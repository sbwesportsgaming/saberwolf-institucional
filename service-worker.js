/*
  SBW Project — PWA hospedado em sbwgg.com.br.
  Central do aplicativo, páginas públicas e arquivos estáticos.
*/

"use strict";

const SITE_BASE_URL = new URL(self.registration.scope);
const CACHE_VERSION = "2026-10-08-project-1";

// Mantém o prefixo anterior para limpar somente o cache deste site.
const CACHE_PREFIX =
  "saberwolf-esports:" +
  encodeURIComponent(SITE_BASE_URL.href) +
  ":";

const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;
const HOME_URL = SITE_BASE_URL.href;
const APP_URL = new URL("app/", SITE_BASE_URL).href;
const OFFLINE_URL = new URL("offline.html", SITE_BASE_URL).href;
const OFFLINE_CACHE_KEY = new URL("offline", SITE_BASE_URL).href;

const OPTIONAL_PRECACHE = [
  { path: "index.html", isDocument: true },
  { path: "app/index.html", isDocument: true },
  { path: "manifest.webmanifest", isDocument: false },
  {
    path: "manifest.webmanifest?v=20260902-16841",
    isDocument: false
  },
  {
    path: "manifest.webmanifest?v=20261008-project-1",
    isDocument: false
  },
  {
    path: "assets/icons/sbw-project-app-192.png",
    isDocument: false
  },
  {
    path: "assets/icons/sbw-project-app-512.png",
    isDocument: false
  },
  {
    path: "assets/icons/sbw-project-app-180.png",
    isDocument: false
  },
  { path: "assets/icons/icon-192-v3.png", isDocument: false },
  { path: "assets/icons/icon-512-v3.png", isDocument: false },
  {
    path: "assets/icons/apple-touch-icon-v3.png",
    isDocument: false
  },
  {
    path: "assets/images/sbw-esports-oficial.png",
    isDocument: false
  },
  {
    path: "assets/images/sbw-championship-oficial.png",
    isDocument: false
  },
  {
    path: "assets/images/sbw-concept-oficial.png",
    isDocument: false
  },
  { path: "js/pwa/sbw-pwa.js", isDocument: false },
  {
    path: "js/pwa/sbw-pwa.js?v=20260902-16841",
    isDocument: false
  },
  {
    path: "js/pwa/sbw-pwa.js?v=20261008-project-1",
    isDocument: false
  }
];

const PUBLIC_PAGES = new Set([
  "",
  "app/",
  "offline",
  "404",
  "pages/sobre",
  "pages/conteudo",
  "pages/loja",
  "pages/termos",
  "pages/privacidade",
  "pages/cookies"
]);

function getSitePath(url) {
  if (
    url.origin !== SITE_BASE_URL.origin ||
    !url.pathname.startsWith(SITE_BASE_URL.pathname)
  ) {
    return null;
  }

  return url.pathname.slice(SITE_BASE_URL.pathname.length);
}

function normalizeDocumentPath(path) {
  if (path === "app") return "app/";

  // Compatível com os endereços sem .html usados pelo Cloudflare Pages.
  return path
    .replace(/(^|\/)index\.html?$/i, "$1")
    .replace(/\.html?$/i, "");
}

function isPublicPage(path) {
  const normalized = normalizeDocumentPath(path);

  if (PUBLIC_PAGES.has(normalized)) return true;

  if (!/^(atletas|blog|comunidades|creators|links)(\/|$)/i.test(path)) {
    return false;
  }

  const filename = path.split("/").pop();

  return (
    !filename ||
    !filename.includes(".") ||
    /\.html?$/i.test(filename)
  );
}

function isStaticAsset(path) {
  return (
    path === "manifest.webmanifest" ||
    /^css\/.+\.css$/i.test(path) ||
    /^js\/.+\.js$/i.test(path) ||
    /^assets\/.+\.(png|jpe?g|webp|gif|svg|ico|avif|woff2?|ttf|otf)$/i.test(path)
  );
}

function documentCacheKey(url, path) {
  // Outros parâmetros podem alterar o conteúdo e não entram no cache.
  const entries = Array.from(url.searchParams.entries());

  if (
    entries.some(
      ([key, value]) =>
        key !== "source" || value !== "pwa-saberwolf"
    )
  ) {
    return null;
  }

  const normalized = new URL(url.href);

  normalized.pathname =
    SITE_BASE_URL.pathname + normalizeDocumentPath(path);

  normalized.search = "";
  normalized.hash = "";

  return normalized.href;
}

function canStore(response, isDocument, cacheKey) {
  if (response.status !== 200) return false;
  if (!["basic", "default"].includes(response.type)) return false;

  if (
    /\b(no-store|private)\b/i.test(
      response.headers.get("Cache-Control") || ""
    )
  ) {
    return false;
  }

  if (
    response.headers
      .get("Vary")
      ?.split(",")
      .some((value) => value.trim() === "*")
  ) {
    return false;
  }

  const isHtml = /\b(text\/html|application\/xhtml\+xml)\b/i.test(
    response.headers.get("Content-Type") || ""
  );

  if (isDocument !== isHtml) return false;

  // Aceita apenas redirecionamentos para a mesma página pública.
  // Exemplo: app/index.html -> app/. Redirecionamentos de login ficam fora.
  if (response.url) {
    const finalUrl = new URL(response.url);
    const finalPath = getSitePath(finalUrl);

    if (finalPath === null) return false;

    if (isDocument) {
      return (
        isPublicPage(finalPath) &&
        documentCacheKey(finalUrl, finalPath) === cacheKey
      );
    }

    return !response.redirected && finalUrl.href === cacheKey;
  }

  return !response.redirected;
}

