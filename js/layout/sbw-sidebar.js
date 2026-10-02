(function () {
  "use strict";

  /*
   * Identifica a pasta do site a partir deste arquivo:
   * js/layout/sbw-sidebar.js
   *
   * A identificação acontece antes do DOMContentLoaded,
   * enquanto document.currentScript está disponível.
   */
  const scriptElement =
    document.currentScript ||
    Array.from(document.scripts).find((script) =>
      /\/js\/layout\/sbw-sidebar\.js(?:[?#]|$)/i.test(script.src)
    );

  const siteBaseUrl = scriptElement?.src
    ? new URL("../../", scriptElement.src)
    : new URL(
        window.SBWRoutes?.getBasePath?.() || "./",
        window.location.href
      );

  function siteUrl(relativePath) {
    const cleanPath = String(relativePath || "").replace(/^\/+/, "");
    return new URL(cleanPath, siteBaseUrl).href;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getChampionshipUrl() {
    const localHosts = [
      "localhost",
      "127.0.0.1",
      "0.0.0.0",
      "::1",
      "[::1]"
    ];

    const isLocalHttp =
      localHosts.includes(window.location.hostname) &&
      ["http:", "https:"].includes(window.location.protocol);

    if (isLocalHttp) {
      const url = new URL("/", window.location.href);
      url.port = "5501";
      return url.href;
    }

    /*
     * Quando o domínio oficial estiver configurado,
     * o endereço será fornecido pelo arquivo de rotas.
     */
    try {
      const configuredUrl = window.SBWRoutes?.championship?.("/");

      if (
        typeof configuredUrl === "string" &&
        /^https?:\/\//i.test(configuredUrl)
      ) {
        return new URL(configuredUrl).href;
      }
    } catch (error) {
      console.warn(
        "[SaberWolf] Não foi possível resolver o endereço da Championship:",
        error
      );
    }

    return "";
  }

  const localLinks = [
    {
      id: "home",
      label: "Início",
      href: siteUrl("index.html"),
      icon: "⌂"
    },
    {
      id: "news",
      label: "Notícias",
      href: siteUrl("blog/noticias.html"),
      icon: "▤"
    },
    {
      id: "about",
      label: "Sobre",
      href: siteUrl("pages/sobre.html"),
      icon: "ⓘ"
    },
    {
      id: "creators",
      label: "Creators",
      href: siteUrl("creators/creators.html"),
      icon: "✦"
    },
    {
      id: "athletes",
      label: "Atletas",
      href: siteUrl("atletas/atletas-sbw.html"),
      icon: "♟"
    },
    {
      id: "communities",
      label: "Comunidades",
      href: siteUrl("comunidades/comunidades.html"),
      icon: "◎"
    },
    {
      id: "content",
      label: "Conteúdo",
      href: siteUrl("pages/conteudo.html"),
      icon: "▶"
    },
    {
      id: "shop",
      label: "Loja",
      href: siteUrl("pages/loja.html"),
      icon: "◇"
    },
    {
      id: "championship",
      label: "SBW Championship",
      href: getChampionshipUrl(),
      icon: "🏆",
      external: true
    },
    {
      id: "links",
      label: "Links oficiais",
      href: siteUrl("links/index.html"),
      icon: "↗"
    }
  ];

  function getActivePage() {
    return document.body.dataset.sbwActivePage || "home";
  }

  function setMobileSidebarOpen(isOpen) {
    document.body.classList.toggle("sbw-sidebar-open", isOpen);

    const toggle = document.querySelector("[data-sbw-sidebar-toggle]");

    if (toggle) {
      toggle.setAttribute("aria-expanded", String(isOpen));
      toggle.setAttribute(
        "aria-label",
        isOpen ? "Fechar menu" : "Abrir menu"
      );
    }
  }

  function closeMobileSidebar() {
    setMobileSidebarOpen(false);
  }

  function renderLinks(activePage) {
    return localLinks
      .map((link) => {
        const isActive = link.id === activePage && !link.external;

        const className =
          "sbw-sidebar__link" + (isActive ? " is-active" : "");

        const content = `
          <span class="sbw-sidebar__icon" aria-hidden="true">
            ${escapeHtml(link.icon)}
          </span>
          <span class="sbw-sidebar__label">
            <span>${escapeHtml(link.label)}</span>
          </span>
        `;

        if (!link.href) {
          return `
            <span
              class="${className}"
              role="link"
              aria-disabled="true"
              title="SBW Championship em preparação"
            >
              ${content}
            </span>
          `;
        }

        const activeAttribute = isActive
          ? ' aria-current="page"'
          : "";

        const externalAttributes = link.external
          ? `
              target="_blank"
              rel="noopener noreferrer"
              aria-label="${escapeHtml(link.label)} — abre em nova aba"
            `
          : "";

        return `
          <a
            class="${className}"
            href="${escapeHtml(link.href)}"
            data-sbw-sidebar-nav
            ${activeAttribute}
            ${externalAttributes}
          >
            ${content}
          </a>
        `;
      })
      .join("");
  }

  function ensureVisualBalanceStyles() {
    if (document.getElementById("sbwVisualBalanceStyles")) return;

    const link = document.createElement("link");

    link.id = "sbwVisualBalanceStyles";
    link.rel = "stylesheet";
    link.href = siteUrl(
      "css/core/sbw-visual-balance.css?v=manual-1"
    );

    document.head.appendChild(link);
  }

  function initSidebarControls() {
    const toggle = document.querySelector("[data-sbw-sidebar-toggle]");
    const backdrop = document.querySelector("[data-sbw-sidebar-close]");

    if (toggle) {
      toggle.setAttribute("aria-controls", "sbwSidebar");

      toggle.addEventListener("click", () => {
        const isOpen = document.body.classList.contains(
          "sbw-sidebar-open"
        );

        setMobileSidebarOpen(!isOpen);
      });
    }

    backdrop?.addEventListener("click", closeMobileSidebar);

    document.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        document.body.classList.contains("sbw-sidebar-open")
      ) {
        closeMobileSidebar();
        toggle?.focus();
      }
    });

    setMobileSidebarOpen(false);
  }

  function initSidebar() {
    const mount = document.getElementById("sbwSidebarMount");

    if (!mount || mount.dataset.sbwSidebarReady === "true") return;

    ensureVisualBalanceStyles();

    document.body.classList.add("sbw-has-sidebar");

    mount.innerHTML = `
      <aside
        id="sbwSidebar"
        class="sbw-sidebar"
        aria-label="Menu principal SaberWolf Esports"
      >
        <a
          class="sbw-sidebar__brand"
          href="${escapeHtml(siteUrl("index.html"))}"
          aria-label="SaberWolf Esports — início"
        >
          <span
            class="sbw-sidebar__brand-mark"
            aria-hidden="true"
          >
            <img
              src="${escapeHtml(siteUrl("assets/images/logo-sbw.png"))}"
              alt=""
            />
          </span>

          <span class="sbw-sidebar__brand-text">
            <strong>SaberWolf</strong>
            <span>Esports</span>
          </span>
        </a>

        <nav
          class="sbw-sidebar__nav"
          aria-label="Navegação institucional"
        >
          ${renderLinks(getActivePage())}
        </nav>
      </aside>
    `;

    mount.querySelectorAll("[data-sbw-sidebar-nav]").forEach((link) => {
      link.addEventListener("click", closeMobileSidebar);
    });

    initSidebarControls();

    mount.dataset.sbwSidebarReady = "true";

    requestAnimationFrame(() => {
      document.body.classList.remove("sbw-sidebar-no-transition");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSidebar, {
      once: true
    });
  } else {
    initSidebar();
  }
})();