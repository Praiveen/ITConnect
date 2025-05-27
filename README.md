# ITConnect

ITConnect - это веб-приложение для эффективной коммуникации IT-команд, включающее в себя чаты, канбан-доски и рабочие пространства для совместной работы.

## Возможности

- Аутентификация и авторизация пользователей
- Управление рабочими пространствами и командами
- Чаты с real-time обменом сообщениями
- Канбан-доски для управления задачами
- Система уведомлений
- Управление профилем пользователя

## Структура проекта

Проект разделен на две основные части:
- `Frontend/` - клиентская часть на Vite.js
- `backend/` - серверная часть на Spring Boot

## Требования для локальной разработки

### Frontend
- Node.js (версия 16 или выше)
- npm (версия 8 или выше)

### Backend
- Java 17 или выше
- Gradle 7.x

## Установка и запуск для разработки

### Backend

1. Перейдите в директорию backend:
```bash
cd backend
```

2. Запустите приложение через Gradle:
```bash
./gradlew bootRun
```

Сервер будет доступен по адресу: `http://localhost:8080`

### Frontend

1. Перейдите в директорию Frontend:
```bash
cd Frontend
```

2. Установите зависимости:
```bash
npm install
```

3. Запустите приложение в режиме разработки:
```bash
npm run dev
```

Frontend будет доступен по адресу: `http://localhost:5173`

## Деплой

### Frontend (Vercel)

1. Создайте новый проект на Vercel
2. Подключите GitHub репозиторий
3. Укажите следующие настройки:
   - Framework Preset: `Vite`
   - Root Directory: `Frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`

#### Переменные окружения для Vercel:
```env
VITE_API_BASE_URL=https://your-backend-url.onrender.com
```

### Backend (Render)

1. Создайте новый Web Service на Render
2. Подключите GitHub репозиторий
3. Укажите следующие настройки:
   - Root Directory: `backend`
   - Runtime: `Docker`
   - Build Command: `./gradlew build`
   - Start Command: `java -jar build/libs/backend-0.0.1-SNAPSHOT.jar`

#### Переменные окружения для Render:
```env
SPRING_PROFILES_ACTIVE=prod
JWT_SECRET=your-secure-jwt-secret
DATABASE_URL=your-database-url
SPRING_DATASOURCE_USERNAME=your-db-username
SPRING_DATASOURCE_PASSWORD=your-db-password
ALLOWED_ORIGINS=https://your-frontend-url.vercel.app
PORT=8080
```

### База данных

1. Создайте PostgreSQL базу данных на Render
2. Получите URL подключения и учетные данные
3. Укажите их в переменных окружения для backend


