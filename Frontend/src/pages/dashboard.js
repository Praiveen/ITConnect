import '../css/main.css';
import { authService } from '../services/auth-service.js';
import { renderDashboardHeader, setupDashboardHeaderEventListeners } from '../components/DashboardHeader.js';
import { renderDashboardSidebar, setupSidebarEventListeners } from '../components/DashboardSidebar.js';
import { renderKanbanBoard, setupBoardEventListeners, cleanupBoardEventListeners } from '../components/KanbanBoard.js';
import { navigateTo } from '../router.js';
import { kanbanService } from '../services/kanban-service.js';
import { workspaceService } from '../services/workspace-service.js';
import * as WorkspaceManager from '../components/WorkspaceManager.js';

// Импортируем константы из компонента WorkspaceManager
const WORKSPACE_TABS = WorkspaceManager.WORKSPACE_TABS;

// Получаем ID доски из URL параметров
function getBoardIdFromUrl() {
  // Получаем hash из URL (без символа #)
  const hash = window.location.hash.substring(1);
  
  // Если в хеше есть параметры запроса, извлекаем их
  if (hash.includes('?')) {
    const queryString = hash.split('?')[1];
    const urlParams = new URLSearchParams(queryString);
    const boardId = urlParams.get('board');
    console.log(`Получен ID доски из URL: ${boardId}`);
    return boardId;
  }
  
  // Если используем не хэш, а обычные URL-параметры
  const urlParams = new URLSearchParams(window.location.search);
  const boardId = urlParams.get('board');
  if (boardId) {
    console.log(`Получен ID доски из URL параметров: ${boardId}`);
  } else {
    console.log('ID доски не найден в URL');
  }
  return boardId;
}

// Получаем тип рабочего пространства из URL параметров
function getWorkspaceTabFromUrl() {
  // Получаем hash из URL (без символа #)
  const hash = window.location.hash.substring(1);
  
  // Если в хеше есть параметры запроса, извлекаем их
  if (hash.includes('?')) {
    const queryString = hash.split('?')[1];
    const urlParams = new URLSearchParams(queryString);
    const tabType = urlParams.get('workspace_tab') || WORKSPACE_TABS.MY;
    console.log(`Получен тип вкладки рабочего пространства из URL: ${tabType}`);
    return tabType;
  }
  
  console.log(`Используется тип вкладки рабочего пространства по умолчанию: ${WORKSPACE_TABS.MY}`);
  return WORKSPACE_TABS.MY; // По умолчанию отображаем "Мои пространства"
}

// Функция для обработки изменения хэша URL (для обновления содержимого при создании/выборе доски)
function setupDashboardHashChangeListener() {
  // Удаляем предыдущий обработчик, если он существует
  window.removeEventListener('hashchange', handleDashboardHashChange);
  
  // Добавляем новый обработчик
  window.addEventListener('hashchange', handleDashboardHashChange);
  console.log('Обработчик изменения хэша установлен для дашборда');
}

// Переменная для отслеживания текущей отображаемой доски
let currentDisplayedBoardId = null;
// Переменная для отслеживания текущей вкладки пространств
let currentWorkspaceTab = WORKSPACE_TABS.MY;
// Переменная для отслеживания последнего рабочего пространства
let lastWorkspaceId = null;

// Функция для проверки кэша досок
function debugBoardCache(boardId) {
  console.group('Отладка кэша досок');
  
  // Проверяем кэш в localStorage
  const localStorageCache = JSON.parse(localStorage.getItem('kanban_boards_cache') || '[]');
  const cachedBoard = localStorageCache.find(b => b.id == boardId);
  
  console.log('Количество досок в кэше localStorage:', localStorageCache.length);
  if (cachedBoard) {
    console.log('Доска в кэше localStorage:', {
      id: cachedBoard.id,
      name: cachedBoard.name,
      hasUnsavedChanges: !!cachedBoard._hasUnsavedChanges
    });
  } else {
    console.log('Доска НЕ найдена в кэше localStorage');
  }
  
  console.groupEnd();
}

// Функция для перехода к рабочему пространству
function navigateToWorkspace(workspaceId) {
  window.location.hash = `/dashboard?workspace=${workspaceId}`;
}

