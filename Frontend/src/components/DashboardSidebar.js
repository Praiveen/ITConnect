import { kanbanService } from "../services/kanban-service.js";
import { workspaceService } from "../services/workspace-service.js";
import { navigateToChat } from "./WorkspaceManager.js";

let boardsCache = null;
let lastBoardsFetchTime = 0;
const CACHE_TIMEOUT = 60 * 1000;

let workspacesCache = null;
let lastWorkspacesFetchTime = 0;

let expandedWorkspacesCache = null;

let allUserChatsCache = null;
let lastAllUserChatsFetchTime = 0;

export const WORKSPACE_TABS = {
  ALL: "all",
  MY: "my",
  SHARED: "shared",
};

let activeWorkspaceTab = WORKSPACE_TABS.MY;

export function getBoardsCache() {
  return boardsCache;
}

export function updateBoardsCache(newCache) {
  boardsCache = newCache;
  lastBoardsFetchTime = Date.now();
}

export function invalidateWorkspaceChatsCache(workspaceId) {
  console.log(
    `[САЙДБАР] invalidateWorkspaceChatsCache вызван для РП ${workspaceId}. Инвалидируем общий кэш чатов.`
  );
  invalidateAllUserChatsCache();
}

export function invalidateAllUserChatsCache() {
  allUserChatsCache = null;
  lastAllUserChatsFetchTime = 0;
  console.log("[САЙДБАР] Кэш ВСЕХ чатов пользователя инвалидирован.");
}

