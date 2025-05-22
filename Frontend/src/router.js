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
    return;
  }

  if (routes[basePath]) {
    if (queryParams) {
      window.location.hash = `${basePath}?${queryParams}`;
    } else {
      window.location.hash = basePath;
    }

  } else {
    window.location.hash = "/";
  }
}

function handleRouteChange() {
  const hashPath = window.location.hash.substring(1);

  const [basePath, queryParams] = hashPath.split("?");

  const routePath = basePath === "" ? "/" : basePath;

  if (currentRoute === routePath) {
    return;
  }

  if (hashPath === "") {
    const handler = routes["/"];
    if (handler) {
      currentRoute = "/";
      handler();
    }
    return;
  }

  const handler = routes[routePath];

  if (handler) {

    currentRoute = routePath;
    handler();
  } else {
    const normalizedPath = routePath.endsWith("/")
      ? routePath.slice(0, -1)
      : routePath;
    const alternativeHandler =
      routes[normalizedPath] || routes[normalizedPath + "/"];

    if (alternativeHandler) {

      currentRoute = normalizedPath;
      alternativeHandler();
    } else {

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
      navigateTo(redirectPath);
    }
  };
}
