import '../css/main.css'
import viteLogo from '/vite.svg'
import { authService } from '../services/auth-service.js'
import { navigateTo } from '../router.js'
import { renderHeader, setupHeaderEventListeners } from '../components/Header.js'
import { renderFooter } from '../components/Footer.js'

// Функция для рендеринга страницы авторизации
export function renderLoginPage() {
  document.querySelector('#app').innerHTML = `
    <div class="app-container">
      <!-- Header -->
      ${renderHeader()}

      <!-- Auth Form Container -->
      <div class="auth-container">
        <div class="auth-card">
          <h2 class="auth-title">Вход в систему</h2>
          <form class="auth-form" id="login-form">
            <div class="form-group">
              <label for="email">Email</label>
              <input type="email" id="email" name="email" placeholder="Введите ваш email" required>
            </div>
            
            <div class="form-group">
              <label for="password">Пароль</label>
              <input type="password" id="password" name="password" placeholder="Введите ваш пароль" required>
            </div>
            
            <div class="form-group remember-me">
              <input type="checkbox" id="remember" name="remember">
              <label for="remember">Запомнить меня</label>
            </div>
            
            <button type="submit" class="btn-primary btn-block">Войти</button>
            
            <div class="auth-links">
              <a href="#" id="forgot-password">Забыли пароль?</a>
              <a href="#" id="go-to-register">Нет аккаунта? Зарегистрироваться</a>
            </div>
          </form>
          <div id="login-error" class="error-message" style="display: none; color: #e55; margin-top: 1rem; text-align: center;"></div>
          <div id="login-loading" class="loading-indicator" style="display: none; text-align: center; margin-top: 1rem;">
            Загрузка...
          </div>
        </div>
      </div>

      <!-- Footer -->
      ${renderFooter()}
    </div>
  `

  // Устанавливаем обработчики событий для хедера
  setupHeaderEventListeners();

  // Обработчики событий страницы авторизации
  document.querySelector('#go-to-register').addEventListener('click', (e) => {
    e.preventDefault()
    import('./register.js').then(module => {
      module.renderRegisterPage()
    })
  })

  document.querySelector('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('remember')?.checked || false;
    
    // Скрываем предыдущие ошибки
    const errorElement = document.querySelector('.auth-error');
    if (errorElement) errorElement.remove();
    
    // Заблокируем кнопку и покажем индикатор загрузки
    const submitButton = document.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Входим...';
    
    try {
      // Вызываем метод входа из сервиса авторизации
      const userData = await authService.login(email, password);
      
      // После успешного входа перенаправляем на страницу профиля
      // или другую страницу, если была указана в redirectAfterAuth
      const redirectUrl = sessionStorage.getItem('redirectAfterAuth') || '/profile';
      
      // Очищаем redirectAfterAuth после использования
      sessionStorage.removeItem('redirectAfterAuth');
      
      // Перенаправляем на нужную страницу
      window.location.href = redirectUrl;
    } catch (error) {
      console.error('Ошибка при входе:', error);
      
      // Показываем сообщение об ошибке
      const errorDiv = document.createElement('div');
      errorDiv.className = 'auth-error';
      errorDiv.textContent = error.message || 'Ошибка при входе. Проверьте email и пароль.';
      document.querySelector('.auth-form').insertBefore(errorDiv, submitButton);
      
      // Возвращаем кнопку в исходное состояние
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  });

  // Обработчик для кнопки "Забыли пароль"
  document.querySelector('#forgot-password').addEventListener('click', (e) => {
    e.preventDefault()
    alert('Функция восстановления пароля будет доступна позже')
  })
} 