import { workspaceService } from '../services/workspace-service.js';
import { notificationService } from '../services/notification-service.js';

// Типы вкладок рабочих пространств
export const WORKSPACE_TABS = {
  ALL: 'all',
  MY: 'my',
  SHARED: 'shared'
};

// Функция для форматирования даты
function formatDate(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Кэширование для рабочих пространств
const workspaceCache = {
  data: {},
  timestamp: {},
  CACHE_TIMEOUT: 30 * 1000, // 30 секунд - время жизни кэша
  
  // Получить данные из кэша
  get(workspaceId) {
    const cacheEntry = this.data[workspaceId];
    const cacheTime = this.timestamp[workspaceId] || 0;
    const now = Date.now();
    
    // Проверяем, не истек ли срок кэша
    if (cacheEntry && now - cacheTime < this.CACHE_TIMEOUT) {
      console.log(`Используем кэшированные данные для рабочего пространства ${workspaceId}`);
      return cacheEntry;
    }
    
    return null;
  },
  
  // Сохранить данные в кэш
  set(workspaceId, data) {
    this.data[workspaceId] = data;
    this.timestamp[workspaceId] = Date.now();
    console.log(`Данные рабочего пространства ${workspaceId} сохранены в кэш`);
  },
  
  // Очистить кэш для конкретного рабочего пространства
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
  }
};

// Кэширование для досок рабочего пространства
const boardsCache = {
  data: {},
  timestamp: {},
  CACHE_TIMEOUT: 30 * 1000, // 30 секунд - время жизни кэша
  
  // Получить данные из кэша
  get(workspaceId) {
    const cacheEntry = this.data[workspaceId];
    const cacheTime = this.timestamp[workspaceId] || 0;
    const now = Date.now();
    
    // Проверяем, не истек ли срок кэша
    if (cacheEntry && now - cacheTime < this.CACHE_TIMEOUT) {
      console.log(`Используем кэшированные доски для рабочего пространства ${workspaceId}`);
      return cacheEntry;
    }
    
    return null;
  },
  
  // Сохранить данные в кэш
  set(workspaceId, data) {
    this.data[workspaceId] = data;
    this.timestamp[workspaceId] = Date.now();
    console.log(`Доски рабочего пространства ${workspaceId} сохранены в кэш`);
  },
  
  // Очистить кэш для конкретного рабочего пространства
  clear(workspaceId) {
    if (workspaceId) {
      delete this.data[workspaceId];
      delete this.timestamp[workspaceId];
      console.log(`Кэш досок для рабочего пространства ${workspaceId} очищен`);
    } else {
      this.data = {};
      this.timestamp = {};
      console.log("Весь кэш досок очищен");
    }
  }
};

