// Operator Desk layer tests: prove the operator gate, the "no ocean pins"
// certification, and current-side-only viral handling.
// Run with: node --test tools/public-map/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const source = readFileSync(join(repoRoot, 'field-desk-operator-layer-v01.js'), 'utf8');
const indexHtml = readFileSync(join(repoRoot, 'index.html'), 'utf8');
const swJs = readFileSync(join(repoRoot, 'service-worker.js'), 'utf8');

// Load the module with a given URL. document.readyState 'loading' keeps boot()
// deferred so no DOM is needed; the module still exports NYCIF_OPERATOR_DESK.
function loadWithUrl(href) {
  const sandbox = {
    window: {},
    document: { readyState: 'loading', addEventListener() {} },
    location: { href },
    URL,
    console: { info() {}, error() {} }
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window.NYCIF_OPERATOR_DESK;
}

test('does nothing for a public visitor (no operator mode)', () => {
  const api = loadWithUrl('https://setoxxx.github.io/nycif-field-desk/');
  assert.equal(api, undefined, 'public mode must not expose the desk API');
});

test('activates for ?desk=1 and ?assignment=1', () => {
  assert.ok(loadWithUrl('https://x/?desk=1'), 'desk=1 should activate');
  assert.ok(loadWithUrl('https://x/?assignment=1'), 'assignment=1 should activate');
});

const desk = loadWithUrl('https://x/?desk=1');

test('certifyCoord accepts real NYC coordinates', () => {
  const c = desk.certifyCoord(40.7562, -73.98653); // Times Square
  assert.equal(c.ok, true);
  assert.equal(c.reason, 'ok_nyc');
});

test('certifyCoord rejects ocean / Null Island / out-of-box / nonfinite', () => {
  assert.equal(desk.certifyCoord(0, 0).ok, false); // Null Island
  assert.equal(desk.certifyCoord(0, 0).reason, 'null_island');
  assert.equal(desk.certifyCoord(25.7, -80.2).ok, false); // Miami — out of box
  assert.equal(desk.certifyCoord(41.5, -73.0).ok, false); // upstate — out of box
  assert.equal(desk.certifyCoord('x', -73.9).ok, false); // nonfinite
  assert.equal(desk.certifyCoord(NaN, NaN).reason, 'nonfinite');
});

test('certifyCoord flags an unambiguous lat/lng swap and refuses it', () => {
  // NYC lat/lng transposed: lat=-73.98, lng=40.75
  const c = desk.certifyCoord(-73.98653, 40.7562);
  assert.equal(c.ok, false);
  assert.equal(c.reason, 'swap_suspected');
});

test('certifyRow requires the backend gate AND a good NYC coordinate', () => {
  const good = { certified_pin: true, coordinate_status: 'map_ready' };
  assert.equal(desk.certifyRow(good, 40.75, -73.98).ok, true);
  // Backend didn't certify → refuse even if coords look fine.
  assert.equal(desk.certifyRow({ certified_pin: false, coordinate_status: 'map_ready' }, 40.75, -73.98).ok, false);
  assert.equal(desk.certifyRow({ certified_pin: true, coordinate_status: 'list_only' }, 40.75, -73.98).ok, false);
  // Certified by backend but ocean coord → still refused here (belt & suspenders).
  assert.equal(desk.certifyRow(good, 0, 0).ok, false);
});

test('shoot-day extractor plots certified pins and demotes the rest to list-only', () => {
  const pack = {
    today: {
      date: '2026-07-14',
      go_shoot_certified: [
        { id: 'a', title: 'Good pin', certified_pin: true, coordinate_status: 'map_ready', latitude: 40.75, longitude: -73.98, borough: 'Manhattan' },
        { id: 'b', title: 'Ocean pin', certified_pin: true, coordinate_status: 'map_ready', latitude: 0, longitude: 0 },
        { id: 'c', title: 'Swapped', certified_pin: true, coordinate_status: 'map_ready', latitude: -73.98, longitude: 40.75 }
      ],
      needs_location: [
        { id: 'd', title: 'No coords', certified_pin: false, coordinate_status: 'list_only' }
      ]
    }
  };
  const res = desk.extractShootDay(pack, 'today');
  assert.equal(res.pins.length, 1, 'only the valid NYC pin is plottable');
  assert.equal(res.pins[0].id, 'a');
  assert.equal(res.dateLabel, '2026-07-14');
  const listIds = res.listOnly.map(r => r.id).sort().join(',');
  assert.equal(listIds, 'b,c,d', 'ocean, swap, and needs-location go to list-only');
});

test('viral extractor uses current-side coords only and returning_likely only', () => {
  const data = {
    matches: [
      { recurrence_label: 'returning_likely', match_score: 90, current: { id: 'cur', title: 'Parade', certified_pin: true, coordinate_status: 'map_ready', latitude: 40.7, longitude: -73.9 }, prior_year: { latitude: 12, longitude: 12 } },
      { recurrence_label: 'unlikely', current: { id: 'no', certified_pin: true, coordinate_status: 'map_ready', latitude: 40.7, longitude: -73.9 } }
    ]
  };
  const res = desk.extractViral(data);
  assert.equal(res.pins.length, 1);
  assert.equal(res.pins[0].id, 'cur');
  assert.equal(res.pins[0].lat, 40.7, 'must use current-side latitude, never prior_year');
});

test('index.html loads the operator layer and it is service-worker cached', () => {
  assert.match(indexHtml, /field-desk-operator-layer-v01\.js/);
  assert.match(swJs, /field-desk-operator-layer-v01\.js/);
  assert.match(swJs, /const CACHE_NAME = 'nycif-v023-operator-desk-v01'/);
});

test('operator terminology is not added to the public (default) filter panel markup', () => {
  // The desk controls are injected only at runtime in operator mode; the
  // static public markup must not contain operator lane labels.
  assert.ok(!/Operator Desk/.test(indexHtml), 'no operator desk in static public markup');
  assert.ok(!/Money Day/i.test(indexHtml), 'no money-day label in static public markup');
  assert.ok(!/Shoot Day/i.test(indexHtml), 'no shoot-day label in static public markup');
});
