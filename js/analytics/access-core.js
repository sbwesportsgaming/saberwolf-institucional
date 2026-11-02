/* SBW — classificação de acessos. Sem cookies ou identificadores permanentes. */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SBWAccessCore = api;
})(typeof window === "undefined" ? globalThis : window, function () {
  "use strict";
  const SESSION_MS = 30 * 60 * 1000;
  const BRANDS = new Set(["sbwgg.com.br", "www.sbwgg.com.br", "sbwchampionship.com", "www.sbwchampionship.com", "sbwproject.com", "www.sbwproject.com"]);
  const STREAMERS = { tigerfurious: "TigerFurious", elitz: "EliTz", dlucca: "D’Lucca" };
  const aliases = { "tiger-furious": "tigerfurious", "tiger_furious": "tigerfurious", "eli-tz": "elitz", "d-lucca": "dlucca", "d_lucca": "dlucca" };
  function slug(value, limit = 80) {
    const text = String(value || "").trim().toLowerCase();
    return /^[a-z0-9][a-z0-9_.-]*$/.test(text) ? text.slice(0, limit) : "";
  }
  function path(value) {
    let p = String(value || "/").split(/[?#]/)[0];
    if (!p.startsWith("/") || p.startsWith("//") || /[\\\s@]|%40|\.\./i.test(p)) return "";
    p = p.replace(/\/+/g, "/").replace(/\/index\.html$/i, "/").replace(/\.html$/i, "");
    return (p === "/" ? p : p.replace(/\/$/, "")).slice(0, 180);
  }
  function host(value) {
    const name = String(value || "").toLowerCase().replace(/^www\./, "");
    return /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/.test(name) && name.length <= 180 ? name : "";
  }
  function network(value) {
    const h = host(value);
    const domains = {
      google: /(^|\.)google\.[a-z.]+$/, bing: /(^|\.)bing\.com$/, duckduckgo: /(^|\.)duckduckgo\.com$/,
      instagram: /(^|\.)instagram\.com$/, facebook: /(^|\.)(facebook\.com|fb\.com|fb\.watch)$/,
      youtube: /(^|\.)(youtube\.com|youtu\.be)$/, tiktok: /(^|\.)tiktok\.com$/,
      x: /(^|\.)(x\.com|twitter\.com|t\.co)$/, threads: /(^|\.)threads\.(com|net)$/,
      twitch: /(^|\.)twitch\.tv$/, discord: /(^|\.)(discord\.com|discord\.gg)$/
    };
    return Object.keys(domains).find(key => domains[key].test(h)) || "";
  }
  function attribution(href, referrer = "") {
    const url = new URL(href);
    const q = url.searchParams;
    const rawSource = slug(q.get("utm_source"));
    const medium = slug(q.get("utm_medium"));
    const campaign = slug(q.get("utm_campaign"));
    const referral = slug(q.get("sbw_streamer") || q.get("streamer") || q.get("ref"));
    const source = aliases[rawSource] || rawSource;
    const explicitStreamer = aliases[referral] || referral;
    let refHost = "";
    try { refHost = host(new URL(referrer).hostname); } catch (_) {}
    const base = { kind: "direct", name: "direct", streamer: "", medium, campaign, referrer_host: refHost };
    if (explicitStreamer && (q.has("streamer") || q.has("sbw_streamer") || STREAMERS[explicitStreamer])) {
      return { ...base, kind: "streamer", name: explicitStreamer, streamer: explicitStreamer, medium: medium || "streamer" };
    }
    if (source && (STREAMERS[source] || ["streamer", "colaborador", "creator", "influencer"].includes(medium))) {
      return { ...base, kind: "streamer", name: source, streamer: source };
    }
    if (source || referral) {
      const name = source || referral;
      const known = network(name + ".com") || (["google", "bing", "duckduckgo"].includes(name) ? name : "");
      return { ...base, name, kind: known ? (["google", "bing", "duckduckgo"].includes(known) ? "search" : "social") : "campaign" };
    }
    if (refHost) {
      const own = host(url.hostname);
      if (refHost === own) return { ...base, kind: "internal", name: "internal" };
      const known = network(refHost);
      return { ...base, name: known || refHost, kind: known ? (["google", "bing", "duckduckgo"].includes(known) ? "search" : "social") : "referral" };
    }
    return base;
  }
  function signature(value) { return [value.kind, value.name, value.streamer, value.medium, value.campaign].join("|"); }
  function session(saved, incoming, now, uuid) {
    const valid = saved && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved.id) && saved.attribution &&
      Number.isFinite(saved.lastSeen) && now >= saved.lastSeen && now - saved.lastSeen < SESSION_MS;
    const explicit = incoming.streamer || incoming.campaign || incoming.medium || incoming.kind === "campaign";
    if (valid && (!explicit || signature(saved.attribution) === signature(incoming))) {
      return { ...saved, lastSeen: now };
    }
    return { id: uuid(), lastSeen: now, attribution: incoming };
  }
  function client(userAgent, standalone = false) {
    const ua = String(userAgent || "");
    const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Chrome|CriOS/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "Outro";
    const device = /iPad|Tablet|Android(?!.*Mobile)/i.test(ua) ? "tablet" : /Mobile|iPhone|Android/i.test(ua) ? "mobile" : "desktop";
    const mode = standalone ? "pwa" : /SBWChampionship|SBWAndroidApp/i.test(ua) ? "app" : /; wv\)|Instagram|FBAN|FBAV/i.test(ua) ? "embedded" : "browser";
    return { browser, device, mode };
  }
  function crossSite(href, origin, source) {
    try {
      const u = new URL(href, origin);
      if (u.protocol !== "https:" || u.origin === new URL(origin).origin || !BRANDS.has(u.hostname) || !source || source.kind === "direct" || source.kind === "internal") return u.href;
      if (!u.searchParams.has("utm_source")) {
        u.searchParams.set("utm_source", source.streamer || source.name);
        u.searchParams.set("utm_medium", source.medium || (source.kind === "streamer" ? "streamer" : "sbw_referral"));
        if (source.campaign) u.searchParams.set("utm_campaign", source.campaign);
      }
      return u.href;
    } catch (_) { return href; }
  }
  function label(source) {
    if (source.streamer) return STREAMERS[source.streamer] || source.streamer;
    return { direct: "Direto / origem não informada", internal: "Origem anterior não identificada" }[source.name] || source.name;
  }
  return { SESSION_MS, STREAMERS, slug, path, host, network, attribution, session, client, crossSite, label };
});
