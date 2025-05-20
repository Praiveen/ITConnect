import "../css/main.css";
import viteLogo from "/vite.svg";
import { authService } from "../services/auth-service.js";
import { navigateTo } from "../router.js";
import {
  renderHeader,
  setupHeaderEventListeners,
} from "../components/Header.js";
import { renderFooter } from "../components/Footer.js";

export function renderRegisterPage() {
  document.querySelector("#app").innerHTML = `
    <div class="app-container">
      <!-- Header -->
      ${renderHeader()}

      <!-- Auth Form Container -->
      <div class="auth-container">
        <div class="auth-card">
          <h2 class="auth-title">Регистрация</h2>
          <form class="auth-form" id="register-form">
            <div class="form-group">
              <label for="name">Имя</label>
              <input type="text" id="name" name="name" placeholder="Введите ваше имя" required>
            </div>
            
            <div class="form-group">
              <label for="email">Email</label>
              <input type="email" id="email" name="email" placeholder="Введите ваш email" required>
            </div>
            
            <div class="form-group">
              <label for="password">Пароль</label>
              <input type="password" id="password" name="password" placeholder="Придумайте пароль" required>
              <div class="password-requirements">
                Пароль должен содержать минимум 5 символов
              </div>
            </div>
            
            <div class="form-group">
              <label for="confirm-password">Подтверждение пароля</label>
              <input type="password" id="confirm-password" name="passwordConfirm" placeholder="Повторите пароль" required>
            </div>
            
            <div class="form-group terms">
              <input type="checkbox" id="terms" name="terms" required>
              <label for="terms">Я соглашаюсь с <a href="#">условиями использования</a> и <a href="#">политикой конфиденциальности</a></label>
            </div>
            
            <button type="submit" class="btn-primary btn-block">Зарегистрироваться</button>
            
            <div class="auth-links">
              <a href="#" id="go-to-login">Уже есть аккаунт? Войти</a>
            </div>
          </form>
          <div id="register-error" class="error-message" style="display: none; color: #e55; margin-top: 1rem; text-align: center;"></div>
          <div id="register-success" class="success-message" style="display: none; color: #5a5; margin-top: 1rem; text-align: center;"></div>
          <div id="register-loading" class="loading-indicator" style="display: none; text-align: center; margin-top: 1rem;">
            Загрузка...
          </div>
        </div>
      </div>

      <!-- Footer -->
      ${renderFooter()}
    </div>
  `;

  setupHeaderEventListeners();

  document.querySelector("#go-to-login").addEventListener("click", (e) => {
    e.preventDefault();
    import("./auth.js").then((module) => {
      module.renderLoginPage();
    });
  });

  document
    .querySelector("#register-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.querySelector("#name").value;
      const email = document.querySelector("#email").value;
      const password = document.querySelector("#password").value;
      const passwordConfirm = document.querySelector("#confirm-password").value;
      const terms = document.querySelector("#terms").checked;

      const errorElement = document.querySelector("#register-error");
      const successElement = document.querySelector("#register-success");
      const loadingElement = document.querySelector("#register-loading");

      errorElement.style.display = "none";
      successElement.style.display = "none";

      if (password.length < 5) {
        errorElement.textContent = "Пароль должен содержать минимум 5 символов";
        errorElement.style.display = "block";
        return;
      }

      if (password !== passwordConfirm) {
        errorElement.textContent = "Пароли не совпадают";
        errorElement.style.display = "block";
        return;
      }

      if (!terms) {
        errorElement.textContent =
          "Необходимо согласиться с условиями использования";
        errorElement.style.display = "block";
        return;
      }

      loadingElement.style.display = "block";

      try {
        const result = await authService.register(name, email, password);

        successElement.textContent =
          result.message ||
          "Регистрация прошла успешно! Перенаправление на страницу входа...";
        successElement.style.display = "block";

        setTimeout(() => {
          import("./auth.js").then((module) => {
            module.renderLoginPage();
          });
        }, 2000);
      } catch (error) {
        errorElement.textContent =
          error.message || "Произошла ошибка при регистрации";
        errorElement.style.display = "block";
        console.error("Ошибка регистрации:", error);
      } finally {
        loadingElement.style.display = "none";
      }
    });
}
