import { chatService } from "../services/chat-service.js";

import { workspaceService } from "../services/workspace-service.js";
import { authService } from "../services/auth-service.js";

let currentChatId = null;
let currentWorkspaceId = null;
let messageListener = null;
let currentReplyToMessageId = null;
let currentReplyToPreview = null;

const CHAT_HISTORY_CACHE_TIMEOUT = 5 * 60 * 1000;
let chatHistoryCache = {};
let lastChatHistoryFetchTime = {};

function getInitials(name) {
  if (!name) return "?";
  const words = name.split(" ");
  if (words.length > 1) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

function formatMessageTimestamp(dateString, isGrouped = false) {
  const date = new Date(dateString);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  if (isGrouped) {
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

function createMessageElement(msg, isContinuation = false) {
  const messageDiv = document.createElement("div");
  messageDiv.className = "chat-ui-message";
  if (isContinuation) {
    messageDiv.classList.add("is-continuation");
  }
  messageDiv.dataset.messageId = msg.id;
  messageDiv.dataset.senderId = msg.senderId;
  messageDiv.dataset.timestamp = msg.sentAt;
  messageDiv.dataset.originalContent = msg.content;

  const actionsToolbar = document.createElement("div");
  actionsToolbar.className = "chat-ui-message-actions";

  const currentUserId = authService.getUserId();

  actionsToolbar.innerHTML = `
        <button class="action-btn" data-action="add-reaction" title="Добавить реакцию">☺</button>
        <button class="action-btn" data-action="reply" title="Ответить">↩️</button>
        ${
          Number(msg.senderId) === Number(currentUserId)
            ? `<button class="action-btn edit-message-btn" data-action="edit" title="Редактировать">✎</button>
         <button class="action-btn delete-message-btn" data-action="delete" title="Удалить">🗑️</button>`
            : ""
        }
        <button class="action-btn" data-action="more" title="Ещё">…</button>
    `;
  messageDiv.appendChild(actionsToolbar);

  const avatarWrapper = document.createElement("div");
  avatarWrapper.className = "chat-ui-avatar-wrapper";
  const avatarPlaceholder = document.createElement("div");
  avatarPlaceholder.className = "chat-ui-avatar-placeholder";
  avatarPlaceholder.textContent = getInitials(msg.senderName);
  avatarWrapper.appendChild(avatarPlaceholder);
  messageDiv.appendChild(avatarWrapper);

  const messageBody = document.createElement("div");
  messageBody.className = "chat-ui-message-body";

  const messageHeader = document.createElement("div");
  messageHeader.className = "chat-ui-message-header";

  const senderNameSpan = document.createElement("span");
  senderNameSpan.className = "chat-ui-sender-name";
  senderNameSpan.textContent = msg.senderName || "Аноним";

  const timestampSpan = document.createElement("span");
  timestampSpan.className = "chat-ui-timestamp";
  timestampSpan.textContent = formatMessageTimestamp(msg.sentAt);

  messageHeader.appendChild(senderNameSpan);
  messageHeader.appendChild(timestampSpan);
  messageBody.appendChild(messageHeader);

  const messageTextDiv = document.createElement("div");
  messageTextDiv.className = "chat-ui-message-text";

  const textNode = document.createTextNode(msg.content);
  messageTextDiv.appendChild(textNode);

  if (msg.editedAt) {
    const editedMarkerSpan = document.createElement("span");
    editedMarkerSpan.className = "chat-ui-edited-marker";
    editedMarkerSpan.textContent = " (изменено)";
    messageTextDiv.appendChild(editedMarkerSpan);
  }

  if (msg.parentMessagePreview) {
    const replyDiv = document.createElement("div");
    replyDiv.className = "chat-reply-block";
    replyDiv.innerHTML = `
      <div class="reply-block-accent"></div>
      <div class="reply-block-main">
        <span class="reply-block-username">${
          msg.parentMessagePreview.senderName
        }</span>
        <span class="reply-block-content">${
          msg.parentMessagePreview.contentPreview || ""
        }</span>
      </div>
    `;
    replyDiv.style.cursor = "pointer";
    replyDiv.title = "Показать исходное сообщение";
    replyDiv.onclick = () => {
      const target = document.querySelector(
        `.chat-ui-message[data-message-id="${msg.parentMessagePreview.id}"]`
      );
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.classList.add("highlighted-message");
        setTimeout(() => target.classList.remove("highlighted-message"), 1800);
      }
    };
    messageBody.appendChild(replyDiv);
  }

  if (msg.attachmentUrl) {
    const attachmentDiv = document.createElement("div");
    attachmentDiv.className = "chat-ui-attachment-block";

    const isImage =
      msg.attachmentType &&
      /^image\/(jpeg|png|webp|gif|jpg)$/i.test(msg.attachmentType);

    if (isImage) {
      const img = document.createElement("img");
      img.className = "chat-attachment-image";
      img.src = `/api/files/${msg.id}/download`;
      img.alt = msg.attachmentName || "Изображение";
      img.loading = "lazy";
      img.onclick = () => {
        window.open(`/api/files/${msg.id}/download`, "_blank");
      };
      attachmentDiv.appendChild(img);
    } else {
      const iconSpan = document.createElement("span");
      iconSpan.className = "attachment-icon";
      if (
        msg.attachmentType &&
        msg.attachmentType.startsWith("application/pdf")
      ) {
        iconSpan.textContent = "📄";
      } else {
        iconSpan.textContent = "📎";
      }

      const nameSpan = document.createElement("span");
      nameSpan.className = "attachment-name";
      nameSpan.textContent = msg.attachmentName || "Вложение";

      const sizeSpan = document.createElement("span");
      sizeSpan.className = "attachment-size";
      if (msg.attachmentSize) {
        sizeSpan.textContent = `(${formatFileSize(msg.attachmentSize)})`;
      }

      const downloadBtn = document.createElement("button");
      downloadBtn.className = "chat-ui-attachment-download-btn";
      downloadBtn.type = "button";
      downloadBtn.title = "Скачать файл";
      downloadBtn.innerHTML = "⬇️";
      downloadBtn.onclick = async (e) => {
        e.preventDefault();
        try {
          const blob = await chatService.downloadFile(msg.id);
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = msg.attachmentName || "file";
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            URL.revokeObjectURL(url);
            a.remove();
          }, 100);
        } catch (err) {
          alert("Ошибка при скачивании файла: " + err.message);
        }
      };

      attachmentDiv.appendChild(iconSpan);
      attachmentDiv.appendChild(nameSpan);
      attachmentDiv.appendChild(sizeSpan);
      attachmentDiv.appendChild(downloadBtn);
    }

    messageBody.appendChild(attachmentDiv);
  }

  messageBody.appendChild(messageTextDiv);

  const editFormContainer = document.createElement("div");
  editFormContainer.className = "chat-ui-message-edit-form-container";
  editFormContainer.style.display = "none";
  editFormContainer.innerHTML = `
        <textarea class="chat-ui-message-edit-textarea"></textarea>
        <div class="chat-ui-edit-actions">
            <button class="chat-ui-edit-save-btn">Сохранить</button>
            <button class="chat-ui-edit-cancel-btn">Отмена</button>
        </div>
    `;
  messageBody.appendChild(editFormContainer);

  messageDiv.appendChild(messageBody);

  const editBtn = messageDiv.querySelector(".edit-message-btn");
  if (editBtn) {
    editBtn.addEventListener("click", () =>
      startEditMessage(messageDiv, msg.id)
    );
  }

  const deleteBtn = messageDiv.querySelector(".delete-message-btn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => confirmDeleteMessage(msg.id));
  }

  const replyBtn = messageDiv.querySelector('[data-action="reply"]');
  if (replyBtn) {
    replyBtn.addEventListener("click", () => {
      currentReplyToMessageId = msg.id;
      currentReplyToPreview = {
        senderName: msg.senderName,
        content: msg.content,
      };
      showReplyPreview();
    });
  }

  return messageDiv;
}

