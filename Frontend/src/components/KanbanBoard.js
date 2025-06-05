import { kanbanService } from "../services/kanban-service.js";
import { getBoardsCache, updateBoardsCache } from "./DashboardSidebar.js";
import { authService } from "../services/auth-service.js";
import { workspaceService } from "../services/workspace-service.js";
import { showWarningToast } from "./Alert.js";

let saveTimer = null;
const SAVE_DELAY = 15000;
let currentBoardData = null;
let boardChanged = false;

let workspaceMembersCache = null;
let currentWorkspaceIdForCache = null;

let touchDraggingCard = null;
let touchGhostCard = null;
let initialTouchX = 0;
let initialTouchY = 0;
let longPressTimer = null;
let isTouchDragging = false;

function getChecklistStats(task) {
  let totalChecklistItems = 0;
  let completedChecklistItems = 0;
  if (task && task.checklists && task.checklists.length > 0) {
    task.checklists.forEach((checklist) => {
      totalChecklistItems += checklist.items.length;
      checklist.items.forEach((item) => {
        if (item.completed) {
          completedChecklistItems++;
        }
      });
    });
  }
  return { totalChecklistItems, completedChecklistItems };
}

let mentionsDropdown = null;
let currentMentionTextarea = null;
let mentionQuery = "";
let activeMentionIndex = -1;
let mentionStartIndex = -1;

async function getMentionableUsers(query) {
  const lowerCaseQuery = query.toLowerCase();
  let resolvedBoardMembers = [];

  if (
    currentBoardData &&
    currentBoardData.members &&
    currentBoardData.members.length > 0
  ) {
    resolvedBoardMembers = currentBoardData.members;
  } else if (currentBoardData && currentBoardData.workspaceId) {
    if (
      currentBoardData.workspaceId === currentWorkspaceIdForCache &&
      workspaceMembersCache
    ) {
      resolvedBoardMembers = workspaceMembersCache;
    } else {
      try {
        const workspace = await workspaceService.getWorkspace(
          currentBoardData.workspaceId
        );

        if (workspace && workspace.members) {
          resolvedBoardMembers = workspace.members.map((member) => ({
            id: String(member.id),
            username: member.fullName
              ? member.fullName.replace(/\s+/g, "_").toLowerCase()
              : `user_${member.id}`,
            fullName: member.fullName || `User ${member.id}`,
          }));

          workspaceMembersCache = resolvedBoardMembers;
          currentWorkspaceIdForCache = currentBoardData.workspaceId;
        } else {
          workspaceMembersCache = [];
          currentWorkspaceIdForCache = currentBoardData.workspaceId;
          resolvedBoardMembers = [];
        }
      } catch (error) {
        workspaceMembersCache = [];
        currentWorkspaceIdForCache = currentBoardData.workspaceId;
        resolvedBoardMembers = [];
      }
    }
  } else {
    resolvedBoardMembers = [];
  }

  if (!resolvedBoardMembers || resolvedBoardMembers.length === 0) {
    return [];
  }

  return resolvedBoardMembers
    .filter(
      (user) =>
        (user.username &&
          user.username.toLowerCase().includes(lowerCaseQuery)) ||
        (user.fullName && user.fullName.toLowerCase().includes(lowerCaseQuery))
    )
    .slice(0, 5);
}

function createMentionsDropdown() {
  if (!mentionsDropdown) {
    mentionsDropdown = document.createElement("div");
    mentionsDropdown.className = "mentions-dropdown";
    document.body.appendChild(mentionsDropdown);
  }
}

async function showMentionsDropdown(query, textarea) {
  currentMentionTextarea = textarea;
  const users = await getMentionableUsers(query);

  if (users.length > 0) {
    createMentionsDropdown();
    mentionsDropdown.innerHTML = users
      .map(
        (user, index) =>
          `<div class="mention-item" data-index="${index}" data-username="${user.username}" data-fullname="${user.fullName}">
         <span class="mention-item-fullname">${user.fullName}</span>
         <span class="mention-item-username">(@${user.username})</span>
       </div>`
      )
      .join("");
    mentionsDropdown.style.display = "block";
    positionMentionsDropdown(textarea);
    activeMentionIndex = -1;

    mentionsDropdown.querySelectorAll(".mention-item").forEach((item) => {
      item.addEventListener("click", handleMentionItemClick);
    });
  } else {
    hideMentionsDropdown();
  }
}

function hideMentionsDropdown() {
  if (mentionsDropdown) {
    mentionsDropdown.style.display = "none";
    mentionsDropdown.innerHTML = "";
  }
  currentMentionTextarea = null;
  mentionQuery = "";
  activeMentionIndex = -1;
  mentionStartIndex = -1;
}

function handleMentionItemClick(event) {
  const item = event.currentTarget;
  const username = item.dataset.username;
  if (username && currentMentionTextarea && mentionStartIndex !== -1) {
    insertMention(username, currentMentionTextarea);
  }
  hideMentionsDropdown();
}

function insertMention(username, textarea) {
  const text = textarea.value;
  const before = text.substring(0, mentionStartIndex);
  const after = text.substring(textarea.selectionStart);

  textarea.value = before + `@${username} ` + after;
  textarea.focus();
  const cursorPos = mentionStartIndex + username.length + 2;
  textarea.setSelectionRange(cursorPos, cursorPos);

  hideMentionsDropdown();
}

function handleMentionTextareaInput(event) {
  const textarea = event.target;

  const text = textarea.value;
  const cursorPos = textarea.selectionStart;

  let atIndex = -1;

  for (let i = cursorPos - 1; i >= 0; i--) {
    if (text[i] === "@") {
      if (i === 0 || /\s/.test(text[i - 1])) {
        atIndex = i;
        break;
      }
    }
    if (/\s/.test(text[i])) {
      break;
    }
  }

  if (atIndex !== -1) {
    const queryPart = text.substring(atIndex + 1, cursorPos);

    if (queryPart.includes(" ")) {
      hideMentionsDropdown();
      return;
    }
    mentionQuery = queryPart;
    mentionStartIndex = atIndex;
    showMentionsDropdown(mentionQuery, textarea);
  } else {
    hideMentionsDropdown();
  }
}

function handleMentionTextareaKeydown(event) {
  if (!mentionsDropdown || mentionsDropdown.style.display === "none") {
    return;
  }

  const items = mentionsDropdown.querySelectorAll(".mention-item");
  if (items.length === 0) return;

  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      activeMentionIndex = (activeMentionIndex + 1) % items.length;
      updateMentionHighlight(items);
      break;
    case "ArrowUp":
      event.preventDefault();
      activeMentionIndex =
        (activeMentionIndex - 1 + items.length) % items.length;
      updateMentionHighlight(items);
      break;
    case "Enter":
      event.preventDefault();
      if (activeMentionIndex > -1) {
        items[activeMentionIndex].click();
      } else {
        hideMentionsDropdown();
      }
      break;
    case "Escape":
      event.preventDefault();
      hideMentionsDropdown();
      break;
    case "Tab":
      event.preventDefault();
      if (activeMentionIndex > -1) {
        items[activeMentionIndex].click();
      } else if (items.length > 0) {
        items[0].click();
      }
      break;
  }
}

function updateMentionHighlight(items) {
  items.forEach((item, index) => {
    if (index === activeMentionIndex) {
      item.classList.add("selected");
      item.scrollIntoView({ block: "nearest" });
    } else {
      item.classList.remove("selected");
    }
  });
}

document.addEventListener("click", function (event) {
  if (mentionsDropdown && mentionsDropdown.style.display === "block") {
    const isClickInsideTextarea =
      currentMentionTextarea && currentMentionTextarea.contains(event.target);
    const isClickInsideDropdown = mentionsDropdown.contains(event.target);
    if (!isClickInsideTextarea && !isClickInsideDropdown) {
      hideMentionsDropdown();
    }
  }
});

function formatTextWithMentions(text) {
  if (!text) return "";

  const mentionRegex = /@([\p{L}\p{N}_]+)/gu;
  return text.replace(mentionRegex, '<span class="mention-tag">@$1</span>');
}

function getCardUserTaskStatus(task, currentUserIdString) {
  if (
    !task ||
    !task.checklists ||
    task.checklists.length === 0 ||
    !currentUserIdString
  ) {
    return { isAssigned: false, allUserTasksCompleted: false };
  }

  let isUserAssignedToAnyItem = false;
  let allUserAssignedItemsCompleted = true;

  for (const checklist of task.checklists) {
    for (const item of checklist.items) {
      if (
        item.assignedUsers &&
        item.assignedUsers.some(
          (user) => String(user.id) === currentUserIdString
        )
      ) {
        isUserAssignedToAnyItem = true;
        if (!item.completed) {
          allUserAssignedItemsCompleted = false;
        }
      }
    }
  }

  if (!isUserAssignedToAnyItem) {
    return { isAssigned: false, allUserTasksCompleted: false };
  }

  return {
    isAssigned: true,
    allUserTasksCompleted: allUserAssignedItemsCompleted,
  };
}

function updateUserCardHighlight(taskId) {
  const currentUser = authService.getUser();
  const currentUserIdString = currentUser ? String(currentUser.id) : null;

  if (!currentUserIdString) return;

  const cardElement = document.querySelector(
    `.kanban-card[data-task-id="${taskId}"]`
  );
  if (!cardElement) return;

  const boardData = JSON.parse(currentBoardData.boardData);
  const task = findTaskById(boardData, taskId);

  if (!task) return;

  const { isAssigned, allUserTasksCompleted } = getCardUserTaskStatus(
    task,
    currentUserIdString
  );

  cardElement.classList.remove(
    "user-assigned-pending",
    "user-assigned-completed"
  );
  cardElement.removeAttribute("title");

  if (isAssigned) {
    if (allUserTasksCompleted) {
      cardElement.classList.add("user-assigned-completed");
      cardElement.setAttribute(
        "title",
        "Все ваши задачи в этой карточке выполнены."
      );
    } else {
      cardElement.classList.add("user-assigned-pending");
      cardElement.setAttribute(
        "title",
        "За вами закреплены невыполненные задачи в этой карточке."
      );
    }
  }
}

export async function renderKanbanBoard(
  boardId,
  preloadedBoardData = null,
  userRole = null
) {
  let board = preloadedBoardData;

  const currentUser = authService.getUser();
  const currentUserIdString = currentUser ? String(currentUser.id) : null;
  if (preloadedBoardData) {
  }

  const isViewOnly = userRole === "VIEWER";

  if (!board) {
    const boardsMemoryCache = getBoardsCache();
    if (boardsMemoryCache) {
      const cachedBoard = boardsMemoryCache.find((b) => b.id == boardId);
      if (cachedBoard) {
        board = cachedBoard;
      }
    }

    if (!board) {
      const localStorageCache = JSON.parse(
        localStorage.getItem("kanban_boards_cache") || "[]"
      );
      const cachedBoard = localStorageCache.find((b) => b.id == boardId);
      if (cachedBoard) {
        board = cachedBoard;
      }
    }

    if (!board || !board._hasUnsavedChanges) {
      try {

        const serverBoard = await kanbanService.getBoard(boardId);

        if (board && board._hasUnsavedChanges) {
        } else {
          board = serverBoard;

          const boardsCache = getBoardsCache();
          if (boardsCache) {
            const boardIndex = boardsCache.findIndex((b) => b.id == boardId);
            if (boardIndex !== -1) {
              boardsCache[boardIndex] = { ...board };
            } else {
              boardsCache.push({ ...board });
            }
            updateBoardsCache(boardsCache);
          }

          const localStorageCache = JSON.parse(
            localStorage.getItem("kanban_boards_cache") || "[]"
          );
          const boardIndex = localStorageCache.findIndex(
            (b) => b.id == boardId
          );
          if (boardIndex !== -1) {
            localStorageCache[boardIndex] = { ...board };
          } else {
            localStorageCache.push({ ...board });
          }
          localStorage.setItem(
            "kanban_boards_cache",
            JSON.stringify(localStorageCache)
          );
        }
      } catch (error) {
        console.error(`Ошибка при загрузке доски с ID ${boardId}:`, error);

        if (board) {
        } else {
          return `
            <div class="board-container">
              <div class="board-header">
                <h1 class="board-title">Ошибка загрузки</h1>
              </div>
              <p>Не удалось загрузить доску: ${
                error.message || "Неизвестная ошибка"
              }</p>
            </div>
          `;
        }
      }
    } else {
    }
  } else {
  }

  if (!board) {
    return `
      <div class="board-container">
        <div class="board-header">
          <h1 class="board-title">Доска не найдена</h1>
        </div>
        <p>Доска с указанным ID не существует или была удалена</p>
      </div>
    `;
  }

  if (board._hasUnsavedChanges) {
    boardChanged = true;

    setTimeout(() => {
      const saveStatus = document.getElementById("saveStatus");
      if (saveStatus) {
        saveStatus.textContent = "Изменения не сохранены...";
        saveStatus.classList.add("unsaved");
      }
    }, 0);
  } else {
    boardChanged = false;
  }

  currentBoardData = board;

  let boardColumnsData = [];
  try {
    const parsedData = JSON.parse(board.boardData);
    boardColumnsData = parsedData.columns || [];
  } catch (error) {
    boardColumnsData = [];
  }

  const columnsHtml = boardColumnsData
    .map((column, index) => {
      const cardsHtml = column.tasks
        .filter((task) => !task.archived)
        .map((task) => {
          const commentsCount = task.comments ? task.comments.length : 0;
          const hasDescription =
            task.description && task.description.trim() !== "";
          const isCompleted = task.completed ? "completed" : "";
          const checkboxClass = task.completed ? "checked" : "";

          const { totalChecklistItems, completedChecklistItems } =
            getChecklistStats(task);

          let userHighlightClass = "";
          let userTaskStatusTitle = "";
          if (currentUserIdString) {
            const userTaskStatus = getCardUserTaskStatus(
              task,
              currentUserIdString
            );
            if (userTaskStatus.isAssigned) {
              userHighlightClass = userTaskStatus.allUserTasksCompleted
                ? "user-assigned-completed"
                : "user-assigned-pending";
              userTaskStatusTitle = userTaskStatus.allUserTasksCompleted
                ? "Все ваши задачи в этой карточке выполнены."
                : "За вами закреплены невыполненные задачи в этой карточке.";
            }
          }

          return `
      <div class="kanban-card ${isCompleted} ${userHighlightClass}" draggable="${!isViewOnly}" data-task-id="${
            task.id
          }" ${userTaskStatusTitle ? `title="${userTaskStatusTitle}"` : ""}>
        <div class="card-checkbox ${checkboxClass}" data-task-id="${
            task.id
          }"></div>
        <div class="card-content">
          <div class="card-title">${task.title}</div>
          <div class="card-indicators">
            ${
              hasDescription
                ? `<div class="card-indicator description-indicator" title="Карточка содержит описание">
                <i class="fas fa-align-left"></i>
              </div>`
                : ""
            }
            ${
              commentsCount > 0
                ? `<div class="card-indicator comments-indicator" title="Комментарии: ${commentsCount}">
                <i class="fas fa-comment"></i>
                <span class="indicator-count">${commentsCount}</span>
              </div>`
                : ""
            }
            ${
              totalChecklistItems > 0
                ? `<div class="card-indicator checklist-indicator" title="Чек-лист: ${completedChecklistItems}/${totalChecklistItems}">
                <i class="fas fa-list-check"></i>
                <span class="indicator-count">${completedChecklistItems}/${totalChecklistItems}</span>
              </div>`
                : ""
            }
          </div>
        </div>
      </div>
    `;
        })
        .join("");

      return `
      <div class="kanban-column" data-column-id="${column.id}">
        <div class="column-header">
          <div class="column-title-container">
            <h3 class="column-title" data-column-id="${column.id}">${
        column.name
      }</h3>
          </div>
          ${
            !isViewOnly
              ? `
          <div class="column-actions">
            <button class="column-menu-btn" data-column-id="${column.id}">⋮</button>
            <div class="column-menu" data-column-id="${column.id}">
              <div class="column-menu-item" data-action="edit" data-column-id="${column.id}">Редактировать</div>
              <div class="column-menu-item" data-action="copy" data-column-id="${column.id}">Копировать</div>
              <div class="column-menu-item" data-action="delete" data-column-id="${column.id}">Удалить</div>
            </div>
          </div>
          `
              : ""
          }
        </div>
        <div class="column-cards" data-column-id="${column.id}">
          ${cardsHtml}
        </div>
        ${
          !isViewOnly
            ? `
        <div class="column-footer">
          <button class="add-card-btn" data-column-id="${column.id}">+ Добавить карточку</button>
        </div>
        `
            : ""
        }
      </div>
    `;
    })
    .join("");

  let archivedCards = [];
  boardColumnsData.forEach((column) => {
    column.tasks.forEach((task) => {
      if (task.archived) {
        archivedCards.push({
          ...task,
          columnName: column.name,
          columnId: column.id,
        });
      }
    });
  });

  return `
    <div class="board-container">
      <div class="board-header">
        <h1 class="board-title">${board.name}</h1>
        <div class="board-actions">
          <div id="saveStatus" class="save-status">Все изменения сохранены</div>
          <input 
            type="text" 
            id="kanban-search-input" 
            class="kanban-search-input"
            placeholder="Поиск по карточкам..." 
          />
          ${
            !isViewOnly
              ? `
          <button class="btn-secondary" id="editBoardButton"><i class="fas fa-archive"></i> <span>Архив карточек</span></button>
          `
              : ""
          }
        </div>
      </div>
      
      <div class="kanban-board" id="kanbanBoard" data-board-id="${boardId}" ${
    isViewOnly ? 'data-view-only="true"' : ""
  }>
        ${columnsHtml}
        ${
          !isViewOnly
            ? `
        <div class="add-column-container">
          <button class="add-column-btn" id="addColumnBtn">+ Добавить колонку</button>
        </div>
        `
            : ""
        }
      </div>
      <div class="archive-sidebar" id="archiveSidebar">
        <div class="archive-sidebar-header">
          <span>Архив карточек</span>
          <button class="archive-sidebar-close" id="closeArchiveSidebar">&times;</button>
        </div>
        <div class="archive-sidebar-content">
          ${
            archivedCards.length === 0
              ? '<div class="archive-empty">Нет архивированных карточек</div>'
              : archivedCards
                  .map(
                    (card) => `
            <div class="archive-card" data-task-id="${card.id}">
              <div class="archive-card-title">${card.title}</div>
              <div class="archive-card-meta">Колонка: <b>${card.columnName}</b></div>
              <div class="archive-card-actions">
                <button class="archive-unarchive-btn" data-task-id="${card.id}" data-column-id="${card.columnId}">Восстановить</button>
              </div>
            </div>
          `
                  )
                  .join("")
          }
        </div>
      </div>
      <div class="archive-sidebar-backdrop" id="archiveSidebarBackdrop"></div>
    </div>
  `;
}

