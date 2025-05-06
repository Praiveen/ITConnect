// Сервис для работы с канбан-досками

class KanbanService {

  // Получить все доски пользователя
  async getBoards() {
    try {
      const response = await fetch('/api/boards', {
        method: 'GET',
        credentials: 'include', // Для работы с куками
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при получении досок');
      }

      return await response.json();
    } catch (error) {
      console.error('Ошибка при получении списка досок:', error);
      throw error;
    }
  }

  // Получить доску по ID
  async getBoard(boardId) {
    try {
      const response = await fetch(`/api/boards/${boardId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при получении доски');
      }

      return await response.json();
    } catch (error) {
      console.error(`Ошибка при получении доски с ID ${boardId}:`, error);
      throw error;
    }
  }

  // Создать новую доску
  async createBoard(boardData) {
    try {
      const response = await fetch('/api/boards', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(boardData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при создании доски');
      }

      return await response.json();
    } catch (error) {
      console.error('Ошибка при создании доски:', error);
      throw error;
    }
  }

  // Обновить существующую доску
  async updateBoard(boardId, boardData) {
    try {
      const response = await fetch(`/api/boards/${boardId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(boardData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при обновлении доски');
      }

      return await response.json();
    } catch (error) {
      console.error(`Ошибка при обновлении доски с ID ${boardId}:`, error);
      throw error;
    }
  }

  // Удалить доску
  async deleteBoard(boardId) {
    try {
      const response = await fetch(`/api/boards/${boardId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при удалении доски');
      }

      return await response.json();
    } catch (error) {
      console.error(`Ошибка при удалении доски с ID ${boardId}:`, error);
      throw error;
    }
  }
}

// Экспортируем экземпляр сервиса
export const kanbanService = new KanbanService(); 