// Функция для отображения контента рабочего пространства
export async function renderWorkspaceContent(tabType) {
  let contentHtml = '';
  
  try {
    let workspaces = [];
    let invitations = [];
    
    // Проверяем наличие активных приглашений
    try {
      invitations = await notificationService.getWorkspaceInvitations() || [];
      console.log('Получены приглашения:', invitations.length);
    } catch (invitationError) {
      console.error('Ошибка при получении приглашений:', invitationError);
      invitations = [];
    }
    
    const hasInvitations = invitations && invitations.length > 0;
    const invitationsHtml = hasInvitations ? renderInvitationsList(invitations) : '';
    
    // Получаем данные в зависимости от выбранной вкладки
    try {
      switch (tabType) {
        case WORKSPACE_TABS.ALL:
          workspaces = await workspaceService.getAllWorkspaces() || [];
          console.log('Получены все рабочие пространства:', workspaces.length);
          contentHtml = `
            <div class="workspace-content">
              <h2>Все рабочие пространства</h2>
              <p>Доступные вам рабочие пространства</p>
              ${hasInvitations ? invitationsHtml : ''}
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
          workspaces = await workspaceService.getAllWorkspaces() || [];
          console.log('Получены рабочие пространства для фильтрации:', workspaces.length);
          console.log('Данные рабочих пространств (МОИ):', JSON.stringify(workspaces));
          
          // Фильтруем только те, где пользователь является владельцем
          const myWorkspaces = Array.isArray(workspaces) ? workspaces.filter(ws => {
            if (!ws) return false;
            return ws.owner === true || ws.owner === 'true' || ws.owner == true;
          }) : [];
          
          console.log('Отфильтрованы мои рабочие пространства:', myWorkspaces.length);
          
          contentHtml = `
            <div class="workspace-content">
              <h2>Мои рабочие пространства</h2>
              <p>Рабочие пространства, созданные вами</p>
              ${hasInvitations ? invitationsHtml : ''}
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
          workspaces = await workspaceService.getAllWorkspaces() || [];
          console.log('Получены рабочие пространства для фильтрации:', workspaces.length);
          console.log('Данные рабочих пространств (СОВМЕСТНЫЕ):', JSON.stringify(workspaces));
          
          // Фильтруем только те, где пользователь не является владельцем
          const sharedWorkspaces = Array.isArray(workspaces) ? workspaces.filter(ws => {
            if (!ws) return false;
            return ws.owner === false || ws.owner === 'false' || ws.owner == false;
          }) : [];
          
          console.log('Отфильтрованы совместные рабочие пространства:', sharedWorkspaces.length);
          
          contentHtml = `
            <div class="workspace-content">
              <h2>Совместные рабочие пространства</h2>
              <p>Рабочие пространства, к которым вам предоставили доступ</p>
              ${hasInvitations ? invitationsHtml : ''}
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
              ${hasInvitations ? invitationsHtml : ''}
            </div>
          `;
      }
    } catch (workspacesError) {
      console.error('Ошибка при получении рабочих пространств:', workspacesError);
      contentHtml = renderErrorContent(workspacesError, tabType, hasInvitations, invitationsHtml);
    }
    
    return contentHtml;
  } catch (error) {
    console.error('Ошибка при отображении контента рабочего пространства:', error);
    return renderGlobalErrorContent(error);
  }
}