export function setupBoardEventListeners(
  boardId,
  onBoardDeleted,
  userRole = null
) {
  const isViewOnly = userRole === "VIEWER";

  if (isViewOnly) {

    const board = document.getElementById("kanbanBoard");
    if (board) {
      board.classList.add("view-only-mode");
    }
    return;
  }

  const deleteBoardButton = document.getElementById("deleteBoardButton");
  if (deleteBoardButton) {
    deleteBoardButton.addEventListener("click", () => {
      deleteBoard(boardId, onBoardDeleted);
    });
  }

  const addColumnBtn = document.getElementById("addColumnBtn");
  if (addColumnBtn) {
    addColumnBtn.addEventListener("click", () => {
      addNewColumn();
    });
  }

  const addCardBtns = document.querySelectorAll(".add-card-btn");
  addCardBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const columnId = e.target.getAttribute("data-column-id");
      addNewCard(columnId);
    });
  });

  const columnTitles = document.querySelectorAll(".column-title-container");
  columnTitles.forEach((titleContainer) => {
    titleContainer.addEventListener("click", (e) => {
      const titleElement = titleContainer.querySelector(".column-title");
      if (titleElement) {
        const columnId = titleElement.getAttribute("data-column-id");
        startEditColumnTitle(titleElement, columnId);
      }
    });
  });

  const columnMenuBtns = document.querySelectorAll(".column-menu-btn");
  columnMenuBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const columnId = e.target.getAttribute("data-column-id");
      const menu = document.querySelector(
        `.column-menu[data-column-id="${columnId}"]`
      );

      document.querySelectorAll(".column-menu.active").forEach((m) => {
        if (m !== menu) m.classList.remove("active");
      });

      menu.classList.toggle("active");
    });
  });

  document.addEventListener("click", (e) => {
    if (
      !e.target.closest(".column-menu") &&
      !e.target.closest(".column-menu-btn")
    ) {
      document.querySelectorAll(".column-menu.active").forEach((menu) => {
        menu.classList.remove("active");
      });
    }
  });

  document.querySelectorAll(".column-menu-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      const action = e.target.getAttribute("data-action");
      const columnId = e.target.getAttribute("data-column-id");

      if (action === "edit") {
        const titleElement = document.querySelector(
          `.column-title[data-column-id="${columnId}"]`
        );
        if (titleElement) {
          startEditColumnTitle(titleElement, columnId);
        }
      } else if (action === "copy") {
        copyColumn(columnId);
      } else if (action === "delete") {
        deleteColumn(columnId);
      }

      const menu = e.target.closest(".column-menu");
      if (menu) menu.classList.remove("active");
    });
  });

  const cardEditBtns = document.querySelectorAll(".card-edit-btn");
  cardEditBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const taskId = e.target.getAttribute("data-task-id");
      editCard(taskId);
    });
  });

  const cardDeleteBtns = document.querySelectorAll(".card-delete-btn");
  cardDeleteBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const taskId = e.target.getAttribute("data-task-id");
      deleteCard(taskId);
    });
  });

  const cards = document.querySelectorAll(".kanban-card");
  cards.forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".card-actions, .card-edit-btn, .card-delete-btn")) {
        return;
      }

      if (e.target.classList.contains("card-checkbox")) {
        return;
      }

      const taskId = card.getAttribute("data-task-id");
      openCardDetailModal(taskId);
    });

    const checkbox = card.querySelector(".card-checkbox");
    if (checkbox) {
      checkbox.addEventListener("click", (e) => {
        e.stopPropagation();
        const taskId = e.target.getAttribute("data-task-id");
        toggleTaskCompletion(taskId);
      });
    }
  });

  setupDragAndDrop();

  setupColumnDragAndDrop();

  window.removeEventListener("beforeunload", handleBeforeUnload);

  window.addEventListener("beforeunload", handleBeforeUnload);

  const archiveBtn = document.getElementById("editBoardButton");
  const archiveSidebar = document.getElementById("archiveSidebar");
  const archiveBackdrop = document.getElementById("archiveSidebarBackdrop");
  if (archiveBtn && archiveSidebar && archiveBackdrop) {
    archiveBtn.addEventListener("click", () => {
      archiveSidebar.classList.add("open");
      archiveBackdrop.classList.add("active");
      renderArchiveSidebarContent();
    });
    archiveBackdrop.addEventListener("click", () => {
      archiveSidebar.classList.remove("open");
      archiveBackdrop.classList.remove("active");
    });
    const closeBtn = document.getElementById("closeArchiveSidebar");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        archiveSidebar.classList.remove("open");
        archiveBackdrop.classList.remove("active");
      });
    }

    archiveSidebar.querySelectorAll(".archive-unarchive-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const taskId = btn.getAttribute("data-task-id");
        const columnId = btn.getAttribute("data-column-id");
        unarchiveCard(taskId, columnId);
      });
    });
  }

  const searchInput = document.getElementById("kanban-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      filterKanbanCards(searchInput.value);
    });
  }
}

function handleBeforeUnload(e) {
  if (boardChanged) {
    const message =
      "У вас есть несохраненные изменения. Вы уверены, что хотите покинуть страницу?";
    e.returnValue = message;
    forceSaveBoardData();
    return message;
  }
}

function setupDragAndDrop() {
  const cards = document.querySelectorAll(".kanban-card");
  const dropZones = document.querySelectorAll(".column-cards");

  cards.forEach((card) => {
    card.addEventListener("dragstart", handleDragStart);
    card.addEventListener("dragend", handleDragEnd);

    card.addEventListener("dragover", handleDragOver);
    card.addEventListener("dragleave", handleDragLeave);

    card.addEventListener("touchstart", handleTouchStart, { passive: false });
  });

  dropZones.forEach((zone) => {
    zone.addEventListener("dragover", handleDragOver);
    zone.addEventListener("dragenter", handleDragEnter);
    zone.addEventListener("dragleave", handleDragLeave);
    zone.addEventListener("drop", handleDrop);
  });
}

function handleDragStart(e) {
  if (e.target.closest(".column-header")) return;

  e.dataTransfer.setData("text/plain", e.target.getAttribute("data-task-id"));
  e.dataTransfer.setData("dragging-type", "card");
  e.target.classList.add("dragging");

  const sourceColumnId = e.target
    .closest(".column-cards")
    .getAttribute("data-column-id");
  e.dataTransfer.setData("source-column", sourceColumnId);

  const board = document.getElementById("kanbanBoard");
  if (board) {
    board.setAttribute("data-dragging", "card");
  }
}

function handleDragEnd(e) {
  e.target.classList.remove("dragging");

  document
    .querySelectorAll(".card-drop-indicator")
    .forEach((el) => el.remove());
  document
    .querySelectorAll(".drag-over")
    .forEach((el) => el.classList.remove("drag-over"));

  const board = document.getElementById("kanbanBoard");
  if (board) {
    board.removeAttribute("data-dragging");
  }
}

function handleDragOver(e) {
  e.preventDefault();

  const board = document.getElementById("kanbanBoard");
  if (!board || board.getAttribute("data-dragging") !== "card") return;

  if (board.classList.contains("dragging-column")) return;

  const cardElement = e.target.closest(".kanban-card");
  const columnElement = e.target.closest(".column-cards");

  const isDropIndicator = e.target.classList.contains("card-drop-indicator");
  if (isDropIndicator) {
    return;
  }

  const existingIndicator = columnElement?.querySelector(
    ".card-drop-indicator"
  );

  if (!cardElement && existingIndicator) {
    return;
  }

  document
    .querySelectorAll(".card-drop-indicator")
    .forEach((el) => el.remove());
  document
    .querySelectorAll(".drag-over-top, .drag-over-bottom")
    .forEach((el) => {
      el.classList.remove("drag-over-top", "drag-over-bottom");
    });

  if (columnElement) {
    columnElement.classList.add("drag-over");
  }

  if (!cardElement) {
    return;
  }

  if (cardElement.classList.contains("dragging")) {
    return;
  }

  const rect = cardElement.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const isBottomHalf = y > rect.height / 2;

  const indicator = document.createElement("div");
  indicator.className = "card-drop-indicator";

  if (isBottomHalf) {
    cardElement.after(indicator);
  } else {
    cardElement.before(indicator);
  }
}

function handleDragEnter(e) {
  e.preventDefault();

  const board = document.getElementById("kanbanBoard");
  if (
    !board ||
    board.getAttribute("data-dragging") !== "card" ||
    board.classList.contains("dragging-column")
  )
    return;

  const columnElement = e.target.closest(".column-cards");
  if (columnElement) {
    columnElement.classList.add("drag-over");
  }
}

function handleDragLeave(e) {
  const board = document.getElementById("kanbanBoard");
  if (
    !board ||
    board.getAttribute("data-dragging") !== "card" ||
    board.classList.contains("dragging-column")
  )
    return;

  const columnElement = e.currentTarget;
  const relatedTarget = e.relatedTarget;

  if (!columnElement.contains(relatedTarget)) {
    columnElement.classList.remove("drag-over");
  }
}

function handleDrop(e) {
  e.preventDefault();

  const board = document.getElementById("kanbanBoard");
  if (!board || board.getAttribute("data-dragging") !== "card") return;

  document
    .querySelectorAll(".drag-over")
    .forEach((el) => el.classList.remove("drag-over"));

  const taskId = e.dataTransfer.getData("text/plain");
  const sourceColumnId = e.dataTransfer.getData("source-column");
  const targetColumnId = e.currentTarget.getAttribute("data-column-id");

  const draggedCard = document.querySelector(
    `.kanban-card[data-task-id="${taskId}"]`
  );
  if (!draggedCard) return;

  const dropIndicator = document.querySelector(".card-drop-indicator");

  const cardElement = e.target.closest(".kanban-card");

  if (sourceColumnId !== targetColumnId) {
    if (dropIndicator) {
      dropIndicator.parentNode.insertBefore(draggedCard, dropIndicator);
    } else if (cardElement && cardElement !== draggedCard) {
      const rect = cardElement.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const isBottomHalf = y > rect.height / 2;

      if (isBottomHalf) {
        cardElement.after(draggedCard);
      } else {
        cardElement.before(draggedCard);
      }
    } else {
      e.currentTarget.appendChild(draggedCard);
    }

    moveCardBetweenColumns(taskId, sourceColumnId, targetColumnId);

    updateCardOrderInColumn(targetColumnId);
  } else {
    if (dropIndicator) {
      dropIndicator.parentNode.insertBefore(draggedCard, dropIndicator);
    } else if (cardElement && cardElement !== draggedCard) {
      const rect = cardElement.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const isBottomHalf = y > rect.height / 2;

      if (isBottomHalf) {
        cardElement.after(draggedCard);
      } else {
        cardElement.before(draggedCard);
      }
    } else if (!cardElement || e.currentTarget.children.length === 0) {
      e.currentTarget.appendChild(draggedCard);
    }

    updateCardOrderInColumn(sourceColumnId);
  }

  document
    .querySelectorAll(".card-drop-indicator")
    .forEach((el) => el.remove());

  draggedCard.classList.remove("dragging");

  board.removeAttribute("data-dragging");
}

function moveCardBetweenColumns(taskId, sourceColumnId, targetColumnId) {
  try {
    const boardData = JSON.parse(currentBoardData.boardData);

    const sourceColumnIndex = boardData.columns.findIndex(
      (col) => col.id === sourceColumnId
    );
    const targetColumnIndex = boardData.columns.findIndex(
      (col) => col.id === targetColumnId
    );

    if (sourceColumnIndex === -1 || targetColumnIndex === -1) {
      return;
    }

    const taskIndex = boardData.columns[sourceColumnIndex].tasks.findIndex(
      (task) => task.id === taskId
    );
    if (taskIndex === -1) {
      return;
    }

    const task = boardData.columns[sourceColumnIndex].tasks.splice(
      taskIndex,
      1
    )[0];

    const targetColumnCards = document.querySelector(
      `.column-cards[data-column-id="${targetColumnId}"]`
    );
    const cardElements = targetColumnCards.querySelectorAll(".kanban-card");

    const newTasks = [];
    let taskAdded = false;

    cardElements.forEach((card) => {
      const cardId = card.getAttribute("data-task-id");

      if (cardId === taskId) {
        taskAdded = true;
        newTasks.push(task);
      } else {
        const existingTask = boardData.columns[targetColumnIndex].tasks.find(
          (t) => t.id === cardId
        );
        if (existingTask) {
          newTasks.push(existingTask);
        }
      }
    });

    boardData.columns[targetColumnIndex].tasks = newTasks;

    updateBoardData(boardData);
  } catch (error) {
    console.error("Ошибка при перемещении карточки:", error);
  }
}

function updateCardOrderInColumn(columnId) {
  try {
    const boardData = JSON.parse(currentBoardData.boardData);

    const columnIndex = boardData.columns.findIndex(
      (col) => col.id === columnId
    );
    if (columnIndex === -1) {
      console.error("Не удалось найти колонку");
      return;
    }

    const columnCards = document.querySelector(
      `.column-cards[data-column-id="${columnId}"]`
    );
    const cardElements = columnCards.querySelectorAll(".kanban-card");

    const newTasks = [];
    cardElements.forEach((card) => {
      const taskId = card.getAttribute("data-task-id");
      const task = boardData.columns[columnIndex].tasks.find(
        (t) => t.id === taskId
      );
      if (task) {
        newTasks.push(task);
      }
    });

    boardData.columns[columnIndex].tasks = newTasks;

    updateBoardData(boardData);
  } catch (error) {
  }
}

async function editBoard(boardId) {
  try {
    const board = await kanbanService.getBoard(boardId);

    const newName = prompt("Введите новое название доски:", board.name);

    if (newName === null) return;
    if (newName.trim() === "") {
      alert("Название доски не может быть пустым");
      return;
    }

    const updateData = {
      name: newName,
      boardData: board.boardData,
    };

    await kanbanService.updateBoard(boardId, updateData);

    window.location.reload();
  } catch (error) {
    alert(
      "Не удалось обновить доску: " + (error.message || "Неизвестная ошибка")
    );
  }
}

async function deleteBoard(boardId, onBoardDeleted) {
  if (boardChanged) {
    const saveFirst = window.confirm(
      "Доска содержит несохраненные изменения. Сохранить перед удалением?"
    );
    if (saveFirst) {
      await saveBoardData();
    }
  }

  const confirmed = window.confirm(
    "Вы уверены, что хотите удалить эту доску? Это действие нельзя отменить."
  );

  if (!confirmed) return;

  try {

    await kanbanService.deleteBoard(boardId);

    const cachedBoards = JSON.parse(
      localStorage.getItem("kanban_boards_cache") || "[]"
    );
    const updatedCache = cachedBoards.filter((board) => board.id != boardId);
    localStorage.setItem("kanban_boards_cache", JSON.stringify(updatedCache));

    const currentCache = getBoardsCache();
    if (currentCache) {
      const updatedMemoryCache = currentCache.filter(
        (board) => board.id != boardId
      );
      updateBoardsCache(updatedMemoryCache);
    }

    if (typeof onBoardDeleted === "function") {
      onBoardDeleted();
    } else {

      window.location.hash = "/dashboard";
    }
  } catch (error) {
    alert(
      "Не удалось удалить доску: " + (error.message || "Неизвестная ошибка")
    );
  }
}

function addNewColumn() {
  const kanbanBoard = document.getElementById("kanbanBoard");
  if (!kanbanBoard) return;
  if (kanbanBoard.querySelector(".add-column-form-container")) return;

  const addColumnContainer = kanbanBoard.querySelector(".add-column-container");
  if (!addColumnContainer) return;

  addColumnContainer.style.display = "none";

  const formContainer = document.createElement("div");
  formContainer.className = "add-column-form-container";
  formContainer.innerHTML = `
    <form class="add-column-form">
      <input type="text" class="add-column-input" placeholder="Название колонки" required autofocus />
      <div class="add-column-form-actions">
        <button type="submit" class="add-column-submit-btn">Добавить колонку</button>
        <button type="button" class="add-column-cancel-btn">&#10006;</button>
      </div>
    </form>
  `;

  kanbanBoard.insertBefore(formContainer, addColumnContainer);

  const input = formContainer.querySelector(".add-column-input");
  const submitBtn = formContainer.querySelector(".add-column-submit-btn");
  const cancelBtn = formContainer.querySelector(".add-column-cancel-btn");
  const form = formContainer.querySelector(".add-column-form");

  input.focus();

  const handleAdd = (e) => {
    e.preventDefault();
    const columnName = input.value.trim();
    if (!columnName) return;
    actuallyAddColumn(columnName);
    cleanup();
  };

  const handleCancel = (e) => {
    e.preventDefault();
    cleanup();
  };

  function cleanup() {
    formContainer.remove();
    addColumnContainer.style.display = "";
  }

  function actuallyAddColumn(columnName) {
    try {
      const columnId = "column_" + Date.now();
      const boardData = JSON.parse(currentBoardData.boardData);

      boardData.columns.push({
        id: columnId,
        name: columnName,
        tasks: [],
      });

      updateBoardData(boardData);

      const newColumnHtml = `
        <div class="kanban-column" data-column-id="${columnId}">
          <div class="column-header">
            <div class="column-title-container">
              <h3 class="column-title" data-column-id="${columnId}">${columnName}</h3>
            </div>
            <div class="column-actions">
              <button class="column-menu-btn" data-column-id="${columnId}">⋮</button>
              <div class="column-menu" data-column-id="${columnId}">
                <div class="column-menu-item" data-action="edit" data-column-id="${columnId}">Редактировать</div>
                <div class="column-menu-item" data-action="copy" data-column-id="${columnId}">Копировать</div>
                <div class="column-menu-item" data-action="delete" data-column-id="${columnId}">Удалить</div>
              </div>
            </div>
          </div>
          <div class="column-cards" data-column-id="${columnId}">
            <!-- Карточки будут здесь -->
          </div>
          <div class="column-footer">
            <button class="add-card-btn" data-column-id="${columnId}">+ Добавить карточку</button>
          </div>
        </div>
      `;

      const newColumn = document.createElement("div");
      newColumn.innerHTML = newColumnHtml;
      kanbanBoard.insertBefore(newColumn.firstElementChild, addColumnContainer);

      const newColumnElement = kanbanBoard.querySelector(
        `.kanban-column[data-column-id="${columnId}"]`
      );
      if (newColumnElement) {
        setupColumnEventListeners(newColumnElement);
      }
    } catch (error) {
      console.error("Ошибка при добавлении колонки:", error);
      alert("Не удалось добавить колонку: " + error.message);
    }
  }

  form.addEventListener("submit", handleAdd);
  cancelBtn.addEventListener("click", handleCancel);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      handleCancel(e);
    }
  });
}

