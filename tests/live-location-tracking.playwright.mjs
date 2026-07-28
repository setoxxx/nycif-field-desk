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
  longitude: -74.0060,
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

function feedPayload(url) {
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
    coords: {
      latitude: 40.7128,
      longitude: -74.0060,
      accuracy: 20,
      altitude: null,
      altitudeAccuracy: null,
      heading: 0,
      speed: 1
    }
  };
  const api = {
    clearCalls: [],
    watchOptions: [],
    push(latitude, longitude, accuracy = 12, heading = null, speed = 1, timestamp = Date.now()) {
      const position = {
        timestamp,
        coords: { latitude, longitude, accuracy, altitude: null, altitudeAccuracy: null, heading, speed }
      };
      watchers.forEach(entry => entry.success(position));
    },
    fail(code, message = 'mock geolocation error') {
      watchers.forEach(entry => entry.error({ code, message }));
    },
    watcherCount() { return watchers.size; }
  };
  const geolocation = {
    getCurrentPosition(success) { success(initial); },
    watchPosition(success, error, options) {
      const id = nextId++;
      watchers.set(id, { success, error, options });
      api.watchOptions.push(options);
      return id;
    },
    clearWatch(id) {
      api.clearCalls.push(id);
      watchers.delete(id);
    }
  };
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    enumerable: true,
    value: geolocation
  });
  window.__NYCIF_GEO_TEST__ = api;
})();`;

async function preparePage(browser, viewport) {
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

  await page.route(/raw\.githubusercontent\.com|127\.0\.0\.1:4173\/data\//, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(feedPayload(route.request().url()))
    });
  });
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
  const mobile = await preparePage(browser, { width: 390, height: 844 });
  const { page, context, consoleErrors, pageErrors } = mobile;

  assert(await page.locator('#map').isVisible(), 'Mobile map is not visible');
  const locate = page.locator('#locateBtn');
  assert((await locate.getAttribute('aria-label')) === 'Start live GPS tracking', 'Location control did not initialize with a live-GPS label');
  assert((await locate.getAttribute('aria-pressed')) === 'false', 'Location control did not initialize as off');

  await locate.focus();
  await page.keyboard.press('Enter');
  const stop = page.locator('#liveLocationStopBtn');
  await stop.waitFor({ state: 'visible' });
  assert((await locate.getAttribute('aria-pressed')) === 'true', 'Keyboard activation did not start tracking');
  assert(await page.evaluate(() => window.__NYCIF_GEO_TEST__.watcherCount()) === 1, 'watchPosition was not started exactly once');

  await page.evaluate(() => window.__NYCIF_GEO_TEST__.push(40.7132, -74.0054, 14, 90, 1.4, 3000));
  await page.waitForFunction(() => {
    const state = window.NYCIF_LIVE_LOCATION_CONTROLLER.getState();
    return state.lastFix?.lat === 40.7132 && state.lastFix?.lng === -74.0054;
  });
  let state = await page.evaluate(() => window.NYCIF_LIVE_LOCATION_CONTROLLER.getState());
  assert(Math.abs(state.markerLatLng.lat - 40.7132) < 0.000001, 'Blue dot latitude did not update');
  assert(Math.abs(state.markerLatLng.lng + 74.0054) < 0.000001, 'Blue dot longitude did not update');
  assert(state.accuracyRadius === 14, 'Accuracy circle did not update');
  assert(state.lastFix.heading === 90, 'Reliable device heading was not retained');

  const headingState = await page.locator('.nycif-live-location-marker').evaluate(element => ({
    hasHeading: element.dataset.hasHeading,
    tracking: element.dataset.liveTracking
  }));
  assert(headingState.hasHeading === 'true', 'Direction indicator was not enabled');
  assert(headingState.tracking === 'true', 'Blue dot was not marked as live');

  const centerBeforePause = await page.evaluate(() => {
    const center = window.NYCIF_MAIN_MAP.getCenter();
    return { lat: center.lat, lng: center.lng };
  });
  await page.evaluate(() => window.NYCIF_MAIN_MAP.fire('dragstart'));
  await page.waitForFunction(() => window.NYCIF_LIVE_LOCATION_CONTROLLER.getState().following === false);
  assert((await locate.getAttribute('aria-label')) === 'Resume following my live location', 'Manual pan did not expose paused follow state');

  await page.evaluate(() => window.__NYCIF_GEO_TEST__.push(40.7140, -74.0040, 10, null, 1.2, 5000));
  await page.waitForFunction(() => window.NYCIF_LIVE_LOCATION_CONTROLLER.getState().lastFix?.lat === 40.7140);
  const centerWhilePaused = await page.evaluate(() => {
    const center = window.NYCIF_MAIN_MAP.getCenter();
    return { lat: center.lat, lng: center.lng };
  });
  assert(Math.abs(centerWhilePaused.lat - centerBeforePause.lat) < 0.000001, 'Map moved while follow mode was paused');
  assert(Math.abs(centerWhilePaused.lng - centerBeforePause.lng) < 0.000001, 'Map moved while follow mode was paused');

  await locate.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.NYCIF_LIVE_LOCATION_CONTROLLER.getState().following === true);
  const centerAfterResume = await page.evaluate(() => {
    const center = window.NYCIF_MAIN_MAP.getCenter();
    return { lat: center.lat, lng: center.lng };
  });
  assert(Math.abs(centerAfterResume.lat - 40.7140) < 0.00001, 'Recenter did not use the latest live latitude');
  assert(Math.abs(centerAfterResume.lng + 74.0040) < 0.00001, 'Recenter did not use the latest live longitude');

  const controlsBox = await page.locator('.map-controls').boundingBox();
  assert(controlsBox && controlsBox.x >= 0 && controlsBox.x + controlsBox.width <= 390, 'Live GPS controls are clipped on mobile');

  const axe = await new AxeBuilder({ page }).analyze();
  const blocking = axe.violations.filter(item => item.impact === 'critical' || item.impact === 'serious');
  assert(blocking.length === 0, `Live GPS UI has blocking axe violations: ${blocking.map(item => item.id).join(', ')}`);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'live-gps-mobile-following.png'), fullPage: false });

  await stop.focus();
  await page.keyboard.press('Enter');
  await stop.waitFor({ state: 'hidden' });
  state = await page.evaluate(() => window.NYCIF_LIVE_LOCATION_CONTROLLER.getState());
  assert(state.tracking === false, 'Keyboard stop did not disable tracking');
  assert((await locate.getAttribute('aria-pressed')) === 'false', 'Location control did not return to off state');
  assert(await page.evaluate(() => window.__NYCIF_GEO_TEST__.clearCalls.length) >= 1, 'clearWatch was not called');

  await locate.click();
  await page.evaluate(() => window.__NYCIF_GEO_TEST__.fail(1, 'permission denied'));
  await page.waitForFunction(() => window.NYCIF_LIVE_LOCATION_CONTROLLER.getState().tracking === false);
  assert(await page.locator('#status').textContent().then(text => /permission was denied/i.test(text)), 'Permission denial message was not reader-safe');

  assert(consoleErrors.length === 0, `Mobile console errors: ${consoleErrors.join(' | ')}`);
  assert(pageErrors.length === 0, `Mobile page errors: ${pageErrors.join(' | ')}`);
  await context.close();

  const desktop = await preparePage(browser, { width: 1440, height: 1000 });
  await desktop.page.locator('#locateBtn').click();
  await desktop.page.evaluate(() => window.__NYCIF_GEO_TEST__.push(40.7160, -74.0020, 11, 45, 1.5, 3000));
  await desktop.page.waitForFunction(() => window.NYCIF_LIVE_LOCATION_CONTROLLER.getState().lastFix?.lat === 40.7160);
  assert(await desktop.page.locator('#liveLocationStopBtn').isVisible(), 'Desktop tracking stop control is not visible');
  assert(await desktop.page.locator('.nycif-live-location-marker').count() === 1, 'Desktop should show one live location marker');
  await desktop.page.screenshot({ path: path.join(ARTIFACT_DIR, 'live-gps-desktop-following.png'), fullPage: false });
  assert(desktop.consoleErrors.length === 0, `Desktop console errors: ${desktop.consoleErrors.join(' | ')}`);
  assert(desktop.pageErrors.length === 0, `Desktop page errors: ${desktop.pageErrors.join(' | ')}`);
  await desktop.context.close();

  const report = {
    status: 'pass',
    mobile: {
      viewport: '390x844',
      continuousUpdates: true,
      heading: true,
      followPauseResume: true,
      keyboardStartStop: true,
      permissionDenied: true,
      axeSeriousCritical: 0
    },
    desktop: {
      viewport: '1440x1000',
      continuousUpdates: true,
      controlVisible: true
    }
  };
  await fs.writeFile(path.join(ARTIFACT_DIR, 'live-location-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
