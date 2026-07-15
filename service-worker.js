const CACHE_NAME = 'nycif-v023-operator-desk-v01';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './fielddesk-v02.css',
  './weekstrip-v06-safe.css',
  './public-map-v01.css',
  './public-approved-overlays-capture-v01.js',
  './public-map-defaults-v01.js',
  './discovery-patch-v02.js',
  './event-feed-schema-v1.js',
  './app-schema-v1-major-all-v01.js',
  './public-approved-overlays-v01.js',
  './field-desk-operator-layer-v01.js',
  './service-worker.js'
];

const NETWORK_FIRST_RE = /\/(?:index\.html|discovery-patch-v02\.js|public-map-defaults-v01\.js|service-worker\.js|public-approved-overlays-v01\.js|public-approved-overlays-capture-v01\.js|app-schema-v1-major-all-v01\.js|event-feed-schema-v1\.js|field-desk-operator-layer-v01\.js)$/;

function isNetworkFirst(url) {
  return (url.origin === location.origin && NETWORK_FIRST_RE.test(url.pathname))
    || url.hostname === 'raw.githubusercontent.com';
}

async function putSuccessful(cache, request, response) {
  if (response && response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      for (const path of APP_SHELL) {
        try {
          const response = await fetch(path, { cache: 'reload' });
          await putSuccessful(cache, path, response);
        } catch {
          // A single optional asset must not prevent the worker installing.
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(key => key.startsWith('nycif-') && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== location.origin && url.hostname !== 'raw.githubusercontent.com') return;

  if (isNetworkFirst(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(event.request, { cache: 'no-store' });
        if (!response.ok) {
          const cached = await caches.match(event.request);
          return cached || response;
        }
        return putSuccessful(cache, event.request, response);
      } catch (error) {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        throw error;
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    const response = await fetch(event.request);
    const cache = await caches.open(CACHE_NAME);
    return putSuccessful(cache, event.request, response);
  })());
});