export async function renderDashboardSidebar(
  activeEntityId = null,
  activeWorkspaceIdFromDashboard = null
) {
  let activeEntityType = null;

  console.log(
    "Рендеринг боковой панели. Активный элемент (из параметра):",
    activeEntityId,
    "Активное пространство (из параметра):",
    activeWorkspaceIdFromDashboard
  );

  const currentHash = window.location.hash.substring(1);
  const urlParams = new URLSearchParams(
    currentHash.includes("?") ? currentHash.split("?")[1] : ""
  );

  const boardIdFromUrl = urlParams.get("board");
  const chatIdFromUrl = urlParams.get("chat");
  const workspaceIdFromUrl = urlParams.get("workspace");

  if (!activeEntityId) {
    if (boardIdFromUrl) {
      activeEntityId = boardIdFromUrl;
      activeEntityType = "board";
    } else if (chatIdFromUrl) {
      activeEntityId = chatIdFromUrl;
      activeEntityType = "chat";
    }
  } else {
    if (boardIdFromUrl && boardIdFromUrl === activeEntityId)
      activeEntityType = "board";
    else if (chatIdFromUrl && chatIdFromUrl === activeEntityId)
      activeEntityType = "chat";
  }

  const currentActiveWorkspaceId =
    activeWorkspaceIdFromDashboard || workspaceIdFromUrl;

  console.log(
    "Данные для сайдбара: активный элемент =",
    activeEntityId,
    "Тип =",
    activeEntityType,
    "активное пространство =",
    currentActiveWorkspaceId
  );

  setTimeout(() => {
    stabilizeDOMAfterRender();
  }, 10);

  const savedExpandedWorkspaces = getSavedExpandedWorkspaces();

  let workspaces = [];
  const now = Date.now();
  const useWorkspacesCache =
    workspacesCache && now - lastWorkspacesFetchTime < CACHE_TIMEOUT;

  if (useWorkspacesCache) {
    workspaces = workspacesCache;
  } else {
    try {
      workspaces = await workspaceService.getAllWorkspaces();
      workspacesCache = workspaces;
      lastWorkspacesFetchTime = now;
    } catch (error) {
      console.error("Ошибка при получении списка рабочих пространств:", error);
      workspaces = [];
    }
  }

  let boards = [];
  const useBoardsCache =
    boardsCache && now - lastBoardsFetchTime < CACHE_TIMEOUT;

  if (useBoardsCache) {
    boards = boardsCache;
  } else {
    try {
      boards = await kanbanService.getBoards();
      boardsCache = boards;
      lastBoardsFetchTime = now;
      localStorage.setItem("kanban_boards_cache", JSON.stringify(boards));
    } catch (error) {
      console.error("Ошибка при получении списка досок:", error);
      const localStorageCache = localStorage.getItem("kanban_boards_cache");
      if (localStorageCache) boards = JSON.parse(localStorageCache);
    }
  }

  if (!allUserChatsCache || now - lastAllUserChatsFetchTime > CACHE_TIMEOUT) {
    try {
      console.log("[САЙДБАР] Загрузка ВСЕХ чатов пользователя...");
      allUserChatsCache = await workspaceService.getAllUserChats();
      lastAllUserChatsFetchTime = now;
      console.log(
        `[САЙДБАР] ВСЕ чаты пользователя загружены (${
          (allUserChatsCache || []).length
        } шт).`
      );
    } catch (error) {
      console.error(
        "[САЙДБАР] Ошибка при загрузке всех чатов пользователя:",
        error
      );
      allUserChatsCache = allUserChatsCache || [];
    }
  }

  if (
    activeEntityType === "board" &&
    activeEntityId &&
    !boards.some((board) => board.id == activeEntityId)
  ) {
    try {
      const boardData = await kanbanService.getBoard(activeEntityId);
      if (boardData) {
        boards.push(boardData);
        boardsCache = boards;
        localStorage.setItem("kanban_boards_cache", JSON.stringify(boards));
      }
    } catch (error) {
      console.error(
        `Ошибка при загрузке активной доски ${activeEntityId}:`,
        error
      );
    }
  } else if (
    activeEntityType === "chat" &&
    activeEntityId &&
    currentActiveWorkspaceId
  ) {
    const isActiveChatInGlobalCache =
      allUserChatsCache &&
      allUserChatsCache.some(
        (chat) =>
          chat.id == activeEntityId &&
          chat.workspaceId == currentActiveWorkspaceId
      );

    if (!isActiveChatInGlobalCache) {
      console.warn(
        `[САЙДБАР] Активный чат ${activeEntityId} (РП: ${currentActiveWorkspaceId}) не найден в allUserChatsCache. Попытка загрузить отдельно.`
      );
      try {
        const chatData = await workspaceService.getChatById(
          currentActiveWorkspaceId,
          activeEntityId
        );
        if (chatData) {
          if (!allUserChatsCache) {
            allUserChatsCache = [];
          }

          if (!allUserChatsCache.some((c) => c.id === chatData.id)) {
            allUserChatsCache.push(chatData);
          }

          console.log(
            `Активный чат ${activeEntityId} из пространства ${currentActiveWorkspaceId} загружен отдельно и добавлен в allUserChatsCache`
          );
        }
      } catch (error) {
        console.error(
          `Ошибка при отдельной загрузке активного чата ${activeEntityId} из пространства ${currentActiveWorkspaceId}:`,
          error
        );
      }
    }
  }

  let activeItemWorkspaceId = null;
  if (activeEntityId) {
    if (activeEntityType === "board") {
      const activeBoardData = boards.find(
        (board) => board.id == activeEntityId
      );
      if (activeBoardData)
        activeItemWorkspaceId = activeBoardData.workspaceId?.toString();
    } else if (activeEntityType === "chat") {
      activeItemWorkspaceId = currentActiveWorkspaceId;
    }

    if (
      activeItemWorkspaceId &&
      !savedExpandedWorkspaces.includes(activeItemWorkspaceId)
    ) {
      savedExpandedWorkspaces.push(activeItemWorkspaceId);

      if (expandedWorkspacesCache) {
        expandedWorkspacesCache = [...savedExpandedWorkspaces];
      } else {
        expandedWorkspacesCache = [...savedExpandedWorkspaces];
      }
      console.log(
        `Активное РП ${activeItemWorkspaceId} добавлено в expandedWorkspacesCache для текущего рендера.`
      );
    }
  }

  let workspacesHtml = "";
  if (workspaces && workspaces.length > 0) {
    workspacesHtml = await Promise.all(
      workspaces.map(async (workspace) => {
        const workspaceBoards = boards.filter(
          (board) => board.workspaceId == workspace.id
        );

        let workspaceChats = [];
        if (allUserChatsCache) {
          workspaceChats = allUserChatsCache.filter(
            (chat) => chat.workspaceId?.toString() === workspace.id?.toString()
          );
        }

        const isActiveWorkspace =
          workspace.id == currentActiveWorkspaceId ||
          workspace.id == activeItemWorkspaceId;
        const wasPreviouslyExpanded = savedExpandedWorkspaces.includes(
          workspace.id.toString()
        );
        const isExpanded = isActiveWorkspace || wasPreviouslyExpanded;

        const hasBoards = workspaceBoards.length > 0;
        const hasChats = workspaceChats.length > 0;

        const boardsContent = hasBoards
          ? workspaceBoards
              .map(
                (board) => `
          <div class="workspace-board ${
            activeEntityType === "board" && board.id == activeEntityId
              ? "active"
              : ""
          }" 
               data-board-id="${board.id}" 
               data-stable-item="true">
            <span class="workspace-board-icon">📋</span>
            <span>${board.name}</span>
          </div>
        `
              )
              .join("")
          : "";

        const chatsContent = hasChats
          ? workspaceChats
              .map((chat) => {
                const isChatActive =
                  activeEntityType === "chat" &&
                  chat.id.toString() === activeEntityId &&
                  workspace.id.toString() === currentActiveWorkspaceId;

                if (workspace.id.toString() === currentActiveWorkspaceId) {
                  console.log(
                    `[САЙДБАР] Рендеринг чата в РП ${workspace.id.toString()}: ID=${
                      chat.id
                    }, Name=${chat.name}. Активен ли этот чат: ${isChatActive}`
                  );
                }
                return `
          <div class="workspace-chat ${isChatActive ? "active" : ""}"
               data-chat-id="${chat.id}"
               data-workspace-id="${workspace.id}" 
               data-stable-item="true">
            <span class="workspace-chat-icon">💬</span>
            <span>${chat.name}</span>
          </div>
        `;
              })
              .join("")
          : "";

        let emptyNotice = "";
        if (!hasBoards && !hasChats) {
          emptyNotice =
            '<div class="workspace-empty-notice">Пространство пусто</div>';
        }

        return `
        <div class="workspace-list-item ${isExpanded ? "expanded" : ""} ${
          isActiveWorkspace ? "active" : ""
        }" 
            data-workspace-id="${workspace.id}" 
            data-stable-render="true">
          <div class="workspace-header">
            <div class="workspace-name">
              <span class="workspace-icon">🔹</span>
              <span>${workspace.name || "Без названия"}</span>
            </div>
            <span class="workspace-toggle workspace-toggle-fixed">❯</span>
          </div>
          
          <div class="workspace-items-container" style="${
            isExpanded ? "display:block; opacity:1; max-height:none;" : ""
          }">
            ${boardsContent}
            ${chatsContent}
            ${emptyNotice}
          </div>
        </div>
      `;
      })
    );
    workspacesHtml = workspacesHtml.join("");
  } else {
    workspacesHtml =
      '<div class="workspaces-empty">Нет доступных рабочих пространств</div>';
  }

  return `
    <div class="dashboard-sidebar">
      <div class="sidebar-header">
        <div class="sidebar-title">Рабочие пространства</div>
      </div>
      
      <div class="workspace-tabs-vertical">
        <div class="workspace-tab-item ${
          activeWorkspaceTab === WORKSPACE_TABS.ALL ? "active" : ""
        }" data-tab="${WORKSPACE_TABS.ALL}">
          <span class="workspace-tab-icon">🌐</span>
          <span>Все пространства</span>
        </div>
        <div class="workspace-tab-item ${
          activeWorkspaceTab === WORKSPACE_TABS.MY ? "active" : ""
        }" data-tab="${WORKSPACE_TABS.MY}">
          <span class="workspace-tab-icon">👤</span>
          <span>Мои пространства</span>
        </div>
        <div class="workspace-tab-item ${
          activeWorkspaceTab === WORKSPACE_TABS.SHARED ? "active" : ""
        }" data-tab="${WORKSPACE_TABS.SHARED}">
          <span class="workspace-tab-icon">👥</span>
          <span>Совместные</span>
        </div>
      </div>
      
      <div class="workspace-divider">
        <span class="workspace-divider-text">Открыть пространство</span>
      </div>
      
      <div class="workspaces-list">
        ${workspacesHtml}
      </div>
    </div>
  `;
}

