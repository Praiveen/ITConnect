import { authService } from '../services/auth-service.js';
import { navigateTo } from '../router.js';
import { notificationService } from '../services/notification-service.js';

// Функция для рендеринга узкого хедера дашборда
export function renderDashboardHeader() {
  // Получаем данные пользователя из локального хранилища
  const userData = authService.getUser() || {};
  const userInitial = userData.firstName ? userData.firstName.charAt(0).toUpperCase() : 'U';
  
  // Заглушка для количества непрочитанных уведомлений - будет обновлено после загрузки
  const unreadNotificationsCount = 0;
  
  return `
    <header class="dashboard-header">
      <div class="dashboard-header-container">
        <div class="dashboard-logo">
          <span class="dashboard-logo-text">ITConnect</span>
        </div>
        
        <div class="dashboard-profile-menu">
          <!-- Иконка уведомлений -->
          <div class="dashboard-notifications" id="notificationsIcon">
            <i class="fas fa-bell"></i>
            <span class="notifications-badge" id="notificationsBadge" style="display: none;">0</span>
          </div>
          
          <!-- Выпадающий список уведомлений -->
          <div class="dashboard-dropdown-menu notifications-dropdown" id="notificationsDropdown">
            <div class="notifications-header">
              <h3>Уведомления</h3>
              <button class="mark-all-read" id="markAllRead" style="display: none;">Прочитать все</button>
            </div>
            <div class="notifications-list" id="notificationsList">
              <!-- Здесь будут отображаться уведомления -->
              <div class="empty-notifications" id="emptyNotifications">У вас нет новых уведомлений</div>
            </div>
          </div>
          
          <!-- Профиль пользователя -->
          <div class="dashboard-user-avatar" id="userAvatarMenu">
            <div class="avatar-placeholder">${userInitial}</div>
          </div>
          
          <div class="dashboard-dropdown-menu" id="userDropdownMenu">
            <div class="dropdown-item" id="goToProfile">
              <span>Профиль</span>
            </div>
            <div class="dropdown-item" id="logoutButton">
              <span>Выйти</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  `;
}

// Функция для отображения уведомления в списке
function renderNotificationItem(notification) {
  const { id, type, icon, title, message, timestamp, read } = notification;
  const date = new Date(timestamp);
  const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateString = date.toLocaleDateString();
  
  // Специальная обработка для уведомлений о приглашениях
  if (type === 'invitation') {
    return `
      <div class="notification-item invitation-item ${read ? '' : 'unread'}" data-id="${id}">
        <div class="notification-icon">
          <i class="fas fa-${icon}"></i>
        </div>
        <div class="notification-content">
          <div class="notification-title">${title}</div>
          <div class="notification-message">${message}</div>
          <div class="notification-time">${dateString}, ${timeString}</div>
          <div class="invitation-actions">
            <button class="accept-invitation-btn btn-primary" data-invitation-id="${notification.invitationId}">
              <i class="fas fa-check"></i> Принять
            </button>
            <button class="decline-invitation-btn btn-secondary" data-invitation-id="${notification.invitationId}">
              <i class="fas fa-times"></i> Отклонить
            </button>
          </div>
        </div>
      </div>
    `;
  }
  
  // Обычные уведомления
  return `
    <div class="notification-item ${read ? '' : 'unread'}" data-id="${id}">
      <div class="notification-icon">
        <i class="fas fa-${icon}"></i>
      </div>
      <div class="notification-content">
        <div class="notification-title">${title}</div>
        <div class="notification-message">${message}</div>
        <div class="notification-time">${dateString}, ${timeString}</div>
      </div>
    </div>
  `;
}

// Функция для обновления счетчика непрочитанных уведомлений
function updateNotificationBadge(notifications) {
  try {
    const count = Array.isArray(notifications) ? notifications.length : 0;
    const badge = document.getElementById('notificationsBadge');
    const markAllReadBtn = document.getElementById('markAllRead');
    
    if (badge) {
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'flex';
        
        if (markAllReadBtn) {
          markAllReadBtn.style.display = 'block';
        }
      } else {
        badge.style.display = 'none';
        
        if (markAllReadBtn) {
          markAllReadBtn.style.display = 'none';
        }
      }
    }
  } catch (error) {
    console.error('Ошибка при обновлении счетчика уведомлений:', error);
  }
}

