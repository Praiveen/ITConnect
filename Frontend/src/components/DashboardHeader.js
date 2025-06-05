import { authService } from "../services/auth-service.js";
import { navigateTo } from "../router.js";
import { notificationService } from "../services/notification-service.js";

export function renderDashboardHeader() {
  const userData = authService.getUser() || {};
  const userInitial = userData.firstName
    ? userData.firstName.charAt(0).toUpperCase()
    : "U";

  const unreadNotificationsCount = 0;

  return `
    <header class="dashboard-header">
      <div class="dashboard-header-container">
        <div class="dashboard-logo">
          <button class="sidebar-toggle-btn" id="sidebarToggleBtn">
            <i class="fas fa-bars"></i>
          </button>
          <span class="dashboard-logo-text">ITConnect</span>
        </div>
        
        <div class="dashboard-profile-menu">
          <!-- Иконка уведомлений -->
          <div class="dashboard-notifications" id="notificationsIcon">
            <i class="fas fa-bell"></i>
            <span class="notifications-badge" id="notificationsBadge" style="display: none;">0</span>
          </div>
          
          <!-- Выпадающий список уведомлений -->
          <div class="dashboard-dropdown-menu notifications-dropdown" id="notificationsDropdown">
            <div class="notifications-header">
              <h3>Уведомления</h3>
              <button class="mark-all-read" id="markAllRead" style="display: none;">Прочитать все</button>
            </div>
            <div class="notifications-list" id="notificationsList">
              <!-- Здесь будут отображаться уведомления -->
              <div class="empty-notifications" id="emptyNotifications">У вас нет новых уведомлений</div>
            </div>
          </div>
          
          <!-- Профиль пользователя -->
          <div class="dashboard-user-avatar" id="userAvatarMenu">
            <div class="avatar-placeholder">${userInitial}</div>
          </div>
          
          <div class="dashboard-dropdown-menu" id="userDropdownMenu">
            <div class="dropdown-item" id="goToProfile">
              <span>Профиль</span>
            </div>
            <div class="dropdown-item" id="logoutButton">
              <span>Выйти</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  `;
}

