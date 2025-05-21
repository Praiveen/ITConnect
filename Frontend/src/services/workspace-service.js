const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function getApiUrl(path) {
  // path должен начинаться с /
  if (API_BASE_URL) {
    return API_BASE_URL + path;
  }
  // Если переменная не задана (локальная разработка) — используем прокси
  return '/api' + path;
}

class WorkspaceService {
  constructor() {
    this.baseUrl = "/api";
  }

  async getAllWorkspaces() {
    try {
      const response = await fetch(getApiUrl('/workspaces'), {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || "Ошибка при получении рабочих пространств"
        );
      }

      const text = await response.text();
      if (!text) {
        console.log("Сервер вернул пустой ответ");
        return [];
      }

      try {
        return JSON.parse(text);
      } catch (e) {
        console.error("Ошибка при разборе JSON:", e);
        console.log("Полученный ответ:", text);
        return [];
      }
    } catch (error) {
      console.error("Ошибка при получении списка рабочих пространств:", error);
      throw error;
    }
  }

  async getWorkspace(workspaceId) {
    if (!workspaceId) {
      console.error(
        "Попытка получить рабочее пространство с неверным ID:",
        workspaceId
      );
      throw new Error("Неверный ID рабочего пространства");
    }

    try {
      console.log(`Запрос данных рабочего пространства ${workspaceId}...`);
      const response = await fetch(getApiUrl(`/workspaces/${workspaceId}`), {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            `Ошибка при получении рабочего пространства ${workspaceId}`
        );
      }

      const text = await response.text();
      if (!text) {
        console.log(
          `Сервер вернул пустой ответ для рабочего пространства ${workspaceId}`
        );
        return null;
      }

      try {
        return JSON.parse(text);
      } catch (e) {
        console.error("Ошибка при разборе JSON:", e);
        console.log("Полученный ответ:", text);
        return null;
      }
    } catch (error) {
      console.error(
        `Ошибка при получении рабочего пространства с ID ${workspaceId}:`,
        error
      );
      throw error;
    }
  }