function preserveExpandedWorkspaces() {
  try {
    const expandedWorkspaces = document.querySelectorAll(
      ".workspace-list-item.expanded"
    );

    const expandedIds = Array.from(expandedWorkspaces)
      .map((item) => {
        const id = item.getAttribute("data-workspace-id");
        return id ? id.toString() : null;
      })
      .filter((id) => id);

    expandedWorkspacesCache = expandedIds;

    localStorage.setItem("expanded_workspaces", JSON.stringify(expandedIds));
    console.log("Сохранены раскрытые пространства:", expandedIds);
  } catch (error) {
    console.error(
      "Ошибка при сохранении состояния раскрытых пространств:",
      error
    );
  }
}

function getSavedExpandedWorkspaces() {
  if (expandedWorkspacesCache) {
    console.log(
      "Используем кэш раскрытых пространств:",
      expandedWorkspacesCache
    );
    return expandedWorkspacesCache;
  }

  try {
    const savedJson = localStorage.getItem("expanded_workspaces");
    if (savedJson) {
      const parsed = JSON.parse(savedJson);

      if (Array.isArray(parsed)) {
        expandedWorkspacesCache = parsed.map((id) => id.toString());
        return expandedWorkspacesCache;
      } else {
        console.error(
          "Сохраненные данные о раскрытых пространствах не являются массивом",
          parsed
        );

        localStorage.removeItem("expanded_workspaces");
      }
    }
  } catch (error) {
    console.error(
      "Ошибка при чтении сохраненных данных о раскрытых пространствах:",
      error
    );

    localStorage.removeItem("expanded_workspaces");
  }
  expandedWorkspacesCache = [];
  return expandedWorkspacesCache;
}

