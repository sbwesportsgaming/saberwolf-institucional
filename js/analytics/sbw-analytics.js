(function () {
  'use strict';

  const VERSION = 'v1.6.84.1';
  const MAX_META_KEYS = 12;
  const MAX_META_VALUE = 160;
  const DEFAULT_CATEGORY = 'site';
  const SKIP_PATHS = [
    '/auth/',
    '/offline.html',
    '/404.html'
  ];

  function getPath() {
    try {
      return window.location.pathname || '/';
    } catch (_) {
      return '/';
    }
  }

  function shouldSkip() {
    try {
      if (window.SBW_DISABLE_ANALYTICS === true) return true;
      if (window.localStorage && window.localStorage.getItem('sbw_analytics_opt_out') === '1') return true;
      const path = getPath().toLowerCase();
      return SKIP_PATHS.some((item) => path.includes(item));
    } catch (_) {
      return false;
    }
  }

  function getClient() {
    return window.SBWSupabase && window.SBWSupabase.client ? window.SBWSupabase.client : null;
  }

  function safeText(value, maxLength) {
    return String(value || '')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength || 120);
  }

  function normalizePath(value) {
    try {
      if (!value) return '';
      const url = new URL(value, window.location.origin);
      if (url.origin !== window.location.origin) return 'external';
      return safeText(url.pathname || '/', 160);
    } catch (_) {
      return '';
    }
  }

  function getPageCategory() {
    const path = getPath().toLowerCase();
    if (path.includes('/torneios/')) return 'torneios';
    if (path.includes('/equipes/')) return 'equipes';
    if (path.includes('/organizadores/')) return 'organizadores';
    if (path.includes('/perfis/')) return 'perfis';
    if (path.includes('/rankings/')) return 'rankings';
    if (path.includes('/blog/') || path.includes('/noticia')) return 'noticias';
    if (path.includes('/creators/')) return 'creators';
    if (path.includes('/comunidades/')) return 'comunidades';
    if (path === '/links' || path.includes('/links/')) return 'links';
    if (path.includes('/admin/')) return 'admin';
    if (path.includes('/pages/loja')) return 'loja';
    if (path === '/' || path.endsWith('/index.html')) return 'home';
    return DEFAULT_CATEGORY;
  }

  function getDeviceType() {
    const width = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    if (width <= 767) return 'mobile';
    if (width <= 1024) return 'tablet';
    return 'desktop';
  }

  function getBrowserFamily() {
    const ua = navigator.userAgent || '';
    if (/Edg\//.test(ua)) return 'edge';
    if (/OPR\//.test(ua) || /Opera/.test(ua)) return 'opera';
    if (/Firefox\//.test(ua)) return 'firefox';
    if (/Safari\//.test(ua) && !/Chrome\//.test(ua) && !/Chromium\//.test(ua)) return 'safari';
    if (/Chrome\//.test(ua) || /Chromium\//.test(ua)) return 'chrome';
    return 'other';
  }

  function getOsFamily() {
    const ua = navigator.userAgent || '';
    if (/Android/i.test(ua)) return 'android';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
    if (/Windows/i.test(ua)) return 'windows';
    if (/Mac OS/i.test(ua)) return 'macos';
    if (/Linux/i.test(ua)) return 'linux';
    return 'other';
  }
  function getBrowserLanguage() {
    try {
      return safeText(navigator.language || (navigator.languages && navigator.languages[0]) || '', 32);
    } catch (_) {
      return '';
    }
  }

  function getBrowserLanguages() {
    try {
      return Array.isArray(navigator.languages) ? navigator.languages.slice(0, 3).map((item) => safeText(item, 32)).join(',') : getBrowserLanguage();
    } catch (_) {
      return '';
    }
  }

  function getTimezone() {
    try {
      return safeText(Intl.DateTimeFormat().resolvedOptions().timeZone || '', 64);
    } catch (_) {
      return '';
    }
  }


  function isPwa() {
    try {
      return Boolean(
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.navigator.standalone === true
      );
    } catch (_) {
      return false;
    }
  }

  function sanitizeMetadata(metadata) {
    const output = {};
    const source = metadata && typeof metadata === 'object' ? metadata : {};
    Object.keys(source).slice(0, MAX_META_KEYS).forEach((key) => {
      const cleanKey = safeText(key, 40).replace(/[^a-zA-Z0-9_:-]/g, '_');
      if (!cleanKey) return;
      const value = source[key];
      if (value === null || value === undefined) return;
      if (typeof value === 'boolean' || typeof value === 'number') {
        output[cleanKey] = value;
        return;
      }
      output[cleanKey] = safeText(value, MAX_META_VALUE);
    });
    return output;
  }

  function baseEvent(eventType, eventName, metadata) {
    return {
      event_type: safeText(eventType || 'page_view', 40),
      event_name: safeText(eventName || eventType || 'page_view', 80),
      page_path: safeText(getPath(), 180),
      page_title: safeText(document.title || '', 140),
      page_category: getPageCategory(),
      referrer_path: normalizePath(document.referrer),
      device_type: getDeviceType(),
      browser_family: getBrowserFamily(),
      os_family: getOsFamily(),
      is_pwa: isPwa(),
      viewport_width: Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0) || null,
      viewport_height: Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0) || null,
      metadata: sanitizeMetadata(Object.assign({
        analytics_version: VERSION,
        browser_language: getBrowserLanguage(),
        browser_languages: getBrowserLanguages(),
        timezone: getTimezone()
      }, metadata || {}))
    };
  }

  function getSupabaseConfig() {
    return window.SBWSupabase && window.SBWSupabase.config ? window.SBWSupabase.config : {};
  }

  function getAnalyticsFunctionUrl() {
    const config = getSupabaseConfig();
    const explicit = safeText(config.analyticsFunctionUrl || config.analytics_function_url || '', 240);

    if (explicit) return explicit.replace(/\/+$/, '');

    const baseUrl = safeText(config.url || '', 220).replace(/\/+$/, '');
    if (!baseUrl) return '';

    return `${baseUrl}/functions/v1/sbw-track-site-event`;
  }

  function getPublishableKey() {
    const config = getSupabaseConfig();
    return safeText(config.publishableKey || config.anonKey || config.anon_key || '', 260);
  }

  async function sendViaEdgeFunction(payload) {
    if (window.SBW_ANALYTICS_EDGE_DISABLED === true) return false;

    const functionUrl = getAnalyticsFunctionUrl();
    const key = getPublishableKey();

    if (!functionUrl || !key || typeof window.fetch !== 'function') return false;

    const response = await window.fetch(functionUrl, {
      method: 'POST',
      mode: 'cors',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({ event: payload })
    });

    if (!response.ok) {
      throw new Error(`Edge Function HTTP ${response.status}`);
    }

    return true;
  }

  async function sendViaRpcFallback(payload) {
    const client = getClient();
    if (!client || typeof client.rpc !== 'function') return false;

    await client.rpc('sbw_track_site_event', {
      p_event: payload
    });

    return true;
  }

  async function send(eventType, eventName, metadata) {
    if (shouldSkip()) return;

    const payload = baseEvent(eventType, eventName, metadata);

    try {
      const sentByEdge = await sendViaEdgeFunction(payload);
      if (sentByEdge) return;

      await sendViaRpcFallback(payload);
    } catch (error) {
      try {
        await sendViaRpcFallback(payload);
      } catch (fallbackError) {
        if (window.SBW_ANALYTICS_DEBUG) {
          console.warn('[SBW Analytics] Falha ignorada:', fallbackError && fallbackError.message ? fallbackError.message : fallbackError);
        }
      }

      if (window.SBW_ANALYTICS_DEBUG) {
        console.warn('[SBW Analytics] Edge Function indisponível, fallback usado:', error && error.message ? error.message : error);
      }
    }
  }

  function trackPageView() {
    send('page_view', 'page_view', {
      visibility_state: document.visibilityState || 'visible'
    });
  }

  function getClickTarget(event) {
    if (!event || !event.target || typeof event.target.closest !== 'function') return null;
    return event.target.closest('[data-sbw-track], [data-analytics-event], .sbw-sidebar a, a.sbw-btn, button.sbw-btn, button[data-action], a[data-action]');
  }

  function getClickName(target) {
    if (!target) return 'click';
    const explicit = target.getAttribute('data-sbw-track') || target.getAttribute('data-analytics-event');
    if (explicit) return safeText(explicit, 80);
    if (target.closest && target.closest('.sbw-sidebar')) return 'sidebar_navigation';
    if (target.tagName === 'A') return 'link_click';
    if (target.tagName === 'BUTTON') return 'button_click';
    return 'click';
  }

  function attachClicks() {
    document.addEventListener('click', function (event) {
      const target = getClickTarget(event);
      if (!target) return;
      const href = target.getAttribute('href') || '';
      send('click', getClickName(target), {
        target_path: href ? normalizePath(href) : '',
        target_role: safeText(target.getAttribute('data-action') || target.getAttribute('role') || target.tagName || '', 40),
        page_category: getPageCategory()
      });
    }, true);
  }

  function init() {
    if (shouldSkip()) return;
    window.SBWAnalytics = {
      track: send,
      version: VERSION
    };
    window.setTimeout(trackPageView, 700);
    attachClicks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
