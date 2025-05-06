// Сервис для работы с рабочими пространствами

class WorkspaceService {
  // Получить все рабочие пространства
  async getAllWorkspaces() {
    try {
      const response = await fetch('/api/workspaces', {
        method: 'GET',
        credentials: 'include', // Для работы с куками
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при получении рабочих пространств');
      }

      // Проверяем, что ответ не пустой
      const text = await response.text();
      if (!text) {
        console.log('Сервер вернул пустой ответ');
        return []; // Возвращаем пустой массив, если ответ пустой
      }

      try {
        // Пробуем разобрать JSON
        return JSON.parse(text);
      } catch (e) {
        console.error('Ошибка при разборе JSON:', e);
        console.log('Полученный ответ:', text);
        return []; // Возвращаем пустой массив в случае ошибки разбора
      }
    } catch (error) {
      console.error('Ошибка при получении списка рабочих пространств:', error);
      throw error;
    }
  }

  // Получить рабочее пространство по ID
  async getWorkspace(workspaceId) {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при получении рабочего пространства');
      }

      // Проверяем, что ответ не пустой
      const text = await response.text();
      if (!text) {
        console.log(`Сервер вернул пустой ответ для рабочего пространства ${workspaceId}`);
        return null; // Возвращаем null, если ответ пустой
      }

      try {
        // Пробуем разобрать JSON
        return JSON.parse(text);
      } catch (e) {
        console.error('Ошибка при разборе JSON:', e);
        console.log('Полученный ответ:', text);
        return null; // Возвращаем null в случае ошибки разбора
      }
    } catch (error) {
      console.error(`Ошибка при получении рабочего пространства с ID ${workspaceId}:`, error);
      throw error;
    }
  }

  // Создать новое рабочее пространство
  async createWorkspace(workspaceData) {
    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(workspaceData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при создании рабочего пространства');
      }

      return await response.json();
    } catch (error) {
      console.error('Ошибка при создании рабочего пространства:', error);
      throw error;
    }
  }

  // Обновить существующее рабочее пространство
  async updateWorkspace(workspaceId, workspaceData) {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(workspaceData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при обновлении рабочего пространства');
      }

      return await response.json();
    } catch (error) {
      console.error(`Ошибка при обновлении рабочего пространства с ID ${workspaceId}:`, error);
      throw error;
    }
  }

  // Удалить рабочее пространство
  async deleteWorkspace(workspaceId) {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при удалении рабочего пространства');
      }

      return await response.json();
    } catch (error) {
      console.error(`Ошибка при удалении рабочего пространства с ID ${workspaceId}:`, error);
      throw error;
    }
  }

  // Добавить участника в рабочее пространство
  async addMember(workspaceId, userId, role = 'MEMBER') {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: userId,
          role: role
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при добавлении участника');
      }

      return await response.json();
    } catch (error) {
      console.error(`Ошибка при добавлении участника в рабочее пространство ${workspaceId}:`, error);
      throw error;
    }
  }

  // Удалить участника из рабочего пространства
  async removeMember(workspaceId, userId) {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при удалении участника');
      }

      return await response.json();
    } catch (error) {
      console.error(`Ошибка при удалении участника из рабочего пространства ${workspaceId}:`, error);
      throw error;
    }
  }

  // Пригласить пользователя в рабочее пространство
  async inviteUser(workspaceId, userData) {
    try {
      const invitationData = {
        email: userData.email,
        role: userData.role || 'MEMBER' // По умолчанию обычный участник
      };

      const response = await fetch(`/api/workspaces/${workspaceId}/invitations`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(invitationData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при приглашении пользователя');
      }

      return await response.json();
    } catch (error) {
      console.error(`Ошибка при приглашении пользователя в рабочее пространство ${workspaceId}:`, error);
      throw error;
    }
  }
}

// Экспортируем экземпляр сервиса
export const workspaceService = new WorkspaceService();