const MESSAGE_GROUPING_THRESHOLD_MINUTES = 5;

function renderChatMessages(messages) {
  const messagesContainer = document.getElementById("chat-messages");
  if (!messagesContainer) return;

  messagesContainer.innerHTML = "";
  let lastSenderId = null;
  let lastMessageTimestamp = null;

  messages.forEach((msg) => {
    let isContinuation = false;

    if (lastSenderId === msg.senderId && lastMessageTimestamp) {
      const currentTime = new Date(msg.sentAt);
      const lastTime = new Date(lastMessageTimestamp);
      const diffMinutes = (currentTime - lastTime) / (1000 * 60);
      if (diffMinutes < MESSAGE_GROUPING_THRESHOLD_MINUTES) {
        isContinuation = true;
      }
    }

    const messageElement = createMessageElement(msg, isContinuation);

    messagesContainer.appendChild(messageElement);

    lastSenderId = msg.senderId;
    lastMessageTimestamp = msg.sentAt;
  });
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function handleNewMessage(message) {
  const messagesContainer = document.getElementById("chat-messages");
  if (!messagesContainer) {
    return;
  }

  const messageChatId = Number(message.chatId);
  const activeChatId = Number(currentChatId);

  if (messageChatId !== activeChatId) {
    return;
  }

  const messageType = message.type || "NEW_MESSAGE";

  switch (messageType) {
    case "NEW_MESSAGE":

      if (chatHistoryCache[activeChatId]) {
        if (!chatHistoryCache[activeChatId].some((m) => m.id === message.id)) {
          chatHistoryCache[activeChatId].push(message);
        }
      } else {
      }

      let isContinuation = false;
      const lastMessageElement = messagesContainer.lastElementChild;

      if (
        lastMessageElement &&
        lastMessageElement.classList.contains("chat-ui-message") &&
        lastMessageElement.dataset.senderId &&
        lastMessageElement.dataset.timestamp
      ) {
        const prevSenderId = Number(lastMessageElement.dataset.senderId);
        const prevTimestamp = lastMessageElement.dataset.timestamp;

        if (prevSenderId === message.senderId) {
          const currentTime = new Date(message.sentAt);
          const lastTime = new Date(prevTimestamp);
          const diffMinutes = (currentTime - lastTime) / (1000 * 60);

          if (diffMinutes < MESSAGE_GROUPING_THRESHOLD_MINUTES) {
            isContinuation = true;
          }
        }
      }

      const newMessageElement = createMessageElement(message, isContinuation);
      messagesContainer.appendChild(newMessageElement);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      break;

    case "MESSAGE_EDITED":

      const editedMessageId = message.messageId || message.id;
      if (editedMessageId && message.payload) {
        updateMessageInDOM(editedMessageId, message.payload);
      } else {
      }
      break;

    case "MESSAGE_DELETED":

      const deletedMessageId = message.messageId || message.id;
      if (deletedMessageId) {
        deleteMessageFromDOM(deletedMessageId);
      } else {
      }
      break;

    default:
  }
}

async function loadChatHistory(chatId) {
  const messagesContainer = document.getElementById("chat-messages");
  const now = Date.now();


  const isCached = !!chatHistoryCache[chatId];
  const cacheTimestamp = lastChatHistoryFetchTime[chatId];
  const isCacheValid =
    isCached &&
    cacheTimestamp &&
    now - cacheTimestamp < CHAT_HISTORY_CACHE_TIMEOUT;


  if (isCacheValid) {
    renderChatMessages(chatHistoryCache[chatId]);
    setupChatInput();
    return;
  } else {
  }

  if (messagesContainer)
    messagesContainer.innerHTML =
      '<div class="chat-loading">Загрузка истории сообщений...</div>';

  if (!currentWorkspaceId || !chatId) {
    if (messagesContainer)
      messagesContainer.innerHTML =
        '<div class="chat-error">Ошибка: ID рабочего пространства или чата не определены.</div>';
    return;
  }

  try {
    const historyPage = await workspaceService.getChatMessages(
      currentWorkspaceId,
      chatId,
      0,
      50
    );
    if (historyPage && historyPage.content) {
      if (historyPage.content.length > 0) {
        renderChatMessages(historyPage.content);
      } else {
        if (messagesContainer)
          messagesContainer.innerHTML =
            '<div class="chat-empty">Сообщений пока нет.</div>';
      }

      chatHistoryCache[chatId] = historyPage.content;
      lastChatHistoryFetchTime[chatId] = now;
    } else {
      if (messagesContainer)
        messagesContainer.innerHTML =
          '<div class="chat-empty">Сообщений пока нет.</div>';

      chatHistoryCache[chatId] = [];
      lastChatHistoryFetchTime[chatId] = now;
    }
  } catch (error) {
    if (messagesContainer)
      messagesContainer.innerHTML = `<div class="chat-error">Не удалось загрузить сообщения: ${error.message}</div>`;
  }

  setupChatInput();
}

function setupChatInput() {
  const messageInput = document.getElementById("chat-message-input");
  const sendMessageButton = document.getElementById("send-chat-message-btn");
  const attachmentInput = document.getElementById("chat-attachment-input");
  const selectedFileBlock = document.getElementById("chat-selected-file-block");

  let selectedFile = null;

  function updateSelectedFileBlock() {
    if (selectedFile) {
      selectedFileBlock.innerHTML = `
        <span class="selected-file-icon">📎</span>
        <span class="selected-file-name">${selectedFile.name}</span>
        <span class="selected-file-size">(${formatFileSize(selectedFile.size)})</span>
        <button class="remove-selected-file-btn" title="Удалить файл">&times;</button>
      `;
      selectedFileBlock.style.display = "flex";
      selectedFileBlock.querySelector(".remove-selected-file-btn").onclick = () => {
        selectedFile = null;
        attachmentInput.value = "";
        updateSelectedFileBlock();
      };
    } else {
      selectedFileBlock.style.display = "none";
      selectedFileBlock.innerHTML = "";
    }
  }

  if (attachmentInput) {
    attachmentInput.addEventListener("change", (e) => {
      selectedFile = e.target.files[0] || null;
      updateSelectedFileBlock();
    });
  }

  
  const chatInputArea = document.querySelector(".chat-input-area");
  if (chatInputArea) {
    chatInputArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      chatInputArea.classList.add("dragover");
    });
    chatInputArea.addEventListener("dragleave", (e) => {
      e.preventDefault();
      chatInputArea.classList.remove("dragover");
    });
    chatInputArea.addEventListener("drop", (e) => {
      e.preventDefault();
      chatInputArea.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        selectedFile = e.dataTransfer.files[0];
        attachmentInput.value = ""; 
        updateSelectedFileBlock();
      }
    });
  }

  const sendMessageHandler = async () => {
    if (!currentChatId || !messageInput) return;
    const content = messageInput.value.trim();

    let attachmentData = null;
    if (selectedFile) {
      try {
        attachmentData = await chatService.uploadFile(selectedFile);
      } catch (e) {
        alert("Ошибка загрузки файла: " + e.message);
        return;
      }
    }

    if (content || attachmentData) {
      const payload = {
        content,
        parentMessageId: currentReplyToMessageId,
        attachmentUrl: attachmentData?.url,
        attachmentName: attachmentData?.name,
        attachmentType: attachmentData?.type,
        attachmentSize: attachmentData?.size,
      };
      chatService.sendMessageWithAttachment(currentChatId, payload);
      messageInput.value = "";
      if (attachmentInput) attachmentInput.value = "";
      selectedFile = null;
      updateSelectedFileBlock();
      currentReplyToMessageId = null;
      currentReplyToPreview = null;
      const replyPreview = document.getElementById("reply-preview");
      if (replyPreview) replyPreview.style.display = "none";
    }
  };

  if (sendMessageButton) {
    sendMessageButton.onclick = sendMessageHandler;
  }
  if (messageInput) {
    messageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessageHandler();
      }
    });
  }
}

