import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = process.env.NYCIF_TEST_URL || 'http://127.0.0.1:4173/index.html?resetFilters=1';
const REPORT = 'data/reports/stage11_public_display_field_audit.json';
const categories = ['sports', 'fitness', 'parks', 'arts', 'market', 'civic', 'media', 'government', 'education', 'family', 'services', 'environment', 'volunteer', 'jobs', 'housing', 'general', 'tours'];
const boroughs = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];

function assert(condition, message) { if (!condition) throw new Error(message); }
function dateKey(date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function offsetKey(amount) { const date = new Date(); date.setDate(date.getDate() + amount); return dateKey(date); }

const today = offsetKey(0);
const yesterday = offsetKey(-1);
const tomorrow = offsetKey(1);
const events = categories.map((category, index) => {
  const id = `stage11-${category}@${today}`;
  const isListOnly = category === 'tours';
  const missingTime = category === 'general';
  const multiDay = category === 'arts';
  const free = category === 'civic';
  const startDay = multiDay ? yesterday : today;
  return {
    id,
    title: `Stage 11 ${category} display event`,
    category,
    event_role: 'public_event',
    start_date_time: missingTime ? today : `${startDay}T12:00:00-04:00`,
    end_date_time: missingTime ? null : `${multiDay ? tomorrow : today}T14:00:00-04:00`,
    timezone: 'America/New_York',
    borough: boroughs[index % boroughs.length],
    location: `Stage 11 ${category} location`,
    latitude: isListOnly ? null : 40.66 + index * 0.005,
    longitude: isListOnly ? null : -74.08 + index * 0.015,
    cost: free ? null : '$10 suggested',
    is_free: free,
    official_url: category === 'sports' ? 'javascript:alert(1)' : `https://example.com/events/${category}`,
    source: {
      dataset: `synthetic-${category}-source`,
      source_event_id: category,
      url: category === 'sports' ? 'javascript:alert(1)' : `https://example.com/events/${category}`
    },
    internal_notes: 'DO NOT EXPOSE INTERNAL STAGE 11 NOTE',
    interests: [category],
    tags: [`${category} tag`],
    nycif: {
      data_layer: 'approved_staged',
      coordinate_status: isListOnly ? 'list_only' : 'map_ready',
      production_feed: true,
      display_disposition: 'standalone_public_event',
      event_date: startDay,
      event_type: `Synthetic ${category} event`,
      verification_status: 'verified',
      is_free: free
    }
  };
});
events.push({
  ...events[0], id: `stage11-maintenance@${today}`, title: 'Hidden maintenance record', event_role: 'maintenance_or_closure'
});
events.push({
  ...events[1], id: `stage11-private@${today}`, title: 'Hidden private record', event_role: 'private_or_reserved_activity'
});

function payloadFor(url) {
  if (url.includes('/major/events.json') || url.includes('events_discovery_v02_major.json') || url.includes('nycif_major_radar_map_events.json')) {
    return { generated_at_utc: new Date().toISOString(), total: events.length, events };
  }
  if (url.includes('/approved/manifest.json') || url.includes('/review/manifest.json')) {
    return { generated_at_utc: new Date().toISOString(), total: 0, pages: [] };
  }
  if (url.includes('photographer_assignment_calendar_2mo.json') || url.includes('photographer_viral_recurrence_matches.json')) return [];
  if (url.includes('community-help')) return { links: [] };
  return { generated_at_utc: new Date().toISOString(), total: 0, events: [] };
}

await fs.mkdir(path.dirname(REPORT), { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/New_York', serviceWorkers: 'block' });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(String(error)));
await page.route(/raw\.githubusercontent\.com|127\.0\.0\.1:4173\/data\//, async route => {
  await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(payloadFor(route.request().url())) });
});
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n1cAAAAASUVORK5CYII=', 'base64');
await page.route(/tile\.openstreetmap\.org/, route => route.fulfill({ status: 200, contentType: 'image/png', body: png }));

