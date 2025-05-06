import { kanbanService } from '../services/kanban-service.js';
// Импортируем ссылку на кэш досок из DashboardSidebar
import { getBoardsCache, updateBoardsCache } from './DashboardSidebar.js';

// Переменная для хранения таймера автосохранения
let saveTimer = null;
// Время задержки перед сохранением (15 секунд)
const SAVE_DELAY = 15000;
// Текущие данные доски
let currentBoardData = null;
// Флаг, указывающий, были ли внесены изменения
let boardChanged = false;

// Компонент для отображения канбан-доски
export async function renderKanbanBoard(boardId, preloadedBoardData = null) {
  let board = preloadedBoardData; // Используем предзагруженные данные, если они есть
  
  console.log('Рендеринг канбан-доски с ID:', boardId);
  if (preloadedBoardData) {
    console.log('Используем предзагруженные данные для доски:', preloadedBoardData.id);
  }
  
  // Если данные доски не переданы, проверяем в кэше
  if (!board) {
    // Проверяем наличие доски в кэше памяти
    const boardsMemoryCache = getBoardsCache();
    if (boardsMemoryCache) {
      const cachedBoard = boardsMemoryCache.find(b => b.id == boardId);
      if (cachedBoard) {
        console.log(`Найдена доска с ID ${boardId} в кэше памяти`);
        board = cachedBoard;
      }
    }
    
    // Если доски нет в кэше памяти, проверяем localStorage
    if (!board) {
      const localStorageCache = JSON.parse(localStorage.getItem('kanban_boards_cache') || '[]');
      const cachedBoard = localStorageCache.find(b => b.id == boardId);
      if (cachedBoard) {
        console.log(`Найдена доска с ID ${boardId} в localStorage`);
        board = cachedBoard;
      }
    }
    
    // Если доски нет в кэше или нет несохраненных изменений, загружаем с сервера
    if (!board || !board._hasUnsavedChanges) {
      try {
        console.log(`Загрузка данных доски с ID ${boardId} с сервера...`);
        // Получаем данные о доске с сервера
        const serverBoard = await kanbanService.getBoard(boardId);
        
        // Если у нас есть кэшированная доска с несохраненными изменениями, 
        // используем ее, иначе используем доску с сервера
        if (board && board._hasUnsavedChanges) {
          console.log('Обнаружены несохраненные изменения, используем кэшированную версию');
        } else {
          board = serverBoard;
          console.log('Используем данные с сервера');
          
          // Обновляем кэш в памяти сразу после получения данных с сервера
          const boardsCache = getBoardsCache();
          if (boardsCache) {
            const boardIndex = boardsCache.findIndex(b => b.id == boardId);
            if (boardIndex !== -1) {
              boardsCache[boardIndex] = { ...board };
            } else {
              boardsCache.push({ ...board });
            }
            updateBoardsCache(boardsCache);
            console.log('Обновлен кэш в памяти после загрузки с сервера');
          }
          
          // Обновляем кэш в localStorage
          const localStorageCache = JSON.parse(localStorage.getItem('kanban_boards_cache') || '[]');
          const boardIndex = localStorageCache.findIndex(b => b.id == boardId);
          if (boardIndex !== -1) {
            localStorageCache[boardIndex] = { ...board };
          } else {
            localStorageCache.push({ ...board });
          }
          localStorage.setItem('kanban_boards_cache', JSON.stringify(localStorageCache));
          console.log('Обновлен кэш в localStorage после загрузки с сервера');
        }
      } catch (error) {
        console.error(`Ошибка при загрузке доски с ID ${boardId}:`, error);
        
        // Если есть кэшированные данные, используем их, даже если нет флага несохраненных изменений
        if (board) {
          console.log('Используем кэшированные данные из-за ошибки сервера');
        } else {
          return `
            <div class="board-container">
              <div class="board-header">
                <h1 class="board-title">Ошибка загрузки</h1>
              </div>
              <p>Не удалось загрузить доску: ${error.message || 'Неизвестная ошибка'}</p>
            </div>
          `;
        }
      }
    } else {
      console.log(`Используем кэшированные данные для доски с ID ${boardId} с несохраненными изменениями`);
    }
  } else {
    console.log(`Используем предзагруженные данные для доски с ID ${boardId}`);
  }
  
  // Если доска не найдена, показываем заглушку
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
  
  // Проверка наличия несохраненных изменений в загруженной доске
  if (board._hasUnsavedChanges) {
    boardChanged = true;
    
    // Отображаем статус несохраненных изменений после рендеринга доски
    setTimeout(() => {
      const saveStatus = document.getElementById('saveStatus');
      if (saveStatus) {
        saveStatus.textContent = 'Изменения не сохранены...';
        saveStatus.classList.add('unsaved');
      }
    }, 0);
  } else {
    boardChanged = false;
  }
  
  // Сохраняем текущие данные доски
  currentBoardData = board;
  
  // Парсим данные доски из JSON
  let boardColumnsData = [];
  try {
    const parsedData = JSON.parse(board.boardData);
    boardColumnsData = parsedData.columns || [];
  } catch (error) {
    console.error('Ошибка при парсинге данных доски:', error);
    boardColumnsData = [];
  }
  
  // Генерируем HTML для колонок
  const columnsHtml = boardColumnsData.map((column, index) => {
    // Генерируем HTML для карточек в колонке
    const cardsHtml = column.tasks.map(task => `
      <div class="kanban-card" draggable="true" data-task-id="${task.id}">
        <div class="card-content">
          <div class="card-title">${task.title}</div>
          ${task.description ? `<div class="card-description">${task.description}</div>` : ''}
        </div>
        <div class="card-actions">
          <button class="card-edit-btn" data-task-id="${task.id}">✏️</button>
          <button class="card-delete-btn" data-task-id="${task.id}">🗑️</button>
        </div>
      </div>
    `).join('');
    
    return `
      <div class="kanban-column" data-column-id="${column.id}">
        <div class="column-header">
          <div class="column-title-container">
            <h3 class="column-title" data-column-id="${column.id}">${column.name}</h3>
          </div>
          <div class="column-actions">
            <button class="column-delete-btn" data-column-id="${column.id}">🗑️</button>
          </div>
        </div>
        <div class="column-cards" data-column-id="${column.id}">
          ${cardsHtml}
        </div>
        <div class="column-footer">
          <button class="add-card-btn" data-column-id="${column.id}">+ Добавить карточку</button>
        </div>
      </div>
    `;
  }).join('');
  
  // Рендерим доску
  return `
    <div class="board-container">
      <div class="board-header">
        <h1 class="board-title">${board.name}</h1>
        <div class="board-actions">
          <div id="saveStatus" class="save-status">Все изменения сохранены</div>
          <button class="btn-secondary" id="editBoardButton">Редактировать</button>
          <button class="btn-danger" id="deleteBoardButton">Удалить</button>
        </div>
      </div>
      
      <div class="kanban-board" id="kanbanBoard" data-board-id="${boardId}">
        ${columnsHtml}
        <div class="add-column-container">
          <button class="add-column-btn" id="addColumnBtn">+ Добавить колонку</button>
        </div>
      </div>
    </div>
  `;
}