export async function renderChatPage(chatId, workspaceId) {
  currentChatId = chatId;
  currentWorkspaceId = workspaceId;

  const appContainer = document.querySelector(".dashboard-content");
  if (!appContainer) {
    return;
  }

  let chatName = `Чат ${chatId}`;
  try {
    if (workspaceId && chatId) {
      const chatDetails = await workspaceService.getChatById(
        workspaceId,
        chatId
      );
      if (chatDetails) chatName = chatDetails.name;
    }
  } catch (e) {
  }

  appContainer.innerHTML = `
        <div class="chat-window-container">
            <div class="chat-header">
                <h2 id="chat-name-header">${chatName}</h2>
            </div>
            <div id="chat-messages" class="chat-messages-container">
                <div class="chat-loading">Подключение к чату...</div>
            </div>
            <div class="chat-input-area">
                <textarea id="chat-message-input" placeholder="Введите сообщение..."></textarea>
                <div id="chat-selected-file-block" class="chat-selected-file-block" style="display:none;"></div>
                <label class="chat-attach-label" title="Прикрепить файл">
                    <input type="file" id="chat-attachment-input" style="display:none;" />
                    <span class="chat-attach-icon">📎</span>
                </label>
                <button id="send-chat-message-btn" class="btn-primary">Отправить</button>
            </div>
        </div>
    `;

  if (messageListener && currentChatId && chatService.stompClient) {
    chatService.unsubscribeFromChat(currentChatId, messageListener);
  }
  messageListener = handleNewMessage;

  try {
    await chatService.subscribeToChat(currentChatId, messageListener);


    if (currentWorkspaceId && currentChatId) {
      await loadChatHistory(currentChatId);
    } else {
      const messagesContainer = document.getElementById("chat-messages");
      if (messagesContainer)
        messagesContainer.innerHTML =
          '<div class="chat-error">Ошибка: ID чата или рабочего пространства не определены.</div>';
    }
  } catch (error) {
    const messagesContainer = document.getElementById("chat-messages");
    if (messagesContainer)
      messagesContainer.innerHTML =
        '<div class="chat-error">Не удалось подключиться к чату или загрузить историю.</div>';
  }

  setupChatInput();
}

