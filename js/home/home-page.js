/* SaberWolf Esports — navegação da Home e abertura de apps anteriores. */
(function () {
  "use strict";

  const scriptElement = document.currentScript ||
    Array.from(document.scripts).find((script) =>
      /\/js\/home\/home-page\.js(?:[?#]|$)/i.test(script.src)
    );

  const siteBaseUrl = scriptElement?.src
    ? new URL("../../", scriptElement.src)
    : new URL(
        window.SBWRoutes?.getBasePath?.() || "./",
        document.baseURI || window.location.href
      );

  function redirectLegacyAppLaunch() {
    const url = new URL(window.location.href);
    const source = url.searchParams.get("source");
    const homePaths = [
      siteBaseUrl.pathname,
      new URL("index.html", siteBaseUrl).pathname,
      new URL("index", siteBaseUrl).pathname
    ];

    // Navegar para a Home pela central continua abrindo o site de esports.
    if (
      !["pwa-saberwolf", "pwa"].includes(source) ||
      !homePaths.includes(url.pathname)
    ) {
      return false;
    }

    const isApp = navigator.standalone === true ||
      (typeof window.matchMedia === "function" && (
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: window-controls-overlay)").matches
      ));

    if (!isApp) return false;

    const destination = new URL("app/index.html", siteBaseUrl);
    destination.searchParams.set("source", "pwa-saberwolf");
    window.location.replace(destination.href);
    return true;
  }

  if (redirectLegacyAppLaunch()) return;

  function initHomePage() {
    if (!document.body?.classList.contains("sbw-home-page")) return;

    const header = document.querySelector("[data-sbw-home-header]");
    const toggle = document.querySelector("[data-sbw-home-menu-toggle]");
    const nav = document.querySelector("[data-sbw-home-nav]");

    if (!header || !toggle || !nav || header.dataset.sbwHomeInitialized) return;

    header.dataset.sbwHomeInitialized = "true";

    function setMenuOpen(open, restoreFocus = false) {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Fechar menu principal" : "Abrir menu principal");
      if (restoreFocus) toggle.focus();
    }

    toggle.addEventListener("click", () => {
      setMenuOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    nav.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("a[href]")) {
        setMenuOpen(false);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        event.preventDefault();
        setMenuOpen(false, true);
      }
    });

    document.addEventListener("pointerdown", (event) => {
      if (!header.contains(event.target)) setMenuOpen(false);
    });

    header.addEventListener("focusout", (event) => {
      if (event.relatedTarget && !header.contains(event.relatedTarget)) {
        setMenuOpen(false);
      }
    });

    const desktop = window.matchMedia?.("(min-width: 1200px)");
    const handleResize = () => setMenuOpen(false);

    if (typeof desktop?.addEventListener === "function") {
      desktop.addEventListener("change", handleResize);
    } else if (typeof desktop?.addListener === "function") {
      desktop.addListener(handleResize);
    }

    setMenuOpen(false);
    toggle.hidden = false;
    header.classList.add("is-menu-ready");

    document.querySelectorAll(".sbw-feature-member__photo img").forEach((img) => {
      const hideBrokenImage = () => { img.hidden = true; };
      img.addEventListener("error", hideBrokenImage, { once: true });
      if (img.complete && img.naturalWidth === 0) hideBrokenImage();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHomePage, { once: true });
  } else {
    initHomePage();
  }
})();
