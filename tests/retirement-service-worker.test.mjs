import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('service-worker.js', 'utf8');
const listeners = new Map();
const deleted = [];
let skipWaitingCalls = 0;
let claimCalls = 0;

const cacheKeys = [
  'nycif-rc-public-map-v10',
  'nycif-rc-public-map-v12',
  'unrelated-field-desk-cache-v1',
];

const context = {
  URL,
  Promise,
  self: {
    location: { origin: 'https://setoxxx.github.io' },
    skipWaiting() { skipWaitingCalls += 1; },
    clients: {
      async claim() { claimCalls += 1; },
    },
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
  },
  caches: {
    async keys() { return [...cacheKeys]; },
    async delete(key) {
      deleted.push(key);
      return true;
    },
  },
  Response: {
    redirect(url, status) {
      return { kind: 'redirect', url, status };
    },
  },
};

vm.runInNewContext(source, context, { filename: 'service-worker.js' });

assert.ok(listeners.has('install'));
assert.ok(listeners.has('activate'));
assert.ok(listeners.has('fetch'));

listeners.get('install')({});
assert.equal(skipWaitingCalls, 1, 'retirement worker must take over immediately');

let activatePromise;
listeners.get('activate')({
  waitUntil(value) { activatePromise = value; },
});
assert.ok(activatePromise instanceof Promise);
await activatePromise;
assert.deepEqual(
  deleted.sort(),
  ['nycif-rc-public-map-v10', 'nycif-rc-public-map-v12'],
  'only legacy public-map cache generations may be deleted',
);
assert.equal(claimCalls, 1, 'retirement worker must claim controlled clients after cache cleanup');

let sameOriginResponse;
listeners.get('fetch')({
  request: {
    mode: 'navigate',
    url: 'https://setoxxx.github.io/nycif-field-desk/preview-major-feed-review.html?cachebust=1',
  },
  respondWith(value) { sameOriginResponse = value; },
});
assert.deepEqual(sameOriginResponse, {
  kind: 'redirect',
  url: 'https://nycinfocus.com/map/',
  status: 302,
});

let crossOriginResponded = false;
listeners.get('fetch')({
  request: {
    mode: 'navigate',
    url: 'https://example.org/legacy-map/',
  },
  respondWith() { crossOriginResponded = true; },
});
assert.equal(crossOriginResponded, false, 'worker must not intercept cross-origin navigation');

let assetResponded = false;
listeners.get('fetch')({
  request: {
    mode: 'no-cors',
    url: 'https://setoxxx.github.io/nycif-field-desk/legacy.js',
  },
  respondWith() { assetResponded = true; },
});
assert.equal(assetResponded, false, 'worker must not synthesize old asset responses');

console.log('FIELD_DESK_RETIREMENT_STALE_CACHE_AND_NAVIGATION_PASS');
