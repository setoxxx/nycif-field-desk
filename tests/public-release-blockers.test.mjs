import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
const policySource = read('../public-feed-policy-v01.js');
const guardSource = read('../public-release-guard-v01.js');
const calendarSource = read('../nyc-calendar-runtime-v01.js');
const tipMotionSource = read('../tip-jar-motion-policy-v01.js');
const tipSafetyCss = read('../tip-jar-motion-safety-v01.css');
const indexSource = read('../index.html');
const serviceWorkerSource = read('../service-worker.js');

function stubSchema() {
  return {
    SCHEMA_VERSION: '1.0',
    DEFAULT_TIMEZONE: 'America/New_York',
    validCalendarDate(value) {
      return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : null;
    },
    projectEvent(row) {
      return {
        id: row.id,
        title: row.title,
        category: row.category,
        start_date_time: row.start_date_time,
        end_date_time: row.end_date_time,
        timezone: row.timezone,
        borough: row.borough,
        location: row.location,
        latitude: row.latitude,
        longitude: row.longitude,
        significance: row.significance ?? null,
        source: {
          dataset: row.source?.dataset ?? null,
          source_event_id: row.source?.source_event_id ?? null
        },
        nycif: row.nycif ? { ...row.nycif } : {}
      };
    },
    projectEnvelope(payload, dataLayer, generatedAtUtc) {
      const rows = Array.isArray(payload) ? payload : (payload?.events || []);
      return {
        schema_version: '1.0',
        generated_at_utc: generatedAtUtc || payload?.generated_at_utc || new Date().toISOString(),
        total: rows.length,
        next_cursor: payload?.next_cursor ?? null,
        events: rows.map(row => this.projectEvent(row, 0, dataLayer))
      };
    }
  };
}

function contextFor(url, overrides = {}) {
  const parsed = new URL(url);
  const replaced = [];
  const fetchCalls = [];
  const timeoutCalls = [];
  const nativeTimeout = (callback, delay, ...args) => {
    timeoutCalls.push({ callback, delay, args });
    return 77;
  };
  const windowObject = {
    location: { href: parsed.href, hostname: parsed.hostname },
    history: {
      state: null,
      replaceState(_state, _title, next) {
        replaced.push(next);
        this.state = _state;
        windowObject.location.href = next;
      }
    },
    fetch(input) {
      fetchCalls.push(typeof input === 'string' ? input : input.url);
      return Promise.resolve(new Response('{}', { status: 200 }));
    },
    setTimeout: nativeTimeout,
    Date,
    ...overrides
  };
  const context = vm.createContext({
    URL,
    URLSearchParams,
    Response,
    Intl,
    Date,
    Object,
    Array,
    String,
    Number,
    Math,
    RegExp,
    Promise,
    Function,
    WeakSet,
    console,
    window: windowObject
  });
  windowObject.window = windowObject;
  context.fetch = (...args) => windowObject.fetch(...args);
  context.location = windowObject.location;
  context.history = windowObject.history;
  return { context, replaced, fetchCalls, timeoutCalls, nativeTimeout };
}

function addCalendarDays(key, amount) {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount, 12));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

// Public mode strips arbitrary feed refs and never reaches the review feed.
{
  const { context, replaced, fetchCalls } = contextFor('https://example.com/map/?feeds=unsafe-branch');
  vm.runInContext(policySource, context);
  assert.equal(context.window.NYCIF_PUBLIC_FEED_POLICY.allowFeedOverride, false);
  assert.equal(context.window.NYCIF_PUBLIC_FEED_POLICY.allowReview, false);
  assert.equal(replaced.length, 1);
  assert.equal(new URL(replaced[0]).searchParams.has('feeds'), false);
  const response = await context.window.fetch('https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/data/schema-v1-discovery/review/manifest.json?cache=1');
  const payload = await response.json();
  assert.deepEqual(payload.pages, []);
  assert.equal(payload.total, 0);
  assert.equal(fetchCalls.length, 0);
}

// Operator mode retains the intentional QA controls.
{
  const { context } = contextFor('https://example.com/map/?desk=1&feeds=qa-branch');
  vm.runInContext(policySource, context);
  assert.equal(context.window.NYCIF_PUBLIC_FEED_POLICY.allowFeedOverride, true);
  assert.equal(context.window.NYCIF_PUBLIC_FEED_POLICY.allowReview, true);
}

