let icon = {
  success: "✅",
  danger: "❌",
  warning: "⚠️",
  info: "ℹ️",
};

export const showToast = (
  message = "Sample Message",
  toastType = "info",
  duration = 5000
) => {
  if (!Object.keys(icon).includes(toastType)) toastType = "info";

  let toastAlready = document.body.querySelector(".toast");
  if (toastAlready) {
    if (document.body.contains(toastAlready)) {
      document.body.removeChild(toastAlready);
    }
  }

  let box = document.createElement("div");
  box.classList.add("toast", `toast-${toastType}`);
  box.innerHTML = ` <div class="toast-content-wrapper">
                      <div class="toast-icon">
                      ${icon[toastType]}
                      </div>
                      <div class="toast-message">${message}</div>
                      <div class="toast-progress"></div>
                      </div>`;
  duration = duration || 5000;
  box.querySelector(".toast-progress").style.animationDuration = `${
    duration / 1000
  }s`;

  document.body.appendChild(box);

  setTimeout(() => {
    if (document.body.contains(box)) {
      box.classList.add("closing");

      setTimeout(() => {
        if (document.body.contains(box)) {
          document.body.removeChild(box);
        }
      }, 500);
    }
  }, duration);
};

export const showSuccessToast = (message, duration) =>
  showToast(message, "success", duration);
export const showErrorToast = (message, duration) =>
  showToast(message, "danger", duration);
export const showWarningToast = (message, duration) =>
  showToast(message, "warning", duration);
export const showInfoToast = (message, duration) =>
  showToast(message, "info", duration);
