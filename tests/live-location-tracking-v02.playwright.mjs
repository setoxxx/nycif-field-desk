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
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

const day = nyDateKey();
const event = {
  id: `live-location-gate@${day}`,
  title: 'Live Location Tracking Gate Event',
  category: 'civic',
  start_date_time: `${day}T12:00:00-04:00`,
  end_date_time: `${day}T14:00:00-04:00`,
  timezone: 'America/New_York',
  borough: 'Manhattan',
  location: 'City Hall Park',
  latitude: 40.7128,
  longitude: -74.006,
  significance: 'major',
  source: { dataset: 'live-location-gate', source_event_id: 'event-1' },
  nycif: {
    data_layer: 'approved_staged',
    coordinate_status: 'map_ready',
    production_feed: true,
    display_disposition: 'standalone_public_event',
    event_date: day,
    event_type: 'Public Event',
    is_major: true,
    verification_status: 'verified'
  }
};

function payloadFor(url) {
  if (url.includes('/major/events.json') || url.includes('events_discovery_v02_major.json') || url.includes('nycif_major_radar_map_events.json')) {
    return { generated_at_utc: new Date().toISOString(), total: 1, events: [event] };
  }
  if (url.includes('/approved/manifest.json') || url.includes('/review/manifest.json')) {
    return { generated_at_utc: new Date().toISOString(), pages: [] };
  }
  if (url.includes('photographer_assignment_calendar_2mo.json') || url.includes('photographer_viral_recurrence_matches.json')) {
    return [];
  }
  return { generated_at_utc: new Date().toISOString(), total: 0, events: [] };
}

const transparentPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n1cAAAAASUVORK5CYII=',
  'base64'
);