// Projection preserves governance metadata and normalizes NYC wall times across DST.
{
  const { context } = contextFor('https://example.com/map/');
  vm.runInContext(policySource, context);
  context.window.NYCIF_EVENT_FEED_SCHEMA_V1 = stubSchema();
  vm.runInContext(guardSource, context);
  const schema = context.window.NYCIF_EVENT_FEED_SCHEMA_V1;
  const raw = {
    id: 'event-1',
    event_group_id: 'group-1',
    parent_event_id: 'parent-1',
    title: 'Governed Event',
    description: 'Full description',
    category: 'civic',
    interests: ['civic', 'market'],
    tags: ['parade'],
    event_role: 'street_closure',
    audience: ['all ages'],
    start_date_time: '2026-12-19T10:00 am',
    end_date_time: '2026-12-19T12:30:00',
    timezone: 'America/New_York',
    borough: 'Manhattan',
    neighborhood: 'Midtown',
    location: 'Fifth Avenue',
    address: '1 Fifth Avenue',
    latitude: 40.75,
    longitude: -73.98,
    source: { dataset: 'test', source_event_id: '1', source_url: 'https://example.com/event' },
    nycif: { data_layer: 'approved_staged', coordinate_status: 'map_ready', display_disposition: 'supporting_record' }
  };
  const event = schema.projectEnvelope({ events: [raw] }, 'approved_staged').events[0];
  assert.equal(event.event_role, 'street_closure');
  assert.equal(event.parent_event_id, 'parent-1');
  assert.equal(event.event_group_id, 'group-1');
  assert.deepEqual(Array.from(event.interests), ['civic', 'market']);
  assert.deepEqual(Array.from(event.tags), ['parade']);
  assert.equal(event.source.source_url, 'https://example.com/event');
  assert.equal(event.nycif.display_disposition, 'supporting_record');
  assert.match(event.start_date_time, /-05:00$/);
  assert.match(event.end_date_time, /-05:00$/);
  assert.equal(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric' }).format(new Date(event.start_date_time)), '10 AM');

  const summer = schema.normalizeWallTime('2026-07-29T09:00:00', 'America/New_York');
  assert.match(summer, /-04:00$/);
  assert.equal(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric' }).format(new Date(summer)), '9 AM');
  assert.match(schema.normalizeWallTime('2026-03-08T01:30:00', 'America/New_York'), /-05:00$/);
  assert.match(schema.normalizeWallTime('2026-03-08T03:30:00', 'America/New_York'), /-04:00$/);
  assert.match(schema.normalizeWallTime('2026-11-01T01:30:00', 'America/New_York'), /-04:00$/);
  assert.match(schema.normalizeWallTime('2026-11-01T02:30:00', 'America/New_York'), /-05:00$/);
  assert.equal(schema.normalizeWallTime('2026-07-29T09:00:00-04:00', 'America/New_York'), '2026-07-29T09:00:00-04:00');

  const review = schema.projectEnvelope({ events: [raw] }, 'review_supplemental');
  assert.equal(review.events.length, 0);
  assert.equal(review.total, 0);

  const chips = schema.dateChipModel(new Date('2026-07-30T02:00:00Z'));
  assert.equal(chips[0].key, '2026-07-29');
  assert.equal(chips[1].key, '2026-07-30');
}

// The application calendar follows New York's date while explicit event dates stay native.
{
  const { context } = contextFor('https://example.com/map/');
  vm.runInContext(calendarSource, context);
  const RuntimeDate = context.window.Date;
  const explicit = new RuntimeDate('2026-12-19T10:00:00-05:00');
  assert.equal(explicit.toISOString(), '2026-12-19T15:00:00.000Z');
  assert.equal(Object.prototype.toString.call(explicit), '[object Date]');
  assert.equal(explicit instanceof RuntimeDate, true);

  const expectedToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
  const current = new RuntimeDate();
  const actualToday = context.window.NYCIF_NYC_CALENDAR_RUNTIME.dateKey(current);
  assert.equal(actualToday, expectedToday);

  const tomorrow = new RuntimeDate(current);
  tomorrow.setDate(tomorrow.getDate() + 1);
  assert.equal(context.window.NYCIF_NYC_CALENDAR_RUNTIME.dateKey(tomorrow), addCalendarDays(expectedToday, 1));
  assert.equal(typeof RuntimeDate.now(), 'number');
  assert.equal(RuntimeDate.UTC(2026, 0, 1), Date.UTC(2026, 0, 1));
}

// The temporary timer guard blocks only the unsolicited recurring tip-jar motion.
{
  const { context, timeoutCalls, nativeTimeout } = contextFor('https://example.com/map/');
  vm.runInContext(tipMotionSource, context);
  const recurringCallback = function recurringTipMotion() {
    if (!panel.hidden) scheduleRandomShake();
  };
  const blocked = context.window.setTimeout(recurringCallback, 7000);
  assert.equal(blocked, 0);
  assert.equal(timeoutCalls.length, 0);

  const ordinary = context.window.setTimeout(() => 'ordinary', 7000);
  assert.equal(ordinary, 77);
  assert.equal(timeoutCalls.length, 1);

  context.window.NYCIF_TIP_JAR_MOTION_POLICY.restore();
  const restored = context.window.setTimeout(() => 'restored', 25);
  assert.equal(restored, 77);
  assert.equal(timeoutCalls.length, 2);
  assert.notEqual(context.window.setTimeout.name, 'guardedSetTimeout');
}

// Asset wiring and cache policy keep the release guards deterministic.
assert.match(tipSafetyCss, /animation:\s*none\s*!important/);
assert.match(tipSafetyCss, /:focus-visible/);
assert.ok(indexSource.indexOf('nyc-calendar-runtime-v01.js') < indexSource.indexOf('app-schema-v1-major-all-v01.js'));
assert.ok(indexSource.indexOf('public-feed-policy-v01.js') < indexSource.indexOf('discovery-patch-v02.js'));
assert.ok(indexSource.indexOf('event-feed-schema-v1.js') < indexSource.indexOf('public-release-guard-v01.js'));
assert.ok(indexSource.indexOf('public-release-guard-v01.js') < indexSource.indexOf('app-schema-v1-major-all-v01.js'));
assert.ok(indexSource.indexOf('tip-jar-motion-policy-v01.js') < indexSource.indexOf('nycif-tip-jar-v01.js'));
assert.ok(indexSource.indexOf('nycif-tip-jar-v01.js') < indexSource.indexOf('policy.restore()'));
assert.match(indexSource, /DOMContentLoaded[\s\S]*policy\.restore\(\)/);
assert.match(serviceWorkerSource, /nycif-rc-public-map-v11/);
for (const asset of [
  'nyc-calendar-runtime-v01.js',
  'public-feed-policy-v01.js',
  'public-release-guard-v01.js',
  'tip-jar-motion-policy-v01.js',
  'tip-jar-motion-safety-v01.css'
]) {
  assert.match(serviceWorkerSource, new RegExp(asset.replaceAll('.', '\\.')));
}

console.log('public release blocker tests passed');
