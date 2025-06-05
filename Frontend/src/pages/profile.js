import "../css/main.css";
import viteLogo from "/vite.svg";
import { authService } from "../services/auth-service.js";
import {
  renderHeader,
  setupHeaderEventListeners,
} from "../components/Header.js";
import { renderFooter } from "../components/Footer.js";

export async function renderProfilePage() {
  try {
    const userData = await authService.refreshUserData();

    if (!userData) {
      console.error("Не удалось получить данные пользователя");

      import("./auth.js").then((module) => {
        module.renderLoginPage();
      });
      return;
    }

    document.querySelector("#app").innerHTML = `
      <div class="app-container">
        <!-- Header -->
        ${renderHeader()}

        <!-- Profile Container -->
        <div class="profile-container">
          <div class="profile-card">
            <h2 class="profile-title">Профиль пользователя</h2>
            
            <div class="profile-info">
              <div class="profile-avatar">
                <div class="avatar-placeholder">${
                  userData.firstName
                    ? userData.firstName.charAt(0).toUpperCase()
                    : "U"
                }</div>
              </div>
              
              <div class="profile-details">
                <div class="profile-item">
                  <span class="profile-label">Имя:</span>
                  <span class="profile-value">${
                    userData.firstName || "Не указано"
                  }</span>
                </div>

                <div class="profile-item">
                  <span class="profile-label">Фамилия:</span>
                  <span class="profile-value">${
                    userData.lastName || "Не указано"
                  }</span>
                </div>
                
                <div class="profile-item">
                  <span class="profile-label">Полное имя:</span>
                  <span class="profile-value">${
                    userData.fullName || "Не указано"
                  }</span>
                </div>
                
                <div class="profile-item">
                  <span class="profile-label">Email:</span>
                  <span class="profile-value">${
                    userData.email || "Не указано"
                  }</span>
                </div>
                
                <div class="profile-item">
                  <span class="profile-label">Телефон:</span>
                  <span class="profile-value">${
                    userData.phoneNumber || "Не указано"
                  }</span>
                </div>
                
                <div class="profile-item">
                  <span class="profile-label">Статус:</span>
                  <span class="profile-value profile-status">Активен</span>
                </div>
              </div>
            </div>
            
            <div class="profile-actions">
              <button class="btn-primary btn-edit-profile">Редактировать профиль</button>
            </div>
          </div>
          
          
        </div>
        
        <!-- Модальное окно для редактирования профиля -->
        <div id="editProfileModal" class="modal">
          <div class="modal-content">
            <span class="close-modal">&times;</span>
            <h2>Редактирование профиля</h2>
            <form id="editProfileForm">
              <div class="form-group">
                <label for="firstName">Имя</label>
                <input type="text" id="firstName" value="${
                  userData.firstName || ""
                }" placeholder="Введите имя">
              </div>
              <div class="form-group">
                <label for="lastName">Фамилия</label>
                <input type="text" id="lastName" value="${
                  userData.lastName || ""
                }" placeholder="Введите фамилию">
              </div>
              <div class="form-group">
                <label for="fullName">Полное имя</label>
                <input type="text" id="fullName" value="${
                  userData.fullName || ""
                }" placeholder="Введите полное имя">
              </div>
              <div class="form-group">
                <label for="phoneNumber">Телефон</label>
                <input type="tel" id="phoneNumber" value="${
                  userData.phoneNumber || ""
                }" placeholder="Введите номер телефона">
                <small class="error-message" id="phoneNumberError" style="color: red; display: none;"></small>
              </div>
              <div class="form-group">
                <label for="email">Email</label>
                <input type="email" id="email" value="${
                  userData.email || ""
                }" placeholder="Введите email" disabled>
                <small>Email нельзя изменить</small>
              </div>
              <button type="submit" class="btn-primary btn-block">Сохранить изменения</button>
            </form>
          </div>
        </div>

        <!-- Footer -->
        ${renderFooter()}
      </div>
    `;

    addModalStyles();

    setupHeaderEventListeners();

    const modal = document.getElementById("editProfileModal");
    const editBtn = document.querySelector(".btn-edit-profile");
    const closeBtn = document.querySelector(".close-modal");

    const phoneNumberInput = document.getElementById("phoneNumber");
    const phoneNumberError = document.getElementById("phoneNumberError");
    const submitFormButton = document.querySelector("#editProfileForm button[type=\"submit\"]");

    function validatePhoneNumber(number) {
      const phoneRegex = /^(\+7|8)\d{10}$/;
      return phoneRegex.test(number);
    }

    phoneNumberInput.addEventListener("input", () => {
      const phoneNumber = phoneNumberInput.value;
      if (phoneNumber === "") {
        phoneNumberError.style.display = "none";
        phoneNumberError.textContent = "";
        submitFormButton.disabled = false;
      } else if (validatePhoneNumber(phoneNumber)) {
        phoneNumberError.style.display = "none";
        phoneNumberError.textContent = "";
        submitFormButton.disabled = false;
      } else {
        phoneNumberError.textContent = "Неверный формат номера. Пример: +79001234567 или 89001234567";
        phoneNumberError.style.display = "block";
        submitFormButton.disabled = true;
      }
    });

    editBtn.addEventListener("click", () => {
      modal.style.display = "block";
    });

    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });

    window.addEventListener("click", (event) => {
      if (event.target === modal) {
        modal.style.display = "none";
      }
    });

    document
      .getElementById("editProfileForm")
      .addEventListener("submit", async (e) => {
        e.preventDefault();

        const phoneNumber = phoneNumberInput.value;
        if (phoneNumber !== "" && !validatePhoneNumber(phoneNumber)) {
          phoneNumberError.textContent = "Неверный формат номера. Пример: +79001234567 или 89001234567";
          phoneNumberError.style.display = "block";
          submitFormButton.disabled = true;
          return;
        }

        const updatedProfile = {
          firstName: document.getElementById("firstName").value,
          lastName: document.getElementById("lastName").value,
          fullName: document.getElementById("fullName").value,
          phoneNumber: phoneNumber,
          email: userData.email,
        };

        try {
          const submitButton = e.target.querySelector('button[type="submit"]');
          const originalButtonText = submitButton.textContent;
          submitButton.disabled = true;
          submitButton.textContent = "Сохранение...";

          await authService.updateProfile(updatedProfile);

          modal.style.display = "none";

          renderProfilePage();
        } catch (error) {
          console.error("Ошибка при обновлении профиля:", error);
          alert("Не удалось обновить профиль. Попробуйте еще раз позже.");

          const submitButton = e.target.querySelector('button[type="submit"]');
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent =
              originalButtonText || "Сохранить изменения";
          }
        }
      });
  } catch (error) {
    console.error("Ошибка при загрузке профиля:", error);

    import("./auth.js").then((module) => {
      module.renderLoginPage();
    });
  }
}

function addModalStyles() {
  if (!document.getElementById("modalStyles")) {
    const style = document.createElement("style");
    style.id = "modalStyles";
    style.innerHTML = `
      .modal {
        display: none;
        position: fixed;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        overflow: auto;
        background-color: rgba(0, 0, 0, 0.5);
      }
      
      .modal-content {
        background-color: #242424;
        margin: 10% auto;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        width: 80%;
        max-width: 500px;
        animation: modalFadeIn 0.3s;
      }
      
      @keyframes modalFadeIn {
        from {opacity: 0; transform: translateY(-20px);}
        to {opacity: 1; transform: translateY(0);}
      }
      
      .close-modal {
        color: #aaa;
        float: right;
        font-size: 28px;
        font-weight: bold;
        cursor: pointer;
        transition: color 0.2s;
      }
      
      .close-modal:hover {
        color: #7c3aed;
      }
      
      #editProfileForm {
        margin-top: 20px;
      }
      
      .form-group small {
        display: block;
        font-size: 0.8rem;
        color: #777;
        margin-top: 5px;
      }
      
      @media (prefers-color-scheme: light) {
        .modal-content {
          background-color: #f9f9f9;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
      }
    `;
    document.head.appendChild(style);
  }
}
