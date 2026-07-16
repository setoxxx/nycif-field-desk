// Editor's Picks / medal engine + News Desk wiring tests.
// Run with: node --test tools/public-map/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function loadEngine() {
  const src = readFileSync(join(repoRoot, 'news-desk-editors-picks-v01.js'), 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window.NYCIF_EDITORIAL;
}
const ED = loadEngine();
const indexHtml = readFileSync(join(repoRoot, 'index.html'), 'utf8');
const appJs = readFileSync(join(repoRoot, 'app-schema-v1-major-all-v01.js'), 'utf8');
const swJs = readFileSync(join(repoRoot, 'service-worker.js'), 'utf8');

test('engine module loads with weights and thresholds', () => {
  assert.ok(ED);
  assert.equal(typeof ED.editorialScore, 'function');
  assert.equal(typeof ED.medalOf, 'function');
  assert.ok(ED.THRESHOLDS.gold > ED.THRESHOLDS.silver);
  assert.ok(ED.THRESHOLDS.silver > ED.THRESHOLDS.bronze);
});

test('being major alone earns no medal (curation, not gilding the whole feed)', () => {
  // Every major feed event carries the same flat major_score; major-only must
  // not medal, or ~900 events would all be gold.
  assert.equal(ED.medalOf(ED.editorialScore({ isMajor: true })), '', 'major alone => no medal');
  assert.equal(ED.medalOf(ED.editorialScore({})), '', 'nothing => no medal');
});

test('editorial score rewards past presence, crowd, money, and photogenic', () => {
  // Returning alone is a medal (silver) but not gold — gold needs more.
  assert.ok(ED.editorialScore({ returning: true }) >= ED.THRESHOLDS.silver, 'past presence => at least silver');
  assert.ok(ED.editorialScore({ returning: true }) < ED.THRESHOLDS.gold, 'past presence alone is not gold');
  assert.ok(ED.editorialScore({ crowdScore: 200 }) > 0, 'crowd adds');
  assert.ok(ED.editorialScore({ moneyScore: 200 }) > 0, 'money adds');
  assert.ok(ED.editorialScore({ photoPick: true }) > 0, 'photo adds');
});

test('gold requires past presence plus another standout signal', () => {
  assert.equal(ED.medalOf(ED.editorialScore({ returning: true })), 'silver', 'returning alone => silver');
  assert.equal(ED.medalOf(ED.editorialScore({ returning: true, moneyScore: 200 })), 'gold', 'returning + money magnet => gold');
  assert.equal(ED.medalOf(ED.editorialScore({ returning: true, crowdScore: 200 })), 'gold', 'returning + big crowd => gold');
});

test('medals are threshold tiers, not fixed counts', () => {
  assert.equal(ED.medalOf(ED.THRESHOLDS.gold), 'gold');
  assert.equal(ED.medalOf(ED.THRESHOLDS.gold + 500), 'gold'); // many can be gold
  assert.equal(ED.medalOf(ED.THRESHOLDS.silver), 'silver');
  assert.equal(ED.medalOf(ED.THRESHOLDS.bronze), 'bronze');
  assert.equal(ED.medalOf(ED.THRESHOLDS.bronze - 1), '', 'below bronze earns no medal');
  assert.equal(ED.medalOf(0), '');
});

test('a proven returning crowd magnet reaches gold; a plain event does not', () => {
  const magnet = ED.editorialScore({ isMajor: true, crowdScore: 100, returning: true, photoPick: true });
  assert.equal(ED.medalOf(magnet), 'gold');
  const plain = ED.editorialScore({ isMajor: true });
  assert.equal(ED.medalOf(plain), '');
});

test('money-day priority alone can earn silver/bronze without past presence', () => {
  assert.equal(ED.medalOf(ED.editorialScore({ moneyScore: 200 })), 'silver');
  assert.equal(ED.medalOf(ED.editorialScore({ moneyScore: 90 })), 'bronze');
});

test('sourceKey joins feed events to operator rows', () => {
  const k = ED.sourceKey({ source: { dataset: 'tvpp-9vvx', source_event_id: '898494' } });
  assert.equal(k, 'tvpp-9vvx:898494');
  assert.equal(ED.sourceKey({ source: {} }), '');
});

test('returning keys come from viral current-side returning_likely only', () => {
  const keys = ED.extractReturningKeys({ matches: [
    { recurrence_label: 'returning_likely', current: { source: { dataset: 'd1', source_event_id: '1' } } },
    { recurrence_label: 'unlikely', current: { source: { dataset: 'd2', source_event_id: '2' } } }
  ] });
  assert.ok(keys.has('d1:1'));
  assert.ok(!keys.has('d2:2'));
});

test('News Desk rows are certified NYC map_ready only — no ocean pins', () => {
  const rows = ED.extractNewsDeskRows(
    { events: [
      { certified_pin: true, coordinate_status: 'map_ready', latitude: 40.75, longitude: -73.98, title: 'Good', source: { dataset: 'm', source_event_id: '1' } },
      { certified_pin: true, coordinate_status: 'map_ready', latitude: 0, longitude: 0, title: 'Ocean', source: { dataset: 'm', source_event_id: '2' } },
      { certified_pin: false, coordinate_status: 'list_only', latitude: 40.75, longitude: -73.98, title: 'Uncertified', source: { dataset: 'm', source_event_id: '3' } }
    ] },
    { matches: [] }
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, 'Good');
  assert.equal(rows[0].kind, 'money');
});

test('index.html exposes the public News Desk toggle and Editor’s Picks control', () => {
  assert.match(indexHtml, /id="newsDeskToggle"/);
  assert.match(indexHtml, /id="editorsPicksSelect"/);
  assert.match(indexHtml, /News Desk/);
  assert.match(indexHtml, /Editor.s Picks/);
  // Engine script must load before the app that consumes it.
  assert.ok(indexHtml.indexOf('news-desk-editors-picks-v01.js') < indexHtml.indexOf('app-schema-v1-major-all-v01.js'));
});

test('app wires medals into filtering and rendering', () => {
  assert.match(appJs, /medalMatch/);
  assert.match(appJs, /state\.newsDeskOn/);
  assert.match(appJs, /loadNewsDeskSignals/);
  assert.match(appJs, /applyEditorial/);
  // News Desk is additive in category matching.
  assert.match(appJs, /state\.newsDeskOn && e\.newsDesk/);
});

test('engine script is service-worker cached and cache bumped', () => {
  assert.match(swJs, /news-desk-editors-picks-v01\.js/);
  assert.match(swJs, /const CACHE_NAME = 'nycif-v\d+-[a-z0-9-]+'/);
});
