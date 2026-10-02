(function () {
  "use strict";

  const scriptElement =
    document.currentScript ||
    Array.from(document.scripts).find((script) =>
      /\/js\/links\/links-page\.js(?:[?#]|$)/i.test(script.src)
    );

  const SITE_BASE_URL = scriptElement?.src
    ? new URL("../../", scriptElement.src)
    : new URL(
        window.SBWRoutes?.getBasePath?.() || "../",
        document.baseURI || window.location.href
      );

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function siteUrl(path) {
    if (typeof window.SBWRoutes?.url === "function") {
      return window.SBWRoutes.url(path);
    }

    const cleanPath = String(path || "index.html").replace(/^\/+/, "");

    return new URL(cleanPath, SITE_BASE_URL).href;
  }

  function safeHref(value) {
    const href = String(value ?? "").trim();
    if (!href) return "";

    try {
      const url = new URL(
        href,
        document.baseURI || window.location.href
      );

      const isWebUrl = ["http:", "https:"].includes(url.protocol);

      const isLocalFile =
        window.location.protocol === "file:" &&
        url.protocol === "file:";

      if (!isWebUrl && !isLocalFile) return "";

      return url.href;
    } catch {
      return "";
    }
  }

  function getLinkState(item) {
    const href = safeHref(item.href);

    const disabled = item.disabled === true || !href;

    const external =
      !disabled &&
      (
        item.external === true ||
        new URL(href).origin !== SITE_BASE_URL.origin
      );

    const attributes = disabled
      ? 'role="link" aria-disabled="true" tabindex="-1"'
      : `href="${escapeHtml(href)}"${
          external ? ' target="_blank" rel="noopener noreferrer"' : ""
        }`;

    const labelSuffix = disabled
      ? " (indisponível no momento)"
      : external
        ? " (abre em nova aba)"
        : "";

    return {
      disabled,
      external,
      attributes,
      labelSuffix
    };
  }

  function renderLink(link, profileKey) {
    if (!link || typeof link !== "object") return "";

    const state = getLinkState(link);
    const label = String(link.label || "Acessar link");

    const description = state.disabled
      ? "Indisponível no momento."
      : link.description;

    const primaryClass = link.primary
      ? " sbw-link-card--primary"
      : "";

    const tracking = state.disabled
      ? ""
      : `data-sbw-track="links_${escapeHtml(profileKey)}_${escapeHtml(link.id)}"`;

    const arrow = state.disabled
      ? "—"
      : state.external
        ? "↗"
        : "→";

    return `
      <a
        class="sbw-link-card${primaryClass}"
        ${state.attributes}
        ${tracking}
        aria-label="${escapeHtml(label + state.labelSuffix)}"
      >
        <span
          class="sbw-link-card__mark"
          aria-hidden="true"
        >
          ${escapeHtml(link.mark)}
        </span>

        <span class="sbw-link-card__copy">
          <strong>${escapeHtml(label)}</strong>
          <small>${escapeHtml(description)}</small>
        </span>

        <span
          class="sbw-link-card__arrow"
          aria-hidden="true"
        >
          ${arrow}
        </span>
      </a>
    `;
  }

  function renderRelated(related) {
    if (!related || typeof related !== "object") return "";

    const state = getLinkState(related);
    const title = String(related.title || "Saiba mais");

    const description = state.disabled
      ? "Indisponível no momento."
      : related.description;

    const tracking = state.disabled || !related.track
      ? ""
      : `data-sbw-track="${escapeHtml(related.track)}"`;

    const arrow = state.disabled
      ? "—"
      : state.external
        ? "↗"
        : "→";

    return `
      <a
        class="sbw-links-related"
        ${state.attributes}
        ${tracking}
        aria-label="${escapeHtml(title + state.labelSuffix)}"
      >
        <span
          class="sbw-links-related__icon"
          aria-hidden="true"
        >
          -SBW-
        </span>

        <span class="sbw-links-related__copy">
          <small>${escapeHtml(related.eyebrow)}</small>
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(description)}</span>
        </span>

        <span
          class="sbw-links-related__arrow"
          aria-hidden="true"
        >
          ${arrow}
        </span>
      </a>
    `;
  }

  function initLinksPage() {
    const root = document.getElementById("sbwLinksRoot");
    if (!root) return;

    const profileKey =
      document.body.dataset.sbwLinksProfile || "ecosystem";

    const profiles = window.SBWLinksProfiles || {};

    const profile = Object.prototype.hasOwnProperty.call(
      profiles,
      profileKey
    )
      ? profiles[profileKey]
      : null;

    const homeUrl = safeHref(siteUrl("index.html"));

    if (!profile || typeof profile !== "object") {
      root.innerHTML = `
        <section class="sbw-links-noscript">
          <h1>Não foi possível carregar este perfil</h1>

          <p>
            Tente novamente ou acesse o site da SaberWolf Esports.
          </p>

          <a href="${escapeHtml(homeUrl)}">
            Voltar ao início
          </a>
        </section>
      `;

      return;
    }

    const title = String(profile.title || "SaberWolf Esports");

    const links = Array.isArray(profile.links)
      ? profile.links
      : [];

    const linksHtml = links
      .map((link) => renderLink(link, profileKey))
      .join("");

    const fallbackImageUrl = safeHref(
      siteUrl("assets/icons/icon-192-v3.png")
    );

    const profileImageUrl = safeHref(profile.image);
    const imageUrl = profileImageUrl || fallbackImageUrl;

    const imageAlt = profileImageUrl
      ? profile.imageAlt || title
      : "Símbolo da SaberWolf Esports";

    document.body.dataset.sbwLinksTheme =
      profile.theme === "creator" ? "creator" : "ecosystem";

    root.innerHTML = `
      <div class="sbw-links-energy" aria-hidden="true"></div>

      <section
        class="sbw-links-profile"
        aria-labelledby="sbwLinksTitle"
      >
        <a
          class="sbw-links-home"
          href="${escapeHtml(homeUrl)}"
          data-sbw-track="links_${escapeHtml(profileKey)}_home"
        >
          <span aria-hidden="true">←</span>
          <span>Voltar ao site da SaberWolf</span>
        </a>

        <div class="sbw-links-portrait-wrap">
          <span
            class="sbw-links-portrait-orbit"
            aria-hidden="true"
          ></span>

          <img
            class="sbw-links-portrait"
            src="${escapeHtml(imageUrl)}"
            alt="${escapeHtml(imageAlt)}"
            width="176"
            height="176"
          />

          <span
            class="sbw-links-status"
            aria-label="Perfil oficial"
          >
            ✓
          </span>
        </div>

        <div class="sbw-links-heading">
          <span class="sbw-links-eyebrow">
            ${escapeHtml(profile.eyebrow)}
          </span>

          <h1 id="sbwLinksTitle">
            ${escapeHtml(title)}
          </h1>

          <strong class="sbw-links-handle">
            ${escapeHtml(profile.handle)}
          </strong>

          <p>${escapeHtml(profile.description)}</p>
        </div>

        <nav
          class="sbw-links-list"
          aria-label="Links de ${escapeHtml(title)}"
        >
          ${linksHtml || "<p>Nenhum link disponível no momento.</p>"}
        </nav>

        ${renderRelated(profile.related)}

        <p class="sbw-links-signature">
          <span aria-hidden="true"></span>
          Conexões oficiais · -SBW-
          <span aria-hidden="true"></span>
        </p>
      </section>
    `;

    const portrait = root.querySelector(".sbw-links-portrait");

    portrait?.addEventListener(
      "error",
      () => {
        if (!fallbackImageUrl || portrait.src === fallbackImageUrl) {
          return;
        }

        portrait.src = fallbackImageUrl;
        portrait.alt = "Símbolo da SaberWolf Esports";
      },
      { once: true }
    );

    window.SBWRoutes?.rewriteLinks?.();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLinksPage, {
      once: true
    });
  } else {
    initLinksPage();
  }
})();