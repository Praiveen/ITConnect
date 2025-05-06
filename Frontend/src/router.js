// Простой роутер для навигации по приложению

// Объект для хранения зарегистрированных маршрутов
const routes = {};

// Храним текущий маршрут для оптимизации отрисовки
let currentRoute = null;

// Функция для регистрации маршрутов
export function registerRoute(path, handler) {
  // Нормализуем путь (удаляем завершающий / если он есть)
  const normalizedPath = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;
  routes[normalizedPath] = handler;
}

// Функция для инициализации роутера
export function initRouter() {
  // Обработка изменения хэша в URL
  window.addEventListener('hashchange', handleRouteChange);
  
  // Начальная обработка текущего URL
  handleRouteChange();
  
  // Добавление обработчиков для ссылок с атрибутом data-route
  document.addEventListener('click', (e) => {
    const routeLink = e.target.closest('[data-route]');
    if (routeLink) {
      e.preventDefault();
      const route = routeLink.getAttribute('data-route');
      navigateTo(route);
    }
  });
}

// Функция для навигации к указанному маршруту
export function navigateTo(path) {
  // Разделяем путь на базовый маршрут и параметры запроса
  const [basePath, queryParams] = path.split('?');
  
  // Формируем новый хэш
  const newHash = queryParams ? `${basePath}?${queryParams}` : basePath;
  
  // Получаем текущий хэш без символа #
  const currentHash = window.location.hash.substring(1);
  
  // Если хэш уже такой же, ничего не делаем (избегаем циклических обновлений)
  if (currentHash === newHash) {
    console.log(`Навигация пропущена: уже находимся по адресу ${newHash}`);
    return;
  }
  
  // Проверяем наличие базового маршрута в зарегистрированных маршрутах
  if (routes[basePath]) {
    // Если есть параметры запроса, добавляем их к хэшу
    if (queryParams) {
      window.location.hash = `${basePath}?${queryParams}`;
    } else {
      window.location.hash = basePath;
    }
    console.log(`Навигация: переход на ${basePath}${queryParams ? '?' + queryParams : ''}`);
  } else {
    console.warn(`Маршрут "${basePath}" не найден`);
    window.location.hash = '/';
  }
}

// Обработчик изменения маршрута
function handleRouteChange() {
  // Получаем текущий путь из хэша URL и разделяем на базовый маршрут и параметры
  const hashPath = window.location.hash.substring(1);
  
  // Разбиваем маршрут на базовый путь и параметры
  const [basePath, queryParams] = hashPath.split('?');
  
  // Определяем базовый маршрут
  const routePath = basePath === '' ? '/' : basePath;
  
  // Если мы уже находимся на этом маршруте, не вызываем обработчик повторно
  // (нас интересует только базовый маршрут, не параметры)
  if (currentRoute === routePath) {
    console.log(`Маршрутизация: пропускаем повторный рендеринг для ${routePath}`);
    return;
  }
  
  // Проверка на пустой хэш (главная страница)
  if (hashPath === '') {
    const handler = routes['/'];
    if (handler) {
      console.log('Маршрутизация: переход на главную страницу');
      currentRoute = '/';
      handler();
    }
    return;
  }
  
  // Ищем обработчик для текущего маршрута
  const handler = routes[routePath];
  
  // Если обработчик найден, вызываем его
  if (handler) {
    console.log(`Маршрутизация: переход по маршруту ${routePath}${queryParams ? ' с параметрами: ' + queryParams : ''}`);
    currentRoute = routePath;
    handler();
  } else {
    // Если обработчик не найден, проверяем, является ли basePath корректным маршрутом
    // (например, если basePath = '/dashboard', а зарегистрирован маршрут '/dashboard')
    const normalizedPath = routePath.endsWith('/') ? routePath.slice(0, -1) : routePath;
    const alternativeHandler = routes[normalizedPath] || routes[normalizedPath + '/'];
    
    if (alternativeHandler) {
      console.log(`Маршрутизация: переход по альтернативному маршруту ${normalizedPath}${queryParams ? ' с параметрами: ' + queryParams : ''}`);
      currentRoute = normalizedPath;
      alternativeHandler();
    } else {
      // Если и альтернативный обработчик не найден, перенаправляем на главную страницу
      console.warn(`Маршрут "${routePath}" не найден, перенаправление на главную`);
      currentRoute = '/';
      window.location.hash = '/';
    }
  }
}

// Функция для проверки авторизации
export function isAuthenticated() {
  // В реальном приложении здесь будет проверка токена в localStorage или cookies
  return localStorage.getItem('auth_token') !== null;
}

// Функция для защиты маршрутов, требующих авторизации
export function protectRoute(handler, redirectPath = '/login') {
  return () => {
    if (isAuthenticated()) {
      handler();
    } else {
      console.warn('Доступ запрещен. Перенаправление на страницу входа');
      navigateTo(redirectPath);
    }
  };
} 