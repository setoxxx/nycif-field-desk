import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = process.env.NYCIF_TEST_URL || 'http://127.0.0.1:4173/index.html?resetFilters=1';
const ARTIFACT_DIR = process.env.NYCIF_ARTIFACT_DIR || 'artifacts';
const INIT_BUDGET_MS = 10_000;
const INTERACTION_BUDGET_MS = 1_500;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nyDateKey() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

const day = nyDateKey();
const event = {
  id: `desktop-gate-event@${day}`,
  title: 'Desktop Keyboard Release Gate Event',
  category: 'civic',
  start_date_time: `${day}T12:00:00-04:00`,
  end_date_time: `${day}T14:00:00-04:00`,
  timezone: 'America/New_York',
  borough: 'Manhattan',
  location: 'City Hall Park',
  latitude: 40.7128,
  longitude: -74.0060,
  significance: 'major',
  source: {
    dataset: 'desktop-release-gate',
    source_event_id: 'event-1'
  },
  nycif: {
    data_layer: 'approved_staged',
    coordinate_status: 'map_ready',
    production_feed: true,
    display_disposition: 'standalone_public_event',
    event_date: day,
    event_type: 'Rally-Demonstration',
    is_major: true,
    photo_pick: true,
    verification_status: 'verified'
  }
};

const transparentPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n1cAAAAASUVORK5CYII=',
  'base64'
);

await fs.mkdir(ARTIFACT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  timezoneId: 'America/New_York',
  reducedMotion: 'reduce'
});
const page = await context.newPage();

const consoleErrors = [];
const pageErrors = [];
page.on('console', message => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', error => pageErrors.push(String(error)));

await page.route(/raw\.githubusercontent\.com/, async route => {
  const url = route.request().url();
  let body;
  if (url.includes('/data/schema-v1/major/events.json') || url.includes('events_discovery_v02_major.json') || url.includes('nycif_major_radar_map_events.json')) {
    body = { generated_at_utc: new Date().toISOString(), total: 1, events: [event] };
  } else if (url.includes('/approved/manifest.json') || url.includes('/review/manifest.json')) {
    body = { generated_at_utc: new Date().toISOString(), pages: [] };
  } else if (url.includes('photographer_assignment_calendar_2mo.json') || url.includes('photographer_viral_recurrence_matches.json')) {
    body = [];
  } else {
    body = { generated_at_utc: new Date().toISOString(), total: 0, events: [] };
  }
  await route.fulfill({
    status: 200,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(body)
  });
});

await page.route(/tile\.openstreetmap\.org/, route => route.fulfill({
  status: 200,
  contentType: 'image/png',
  body: transparentPng
}));

const startedAt = Date.now();
await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: INIT_BUDGET_MS });
await page.locator('#brandCount').filter({ hasText: '1 event' }).waitFor({ timeout: INIT_BUDGET_MS });
const initializedMs = Date.now() - startedAt;
assert(initializedMs <= INIT_BUDGET_MS, `Initialization exceeded ${INIT_BUDGET_MS}ms: ${initializedMs}ms`);
assert((await page.title()) === 'NYC In Focus · NYC Event Map', 'Unexpected page title');
assert(await page.locator('#map').isVisible(), 'Map region is not visible');
assert(await page.locator('.leaflet-marker-icon').count() === 1, 'Expected one rendered event marker');

const selectedDate = page.locator('#dateChips button[aria-current="date"]');
assert(await selectedDate.count() === 1, 'Selected date is missing aria-current=date');
assert((await selectedDate.getAttribute('aria-pressed')) === 'true', 'Selected date is missing aria-pressed=true');

let interactionStartedAt = Date.now();
await page.locator('#layersBtn').focus();
await page.keyboard.press('Enter');
await page.locator('#layersPanel').waitFor({ state: 'visible' });
assert((await page.locator('#layersBtn').getAttribute('aria-expanded')) === 'true', 'Filters did not expose expanded state');
await page.keyboard.press('Escape');
await page.locator('#layersPanel').waitFor({ state: 'hidden' });
assert(await page.evaluate(() => document.activeElement?.id === 'layersBtn'), 'Filter Escape did not restore focus');
assert(Date.now() - interactionStartedAt <= INTERACTION_BUDGET_MS, 'Filter keyboard interaction exceeded budget');