// Отображение списка приглашений
function renderInvitationsList(invitations) {
  return `
    <div class="workspace-invitations">
      <h3>Приглашения</h3>
      ${invitations.map(inv => `
        <div class="invitation-item">
          <div class="invitation-info">
            <div class="invitation-workspace">${inv.workspaceName || 'Рабочее пространство'}</div>
            <div class="invitation-role">Роль: ${inv.role || 'Участник'}</div>
            <div class="invitation-from">От: ${inv.inviterName || 'Пользователь'}</div>
          </div>
          <div class="invitation-actions">
            <button class="btn-primary accept-invitation-btn" data-invitation-id="${inv.id}">Принять</button>
            <button class="btn-secondary decline-invitation-btn" data-invitation-id="${inv.id}">Отклонить</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// Отображение сообщения об ошибке
function renderErrorContent(error, tabType, hasInvitations, invitationsHtml) {
  return `
    <div class="workspace-content">
      <h2>${tabType === WORKSPACE_TABS.ALL ? 'Все рабочие пространства' : 
             tabType === WORKSPACE_TABS.MY ? 'Мои рабочие пространства' : 
             'Совместные рабочие пространства'}</h2>
      <p>Произошла ошибка при загрузке данных</p>
      ${hasInvitations ? invitationsHtml : ''}
      <div class="workspace-header-actions">
        <button class="btn-primary create-workspace-btn">
          <span>+</span> Создать рабочее пространство
        </button>
      </div>
      <div class="workspace-error">
        <p>${error.message || 'Ошибка при загрузке рабочих пространств'}</p>
        <button class="btn-secondary" onclick="window.location.reload()">Обновить</button>
      </div>
    </div>
  `;
}

// Отображение глобального сообщения об ошибке
function renderGlobalErrorContent(error) {
  return `
    <div class="workspace-error">
      <h3>Ошибка при загрузке данных</h3>
      <p>${error.message || 'Неизвестная ошибка'}</p>
      <button class="btn-secondary" onclick="window.location.reload()">Обновить</button>
    </div>
  `;
}

// Функция для отображения списка рабочих пространств
export function renderWorkspaceList(workspaces) {
  if (!workspaces || !Array.isArray(workspaces) || workspaces.length === 0) {
    return `<div class="workspace-empty">Нет доступных рабочих пространств</div>`;
  }
  
  return workspaces.map(workspace => `
    <div class="workspace-item" data-workspace-id="${workspace.id}">
      <h3>${workspace.name || 'Без названия'}</h3>
      <p>${workspace.description || 'Нет описания'}</p>
      <div class="workspace-item-footer">
        <span class="workspace-members-count">👥 ${workspace.membersCount || 1}</span>
        <span class="workspace-created">${formatDate(workspace.createdAt)}</span>
      </div>
    </div>
  `).join('');
}

// Функция для настройки обработчиков событий контента рабочих пространств
export function setupWorkspaceContentEventListeners(navigateCallback) {
  // Обработчик для создания нового рабочего пространства
  document.querySelectorAll('.create-workspace-btn').forEach(btn => {
    btn.addEventListener('click', createNewWorkspace);
  });
  
  // Обработчик для выбора рабочего пространства
  document.querySelectorAll('.workspace-item').forEach(item => {
    item.addEventListener('click', () => {
      const workspaceId = item.getAttribute('data-workspace-id');
      if (typeof navigateCallback === 'function') {
        navigateCallback(workspaceId);
      } else {
        navigateToWorkspace(workspaceId);
      }
    });
  });
  
  // Добавляем обработчики для кнопок принятия/отклонения приглашений
  document.querySelectorAll('.accept-invitation-btn').forEach(button => {
    button.addEventListener('click', async function() {
      const invitationId = this.dataset.invitationId;
      try {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Принятие...';
        await acceptInvitation(invitationId);
        // Обновляем контент после принятия приглашения
        if (navigateCallback) {
          navigateCallback();
        }
      } catch (error) {
        console.error('Ошибка при принятии приглашения:', error);
        alert(`Ошибка при принятии приглашения: ${error.message}`);
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-check"></i> Принять';
      }
    });
  });
  
  document.querySelectorAll('.decline-invitation-btn').forEach(button => {
    button.addEventListener('click', async function() {
      const invitationId = this.dataset.invitationId;
      try {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отклонение...';
        await declineInvitation(invitationId);
        // Обновляем контент после отклонения приглашения
        if (navigateCallback) {
          navigateCallback();
        }
      } catch (error) {
        console.error('Ошибка при отклонении приглашения:', error);
        alert(`Ошибка при отклонении приглашения: ${error.message}`);
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-times"></i> Отклонить';
      }
    });
  });
}

// Функция для создания нового рабочего пространства
export async function createNewWorkspace() {
  const name = prompt('Введите название нового рабочего пространства:');
  if (!name || name.trim() === '') return;
  
  const description = prompt('Введите описание рабочего пространства (необязательно):');
  
  try {
    const workspaceData = {
      name: name.trim(),
      description: description ? description.trim() : ''
    };
    
    const newWorkspace = await workspaceService.createWorkspace(workspaceData);
    navigateToWorkspace(newWorkspace.id);
  } catch (error) {
    console.error('Ошибка при создании рабочего пространства:', error);
    alert(`Не удалось создать рабочее пространство: ${error.message || 'Неизвестная ошибка'}`);
  }
}

// Функция для перехода к рабочему пространству
export function navigateToWorkspace(workspaceId) {
  window.location.hash = `/dashboard?workspace=${workspaceId}`;
}

// Функция для принятия приглашения
export async function acceptInvitation(invitationId) {
  try {
    await notificationService.acceptWorkspaceInvitation(invitationId);
    return true;
  } catch (error) {
    console.error(`Ошибка при принятии приглашения ${invitationId}:`, error);
    throw error;
  }
}

// Функция для отклонения приглашения
export async function declineInvitation(invitationId) {
  try {
    await notificationService.declineWorkspaceInvitation(invitationId);
    return true;
  } catch (error) {
    console.error(`Ошибка при отклонении приглашения ${invitationId}:`, error);
    throw error;
  }
}

// Функция для загрузки и отображения участников рабочего пространства
export async function loadWorkspaceMembers(workspaceId) {
  const membersContainer = document.getElementById('workspaceMembers');
  const boardsContainer = document.getElementById('workspaceBoards');
  
  if (!membersContainer) {
    console.error('Не найден контейнер для отображения участников: #workspaceMembers');
    return;
  }
  
  if (!boardsContainer) {
    console.error('Не найден контейнер для отображения досок: #workspaceBoards');
  }
  
  try {
    console.log(`Загрузка рабочего пространства ${workspaceId}...`);
    
    // Показываем индикатор загрузки
    membersContainer.innerHTML = '<div class="loader">Загрузка...</div>';
    if (boardsContainer) {
      boardsContainer.innerHTML = '<div class="loader">Загрузка...</div>';
    }
    
    // Пытаемся получить данные из кэша
    let workspace = workspaceCache.get(workspaceId);
    
    // Если данных нет в кэше, запрашиваем с сервера
    if (!workspace) {
      console.log(`Данные рабочего пространства ${workspaceId} не найдены в кэше, загружаем с сервера`);
      workspace = await workspaceService.getWorkspace(workspaceId);
      
      // Сохраняем в кэш, если данные получены успешно
      if (workspace) {
        workspaceCache.set(workspaceId, workspace);
      }
    }
    
    console.log('Полученные данные рабочего пространства:', workspace);
    
    if (!workspace) {
      console.error(`Не удалось загрузить рабочее пространство ${workspaceId}. Возможно, у вас нет доступа.`);
      membersContainer.innerHTML = `
        <div class="workspace-error">
          <p>Не удалось загрузить данные рабочего пространства. Возможно, у вас нет доступа.</p>
          <button class="btn-secondary" onclick="window.location.hash = '/dashboard'">Вернуться к списку</button>
        </div>
      `;
      
      // Сообщаем об ошибке в контейнер для досок
      if (boardsContainer) {
        boardsContainer.innerHTML = '';
      }
      return;
    }
    
    const members = workspace.members || [];
    console.log('Участники рабочего пространства:', members);
    
    // Проверяем структуру данных участников
    if (members.length > 0) {
      console.log('Первый участник:', members[0]);
      console.log('Ключи первого участника:', Object.keys(members[0]));
    }
    
    // Проверяем, что members это массив и содержит валидные объекты
    const validMembers = Array.isArray(members) ? members.filter(m => m && typeof m === 'object') : [];
    console.log(`Валидных участников: ${validMembers.length} из ${members.length}`);
    
    // Отображаем участников
    renderMembers(validMembers, workspace, membersContainer);
    
    // После загрузки участников, загружаем доски рабочего пространства
    await loadWorkspaceBoards(workspaceId);
    
    // Устанавливаем обработчики событий для деталей рабочего пространства
    setupWorkspaceDetailEventListeners(workspace);
  } catch (error) {
    console.error(`Ошибка при загрузке участников рабочего пространства ${workspaceId}:`, error);
    membersContainer.innerHTML = `
      <div class="workspace-error">
        <p>Ошибка при загрузке участников: ${error.message || 'Неизвестная ошибка'}</p>
        <button class="btn-secondary" onclick="window.location.reload()">Попробовать снова</button>
      </div>
    `;
    
    if (boardsContainer) {
      boardsContainer.innerHTML = `
        <div class="workspace-error">
          <p>Не удалось загрузить доски.</p>
        </div>
      `;
    }
  }
}

// Вспомогательная функция для отображения участников
function renderMembers(members, workspace, container) {
  if (!members || members.length === 0) {
    container.innerHTML = `<div class="workspace-empty">Нет участников</div>`;
    return;
  }
  
  console.log('Отображение участников:', members);
  
  const getRoleName = (role) => {
    switch (role) {
      case 'ADMIN': return 'Администратор';
      case 'MEMBER': return 'Участник';
      case 'VIEWER': return 'Наблюдатель';
      default: return role || 'Участник';
    }
  };
  
  const membersHtml = members.map(member => {
    // Получаем имя пользователя, используя fullName или id, если имя не задано
    const displayName = member.fullName || `Пользователь ${member.id}`;
    // Получаем первую букву имени для аватара
    const avatarChar = displayName.charAt(0).toUpperCase();
    // Форматируем роль для отображения
    const roleDisplay = getRoleName(member.role);
    
    return `
      <div class="workspace-member">
        <div class="member-avatar">${avatarChar}</div>
        <div class="member-info">
          <div class="member-name">${displayName}</div>
          <div class="member-role">${roleDisplay}</div>
        </div>
        ${workspace.owner && !member.isOwner ? `
          <button class="btn-danger remove-member-btn" data-user-id="${member.id}" data-user-name="${displayName}">
            ✕
          </button>
        ` : ''}
      </div>
    `;
  }).join('');
  
  container.innerHTML = membersHtml;
  
  // Добавляем обработчики для кнопок удаления участников
  if (workspace.owner) {
    document.querySelectorAll('.remove-member-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation(); // Предотвращаем всплытие события
        const userId = btn.getAttribute('data-user-id');
        const userName = btn.getAttribute('data-user-name');
        await removeMember(workspace.id, userId, userName);
      });
    });
  }
}