export function cleanupChatPage() {
  if (
    currentChatId &&
    messageListener &&
    chatService.stompClient &&
    chatService.stompClient.connected
  ) {
    chatService.unsubscribeFromChat(currentChatId, messageListener);
  }

  currentChatId = null;
  currentWorkspaceId = null;
  messageListener = null;

  const messagesContainer = document.getElementById("chat-messages");
  if (messagesContainer) {
  }

}

function startEditMessage(messageDiv, messageId) {
  const messageTextDiv = messageDiv.querySelector(".chat-ui-message-text");
  const editFormContainer = messageDiv.querySelector(
    ".chat-ui-message-edit-form-container"
  );
  const editTextarea = editFormContainer.querySelector(
    ".chat-ui-message-edit-textarea"
  );
  const originalContent =
    messageDiv.dataset.originalContent || messageTextDiv.textContent;

  if (!messageTextDiv || !editFormContainer || !editTextarea) return;

  messageTextDiv.style.display = "none";
  editFormContainer.style.display = "block";
  editTextarea.value = originalContent;
  editTextarea.focus();
  editTextarea.selectionStart = editTextarea.selectionEnd =
    editTextarea.value.length;

  const messagesContainer = document.getElementById("chat-messages");
  if (messagesContainer) {
    const formRect = editFormContainer.getBoundingClientRect();
    const containerRect = messagesContainer.getBoundingClientRect();

    if (formRect.bottom > containerRect.bottom) {
      messagesContainer.scrollTop +=
        formRect.bottom - containerRect.bottom + 10;
    }
  }

  const saveBtn = editFormContainer.querySelector(".chat-ui-edit-save-btn");
  const cancelBtn = editFormContainer.querySelector(".chat-ui-edit-cancel-btn");

  const newSaveBtn = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
  const newCancelBtn = cancelBtn.cloneNode(true);
  cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

  newSaveBtn.onclick = async () => {
    const newContent = editTextarea.value.trim();
    if (newContent && newContent !== originalContent) {
      if (!chatService || typeof chatService.editMessage !== "function") {

        finishEditMessage(messageDiv);
        return;
      }

      try {
        await chatService.editMessage(currentChatId, messageId, newContent);
      } catch (error) {
      }
    }
    finishEditMessage(messageDiv);
  };

  newCancelBtn.onclick = () => {
    finishEditMessage(messageDiv);
  };

  editTextarea.onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      newSaveBtn.click();
    } else if (e.key === "Escape") {
      e.preventDefault();
      newCancelBtn.click();
    }
  };
}

