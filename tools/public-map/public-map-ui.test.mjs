// Public map UI contract tests: static checks against the shipped
// entrypoint and runtime so newsroom/workflow terminology, removed
// controls, and reliability plumbing cannot silently regress.
// Run with: node --test tools/public-map/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const indexHtml = readFileSync(join(repoRoot, 'index.html'), 'utf8');
const appJs = readFileSync(join(repoRoot, 'app-schema-v1-major-all-v01.js'), 'utf8');
const swJs = readFileSync(join(repoRoot, 'service-worker.js'), 'utf8');
const defaultsJs = readFileSync(join(repoRoot, 'public-map-defaults-v01.js'), 'utf8');
const patchJs = readFileSync(join(repoRoot, 'discovery-patch-v02.js'), 'utf8');

// Visible page copy: index.html with script bodies and attribute
// values (script/style URLs legitimately contain internal file names) removed.
const visibleCopy = indexHtml
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<[^>]+>/g, ' ');

test('public copy contains no newsroom or workflow terminology', () => {
  const banned = [
    /photo only/i,
    /photo-friendly/i,
    /nypd/i,
    /field intel/i,
    /staged/i,
    /\breview\b/i,
    /\bapproved\b/i,
    /operator/i,
    /pipeline/i,
    /\bschema\b/i,
    /backend/i,
    /major only/i,
    /list only/i,
    /newsroom/i
  ];
  for (const pattern of banned) {
    assert.ok(!pattern.test(visibleCopy), `visible copy must not contain ${pattern}`);
  }
});

test('removed date controls stay removed', () => {
  assert.ok(!/next 7 days/i.test(visibleCopy), 'Next 7 Days must not appear');
  assert.ok(!/all upcoming/i.test(visibleCopy), 'All Upcoming must not appear');
  assert.ok(!/showAllUpcomingBtn/.test(indexHtml), 'Show All Upcoming button must not exist');
  assert.ok(!/'next7'/.test(appJs) && !/"next7"/.test(appJs), 'next7 date mode must be gone from the runtime');
});

test('filter panel offers the required public actions', () => {
  assert.match(visibleCopy, /Choose what to show/);
  assert.match(visibleCopy, /Enable All/);
  assert.match(visibleCopy, /Clear Filters/);
  assert.match(visibleCopy, /Retry Events/);
});

test('removed internal controls stay removed from the entrypoint', () => {
  for (const id of ['sourceFilter', 'photoOnly', 'nypdOnly', 'modeMajor', 'modeAll']) {
    assert.ok(!indexHtml.includes(`id="${id}"`), `${id} control must not exist`);
  }
});

test('upper-right control stack has Filters, Near Me, GPS, and Bug', () => {
  const stack = /<div class="map-controls"[\s\S]*?<\/div>/.exec(indexHtml);
  assert.ok(stack, 'map-controls stack missing');
  const order = ['layersBtn', 'nearMeBtn', 'locateBtn', 'bugBtn'];
  let last = -1;
  for (const id of order) {
    const at = stack[0].indexOf(`id="${id}"`);
    assert.ok(at > last, `${id} must appear in stack order`);
    last = at;
  }
  assert.ok(!stack[0].includes('🗽'), 'GPS button must not use the Statue of Liberty emoji');
});

test('bug report goes to the right recipient with the right subject', () => {
  assert.ok(appJs.includes("'howard@nycinfocus.com'"), 'bug email recipient');
  assert.ok(appJs.includes("encodeURIComponent('Bug Found')"), 'bug email subject');
  for (const field of ['Map URL', 'Selected date', 'Categories', 'Borough', 'Sort', 'Feed state', 'Browser', 'Screen', 'Timestamp', 'App version', 'Map center', 'Map zoom', 'What happened?']) {
    assert.ok(appJs.includes(field), `bug report body includes "${field}"`);
  }
});

test('feed fallback order is primary, then full fallback, then emergency', () => {
  const primary = appJs.indexOf('FEEDS.major, label:');
  const fallback = appJs.indexOf('FEEDS.majorFallback');
  const emergency = appJs.indexOf('FEEDS.majorEmergency');
  const chainStart = appJs.indexOf('const chain = [');
  assert.ok(chainStart > -1, 'feed chain missing');
  const chain = appJs.slice(chainStart, appJs.indexOf('];', chainStart));
  const order = ['FEEDS.major,', 'FEEDS.majorFallback,', 'FEEDS.majorEmergency,'];
  let last = -1;
  for (const step of order) {
    const at = chain.indexOf(step);
    assert.ok(at > last, `${step} must appear in fallback order`);
    last = at;
  }
  assert.ok(primary > -1 || fallback > -1 || emergency > -1);
});