// Функция для загрузки и отображения досок рабочего пространства
export async function loadWorkspaceBoards(workspaceId) {
  const boardsContainer = document.getElementById('workspaceBoards');
  
  if (!boardsContainer) {
    console.error('Не найден контейнер для отображения досок: #workspaceBoards');
    return;
  }
  
  try {
    console.log(`Загрузка досок для рабочего пространства ${workspaceId}...`);
    
    // Получаем доски рабочего пространства
    const boards = await getWorkspaceBoards(workspaceId);
    console.log(`Получено ${boards ? boards.length : 0} досок для рабочего пространства ${workspaceId}`);
    
    if (!boards || boards.length === 0) {
      boardsContainer.innerHTML = `<div class="workspace-empty">Нет досок в этом рабочем пространстве</div>`;
      return;
    }
    
    renderBoards(boards, boardsContainer);
  } catch (error) {
    console.error(`Ошибка при загрузке досок рабочего пространства ${workspaceId}:`, error);
    boardsContainer.innerHTML = `
      <div class="workspace-error">
        <p>Ошибка при загрузке досок: ${error.message || 'Неизвестная ошибка'}</p>
        <button class="btn-secondary" onclick="loadWorkspaceBoards('${workspaceId}')">Попробовать снова</button>
      </div>
    `;
  }
}

