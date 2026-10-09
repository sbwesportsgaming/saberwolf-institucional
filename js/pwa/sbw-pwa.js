/* SBW Project — registro do app e botão de instalação em sbwgg.com.br. */

(function () {
  "use strict";

  if (window.SBWPWA) return;

  const APP_NAME = "SBW Project";
  const PWA_VERSION = "20261008-project-1";

  const scriptElement = document.currentScript ||
    Array.from(document.scripts).find((script) =>
      /\/js\/pwa\/sbw-pwa\.js(?:[?#]|$)/i.test(script.src)
    );

  // Este arquivo fica em js/pwa/, dois níveis abaixo da pasta do site.
  const SITE_BASE_URL = scriptElement?.src
    ? new URL("../../", scriptElement.src)
    : new URL(
        window.SBWRoutes?.getBasePath?.() || "./",
        document.baseURI || window.location.href
      );

  const SERVICE_WORKER_URL = new URL(
    "service-worker.js?v=" + PWA_VERSION,
    SITE_BASE_URL
  );

  const APP_URL = new URL(
    "app/index.html?source=pwa-saberwolf",
    SITE_BASE_URL
  );

  const INSTALL_SELECTOR = [
    "[data-sbw-pwa-install]",
    "[data-sbw-install-app]",
    "[data-pwa-install]",
    "#sbwPwaInstallButton",
    "#pwaInstallButton",
    ".js-pwa-install"
  ].join(",");

  const installButtons = new WeakMap();

  const standaloneMedia = window.matchMedia?.(
    "(display-mode: standalone)"
  );

  let deferredPrompt = null;
  let promptInProgress = false;
  let installedThisSession = false;
  let registrationPromise = null;
  let currentRegistration = null;
  let lastStatus = "";

  function getInstallButtons() {
    return Array.from(
      document.querySelectorAll(INSTALL_SELECTOR)
    );
  }

  function isStandaloneMode() {
    return (
      standaloneMedia?.matches === true ||
      navigator.standalone === true
    );
  }

  function isInstalled() {
    return installedThisSession || isStandaloneMode();
  }

  function createInstallMarkup(button) {
    const content = document.createElement("span");
    const originalIcon = button.querySelector(
      "svg, i, [data-sbw-pwa-icon]"
    );

    if (originalIcon) {
      const icon = originalIcon.cloneNode(true);

      icon.setAttribute("aria-hidden", "true");
      content.appendChild(icon);
      content.appendChild(document.createTextNode(" "));
    }

    content.appendChild(
      document.createTextNode("Instalar app " + APP_NAME)
    );

    return content.innerHTML;
  }

  function setStatusText(text) {
    lastStatus = text;

    let elements = Array.from(
      document.querySelectorAll("[data-sbw-pwa-status]")
    );

    // Cria uma orientação quando a página não tem um aviso próprio.
    if (!elements.length && text) {
      const button = getInstallButtons()[0];
      if (!button) return;

      const status = document.createElement("p");

      status.className = "sbw-pwa-status";
      status.setAttribute("data-sbw-pwa-status", "");
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");

      status.style.margin = "12px 0 0";
      status.style.fontSize = "0.875rem";
      status.style.lineHeight = "1.5";

      const anchor =
        button.closest(".sbw-home-hero__actions") || button;

      anchor.after(status);
      elements = [status];
    }

    elements.forEach((element) => {
      element.setAttribute("role", "status");
      element.setAttribute("aria-live", "polite");
      element.hidden = !text;
      element.textContent = text;
    });
  }

  function refreshButtons() {
    const installed = isInstalled();
    const disabled = installed || promptInProgress;

    document.documentElement.classList.toggle(
      "sbw-pwa-installable",
      Boolean(deferredPrompt) && !disabled
    );

    document.documentElement.classList.toggle(
      "sbw-pwa-installed",
      installed
    );

    document.documentElement.classList.toggle(
      "sbw-pwa-standalone",
      isStandaloneMode()
    );

    getInstallButtons().forEach((button) => {
      if (!installButtons.has(button)) {
        installButtons.set(button, createInstallMarkup(button));
        button.addEventListener("click", handleInstallClick);

        if (button.tagName === "BUTTON") {
          button.type = "button";
        }
      }

      button.disabled = disabled;

      if (disabled) {
        button.setAttribute("aria-disabled", "true");
      } else {
        button.removeAttribute("aria-disabled");
      }

      if (installed) {
        button.textContent = "App " + APP_NAME + " instalado";
      } else if (promptInProgress) {
        button.textContent = "Aguarde...";
      } else {
        button.innerHTML =
          installButtons.get(button);
      }

      button.setAttribute("aria-label", button.textContent.trim());
    });
  }

  function showInstallHelp() {
    if (window.location.protocol === "file:") {
      setStatusText(
        "Abra este site pelo Go Live no VS Code para testar a instalação."
      );
      return;
    }

    if (!window.isSecureContext) {
      setStatusText(
        "Abra o site por uma conexão HTTPS para instalar o app."
      );
      return;
    }

    setStatusText(
      "A instalação automática ainda não está disponível. Procure Instalar aplicativo ou Adicionar à tela inicial no menu de opções ou de compartilhamento do navegador, se essa opção estiver disponível."
    );

    const guide = document.querySelector(
      "#sbw-pwa-install-guide, #como-instalar-sbw, [data-sbw-pwa-guide]"
    );

    guide?.scrollIntoView({
      behavior: window.matchMedia?.(
        "(prefers-reduced-motion: reduce)"
      ).matches ? "auto" : "smooth",
      block: "start"
    });
  }

  async function handleInstallClick(event) {
    event.preventDefault();

    if (promptInProgress) return;

    if (isInstalled()) {
      refreshButtons();

      setStatusText(
        "O app " + APP_NAME + " já está instalado ou aberto em modo aplicativo."
      );
      return;
    }

    if (!deferredPrompt) {
      showInstallHelp();
      return;
    }

    // Cada evento de instalação só pode ser utilizado uma vez.
    const installEvent = deferredPrompt;

    deferredPrompt = null;
    promptInProgress = true;
    refreshButtons();

    try {
      // A chamada ocorre diretamente a partir do clique do usuário.
      const result = await installEvent.prompt();
      const choice = result?.outcome
        ? result
        : await installEvent.userChoice;

      if (!isInstalled()) {
        setStatusText(
          choice?.outcome === "accepted"
            ? "Instalação solicitada. Aguarde a conclusão pelo navegador."
            : "Instalação cancelada. Você pode tentar novamente quando a opção estiver disponível no navegador."
        );
      }
    } catch (error) {
      console.warn(
        "[SBW PWA] Não foi possível abrir a instalação:",
        error
      );

      if (!isInstalled()) {
        setStatusText(
          "Não foi possível abrir a instalação automática. Tente pelo menu do navegador."
        );
      }
    } finally {
      promptInProgress = false;
      refreshButtons();
    }
  }

  function registerServiceWorker() {
    if (
      !("serviceWorker" in navigator) ||
      !window.isSecureContext ||
      !["http:", "https:"].includes(window.location.protocol) ||
      SITE_BASE_URL.origin !== window.location.origin
    ) {
      return Promise.resolve(null);
    }

    if (registrationPromise) {
      return registrationPromise;
    }

    registrationPromise = Promise.resolve()
      .then(() =>
        navigator.serviceWorker.register(
          SERVICE_WORKER_URL.href,
          {
            scope: SITE_BASE_URL.href,
            updateViaCache: "none"
          }
        )
      )
      .then((registration) => {
        currentRegistration = registration;

        // Permite que sbw-site-compliance.js acompanhe as atualizações.
        window.dispatchEvent(
          new CustomEvent("sbw:pwa-registered", {
            detail: { registration }
          })
        );

        return registration;
      })
      .catch((error) => {
        registrationPromise = null;

        if (navigator.onLine !== false) {
          console.warn(
            "[SBW PWA] Service worker não registrado:",
            error
          );
        }

        return null;
      });

    return registrationPromise;
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    if (typeof event.prompt !== "function") return;

    if (isInstalled()) return;

    event.preventDefault();
    deferredPrompt = event;
    refreshButtons();

    setStatusText(
      "Instalação disponível. Clique no botão para instalar o app " + APP_NAME + "."
    );
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installedThisSession = true;
    refreshButtons();

    setStatusText(
      "App " + APP_NAME + " instalado com sucesso."
    );
  });

  function handleDisplayModeChange() {
    refreshButtons();

    if (isStandaloneMode()) {
      setStatusText(
        APP_NAME + " aberto em modo aplicativo."
      );
    } else if (installedThisSession) {
      setStatusText("App " + APP_NAME + " instalado com sucesso.");
    } else {
      setStatusText(
        deferredPrompt ? "Instalação disponível neste navegador." : ""
      );
    }
  }

  if (typeof standaloneMedia?.addEventListener === "function") {
    standaloneMedia.addEventListener("change", handleDisplayModeChange);
  } else if (typeof standaloneMedia?.addListener === "function") {
    standaloneMedia.addListener(handleDisplayModeChange);
  }

  // Permite tentar o registro novamente depois de recuperar a conexão.
  window.addEventListener("online", () => {
    if (!currentRegistration) registerServiceWorker();
  });

  function initPwa() {
    refreshButtons();

    if (isStandaloneMode()) {
      setStatusText(
        APP_NAME + " aberto em modo aplicativo."
      );
    } else if (installedThisSession) {
      setStatusText(
        "App " + APP_NAME + " instalado com sucesso."
      );
    } else if (lastStatus) {
      setStatusText(lastStatus);
    }

    registerServiceWorker();
  }

  window.SBWPWA = {
    version: PWA_VERSION,
    register: registerServiceWorker,
    getRegistration: () => currentRegistration,
    getBasePath: () => SITE_BASE_URL.pathname,
    getAppUrl: () => APP_URL.href,
    refresh: refreshButtons
  };

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initPwa,
      { once: true }
    );
  } else {
    initPwa();
  }
})();