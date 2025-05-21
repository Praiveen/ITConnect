import { workspaceService } from "../services/workspace-service.js";
import { notificationService } from "../services/notification-service.js";
import {
  showSuccessToast,
  showErrorToast,
  showWarningToast,
  showInfoToast,
} from "./Alert.js";
import {
  invalidateWorkspaceChatsCache,
  getBoardsCache,
  updateBoardsCache,
  invalidateWorkspacesCache,
} from "./DashboardSidebar.js";
import { kanbanService } from "../services/kanban-service.js";

export const WORKSPACE_TABS = {
  ALL: "all",
  MY: "my",
  SHARED: "shared",
};

export const WORKSPACE_DETAIL_TABS = {
  OVERVIEW: "overview",
  MEMBERS: "members",
  SETTINGS: "settings",
};

function formatDate(dateString) {
  if (!dateString) return "";
  
  const date = new Date(dateString);
  return date.toLocaleDateString("ru-RU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const workspaceCache = {
  data: {},
  timestamp: {},
  CACHE_TIMEOUT: 30 * 1000,
  
  get(workspaceId) {
    const cacheEntry = this.data[workspaceId];
    const cacheTime = this.timestamp[workspaceId] || 0;
    const now = Date.now();
    
    if (cacheEntry && now - cacheTime < this.CACHE_TIMEOUT) {
      console.log(
        `Используем кэшированные данные для рабочего пространства ${workspaceId}`
      );
      return cacheEntry;
    }
    
    return null;
  },
  
  set(workspaceId, data) {
    this.data[workspaceId] = data;
    this.timestamp[workspaceId] = Date.now();
    console.log(`Данные рабочего пространства ${workspaceId} сохранены в кэш`);
  },
  
  clear(workspaceId) {
    if (workspaceId) {
      delete this.data[workspaceId];
      delete this.timestamp[workspaceId];
      console.log(`Кэш для рабочего пространства ${workspaceId} очищен`);
    } else {
      this.data = {};
      this.timestamp = {};
      console.log("Весь кэш рабочих пространств очищен");
    }
  },
};

export async function renderWorkspaceContent(tabType) {
  let contentHtml = "";
  
  try {
    let workspaces = [];
    let invitations = [];
    
    try {
      invitations = (await notificationService.getWorkspaceInvitations()) || [];
      console.log("Получены приглашения:", invitations.length);
    } catch (invitationError) {
      console.error("Ошибка при получении приглашений:", invitationError);
      invitations = [];
    }
    
    const hasInvitations = invitations && invitations.length > 0;
    const invitationsHtml = hasInvitations
      ? renderInvitationsList(invitations)
      : "";
    
    try {
      switch (tabType) {
        case WORKSPACE_TABS.ALL:
          workspaces = (await workspaceService.getAllWorkspaces()) || [];
          console.log("Получены все рабочие пространства:", workspaces.length);
          contentHtml = `
            <div class="workspace-content">
              <h2>Все рабочие пространства</h2>
              <p>Доступные вам рабочие пространства</p>
              ${hasInvitations ? invitationsHtml : ""}
              <div class="workspace-header-actions">
                <button class="btn-primary create-workspace-btn">
                  <span>+</span> Создать рабочее пространство
                </button>
              </div>
              <div class="workspace-list">
                ${renderWorkspaceList(workspaces)}
              </div>
            </div>
          `;
          break;
          
        case WORKSPACE_TABS.MY:
          workspaces = (await workspaceService.getAllWorkspaces()) || [];
          console.log(
            "Получены рабочие пространства для фильтрации:",
            workspaces.length
          );
          console.log(
            "Данные рабочих пространств (МОИ):",
            JSON.stringify(workspaces)
          );

          const myWorkspaces = Array.isArray(workspaces)
            ? workspaces.filter((ws) => {
            if (!ws) return false;
                return (
                  ws.owner === true || ws.owner === "true" || ws.owner == true
                );
              })
            : [];

          console.log(
            "Отфильтрованы мои рабочие пространства:",
            myWorkspaces.length
          );
          
          contentHtml = `
            <div class="workspace-content">
              <h2>Мои рабочие пространства</h2>
              <p>Рабочие пространства, созданные вами</p>
              ${hasInvitations ? invitationsHtml : ""}
              <div class="workspace-header-actions">
                <button class="btn-primary create-workspace-btn">
                  <span>+</span> Создать рабочее пространство
                </button>
              </div>
              <div class="workspace-list">
                ${renderWorkspaceList(myWorkspaces)}
              </div>
            </div>
          `;
          break;
          
        case WORKSPACE_TABS.SHARED:
          workspaces = (await workspaceService.getAllWorkspaces()) || [];
          console.log(
            "Получены рабочие пространства для фильтрации:",
            workspaces.length
          );
          console.log(
            "Данные рабочих пространств (СОВМЕСТНЫЕ):",
            JSON.stringify(workspaces)
          );

          const sharedWorkspaces = Array.isArray(workspaces)
            ? workspaces.filter((ws) => {
            if (!ws) return false;
                return (
                  ws.owner === false ||
                  ws.owner === "false" ||
                  ws.owner == false
                );
              })
            : [];

          console.log(
            "Отфильтрованы совместные рабочие пространства:",
            sharedWorkspaces.length
          );
          
          contentHtml = `
            <div class="workspace-content">
              <h2>Совместные рабочие пространства</h2>
              <p>Рабочие пространства, к которым вам предоставили доступ</p>
              ${hasInvitations ? invitationsHtml : ""}
              <div class="workspace-list">
                ${renderWorkspaceList(sharedWorkspaces)}
              </div>
            </div>
          `;
          break;
          
        default:
          contentHtml = `
            <div class="workspace-content">
              <h2>Выберите тип рабочих пространств</h2>
              <p>Используйте вкладки слева для просмотра различных типов рабочих пространств.</p>
              ${hasInvitations ? invitationsHtml : ""}
            </div>
          `;
      }
    } catch (workspacesError) {
      console.error(
        "Ошибка при получении рабочих пространств:",
        workspacesError
      );
      contentHtml = renderErrorContent(
        workspacesError,
        tabType,
        hasInvitations,
        invitationsHtml
      );
    }
    
    return contentHtml;
  } catch (error) {
    console.error(
      "Ошибка при отображении контента рабочего пространства:",
      error
    );
    return renderGlobalErrorContent(error);
  }
}

function renderInvitationsList(invitations) {
  return `
    <div class="workspace-invitations">
      <h3>Приглашения</h3>
      ${invitations
        .map(
          (inv) => `
        <div class="invitation-item">
          <div class="invitation-info">
            <div class="invitation-workspace">${
              inv.workspaceName || "Рабочее пространство"
            }</div>
            <div class="invitation-role">Роль: ${inv.role || "Участник"}</div>
            <div class="invitation-from">От: ${
              inv.inviterName || "Пользователь"
            }</div>
          </div>
          <div class="invitation-actions">
            <button class="btn-primary accept-invitation-btn" data-invitation-id="${
              inv.id
            }">Принять</button>
            <button class="btn-secondary decline-invitation-btn" data-invitation-id="${
              inv.id
            }">Отклонить</button>
          </div>
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

function renderErrorContent(error, tabType, hasInvitations, invitationsHtml) {
  return `
    <div class="workspace-content">
      <h2>${
        tabType === WORKSPACE_TABS.ALL
          ? "Все рабочие пространства"
          : tabType === WORKSPACE_TABS.MY
          ? "Мои рабочие пространства"
          : "Совместные рабочие пространства"
      }</h2>
      <p>Произошла ошибка при загрузке данных</p>
      ${hasInvitations ? invitationsHtml : ""}
      <div class="workspace-header-actions">
        <button class="btn-primary create-workspace-btn">
          <span>+</span> Создать рабочее пространство
        </button>
      </div>
      <div class="workspace-error">
        <p>${error.message || "Ошибка при загрузке рабочих пространств"}</p>
        <button class="btn-secondary" onclick="window.location.reload()">Обновить</button>
      </div>
    </div>
  `;
}

function renderGlobalErrorContent(error) {
  return `
    <div class="workspace-error">
      <h3>Ошибка при загрузке данных</h3>
      <p>${error.message || "Неизвестная ошибка"}</p>
      <button class="btn-secondary" onclick="window.location.reload()">Обновить</button>
    </div>
  `;
}

export function renderWorkspaceList(workspaces) {
  if (!workspaces || !Array.isArray(workspaces) || workspaces.length === 0) {
    return `<div class="workspace-empty">Нет доступных рабочих пространств</div>`;
  }
  
  return workspaces
    .map(
      (workspace) => `
    <div class="workspace-item" data-workspace-id="${workspace.id}">
      <h3>${workspace.name || "Без названия"}</h3>
      <p>${workspace.description || "Нет описания"}</p>
      <div class="workspace-item-footer">
        <span class="workspace-members-count">👥 ${
          workspace.membersCount || 1
        }</span>
        <span class="workspace-created">${formatDate(
          workspace.createdAt
        )}</span>
      </div>
    </div>
  `
    )
    .join("");
}

