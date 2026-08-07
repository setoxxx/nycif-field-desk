const CANONICAL_MAP = 'https://nycinfocus.com/map/';
const LEGACY_CACHE_PREFIX = 'nycif-rc-public-map-';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(LEGACY_CACHE_PREFIX))
        .map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(Response.redirect(CANONICAL_MAP, 302));
  }
});