// Функция для загрузки и отображения уведомлений
async function loadNotifications() {
  try {
    const notifications = await notificationService.getUnreadNotifications();
    const notificationsList = document.getElementById('notificationsList');
    const emptyNotifications = document.getElementById('emptyNotifications');
    
    if (notificationsList) {
      if (notifications.length > 0) {
        // Очищаем список и добавляем уведомления
        notificationsList.innerHTML = notifications.map(renderNotificationItem).join('');
        
        // Скрываем сообщение о пустом списке
        if (emptyNotifications) {
          emptyNotifications.style.display = 'none';
        }
        
        // Добавляем обработчики клика для каждого обычного уведомления
        document.querySelectorAll('.notification-item:not(.invitation-item)').forEach(item => {
          item.addEventListener('click', async () => {
            const notificationId = item.dataset.id;
            
            if (!item.classList.contains('read')) {
              // Отмечаем уведомление как прочитанное
              await notificationService.markAsRead(notificationId);
              
              // Удаляем уведомление из UI и обновляем счетчик
              item.remove();
              const remainingNotifications = document.querySelectorAll('.notification-item').length;
              updateNotificationBadge(Array(remainingNotifications).fill({}));
              
              // Если уведомлений не осталось, показываем сообщение
              if (remainingNotifications === 0) {
                notificationsList.innerHTML = '<div class="empty-notifications">У вас нет непрочитанных уведомлений</div>';
              }
            }
          });
        });
        
        // Добавляем обработчики для кнопок принятия/отклонения приглашений
        document.querySelectorAll('.accept-invitation-btn').forEach(button => {
          button.addEventListener('click', async (event) => {
            event.stopPropagation(); // Предотвращаем срабатывание клика на родительском элементе
            
            try {
              const invitationId = button.dataset.invitationId;
              const result = await notificationService.acceptWorkspaceInvitation(invitationId);
              
              if (result && result.success) {
                // Обновляем UI после успешного принятия приглашения
                const notificationItem = button.closest('.notification-item');
                if (notificationItem) {
                  // Показываем сообщение об успехе
                  notificationItem.innerHTML = `
                    <div class="notification-content">
                      <div class="notification-message" style="color: #4caf50;">
                        <i class="fas fa-check-circle"></i> Приглашение успешно принято
                      </div>
                    </div>
                  `;
                  
                  // Через 2 секунды перезагружаем уведомления
                  setTimeout(async () => {
                    const refreshedNotifications = await notificationService.getUnreadNotifications();
                    loadNotificationsIntoUI(refreshedNotifications);
                  }, 2000);
                }
              }
            } catch (error) {
              console.error('Ошибка при принятии приглашения:', error);
              alert('Произошла ошибка при принятии приглашения. Пожалуйста, попробуйте снова.');
            }
          });
        });
        
        document.querySelectorAll('.decline-invitation-btn').forEach(button => {
          button.addEventListener('click', async (event) => {
            event.stopPropagation(); // Предотвращаем срабатывание клика на родительском элементе
            
            try {
              const invitationId = button.dataset.invitationId;
              const result = await notificationService.declineWorkspaceInvitation(invitationId);
              
              if (result && result.success) {
                // Обновляем UI после успешного отклонения приглашения
                const notificationItem = button.closest('.notification-item');
                if (notificationItem) {
                  // Показываем сообщение об успехе
                  notificationItem.innerHTML = `
                    <div class="notification-content">
                      <div class="notification-message" style="color: #f44336;">
                        <i class="fas fa-times-circle"></i> Приглашение отклонено
                      </div>
                    </div>
                  `;
                  
                  // Через 2 секунды перезагружаем уведомления
                  setTimeout(async () => {
                    const refreshedNotifications = await notificationService.getUnreadNotifications();
                    loadNotificationsIntoUI(refreshedNotifications);
                  }, 2000);
                }
              }
            } catch (error) {
              console.error('Ошибка при отклонении приглашения:', error);
              alert('Произошла ошибка при отклонении приглашения. Пожалуйста, попробуйте снова.');
            }
          });
        });
      } else {
        // Если уведомлений нет, показываем сообщение
        notificationsList.innerHTML = '<div class="empty-notifications">У вас нет непрочитанных уведомлений</div>';
      }
    }
    
    // Обновляем счетчик
    updateNotificationBadge(notifications);
  } catch (error) {
    console.error('Ошибка при загрузке уведомлений:', error);
  }
}

