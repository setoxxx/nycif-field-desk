// Public map schema and classification tests.
// Run with: node --test tools/public-map/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function loadSchema() {
  const source = readFileSync(join(repoRoot, 'event-feed-schema-v1.js'), 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window.NYCIF_EVENT_FEED_SCHEMA_V1;
}

const SCHEMA = loadSchema();

test('schema module loads and exposes the public-map helpers', () => {
  assert.ok(SCHEMA, 'schema global missing');
  assert.equal(typeof SCHEMA.validCalendarDate, 'function');
  assert.equal(typeof SCHEMA.dateChipModel, 'function');
  assert.equal(typeof SCHEMA.enforceSportsFitness, 'function');
});

test('valid real calendar dates are accepted', () => {
  assert.equal(SCHEMA.validCalendarDate('2026-07-14'), '2026-07-14');
  assert.equal(SCHEMA.validCalendarDate('2026-12-31'), '2026-12-31');
  assert.equal(SCHEMA.validCalendarDate('2028-02-29'), '2028-02-29'); // leap year
});

test('impossible calendar dates are rejected even when the shape matches', () => {
  assert.equal(SCHEMA.validCalendarDate('2026-99-99'), null);
  assert.equal(SCHEMA.validCalendarDate('2026-02-31'), null);
  assert.equal(SCHEMA.validCalendarDate('0000-00-00'), null);
  assert.equal(SCHEMA.validCalendarDate('2026-02-30'), null);
  assert.equal(SCHEMA.validCalendarDate('2026-13-01'), null);
  assert.equal(SCHEMA.validCalendarDate('2027-02-29'), null); // not a leap year
  assert.equal(SCHEMA.validCalendarDate('not-a-date'), null);
  assert.equal(SCHEMA.validCalendarDate(''), null);
  assert.equal(SCHEMA.validCalendarDate(null), null);
});

test('event date falls back to start_date_time when row.date is invalid', () => {
  const projected = SCHEMA.projectEvent({
    title: 'Fallback date event',
    date: '2026-02-31',
    start_date_time: '2026-08-02T10:00:00',
    lat: 40.75,
    lng: -73.98
  }, 0, 'approved_staged');
  assert.equal(projected.nycif.event_date, '2026-08-02');
});

test('an event with no usable date has no event_date', () => {
  const projected = SCHEMA.projectEvent({
    title: 'No date event',
    date: '2026-99-99',
    start_date_time: 'soon',
    lat: 40.75,
    lng: -73.98
  }, 0, 'approved_staged');
  assert.equal(projected.nycif.event_date, null);
});

test('softball and league sports route to Sports', () => {
  for (const title of [
    'Co-ed Softball League Finals',
    'Youth Baseball Clinic',
    'Basketball Tournament',
    'Soccer in the Park',
    'Little League Opening Day'
  ]) {
    const projected = SCHEMA.projectEvent({ title, lat: 40.75, lng: -73.98 }, 0, 'approved_staged');
    assert.equal(projected.category, 'sports', `${title} should be sports`);
  }
});

test('yoga and wellness classes route to Fitness', () => {
  for (const title of ['Sunrise Yoga', 'Zumba in the Plaza', 'Tai Chi for Seniors', 'Shape Up NYC: Aerobics']) {
    const projected = SCHEMA.projectEvent({ title, lat: 40.75, lng: -73.98 }, 0, 'approved_staged');
    assert.equal(projected.category, 'fitness', `${title} should be fitness`);
  }
});

test('a backend fitness category never survives for league sports', () => {
  assert.equal(SCHEMA.enforceSportsFitness('fitness', { title: 'Adult Softball League' }), 'sports');
  assert.equal(SCHEMA.enforceSportsFitness('fitness', { title: 'Volleyball Night' }), 'sports');
  assert.equal(SCHEMA.enforceSportsFitness('fitness', { title: 'Evening Yoga' }), 'fitness');
  assert.equal(SCHEMA.enforceSportsFitness('arts', { title: 'Softball: The Musical' }), 'arts');
  const projected = SCHEMA.projectEvent({
    title: 'Brooklyn Kickball League',
    category: 'fitness',
    lat: 40.68,
    lng: -73.95
  }, 0, 'approved_staged');
  assert.equal(projected.category, 'sports');
});

test('ordinary and untiered events keep a visible category', () => {
  const projected = SCHEMA.projectEvent({
    title: 'Community Board Coffee Hour',
    lat: 40.71,
    lng: -73.99
  }, 0, 'approved_staged');
  assert.ok(projected.category, 'ordinary event must keep a category');
  assert.equal(projected.significance, null, 'untiered event stays untiered');
});

test('date chip model returns exactly eight forward days, Today first', () => {
  const base = new Date(2026, 6, 14); // July 14, 2026 (a Tuesday)
  const chips = SCHEMA.dateChipModel(base);
  assert.equal(chips.length, 8);
  assert.equal(chips[0].label, 'Today');
  assert.equal(chips[0].key, '2026-07-14');
  assert.equal(chips[1].label, 'Tomorrow');
  assert.equal(chips[1].key, '2026-07-15');
  assert.equal(chips[2].label, 'Thu 7/16');
  assert.equal(chips[7].key, '2026-07-21');
  // No past dates and strictly increasing keys.
  for (let i = 1; i < chips.length; i += 1) {
    assert.ok(chips[i].key > chips[i - 1].key, 'chip keys must move forward');
  }
  for (const chip of chips) {
    assert.ok(chip.key >= chips[0].key, 'no chip may be in the past');
    assert.ok(SCHEMA.validCalendarDate(chip.key), 'every chip key is a real date');
    assert.ok(chip.label.length <= 10, `label "${chip.label}" should stay compact`);
  }
});

test('date chip model handles month boundaries', () => {
  const chips = SCHEMA.dateChipModel(new Date(2026, 6, 29)); // July 29, 2026
  assert.equal(chips.length, 8);
  assert.equal(chips[3].key, '2026-08-01');
});