export function setupWorkspaceContentEventListeners(navigateCallback) {
  document.querySelectorAll(".create-workspace-btn").forEach((btn) => {
    btn.addEventListener("click", createNewWorkspace);
  });

  document.querySelectorAll(".workspace-item").forEach((item) => {
    item.addEventListener("click", () => {
      const workspaceId = item.getAttribute("data-workspace-id");
      if (typeof navigateCallback === "function") {
        navigateCallback(workspaceId);
      } else {
        navigateToWorkspace(workspaceId);
      }
    });
  });
  
  document.querySelectorAll(".accept-invitation-btn").forEach((button) => {
    button.addEventListener("click", async function () {
      const invitationId = this.dataset.invitationId;
      if (!invitationId) {
        console.error("ID приглашения не найден в элементе кнопки");
        return;
      }
      
      try {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Принятие...';
        
        console.log(`Принятие приглашения ${invitationId}...`);
        const success = await acceptInvitation(invitationId);
        
        if (success) {
          const invitationElement = button.closest(".invitation-item");
          if (invitationElement) {
            invitationElement.innerHTML = `
              <div class="invitation-info">
                <div class="invitation-message" style="color: #4caf50; padding: 10px;">
                  <i class="fas fa-check-circle"></i> Приглашение успешно принято
                </div>
              </div>
            `;
          }
          
          workspaceCache.clear();
          
          setTimeout(() => {
            if (typeof navigateCallback === "function") {
              navigateCallback();
            } else {
              window.location.reload();
            }
          }, 2000);
        }
      } catch (error) {
        console.error("Ошибка при принятии приглашения:", error);

        button.disabled = false;
        button.innerHTML = '<i class="fas fa-check"></i> Принять';
        alert(`Ошибка при принятии приглашения: ${error.message}`);
      }
    });
  });
  
  document.querySelectorAll(".decline-invitation-btn").forEach((button) => {
    button.addEventListener("click", async function () {
      const invitationId = this.dataset.invitationId;
      if (!invitationId) {
        console.error("ID приглашения не найден в элементе кнопки");
        return;
      }
      
      try {
        button.disabled = true;
        button.innerHTML =
          '<i class="fas fa-spinner fa-spin"></i> Отклонение...';
        
        console.log(`Отклонение приглашения ${invitationId}...`);
        const success = await declineInvitation(invitationId);
        
        if (success) {
          const invitationElement = button.closest(".invitation-item");
          if (invitationElement) {
            invitationElement.innerHTML = `
              <div class="invitation-info">
                <div class="invitation-message" style="color: #f44336; padding: 10px;">
                  <i class="fas fa-times-circle"></i> Приглашение отклонено
                </div>
              </div>
            `;
          }
          
          setTimeout(() => {
            if (typeof navigateCallback === "function") {
              navigateCallback();
            }
          }, 2000);
        }
      } catch (error) {
        console.error("Ошибка при отклонении приглашения:", error);

        button.disabled = false;
        button.innerHTML = '<i class="fas fa-times"></i> Отклонить';
        alert(`Ошибка при отклонении приглашения: ${error.message}`);
      }
    });
  });
}

