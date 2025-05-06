import { authService } from '../services/auth-service.js';

// Функция для рендеринга хедера
export function renderHeader() {
  return `
    <header class="header">
      <div class="logo-container">
        <img src="/logo_ITConnect.png" class="logo" alt="ITConnect logo" />
        <span class="logo-text" id="home-link">ITConnect</span>
      </div>
      <div class="auth-buttons">
        ${authService.isAuthenticated() ? 
          `<button class="btn-profile">Профиль</button>
           <button class="btn-logout">Выйти</button>` : 
          `<button class="btn-login">Войти</button>
           <button class="btn-register">Зарегистрироваться</button>`
        }
      </div>
    </header>
  `;
}

// Функция для добавления обработчиков событий к элементам хедера
export function setupHeaderEventListeners() {
  // Обработчик для возврата на главную при клике на название
  document.querySelector('#home-link').addEventListener('click', () => {
    window.location.href = '/';
  });

  // Кнопки входа
  document.querySelectorAll('.btn-login').forEach(button => {
    button.addEventListener('click', () => {
      console.log('Переход на страницу входа');
      import('../pages/auth.js').then(module => {
        module.renderLoginPage();
      });
    });
  });

  // Кнопки регистрации
  document.querySelectorAll('.btn-register').forEach(button => {
    button.addEventListener('click', () => {
      console.log('Переход на страницу регистрации');
      import('../pages/register.js').then(module => {
        module.renderRegisterPage();
      });
    });
  });
  
  // Кнопка профиля (если пользователь авторизован)
  document.querySelectorAll('.btn-profile').forEach(button => {
    button.addEventListener('click', () => {
      console.log('Переход в профиль');
      import('../pages/profile.js').then(module => {
        module.renderProfilePage();
      });
    });
  });
  
  // Кнопка выхода (если пользователь авторизован)
  document.querySelectorAll('.btn-logout').forEach(button => {
    button.addEventListener('click', async () => {
      console.log('Выход из системы');
      try {
        await authService.logout();
        // Перезагружаем страницу после выхода
        window.location.reload();
      } catch (error) {
        console.error('Ошибка при выходе:', error);
        alert('Произошла ошибка при выходе из системы');
      }
    });
  });
} 