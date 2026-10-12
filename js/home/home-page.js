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

