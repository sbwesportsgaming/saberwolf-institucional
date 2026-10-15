/* SBW — compartilhamento dos agregadores; links funcionam sem JavaScript. */
(function () {
  "use strict";

  function init() {
    const button = document.querySelector("[data-hub-share]");
    const status = document.querySelector("[data-hub-share-status]");
    const copyBox = document.querySelector("[data-hub-copy]");
    const input = document.querySelector("[data-hub-copy-input]");
    const canonical = document.querySelector('link[rel="canonical"]');
    if (!button || !status || !copyBox || !input || !canonical) return;

    const url = canonical.href;
    let sharing = false;
    button.hidden = false;

    function manualCopy() {
      copyBox.hidden = false;
      input.value = url;
      input.focus();
      input.select();
      input.setSelectionRange(0, input.value.length);
      status.textContent = "Copie o endereço selecionado para compartilhar.";
    }

    button.addEventListener("click", async function () {
      if (sharing) return;
      sharing = true;
      status.textContent = "";
      copyBox.hidden = true;

      try {
        if (typeof navigator.share === "function") {
          try {
            await navigator.share({ title: document.title, url: url });
            return;
          } catch (error) {
            if (error && error.name === "AbortError") return;
          }
        }

        if (window.isSecureContext && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
          try {
            await navigator.clipboard.writeText(url);
            status.textContent = "Link copiado. Agora é só compartilhar.";
            return;
          } catch (error) {
            // Sem permissão para a área de transferência, oferece cópia manual.
          }
        }

        manualCopy();
      } finally {
        sharing = false;
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
