const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function getApiUrl(path) {
  // path должен начинаться с /
  if (API_BASE_URL) {
    return API_BASE_URL + path;
  }
  // Если переменная не задана (локальная разработка) — используем прокси
  return '/api' + path;
}

class AuthService {
  constructor() {
    this.userKey = "auth_user";
    this.isAuthenticatedKey = "is_authenticated";
  }

  async login(email, password) {
    try {
      const response = await fetch(getApiUrl('/auth/login'), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Ошибка при входе в систему");
      }

      sessionStorage.setItem(this.isAuthenticatedKey, "true");
      return await this.refreshUserData();
    } catch (error) {
      console.error("Ошибка при входе:", error);
      throw error;
    }
  }

  async register(firstName, email, password) {
    try {
      const response = await fetch(getApiUrl('/auth/signup'), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName,
          email,
          password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Ошибка при регистрации");
      }

      return await response.json();
    } catch (error) {
      console.error("Ошибка при регистрации:", error);
      throw error;
    }
  }

  async logout() {
    try {
      const response = await fetch(getApiUrl('/auth/logout'), {
        method: "GET",
        credentials: "include",
      });

      localStorage.removeItem(this.userKey);
      sessionStorage.removeItem(this.isAuthenticatedKey);

      return response.ok;
    } catch (error) {
      console.error("Ошибка при выходе:", error);

      localStorage.removeItem(this.userKey);
      sessionStorage.removeItem(this.isAuthenticatedKey);
      throw error;
    }
  }

  async getUserProfile() {
    try {
      return await this.refreshUserData();
    } catch (error) {
      console.error("Ошибка при получении профиля:", error);

      if (this.isAuthenticated()) {
        const userData = this.getUser();
        if (userData) {
          return userData;
        }
      }

      sessionStorage.removeItem(this.isAuthenticatedKey);
      localStorage.removeItem(this.userKey);
      throw error;
    }
  }

  async refreshUserData() {
    try {
      const response = await fetch(getApiUrl('/user/profile'), {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          sessionStorage.removeItem(this.isAuthenticatedKey);
          localStorage.removeItem(this.userKey);
          throw new Error("Пользователь не авторизован");
        }
        throw new Error("Не удалось получить профиль пользователя");
      }

      const userData = await response.json();

      if (!userData || typeof userData !== "object") {
        throw new Error("Некорректный формат данных пользователя");
      }

      localStorage.setItem(this.userKey, JSON.stringify(userData));
      sessionStorage.setItem(this.isAuthenticatedKey, "true");

      return userData;
    } catch (error) {
      console.error("Ошибка при получении профиля:", error);
      throw error;
    }
  }

  async updateProfile(profileData) {
    try {
      const response = await fetch(getApiUrl('/user/profile'), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profileData),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Ошибка при обновлении профиля");
      }

      const updatedData = await response.json();
      localStorage.setItem(this.userKey, JSON.stringify(updatedData));

      return updatedData;
    } catch (error) {
      console.error("Ошибка при обновлении профиля:", error);
      throw error;
    }
  }

  isAuthenticated() {
    return sessionStorage.getItem(this.isAuthenticatedKey) === "true";
  }

  getUser() {
    const userData = localStorage.getItem(this.userKey);
    return userData ? JSON.parse(userData) : null;
  }

  getUserId() {
    const user = this.getUser();
    return user ? user.id : null;
  }
}

export const authService = new AuthService();
