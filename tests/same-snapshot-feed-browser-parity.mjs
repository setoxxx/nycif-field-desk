import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const FIELD_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIVE_ROOT = path.resolve(process.env.NYCIF_LIVE_FEEDS_ROOT || '../nycif-live-feeds');
const BASE_URL = process.env.NYCIF_TEST_URL || 'http://127.0.0.1:4173/index.html?resetFilters=1';
const LIVE_SHA = process.env.NYCIF_LIVE_FEEDS_SHA || 'unknown';
const REPORT = path.join(FIELD_ROOT, 'data', 'reports', 'stage10_same_snapshot_feed_browser_parity.json');
const TIMEOUT = 120_000;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function eventsOf(payload) {
  if (Array.isArray(payload)) return payload.filter(item => item && typeof item === 'object');
  if (!payload || typeof payload !== 'object') return [];
  for (const key of ['events', 'items', 'records']) {
    if (Array.isArray(payload[key])) return payload[key].filter(item => item && typeof item === 'object');
  }
  return [];
}

function nyDateKey() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dayOf(event) {
  const nycif = event.nycif && typeof event.nycif === 'object' ? event.nycif : {};
  return String(nycif.event_date || event.start_date_time || event.start || '').slice(0, 10);
}

function endDayOf(event) {
  return String(event.end_date_time || event.end || dayOf(event)).slice(0, 10) || dayOf(event);
}

function categoryOf(event) {
  return String(event.category || 'general').toLowerCase();
}

function roleOf(event) {
  return String(event.event_role || '').toLowerCase();
}

function sourceVisible(event) {
  const role = roleOf(event);
  if (role === 'maintenance_or_closure') return false;
  if (role === 'public_event') return true;
  return categoryOf(event) === 'media' && (role === 'street_closure' || role === 'supporting_permit');
}

function dateVisible(event, selectedDate) {
  const start = dayOf(event);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return false;
  const end = /^\d{4}-\d{2}-\d{2}$/.test(endDayOf(event)) ? endDayOf(event) : start;
  return start <= selectedDate && selectedDate <= end;
}

function mapReady(event) {
  const nycif = event.nycif && typeof event.nycif === 'object' ? event.nycif : {};
  const lat = Number(event.latitude ?? event.lat);
  const lng = Number(event.longitude ?? event.lng);
  return nycif.coordinate_status === 'map_ready'
    && Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= 40.45 && lat <= 40.95 && lng >= -74.30 && lng <= -73.65;
}

function markerEligible(event) {
  if (!mapReady(event)) return false;
  const role = roleOf(event);
  if (categoryOf(event) === 'media') {
    if (role === 'maintenance_or_closure') return false;
    return role === 'public_event' || role === 'street_closure' || role === 'supporting_permit';
  }
  if (role !== 'public_event') return false;
  if (event.parent_event_id) return false;
  const nycif = event.nycif && typeof event.nycif === 'object' ? event.nycif : {};
  return !nycif.display_disposition || nycif.display_disposition === 'standalone_public_event';
}

function recordLayer(pathname) {
  if (pathname.includes('/approved/pages/')) return 'approved';
  if (pathname.includes('/review/pages/')) return 'review';
  if (pathname.endsWith('/major/events.json') || pathname.endsWith('/events_discovery_v02_major.json') || pathname.endsWith('/nycif_major_radar_map_events.json')) return 'major';
  return null;
}

const requestedFiles = [];
const ingestedById = new Map();
const projectionOrder = [];
let approvedManifest = null;
let reviewManifest = null;

await fs.mkdir(path.dirname(REPORT), { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  timezoneId: 'America/New_York',
  serviceWorkers: 'block',
  reducedMotion: 'reduce'
});
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', error => pageErrors.push(String(error)));

await page.route(/127\.0\.0\.1:4173\/data\//, async route => {
  const url = new URL(route.request().url());
  const relative = decodeURIComponent(url.pathname).replace(/^\//, '');
  const localPath = path.join(LIVE_ROOT, relative);
  requestedFiles.push(relative);
  try {
    const text = await fs.readFile(localPath, 'utf8');
    const payload = JSON.parse(text);
    if (relative.endsWith('/approved/manifest.json')) approvedManifest = payload;
    if (relative.endsWith('/review/manifest.json')) reviewManifest = payload;
    const layer = recordLayer(url.pathname);
    if (layer) {
      for (const event of eventsOf(payload)) {
        const id = String(event.id || '').trim();
        if (!id) throw new Error(`Feed row without canonical id in ${relative}`);
        const projected = structuredClone(event);
        projected.nycif = { ...(projected.nycif || {}) };
        if (layer === 'major') {
          projected.nycif.data_layer = 'approved_staged';
          projected.nycif.is_major = true;
          projected.significance = 'major';
        } else {
          projected.nycif.data_layer = layer === 'review' ? 'review_supplemental' : 'approved_staged';
        }
        ingestedById.set(id, projected);
        projectionOrder.push({ id, layer, file: relative });
      }
    }
    await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: text });
  } catch (error) {
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: String(error) }) });
  }
});

const transparentPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n1cAAAAASUVORK5CYII=', 'base64');
await page.route(/tile\.openstreetmap\.org/, route => route.fulfill({ status: 200, contentType: 'image/png', body: transparentPng }));

let report;
try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
  await page.waitForFunction(() => {
    const summary = window.NYCIF_UNIFIED_VIEWER?.getSummary?.();
    return summary?.feedPhase === 'ok' && summary?.indexComplete === true;
  }, null, { timeout: TIMEOUT });

  await page.evaluate(() => {
    window.NYCIF_MAIN_MAP?.fitBounds([[40.45, -74.30], [40.95, -73.65]], { padding: [0, 0], animate: false });
  });
  await page.waitForTimeout(1600);

  const actual = await page.evaluate(() => window.NYCIF_UNIFIED_VIEWER.getSummary());
  const selectedDate = actual.selectedDate || nyDateKey();
  const finalEvents = [...ingestedById.values()];
  const visibleEvents = finalEvents.filter(event => sourceVisible(event) && dateVisible(event, selectedDate));
  const mapEligibleEvents = visibleEvents.filter(markerEligible);
  const listDomCount = await page.locator('button.event-item').count();
  const listMeta = await page.locator('#listMeta').textContent();
  const expectedListDomCount = Math.min(100, visibleEvents.length);

  const equations = {
    feed_phase_ok: actual.feedPhase === 'ok',
    primary_feed_used: actual.feedSource === 'primary',
    index_complete: actual.indexComplete === true,
    all_approved_pages_loaded: actual.pagesLoaded.approved === actual.pagesTotal.approved,
    all_review_pages_loaded: actual.pagesLoaded.review === actual.pagesTotal.review,
    runtime_total_matches_ingested_unique_ids: actual.total === finalEvents.length,
    current_day_list_count_matches: actual.visible === visibleEvents.length,
    current_day_map_eligible_count_matches: actual.mapEligibleVisible === mapEligibleEvents.length,
    clustered_marker_event_count_matches: actual.markerEvents === mapEligibleEvents.length,
    marker_parity_complete: actual.markerParityComplete === true,
    clustering_enabled: actual.cluster === true,
    list_dom_page_size_matches: listDomCount === expectedListDomCount,
    list_meta_reports_total: String(listMeta || '').replaceAll(',', '').includes(String(visibleEvents.length)),
    approved_manifest_generation_matches_review: approvedManifest?.generated_at_utc === reviewManifest?.generated_at_utc,
    no_page_errors: pageErrors.length === 0,
    no_console_errors: consoleErrors.length === 0
  };
  const qaPass = Object.values(equations).every(Boolean);
  report = {
    artifact_type: 'stage10_same_snapshot_feed_browser_parity',
    schema_version: '1.0.0',
    generated_at_utc: new Date().toISOString(),
    live_feeds_commit_sha: LIVE_SHA,
    field_desk_commit_sha: process.env.GITHUB_SHA || 'unknown',
    snapshot_generated_at_utc: approvedManifest?.generated_at_utc || null,
    selected_date: selectedDate,
    requested_file_count: requestedFiles.length,
    requested_files: [...new Set(requestedFiles)].sort(),
    projection_upsert_count: projectionOrder.length,
    expected: {
      unique_runtime_records: finalEvents.length,
      visible_list_records: visibleEvents.length,
      map_eligible_visible_records: mapEligibleEvents.length,
      first_list_page_records: expectedListDomCount,
      approved_pages: approvedManifest?.pages?.length ?? null,
      review_pages: reviewManifest?.pages?.length ?? null
    },
    actual,
    list_dom_count: listDomCount,
    list_meta: listMeta,
    console_errors: consoleErrors,
    page_errors: pageErrors,
    equations,
    feed_data_modified: false,
    public_surface_modified: false,
    launch_authorized: false,
    qa_pass: qaPass
  };
  await fs.writeFile(REPORT, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  assert(qaPass, `Stage 10 parity equations failed: ${Object.entries(equations).filter(([, value]) => !value).map(([key]) => key).join(', ')}`);
} finally {
  await browser.close();
}
