import "./css/main.css";
import javascriptLogo from "./javascript.svg";
import viteLogo from "/vite.svg";
import logo_ITConnect from "/logo_ITConnect.png";
import { authService } from "./services/auth-service.js";
import { initRouter, registerRoute, navigateTo } from "./router.js";
import {
  renderHeader,
  setupHeaderEventListeners,
} from "./components/Header.js";
import { renderFooter } from "./components/Footer.js";

function renderHomePage() {
  document.querySelector("#app").innerHTML = `
    <div class="app-container">
      <!-- Header -->
      ${renderHeader()}

      <!-- Hero Section -->
      <section class="hero">
        <h1 class="hero-title">Упрощайте коммуникацию в IT-команде</h1>
        <p class="hero-subtitle">ITConnect — платформа для эффективного обмена сообщениями внутри IT-команд, которая помогает ускорить разработку и улучшить взаимодействие</p>
        ${
          !authService.isAuthenticated()
            ? `<button class="btn-register">Начать бесплатно</button>`
            : `<button class="btn-dashboard">Перейти к работе</button>`
        }
      </section>

      <!-- Features Section -->
      <section class="features">
        <div class="feature-card">
          <div class="feature-icon">💬</div>
          <h3>Мгновенные сообщения</h3>
          <p>Общайтесь с командой в реальном времени без задержек и помех</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">📋</div>
          <h3>Kanban доски</h3>
          <p>Упрощайте планирование задач и достигайте целей вместе, используя визуальные инструменты</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">👥</div>
          <h3>Групповые чаты</h3>
          <p>Создавайте тематические каналы для разных проектов и команд</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🔐</div>
          <h3>Безопасность</h3>
          <p>Ваши данные надежно защищены современными алгоритмами шифрования</p>
        </div>
      </section>

      <!-- Footer -->
      ${renderFooter()}
    </div>
  `;

  setupHeaderEventListeners();

  setupHomePageButtons();
}

function setupHomePageButtons() {
  document.querySelectorAll(".btn-register").forEach((button) => {
    button.addEventListener("click", () => {
      console.log("Переход на страницу регистрации");
      import("./pages/register.js").then((module) => {
        module.renderRegisterPage();
      });
    });
  });

  document.querySelectorAll(".btn-dashboard").forEach((button) => {
    button.addEventListener("click", () => {
      console.log("Переход к дашборду");
      navigateTo("/dashboard");
    });
  });
}

function initializeRoutes() {
  registerRoute("/", renderHomePage);

  registerRoute("/login", () => {
    import("./pages/auth.js").then((module) => {
      module.renderLoginPage();
    });
  });

  registerRoute("/register", () => {
    import("./pages/register.js").then((module) => {
      module.renderRegisterPage();
    });
  });

  registerRoute("/profile", () => {
    import("./pages/profile.js").then((module) => {
      module.renderProfilePage();
    });
  });

  registerRoute("/dashboard", () => {
    import("./pages/dashboard.js").then((module) => {
      module.renderDashboardPage();
    });
  });
}

async function checkAuthState() {
  try {
    try {
      await authService.getUserProfile();
      console.log("Статус авторизации: авторизован");

      const redirectAfterAuth = sessionStorage.getItem("redirectAfterAuth");
      if (redirectAfterAuth) {
        sessionStorage.removeItem("redirectAfterAuth");
        navigateTo(redirectAfterAuth);
        return true;
      }
    } catch (error) {
      console.log("Статус авторизации: не авторизован");
    }

    return false;
  } catch (error) {
    console.error("Ошибка при проверке авторизации:", error);
    return false;
  }
}

async function initApp() {
  initializeRoutes();

  initRouter();

  const hash = window.location.hash;
  if (hash && hash.length > 1) {
    console.log("Обнаружен хэш в URL:", hash);

    return;
  }

  const shouldRedirect = await checkAuthState();
  if (!shouldRedirect) {
    renderHomePage();
  }
}

initApp();

function getCookies() {
  const cookies = document.cookie;

  if (cookies) {
    const cookieArray = cookies.split("; ");

    cookieArray.forEach((cookie) => {
      console.log(cookie);
    });
  } else {
    console.log("Куки не найдены.");
  }
}

getCookies();