// Вспомогательная функция для отображения уведомлений в UI
function loadNotificationsIntoUI(notifications) {
  const notificationsList = document.getElementById('notificationsList');
  const emptyNotifications = document.getElementById('emptyNotifications');
  
  if (notificationsList) {
    if (notifications.length > 0) {
      // Очищаем список и добавляем уведомления
      notificationsList.innerHTML = notifications.map(renderNotificationItem).join('');
      
      // Скрываем сообщение о пустом списке
      if (emptyNotifications) {
        emptyNotifications.style.display = 'none';
      }
      
      // Добавляем обработчики событий для новых элементов
      setupNotificationEventListeners();
    } else {
      // Если уведомлений нет, показываем сообщение
      notificationsList.innerHTML = '<div class="empty-notifications">У вас нет непрочитанных уведомлений</div>';
    }
  }
  
  // Обновляем счетчик
  updateNotificationBadge(notifications);
}

// Настраивает обработчики событий для элементов уведомлений
function setupNotificationEventListeners() {
  // Обработчики для обычных уведомлений
  document.querySelectorAll('.notification-item:not(.invitation-item)').forEach(item => {
    item.addEventListener('click', async () => {
      const notificationId = item.dataset.id;
      
      if (!item.classList.contains('read')) {
        // Отмечаем уведомление как прочитанное
        await notificationService.markAsRead(notificationId);
        
        // Удаляем уведомление из UI и обновляем счетчик
        item.remove();
        const remainingNotifications = document.querySelectorAll('.notification-item').length;
        updateNotificationBadge(Array(remainingNotifications).fill({}));
        
        // Если уведомлений не осталось, показываем сообщение
        if (remainingNotifications === 0) {
          const notificationsList = document.getElementById('notificationsList');
          if (notificationsList) {
            notificationsList.innerHTML = '<div class="empty-notifications">У вас нет непрочитанных уведомлений</div>';
          }
        }
      }
    });
  });
  
  // Обработчики для кнопок приглашений
  setupInvitationButtons();
}

// Настраивает обработчики для кнопок принятия/отклонения приглашений
function setupInvitationButtons() {
  document.querySelectorAll('.accept-invitation-btn').forEach(button => {
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      
      try {
        const invitationId = button.dataset.invitationId;
        const result = await notificationService.acceptWorkspaceInvitation(invitationId);
        
        if (result && result.success) {
          const notificationItem = button.closest('.notification-item');
          if (notificationItem) {
            notificationItem.innerHTML = `
              <div class="notification-content">
                <div class="notification-message" style="color: #4caf50;">
                  <i class="fas fa-check-circle"></i> Приглашение успешно принято
                </div>
              </div>
            `;
            
            setTimeout(async () => {
              const refreshedNotifications = await notificationService.getUnreadNotifications();
              loadNotificationsIntoUI(refreshedNotifications);
            }, 2000);
          }
        }
      } catch (error) {
        console.error('Ошибка при принятии приглашения:', error);
        alert('Произошла ошибка при принятии приглашения. Пожалуйста, попробуйте снова.');
      }
    });
  });
  
  document.querySelectorAll('.decline-invitation-btn').forEach(button => {
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      
      try {
        const invitationId = button.dataset.invitationId;
        const result = await notificationService.declineWorkspaceInvitation(invitationId);
        
        if (result && result.success) {
          const notificationItem = button.closest('.notification-item');
          if (notificationItem) {
            notificationItem.innerHTML = `
              <div class="notification-content">
                <div class="notification-message" style="color: #f44336;">
                  <i class="fas fa-times-circle"></i> Приглашение отклонено
                </div>
              </div>
            `;
            
            setTimeout(async () => {
              const refreshedNotifications = await notificationService.getUnreadNotifications();
              loadNotificationsIntoUI(refreshedNotifications);
            }, 2000);
          }
        }
      } catch (error) {
        console.error('Ошибка при отклонении приглашения:', error);
        alert('Произошла ошибка при отклонении приглашения. Пожалуйста, попробуйте снова.');
      }
    });
  });
}