test('live feed requests bypass caches', () => {
  assert.ok(appJs.includes("cache: 'no-store'"), 'fetch must use no-store');
  assert.ok(appJs.includes('cache=${Date.now()}'), 'fetch must use a cache-busting query');
});

test('a feed failure is never presented as zero events', () => {
  assert.ok(appJs.includes('Events could not be refreshed. Showing the most recent available information.'));
  assert.ok(appJs.includes("state.feedPhase = 'error'"));
  assert.ok(
    appJs.indexOf('state.byId.clear()') > appJs.indexOf('await loadMajorWithFallbacks()'),
    'inventory is only replaced after a feed succeeds'
  );
});

test('today is the default date and only forward days match', () => {
  assert.ok(appJs.includes("dateMode: 'today'"), 'default date mode is today');
  assert.ok(appJs.includes('dateChipModel'), 'chips come from the shared eight-day model');
});

test('multi-day events match every day they run (feasts/festivals span)', () => {
  // dateMatches uses a start<=selected<=end span, not just the start date.
  assert.match(appJs, /start <= sel && sel <= end/);
  assert.match(appJs, /function eventEndDay/);
  assert.ok(appJs.includes('endDay:'), 'events carry an endDay');
  // Finished events still never appear (selected day is always today or later).
  assert.match(appJs, /selectedDateKey\(\) is always today or later/);
  // A cap prevents a season-long permit from flooding every day.
  assert.match(appJs, /MAX_SPAN_DAYS/);
});

test('clear filters resets to Today without reloading feeds', () => {
  const fn = /function clearFilters\(\) \{[\s\S]*?\n  \}/.exec(appJs);
  assert.ok(fn, 'clearFilters missing');
  assert.ok(fn[0].includes("state.dateMode = 'today'"));
  assert.ok(fn[0].includes('state.categories[k] = false'));
  assert.ok(!fn[0].includes('bootFeeds'), 'clear filters must not reload feeds');
});

test('enable all checks categories without touching date, search, or feeds', () => {
  const fn = /function enableAllCategories\(\) \{[\s\S]*?\n  \}/.exec(appJs);
  assert.ok(fn, 'enableAllCategories missing');
  assert.ok(fn[0].includes('state.categories[k] = true'));
  assert.ok(!fn[0].includes('dateMode'), 'enable all must not change the date');
  assert.ok(!fn[0].includes('search'), 'enable all must not change the search');
  assert.ok(!fn[0].includes('bootFeeds'), 'enable all must not reload feeds');
});

test('service worker cache version was bumped for this release', () => {
  assert.match(swJs, /const CACHE_NAME = 'nycif-v\d+-[a-z0-9-]+'/);
  assert.ok(swJs.includes('keys.filter') || swJs.includes(".filter(key => key.startsWith('nycif-')"), 'old caches are cleaned up');
});

test('the service worker is registered exactly once across the page', () => {
  const inHtml = (indexHtml.match(/serviceWorker\.register/g) || []).length;
  const inApp = (appJs.match(/serviceWorker\.register/g) || []).length;
  assert.equal(inHtml + inApp, 1, 'service worker must be registered exactly once');
});

test('stored-preference version matches across scripts', () => {
  const appVersion = /const VERSION = '([^']+)'/.exec(patchJs)?.[1];
  const defaultsVersion = /const DEFAULT_VERSION = '([^']+)'/.exec(defaultsJs)?.[1];
  assert.ok(appVersion, 'runtime version missing');
  assert.equal(defaultsVersion, appVersion, 'defaults helper must share the runtime version');
});

test('pending locations use calm public language', () => {
  assert.ok(appJs.includes('Location being confirmed'), 'pending-location language present');
  assert.ok(!appJs.includes('LIST ONLY'), 'LIST ONLY label removed');
  assert.ok(!appJs.includes("'REVIEW'"), 'REVIEW label removed');
});

test('overlay layers remain wired into the page', () => {
  assert.ok(indexHtml.includes('public-approved-overlays-v01.js'), 'overlay script still loads');
  const overlays = readFileSync(join(repoRoot, 'public-approved-overlays-v01.js'), 'utf8');
  for (const label of ["It's 5PM Somewhere", 'Legal Cannabis Dispensaries', 'Smoke/Vape/Cannabis Correlation']) {
    assert.ok(overlays.includes(label), `${label} overlay still defined`);
  }
});
