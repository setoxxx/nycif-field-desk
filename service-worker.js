const CANONICAL_MAP = 'https://nycinfocus.com/map/';
const RETIRED_CACHE_PREFIX = 'nycif-rc-public-map-';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(RETIRED_CACHE_PREFIX))
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(Response.redirect(CANONICAL_MAP, 302));
});
