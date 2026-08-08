import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const indexSource = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const workerSource = fs.readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');
const canonical = 'https://nycinfocus.com/map/';

// Redirect-only public-root contract.
assert.match(indexSource, /<meta\s+http-equiv=["']refresh["'][^>]*https:\/\/nycinfocus\.com\/map\//i);
assert.match(indexSource, /<link\s+rel=["']canonical["']\s+href=["']https:\/\/nycinfocus\.com\/map\/["']/i);
assert.match(indexSource, /window\.location\.replace\(['"]https:\/\/nycinfocus\.com\/map\/['"]\)/);
assert.match(indexSource, /<meta\s+name=["']robots["']\s+content=["']noindex,follow["']/i);
assert.match(indexSource, /<a\s+href=["']https:\/\/nycinfocus\.com\/map\/["'][^>]*>[^<]+<\/a>/i);
assert.match(indexSource, /<main[\s>]/i);

for (const forbidden of [
  'leaflet',
  'raw.githubusercontent.com',
  'app-schema-v1-major-all-v01.js',
  'nyc-calendar-runtime-v01.js',
  'public-feed-policy-v01.js',
  'public-release-guard-v01.js',
  'community-help-v01.js',
  'live-location-tracking-v01.js',
  'serviceWorker.register',
]) {
  assert.equal(indexSource.toLowerCase().includes(forbidden.toLowerCase()), false, `retired root must not load ${forbidden}`);
}
assert.doesNotMatch(indexSource, /<script\s+[^>]*src=/i, 'retired root must not load application scripts');
assert.doesNotMatch(indexSource, /autofocus/i, 'redirect fallback must not steal focus');

// Retirement worker: delete only legacy NYCIF public-map caches and redirect
// navigation requests. No app-shell precache or source runtime.
assert.match(workerSource, /const CANONICAL_MAP = ['"]https:\/\/nycinfocus\.com\/map\/['"]/);
assert.match(workerSource, /const LEGACY_CACHE_PREFIX = ['"]nycif-rc-public-map-['"]/);
assert.match(workerSource, /key\.startsWith\(LEGACY_CACHE_PREFIX\)/);
assert.match(workerSource, /caches\.delete\(key\)/);
assert.match(workerSource, /event\.request\.mode === ['"]navigate['"]/);
assert.match(workerSource, /Response\.redirect\(CANONICAL_MAP, 302\)/);
for (const forbidden of ['raw.githubusercontent.com', 'cache.addAll', 'APP_SHELL', 'leaflet']) {
  assert.equal(workerSource.toLowerCase().includes(forbidden.toLowerCase()), false, `retirement worker must not contain ${forbidden}`);
}

const listeners = {};
const deleted = [];
let claimed = false;
let skipped = false;
const sandbox = {
  Response,
  Promise,
  console,
  caches: {
    async keys() {
      return ['nycif-rc-public-map-v12', 'nycif-rc-public-map-v9', 'unrelated-app-cache', 'maplibre-reader-safe-v3'];
    },
    async delete(key) {
      deleted.push(key);
      return true;
    },
  },
  self: {
    clients: {
      async claim() {
        claimed = true;
      },
    },
    skipWaiting() {
      skipped = true;
    },
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
  },
};
vm.runInNewContext(workerSource, sandbox, { filename: 'service-worker.js' });

listeners.install({});
assert.equal(skipped, true, 'retirement worker must activate without waiting for old runtime');

let activationPromise;
listeners.activate({ waitUntil(promise) { activationPromise = promise; } });
await activationPromise;
assert.deepEqual(deleted.sort(), ['nycif-rc-public-map-v12', 'nycif-rc-public-map-v9']);
assert.equal(claimed, true);

let navigationResponse;
listeners.fetch({
  request: { mode: 'navigate' },
  respondWith(value) { navigationResponse = value; },
});
const redirect = await navigationResponse;
assert.equal(redirect.status, 302);
assert.equal(redirect.headers.get('location'), canonical);

let assetIntercepted = false;
listeners.fetch({
  request: { mode: 'cors' },
  respondWith() { assetIntercepted = true; },
});
assert.equal(assetIntercepted, false, 'retirement worker must not hijack non-navigation requests');

console.log('retired public runtime contract passed');