export function setupSidebarEventListeners(
  onBoardSelect,
  onWorkspaceTabClick,
  onWorkspaceSelect,
  onChatSelect
) {
  try {
    setTimeout(() => {
      const expandedItems = document.querySelectorAll(
        ".workspace-list-item.expanded"
      );

      expandedItems.forEach((item) => {
        item.setAttribute("data-stable-render", "true");

        const toggleIcon = item.querySelector(".workspace-toggle");
        if (toggleIcon) {
          toggleIcon.textContent = "❯";

          toggleIcon.classList.add("workspace-toggle-fixed");
        }

        const itemsContainer = item.querySelector(".workspace-items-container");
        if (itemsContainer) {
          itemsContainer.style.display = "block";
          itemsContainer.style.maxHeight = "none";
          itemsContainer.style.opacity = "1";

          const childItems = itemsContainer.querySelectorAll(
            ".workspace-board, .workspace-chat"
          );
          childItems.forEach((child) => {
            child.setAttribute("data-stable-item", "true");
          });
        }
      });

      console.log("Стили раскрытых пространств обновлены, DOM стабилизирован");
    }, 0);

    const boardItems = document.querySelectorAll(".workspace-board");
    boardItems.forEach((item) => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const boardId = item.getAttribute("data-board-id");

        const workspaceItem = item.closest(".workspace-list-item");
        const workspaceId = workspaceItem?.getAttribute("data-workspace-id");

        try {
          if (
            workspaceId &&
            expandedWorkspacesCache &&
            !expandedWorkspacesCache.includes(workspaceId)
          ) {
            expandedWorkspacesCache.push(workspaceId);
            localStorage.setItem(
              "expanded_workspaces",
              JSON.stringify(expandedWorkspacesCache)
            );
            console.log(
              "Автоматически добавили рабочее пространство перед переходом на доску:",
              workspaceId
            );
          }

          preserveExpandedWorkspaces();
        } catch (err) {
          console.error(
            "Ошибка при сохранении состояния раскрытых пространств (board click):",
            err
          );
        }

        if (typeof onBoardSelect === "function") {
          onBoardSelect(boardId, workspaceId);
        }
      });
    });

    const chatItems = document.querySelectorAll(".workspace-chat");
    chatItems.forEach((item) => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const chatId = item.getAttribute("data-chat-id");
        const workspaceId = item.getAttribute("data-workspace-id");

        try {
          if (
            workspaceId &&
            expandedWorkspacesCache &&
            !expandedWorkspacesCache.includes(workspaceId)
          ) {
            expandedWorkspacesCache.push(workspaceId);
            localStorage.setItem(
              "expanded_workspaces",
              JSON.stringify(expandedWorkspacesCache)
            );
          }
          preserveExpandedWorkspaces();
        } catch (err) {
          console.error(
            "Ошибка при сохранении состояния раскрытых пространств (chat click):",
            err
          );
        }

        if (typeof onChatSelect === "function") {
          onChatSelect(chatId, workspaceId);
        } else {
          navigateToChat(chatId, workspaceId);
        }
      });
    });

    const workspaceHeaders = document.querySelectorAll(".workspace-header");
    workspaceHeaders.forEach((header) => {
      header.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        try {
          const workspaceItem = header.closest(".workspace-list-item");
          const workspaceId = workspaceItem.getAttribute("data-workspace-id");

          const wasExpanded = workspaceItem.classList.contains("expanded");
          workspaceItem.classList.toggle("expanded");

          const icon = header.querySelector(".workspace-toggle");
          if (icon) {
            icon.classList.add("workspace-toggle-fixed");

            const itemsContainer = workspaceItem.querySelector(
              ".workspace-items-container"
            );
            if (itemsContainer) {
              if (wasExpanded) {
                itemsContainer.style.display = "none";
                itemsContainer.style.maxHeight = "0";
                itemsContainer.style.opacity = "0";
              } else {
                itemsContainer.style.display = "block";
                itemsContainer.style.maxHeight = "none";
                itemsContainer.style.opacity = "1";
              }
            }
          }

          preserveExpandedWorkspaces();
        } catch (err) {
          console.error(
            "Ошибка при обработке клика на заголовок рабочего пространства:",
            err
          );
        }
      });
    });

    const workspaceTabs = document.querySelectorAll(".workspace-tab-item");
    workspaceTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        try {
          const expandedItems = document.querySelectorAll(
            ".workspace-list-item.expanded"
          );
          const expandedIds = Array.from(expandedItems)
            .map((item) => item.getAttribute("data-workspace-id"))
            .filter((id) => id);

          expandedWorkspacesCache = expandedIds.map((id) => id.toString());

          localStorage.setItem(
            "expanded_workspaces",
            JSON.stringify(expandedWorkspacesCache)
          );
          console.log(
            "Перед переключением вкладки сохранены раскрытые пространства:",
            expandedWorkspacesCache
          );

          const tabType = tab.getAttribute("data-tab");

          workspaceTabs.forEach((t) => t.classList.remove("active"));
          tab.classList.add("active");

          activeWorkspaceTab = tabType;

          if (typeof onWorkspaceTabClick === "function") {
            onWorkspaceTabClick(tabType);

            setTimeout(() => {
              stabilizeDOMAfterRender();
            }, 50);
          }
        } catch (err) {
          console.error(
            "Ошибка при обработке клика на вкладку рабочего пространства:",
            err
          );
        }
      });
    });

    document.addEventListener("beforeunload", () => {
      preserveExpandedWorkspaces();
    });
  } catch (error) {
    console.error(
      "Ошибка при установке обработчиков событий для боковой панели:",
      error
    );
  }
}

