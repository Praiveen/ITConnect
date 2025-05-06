// Сервис для работы с уведомлениями
class NotificationService {
  constructor() {
    // Базовый URL для API уведомлений
    this.baseUrl = '/api/notifications';
  }
  
  // Получить все уведомления пользователя
  async getNotifications() {
    try {
      const response = await fetch(`${this.baseUrl}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при получении уведомлений');
      }
      
      // Проверяем, что ответ не пустой
      const text = await response.text();
      if (!text) {
        return []; // Возвращаем пустой массив, если ответ пустой
      }
      
      try {
        // Пробуем разобрать JSON
        const notifications = JSON.parse(text);
        return this._processNotifications(notifications);
      } catch (e) {
        console.error('Ошибка при разборе JSON уведомлений:', e);
        return []; // Возвращаем пустой массив в случае ошибки разбора
      }
    } catch (error) {
      console.error('Ошибка при получении уведомлений:', error);
      return []; // Возвращаем пустой массив в случае ошибки
    }
  }
  
  // Получить непрочитанные уведомления пользователя
  async getUnreadNotifications() {
    try {
      const response = await fetch(`${this.baseUrl}/unread`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при получении непрочитанных уведомлений');
      }
      
      // Проверяем, что ответ не пустой
      const text = await response.text();
      if (!text) {
        return []; // Возвращаем пустой массив, если ответ пустой
      }
      
      try {
        // Пробуем разобрать JSON
        const notifications = JSON.parse(text);
        return this._processNotifications(notifications);
      } catch (e) {
        console.error('Ошибка при разборе JSON непрочитанных уведомлений:', e);
        return []; // Возвращаем пустой массив в случае ошибки разбора
      }
    } catch (error) {
      console.error('Ошибка при получении непрочитанных уведомлений:', error);
      return []; // Возвращаем пустой массив в случае ошибки
    }
  }
  
  // Получить количество непрочитанных уведомлений
  async getUnreadCount() {
    try {
      const response = await fetch(`${this.baseUrl}/unread/count`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при получении количества непрочитанных уведомлений');
      }
      
      const data = await response.json();
      return data.count || 0;
    } catch (error) {
      console.error('Ошибка при получении количества непрочитанных уведомлений:', error);
      return 0;
    }
  }
  
  // Получить приглашения в рабочие пространства
  async getWorkspaceInvitations() {
    try {
      const response = await fetch(`${this.baseUrl}/workspace-invitations`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при получении приглашений');
      }
      
      // Проверяем, что ответ не пустой
      const text = await response.text();
      if (!text) {
        return []; // Возвращаем пустой массив, если ответ пустой
      }
      
      try {
        // Пробуем разобрать JSON
        return JSON.parse(text);
      } catch (e) {
        console.error('Ошибка при разборе JSON приглашений:', e);
        return []; // Возвращаем пустой массив в случае ошибки разбора
      }
    } catch (error) {
      console.error('Ошибка при получении приглашений в рабочие пространства:', error);
      return []; // Возвращаем пустой массив в случае ошибки
    }
  }
  
  // Принять приглашение в рабочее пространство
  async acceptWorkspaceInvitation(invitationId) {
    try {
      const response = await fetch(`${this.baseUrl}/${invitationId}/accept`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при принятии приглашения');
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Ошибка при принятии приглашения ${invitationId}:`, error);
      throw error;
    }
  }
  
  // Отклонить приглашение в рабочее пространство
  async declineWorkspaceInvitation(invitationId) {
    try {
      const response = await fetch(`${this.baseUrl}/${invitationId}/decline`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при отклонении приглашения');
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Ошибка при отклонении приглашения ${invitationId}:`, error);
      throw error;
    }
  }
  
  // Форматирование уведомлений для отображения на фронтенде
  _processNotifications(notifications) {
    return notifications.map(notification => {
      // Если это приглашение в рабочее пространство
      if (notification.type === 'WORKSPACE_INVITATION') {
        return {
          id: notification.id,
          type: 'invitation',
          icon: 'user-plus',
          title: 'Приглашение в рабочее пространство',
          message: notification.message,
          timestamp: notification.createdAt || new Date(),
          read: notification.read,
          invitationId: notification.id,
          workspaceName: notification.workspace ? notification.workspace.name : '',
          role: notification.role,
          fromUser: notification.sender ? `${notification.sender.firstName || ''} ${notification.sender.lastName || ''}` : 'Unknown'
        };
      }
      
      // Для обычных уведомлений
      return {
        id: notification.id,
        type: notification.type.toLowerCase(),
        icon: this._getIconByType(notification.type),
        title: this._getTitleByType(notification.type),
        message: notification.message,
        timestamp: notification.createdAt || new Date(),
        read: notification.read,
        referenceId: notification.referenceId,
        referenceType: notification.referenceType
      };
    });
  }
  
  // Получить иконку по типу уведомления
  _getIconByType(type) {
    const icons = {
      'INFO': 'info-circle',
      'SUCCESS': 'check-circle',
      'WARNING': 'exclamation-triangle',
      'ERROR': 'times-circle',
      'WORKSPACE_INVITATION': 'user-plus',
      'TASK_ASSIGNED': 'tasks',
      'COMMENT_ADDED': 'comment',
      'BOARD_SHARED': 'clipboard'
    };
    
    return icons[type] || 'bell';
  }
  
  // Получить заголовок по типу уведомления
  _getTitleByType(type) {
    const titles = {
      'INFO': 'Информация',
      'SUCCESS': 'Успешно',
      'WARNING': 'Предупреждение',
      'ERROR': 'Ошибка',
      'WORKSPACE_INVITATION': 'Приглашение в рабочее пространство',
      'TASK_ASSIGNED': 'Задача назначена',
      'COMMENT_ADDED': 'Новый комментарий',
      'BOARD_SHARED': 'Доска предоставлена'
    };
    
    return titles[type] || 'Уведомление';
  }
  
  // Перевод роли на русский язык
  _translateRole(role) {
    const roles = {
      'ADMIN': 'Администратор',
      'MEMBER': 'Участник',
      'VIEWER': 'Наблюдатель'
    };
    
    return roles[role] || role;
  }
  
  // Отметить уведомление как прочитанное
  async markAsRead(notificationId) {
    try {
      const response = await fetch(`${this.baseUrl}/${notificationId}/read`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при отметке уведомления как прочитанного');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Ошибка при отметке уведомления как прочитанного:', error);
      throw error;
    }
  }
  
  // Отметить все уведомления как прочитанные
  async markAllAsRead() {
    try {
      const response = await fetch(`${this.baseUrl}/read-all`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при отметке всех уведомлений как прочитанных');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Ошибка при отметке всех уведомлений как прочитанных:', error);
      throw error;
    }
  }
  
  // Удалить уведомление
  async deleteNotification(notificationId) {
    try {
      const response = await fetch(`${this.baseUrl}/${notificationId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при удалении уведомления');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Ошибка при удалении уведомления:', error);
      throw error;
    }
  }
  
  // Создать тестовое уведомление (для разработки)
  async createTestNotification() {
    try {
      const response = await fetch(`${this.baseUrl}/test`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при создании тестового уведомления');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Ошибка при создании тестового уведомления:', error);
      throw error;
    }
  }
}

// Создаем и экспортируем экземпляр сервиса
export const notificationService = new NotificationService(); 