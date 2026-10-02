/* SaberWolf Esports — cache do site institucional. */

"use strict";

const SITE_BASE_URL = new URL(self.registration.scope);

// Incremente esta versão ao atualizar os arquivos preparados para uso offline.
const CACHE_VERSION = "2026-09-09-1";

const CACHE_PREFIX =
  "saberwolf-esports:" +
  encodeURIComponent(SITE_BASE_URL.href) +
  ":";

const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;

const OFFLINE_URL = new URL(
  "offline.html",
  SITE_BASE_URL
).href;

const HOME_URL = new URL(
  "index.html",
  SITE_BASE_URL
).href;

const OPTIONAL_PRECACHE = [
  "index.html",
  "manifest.webmanifest?v=20260902-16841",
  "assets/icons/icon-192-v3.png",
  "assets/icons/icon-512-v3.png",
  "assets/icons/apple-touch-icon-v3.png"
].map((path) => new URL(path, SITE_BASE_URL).href);

const PUBLIC_PAGES = new Set([
  "",
  "index.html",
  "offline.html",
  "404.html",
  "pages/sobre.html",
  "pages/conteudo.html",
  "pages/loja.html",
  "pages/termos.html",
  "pages/privacidade.html",
  "pages/cookies.html"
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

function isPublicPage(path) {
  if (PUBLIC_PAGES.has(path)) return true;

  if (
    !/^(atletas|blog|comunidades|creators|links)(\/|$)/i.test(path)
  ) {
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
  // O parâmetro de abertura do app não muda o conteúdo da página.
  const entries = Array.from(url.searchParams.entries());

  if (
    entries.some(
      ([key, value]) =>
        key !== "source" || value !== "pwa-saberwolf"
    )
  ) {
    return null;
  }

  if (path === "") return HOME_URL;

  const normalized = new URL(url.href);
  normalized.search = "";
  normalized.hash = "";

  return normalized.href;
}

function canStore(response, isDocument) {
  if (response.status !== 200 || response.redirected) {
    return false;
  }

  if (!["basic", "default"].includes(response.type)) {
    return false;
  }

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

  return isDocument ? isHtml : !isHtml;
}

async function prepareCache() {
  const cache = await caches.open(CACHE_NAME);

  async function addFile(url, isDocument) {
    const response = await fetch(url, {
      cache: "reload"
    });

    if (!canStore(response, isDocument)) {
      throw new Error(
        "Não foi possível preparar: " + url
      );
    }

    await cache.put(url, response);
  }

  // A página offline precisa estar salva antes de concluir a instalação.
  await addFile(OFFLINE_URL, true);

  const results = await Promise.allSettled(
    OPTIONAL_PRECACHE.map((url) =>
      addFile(url, url === HOME_URL)
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

  // Com o site aberto, a atualização pode ser aplicada pelo botão.
});

self.addEventListener("message", (event) => {
  const type = event.data?.type;

  if (
    type === "SBW_SKIP_WAITING" ||
    type === "SBW_APPLY_UPDATE"
  ) {
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
              name.startsWith(CACHE_PREFIX) &&
              name !== CACHE_NAME
          )
          .map((name) => caches.delete(name))
      );

      await self.clients.claim();
    })()
  );
});

function emergencyOfflineResponse() {
  return new Response(
    `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
          >
          <title>SaberWolf Esports — Offline</title>
        </head>

        <body>
          <h1>Você está offline</h1>
          <p>Verifique sua conexão e tente novamente.</p>
          <a href="${HOME_URL}">Voltar ao início</a>
        </body>
      </html>
    `,
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
  // O aviso pode aparecer no endereço de uma página dentro de outra pasta.
  // Esta base mantém os links relativos apontando para a pasta do site.
  const html = (await response.text()).replace(
    /<head\b[^>]*>/i,
    (head) =>
      head + `<base href="${SITE_BASE_URL.href}">`
  );

  const headers = new Headers(response.headers);

  headers.delete("Content-Length");
  headers.delete("Content-Encoding");

  headers.set(
    "Content-Type",
    "text/html; charset=utf-8"
  );

  headers.set("Cache-Control", "no-store");

  return new Response(html, {
    status: 503,
    headers
  });
}

async function readOffline(cacheKey, isDocument) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(cacheKey);

    if (cached) {
      return cacheKey === OFFLINE_URL
        ? await offlinePageResponse(cached)
        : cached;
    }

    if (isDocument) {
      const offline = await cache.match(OFFLINE_URL);

      if (offline) {
        return await offlinePageResponse(offline);
      }
    }
  } catch (error) {
    console.warn(
      "[SBW PWA] Não foi possível ler o cache:",
      error
    );
  }

  return isDocument
    ? emergencyOfflineResponse()
    : Response.error();
}

function networkFirst(event, cacheKey, isDocument) {
  const network = fetch(event.request, {
    cache: "no-store"
  });

  // A gravação fica protegida até terminar e não bloqueia a resposta da rede.
  event.waitUntil(
    network
      .then(async (response) => {
        if (!canStore(response, isDocument)) return;

        const copy = response.clone();
        const cache = await caches.open(CACHE_NAME);

        await cache.put(cacheKey, copy);
      })
      .catch(() => {})
  );

  // Respostas HTTP como 404 permanecem visíveis.
  // O fallback cobre falhas de rede.
  return network.catch(() =>
    readOffline(cacheKey, isDocument)
  );
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

  event.respondWith(
    networkFirst(event, cacheKey, isDocument)
  );
});