function startEditColumnTitle(titleElement, columnId) {
  const titleContainer = titleElement.closest(".column-title-container");
  if (!titleContainer) return;

  const currentName = titleElement.textContent;

  const inputElement = document.createElement("input");
  inputElement.type = "text";
  inputElement.value = currentName;
  inputElement.className = "column-title-edit";
  inputElement.setAttribute("data-column-id", columnId);

  titleContainer.innerHTML = "";
  titleContainer.appendChild(inputElement);

  inputElement.focus();
  inputElement.select();

  const handleClickOutside = (e) => {
    if (e.target !== inputElement) {
      finishEditColumnTitle(inputElement, titleContainer, columnId);
      document.removeEventListener("click", handleClickOutside);
    }
  };

  const handleEnterKey = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      finishEditColumnTitle(inputElement, titleContainer, columnId);
      inputElement.removeEventListener("keydown", handleEnterKey);
    }

    if (e.key === "Escape") {
      e.preventDefault();

      restoreColumnTitle(titleContainer, columnId, currentName);
      inputElement.removeEventListener("keydown", handleEnterKey);
      setTimeout(() => {
        document.removeEventListener("click", handleClickOutside);
      }, 10);
    }
  };

  setTimeout(() => {
    document.addEventListener("click", handleClickOutside);
  }, 10);

  inputElement.addEventListener("keydown", handleEnterKey);
}

function restoreColumnTitle(titleContainer, columnId, title) {
  const h3 = document.createElement("h3");
  h3.className = "column-title";
  h3.setAttribute("data-column-id", columnId);
  h3.textContent = title;

  titleContainer.innerHTML = "";
  titleContainer.appendChild(h3);
}

function finishEditColumnTitle(inputElement, titleContainer, columnId) {
  const newName = inputElement.value.trim();

  if (newName !== "") {
    try {
      const boardData = JSON.parse(currentBoardData.boardData);

      const columnIndex = boardData.columns.findIndex(
        (column) => column.id === columnId
      );
      if (columnIndex === -1) {

        const defaultValue = inputElement.defaultValue || "Колонка";
        restoreColumnTitle(titleContainer, columnId, defaultValue);
        return;
      }

      const currentName = boardData.columns[columnIndex].name;

      if (newName === currentName) {
        restoreColumnTitle(titleContainer, columnId, currentName);
        return;
      }

      boardData.columns[columnIndex].name = newName;

      updateBoardData(boardData);

      restoreColumnTitle(titleContainer, columnId, newName);
    } catch (error) {
      alert("Не удалось отредактировать колонку: " + error.message);

      const boardData = JSON.parse(currentBoardData.boardData);
      const columnIndex = boardData.columns.findIndex(
        (column) => column.id === columnId
      );
      if (columnIndex !== -1) {
        restoreColumnTitle(
          titleContainer,
          columnId,
          boardData.columns[columnIndex].name
        );
      } else {
        const defaultValue = inputElement.defaultValue || "Колонка";
        restoreColumnTitle(titleContainer, columnId, defaultValue);
      }
    }
  } else {
    const boardData = JSON.parse(currentBoardData.boardData);
    const columnIndex = boardData.columns.findIndex(
      (column) => column.id === columnId
    );
    if (columnIndex !== -1) {
      restoreColumnTitle(
        titleContainer,
        columnId,
        boardData.columns[columnIndex].name
      );
    } else {
      const defaultValue = inputElement.defaultValue || "Колонка";
      restoreColumnTitle(titleContainer, columnId, defaultValue);
    }
  }
}

function deleteColumn(columnId) {
  const confirmed = window.confirm(
    "Вы уверены, что хотите удалить эту колонку? Все карточки в колонке будут удалены."
  );
  if (!confirmed) return;

  try {
    const boardData = JSON.parse(currentBoardData.boardData);

    const columnIndex = boardData.columns.findIndex(
      (column) => column.id === columnId
    );
    if (columnIndex === -1) {
      console.error("Колонка не найдена");
      return;
    }

    boardData.columns.splice(columnIndex, 1);

    updateBoardData(boardData);

    const columnElement = document.querySelector(
      `.kanban-column[data-column-id="${columnId}"]`
    );
    if (columnElement) {
      columnElement.remove();
    }
  } catch (error) {
    console.error("Ошибка при удалении колонки:", error);
    alert("Не удалось удалить колонку: " + error.message);
  }
}

function addNewCard(columnId) {
  const columnElement = document.querySelector(
    `.kanban-column[data-column-id="${columnId}"]`
  );
  const columnFooter = columnElement.querySelector(".column-footer");
  const addCardBtn = columnFooter.querySelector(".add-card-btn");

  const existingForm = columnElement.querySelector(".add-card-form-container");
  if (existingForm) {
    existingForm.remove();
    addCardBtn.style.display = "";
    return;
  }

  addCardBtn.style.display = "none";

  const formContainer = document.createElement("div");
  formContainer.className = "add-card-form-container";

  columnFooter.appendChild(formContainer);

  formContainer.innerHTML = `
    <div class="add-card-form">
      <textarea class="card-input" placeholder="Введите название или вставьте ссылку"></textarea>
      <div class="add-card-form-actions">
        <button class="add-card-submit-btn">Добавить карточку</button>
        <button class="add-card-cancel-btn">&#10006;</button>
      </div>
    </div>
  `;

  const textarea = formContainer.querySelector(".card-input");
  const submitBtn = formContainer.querySelector(".add-card-submit-btn");
  const cancelBtn = formContainer.querySelector(".add-card-cancel-btn");

  textarea.focus();

  submitBtn.addEventListener("click", () => {
    const cardTitle = textarea.value.trim();
    if (!cardTitle) return;

    submitNewCard(columnId, cardTitle);

    formContainer.remove();
    addCardBtn.style.display = "";
  });

  cancelBtn.addEventListener("click", () => {
    formContainer.remove();
    addCardBtn.style.display = "";
  });

  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const cardTitle = textarea.value.trim();
      if (cardTitle) {
        submitNewCard(columnId, cardTitle);

        formContainer.remove();
        addCardBtn.style.display = "";
      }
    } else if (e.key === "Escape") {
      formContainer.remove();
      addCardBtn.style.display = "";
    }
  });
}

function submitNewCard(columnId, cardTitle) {
  try {
    const cardDescription = "";

    const taskId = "task_" + Date.now();

    const newTask = {
      id: taskId,
      title: cardTitle,
      description: cardDescription,
      createdAt: new Date().toISOString(),
      completed: false,
    };

    const boardData = JSON.parse(currentBoardData.boardData);

    const columnIndex = boardData.columns.findIndex(
      (column) => column.id === columnId
    );
    if (columnIndex === -1) {
      console.error("Колонка не найдена");
      return;
    }

    boardData.columns[columnIndex].tasks.push(newTask);

    updateBoardData(boardData);

    const columnCards = document.querySelector(
      `.column-cards[data-column-id="${columnId}"]`
    );
    if (columnCards) {
      const cardHtml = `
        <div class="kanban-card" draggable="true" data-task-id="${taskId}">
          <div class="card-checkbox" data-task-id="${taskId}"></div>
          <div class="card-content">
            <div class="card-title">${cardTitle}</div>
            <div class="card-indicators">
              <!-- Индикаторы будут добавлены, когда появятся описание или комментарии -->
              <!-- Для новой карточки чек-листов нет, поэтому getChecklistStats вернет 0/0 и индикатор не отобразится -->
            </div>
          </div>
        </div>
      `;

      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = cardHtml;
      const cardElement = tempDiv.firstElementChild;
      columnCards.appendChild(cardElement);

      cardElement.addEventListener("dragstart", handleDragStart);
      cardElement.addEventListener("dragend", handleDragEnd);
      cardElement.addEventListener("dragover", handleDragOver);
      cardElement.addEventListener("dragleave", handleDragLeave);

      const checkbox = cardElement.querySelector(".card-checkbox");
      if (checkbox) {
        checkbox.addEventListener("click", (e) => {
          e.stopPropagation();
          const taskId = e.target.getAttribute("data-task-id");
          toggleTaskCompletion(taskId);
        });
      }

      cardElement.addEventListener("click", (e) => {
        if (e.target.classList.contains("card-checkbox")) {
          return;
        }
        const taskId = cardElement.getAttribute("data-task-id");
        openCardDetailModal(taskId);
      });
    }
  } catch (error) {
    console.error("Ошибка при добавлении карточки:", error);
    alert("Не удалось добавить карточку: " + error.message);
  }
}

function editCard(taskId) {
  try {
    const boardData = JSON.parse(currentBoardData.boardData);

    let foundTask = null;
    let columnIndex = -1;
    let taskIndex = -1;

    for (let i = 0; i < boardData.columns.length; i++) {
      const column = boardData.columns[i];
      const tIndex = column.tasks.findIndex((task) => task.id === taskId);

      if (tIndex !== -1) {
        columnIndex = i;
        taskIndex = tIndex;
        foundTask = column.tasks[tIndex];
        break;
      }
    }

    if (!foundTask) {
      console.error("Карточка не найдена");
      return;
    }

    const cardElement = document.querySelector(
      `.kanban-card[data-task-id="${taskId}"]`
    );
    if (!cardElement) {
      console.error("Элемент карточки не найден в DOM");
      return;
    }

    const originalContent = cardElement.innerHTML;

    cardElement.innerHTML = `
      <div class="edit-card-form">
        <textarea class="card-title-input" placeholder="Название карточки">${
          foundTask.title
        }</textarea>
        <textarea class="card-description-input" placeholder="Описание (необязательно)">${
          foundTask.description || ""
        }</textarea>
        <div class="edit-card-actions">
          <button class="edit-card-save-btn">Сохранить</button>
          <button class="edit-card-cancel-btn">Отмена</button>
        </div>
      </div>
    `;

    cardElement.classList.add("editing");

    const titleInput = cardElement.querySelector(".card-title-input");
    const descriptionInput = cardElement.querySelector(
      ".card-description-input"
    );
    const saveBtn = cardElement.querySelector(".edit-card-save-btn");
    const cancelBtn = cardElement.querySelector(".edit-card-cancel-btn");

    titleInput.focus();
    titleInput.select();

    saveBtn.addEventListener("click", () => {
      const newTitle = titleInput.value.trim();
      const newDescription = descriptionInput.value.trim();

      if (!newTitle) {
        alert("Название карточки не может быть пустым");
        return;
      }

      if (
        newTitle === foundTask.title &&
        newDescription === foundTask.description
      ) {
        cardElement.innerHTML = originalContent;
        cardElement.classList.remove("editing");
        return;
      }

      boardData.columns[columnIndex].tasks[taskIndex].title = newTitle;
      boardData.columns[columnIndex].tasks[taskIndex].description =
        newDescription;
      boardData.columns[columnIndex].tasks[taskIndex].updatedAt =
        new Date().toISOString();

      updateBoardData(boardData);

      const commentsCount = boardData.columns[columnIndex].tasks[taskIndex]
        .comments
        ? boardData.columns[columnIndex].tasks[taskIndex].comments.length
        : 0;
      const hasDescription = newDescription !== "";

      const { totalChecklistItems, completedChecklistItems } =
        getChecklistStats(boardData.columns[columnIndex].tasks[taskIndex]);

      cardElement.classList.remove("editing");
      cardElement.innerHTML = `
        <div class="card-checkbox ${
          foundTask.completed ? "checked" : ""
        }" data-task-id="${taskId}"></div>
        <div class="card-content">
          <div class="card-title">${newTitle}</div>
          <div class="card-indicators">
            ${
              hasDescription
                ? `<div class="card-indicator description-indicator" title="Карточка содержит описание">
                <i class="fas fa-align-left"></i>
              </div>`
                : ""
            }
            ${
              commentsCount > 0
                ? `<div class="card-indicator comments-indicator" title="Комментарии: ${commentsCount}">
                <i class="fas fa-comment"></i>
                <span class="indicator-count">${commentsCount}</span>
              </div>`
                : ""
            }
            ${
              totalChecklistItems > 0
                ? `<div class="card-indicator checklist-indicator" title="Чек-лист: ${completedChecklistItems}/${totalChecklistItems}">
                <i class="fas fa-list-check"></i>
                <span class="indicator-count">${completedChecklistItems}/${totalChecklistItems}</span>
              </div>`
                : ""
            }
          </div>
        </div>
      `;

      cardElement.addEventListener("dragstart", handleDragStart);
      cardElement.addEventListener("dragend", handleDragEnd);
      cardElement.addEventListener("dragover", handleDragOver);
      cardElement.addEventListener("dragleave", handleDragLeave);

      const checkbox = cardElement.querySelector(".card-checkbox");
      if (checkbox) {
        checkbox.addEventListener("click", (e) => {
          e.stopPropagation();
          toggleTaskCompletion(taskId);
        });
      }

      cardElement.addEventListener("click", (e) => {
        if (e.target.classList.contains("card-checkbox")) {
          return;
        }
        openCardDetailModal(taskId);
      });
    });

    cancelBtn.addEventListener("click", () => {
      cardElement.innerHTML = originalContent;
      cardElement.classList.remove("editing");

      cardElement.addEventListener("dragstart", handleDragStart);
      cardElement.addEventListener("dragend", handleDragEnd);
      cardElement.addEventListener("dragover", handleDragOver);
      cardElement.addEventListener("dragleave", handleDragLeave);

      cardElement.addEventListener("click", (e) => {
        if (e.target.classList.contains("card-checkbox")) {
          return;
        }
        openCardDetailModal(taskId);
      });
    });

    function handleKeydown(e) {
      if (e.key === "Enter" && e.ctrlKey) {
        e.preventDefault();
        saveBtn.click();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelBtn.click();
      }
    }

    titleInput.addEventListener("keydown", handleKeydown);
    descriptionInput.addEventListener("keydown", handleKeydown);

    cardElement.setAttribute("draggable", "false");
  } catch (error) {
    console.error("Ошибка при редактировании карточки:", error);
    alert("Не удалось отредактировать карточку: " + error.message);
  }
}