async function createNewBoard(onBoardSelect) {
  const boardName = prompt("Введите название новой доски:");
  console.log("Введенное имя доски:", boardName);

  if (!boardName || boardName.trim() === "") {
    console.log("Создание доски отменено: пустое имя");
    return;
  }

  try {
    console.log("Начинаю создание доски:", boardName);

    const currentHash = window.location.hash.substring(1);
    const urlParams = new URLSearchParams(
      currentHash.includes("?") ? currentHash.split("?")[1] : ""
    );
    const workspaceId = urlParams.get("workspace");

    const boardData = {
      name: boardName,
      boardData: JSON.stringify({
        columns: [
          { id: "column1", name: "К выполнению", tasks: [] },
          { id: "column2", name: "В процессе", tasks: [] },
          { id: "column3", name: "Готово", tasks: [] },
        ],
      }),
    };

    if (workspaceId) {
      boardData.workspaceId = workspaceId;
    }

    const boardList = document.getElementById("boardList");
    if (boardList) {
      const loadingHtml = '<div class="board-loading">Создание доски...</div>';
      boardList.innerHTML += loadingHtml;
    }

    console.log("Отправка запроса на создание доски:", boardData);

    const newBoard = await kanbanService.createBoard(boardData);
    console.log("Создана новая доска:", newBoard);

    if (boardsCache) {
      boardsCache.push(newBoard);
      lastBoardsFetchTime = Date.now();
    }

    const cachedBoards = JSON.parse(
      localStorage.getItem("kanban_boards_cache") || "[]"
    );
    cachedBoards.push(newBoard);
    localStorage.setItem("kanban_boards_cache", JSON.stringify(cachedBoards));
    console.log(
      "Кэш досок обновлен, текущее количество досок:",
      cachedBoards.length
    );

    if (typeof onBoardSelect === "function") {
      console.log("Вызываем коллбэк с ID новой доски:", newBoard.id);

      onBoardSelect(newBoard.id);
    } else {
      console.log(
        "Коллбэк не предоставлен, выполняем перенаправление вручную на:",
        `/dashboard?board=${newBoard.id}`
      );

      if (workspaceId) {
        window.location.hash = `/dashboard?board=${newBoard.id}&workspace=${workspaceId}`;
      } else {
        window.location.hash = `/dashboard?board=${newBoard.id}`;
      }
    }
  } catch (error) {
    console.error("Ошибка при создании доски:", error);

    const loadingElement = document.querySelector(".board-loading");
    if (loadingElement) {
      loadingElement.remove();
    }

    alert(
      "Не удалось создать доску: " + (error.message || "Неизвестная ошибка")
    );
  }
}