export async function createNewWorkspace() {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  
  modalOverlay.innerHTML = `
    <div class="modal-container">
      <div class="modal-header">
        <h3 class="modal-title">Создание рабочего пространства</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <form class="create-workspace-form" id="createWorkspaceForm">
          <div class="form-group">
            <label for="workspaceName">Название рабочего пространства</label>
            <input type="text" id="workspaceName" name="workspaceName" placeholder="Введите название" required>
          </div>
          <div class="form-group">
            <label for="workspaceDescription">Описание (необязательно)</label>
            <textarea id="workspaceDescription" name="workspaceDescription" rows="4" placeholder="Введите описание"></textarea>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="modal-secondary-btn" id="cancelCreate">Отмена</button>
        <button class="modal-primary-btn" id="submitCreate">Создать</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modalOverlay);
  
  setTimeout(() => {
    modalOverlay.classList.add("active");
  }, 10);
  
  return new Promise((resolve, reject) => {
    const closeModal = () => {
      modalOverlay.classList.remove("active");
      setTimeout(() => {
        document.body.removeChild(modalOverlay);
      }, 300);
    };
    
    const submitCreate = async () => {
      const name = document.getElementById("workspaceName").value.trim();
      const description = document
        .getElementById("workspaceDescription")
        .value.trim();
      
      if (!name) {
        showWarningToast("Пожалуйста, введите название рабочего пространства");
        return;
      }
  
  try {
    const workspaceData = {
          name: name,
          description: description,
    };
    
        const newWorkspace = await workspaceService.createWorkspace(
          workspaceData
        );
        
        showSuccessToast(`Рабочее пространство "${name}" успешно создано`);

        invalidateWorkspacesCache(); 

        
        console.log("[WorkspaceManager] Генерируется событие sidebarShouldRefresh для рабочего пространства (создание)");
        document.dispatchEvent(
          new CustomEvent("sidebarShouldRefresh", {
            detail: {
              type: "workspace",
              action: "created",
              workspaceId: newWorkspace.id,
            },
          })
        );
        
        closeModal();
    navigateToWorkspace(newWorkspace.id);
        resolve(true);
  } catch (error) {
        console.error("Ошибка при создании рабочего пространства:", error);
        showErrorToast(
          `Не удалось создать рабочее пространство: ${
            error.message || "Неизвестная ошибка"
          }`
        );
        closeModal();
        resolve(false);
      }
    };
    
    modalOverlay.querySelector(".modal-close").addEventListener("click", () => {
      closeModal();
      resolve(false);
    });
    
    document.getElementById("cancelCreate").addEventListener("click", () => {
      closeModal();
      resolve(false);
    });
    
    document
      .getElementById("submitCreate")
      .addEventListener("click", submitCreate);
    
    document
      .getElementById("createWorkspaceForm")
      .addEventListener("submit", (e) => {
      e.preventDefault();
      submitCreate();
    });
    
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) {
        closeModal();
        resolve(false);
      }
    });
  });
}

export function navigateToWorkspace(workspaceId) {
  window.location.hash = `/dashboard?workspace=${workspaceId}`;
}

export async function acceptInvitation(invitationId) {
  if (!invitationId) {
    console.error("Невозможно принять приглашение: не указан ID приглашения");
    return false;
  }
  
  try {
    console.log(`Принятие приглашения с ID ${invitationId}...`);
    await notificationService.acceptWorkspaceInvitation(invitationId);
    
    await notificationService.markAsRead(invitationId);
    
    workspaceCache.clear();
    
    return true;
  } catch (error) {
    console.error(`Ошибка при принятии приглашения ${invitationId}:`, error);
    throw error;
  }
}

export async function declineInvitation(invitationId) {
  if (!invitationId) {
    console.error("Невозможно отклонить приглашение: не указан ID приглашения");
    return false;
  }
  
  try {
    console.log(`Отклонение приглашения с ID ${invitationId}...`);
    await notificationService.declineWorkspaceInvitation(invitationId);
    
    await notificationService.markAsRead(invitationId);
    
    return true;
  } catch (error) {
    console.error(`Ошибка при отклонении приглашения ${invitationId}:`, error);
    throw error;
  }
}

export async function loadWorkspaceMembers(workspaceId) {
  if (!workspaceId) {
    console.error(
      "Вызов loadWorkspaceMembers с неверным ID рабочего пространства:",
      workspaceId
    );
    return;
  }
  
  const membersContainer = document.getElementById("workspaceMembers");
  
  if (!membersContainer) {
    console.error(
      "Не найден контейнер для отображения участников: #workspaceMembers"
    );
    return;
  }
  
  try {
    console.log(`Загрузка участников рабочего пространства ${workspaceId}...`);
    
    membersContainer.innerHTML =
      '<div class="workspace-loading">Загрузка участников...</div>';
    
    let workspace = workspaceCache.get(workspaceId);
    
    if (!workspace) {
      console.log(
        `Данные рабочего пространства ${workspaceId} не найдены в кэше, загружаем с сервера`
      );
      
      try {
        workspace = await workspaceService.getWorkspace(workspaceId);
        
        if (workspace) {
          workspaceCache.set(workspaceId, workspace);
        }
      } catch (error) {
        console.error(
          `Ошибка при загрузке рабочего пространства ${workspaceId}:`,
          error
        );
        membersContainer.innerHTML = `
          <div class="workspace-error">
            <p>Ошибка при загрузке данных: ${
              error.message || "Неизвестная ошибка"
            }</p>
            <button class="btn-secondary" onclick="window.location.hash = '/dashboard'">Вернуться к списку</button>
          </div>
        `;
        return;
      }
    }
    
    console.log("Полученные данные рабочего пространства:", workspace);
    
    if (!workspace) {
      console.error(
        `Не удалось загрузить рабочее пространство ${workspaceId}. Возможно, у вас нет доступа.`
      );
      membersContainer.innerHTML = `
        <div class="workspace-error">
          <p>Не удалось загрузить данные рабочего пространства. Возможно, у вас нет доступа.</p>
          <button class="btn-secondary" onclick="window.location.hash = '/dashboard'">Вернуться к списку</button>
        </div>
      `;
      return;
    }
    
    const members = workspace.members || [];
    console.log("Участники рабочего пространства:", members);
    
    if (members.length > 0) {
      console.log("Первый участник:", members[0]);
      console.log("Ключи первого участника:", Object.keys(members[0]));
    }

    const validMembers = Array.isArray(members)
      ? members.filter((m) => m && typeof m === "object")
      : [];
    console.log(
      `Валидных участников: ${validMembers.length} из ${members.length}`
    );

    renderMembers(validMembers, workspace, membersContainer);
    
    setupWorkspaceDetailEventListeners(workspace);
  } catch (error) {
    console.error(
      `Ошибка при загрузке участников рабочего пространства ${workspaceId}:`,
      error
    );
    membersContainer.innerHTML = `
      <div class="workspace-error">
        <p>Ошибка при загрузке участников: ${
          error.message || "Неизвестная ошибка"
        }</p>
        <button class="btn-secondary" onclick="window.location.reload()">Попробовать снова</button>
        </div>
      `;
  }
}

export async function loadWorkspaceBoards(workspaceId) {
  const boardsContainer = document.getElementById("workspaceBoards");
  
  if (!boardsContainer) {
    console.error(
      "Не найден контейнер для отображения досок: #workspaceBoards"
    );
    return;
  }

  if (!workspaceId) {
    console.error("ID рабочего пространства не указан при загрузке досок");
    boardsContainer.innerHTML = `<div class="workspace-empty">Не указан ID рабочего пространства</div>`;
    return;
  }
  
  try {
    console.log(`Загрузка досок для рабочего пространства ${workspaceId}...`);
    
    boardsContainer.innerHTML =
      '<div class="workspace-loading">Загрузка досок...</div>';
    
    const boards = await getWorkspaceBoards(workspaceId);
    console.log(
      `Получено ${
        boards ? boards.length : 0
      } досок для рабочего пространства ${workspaceId}:`,
      boards
    );
    
    if (!boards || !Array.isArray(boards) || boards.length === 0) {
      console.log(`Доски не найдены для рабочего пространства ${workspaceId}`);
      boardsContainer.innerHTML = `<div class="workspace-empty">Нет досок в этом рабочем пространстве</div>`;
      return;
    }
    
    renderBoards(boards, boardsContainer, workspaceId);
  } catch (error) {
    console.error(
      `Ошибка при загрузке досок рабочего пространства ${workspaceId}:`,
      error
    );
    boardsContainer.innerHTML = `
      <div class="workspace-error">
        <p>Ошибка при загрузке досок: ${
          error.message || "Неизвестная ошибка"
        }</p>
        <button class="btn-secondary" onclick="window.location.reload()">Попробовать снова</button>
      </div>
    `;
  }
}

export async function getWorkspaceBoards(workspaceId) {
  try {
    console.log(`Запрос досок для рабочего пространства ${workspaceId}...`);
    
    const kanbanService = await import("../services/kanban-service.js").then(
      (module) => module.kanbanService
    );
    
    const allBoards = await kanbanService.getBoards();
    console.log(
      `Получено всего ${allBoards ? allBoards.length : 0} досок пользователя`
    );
    
    if (!allBoards || !Array.isArray(allBoards)) {
      console.error("Получен некорректный список досок:", allBoards);
      return [];
    }
    
    const workspaceBoards = allBoards.filter((board) => {
      if (!board) return false;
      return String(board.workspaceId) === String(workspaceId);
    });
    
    console.log(
      `Отфильтровано ${workspaceBoards.length} досок для рабочего пространства ${workspaceId}`
    );
    
    return workspaceBoards;
  } catch (error) {
    console.error(
      `Ошибка при получении досок рабочего пространства ${workspaceId}:`,
      error
    );
    return [];
  }
}

function renderBoards(boards, container, workspaceId) {
  if (!boards || !Array.isArray(boards) || boards.length === 0) {
    container.innerHTML = `<div class="workspace-empty">Нет досок в этом рабочем пространстве</div>`;
    return;
  }

  console.log(`Генерируем HTML для ${boards.length} досок в РП ${workspaceId}`);

  const boardsHtml = boards
    .map(
      (board) => `
    <div class="workspace-board-item" data-board-id="${
      board.id
    }" data-workspace-id="${workspaceId}">
      <div class="board-icon">📋</div>
      <div class="board-info">
        <div class="board-name">${board.name || "Без названия"}</div>
        <div class="board-created">${formatDate(
          board.createdAt || new Date()
        )}</div>
      </div>
      <div class="workspace-item-actions">
        <button class="btn-secondary item-action-btn edit-board-btn" data-board-id="${
          board.id
        }" data-board-name="${
        board.name || "Без названия"
      }" title="Редактировать доску">Редактировать</button>
        <button class="btn-danger item-action-btn delete-board-btn" data-board-id="${
          board.id
        }" data-board-name="${
        board.name || "Без названия"
      }" title="Удалить доску">Удалить</button>
    </div>
    </div>
  `
    )
    .join("");
  
  container.innerHTML = boardsHtml;
  
  console.log(
    `HTML сгенерирован и добавлен в контейнер, настраиваем обработчики событий для досок`
  );

  document.querySelectorAll(".workspace-board-item").forEach((boardItem) => {
    const boardId = boardItem.getAttribute("data-board-id");
    const currentWorkspaceId = boardItem.getAttribute("data-workspace-id");

    boardItem.querySelector(".board-info").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!boardId) {
        console.error("ID доски не найден в элементе");
        return;
      }
      console.log(
        `Выбрана доска ${boardId} из списка досок рабочего пространства ${currentWorkspaceId}`
      );
      navigateToBoard(boardId);
    });

    const editBtn = boardItem.querySelector(".edit-board-btn");
    if (editBtn) {
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const boardName = editBtn.dataset.boardName;
        handleEditBoardClick(boardId, boardName, currentWorkspaceId);
      });
    }

    const deleteBtn = boardItem.querySelector(".delete-board-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const boardName = deleteBtn.dataset.boardName;
        handleDeleteBoardClick(boardId, boardName, currentWorkspaceId);
      });
    }
  });
  
  console.log(`Обработчики событий для досок настроены`);
}

export function navigateToBoard(boardId) {
  const currentHash = window.location.hash.substring(1);
  const urlParams = new URLSearchParams(
    currentHash.includes("?") ? currentHash.split("?")[1] : ""
  );

  const workspaceId = urlParams.get("workspace");
  const currentBoardId = urlParams.get("board");

  const reloadParam = currentBoardId === boardId ? `&reload=${Date.now()}` : "";

  console.log(
    `Переход к доске ${boardId} из рабочего пространства ${
      workspaceId || "не указано"
    }`
  );

  if (workspaceId) {
    window.location.hash = `/dashboard?board=${boardId}&workspace=${workspaceId}${reloadParam}`;
  } else {
    window.location.hash = `/dashboard?board=${boardId}${reloadParam}`;
  }
}

export async function removeMember(workspaceId, userId, userName) {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  
  modalOverlay.innerHTML = `
    <div class="modal-container">
      <div class="modal-header">
        <h3 class="modal-title">Удаление участника</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body confirm-delete-modal">
        <p>Вы уверены, что хотите удалить следующего участника из рабочего пространства?</p>
        <div class="member-info">
          <div class="member-name">${userName}</div>
        </div>
        <p class="warning-text">Это действие нельзя отменить.</p>
      </div>
      <div class="modal-footer">
        <button class="modal-secondary-btn" id="cancelRemove">Отмена</button>
        <button class="modal-danger-btn" id="confirmRemove">Удалить</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modalOverlay);
  
  setTimeout(() => {
    modalOverlay.classList.add("active");
  }, 10);
  
  return new Promise((resolve, reject) => {
    const closeModal = () => {
      modalOverlay.classList.remove("active");
      setTimeout(() => {
        document.body.removeChild(modalOverlay);
      }, 300);
    };
    
    const confirmRemove = async () => {
  try {
    const numericUserId = Number(userId) || userId;
    await workspaceService.removeMember(workspaceId, numericUserId);
        showSuccessToast(
          `Пользователь ${userName} успешно удален из рабочего пространства`
        );
        
        workspaceCache.clear(workspaceId);
        
        closeModal();
        resolve(true);
  } catch (error) {
        console.error(
          `Ошибка при удалении участника ${userId} из рабочего пространства ${workspaceId}:`,
          error
        );
        showErrorToast(
          `Не удалось удалить участника: ${
            error.message || "Неизвестная ошибка"
          }`
        );
        closeModal();
        resolve(false);
      }
    };
    
    modalOverlay.querySelector(".modal-close").addEventListener("click", () => {
      closeModal();
      resolve(false);
    });
    
    document.getElementById("cancelRemove").addEventListener("click", () => {
      closeModal();
      resolve(false);
    });
    
    document
      .getElementById("confirmRemove")
      .addEventListener("click", confirmRemove);
    
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) {
        closeModal();
        resolve(false);
      }
    });
  });
}

export function setupWorkspaceDetailEventListeners(workspace) {
  console.log(
    `Установка обработчиков событий для рабочего пространства ${workspace.id}`
  );
  
  const userRole = workspace.role || "";
  const isOwner = workspace.owner === true;
  const isAdmin = userRole === "ADMIN";
  const hasEditRights = isOwner || isAdmin;
  
  console.log(
    `Права пользователя: владелец = ${isOwner}, админ = ${isAdmin}, роль = ${userRole}`
  );

  const editBtns = document.querySelectorAll(".workspace-edit-btn");
  editBtns.forEach((editBtn) => {
  if (editBtn) {
    if (hasEditRights) {
        console.log(
          "Найдена кнопка редактирования рабочего пространства - права есть"
        );
        editBtn.addEventListener("click", () => {
          console.log(
            `Нажата кнопка редактирования для рабочего пространства ${workspace.id}`
          );
        editWorkspace(workspace);
      });
    } else {
        console.log(
          "Найдена кнопка редактирования рабочего пространства - прав нет, скрываем"
        );
        editBtn.style.display = "none";
    }
  }
  });
  
  const inviteBtns = document.querySelectorAll(".workspace-invite-btn");
  inviteBtns.forEach((inviteBtn) => {
  if (inviteBtn) {
    if (hasEditRights) {
        console.log("Найдена кнопка приглашения пользователя - права есть");
        inviteBtn.addEventListener("click", async () => {
          console.log(
            `Нажата кнопка приглашения для рабочего пространства ${workspace.id}`
          );
          const success = await inviteUserToWorkspace(workspace.id);
          
          if (success) {
            loadWorkspaceMembers(workspace.id);
          }
      });
    } else {
        console.log(
          "Найдена кнопка приглашения пользователя - прав нет, скрываем"
        );
        inviteBtn.style.display = "none";
    }
  }
  });
  
  const addBoardBtn = document.querySelector(".workspace-add-board-btn");
  if (addBoardBtn) {
    if (userRole !== "VIEWER") {
      console.log("Найдена кнопка добавления доски - права есть");
      addBoardBtn.addEventListener("click", () => {
        console.log(
          `Нажата кнопка добавления доски для рабочего пространства ${workspace.id}`
        );
        addBoardToWorkspace(workspace.id);
      });
    } else {
      console.log(
        "Найдена кнопка добавления доски - прав нет (наблюдатель), скрываем"
      );
      addBoardBtn.style.display = "none";
    }
  } else {
    console.warn("Кнопка добавления доски не найдена");
  }
}

