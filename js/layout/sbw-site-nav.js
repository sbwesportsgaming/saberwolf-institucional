/* SaberWolf Esports — navegação compartilhada das páginas institucionais. */
(function () {
  "use strict";

  function initNavigation() {
    const header = document.querySelector("[data-sbw-site-header]");
    const toggle = document.querySelector("[data-sbw-site-menu-toggle]");
    const nav = document.querySelector("[data-sbw-site-nav]");

    if (!header || !toggle || !nav || header.dataset.sbwNavInitialized === "true") return;
    header.dataset.sbwNavInitialized = "true";

    function setOpen(open, restoreFocus = false) {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Fechar menu principal" : "Abrir menu principal");
      if (restoreFocus) toggle.focus();
    }

    toggle.addEventListener("click", () => {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    nav.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("a[href]")) setOpen(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        event.preventDefault();
        setOpen(false, true);
      }
    });

    document.addEventListener("pointerdown", (event) => {
      if (!header.contains(event.target)) setOpen(false);
    });

    header.addEventListener("focusout", (event) => {
      if (event.relatedTarget && !header.contains(event.relatedTarget)) setOpen(false);
    });

    const desktop = window.matchMedia?.("(min-width: 1200px)");
    const resetMenu = () => setOpen(false);
    if (typeof desktop?.addEventListener === "function") {
      desktop.addEventListener("change", resetMenu);
    } else if (typeof desktop?.addListener === "function") {
      desktop.addListener(resetMenu);
    }

    setOpen(false);
    toggle.hidden = false;
    header.classList.add("is-menu-ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNavigation, { once: true });
  } else {
    initNavigation();
  }
})();