function renderNotificationItem(notification) {
  const { id, type, icon, title, message, timestamp, read } = notification;
  const date = new Date(timestamp);
  const timeString = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateString = date.toLocaleDateString();

  if (type === "invitation") {
    return `
      <div class="notification-item invitation-item ${
        read ? "" : "unread"
      }" data-id="${id}">
        <div class="notification-icon">
          <i class="fas fa-${icon}"></i>
        </div>
        <div class="notification-content">
          <div class="notification-title">${title}</div>
          <div class="notification-message">${message}</div>
          <div class="notification-time">${dateString}, ${timeString}</div>
          <div class="invitation-actions">
            <button class="accept-invitation-btn btn-primary" data-invitation-id="${
              notification.invitationId
            }">
              <i class="fas fa-check"></i> Принять
            </button>
            <button class="decline-invitation-btn btn-secondary" data-invitation-id="${
              notification.invitationId
            }">
              <i class="fas fa-times"></i> Отклонить
            </button>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="notification-item ${read ? "" : "unread"}" data-id="${id}">
      <div class="notification-icon">
        <i class="fas fa-${icon}"></i>
      </div>
      <div class="notification-content">
        <div class="notification-title">${title}</div>
        <div class="notification-message">${message}</div>
        <div class="notification-time">${dateString}, ${timeString}</div>
      </div>
    </div>
  `;
}

function updateNotificationBadge(notifications) {
  try {
    const count = Array.isArray(notifications) ? notifications.length : 0;
    const badge = document.getElementById("notificationsBadge");
    const markAllReadBtn = document.getElementById("markAllRead");

    if (badge) {
      if (count > 0) {
        badge.textContent = count > 99 ? "99+" : count;
        badge.style.display = "flex";

        if (markAllReadBtn) {
          markAllReadBtn.style.display = "block";
        }
      } else {
        badge.style.display = "none";

        if (markAllReadBtn) {
          markAllReadBtn.style.display = "none";
        }
      }
    }
  } catch (error) {
  }
}

async function loadNotifications() {
  try {
    const notifications = await notificationService.getUnreadNotifications();
    const notificationsList = document.getElementById("notificationsList");
    const emptyNotifications = document.getElementById("emptyNotifications");

    if (notificationsList) {
      if (notifications.length > 0) {
        notificationsList.innerHTML = notifications
          .map(renderNotificationItem)
          .join("");

        if (emptyNotifications) {
          emptyNotifications.style.display = "none";
        }

        document
          .querySelectorAll(".notification-item:not(.invitation-item)")
          .forEach((item) => {
            item.addEventListener("click", async () => {
              const notificationId = item.dataset.id;

              if (!item.classList.contains("read")) {
                await notificationService.markAsRead(notificationId);

                item.remove();
                const remainingNotifications =
                  document.querySelectorAll(".notification-item").length;
                updateNotificationBadge(Array(remainingNotifications).fill({}));

                if (remainingNotifications === 0) {
                  notificationsList.innerHTML =
                    '<div class="empty-notifications">У вас нет непрочитанных уведомлений</div>';
                }
              }
            });
          });

        document
          .querySelectorAll(".accept-invitation-btn")
          .forEach((button) => {
            button.addEventListener("click", async (event) => {
              event.stopPropagation();

              try {
                const invitationId = button.dataset.invitationId;
                button.disabled = true;
                button.innerHTML =
                  '<i class="fas fa-spinner fa-spin"></i> Принятие...';

                const result =
                  await notificationService.acceptWorkspaceInvitation(
                    invitationId
                  );

                if (result && result.success) {
                  await notificationService.markAsRead(invitationId);

                  const notificationItem = button.closest(".notification-item");
                  if (notificationItem) {
                    notificationItem.innerHTML = `
                    <div class="notification-content">
                      <div class="notification-message" style="color: #4caf50;">
                        <i class="fas fa-check-circle"></i> Приглашение успешно принято
                      </div>
                    </div>
                  `;

                    setTimeout(async () => {
                      const refreshedNotifications =
                        await notificationService.getUnreadNotifications();
                      loadNotificationsIntoUI(refreshedNotifications);
                    }, 2000);
                  }
                }
              } catch (error) {
                button.disabled = false;
                button.innerHTML = '<i class="fas fa-check"></i> Принять';
                alert(
                  "Произошла ошибка при принятии приглашения. Пожалуйста, попробуйте снова."
                );
              }
            });
          });

        document
          .querySelectorAll(".decline-invitation-btn")
          .forEach((button) => {
            button.addEventListener("click", async (event) => {
              event.stopPropagation();

              try {
                const invitationId = button.dataset.invitationId;
                const result =
                  await notificationService.declineWorkspaceInvitation(
                    invitationId
                  );

                if (result && result.success) {
                  await notificationService.markAsRead(invitationId);

                  const notificationItem = button.closest(".notification-item");
                  if (notificationItem) {
                    notificationItem.innerHTML = `
                    <div class="notification-content">
                      <div class="notification-message" style="color: #f44336;">
                        <i class="fas fa-times-circle"></i> Приглашение отклонено
                      </div>
                    </div>
                  `;

                    setTimeout(async () => {
                      const refreshedNotifications =
                        await notificationService.getUnreadNotifications();
                      loadNotificationsIntoUI(refreshedNotifications);
                    }, 2000);
                  }
                }
              } catch (error) {
                alert(
                  "Произошла ошибка при отклонении приглашения. Пожалуйста, попробуйте снова."
                );
              }
            });
          });
      } else {
        notificationsList.innerHTML =
          '<div class="empty-notifications">У вас нет непрочитанных уведомлений</div>';
      }
    }

    updateNotificationBadge(notifications);
  } catch (error) {
  }
}

function loadNotificationsIntoUI(notifications) {
  const notificationsList = document.getElementById("notificationsList");
  const emptyNotifications = document.getElementById("emptyNotifications");

  if (notificationsList) {
    if (notifications.length > 0) {
      notificationsList.innerHTML = notifications
        .map(renderNotificationItem)
        .join("");

      if (emptyNotifications) {
        emptyNotifications.style.display = "none";
      }

      setupNotificationEventListeners();
    } else {
      notificationsList.innerHTML =
        '<div class="empty-notifications">У вас нет непрочитанных уведомлений</div>';
    }
  }

  updateNotificationBadge(notifications);
}

function setupNotificationEventListeners() {
  document
    .querySelectorAll(".notification-item:not(.invitation-item)")
    .forEach((item) => {
      item.addEventListener("click", async () => {
        const notificationId = item.dataset.id;

        if (!item.classList.contains("read")) {
          await notificationService.markAsRead(notificationId);

          item.remove();
          const remainingNotifications =
            document.querySelectorAll(".notification-item").length;
          updateNotificationBadge(Array(remainingNotifications).fill({}));

          if (remainingNotifications === 0) {
            const notificationsList =
              document.getElementById("notificationsList");
            if (notificationsList) {
              notificationsList.innerHTML =
                '<div class="empty-notifications">У вас нет непрочитанных уведомлений</div>';
            }
          }
        }
      });
    });

  setupInvitationButtons();
}

function setupInvitationButtons() {
  document.querySelectorAll(".accept-invitation-btn").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();

      try {
        const invitationId = button.dataset.invitationId;
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Принятие...';

        const result = await notificationService.acceptWorkspaceInvitation(
          invitationId
        );

        if (result && result.success) {
          await notificationService.markAsRead(invitationId);

          const notificationItem = button.closest(".notification-item");
          if (notificationItem) {
            notificationItem.innerHTML = `
              <div class="notification-content">
                <div class="notification-message" style="color: #4caf50;">
                  <i class="fas fa-check-circle"></i> Приглашение успешно принято
                </div>
              </div>
            `;

            setTimeout(async () => {
              const refreshedNotifications =
                await notificationService.getUnreadNotifications();
              loadNotificationsIntoUI(refreshedNotifications);
            }, 2000);
          }
        }
      } catch (error) {
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-check"></i> Принять';
        alert(
          "Произошла ошибка при принятии приглашения. Пожалуйста, попробуйте снова."
        );
      }
    });
  });

  document.querySelectorAll(".decline-invitation-btn").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();

      try {
        const invitationId = button.dataset.invitationId;
        button.disabled = true;
        button.innerHTML =
          '<i class="fas fa-spinner fa-spin"></i> Отклонение...';

        const result = await notificationService.declineWorkspaceInvitation(
          invitationId
        );

        if (result && result.success) {
          await notificationService.markAsRead(invitationId);

          const notificationItem = button.closest(".notification-item");
          if (notificationItem) {
            notificationItem.innerHTML = `
              <div class="notification-content">
                <div class="notification-message" style="color: #f44336;">
                  <i class="fas fa-times-circle"></i> Приглашение отклонено
                </div>
              </div>
            `;

            setTimeout(async () => {
              const refreshedNotifications =
                await notificationService.getUnreadNotifications();
              loadNotificationsIntoUI(refreshedNotifications);
            }, 2000);
          }
        }
      } catch (error) {
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-times"></i> Отклонить';
        alert(
          "Произошла ошибка при отклонении приглашения. Пожалуйста, попробуйте снова."
        );
      }
    });
  });
}