export async function editWorkspace(workspace) {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  
  modalOverlay.innerHTML = `
    <div class="modal-container">
      <div class="modal-header">
        <h3 class="modal-title">Редактирование рабочего пространства</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <form class="edit-workspace-form" id="editWorkspaceForm">
          <div class="form-group">
            <label for="workspaceName">Название рабочего пространства</label>
            <input type="text" id="workspaceName" name="workspaceName" value="${
              workspace.name || ""
            }" required>
          </div>
          <div class="form-group">
            <label for="workspaceDescription">Описание рабочего пространства</label>
            <textarea id="workspaceDescription" name="workspaceDescription" rows="4">${
              workspace.description || ""
            }</textarea>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="modal-secondary-btn" id="cancelEdit">Отмена</button>
        <button class="modal-primary-btn" id="submitEdit">Сохранить</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modalOverlay);
  
  setTimeout(() => {
    modalOverlay.classList.add("active");
  }, 10);
  
  return new Promise((resolve, reject) => {
    const closeModal = () => {
      modalOverlay.classList.remove("active");
      setTimeout(() => {
        document.body.removeChild(modalOverlay);
      }, 300);
    };
    
    const submitEdit = async () => {
      const name = document.getElementById("workspaceName").value.trim();
      const description = document
        .getElementById("workspaceDescription")
        .value.trim();
      
      if (!name) {
        showWarningToast("Пожалуйста, введите название рабочего пространства");
        return;
      }
  
  try {
    const workspaceData = {
          name: name,
          description: description,
        };

        const updatedWorkspace = await workspaceService.updateWorkspace(
          workspace.id,
          workspaceData
        );

    workspaceCache.clear(workspace.id);
    
    if (updatedWorkspace) {
      workspaceCache.set(workspace.id, updatedWorkspace);
      
          const workspaceNameElem = document.querySelector(
            ".workspace-detail-header h2"
          );
          const workspaceDescElem = document.querySelector(
            ".workspace-description"
          );
      
      if (workspaceNameElem) {
        workspaceNameElem.textContent = updatedWorkspace.name;
      }
      
      if (workspaceDescElem) {
            workspaceDescElem.textContent =
              updatedWorkspace.description || "Нет описания";
          }

          console.log(
            "Рабочее пространство успешно обновлено без перезагрузки страницы"
          );
          showSuccessToast("Рабочее пространство успешно обновлено");

          invalidateWorkspacesCache(); 

          
          console.log("[WorkspaceManager] Генерируется событие sidebarShouldRefresh для рабочего пространства (обновление)");
          document.dispatchEvent(
            new CustomEvent("sidebarShouldRefresh", {
              detail: {
                type: "workspace",
                action: "updated",
                workspaceId: workspace.id,
              },
            })
          );
    } else {
      window.location.reload();
    }
        
        closeModal();
        resolve(true);
  } catch (error) {
        console.error(
          `Ошибка при обновлении рабочего пространства ${workspace.id}:`,
          error
        );
        showErrorToast(
          `Не удалось обновить рабочее пространство: ${
            error.message || "Неизвестная ошибка"
          }`
        );
        closeModal();
        resolve(false);
      }
    };
    
    modalOverlay.querySelector(".modal-close").addEventListener("click", () => {
      closeModal();
      resolve(false);
    });
    
    document.getElementById("cancelEdit").addEventListener("click", () => {
      closeModal();
      resolve(false);
    });
    
    document.getElementById("submitEdit").addEventListener("click", submitEdit);
    
    document
      .getElementById("editWorkspaceForm")
      .addEventListener("submit", (e) => {
      e.preventDefault();
      submitEdit();
    });
    
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) {
        closeModal();
        resolve(false);
      }
    });
  });
}

export async function inviteUserToWorkspace(workspaceId) {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  
  modalOverlay.innerHTML = `
    <div class="modal-container">
      <div class="modal-header">
        <h3 class="modal-title">Пригласить пользователя</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <form class="invite-form" id="inviteForm">
          <div class="form-group">
            <label for="email">Email пользователя</label>
            <input type="email" id="email" name="email" placeholder="Введите email пользователя" required>
          </div>
          <div class="form-group">
            <label for="role">Роль пользователя</label>
            <select id="role" name="role" required>
              <option value="ADMIN">Администратор</option>
              <option value="MEMBER" selected>Участник</option>
              <option value="VIEWER">Наблюдатель</option>
            </select>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="modal-secondary-btn" id="cancelInvite">Отмена</button>
        <button class="modal-primary-btn" id="submitInvite">Пригласить</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modalOverlay);
  
  setTimeout(() => {
    modalOverlay.classList.add("active");
  }, 10);
  
  return new Promise((resolve, reject) => {
    const closeModal = () => {
      modalOverlay.classList.remove("active");
      setTimeout(() => {
        document.body.removeChild(modalOverlay);
      }, 300);
    };
    
    const submitInvite = async () => {
      const email = document.getElementById("email").value.trim();
      const role = document.getElementById("role").value;
      
      if (!email) {
        showWarningToast("Пожалуйста, введите email пользователя");
        return;
      }
      
      try {
        const userData = { email, role };
    await workspaceService.inviteUser(workspaceId, userData);
        closeModal();
        showSuccessToast(`Приглашение отправлено на email ${email}`);
        resolve(true);
  } catch (error) {
        console.error(
          `Ошибка при приглашении пользователя в рабочее пространство ${workspaceId}:`,
          error
        );
        showErrorToast(
          `Не удалось отправить приглашение: ${
            error.message || "Неизвестная ошибка"
          }`
        );
        resolve(false);
      }
    };
    
    modalOverlay.querySelector(".modal-close").addEventListener("click", () => {
      closeModal();
      resolve(false);
    });
    
    document.getElementById("cancelInvite").addEventListener("click", () => {
      closeModal();
      resolve(false);
    });
    
    document
      .getElementById("submitInvite")
      .addEventListener("click", submitInvite);
    
    document.getElementById("inviteForm").addEventListener("submit", (e) => {
      e.preventDefault();
      submitInvite();
    });
    
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) {
        closeModal();
        resolve(false);
      }
    });
  });
}

