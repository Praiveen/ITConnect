const routes = {};

let currentRoute = null;

export function registerRoute(path, handler) {
  const normalizedPath =
    path.endsWith("/") && path !== "/" ? path.slice(0, -1) : path;
  routes[normalizedPath] = handler;
}

export function initRouter() {
  window.addEventListener("hashchange", handleRouteChange);

  handleRouteChange();

  document.addEventListener("click", (e) => {
    const routeLink = e.target.closest("[data-route]");
    if (routeLink) {
      e.preventDefault();
      const route = routeLink.getAttribute("data-route");
      navigateTo(route);
    }
  });
}

export function navigateTo(path) {
  const [basePath, queryParams] = path.split("?");

  const newHash = queryParams ? `${basePath}?${queryParams}` : basePath;

  const currentHash = window.location.hash.substring(1);

  if (currentHash === newHash) {
    console.log(`Навигация пропущена: уже находимся по адресу ${newHash}`);
    return;
  }

  if (routes[basePath]) {
    if (queryParams) {
      window.location.hash = `${basePath}?${queryParams}`;
    } else {
      window.location.hash = basePath;
    }
    console.log(
      `Навигация: переход на ${basePath}${queryParams ? "?" + queryParams : ""}`
    );
  } else {
    console.warn(`Маршрут "${basePath}" не найден`);
    window.location.hash = "/";
  }
}

function handleRouteChange() {
  const hashPath = window.location.hash.substring(1);

  const [basePath, queryParams] = hashPath.split("?");

  const routePath = basePath === "" ? "/" : basePath;

  if (currentRoute === routePath) {
    console.log(
      `Маршрутизация: пропускаем повторный рендеринг для ${routePath}`
    );
    return;
  }

  if (hashPath === "") {
    const handler = routes["/"];
    if (handler) {
      console.log("Маршрутизация: переход на главную страницу");
      currentRoute = "/";
      handler();
    }
    return;
  }

  const handler = routes[routePath];

  if (handler) {
    console.log(
      `Маршрутизация: переход по маршруту ${routePath}${
        queryParams ? " с параметрами: " + queryParams : ""
      }`
    );
    currentRoute = routePath;
    handler();
  } else {
    const normalizedPath = routePath.endsWith("/")
      ? routePath.slice(0, -1)
      : routePath;
    const alternativeHandler =
      routes[normalizedPath] || routes[normalizedPath + "/"];

    if (alternativeHandler) {
      console.log(
        `Маршрутизация: переход по альтернативному маршруту ${normalizedPath}${
          queryParams ? " с параметрами: " + queryParams : ""
        }`
      );
      currentRoute = normalizedPath;
      alternativeHandler();
    } else {
      console.warn(
        `Маршрут "${routePath}" не найден, перенаправление на главную`
      );
      currentRoute = "/";
      window.location.hash = "/";
    }
  }
}

export function isAuthenticated() {
  return localStorage.getItem("auth_token") !== null;
}

export function protectRoute(handler, redirectPath = "/login") {
  return () => {
    if (isAuthenticated()) {
      handler();
    } else {
      console.warn("Доступ запрещен. Перенаправление на страницу входа");
      navigateTo(redirectPath);
    }
  };
}
