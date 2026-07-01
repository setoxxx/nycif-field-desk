const CACHE_NAME = 'nycif-v014-category-defaults-fix';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './fielddesk-v02.css',
  './weekstrip-v06-safe.css',
  './staged-map-mode-v01.css',
  './public-map-v01.css',
  './data-window-v08-safe.css',
  './truth-panel-v09-safe.css',
  './live-test-v010-safe.css',
  './public-approved-overlays-capture-v01.js',
  './public-map-defaults-v01.js',
  './public-approved-overlays-v01.js',
  './boot-today-v073-safe.js',
  './date-normalizer-v073-safe.js',
  './app-v06-safe.js',
  './stats-v05-safe.js',
  './data-window-v08-safe.js',
  './truth-panel-v09-safe.js',
  './live-test-v011-safe.js',
  './manifest.json',
  './icons/icon-192.svg',
  './icons/icon-512.svg'
];

const UI_CONFIG_RE = /\/(?:index\.html|app-v06-safe\.js|public-map-defaults-v01\.js|public-approved-overlays-v01\.js|public-approved-overlays-capture-v01\.js)$/;

function isUiConfigRequest(url) {
  return url.origin === location.origin && UI_CONFIG_RE.test(url.pathname);
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin && u.hostname !== 'raw.githubusercontent.com') return;

  if (isUiConfigRequest(u)) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }).then(r => {
      const copy = r.clone();
      caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
      return r;
    }));
    return;
  }

  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone();
    caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request)));
});
