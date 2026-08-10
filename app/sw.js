// Viajemos · Service Worker
// Network-first para el app shell y el dataset (con fallback a caché si no
// hay red): así cada despliegue nuevo se ve de inmediato en vez de tardar
// una recarga extra en propagarse, y aun así sigue funcionando offline
// porque cada respuesta de red buena se guarda en caché para la próxima.

const VERSION = 'viajemos-v2';
const SHELL_CACHE = `${VERSION}-shell`;
const TILE_CACHE = `${VERSION}-tiles`;

const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/db.js',
  './js/data.js',
  './js/geo.js',
  './js/map.js',
  './js/app.js',
  './data/trip.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      Promise.all(
        SHELL_ASSETS.map((url) =>
          cache.add(url).catch((err) => console.warn('[sw] no se pudo cachear', url, err))
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('viajemos-') && k !== SHELL_CACHE && k !== TILE_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

function isTileRequest(url) {
  return /tile\.openstreetmap\.org/.test(url) || /\{s\}\.tile/.test(url);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = req.url;

  // Tiles de mapa: cache-first con cache dedicada (mejor esfuerzo offline).
  if (isTileRequest(url)) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        } catch (e) {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  // App shell y dataset: network-first. Si hay red, siempre se sirve la
  // versión más reciente (y se refresca la caché de paso); si no hay red,
  // cae a lo último cacheado — así la app sigue funcionando offline.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && req.method === 'GET') {
          caches.open(SHELL_CACHE).then((cache) => cache.put(req, res.clone()));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