  async createWorkspace(workspaceData) {
    try {
      const response = await fetch(getApiUrl('/workspaces'), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(workspaceData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Ошибка при создании рабочего пространства"
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Ошибка при создании рабочего пространства:", error);
      throw error;
    }
  }

  async updateWorkspace(workspaceId, workspaceData) {
    try {
      const response = await fetch(getApiUrl(`/workspaces/${workspaceId}`), {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(workspaceData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Ошибка при обновлении рабочего пространства"
        );
      }

      return await response.json();
    } catch (error) {
      console.error(
        `Ошибка при обновлении рабочего пространства с ID ${workspaceId}:`,
        error
      );
      throw error;
    }
  }

  async deleteWorkspace(workspaceId) {
    try {
      const response = await fetch(getApiUrl(`/workspaces/${workspaceId}`), {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Ошибка при удалении рабочего пространства"
        );
      }

      return await response.json();
    } catch (error) {
      console.error(
        `Ошибка при удалении рабочего пространства с ID ${workspaceId}:`,
        error
      );
      throw error;
    }
  }

  async addMember(workspaceId, userId, role = "MEMBER") {
    try {
      const response = await fetch(getApiUrl(`/workspaces/${workspaceId}/members`), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: userId,
          role: role,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Ошибка при добавлении участника");
      }

      return await response.json();
    } catch (error) {
      console.error(
        `Ошибка при добавлении участника в рабочее пространство ${workspaceId}:`,
        error
      );
      throw error;
    }
  }

  async removeMember(workspaceId, userId) {
    try {
      const response = await fetch(getApiUrl(`/workspaces/${workspaceId}/members/${userId}`), {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Ошибка при удалении участника");
      }

      return await response.json();
    } catch (error) {
      console.error(
        `Ошибка при удалении участника из рабочего пространства ${workspaceId}:`,
        error
      );
      throw error;
    }
  }

  async inviteUser(workspaceId, userData) {
    try {
      const invitationData = {
        email: userData.email,
        role: userData.role || "MEMBER",
      };

      const response = await fetch(getApiUrl(`/workspaces/${workspaceId}/invitations`), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(invitationData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Ошибка при приглашении пользователя"
        );
      }

      return await response.json();
    } catch (error) {
      console.error(
        `Ошибка при приглашении пользователя в рабочее пространство ${workspaceId}:`,
        error
      );
      throw error;
    }
  }

  async changeUserRole(workspaceId, userId, newRole) {
    if (!newRole || !["ADMIN", "MEMBER", "VIEWER"].includes(newRole)) {
      throw new Error("Указана некорректная роль пользователя");
    }

    try {
      const response = await fetch(getApiUrl(`/workspaces/${workspaceId}/members/${userId}/role`), {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: newRole,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Ошибка при изменении роли пользователя"
        );
      }

      return await response.json();
    } catch (error) {
      console.error(
        `Ошибка при изменении роли пользователя ${userId} в рабочем пространстве ${workspaceId}:`,
        error
      );
      throw error;
    }
  }

  async getWorkspaceChats(workspaceId) {
    if (!workspaceId) {
      console.error(
        "Попытка получить чаты с неверным ID рабочего пространства:",
        workspaceId
      );
      throw new Error("Неверный ID рабочего пространства");
    }
    try {
      const response = await fetch(getApiUrl(`/workspaces/${workspaceId}/chats`), {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            `Ошибка при получении чатов для рабочего пространства ${workspaceId}`
        );
      }
      const text = await response.text();
      if (!text) return [];
      try {
        return JSON.parse(text);
      } catch (e) {
        console.error("Ошибка при разборе JSON чатов:", e, text);
        return [];
      }
    } catch (error) {
      console.error(
        `Ошибка при получении чатов для рабочего пространства ${workspaceId}:`,
        error
      );
      throw error;
    }
  }

  async createChatInWorkspace(workspaceId, chatData) {
    if (!workspaceId) {
      throw new Error("Не указан ID рабочего пространства для создания чата");
    }
    if (!chatData || !chatData.name) {
      throw new Error("Не указано имя для нового чата");
    }
    try {
      const response = await fetch(getApiUrl(`/workspaces/${workspaceId}/chats`), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chatData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Ошибка при создании чата");
      }
      return await response.json();
    } catch (error) {
      console.error(
        `Ошибка при создании чата в рабочем пространстве ${workspaceId}:`,
        error
      );
      throw error;
    }
  }

  async updateChatInWorkspace(workspaceId, chatId, chatData) {
    if (!workspaceId || !chatId) {
      throw new Error(
        "Не указан ID рабочего пространства или чата для обновления"
      );
    }
    if (!chatData || !chatData.name) {
      throw new Error("Не указаны данные для обновления чата, как минимум имя");
    }
    try {
      const response = await fetch(getApiUrl(`/workspaces/${workspaceId}/chats/${chatId}`), {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chatData),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: `Ошибка ${response.status}` }));
        throw new Error(errorData.message || "Ошибка при обновлении чата");
      }
      return await response.json();
    } catch (error) {
      console.error(
        `Ошибка при обновлении чата ${chatId} в рабочем пространстве ${workspaceId}:`,
        error
      );
      throw error;
    }
  }

  async deleteChatInWorkspace(workspaceId, chatId) {
    if (!workspaceId || !chatId) {
      throw new Error(
        "Не указан ID рабочего пространства или чата для удаления"
      );
    }
    try {
      const response = await fetch(getApiUrl(`/workspaces/${workspaceId}/chats/${chatId}`), {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: `Ошибка ${response.status}` }));
        throw new Error(errorData.message || "Ошибка при удалении чата");
      }

      return { success: true, message: "Чат успешно удален" };
    } catch (error) {
      console.error(
        `Ошибка при удалении чата ${chatId} из рабочего пространства ${workspaceId}:`,
        error
      );
      throw error;
    }
  }

  async getChatById(workspaceId, chatId) {
    if (!workspaceId || !chatId) {
      console.error(
        "Неверный ID рабочего пространства или чата при запросе деталей чата:",
        workspaceId,
        chatId
      );
      throw new Error("Неверный ID рабочего пространства или чата");
    }
    try {
      const response = await fetch(
        getApiUrl(`/workspaces/${workspaceId}/chats/${chatId}`),
        {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: response.statusText }));
        console.error(
          `Ошибка при получении чата ${chatId} для пространства ${workspaceId}:`,
          errorData
        );
        throw new Error(errorData.message || `Ошибка HTTP: ${response.status}`);
      }
      const text = await response.text();
      if (!text) return null;
      try {
        const chat = JSON.parse(text);
        return chat.data || chat;
      } catch (e) {
        console.error("Ошибка при разборе JSON деталей чата:", e, text);
        return null;
      }
    } catch (error) {
      console.error(
        `Сетевая ошибка при получении чата ${chatId} для пространства ${workspaceId}:`,
        error
      );
      throw error;
    }
  }

  async getChatMessages(workspaceId, chatId, page = 0, size = 50) {
    if (!workspaceId || !chatId) {
      console.error(
        "Неверный ID рабочего пространства или чата при запросе сообщений:",
        workspaceId,
        chatId
      );
      throw new Error("Неверный ID рабочего пространства или чата");
    }
    try {
      const response = await fetch(
        getApiUrl(`/workspaces/${workspaceId}/chats/${chatId}/messages?page=${page}&size=${size}&sort=sentAt,asc`),
        {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: response.statusText }));
        console.error(
          `Ошибка при получении сообщений для чата ${chatId}:`,
          errorData
        );
        throw new Error(errorData.message || `Ошибка HTTP: ${response.status}`);
      }
      const messagesPage = await response.json();

      return messagesPage;
    } catch (error) {
      console.error(
        `Сетевая ошибка при получении сообщений для чата ${chatId}:`,
        error
      );
      throw error;
    }
  }

  async getAllUserChats() {
    try {
      const response = await fetch(getApiUrl('/chats/all'), {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || "Ошибка при получении всех чатов пользователя"
        );
      }
      return await response.json();
    } catch (error) {
      console.error("Ошибка при получении всех чатов пользователя:", error);
      throw error;
    }
  }
}

export const workspaceService = new WorkspaceService();
