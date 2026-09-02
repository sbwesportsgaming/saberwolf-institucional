/*
  -SBW- PWA Beta JS v0.5
  - Registro simples do service worker.
  - Botão de instalação conservador.
  - Não mexe em Supabase, Auth, Admin, torneios, rankings, equipes ou dados dinâmicos.
*/

(function () {
  'use strict';

  var deferredPrompt = null;

  var installSelectors = [
    '[data-sbw-pwa-install]',
    '[data-sbw-install-app]',
    '[data-pwa-install]',
    '#sbwPwaInstallButton',
    '#pwaInstallButton',
    '.js-pwa-install'
  ];

  function getInstallButtons() {
    return Array.prototype.slice.call(document.querySelectorAll(installSelectors.join(',')));
  }

  function getStatusElements() {
    return Array.prototype.slice.call(document.querySelectorAll('[data-sbw-pwa-status]'));
  }

  function isStandaloneMode() {
    return (
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true
    );
  }

  function setButtonState(state) {
    var buttons = getInstallButtons();

    buttons.forEach(function (button) {
      if (!button.dataset.originalHtml) {
        button.dataset.originalHtml = button.innerHTML.trim();
      }

      if (state === 'installed') {
        button.disabled = true;
        button.setAttribute('aria-disabled', 'true');
        button.textContent = 'App -SBW- instalado';
        return;
      }

      if (state === 'available') {
        button.disabled = false;
        button.removeAttribute('aria-disabled');
        button.innerHTML = button.dataset.originalHtml || 'Instalar App -SBW- Beta';
      }
    });
  }

  function setStatusText(text) {
    getStatusElements().forEach(function (element) {
      element.textContent = text;
    });
  }

  function scrollToGuide() {
    var guide = document.querySelector('#sbw-pwa-install-guide, #como-instalar-sbw, [data-sbw-pwa-guide]');
    if (guide) {
      guide.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function bindInstallButtons() {
    getInstallButtons().forEach(function (button) {
      if (button.dataset.sbwPwaBound === 'true') return;
      button.dataset.sbwPwaBound = 'true';

      button.addEventListener('click', function () {
        if (isStandaloneMode()) {
          setButtonState('installed');
          setStatusText('O App -SBW- Beta já está aberto em modo aplicativo.');
          return;
        }

        if (!deferredPrompt) {
          setStatusText('Se a instalação automática não aparecer, use o menu do navegador: no celular escolha Adicionar à tela inicial; no PC escolha Instalar aplicativo.');
          scrollToGuide();
          return;
        }

        deferredPrompt.prompt();

        Promise.resolve(deferredPrompt.userChoice)
          .catch(function () {})
          .finally(function () {
            deferredPrompt = null;
          });
      });
    });
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (window.location.protocol === 'file:') return;

    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/service-worker.js?v=20260902-16841', { scope: '/', updateViaCache: 'none' })
        .then(function (registration) {
          if (registration && typeof registration.update === 'function') {
            registration.update().catch(function () {});
          }
        })
        .catch(function (error) {
          console.warn('[SBW PWA] Service worker não registrado:', error);
        });
    });
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredPrompt = event;
    document.documentElement.classList.add('sbw-pwa-installable');
    setButtonState('available');
    setStatusText('Instalação disponível neste navegador.');
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    document.documentElement.classList.add('sbw-pwa-installed');
    setButtonState('installed');
    setStatusText('App -SBW- Beta instalado com sucesso.');
  });

  document.addEventListener('DOMContentLoaded', function () {
    bindInstallButtons();

    if (isStandaloneMode()) {
      document.documentElement.classList.add('sbw-pwa-standalone');
      setButtonState('installed');
      setStatusText('App -SBW- Beta aberto em modo aplicativo.');
    }
  });

  registerServiceWorker();
})();
