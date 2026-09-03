import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = process.env.NYCIF_TEST_URL || 'http://127.0.0.1:4173/index.html?resetFilters=1';
const ARTIFACT_DIR = process.env.NYCIF_ARTIFACT_DIR || 'artifacts/live-location';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nyDateKey() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

const day = nyDateKey();
const event = {
  id: `live-location-single-control@${day}`,
  title: 'Live Location Single Control Gate Event',
  category: 'civic',
  start_date_time: `${day}T12:00:00-04:00`,
  end_date_time: `${day}T14:00:00-04:00`,
  timezone: 'America/New_York',
  borough: 'Manhattan',
  location: 'City Hall Park',
  latitude: 40.7128,
  longitude: -74.006,
  significance: 'major',
  source: { dataset: 'live-location-single-control', source_event_id: 'event-1' },
  nycif: {
    data_layer: 'approved_staged', coordinate_status: 'map_ready', production_feed: true,
    display_disposition: 'standalone_public_event', event_date: day,
    event_type: 'Public Event', is_major: true, verification_status: 'verified'
  }
};

function payloadFor(url) {
  if (url.includes('/major/events.json') || url.includes('events_discovery_v02_major.json') || url.includes('nycif_major_radar_map_events.json')) {
    return { generated_at_utc: new Date().toISOString(), total: 1, events: [event] };
  }
  if (url.includes('/approved/manifest.json') || url.includes('/review/manifest.json')) {
    return { generated_at_utc: new Date().toISOString(), pages: [] };
  }
  if (url.includes('photographer_assignment_calendar_2mo.json') || url.includes('photographer_viral_recurrence_matches.json')) return [];
  return { generated_at_utc: new Date().toISOString(), total: 0, events: [] };
}

function supabaseReaderPayload() {
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [event.longitude, event.latitude] },
      properties: {
        occurrence_id: event.id,
        title: event.title,
        category: event.category,
        public_subtype: event.nycif.event_type,
        start_date_time: event.start_date_time,
        end_date_time: event.end_date_time,
        timezone: event.timezone,
        borough: event.borough,
        location: event.location,
        significance: event.significance,
        event_role: 'public_event',
        public_url: 'https://example.com/live-location-single-control',
        source_dataset: event.source.dataset,
        source_event_id: event.source.source_event_id,
        event_date: day,
        is_major: true,
        photo_pick: false,
        map_eligibility_state: 'MAP_READY',
        certified_pin: true,
        display_disposition: 'standalone_public_event'
      }
    }],
    metadata: {
      authority: 'supabase_event_authority',
      event_data_origin: 'supabase_only',
      schema_version: 'nycif-supabase-reader-v1',
      generated_at_utc: new Date().toISOString(),
      reader_window_start: day,
      reader_window_end: day,
      reader_safe_event_count: 1,
      exact_marker_count: 1,
      reader_metadata_complete_count: 1,
      reader_metadata_fallback_count: 0,
      resource_warning: false
    }
  };
}

const transparentPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n1cAAAAASUVORK5CYII=',
  'base64'
);

const geolocationMock = `(() => {
  const watchers = new Map();
  let nextId = 1;
  window.__NYCIF_GEO_TEST__ = {
    clearCalls: [],
    getCurrentPositionCalls: 0,
    push(latitude, longitude, accuracy = 12, heading = null, speed = 1, timestamp = Date.now()) {
      const position = { timestamp, coords: { latitude, longitude, accuracy, heading, speed } };
      watchers.forEach(entry => entry.success(position));
    },
    fail(code, message = 'mock error') { watchers.forEach(entry => entry.error({ code, message })); },
    count() { return watchers.size; }
  };
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition(success) {
        window.__NYCIF_GEO_TEST__.getCurrentPositionCalls += 1;
        success({ timestamp: 1000, coords: { latitude: 40.7128, longitude: -74.006, accuracy: 20, heading: 0, speed: 1 } });
      },
      watchPosition(success, error, options) {
        const id = nextId++;
        watchers.set(id, { success, error, options });
        return id;
      },
      clearWatch(id) {
        window.__NYCIF_GEO_TEST__.clearCalls.push(id);
        watchers.delete(id);
      }
    }
  });
})();`;

