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
    return boardId;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const boardId = urlParams.get("board");
  if (boardId) {
  } else {
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
    return tabType;
  }
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
    return tabType;
  }
  return WorkspaceManager.WORKSPACE_DETAIL_TABS.OVERVIEW;
}

function setupDashboardHashChangeListener() {
  window.removeEventListener("hashchange", handleDashboardHashChange);

  window.addEventListener("hashchange", handleDashboardHashChange);
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
  if (cachedBoard) {
  } else {
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
}

async function handleDashboardHashChange() {
  const hash = window.location.hash.substring(1);
  if (hash.startsWith("/dashboard")) {
    const boardId = getBoardIdFromUrl();
    const chatId = getChatIdFromUrl();
    const workspaceTab = getWorkspaceTabFromUrl();
    const workspaceId = getWorkspaceIdFromUrl();
    const workspaceDetailTab = getWorkspaceDetailTabFromUrl();

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
      cleanupBoardEventListeners();
      currentDisplayedBoardId = null;
    }

    if (transitionFromChatToWorkspace || transitionFromChatToBoard) {
      cleanupChatPage();
      currentDisplayedChatId = null;
    }

    if (workspaceId !== lastWorkspaceId) {
      lastWorkspaceId = workspaceId;
    }

    try {
      const shouldLoadBoard =
        boardId &&
        (currentDisplayedBoardId !== boardId ||
          transitionToDifferentBoard ||
          transitionFromChatToBoard);

      const shouldLoadChat =
        chatId &&
        workspaceId &&
        (currentDisplayedChatId !== chatId ||
          transitionToDifferentChat ||
          transitionFromBoardToChat);

      if (shouldLoadBoard) {
        if (currentDisplayedChatId) {
          cleanupChatPage();
          currentDisplayedChatId = null;
        }
        cleanupBoardEventListeners();
        currentDisplayedBoardId = boardId;
      }

      if (shouldLoadChat) {
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
            boardDataFromCache = cachedBoard;
          }
        }
      }

      const promises = [renderDashboardSidebar(boardId || chatId, workspaceId)];

      if (shouldLoadBoard && boardId && !boardDataFromCache) {
        promises.push(kanbanService.getBoard(boardId));
      } else {
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

          let dashboardPath;

          if (workspaceId) {
            dashboardPath = `/dashboard?board=${selectedBoardId}&workspace=${workspaceId}&workspace_tab=${currentWorkspaceTab}`;
          } else {
            dashboardPath = `/dashboard?board=${selectedBoardId}&workspace_tab=${currentWorkspaceTab}`;
          }

          window.location.hash = dashboardPath;
        },

        (tabType) => {

          const dashboardPath = `/dashboard?workspace_tab=${tabType}`;

          window.location.hash = dashboardPath;
        },

        (selectedWorkspaceId) => {

          const dashboardPath = `/dashboard?workspace=${selectedWorkspaceId}&workspace_tab=${currentWorkspaceTab}`;

          if (workspaceId === selectedWorkspaceId) {
            return;
          }

          window.location.hash = dashboardPath;
        },

        (selectedChatId, selectedWorkspaceId) => {
          let dashboardPath;
          if (selectedWorkspaceId) {
            dashboardPath = `/dashboard?chat=${selectedChatId}&workspace=${selectedWorkspaceId}&workspace_tab=${currentWorkspaceTab}`;
          } else {
            dashboardPath = `/dashboard?chat=${selectedChatId}&workspace_tab=${currentWorkspaceTab}`;
          }
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

            currentDisplayedBoardId = null;
            window.location.hash = "/dashboard";
          },
          userRole
        );
      } else if (chatId && workspaceId && shouldLoadChat) {

        if (currentDisplayedBoardId) {
          cleanupBoardEventListeners();
          currentDisplayedBoardId = null;
        }

        await renderChatPage(chatId, workspaceId);
      } else if (workspaceId) {
        try {

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

  await refreshDashboardSidebar();

  if (event.detail && event.detail.action === "deleted" && event.detail.navigateToDashboardHome) {
    window.location.hash = "/dashboard";
  }
}
