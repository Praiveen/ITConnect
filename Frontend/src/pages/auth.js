import "../css/main.css";
import viteLogo from "/vite.svg";
import { authService } from "../services/auth-service.js";
import { navigateTo } from "../router.js";
import {
  renderHeader,
  setupHeaderEventListeners,
} from "../components/Header.js";
import { renderFooter } from "../components/Footer.js";

export function renderLoginPage() {
  document.querySelector("#app").innerHTML = `
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
  `;

  setupHeaderEventListeners();

  document.querySelector("#go-to-register").addEventListener("click", (e) => {
    e.preventDefault();
    import("./register.js").then((module) => {
      module.renderRegisterPage();
    });
  });

  document
    .querySelector("#login-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const rememberMe = document.getElementById("remember")?.checked || false;

      const errorElement = document.querySelector(".auth-error");
      if (errorElement) errorElement.remove();

      const submitButton = document.querySelector('button[type="submit"]');
      const originalButtonText = submitButton.textContent;
      submitButton.disabled = true;
      submitButton.textContent = "Входим...";

      try {
        const userData = await authService.login(email, password);

        const redirectUrl =
          sessionStorage.getItem("redirectAfterAuth") || "/dashboard";

        sessionStorage.removeItem("redirectAfterAuth");

        navigateTo(redirectUrl);
      } catch (error) {
        console.error("Ошибка при входе:", error);

        const errorDiv = document.createElement("div");
        errorDiv.className = "auth-error";
        errorDiv.textContent =
          error.message || "Ошибка при входе. Проверьте email и пароль.";
        document
          .querySelector(".auth-form")
          .insertBefore(errorDiv, submitButton);

        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      }
    });

  document.querySelector("#forgot-password").addEventListener("click", (e) => {
    e.preventDefault();
    alert("Функция восстановления пароля будет доступна позже");
  });
}
