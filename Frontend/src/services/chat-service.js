import SockJS from "sockjs-client/dist/sockjs.min.js";
import Stomp from "stompjs";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function getApiUrl(path) {
  // path должен начинаться с /
  if (API_BASE_URL) {
    return API_BASE_URL + path;
  }
  // Если переменная не задана (локальная разработка) — используем прокси
  return '/api' + path;
}

// Для WebSocket нужен полный адрес
const SOCKET_URL = getApiUrl('/ws');

class ChatService {
  constructor() {
    this.stompClient = null;
    this.subscriptions = new Map();
    this.messageListeners = new Map();
    this.connectionPromise = null;
    this.isConnecting = false;
    this.hasConnectFailedRecently = false;
  }

  connect() {
    if (this.stompClient && this.stompClient.connected) {
      console.log("STOMP клиент уже подключен.");
      return Promise.resolve(this.stompClient.connected);
    }

    if (this.isConnecting && this.connectionPromise) {
      console.log("STOMP клиент уже в процессе подключения.");
      return this.connectionPromise.then(() => true).catch(() => false);
    }

    if (this.hasConnectFailedRecently) {
      console.warn(
        "Предыдущая попытка подключения не удалась, новая попытка отложена."
      );
      return Promise.resolve(false);
    }

    this.isConnecting = true;
    this.hasConnectFailedRecently = false;
    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        console.log("Создание SockJS подключения к:", SOCKET_URL);
        const socket = new SockJS(SOCKET_URL);
        this.stompClient = Stomp.over(socket);
        this.stompClient.debug = (str) => {};

        const headers = {};

        this.stompClient.connect(
          headers,
          (frame) => {
            console.log("STOMP подключение установлено успешно. Frame:", frame);
            this.isConnecting = false;

            resolve(true);
          },
          (error) => {
            console.error("Ошибка STOMP подключения:", error);
            this.isConnecting = false;
            this.stompClient = null;
            this.connectionPromise = null;
            this.hasConnectFailedRecently = true;

            setTimeout(() => {
              this.hasConnectFailedRecently = false;
            }, 5000);
            reject(error);
          }
        );
      } catch (error) {
        console.error("Ошибка при инициализации STOMP клиента:", error);
        this.isConnecting = false;
        this.connectionPromise = null;
        this.hasConnectFailedRecently = true;
        setTimeout(() => {
          this.hasConnectFailedRecently = false;
        }, 5000);
        reject(error);
      }
    });
    return this.connectionPromise
      .then(() => true)
      .catch((err) => {
        console.error("Возвращаем false из промиса connect из-за ошибки:", err);
        return Promise.resolve(false);
      });
  }

  disconnect() {
    if (this.stompClient && this.stompClient.connected) {
      this.subscriptions.forEach((sub) => sub.unsubscribe());
      this.subscriptions.clear();
      this.stompClient.disconnect(() => {
        console.log("STOMP клиент отключен.");
      });
      this.stompClient = null;
    }
  }

  async subscribeToChat(chatId, onMessageReceived) {
    if (!this.stompClient || !this.stompClient.connected) {
      console.warn(
        "STOMP не подключен. Попытка подключения перед подпиской на чат",
        chatId
      );
      try {
        const connected = await this.connect();
        if (!connected) {
          console.error(
            "Не удалось подключиться к STOMP для подписки на чат",
            chatId
          );

          return;
        }
        console.log(
          "STOMP подключен (из subscribeToChat), выполняем подписку."
        );
      } catch (error) {
        console.error(
          "Ошибка при попытке подключения в subscribeToChat:",
          error
        );
        return;
      }
    }

    this._performStompSubscription(chatId, onMessageReceived);
  }

  _performStompSubscription(chatId, onMessageReceived, isResubscribe = false) {
    if (!this.stompClient || !this.stompClient.connected) {
      console.error(
        `_performStompSubscription: STOMP не подключен для чата ${chatId}. Попытка отменена.`
      );
      return;
    }

    const topic = `/topic/chat/${chatId}`;

    if (this.subscriptions.has(chatId) && !isResubscribe) {
      console.log(`Уже подписаны на ${topic}. Добавляем слушателя.`);
      this.addMessageListener(chatId, onMessageReceived);
      return;
    }

    if (this.subscriptions.has(chatId) && isResubscribe) {
      this.subscriptions.get(chatId).unsubscribe();
      this.subscriptions.delete(chatId);
      console.log(
        `Отписались от старой подписки на ${topic} перед переподпиской.`
      );
    }

    console.log(`Подписка на STOMP топик: ${topic}`);
    try {
      const subscription = this.stompClient.subscribe(topic, (message) => {
        const parsedMessage = JSON.parse(message.body);
        if (this.messageListeners.has(chatId)) {
          this.messageListeners.get(chatId).forEach((listener) => {
            try {
              listener(parsedMessage);
            } catch (e) {
              console.error("Ошибка в слушателе сообщения чата:", e);
            }
          });
        }
      });
      this.subscriptions.set(chatId, subscription);
      this.addMessageListener(chatId, onMessageReceived);
      console.log(`Успешно подписаны на ${topic}`);
    } catch (error) {
      console.error(`Ошибка при подписке на STOMP топик ${topic}:`, error);
    }
  }

  unsubscribeFromChat(chatId, onMessageReceivedCallback) {
    this.removeMessageListener(chatId, onMessageReceivedCallback);

    if (
      this.messageListeners.has(chatId) &&
      this.messageListeners.get(chatId).size === 0
    ) {
      if (this.subscriptions.has(chatId)) {
        this.subscriptions.get(chatId).unsubscribe();
        this.subscriptions.delete(chatId);
        this.messageListeners.delete(chatId);
        console.log(`Отписались от STOMP топика для чата ${chatId}`);
      }
    }
  }

  sendMessage(chatId, messageContent, parentMessageId = null) {
    if (!this.stompClient || !this.stompClient.connected) {
      console.error("Невозможно отправить сообщение: STOMP не подключен.");
      return;
    }
    if (!chatId || !messageContent.trim()) {
      console.error("ChatId и текст сообщения не могут быть пустыми.");
      return;
    }

    const destination = `/app/chat.sendMessage/${chatId}`;
    const payload = {
      content: messageContent,
    };
    if (parentMessageId) {
      payload.parentMessageId = parentMessageId;
    }

    try {
      this.stompClient.send(destination, {}, JSON.stringify(payload));
      console.log(`STOMP: сообщение отправлено на ${destination}:`, payload);
    } catch (error) {
      console.error(
        `Ошибка при отправке STOMP сообщения на ${destination}:`,
        error
      );
    }
  }

  addMessageListener(chatId, callback) {
    if (!this.messageListeners.has(chatId)) {
      this.messageListeners.set(chatId, new Set());
    }
    this.messageListeners.get(chatId).add(callback);
  }

  removeMessageListener(chatId, callback) {
    if (this.messageListeners.has(chatId)) {
      this.messageListeners.get(chatId).delete(callback);
    }
  }

  async editMessage(chatId, messageId, newContent) {
    if (this.stompClient && this.stompClient.connected) {
      const destination = `/app/chat.editMessage/${chatId}/${messageId}`;
      const payload = { content: newContent };
      this.stompClient.send(destination, {}, JSON.stringify(payload));
      console.log(
        `ChatService: Edit message request sent to ${destination}`,
        payload
      );
    } else {
      console.error(
        "ChatService: STOMP client not connected. Cannot edit message."
      );

      throw new Error("STOMP client not connected for editing message");
    }
  }

  async deleteMessage(chatId, messageId) {
    if (this.stompClient && this.stompClient.connected) {
      const destination = `/app/chat.deleteMessage/${chatId}/${messageId}`;

      this.stompClient.send(destination, {}, JSON.stringify({}));
      console.log(`ChatService: Delete message request sent to ${destination}`);
    } else {
      console.error(
        "ChatService: STOMP client not connected. Cannot delete message."
      );
      throw new Error("STOMP client not connected for deleting message");
    }
  }
}

export const chatService = new ChatService();
export { getApiUrl };
