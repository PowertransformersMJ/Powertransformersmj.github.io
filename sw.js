// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Service Worker (kill-switch · 2026-04-27)
// ──────────────────────────────────────────────────────────────
// ESTE SW SE AUTO-DESREGISTRA EN SU PRIMERA ACTIVACIÓN.
//
// Motivo: el SW antiguo (cache-first, F34) provocaba que cualquier
// deploy a GitHub Pages quedara invisible para los navegadores que
// ya tenían el sitio cargado, y los workarounds (bumpear CACHE_VERSION,
// pasar a network-first) seguían dependiendo de que el navegador
// chequeara sw.js voluntariamente. El director (Miguel) reportó
// repetidamente "todo sigue igual" después de cada deploy.
//
// Solución de raíz: matar el SW. Cuando este sw.js sea descargado
// por un navegador, install + activate borran TODOS los caches y
// llaman registration.unregister(). Tras la próxima recarga el
// sitio funciona como un sitio web tradicional (sin cache de SW),
// y los pushes a main son visibles de inmediato.
//
// La PWA / offline-first se reintroducirá más adelante con una
// estrategia network-first bien probada — por ahora prioridad al
// "deploy y se ve" sin fricción.
// ══════════════════════════════════════════════════════════════

self.addEventListener('install', (event) => {
  // Activarse inmediatamente sin esperar a que se cierren las pestañas.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 1. Borrar TODOS los caches (no solo los del SW antiguo,
    //    para asegurar que ningún asset viejo siga sirviéndose).
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (_) {
      // ignorar — el unregister se hace de todos modos
    }

    // 2. Desregistrar este SW.
    try {
      await self.registration.unregister();
    } catch (_) {}

    // 3. Recargar todas las pestañas controladas para que carguen
    //    los assets ya sin SW intermediando — fresh from server.
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const c of clients) {
        try { c.navigate(c.url); } catch (_) {}
      }
    } catch (_) {}
  })());
});

// Sin fetch handler: el navegador maneja las requests directamente.
// (Aunque sw.js técnicamente sigue activo hasta que termine activate,
//  es de un solo turno: en cuanto activate completa, el SW deja de
//  controlar al cliente.)