// Функция для установки обработчиков событий канбан-доски
export function setupBoardEventListeners(boardId, onBoardDeleted) {
  // Обработчик для кнопки редактирования доски
  const editBoardButton = document.getElementById('editBoardButton');
  if (editBoardButton) {
    editBoardButton.addEventListener('click', () => {
      editBoard(boardId);
    });
  }
  
  // Обработчик для кнопки удаления доски
  const deleteBoardButton = document.getElementById('deleteBoardButton');
  if (deleteBoardButton) {
    deleteBoardButton.addEventListener('click', () => {
      deleteBoard(boardId, onBoardDeleted);
    });
  }
  
  // Обработчик для кнопки добавления колонки
  const addColumnBtn = document.getElementById('addColumnBtn');
  if (addColumnBtn) {
    addColumnBtn.addEventListener('click', () => {
      addNewColumn();
    });
  }
  
  // Обработчики для кнопок добавления карточек
  const addCardBtns = document.querySelectorAll('.add-card-btn');
  addCardBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const columnId = e.target.getAttribute('data-column-id');
      addNewCard(columnId);
    });
  });
  
  // Обработчики для заголовков колонок (инлайн-редактирование)
  const columnTitles = document.querySelectorAll('.column-title-container');
  columnTitles.forEach(titleContainer => {
    titleContainer.addEventListener('click', (e) => {
      // Находим элемент заголовка внутри контейнера
      const titleElement = titleContainer.querySelector('.column-title');
      if (titleElement) {
        const columnId = titleElement.getAttribute('data-column-id');
        startEditColumnTitle(titleElement, columnId);
      }
    });
  });
  
  // Обработчики для кнопок удаления колонок
  const columnDeleteBtns = document.querySelectorAll('.column-delete-btn');
  columnDeleteBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const columnId = e.target.getAttribute('data-column-id');
      deleteColumn(columnId);
    });
  });
  
  // Обработчики для кнопок редактирования карточек
  const cardEditBtns = document.querySelectorAll('.card-edit-btn');
  cardEditBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // Останавливаем всплытие события
      const taskId = e.target.getAttribute('data-task-id');
      editCard(taskId);
    });
  });
  
  // Обработчики для кнопок удаления карточек
  const cardDeleteBtns = document.querySelectorAll('.card-delete-btn');
  cardDeleteBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // Останавливаем всплытие события
      const taskId = e.target.getAttribute('data-task-id');
      deleteCard(taskId);
    });
  });
  
  // Настройка drag and drop для карточек
  setupDragAndDrop();
  
  // Очищаем предыдущий слушатель beforeunload, если был установлен
  window.removeEventListener('beforeunload', handleBeforeUnload);
  
  // Добавляем слушатель для обработки несохраненных изменений при уходе со страницы
  window.addEventListener('beforeunload', handleBeforeUnload);
}

// Обработчик события beforeunload
function handleBeforeUnload(e) {
  if (boardChanged) {
    // Отображаем предупреждение пользователю
    const message = 'У вас есть несохраненные изменения. Вы уверены, что хотите покинуть страницу?';
    e.returnValue = message;
    forceSaveBoardData();
    return message;
  }
}

// Настройка перетаскивания карточек
function setupDragAndDrop() {
  const cards = document.querySelectorAll('.kanban-card');
  const dropZones = document.querySelectorAll('.column-cards');
  
  // Настраиваем перетаскивание для всех карточек
  cards.forEach(card => {
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
    // Добавляем новые обработчики для карточек
    card.addEventListener('dragover', handleDragOver);
    card.addEventListener('dragleave', handleDragLeave);
  });
  
  // Настраиваем зоны для бросания карточек
  dropZones.forEach(zone => {
    zone.addEventListener('dragover', handleDragOver);
    zone.addEventListener('dragenter', handleDragEnter);
    zone.addEventListener('dragleave', handleDragLeave);
    zone.addEventListener('drop', handleDrop);
  });
}

// Обработчики для drag and drop
function handleDragStart(e) {
  e.dataTransfer.setData('text/plain', e.target.getAttribute('data-task-id'));
  e.target.classList.add('dragging');
  // Записываем исходную колонку
  const sourceColumnId = e.target.closest('.column-cards').getAttribute('data-column-id');
  e.dataTransfer.setData('source-column', sourceColumnId);
}