// Вспомогательная функция для отображения досок
function renderBoards(boards, container) {
  const boardsHtml = boards.map(board => `
    <div class="workspace-board-item" data-board-id="${board.id}">
      <div class="board-icon">📋</div>
      <div class="board-info">
        <div class="board-name">${board.name}</div>
        <div class="board-created">${formatDate(board.createdAt)}</div>
      </div>
    </div>
  `).join('');
  
  container.innerHTML = boardsHtml;
  
  // Добавляем обработчики для выбора доски
  document.querySelectorAll('.workspace-board-item').forEach(boardItem => {
    boardItem.addEventListener('click', (e) => {
      e.stopPropagation(); // Предотвращаем всплытие события
      const boardId = boardItem.getAttribute('data-board-id');
      console.log(`Выбрана доска ${boardId} из списка досок рабочего пространства`);
      
      // Получаем текущий путь и параметры
      const currentHash = window.location.hash.substring(1);
      const urlParams = new URLSearchParams(currentHash.includes('?') ? currentHash.split('?')[1] : '');
      
      // Получаем ID текущей доски, если она выбрана
      const currentBoardId = urlParams.get('board');
      
      // Если выбрана та же самая доска, сначала очистим локальный кэш
      if (currentBoardId === boardId) {
        console.log(`Повторный выбор той же доски ${boardId}, очищаем кэши`);
        boardsCache.clear(); // Очищаем кэш досок
        
        // Также попробуем очистить кэш доски в localStorage
        try {
          const localStorageCache = JSON.parse(localStorage.getItem('kanban_boards_cache') || '[]');
          const updatedCache = localStorageCache.filter(board => board.id != boardId);
          localStorage.setItem('kanban_boards_cache', JSON.stringify(updatedCache));
          console.log(`Очищен кэш доски ${boardId} в localStorage`);
        } catch (error) {
          console.error('Ошибка при очистке кэша доски в localStorage:', error);
        }
      }
      
      navigateToBoard(boardId);
    });
  });
}

// Функция для получения досок рабочего пространства
export async function getWorkspaceBoards(workspaceId) {
  try {
    console.log(`Запрос досок для рабочего пространства ${workspaceId}...`);
    
    // Пытаемся получить данные из кэша
    let workspaceBoards = boardsCache.get(workspaceId);
    
    // Если данных нет в кэше, запрашиваем с сервера
    if (!workspaceBoards) {
      console.log(`Доски рабочего пространства ${workspaceId} не найдены в кэше, загружаем с сервера`);
      
      // Импортируем сервис для работы с досками
      const kanbanService = await import('../services/kanban-service.js').then(module => module.kanbanService);
      
      // Получаем все доски пользователя и фильтруем 
      const allBoards = await kanbanService.getBoards();
      console.log(`Получено всего ${allBoards ? allBoards.length : 0} досок пользователя`);
      
      // Фильтруем только те, которые принадлежат данному рабочему пространству
      workspaceBoards = allBoards.filter(board => board.workspaceId == workspaceId);
      console.log(`Отфильтровано ${workspaceBoards.length} досок для рабочего пространства ${workspaceId}`);
      
      // Сохраняем в кэш
      boardsCache.set(workspaceId, workspaceBoards);
    }
    
    return workspaceBoards;
  } catch (error) {
    console.error(`Ошибка при получении досок рабочего пространства ${workspaceId}:`, error);
    throw error;
  }
}

