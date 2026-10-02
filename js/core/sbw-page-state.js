(function () {
  "use strict";

  if (window.SBWPageState) return;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getTarget(target) {
    if (!target) return null;

    if (typeof target === "string") {
      try {
        return document.querySelector(target);
      } catch (error) {
        console.warn("[SBWPageState] Seletor inválido:", target, error);
        return null;
      }
    }

    return target.nodeType === 1 ? target : null;
  }

  function getActionHref(value) {
    let href = String(value ?? "").trim();
    if (!href) return "";

    try {
      const routes = window.SBWRoutes;

      const isNamedRoute = Object.prototype.hasOwnProperty.call(
        routes?.routes || {},
        href
      );

      const isRootPath = href.startsWith("/") && !href.startsWith("//");

      if (
        typeof routes?.url === "function" &&
        (isNamedRoute || isRootPath)
      ) {
        href = routes.url(href);
        if (!href) return "";
      }

      const url = new URL(
        href,
        document.baseURI || window.location.href
      );

      const allowedProtocols = [
        "http:",
        "https:",
        "mailto:",
        "tel:"
      ];

      if (allowedProtocols.includes(url.protocol)) {
        return url.href;
      }

      if (
        url.protocol === "file:" &&
        window.location.protocol === "file:"
      ) {
        return url.href;
      }
    } catch (error) {
      console.warn("[SBWPageState] Link inválido:", error);
    }

    return "";
  }

  function makeSkeletonRows(count = 4) {
    const requested = Number(count);

    const total = Number.isFinite(requested)
      ? Math.min(12, Math.max(1, Math.floor(requested)))
      : 4;

    return Array.from(
      { length: total },
      (_, index) => `
        <span
          class="sbw-skeleton-line ${index === 0 ? "is-wide" : ""}"
          aria-hidden="true"
        ></span>
      `
    ).join("");
  }

  function setBusy(target, isBusy) {
    const el = getTarget(target);
    if (!el) return;

    const busy = Boolean(isBusy);

    el.setAttribute("aria-busy", busy ? "true" : "false");
    el.classList.toggle("is-sbw-loading", busy);
  }

  function renderLoading(target, options = {}) {
    const el = getTarget(target);
    if (!el) return;

    const title = options?.title || "Carregando conteúdo";

    const message =
      options?.message ||
      "Aguarde enquanto a -SBW- prepara esta área.";

    setBusy(el, true);

    el.innerHTML = `
      <section
        class="sbw-page-state sbw-page-state--loading"
        role="status"
        aria-live="polite"
      >
        <div
          class="sbw-page-state__orb"
          aria-hidden="true"
        ></div>

        <div>
          <strong>${escapeHtml(title)}</strong>
          <p>${escapeHtml(message)}</p>

          <div class="sbw-skeleton-stack" aria-hidden="true">
            ${makeSkeletonRows(options?.rows ?? 4)}
          </div>
        </div>
      </section>
    `;
  }

  function renderEmpty(target, options = {}) {
    const el = getTarget(target);
    if (!el) return;

    const title = options?.title || "Nada encontrado";

    const message =
      options?.message ||
      "Ainda não há conteúdo disponível nesta área.";

    const action = options?.action;
    const href = getActionHref(action?.href);

    el.innerHTML = `
      <section
        class="sbw-page-state sbw-page-state--empty"
        role="status"
        aria-live="polite"
      >
        <div class="sbw-page-state__icon" aria-hidden="true">
          ◇
        </div>

        <div>
          <strong>${escapeHtml(title)}</strong>
          <p>${escapeHtml(message)}</p>

          ${
            href && action?.label
              ? `
                <a
                  class="sbw-page-state__action"
                  href="${escapeHtml(href)}"
                >
                  ${escapeHtml(action.label)}
                </a>
              `
              : ""
          }
        </div>
      </section>
    `;

    setBusy(el, false);
  }

  function renderError(target, options = {}) {
    const el = getTarget(target);
    if (!el) return;

    const title =
      options?.title || "Não foi possível carregar";

    const message =
      options?.message || "Atualize a página e tente novamente.";

    // Detalhes devem ser textos próprios para o visitante.
    const details = options?.details || "";

    el.innerHTML = `
      <section
        class="sbw-page-state sbw-page-state--error"
        role="alert"
      >
        <div class="sbw-page-state__icon" aria-hidden="true">
          !
        </div>

        <div>
          <strong>${escapeHtml(title)}</strong>
          <p>${escapeHtml(message)}</p>

          ${
            details
              ? `<small>${escapeHtml(details)}</small>`
              : ""
          }

          <button
            class="sbw-page-state__button"
            type="button"
            data-sbw-page-reload
          >
            Recarregar
          </button>
        </div>
      </section>
    `;

    setBusy(el, false);

    el.querySelector("[data-sbw-page-reload]")
      ?.addEventListener("click", () => {
        window.location.reload();
      });
  }

  function markReady() {
    if (!document.body) return;

    document.body.classList.remove("sbw-page-booting");
    document.body.classList.add("sbw-page-ready");
  }

  function markBooting() {
    if (!document.body) return;

    document.body.classList.add("sbw-page-booting");
    document.body.classList.remove("sbw-page-ready");
  }

  async function safeRun(target, callback, options = {}) {
    const el = getTarget(target);

    try {
      if (typeof callback !== "function") {
        throw new TypeError(
          "safeRun precisa receber uma função."
        );
      }

      if (el) {
        if (options?.loading !== false) {
          renderLoading(el, options?.loadingOptions);
        } else {
          setBusy(el, true);
        }
      }

      return await callback();
    } catch (error) {
      console.error(
        "[SBWPageState] Falha ao carregar área:",
        error
      );

      if (el) {
        renderError(el, {
          title:
            options?.errorTitle ||
            "Erro ao carregar área",

          message:
            options?.errorMessage ||
            "Não foi possível carregar o conteúdo. Tente novamente."
        });
      }

      return null;
    } finally {
      setBusy(el, false);
      markReady();
    }
  }

  window.SBWPageState = {
    escapeHtml,
    renderLoading,
    renderEmpty,
    renderError,
    setBusy,
    markReady,
    markBooting,
    safeRun
  };

  if (document.readyState === "loading") {
    markBooting();

    document.addEventListener("DOMContentLoaded", markReady, {
      once: true
    });
  } else {
    markReady();
  }
})();