function handleDragEnd(e) {
  e.target.classList.remove('dragging');
  
  // Удаляем все индикаторы после завершения перетаскивания
  document.querySelectorAll('.card-drop-indicator').forEach(el => el.remove());
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function handleDragOver(e) {
  e.preventDefault(); // Разрешаем drop
  
  // Находим ближайшую карточку и колонку
  const cardElement = e.target.closest('.kanban-card');
  const columnElement = e.target.closest('.column-cards');
  
  // Проверяем, не является ли целевой элемент индикатором
  const isDropIndicator = e.target.classList.contains('card-drop-indicator');
  if (isDropIndicator) {
    // Если мы находимся над индикатором, ничего не делаем
    return;
  }
  
  // Находим текущий индикатор, если он есть
  const existingIndicator = columnElement.querySelector('.card-drop-indicator');
  
  // Если мы не над карточкой и не в пустой колонке, ничего не делаем
  if (!cardElement && existingIndicator) {
    return;
  }
  
  // Удаляем все существующие индикаторы
  document.querySelectorAll('.card-drop-indicator').forEach(el => el.remove());
  document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
    el.classList.remove('drag-over-top', 'drag-over-bottom');
  });
  
  // Всегда добавляем класс drag-over к колонке при перетаскивании над любым элементом в колонке
  if (columnElement) {
    columnElement.classList.add('drag-over');
  }
  
  if (!cardElement) {
    // Если мы находимся над пустой областью колонки, только подсвечиваем колонку
    return;
  }
  
  // Проверяем, не является ли эта карточка перетаскиваемой
  if (cardElement.classList.contains('dragging')) {
    return;
  }
  
  // Находим положение курсора относительно карточки
  const rect = cardElement.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const isBottomHalf = y > rect.height / 2;
  
  // Создаем индикатор вместо подсветки границ
  const indicator = document.createElement('div');
  indicator.className = 'card-drop-indicator';
  
  if (isBottomHalf) {
    // Размещаем индикатор снизу карточки
    cardElement.after(indicator);
  } else {
    // Размещаем индикатор сверху карточки
    cardElement.before(indicator);
  }
}

function handleDragEnter(e) {
  e.preventDefault();
  // Добавляем класс только для колонки независимо от того, над чем находится курсор
  const columnElement = e.target.closest('.column-cards');
  if (columnElement) {
    columnElement.classList.add('drag-over');
  }
}

function handleDragLeave(e) {
  // Удаляем класс у колонки только если покидаем саму колонку, а не элементы внутри неё
  // Проверяем, что relatedTarget (элемент, на который переходим) не содержится в текущей колонке
  const columnElement = e.currentTarget;
  const relatedTarget = e.relatedTarget;
  
  if (!columnElement.contains(relatedTarget)) {
    columnElement.classList.remove('drag-over');
  }
  
  // При уходе с карточки необязательно удалять индикатор - это будет сделано при следующем dragover
}

function handleDrop(e) {
  e.preventDefault();
  
  // Очищаем все индикаторы перетаскивания
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  
  // Получаем данные перетаскивания
  const taskId = e.dataTransfer.getData('text/plain');
  const sourceColumnId = e.dataTransfer.getData('source-column');
  const targetColumnId = e.currentTarget.getAttribute('data-column-id');
  
  // Находим карточку, которую перетаскиваем
  const draggedCard = document.querySelector(`.kanban-card[data-task-id="${taskId}"]`);
  if (!draggedCard) return;
  
  // Найдем индикатор вставки
  const dropIndicator = document.querySelector('.card-drop-indicator');
  
  // Находим целевую карточку (если она есть)
  const cardElement = e.target.closest('.kanban-card');
  
  // Определяем, перемещение между колонками или внутри колонки
  if (sourceColumnId !== targetColumnId) {
    if (dropIndicator) {
      // Вставляем карточку на место индикатора
      dropIndicator.parentNode.insertBefore(draggedCard, dropIndicator);
    } else if (cardElement && cardElement !== draggedCard) {
      // Если нет индикатора, но есть карточка (для обратной совместимости)
      const rect = cardElement.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const isBottomHalf = y > rect.height / 2;
      
      if (isBottomHalf) {
        cardElement.after(draggedCard);
      } else {
        cardElement.before(draggedCard);
      }
    } else {
      // Если ни индикатора, ни карточки нет, добавляем в конец колонки
      e.currentTarget.appendChild(draggedCard);
    }
    // Обновляем данные доски для перемещения между колонками
    moveCardBetweenColumns(taskId, sourceColumnId, targetColumnId);
    // Обновляем порядок карточек в целевой колонке
    updateCardOrderInColumn(targetColumnId);
  } else {
    // Перемещение внутри колонки
    if (dropIndicator) {
      // Вставляем карточку на место индикатора
      dropIndicator.parentNode.insertBefore(draggedCard, dropIndicator);
    } else if (cardElement && cardElement !== draggedCard) {
      // Если нет индикатора, но есть карточка (для обратной совместимости)
      const rect = cardElement.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const isBottomHalf = y > rect.height / 2;
      
      if (isBottomHalf) {
        cardElement.after(draggedCard);
      } else {
        cardElement.before(draggedCard);
      }
    } else if (!cardElement || e.currentTarget.children.length === 0) {
      // Если колонка пуста или курсор не над карточкой, добавляем в конец колонки
      e.currentTarget.appendChild(draggedCard);
    }
    // Обновляем порядок карточек в данных
    updateCardOrderInColumn(sourceColumnId);
  }
  
  // Удаляем все индикаторы после вставки
  document.querySelectorAll('.card-drop-indicator').forEach(el => el.remove());
  
  // Восстанавливаем стили перетаскиваемой карточки
  draggedCard.classList.remove('dragging');
}

// Функция для перемещения карточки между колонками
function moveCardBetweenColumns(taskId, sourceColumnId, targetColumnId) {
  try {
    // Получаем текущие данные доски
    const boardData = JSON.parse(currentBoardData.boardData);
    
    // Находим исходную и целевую колонки
    const sourceColumnIndex = boardData.columns.findIndex(col => col.id === sourceColumnId);
    const targetColumnIndex = boardData.columns.findIndex(col => col.id === targetColumnId);
    
    if (sourceColumnIndex === -1 || targetColumnIndex === -1) {
      console.error('Не удалось найти исходную или целевую колонку');
      return;
    }
    
    // Находим задачу в исходной колонке
    const taskIndex = boardData.columns[sourceColumnIndex].tasks.findIndex(task => task.id === taskId);
    if (taskIndex === -1) {
      console.error('Не удалось найти задачу в исходной колонке');
      return;
    }
    
    // Извлекаем задачу из исходной колонки
    const task = boardData.columns[sourceColumnIndex].tasks.splice(taskIndex, 1)[0];
    
    // Определяем порядок карточек из DOM для целевой колонки
    const targetColumnCards = document.querySelector(`.column-cards[data-column-id="${targetColumnId}"]`);
    const cardElements = targetColumnCards.querySelectorAll('.kanban-card');
    
    // Создаем новый массив задач в целевой колонке в правильном порядке
    const newTasks = [];
    let taskAdded = false;
    
    // Проходим по всем элементам DOM и создаем новый массив в правильном порядке
    cardElements.forEach(card => {
      const cardId = card.getAttribute('data-task-id');
      
      if (cardId === taskId) {
        // Это наша перемещенная карточка, её уже добавили в DOM,
        // но нужно добавить её данные в массив в правильном порядке
        taskAdded = true;
        newTasks.push(task);
      } else {
        // Это другая карточка, находим её данные и добавляем в массив
        const existingTask = boardData.columns[targetColumnIndex].tasks.find(t => t.id === cardId);
        if (existingTask) {
          newTasks.push(existingTask);
        }
      }
    });
    
    // Обновляем массив задач целевой колонки
    boardData.columns[targetColumnIndex].tasks = newTasks;
    
    // Обновляем данные доски
    updateBoardData(boardData);
  } catch (error) {
    console.error('Ошибка при перемещении карточки:', error);
  }
}