function deleteCard(taskId) {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";

  modalOverlay.innerHTML = `
    <div class="modal-container delete-card-modal">
      <div class="modal-header">
        <h3 class="modal-title">Удаление карточки</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <p>Вы уверены, что хотите удалить эту карточку?</p>
        <p class="delete-warning">Это действие нельзя отменить.</p>
      </div>
      <div class="modal-footer">
        <button class="modal-secondary-btn" id="cancelDelete">Отмена</button>
        <button class="modal-danger-btn" id="confirmDelete">Удалить</button>
      </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);

  setTimeout(() => {
    modalOverlay.classList.add("active");
  }, 10);

  const closeModal = () => {
    modalOverlay.classList.remove("active");
    setTimeout(() => {
      document.body.removeChild(modalOverlay);
    }, 300);
  };

  modalOverlay
    .querySelector(".modal-close")
    .addEventListener("click", closeModal);

  document.getElementById("cancelDelete").addEventListener("click", closeModal);

  document.getElementById("confirmDelete").addEventListener("click", () => {
    try {
      const boardData = JSON.parse(currentBoardData.boardData);

      let columnIndex = -1;
      let taskIndex = -1;

      for (let i = 0; i < boardData.columns.length; i++) {
        const column = boardData.columns[i];
        const tIndex = column.tasks.findIndex((task) => task.id === taskId);

        if (tIndex !== -1) {
          columnIndex = i;
          taskIndex = tIndex;
          break;
        }
      }

      if (columnIndex === -1 || taskIndex === -1) {
        console.error("Карточка не найдена");
        closeModal();
        return;
      }

      boardData.columns[columnIndex].tasks.splice(taskIndex, 1);

      updateBoardData(boardData);

      const cardElement = document.querySelector(
        `.kanban-card[data-task-id="${taskId}"]`
      );
      if (cardElement) {
        cardElement.remove();
      }

      closeModal();
    } catch (error) {
      console.error("Ошибка при удалении карточки:", error);
      alert("Не удалось удалить карточку: " + error.message);
      closeModal();
    }
  });

  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });

  const handleKeydown = (e) => {
    if (e.key === "Escape") {
      closeModal();
      document.removeEventListener("keydown", handleKeydown);
    }
  };

  document.addEventListener("keydown", handleKeydown);
}

function updateBoardData(boardData) {
  try {
    const stringifiedData = JSON.stringify(boardData);
    currentBoardData.boardData = stringifiedData;

    const saveStatus = document.getElementById("saveStatus");
    if (saveStatus) {
      saveStatus.textContent = "Изменения не сохранены...";
      saveStatus.classList.add("unsaved");
    }

    boardChanged = true;

    currentBoardData._hasUnsavedChanges = true;

    const boardsCache = getBoardsCache();
    if (boardsCache) {
      const boardIndex = boardsCache.findIndex(
        (board) => board.id == currentBoardData.id
      );
      if (boardIndex !== -1) {
        const updatedBoard = JSON.parse(JSON.stringify(currentBoardData));
        updatedBoard._hasUnsavedChanges = true;

        boardsCache[boardIndex] = updatedBoard;
        updateBoardsCache(boardsCache);
      } else {
        console.warn("Доска не найдена в кэше памяти:", currentBoardData.id);
      }
    } else {
      console.warn("Кэш в памяти не инициализирован");
    }

    const localStorageCache = JSON.parse(
      localStorage.getItem("kanban_boards_cache") || "[]"
    );
    const boardIndex = localStorageCache.findIndex(
      (board) => board.id == currentBoardData.id
    );

    if (boardIndex !== -1) {
      const updatedBoard = JSON.parse(JSON.stringify(currentBoardData));
      updatedBoard._hasUnsavedChanges = true;

      localStorageCache[boardIndex] = updatedBoard;

      localStorage.setItem(
        "kanban_boards_cache",
        JSON.stringify(localStorageCache)
      );

      const afterUpdateCache = JSON.parse(
        localStorage.getItem("kanban_boards_cache") || "[]"
      );
      const afterUpdateBoard = afterUpdateCache.find(
        (b) => b.id == currentBoardData.id
      );
      if (afterUpdateBoard && afterUpdateBoard._hasUnsavedChanges) {
      } else if (afterUpdateBoard && afterUpdateBoard._hasUnsavedChanges) {
        console.error(
          "Ошибка: флаг несохраненных изменений остался в кэше после сохранения"
        );
      }
    } else {

      const updatedBoard = JSON.parse(JSON.stringify(currentBoardData));
      updatedBoard._hasUnsavedChanges = true;

      localStorageCache.push(updatedBoard);
      localStorage.setItem(
        "kanban_boards_cache",
        JSON.stringify(localStorageCache)
      );
    }

    if (saveTimer) {
      clearTimeout(saveTimer);
    }

    saveTimer = setTimeout(() => {
      saveBoardData();
    }, SAVE_DELAY);
  } catch (error) {
    console.error("Ошибка при обновлении данных доски:", error);
  }
}

async function saveBoardData() {
  if (!boardChanged) return;

  try {
    const saveStatus = document.getElementById("saveStatus");
    if (saveStatus) {
      saveStatus.textContent = "Сохранение...";
      saveStatus.classList.remove("unsaved");
      saveStatus.classList.add("saving");
    }

    if (!currentBoardData || !currentBoardData.id) {
      throw new Error("Данные доски недоступны");
    }

    const updateData = {
      name: currentBoardData.name,
      boardData: currentBoardData.boardData,
    };

    await kanbanService.updateBoard(currentBoardData.id, updateData);

    delete currentBoardData._hasUnsavedChanges;

    boardChanged = false;

    const boardsCache = getBoardsCache();
    if (boardsCache) {
      const boardIndex = boardsCache.findIndex(
        (board) => board.id == currentBoardData.id
      );
      if (boardIndex !== -1) {
        const updatedBoard = JSON.parse(JSON.stringify(currentBoardData));
        boardsCache[boardIndex] = updatedBoard;
        updateBoardsCache(boardsCache);
      }
    }

    const localStorageCache = JSON.parse(
      localStorage.getItem("kanban_boards_cache") || "[]"
    );
    const boardIndex = localStorageCache.findIndex(
      (board) => board.id == currentBoardData.id
    );
    if (boardIndex !== -1) {
      const updatedBoard = JSON.parse(JSON.stringify(currentBoardData));
      localStorageCache[boardIndex] = updatedBoard;
      localStorage.setItem(
        "kanban_boards_cache",
        JSON.stringify(localStorageCache)
      );

      const checkCache = JSON.parse(
        localStorage.getItem("kanban_boards_cache") || "[]"
      );
      const checkBoard = checkCache.find((b) => b.id == currentBoardData.id);
      if (checkBoard && !checkBoard._hasUnsavedChanges) {
      } else if (checkBoard && checkBoard._hasUnsavedChanges) {
        console.error(
          "Ошибка: флаг несохраненных изменений остался в кэше после сохранения"
        );
      }
    } else {
      console.warn(
        "Доска не найдена в кэше localStorage:",
        currentBoardData.id
      );

      const updatedBoard = JSON.parse(JSON.stringify(currentBoardData));
      localStorageCache.push(updatedBoard);
      localStorage.setItem(
        "kanban_boards_cache",
        JSON.stringify(localStorageCache)
      );
    }

    if (saveStatus) {
      saveStatus.textContent = "Все изменения сохранены";
      saveStatus.classList.remove("saving");
      saveStatus.classList.remove("unsaved");
    }
  } catch (error) {
    console.error("Ошибка при сохранении доски:", error);

    const saveStatus = document.getElementById("saveStatus");
    if (saveStatus) {
      saveStatus.textContent = "Ошибка сохранения! Попробуйте снова.";
      saveStatus.classList.remove("saving");
      saveStatus.classList.add("error");
    }
  }
}

function forceSaveBoardData() {
  if (boardChanged && currentBoardData) {
    const updateData = {
      name: currentBoardData.name,
      boardData: currentBoardData.boardData,
    };

    try {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", `/api/boards/${currentBoardData.id}`, false);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.send(JSON.stringify(updateData));

      if (xhr.status >= 200 && xhr.status < 300) {
        delete currentBoardData._hasUnsavedChanges;
        boardChanged = false;

        const boardsCache = getBoardsCache();
        if (boardsCache) {
          const boardIndex = boardsCache.findIndex(
            (board) => board.id == currentBoardData.id
          );
          if (boardIndex !== -1) {
            const updatedBoard = JSON.parse(JSON.stringify(currentBoardData));
            boardsCache[boardIndex] = updatedBoard;
            updateBoardsCache(boardsCache);
          }
        }

        const localStorageCache = JSON.parse(
          localStorage.getItem("kanban_boards_cache") || "[]"
        );
        const boardIndex = localStorageCache.findIndex(
          (board) => board.id == currentBoardData.id
        );
        if (boardIndex !== -1) {
          const updatedBoard = JSON.parse(JSON.stringify(currentBoardData));
          localStorageCache[boardIndex] = updatedBoard;
          localStorage.setItem(
            "kanban_boards_cache",
            JSON.stringify(localStorageCache)
          );
        }
      } else {
        console.error("Ошибка при принудительном сохранении доски");
      }
    } catch (error) {
      console.error(
        "Критическая ошибка при принудительном сохранении доски:",
        error
      );
    }
  }
}

export function cleanupBoardEventListeners() {
  window.removeEventListener("beforeunload", handleBeforeUnload);

  if (boardChanged && currentBoardData) {
    forceSaveBoardData();
  }

  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }

  boardChanged = false;
  currentBoardData = null;
}

function setupColumnDragAndDrop() {
  const columns = document.querySelectorAll(".kanban-column");
  const board = document.getElementById("kanbanBoard");

  columns.forEach((column) => {
    const columnHeader = column.querySelector(".column-header");
    if (columnHeader) {
      columnHeader.setAttribute("draggable", "true");
      columnHeader.addEventListener("dragstart", handleColumnDragStart);
      columnHeader.addEventListener("dragend", handleColumnDragEnd);
    }
  });

  if (board) {
    board.addEventListener("dragover", handleColumnDragOver);
    board.addEventListener("dragenter", function (e) {
      e.preventDefault();
    });
    board.addEventListener("drop", handleColumnDrop);
  }
}

function handleColumnDragStart(e) {
  const column = e.target.closest(".kanban-column");
  if (!column) return;

  try {
    const ghostImage = column.cloneNode(true);

    ghostImage.style.position = "absolute";
    ghostImage.style.top = "-1000px";
    ghostImage.style.opacity = "0.8";
    ghostImage.style.transform = "scale(0.8)";
    ghostImage.style.width = `${column.offsetWidth}px`;

    document.body.appendChild(ghostImage);
    e.dataTransfer.setDragImage(ghostImage, 10, 10);

    setTimeout(() => {
      document.body.removeChild(ghostImage);
    }, 0);
  } catch (error) {
    console.error("Ошибка при создании превью перетаскивания:", error);
  }

  e.dataTransfer.setData("column-id", column.getAttribute("data-column-id"));

  e.dataTransfer.setData("dragging-type", "column");

  e.dataTransfer.effectAllowed = "move";

  setTimeout(() => {
    column.classList.add("dragging");

    const board = document.getElementById("kanbanBoard");
    if (board) {
      board.setAttribute("data-dragging", "column");

      board.classList.add("dragging-column");

      const cardDropZones = document.querySelectorAll(".column-cards");
      cardDropZones.forEach((zone) => {
        zone.classList.add("no-drop-highlight");
      });
    }
  }, 0);
}

function handleColumnDragEnd(e) {
  const column = e.target.closest(".kanban-column");
  if (!column) return;

  column.classList.remove("dragging");

  document
    .querySelectorAll(".column-drop-indicator")
    .forEach((el) => el.remove());

  const board = document.getElementById("kanbanBoard");
  if (board) {
    board.removeAttribute("data-dragging");
    board.classList.remove("dragging-column");

    const cardDropZones = document.querySelectorAll(".column-cards");
    cardDropZones.forEach((zone) => {
      zone.classList.remove("no-drop-highlight");
    });
  }
}

function handleColumnDragOver(e) {
  e.preventDefault();

  const board = document.getElementById("kanbanBoard");
  if (!board || board.getAttribute("data-dragging") !== "column") return;

  if (e.target.classList.contains("column-drop-indicator")) {
    return;
  }

  const columns = Array.from(
    document.querySelectorAll(".kanban-column:not(.dragging)")
  );
  if (!columns.length) return;

  const closestColumn = findClosestColumn(e.clientX, columns);
  if (!closestColumn) return;

  document
    .querySelectorAll(".column-drop-indicator")
    .forEach((el) => el.remove());

  const rect = closestColumn.getBoundingClientRect();
  const isLeftHalf = e.clientX < rect.left + rect.width / 2;

  const indicator = document.createElement("div");
  indicator.className = "column-drop-indicator";

  if (isLeftHalf) {
    closestColumn.before(indicator);
  } else {
    closestColumn.after(indicator);
  }
}

function findClosestColumn(mouseX, columns) {
  let closestColumn = null;
  let closestDistance = Infinity;

  columns.forEach((column) => {
    const rect = column.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const distance = Math.abs(mouseX - centerX);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestColumn = column;
    }
  });

  return closestColumn;
}

function handleColumnDrop(e) {
  e.preventDefault();

  const board = document.getElementById("kanbanBoard");
  if (!board || board.getAttribute("data-dragging") !== "column") return;

  const columnId = e.dataTransfer.getData("column-id");
  if (!columnId) return;

  const draggedColumn = document.querySelector(
    `.kanban-column[data-column-id="${columnId}"]`
  );
  if (!draggedColumn) return;

  const indicator = document.querySelector(".column-drop-indicator");
  if (indicator) {
    indicator.parentNode.insertBefore(draggedColumn, indicator);
    indicator.remove();

    updateColumnsOrder();
  } else {
    const columns = Array.from(
      document.querySelectorAll(".kanban-column:not(.dragging)")
    );
    const closestColumn = findClosestColumn(e.clientX, columns);

    if (closestColumn) {
      const rect = closestColumn.getBoundingClientRect();
      const isLeftHalf = e.clientX < rect.left + rect.width / 2;

      if (isLeftHalf) {
        closestColumn.before(draggedColumn);
      } else {
        closestColumn.after(draggedColumn);
      }

      updateColumnsOrder();
    }
  }

  board.removeAttribute("data-dragging");
  board.classList.remove("dragging-column");

  const cardDropZones = document.querySelectorAll(".column-cards");
  cardDropZones.forEach((zone) => {
    zone.classList.remove("no-drop-highlight");
  });
}

function updateColumnsOrder() {
  try {
    const boardData = JSON.parse(currentBoardData.boardData);

    const columnElements = document.querySelectorAll(".kanban-column");
    const newColumns = [];

    columnElements.forEach((columnElement) => {
      const columnId = columnElement.getAttribute("data-column-id");
      const column = boardData.columns.find((c) => c.id === columnId);
      if (column) {
        newColumns.push(column);
      }
    });

    boardData.columns = newColumns;

    updateBoardData(boardData);
  } catch (error) {
    console.error("Ошибка при обновлении порядка колонок:", error);
  }
}

function copyColumn(columnId) {
  try {
    const boardData = JSON.parse(currentBoardData.boardData);

    const sourceColumn = boardData.columns.find(
      (column) => column.id === columnId
    );
    if (!sourceColumn) {
      console.error("Колонка не найдена");
      return;
    }

    const columnElement = document.querySelector(
      `.kanban-column[data-column-id="${columnId}"]`
    );
    const columnHeader = columnElement.querySelector(".column-header");

    const originalContent = columnHeader.innerHTML;

    const inputContainer = document.createElement("div");
    inputContainer.className = "column-copy-form";
    inputContainer.innerHTML = `
      <input type="text" class="column-copy-input" placeholder="Название новой колонки" value="${sourceColumn.name} (копия)">
      <div class="column-copy-actions">
        <button class="column-copy-save">Копировать</button>
        <button class="column-copy-cancel">Отмена</button>
      </div>
    `;

    columnHeader.innerHTML = "";
    columnHeader.appendChild(inputContainer);

    const inputElement = inputContainer.querySelector(".column-copy-input");
    inputElement.focus();
    inputElement.select();

    const restoreHeaderWithEventListeners = () => {
      columnHeader.innerHTML = originalContent;

      const menuBtn = columnHeader.querySelector(".column-menu-btn");
      if (menuBtn) {
        menuBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const menu = columnHeader.querySelector(".column-menu");

          document.querySelectorAll(".column-menu.active").forEach((m) => {
            if (m !== menu) m.classList.remove("active");
          });

          menu.classList.toggle("active");
        });
      }

      const menuItems = columnHeader.querySelectorAll(".column-menu-item");
      menuItems.forEach((item) => {
        item.addEventListener("click", (e) => {
          const action = e.target.getAttribute("data-action");
          const colId = e.target.getAttribute("data-column-id");

          if (action === "edit") {
            const titleElement = columnElement.querySelector(".column-title");
            if (titleElement) {
              startEditColumnTitle(titleElement, colId);
            }
          } else if (action === "copy") {
            copyColumn(colId);
          } else if (action === "delete") {
            deleteColumn(colId);
          }

          const menu = e.target.closest(".column-menu");
          if (menu) menu.classList.remove("active");
        });
      });

      columnHeader.setAttribute("draggable", "true");
      columnHeader.addEventListener("dragstart", handleColumnDragStart);
      columnHeader.addEventListener("dragend", handleColumnDragEnd);

      const titleContainer = columnHeader.querySelector(
        ".column-title-container"
      );
      if (titleContainer) {
        titleContainer.addEventListener("click", (e) => {
          const titleElement = titleContainer.querySelector(".column-title");
          if (titleElement) {
            startEditColumnTitle(titleElement, columnId);
          }
        });
      }
    };

    const saveButton = inputContainer.querySelector(".column-copy-save");
    saveButton.addEventListener("click", () => {
      const newColumnName = inputElement.value.trim();
      if (newColumnName) {
        createColumnCopy(sourceColumn, newColumnName);
      }

      restoreHeaderWithEventListeners();
    });

    const cancelButton = inputContainer.querySelector(".column-copy-cancel");
    cancelButton.addEventListener("click", () => {
      restoreHeaderWithEventListeners();
    });

    inputElement.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const newColumnName = inputElement.value.trim();
        if (newColumnName) {
          createColumnCopy(sourceColumn, newColumnName);
        }

        restoreHeaderWithEventListeners();
      } else if (e.key === "Escape") {
        e.preventDefault();

        restoreHeaderWithEventListeners();
      }
    });
  } catch (error) {
    console.error("Ошибка при копировании колонки:", error);
    alert("Не удалось копировать колонку: " + error.message);
  }
}

function createColumnCopy(sourceColumn, newColumnName) {
  try {
    const newColumnId = "column_" + Date.now();

    const columnCopy = {
      id: newColumnId,
      name: newColumnName,
      tasks: JSON.parse(JSON.stringify(sourceColumn.tasks)),
    };

    columnCopy.tasks.forEach((task) => {
      task.id = "task_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    });

    const boardData = JSON.parse(currentBoardData.boardData);

    const sourceColumnIndex = boardData.columns.findIndex(
      (col) => col.id === sourceColumn.id
    );

    boardData.columns.splice(sourceColumnIndex + 1, 0, columnCopy);

    updateBoardData(boardData);

    const kanbanBoard = document.getElementById("kanbanBoard");
    const sourceColumnElement = document.querySelector(
      `.kanban-column[data-column-id="${sourceColumn.id}"]`
    );

    const cardsHtml = columnCopy.tasks
      .map(
        (task) => `
      <div class="kanban-card" draggable="true" data-task-id="${task.id}">
        <div class="card-content">
          <div class="card-title">${task.title}</div>
          ${
            task.description
              ? `<div class="card-description">${task.description}</div>`
              : ""
          }
        </div>
      </div>
    `
      )
      .join("");

    const newColumnHtml = `
      <div class="kanban-column" data-column-id="${newColumnId}">
        <div class="column-header">
          <div class="column-title-container">
            <h3 class="column-title" data-column-id="${newColumnId}">${newColumnName}</h3>
          </div>
          <div class="column-actions">
            <button class="column-menu-btn" data-column-id="${newColumnId}">⋮</button>
            <div class="column-menu" data-column-id="${newColumnId}">
              <div class="column-menu-item" data-action="edit" data-column-id="${newColumnId}">Редактировать</div>
              <div class="column-menu-item" data-action="copy" data-column-id="${newColumnId}">Копировать</div>
              <div class="column-menu-item" data-action="delete" data-column-id="${newColumnId}">Удалить</div>
            </div>
          </div>
        </div>
        <div class="column-cards" data-column-id="${newColumnId}">
          ${cardsHtml}
        </div>
        <div class="column-footer">
          <button class="add-card-btn" data-column-id="${newColumnId}">+ Добавить карточку</button>
        </div>
      </div>
    `;

    const newColumnElement = document.createElement("div");
    newColumnElement.innerHTML = newColumnHtml;
    const newColumn = newColumnElement.firstElementChild;

    if (sourceColumnElement.nextElementSibling) {
      kanbanBoard.insertBefore(
        newColumn,
        sourceColumnElement.nextElementSibling
      );
    } else {
      kanbanBoard.insertBefore(
        newColumn,
        document.querySelector(".add-column-container")
      );
    }

    setupColumnEventListeners(newColumn);
  } catch (error) {
    console.error("Ошибка при создании копии колонки:", error);
    alert("Не удалось создать копию колонки: " + error.message);
  }
}

function setupColumnEventListeners(columnElement) {
  const addCardBtn = columnElement.querySelector(".add-card-btn");
  const columnId = columnElement.getAttribute("data-column-id");

  addCardBtn.addEventListener("click", () => {
    addNewCard(columnId);
  });

  const columnTitleContainer = columnElement.querySelector(
    ".column-title-container"
  );
  columnTitleContainer.addEventListener("click", (e) => {
    const titleElement = columnTitleContainer.querySelector(".column-title");
    if (titleElement) {
      startEditColumnTitle(titleElement, columnId);
    }
  });

  const menuBtn = columnElement.querySelector(".column-menu-btn");
  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const menu = columnElement.querySelector(".column-menu");

    document.querySelectorAll(".column-menu.active").forEach((m) => {
      if (m !== menu) m.classList.remove("active");
    });

    menu.classList.toggle("active");
  });

  const menuItems = columnElement.querySelectorAll(".column-menu-item");
  menuItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      const action = e.target.getAttribute("data-action");
      const colId = e.target.getAttribute("data-column-id");

      if (action === "edit") {
        const titleElement = columnElement.querySelector(".column-title");
        if (titleElement) {
          startEditColumnTitle(titleElement, colId);
        }
      } else if (action === "copy") {
        copyColumn(colId);
      } else if (action === "delete") {
        deleteColumn(colId);
      }

      const menu = e.target.closest(".column-menu");
      if (menu) menu.classList.remove("active");
    });
  });

  const columnHeader = columnElement.querySelector(".column-header");
  columnHeader.setAttribute("draggable", "true");
  columnHeader.addEventListener("dragstart", handleColumnDragStart);
  columnHeader.addEventListener("dragend", handleColumnDragEnd);

  const dropZone = columnElement.querySelector(".column-cards");
  dropZone.addEventListener("dragover", handleDragOver);
  dropZone.addEventListener("dragenter", handleDragEnter);
  dropZone.addEventListener("dragleave", handleDragLeave);
  dropZone.addEventListener("drop", handleDrop);

  const cards = columnElement.querySelectorAll(".kanban-card");
  cards.forEach((card) => {
    card.addEventListener("dragstart", handleDragStart);
    card.addEventListener("dragend", handleDragEnd);
    card.addEventListener("dragover", handleDragOver);
    card.addEventListener("dragleave", handleDragLeave);

    const taskId = card.getAttribute("data-task-id");

    card.addEventListener("click", () => {
      openCardDetailModal(taskId);
    });
  });
}

function openCardDetailModal(taskId, options = {}) {
  try {
    const boardData = JSON.parse(currentBoardData.boardData);

    let foundTask = null;
    let columnName = "";
    let columnId = "";

    for (const column of boardData.columns) {
      const task = column.tasks.find((t) => t.id === taskId);
      if (task) {
        foundTask = task;
        columnName = column.name;
        columnId = column.id;
        break;
      }
    }

    if (!foundTask) {
      console.error("Карточка не найдена");
      return;
    }

    if (!foundTask.comments) {
      foundTask.comments = [];
    }
    if (!foundTask.checklists) {
      foundTask.checklists = [];
    }

    const isArchived = options.archived || foundTask.archived;
    const archivedAt = foundTask.archivedAt;
    const archivedBy = foundTask.archivedBy;

    const createdDate = new Date(foundTask.createdAt);
    const formattedDate = createdDate.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const currentUser = JSON.parse(localStorage.getItem("auth_user") || "{}");
    const currentUsername =
      currentUser.fullname ||
      (
        (currentUser.firstName || "") +
        " " +
        (currentUser.lastName || "")
      ).trim() ||
      currentUser.name ||
      "Пользователь";

    const modalOverlay = document.createElement("div");
    modalOverlay.className = "modal-overlay";

    modalOverlay.innerHTML = `
      <div class="modal-container card-detail-modal">
        <div class="card-modal-header">
          <h3 class="card-modal-title card-title-editable" data-task-id="${taskId}">${
      foundTask.title
    }</h3>
          <button class="card-modal-close">&times;</button>
        </div>
        <div class="card-modal-body">
          <div class="card-modal-main-content">
            <div class="card-detail-section">
              <div class="card-list-row">
                <div class="card-detail-label">В списке:</div>
                <div class="card-detail-value list-value">${columnName}</div>
              </div>
            </div>
            
            <div class="card-detail-section">
              <div class="card-detail-label">Описание</div>
              <div class="card-detail-value card-description-editable" data-task-id="${taskId}">${formatTextWithMentions(
      foundTask.description || "Добавить более подробное описание..."
    )}</div>
            </div>

            ${
              foundTask.checklists && foundTask.checklists.length > 0
                ? `
            <div class="card-detail-section">
              <div class="card-detail-label">Чек-листы</div>
              <div class="card-checklists-container" data-task-id="${taskId}">
                ${foundTask.checklists
                  .map((checklist) => renderChecklistHTML(checklist, taskId))
                  .join("")}
              </div>
            </div>
            `
                : `
            <div class="card-checklists-container" data-task-id="${taskId}">
              ${foundTask.checklists
                .map((checklist) => renderChecklistHTML(checklist, taskId))
                .join("")}
            </div>
            `
            }
            
            <div class="card-detail-section">
              <div class="card-detail-label">Комментарии</div>
              <div class="card-activity-wrapper">
                <div class="comment-form">
                  <div class="comment-avatar">${currentUsername.substring(
                    0,
                    2
                  )}</div>
                  <textarea class="card-comment-input" placeholder="Напишите комментарий..."></textarea>
                </div>
                <button class="comment-submit-btn">Отправить</button>
              </div>
              <div class="card-comments-container">
                ${
                  foundTask.comments && foundTask.comments.length > 0
                    ? [...foundTask.comments]
                        .reverse()
                        .map(
                          (comment) => `
                    <div class="card-comment" data-comment-id="${comment.id}">
                      <div class="comment-avatar">${comment.author.substring(
                        0,
                        2
                      )}</div>
                      <div class="comment-content">
                        <div class="comment-header">
                          <span class="comment-author">${comment.author}</span>
                          <span class="comment-date">${new Date(
                            comment.createdAt
                          ).toLocaleString("ru-RU")}</span>
                        </div>
                        <div class="comment-text">${formatTextWithMentions(
                          comment.text
                        )}</div>
                        <div class="comment-actions">
                          ${
                            comment.authorId === currentUser.id
                              ? `
                            <button class="comment-edit-btn" data-comment-id="${comment.id}">Редактировать</button>
                            <button class="comment-delete-btn" data-comment-id="${comment.id}">Удалить</button>
                          `
                              : ""
                          }
                        </div>
                      </div>
                    </div>
                  `
                        )
                        .join("")
                    : '<div class="no-comments">Нет комментариев</div>'
                }
              </div>
            </div>
          </div>
          
          <div class="card-modal-sidebar">
            <div class="sidebar-section">
              <h4 class="sidebar-title">Действия</h4>
              <div class="sidebar-actions">
                <div class="task-completion-toggle">
                  <div class="card-checkbox ${
                    foundTask.completed ? "checked" : ""
                  }" data-task-id="${taskId}"></div>
                  <span class="task-label">Отметить как выполненное</span>
                </div>
                <button class="sidebar-btn add-checklist-btn" data-task-id="${taskId}"><i class="fas fa-tasks"></i> Добавить чек-лист</button>
                <button class="sidebar-btn set-card-due-date-btn" data-task-id="${taskId}"><i class="fas fa-calendar-alt"></i> Установить дату</button>
                <button class="sidebar-btn archive-card-btn" data-task-id="${taskId}"><i class="fas fa-archive"></i> Архивировать</button>
                <button class="sidebar-btn delete-card-btn" data-task-id="${taskId}">🗑️ Удалить карточку</button>
              </div>
            </div>
            <div class="sidebar-section">
              <h4 class="sidebar-title">Добавлено</h4>
              <div class="sidebar-date">${formattedDate}</div>
            </div>
          </div>
        </div>
        <div class="card-modal-footer">
          <!-- Нижний колонтитул, если нужен -->
        </div>
      </div>
    `;

    document.body.appendChild(modalOverlay);

    setTimeout(() => {
      modalOverlay.classList.add("active");

      foundTask.checklists.forEach((checklist) => {
        const checklistElement = modalOverlay.querySelector(
          `.checklist-section[data-checklist-id="${checklist.id}"]`
        );
        if (checklistElement) {
          updateChecklistProgress(checklistElement, checklist);
          setupChecklistEventListeners(checklistElement, taskId, checklist.id);
        }
      });
    }, 10);

    const closeModal = () => {
      modalOverlay.classList.remove("active");
      setTimeout(() => {
        document.body.removeChild(modalOverlay);
      }, 300);
    };

    modalOverlay
      .querySelector(".card-modal-close")
      .addEventListener("click", closeModal);

    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) {
        closeModal();
      }
    });

    const titleElement = modalOverlay.querySelector(".card-title-editable");
    titleElement.addEventListener("click", function (e) {
      if (this.querySelector(".card-title-input-inline")) {
        return;
      }

      const currentTitle = this.textContent;
      const input = document.createElement("input");
      input.value = currentTitle;
      input.className = "card-title-input-inline";
      this.innerHTML = "";
      this.appendChild(input);
      input.focus();

      const valueLength = input.value.length;
      input.setSelectionRange(valueLength, valueLength);

      const saveTitle = () => {
        const newTitle = input.value.trim();
        if (newTitle) {
          const boardData = JSON.parse(currentBoardData.boardData);
          for (const column of boardData.columns) {
            const taskIndex = column.tasks.findIndex((t) => t.id === taskId);
            if (taskIndex !== -1) {
              column.tasks[taskIndex].title = newTitle;
              column.tasks[taskIndex].updatedAt = new Date().toISOString();

              titleElement.textContent = newTitle;

              const cardElement = document.querySelector(
                `.kanban-card[data-task-id="${taskId}"] .card-title`
              );
              if (cardElement) {
                cardElement.textContent = newTitle;
              }

              updateBoardData(boardData);
              break;
            }
          }
        } else {
          titleElement.textContent = currentTitle;
        }
      };

      input.addEventListener("blur", saveTitle);

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          saveTitle();
        } else if (e.key === "Escape") {
          titleElement.textContent = currentTitle;
        }
      });

      e.stopPropagation();
    });

    const descriptionElement = modalOverlay.querySelector(
      ".card-description-editable"
    );
    descriptionElement.addEventListener("click", function (e) {
      if (this.querySelector(".card-description-textarea-inline")) {
        return;
      }

      const editSessionId = "edit_" + Date.now();
      this.setAttribute("data-edit-session", editSessionId);

      const currentDescription =
        this.textContent === "Добавить более подробное описание..."
          ? ""
          : this.textContent;
      const textarea = document.createElement("textarea");
      textarea.value = currentDescription;
      textarea.className = "card-description-textarea-inline";
      textarea.placeholder = "Добавить более подробное описание...";

      const originalContent = this.innerHTML;

      this.innerHTML = "";
      this.appendChild(textarea);
      textarea.focus();

      textarea.addEventListener("input", handleMentionTextareaInput);
      textarea.addEventListener("keydown", handleMentionTextareaKeydown);

      textarea.addEventListener("blur", (event) => {
        setTimeout(() => {
          const activeElement = document.activeElement;

          if (mentionsDropdown && mentionsDropdown.contains(activeElement)) {
            return;
          }

          if (
            mentionsDropdown &&
            mentionsDropdown.style.display === "block" &&
            currentMentionTextarea === textarea
          ) {
            hideMentionsDropdown();
          }
        }, 100);
      });

      const saveDescription = () => {
        if (this.getAttribute("data-edit-session") !== editSessionId) {
          return;
        }

        const newDescription = textarea.value.trim();

        this.innerHTML = "";

        this.removeAttribute("data-edit-session");

        const boardData = JSON.parse(currentBoardData.boardData);
        for (const column of boardData.columns) {
          const taskIndex = column.tasks.findIndex((t) => t.id === taskId);
          if (taskIndex !== -1) {
            column.tasks[taskIndex].description = newDescription;
            column.tasks[taskIndex].updatedAt = new Date().toISOString();

            this.innerHTML = formatTextWithMentions(
              newDescription || "Добавить более подробное описание..."
            );

            const cardElement = document.querySelector(
              `.kanban-card[data-task-id="${taskId}"] .card-description`
            );
            if (cardElement) {
              if (newDescription) {
                if (cardElement) {
                  cardElement.textContent = newDescription;
                } else {
                  const cardContent = document.querySelector(
                    `.kanban-card[data-task-id="${taskId}"] .card-content`
                  );
                  if (cardContent) {
                    const descElement = document.createElement("div");
                    descElement.className = "card-description";
                    descElement.textContent = newDescription;
                    cardContent.appendChild(descElement);
                  }
                }
              } else if (cardElement) {
                cardElement.remove();
              }
            }

            updateBoardData(boardData);

            updateCardIndicators(taskId);
            break;
          }
        }
      };

      const cancelEdit = () => {
        if (this.getAttribute("data-edit-session") !== editSessionId) {
          return;
        }

        this.removeAttribute("data-edit-session");

        this.innerHTML = originalContent;
      };

      const actionButtons = document.createElement("div");
      actionButtons.className = "description-edit-actions";
      actionButtons.innerHTML = `
        <button class="description-save-btn">Сохранить</button>
        <button class="description-cancel-btn">Отмена</button>
      `;
      this.appendChild(actionButtons);

      const saveBtn = actionButtons.querySelector(".description-save-btn");
      const cancelBtn = actionButtons.querySelector(".description-cancel-btn");

      saveBtn.addEventListener(
        "click",
        function (e) {
          e.stopPropagation();
          saveDescription();
        },
        { once: true }
      );

      cancelBtn.addEventListener(
        "click",
        function (e) {
          e.stopPropagation();
          cancelEdit();
        },
        { once: true }
      );

      e.stopPropagation();
    });

    const commentInput = modalOverlay.querySelector(".card-comment-input");
    const commentSubmitBtn = modalOverlay.querySelector(".comment-submit-btn");

    if (commentInput) {
      commentInput.addEventListener("input", handleMentionTextareaInput);
      commentInput.addEventListener("keydown", handleMentionTextareaKeydown);
      commentInput.addEventListener("focus", () => {
      });
      commentInput.addEventListener("blur", (event) => {
        setTimeout(() => {
          const activeElement = document.activeElement;

          if (mentionsDropdown && mentionsDropdown.contains(activeElement)) {
            return;
          }

          if (
            mentionsDropdown &&
            mentionsDropdown.style.display === "block" &&
            currentMentionTextarea === commentInput
          ) {
            hideMentionsDropdown();
          }
        }, 150);
      });
    } else {
      console.error(
        "Mentions: Comment input field (.card-comment-input) not found in modalOverlay for initialization."
      );
    }

    commentSubmitBtn.addEventListener("click", async () => {
      const commentText = commentInput.value.trim();
      if (!commentText) return;

      try {
        let userData;
        try {
          userData = await authService.getUserProfile();
        } catch (error) {
          console.error(
            "Не удалось получить данные пользователя через API:",
            error
          );

          userData = authService.getUser();

          if (!userData) {
            throw new Error(
              "Не удалось получить данные пользователя для комментария"
            );
          }
        }

        const currentUsername =
          userData.fullname ||
          (
            (userData.firstName || "") +
            " " +
            (userData.lastName || "")
          ).trim() ||
          userData.name ||
          "Пользователь";

        const newComment = {
          id: "comment_" + Date.now(),
          author: currentUsername,
          authorId: userData.id,
          text: commentText,
          createdAt: new Date().toISOString(),
        };

        const boardData = JSON.parse(currentBoardData.boardData);
        for (const column of boardData.columns) {
          const taskIndex = column.tasks.findIndex((t) => t.id === taskId);
          if (taskIndex !== -1) {
            if (!column.tasks[taskIndex].comments) {
              column.tasks[taskIndex].comments = [];
            }

            column.tasks[taskIndex].comments.push(newComment);
            column.tasks[taskIndex].updatedAt = new Date().toISOString();

            const commentsContainer = modalOverlay.querySelector(
              ".card-comments-container"
            );

            const noComments = commentsContainer.querySelector(".no-comments");
            if (noComments) {
              noComments.remove();
            }

            const commentElement = document.createElement("div");
            commentElement.className = "card-comment";
            commentElement.setAttribute("data-comment-id", newComment.id);
            commentElement.innerHTML = `
              <div class="comment-avatar">${newComment.author.substring(
                0,
                2
              )}</div>
              <div class="comment-content">
                <div class="comment-header">
                  <span class="comment-author">${newComment.author}</span>
                  <span class="comment-date">${new Date(
                    newComment.createdAt
                  ).toLocaleString("ru-RU")}</span>
                </div>
                <div class="comment-text">${formatTextWithMentions(
                  newComment.text
                )}</div>
                <div class="comment-actions">
                  <button class="comment-edit-btn" data-comment-id="${
                    newComment.id
                  }">Редактировать</button>
                  <button class="comment-delete-btn" data-comment-id="${
                    newComment.id
                  }">Удалить</button>
                </div>
              </div>
            `;

            commentsContainer.insertBefore(
              commentElement,
              commentsContainer.firstChild
            );

            const editBtn = commentElement.querySelector(".comment-edit-btn");
            const deleteBtn = commentElement.querySelector(
              ".comment-delete-btn"
            );

            editBtn.addEventListener("click", () => {
              editComment(taskId, newComment.id, commentElement);
            });

            deleteBtn.addEventListener("click", () => {
              deleteComment(taskId, newComment.id, commentElement);
            });

            commentInput.value = "";

            updateBoardData(boardData);
            break;
          }
        }
      } catch (error) {
        alert("Не удалось добавить комментарий: " + error.message);
      }
    });

    commentInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        commentSubmitBtn.click();
      }
    });

    const editBtns = modalOverlay.querySelectorAll(".comment-edit-btn");
    const deleteBtns = modalOverlay.querySelectorAll(".comment-delete-btn");

    editBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const commentId = btn.getAttribute("data-comment-id");
        const commentElement = modalOverlay.querySelector(
          `.card-comment[data-comment-id="${commentId}"]`
        );
        editComment(taskId, commentId, commentElement);
      });
    });

    deleteBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const commentId = btn.getAttribute("data-comment-id");
        const commentElement = modalOverlay.querySelector(
          `.card-comment[data-comment-id="${commentId}"]`
        );
        deleteComment(taskId, commentId, commentElement);
      });
    });

    const deleteBtn = modalOverlay.querySelector(".delete-card-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => {
        closeModal();
        deleteCard(taskId);
      });
    }

    const handleKeydown = (e) => {
      if (e.key === "Escape") {
        closeModal();
        document.removeEventListener("keydown", handleKeydown);
      }
    };

    document.addEventListener("keydown", handleKeydown);

    const completionCheckbox = modalOverlay.querySelector(
      ".completion-checkbox"
    );
    if (completionCheckbox) {
      completionCheckbox.addEventListener("click", (e) => {
        e.preventDefault();
        const taskId = e.target.getAttribute("data-task-id");
        toggleTaskCompletion(taskId);

        const boardData = JSON.parse(currentBoardData.boardData);
        for (const column of boardData.columns) {
          const task = column.tasks.find((t) => t.id === taskId);
          if (task) {
            completionCheckbox.checked = task.completed;
            break;
          }
        }
      });
    }

    const modalCheckbox = modalOverlay.querySelector(
      ".task-completion-toggle .card-checkbox"
    );
    if (modalCheckbox) {
      modalCheckbox.addEventListener("click", (e) => {
        e.stopPropagation();
        const taskId = e.target.getAttribute("data-task-id");
        toggleTaskCompletion(taskId);
      });

      const toggleContainer = modalOverlay.querySelector(
        ".task-completion-toggle"
      );
      if (toggleContainer) {
        toggleContainer.addEventListener("click", (e) => {
          if (!e.target.classList.contains("card-checkbox")) {
            const taskId = modalCheckbox.getAttribute("data-task-id");
            toggleTaskCompletion(taskId);
          }
        });
      }
    }

    const addChecklistButton = modalOverlay.querySelector(".add-checklist-btn");
    if (addChecklistButton) {
      addChecklistButton.addEventListener("click", () => {
        addChecklist(taskId);
      });
    }

    const checklistElements =
      modalOverlay.querySelectorAll(".checklist-section");
    checklistElements.forEach((checklistElement) => {
      const checklistId = checklistElement.dataset.checklistId;
      const checklistData = foundTask.checklists.find(
        (cl) => cl.id === checklistId
      );
      if (checklistData) {
        updateChecklistProgress(checklistElement, checklistData);
        setupChecklistEventListeners(checklistElement, taskId, checklistId);
      }
    });

    const archiveBtn = modalOverlay.querySelector(".archive-card-btn");
    if (archiveBtn) {
      archiveBtn.addEventListener("click", () => {
        closeModal();
        archiveCard(taskId);
      });
    }

    if (isArchived && (archivedAt || archivedBy)) {
      const sidebar = modalOverlay.querySelector(".card-modal-sidebar");
      if (sidebar) {
        const archiveInfo = document.createElement("div");
        archiveInfo.className = "sidebar-section";
        archiveInfo.innerHTML = `
          <h4 class="sidebar-title" style="color:#7c3aed;">Архивировано</h4>
          <div class="sidebar-archive-info">
            ${archivedBy ? `<div>Кем: <b>${archivedBy}</b></div>` : ""}
            ${
              archivedAt
                ? `<div>Когда: <b>${new Date(archivedAt).toLocaleString(
                    "ru-RU"
                  )}</b></div>`
                : ""
            }
          </div>
        `;
        sidebar.insertBefore(archiveInfo, sidebar.firstChild);
      }
    }

    if (isArchived) {
      const header = modalOverlay.querySelector(".card-modal-header");
      if (header && !header.querySelector(".archived-badge")) {
        const badge = document.createElement("span");
        badge.textContent = "В архиве";
        badge.className = "archived-badge";
        badge.style.cssText =
          "margin-left: 16px; color: #fff; background: #7c3aed; border-radius: 6px; padding: 2px 10px; font-size: 13px;";
        header.appendChild(badge);
      }

      const modalContainer = modalOverlay.querySelector(".card-detail-modal");
      if (modalContainer) {
        modalContainer.addEventListener(
          "mousedown",
          (e) => {
            if (e.target.closest(".card-modal-close")) {
              return;
            }
            e.stopPropagation();
            e.preventDefault();
            showWarningToast(
              "Редактирование архивированной карточки запрещено"
            );
          },
          true
        );

        modalContainer.addEventListener("focusin", (e) => {
          if (e.target.closest(".card-modal-close")) {
            return;
          }
          e.stopPropagation();
          e.preventDefault();
          showWarningToast("Редактирование архивированной карточки запрещено");
          if (typeof e.target.blur === "function") e.target.blur();
        });

        const titleElement = modalContainer.querySelector(
          ".card-title-editable"
        );
        if (titleElement) {
          titleElement.addEventListener("click", (e) => {
            showWarningToast(
              "Редактирование архивированной карточки запрещено"
            );
            e.stopPropagation();
            e.preventDefault();
          });
        }
        const descElement = modalContainer.querySelector(
          ".card-description-editable"
        );
        if (descElement) {
          descElement.addEventListener("click", (e) => {
            showWarningToast(
              "Редактирование архивированной карточки запрещено"
            );
            e.stopPropagation();
            e.preventDefault();
          });
        }
      }
    }
  } catch (error) {
    console.error("Ошибка при открытии карточки:", error);
    showWarningToast("Не удалось открыть карточку: " + error.message);
  }
}

function editComment(taskId, commentId, commentElement) {
  try {
    const commentTextElement = commentElement.querySelector(".comment-text");

    const boardDataForEditText = JSON.parse(currentBoardData.boardData);
    let rawText = "";
    for (const column of boardDataForEditText.columns) {
      const task = column.tasks.find((t) => t.id === taskId);
      if (task && task.comments) {
        const comment = task.comments.find((c) => c.id === commentId);
        if (comment) {
          rawText = comment.text;
          break;
        }
      }
      if (rawText) break;
    }

    const editForm = document.createElement("div");
    editForm.className = "comment-edit-form";
    editForm.innerHTML = `
      <textarea class="comment-edit-textarea">${rawText}</textarea>
      <div class="comment-edit-actions">
        <button class="comment-save-btn">Сохранить</button>
        <button class="comment-cancel-btn">Отмена</button>
      </div>
    `;

    commentTextElement.innerHTML = "";
    commentTextElement.appendChild(editForm);

    const textarea = editForm.querySelector(".comment-edit-textarea");
    const saveBtn = editForm.querySelector(".comment-save-btn");
    const cancelBtn = editForm.querySelector(".comment-cancel-btn");

    textarea.focus();

    saveBtn.addEventListener("click", () => {
      const newText = textarea.value.trim();
      if (!newText) return;

      const boardData = JSON.parse(currentBoardData.boardData);
      for (const column of boardData.columns) {
        const taskIndex = column.tasks.findIndex((t) => t.id === taskId);
        if (taskIndex !== -1) {
          const commentIndex = column.tasks[taskIndex].comments.findIndex(
            (c) => c.id === commentId
          );
          if (commentIndex !== -1) {
            column.tasks[taskIndex].comments[commentIndex].text = newText;
            column.tasks[taskIndex].comments[commentIndex].updatedAt =
              new Date().toISOString();

            commentTextElement.innerHTML = formatTextWithMentions(newText);

            updateBoardData(boardData);
            break;
          }
        }
      }
    });

    cancelBtn.addEventListener("click", () => {
      commentTextElement.innerHTML = formatTextWithMentions(rawText);
    });

    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        saveBtn.click();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelBtn.click();
      }
    });
  } catch (error) {
    console.error("Ошибка при редактировании комментария:", error);
    alert("Не удалось отредактировать комментарий: " + error.message);
  }
}

function deleteComment(taskId, commentId, commentElement) {
  try {
    const modalOverlay = document.createElement("div");
    modalOverlay.className = "modal-overlay";

    modalOverlay.innerHTML = `
      <div class="modal-container delete-card-modal">
        <div class="modal-header">
          <h3 class="modal-title">Удаление комментария</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <p>Вы уверены, что хотите удалить этот комментарий?</p>
          <p class="delete-warning">Это действие нельзя отменить.</p>
        </div>
        <div class="modal-footer">
          <button class="modal-secondary-btn" id="cancelDeleteComment">Отмена</button>
          <button class="modal-danger-btn" id="confirmDeleteComment">Удалить</button>
        </div>
      </div>
    `;

    document.body.appendChild(modalOverlay);

    setTimeout(() => {
      modalOverlay.classList.add("active");
    }, 10);

    const closeModal = () => {
      modalOverlay.classList.remove("active");
      setTimeout(() => {
        document.body.removeChild(modalOverlay);
      }, 300);
    };

    modalOverlay
      .querySelector(".modal-close")
      .addEventListener("click", closeModal);

    document
      .getElementById("cancelDeleteComment")
      .addEventListener("click", closeModal);

    document
      .getElementById("confirmDeleteComment")
      .addEventListener("click", () => {
        const boardData = JSON.parse(currentBoardData.boardData);
        for (const column of boardData.columns) {
          const taskIndex = column.tasks.findIndex((t) => t.id === taskId);
          if (taskIndex !== -1) {
            const commentIndex = column.tasks[taskIndex].comments.findIndex(
              (c) => c.id === commentId
            );
            if (commentIndex !== -1) {
              column.tasks[taskIndex].comments.splice(commentIndex, 1);

              commentElement.remove();

              const commentsContainer = document.querySelector(
                ".card-comments-container"
              );
              if (
                commentsContainer &&
                column.tasks[taskIndex].comments.length === 0
              ) {
                commentsContainer.innerHTML =
                  '<div class="no-comments">Нет комментариев</div>';
              }

              updateBoardData(boardData);

              updateCardIndicators(taskId);
              break;
            }
          }
        }

        closeModal();
      });

    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) {
        closeModal();
      }
    });

    const handleKeydown = (e) => {
      if (e.key === "Escape") {
        closeModal();
        document.removeEventListener("keydown", handleKeydown);
      }
    };

    document.addEventListener("keydown", handleKeydown);
  } catch (error) {
    alert("Не удалось удалить комментарий: " + error.message);
  }
}

function updateCardIndicators(taskId) {
  try {
    const cardElement = document.querySelector(
      `.kanban-card[data-task-id="${taskId}"]`
    );
    if (!cardElement) return;

    const boardData = JSON.parse(currentBoardData.boardData);

    let foundTask = null;

    for (const column of boardData.columns) {
      const task = column.tasks.find((t) => t.id === taskId);
      if (task) {
        foundTask = task;
        break;
      }
    }

    if (!foundTask) return;

    const commentsCount = foundTask.comments ? foundTask.comments.length : 0;
    const hasDescription =
      foundTask.description && foundTask.description.trim() !== "";

    const { totalChecklistItems, completedChecklistItems } =
      getChecklistStats(foundTask);

    const indicatorsContainer = cardElement.querySelector(".card-indicators");
    if (indicatorsContainer) {
      indicatorsContainer.innerHTML = `
        ${
          hasDescription
            ? `<div class="card-indicator description-indicator" title="Карточка содержит описание">
            <i class="fas fa-align-left"></i>
          </div>`
            : ""
        }
        ${
          commentsCount > 0
            ? `<div class="card-indicator comments-indicator" title="Комментарии: ${commentsCount}">
            <i class="fas fa-comment"></i>
            <span class="indicator-count">${commentsCount}</span>
          </div>`
            : ""
        }
        ${
          totalChecklistItems > 0
            ? `<div class="card-indicator checklist-indicator" title="Чек-лист: ${completedChecklistItems}/${totalChecklistItems}">
            <i class="fas fa-list-check"></i>
            <span class="indicator-count">${completedChecklistItems}/${totalChecklistItems}</span>
          </div>`
            : ""
        }
      `;
    }
  } catch (error) {}
}

function toggleTaskCompletion(taskId) {
  try {
    const boardData = JSON.parse(currentBoardData.boardData);

    let foundTask = null;
    let columnIndex = -1;
    let taskIndex = -1;

    for (let i = 0; i < boardData.columns.length; i++) {
      const column = boardData.columns[i];
      const tIndex = column.tasks.findIndex((task) => task.id === taskId);

      if (tIndex !== -1) {
        columnIndex = i;
        taskIndex = tIndex;
        foundTask = column.tasks[tIndex];
        break;
      }
    }

    if (!foundTask) {
      return;
    }

    foundTask.completed = !foundTask.completed;
    foundTask.updatedAt = new Date().toISOString();

    const cardElement = document.querySelector(
      `.kanban-card[data-task-id="${taskId}"]`
    );
    if (cardElement) {
      const checkbox = cardElement.querySelector(".card-checkbox");

      if (foundTask.completed) {
        cardElement.classList.add("completed");
        if (checkbox) checkbox.classList.add("checked");
      } else {
        cardElement.classList.remove("completed");
        if (checkbox) checkbox.classList.remove("checked");
      }
    }

    const modalCheckbox = document.querySelector(
      `.task-completion-toggle .card-checkbox[data-task-id="${taskId}"]`
    );
    if (modalCheckbox) {
      if (foundTask.completed) {
        modalCheckbox.classList.add("checked");
      } else {
        modalCheckbox.classList.remove("checked");
      }
    }

    boardData.columns[columnIndex].tasks[taskIndex] = foundTask;
    updateBoardData(boardData);
  } catch (error) {
  }
}

function renderChecklistHTML(checklist, taskId) {
  const completedItems = checklist.items.filter(
    (item) => item.completed
  ).length;
  const totalItems = checklist.items.length;
  const progress =
    totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return `
    <div class="checklist-section" data-checklist-id="${
      checklist.id
    }" data-task-id="${taskId}">
      <div class="checklist-header">
        <h4 class="checklist-title-text checklist-title-editable" data-checklist-id="${
          checklist.id
        }">${checklist.title}</h4>
        <button class="checklist-delete-btn" title="Удалить чек-лист">&times;</button>
      </div>
      <div class="checklist-progress-info">
        <span class="checklist-progress-percentage">${progress}%</span>
        <div class="checklist-progress">
          <div class="checklist-progress-bar" style="width: ${progress}%;"></div>
        </div>
      </div>
      <div class="checklist-items">
        ${checklist.items
          .map((item) => {
            let assignedUsersHtml = "";
            if (item.assignedUsers && item.assignedUsers.length > 0) {
              assignedUsersHtml = item.assignedUsers
                .map(
                  (user) => `
              <span class="checklist-item-assignee-tag" data-user-id="${user.id}">
                @${user.name}
                <button class="delete-assignee-btn" title="Удалить пользователя">&times;</button>
              </span>
            `
                )
                .join("");
            }

            let dueDateHtml = "";
            if (item.dueDate) {
              const date = new Date(item.dueDate);

              if (!isNaN(date.getTime())) {
                const utcDate = new Date(
                  Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
                );
                dueDateHtml = `<span class="checklist-item-duedate" title="Срок: ${utcDate.toLocaleDateString(
                  "ru-RU"
                )}">📅 ${utcDate.toLocaleDateString("ru-RU")}</span>`;
              }
            }

            return `
          <div class="checklist-item ${
            item.completed ? "completed" : ""
          }" data-item-id="${item.id}">
            <div class="checklist-item-checkbox ${
              item.completed ? "checked" : ""
            }"></div>
            <div class="checklist-item-details">
              <span class="checklist-item-text checklist-item-editable" data-item-id="${
                item.id
              }">${item.text}</span>
              <div class="checklist-item-meta">
                <div class="assigned-users-container">
                  ${assignedUsersHtml}
                </div>
                ${dueDateHtml}
              </div>
            </div>
            <div class="checklist-item-actions">
              <button class="checklist-item-assign-user-btn" title="Назначить пользователя" data-item-id="${
                item.id
              }">👤</button>
              <button class="checklist-item-set-due-date-btn" title="Установить срок" data-item-id="${
                item.id
              }">📅</button>
              <button class="checklist-item-delete-btn" title="Удалить элемент">&times;</button>
            </div>
          </div>
        `;
          })
          .join("")}
      </div>
      <div class="checklist-add-item-form">
        <input type="text" class="checklist-add-input" placeholder="Добавить элемент">
        <div class="checklist-add-item-actions">
            <button class="checklist-add-btn">Добавить</button>
            <button class="checklist-cancel-add-btn">Отмена</button>
        </div>
      </div>
      <button class="checklist-show-add-form-btn">+ Добавить элемент</button>
    </div>
  `;
}

function addChecklist(taskId) {
  const boardData = JSON.parse(currentBoardData.boardData);
  const task = findTaskById(boardData, taskId);

  if (task) {
    const newChecklist = {
      id: "checklist_" + Date.now(),
      title: "Чек-лист",
      items: [],
    };
    if (!task.checklists) {
      task.checklists = [];
    }
    const isFirstChecklist = task.checklists.length === 0;
    task.checklists.push(newChecklist);
    updateBoardData(boardData);
    updateCardIndicators(taskId);

    const checklistsContainer = document.querySelector(
      `.card-checklists-container[data-task-id="${taskId}"]`
    );
    if (checklistsContainer) {
      if (
        isFirstChecklist &&
        !checklistsContainer.previousElementSibling?.classList.contains(
          "card-detail-label"
        )
      ) {
        const parentSection = checklistsContainer.closest(
          ".card-detail-section"
        );
        if (
          parentSection &&
          !parentSection.querySelector(".card-detail-label")
        ) {
          const labelDiv = document.createElement("div");
          labelDiv.className = "card-detail-label";
          labelDiv.textContent = "Чек-листы";

          if (
            checklistsContainer.parentElement.classList.contains(
              "card-modal-main-content"
            )
          ) {
            const newSection = document.createElement("div");
            newSection.className = "card-detail-section";
            newSection.appendChild(labelDiv);
            newSection.appendChild(checklistsContainer);

            const descriptionSection = document
              .querySelector(".card-description-editable")
              ?.closest(".card-detail-section");
            if (descriptionSection && descriptionSection.nextElementSibling) {
              descriptionSection.parentElement.insertBefore(
                newSection,
                descriptionSection.nextElementSibling
              );
            } else if (descriptionSection) {
              descriptionSection.parentElement.appendChild(newSection);
            } else {
              document
                .querySelector(".card-modal-main-content")
                .appendChild(newSection);
            }
          } else if (
            !checklistsContainer.parentElement.querySelector(
              ".card-detail-label"
            )
          ) {
            checklistsContainer.parentElement.insertBefore(
              labelDiv,
              checklistsContainer
            );
          }
        } else if (
          parentSection &&
          parentSection.querySelector(".card-detail-label")
        ) {
          parentSection.style.display = "";
          parentSection.querySelector(".card-detail-label").style.display = "";
        }
      }

      const newChecklistHTML = renderChecklistHTML(newChecklist, taskId);
      checklistsContainer.insertAdjacentHTML("beforeend", newChecklistHTML);
      const newChecklistElement = checklistsContainer.querySelector(
        `.checklist-section[data-checklist-id="${newChecklist.id}"]`
      );
      if (newChecklistElement) {
        updateChecklistProgress(newChecklistElement, newChecklist);
        setupChecklistEventListeners(
          newChecklistElement,
          taskId,
          newChecklist.id
        );

        const showAddFormBtn = newChecklistElement.querySelector(
          ".checklist-show-add-form-btn"
        );
        if (showAddFormBtn) showAddFormBtn.click();
      }
    }
  }
}

function deleteChecklist(taskId, checklistId) {
  const boardData = JSON.parse(currentBoardData.boardData);
  const task = findTaskById(boardData, taskId);

  if (task && task.checklists) {
    task.checklists = task.checklists.filter((cl) => cl.id !== checklistId);
    updateBoardData(boardData);
    updateCardIndicators(taskId);

    const checklistElement = document.querySelector(
      `.checklist-section[data-checklist-id="${checklistId}"]`
    );
    if (checklistElement) {
      const checklistsContainer = checklistElement.parentElement;
      checklistElement.remove();

      if (checklistsContainer && checklistsContainer.children.length === 0) {
        const parentSection = checklistsContainer.closest(
          ".card-detail-section"
        );
        if (parentSection) {
          parentSection.style.display = "none";
        }
      }
    }
  }
}

function addChecklistItem(taskId, checklistId, itemText) {
  const boardData = JSON.parse(currentBoardData.boardData);
  const task = findTaskById(boardData, taskId);
  const checklist = task
    ? task.checklists.find((cl) => cl.id === checklistId)
    : null;

  if (checklist && itemText.trim() !== "") {
    const newItem = {
      id: "item_" + Date.now(),
      text: itemText.trim(),
      completed: false,
      assignedUsers: [],
      dueDate: null,
    };
    checklist.items.push(newItem);
    updateBoardData(boardData);
    updateCardIndicators(taskId);
    updateUserCardHighlight(taskId);

    const checklistElement = document.querySelector(
      `.checklist-section[data-checklist-id="${checklistId}"]`
    );
    if (checklistElement) {
      const itemsContainer = checklistElement.querySelector(".checklist-items");
      const newItemHTML = `
        <div class="checklist-item" data-item-id="${newItem.id}">
          <div class="checklist-item-checkbox"></div>
          <div class="checklist-item-details">
            <span class="checklist-item-text checklist-item-editable" data-item-id="${newItem.id}">${newItem.text}</span>
            <div class="checklist-item-meta">
              <div class="assigned-users-container"></div> <!-- <<< ИЗМЕНЕНИЕ ЗДЕСЬ -->
              <!-- dueDate будет добавлен динамически при установке -->
            </div>
          </div>
          <div class="checklist-item-actions">
            <button class="checklist-item-assign-user-btn" title="Назначить пользователя" data-item-id="${newItem.id}">👤</button>
            <button class="checklist-item-set-due-date-btn" title="Установить срок" data-item-id="${newItem.id}">📅</button>
            <button class="checklist-item-delete-btn" title="Удалить элемент">&times;</button>
          </div>
        </div>
      `;
      itemsContainer.insertAdjacentHTML("beforeend", newItemHTML);

      const newItemElement = itemsContainer.querySelector(
        `.checklist-item[data-item-id="${newItem.id}"]`
      );
      if (newItemElement) {
        newItemElement
          .querySelector(".checklist-item-checkbox")
          .addEventListener("click", () => {
            toggleChecklistItemCompletion(taskId, checklistId, newItem.id);
          });

        const textElement = newItemElement.querySelector(
          ".checklist-item-text.checklist-item-editable"
        );
        if (textElement) {
          textElement.addEventListener(
            "click",
            function handleItemTextClick(e) {
              if (this.querySelector("input.checklist-item-edit-input")) {
                return;
              }
              const currentText = this.textContent;
              const input = document.createElement("input");
              input.type = "text";
              input.value = currentText;
              input.className = "checklist-item-edit-input";

              this.innerHTML = "";
              this.appendChild(input);
              input.focus();
              input.select();

              const saveItemText = () => {
                const newText = input.value.trim();
                if (newText && newText !== currentText) {
                  const boardDataLocal = JSON.parse(currentBoardData.boardData);
                  const taskLocal = findTaskById(boardDataLocal, taskId);
                  const checklistLocal = taskLocal
                    ? taskLocal.checklists.find((cl) => cl.id === checklistId)
                    : null;

                  const itemLocal = checklistLocal
                    ? checklistLocal.items.find((i) => i.id === newItem.id)
                    : null;
                  if (itemLocal) {
                    itemLocal.text = newText;
                    updateBoardData(boardDataLocal);
                    this.textContent = newText;
                  } else {
                    this.textContent = currentText;
                  }
                } else {
                  this.textContent = currentText;
                }
                input.removeEventListener("blur", saveItemText);
                input.removeEventListener("keydown", handleInputKeydown);
              };

              const handleInputKeydown = (event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  saveItemText();
                } else if (event.key === "Escape") {
                  this.textContent = currentText;
                  input.removeEventListener("blur", saveItemText);
                  input.removeEventListener("keydown", handleInputKeydown);
                }
              };

              input.addEventListener("blur", saveItemText);
              input.addEventListener("keydown", handleInputKeydown);
              e.stopPropagation();
            }
          );
        }

        newItemElement
          .querySelector(".checklist-item-delete-btn")
          .addEventListener("click", (e) => {
            e.stopPropagation();
            deleteChecklistItem(taskId, checklistId, newItem.id);
          });

        const newElementItemId = newItemElement.dataset.itemId;
        if (newElementItemId !== newItem.id) {
          console.warn(
            `[addChecklistItem] Mismatch! newItem.id (${newItem.id}) vs newItemElement.dataset.itemId (${newElementItemId})`
          );
        }
        setupChecklistItemActionButtons(
          newItemElement,
          taskId,
          checklistId,
          newElementItemId
        );
      }
      updateChecklistProgress(checklistElement, checklist);
    }
  }
}

function deleteChecklistItem(taskId, checklistId, itemId) {
  const boardData = JSON.parse(currentBoardData.boardData);
  const task = findTaskById(boardData, taskId);
  const checklist = task
    ? task.checklists.find((cl) => cl.id === checklistId)
    : null;

  if (checklist) {
    checklist.items = checklist.items.filter((item) => item.id !== itemId);
    updateBoardData(boardData);
    updateCardIndicators(taskId);
    updateUserCardHighlight(taskId);

    const itemElement = document.querySelector(
      `.checklist-item[data-item-id="${itemId}"]`
    );
    if (itemElement) {
      itemElement.remove();
    }
    const checklistElement = document.querySelector(
      `.checklist-section[data-checklist-id="${checklistId}"]`
    );
    if (checklistElement) {
      updateChecklistProgress(checklistElement, checklist);
    }
  }
}

function toggleChecklistItemCompletion(taskId, checklistId, itemId) {
  const boardData = JSON.parse(currentBoardData.boardData);
  const task = findTaskById(boardData, taskId);
  const checklist = task
    ? task.checklists.find((cl) => cl.id === checklistId)
    : null;
  const item = checklist ? checklist.items.find((i) => i.id === itemId) : null;

  if (item) {
    item.completed = !item.completed;
    updateBoardData(boardData);
    updateCardIndicators(taskId);
    updateUserCardHighlight(taskId);

    const itemElement = document.querySelector(
      `.checklist-item[data-item-id="${itemId}"]`
    );
    if (itemElement) {
      itemElement.classList.toggle("completed", item.completed);
      itemElement
        .querySelector(".checklist-item-checkbox")
        .classList.toggle("checked", item.completed);
    }
    const checklistElement = document.querySelector(
      `.checklist-section[data-checklist-id="${checklistId}"]`
    );
    if (checklistElement) {
      updateChecklistProgress(checklistElement, checklist);
    }
  }
}

function updateChecklistProgress(checklistElement, checklistData) {
  const completedItems = checklistData.items.filter(
    (item) => item.completed
  ).length;
  const totalItems = checklistData.items.length;
  const progress =
    totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const progressBar = checklistElement.querySelector(".checklist-progress-bar");
  const progressPercentage = checklistElement.querySelector(
    ".checklist-progress-percentage"
  );

  if (progressBar) progressBar.style.width = `${progress}%`;
  if (progressPercentage) progressPercentage.textContent = `${progress}%`;
}

function findTaskById(boardData, taskId) {
  for (const column of boardData.columns) {
    const task = column.tasks.find((t) => t.id === taskId);
    if (task) return task;
  }
  return null;
}

function setupChecklistEventListeners(checklistElement, taskId, checklistId) {
  const oldDeleteBtn = checklistElement.querySelector(".checklist-delete-btn");
  if (oldDeleteBtn) {
    const newDeleteBtn = oldDeleteBtn.cloneNode(true);
    oldDeleteBtn.parentNode.replaceChild(newDeleteBtn, oldDeleteBtn);
    newDeleteBtn.addEventListener("click", () => {
      if (confirm("Удалить этот чек-лист?")) {
        deleteChecklist(taskId, checklistId);
      }
    });
  }

  const showAddFormBtn = checklistElement.querySelector(
    ".checklist-show-add-form-btn"
  );
  const addItemForm = checklistElement.querySelector(
    ".checklist-add-item-form"
  );

  const originalAddInput = checklistElement.querySelector(
    ".checklist-add-input"
  );
  const originalAddBtn = checklistElement.querySelector(".checklist-add-btn");
  const originalCancelBtn = checklistElement.querySelector(
    ".checklist-cancel-add-btn"
  );

  if (showAddFormBtn) {
    const newShowAddFormBtn = showAddFormBtn.cloneNode(true);
    showAddFormBtn.parentNode.replaceChild(newShowAddFormBtn, showAddFormBtn);
    newShowAddFormBtn.addEventListener("click", () => {
      addItemForm.style.display = "flex";
      newShowAddFormBtn.style.display = "none";

      const currentAddInput = checklistElement.querySelector(
        ".checklist-add-input"
      );
      if (currentAddInput) currentAddInput.focus();
    });
  }

  if (originalCancelBtn) {
    const newCancelBtn = originalCancelBtn.cloneNode(true);
    originalCancelBtn.parentNode.replaceChild(newCancelBtn, originalCancelBtn);
    newCancelBtn.addEventListener("click", () => {
      addItemForm.style.display = "none";
      const currentShowAddFormBtn = checklistElement.querySelector(
        ".checklist-show-add-form-btn"
      );
      if (currentShowAddFormBtn) currentShowAddFormBtn.style.display = "block";

      const currentAddInput = checklistElement.querySelector(
        ".checklist-add-input"
      );
      if (currentAddInput) currentAddInput.value = "";
    });
  }

  if (originalAddInput) {
    const newAddInput = originalAddInput.cloneNode(true);
    originalAddInput.parentNode.replaceChild(newAddInput, originalAddInput);
    newAddInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();

        const currentAddBtn =
          checklistElement.querySelector(".checklist-add-btn");
        if (currentAddBtn) currentAddBtn.click();
      }
    });
  }

  if (originalAddBtn) {
    const newAddBtn = originalAddBtn.cloneNode(true);
    originalAddBtn.parentNode.replaceChild(newAddBtn, originalAddBtn);
    newAddBtn.addEventListener("click", () => {
      const currentAddInput = checklistElement.querySelector(
        ".checklist-add-input"
      );
      if (currentAddInput) {
        const text = currentAddInput.value.trim();
        if (text) {
          addChecklistItem(taskId, checklistId, text);
          currentAddInput.value = "";
          currentAddInput.focus();
        }
      }
    });
  }

  checklistElement
    .querySelectorAll(".checklist-item")
    .forEach((itemElement) => {
      const itemId = itemElement.dataset.itemId;

      const checkbox = itemElement.querySelector(".checklist-item-checkbox");
      const textElement = itemElement.querySelector(
        ".checklist-item-text.checklist-item-editable"
      );
      const deleteItemBtn = itemElement.querySelector(
        ".checklist-item-delete-btn"
      );

      if (checkbox) {
        const newCheckbox = checkbox.cloneNode(true);
        checkbox.parentNode.replaceChild(newCheckbox, checkbox);
        newCheckbox.addEventListener("click", () => {
          toggleChecklistItemCompletion(taskId, checklistId, itemId);
        });
      }
      if (deleteItemBtn) {
        const newDeleteItemBtn = deleteItemBtn.cloneNode(true);
        deleteItemBtn.parentNode.replaceChild(newDeleteItemBtn, deleteItemBtn);
        newDeleteItemBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          deleteChecklistItem(taskId, checklistId, itemId);
        });
      }

      setupChecklistItemActionButtons(itemElement, taskId, checklistId, itemId);
    });

  const checklistTitleElement = checklistElement.querySelector(
    ".checklist-title-editable"
  );
  if (checklistTitleElement) {
    const newChecklistTitleElement = checklistTitleElement.cloneNode(true);
    checklistTitleElement.parentNode.replaceChild(
      newChecklistTitleElement,
      checklistTitleElement
    );

    newChecklistTitleElement.addEventListener(
      "click",
      function handleTitleClick(e) {
        if (this.querySelector(".checklist-title-input-inline")) {
          return;
        }

        const currentTitle = this.textContent;
        const input = document.createElement("input");
        input.value = currentTitle;
        input.className = "checklist-title-input-inline";
        this.innerHTML = "";
        this.appendChild(input);
        input.focus();

        const valueLength = input.value.length;
        input.setSelectionRange(valueLength, valueLength);

        const saveChecklistTitle = () => {
          const newTitle = input.value.trim();
          if (newTitle && newTitle !== currentTitle) {
            const boardData = JSON.parse(currentBoardData.boardData);
            const task = findTaskById(boardData, taskId);
            const checklist = task
              ? task.checklists.find((cl) => cl.id === checklistId)
              : null;
            if (checklist) {
              checklist.title = newTitle;
              updateBoardData(boardData);
              newChecklistTitleElement.textContent = newTitle;
            } else {
              newChecklistTitleElement.textContent = currentTitle;
            }
          } else {
            newChecklistTitleElement.textContent = currentTitle;
          }

          input.removeEventListener("blur", saveChecklistTitle);
          input.removeEventListener("keydown", handleInputKeydown);
        };

        const handleInputKeydown = (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            saveChecklistTitle();
          } else if (event.key === "Escape") {
            newChecklistTitleElement.textContent = currentTitle;
            input.removeEventListener("blur", saveChecklistTitle);
            input.removeEventListener("keydown", handleInputKeydown);
          }
        };

        input.addEventListener("blur", saveChecklistTitle);
        input.addEventListener("keydown", handleInputKeydown);

        e.stopPropagation();
      }
    );
  }
}

function setupChecklistItemActionButtons(
  itemElement,
  taskId,
  checklistId,
  itemId
) {
  const assignUserBtn = itemElement.querySelector(
    ".checklist-item-assign-user-btn"
  );
  const setDueDateBtn = itemElement.querySelector(
    ".checklist-item-set-due-date-btn"
  );

  if (assignUserBtn) {
    const newAssignUserBtn = assignUserBtn.cloneNode(true);
    assignUserBtn.parentNode.replaceChild(newAssignUserBtn, assignUserBtn);
    newAssignUserBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      closeAllChecklistItemPopups();

      const users = await getMentionableUsers("");

      const dropdown = document.createElement("div");
      dropdown.className = "checklist-user-dropdown";

      if (!users || users.length === 0) {
        const noUsersDiv = document.createElement("div");
        noUsersDiv.className = "checklist-user-item-empty";
        noUsersDiv.textContent = "Пользователи не найдены";
        dropdown.appendChild(noUsersDiv);
      } else {
        users.forEach((user) => {
          const userDiv = document.createElement("div");
          userDiv.className = "checklist-user-item";
          userDiv.textContent = user.fullName || user.username;
          userDiv.dataset.userId = user.id;
          userDiv.dataset.userName = user.fullName || user.username;
          userDiv.addEventListener("click", () => {
            const currentItemId = itemId;

            if (itemElement.dataset.itemId !== currentItemId) {
              console.error(
                `[UserDiv Click] MISMATCH: DOM element data-id (${itemElement.dataset.itemId}) !== currentItemId from closure (${currentItemId}). This is a problem!`
              );
            }

            const boardData = JSON.parse(currentBoardData.boardData);
            const task = findTaskById(boardData, taskId);
            const checklist = task?.checklists.find(
              (cl) => cl.id === checklistId
            );

            if (!checklist) {
              console.error(
                "[UserDiv Click] Checklist not found in data for ID:",
                checklistId
              );
              closeAllChecklistItemPopups();
              return;
            }

            const itemToUpdate = checklist.items.find(
              (i) => i.id === currentItemId
            );

            if (itemToUpdate) {
              if (!itemToUpdate.assignedUsers) {
                itemToUpdate.assignedUsers = [];
              }
              if (!itemToUpdate.assignedUsers.find((u) => u.id === user.id)) {
                itemToUpdate.assignedUsers.push({
                  id: user.id,
                  name: user.fullName || user.username,
                });

                updateBoardData(boardData);
                updateUserCardHighlight(taskId);

                const freshItemElement = document.querySelector(
                  `.checklist-item[data-item-id="${currentItemId}"]`
                );

                if (freshItemElement) {
                  if (!document.body.contains(freshItemElement)) {
                    console.error(
                      "[UserDiv Click] freshItemElement is DETACHED from DOM before rendering assigned users!",
                      freshItemElement
                    );
                  }
                  renderAssignedUsersForChecklistItem(
                    freshItemElement,
                    itemToUpdate.assignedUsers,
                    taskId,
                    checklistId,
                    itemToUpdate.id
                  );
                } else {
                  console.error(
                    `[UserDiv Click] CRITICAL: freshItemElement with data-item-id '${currentItemId}' NOT FOUND in DOM before rendering assigned users.`
                  );
                }
              } else {
              }
            } else {
              console.error(
                `[UserDiv Click] CRITICAL: Item with ID '${currentItemId}' NOT FOUND in data. TaskId: ${taskId}, ChecklistId: ${checklistId}. Checklist items in data:`,
                checklist.items.map((it) => it.id)
              );
            }
            closeAllChecklistItemPopups();
          });
          dropdown.appendChild(userDiv);
        });
      }

      itemElement
        .querySelector(".checklist-item-actions")
        .appendChild(dropdown);
      activeChecklistItemUserDropdown = dropdown;
    });
  }

  const boardDataForInitialRender = JSON.parse(currentBoardData.boardData);
  const taskForInitialRender = findTaskById(boardDataForInitialRender, taskId);
  const checklistForInitialRender = taskForInitialRender?.checklists.find(
    (cl) => cl.id === checklistId
  );
  const itemForInitialRender = checklistForInitialRender?.items.find(
    (i) => i.id === itemId
  );
  if (itemForInitialRender && itemForInitialRender.assignedUsers) {
    renderAssignedUsersForChecklistItem(
      itemElement,
      itemForInitialRender.assignedUsers,
      taskId,
      checklistId,
      itemId
    );
  }

  if (setDueDateBtn) {
    const newSetDueDateBtn = setDueDateBtn.cloneNode(true);
    setDueDateBtn.parentNode.replaceChild(newSetDueDateBtn, setDueDateBtn);

    newSetDueDateBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllChecklistItemPopups();

      const currentDueDateValue =
        itemElement
          .querySelector(".checklist-item-duedate")
          ?.textContent.split(" ")[1] || "";

      let dateForInput = "";
      if (currentDueDateValue) {
        const parts = currentDueDateValue.split(".");
        if (parts.length === 3) {
          dateForInput = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }

      const dateInput = document.createElement("input");
      dateInput.type = "date";
      dateInput.className = "checklist-item-date-input";
      dateInput.value = dateForInput;

      newSetDueDateBtn.style.display = "none";

      newSetDueDateBtn.parentNode.insertBefore(
        dateInput,
        newSetDueDateBtn.nextSibling
      );
      dateInput.focus();

      activeChecklistItemDateInput = {
        input: dateInput,
        setDueDateBtn: newSetDueDateBtn,
        taskId,
        checklistId,
        itemId,
      };

      const saveDueDate = () => {
        if (
          activeChecklistItemDateInput &&
          activeChecklistItemDateInput.input === dateInput
        ) {
          const newDueDate = dateInput.value;

          const boardData = JSON.parse(currentBoardData.boardData);
          const task = findTaskById(boardData, taskId);
          const checklist = task?.checklists.find(
            (cl) => cl.id === checklistId
          );
          const item = checklist?.items.find((i) => i.id === itemId);

          if (item) {
            item.dueDate = newDueDate ? newDueDate : null;
            updateBoardData(boardData);

            const metaContainer = itemElement.querySelector(
              ".checklist-item-meta"
            );
            let dueDateDisplay = metaContainer.querySelector(
              ".checklist-item-duedate"
            );
            if (newDueDate) {
              if (!dueDateDisplay) {
                dueDateDisplay = document.createElement("span");
                dueDateDisplay.className = "checklist-item-duedate";
                metaContainer.appendChild(dueDateDisplay);
              }
              const displayDate = new Date(newDueDate);
              const utcDisplayDate = new Date(
                Date.UTC(
                  displayDate.getFullYear(),
                  displayDate.getMonth(),
                  displayDate.getDate()
                )
              );
              dueDateDisplay.textContent = `📅 ${utcDisplayDate.toLocaleDateString(
                "ru-RU"
              )}`;
              dueDateDisplay.title = `Срок: ${utcDisplayDate.toLocaleDateString(
                "ru-RU"
              )}`;
            } else if (dueDateDisplay) {
              dueDateDisplay.remove();
            }
          }
          closeAllChecklistItemPopups();
        }
      };

      dateInput.addEventListener("blur", () => {
        setTimeout(saveDueDate, 100);
      });

      dateInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          saveDueDate();
        } else if (event.key === "Escape") {
          event.preventDefault();
          closeAllChecklistItemPopups();
        }
      });
    });
  }
}

function renderAssignedUsersForChecklistItem(
  itemElement,
  assignedUsers,
  taskId,
  checklistId,
  itemId
) {

  if (!itemElement) {
    console.error(
      `[renderAssignedUsersForChecklistItem] CRITICAL: itemElement is NULL for itemId: ${itemId}. Cannot render.`
    );
    return;
  }
  if (!document.body.contains(itemElement)) {
    console.error(
      `[renderAssignedUsersForChecklistItem] itemElement for itemId ${itemId} is DETACHED from DOM. Cannot render.`,
      itemElement
    );
    return;
  }

  const assignedUsersContainer = itemElement.querySelector(
    ".assigned-users-container"
  );
  if (!assignedUsersContainer) {
    console.error(
      `[renderAssignedUsersForChecklistItem] CRITICAL: .assigned-users-container NOT FOUND within itemElement for itemId: ${itemId}. itemElement innerHTML:`,
      itemElement.innerHTML
    );
    return;
  }

  assignedUsersContainer.innerHTML = "";

  if (assignedUsers && assignedUsers.length > 0) {
    assignedUsers.forEach((user) => {
      const userTag = document.createElement("span");
      userTag.className = "checklist-item-assignee-tag";
      userTag.dataset.userId = user.id;
      userTag.textContent = `@${user.name}`;

      const deleteAssigneeBtn = document.createElement("button");
      deleteAssigneeBtn.className = "delete-assignee-btn";
      deleteAssigneeBtn.title = "Удалить пользователя";
      deleteAssigneeBtn.innerHTML = "&times;";

      deleteAssigneeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const boardData = JSON.parse(currentBoardData.boardData);
        const task = findTaskById(boardData, taskId);
        const checklist = task?.checklists.find((cl) => cl.id === checklistId);
        const item = checklist?.items.find((i) => i.id === itemId);

        if (item && item.assignedUsers) {
          item.assignedUsers = item.assignedUsers.filter(
            (u) => u.id !== user.id
          );
          updateBoardData(boardData);
          renderAssignedUsersForChecklistItem(
            itemElement,
            item.assignedUsers,
            taskId,
            checklistId,
            itemId
          );
          updateUserCardHighlight(taskId);
        }
      });

      userTag.appendChild(deleteAssigneeBtn);
      assignedUsersContainer.appendChild(userTag);
    });
  }
}

function positionMentionsDropdown(textarea) {
  if (!mentionsDropdown || !textarea) return;
  const rect = textarea.getBoundingClientRect();

  if (rect.width === 0 && rect.height === 0) {
    console.warn(
      "Mentions: Textarea has no dimensions, cannot position dropdown accurately.",
      textarea
    );

    hideMentionsDropdown();
    return;
  }

  mentionsDropdown.style.left = `${rect.left + window.scrollX}px`;
  mentionsDropdown.style.top = `${rect.bottom + window.scrollY}px`;
  mentionsDropdown.style.width = `${rect.width}px`;
}

let activeChecklistItemUserDropdown = null;

let activeChecklistItemDateInput = null;

function closeAllChecklistItemPopups() {
  if (activeChecklistItemUserDropdown) {
    activeChecklistItemUserDropdown.remove();
    activeChecklistItemUserDropdown = null;
  }
  if (activeChecklistItemDateInput) {
    const { input, setDueDateBtn } = activeChecklistItemDateInput;
    input.remove();
    setDueDateBtn.style.display = "";
    activeChecklistItemDateInput = null;
  }
}

document.addEventListener("click", function (event) {
  if (
    activeChecklistItemUserDropdown &&
    !activeChecklistItemUserDropdown.contains(event.target) &&
    !event.target.classList.contains("checklist-item-assign-user-btn")
  ) {
    closeAllChecklistItemPopups();
  }
  if (
    activeChecklistItemDateInput &&
    !activeChecklistItemDateInput.input.contains(event.target) &&
    !event.target.classList.contains("checklist-item-set-due-date-btn")
  ) {
    const { input, setDueDateBtn, taskId, checklistId, itemId } =
      activeChecklistItemDateInput;

    closeAllChecklistItemPopups();
  }

  if (mentionsDropdown && mentionsDropdown.style.display === "block") {
    const isClickInsideTextarea =
      currentMentionTextarea && currentMentionTextarea.contains(event.target);
    const isClickInsideDropdown = mentionsDropdown.contains(event.target);
    if (!isClickInsideTextarea && !isClickInsideDropdown) {
      hideMentionsDropdown();
    }
  }
});

function archiveCard(taskId) {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";

  modalOverlay.innerHTML = `
    <div class="modal-container delete-card-modal">
      <div class="modal-header">
        <h3 class="modal-title">Архивировать карточку</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <p>Карточка будет перемещена в архив, но вы сможете восстановить её при необходимости.</p>
        <p class="delete-warning">Вы уверены, что хотите архивировать эту карточку?</p>
      </div>
      <div class="modal-footer">
        <button class="modal-secondary-btn" id="cancelArchive">Отмена</button>
        <button class="modal-danger-btn" id="confirmArchive">Архивировать</button>
      </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);

  setTimeout(() => {
    modalOverlay.classList.add("active");
  }, 10);

  const closeModal = () => {
    modalOverlay.classList.remove("active");
    setTimeout(() => {
      document.body.removeChild(modalOverlay);
    }, 300);
  };

  modalOverlay
    .querySelector(".modal-close")
    .addEventListener("click", closeModal);

  document
    .getElementById("cancelArchive")
    .addEventListener("click", closeModal);

  document.getElementById("confirmArchive").addEventListener("click", () => {
    try {
      const boardData = JSON.parse(currentBoardData.boardData);

      let columnIndex = -1;
      let taskIndex = -1;

      for (let i = 0; i < boardData.columns.length; i++) {
        const column = boardData.columns[i];
        const tIndex = column.tasks.findIndex((task) => task.id === taskId);

        if (tIndex !== -1) {
          columnIndex = i;
          taskIndex = tIndex;
          break;
        }
      }

      if (columnIndex === -1 || taskIndex === -1) {
        console.error("Карточка не найдена");
        closeModal();
        return;
      }

      let userData;
      try {
        userData = JSON.parse(localStorage.getItem("auth_user") || "{}");
      } catch (e) {
        userData = {};
      }
      const archivedBy =
        userData.fullname ||
        ((userData.firstName || "") + " " + (userData.lastName || "")).trim() ||
        userData.name ||
        "Пользователь";

      boardData.columns[columnIndex].tasks[taskIndex].archived = true;
      boardData.columns[columnIndex].tasks[taskIndex].archivedAt =
        new Date().toISOString();
      boardData.columns[columnIndex].tasks[taskIndex].archivedBy = archivedBy;
      boardData.columns[columnIndex].tasks[taskIndex].updatedAt =
        new Date().toISOString();

      updateBoardData(boardData);

      const cardElement = document.querySelector(
        `.kanban-card[data-task-id="${taskId}"]`
      );
      if (cardElement) {
        cardElement.remove();
      }

      renderArchiveSidebarContent();

      closeModal();
    } catch (error) {
      console.error("Ошибка при архивировании карточки:", error);
      alert("Не удалось архивировать карточку: " + error.message);
      closeModal();
    }
  });

  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });

  const handleKeydown = (e) => {
    if (e.key === "Escape") {
      closeModal();
      document.removeEventListener("keydown", handleKeydown);
    }
  };

  document.addEventListener("keydown", handleKeydown);
}