// Функция для перехода к доске
export function navigateToBoard(boardId) {
  // Сохраняем текущие параметры URL
  const currentHash = window.location.hash.substring(1);
  const urlParams = new URLSearchParams(currentHash.includes('?') ? currentHash.split('?')[1] : '');
  
  // Получаем ID текущего рабочего пространства
  const workspaceId = urlParams.get('workspace');
  const currentBoardId = urlParams.get('board');
  
  // Если пытаемся перейти на ту же самую доску, добавляем временный параметр
  // для принудительного обновления хэша и события hashchange
  const reloadParam = currentBoardId === boardId ? `&reload=${Date.now()}` : '';
  
  console.log(`Переход к доске ${boardId} из рабочего пространства ${workspaceId || 'не указано'}`);
  
  // Формируем новый URL, сохраняя ID рабочего пространства, если оно было выбрано
  if (workspaceId) {
    window.location.hash = `/dashboard?board=${boardId}&workspace=${workspaceId}${reloadParam}`;
  } else {
    window.location.hash = `/dashboard?board=${boardId}${reloadParam}`;
  }
}

// Функция для удаления участника из рабочего пространства
export async function removeMember(workspaceId, userId, userName) {
  if (!confirm(`Вы уверены, что хотите удалить пользователя ${userName} из рабочего пространства?`)) {
    return;
  }
  
  try {
    // Конвертируем userId в число, если это возможно
    const numericUserId = Number(userId) || userId;
    await workspaceService.removeMember(workspaceId, numericUserId);
    alert(`Пользователь ${userName} успешно удален из рабочего пространства.`);
    loadWorkspaceMembers(workspaceId); // Обновляем список участников
  } catch (error) {
    console.error(`Ошибка при удалении участника ${userId} из рабочего пространства ${workspaceId}:`, error);
    alert(`Не удалось удалить участника: ${error.message || 'Неизвестная ошибка'}`);
  }
}

// Установка обработчиков для детальной страницы рабочего пространства
export function setupWorkspaceDetailEventListeners(workspace) {
  console.log(`Установка обработчиков событий для рабочего пространства ${workspace.id}`);
  
  // Обработчик для кнопки редактирования
  const editBtn = document.querySelector('.workspace-edit-btn');
  if (editBtn) {
    console.log('Найдена кнопка редактирования рабочего пространства');
    editBtn.addEventListener('click', () => {
      console.log(`Нажата кнопка редактирования для рабочего пространства ${workspace.id}`);
      editWorkspace(workspace);
    });
  } else {
    console.warn('Кнопка редактирования рабочего пространства не найдена');
  }
  
  // Обработчик для кнопки приглашения
  const inviteBtn = document.querySelector('.workspace-invite-btn');
  if (inviteBtn) {
    console.log('Найдена кнопка приглашения пользователя');
    inviteBtn.addEventListener('click', () => {
      console.log(`Нажата кнопка приглашения для рабочего пространства ${workspace.id}`);
      inviteUserToWorkspace(workspace.id);
    });
  } else {
    console.warn('Кнопка приглашения пользователя не найдена');
  }
  
  // Обработчик для кнопки добавления доски
  const addBoardBtn = document.querySelector('.workspace-add-board-btn');
  if (addBoardBtn) {
    console.log('Найдена кнопка добавления доски');
    addBoardBtn.addEventListener('click', () => {
      console.log(`Нажата кнопка добавления доски для рабочего пространства ${workspace.id}`);
      addBoardToWorkspace(workspace.id);
    });
  } else {
    console.warn('Кнопка добавления доски не найдена');
  }
}

