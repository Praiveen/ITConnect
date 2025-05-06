import { kanbanService } from '../services/kanban-service.js';

// Кэш последних полученных досок
let boardsCache = null;
let lastBoardsFetchTime = 0;
const CACHE_TIMEOUT = 60 * 1000; // 1 минута - время жизни кэша в памяти

// Типы отображения рабочих пространств
export const WORKSPACE_TABS = {
  ALL: 'all',
  MY: 'my',
  SHARED: 'shared'
};

// Текущая активная вкладка
let activeWorkspaceTab = WORKSPACE_TABS.MY;

// Функции для доступа к кэшу из других модулей
export function getBoardsCache() {
  return boardsCache;
}

export function updateBoardsCache(newCache) {
  boardsCache = newCache;
  lastBoardsFetchTime = Date.now();
}

// Компонент боковой панели дашборда
export async function renderDashboardSidebar(activeBoard = null) {
  // Используем кэш, если он есть и не устарел
  const now = Date.now();
  const useCache = boardsCache && (now - lastBoardsFetchTime < CACHE_TIMEOUT);
  
  // Получаем список досок с сервера или из кэша
  let boards = [];
  if (useCache) {
    console.log('Используем кэшированные данные о досках из памяти');
    boards = boardsCache;
  } else {
    try {
      console.log('Загрузка списка досок с сервера...');
      boards = await kanbanService.getBoards();
      
      // Обновляем кэш в памяти и localStorage
      boardsCache = boards;
      lastBoardsFetchTime = now;
      localStorage.setItem('kanban_boards_cache', JSON.stringify(boards));
      console.log(`Получены доски с сервера (${boards.length}), кэш обновлен`);
    } catch (error) {
      console.error('Ошибка при получении списка досок:', error);
      // Если произошла ошибка, используем кэшированные данные из localStorage
      const localStorageCache = localStorage.getItem('kanban_boards_cache');
      if (localStorageCache) {
        boards = JSON.parse(localStorageCache);
        console.log(`Используем кэшированные данные из localStorage (${boards.length} досок)`);
      } else {
        console.log('Кэш в localStorage не найден, возвращаем пустой список');
      }
    }
  }
  
  // Если активная доска отсутствует в списке досок, добавляем её
  if (activeBoard && !boards.some(board => board.id == activeBoard)) {
    try {
      console.log(`Активная доска ${activeBoard} отсутствует в списке, загружаем данные...`);
      const boardData = await kanbanService.getBoard(activeBoard);
      if (boardData) {
        // Добавляем доску в список и обновляем кэши
        boards.push(boardData);
        boardsCache = boards;
        localStorage.setItem('kanban_boards_cache', JSON.stringify(boards));
        console.log(`Доска ${activeBoard} добавлена в список и кэш`);
      }
    } catch (error) {
      console.error(`Ошибка при загрузке активной доски ${activeBoard}:`, error);
    }
  }
  
  return `
    <div class="dashboard-sidebar">
      <div class="sidebar-header">
        <div class="sidebar-title">Рабочие пространства</div>
      </div>
      
      <div class="workspace-tabs-vertical">
        <div class="workspace-tab-item ${activeWorkspaceTab === WORKSPACE_TABS.ALL ? 'active' : ''}" data-tab="${WORKSPACE_TABS.ALL}">
          <span class="workspace-tab-icon">🌐</span>
          <span>Все пространства</span>
        </div>
        <div class="workspace-tab-item ${activeWorkspaceTab === WORKSPACE_TABS.MY ? 'active' : ''}" data-tab="${WORKSPACE_TABS.MY}">
          <span class="workspace-tab-icon">👤</span>
          <span>Мои пространства</span>
        </div>
        <div class="workspace-tab-item ${activeWorkspaceTab === WORKSPACE_TABS.SHARED ? 'active' : ''}" data-tab="${WORKSPACE_TABS.SHARED}">
          <span class="workspace-tab-icon">👥</span>
          <span>Совместные</span>
        </div>
      </div>
      
      <div class="sidebar-menu">
        <button class="create-board-button" id="createBoardButton">
          <span>+</span> Создать доску
        </button>
        
        <div class="sidebar-section">
          <div class="sidebar-section-title">
            Мои доски
          </div>
          
          <div class="board-list" id="boardList">
            ${boards.length > 0 
              ? boards.map(board => `
                <div class="sidebar-item ${board.id == activeBoard ? 'active' : ''}" data-board-id="${board.id}">
                  <span class="sidebar-item-icon">📋</span>
                  <span>${board.name}</span>
                </div>
              `).join('')
              : `<div class="board-empty-state">У вас пока нет досок</div>`
            }
          </div>
        </div>
      </div>
    </div>
  `;
}

