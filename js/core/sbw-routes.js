(function () {
  "use strict";

  const CURRENT_PRODUCT = "saberwolf";
  const CHAMPIONSHIP_LOCAL_PORT = "5501";

  // Preencher quando o domínio oficial da Championship for definido.
  const CHAMPIONSHIP_ORIGIN = "";

  const scriptElement =
    document.currentScript ||
    Array.from(document.scripts).find((script) =>
      /\/js\/core\/sbw-routes\.js(?:[?#]|$)/i.test(script.src)
    );

  // Este arquivo fica em js/core/, dois níveis abaixo da pasta do site.
  const SITE_BASE_URL = scriptElement?.src
    ? new URL("../../", scriptElement.src)
    : new URL("./", document.baseURI || window.location.href);

  const ROUTES = Object.freeze({
    home: "index.html",
    athletes: "atletas/atletas-sbw.html",
    communities: "comunidades/comunidades.html",
    content: "pages/conteudo.html",
    creators: "creators/creators.html",
    news: "blog/noticias.html",
    about: "pages/sobre.html",
    shop: "pages/loja.html",
    links: "links/index.html",
    terms: "pages/termos.html",
    privacy: "pages/privacidade.html",
    cookies: "pages/cookies.html"
  });

  const COMPETITIVE_PATH =
    /^\/(?:admin|auth|beta|equipes|organizadores|perfis|rankings|torneios|transferencias)(?:\/|$)/i;

  const INSTITUTIONAL_PATH =
    /^\/(?:$|(?:index|404|offline)\.html$|(?:atletas|blog|comunidades|creators|links|pages)(?:\/|$))/i;

  function getBasePath() {
    return SITE_BASE_URL.pathname;
  }

  function isLocalEnvironment() {
    return (
      ["http:", "https:"].includes(window.location.protocol) &&
      ["127.0.0.1", "localhost", "0.0.0.0", "::1", "[::1]"].includes(
        window.location.hostname
      )
    );
  }

  function getProductBaseUrl(product) {
    if (product === CURRENT_PRODUCT) {
      return new URL(SITE_BASE_URL.href);
    }

    if (product !== "championship") return null;

    if (isLocalEnvironment()) {
      const url = new URL("/", window.location.href);
      url.port = CHAMPIONSHIP_LOCAL_PORT;
      return url;
    }

    const configured =
      document
        .querySelector('meta[name="sbw-championship-origin"]')
        ?.content?.trim() || CHAMPIONSHIP_ORIGIN.trim();

    if (!configured) return null;

    try {
      const url = new URL(configured);

      if (!["http:", "https:"].includes(url.protocol)) return null;

      return new URL("/", url);
    } catch {
      return null;
    }
  }

  function productUrl(product, routePath = "/") {
    const baseUrl = getProductBaseUrl(product);
    if (!baseUrl) return "";

    const route = String(routePath || "/").trim();

    // O caminho deve pertencer ao produto escolhido.
    if (/^[a-z][a-z0-9+.-]*:/i.test(route)) return "";

    const cleanPath = route.replace(/^\/+/, "");
    const url = new URL("./" + cleanPath, baseUrl);

    if (!url.pathname.startsWith(baseUrl.pathname)) return "";

    return url.href;
  }

  function applyUrlOptions(url, params, hash) {
    if (params && typeof params === "object") {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.set(key, String(value));
        }
      });
    }

    if (hash !== undefined && hash !== null) {
      url.hash = String(hash);
    }
  }

  function getSitePath(url) {
    if (url.origin !== SITE_BASE_URL.origin) return null;

    const basePath = getBasePath();

    if (url.pathname === basePath.slice(0, -1)) return "/";

    if (url.pathname.startsWith(basePath)) {
      return "/" + url.pathname.slice(basePath.length);
    }

    // Reconhece também os caminhos antigos, como /blog/noticias.html.
    return url.pathname;
  }

  function toUrl(routeOrPath, params, hash) {
    const input = String(routeOrPath ?? "home").trim() || "home";

    const route = Object.prototype.hasOwnProperty.call(ROUTES, input)
      ? ROUTES[input]
      : input;

    if (route.startsWith("#") || /^(?:mailto:|tel:)/i.test(route)) {
      return route;
    }

    if (/^(?:https?:)?\/\//i.test(route)) {
      const externalUrl = new URL(route, SITE_BASE_URL);
      applyUrlOptions(externalUrl, params, hash);
      return externalUrl.href;
    }

    if (/^[a-z][a-z0-9+.-]*:/i.test(route)) return "";

    const basePath = getBasePath();
    const cleanPath = route.startsWith(basePath)
      ? route.slice(basePath.length)
      : route.replace(/^\/+/, "");

    const url = new URL("./" + cleanPath, SITE_BASE_URL);
    applyUrlOptions(url, params, hash);

    const sitePath = getSitePath(url);

    if (sitePath && COMPETITIVE_PATH.test(sitePath)) {
      return productUrl(
        "championship",
        sitePath + url.search + url.hash
      );
    }

    if (url.protocol === "file:") return url.href;

    return url.pathname + url.search + url.hash;
  }

  function rewriteLinks() {
    document.querySelectorAll("a[href]").forEach((anchor) => {
      const rawHref = anchor.getAttribute("href")?.trim();

      if (!rawHref || rawHref.startsWith("#")) return;

      let url;

      try {
        url = new URL(rawHref, document.baseURI || window.location.href);
      } catch {
        return;
      }

      if (!["http:", "https:", "file:"].includes(url.protocol)) return;

      const sitePath = getSitePath(url);
      if (sitePath === null) return;

      if (COMPETITIVE_PATH.test(sitePath)) {
        const destination = productUrl(
          "championship",
          sitePath + url.search + url.hash
        );

        if (!destination) {
          anchor.removeAttribute("href");
          anchor.setAttribute("aria-disabled", "true");
          anchor.setAttribute("title", "SBW Championship em preparação");
          return;
        }

        anchor.href = destination;
        anchor.target = "_blank";
        anchor.relList.add("noopener", "noreferrer");
        return;
      }

      if (INSTITUTIONAL_PATH.test(sitePath)) {
        anchor.href = productUrl(
          CURRENT_PRODUCT,
          sitePath + url.search + url.hash
        );
      }
    });
  }

  window.SBWRoutes = {
    currentProduct: CURRENT_PRODUCT,
    routes: { ...ROUTES },
    getBasePath,
    url: toUrl,
    productUrl,
    rewriteLinks,
    championship: (routePath) => productUrl("championship", routePath),
    home: () => toUrl("home"),
    athletes: () => toUrl("athletes"),
    communities: () => toUrl("communities"),
    content: () => toUrl("content"),
    creators: () => toUrl("creators"),
    news: () => toUrl("news"),
    about: () => toUrl("about"),
    shop: () => toUrl("shop"),
    links: () => toUrl("links"),
    terms: () => toUrl("terms"),
    privacy: () => toUrl("privacy"),
    cookies: () => toUrl("cookies")
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", rewriteLinks, {
      once: true
    });
  } else {
    rewriteLinks();
  }

  // Inclui os links criados pelos outros scripts durante o carregamento.
  window.addEventListener("load", rewriteLinks, { once: true });
})();