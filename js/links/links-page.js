(function () {
  "use strict";

  const root = document.getElementById("sbwLinksRoot");
  if (!root) return;

  const profileKey = document.body.dataset.sbwLinksProfile || "ecosystem";
  const profiles = window.SBWLinksProfiles || {};
  const profile = profiles[profileKey];

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function safeHref(value) {
    const href = String(value || "").trim();
    if (href.startsWith("/") || /^https:\/\//i.test(href)) return href;
    return "/";
  }

  function renderLink(link) {
    const href = safeHref(link.href);
    const externalAttributes = link.external
      ? ' target="_blank" rel="noopener noreferrer"'
      : "";
    const primaryClass = link.primary ? " sbw-link-card--primary" : "";

    return `
      <a
        class="sbw-link-card${primaryClass}"
        href="${escapeHtml(href)}"
        data-sbw-track="links_${escapeHtml(profileKey)}_${escapeHtml(link.id)}"
        aria-label="${escapeHtml(link.label)}${link.external ? " (abre em nova aba)" : ""}"
        ${externalAttributes}
      >
        <span class="sbw-link-card__mark" aria-hidden="true">${escapeHtml(link.mark)}</span>
        <span class="sbw-link-card__copy">
          <strong>${escapeHtml(link.label)}</strong>
          <small>${escapeHtml(link.description)}</small>
        </span>
        <span class="sbw-link-card__arrow" aria-hidden="true">${link.external ? "↗" : "→"}</span>
      </a>
    `;
  }

  function renderRelated(related) {
    if (!related) return "";

    return `
      <a
        class="sbw-links-related"
        href="${escapeHtml(safeHref(related.href))}"
        data-sbw-track="${escapeHtml(related.track)}"
      >
        <span class="sbw-links-related__icon" aria-hidden="true">-SBW-</span>
        <span class="sbw-links-related__copy">
          <small>${escapeHtml(related.eyebrow)}</small>
          <strong>${escapeHtml(related.title)}</strong>
          <span>${escapeHtml(related.description)}</span>
        </span>
        <span class="sbw-links-related__arrow" aria-hidden="true">→</span>
      </a>
    `;
  }

  function render() {
    if (!profile) {
      root.innerHTML = `
        <section class="sbw-links-noscript">
          <h1>Perfil não encontrado</h1>
          <a href="/links/">Voltar aos links da -SBW-</a>
        </section>
      `;
      return;
    }

    document.body.dataset.sbwLinksTheme = profile.theme || "ecosystem";

    root.innerHTML = `
      <div class="sbw-links-energy" aria-hidden="true"></div>

      <section class="sbw-links-profile" aria-labelledby="sbwLinksTitle">
        <a class="sbw-links-home" href="/" data-sbw-track="links_${escapeHtml(profileKey)}_home">
          <span aria-hidden="true">←</span>
          <span>sbwgg.com.br</span>
        </a>

        <div class="sbw-links-portrait-wrap">
          <span class="sbw-links-portrait-orbit" aria-hidden="true"></span>
          <img
            class="sbw-links-portrait"
            src="${escapeHtml(profile.image)}"
            alt="${escapeHtml(profile.imageAlt)}"
            width="176"
            height="176"
          />
          <span class="sbw-links-status" aria-label="Perfil oficial">✓</span>
        </div>

        <div class="sbw-links-heading">
          <span class="sbw-links-eyebrow">${escapeHtml(profile.eyebrow)}</span>
          <h1 id="sbwLinksTitle">${escapeHtml(profile.title)}</h1>
          <strong class="sbw-links-handle">${escapeHtml(profile.handle)}</strong>
          <p>${escapeHtml(profile.description)}</p>
        </div>

        <nav class="sbw-links-list" aria-label="Links de ${escapeHtml(profile.title)}">
          ${profile.links.map(renderLink).join("")}
        </nav>

        ${renderRelated(profile.related)}

        <p class="sbw-links-signature">
          <span aria-hidden="true"></span>
          Conexões oficiais · -SBW-
          <span aria-hidden="true"></span>
        </p>
      </section>
    `;
  }

  render();
})();