function finishEditMessage(messageDiv) {
  const messageTextDiv = messageDiv.querySelector(".chat-ui-message-text");
  const editFormContainer = messageDiv.querySelector(
    ".chat-ui-message-edit-form-container"
  );

  if (messageTextDiv && editFormContainer) {
    messageTextDiv.style.display = "block";
    editFormContainer.style.display = "none";
  }
}

async function confirmDeleteMessage(messageId) {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";

  modalOverlay.innerHTML = `
        <div class="modal-container">
            <div class="modal-header">
                <h3 class="modal-title">Удалить сообщение</h3>
                <button class="modal-close" aria-label="Закрыть">&times;</button>
            </div>
            <div class="modal-body">
                <p>Вы уверены, что хотите удалить это сообщение?</p>
                <p class="warning-text">Это действие нельзя будет отменить.</p>
            </div>
            <div class="modal-footer">
                <button class="modal-secondary-btn" id="cancelDeleteMessageBtn">Отмена</button>
                <button class="modal-danger-btn" id="confirmDeleteMessageBtn">Удалить</button>
            </div>
        </div>
    `;

  document.body.appendChild(modalOverlay);

  requestAnimationFrame(() => {
    modalOverlay.classList.add("active");
  });

  const closeModal = () => {
    modalOverlay.classList.remove("active");

    modalOverlay.addEventListener(
      "transitionend",
      () => {
        if (modalOverlay.parentNode) {
          modalOverlay.parentNode.removeChild(modalOverlay);
        }
      },
      { once: true }
    );
  };

  const confirmBtn = modalOverlay.querySelector("#confirmDeleteMessageBtn");
  const cancelBtn = modalOverlay.querySelector("#cancelDeleteMessageBtn");
  const closeIconBtn = modalOverlay.querySelector(".modal-close");

  return new Promise((resolve) => {
    confirmBtn.onclick = async () => {
      closeModal();
      if (!chatService || typeof chatService.deleteMessage !== "function") {
        resolve(false);
        return;
      }
      try {
        await chatService.deleteMessage(currentChatId, messageId);
        resolve(true);
      } catch (error) {

        resolve(false);
      }
    };

    cancelBtn.onclick = () => {
      closeModal();
      resolve(false);
    };

    closeIconBtn.onclick = () => {
      closeModal();
      resolve(false);
    };

    modalOverlay.onclick = (event) => {
      if (event.target === modalOverlay) {
        closeModal();
        resolve(false);
      }
    };
  });
}