// Функция для установки обработчиков событий в хедере дашборда
export function setupDashboardHeaderEventListeners() {
  // Обработчик клика по аватару для открытия/закрытия меню
  const avatarMenu = document.getElementById('userAvatarMenu');
  const dropdownMenu = document.getElementById('userDropdownMenu');
  
  if (avatarMenu && dropdownMenu) {
    avatarMenu.addEventListener('click', () => {
      // Закрываем меню уведомлений при открытии меню профиля
      const notificationsDropdown = document.getElementById('notificationsDropdown');
      if (notificationsDropdown) {
        notificationsDropdown.classList.remove('active');
      }
      
      // Открываем/закрываем меню профиля
      dropdownMenu.classList.toggle('active');
    });
    
    // Закрытие меню при клике в любом месте страницы
    document.addEventListener('click', (event) => {
      if (!avatarMenu.contains(event.target) && !dropdownMenu.contains(event.target)) {
        dropdownMenu.classList.remove('active');
      }
    });
    
    // Обработчик для перехода в профиль
    const profileLink = document.getElementById('goToProfile');
    if (profileLink) {
      profileLink.addEventListener('click', () => {
        navigateTo('/profile');
      });
    }
    
    // Обработчик для выхода из системы
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
      logoutButton.addEventListener('click', async () => {
        try {
          await authService.logout();
          navigateTo('/');
        } catch (error) {
          console.error('Ошибка при выходе:', error);
        }
      });
    }
  }
  
  // Обработчик клика по иконке уведомлений
  const notificationsIcon = document.getElementById('notificationsIcon');
  const notificationsDropdown = document.getElementById('notificationsDropdown');
  
  if (notificationsIcon && notificationsDropdown) {
    notificationsIcon.addEventListener('click', async (event) => {
      // Закрываем меню профиля при открытии уведомлений
      const userDropdownMenu = document.getElementById('userDropdownMenu');
      if (userDropdownMenu) {
        userDropdownMenu.classList.remove('active');
      }
      
      // Загружаем уведомления при открытии меню
      await loadNotifications();
      
      // Открываем/закрываем выпадающий список уведомлений
      notificationsDropdown.classList.toggle('active');
      
      event.stopPropagation();
    });
    
    // Закрываем выпадающее меню уведомлений при клике вне его
    document.addEventListener('click', (event) => {
      if (!notificationsIcon.contains(event.target) && !notificationsDropdown.contains(event.target)) {
        notificationsDropdown.classList.remove('active');
      }
    });
    
    // Обработчик кнопки "Прочитать все"
    const markAllRead = document.getElementById('markAllRead');
    if (markAllRead) {
      markAllRead.addEventListener('click', async () => {
        try {
          await notificationService.markAllAsRead();
          
          // Обновляем UI - показываем пустой список
          const notificationsList = document.getElementById('notificationsList');
          if (notificationsList) {
            notificationsList.innerHTML = '<div class="empty-notifications">У вас нет непрочитанных уведомлений</div>';
          }
          
          // Обновляем счетчик
          updateNotificationBadge([]);
        } catch (error) {
          console.error('Ошибка при отметке всех уведомлений как прочитанных:', error);
        }
      });
    }
  }
  
  // Первичная проверка наличия уведомлений при загрузке страницы
  initNotifications();
}

// Инициализация уведомлений при загрузке страницы
async function initNotifications() {
  try {
    const notifications = await notificationService.getUnreadNotifications();
    updateNotificationBadge(notifications);
  } catch (error) {
    console.error('Ошибка при инициализации уведомлений:', error);
  }
}