export async function addBoardToWorkspace(workspaceId) {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  
  modalOverlay.innerHTML = `
    <div class="modal-container">
      <div class="modal-header">
        <h3 class="modal-title">Создание новой доски</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <form class="create-board-form" id="createBoardForm">
          <div class="form-group">
            <label for="boardName">Название доски</label>
            <input type="text" id="boardName" name="boardName" placeholder="Введите название доски" required>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="modal-secondary-btn" id="cancelBoard">Отмена</button>
        <button class="modal-primary-btn" id="submitBoard">Создать</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modalOverlay);
  
  setTimeout(() => {
    modalOverlay.classList.add("active");
  }, 10);
  
  return new Promise((resolve, reject) => {
    const closeModal = () => {
      modalOverlay.classList.remove("active");
      setTimeout(() => {
        document.body.removeChild(modalOverlay);
      }, 300);
    };
    
    const submitBoard = async () => {
      const boardName = document.getElementById("boardName").value.trim();
      
      if (!boardName) {
        showWarningToast("Пожалуйста, введите название доски");
        return;
      }
  
  try {
    const boardData = {
          name: boardName,
      workspaceId: workspaceId,
      boardData: JSON.stringify({
        columns: [
              { id: "column1", name: "К выполнению", tasks: [] },
              { id: "column2", name: "В процессе", tasks: [] },
              { id: "column3", name: "Готово", tasks: [] },
            ],
          }),
        };

        const kanbanService = await import(
          "../services/kanban-service.js"
        ).then((module) => module.kanbanService);
    const newBoard = await kanbanService.createBoard(boardData);
    
    await loadWorkspaceBoards(workspaceId);
        
        closeModal();
    
        const modalConfirmOverlay = document.createElement("div");
        modalConfirmOverlay.className = "modal-overlay";
        
        modalConfirmOverlay.innerHTML = `
          <div class="modal-container">
            <div class="modal-header">
              <h3 class="modal-title">Доска создана</h3>
              <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
              <p>Доска "${boardName}" успешно создана!</p>
              <p>Хотите перейти к новой доске?</p>
            </div>
            <div class="modal-footer">
              <button class="modal-secondary-btn" id="stayHere">Остаться здесь</button>
              <button class="modal-primary-btn" id="goToBoard">Перейти к доске</button>
            </div>
          </div>
        `;
        
        document.body.appendChild(modalConfirmOverlay);
        
        setTimeout(() => {
          modalConfirmOverlay.classList.add("active");
        }, 10);
        
        const closeConfirmModal = () => {
          modalConfirmOverlay.classList.remove("active");
          setTimeout(() => {
            document.body.removeChild(modalConfirmOverlay);
          }, 300);
        };
        
        modalConfirmOverlay
          .querySelector(".modal-close")
          .addEventListener("click", () => {
          closeConfirmModal();
          showSuccessToast(`Доска "${boardName}" успешно создана`);
          resolve(true);
        });
        
        document.getElementById("stayHere").addEventListener("click", () => {
          closeConfirmModal();
          showSuccessToast(`Доска "${boardName}" успешно создана`);
          resolve(true);
        });
        
        document.getElementById("goToBoard").addEventListener("click", () => {
          closeConfirmModal();

      window.location.hash = `/dashboard?board=${newBoard.id}&workspace=${workspaceId}`;
          resolve(true);
        });
        
        modalConfirmOverlay.addEventListener("click", (e) => {
          if (e.target === modalConfirmOverlay) {
            closeConfirmModal();
            showSuccessToast(`Доска "${boardName}" успешно создана`);
            resolve(true);
          }
        });
  } catch (error) {
        console.error("Ошибка при создании доски:", error);
        showErrorToast(
          `Не удалось создать доску: ${error.message || "Неизвестная ошибка"}`
        );
        closeModal();
        resolve(false);
      }
    };
    
    modalOverlay.querySelector(".modal-close").addEventListener("click", () => {
      closeModal();
      resolve(false);
    });
    
    document.getElementById("cancelBoard").addEventListener("click", () => {
      closeModal();
      resolve(false);
    });
    
    document
      .getElementById("submitBoard")
      .addEventListener("click", submitBoard);
    
    document
      .getElementById("createBoardForm")
      .addEventListener("submit", (e) => {
      e.preventDefault();
      submitBoard();
    });
    
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) {
        closeModal();
        resolve(false);
      }
    });
  });
}

export async function renderWorkspaceDetail(
  workspaceId,
  activeTab = WORKSPACE_DETAIL_TABS.OVERVIEW
) {
  if (!workspaceId) {
    console.error("ID рабочего пространства не указан");
    return `
      <div class="workspace-error">
        <h3>Ошибка при загрузке рабочего пространства</h3>
        <p>Не указан ID рабочего пространства</p>
        <button class="btn-secondary" onclick="window.location.hash = '/dashboard'">
          Вернуться к списку
        </button>
      </div>
    `;
  }

  try {
    console.log(`Загрузка рабочего пространства ${workspaceId}...`);
    
    let workspace = workspaceCache.get(workspaceId);
    
    if (!workspace) {
      console.log(
        `Данные рабочего пространства ${workspaceId} не найдены в кэше, загружаем с сервера`
      );
      
      try {
        workspace = await workspaceService.getWorkspace(workspaceId);
        
        if (workspace) {
          workspaceCache.set(workspaceId, workspace);
        }
      } catch (error) {
        console.error(
          `Ошибка при загрузке рабочего пространства ${workspaceId}:`,
          error
        );
        return `
          <div class="workspace-error">
            <h3>Ошибка при загрузке рабочего пространства</h3>
            <p>${error.message || "Неизвестная ошибка"}</p>
            <button class="btn-secondary" onclick="window.location.hash = '/dashboard'">
              Вернуться к списку
            </button>
          </div>
        `;
      }
    }

    if (!workspace) {
      console.error(
        `Не удалось загрузить рабочее пространство ${workspaceId}. Возможно, у вас нет доступа.`
      );
      return `
        <div class="workspace-error">
          <h3>Рабочее пространство не найдено</h3>
          <p>Не удалось загрузить данные рабочего пространства. Возможно, у вас нет доступа.</p>
          <button class="btn-secondary" onclick="window.location.hash = '/dashboard'">
            Вернуться к списку
          </button>
        </div>
      `;
    }

    console.log("Полученные данные рабочего пространства:", workspace);

    const tabContent = await renderWorkspaceTabContent(workspace, activeTab);
    
    return `
      <div class="workspace-detail">
        <div class="workspace-detail-header">
          <h2>${workspace.name}</h2>
        </div>
        <p class="workspace-description">${
          workspace.description || "Нет описания"
        }</p>
        
        <div class="workspace-detail-tabs">
          <div class="workspace-tab ${
            activeTab === WORKSPACE_DETAIL_TABS.OVERVIEW ? "active" : ""
          }" 
               data-tab="${WORKSPACE_DETAIL_TABS.OVERVIEW}">
            Обзор
          </div>
          <div class="workspace-tab ${
            activeTab === WORKSPACE_DETAIL_TABS.MEMBERS ? "active" : ""
          }" 
               data-tab="${WORKSPACE_DETAIL_TABS.MEMBERS}">
            Управление участниками
          </div>
          <div class="workspace-tab ${
            activeTab === WORKSPACE_DETAIL_TABS.SETTINGS ? "active" : ""
          }" 
               data-tab="${WORKSPACE_DETAIL_TABS.SETTINGS}">
            Настройки
          </div>
        </div>
        
        <div class="workspace-detail-content">
          ${tabContent}
        </div>
      </div>
    `;
  } catch (error) {
    console.error(
      `Ошибка при отображении деталей рабочего пространства ${workspaceId}:`,
      error
    );
    return `
      <div class="workspace-error">
        <h3>Ошибка при загрузке данных</h3>
        <p>${error.message || "Неизвестная ошибка"}</p>
        <button class="btn-secondary" onclick="window.location.hash = '/dashboard'">
          Вернуться к списку
        </button>
      </div>
    `;
  }
}

async function renderWorkspaceTabContent(workspace, activeTab) {
  switch (activeTab) {
    case WORKSPACE_DETAIL_TABS.OVERVIEW:
      return await renderWorkspaceOverviewTab(workspace);
    case WORKSPACE_DETAIL_TABS.MEMBERS:
      return await renderWorkspaceMembersTab(workspace);
    case WORKSPACE_DETAIL_TABS.SETTINGS:
      return await renderWorkspaceSettingsTab(workspace);
    default:
      return await renderWorkspaceOverviewTab(workspace);
  }
}

async function renderWorkspaceOverviewTab(workspace) {
  return `
    <div class="workspace-overview-tab">
      <div class="workspace-overview-container">
        <div class="workspace-overview-row"> <!-- Новый flex-контейнер -->
          <div class="workspace-section workspace-section-boards">
            <h3>Доски</h3>
            <div class="workspace-header-actions">
              <button class="btn-secondary workspace-add-board-btn" data-workspace-id="${workspace.id}">
                + Добавить доску
              </button>
            </div>
            <div class="workspace-boards" id="workspaceBoards">
              <div class="workspace-loading">Загрузка досок...</div>
            </div>
          </div>

          <div class="workspace-section workspace-section-chats">
            <h3>Чаты</h3>
            <div class="workspace-header-actions">
              <button class="btn-secondary workspace-add-chat-btn" data-workspace-id="${workspace.id}">
                + Создать чат
              </button>
            </div>
            <div class="workspace-chats" id="workspaceChats">
              <div class="workspace-loading">Загрузка чатов...</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;
}

async function renderWorkspaceMembersTab(workspace) {
  return `
    <div class="workspace-members-tab">
      <div class="workspace-members-container">
        <div class="workspace-members-header">
          <h3>Участники рабочего пространства</h3>
          <div class="workspace-members-actions">
            <button class="btn-primary workspace-invite-btn" data-workspace-id="${workspace.id}">
              + Пригласить пользователя
            </button>
          </div>
        </div>
        
        <div class="workspace-members-content" id="workspaceMembers">
          <div class="workspace-loading">Загрузка участников...</div>
        </div>
      </div>
    </div>
  `;
}

async function renderWorkspaceSettingsTab(workspace) {
  const isOwner = workspace.owner === true;
  const isAdmin = workspace.role === "ADMIN";
  const hasEditRights = isOwner || isAdmin;

  return `
    <div class="workspace-settings-tab">
      <div class="workspace-settings-container">
        <div class="workspace-section">
          <h3>Основная информация</h3>
          <div class="workspace-info-list">
            <div class="workspace-info-item">
              <div class="workspace-info-label">Создано</div>
              <div class="workspace-info-value">${formatDate(
                workspace.createdAt
              )}</div>
            </div>
            <div class="workspace-info-item">
              <div class="workspace-info-label">Количество участников</div>
              <div class="workspace-info-value">${
                workspace.membersCount || 1
              }</div>
            </div>
            <div class="workspace-info-item">
              <div class="workspace-info-label">Ваша роль</div>
              <div class="workspace-info-value">${getRoleName(
                workspace.role
              )}</div>
            </div>
          </div>
          
          ${
            hasEditRights
              ? `
            <div class="workspace-detail-actions">
              <button class="btn-secondary workspace-edit-btn" data-workspace-id="${workspace.id}">
                Редактировать рабочее пространство
              </button>
            </div>
          `
              : ""
          }
        </div>
        
        ${
          hasEditRights
            ? `
          <div class="workspace-danger-zone">
            <h4>Опасная зона</h4>
            <p>Эти действия невозможно отменить</p>
            <button class="btn-danger delete-workspace-btn" data-workspace-id="${workspace.id}">
              Удалить рабочее пространство
            </button>
          </div>
        `
            : ""
        }
      </div>
    </div>
  `;
}

