(function () {
  "use strict";

  const scriptElement =
    document.currentScript ||
    Array.from(document.scripts).find((script) =>
      /\/js\/creators\/creators-page\.js(?:[?#]|$)/i.test(script.src)
    );

  // Este arquivo fica em js/creators/, dois níveis abaixo da pasta do site.
  const SITE_BASE_URL = scriptElement?.src
    ? new URL("../../", scriptElement.src)
    : new URL("../", document.baseURI || window.location.href);

  const FALLBACK_AVATAR = new URL(
    "assets/images/logo-sbw.png",
    SITE_BASE_URL
  ).href;

  const ROTATION_DELAY = 6200;
  const reducedMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)"
  );

  const creators = [
    {
      id: "dlucca",
      name: "-SBW- | D’Lucca",
      role: "Fundador e creator",
      badge: "Oficial",
      description:
        "Fundador da -SBW-, creator e responsável por iniciativas de conteúdo e comunidade da SaberWolf Esports.",
      avatar: "assets/images/dlucca-avatar.jpeg",
      href: "creators/creator-dlucca.html",
      tags: ["Fundador", "Conteúdo", "Comunidade"],
      filters: ["sbw", "community"]
    },
    {
      id: "elitz",
      name: "-SBW- | EliTz",
      role: "Creator oficial",
      badge: "Oficial",
      description:
        "Jogador profissional de Call of Duty e creator da -SBW-, com conteúdo voltado a gameplay e evolução dentro do jogo.",
      avatar: "assets/images/elitz-avatar.jpg",
      href: "creators/creator-elitz.html",
      tags: ["Call of Duty", "Conteúdo", "SBW"],
      filters: ["sbw", "gameplay", "community"]
    },
    {
      id: "kari-akane",
      name: "Kari Akane",
      role: "FGC / Comunidade parceira",
      badge: "Parceira",
      description:
        "Representante da Fighting Girls Community, fortalecendo presença, acolhimento e visibilidade feminina na FGC.",
      avatar: "assets/images/kari-akane-avatar.jpg",
      href: "creators/creator-kari-akane.html",
      tags: ["FGC", "Comunidade", "Fighting Girls"],
      filters: ["fgc", "community"]
    },
    {
      id: "tiger-furious",
      name: "-SBW- | TigerFurious",
      role: "Creator parceira",
      badge: "Parceira",
      description:
        "Creator parceira conectada a fighting games, gameplay, comunidade e conteúdo competitivo da SaberWolf Esports.",
      avatar: "assets/images/tigerfurious-avatar.jpg",
      href: "creators/creator-tiger-furious.html",
      tags: ["FGC", "Live", "Comunidade"],
      filters: ["fgc", "gameplay", "community"]
    }
  ];

  let page = null;
  let featuredCard = null;
  let activeFilter = "all";
  let activeSearch = "";
  let featuredIndex = 0;
  let featuredTimer = null;
  let transitionTimer = null;
  let hovered = false;
  let focused = false;
  let paused = false;

  function qs(selector, root = page) {
    return root?.querySelector(selector) || null;
  }

  function qsa(selector, root = page) {
    return Array.from(root?.querySelectorAll(selector) || []);
  }

  function siteUrl(path) {
    return (
      window.SBWRoutes?.url?.(path) ||
      new URL(path, SITE_BASE_URL).href
    );
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeText(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function imageWithFallback(event) {
    const image = event.currentTarget;

    if (!image || image.dataset.fallbackApplied === "true") return;

    image.dataset.fallbackApplied = "true";
    image.alt = "Logo da SaberWolf Esports";
    image.src = FALLBACK_AVATAR;
  }

  function bindImageFallback(image) {
    image.addEventListener("error", imageWithFallback);

    if (image.complete && image.naturalWidth === 0) {
      imageWithFallback({ currentTarget: image });
    }
  }

  function setFeaturedAvatar(image, creator) {
    // Cada novo creator deve poder usar a imagem reserva novamente.
    delete image.dataset.fallbackApplied;

    image.alt = creator.name;
    image.addEventListener("error", imageWithFallback);
    image.src = creator.avatar
      ? siteUrl(creator.avatar)
      : FALLBACK_AVATAR;
  }

  function creatorMatches(creator) {
    const tags = creator.tags || [];
    const filters = creator.filters || [];

    const matchesFilter =
      activeFilter === "all" ||
      filters.some((filter) => normalizeText(filter) === activeFilter) ||
      tags.some((tag) => normalizeText(tag).includes(activeFilter));

    const haystack = normalizeText(
      [
        creator.name,
        creator.role,
        creator.description,
        ...tags
      ].join(" ")
    );

    return (
      matchesFilter &&
      (!activeSearch || haystack.includes(activeSearch))
    );
  }

  function renderCreatorCard(creator) {
    const tags = (creator.tags || [])
      .slice(0, 3)
      .map((tag) => `<span>${escapeHtml(tag)}</span>`)
      .join("");

    return `
      <a
        class="sbw-creator-card"
        href="${escapeHtml(siteUrl(creator.href))}"
      >
        <div class="sbw-creator-card__top">
          <img
            class="sbw-creator-card__avatar"
            src="${escapeHtml(siteUrl(creator.avatar))}"
            alt="${escapeHtml(creator.name)}"
            loading="lazy"
            decoding="async"
          />

          <span class="sbw-creator-card__badge">
            ${escapeHtml(creator.badge)}
          </span>
        </div>

        <div>
          <h3>${escapeHtml(creator.name)}</h3>
          <p>${escapeHtml(creator.description)}</p>
        </div>

        <div class="sbw-creator-card__footer">
          <div class="sbw-creator-card__tags">${tags}</div>
          <span>Ver perfil →</span>
        </div>
      </a>
    `;
  }

  function renderGrid() {
    const grid = qs("[data-creators-grid]");
    if (!grid) return;

    const filtered = creators.filter(creatorMatches);

    grid.innerHTML = filtered.length
      ? filtered.map(renderCreatorCard).join("")
      : `
        <div class="sbw-creators-empty" role="status">
          Nenhum creator encontrado com os filtros atuais.
        </div>
      `;

    qsa("img", grid).forEach(bindImageFallback);
  }

  function cancelTransition() {
    window.clearTimeout(transitionTimer);
    transitionTimer = null;
    featuredCard?.classList.remove("is-changing");
  }

  function renderFeatured(animate = false) {
    if (!featuredCard || !creators.length) return;

    cancelTransition();

    const creator = creators[featuredIndex];

    const applyContent = () => {
      transitionTimer = null;

      const avatar = qs("[data-featured-avatar]", featuredCard);
      const role = qs("[data-featured-role]", featuredCard);
      const name = qs("[data-featured-name]", featuredCard);
      const description = qs(
        "[data-featured-description]",
        featuredCard
      );
      const tags = qs("[data-featured-tags]", featuredCard);
      const link = qs("[data-featured-link]", featuredCard);

      if (avatar) setFeaturedAvatar(avatar, creator);
      if (role) role.textContent = creator.role;
      if (name) name.textContent = creator.name;
      if (description) description.textContent = creator.description;

      if (tags) {
        tags.innerHTML = (creator.tags || [])
          .map((tag) => `<span>${escapeHtml(tag)}</span>`)
          .join("");
      }

      if (link) {
        link.href = siteUrl(creator.href);
        link.setAttribute(
          "aria-label",
          `Ver perfil de ${creator.name}`
        );
      }

      featuredCard.setAttribute(
        "aria-label",
        `Creator em destaque: ${creator.name}`
      );

      featuredCard.classList.remove("is-changing");
    };

    if (animate && !reducedMotion?.matches) {
      featuredCard.classList.add("is-changing");
      transitionTimer = window.setTimeout(applyContent, 150);
    } else {
      applyContent();
    }
  }

  function stopRotation() {
    window.clearTimeout(featuredTimer);
    featuredTimer = null;
  }

  function scheduleRotation() {
    stopRotation();

    if (
      !featuredCard ||
      creators.length < 2 ||
      document.hidden ||
      reducedMotion?.matches ||
      hovered ||
      focused ||
      paused
    ) {
      return;
    }

    featuredTimer = window.setTimeout(
      () => moveFeatured(1),
      ROTATION_DELAY
    );
  }

  function moveFeatured(direction) {
    if (!featuredCard || creators.length < 2) return;

    featuredIndex =
      (featuredIndex + direction + creators.length) % creators.length;

    renderFeatured(true);
    scheduleRotation();
  }

  function bindFeaturedControls() {
    if (!featuredCard) return;

    qs("[data-feature-prev]")?.addEventListener(
      "click",
      () => moveFeatured(-1)
    );

    qs("[data-feature-next]")?.addEventListener(
      "click",
      () => moveFeatured(1)
    );

    const nav = qs(".sbw-featured-creator__nav", featuredCard);

    if (nav) {
      const toggle =
        qs("[data-feature-toggle]", nav) ||
        document.createElement("button");

      toggle.type = "button";
      toggle.dataset.featureToggle = "";

      function updateToggle() {
        const unavailable = Boolean(reducedMotion?.matches);

        toggle.disabled = unavailable;

        const label = unavailable
          ? "Troca automática desativada pela preferência de movimento"
          : paused
            ? "Retomar troca automática dos creators"
            : "Pausar troca automática dos creators";

        toggle.textContent = paused || unavailable ? "▶" : "Ⅱ";
        toggle.setAttribute("aria-label", label);
        toggle.title = label;
      }

      toggle.addEventListener("click", () => {
        paused = !paused;
        updateToggle();
        scheduleRotation();
      });

      nav.appendChild(toggle);
      updateToggle();

      reducedMotion?.addEventListener?.("change", updateToggle);
    }

    featuredCard.addEventListener("mouseenter", () => {
      hovered = true;
      stopRotation();
    });

    featuredCard.addEventListener("mouseleave", () => {
      hovered = false;
      scheduleRotation();
    });

    featuredCard.addEventListener("focusin", () => {
      focused = true;
      stopRotation();
    });

    featuredCard.addEventListener("focusout", (event) => {
      focused = featuredCard.contains(event.relatedTarget);
      scheduleRotation();
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) renderFeatured();
      scheduleRotation();
    });

    reducedMotion?.addEventListener?.("change", () => {
      renderFeatured();
      scheduleRotation();
    });
  }

  function bindFilters() {
    const search = qs("[data-creator-search]");

    if (search) {
      activeSearch = normalizeText(search.value);

      search.addEventListener("input", () => {
        activeSearch = normalizeText(search.value);
        renderGrid();
      });
    }

    const buttons = qsa("[data-creator-filter]");

    function selectFilter(button) {
      activeFilter =
        normalizeText(button.dataset.creatorFilter) || "all";

      buttons.forEach((item) => {
        const selected = item === button;

        item.classList.toggle("is-active", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
    }

    const initialFilter =
      buttons.find((button) =>
        button.classList.contains("is-active")
      ) ||
      buttons.find((button) =>
        button.dataset.creatorFilter === "all"
      );

    if (initialFilter) selectFilter(initialFilter);

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        selectFilter(button);
        renderGrid();
      });
    });
  }

  function init() {
    page = document.getElementById("sbwCreatorsPage");

    if (!page || page.dataset.sbwCreatorsInitialized === "true") {
      return;
    }

    page.dataset.sbwCreatorsInitialized = "true";
    featuredCard = qs("[data-featured-creator]");

    bindFilters();
    bindFeaturedControls();
    renderFeatured();
    renderGrid();
    scheduleRotation();

    window.addEventListener("pagehide", () => {
      stopRotation();
      cancelTransition();
    });

    window.addEventListener("pageshow", () => {
      renderFeatured();
      scheduleRotation();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, {
      once: true
    });
  } else {
    init();
  }
})();