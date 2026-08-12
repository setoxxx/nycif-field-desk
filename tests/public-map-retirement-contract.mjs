import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync('index.html', 'utf8');
const worker = fs.readFileSync('service-worker.js', 'utf8');
const canonical = 'https://nycinfocus.com/map/';

assert.match(html, /<meta[^>]+http-equiv="refresh"[^>]+nycinfocus\.com\/map\//i);
assert.match(html, /<link[^>]+rel="canonical"[^>]+nycinfocus\.com\/map\//i);
assert.ok(html.includes(canonical));
assert.ok(!/leaflet/i.test(html), 'retired root must not load or reference Leaflet');
assert.ok(!/raw\.githubusercontent\.com/i.test(html), 'retired root must not load raw feed authority');
assert.ok(!/serviceWorker\.register/i.test(html), 'retired root must not re-register the legacy service worker');
assert.ok(!/public-map-defaults|community-help-v01|app-schema-v1-major-all/i.test(html), 'retired root must not load legacy app modules');

assert.ok(worker.includes(canonical));
assert.ok(worker.includes("nycif-rc-public-map-"));
assert.ok(worker.includes('Response.redirect'));
assert.ok(!worker.includes('APP_SHELL'), 'retirement worker must not retain the legacy offline shell');
assert.ok(!worker.includes('raw.githubusercontent.com'), 'retirement worker must not fetch raw feed authority');

console.log('FIELD_DESK_PUBLIC_ROOT_RETIREMENT_CONTRACT_PASS');
