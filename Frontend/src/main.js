import './css/main.css'
import javascriptLogo from './javascript.svg'
import viteLogo from '/vite.svg'
import logo_ITConnect from '/logo_ITConnect.png'
import { authService } from './services/auth-service.js'
import { initRouter, registerRoute, navigateTo } from './router.js'
import { renderHeader, setupHeaderEventListeners } from './components/Header.js'
import { renderFooter } from './components/Footer.js'

// Рендерим главную страницу
function renderHomePage() {
  document.querySelector('#app').innerHTML = `
    <div class="app-container">
      <!-- Header -->
      ${renderHeader()}

      <!-- Hero Section -->
      <section class="hero">
        <h1 class="hero-title">Упрощайте коммуникацию в IT-команде</h1>
        <p class="hero-subtitle">ITConnect — платформа для эффективного обмена сообщениями внутри IT-команд, которая помогает ускорить разработку и улучшить взаимодействие</p>
        ${!authService.isAuthenticated() ? 
          `<button class="btn-register">Начать бесплатно</button>` : 
          `<button class="btn-dashboard">Перейти к сообщениям</button>`
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
          <div class="feature-icon">📁</div>
          <h3>Обмен файлами</h3>
          <p>Легко делитесь документами, кодом и другими ресурсами</p>
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
  `

  // Добавим обработчики событий для элементов хедера
  setupHeaderEventListeners();
  
  // Добавим обработчики для кнопок главной страницы
  setupHomePageButtons();
}

// Функция настройки обработчиков кнопок главной страницы
function setupHomePageButtons() {
  // Кнопки регистрации
  document.querySelectorAll('.btn-register').forEach(button => {
    button.addEventListener('click', () => {
      console.log('Переход на страницу регистрации')
      import('./pages/register.js').then(module => {
        module.renderRegisterPage()
      })
    })
  })
  
  // Кнопка перехода к сообщениям (если пользователь авторизован)
  document.querySelectorAll('.btn-dashboard').forEach(button => {
    button.addEventListener('click', () => {
      console.log('Переход к дашборду')
      navigateTo('/dashboard')
    })
  })
}

// Инициализация маршрутов
function initializeRoutes() {
  registerRoute('/', renderHomePage)
  
  registerRoute('/login', () => {
    import('./pages/auth.js').then(module => {
      module.renderLoginPage()
    })
  })
  
  registerRoute('/register', () => {
    import('./pages/register.js').then(module => {
      module.renderRegisterPage()
    })
  })
  
  registerRoute('/profile', () => {
    import('./pages/profile.js').then(module => {
      module.renderProfilePage()
    })
  })
  
  registerRoute('/dashboard', () => {
    import('./pages/dashboard.js').then(module => {
      module.renderDashboardPage()
    })
  })
  
  // Здесь можно добавить другие маршруты
}

// Функция проверки состояния аутентификации
async function checkAuthState() {
  try {
    // Проверяем состояние авторизации при загрузке приложения, получая данные профиля
    try {
      await authService.getUserProfile();
      console.log('Статус авторизации: авторизован');
      
      // Если есть сохраненный редирект после авторизации, перенаправляем пользователя
      const redirectAfterAuth = sessionStorage.getItem('redirectAfterAuth');
      if (redirectAfterAuth) {
        sessionStorage.removeItem('redirectAfterAuth');
        navigateTo(redirectAfterAuth);
        return true;
      }
    } catch (error) {
      console.log('Статус авторизации: не авторизован');
      // Если ошибка при проверке профиля - пользователь не авторизован, просто продолжаем
    }
    
    return false;
  } catch (error) {
    console.error('Ошибка при проверке авторизации:', error);
    return false;
  }
}

// Инициализация приложения
async function initApp() {
  // Инициализируем маршруты
  initializeRoutes()
  // Инициализируем роутер
  initRouter()
  
  // Проверка наличия хэша в URL
  const hash = window.location.hash;
  if (hash && hash.length > 1) {
    console.log('Обнаружен хэш в URL:', hash);
    // Не рендерим главную страницу, позволяем роутеру обработать текущий хэш
    return;
  }
  
  // Проверяем состояние авторизации и перенаправляем если нужно
  const shouldRedirect = await checkAuthState();
  if (!shouldRedirect) {
    // Рендерим главную страницу
    renderHomePage()
  }
}

// Запуск приложения
initApp()


function getCookies() {
  // Получаем строку всех куки
  const cookies = document.cookie;
  
  // Проверяем, есть ли куки
  if (cookies) {
      // Разделяем куки на отдельные пары "ключ=значение"
      const cookieArray = cookies.split('; ');

      // Выводим каждую пару куки в консоль
      cookieArray.forEach(cookie => {
          console.log(cookie);
      });
  } else {
      console.log("Куки не найдены.");
  }
}

// Вызов функции для вывода куки
getCookies();