function unarchiveCard(taskId, columnId) {
  try {
    const boardData = JSON.parse(currentBoardData.boardData);
    const column = boardData.columns.find((col) => col.id === columnId);
    if (!column) return;
    const task = column.tasks.find((t) => t.id === taskId);
    if (!task) return;
    task.archived = false;
    task.updatedAt = new Date().toISOString();
    updateBoardData(boardData);

    renderArchiveSidebarContent();

    const columnCards = document.querySelector(
      `.column-cards[data-column-id="${columnId}"]`
    );
    if (columnCards) {
      const cards = column.tasks.filter((t) => !t.archived);
      columnCards.innerHTML = cards
        .map((task) => {
          const commentsCount = task.comments ? task.comments.length : 0;
          const hasDescription =
            task.description && task.description.trim() !== "";
          const isCompleted = task.completed ? "completed" : "";
          const checkboxClass = task.completed ? "checked" : "";

          return `
            <div class="kanban-card ${isCompleted}" draggable="true" data-task-id="${
            task.id
          }">
              <div class="card-checkbox ${checkboxClass}" data-task-id="${
            task.id
          }"></div>
              <div class="card-content">
                <div class="card-title">${task.title}</div>
                <div class="card-indicators">
                  ${
                    hasDescription
                      ? `<div class="card-indicator description-indicator" title="Карточка содержит описание">
                          <i class="fas fa-align-left"></i>
                        </div>`
                      : ""
                  }
                  ${
                    commentsCount > 0
                      ? `<div class="card-indicator comments-indicator" title="Комментарии: ${commentsCount}">
                          <i class="fas fa-comment"></i>
                          <span class="indicator-count">${commentsCount}</span>
                        </div>`
                      : ""
                  }
                </div>
              </div>
            </div>
          `;
        })
        .join("");

      setupBoardEventListeners(currentBoardData.id);
    } else {
      window.location.reload();
    }
  } catch (error) {
    alert("Ошибка при восстановлении карточки: " + error.message);
  }
}

