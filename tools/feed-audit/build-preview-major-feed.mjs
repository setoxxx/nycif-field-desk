#!/usr/bin/env node
/**
 * C4 preview major-feed builder.
 * Preview outputs only. Does not modify production feeds, public UI, or location cache.
 */
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const PROTOTYPE_MAPPED_PATH = path.join(ROOT, 'data/prototype_major_events.json');
const PROTOTYPE_REVIEW_PATH = path.join(ROOT, 'data/prototype_major_events_needs_review.json');
const PROTOTYPE_REPORT_PATH = path.join(ROOT, 'data/reports/prototype_major_events_report.json');
const APPROVED_GEOCODES_PATH = path.join(ROOT, 'data/approved_major_event_geocodes.json');

const PREVIEW_MAJOR_PATH = path.join(ROOT, 'data/preview_major_feed.json');
const PREVIEW_ALL_PATH = path.join(ROOT, 'data/preview_all_feed.json');
const PREVIEW_STAGED_PATH = path.join(ROOT, 'data/preview_staged_feed.json');
const PREVIEW_REVIEW_PATH = path.join(ROOT, 'data/preview_major_feed_needs_review.json');
const PREVIEW_REPORT_PATH = path.join(ROOT, 'data/reports/preview_major_feed_report.json');

const PRODUCTION_MAJOR_URL = 'https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/nycif_major_radar_map_events.json';
const PRODUCTION_ALL_URL = 'https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/nycif_all_radar_map_events.json';

const PROTOTYPE_REVIEW_URL = 'https://setoxxx.github.io/nycif-field-desk/prototype-major-events-review.html?v=c2b-01';
const JULY_4_DATE = '2026-07-04';
const NYC_BOUNDS = { latMin: 40.4774, latMax: 40.9176, lngMin: -74.2591, lngMax: -73.7004 };

const HEADLINE_JULY4_RE = /\bfireworks\b|\bparade\b|\bindependence day\b|\bnathan'?s?\b|\bblock party\b|\bhuck finn\b|\bholiday\b|\bjuly 4\b|\bjuly 4th\b/i;
const MANUAL_SOURCE_FILE_RE = /manual|hardwrite|hard-write|field[-_ ]intel|nypd/i;

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'NYCIF-preview-major-feed-builder/1.0' },
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
  const text = await response.text();
  if (!text.trim()) return [];
  return JSON.parse(text);
}

function normalizeFeedArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.events)) return payload.events;
  return [];
}

function isManualRecord(row) {
  if (!row || typeof row !== 'object') return false;
  if (row.verification_status === 'nypd_field_intel') return true;
  if (row._manual_priority) return true;
  if (/^nypd-hardwrite-/i.test(String(row.id || ''))) return true;
  if (MANUAL_SOURCE_FILE_RE.test(String(row.source_file || ''))) return true;
  return false;
}

function inNycBounds(lat, lng) {
  return lat >= NYC_BOUNDS.latMin && lat <= NYC_BOUNDS.latMax
    && lng >= NYC_BOUNDS.lngMin && lng <= NYC_BOUNDS.lngMax;
}

