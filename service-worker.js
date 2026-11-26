"use strict";

// Permanece na URL antiga para desativar instalações existentes do site.
const cachePrefix = "saberwolf-esports:" + encodeURIComponent(self.registration.scope) + ":";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name.startsWith(cachePrefix))
          .map((name) => caches.delete(name))
      );
    } finally {
      await self.registration.unregister();
    }
  })());
});