// Функция для обновления порядка карточек в колонке
function updateCardOrderInColumn(columnId) {
  try {
    // Получаем текущие данные доски
    const boardData = JSON.parse(currentBoardData.boardData);
    
    // Находим индекс колонки
    const columnIndex = boardData.columns.findIndex(col => col.id === columnId);
    if (columnIndex === -1) {
      console.error('Не удалось найти колонку');
      return;
    }
    
    // Получаем текущий порядок карточек из DOM
    const columnCards = document.querySelector(`.column-cards[data-column-id="${columnId}"]`);
    const cardElements = columnCards.querySelectorAll('.kanban-card');
    
    // Создаем новый массив задач в правильном порядке
    const newTasks = [];
    cardElements.forEach(card => {
      const taskId = card.getAttribute('data-task-id');
      const task = boardData.columns[columnIndex].tasks.find(t => t.id === taskId);
      if (task) {
        newTasks.push(task);
      }
    });
    
    // Обновляем порядок задач в данных
    boardData.columns[columnIndex].tasks = newTasks;
    
    // Обновляем данные доски
    updateBoardData(boardData);
    
    console.log('Порядок карточек обновлен в колонке:', columnId);
  } catch (error) {
    console.error('Ошибка при обновлении порядка карточек:', error);
  }
}

// Функция для редактирования доски
async function editBoard(boardId) {
  try {
    // Получаем текущие данные доски
    const board = await kanbanService.getBoard(boardId);
    
    // Запрашиваем новое название доски
    const newName = prompt('Введите новое название доски:', board.name);
    
    if (newName === null) return; // Пользователь отменил
    if (newName.trim() === '') {
      alert('Название доски не может быть пустым');
      return;
    }
    
    // Создаем объект для обновления
    const updateData = {
      name: newName,
      boardData: board.boardData
    };
    
    // Обновляем доску
    await kanbanService.updateBoard(boardId, updateData);
    
    // Обновляем страницу для отображения изменений
    window.location.reload();
  } catch (error) {
    console.error(`Ошибка при редактировании доски с ID ${boardId}:`, error);
    alert('Не удалось обновить доску: ' + (error.message || 'Неизвестная ошибка'));
  }
}

// Функция для удаления доски
async function deleteBoard(boardId, onBoardDeleted) {
  // Проверяем, есть ли несохраненные изменения
  if (boardChanged) {
    const saveFirst = window.confirm('Доска содержит несохраненные изменения. Сохранить перед удалением?');
    if (saveFirst) {
      await saveBoardData();
    }
  }
  
  // Запрашиваем подтверждение удаления
  const confirmed = window.confirm('Вы уверены, что хотите удалить эту доску? Это действие нельзя отменить.');
  
  if (!confirmed) return;
  
  try {
    console.log('Удаление доски с ID:', boardId);
    // Удаляем доску на сервере
    await kanbanService.deleteBoard(boardId);
    
    // Обновляем кэш досок в localStorage
    const cachedBoards = JSON.parse(localStorage.getItem('kanban_boards_cache') || '[]');
    const updatedCache = cachedBoards.filter(board => board.id != boardId);
    localStorage.setItem('kanban_boards_cache', JSON.stringify(updatedCache));
    console.log('Кэш досок в localStorage обновлен после удаления, осталось досок:', updatedCache.length);
    
    // Обновляем кэш в памяти
    const currentCache = getBoardsCache();
    if (currentCache) {
      const updatedMemoryCache = currentCache.filter(board => board.id != boardId);
      updateBoardsCache(updatedMemoryCache);
      console.log('Кэш досок в памяти обновлен после удаления');
    }
    
    // Вызываем коллбэк, если он предоставлен
    if (typeof onBoardDeleted === 'function') {
      console.log('Вызываем коллбэк после удаления доски');
      onBoardDeleted();
    } else {
      console.log('Коллбэк не предоставлен, перенаправляем на дашборд вручную');
      // Если коллбэк не предоставлен, выполняем перенаправление вручную
      window.location.hash = '/dashboard';
    }
  } catch (error) {
    console.error(`Ошибка при удалении доски с ID ${boardId}:`, error);
    alert('Не удалось удалить доску: ' + (error.message || 'Неизвестная ошибка'));
  }
}