function hasValidCoordinates(row) {
  const lat = Number(row?.lat);
  const lng = Number(row?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && inNycBounds(lat, lng);
}

function isHeadlineJuly4(row) {
  const text = [
    row.title,
    row.event_type,
    row.event_agency,
    row.location,
    row.display_location,
    row.major_reason
  ].filter(Boolean).join(' ');
  return HEADLINE_JULY4_RE.test(String(text || ''))
    || (String(row.date || '').slice(0, 10) === JULY_4_DATE && HEADLINE_JULY4_RE.test(text));
}

async function loadApprovedGeocodes() {
  try {
    await access(APPROVED_GEOCODES_PATH);
  } catch {
    return new Map();
  }
  const raw = await readFile(APPROVED_GEOCODES_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  const rows = Array.isArray(parsed) ? parsed : (parsed.approved || parsed.rows || []);
  const map = new Map();
  for (const row of rows) {
    const id = String(row.source_record_id || '').trim();
    if (!id) continue;
    map.set(id, row);
  }
  return map;
}

function applyGeocodeOverride(row, overrides) {
  const override = overrides.get(String(row.source_record_id || '').trim());
  if (!override) return row;
  const lat = Number(override.lat);
  const lng = Number(override.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return row;
  return {
    ...row,
    lat,
    lng,
    display_location: override.display_location || row.display_location || row.location,
    geocode_source: override.geocode_source || 'approved_override',
    missing_geocode: false
  };
}

function prototypeToMajorFeedRow(row) {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    start_date_time: row.start_date_time || null,
    end_date_time: row.end_date_time || null,
    borough: row.borough || null,
    location: row.location || null,
    display_location: row.display_location || row.location || null,
    lat: row.lat,
    lng: row.lng,
    photo_pick: Boolean(row.photo_pick),
    priority_score: row.major_score ?? null,
    verification_status: row.verification_status || 'source_listed',
    source_name: row.source_name || null,
    source_url: row.source_url || null,
    source_record_id: row.source_record_id || null,
    event_agency: row.event_agency || null,
    event_type: row.event_type || null,
    street_closure_type: row.street_closure_type || null,
    major_score: row.major_score ?? null,
    major_reason: row.major_reason || null,
    major_reason_tags: row.major_reason_tags || [],
    expected_crowd_signal: row.expected_crowd_signal || 'source_listed_public_event',
    safety_note: row.safety_note || null,
    assignment_feed: 'major',
    preview_feed: true,
    preview_phase: 'C4',
    geocode_source: row.geocode_source || null
  };
}

function prototypeToStagedRow(row) {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    start_date_time: row.start_date_time || null,
    end_date_time: row.end_date_time || null,
    borough: row.borough || null,
    location: row.location || null,
    display_location: row.display_location || row.location || null,
    lat: row.lat,
    lng: row.lng,
    event_agency: row.event_agency || null,
    event_type: row.event_type || null,
    source_record_id: row.source_record_id || null,
    major_score: row.major_score ?? null,
    major_reason: row.major_reason || null,
    verification_status: row.verification_status || 'source_listed',
    preview_feed: true,
    preview_phase: 'C4',
    staged_preview: true,
    production_ready: false
  };
}

function manualToStagedRow(row) {
  return {
    ...row,
    preview_feed: true,
    preview_phase: 'C4',
    staged_preview: true,
    preview_preserved_manual: true,
    production_ready: false
  };
}

function mergeById(primaryRows, additionalRows, { preservePrimary = true } = {}) {
  const byId = new Map();
  const bySourceRecordId = new Map();

  for (const row of primaryRows) {
    if (row?.id) byId.set(String(row.id), row);
    if (row?.source_record_id) bySourceRecordId.set(String(row.source_record_id), row);
  }

  for (const row of additionalRows) {
    const id = String(row?.id || '');
    const sourceRecordId = String(row?.source_record_id || '');

    if (id && byId.has(id)) {
      if (preservePrimary) continue;
    }
    if (sourceRecordId && bySourceRecordId.has(sourceRecordId)) continue;

    if (id) byId.set(id, row);
    if (sourceRecordId) bySourceRecordId.set(sourceRecordId, row);
  }

  return [...byId.values()];
}

function countByReason(rows, key = 'review_reasons') {
  const counts = {};
  for (const row of rows) {
    const reasons = row[key] || row.rejection_reasons || ['unknown'];
    for (const reason of reasons) {
      counts[reason] = (counts[reason] || 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
}

function buildJuly4Coverage(headlineRows, majorRows, reviewRows) {
  const majorIds = new Set(majorRows.map(row => String(row.source_record_id || '')));
  const reviewIds = new Set(reviewRows.map(row => String(row.source_record_id || '')));

  return headlineRows.map(row => {
    const sourceRecordId = String(row.source_record_id || '');
    let previewDisposition = 'missing_from_preview';
    if (majorIds.has(sourceRecordId)) previewDisposition = 'preview_major';
    else if (reviewIds.has(sourceRecordId)) previewDisposition = 'preview_needs_review';

    return {
      source_record_id: sourceRecordId,
      title: row.title,
      date: row.date,
      prototype_disposition: row.disposition,
      preview_disposition: previewDisposition,
      major_score: row.major_score,
      review_reasons: row.review_reasons || []
    };
  });
}

async function main() {
  const generatedAt = new Date().toISOString();

  const [prototypeMappedRaw, prototypeReviewRaw, prototypeReportRaw, productionMajorRaw, productionAllRaw, geocodeOverrides] = await Promise.all([
    readFile(PROTOTYPE_MAPPED_PATH, 'utf8'),
    readFile(PROTOTYPE_REVIEW_PATH, 'utf8'),
    readFile(PROTOTYPE_REPORT_PATH, 'utf8'),
    fetchJson(PRODUCTION_MAJOR_URL),
    fetchJson(PRODUCTION_ALL_URL),
    loadApprovedGeocodes()
  ]);

  const prototypeMapped = JSON.parse(prototypeMappedRaw);
  const prototypeReview = JSON.parse(prototypeReviewRaw);
  const prototypeReport = JSON.parse(prototypeReportRaw);
  const productionMajor = normalizeFeedArray(productionMajorRaw);
  const productionAll = normalizeFeedArray(productionAllRaw);

  const manualMajorRecords = productionMajor.filter(isManualRecord);
  const manualAllRecords = productionAll.filter(isManualRecord);

  const mappedWithOverrides = prototypeMapped.map(row => applyGeocodeOverride(row, geocodeOverrides));
  const reviewWithOverrides = prototypeReview.map(row => applyGeocodeOverride(row, geocodeOverrides));

  const promotableMapped = mappedWithOverrides.filter(hasValidCoordinates).map(prototypeToMajorFeedRow);
  const blockedMappedCandidates = mappedWithOverrides
    .filter(row => !hasValidCoordinates(row))
    .map(row => ({
      ...row,
      review_status: 'needs_review',
      review_reasons: [...new Set([...(row.review_reasons || []), 'missing_geocode'])]
    }));

  const previewNeedsReview = [...reviewWithOverrides, ...blockedMappedCandidates]
    .sort((a, b) => (b.major_score || 0) - (a.major_score || 0) || String(a.start_date_time).localeCompare(String(b.start_date_time)));

  const previewMajor = mergeById(
    manualMajorRecords,
    promotableMapped,
    { preservePrimary: true }
  ).sort((a, b) => (b.priority_score || b.major_score || 0) - (a.priority_score || a.major_score || 0)
    || String(a.start_date_time || a.date).localeCompare(String(b.start_date_time || b.date)));

  const nonRejectedCandidates = [...mappedWithOverrides, ...reviewWithOverrides];
  const allFeedGeocodedCandidates = nonRejectedCandidates
    .filter(hasValidCoordinates)
    .map(prototypeToMajorFeedRow);
  const allFeedExcludedNoGeocode = nonRejectedCandidates.filter(row => !hasValidCoordinates(row)).length;

  const previewAll = mergeById(
    mergeById(manualMajorRecords, manualAllRecords, { preservePrimary: true }),
    allFeedGeocodedCandidates,
    { preservePrimary: true }
  );

  const stagedEvents = mergeById(
    manualMajorRecords.map(manualToStagedRow),
    promotableMapped.map(prototypeToStagedRow),
    { preservePrimary: true }
  );

  const previewStaged = {
    events: stagedEvents,
    generated_at_utc: generatedAt,
    preview_feed: true,
    preview_phase: 'C4',
    production_feed: false,
    production_ready: false,
    staged_feed: true,
    source: 'build-preview-major-feed.mjs'
  };

  const headlineCoverageSource = prototypeReport.headline_july_4_coverage || [];
  const july4Coverage = buildJuly4Coverage(headlineCoverageSource, previewMajor, previewNeedsReview);
  const headlineInPreviewOrReview = headlineCoverageSource.length === 0
    ? true
    : headlineCoverageSource.every(row => {
      const id = String(row.source_record_id || '');
      return previewMajor.some(item => String(item.source_record_id || '') === id)
        || previewNeedsReview.some(item => String(item.source_record_id || '') === id);
    });

  const droppedRowsByReason = Object.fromEntries(
    (prototypeReport.top_rejection_reasons || []).map(item => [item.reason, item.count])
  );

  const report = {
    phase: 'C4',
    mode: 'preview_only',
    generated_at: generatedAt,
    production_feeds_modified: false,
    public_ui_modified: false,
    wordpress_modified: false,
    prototype_review_url: PROTOTYPE_REVIEW_URL,
    source_rows: prototypeReport.source_rows,
    prototype_mapped_rows: prototypeMapped.length,
    prototype_needs_review_rows: prototypeReview.length,
    preview_major_feed_rows: previewMajor.length,
    preview_all_feed_rows: previewAll.length,
    preview_staged_rows: stagedEvents.length,
    preview_needs_review_rows: previewNeedsReview.length,
    preserved_manual_records: manualMajorRecords.length,
    manual_records_removed: 0,
    dropped_rows_count: prototypeReport.rejected_rows,
    dropped_rows_by_reason: droppedRowsByReason,
    july_4_coverage: {
      july_4_source_rows: prototypeReport.july_4_source_rows,
      july_4_mapped_rows: prototypeReport.july_4_mapped_rows,
      july_4_needs_review_rows: prototypeReport.july_4_needs_review_rows,
      headline_july_4_rows: headlineCoverageSource.length,
      headline_july_4_in_major_preview: july4Coverage.filter(row => row.preview_disposition === 'preview_major').length,
      headline_july_4_in_needs_review: july4Coverage.filter(row => row.preview_disposition === 'preview_needs_review').length,
      rows: july4Coverage
    },
    missing_geocode_count: previewNeedsReview.filter(row => row.missing_geocode || !hasValidCoordinates(row)).length,
    headline_july_4_in_preview_or_review: headlineInPreviewOrReview,
    all_feed_excluded_no_geocode: allFeedExcludedNoGeocode,
    approved_geocode_overrides_loaded: geocodeOverrides.size,
    production_major_snapshot_rows: productionMajor.length,
    production_all_snapshot_rows: productionAll.length,
    production_files_blocked: [
      'nycif_major_radar_map_events.json',
      'nycif_all_radar_map_events.json',
      'data/nycif_staged_live_events.json'
    ],
    c5_required_for_production_publish: true,
    explicit_howard_approval_required_for_c5: true,
    inputs: {
      prototype_mapped_path: 'data/prototype_major_events.json',
      prototype_review_path: 'data/prototype_major_events_needs_review.json',
      prototype_report_path: 'data/reports/prototype_major_events_report.json',
      production_major_url: PRODUCTION_MAJOR_URL,
      production_all_url: PRODUCTION_ALL_URL,
      approved_geocodes_path: 'data/approved_major_event_geocodes.json',
      approved_geocodes_present: geocodeOverrides.size > 0
    },
    outputs: {
      preview_major_feed: 'data/preview_major_feed.json',
      preview_all_feed: 'data/preview_all_feed.json',
      preview_staged_feed: 'data/preview_staged_feed.json',
      preview_needs_review: 'data/preview_major_feed_needs_review.json',
      preview_report: 'data/reports/preview_major_feed_report.json'
    }
  };

  await mkdir(path.dirname(PREVIEW_REPORT_PATH), { recursive: true });
  await writeFile(PREVIEW_MAJOR_PATH, `${JSON.stringify(previewMajor, null, 2)}\n`);
  await writeFile(PREVIEW_ALL_PATH, `${JSON.stringify(previewAll, null, 2)}\n`);
  await writeFile(PREVIEW_STAGED_PATH, `${JSON.stringify(previewStaged, null, 2)}\n`);
  await writeFile(PREVIEW_REVIEW_PATH, `${JSON.stringify(previewNeedsReview, null, 2)}\n`);
  await writeFile(PREVIEW_REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Wrote ${PREVIEW_MAJOR_PATH}`);
  console.log(`Wrote ${PREVIEW_ALL_PATH}`);
  console.log(`Wrote ${PREVIEW_STAGED_PATH}`);
  console.log(`Wrote ${PREVIEW_REVIEW_PATH}`);
  console.log(`Wrote ${PREVIEW_REPORT_PATH}`);
  console.log(`preview_major_feed_rows=${report.preview_major_feed_rows}`);
  console.log(`preview_all_feed_rows=${report.preview_all_feed_rows}`);
  console.log(`preview_staged_rows=${report.preview_staged_rows}`);
  console.log(`preview_needs_review_rows=${report.preview_needs_review_rows}`);
  console.log(`preserved_manual_records=${report.preserved_manual_records}`);
  console.log(`manual_records_removed=${report.manual_records_removed}`);
  console.log(`headline_july_4_in_preview_or_review=${report.headline_july_4_in_preview_or_review}`);
  console.log(`missing_geocode_count=${report.missing_geocode_count}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