interactionStartedAt = Date.now();
await page.locator('#deskBtn').focus();
await page.keyboard.press('Enter');
await page.locator('#deskDrawer').waitFor({ state: 'visible' });
assert(await page.evaluate(() => document.activeElement?.id === 'searchInput'), 'Event List did not move focus to search');
await page.keyboard.type('Desktop Keyboard');
await page.locator('button.event-item').waitFor({ state: 'visible' });
await page.locator('button.event-item').focus();
await page.keyboard.press('Enter');
await page.locator('#deskDrawer').waitFor({ state: 'hidden' });
const dialog = page.locator('.leaflet-popup-content[role="dialog"]');
await dialog.waitFor({ state: 'visible', timeout: 3_000 });
assert(await dialog.evaluate(node => document.activeElement === node), 'Popup dialog did not receive focus');
assert(await dialog.getAttribute('aria-labelledby'), 'Popup dialog is missing aria-labelledby');
await page.keyboard.press('Escape');
await dialog.waitFor({ state: 'detached' });
assert(await page.evaluate(() => document.activeElement?.id === 'deskBtn'), 'Event List popup close did not restore focus to visible Event List button');
assert(Date.now() - interactionStartedAt <= 4_000, 'Event List to popup keyboard path exceeded budget');

const marker = page.locator('.leaflet-marker-icon').first();
await marker.focus();
assert((await marker.getAttribute('role')) === 'button', 'Marker is missing button role');
assert((await marker.getAttribute('aria-haspopup')) === 'dialog', 'Marker is missing aria-haspopup=dialog');
await page.keyboard.press('Space');
await page.locator('.leaflet-popup-content[role="dialog"]').waitFor({ state: 'visible' });
await page.keyboard.press('Escape');
await page.locator('.leaflet-popup-content[role="dialog"]').waitFor({ state: 'detached' });
assert(await marker.evaluate(node => document.activeElement === node), 'Marker popup close did not restore focus to marker');

await page.locator('#deskBtn').focus();
await page.keyboard.press('Enter');
await page.locator('#searchInput').fill('Desktop Keyboard');
await page.waitForTimeout(350);
const liveLabel = await page.locator('#listMeta').getAttribute('aria-label');
assert(liveLabel?.startsWith('Event results:'), 'Event result changes are not exposed through the live-region label');
await page.keyboard.press('Escape');

const reducedMotion = await page.evaluate(() => ({
  htmlClass: document.documentElement.classList.contains('reduce-motion'),
  zoomAnimation: window.NYCIF_MAIN_MAP?.options?.zoomAnimation,
  fadeAnimation: window.NYCIF_MAIN_MAP?.options?.fadeAnimation,
  markerZoomAnimation: window.NYCIF_MAIN_MAP?.options?.markerZoomAnimation
}));
assert(reducedMotion.htmlClass, 'Reduced-motion class was not applied');
assert(reducedMotion.zoomAnimation === false, 'Map zoom animation remains enabled under reduced motion');
assert(reducedMotion.fadeAnimation === false, 'Map fade animation remains enabled under reduced motion');
assert(reducedMotion.markerZoomAnimation === false, 'Marker zoom animation remains enabled under reduced motion');

const axe = await new AxeBuilder({ page }).analyze();
const blockingViolations = axe.violations.filter(item => item.impact === 'critical' || item.impact === 'serious');
assert(blockingViolations.length === 0, `Axe found blocking violations: ${blockingViolations.map(item => item.id).join(', ')}`);

const relevantConsoleErrors = consoleErrors.filter(text => !/favicon|tile/i.test(text));
assert(pageErrors.length === 0, `Page errors detected: ${pageErrors.join(' | ')}`);
assert(relevantConsoleErrors.length === 0, `Console errors detected: ${relevantConsoleErrors.join(' | ')}`);

await page.screenshot({ path: path.join(ARTIFACT_DIR, 'desktop-release-gates.png'), fullPage: false });
const result = {
  status: 'pass',
  url: BASE_URL,
  viewport: { width: 1440, height: 1000 },
  initializedMs,
  interactionBudgetMs: INTERACTION_BUDGET_MS,
  axe: {
    violations: axe.violations.length,
    seriousOrCritical: blockingViolations.length
  },
  reducedMotion,
  consoleErrors: relevantConsoleErrors,
  pageErrors
};
await fs.writeFile(path.join(ARTIFACT_DIR, 'desktop-release-gates.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));

await browser.close();
