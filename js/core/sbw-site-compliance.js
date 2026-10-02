/*
  SaberWolf Esports — preferências, rodapé e atualização do app.

  A escolha sobre vídeos e chats da Twitch fica em Preferências.
  A preferência externalMedia mantém a integração com os players.
  Os players devem consultar isAllowed("externalMedia") ANTES de
  atribuir src aos iframes e removê-los quando a preferência for revogada.

  Este arquivo não intercepta iframes antigos nem carrega serviços externos.
*/
(function () {
  "use strict";

  if (window.SBWCompliance) return;

  const scriptElement = document.currentScript ||
    Array.from(document.scripts).find((script) =>
      /\/js\/core\/sbw-site-compliance\.js(?:[?#]|$)/i.test(script.src)
    );

  const SITE_BASE_URL = scriptElement?.src
    ? new URL("../../", scriptElement.src)
    : new URL(
        window.SBWRoutes?.getBasePath?.() || "./",
        document.baseURI || window.location.href
      );

  const CONSENT_KEY =
    "saberwolf_esports_cookie_consent_v1:" + SITE_BASE_URL.pathname;

  // Mantém a versão do consentimento e as escolhas já salvas.
  const CONSENT_VERSION = "2026-09-11-2";

  const SBW_SITE_VERSION =
    document.querySelector('meta[name="sbw-site-version"]')
      ?.content?.trim() || "v1.6.84.1";

  const SBW_APP_VERSION =
    document.querySelector('meta[name="sbw-app-version"]')
      ?.content?.trim() || "App SaberWolf Esports";

  const SERVICE_WORKER_URL = new URL("service-worker.js", SITE_BASE_URL);

  let currentConsent = readStoredConsent();
  let activeModal = null;
  let updateRequested = false;
  let reloading = false;

  function defaultConsent() {
    return {
      version: CONSENT_VERSION,
      necessary: true,
      analytics: false,
      externalMedia: false,
      updatedAt: null
    };
  }

  function readStoredConsent() {
    try {
      const consent = JSON.parse(window.localStorage.getItem(CONSENT_KEY));

      if (
        !consent ||
        consent.version !== CONSENT_VERSION ||
        consent.necessary !== true ||
        typeof consent.analytics !== "boolean" ||
        typeof consent.externalMedia !== "boolean"
      ) {
        return null;
      }

      return {
        version: CONSENT_VERSION,
        necessary: true,

        // Métricas permanecem indisponíveis nesta etapa.
        analytics: false,

        externalMedia: consent.externalMedia,
        updatedAt:
          typeof consent.updatedAt === "string" ? consent.updatedAt : null
      };
    } catch {
      return null;
    }
  }

  function getConsent() {
    return currentConsent ? { ...currentConsent } : null;
  }

  function effectiveConsent() {
    return getConsent() || defaultConsent();
  }

  function isAllowed(category) {
    if (category === "necessary") return true;

    if (category === "externalMedia") {
      return currentConsent?.externalMedia === true;
    }

    return false;
  }

  function publishConsent() {
    const consent = effectiveConsent();

    window.SBWCookieConsent = { ...consent };

    window.dispatchEvent(
      new CustomEvent("sbw:cookies-consent-updated", {
        detail: { ...consent }
      })
    );
  }

  // Notifica imediatamente e sempre que a preferência mudar.
  // Retorna uma função para cancelar a assinatura.
  function onConsentChange(callback) {
    if (typeof callback !== "function") return () => {};

    const notify = () => {
      try {
        callback(effectiveConsent());
      } catch (error) {
        console.warn("[SBW] Falha ao aplicar uma preferência:", error);
      }
    };

    window.addEventListener("sbw:cookies-consent-updated", notify);
    notify();

    return () => {
      window.removeEventListener("sbw:cookies-consent-updated", notify);
    };
  }

  function syncPreferenceControls() {
    if (!activeModal) return;

    activeModal.querySelector("[data-sbw-cookie-external-media]").checked =
      isAllowed("externalMedia");

    activeModal.querySelector("[data-sbw-cookie-analytics]").checked = false;
  }

  function saveConsent(options = {}) {
    currentConsent = {
      version: CONSENT_VERSION,
      necessary: true,
      analytics: false,
      externalMedia: options?.externalMedia === true,
      updatedAt: new Date().toISOString()
    };

    try {
      window.localStorage.setItem(
        CONSENT_KEY,
        JSON.stringify(currentConsent)
      );
    } catch (error) {
      console.warn("[SBW] Preferência mantida apenas nesta página:", error);
    }

    syncPreferenceControls();
    publishConsent();
    closeCookieBanner();

    return getConsent();
  }

  function routeUrl(path) {
    if (typeof window.SBWRoutes?.url === "function") {
      return window.SBWRoutes.url(path);
    }

    return new URL(path.replace(/^\/+/, ""), SITE_BASE_URL).href;
  }

  function createElementFromHtml(html) {
    const template = document.createElement("template");
    template.innerHTML = html.trim();

    return template.content.firstElementChild;
  }

  function setLegalLinks(root) {
    root.querySelectorAll("[data-sbw-legal-link]").forEach((link) => {
      link.href = routeUrl(link.dataset.sbwLegalLink);
    });
  }

  function ensureFooter() {
    let footer =
      document.querySelector("[data-sbw-site-footer]") ||
      document.querySelector(".sbw-site-footer") ||
      document.querySelector("body > footer");

    if (!footer) {
      footer = createElementFromHtml(`
        <footer class="sbw-site-footer" data-sbw-site-footer>
          <div class="sbw-site-footer__inner">
            <p class="sbw-site-footer__copy">
              © ${new Date().getFullYear()} SaberWolf Esports.
              Todos os direitos reservados.
            </p>
          </div>
        </footer>
      `);

      document.body.appendChild(footer);
    } else if (!footer.hasAttribute("data-sbw-site-footer")) {
      footer.classList.add("sbw-legacy-footer");
    }

    const inner = footer.querySelector(".sbw-site-footer__inner") || footer;
    let legal = inner.querySelector(".sbw-site-footer__legal");

    if (!legal) {
      legal = createElementFromHtml(`
        <nav class="sbw-site-footer__legal" aria-label="Links legais">
          <a data-sbw-legal-link="pages/termos.html">Termos</a>
          <a data-sbw-legal-link="pages/privacidade.html">Privacidade</a>
          <a data-sbw-legal-link="pages/cookies.html">Cookies</a>
        </nav>
      `);

      inner.appendChild(legal);
    }

    setLegalLinks(legal);

    legal.querySelectorAll("a[href]").forEach((link) => {
      let url;

      try {
        url = new URL(link.getAttribute("href"), document.baseURI);
      } catch {
        return;
      }

      if (url.origin !== SITE_BASE_URL.origin) return;

      const match = url.pathname.match(
        /\/pages\/(termos|privacidade|cookies)\.html$/
      );

      if (!match) return;

      const path = "pages/" + match[1] + ".html";

      if (
        url.pathname === "/" + path ||
        url.pathname === SITE_BASE_URL.pathname + path
      ) {
        link.href = routeUrl(path) + url.search + url.hash;
      }
    });

    if (!legal.querySelector("[data-sbw-cookie-preferences]")) {
      legal.appendChild(
        createElementFromHtml(`
          <button
            type="button"
            class="sbw-cookie-button sbw-cookie-button--ghost"
            aria-haspopup="dialog"
            data-sbw-cookie-preferences
          >
            Preferências de cookies
          </button>
        `)
      );
    }

    let version = footer.querySelector("[data-sbw-version-label]");

    if (!version) {
      version = document.createElement("p");
      version.className = "sbw-site-footer__version";
      version.setAttribute("data-sbw-version-label", "");
      legal.before(version);
    }

    version.textContent = `Site ${SBW_SITE_VERSION} · ${SBW_APP_VERSION}`;
  }

  function closeCookieBanner() {
    const banner = document.querySelector("[data-sbw-cookie-banner]");
    const hadFocus = banner?.contains(document.activeElement);

    banner?.remove();

    if (hadFocus) {
      document
        .querySelector("footer [data-sbw-cookie-preferences]")
        ?.focus({ preventScroll: true });
    }
  }

  function openPreferences() {
    if (!document.body) return;

    if (activeModal) {
      activeModal.querySelector("button")?.focus();
      return;
    }

    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;

    const modal = createElementFromHtml(`
      <div
        class="sbw-cookie-modal"
        data-sbw-cookie-modal
        role="dialog"
        aria-modal="true"
        aria-labelledby="sbwCookieModalTitle"
      >
        <div
          class="sbw-cookie-modal__backdrop"
          data-sbw-cookie-close
        ></div>

        <div class="sbw-cookie-modal__panel" tabindex="-1">
          <div class="sbw-cookie-modal__header">
            <span class="sbw-cookie-modal__eyebrow">Preferências</span>

            <h2 id="sbwCookieModalTitle">
              Cookies da SaberWolf Esports
            </h2>

            <button
              type="button"
              class="sbw-cookie-modal__close"
              data-sbw-cookie-close
              aria-label="Fechar preferências"
            >×</button>
          </div>

          <div class="sbw-cookie-modal__content">
            <label class="sbw-cookie-option is-required">
              <input type="checkbox" checked disabled />

              <span>
                <strong>Necessários</strong>
                <small>
                  Mantêm as preferências básicas e os recursos
                  essenciais deste site.
                </small>
              </span>
            </label>

            <label class="sbw-cookie-option">
              <input
                type="checkbox"
                data-sbw-cookie-external-media
              />

              <span>
                <strong>Vídeos e chats da Twitch</strong>
                <small>
                  Permite carregar transmissões e chats da Twitch.
                  Ao carregar, a Twitch recebe dados de conexão
                  e pode utilizar cookies. Você pode mudar esta
                  escolha a qualquer momento.
                </small>
              </span>
            </label>

            <label class="sbw-cookie-option">
              <input
                type="checkbox"
                data-sbw-cookie-analytics
                disabled
              />

              <span>
                <strong>Métricas de uso · Em preparação</strong>
                <small>
                  Esta opção ficará disponível quando a ferramenta
                  e sua finalidade forem definidas.
                </small>
              </span>
            </label>

            <p style="color:#c7d8e7; font-size:13px; line-height:1.6;">
              Consulte a
              <a
                data-sbw-legal-link="pages/privacidade.html"
                style="color:inherit;"
              >Política de Privacidade</a>
              e a
              <a
                data-sbw-legal-link="pages/cookies.html"
                style="color:inherit;"
              >Política de Cookies</a>.
            </p>
          </div>

          <div class="sbw-cookie-modal__actions">
            <button
              type="button"
              class="sbw-cookie-button sbw-cookie-button--ghost"
              data-sbw-cookie-necessary
            >Somente necessários</button>

            <button
              type="button"
              class="sbw-cookie-button"
              data-sbw-cookie-save
            >Salvar preferências</button>
          </div>
        </div>
      </div>
    `);

    setLegalLinks(modal);

    const panel = modal.querySelector(".sbw-cookie-modal__panel");

    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";

    activeModal = modal;
    syncPreferenceControls();

    function closeModal() {
      document.removeEventListener("keydown", onKeyDown);

      modal.remove();
      activeModal = null;

      document.body.style.overflow = previousOverflow;

      const target = previousFocus?.isConnected
        ? previousFocus
        : document.querySelector("footer [data-sbw-cookie-preferences]");

      target?.focus({ preventScroll: true });
    }

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
      } else if (event.key === "Tab") {
        const controls = Array.from(
          modal.querySelectorAll(
            'button:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]'
          )
        );

        const first = controls[0] || panel;
        const last = controls[controls.length - 1] || panel;
        const focused = document.activeElement;

        if (
          !controls.includes(focused) ||
          (event.shiftKey && focused === first) ||
          (!event.shiftKey && focused === last)
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }
    }

    modal.querySelectorAll("[data-sbw-cookie-close]").forEach((element) => {
      element.addEventListener("click", closeModal);
    });

    modal
      .querySelector("[data-sbw-cookie-necessary]")
      .addEventListener("click", () => {
        saveConsent({ externalMedia: false });
        closeModal();
      });

    modal
      .querySelector("[data-sbw-cookie-save]")
      .addEventListener("click", () => {
        saveConsent({
          externalMedia: modal.querySelector(
            "[data-sbw-cookie-external-media]"
          ).checked
        });

        closeModal();
      });

    document.addEventListener("keydown", onKeyDown);
    modal.querySelector("button").focus();
  }

  function ensureCookieBanner() {
    if (currentConsent) {
      closeCookieBanner();
      return;
    }

    if (document.querySelector("[data-sbw-cookie-banner]")) return;

    const banner = createElementFromHtml(`
      <section
        class="sbw-cookie-banner"
        data-sbw-cookie-banner
        aria-label="Aviso de privacidade"
      >
        <div class="sbw-cookie-banner__text">
          <strong>Cookies e preferências</strong>

          <span>
            Guardamos suas preferências neste navegador.
            Em Preferências, você pode decidir se deseja permitir
            conteúdos externos ou manter somente os recursos necessários.
          </span>

          <span>
            <a
              data-sbw-legal-link="pages/privacidade.html"
            >Privacidade</a>
            ·
            <a
              data-sbw-legal-link="pages/cookies.html"
            >Cookies</a>
          </span>
        </div>

        <div class="sbw-cookie-banner__actions">
          <button
            type="button"
            class="sbw-cookie-button sbw-cookie-button--ghost"
            aria-haspopup="dialog"
            data-sbw-cookie-preferences
          >Preferências</button>

          <button
            type="button"
            class="sbw-cookie-button sbw-cookie-button--ghost"
            data-sbw-cookie-necessary
          >Somente necessários</button>
        </div>
      </section>
    `);

    setLegalLinks(banner);

    // Mantém a ordem usada pelo CSS quando os dois avisos estão presentes.
    const updateNotice = document.querySelector(
      "body > [data-sbw-pwa-update-notice]"
    );

    if (updateNotice) {
      document.body.insertBefore(banner, updateNotice);
    } else {
      document.body.appendChild(banner);
    }

    banner
      .querySelector("[data-sbw-cookie-necessary]")
      .addEventListener("click", () => {
        saveConsent({ externalMedia: false });
      });
  }

  function isSiteWorker(worker) {
    if (!worker) return false;

    try {
      const url = new URL(worker.scriptURL);

      return (
        url.origin === SERVICE_WORKER_URL.origin &&
        url.pathname === SERVICE_WORKER_URL.pathname
      );
    } catch {
      return false;
    }
  }

  function reloadOnce() {
    if (reloading) return;

    reloading = true;
    window.location.reload();
  }

  function createPwaUpdateNotice(registration) {
    if (document.querySelector("[data-sbw-pwa-update-notice]")) return;

    const notice = createElementFromHtml(`
      <section
        class="sbw-pwa-update-notice"
        data-sbw-pwa-update-notice
        role="status"
        aria-live="polite"
      >
        <div class="sbw-pwa-update-notice__text">
          <strong>Nova versão disponível</strong>
          <span>
            Atualize a SaberWolf Esports para carregar
            as melhorias mais recentes.
          </span>
        </div>

        <div class="sbw-pwa-update-notice__actions">
          <button
            type="button"
            class="sbw-pwa-update-notice__button"
            data-sbw-pwa-update-apply
          >Atualizar agora</button>

          <button
            type="button"
            class="sbw-pwa-update-notice__dismiss"
            data-sbw-pwa-update-dismiss
            aria-label="Fechar aviso"
          >×</button>
        </div>
      </section>
    `);

    document.body.appendChild(notice);

    notice
      .querySelector("[data-sbw-pwa-update-dismiss]")
      .addEventListener("click", () => notice.remove());

    notice
      .querySelector("[data-sbw-pwa-update-apply]")
      .addEventListener("click", () => {
        if (!registration.waiting) {
          reloadOnce();
          return;
        }

        const button = notice.querySelector("[data-sbw-pwa-update-apply]");

        button.disabled = true;
        button.textContent = "Atualizando...";
        updateRequested = true;

        try {
          registration.waiting.postMessage({
            type: "SBW_APPLY_UPDATE"
          });
        } catch {
          updateRequested = false;
          button.disabled = false;
          button.textContent = "Tentar novamente";
        }
      });
  }

  function watchPwaUpdates() {
    if (
      !("serviceWorker" in navigator) ||
      !window.isSecureContext ||
      !["http:", "https:"].includes(window.location.protocol)
    ) {
      return;
    }

    const serviceWorker = navigator.serviceWorker;
    const watched = new WeakSet();

    function observeRegistration(registration) {
      // Não acompanha registros de outras pastas ou do outro site.
      if (
        !registration ||
        registration.scope !== SITE_BASE_URL.href ||
        watched.has(registration)
      ) {
        return;
      }

      watched.add(registration);

      function showUpdate() {
        if (isSiteWorker(serviceWorker.controller)) {
          createPwaUpdateNotice(registration);
        }
      }

      if (isSiteWorker(registration.waiting)) {
        showUpdate();
      }

      function watchInstallingWorker() {
        const worker = registration.installing;

        if (!isSiteWorker(worker)) return;

        const checkState = () => {
          if (worker.state === "installed") {
            showUpdate();
          }
        };

        worker.addEventListener("statechange", checkState);
        checkState();
      }

      registration.addEventListener(
        "updatefound",
        watchInstallingWorker
      );

      watchInstallingWorker();
    }

    // O registro do service worker continua em js/pwa/sbw-pwa.js.
    serviceWorker
      .getRegistration(SITE_BASE_URL.href)
      .then(observeRegistration)
      .catch((error) => {
        console.warn("[SBW PWA] Falha ao consultar o app:", error);
      });

    serviceWorker.ready
      .then(observeRegistration)
      .catch(() => {});

    window.addEventListener("sbw:pwa-registered", (event) => {
      observeRegistration(event.detail?.registration);
    });

    serviceWorker.addEventListener("controllerchange", () => {
      if (
        updateRequested &&
        isSiteWorker(serviceWorker.controller)
      ) {
        reloadOnce();
      }
    });
  }

  function refreshConsentFromStorage() {
    currentConsent = readStoredConsent();

    syncPreferenceControls();
    publishConsent();
    ensureCookieBanner();
  }

  function initCompliance() {
    ensureFooter();
    ensureCookieBanner();

    document.addEventListener("click", (event) => {
      if (
        event.target instanceof Element &&
        event.target.closest("[data-sbw-cookie-preferences]")
      ) {
        event.preventDefault();
        openPreferences();
      }
    });

    window.addEventListener("storage", (event) => {
      if (event.key !== CONSENT_KEY && event.key !== null) return;

      try {
        if (
          event.storageArea &&
          event.storageArea !== window.localStorage
        ) {
          return;
        }
      } catch {
        return;
      }

      refreshConsentFromStorage();
    });

    window.addEventListener("pageshow", (event) => {
      if (event.persisted) {
        refreshConsentFromStorage();
      }
    });

    window.SBWRoutes?.rewriteLinks?.();

    publishConsent();
    watchPwaUpdates();
  }

  window.SBWVersions = {
    site: SBW_SITE_VERSION,
    app: SBW_APP_VERSION
  };

  window.SBWCompliance = {
    getConsent,
    saveConsent,
    isAllowed,
    onConsentChange,
    openCookiePreferences: openPreferences
  };

  window.SBWCookieConsent = effectiveConsent();

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initCompliance,
      { once: true }
    );
  } else {
    initCompliance();
  }
})();