// Функция для принятия приглашения
async function acceptInvitation(invitationId) {
  await WorkspaceManager.acceptInvitation(invitationId);
}

// Функция для отклонения приглашения
async function declineInvitation(invitationId) {
  await WorkspaceManager.declineInvitation(invitationId);
}

// Выносим обработчик изменения хэша в отдельную функцию
async function handleDashboardHashChange() {
  // Проверяем, что мы на странице дашборда
  const hash = window.location.hash.substring(1);
  if (hash.startsWith('/dashboard')) {
    console.log('Обработчик hashchange: обновление содержимого дашборда');
    const boardId = getBoardIdFromUrl();
    const workspaceTab = getWorkspaceTabFromUrl();
    const workspaceId = getWorkspaceIdFromUrl(); // Получаем ID рабочего пространства
    
    // Отладка запроса и параметров URL
    console.log('Текущие параметры URL:', { boardId, workspaceTab, workspaceId });
    
    // Обновляем текущую вкладку рабочих пространств
    currentWorkspaceTab = workspaceTab;
    
    // Проверяем, не произошел ли переход от доски к рабочему пространству
    const transitionToDifferentBoard = currentDisplayedBoardId && boardId && currentDisplayedBoardId !== boardId;
    const transitionFromBoardToWorkspace = currentDisplayedBoardId && !boardId && workspaceId;
    
    // Если переходим из доски в рабочее пространство, сбрасываем currentDisplayedBoardId
    if (transitionFromBoardToWorkspace) {
      console.log(`Переход с доски ${currentDisplayedBoardId} в рабочее пространство ${workspaceId}`);
      cleanupBoardEventListeners();
      currentDisplayedBoardId = null;
    }
    
    // Проверяем, было ли изменение рабочего пространства
    if (workspaceId !== lastWorkspaceId) {
      console.log(`Изменено рабочее пространство с ${lastWorkspaceId} на ${workspaceId}`);
      lastWorkspaceId = workspaceId;
    }
    
    try {
      // Определяем приоритет отображения:
      // 1. Если есть boardId - показываем доску
      // 2. Если нет boardId, но есть workspaceId - показываем рабочее пространство
      // 3. Иначе показываем список рабочих пространств
      
      // Определяем, нужно ли загружать доску
      const shouldLoadBoard = boardId && (currentDisplayedBoardId !== boardId || transitionToDifferentBoard);
      console.log('Нужно ли загружать доску:', shouldLoadBoard, 'текущая доска:', currentDisplayedBoardId, 'новая доска:', boardId);
      
      // Если переходим на другую доску, очищаем слушатели и сохраняем текущие изменения
      if (shouldLoadBoard) {
        console.log(`Переход с доски ${currentDisplayedBoardId} на доску ${boardId}`);
        cleanupBoardEventListeners();
        currentDisplayedBoardId = boardId;
      }
      
      // Проверяем кэш в localStorage только если нужно загрузить доску
      let boardDataFromCache = null;
      if (shouldLoadBoard) {
        if (boardId) {
          debugBoardCache(boardId);
          const localStorageCache = JSON.parse(localStorage.getItem('kanban_boards_cache') || '[]');
          const cachedBoard = localStorageCache.find(b => b.id == boardId);
          
          if (cachedBoard && cachedBoard._hasUnsavedChanges) {
            console.log(`Найдена доска с ID ${boardId} в кэше localStorage с несохраненными изменениями`);
            boardDataFromCache = cachedBoard;
          }
        }
      }
      
      // Загружаем данные параллельно, но доску только если это необходимо
      const promises = [
        renderDashboardSidebar(boardId) // Рендерим сайдбар с выделенной доской
      ];
      
      // Добавляем запрос на загрузку доски только если нужно
      if (shouldLoadBoard && boardId && !boardDataFromCache) {
        console.log('Добавляем запрос на загрузку доски с сервера:', boardId);
        promises.push(kanbanService.getBoard(boardId));
      } else {
        console.log('Доску загружать не нужно, пропускаем запрос к API');
        promises.push(null);
      }
      
      const [sidebarHtml, boardDataFromServer] = await Promise.all(promises);
      
      // Определяем, какие данные использовать
      const boardData = boardDataFromCache || boardDataFromServer;
      
      // Обновляем сайдбар
      document.getElementById('sidebarPlaceholder').innerHTML = sidebarHtml;
      
      // Устанавливаем обработчики для сайдбара
      setupSidebarEventListeners(
        // Обработчик выбора доски
        (selectedBoardId) => {
          console.log('Выбрана доска с ID (из обработчика изменения хэша):', selectedBoardId);
          // Используем хэш-навигацию для перехода к выбранной доске
          let dashboardPath;
          
          // Сохраняем ID рабочего пространства, если оно было выбрано
          if (workspaceId) {
            dashboardPath = `/dashboard?board=${selectedBoardId}&workspace=${workspaceId}&workspace_tab=${currentWorkspaceTab}`;
          } else {
            dashboardPath = `/dashboard?board=${selectedBoardId}&workspace_tab=${currentWorkspaceTab}`;
          }
          
          console.log('Перенаправляем на:', dashboardPath);
          
          // Обновляем URL без перезагрузки страницы
          window.location.hash = dashboardPath;
        },
        // Обработчик выбора вкладки рабочих пространств
        (tabType) => {
          console.log('Выбрана вкладка рабочих пространств:', tabType);
          
          // Формируем новый URL с выбранной вкладкой, полностью удаляя параметр board
          const dashboardPath = `/dashboard?workspace_tab=${tabType}`;
          
          console.log('Перенаправляем на:', dashboardPath);
          
          // Обновляем URL без перезагрузки страницы
          window.location.hash = dashboardPath;
        }
      );
      
      // Обновляем содержимое в зависимости от выбранной доски, рабочего пространства и вкладки
      let contentHtml;
      if (boardId && boardData) {
        // Если выбрана конкретная доска, отображаем её содержимое
        contentHtml = await renderKanbanBoard(boardId, boardData);
        document.getElementById('dashboardContent').innerHTML = contentHtml;
        
        // Устанавливаем обработчики для доски
        setupBoardEventListeners(boardId, () => {
          console.log('Доска удалена (из обработчика изменения хэша), перенаправляем на дашборд без параметров');
          window.location.hash = '/dashboard';
        });
      } else if (workspaceId) {
        // Если выбрано конкретное рабочее пространство, отображаем его содержимое
        try {
          const workspace = await workspaceService.getWorkspace(workspaceId);
          contentHtml = `
            <div class="workspace-detail">
              <div class="workspace-detail-header">
                <h2>${workspace.name}</h2>
                <div class="workspace-detail-actions">
                  <button class="btn-secondary workspace-edit-btn" data-workspace-id="${workspace.id}">
                    Редактировать
                  </button>
                  <button class="btn-primary workspace-invite-btn" data-workspace-id="${workspace.id}">
                    + Пригласить
                  </button>
                </div>
              </div>
              <p class="workspace-description">${workspace.description || 'Нет описания'}</p>
              
              <div class="workspace-detail-content">
                <div class="workspace-section">
                  <h3>Участники</h3>
                  <div class="workspace-members" id="workspaceMembers">
                    <div class="workspace-loading">Загрузка участников...</div>
                  </div>
                </div>
                
                <div class="workspace-section">
                  <h3>Доски</h3>
                  <button class="btn-secondary workspace-add-board-btn" data-workspace-id="${workspace.id}">
                    + Добавить доску
                  </button>
                  <div class="workspace-boards" id="workspaceBoards">
                    <div class="workspace-loading">Загрузка досок...</div>
                  </div>
                </div>
              </div>
            </div>
          `;
          document.getElementById('dashboardContent').innerHTML = contentHtml;
          
          // Загружаем и отображаем участников рабочего пространства
          WorkspaceManager.loadWorkspaceMembers(workspaceId);
          
          // Не нужно устанавливать обработчики снова, они уже установлены в loadWorkspaceMembers
          // WorkspaceManager.setupWorkspaceDetailEventListeners(workspace);
        } catch (error) {
          console.error(`Ошибка при загрузке рабочего пространства ${workspaceId}:`, error);
          contentHtml = `
            <div class="workspace-error">
              <h3>Ошибка при загрузке рабочего пространства</h3>
              <p>${error.message || 'Неизвестная ошибка'}</p>
              <button class="btn-secondary" onclick="window.location.hash = '/dashboard'">
                Вернуться к списку
              </button>
            </div>
          `;
          document.getElementById('dashboardContent').innerHTML = contentHtml;
        }
      } else {
        // Если не выбрана доска и не выбрано рабочее пространство, отображаем контент рабочего пространства
        contentHtml = await WorkspaceManager.renderWorkspaceContent(workspaceTab);
        document.getElementById('dashboardContent').innerHTML = contentHtml;
        
        // Устанавливаем обработчики для контента рабочих пространств
        WorkspaceManager.setupWorkspaceContentEventListeners((wsId) => {
          // Обновляем URL с ID рабочего пространства
          window.location.hash = `/dashboard?workspace=${wsId}&workspace_tab=${currentWorkspaceTab}`;
        });
      }
    } catch (error) {
      console.error('Ошибка при обновлении содержимого по хэшу:', error);
      const errorMsg = `
        <div class="dashboard-error-content">
          <h3>Ошибка при загрузке данных</h3>
          <p>${error.message || 'Неизвестная ошибка'}</p>
          <button id="reloadButton" class="btn-secondary">Обновить данные</button>
        </div>
      `;
      document.getElementById('dashboardContent').innerHTML = errorMsg;
      
      // Добавляем обработчик для кнопки повторной загрузки
      document.getElementById('reloadButton')?.addEventListener('click', () => {
        window.location.reload();
      });
    }
  }
}

