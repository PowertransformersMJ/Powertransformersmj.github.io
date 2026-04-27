// ══════════════════════════════════════════════════════════════
// SGM · TRANSPOWER — Service Worker (F34, refactor 2026-04-27)
// ──────────────────────────────────────────────────────────────
// Estrategia network-first para HTML/CSS/JS para que un push a
// GitHub Pages se vea reflejado en la próxima recarga sin tener
// que bumpear CACHE_VERSION ni que el director toque DevTools.
//
//   · HTML/CSS/JS/JSON  → network-first, cache como fallback offline
//   · Imágenes / fuentes → stale-while-revalidate (cambian rara vez)
//   · Firebase / GoogleAPIs → network-first con fallback cache
//
// El SW antiguo (cache-first puro) provocaba que cualquier merge
// en main quedara invisible hasta que Safari decidiera actualizar
// el sw.js (podía tardar 24h). Esto se soluciona definitivamente
// pasando a network-first para el shell.
//
// Firebase Firestore offline persistence se habilita aparte en
// firebase-init.js con enableIndexedDbPersistence.
// ══════════════════════════════════════════════════════════════

const CACHE_VERSION = 'sgm-v4-0-0';

// Pre-cache mínimo — solo el shell estático fundamental para
// arranque offline. Se actualizará automáticamente con SWR / NF.
const SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/img/favicon.svg'
];

// Extensiones que tratamos como "shell dinámico" (network-first):
// cualquier cambio que el director suba debe verse en la próxima
// recarga.
const SHELL_DYNAMIC_EXT = /\.(?:html|css|js|json)$/i;

// Extensiones de imágenes / fuentes (stale-while-revalidate):
// rara vez cambian, vale la pena servir del cache mientras se
// refresca en background.
const ASSET_EXT = /\.(?:png|jpe?g|webp|svg|gif|ico|woff2?|ttf|otf)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((c) => c.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// Permite que la app fuerce un skipWaiting desde un mensaje
// (por si en el futuro queremos un botón "Actualizar").
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Estrategias ───────────────────────────────────────────────

function networkFirst(request) {
  return fetch(request).then((resp) => {
    if (resp && resp.status === 200 && resp.type !== 'opaque') {
      const copy = resp.clone();
      caches.open(CACHE_VERSION).then((c) => c.put(request, copy)).catch(() => {});
    }
    return resp;
  }).catch(() => caches.match(request).then((cached) => {
    if (cached) return cached;
    // Para navegación HTML, fallback a index.html offline
    if (request.mode === 'navigate') return caches.match('/index.html');
    return Response.error();
  }));
}

function staleWhileRevalidate(request) {
  return caches.match(request).then((cached) => {
    const fetchPromise = fetch(request).then((resp) => {
      if (resp && resp.status === 200 && resp.type !== 'opaque') {
        const copy = resp.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(request, copy)).catch(() => {});
      }
      return resp;
    }).catch(() => cached);
    return cached || fetchPromise;
  });
}

// ── Router ────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Firebase / Google APIs → network-first puro
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseio.com')
  ) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Mismo origen o fuentes Google → estrategia según tipo de archivo
  const isSameOrigin = url.origin === self.location.origin;
  const isGoogleFonts = url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com';
  if (!isSameOrigin && !isGoogleFonts) return;

  // HTML, CSS, JS, JSON → network-first (siempre fresco si hay red)
  if (request.mode === 'navigate' || SHELL_DYNAMIC_EXT.test(url.pathname)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Imágenes / fuentes → stale-while-revalidate
  if (ASSET_EXT.test(url.pathname) || isGoogleFonts) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Resto: network-first conservador
  event.respondWith(networkFirst(request));
});
