(function () {
  "use strict";

  function initStoreFilters(page) {
    const filterButtons = Array.from(
      page.querySelectorAll("[data-sbw-store-filter]")
    );

    const grid = page.querySelector("[data-sbw-store-grid]");

    if (!filterButtons.length || !grid) return;

    const cards = Array.from(
      grid.querySelectorAll("[data-store-category]")
    );

    function applyFilter(selectedButton) {
      const selected = selectedButton.dataset.sbwStoreFilter || "all";

      filterButtons.forEach((button) => {
        const isActive = button === selectedButton;

        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));

        if (grid.id) {
          button.setAttribute("aria-controls", grid.id);
        }
      });

      cards.forEach((card) => {
        const category = card.dataset.storeCategory || "";
        const shouldShow = selected === "all" || category === selected;

        card.hidden = !shouldShow;
        card.classList.toggle("is-hidden", !shouldShow);
      });
    }

    filterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        applyFilter(button);
      });
    });

    const initialButton =
      filterButtons.find((button) =>
        button.classList.contains("is-active")
      ) ||
      filterButtons.find((button) =>
        button.dataset.sbwStoreFilter === "all"
      ) ||
      filterButtons[0];

    applyFilter(initialButton);
  }

  function initStorePage() {
    const page =
      document.getElementById("sbwStorePage") ||
      document.querySelector(".sbw-store-page");

    if (!page || page.dataset.sbwStoreInitialized === "true") {
      return;
    }

    page.dataset.sbwStoreInitialized = "true";

    initStoreFilters(page);

    requestAnimationFrame(() => {
      document.body.classList.remove("sbw-sidebar-no-transition");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initStorePage, {
      once: true
    });
  } else {
    initStorePage();
  }
})();