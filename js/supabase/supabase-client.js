(function () {
  const config = window.SBWSupabaseConfig || {};

  function isConfigured() {
    return Boolean(
      config.enabled &&
      config.url &&
      config.publishableKey &&
      window.supabase &&
      typeof window.supabase.createClient === "function"
    );
  }

  function createClient() {
    if (!isConfigured()) {
      console.warn("[SaberWolf Supabase] Supabase não configurado. Usando modo local-demo.");

      return null;
    }

    return window.supabase.createClient(config.url, config.publishableKey);
  }

  const client = createClient();

  window.SBWSupabase = {
    config: config,
    client: client,
    isConfigured: isConfigured,
    isEnabled: function () {
      return Boolean(client);
    }
  };


  function loadAnalytics() {
    try {
      if (window.SBW_DISABLE_ANALYTICS === true) return;
      if (document.querySelector('script[data-sbw-analytics="true"]')) return;

      const currentScript = document.currentScript || Array.from(document.scripts).find(function (script) {
        return /js\/supabase\/supabase-client\.js(\?.*)?$/.test(script.getAttribute('src') || '');
      });

      const currentSrc = currentScript ? currentScript.getAttribute('src') || '' : '';
      const basePath = currentSrc.replace(/js\/supabase\/supabase-client\.js(\?.*)?$/, '');
      const script = document.createElement('script');
      script.defer = true;
      script.setAttribute('data-sbw-analytics', 'true');
      script.src = basePath + 'js/analytics/sbw-analytics.js?v=1.6.84.1';
      document.head.appendChild(script);
    } catch (error) {
      if (window.SBW_ANALYTICS_DEBUG) {
        console.warn('[SBW Analytics] loader ignorado:', error);
      }
    }
  }

  if (client) {
    loadAnalytics();
  }
})();