const equations = {};
try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.locator('#brandCount').filter({ hasText: `${categories.length} events` }).waitFor({ timeout: 30_000 });
  await page.locator('#deskBtn').click();
  await page.locator('#deskDrawer').waitFor({ state: 'visible' });

  equations.nonpublic_roles_hidden = await page.locator('text=Hidden maintenance record').count() === 0
    && await page.locator('text=Hidden private record').count() === 0;
  equations.all_implemented_categories_listed = await page.locator('button.event-item').count() === categories.length;
  const listText = await page.locator('#eventList').innerText();
  equations.all_boroughs_represented = boroughs.every(borough => listText.includes(borough));
  equations.internal_notes_suppressed = !(await page.locator('body').innerText()).includes('DO NOT EXPOSE INTERNAL STAGE 11 NOTE');

  const civic = page.locator(`[data-id="stage11-civic@${today}"]`);
  const civicText = await civic.innerText();
  equations.list_shows_time = civicText.includes('12:00 PM') && civicText.includes('2:00 PM');
  equations.list_shows_free_and_verified = civicText.includes('Free') && civicText.includes('Verified');
  await civic.click();
  const popup = page.locator('.leaflet-popup-content[role="dialog"]');
  await popup.waitFor({ state: 'visible' });
  const popupText = await popup.innerText();
  equations.popup_core_fields = ['Date', 'Time', 'Type', 'Borough', 'Location', 'Cost', 'Verification', 'Source'].every(label => popupText.includes(label));
  equations.popup_values = popupText.includes('Synthetic civic event')
    && popupText.includes('Free') && popupText.includes('Verified')
    && popupText.includes('Synthetic Civic Source');
  equations.source_link_safe = await popup.locator('a[href="https://example.com/events/civic"]').count() === 1;
  equations.directions_available_for_map_ready = popupText.includes('Apple Maps') && popupText.includes('Google Maps');
  await page.keyboard.press('Escape');

  await page.locator('#deskBtn').click();
  await page.locator('#searchInput').fill('Stage 11 tours');
  await page.waitForTimeout(250);
  const tours = page.locator(`[data-id="stage11-tours@${today}"]`);
  const toursText = await tours.innerText();
  equations.list_only_explained = toursText.includes('Location being confirmed') && !toursText.includes('Directions');

  await page.locator('#searchInput').fill('Stage 11 general');
  await page.waitForTimeout(250);
  const general = page.locator(`[data-id="stage11-general@${today}"]`);
  equations.missing_time_explained = (await general.innerText()).includes('Time not listed');

  await page.locator('#searchInput').fill('Stage 11 arts');
  await page.waitForTimeout(250);
  equations.multi_day_labeled = (await page.locator(`[data-id="stage11-arts@${today}"]`).innerText()).includes('Multi-day');

  await page.locator('#searchInput').fill('Stage 11 sports');
  await page.waitForTimeout(250);
  await page.locator(`[data-id="stage11-sports@${today}"]`).click();
  await popup.waitFor({ state: 'visible' });
  equations.unsafe_source_url_rejected = await popup.locator('a[href^="javascript:"]').count() === 0
    && (await popup.innerText()).includes('Synthetic Sports Source');
  equations.no_page_errors = pageErrors.length === 0;

  const qaPass = Object.values(equations).every(Boolean);
  const report = {
    artifact_type: 'stage11_public_display_field_audit', schema_version: '1.0.0',
    generated_at_utc: new Date().toISOString(), fixture_date: today,
    implemented_category_count: categories.length, borough_count: boroughs.length,
    display_policy: {
      cost: 'display only when supplied; otherwise omit',
      source: 'show dataset label; link only an absolute safe public URL',
      verification: 'show public verification status when supplied',
      internal_fields: 'never render'
    },
    equations, page_errors: pageErrors, public_surface_scope: 'list cards and event popups only',
    navigation_changed: false, launch_authorized: false, qa_pass: qaPass
  };
  await fs.writeFile(REPORT, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  assert(qaPass, `Stage 11 display equations failed: ${Object.entries(equations).filter(([, value]) => !value).map(([key]) => key).join(', ')}`);
} finally {
  await browser.close();
}