const geolocationMock = `(() => {
  const watchers = new Map();
  let nextId = 1;
  const initial = {
    timestamp: 1000,
    coords: { latitude: 40.7128, longitude: -74.006, accuracy: 20, heading: 0, speed: 1 }
  };
  window.__NYCIF_GEO_TEST__ = {
    clearCalls: [],
    push(latitude, longitude, accuracy = 12, heading = null, speed = 1, timestamp = Date.now()) {
      const position = { timestamp, coords: { latitude, longitude, accuracy, heading, speed } };
      watchers.forEach(entry => entry.success(position));
    },
    fail(code, message = 'mock error') {
      watchers.forEach(entry => entry.error({ code, message }));
    },
    count() { return watchers.size; }
  };
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition(success) { success(initial); },
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
    viewport,
    timezoneId: 'America/New_York',
    reducedMotion: 'reduce',
    serviceWorkers: 'block'
  });
  await context.addInitScript({ content: geolocationMock });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => pageErrors.push(String(error)));
  await page.route(/raw\.githubusercontent\.com|127\.0\.0\.1:4173\/data\//, route => route.fulfill({
    status: 200,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(payloadFor(route.request().url()))
  }));
  await page.route(/tile\.openstreetmap\.org/, route => route.fulfill({
    status: 200,
    contentType: 'image/png',
    body: transparentPng
  }));
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 10_000 });
  await page.locator('#brandCount').filter({ hasText: '1 event' }).waitFor({ timeout: 10_000 });
  await page.waitForFunction(() => Boolean(window.NYCIF_LIVE_LOCATION_CONTROLLER));
  return { context, page, consoleErrors, pageErrors };
}

await fs.mkdir(ARTIFACT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });

try {
  const mobile = await openTestPage(browser, { width: 390, height: 844 });
  const { page, context, consoleErrors, pageErrors } = mobile;
  const locate = page.locator('#locateBtn');
  const stop = page.locator('#liveLocationStopBtn');

  assert(await page.locator('#map').isVisible(), 'Mobile map is not visible');
  assert((await locate.getAttribute('aria-label')) === 'Start live GPS tracking', 'Initial live GPS label is wrong');
  assert((await locate.getAttribute('aria-pressed')) === 'false', 'Initial tracking state is wrong');

  await locate.focus();
  await page.keyboard.press('Enter');
  await stop.waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.getElementById('locateBtn')?.dataset.liveHandoff === 'true');
  assert(await page.evaluate(() => window.__NYCIF_GEO_TEST__.count()) === 1, 'watchPosition did not start exactly once');

  await page.evaluate(() => window.__NYCIF_GEO_TEST__.push(40.7132, -74.0054, 14, 90, 1.4, 3000));
  await page.waitForFunction(() => window.NYCIF_LIVE_LOCATION_CONTROLLER.getState().lastFix?.lat === 40.7132);
  let state = await page.evaluate(() => window.NYCIF_LIVE_LOCATION_CONTROLLER.getState());
  assert(Math.abs(state.markerLatLng.lat - 40.7132) < 0.000001, 'Blue dot latitude did not update');
  assert(Math.abs(state.markerLatLng.lng + 74.0054) < 0.000001, 'Blue dot longitude did not update');
  assert(state.accuracyRadius === 14, 'Accuracy circle did not update');
  assert(state.lastFix.heading === 90, 'Direction heading did not update');
  assert(await page.locator('.nycif-live-location-marker[data-has-heading="true"]').count() === 1, 'Direction indicator is not active');

  const centerBeforePause = await page.evaluate(() => {
    const center = window.NYCIF_MAIN_MAP.getCenter();
    return { lat: center.lat, lng: center.lng };
  });
  await page.evaluate(() => window.NYCIF_MAIN_MAP.fire('dragstart'));
  await page.waitForFunction(() => window.NYCIF_LIVE_LOCATION_CONTROLLER.getState().following === false);
  assert((await locate.getAttribute('aria-label')) === 'Resume following my live location', 'Paused follow state is not exposed');

  await page.evaluate(() => window.__NYCIF_GEO_TEST__.push(40.714, -74.004, 10, null, 1.2, 5000));
  await page.waitForFunction(() => window.NYCIF_LIVE_LOCATION_CONTROLLER.getState().lastFix?.lat === 40.714);
  const centerWhilePaused = await page.evaluate(() => {
    const center = window.NYCIF_MAIN_MAP.getCenter();
    return { lat: center.lat, lng: center.lng };
  });
  assert(Math.abs(centerWhilePaused.lat - centerBeforePause.lat) < 0.000001, 'Paused follow mode moved the map');
  assert(Math.abs(centerWhilePaused.lng - centerBeforePause.lng) < 0.000001, 'Paused follow mode moved the map');

  await locate.click();
  await page.waitForFunction(() => {
    const state = window.NYCIF_LIVE_LOCATION_CONTROLLER.getState();
    const center = window.NYCIF_MAIN_MAP.getCenter();
    return state.following === true
      && Math.abs(center.lat - 40.714) < 0.00001
      && Math.abs(center.lng + 74.004) < 0.00001;
  });

  const controls = await page.locator('.map-controls').boundingBox();
  assert(controls && controls.x >= 0 && controls.x + controls.width <= 390, 'Live GPS controls are clipped on mobile');

  const axe = await new AxeBuilder({ page }).analyze();
  const blocking = axe.violations.filter(item => item.impact === 'critical' || item.impact === 'serious');
  assert(blocking.length === 0, `Blocking axe violations: ${blocking.map(item => item.id).join(', ')}`);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'live-gps-mobile-following.png'), fullPage: false });

  await stop.focus();
  await page.keyboard.press('Enter');
  await stop.waitFor({ state: 'hidden' });
  assert((await locate.getAttribute('aria-pressed')) === 'false', 'Keyboard stop did not expose off state');
  assert(await page.evaluate(() => window.__NYCIF_GEO_TEST__.clearCalls.length) >= 1, 'clearWatch was not called');

  await locate.click();
  await page.evaluate(() => window.__NYCIF_GEO_TEST__.fail(1, 'permission denied'));
  await page.waitForFunction(() => window.NYCIF_LIVE_LOCATION_CONTROLLER.getState().tracking === false);
  assert(/permission was denied/i.test(await page.locator('#status').textContent()), 'Permission denial message is not reader-safe');

  assert(consoleErrors.length === 0, `Mobile console errors: ${consoleErrors.join(' | ')}`);
  assert(pageErrors.length === 0, `Mobile page errors: ${pageErrors.join(' | ')}`);
  await context.close();

  const desktop = await openTestPage(browser, { width: 1440, height: 1000 });
  await desktop.page.locator('#locateBtn').click();
  await desktop.page.waitForFunction(() => document.getElementById('locateBtn')?.dataset.liveHandoff === 'true');
  await desktop.page.evaluate(() => window.__NYCIF_GEO_TEST__.push(40.716, -74.002, 11, 45, 1.5, 3000));
  await desktop.page.waitForFunction(() => window.NYCIF_LIVE_LOCATION_CONTROLLER.getState().lastFix?.lat === 40.716);
  assert(await desktop.page.locator('#liveLocationStopBtn').isVisible(), 'Desktop stop control is not visible');
  assert(await desktop.page.locator('.nycif-live-location-marker').count() === 1, 'Desktop live blue dot is missing');
  await desktop.page.screenshot({ path: path.join(ARTIFACT_DIR, 'live-gps-desktop-following.png'), fullPage: false });
  assert(desktop.consoleErrors.length === 0, `Desktop console errors: ${desktop.consoleErrors.join(' | ')}`);
  assert(desktop.pageErrors.length === 0, `Desktop page errors: ${desktop.pageErrors.join(' | ')}`);
  await desktop.context.close();

  const report = {
    status: 'pass',
    mobile: {
      viewport: '390x844',
      continuousUpdates: true,
      direction: true,
      pauseAndTapRecenter: true,
      keyboardStartStop: true,
      permissionDenied: true,
      axeSeriousCritical: 0
    },
    desktop: { viewport: '1440x1000', continuousUpdates: true }
  };
  await fs.writeFile(path.join(ARTIFACT_DIR, 'live-location-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