// Получаем ID рабочего пространства из URL параметров
function getWorkspaceIdFromUrl() {
  // Получаем hash из URL (без символа #)
  const hash = window.location.hash.substring(1);
  
  // Если в хеше есть параметры запроса, извлекаем их
  if (hash.includes('?')) {
    const queryString = hash.split('?')[1];
    const urlParams = new URLSearchParams(queryString);
    const workspaceId = urlParams.get('workspace');
    console.log(`Получен ID рабочего пространства из URL: ${workspaceId}`);
    return workspaceId;
  }
  
  console.log('ID рабочего пространства не найден в URL');
  return null;
}

// Функция для рендеринга страницы дашборда
export async function renderDashboardPage() {
  try {
    // Проверяем, авторизован ли пользователь
    if (!authService.isAuthenticated()) {
      // Сохраняем текущий URL для редиректа после авторизации
      sessionStorage.setItem('redirectAfterAuth', window.location.pathname + window.location.search);
      // Перенаправляем на страницу входа
      navigateTo('/login');
      return;
    }

    // Получаем данные пользователя
    const userData = await authService.refreshUserData();
    if (!userData) {
      throw new Error('Не удалось получить данные пользователя');
    }
    
    // Сначала рендерим страницу со скелетом и индикатором загрузки
    document.querySelector('#app').innerHTML = `
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
    
    // Устанавливаем обработчики событий для хедера
    setupDashboardHeaderEventListeners();
    
    // Настраиваем обработчик изменения хэша для динамического обновления содержимого
    setupDashboardHashChangeListener();
    
    // Имитируем событие изменения хэша для обновления содержимого при первой загрузке
    await handleDashboardHashChange();
    
  } catch (error) {
    console.error('Ошибка при загрузке дашборда:', error);
    // В случае ошибки показываем сообщение об ошибке
    document.querySelector('#app').innerHTML = `
      <div class="dashboard-error">
        <h2>Ошибка при загрузке дашборда</h2>
        <p>${error.message || 'Неизвестная ошибка'}</p>
        <button id="tryAgainButton">Попробовать снова</button>
        <button id="logoutButton">Выйти из системы</button>
      </div>
    `;
    
    // Добавляем обработчики для кнопок
    document.getElementById('tryAgainButton').addEventListener('click', () => {
      window.location.reload();
    });
    
    document.getElementById('logoutButton').addEventListener('click', async () => {
      await authService.logout();
      navigateTo('/login');
    });
  }
}