function renderArchiveSidebarContent() {
  try {
    const boardData = JSON.parse(currentBoardData.boardData);
    let archivedCards = [];
    (boardData.columns || []).forEach((column) => {
      (column.tasks || []).forEach((task) => {
        if (task.archived) {
          archivedCards.push({
            ...task,
            columnName: column.name,
            columnId: column.id,
          });
        }
      });
    });

    const archiveSidebar = document.getElementById("archiveSidebar");
    if (!archiveSidebar) return;

    const content = archiveSidebar.querySelector(".archive-sidebar-content");
    if (!content) return;

    let searchInput = archiveSidebar.querySelector("#archive-search-input");
    if (!searchInput) {
      const searchDiv = document.createElement("div");
      searchDiv.innerHTML = `
        <input 
          type="text" 
          id="archive-search-input" 
          class="archive-search-input"
          placeholder="Поиск по архиву..." 
        />
      `;
      content.parentElement.insertBefore(searchDiv, content);
      searchInput = searchDiv.querySelector("#archive-search-input");
    }

    const filterValue =
      searchInput && searchInput.value
        ? searchInput.value.trim().toLowerCase()
        : "";
    let filteredCards = archivedCards;
    if (filterValue) {
      filteredCards = archivedCards.filter(
        (card) =>
          (card.title && card.title.toLowerCase().includes(filterValue)) ||
          (card.description &&
            card.description.toLowerCase().includes(filterValue))
      );
    }

    if (filteredCards.length === 0) {
      content.innerHTML = filterValue
        ? '<div class="archive-empty">Ничего не найдено</div>'
        : '<div class="archive-empty">Нет архивированных карточек</div>';
    } else {
      content.innerHTML = filteredCards
        .map(
          (card) => `
          <div class="archive-card" data-task-id="${card.id}" data-column-id="${
            card.columnId
          }">
            <div class="archive-card-title">${card.title}</div>
            <div class="archive-card-meta">Колонка: <b>${
              card.columnName
            }</b></div>
            <div class="archive-card-archiveinfo">
              <span>Кем: <b>${
                card.archivedBy ? card.archivedBy : "—"
              }</b></span><br>
              <span>Когда: <b>${
                card.archivedAt
                  ? new Date(card.archivedAt).toLocaleString("ru-RU")
                  : "—"
              }</b></span>
            </div>
            <div class="archive-card-actions">
              <button class="archive-unarchive-btn" data-task-id="${
                card.id
              }" data-column-id="${card.columnId}">Восстановить</button>
            </div>
          </div>
        `
        )
        .join("");
    }

    content.querySelectorAll(".archive-unarchive-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const taskId = btn.getAttribute("data-task-id");
        const columnId = btn.getAttribute("data-column-id");
        unarchiveCard(taskId, columnId);
      });
    });

    content.querySelectorAll(".archive-card").forEach((cardDiv) => {
      cardDiv.addEventListener("click", (e) => {
        if (e.target.closest(".archive-unarchive-btn")) return;
        const taskId = cardDiv.getAttribute("data-task-id");
        openCardDetailModal(taskId, { archived: true });
      });
    });

    if (searchInput && !searchInput._archiveSearchHandlerAdded) {
      searchInput.addEventListener("input", () => {
        renderArchiveSidebarContent();
      });
      searchInput._archiveSearchHandlerAdded = true;
    }
  } catch (error) {}
}

