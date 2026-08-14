const CACHE_NAME = 'nycif-rc-public-map-v13-daily-guide';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './fielddesk-v02.css',
  './weekstrip-v06-safe.css',
  './public-map-v01.css',
  './tip-jar-motion-safety-v01.css',
  './accessibility-v01.css',
  './public-display-mode-v01.js',
  './public-approved-overlays-capture-v01.js',
  './public-map-defaults-v01.js',
  './public-feed-policy-v01.js',
  './discovery-patch-v02.js',
  './event-feed-schema-v1.js',
  './nyc-calendar-runtime-v01.js',
  './public-release-guard-v01.js',
  './news-desk-editors-picks-v01.js',
  './app-schema-v1-major-all-v01.js',
  './live-location-tracking-v01.js',
  './live-location-control-handoff-v01.js',
  './accessibility-v01.js',
  './public-approved-overlays-v01.js',
  './community-help-v01.js',
  './field-desk-operator-layer-v01.js',
  './admin-whats-new-v01.js',
  './tip-jar-motion-policy-v01.js',
  './nycif-tip-jar-v01.js',
  './data/community-help/benefits.json',
  './data/community-help/food.json',
  './data/community-help/health.json',
  './data/community-help/jobs.json',
  './data/community-help/naloxone.json',
  './data/community-help/shelter.json',
  './data/community-help/youth.json',
  './data/community-help/homebase.json',
  './data/community-help/senior.json',
  './data/community-help/family.json',
  './data/community-help/digital.json',
  './data/community-help/restroom.json',
  './data/community-help/links.json',
  './data/community-help/sync-summary-v2.json',
  './service-worker.js',
];

const NETWORK_FIRST_RE = /\/(?:index\.html|discovery-patch-v02\.js|public-map-defaults-v01\.js|public-display-mode-v01\.js|public-feed-policy-v01\.js|public-release-guard-v01\.js|nyc-calendar-runtime-v01\.js|service-worker\.js|public-approved-overlays-v01\.js|public-approved-overlays-capture-v01\.js|community-help-v01\.js|accessibility-v01\.js|live-location-tracking-v01\.js|live-location-control-handoff-v01\.js|app-schema-v1-major-all-v01\.js|event-feed-schema-v1\.js|field-desk-operator-layer-v01\.js|news-desk-editors-picks-v01\.js|tip-jar-motion-policy-v01\.js|nycif-tip-jar-v01\.js|data\/community-help\/[^/]+\.json)$/;

function isNetworkFirst(url) {
  return (url.origin === location.origin && NETWORK_FIRST_RE.test(url.pathname))
    || url.hostname === 'raw.githubusercontent.com';
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin && url.hostname !== 'raw.githubusercontent.com') return;
  if (isNetworkFirst(url)) {
    event.respondWith(
      fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      }).catch(() => caches.match(event.request)),
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    })),
  );
});
