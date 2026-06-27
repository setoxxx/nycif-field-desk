const CACHE_NAME = 'nycif-v072-today-local-date';
const APP_SHELL = ['./','./index.html','./style.css','./fielddesk-v02.css','./weekstrip-v06-safe.css','./date-normalizer-v072-safe.js','./app-v06-safe.js','./stats-v05-safe.js','./manifest.json','./icons/icon-192.svg','./icons/icon-512.svg'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))); self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))); self.clients.claim(); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin === location.origin || url.hostname === 'raw.githubusercontent.com') {
    event.respondWith(fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request)));
  }
});
