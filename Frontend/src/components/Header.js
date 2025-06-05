import { authService } from "../services/auth-service.js";

export function renderHeader() {
  return `
    <header class="header">
      <div class="logo-container">
        <img src="/logo_ITConnect.png" class="logo" alt="ITConnect logo" />
        <span class="logo-text" id="home-link">ITConnect</span>
      </div>
      <nav class="auth-buttons">
        ${
          authService.isAuthenticated()
            ? `<button class="btn-profile">Профиль</button>
           <button class="btn-logout">Выйти</button>`
            : `<button class="btn-login">Войти</button>
           <button class="btn-register">Зарегистрироваться</button>`
        }
      </nav>
      <div class="mobile-menu-icon">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div class="mobile-nav">
        ${
          authService.isAuthenticated()
            ? `<a href="#" class="btn-profile">Профиль</a>
               <a href="#" class="btn-logout">Выйти</a>`
            : `<a href="#" class="btn-login">Войти</a>
               <a href="#" class="btn-register">Зарегистрироваться</a>`
        }
      </div>
    </header>
  `;
}

export function setupHeaderEventListeners() {
  document.querySelector("#home-link").addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "/";
  });

  const mobileMenuIcon = document.querySelector(".mobile-menu-icon");
  const mobileNav = document.querySelector(".mobile-nav");

  if (mobileMenuIcon) {
    mobileMenuIcon.addEventListener("click", () => {
      mobileMenuIcon.classList.toggle("active");
      mobileNav.classList.toggle("active");
    });
  }

  document.querySelectorAll(".btn-login").forEach((button) => {
    button.addEventListener("click", () => {
      import("../pages/auth.js").then((module) => {
        module.renderLoginPage();
      });
    });
  });

  document.querySelectorAll(".btn-register").forEach((button) => {
    button.addEventListener("click", () => {
      import("../pages/register.js").then((module) => {
        module.renderRegisterPage();
      });
    });
  });

  document.querySelectorAll(".btn-profile").forEach((button) => {
    button.addEventListener("click", () => {
      import("../pages/profile.js").then((module) => {
        module.renderProfilePage();
      });
    });
  });

  document.querySelectorAll(".btn-logout").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await authService.logout();

        window.location.reload();
      } catch (error) {
        console.error("Ошибка при выходе:", error);
        alert("Произошла ошибка при выходе из системы");
      }
    });
  });
}