export function setupWorkspaceDetailTabsEventListeners(workspaceId) {
  const activeTabElement = document.querySelector(".workspace-tab.active");
  const activeTab = activeTabElement
    ? activeTabElement.getAttribute("data-tab")
    : WORKSPACE_DETAIL_TABS.OVERVIEW;

  console.log(
    `Настройка обработчиков для рабочего пространства ${workspaceId}, активная вкладка: ${activeTab}`
  );

  document.querySelectorAll(".workspace-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabType = tab.getAttribute("data-tab");
      if (!tabType) return;
      
      console.log(
        `Выбрана вкладка ${tabType} для рабочего пространства ${workspaceId}`
      );
      
      const currentHash = window.location.hash.substring(1);
      const urlParams = new URLSearchParams(
        currentHash.includes("?") ? currentHash.split("?")[1] : ""
      );
      
      urlParams.set("workspace", workspaceId);
      urlParams.set("workspace_detail_tab", tabType);
      
      window.location.hash = `/dashboard?${urlParams.toString()}`;
    });
  });
  
  const deleteBtn = document.querySelector(".delete-workspace-btn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      const workspace = workspaceCache.get(workspaceId);
      if (!workspace) {
        alert("Не удалось получить данные рабочего пространства");
        return;
      }
      
      deleteWorkspace(workspace);
    });
  }
  
  const editBtn = document.querySelector(".workspace-edit-btn");
  if (editBtn) {
    editBtn.addEventListener("click", async () => {
      const workspace = workspaceCache.get(workspaceId);
      if (!workspace) {
        alert("Не удалось получить данные рабочего пространства");
        return;
      }
      
      editWorkspace(workspace);
    });
  }
  
  console.log(`Загрузка данных для вкладки: ${activeTab}`);
  
  if (activeTab === WORKSPACE_DETAIL_TABS.MEMBERS) {
    const membersContainer = document.getElementById("workspaceMembers");
    if (membersContainer) {
      console.log('Загрузка участников для вкладки "Управление участниками"');
      loadWorkspaceMembers(workspaceId);
    } else {
      console.warn("Контейнер участников #workspaceMembers не найден");
    }
  } else if (activeTab === WORKSPACE_DETAIL_TABS.OVERVIEW) {
    const boardsContainer = document.getElementById("workspaceBoards");
    if (boardsContainer) {
      console.log('Загрузка досок для вкладки "Обзор"');
      loadWorkspaceBoards(workspaceId);
    } else {
      console.warn("Контейнер досок #workspaceBoards не найден");
    }
    const chatsContainer = document.getElementById("workspaceChats");
    if (chatsContainer) {
      console.log('Загрузка чатов для вкладки "Обзор"');
      loadWorkspaceChats(workspaceId);
    } else {
      console.warn("Контейнер чатов #workspaceChats не найден");
    }
  }
  
  const addBoardBtn = document.querySelector(".workspace-add-board-btn");
  if (addBoardBtn) {
    addBoardBtn.addEventListener("click", () => {
      addBoardToWorkspace(workspaceId);
    });
  }

  const addChatBtn = document.querySelector(".workspace-add-chat-btn");
  if (addChatBtn) {
    addChatBtn.addEventListener("click", () => {
      addChatToWorkspace(workspaceId);
    });
  }
}

export async function deleteWorkspace(workspace) {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  
  modalOverlay.innerHTML = `
    <div class="modal-container delete-workspace-modal">
      <div class="modal-header">
        <h3 class="modal-title">Удаление рабочего пространства</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="warning-icon">⚠️</div>
        <p class="delete-warning">Вы собираетесь удалить рабочее пространство <strong>${workspace.name}</strong>.</p>
        <p class="delete-info">Это действие <strong>нельзя отменить</strong>. Все доски, списки и задачи в этом рабочем пространстве будут удалены.</p>
        
        <div class="delete-confirmation">
          <p>Для подтверждения введите "удалить ${workspace.name}" в поле ниже:</p>
          <input type="text" id="deleteConfirmText" class="delete-confirm-input" placeholder="удалить ${workspace.name}">
        </div>
        
        <div class="delete-agree-checkbox">
          <input type="checkbox" id="deleteAgree">
          <label for="deleteAgree">Я понимаю, что весь контент рабочего пространства будет удален без возможности восстановления</label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="modal-secondary-btn" id="cancelDelete">Отмена</button>
        <button class="modal-danger-btn" id="confirmDelete" disabled>Удалить</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modalOverlay);
  
  setTimeout(() => {
    modalOverlay.classList.add("active");
  }, 10);
  
  return new Promise((resolve, reject) => {
    const closeModal = () => {
      modalOverlay.classList.remove("active");
      setTimeout(() => {
        document.body.removeChild(modalOverlay);
      }, 300);
    };
    
    const deleteConfirmInput = document.getElementById("deleteConfirmText");
    const deleteAgreeCheckbox = document.getElementById("deleteAgree");
    const confirmDeleteBtn = document.getElementById("confirmDelete");

    const checkDeleteConditions = () => {
      const expectedText = `удалить ${workspace.name}`;
      const isTextCorrect = deleteConfirmInput.value.trim() === expectedText;
      const isChecked = deleteAgreeCheckbox.checked;
      
      confirmDeleteBtn.disabled = !(isTextCorrect && isChecked);
    };
    
    deleteConfirmInput.addEventListener("input", checkDeleteConditions);
    deleteAgreeCheckbox.addEventListener("change", checkDeleteConditions);
    
    const confirmDelete = async () => {
      try {
        await workspaceService.deleteWorkspace(workspace.id);
        showSuccessToast("Рабочее пространство успешно удалено");

        invalidateWorkspacesCache(); 
        
        // Генерируем событие для обновления сайдбара
        console.log("[WorkspaceManager] Генерируется событие sidebarShouldRefresh для рабочего пространства (удаление)");
        document.dispatchEvent(
          new CustomEvent("sidebarShouldRefresh", {
            detail: {
              type: "workspace",
              action: "deleted",
              workspaceId: workspace.id,
              // Можно добавить флаг, что нужно перейти на /dashboard после обновления
              navigateToDashboardHome: true 
            },
          })
        );
        
        closeModal();
        // Убираем немедленную навигацию отсюда, если хотим, чтобы dashboard.js сделал это после обновления
        // window.location.hash = "/dashboard"; 
        resolve(true);
      } catch (error) {
        console.error(
          `Ошибка при удалении рабочего пространства ${workspace.id}:`,
          error
        );
        showErrorToast(
          `Не удалось удалить рабочее пространство: ${
            error.message || "Неизвестная ошибка"
          }`
        );
        closeModal();
        resolve(false);
      }
    };
    
    modalOverlay.querySelector(".modal-close").addEventListener("click", () => {
      closeModal();
      resolve(false);
    });
    
    document.getElementById("cancelDelete").addEventListener("click", () => {
      closeModal();
      resolve(false);
    });
    
    confirmDeleteBtn.addEventListener("click", confirmDelete);
    
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) {
        closeModal();
        resolve(false);
      }
    });
  });
}

function getRoleName(role) {
  switch (role) {
    case "ADMIN":
      return "Администратор";
    case "MEMBER":
      return "Участник";
    case "VIEWER":
      return "Наблюдатель";
    default:
      return role || "Участник";
  }
}

function renderMembers(members, workspace, container) {
  if (!members || members.length === 0) {
    container.innerHTML = `<div class="workspace-empty">Нет участников</div>`;
    return;
  }
  
  console.log("Отображение участников:", members);
  
  const membersHtml = `
    <div class="members-filter-container">
      <input type="text" class="members-filter-input" placeholder="Поиск участников" id="membersFilter">
      <div class="members-filter-icon">🔍</div>
    </div>
    <div class="members-list">
      <div class="members-list-header">
        <div class="member-col member-avatar-col">Аватар</div>
        <div class="member-col member-name-col">Пользователь</div>
        <div class="member-col member-role-col">Роль</div>
        <div class="member-col member-actions-col">Действия</div>
      </div>
      <div class="members-rows-container">
        ${members
          .map((member) => {
          const displayName = member.fullName || `Пользователь ${member.id}`;

          const avatarChar = displayName.charAt(0).toUpperCase();

            const userEmail = member.email || "Нет данных";

          const roleDisplay = getRoleName(member.role);
          
          return `
            <div class="member-row" data-name="${displayName.toLowerCase()}" data-email="${userEmail.toLowerCase()}">
              <div class="member-col member-avatar-col">
                <div class="member-avatar">${avatarChar}</div>
              </div>
              <div class="member-col member-name-col">
                <div class="member-name">${displayName}</div>
                <div class="member-email">${userEmail}</div>
              </div>
              <div class="member-col member-role-col">
                <div class="member-role-badge">${roleDisplay}</div>
              </div>
              <div class="member-col member-actions-col">
                ${
                  workspace.owner && !member.isOwner
                    ? `
                  <button class="btn-secondary change-role-btn" data-user-id="${member.id}" data-user-name="${displayName}" data-role="${member.role}">
                    Изменить роль
                  </button>
                  <button class="btn-danger remove-member-btn" data-user-id="${member.id}" data-user-name="${displayName}">
                    Удалить
                  </button>
                `
                    : ""
                }
              </div>
            </div>
          `;
          })
          .join("")}
      </div>
    </div>
  `;
  
  container.innerHTML = membersHtml;
  
  const filterInput = document.getElementById("membersFilter");
  if (filterInput) {
    filterInput.addEventListener("input", function () {
      const filterValue = this.value.toLowerCase();
      const memberRows = container.querySelectorAll(".member-row");

      memberRows.forEach((row) => {
        const name = row.getAttribute("data-name");
        const email = row.getAttribute("data-email");
        
        if (name.includes(filterValue) || email.includes(filterValue)) {
          row.style.display = "";
        } else {
          row.style.display = "none";
        }
      });
    });
  }
  
  if (workspace.owner) {
    document.querySelectorAll(".remove-member-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const userId = btn.getAttribute("data-user-id");
        const userName = btn.getAttribute("data-user-name");
        const success = await removeMember(workspace.id, userId, userName);
        
        if (success) {
          loadWorkspaceMembers(workspace.id);
        }
      });
    });
    
    document.querySelectorAll(".change-role-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const userId = btn.getAttribute("data-user-id");
        const userName = btn.getAttribute("data-user-name");
        const currentRole = btn.getAttribute("data-role");
        const success = await changeUserRole(
          workspace.id,
          userId,
          userName,
          currentRole
        );

        if (success) {
          loadWorkspaceMembers(workspace.id);
        }
      });
    });
  }
}

export async function changeUserRole(
  workspaceId,
  userId,
  userName,
  currentRole
) {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  
  modalOverlay.innerHTML = `
    <div class="modal-container">
      <div class="modal-header">
        <h3 class="modal-title">Изменить роль пользователя</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <p>Выберите новую роль для пользователя <strong>${userName}</strong>:</p>
        <form class="role-select-form" id="roleForm">
          <div class="role-option ${currentRole === "ADMIN" ? "selected" : ""}">
            <input type="radio" name="role" id="role-admin" value="ADMIN" ${
              currentRole === "ADMIN" ? "checked" : ""
            }>
            <div class="role-info">
              <div class="role-name">Администратор</div>
              <div class="role-description">Полный доступ ко всем функциям рабочего пространства</div>
            </div>
          </div>
          <div class="role-option ${
            currentRole === "MEMBER" ? "selected" : ""
          }">
            <input type="radio" name="role" id="role-member" value="MEMBER" ${
              currentRole === "MEMBER" ? "checked" : ""
            }>
            <div class="role-info">
              <div class="role-name">Участник</div>
              <div class="role-description">Может создавать и редактировать доски и карточки</div>
            </div>
          </div>
          <div class="role-option ${
            currentRole === "VIEWER" ? "selected" : ""
          }">
            <input type="radio" name="role" id="role-viewer" value="VIEWER" ${
              currentRole === "VIEWER" ? "checked" : ""
            }>
            <div class="role-info">
              <div class="role-name">Наблюдатель</div>
              <div class="role-description">Может только просматривать содержимое, без возможности редактирования</div>
            </div>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="modal-secondary-btn" id="cancelRoleChange">Отмена</button>
        <button class="modal-primary-btn" id="submitRoleChange">Сохранить</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modalOverlay);
  
  setTimeout(() => {
    modalOverlay.classList.add("active");
  }, 10);
  
  const roleOptions = modalOverlay.querySelectorAll(".role-option");
  roleOptions.forEach((option) => {
    option.addEventListener("click", () => {
      roleOptions.forEach((opt) => opt.classList.remove("selected"));

      option.classList.add("selected");

      option.querySelector('input[type="radio"]').checked = true;
    });
  });
  
  return new Promise((resolve, reject) => {
    const closeModal = () => {
      modalOverlay.classList.remove("active");
      setTimeout(() => {
        document.body.removeChild(modalOverlay);
      }, 300);
    };
    
    const submitRoleChange = async () => {
      const selectedRole = document.querySelector(
        'input[name="role"]:checked'
      ).value;
      
      if (selectedRole === currentRole) {
        showInfoToast(
          `У пользователя ${userName} уже установлена роль "${getRoleName(
            selectedRole
          )}"`
        );
        closeModal();
        resolve(false);
        return;
      }
      
      try {
        await workspaceService.changeUserRole(
          workspaceId,
          userId,
          selectedRole
        );
        showSuccessToast(
          `Роль пользователя ${userName} успешно изменена на "${getRoleName(
            selectedRole
          )}"`
        );

        workspaceCache.clear(workspaceId);
        
        closeModal();
        resolve(true);
      } catch (error) {
        console.error(
          `Ошибка при изменении роли пользователя ${userId}:`,
          error
        );
        showErrorToast(
          `Не удалось изменить роль: ${error.message || "Неизвестная ошибка"}`
        );
        closeModal();
        resolve(false);
      }
    };
    
    modalOverlay.querySelector(".modal-close").addEventListener("click", () => {
      closeModal();
      resolve(false);
    });
    
    document
      .getElementById("cancelRoleChange")
      .addEventListener("click", () => {
      closeModal();
      resolve(false);
    });
    
    document
      .getElementById("submitRoleChange")
      .addEventListener("click", submitRoleChange);
    
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) {
        closeModal();
        resolve(false);
      }
    });
  });
} 

