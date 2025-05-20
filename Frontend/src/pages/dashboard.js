import "../css/main.css";
import { authService } from "../services/auth-service.js";
import {
  renderDashboardHeader,
  setupDashboardHeaderEventListeners,
} from "../components/DashboardHeader.js";
import {
  renderDashboardSidebar,
  setupSidebarEventListeners,
  getBoardsCache,
  updateBoardsCache,
  invalidateWorkspaceChatsCache,
} from "../components/DashboardSidebar.js";
import {
  renderKanbanBoard,
  setupBoardEventListeners,
  cleanupBoardEventListeners,
} from "../components/KanbanBoard.js";
import { navigateTo } from "../router.js";
import { kanbanService } from "../services/kanban-service.js";
import { workspaceService } from "../services/workspace-service.js";
import * as WorkspaceManager from "../components/WorkspaceManager.js";
import { renderChatPage, cleanupChatPage } from "../components/ChatWindow.js";

const WORKSPACE_TABS = WorkspaceManager.WORKSPACE_TABS;

function getBoardIdFromUrl() {
  const hash = window.location.hash.substring(1);

  if (hash.includes("?")) {
    const queryString = hash.split("?")[1];
    const urlParams = new URLSearchParams(queryString);
    const boardId = urlParams.get("board");
    console.log(`Получен ID доски из URL: ${boardId}`);
    return boardId;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const boardId = urlParams.get("board");
  if (boardId) {
    console.log(`Получен ID доски из URL параметров: ${boardId}`);
  } else {
    console.log("ID доски не найден в URL");
  }
  return boardId;
}

function getChatIdFromUrl() {
  const hash = window.location.hash.substring(1);
  if (hash.includes("?")) {
    const queryString = hash.split("?")[1];
    const urlParams = new URLSearchParams(queryString);
    const chatId = urlParams.get("chat");
    if (chatId) {
      console.log(`Получен ID чата из URL: ${chatId}`);
    }
    return chatId;
  }
  return null;
}

function getWorkspaceTabFromUrl() {
  const hash = window.location.hash.substring(1);

  if (hash.includes("?")) {
    const queryString = hash.split("?")[1];
    const urlParams = new URLSearchParams(queryString);
    const tabType = urlParams.get("workspace_tab") || WORKSPACE_TABS.MY;
    console.log(`Получен тип вкладки рабочего пространства из URL: ${tabType}`);
    return tabType;
  }

  console.log(
    `Используется тип вкладки рабочего пространства по умолчанию: ${WORKSPACE_TABS.MY}`
  );
  return WORKSPACE_TABS.MY;
}

function getWorkspaceIdFromUrl() {
  const hash = window.location.hash.substring(1);
  const urlParams = new URLSearchParams(
    hash.includes("?") ? hash.split("?")[1] : ""
  );
  const workspaceId = urlParams.get("workspace");

  return workspaceId && workspaceId.trim() !== "" ? workspaceId : null;
}

function getWorkspaceDetailTabFromUrl() {
  const hash = window.location.hash.substring(1);

  if (hash.includes("?")) {
    const queryString = hash.split("?")[1];
    const urlParams = new URLSearchParams(queryString);
    const tabType =
      urlParams.get("workspace_detail_tab") ||
      WorkspaceManager.WORKSPACE_DETAIL_TABS.OVERVIEW;
    console.log(
      `Получен тип вкладки детального просмотра рабочего пространства из URL: ${tabType}`
    );
    return tabType;
  }

  console.log(
    `Используется тип вкладки детального просмотра по умолчанию: ${WorkspaceManager.WORKSPACE_DETAIL_TABS.OVERVIEW}`
  );
  return WorkspaceManager.WORKSPACE_DETAIL_TABS.OVERVIEW;
}

function setupDashboardHashChangeListener() {
  window.removeEventListener("hashchange", handleDashboardHashChange);

  window.addEventListener("hashchange", handleDashboardHashChange);
  console.log("Обработчик изменения хэша установлен для дашборда");
}

let currentDisplayedBoardId = null;

let currentDisplayedChatId = null;

let currentWorkspaceTab = WORKSPACE_TABS.MY;

let lastWorkspaceId = null;

function debugBoardCache(boardId) {
  console.group("Отладка кэша досок");

  const localStorageCache = JSON.parse(
    localStorage.getItem("kanban_boards_cache") || "[]"
  );
  const cachedBoard = localStorageCache.find((b) => b.id == boardId);

  console.log(
    "Количество досок в кэше localStorage:",
    localStorageCache.length
  );
  if (cachedBoard) {
    console.log("Доска в кэше localStorage:", {
      id: cachedBoard.id,
      name: cachedBoard.name,
      hasUnsavedChanges: !!cachedBoard._hasUnsavedChanges,
    });
  } else {
    console.log("Доска НЕ найдена в кэше localStorage");
  }

  console.groupEnd();
}

function navigateToWorkspace(workspaceId) {
  window.location.hash = `/dashboard?workspace=${workspaceId}`;
}

async function acceptInvitation(invitationId) {
  await WorkspaceManager.acceptInvitation(invitationId);
}

async function declineInvitation(invitationId) {
  await WorkspaceManager.declineInvitation(invitationId);
}

async function refreshDashboardSidebar() {
  const sidebarContainer = document.getElementById("sidebarPlaceholder");
  if (!sidebarContainer) {
    console.error('Контейнер сайдбара "sidebarPlaceholder" не найден.');
    return;
  }

  console.log("[DASHBOARD] Обновление сайдбара...");

  const currentHash = window.location.hash.substring(1);
  const urlParams = new URLSearchParams(
    currentHash.includes("?") ? currentHash.split("?")[1] : ""
  );
  const activeEntityId = urlParams.get("board") || urlParams.get("chat");
  const activeWorkspaceId = urlParams.get("workspace");
  const currentWorkspaceTabFromUrl = getWorkspaceTabFromUrl();

  const sidebarHtml = await renderDashboardSidebar(
    activeEntityId,
    activeWorkspaceId
  );
  sidebarContainer.innerHTML = sidebarHtml;

  setupSidebarEventListeners(
    (selectedBoardId, selectedWsId) => {
      const newHash = `/dashboard?board=${selectedBoardId}${
        selectedWsId ? `&workspace=${selectedWsId}` : ""
      }&workspace_tab=${currentWorkspaceTabFromUrl}`;
      window.location.hash = newHash;
    },
    (tabType) => {
      window.location.hash = `/dashboard?workspace_tab=${tabType}`;
    },
    (selectedWorkspaceId) => {
      window.location.hash = `/dashboard?workspace=${selectedWorkspaceId}&workspace_tab=${currentWorkspaceTabFromUrl}&workspace_detail_tab=overview`;
    },
    (selectedChatId, selectedWsId) => {
      const newHash = `/dashboard?chat=${selectedChatId}${
        selectedWsId ? `&workspace=${selectedWsId}` : ""
      }&workspace_tab=${currentWorkspaceTabFromUrl}`;
      window.location.hash = newHash;
    }
  );
  console.log("[DASHBOARD] Сайдбар обновлен и обработчики установлены.");
}

async function handleDashboardHashChange() {
  const hash = window.location.hash.substring(1);
  if (hash.startsWith("/dashboard")) {
    console.log("Обработчик hashchange: обновление содержимого дашборда");
    const boardId = getBoardIdFromUrl();
    const chatId = getChatIdFromUrl();
    const workspaceTab = getWorkspaceTabFromUrl();
    const workspaceId = getWorkspaceIdFromUrl();
    const workspaceDetailTab = getWorkspaceDetailTabFromUrl();

    console.log("Текущие параметры URL:", {
      boardId,
      chatId,
      workspaceTab,
      workspaceId,
      workspaceDetailTab,
    });

    currentWorkspaceTab = workspaceTab;

    const transitionToDifferentBoard =
      currentDisplayedBoardId && boardId && currentDisplayedBoardId !== boardId;
    const transitionFromBoardToWorkspace =
      currentDisplayedBoardId && !boardId && !chatId && workspaceId;
    const transitionFromChatToWorkspace =
      currentDisplayedChatId && !boardId && !chatId && workspaceId;
    const transitionToDifferentChat =
      currentDisplayedChatId && chatId && currentDisplayedChatId !== chatId;
    const transitionFromBoardToChat =
      currentDisplayedBoardId && chatId && !boardId;
    const transitionFromChatToBoard =
      currentDisplayedChatId && boardId && !chatId;

    if (transitionFromBoardToWorkspace || transitionFromBoardToChat) {
      console.log(
        `Переход с доски ${currentDisplayedBoardId} в рабочее пространство/чат`
      );
      cleanupBoardEventListeners();
      currentDisplayedBoardId = null;
    }

    if (transitionFromChatToWorkspace || transitionFromChatToBoard) {
      console.log(
        `Переход с чата ${currentDisplayedChatId} в рабочее пространство/доску`
      );
      cleanupChatPage();
      currentDisplayedChatId = null;
    }

    if (workspaceId !== lastWorkspaceId) {
      console.log(
        `Изменено рабочее пространство с ${lastWorkspaceId} на ${workspaceId}`
      );
      lastWorkspaceId = workspaceId;
    }

    try {
      const shouldLoadBoard =
        boardId &&
        (currentDisplayedBoardId !== boardId ||
          transitionToDifferentBoard ||
          transitionFromChatToBoard);
      console.log(
        "Нужно ли загружать доску:",
        shouldLoadBoard,
        "текущая доска:",
        currentDisplayedBoardId,
        "новая доска:",
        boardId
      );

      const shouldLoadChat =
        chatId &&
        workspaceId &&
        (currentDisplayedChatId !== chatId ||
          transitionToDifferentChat ||
          transitionFromBoardToChat);
      console.log(
        "Нужно ли загружать чат:",
        shouldLoadChat,
        "текущий чат:",
        currentDisplayedChatId,
        "новый чат:",
        chatId
      );

      if (shouldLoadBoard) {
        console.log(`Переход на доску ${boardId}`);
        if (currentDisplayedChatId) {
          cleanupChatPage();
          currentDisplayedChatId = null;
        }
        cleanupBoardEventListeners();
        currentDisplayedBoardId = boardId;
      }

      if (shouldLoadChat) {
        console.log(`Переход на чат ${chatId} в пространстве ${workspaceId}`);
        if (currentDisplayedBoardId) {
          cleanupBoardEventListeners();
          currentDisplayedBoardId = null;
        }
        if (currentDisplayedChatId) {
          cleanupChatPage();
        }
        currentDisplayedChatId = chatId;
      }

      let boardDataFromCache = null;
      if (shouldLoadBoard) {
        if (boardId) {
          debugBoardCache(boardId);
          const localStorageCache = JSON.parse(
            localStorage.getItem("kanban_boards_cache") || "[]"
          );
          const cachedBoard = localStorageCache.find((b) => b.id == boardId);

          if (cachedBoard && cachedBoard._hasUnsavedChanges) {
            console.log(
              `Найдена доска с ID ${boardId} в кэше localStorage с несохраненными изменениями`
            );
            boardDataFromCache = cachedBoard;
          }
        }
      }

      const promises = [renderDashboardSidebar(boardId || chatId, workspaceId)];

      if (shouldLoadBoard && boardId && !boardDataFromCache) {
        console.log("Добавляем запрос на загрузку доски с сервера:", boardId);
        promises.push(kanbanService.getBoard(boardId));
      } else {
        console.log("Доску загружать не нужно, пропускаем запрос к API");
        promises.push(null);
      }

      const [sidebarHtml, boardDataFromServer] = await Promise.all(promises);

      const boardData = boardDataFromCache || boardDataFromServer;

      const sidebarPlaceholder = document.getElementById("sidebarPlaceholder");
      if (sidebarPlaceholder) {
        sidebarPlaceholder.innerHTML = sidebarHtml;
      } else {
        console.error('Элемент с ID "sidebarPlaceholder" не найден в DOM.');
      }

      setupSidebarEventListeners(
        (selectedBoardId) => {
          console.log(
            "Выбрана доска с ID (из обработчика изменения хэша):",
            selectedBoardId
          );

          let dashboardPath;

          if (workspaceId) {
            dashboardPath = `/dashboard?board=${selectedBoardId}&workspace=${workspaceId}&workspace_tab=${currentWorkspaceTab}`;
          } else {
            dashboardPath = `/dashboard?board=${selectedBoardId}&workspace_tab=${currentWorkspaceTab}`;
          }

          console.log("Перенаправляем на:", dashboardPath);

          window.location.hash = dashboardPath;
        },

        (tabType) => {
          console.log("Выбрана вкладка рабочих пространств:", tabType);

          const dashboardPath = `/dashboard?workspace_tab=${tabType}`;

          console.log("Перенаправляем на:", dashboardPath);

          window.location.hash = dashboardPath;
        },

        (selectedWorkspaceId) => {
          console.log(
            "Выбрано рабочее пространство с ID:",
            selectedWorkspaceId
          );

          const dashboardPath = `/dashboard?workspace=${selectedWorkspaceId}&workspace_tab=${currentWorkspaceTab}`;

          if (workspaceId === selectedWorkspaceId) {
            console.log(
              "Уже находимся в выбранном рабочем пространстве, не обновляем URL"
            );
            return;
          }

          console.log("Перенаправляем на:", dashboardPath);

          window.location.hash = dashboardPath;
        },

        (selectedChatId, selectedWorkspaceId) => {
          console.log(
            "Выбран чат с ID (из обработчика изменения хэша):",
            selectedChatId,
            "в пространстве:",
            selectedWorkspaceId
          );
          let dashboardPath;
          if (selectedWorkspaceId) {
            dashboardPath = `/dashboard?chat=${selectedChatId}&workspace=${selectedWorkspaceId}&workspace_tab=${currentWorkspaceTab}`;
          } else {
            dashboardPath = `/dashboard?chat=${selectedChatId}&workspace_tab=${currentWorkspaceTab}`;
          }
          console.log("Перенаправляем на:", dashboardPath);
          window.location.hash = dashboardPath;
        }
      );

      let contentHtml;
      if (boardId && boardData) {
        let userRole = null;

        if (workspaceId && boardData.workspaceId == workspaceId) {
          try {
            const workspace = await workspaceService.getWorkspace(workspaceId);
            if (workspace) {
              userRole = workspace.role;
              console.log(`Получена роль пользователя для доски: ${userRole}`);
            }
          } catch (error) {
            console.error("Ошибка при получении роли пользователя:", error);
          }
        }

        contentHtml = await renderKanbanBoard(boardId, boardData, userRole);
        document.getElementById("dashboardContent").innerHTML = contentHtml;

        setupBoardEventListeners(
          boardId,
          () => {
            console.log(
              "Доска удалена (из обработчика изменения хэша), перенаправляем на дашборд без параметров"
            );

            currentDisplayedBoardId = null;
            window.location.hash = "/dashboard";
          },
          userRole
        );
      } else if (chatId && workspaceId && shouldLoadChat) {
        console.log(
          `Отображение чата ${chatId} в рабочем пространстве ${workspaceId}`
        );
        console.log(
          "Токен в dashboard.js ПЕРЕД renderChatPage:",
          localStorage.getItem("auth_token")
        );

        if (currentDisplayedBoardId) {
          cleanupBoardEventListeners();
          currentDisplayedBoardId = null;
        }

        await renderChatPage(chatId, workspaceId);
      } else if (workspaceId) {
        try {
          console.log(`Загрузка рабочего пространства ${workspaceId}...`);

          if (
            !workspaceId ||
            workspaceId === "undefined" ||
            workspaceId === "null"
          ) {
            console.error(
              "Обнаружен некорректный ID рабочего пространства:",
              workspaceId
            );
            throw new Error("Некорректный ID рабочего пространства");
          }

          contentHtml = await WorkspaceManager.renderWorkspaceDetail(
            workspaceId,
            workspaceDetailTab
          );
          document.getElementById("dashboardContent").innerHTML = contentHtml;

          WorkspaceManager.setupWorkspaceDetailTabsEventListeners(workspaceId);
        } catch (error) {
          console.error(
            `Ошибка при загрузке рабочего пространства ${workspaceId}:`,
            error
          );
          contentHtml = `
            <div class="workspace-error">
              <h3>Ошибка при загрузке рабочего пространства</h3>
              <p>${error.message || "Неизвестная ошибка"}</p>
              <button class="btn-secondary" onclick="window.location.hash = '/dashboard'">
                Вернуться к списку
              </button>
            </div>
          `;
          document.getElementById("dashboardContent").innerHTML = contentHtml;
        }
      } else {
        contentHtml = await WorkspaceManager.renderWorkspaceContent(
          workspaceTab
        );
        document.getElementById("dashboardContent").innerHTML = contentHtml;

        WorkspaceManager.setupWorkspaceContentEventListeners((wsId) => {
          currentDisplayedBoardId = null;
          currentDisplayedChatId = null;
          cleanupBoardEventListeners();
          cleanupChatPage();
          window.location.hash = `/dashboard?workspace=${wsId}&workspace_tab=${currentWorkspaceTab}`;
        });
      }
    } catch (error) {
      console.error("Ошибка при обновлении содержимого по хэшу:", error);
      const errorMsg = `
        <div class="dashboard-error-content">
          <h3>Ошибка при загрузке данных</h3>
          <p>${error.message || "Неизвестная ошибка"}</p>
          <button id="reloadButton" class="btn-secondary">Обновить данные</button>
        </div>
      `;
      document.getElementById("dashboardContent").innerHTML = errorMsg;

      document.getElementById("reloadButton")?.addEventListener("click", () => {
        window.location.reload();
      });
    }
  }
}

export async function renderDashboardPage() {
  try {
    if (!authService.isAuthenticated()) {
      sessionStorage.setItem(
        "redirectAfterAuth",
        window.location.pathname + window.location.search
      );

      navigateTo("/login");
      return;
    }

    const userData = await authService.refreshUserData();
    if (!userData) {
      throw new Error("Не удалось получить данные пользователя");
    }

    document.querySelector("#app").innerHTML = `
      <div class="dashboard-container">
        <!-- Dashboard Header -->
        ${renderDashboardHeader()}
        
        <!-- Dashboard Sidebar -->
        <div id="sidebarPlaceholder">
          <div class="dashboard-sidebar">
            <div class="sidebar-header">
              <div class="sidebar-title">Рабочие пространства</div>
            </div>
            <div class="sidebar-menu">
              <div class="sidebar-loading">Загрузка...</div>
            </div>
          </div>
        </div>

        <!-- Dashboard Content -->
        <div id="dashboardContent" class="dashboard-content">
          <div class="dashboard-loading">
            <p>Загрузка содержимого...</p>
          </div>
        </div>
      </div>
    `;

    setupDashboardHeaderEventListeners();

    setupDashboardHashChangeListener();

    await handleDashboardHashChange();

    document.removeEventListener(
      "sidebarShouldRefresh",
      handleSidebarRefreshEvent
    );
    document.addEventListener(
      "sidebarShouldRefresh",
      handleSidebarRefreshEvent
    );
  } catch (error) {
    console.error("Ошибка при загрузке дашборда:", error);

    document.querySelector("#app").innerHTML = `
      <div class="dashboard-error">
        <h2>Ошибка при загрузке дашборда</h2>
        <p>${error.message || "Неизвестная ошибка"}</p>
        <button id="tryAgainButton">Попробовать снова</button>
        <button id="logoutButton">Выйти из системы</button>
      </div>
    `;

    document.getElementById("tryAgainButton").addEventListener("click", () => {
      window.location.reload();
    });

    document
      .getElementById("logoutButton")
      .addEventListener("click", async () => {
        await authService.logout();
        navigateTo("/login");
      });
  }
}

async function handleSidebarRefreshEvent(event) {
  console.log(
    "[DASHBOARD] Получено событие sidebarShouldRefresh:",
    event.detail
  );

  await refreshDashboardSidebar();
}