// Функция для создания новой колонки
function addNewColumn() {
  // Запрашиваем название колонки
  const columnName = prompt('Введите название новой колонки:');
  if (!columnName || columnName.trim() === '') return;
  
  try {
    // Генерируем уникальный ID для колонки
    const columnId = 'column_' + Date.now();
    
    // Получаем текущие данные доски
    const boardData = JSON.parse(currentBoardData.boardData);
    
    // Добавляем новую колонку
    boardData.columns.push({
      id: columnId,
      name: columnName,
      tasks: []
    });
    
    // Обновляем данные доски
    updateBoardData(boardData);
    
    // Добавляем колонку в DOM без перезагрузки страницы
    const kanbanBoard = document.getElementById('kanbanBoard');
    const addColumnContainer = document.querySelector('.add-column-container');
    
    const newColumnHtml = `
      <div class="kanban-column" data-column-id="${columnId}">
        <div class="column-header">
          <div class="column-title-container">
            <h3 class="column-title" data-column-id="${columnId}">${columnName}</h3>
          </div>
          <div class="column-actions">
            <button class="column-delete-btn" data-column-id="${columnId}">🗑️</button>
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
    
    // Вставляем новую колонку перед кнопкой добавления
    const newColumn = document.createElement('div');
    newColumn.innerHTML = newColumnHtml;
    kanbanBoard.insertBefore(newColumn.firstElementChild, addColumnContainer);
    
    // Добавляем обработчики событий
    const newColumnElement = kanbanBoard.querySelector(`.kanban-column[data-column-id="${columnId}"]`);
    
    // Обработчик для кнопки добавления карточки
    const addCardBtn = newColumnElement.querySelector('.add-card-btn');
    addCardBtn.addEventListener('click', () => {
      addNewCard(columnId);
    });
    
    // Обработчик для заголовка колонки (инлайн-редактирование)
    const columnTitleContainer = newColumnElement.querySelector('.column-title-container');
    columnTitleContainer.addEventListener('click', (e) => {
      const titleElement = columnTitleContainer.querySelector('.column-title');
      if (titleElement) {
        startEditColumnTitle(titleElement, columnId);
      }
    });
    
    // Обработчики для кнопок удаления колонки
    const deleteColumnBtn = newColumnElement.querySelector('.column-delete-btn');
    deleteColumnBtn.addEventListener('click', () => {
      deleteColumn(columnId);
    });
    
    // Настраиваем drag and drop для новой колонки
    const dropZone = newColumnElement.querySelector('.column-cards');
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragenter', handleDragEnter);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
    
  } catch (error) {
    console.error('Ошибка при добавлении колонки:', error);
    alert('Не удалось добавить колонку: ' + error.message);
  }
}

// Функция для начала редактирования названия колонки
function startEditColumnTitle(titleElement, columnId) {
  // Получаем контейнер заголовка
  const titleContainer = titleElement.closest('.column-title-container');
  if (!titleContainer) return;
  
  // Сохраняем текущее название
  const currentName = titleElement.textContent;
  
  // Создаем поле ввода
  const inputElement = document.createElement('input');
  inputElement.type = 'text';
  inputElement.value = currentName;
  inputElement.className = 'column-title-edit';
  inputElement.setAttribute('data-column-id', columnId);
  
  // Очищаем контейнер и добавляем поле ввода
  titleContainer.innerHTML = '';
  titleContainer.appendChild(inputElement);
  
  // Фокусируемся на поле ввода и выделяем текст
  inputElement.focus();
  inputElement.select();
  
  // Обработчик для события клика вне поля ввода
  const handleClickOutside = (e) => {
    if (e.target !== inputElement) {
      finishEditColumnTitle(inputElement, titleContainer, columnId);
      document.removeEventListener('click', handleClickOutside);
    }
  };
  
  // Обработчик для нажатия Enter
  const handleEnterKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finishEditColumnTitle(inputElement, titleContainer, columnId);
      inputElement.removeEventListener('keydown', handleEnterKey);
    }
    // Закрытие по Escape с отменой редактирования
    if (e.key === 'Escape') {
      e.preventDefault();
      // Восстанавливаем исходное содержимое
      restoreColumnTitle(titleContainer, columnId, currentName);
      inputElement.removeEventListener('keydown', handleEnterKey);
      setTimeout(() => {
        document.removeEventListener('click', handleClickOutside);
      }, 10);
    }
  };
  
  // Добавляем обработчики
  setTimeout(() => {
    document.addEventListener('click', handleClickOutside);
  }, 10); // Небольшая задержка, чтобы предотвратить немедленное срабатывание
  
  inputElement.addEventListener('keydown', handleEnterKey);
}

// Функция для восстановления заголовка колонки
function restoreColumnTitle(titleContainer, columnId, title) {
  const h3 = document.createElement('h3');
  h3.className = 'column-title';
  h3.setAttribute('data-column-id', columnId);
  h3.textContent = title;
  
  titleContainer.innerHTML = '';
  titleContainer.appendChild(h3);
}

// Функция для завершения редактирования названия колонки
function finishEditColumnTitle(inputElement, titleContainer, columnId) {
  const newName = inputElement.value.trim();
  
  // Если название не пустое
  if (newName !== '') {
    // Получаем текущие данные доски
    try {
      const boardData = JSON.parse(currentBoardData.boardData);
      
      // Находим колонку для редактирования
      const columnIndex = boardData.columns.findIndex(column => column.id === columnId);
      if (columnIndex === -1) {
        console.error('Колонка не найдена');
        // Восстанавливаем исходное значение
        const defaultValue = inputElement.defaultValue || 'Колонка';
        restoreColumnTitle(titleContainer, columnId, defaultValue);
        return;
      }
      
      const currentName = boardData.columns[columnIndex].name;
      
      // Если название не изменилось, просто заменяем поле ввода на текст
      if (newName === currentName) {
        restoreColumnTitle(titleContainer, columnId, currentName);
        return;
      }
      
      // Обновляем название колонки
      boardData.columns[columnIndex].name = newName;
      
      // Обновляем данные доски
      updateBoardData(boardData);
      
      // Обновляем текст в DOM
      restoreColumnTitle(titleContainer, columnId, newName);
    } catch (error) {
      console.error('Ошибка при редактировании колонки:', error);
      alert('Не удалось отредактировать колонку: ' + error.message);
      
      // Восстанавливаем исходное название в случае ошибки
      const boardData = JSON.parse(currentBoardData.boardData);
      const columnIndex = boardData.columns.findIndex(column => column.id === columnId);
      if (columnIndex !== -1) {
        restoreColumnTitle(titleContainer, columnId, boardData.columns[columnIndex].name);
      } else {
        const defaultValue = inputElement.defaultValue || 'Колонка';
        restoreColumnTitle(titleContainer, columnId, defaultValue);
      }
    }
  } else {
    // Если название пустое, восстанавливаем исходное значение
    const boardData = JSON.parse(currentBoardData.boardData);
    const columnIndex = boardData.columns.findIndex(column => column.id === columnId);
    if (columnIndex !== -1) {
      restoreColumnTitle(titleContainer, columnId, boardData.columns[columnIndex].name);
    } else {
      const defaultValue = inputElement.defaultValue || 'Колонка';
      restoreColumnTitle(titleContainer, columnId, defaultValue);
    }
  }
}

// Функция для удаления колонки
function deleteColumn(columnId) {
  // Запрашиваем подтверждение удаления
  const confirmed = window.confirm('Вы уверены, что хотите удалить эту колонку? Все карточки в колонке будут удалены.');
  if (!confirmed) return;
  
  try {
    // Получаем текущие данные доски
    const boardData = JSON.parse(currentBoardData.boardData);
    
    // Находим индекс колонки для удаления
    const columnIndex = boardData.columns.findIndex(column => column.id === columnId);
    if (columnIndex === -1) {
      console.error('Колонка не найдена');
      return;
    }
    
    // Удаляем колонку
    boardData.columns.splice(columnIndex, 1);
    
    // Обновляем данные доски
    updateBoardData(boardData);
    
    // Удаляем колонку из DOM без перезагрузки страницы
    const columnElement = document.querySelector(`.kanban-column[data-column-id="${columnId}"]`);
    if (columnElement) {
      columnElement.remove();
    }
    
  } catch (error) {
    console.error('Ошибка при удалении колонки:', error);
    alert('Не удалось удалить колонку: ' + error.message);
  }
}

// Функция для добавления новой карточки
function addNewCard(columnId) {
  // Запрашиваем название карточки
  const cardTitle = prompt('Введите название карточки:');
  if (!cardTitle || cardTitle.trim() === '') return;
  
  // Запрашиваем описание карточки (опционально)
  const cardDescription = prompt('Введите описание карточки (по желанию):');
  
  try {
    // Генерируем уникальный ID для карточки
    const taskId = 'task_' + Date.now();
    
    // Создаем новую карточку
    const newTask = {
      id: taskId,
      title: cardTitle,
      description: cardDescription || '',
      createdAt: new Date().toISOString()
    };
    
    // Получаем текущие данные доски
    const boardData = JSON.parse(currentBoardData.boardData);
    
    // Находим колонку для добавления карточки
    const columnIndex = boardData.columns.findIndex(column => column.id === columnId);
    if (columnIndex === -1) {
      console.error('Колонка не найдена');
      return;
    }
    
    // Добавляем карточку в колонку
    boardData.columns[columnIndex].tasks.push(newTask);
    
    // Обновляем данные доски
    updateBoardData(boardData);
    
    // Добавляем карточку в DOM без перезагрузки страницы
    const columnCards = document.querySelector(`.column-cards[data-column-id="${columnId}"]`);
    if (columnCards) {
      const cardHtml = `
        <div class="kanban-card" draggable="true" data-task-id="${taskId}">
          <div class="card-content">
            <div class="card-title">${cardTitle}</div>
            ${cardDescription ? `<div class="card-description">${cardDescription}</div>` : ''}
          </div>
          <div class="card-actions">
            <button class="card-edit-btn" data-task-id="${taskId}">✏️</button>
            <button class="card-delete-btn" data-task-id="${taskId}">🗑️</button>
          </div>
        </div>
      `;
      
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = cardHtml;
      const cardElement = tempDiv.firstElementChild;
      columnCards.appendChild(cardElement);
      
      // Добавляем обработчики для новой карточки
      cardElement.addEventListener('dragstart', handleDragStart);
      cardElement.addEventListener('dragend', handleDragEnd);
      // Добавляем новые обработчики для карточки
      cardElement.addEventListener('dragover', handleDragOver);
      cardElement.addEventListener('dragleave', handleDragLeave);
      
      // Добавляем обработчики для кнопок
      const editBtn = cardElement.querySelector('.card-edit-btn');
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        editCard(taskId);
      });
      
      const deleteBtn = cardElement.querySelector('.card-delete-btn');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteCard(taskId);
      });
    }
    
  } catch (error) {
    console.error('Ошибка при добавлении карточки:', error);
    alert('Не удалось добавить карточку: ' + error.message);
  }
}

// Функция для редактирования карточки
function editCard(taskId) {
  try {
    // Получаем текущие данные доски
    const boardData = JSON.parse(currentBoardData.boardData);
    
    // Находим колонку и карточку для редактирования
    let foundTask = null;
    let columnIndex = -1;
    let taskIndex = -1;
    
    for (let i = 0; i < boardData.columns.length; i++) {
      const column = boardData.columns[i];
      const tIndex = column.tasks.findIndex(task => task.id === taskId);
      
      if (tIndex !== -1) {
        columnIndex = i;
        taskIndex = tIndex;
        foundTask = column.tasks[tIndex];
        break;
      }
    }
    
    if (!foundTask) {
      console.error('Карточка не найдена');
      return;
    }
    
    // Запрашиваем новое название карточки
    const newTitle = prompt('Введите новое название карточки:', foundTask.title);
    if (!newTitle || newTitle.trim() === '') return;
    
    // Запрашиваем новое описание карточки
    const newDescription = prompt('Введите новое описание карточки:', foundTask.description || '');
    
    // Проверяем, были ли внесены изменения
    if (newTitle === foundTask.title && newDescription === foundTask.description) return;
    
    // Обновляем карточку
    boardData.columns[columnIndex].tasks[taskIndex].title = newTitle;
    boardData.columns[columnIndex].tasks[taskIndex].description = newDescription;
    boardData.columns[columnIndex].tasks[taskIndex].updatedAt = new Date().toISOString();
    
    // Обновляем данные доски
    updateBoardData(boardData);
    
    // Обновляем карточку в DOM без перезагрузки страницы
    const cardElement = document.querySelector(`.kanban-card[data-task-id="${taskId}"]`);
    if (cardElement) {
      const titleElement = cardElement.querySelector('.card-title');
      if (titleElement) {
        titleElement.textContent = newTitle;
      }
      
      let descriptionElement = cardElement.querySelector('.card-description');
      if (newDescription) {
        if (descriptionElement) {
          descriptionElement.textContent = newDescription;
        } else {
          // Создаем элемент описания, если его нет
          descriptionElement = document.createElement('div');
          descriptionElement.className = 'card-description';
          descriptionElement.textContent = newDescription;
          cardElement.querySelector('.card-content').appendChild(descriptionElement);
        }
      } else if (descriptionElement) {
        // Удаляем элемент описания, если новое описание пустое
        descriptionElement.remove();
      }
    }
    
  } catch (error) {
    console.error('Ошибка при редактировании карточки:', error);
    alert('Не удалось отредактировать карточку: ' + error.message);
  }
}

// Функция для удаления карточки
function deleteCard(taskId) {
  // Запрашиваем подтверждение удаления
  const confirmed = window.confirm('Вы уверены, что хотите удалить эту карточку?');
  if (!confirmed) return;
  
  try {
    // Получаем текущие данные доски
    const boardData = JSON.parse(currentBoardData.boardData);
    
    // Находим колонку и карточку для удаления
    let columnIndex = -1;
    let taskIndex = -1;
    
    for (let i = 0; i < boardData.columns.length; i++) {
      const column = boardData.columns[i];
      const tIndex = column.tasks.findIndex(task => task.id === taskId);
      
      if (tIndex !== -1) {
        columnIndex = i;
        taskIndex = tIndex;
        break;
      }
    }
    
    if (columnIndex === -1 || taskIndex === -1) {
      console.error('Карточка не найдена');
      return;
    }
    
    // Удаляем карточку
    boardData.columns[columnIndex].tasks.splice(taskIndex, 1);
    
    // Обновляем данные доски
    updateBoardData(boardData);
    
    // Удаляем карточку из DOM без перезагрузки страницы
    const cardElement = document.querySelector(`.kanban-card[data-task-id="${taskId}"]`);
    if (cardElement) {
      cardElement.remove();
    }
    
  } catch (error) {
    console.error('Ошибка при удалении карточки:', error);
    alert('Не удалось удалить карточку: ' + error.message);
  }
}

// Функция для обновления данных доски
function updateBoardData(boardData) {
  try {
    // Обновляем данные доски
    const stringifiedData = JSON.stringify(boardData);
    currentBoardData.boardData = stringifiedData;
    
    // Отображаем статус сохранения
    const saveStatus = document.getElementById('saveStatus');
    if (saveStatus) {
      saveStatus.textContent = 'Изменения не сохранены...';
      saveStatus.classList.add('unsaved');
    }
    
    // Устанавливаем флаг изменения
    boardChanged = true;
    
    // Добавляем флаг несохраненных изменений в текущие данные
    currentBoardData._hasUnsavedChanges = true;
    
    console.log('Обновление данных доски:', currentBoardData.id);
    
    // Сразу обновляем кэш досок в памяти
    const boardsCache = getBoardsCache();
    if (boardsCache) {
      const boardIndex = boardsCache.findIndex(board => board.id == currentBoardData.id);
      if (boardIndex !== -1) {
        // Создаем копию объекта доски, чтобы избежать проблем с ссылками
        const updatedBoard = JSON.parse(JSON.stringify(currentBoardData));
        updatedBoard._hasUnsavedChanges = true; // Явно устанавливаем флаг
        
        boardsCache[boardIndex] = updatedBoard;
        updateBoardsCache(boardsCache);
        console.log('Кэш в памяти обновлен, индекс доски:', boardIndex);
      } else {
        console.warn('Доска не найдена в кэше памяти:', currentBoardData.id);
      }
    } else {
      console.warn('Кэш в памяти не инициализирован');
    }
    
    // Обновляем кэш в localStorage
    const localStorageCache = JSON.parse(localStorage.getItem('kanban_boards_cache') || '[]');
    const boardIndex = localStorageCache.findIndex(board => board.id == currentBoardData.id);
    
    if (boardIndex !== -1) {
      // Создаем копию объекта доски через строковую сериализацию
      const updatedBoard = JSON.parse(JSON.stringify(currentBoardData));
      updatedBoard._hasUnsavedChanges = true; // Явно устанавливаем флаг
      
      localStorageCache[boardIndex] = updatedBoard;
      
      // Сохраняем обновленный кэш в localStorage
      localStorage.setItem('kanban_boards_cache', JSON.stringify(localStorageCache));
      console.log('Кэш в localStorage обновлен, индекс доски:', boardIndex);
      
      // Проверяем, правильно ли сохранились данные
      const afterUpdateCache = JSON.parse(localStorage.getItem('kanban_boards_cache') || '[]');
      const afterUpdateBoard = afterUpdateCache.find(b => b.id == currentBoardData.id);
      if (afterUpdateBoard && afterUpdateBoard._hasUnsavedChanges) {
        console.log('Проверка успешна: флаг несохраненных изменений установлен в кэше localStorage');
      } else {
        console.error('Ошибка: флаг несохраненных изменений не установлен в кэше localStorage после обновления');
        console.log('Данные в кэше после обновления:', afterUpdateBoard);
      }
    } else {
      console.warn('Доска не найдена в кэше localStorage:', currentBoardData.id);
      
      // Добавляем доску в кэш, если её там нет
      const updatedBoard = JSON.parse(JSON.stringify(currentBoardData));
      updatedBoard._hasUnsavedChanges = true;
      
      localStorageCache.push(updatedBoard);
      localStorage.setItem('kanban_boards_cache', JSON.stringify(localStorageCache));
      console.log('Доска добавлена в кэш localStorage');
    }
    
    // Сбрасываем предыдущий таймер автосохранения
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    
    // Устанавливаем новый таймер автосохранения (15 секунд)
    saveTimer = setTimeout(() => {
      saveBoardData();
    }, SAVE_DELAY);
    
  } catch (error) {
    console.error('Ошибка при обновлении данных доски:', error);
  }
}

// Функция для сохранения данных доски на сервере
async function saveBoardData() {
  if (!boardChanged) return;
  
  try {
    const saveStatus = document.getElementById('saveStatus');
    if (saveStatus) {
      saveStatus.textContent = 'Сохранение...';
      saveStatus.classList.remove('unsaved');
      saveStatus.classList.add('saving');
    }
    
    // Проверяем, что доска существует
    if (!currentBoardData || !currentBoardData.id) {
      throw new Error('Данные доски недоступны');
    }
    
    // Создаем объект для обновления
    const updateData = {
      name: currentBoardData.name,
      boardData: currentBoardData.boardData
    };
    
    console.log('Сохранение доски на сервере:', currentBoardData.id);
    
    // Отправляем запрос на обновление
    await kanbanService.updateBoard(currentBoardData.id, updateData);
    
    // Удаляем флаг несохраненных изменений из текущих данных
    delete currentBoardData._hasUnsavedChanges;
    
    // Обновляем флаг изменения
    boardChanged = false;
    
    console.log('Доска успешно сохранена на сервере, обновляем кэши');
    
    // Обновляем кэш досок в памяти
    const boardsCache = getBoardsCache();
    if (boardsCache) {
      const boardIndex = boardsCache.findIndex(board => board.id == currentBoardData.id);
      if (boardIndex !== -1) {
        // Создаем новую копию объекта без свойства _hasUnsavedChanges
        const updatedBoard = JSON.parse(JSON.stringify(currentBoardData));
        boardsCache[boardIndex] = updatedBoard;
        updateBoardsCache(boardsCache);
        console.log('Кэш в памяти обновлен после сохранения');
      }
    }
    
    // Обновляем кэш в localStorage
    const localStorageCache = JSON.parse(localStorage.getItem('kanban_boards_cache') || '[]');
    const boardIndex = localStorageCache.findIndex(board => board.id == currentBoardData.id);
    if (boardIndex !== -1) {
      // Создаем новую копию объекта без свойства _hasUnsavedChanges
      const updatedBoard = JSON.parse(JSON.stringify(currentBoardData));
      localStorageCache[boardIndex] = updatedBoard;
      localStorage.setItem('kanban_boards_cache', JSON.stringify(localStorageCache));
      console.log('Кэш в localStorage обновлен после сохранения');
      
      // Проверяем обновление кэша
      const checkCache = JSON.parse(localStorage.getItem('kanban_boards_cache') || '[]');
      const checkBoard = checkCache.find(b => b.id == currentBoardData.id);
      if (checkBoard && !checkBoard._hasUnsavedChanges) {
        console.log('Проверка успешна: флаг несохраненных изменений удален из кэша localStorage');
      } else if (checkBoard && checkBoard._hasUnsavedChanges) {
        console.error('Ошибка: флаг несохраненных изменений остался в кэше после сохранения');
      }
    } else {
      console.warn('Доска не найдена в кэше localStorage:', currentBoardData.id);
      
      // Добавляем доску в кэш, если её там нет
      const updatedBoard = JSON.parse(JSON.stringify(currentBoardData));
      localStorageCache.push(updatedBoard);
      localStorage.setItem('kanban_boards_cache', JSON.stringify(localStorageCache));
      console.log('Доска добавлена в кэш localStorage');
    }
    
    // Обновляем статус сохранения
    if (saveStatus) {
      saveStatus.textContent = 'Все изменения сохранены';
      saveStatus.classList.remove('saving');
      saveStatus.classList.remove('unsaved');
    }
    
    console.log('Доска успешно сохранена');
    
  } catch (error) {
    console.error('Ошибка при сохранении доски:', error);
    
    const saveStatus = document.getElementById('saveStatus');
    if (saveStatus) {
      saveStatus.textContent = 'Ошибка сохранения! Попробуйте снова.';
      saveStatus.classList.remove('saving');
      saveStatus.classList.add('error');
    }
  }
}

// Функция для принудительного сохранения доски при уходе со страницы
function forceSaveBoardData() {
  if (boardChanged && currentBoardData) {
    // Создаем объект для обновления
    const updateData = {
      name: currentBoardData.name,
      boardData: currentBoardData.boardData
    };
    
    console.log('Принудительное сохранение доски:', currentBoardData.id);
    
    try {
      // Используем синхронный запрос для гарантированного сохранения перед уходом со страницы
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', `/api/boards/${currentBoardData.id}`, false); // false = синхронный запрос
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify(updateData));
      
      if (xhr.status >= 200 && xhr.status < 300) {
        // Успешное сохранение
        delete currentBoardData._hasUnsavedChanges;
        boardChanged = false;
        
        console.log('Доска принудительно сохранена, обновляем кэши');
        
        // Обновляем кэш в памяти
        const boardsCache = getBoardsCache();
        if (boardsCache) {
          const boardIndex = boardsCache.findIndex(board => board.id == currentBoardData.id);
          if (boardIndex !== -1) {
            // Создаем новую копию объекта без флага несохраненных изменений
            const updatedBoard = JSON.parse(JSON.stringify(currentBoardData));
            boardsCache[boardIndex] = updatedBoard;
            updateBoardsCache(boardsCache);
            console.log('Кэш в памяти обновлен после принудительного сохранения');
          }
        }
        
        // Обновляем кэш в localStorage
        const localStorageCache = JSON.parse(localStorage.getItem('kanban_boards_cache') || '[]');
        const boardIndex = localStorageCache.findIndex(board => board.id == currentBoardData.id);
        if (boardIndex !== -1) {
          // Создаем новую копию объекта без флага несохраненных изменений
          const updatedBoard = JSON.parse(JSON.stringify(currentBoardData));
          localStorageCache[boardIndex] = updatedBoard;
          localStorage.setItem('kanban_boards_cache', JSON.stringify(localStorageCache));
          console.log('Кэш в localStorage обновлен после принудительного сохранения');
        }
        
        console.log('Доска принудительно сохранена перед выходом');
      } else {
        console.error('Ошибка при принудительном сохранении доски');
      }
    } catch (error) {
      console.error('Критическая ошибка при принудительном сохранении доски:', error);
    }
  }
}

// Функция для очистки слушателей событий доски
export function cleanupBoardEventListeners() {
  // Удаляем слушатель beforeunload
  window.removeEventListener('beforeunload', handleBeforeUnload);
  
  // Сохраняем изменения перед переходом, если они есть
  if (boardChanged && currentBoardData) {
    // Используем принудительное сохранение вместо обычного, так как оно синхронное
    forceSaveBoardData();
  }
  
  // Сбрасываем таймер автосохранения
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  
  // Сбрасываем переменные доски
  boardChanged = false;
  currentBoardData = null;
  
  console.log('Очистка слушателей событий доски выполнена');
} 