(function () {
  "use strict";

  const CATEGORIES = Object.freeze({
    organizacao: "Organização",
    atletas: "Atletas",
    creators: "Creators",
    comunidades: "Comunidades",
    eventos: "Eventos"
  });

  /*
    Cadastre aqui somente notícias já publicadas,
    da mais recente à mais antiga.

    Campos: title, summary, category e href.

    category:
    organizacao, atletas, creators, comunidades ou eventos.

    href:
    Caminho a partir da pasta do site,
    como blog/nome-da-materia.html,
    ou endereço completo de uma publicação externa.

    featured: true é opcional para escolher uma matéria em destaque.
  */
  const officialNews = [];

  const scriptElement =
    document.currentScript ||
    Array.from(document.scripts).find((script) =>
      /\/js\/news\/news-page\.js(?:[?#]|$)/i.test(script.src)
    );

  // Este arquivo está em js/news/, dois níveis abaixo da pasta do site.
  const SITE_BASE_URL = scriptElement?.src
    ? new URL("../../", scriptElement.src)
    : new URL("../", document.baseURI || window.location.href);

  let page = null;
  let news = [];
  let activeCategory = "all";

  function normalize(value) {
    return String(value ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function qs(selector) {
    return page?.querySelector(selector) || null;
  }

  function categoryExists(value) {
    return Object.prototype.hasOwnProperty.call(
      CATEGORIES,
      value
    );
  }

  function resolveNewsLink(value) {
    const raw = String(value ?? "").trim();

    if (!raw || raw.startsWith("#")) return null;

    try {
      let url;

      if (
        /^[a-z][a-z0-9+.-]*:/i.test(raw) ||
        raw.startsWith("//")
      ) {
        url = new URL(raw, SITE_BASE_URL);
      } else if (
        raw.startsWith("./") ||
        raw.startsWith("../")
      ) {
        url = new URL(
          raw,
          document.baseURI || window.location.href
        );
      } else {
        const basePath = SITE_BASE_URL.pathname;

        const path = raw.startsWith(basePath)
          ? raw.slice(basePath.length)
          : raw.replace(/^\/+/, "");

        const routedPath = window.SBWRoutes?.url
          ? window.SBWRoutes.url(path)
          : "./" + path;

        if (!routedPath || routedPath.startsWith("#")) {
          return null;
        }

        url = new URL(routedPath, SITE_BASE_URL);
      }

      const allowed =
        ["http:", "https:"].includes(url.protocol) ||
        (
          url.protocol === "file:" &&
          SITE_BASE_URL.protocol === "file:"
        );

      if (!allowed) return null;

      return {
        href: url.href,
        external: url.origin !== SITE_BASE_URL.origin
      };
    } catch {
      return null;
    }
  }

  function prepareNews(item) {
    if (!item || typeof item !== "object") return null;

    const title = String(item.title ?? "").trim();
    const summary = String(item.summary ?? "").trim();
    const category = normalize(item.category);

    if (!title || !categoryExists(category)) return null;

    return {
      title,
      summary,
      category,
      categoryLabel: CATEGORIES[category],
      link: resolveNewsLink(item.href),
      featured: item.featured === true,
      searchText: normalize(
        [
          title,
          summary,
          CATEGORIES[category]
        ].join(" ")
      )
    };
  }

  function renderReadMore(item, featured = false) {
    if (!item.link) return "";

    const external = item.link.external;

    const attributes = external
      ? ' target="_blank" rel="noopener noreferrer"'
      : "";

    const className = featured
      ? "sbw-news-button"
      : "sbw-news-button sbw-news-button--ghost";

    const label =
      `Ler notícia: ${item.title}` +
      (external ? " (abre em nova aba)" : "");

    return `
      <a
        class="${className}"
        href="${escapeHtml(item.link.href)}"
        aria-label="${escapeHtml(label)}"
        ${attributes}
      >
        Ler mais ${external ? "↗" : "→"}
      </a>
    `;
  }

  function renderCard(item) {
    return `
      <article class="sbw-news-card">
        <span>${escapeHtml(item.categoryLabel)}</span>

        <h3>${escapeHtml(item.title)}</h3>

        ${
          item.summary
            ? `<p>${escapeHtml(item.summary)}</p>`
            : ""
        }

        ${renderReadMore(item)}
      </article>
    `;
  }

  function renderFeatured(items) {
    const featured = qs("[data-sbw-news-featured]");

    if (!featured) return;

    const item =
      items.find((entry) => entry.featured) ||
      items[0];

    featured.hidden = !item;

    if (!item) {
      featured.innerHTML = "";
      return;
    }

    featured.innerHTML = `
      <div class="sbw-news-featured__meta">
        <span class="sbw-news-chip">
          ${escapeHtml(item.categoryLabel)}
        </span>

        <span>Em destaque</span>
      </div>

      <h2>${escapeHtml(item.title)}</h2>

      ${
        item.summary
          ? `<p>${escapeHtml(item.summary)}</p>`
          : ""
      }

      ${
        item.link
          ? `
            <div class="sbw-news-featured__footer">
              ${renderReadMore(item, true)}
            </div>
          `
          : ""
      }
    `;
  }

  function updateEmptyState(hasResults) {
    const empty = qs("[data-sbw-news-empty]");

    if (!empty) return;

    empty.hidden = hasResults;
    empty.classList.toggle("is-hidden", hasResults);

    if (hasResults) return;

    const title = empty.querySelector("strong");
    const description = empty.querySelector("p");
    const hasPublications = news.length > 0;

    if (title) {
      title.textContent = hasPublications
        ? "Nenhuma notícia encontrada."
        : "Nenhuma notícia publicada no momento.";
    }

    if (description) {
      description.textContent = hasPublications
        ? "Tente outra palavra na busca ou selecione outra categoria."
        : "Os próximos comunicados e novidades da SaberWolf serão divulgados aqui.";
    }
  }

  function renderNews() {
    const grid = qs("[data-sbw-news-grid]");

    if (!grid) return;

    const searchTerm = normalize(
      qs("[data-sbw-news-search]")?.value
    );

    const filtered = news.filter((item) => {
      const matchesCategory =
        activeCategory === "all" ||
        item.category === activeCategory;

      const matchesSearch =
        !searchTerm ||
        item.searchText.includes(searchTerm);

      return matchesCategory && matchesSearch;
    });

    // Sem resultados, a lista fica vazia.
    // Não são criados cartões de exemplo.
    grid.innerHTML = filtered.map(renderCard).join("");

    updateEmptyState(filtered.length > 0);
    renderFeatured(filtered);

    // Todas as matérias filtradas já são exibidas nesta versão.
    const loadMore = qs(
      "[data-sbw-news-load-more], .sbw-news-load-more"
    );

    if (loadMore) {
      loadMore.disabled = true;
      loadMore.hidden = true;
    }
  }

  function selectCategory(value) {
    const category = normalize(value);

    activeCategory = categoryExists(category)
      ? category
      : "all";

    page
      .querySelectorAll("[data-sbw-news-category]")
      .forEach((button) => {
        const selected =
          normalize(button.dataset.sbwNewsCategory) ===
          activeCategory;

        button.classList.toggle("is-active", selected);
        button.setAttribute(
          "aria-pressed",
          String(selected)
        );
      });
  }

  function bindFilters() {
    const buttons = Array.from(
      page.querySelectorAll("[data-sbw-news-category]")
    );

    const initialButton = buttons.find((button) =>
      button.classList.contains("is-active")
    );

    selectCategory(
      initialButton?.dataset.sbwNewsCategory || "all"
    );

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        selectCategory(button.dataset.sbwNewsCategory);
        renderNews();
      });
    });

    qs("[data-sbw-news-search]")?.addEventListener(
      "input",
      renderNews
    );
  }

  function initNewsPage() {
    page = document.getElementById("sbwNewsPage");

    if (
      !page ||
      page.dataset.sbwNewsInitialized === "true"
    ) {
      return;
    }

    if (!qs("[data-sbw-news-grid]")) return;

    page.dataset.sbwNewsInitialized = "true";

    news = officialNews
      .map(prepareNews)
      .filter(Boolean);

    bindFilters();
    renderNews();

    window.SBWPageState?.markReady?.();

    window.requestAnimationFrame(() => {
      document.body.classList.remove(
        "sbw-sidebar-no-transition"
      );
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initNewsPage,
      { once: true }
    );
  } else {
    initNewsPage();
  }
})();