function updateMessageInDOM(messageId, updatedData) {
  const messageDiv = document.querySelector(
    `.chat-ui-message[data-message-id="${messageId}"]`
  );
  if (!messageDiv) return;

  const messageTextDiv = messageDiv.querySelector(".chat-ui-message-text");

  if (updatedData.content && messageTextDiv) {
    messageTextDiv.innerHTML = "";

    const textNode = document.createTextNode(updatedData.content);
    messageTextDiv.appendChild(textNode);

    if (updatedData.editedAt) {
      let editedMarker = messageTextDiv.querySelector(".chat-ui-edited-marker");
      if (!editedMarker) {
        editedMarker = document.createElement("span");
        editedMarker.className = "chat-ui-edited-marker";
        editedMarker.textContent = " (изменено)";
        messageTextDiv.appendChild(editedMarker);
      }
    } else {
      let existingMarker = messageTextDiv.querySelector(
        ".chat-ui-edited-marker"
      );
      if (existingMarker) {
        existingMarker.remove();
      }
    }

    messageDiv.dataset.originalContent = updatedData.content;
  }

  if (currentChatId && chatHistoryCache[currentChatId]) {
    const msgIndex = chatHistoryCache[currentChatId].findIndex(
      (m) => m.id === messageId
    );
    if (msgIndex !== -1) {
      chatHistoryCache[currentChatId][msgIndex].content = updatedData.content;
      chatHistoryCache[currentChatId][msgIndex].editedAt = updatedData.editedAt;
    }
  }
}

function deleteMessageFromDOM(messageId) {
  const messageDiv = document.querySelector(
    `.chat-ui-message[data-message-id="${messageId}"]`
  );
  if (messageDiv) {
    messageDiv.remove();
  }

  if (currentChatId && chatHistoryCache[currentChatId]) {
    chatHistoryCache[currentChatId] = chatHistoryCache[currentChatId].filter(
      (m) => m.id !== messageId
    );

    if (chatHistoryCache[currentChatId].length === 0) {
      const messagesContainer = document.getElementById("chat-messages");
      if (messagesContainer && messagesContainer.children.length === 0) {
        messagesContainer.innerHTML =
          '<div class="chat-empty">Сообщений пока нет.</div>';
      }
    }
  }
}

function showReplyPreview() {
  let replyPreview = document.getElementById("reply-preview");
  const chatInputArea = document.querySelector(".chat-input-area");
  if (!replyPreview) {
    replyPreview = document.createElement("div");
    replyPreview.id = "reply-preview";
    replyPreview.className = "chat-reply-preview-block";
    chatInputArea.parentNode.insertBefore(replyPreview, chatInputArea);
  }
  replyPreview.innerHTML = `
    <div class="reply-preview-main">
      <div class="reply-preview-label">Отвечает на <b>${
        currentReplyToPreview.senderName
      }</b></div>
      <div class="reply-preview-content">${currentReplyToPreview.content.slice(
        0,
        120
      )}${currentReplyToPreview.content.length > 120 ? "..." : ""}</div>
    </div>
    <button class="cancel-reply-btn" title="Отменить ответ">&times;</button>
  `;
  replyPreview.style.display = "flex";
  replyPreview.querySelector(".cancel-reply-btn").onclick = () => {
    currentReplyToMessageId = null;
    currentReplyToPreview = null;
    replyPreview.style.display = "none";
  };

  setTimeout(() => {
    const messagesContainer = document.getElementById("chat-messages");
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }, 0);
}

function formatFileSize(bytes) {
  if (!bytes) return "";
  const sizes = ["Б", "КБ", "МБ", "ГБ"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + " " + sizes[i];
}