export function setupDashboardHeaderEventListeners() {
  const avatarMenu = document.getElementById("userAvatarMenu");
  const dropdownMenu = document.getElementById("userDropdownMenu");

  if (avatarMenu && dropdownMenu) {
    avatarMenu.addEventListener("click", () => {
      const notificationsDropdown = document.getElementById(
        "notificationsDropdown"
      );
      if (notificationsDropdown) {
        notificationsDropdown.classList.remove("active");
      }

      dropdownMenu.classList.toggle("active");
    });

    document.addEventListener("click", (event) => {
      if (
        !avatarMenu.contains(event.target) &&
        !dropdownMenu.contains(event.target)
      ) {
        dropdownMenu.classList.remove("active");
      }
    });

    const profileLink = document.getElementById("goToProfile");
    if (profileLink) {
      profileLink.addEventListener("click", () => {
        navigateTo("/profile");
      });
    }

    const logoutButton = document.getElementById("logoutButton");
    if (logoutButton) {
      logoutButton.addEventListener("click", async () => {
        try {
          await authService.logout();
          navigateTo("/");
        } catch (error) {
        }
      });
    }
  }

  const notificationsIcon = document.getElementById("notificationsIcon");
  const notificationsDropdown = document.getElementById(
    "notificationsDropdown"
  );

  if (notificationsIcon && notificationsDropdown) {
    notificationsIcon.addEventListener("click", async (event) => {
      const userDropdownMenu = document.getElementById("userDropdownMenu");
      if (userDropdownMenu) {
        userDropdownMenu.classList.remove("active");
      }

      await loadNotifications();

      notificationsDropdown.classList.toggle("active");

      event.stopPropagation();
    });

    document.addEventListener("click", (event) => {
      if (
        !notificationsIcon.contains(event.target) &&
        !notificationsDropdown.contains(event.target)
      ) {
        notificationsDropdown.classList.remove("active");
      }
    });

    const markAllRead = document.getElementById("markAllRead");
    if (markAllRead) {
      markAllRead.addEventListener("click", async () => {
        try {
          await notificationService.markAllAsRead();

          const notificationsList =
            document.getElementById("notificationsList");
          if (notificationsList) {
            notificationsList.innerHTML =
              '<div class="empty-notifications">У вас нет непрочитанных уведомлений</div>';
          }

          updateNotificationBadge([]);
        } catch (error) {
        }
      });
    }
  }

  initNotifications();
}

async function initNotifications() {
  try {
    const notifications = await notificationService.getUnreadNotifications();
    updateNotificationBadge(notifications);
  } catch (error) {
  }
}
