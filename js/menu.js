(function () {
  if (window.SBWMenuAlreadyInitialized) {
    return;
  }

  window.SBWMenuAlreadyInitialized = true;

  const competitivePath = /^\/(?:admin|auth|beta|equipes|organizadores|perfis|rankings|torneios|transferencias)(?:\/|$)/;

  function getChampionshipOrigin() {
    if (["127.0.0.1", "localhost", "0.0.0.0", "::1"].includes(window.location.hostname)) {
      return `${window.location.protocol}//${window.location.hostname}:5501`;
    }

    return document.querySelector('meta[name="sbw-championship-origin"]')?.content?.trim() || "";
  }

  function rewriteCrossProductLinks() {
    const championshipOrigin = getChampionshipOrigin();
    if (!championshipOrigin) return;

    document.querySelectorAll('a[href]').forEach((anchor) => {
      const rawHref = anchor.getAttribute("href");
      if (!rawHref || rawHref.startsWith("#")) return;

      const url = new URL(rawHref, window.location.href);
      if (url.origin !== window.location.origin || !competitivePath.test(url.pathname)) return;

      anchor.href = new URL(`${url.pathname}${url.search}${url.hash}`, championshipOrigin).href;
    });
  }

  function initMenu() {
    rewriteCrossProductLinks();

    const header = document.querySelector("body > header");
    const toggleButton = document.querySelector(".menu-toggle");
    const nav = document.querySelector("body > header nav");

    if (!header || !toggleButton || !nav) {
      return;
    }

    toggleButton.addEventListener("click", function () {
      header.classList.toggle("is-open");
      nav.classList.toggle("active");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMenu);
  } else {
    initMenu();
  }
})();
