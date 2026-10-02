(function () {
  "use strict";

  const scriptSource = document.currentScript?.src;

  const siteBaseUrl = scriptSource
    ? new URL("../../", scriptSource)
    : new URL("../", document.baseURI);

  function siteUrl(path) {
    return new URL(path, siteBaseUrl).href;
  }

  const communities = [
    {
      id: "fighting-girls-community",
      name: "Fighting Girls Community",
      category: "Fighting Games",
      game: "Fighting Games",
      region: "Brasil",
      type: "Parceira",
      activity: "Ativa",
      members: "Comunidade parceira",
      online: "Cenas e eventos",

      image: siteUrl("assets/images/fighting-girls-logo-1.png"),

      initials: "FG",
      featured: true,
      description:
        "Comunidade parceira voltada ao fortalecimento, visibilidade e participação feminina no cenário de Fighting Games.",
      tags: ["Parceira", "FGC", "Fighting Games"],

      href: siteUrl("comunidades/comunidade-fighting-girls.html")
    }
  ];

  const categoryMeta = [
    { key: "Fighting Games", icon: "🥊" },
    { key: "Parceira", icon: "★" }
  ];

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function uniqueValues(key) {
    return [...new Set(
      communities.map((item) => item[key]).filter(Boolean)
    )].sort((a, b) =>
      String(a).localeCompare(String(b), "pt-BR")
    );
  }

  function fillSelect(selector, values) {
    const select = document.querySelector(selector);
    if (!select) return;

    const firstOption = select.querySelector("option")?.outerHTML || "";

    select.innerHTML = firstOption + values
      .map((value) => `
        <option value="${escapeHtml(value)}">
          ${escapeHtml(value)}
        </option>
      `)
      .join("");
  }

  function getFilters() {
    return {
      search: String(
        document.querySelector("[data-community-search]")?.value || ""
      ).trim().toLowerCase(),

      game:
        document.querySelector('[data-community-filter="game"]')?.value ||
        "all",

      region:
        document.querySelector('[data-community-filter="region"]')?.value ||
        "all",

      type:
        document.querySelector('[data-community-filter="type"]')?.value ||
        "all",

      activity:
        document.querySelector('[data-community-filter="activity"]')?.value ||
        "all"
    };
  }

  function communityMatches(community, filters) {
    const text = [
      community.name,
      community.category,
      community.game,
      community.region,
      community.type,
      community.activity,
      community.description,
      ...(community.tags || [])
    ]
      .join(" ")
      .toLowerCase();

    if (filters.search && !text.includes(filters.search)) return false;

    if (filters.game !== "all" && community.game !== filters.game) {
      return false;
    }

    if (filters.region !== "all" && community.region !== filters.region) {
      return false;
    }

    if (filters.type !== "all" && community.type !== filters.type) {
      return false;
    }

    if (
      filters.activity !== "all" &&
      community.activity !== filters.activity
    ) {
      return false;
    }

    return true;
  }

  function getCommunityStyle(community) {
    return community.image
      ? ` style="--community-image: url('${escapeHtml(community.image)}')"`
      : "";
  }

  function renderCard(community, options = {}) {
    const isFeatured = Boolean(options.featured);

    const className = isFeatured
      ? "sbw-communities-feature-card sbw-communities-card"
      : "sbw-communities-card";

    const actionLabel = community.href === "#"
      ? "Em breve"
      : "Ver comunidade";

    const href = community.href || "#";

    const tagList = (community.tags || [])
      .map((tag) => `<span>${escapeHtml(tag)}</span>`)
      .join("");

    return `
      <a
        class="${className}"
        href="${escapeHtml(href)}"
        aria-label="Abrir comunidade ${escapeHtml(community.name)}"
      >
        <div
          class="sbw-communities-card__banner"
          ${getCommunityStyle(community)}
        ></div>

        <div class="sbw-communities-card__content">
          <div class="sbw-communities-card__top">
            <span class="sbw-communities-avatar">
              ${escapeHtml(
                community.initials || community.name.slice(0, 2)
              )}
            </span>

            <div class="sbw-communities-card__meta">
              <span>${escapeHtml(community.members)}</span>
              <span>${escapeHtml(community.online)}</span>
            </div>
          </div>

          <h3>${escapeHtml(community.name)}</h3>
          <p>${escapeHtml(community.description)}</p>

          <div class="sbw-communities-badges">
            ${tagList}
          </div>

          <div class="sbw-communities-card__actions">
            <span>${actionLabel} →</span>
          </div>
        </div>
      </a>
    `;
  }

  function renderCategories() {
    const container = document.querySelector("[data-community-categories]");
    if (!container) return;

    container.innerHTML = categoryMeta
      .map((category) => {
        const total = communities.filter((community) =>
          community.category === category.key ||
          community.type === category.key ||
          community.game === category.key
        ).length;

        return `
          <button
            class="sbw-communities-category-card"
            type="button"
            data-community-category="${escapeHtml(category.key)}"
          >
            <span>${category.icon}</span>

            <span>
              <strong>${escapeHtml(category.key)}</strong>
              <small>
                ${total || "Em breve"} comunidade${total === 1 ? "" : "s"}
              </small>
            </span>
          </button>
        `;
      })
      .join("");

    container.querySelectorAll("[data-community-category]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const value = button.dataset.communityCategory;

          const gameSelect = document.querySelector(
            '[data-community-filter="game"]'
          );

          const typeSelect = document.querySelector(
            '[data-community-filter="type"]'
          );

          if (
            gameSelect &&
            [...gameSelect.options].some((option) => option.value === value)
          ) {
            gameSelect.value = value;
          } else if (
            typeSelect &&
            [...typeSelect.options].some((option) => option.value === value)
          ) {
            typeSelect.value = value;
          }

          renderCommunities();

          document.getElementById("communitiesList")?.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        });
      });
  }

  function renderFeatured() {
    const container = document.querySelector("[data-community-featured]");
    if (!container) return;

    const featured = communities
      .filter((community) => community.featured)
      .slice(0, 4);

    container.innerHTML = featured.length
      ? featured
          .map((community) => renderCard(community, { featured: true }))
          .join("")
      : `
          <div class="sbw-communities-empty">
            Nenhuma comunidade em destaque adicional no momento.
          </div>
        `;
  }

  function renderCommunities() {
    const grid = document.querySelector("[data-community-grid]");
    const count = document.querySelector("[data-community-count]");

    if (!grid) return;

    const filters = getFilters();

    const filtered = communities.filter((community) =>
      communityMatches(community, filters)
    );

    if (count) {
      count.textContent =
        `${filtered.length} comunidade${filtered.length === 1 ? "" : "s"} ` +
        `encontrada${filtered.length === 1 ? "" : "s"}`;
    }

    grid.innerHTML = filtered.length
      ? filtered.map((community) => renderCard(community)).join("")
      : `
          <div class="sbw-communities-empty">
            Nenhuma comunidade parceira encontrada com os filtros atuais.
          </div>
        `;
  }

  function bindFilters() {
    document.querySelector("[data-community-search]")
      ?.addEventListener("input", renderCommunities);

    document.querySelectorAll("[data-community-filter]")
      .forEach((select) => {
        select.addEventListener("change", renderCommunities);
      });

    document.querySelector("[data-community-clear]")
      ?.addEventListener("click", () => {
        const search = document.querySelector("[data-community-search]");

        if (search) search.value = "";

        document.querySelectorAll("[data-community-filter]")
          .forEach((select) => {
            select.value = "all";
          });

        renderCommunities();
      });
  }

  function init() {
    const page = document.querySelector(".sbw-communities-page");

    if (!page || page.dataset.sbwCommunitiesInitialized === "true") {
      return;
    }

    page.dataset.sbwCommunitiesInitialized = "true";

    fillSelect('[data-community-filter="game"]', uniqueValues("game"));
    fillSelect('[data-community-filter="region"]', uniqueValues("region"));
    fillSelect('[data-community-filter="type"]', uniqueValues("type"));
    fillSelect('[data-community-filter="activity"]', uniqueValues("activity"));

    renderCategories();
    renderCommunities();
    bindFilters();

    window.SBWPageState?.markReady?.();

    requestAnimationFrame(() => {
      document.body.classList.remove("sbw-sidebar-no-transition");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();