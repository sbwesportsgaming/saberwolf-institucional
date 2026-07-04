(function () {
  "use strict";

  const CONSENT_KEY = "sbw_cookie_consent_v1";
  const CONSENT_VERSION = "2026-06-10";
  const SBW_SITE_VERSION = "v1.6.81";
  const SBW_APP_VERSION = "App -SBW- Beta v0.2";
  const SBW_PWA_SW_URL = "/service-worker.js?v=20260630-16808";

  function getStoredConsent() {
    try {
      const raw = window.localStorage.getItem(CONSENT_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== CONSENT_VERSION) return null;

      return parsed;
    } catch (error) {
      console.warn("[SBW Compliance] Não foi possível ler consentimento:", error);
      return null;
    }
  }

  function saveConsent(options) {
    const consent = {
      version: CONSENT_VERSION,
      necessary: true,
      analytics: Boolean(options && options.analytics),
      updatedAt: new Date().toISOString()
    };

    try {
      window.localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
    } catch (error) {
      console.warn("[SBW Compliance] Não foi possível salvar consentimento:", error);
    }

    window.SBWCookieConsent = consent;
    window.dispatchEvent(new CustomEvent("sbw:cookies-consent-updated", { detail: consent }));

    return consent;
  }

  function routeUrl(path) {
    if (window.SBWRoutes && typeof window.SBWRoutes.url === "function") {
      return window.SBWRoutes.url(path);
    }

    return path.startsWith("/") ? path : "/" + path.replace(/^\/+/, "");
  }

  function createElementFromHtml(html) {
    const template = document.createElement("template");
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
  }

  function ensureFooter() {
    if (document.querySelector("[data-sbw-site-footer]")) return;

    const existingFooter = document.querySelector("footer:not([data-sbw-site-footer])");

    if (existingFooter) {
      existingFooter.classList.add("sbw-legacy-footer");
      return;
    }

    const footer = createElementFromHtml(`
      <footer class="sbw-site-footer" data-sbw-site-footer>
        <div class="sbw-site-footer__inner">
          <p class="sbw-site-footer__copy">© 2026 -SBW- Project. Todos os direitos reservados.</p>
          <p class="sbw-site-footer__version" data-sbw-version-label>Site ${SBW_SITE_VERSION} · ${SBW_APP_VERSION}</p>

          <nav class="sbw-site-footer__legal" aria-label="Links legais">
            <a href="${routeUrl("pages/termos.html")}">Termos</a>
            <a href="${routeUrl("pages/privacidade.html")}">Privacidade</a>
            <a href="${routeUrl("pages/cookies.html")}">Cookies</a>
          </nav>
        </div>
      </footer>
    `);

    document.body.appendChild(footer);
  }


  function ensureVersionLabel() {
    const text = `Site ${SBW_SITE_VERSION} · ${SBW_APP_VERSION}`;
    const existing = document.querySelector("[data-sbw-version-label]");

    if (existing) {
      existing.textContent = text;
      return;
    }

    const footer = document.querySelector("[data-sbw-site-footer], footer");
    if (!footer) return;

    const version = document.createElement("p");
    version.className = "sbw-site-footer__version";
    version.setAttribute("data-sbw-version-label", "");
    version.textContent = text;

    const inner = footer.querySelector(".sbw-site-footer__inner") || footer;
    const legal = inner.querySelector(".sbw-site-footer__legal");

    if (legal) {
      inner.insertBefore(version, legal);
    } else {
      inner.appendChild(version);
    }
  }

  function createPwaUpdateNotice(registration) {
    if (document.querySelector("[data-sbw-pwa-update-notice]")) return;
    if (!registration) return;

    const notice = createElementFromHtml(`
      <section class="sbw-pwa-update-notice" data-sbw-pwa-update-notice role="status" aria-live="polite">
        <div class="sbw-pwa-update-notice__text">
          <strong>Nova versão disponível</strong>
          <span>Atualize o App -SBW- Beta para carregar as melhorias mais recentes.</span>
        </div>
        <div class="sbw-pwa-update-notice__actions">
          <button type="button" class="sbw-pwa-update-notice__button" data-sbw-pwa-update-apply>Atualizar agora</button>
          <button type="button" class="sbw-pwa-update-notice__dismiss" data-sbw-pwa-update-dismiss aria-label="Fechar aviso">×</button>
        </div>
      </section>
    `);

    document.body.appendChild(notice);

    notice.querySelector("[data-sbw-pwa-update-dismiss]")?.addEventListener("click", () => notice.remove());
    notice.querySelector("[data-sbw-pwa-update-apply]")?.addEventListener("click", () => {
      const button = notice.querySelector("[data-sbw-pwa-update-apply]");
      if (button) {
        button.disabled = true;
        button.textContent = "Atualizando...";
      }

      if (registration.waiting) {
        registration.waiting.postMessage({ type: "SBW_APPLY_UPDATE" });
        return;
      }

      window.location.reload();
    });
  }

  function watchPwaUpdates() {
    if (!("serviceWorker" in navigator)) return;
    if (window.location.protocol === "file:") return;

    let reloading = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });

    const getRegistration = navigator.serviceWorker
      .getRegistration("/")
      .then((registration) => {
        if (registration) return registration;
        return navigator.serviceWorker.register(SBW_PWA_SW_URL, { scope: "/", updateViaCache: "none" });
      });

    getRegistration
      .then((registration) => {
        if (!registration) return;

        if (registration.waiting && navigator.serviceWorker.controller) {
          createPwaUpdateNotice(registration);
        }

        registration.addEventListener("updatefound", () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener("statechange", () => {
            if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
              createPwaUpdateNotice(registration);
            }
          });
        });

        if (typeof registration.update === "function") {
          registration.update().catch(() => {});
        }
      })
      .catch((error) => {
        console.warn("[SBW PWA] Não foi possível verificar atualização:", error);
      });
  }

  function closeCookieBanner() {
    const banner = document.querySelector("[data-sbw-cookie-banner]");
    if (banner) banner.remove();
  }

  function openPreferences() {
    const current = getStoredConsent() || { analytics: false };
    const existing = document.querySelector("[data-sbw-cookie-modal]");
    if (existing) existing.remove();

    const modal = createElementFromHtml(`
      <div class="sbw-cookie-modal" data-sbw-cookie-modal role="dialog" aria-modal="true" aria-labelledby="sbwCookieModalTitle">
        <div class="sbw-cookie-modal__backdrop" data-sbw-cookie-close></div>
        <div class="sbw-cookie-modal__panel">
          <div class="sbw-cookie-modal__header">
            <span class="sbw-cookie-modal__eyebrow">Preferências</span>
            <h2 id="sbwCookieModalTitle">Cookies da -SBW-</h2>
            <button type="button" class="sbw-cookie-modal__close" data-sbw-cookie-close aria-label="Fechar">×</button>
          </div>

          <div class="sbw-cookie-modal__content">
            <label class="sbw-cookie-option is-required">
              <input type="checkbox" checked disabled />
              <span>
                <strong>Necessários</strong>
                <small>Essenciais para login, segurança, preferências básicas e funcionamento da plataforma.</small>
              </span>
            </label>

            <label class="sbw-cookie-option">
              <input type="checkbox" data-sbw-cookie-analytics ${current.analytics ? "checked" : ""} />
              <span>
                <strong>Analytics agregado</strong>
                <small>Métricas gerais da plataforma, sem dados pessoais, para melhorar páginas, PWA e experiência pública.</small>
              </span>
            </label>
          </div>

          <div class="sbw-cookie-modal__actions">
            <button type="button" class="sbw-cookie-button sbw-cookie-button--ghost" data-sbw-cookie-necessary>Somente necessários</button>
            <button type="button" class="sbw-cookie-button" data-sbw-cookie-save>Salvar preferências</button>
          </div>
        </div>
      </div>
    `);

    document.body.appendChild(modal);

    modal.querySelectorAll("[data-sbw-cookie-close]").forEach((button) => {
      button.addEventListener("click", () => modal.remove());
    });

    const necessaryButton = modal.querySelector("[data-sbw-cookie-necessary]");
    if (necessaryButton) {
      necessaryButton.addEventListener("click", () => {
        saveConsent({ analytics: false });
        modal.remove();
        closeCookieBanner();
      });
    }

    const saveButton = modal.querySelector("[data-sbw-cookie-save]");
    if (saveButton) {
      saveButton.addEventListener("click", () => {
        const analytics = Boolean(modal.querySelector("[data-sbw-cookie-analytics]")?.checked);
        saveConsent({ analytics });
        modal.remove();
        closeCookieBanner();
      });
    }
  }

  function ensureCookieBanner() {
    const storedConsent = getStoredConsent();
    if (storedConsent) {
      window.SBWCookieConsent = storedConsent;
      return;
    }

    if (document.querySelector("[data-sbw-cookie-banner]")) return;

    const banner = createElementFromHtml(`
      <section class="sbw-cookie-banner" data-sbw-cookie-banner aria-label="Aviso de cookies">
        <div class="sbw-cookie-banner__text">
          <strong>Cookies e preferências</strong>
          <span>Usamos recursos necessários para login, segurança e funcionamento da plataforma. Métricas adicionais só devem ser ativadas com preferência salva.</span>
        </div>

        <div class="sbw-cookie-banner__actions">
          <button type="button" class="sbw-cookie-button sbw-cookie-button--ghost" data-sbw-cookie-preferences>Preferências</button>
          <button type="button" class="sbw-cookie-button sbw-cookie-button--ghost" data-sbw-cookie-necessary>Somente necessários</button>
          <button type="button" class="sbw-cookie-button" data-sbw-cookie-accept>Aceitar</button>
        </div>
      </section>
    `);

    document.body.appendChild(banner);

    banner.querySelector("[data-sbw-cookie-preferences]")?.addEventListener("click", openPreferences);
    banner.querySelector("[data-sbw-cookie-necessary]")?.addEventListener("click", () => {
      saveConsent({ analytics: false });
      closeCookieBanner();
    });
    banner.querySelector("[data-sbw-cookie-accept]")?.addEventListener("click", () => {
      saveConsent({ analytics: true });
      closeCookieBanner();
    });
  }

  function initCompliance() {
    ensureFooter();
    ensureVersionLabel();
    ensureCookieBanner();
    watchPwaUpdates();

    window.SBWVersions = {
      site: SBW_SITE_VERSION,
      app: SBW_APP_VERSION
    };

    window.SBWCompliance = {
      getConsent: getStoredConsent,
      saveConsent,
      openCookiePreferences: openPreferences
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCompliance);
  } else {
    initCompliance();
  }
})();
