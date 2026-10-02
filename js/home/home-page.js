(function () {
  "use strict";

  function ensureReducedMotionStyles() {
    if (document.getElementById("sbwHomeMotionStyles")) return;

    const style = document.createElement("style");
    style.id = "sbwHomeMotionStyles";

    style.textContent = `
      @media (prefers-reduced-motion: reduce) {
        html {
          scroll-behavior: auto !important;
        }

        body.sbw-home-page .sbw-reveal,
        body.sbw-home-page .sbw-btn,
        body.sbw-home-page .sbw-feature-member--link,
        body.sbw-home-page .sbw-feature-member__photo img,
        body.sbw-home-page .sbw-module-card {
          animation: none !important;
          transition: none !important;
          transform: none !important;
        }

        body.sbw-home-page .sbw-reveal {
          opacity: 1 !important;
          visibility: visible !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function initRevealAnimation(root) {
    const elements = Array.from(root.querySelectorAll(".sbw-reveal"));

    if (!elements.length) return;

    const motionPreference =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;

    let observer = null;

    function revealAll() {
      observer?.disconnect();

      elements.forEach((element) => {
        element.classList.add("is-visible");
      });
    }

    if (
      motionPreference?.matches ||
      typeof window.IntersectionObserver !== "function"
    ) {
      revealAll();
      return;
    }

    try {
      observer = new window.IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;

            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          });
        },
        {
          // Permite revelar também blocos maiores que a tela.
          threshold: 0
        }
      );

      elements.forEach((element) => {
        observer.observe(element);
      });
    } catch (error) {
      revealAll();
      console.warn("[SBW Home] Conteúdo exibido sem animação:", error);
      return;
    }

    function handleMotionChange(event) {
      if (event.matches) {
        revealAll();
      }
    }

    if (typeof motionPreference?.addEventListener === "function") {
      motionPreference.addEventListener("change", handleMotionChange);
    } else if (typeof motionPreference?.addListener === "function") {
      motionPreference.addListener(handleMotionChange);
    }
  }

  function initHomePage() {
    if (!document.body?.classList.contains("sbw-home-page")) return;

    const root = document.querySelector(".sbw-home-shell");

    if (!root || root.dataset.sbwHomeInitialized === "true") return;

    root.dataset.sbwHomeInitialized = "true";

    ensureReducedMotionStyles();
    initRevealAnimation(root);

    // As âncoras usam a navegação nativa, incluindo o histórico e o foco.
    // A rolagem suave já está definida em css/home/home-landing.css.
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHomePage, {
      once: true
    });
  } else {
    initHomePage();
  }
})();