export async function loadWorkspaceChats(workspaceId) {
  const chatsContainer = document.getElementById("workspaceChats");
  if (!chatsContainer) {
    console.error("Не найден контейнер для отображения чатов: #workspaceChats");
    return;
  }
  if (!workspaceId) {
    console.error("ID рабочего пространства не указан при загрузке чатов");
    chatsContainer.innerHTML = `<div class="workspace-empty">Не указан ID рабочего пространства</div>`;
    return;
  }

  try {
    console.log(`Загрузка чатов для рабочего пространства ${workspaceId}...`);
    chatsContainer.innerHTML =
      '<div class="workspace-loading">Загрузка чатов...</div>';
    
    const chats = await workspaceService.getWorkspaceChats(workspaceId); 

    console.log(
      `Получено ${
        chats ? chats.length : 0
      } чатов для рабочего пространства ${workspaceId}:`,
      chats
    );

    renderChats(chats, chatsContainer, workspaceId);
  } catch (error) {
    console.error(
      `Ошибка при загрузке чатов рабочего пространства ${workspaceId}:`,
      error
    );
    chatsContainer.innerHTML = `
      <div class="workspace-error">
        <p>Ошибка при загрузке чатов: ${
          error.message || "Неизвестная ошибка"
        }</p>
        <button class="btn-secondary" onclick="window.location.reload()">Попробовать снова</button>
      </div>
    `;
  }
}

function renderChats(chats, container, workspaceId) {
  if (!chats || !Array.isArray(chats) || chats.length === 0) {
    container.innerHTML = `<div class="workspace-empty">Нет чатов в этом рабочем пространстве</div>`;
    return;
  }

  console.log(`Генерируем HTML для ${chats.length} чатов в РП ${workspaceId}`);

  const chatsHtml = chats
    .map(
      (chat) => `
    <div class="workspace-chat-item" data-chat-id="${
      chat.id
    }" data-workspace-id="${workspaceId}">
      <div class="chat-icon">💬</div>
      <div class="chat-info">
        <div class="chat-name">${chat.name || "Без названия"}</div>
        <div class="chat-created">${formatDate(
          chat.createdAt || new Date()
        )}</div>
      </div>
      <div class="workspace-item-actions">
        <button class="btn-secondary item-action-btn edit-chat-btn" data-chat-id="${
          chat.id
        }" data-chat-name="${
        chat.name || "Без названия"
      }" data-chat-description="${
        chat.description || ""
      }" title="Редактировать чат">Редактировать</button>
        <button class="btn-danger item-action-btn delete-chat-btn" data-chat-id="${
          chat.id
        }" data-chat-name="${
        chat.name || "Без названия"
      }" title="Удалить чат">Удалить</button>
    </div>
    </div>
  `
    )
    .join("");
  
  container.innerHTML = chatsHtml;
  
  document.querySelectorAll(".workspace-chat-item").forEach((chatItem) => {
    const chatId = chatItem.getAttribute("data-chat-id");
    const currentWorkspaceId = chatItem.getAttribute("data-workspace-id");

    chatItem.querySelector(".chat-info").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!chatId) {
        console.error("ID чата не найден в элементе");
        return;
      }
      console.log(`Выбран чат ${chatId}`);
      navigateToChat(chatId, currentWorkspaceId);
    });

    const editBtn = chatItem.querySelector(".edit-chat-btn");
    if (editBtn) {
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const chatName = editBtn.dataset.chatName;
        const chatDescription = editBtn.dataset.chatDescription;
        handleEditChatClick(
          chatId,
          chatName,
          chatDescription,
          currentWorkspaceId
        );
      });
    }

    const deleteBtn = chatItem.querySelector(".delete-chat-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const chatName = deleteBtn.dataset.chatName;
        handleDeleteChatClick(chatId, chatName, currentWorkspaceId);
      });
    }
  });
}