function filterKanbanCards(query) {
  const filter = (query || "").trim().toLowerCase();
  const boardData = JSON.parse(currentBoardData.boardData);

  boardData.columns.forEach((column) => {
    const columnElement = document.querySelector(
      `.kanban-column[data-column-id="${column.id}"]`
    );
    if (!columnElement) return;
    const cards = columnElement.querySelectorAll(".kanban-card");
    cards.forEach((card) => {
      const taskId = card.getAttribute("data-task-id");
      const task = column.tasks.find((t) => t.id === taskId);
      if (!task) {
        card.style.display = "";
        return;
      }
      const title = (task.title || "").toLowerCase();
      if (!filter || title.includes(filter)) {
        card.style.display = "";
      } else {
        card.style.display = "none";
      }
    });
  });
}

function handleTouchStart(e) {
  const card = e.currentTarget;
  if (card.closest('[data-view-only="true"]')) return;
  if (e.target.closest(".card-actions, .card-checkbox")) return;

  if (e.touches.length === 1) {
    touchDraggingCard = card;
    isTouchDragging = false;
    const touch = e.touches[0];
    initialTouchX = touch.clientX;
    initialTouchY = touch.clientY;

    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd, { passive: false });
    document.addEventListener("touchcancel", handleTouchEnd, {
      passive: false,
    });

    longPressTimer = setTimeout(() => {
      e.preventDefault();
      isTouchDragging = true;

      const rect = card.getBoundingClientRect();
      touchGhostCard = card.cloneNode(true);
      touchGhostCard.classList.add("dragging", "ghost");
      document.body.appendChild(touchGhostCard);

      touchGhostCard.style.left = `${rect.left}px`;
      touchGhostCard.style.top = `${rect.top}px`;
      touchGhostCard.style.width = `${rect.width}px`;
      touchGhostCard.style.height = `${rect.height}px`;

      card.classList.add("dragging-source");
    }, 250);
  }
}