function stabilizeDOMAfterRender() {
  setTimeout(() => {
    const expandedItems = document.querySelectorAll(
      ".workspace-list-item.expanded"
    );

    expandedItems.forEach((item) => {
      const itemsContainer = item.querySelector(".workspace-items-container");
      if (itemsContainer) {
        itemsContainer.style.display = "block";
        itemsContainer.style.maxHeight = "none";
        itemsContainer.style.opacity = "1";
        itemsContainer.style.transition = "none";
      }

      const toggleIcon = item.querySelector(".workspace-toggle");
      if (toggleIcon) {
        toggleIcon.textContent = "❯";

        toggleIcon.classList.add("workspace-toggle-fixed");
      }
    });

    const collapsedItems = document.querySelectorAll(
      ".workspace-list-item:not(.expanded)"
    );
    collapsedItems.forEach((item) => {
      const itemsContainer = item.querySelector(".workspace-items-container");
      if (itemsContainer) {
        itemsContainer.style.display = "none";
        itemsContainer.style.maxHeight = "0";
        itemsContainer.style.opacity = "0";
      }

      const toggleIcon = item.querySelector(".workspace-toggle");
      if (toggleIcon) {
        toggleIcon.textContent = "❯";

        toggleIcon.classList.add("workspace-toggle-fixed");
      }
    });

    console.log("DOM стабилизирован после рендеринга");
  }, 0);
}
