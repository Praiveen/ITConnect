// Сервис для работы с аутентификацией

// Класс для работы с аутентификацией
class AuthService {
  constructor() {
    this.userKey = 'auth_user';
    this.isAuthenticatedKey = 'is_authenticated';
  }

  // Метод для входа пользователя
  async login(email, password) {
    try {
      const response = await fetch(`/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include' // Для работы с куками
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при входе в систему');
      }

      const data = await response.json();
      
      // Отмечаем, что пользователь аутентифицирован
      sessionStorage.setItem(this.isAuthenticatedKey, 'true');
      
      // После успешного входа получаем актуальные данные пользователя
      return await this.refreshUserData();
    } catch (error) {
      console.error('Ошибка при входе:', error);
      throw error;
    }
  }

  // Метод для регистрации пользователя
  async register(firstName, email, password) {
    try {
      const response = await fetch(`/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          firstName,
          email,
          password
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при регистрации');
      }

      const data = await response.json();
      
      return data;
    } catch (error) {
      console.error('Ошибка при регистрации:', error);
      throw error;
    }
  }

  // Метод для выхода пользователя
  async logout() {
    try {
      // Делаем запрос на сервер для выхода
      const response = await fetch(`/api/auth/logout`, {
        method: 'GET',
        credentials: 'include' // Для работы с куками
      });
      
      // Удаляем данные из localStorage и sessionStorage
      localStorage.removeItem(this.userKey);
      sessionStorage.removeItem(this.isAuthenticatedKey);
      
      return response.ok;
    } catch (error) {
      console.error('Ошибка при выходе:', error);
      // Даже если запрос не удался, все равно удаляем данные сессии
      localStorage.removeItem(this.userKey);
      sessionStorage.removeItem(this.isAuthenticatedKey);
      throw error;
    }
  }

  // Метод для получения профиля пользователя
  async getUserProfile() {
    try {
      // Всегда получаем свежие данные с сервера
      return await this.refreshUserData();
    } catch (error) {
      console.error('Ошибка при получении профиля:', error);
      
      // Если запрос не удался, но у нас есть данные в локальном хранилище и мы аутентифицированы
      if (this.isAuthenticated()) {
        const userData = this.getUser();
        if (userData) {
          return userData;
        }
      }
      
      // Если ничего не помогло, очищаем данные аутентификации
      sessionStorage.removeItem(this.isAuthenticatedKey);
      localStorage.removeItem(this.userKey);
      throw error;
    }
  }
  
  // Получить обновленные данные пользователя с сервера
  async refreshUserData() {
    try {
      const response = await fetch(`/api/user/profile`, {
        method: 'GET',
        credentials: 'include' // Передаем куки в запросе
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          // Если пользователь не авторизован
          sessionStorage.removeItem(this.isAuthenticatedKey);
          localStorage.removeItem(this.userKey);
          throw new Error('Пользователь не авторизован');
        }
        throw new Error('Не удалось получить профиль пользователя');
      }
      
      // Получаем и сохраняем данные пользователя
      const userData = await response.json();
      
      // Проверяем формат полученных данных
      if (!userData || typeof userData !== 'object') {
        throw new Error('Некорректный формат данных пользователя');
      }
      
      localStorage.setItem(this.userKey, JSON.stringify(userData));
      
      // Если данные получены успешно, значит пользователь аутентифицирован
      sessionStorage.setItem(this.isAuthenticatedKey, 'true');
      
      return userData;
    } catch (error) {
      console.error('Ошибка при получении профиля:', error);
      throw error;
    }
  }

  // Метод для обновления профиля пользователя
  async updateProfile(profileData) {
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(profileData),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при обновлении профиля');
      }

      // Получаем обновленные данные и сохраняем их
      const updatedData = await response.json();
      localStorage.setItem(this.userKey, JSON.stringify(updatedData));
      
      return updatedData;
    } catch (error) {
      console.error('Ошибка при обновлении профиля:', error);
      throw error;
    }
  }

  // Метод для проверки авторизации пользователя
  isAuthenticated() {
    // Проверяем значение в sessionStorage
    return sessionStorage.getItem(this.isAuthenticatedKey) === 'true';
  }

  // Метод для получения данных пользователя из локального хранилища
  getUser() {
    const userData = localStorage.getItem(this.userKey);
    return userData ? JSON.parse(userData) : null;
  }
}

// Экспортируем экземпляр сервиса
export const authService = new AuthService(); 