export async function addChatToWorkspace(workspaceId) {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  
  modalOverlay.innerHTML = `
    <div class="modal-container">
      <div class="modal-header">
        <h3 class="modal-title">Создание нового чата</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <form class="create-chat-form" id="createChatForm">
          <div class="form-group">
            <label for="chatName">Название чата</label>
            <input type="text" id="chatName" name="chatName" placeholder="Введите название чата" required>
          </div>
          <div class="form-group">
            <label for="chatDescription">Описание (необязательно)</label>
            <textarea id="chatDescription" name="chatDescription" rows="3" placeholder="Введите описание чата"></textarea>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="modal-secondary-btn" id="cancelChat">Отмена</button>
        <button class="modal-primary-btn" id="submitChat">Создать</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modalOverlay);
  
  setTimeout(() => {
    modalOverlay.classList.add("active");
  }, 10);
  
  return new Promise((resolve) => {
    const closeModal = () => {
      modalOverlay.classList.remove("active");
      setTimeout(() => {
        document.body.removeChild(modalOverlay);
      }, 300);
    };
    
    const submitChat = async () => {
      const chatName = document.getElementById("chatName").value.trim();
      const chatDescription = document
        .getElementById("chatDescription")
        .value.trim();
      
      if (!chatName) {
        showWarningToast("Пожалуйста, введите название чата");
        return;
      }
  
      try {
        const chatData = {
          name: chatName,
          description: chatDescription,
        };

        const newChat = await workspaceService.createChatInWorkspace(
          workspaceId,
          chatData
        );
 
        showSuccessToast(`Чат "${chatName}" успешно создан`);

        const overviewChatsContainer =
          document.getElementById("workspaceChats");
        if (
          overviewChatsContainer &&
          overviewChatsContainer.closest(".workspace-overview-tab")
        ) {
          await loadWorkspaceChats(workspaceId);
        }

        invalidateWorkspaceChatsCache(workspaceId);

        closeModal();
        
        resolve(true);
      } catch (error) {
        console.error("Ошибка при создании чата:", error);
        showErrorToast(
          `Не удалось создать чат: ${error.message || "Неизвестная ошибка"}`
        );
        closeModal();
        resolve(false);
      }
    };
    
    modalOverlay.querySelector(".modal-close").addEventListener("click", () => {
      closeModal();
      resolve(false);
    });
    document.getElementById("cancelChat").addEventListener("click", () => {
      closeModal();
      resolve(false);
    });
    document.getElementById("submitChat").addEventListener("click", submitChat);
    document
      .getElementById("createChatForm")
      .addEventListener("submit", (e) => {
        e.preventDefault();
        submitChat();
      });
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) {
        closeModal();
        resolve(false);
      }
    });
  });
}

export function navigateToChat(chatId, workspaceId) {
  if (!chatId) {
    console.error("ID чата не указан для навигации");
    return;
  }

  if (!workspaceId) {
    console.warn(
      `WorkspaceId не предоставлен для чата ${chatId}. Попытка определить из текущего URL.`
    );

    const currentHashParams = new URLSearchParams(
      window.location.hash.substring(1).split("?")[1] || ""
    );
    const currentWorkspaceId = currentHashParams.get("workspace");
    if (currentWorkspaceId) {
      workspaceId = currentWorkspaceId;
      console.log(
        `Используется workspaceId ${workspaceId} из текущего URL для чата ${chatId}`
      );
    } else {
      console.error(
        `Не удалось определить workspaceId для чата ${chatId}. Навигация может быть неполной.`
      );
    }
  }

  console.log(
    `Переход к чату ${chatId} в рабочем пространстве ${
      workspaceId || "не указано"
    }`
  );
  
  const params = new URLSearchParams();
  if (workspaceId) params.set("workspace", workspaceId);
  params.set("chat", chatId);

  window.location.hash = `/dashboard?${params.toString()}`;
}

async function handleEditBoardClick(boardId, currentName, workspaceId) {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  modalOverlay.innerHTML = `
    <div class="modal-container">
      <div class="modal-header">
        <h3 class="modal-title">Редактировать доску</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <form id="editBoardFormOverview">
          <div class="form-group">
            <label for="editBoardNameOverview">Название доски</label>
            <input type="text" id="editBoardNameOverview" value="${currentName}" required>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="modal-secondary-btn" id="cancelEditBoardOverview">Отмена</button>
        <button class="modal-primary-btn" id="submitEditBoardOverview">Сохранить</button>
      </div>
    </div>
  `;
  document.body.appendChild(modalOverlay);
  setTimeout(() => modalOverlay.classList.add("active"), 10);

  const closeModal = () => {
    modalOverlay.classList.remove("active");
    setTimeout(() => document.body.removeChild(modalOverlay), 300);
  };

  modalOverlay
    .querySelector(".modal-close")
    .addEventListener("click", closeModal);
  document
    .getElementById("cancelEditBoardOverview")
    .addEventListener("click", closeModal);
  document
    .getElementById("submitEditBoardOverview")
    .addEventListener("click", async () => {
      const newName = document
        .getElementById("editBoardNameOverview")
        .value.trim();
      if (!newName) {
        showErrorToast("Название доски не может быть пустым.");
        return;
      }
      try {
        const currentBoardData = await kanbanService.getBoard(boardId);
        await kanbanService.updateBoard(boardId, {
          name: newName,
          boardData: currentBoardData.boardData,
        });
        showSuccessToast("Доска обновлена");

        const boardsCache = getBoardsCache();
        if (boardsCache) {
          const boardInCache = boardsCache.find(
            (b) => String(b.id) === String(boardId)
          );
          if (boardInCache) {
            boardInCache.name = newName;
            updateBoardsCache([...boardsCache]);
          }
        }

        await loadWorkspaceBoards(workspaceId);
        closeModal();

        console.log(
          "[WorkspaceManager] Генерируется событие sidebarShouldRefresh для доски"
        );
        document.dispatchEvent(
          new CustomEvent("sidebarShouldRefresh", {
            detail: {
              type: "board",
              workspaceId: workspaceId,
              boardId: boardId,
            },
          })
        );
      } catch (error) {
        showErrorToast(`Ошибка обновления доски: ${error.message}`);
      }
    });
}

async function handleDeleteBoardClick(boardId, boardName, workspaceId) {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  modalOverlay.innerHTML = `
    <div class="modal-container">
      <div class="modal-header">
        <h3 class="modal-title">Удалить доску</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <p>Вы уверены, что хотите удалить доску "${boardName}"?</p>
        <p class="delete-warning">Это действие нельзя отменить.</p>
      </div>
      <div class="modal-footer">
        <button class="modal-secondary-btn" id="cancelDeleteBoardOverview">Отмена</button>
        <button class="modal-danger-btn" id="submitDeleteBoardOverview">Удалить</button>
      </div>
    </div>
  `;
  document.body.appendChild(modalOverlay);
  setTimeout(() => modalOverlay.classList.add("active"), 10);

  const closeModal = () => {
    modalOverlay.classList.remove("active");
    setTimeout(() => document.body.removeChild(modalOverlay), 300);
  };

  modalOverlay
    .querySelector(".modal-close")
    .addEventListener("click", closeModal);
  document
    .getElementById("cancelDeleteBoardOverview")
    .addEventListener("click", closeModal);
  document
    .getElementById("submitDeleteBoardOverview")
    .addEventListener("click", async () => {
      try {
        await kanbanService.deleteBoard(boardId);
        showSuccessToast("Доска удалена");

        const boardsCache = getBoardsCache();
        if (boardsCache) {
          const updatedCache = boardsCache.filter(
            (b) => String(b.id) !== String(boardId)
          );
          updateBoardsCache(updatedCache);
        }

        await loadWorkspaceBoards(workspaceId);
        closeModal();
      } catch (error) {
        showErrorToast(`Ошибка удаления доски: ${error.message}`);
      }
    });
}

async function handleEditChatClick(
  chatId,
  currentName,
  currentDescription,
  workspaceId
) {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  modalOverlay.innerHTML = `
    <div class="modal-container">
      <div class="modal-header">
        <h3 class="modal-title">Редактировать чат</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <form id="editChatFormOverview">
          <div class="form-group">
            <label for="editChatNameOverview">Название чата</label>
            <input type="text" id="editChatNameOverview" value="${currentName}" required>
          </div>
          <div class="form-group">
            <label for="editChatDescriptionOverview">Описание чата</label>
            <textarea id="editChatDescriptionOverview" rows="3">${currentDescription}</textarea>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="modal-secondary-btn" id="cancelEditChatOverview">Отмена</button>
        <button class="modal-primary-btn" id="submitEditChatOverview">Сохранить</button>
      </div>
    </div>
  `;
  document.body.appendChild(modalOverlay);
  setTimeout(() => modalOverlay.classList.add("active"), 10);

  const closeModal = () => {
    modalOverlay.classList.remove("active");
    setTimeout(() => document.body.removeChild(modalOverlay), 300);
  };

  modalOverlay
    .querySelector(".modal-close")
    .addEventListener("click", closeModal);
  document
    .getElementById("cancelEditChatOverview")
    .addEventListener("click", closeModal);
  document
    .getElementById("submitEditChatOverview")
    .addEventListener("click", async () => {
      const newName = document
        .getElementById("editChatNameOverview")
        .value.trim();
      const newDescription = document
        .getElementById("editChatDescriptionOverview")
        .value.trim();
      if (!newName) {
        showErrorToast("Название чата не может быть пустым.");
        return;
      }
      try {
        await workspaceService.updateChatInWorkspace(workspaceId, chatId, {
          name: newName,
          description: newDescription,
        });
        showSuccessToast("Чат обновлен");

        invalidateWorkspaceChatsCache(workspaceId);

        await loadWorkspaceChats(workspaceId);
        closeModal();

        console.log(
          "[WorkspaceManager] Генерируется событие sidebarShouldRefresh для чата"
        );
        document.dispatchEvent(
          new CustomEvent("sidebarShouldRefresh", {
            detail: {
              type: "chat",
              workspaceId: workspaceId,
              chatId: chatId,
            },
          })
        );
      } catch (error) {
        showErrorToast(`Ошибка обновления чата: ${error.message}`);
      }
    });
}

async function handleDeleteChatClick(chatId, chatName, workspaceId) {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  modalOverlay.innerHTML = `
    <div class="modal-container">
      <div class="modal-header">
        <h3 class="modal-title">Удалить чат</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <p>Вы уверены, что хотите удалить чат "${chatName}"?</p>
        <p class="delete-warning">Это действие нельзя отменить. Вся история сообщений будет удалена.</p>
      </div>
      <div class="modal-footer">
        <button class="modal-secondary-btn" id="cancelDeleteChatOverview">Отмена</button>
        <button class="modal-danger-btn" id="submitDeleteChatOverview">Удалить</button>
      </div>
    </div>
  `;
  document.body.appendChild(modalOverlay);
  setTimeout(() => modalOverlay.classList.add("active"), 10);

  const closeModal = () => {
    modalOverlay.classList.remove("active");
    setTimeout(() => document.body.removeChild(modalOverlay), 300);
  };

  modalOverlay
    .querySelector(".modal-close")
    .addEventListener("click", closeModal);
  document
    .getElementById("cancelDeleteChatOverview")
    .addEventListener("click", closeModal);
  document
    .getElementById("submitDeleteChatOverview")
    .addEventListener("click", async () => {
      try {
        await workspaceService.deleteChatInWorkspace(workspaceId, chatId);
        showSuccessToast("Чат удален");
        invalidateWorkspaceChatsCache(workspaceId);
        await loadWorkspaceChats(workspaceId);
        closeModal();
      } catch (error) {
        showErrorToast(`Ошибка удаления чата: ${error.message}`);
      }
    });
}
  