// Функция для установки обработчиков событий боковой панели
export function setupSidebarEventListeners(onBoardSelect, onWorkspaceTabClick) {
  // Обработчик для кнопки создания доски
  const createBoardButton = document.getElementById('createBoardButton');
  if (createBoardButton) {
    createBoardButton.addEventListener('click', () => {
      createNewBoard(onBoardSelect);
    });
  }
  
  // Обработчики для элементов списка досок
  const boardItems = document.querySelectorAll('.sidebar-item[data-board-id]');
  boardItems.forEach(item => {
    item.addEventListener('click', () => {
      const boardId = item.getAttribute('data-board-id');
      if (typeof onBoardSelect === 'function') {
        onBoardSelect(boardId);
      }
    });
  });
  
  // Обработчики для вкладок рабочих пространств
  const workspaceTabs = document.querySelectorAll('.workspace-tab-item');
  workspaceTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabType = tab.getAttribute('data-tab');
      
      // Меняем активную вкладку
      workspaceTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      activeWorkspaceTab = tabType;
      
      // Вызываем обработчик выбора вкладки
      if (typeof onWorkspaceTabClick === 'function') {
        onWorkspaceTabClick(tabType);
      }
    });
  });
}

// Функция для создания новой доски
async function createNewBoard(onBoardSelect) {
  const boardName = prompt('Введите название новой доски:');
  console.log('Введенное имя доски:', boardName);
  
  if (!boardName || boardName.trim() === '') {
    console.log('Создание доски отменено: пустое имя');
    return;
  }
  
  try {
    console.log('Начинаю создание доски:', boardName);
    
    // Получаем текущий ID рабочего пространства из URL (если есть)
    const currentHash = window.location.hash.substring(1);
    const urlParams = new URLSearchParams(currentHash.includes('?') ? currentHash.split('?')[1] : '');
    const workspaceId = urlParams.get('workspace');
    
    // Подготавливаем данные о новой доске
    const boardData = {
      name: boardName,
      boardData: JSON.stringify({
        columns: [
          { id: 'column1', name: 'К выполнению', tasks: [] },
          { id: 'column2', name: 'В процессе', tasks: [] },
          { id: 'column3', name: 'Готово', tasks: [] }
        ]
      })
    };
    
    // Добавляем ID рабочего пространства, если оно выбрано
    if (workspaceId) {
      boardData.workspaceId = workspaceId;
    }
    
    // Показываем индикатор загрузки в сайдбаре
    const boardList = document.getElementById('boardList');
    if (boardList) {
      const loadingHtml = '<div class="board-loading">Создание доски...</div>';
      boardList.innerHTML += loadingHtml;
    }
    
    console.log('Отправка запроса на создание доски:', boardData);
    
    // Отправляем запрос на создание доски
    const newBoard = await kanbanService.createBoard(boardData);
    console.log('Создана новая доска:', newBoard);
    
    // Обновляем все кэши
    // 1. Кэш в памяти
    if (boardsCache) {
      boardsCache.push(newBoard);
      lastBoardsFetchTime = Date.now();
    }
    
    // 2. Кэш в localStorage
    const cachedBoards = JSON.parse(localStorage.getItem('kanban_boards_cache') || '[]');
    cachedBoards.push(newBoard);
    localStorage.setItem('kanban_boards_cache', JSON.stringify(cachedBoards));
    console.log('Кэш досок обновлен, текущее количество досок:', cachedBoards.length);
    
    // Перенаправляем на созданную доску
    if (typeof onBoardSelect === 'function') {
      console.log('Вызываем коллбэк с ID новой доски:', newBoard.id);
      // Вызываем коллбэк с ID новой доски
      onBoardSelect(newBoard.id);
    } else {
      console.log('Коллбэк не предоставлен, выполняем перенаправление вручную на:', `/dashboard?board=${newBoard.id}`);
      // Если коллбэк не предоставлен, выполняем перенаправление вручную
      // Сохраняем ID рабочего пространства при переходе к доске
      if (workspaceId) {
        window.location.hash = `/dashboard?board=${newBoard.id}&workspace=${workspaceId}`;
      } else {
        window.location.hash = `/dashboard?board=${newBoard.id}`;
      }
    }
  } catch (error) {
    console.error('Ошибка при создании доски:', error);
    
    // Удаляем индикатор загрузки, если он есть
    const loadingElement = document.querySelector('.board-loading');
    if (loadingElement) {
      loadingElement.remove();
    }
    
    alert('Не удалось создать доску: ' + (error.message || 'Неизвестная ошибка'));
  }
} 