function handleTouchMove(e) {
  if (!touchDraggingCard) return;

  const touch = e.touches[0];
  const dx = Math.abs(touch.clientX - initialTouchX);
  const dy = Math.abs(touch.clientY - initialTouchY);

  if (!isTouchDragging && (dx > 5 || dy > 5)) {
    clearTimeout(longPressTimer);
    isTouchDragging = true;

    const card = touchDraggingCard;
    const rect = card.getBoundingClientRect();
    touchGhostCard = card.cloneNode(true);
    touchGhostCard.classList.add("dragging", "ghost");
    document.body.appendChild(touchGhostCard);

    touchGhostCard.style.left = `${rect.left}px`;
    touchGhostCard.style.top = `${rect.top}px`;
    touchGhostCard.style.width = `${rect.width}px`;
    touchGhostCard.style.height = `${rect.height}px`;

    card.classList.add("dragging-source");
  }

  if (!isTouchDragging) return;

  e.preventDefault();

  touchGhostCard.style.transform = `translate(${
    touch.clientX - initialTouchX
  }px, ${touch.clientY - initialTouchY}px)`;

  touchGhostCard.style.display = "none";
  const existingIndicator = document.querySelector(".card-drop-indicator");
  if (existingIndicator) existingIndicator.style.display = "none";

  const elementUnder = document.elementFromPoint(touch.clientX, touch.clientY);

  touchGhostCard.style.display = "";
  if (existingIndicator) existingIndicator.style.display = "";

  if (!elementUnder) return;

  const dropZone = elementUnder.closest(".column-cards");

  document
    .querySelectorAll(".column-cards.drag-over")
    .forEach((el) => el.classList.remove("drag-over"));
  document
    .querySelectorAll(".card-drop-indicator")
    .forEach((el) => el.remove());

  if (dropZone) {
    dropZone.classList.add("drag-over");
    const cardUnder = elementUnder.closest(
      ".kanban-card:not(.dragging-source)"
    );
    const indicator = document.createElement("div");
    indicator.className = "card-drop-indicator";

    if (cardUnder) {
      const cardRect = cardUnder.getBoundingClientRect();
      const isBottomHalf = touch.clientY > cardRect.top + cardRect.height / 2;
      if (isBottomHalf) {
        cardUnder.after(indicator);
      } else {
        cardUnder.before(indicator);
      }
    } else {
      dropZone.appendChild(indicator);
    }
  }
}

function handleTouchEnd(e) {
  clearTimeout(longPressTimer);
  const wasDragging = isTouchDragging;

  document.removeEventListener("touchmove", handleTouchMove);
  document.removeEventListener("touchend", handleTouchEnd);
  document.removeEventListener("touchcancel", handleTouchEnd);

  if (wasDragging) {
    e.preventDefault();

    const dropIndicator = document.querySelector(".card-drop-indicator");
    const dropZone = dropIndicator
      ? dropIndicator.closest(".column-cards")
      : null;

    if (dropZone && touchDraggingCard) {
      const taskId = touchDraggingCard.dataset.taskId;
      const sourceColumnId =
        touchDraggingCard.closest(".kanban-column").dataset.columnId;
      const targetColumnId = dropZone.dataset.columnId;

      dropIndicator.parentNode.insertBefore(touchDraggingCard, dropIndicator);

      const boardData = JSON.parse(currentBoardData.boardData);
      const sourceCol = boardData.columns.find((c) => c.id === sourceColumnId);
      const targetCol = boardData.columns.find((c) => c.id === targetColumnId);

      if (sourceCol && targetCol) {
        let taskToMove = null;
        const taskIndex = sourceCol.tasks.findIndex((t) => t.id === taskId);

        if (taskIndex > -1) {
          taskToMove = sourceCol.tasks[taskIndex];
        } else {
          taskToMove = findTaskById(boardData, taskId);
        }

        if (taskToMove) {
          boardData.columns.forEach((col) => {
            col.tasks = col.tasks.filter((t) => t.id !== taskId);
          });

          const cardsInColumn = dropZone.querySelectorAll(".kanban-card");
          const newOrderedTasks = [];
          cardsInColumn.forEach((cardEl) => {
            const cardId = cardEl.getAttribute("data-task-id");
            if (cardId === taskId) {
              newOrderedTasks.push(taskToMove);
            } else {
              const taskObj = findTaskById(boardData, cardId);
              if (taskObj) newOrderedTasks.push(taskObj);
            }
          });
          targetCol.tasks = newOrderedTasks;
          updateBoardData(boardData);
        }
      }
    }

    if (touchGhostCard && touchGhostCard.parentNode) {
      document.body.removeChild(touchGhostCard);
    }
    if (touchDraggingCard) {
      touchDraggingCard.classList.remove("dragging-source");
    }
    document
      .querySelectorAll(".drag-over")
      .forEach((el) => el.classList.remove("drag-over"));
    document
      .querySelectorAll(".card-drop-indicator")
      .forEach((el) => el.remove());
  } else if (touchDraggingCard) {
    openCardDetailModal(touchDraggingCard.dataset.taskId);
  }

  touchDraggingCard = null;
  touchGhostCard = null;
  isTouchDragging = false;
  longPressTimer = null;
}
