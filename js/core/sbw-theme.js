/* SBW — preferência de aparência. Executar no head, antes dos estilos. */
(function () {
  "use strict";
  if (window.SBWTheme) return;

  var root = document.documentElement;
  var script = document.currentScript;
  var site = script && script.getAttribute("data-sbw-theme-site") || "project";
  var storageKey = "sbw-theme-v1";
  var allowed = ["light", "dark", "black", "system"];
  var preference = "system";
  var media = typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  var control = null;
  var fallback = null;
  var sidebarObserver = null;
  var scheduled = false;
  var colors = {
    project: { light: "#f3f4f6", dark: "#11151b", black: "#000000" },
    esports: { light: "#ffffff", dark: "#050d14", black: "#000000" },
    championship: { light: "#dde2e8", dark: "#081321", black: "#000000" }
  };
  if (!Object.prototype.hasOwnProperty.call(colors, site)) site = "project";
  root.setAttribute("data-sbw-theme-site", site);

  function normalize(value) {
    return allowed.indexOf(value) !== -1 ? value : "system";
  }

  try { preference = normalize(window.localStorage.getItem(storageKey)); }
  catch (error) { /* A aparência também funciona com armazenamento bloqueado. */ }

  function resolved() {
    if (preference === "black") return "dark";
    return preference === "system" ? (media && media.matches ? "dark" : "light") : preference;
  }

  function resolvedPalette() {
    return preference === "black" ? "black" : resolved();
  }

  function apply() {
    var theme = resolved();
    var palette = resolvedPalette();
    var previous = root.getAttribute("data-sbw-theme");
    var previousPalette = root.getAttribute("data-sbw-theme-palette");
    root.setAttribute("data-sbw-theme", theme);
    root.setAttribute("data-sbw-theme-palette", palette);
    root.setAttribute("data-sbw-theme-preference", preference);
    root.style.colorScheme = theme;
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (meta) {
      if (!meta.hasAttribute("media")) meta.content = colors[site][palette];
    });
    document.querySelectorAll("[data-sbw-theme-select]").forEach(function (select) {
      select.value = preference;
    });
    if (previous !== theme || previousPalette !== palette || control) {
      window.dispatchEvent(new CustomEvent("sbw:theme-change", {
        detail: { preference: preference, theme: theme, palette: palette }
      }));
    }
    return theme;
  }

  function setPreference(value) {
    if (allowed.indexOf(value) === -1) return false;
    preference = value;
    try { window.localStorage.setItem(storageKey, value); }
    catch (error) { /* Mantém a escolha durante esta visita. */ }
    apply();
    return true;
  }

  function makeControl() {
    if (control) return control;
    var english = /^en(?:-|$)/i.test(root.lang || "");
    var label = document.createElement("label");
    label.className = "sbw-theme-control";
    label.setAttribute("data-sbw-theme-control", "");
    var icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-width", "1.7");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("focusable", "false");
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M20.5 13.2A8.8 8.8 0 0 1 10.8 3.5a8.8 8.8 0 1 0 9.7 9.7Z");
    icon.appendChild(path);
    var caption = document.createElement("span");
    caption.className = "sbw-theme-control__caption";
    caption.textContent = english ? "Theme" : "Tema";
    var select = document.createElement("select");
    select.setAttribute("data-sbw-theme-select", "");
    select.setAttribute("aria-label", english ? "Website theme" : "Tema do site");
    var names = english ? ["Light", "Dark", "Black", "Automatic"] : ["Claro", "Escuro", "Preto", "Automático"];
    allowed.forEach(function (value, index) {
      var option = document.createElement("option");
      option.value = value;
      option.textContent = names[index];
      select.appendChild(option);
    });
    select.value = preference;
    select.addEventListener("change", function () { setPreference(select.value); });
    label.appendChild(icon);
    label.appendChild(caption);
    label.appendChild(select);
    control = label;
    return label;
  }

  function mountControl() {
    if (!document.body) return;
    var sidebar = document.querySelector("#sbwChampionshipSidebar, #sbwSidebar");
    var destination = document.querySelector("[data-sbw-theme-mount]");
    if (!destination && sidebar) {
      destination = document.createElement("div");
      destination.className = "sbw-theme-mount sbw-theme-mount--sidebar";
      destination.setAttribute("data-sbw-theme-mount", "");
      var institutional = sidebar.querySelector(".sbw-sidebar__nav--institutional");
      sidebar.insertBefore(destination, institutional || null);
    }
    if (!destination) {
      var nav = document.querySelector(".site-nav, #sbwSiteNavigation, .sbw-error-nav");
      var toolbar = document.querySelector(".hub-topbar, .dlucca-header-inner, .app-header__inner, .sbw-app-header");
      var host = nav || toolbar;
      if (host) {
        destination = document.createElement("div");
        destination.className = "sbw-theme-mount";
        destination.setAttribute("data-sbw-theme-mount", "");
        if (host.id === "sbwSiteNavigation") destination.classList.add("sbw-theme-mount--dark-header");
        if (host.classList.contains("hub-topbar")) {
          host.insertBefore(destination, host.querySelector(".hub-share"));
        } else host.appendChild(destination);
      }
    }
    if (!destination) {
      if (!fallback || !fallback.isConnected) {
        fallback = document.createElement("div");
        fallback.className = "sbw-theme-mount sbw-theme-mount--floating";
        fallback.setAttribute("data-sbw-theme-fallback", "");
        document.body.appendChild(fallback);
      }
      destination = fallback;
    }
    var node = makeControl();
    if (node.parentElement !== destination) destination.appendChild(node);
    if (fallback && fallback !== destination) { fallback.remove(); fallback = null; }
    apply();
  }

  function scheduleMount() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(function () { scheduled = false; mountControl(); });
  }

  function init() {
    mountControl();
    var sidebarMount = document.getElementById("sbwSidebarMount");
    if (sidebarMount && typeof MutationObserver === "function") {
      sidebarObserver = new MutationObserver(function () {
        if (!control || !control.isConnected || (fallback && sidebarMount.querySelector("aside"))) scheduleMount();
      });
      sidebarObserver.observe(sidebarMount, { childList: true, subtree: true });
    }
  }

  if (media) {
    var onSystemChange = function () { if (preference === "system") apply(); };
    if (typeof media.addEventListener === "function") media.addEventListener("change", onSystemChange);
    else if (typeof media.addListener === "function") media.addListener(onSystemChange);
  }
  window.addEventListener("storage", function (event) {
    if (event.key === storageKey || event.key === null) {
      preference = normalize(event.key === null ? null : event.newValue);
      apply();
    }
  });
  window.addEventListener("pageshow", apply);
  window.SBWTheme = {
    getPreference: function () { return preference; },
    getResolvedTheme: resolved,
    getResolvedPalette: resolvedPalette,
    setPreference: setPreference,
    refresh: mountControl
  };
  apply();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
