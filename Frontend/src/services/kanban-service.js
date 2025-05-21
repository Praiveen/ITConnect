const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function getApiUrl(path) {
  // path должен начинаться с /
  if (API_BASE_URL) {
    return API_BASE_URL + path;
  }
  // Если переменная не задана (локальная разработка) — используем прокси
  return '/api' + path;
}

class KanbanService {
  async getBoards() {
    try {
      const response = await fetch(getApiUrl('/boards'), {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Ошибка при получении досок");
      }

      return await response.json();
    } catch (error) {
      console.error("Ошибка при получении списка досок:", error);
      throw error;
    }
  }

  async getBoard(boardId) {
    try {
      const response = await fetch(getApiUrl(`/boards/${boardId}`), {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Ошибка при получении доски");
      }

      return await response.json();
    } catch (error) {
      console.error(`Ошибка при получении доски с ID ${boardId}:`, error);
      throw error;
    }
  }

  async createBoard(boardData) {
    try {
      const response = await fetch(getApiUrl('/boards'), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(boardData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Ошибка при создании доски");
      }

      return await response.json();
    } catch (error) {
      console.error("Ошибка при создании доски:", error);
      throw error;
    }
  }

  async updateBoard(boardId, boardData) {
    try {
      const response = await fetch(getApiUrl(`/boards/${boardId}`), {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(boardData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Ошибка при обновлении доски");
      }

      return await response.json();
    } catch (error) {
      console.error(`Ошибка при обновлении доски с ID ${boardId}:`, error);
      throw error;
    }
  }

  async deleteBoard(boardId) {
    try {
      const response = await fetch(getApiUrl(`/boards/${boardId}`), {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Ошибка при удалении доски");
      }

      return await response.json();
    } catch (error) {
      console.error(`Ошибка при удалении доски с ID ${boardId}:`, error);
      throw error;
    }
  }
}

export const kanbanService = new KanbanService();