async function openTestPage(browser, viewport) {
  const context = await browser.newContext({
    viewport, timezoneId: 'America/New_York', reducedMotion: 'reduce', serviceWorkers: 'block'
  });
  await context.addInitScript({ content: geolocationMock });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => pageErrors.push(String(error)));
  await page.route('https://oggwpvdirkrnzoolparx.supabase.co/rest/v1/rpc/nycif_events_reader_v1', route => route.fulfill({
    status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(supabaseReaderPayload())
  }));
  await page.route(/raw\.githubusercontent\.com|127\.0\.0\.1:4173\/data\//, route => route.fulfill({
    status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(payloadFor(route.request().url()))
  }));
  await page.route(/tile\.openstreetmap\.org/, route => route.fulfill({
    status: 200, contentType: 'image/png', body: transparentPng
  }));
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 10_000 });
  await page.locator('#brandCount').filter({ hasText: '1 event' }).waitFor({ timeout: 10_000 });
  await page.waitForFunction(() => Boolean(window.NYCIF_LIVE_LOCATION_CONTROLLER));
  await page.waitForFunction(() => window.NYCIF_LIVE_LOCATION_HANDOFF?.mode === 'single-control');
  return { context, page, consoleErrors, pageErrors };
}

async function assertNoLegacyGpsUi(page) {
  assert(await page.locator('#liveLocationStopBtn').count() === 0, 'Separate GPS stop pill exists');
  assert(await page.locator('.leaflet-popup').filter({ hasText: 'You are here' }).count() === 0, 'Legacy You are here popup is visible');
  assert(await page.evaluate(() => window.__NYCIF_GEO_TEST__.getCurrentPositionCalls) === 0,
    'Legacy one-time getCurrentPosition handler ran');
}

await fs.mkdir(ARTIFACT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });

try {
  const mobile = await openTestPage(browser, { width: 390, height: 844 });
  const { page, context, consoleErrors, pageErrors } = mobile;
  const locate = page.locator('#locateBtn');

  assert(await page.locator('#map').isVisible(), 'Mobile map is not visible');
  assert((await locate.getAttribute('aria-label')) === 'Start live GPS tracking', 'Initial single-control label is wrong');
  assert((await locate.getAttribute('aria-pressed')) === 'false', 'Initial tracking state is wrong');
  await assertNoLegacyGpsUi(page);

  await locate.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.NYCIF_LIVE_LOCATION_CONTROLLER.getState().tracking === true);
  await page.waitForFunction(() => document.getElementById('locateBtn')?.getAttribute('aria-label') === 'Stop live GPS tracking');
  assert(await page.evaluate(() => window.__NYCIF_GEO_TEST__.count()) === 1, 'watchPosition did not start exactly once');
  await assertNoLegacyGpsUi(page);

  await page.evaluate(() => window.__NYCIF_GEO_TEST__.push(40.7132, -74.0054, 14, 90, 1.4, 3000));
  await page.waitForFunction(() => window.NYCIF_LIVE_LOCATION_CONTROLLER.getState().lastFix?.lat === 40.7132);
  let state = await page.evaluate(() => window.NYCIF_LIVE_LOCATION_CONTROLLER.getState());
  assert(Math.abs(state.markerLatLng.lat - 40.7132) < 0.000001, 'Blue dot latitude did not update');
  assert(Math.abs(state.markerLatLng.lng + 74.0054) < 0.000001, 'Blue dot longitude did not update');
  assert(state.accuracyRadius === 14, 'Accuracy circle did not update');
  assert(await page.locator('.nycif-live-location-marker').count() === 1, 'Blue live-location dot is missing');
  await assertNoLegacyGpsUi(page);

  const centerBeforePause = await page.evaluate(() => {
    const center = window.NYCIF_MAIN_MAP.getCenter();
    return { lat: center.lat, lng: center.lng };
  });
  await page.evaluate(() => window.NYCIF_MAIN_MAP.fire('dragstart'));
  await page.waitForFunction(() => window.NYCIF_LIVE_LOCATION_CONTROLLER.getState().following === false);
  await page.waitForFunction(() => document.getElementById('locateBtn')?.getAttribute('aria-label') === 'Recenter and resume live GPS tracking');

  await page.evaluate(() => window.__NYCIF_GEO_TEST__.push(40.714, -74.004, 10, null, 1.2, 5000));
  await page.waitForFunction(() => window.NYCIF_LIVE_LOCATION_CONTROLLER.getState().lastFix?.lat === 40.714);
  const centerWhilePaused = await page.evaluate(() => {
    const center = window.NYCIF_MAIN_MAP.getCenter();
    return { lat: center.lat, lng: center.lng };
  });
  assert(Math.abs(centerWhilePaused.lat - centerBeforePause.lat) < 0.000001, 'Paused follow mode moved the map');
  assert(Math.abs(centerWhilePaused.lng - centerBeforePause.lng) < 0.000001, 'Paused follow mode moved the map');

  await locate.click();
  await page.waitForTimeout(500);
  const recenter = await page.evaluate(() => {
    const state = window.NYCIF_LIVE_LOCATION_CONTROLLER.getState();
    const center = window.NYCIF_MAIN_MAP.getCenter();
    return {
      following: state.following,
      distanceMeters: window.NYCIF_MAIN_MAP.distance(center, [40.714, -74.004]),
      label: document.getElementById('locateBtn')?.getAttribute('aria-label')
    };
  });
  assert(recenter.following === true, `Single control did not resume follow mode: ${JSON.stringify(recenter)}`);
  assert(recenter.distanceMeters <= 5, `Recenter exceeded five meters: ${JSON.stringify(recenter)}`);
  assert(recenter.label === 'Stop live GPS tracking', 'Single control did not return to stop state');
  await assertNoLegacyGpsUi(page);

  const axe = await new AxeBuilder({ page }).analyze();
  const blocking = axe.violations.filter(item => item.impact === 'critical' || item.impact === 'serious');
  assert(blocking.length === 0, `Blocking axe violations: ${blocking.map(item => item.id).join(', ')}`);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'live-gps-mobile-single-control.png'), fullPage: false });

  await locate.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.NYCIF_LIVE_LOCATION_CONTROLLER.getState().tracking === false);
  await page.waitForFunction(() => document.getElementById('locateBtn')?.getAttribute('aria-label') === 'Start live GPS tracking');
  assert((await locate.getAttribute('aria-pressed')) === 'false', 'Keyboard stop did not expose off state');
  assert(await page.evaluate(() => window.__NYCIF_GEO_TEST__.clearCalls.length) >= 1, 'clearWatch was not called');
  await assertNoLegacyGpsUi(page);

  await locate.click();
  await page.evaluate(() => window.__NYCIF_GEO_TEST__.fail(1, 'permission denied'));
  await page.waitForFunction(() => window.NYCIF_LIVE_LOCATION_CONTROLLER.getState().tracking === false);
  assert(/permission was denied/i.test(await page.locator('#status').textContent()), 'Permission denial message is not reader-safe');
  await assertNoLegacyGpsUi(page);

  assert(consoleErrors.length === 0, `Mobile console errors: ${consoleErrors.join(' | ')}`);
  assert(pageErrors.length === 0, `Mobile page errors: ${pageErrors.join(' | ')}`);
  await context.close();

  const desktop = await openTestPage(browser, { width: 1440, height: 1000 });
  await desktop.page.locator('#locateBtn').click();
  await desktop.page.evaluate(() => window.__NYCIF_GEO_TEST__.push(40.716, -74.002, 11, 45, 1.5, 3000));
  await desktop.page.waitForFunction(() => window.NYCIF_LIVE_LOCATION_CONTROLLER.getState().lastFix?.lat === 40.716);
  assert(await desktop.page.locator('.nycif-live-location-marker').count() === 1, 'Desktop blue dot is missing');
  await assertNoLegacyGpsUi(desktop.page);
  await desktop.page.screenshot({ path: path.join(ARTIFACT_DIR, 'live-gps-desktop-single-control.png'), fullPage: false });
  assert(desktop.consoleErrors.length === 0, `Desktop console errors: ${desktop.consoleErrors.join(' | ')}`);
  assert(desktop.pageErrors.length === 0, `Desktop page errors: ${desktop.pageErrors.join(' | ')}`);
  await desktop.context.close();

  const report = {
    status: 'pass',
    browserPlugin: 'not available; repository Playwright used',
    mobile: {
      viewport: '390x844', blueDot: true, accuracyCircle: true,
      legacyPopupAbsent: true, separateStopPillAbsent: true,
      singleButtonStartRecenterStop: true, permissionDenied: true,
      axeSeriousCritical: 0
    },
    desktop: {
      viewport: '1440x1000', blueDot: true,
      legacyPopupAbsent: true, separateStopPillAbsent: true
    }
  };
  await fs.writeFile(path.join(ARTIFACT_DIR, 'live-location-single-control-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