// Функция для редактирования рабочего пространства
export async function editWorkspace(workspace) {
  const name = prompt('Введите новое название рабочего пространства:', workspace.name);
  if (!name || name.trim() === '') return;
  
  const description = prompt('Введите новое описание рабочего пространства:', workspace.description || '');
  
  try {
    const workspaceData = {
      name: name.trim(),
      description: description ? description.trim() : ''
    };
    
    // Обновляем данные на сервере
    const updatedWorkspace = await workspaceService.updateWorkspace(workspace.id, workspaceData);
    
    // Очищаем кэш для обновленного рабочего пространства
    workspaceCache.clear(workspace.id);
    
    // Если обновление прошло успешно и вернулись новые данные
    if (updatedWorkspace) {
      // Сохраняем обновленные данные в кэш
      workspaceCache.set(workspace.id, updatedWorkspace);
      
      // Обновляем только нужные элементы на странице
      const workspaceNameElem = document.querySelector('.workspace-detail-header h2');
      const workspaceDescElem = document.querySelector('.workspace-detail-header p');
      
      if (workspaceNameElem) {
        workspaceNameElem.textContent = updatedWorkspace.name;
      }
      
      if (workspaceDescElem) {
        workspaceDescElem.textContent = updatedWorkspace.description || 'Нет описания';
      }
      
      console.log('Рабочее пространство успешно обновлено без перезагрузки страницы');
    } else {
      // Если нет данных, просто перезагружаем страницу
      window.location.reload();
    }
  } catch (error) {
    console.error(`Ошибка при обновлении рабочего пространства ${workspace.id}:`, error);
    alert(`Не удалось обновить рабочее пространство: ${error.message || 'Неизвестная ошибка'}`);
  }
}

// Функция для приглашения пользователя в рабочее пространство
export async function inviteUserToWorkspace(workspaceId) {
  const email = prompt('Введите email пользователя для приглашения:');
  if (!email || email.trim() === '') return;
  
  let role = 'MEMBER'; // По умолчанию обычный участник
  
  // Предложим выбрать роль
  const roleChoice = prompt('Выберите роль (введите число):\n1 - Администратор\n2 - Участник\n3 - Наблюдатель', '2');
  
  switch(roleChoice) {
    case '1':
      role = 'ADMIN';
      break;
    case '2':
      role = 'MEMBER';
      break;
    case '3':
      role = 'VIEWER';
      break;
    default:
      role = 'MEMBER';
  }
  
  try {
    const userData = {
      email: email.trim(),
      role: role
    };
    
    await workspaceService.inviteUser(workspaceId, userData);
    alert(`Приглашение отправлено на email ${email.trim()}`);
  } catch (error) {
    console.error(`Ошибка при приглашении пользователя в рабочее пространство ${workspaceId}:`, error);
    alert(`Не удалось отправить приглашение: ${error.message || 'Неизвестная ошибка'}`);
  }
}

// Функция для добавления доски в рабочее пространство
export async function addBoardToWorkspace(workspaceId) {
  const boardName = prompt('Введите название новой доски:');
  if (!boardName || boardName.trim() === '') return;
  
  try {
    const boardData = {
      name: boardName.trim(),
      workspaceId: workspaceId,
      boardData: JSON.stringify({
        columns: [
          { id: 'column1', name: 'К выполнению', tasks: [] },
          { id: 'column2', name: 'В процессе', tasks: [] },
          { id: 'column3', name: 'Готово', tasks: [] }
        ]
      })
    };
    
    const kanbanService = await import('../services/kanban-service.js').then(module => module.kanbanService);
    const newBoard = await kanbanService.createBoard(boardData);
    
    // Очищаем кэш досок для этого рабочего пространства
    boardsCache.clear(workspaceId);
    
    // После создания доски обновляем список досок в интерфейсе
    await loadWorkspaceBoards(workspaceId);
    
    // Спрашиваем пользователя, хочет ли он сразу перейти к новой доске
    if (confirm(`Доска "${boardName}" успешно создана! Перейти к новой доске?`)) {
      // Используем обновленную функцию навигации для перехода, сохраняя ID рабочего пространства
      window.location.hash = `/dashboard?board=${newBoard.id}&workspace=${workspaceId}`;
    }
  } catch (error) {
    console.error('Ошибка при создании доски:', error);
    alert(`Не удалось создать доску: ${error.message || 'Неизвестная ошибка'}`);
  }
} 