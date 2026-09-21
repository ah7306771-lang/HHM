// HHM Service Worker — network-first for HTML, cache-first for assets
const CACHE_VERSION = 'hhm-v2';
const HTML_CACHE = CACHE_VERSION + '-html';
const ASSETS_CACHE = CACHE_VERSION + '-assets';
const CORE_ASSETS = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(ASSETS_CACHE).then(cache => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== HTML_CACHE && k !== ASSETS_CACHE).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isHtml = req.mode === 'navigate' ||
                 req.destination === 'document' ||
                 (req.headers.get('accept') || '').includes('text/html');

  // NETWORK-FIRST for HTML — this way any deploy is picked up immediately.
  if (isHtml) {
    event.respondWith(
      fetch(req).then(res => {
        if (res && res.status === 200 && url.origin === self.location.origin) {
          const clone = res.clone();
          caches.open(HTML_CACHE).then(cache => cache.put(req, clone)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(req).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // CACHE-FIRST for images / manifest / icons
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.status === 200 && url.origin === self.location.origin) {
          const clone = res.clone();
          caches.open(ASSETS_CACHE).then(cache => cache.put(req, clone)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
    })
  );
});