async function storeResponse(cache, cacheKey, response, isDocument) {
  let stored = response;

  if (isDocument && (response.redirected || cacheKey === APP_URL)) {
    // Respostas que seguiram redirecionamentos precisam ser reconstruídas
    // antes de serem usadas em uma navegação offline.
    const headers = new Headers(response.headers);
    let html = await response.text();

    headers.delete("Content-Length");
    headers.delete("Content-Encoding");

    if (cacheKey === APP_URL) {
      // Também mantém os links corretos quando o endereço aberto é /app.
      const base = `<base href="${escapeHtml(APP_URL)}">`;

      html = html.replace(/<base\b[^>]*>/gi, "");
      html = html.replace(/<head\b[^>]*>/i, (head) => head + base);
    }

    stored = new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  await cache.put(cacheKey, stored);
}

async function prepareCache() {
  const cache = await caches.open(CACHE_NAME);

  async function addFile(path, isDocument) {
    const url = new URL(path, SITE_BASE_URL);
    const cacheKey = isDocument
      ? documentCacheKey(url, getSitePath(url))
      : url.href;

    const response = await fetch(url.href, { cache: "reload" });

    if (!canStore(response, isDocument, cacheKey)) {
      throw new Error("Não foi possível preparar: " + url.href);
    }

    await storeResponse(cache, cacheKey, response, isDocument);
  }

  // A instalação só termina depois de salvar a página de aviso offline.
  await addFile(OFFLINE_URL, true);

  const results = await Promise.allSettled(
    OPTIONAL_PRECACHE.map(({ path, isDocument }) =>
      addFile(path, isDocument)
    )
  );

  results.forEach((result) => {
    if (result.status === "rejected") {
      console.warn(
        "[SBW PWA] Arquivo opcional indisponível:",
        result.reason
      );
    }
  });
}

self.addEventListener("install", (event) => {
  event.waitUntil(prepareCache());

  // A atualização aguarda o fechamento das abas ou o botão de atualização.
});

self.addEventListener("message", (event) => {
  const type = event.data?.type;

  if (type === "SBW_SKIP_WAITING" || type === "SBW_APPLY_UPDATE") {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();

      await Promise.all(
        names
          .filter(
            (name) =>
              name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME
          )
          .map((name) => caches.delete(name))
      );

      await self.clients.claim();
    })()
  );
});

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function emergencyOfflineResponse() {
  return new Response(
    `<!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="theme-color" content="#f3f4f6">
        <title>SBW Project — Offline</title>
      </head>
      <body>
        <main>
          <h1>Você está offline</h1>
          <p>Verifique sua conexão e tente novamente.</p>
          <p><a href="${escapeHtml(APP_URL)}">Abrir central SBW</a></p>
          <p><a href="${escapeHtml(HOME_URL)}">SaberWolf Esports</a></p>
        </main>
      </body>
    </html>`,
    {
      status: 503,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      }
    }
  );
}

async function offlinePageResponse(response) {
  // Mantém os links do aviso offline relativos à pasta raiz do site.
  const base = `<base href="${escapeHtml(SITE_BASE_URL.href)}">`;
  let html = await response.text();

  html = html.replace(/<base\b[^>]*>/gi, "");
  html = html.replace(/<head\b[^>]*>/i, (head) => head + base);

  const headers = new Headers(response.headers);

  headers.delete("Content-Length");
  headers.delete("Content-Encoding");
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "no-store");

  return new Response(html, { status: 503, headers });
}

async function readOffline(cacheKey, isDocument) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(cacheKey);

    if (cached) {
      return cacheKey === OFFLINE_CACHE_KEY
        ? await offlinePageResponse(cached)
        : cached;
    }

    if (isDocument) {
      const offline = await cache.match(OFFLINE_CACHE_KEY);

      if (offline) return await offlinePageResponse(offline);
    }
  } catch (error) {
    console.warn("[SBW PWA] Não foi possível ler o cache:", error);
  }

  return isDocument ? emergencyOfflineResponse() : Response.error();
}

function networkFirst(event, cacheKey, isDocument) {
  const network = fetch(event.request, { cache: "no-store" });

  // A gravação não bloqueia a resposta e continua até terminar.
  event.waitUntil(
    network
      .then(async (response) => {
        if (!canStore(response, isDocument, cacheKey)) return;

        const copy = response.clone();
        const cache = await caches.open(CACHE_NAME);

        await storeResponse(cache, cacheKey, copy, isDocument);
      })
      .catch(() => {})
  );

  // Um erro HTTP, como 404, continua visível; só falhas de rede usam cache.
  return network.catch(() => readOffline(cacheKey, isDocument));
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (
    request.method !== "GET" ||
    request.cache === "no-store" ||
    request.headers.has("Authorization") ||
    request.headers.has("Range")
  ) {
    return;
  }

  const url = new URL(request.url);
  const path = getSitePath(url);

  if (path === null) return;

  const isDocument = request.mode === "navigate";

  if (isDocument && !isPublicPage(path)) return;
  if (!isDocument && !isStaticAsset(path)) return;

  const cacheKey = isDocument
    ? documentCacheKey(url, path)
    : url.href;

  if (!cacheKey) return;

  event.respondWith(networkFirst(event, cacheKey, isDocument));
});