#!/usr/bin/env node
/**
 * QA-only audit for NYC Permitted Event Information (tvpp-9vvx) vs NYCIF feeds.
 * Does not overwrite production feeds.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REPORT_DIR = path.join(ROOT, 'data/reports');
const TVPP_URL = 'https://data.cityofnewyork.us/resource/tvpp-9vvx.json';
const TVPP_VIEW_URL = 'https://data.cityofnewyork.us/api/views/tvpp-9vvx.json';
const ALL_FEED_URL = 'https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/nycif_all_radar_map_events.json';
const MAJOR_FEED_URL = 'https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/nycif_major_radar_map_events.json';
const STAGED_FEED_URL = 'https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/data/nycif_staged_live_events.json';
const LIVE_SYNC_URL = 'https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/data/live_sync_report.json';
const REMAINDER_URL = 'https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/data/remainder_year_coverage_report.json';

const HEADLINE_JULY4_TERMS = [
  'July 4th Fireworks',
  'Annual July 4 Parade',
  'Nathans Famous July 4th',
  'Huck Finn July 4th',
  'Independence Day Block Party'
];

const PROPOSED_MAJOR_FIELDS = [
  'major_score',
  'major_reason',
  'photo_pick',
  'instagramable_signal',
  'public_event_type',
  'expected_crowd_signal',
  'source_name',
  'source_url',
  'source_record_id',
  'date',
  'start_date_time',
  'end_date_time',
  'title',
  'display_location',
  'borough',
  'lat',
  'lng',
  'verification_status',
  'review_status'
];

async function fetchJson(url, init = {}) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'NYCIF-tvpp-major-audit/1.0' },
    cache: 'no-store',
    ...init
  });
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
  return response.json();
}

async function fetchTvppPage(params) {
  const query = new URLSearchParams(params);
  return fetchJson(`${TVPP_URL}?${query.toString()}`);
}

async function fetchAllTvppCurrentFuture() {
  const rows = [];
  const today = new Date().toISOString().slice(0, 10);
  let offset = 0;
  const limit = 50000;
  while (true) {
    const page = await fetchTvppPage({
      $limit: String(limit),
      $offset: String(offset),
      $order: 'start_date_time,event_id',
      $where: `start_date_time >= '${today}T00:00:00'`
    });
    if (!Array.isArray(page) || page.length === 0) break;
    rows.push(...page);
    if (page.length < limit) break;
    offset += limit;
    if (offset >= 300000) break;
  }
  return rows;
}

function dateKey(value) {
  return String(value || '').slice(0, 10);
}

function norm(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function feedId(row) {
  return String(row?.source_event_id || row?.event_id || row?.id || row?.source_record_id || '').trim();
}

function feedRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.events)) return payload.events;
  return [];
}

function indexFeed(rows) {
  const byId = new Map();
  for (const row of rows) {
    const id = feedId(row);
    if (id) byId.set(id, row);
  }
  return byId;
}

function hasGps(row) {
  const lat = Number(row?.lat);
  const lng = Number(row?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

function headlineMatch(name) {
  const text = norm(name);
  return HEADLINE_JULY4_TERMS.some(term => text.includes(norm(term)));
}

function classifyDisposition(tvppRow, allRow, majorRow) {
  if (!allRow) return 'missing_from_all_feed';
  if (!hasGps(allRow)) return 'needs_review_missing_geocode';
  if (!majorRow) return 'mapped_not_major';
  return 'mapped_in_major';
}

function rejectionReason(disposition, tvppRow, allRow) {
  if (disposition === 'missing_from_all_feed') {
    if (!String(tvppRow.cemsid || '').replace(/[,0\s]/g, '')) return 'no_cemsid_and_not_enriched';
    return 'not_present_in_enriched_all_feed';
  }
  if (disposition === 'needs_review_missing_geocode') return 'missing_lat_lng';
  if (disposition === 'mapped_not_major') {
    const type = norm(tvppRow.event_type);
    if (type.includes('sport')) return 'low_major_score_sports_permit';
    if (type.includes('market') || type.includes('sidewalk')) return 'low_major_score_market_permit';
    return 'below_major_selection_threshold';
  }
  return null;
}

function scoreCandidate(tvppRow) {
  let score = 0;
  const reasons = [];
  const name = norm(tvppRow.event_name);
  const type = norm(tvppRow.event_type);
  const agency = norm(tvppRow.event_agency);

  const add = (points, reason) => {
    score += points;
    reasons.push(reason);
  };

  if (name.includes('july 4') || name.includes('independence day') || name.includes('fireworks')) add(120, 'holiday_citywide_signal');
  if (type.includes('parade') || name.includes('parade') || name.includes('march')) add(90, 'parade_or_march');
  if (type.includes('block party') || name.includes('block party')) add(70, 'block_party');
  if (type.includes('street event') || type.includes('production')) add(55, 'street_or_production_activity');
  if (agency.includes('police department')) add(45, 'official_civic_agency');
  if (agency.includes('parks department')) add(35, 'parks_department_event');
  if (name.includes('festival') || name.includes('waterfront') || name.includes('fireworks')) add(40, 'festival_or_waterfront');
  if (name.includes('world cup') || name.includes('fan zone')) add(50, 'sports_fan_zone');
  if (type.includes('farmers market') || type.includes('sidewalk sale')) add(15, 'market_permit');
  if (type.includes('sport')) add(-20, 'routine_sports_permit');

  return { major_score: score, major_reason: reasons.join(', ') || 'general_permit_event' };
}

async function main() {
  const generatedAt = new Date().toISOString();
  const [viewMeta, tvppRows, allRowsRaw, majorRowsRaw, stagedRowsRaw, liveSync, remainder] = await Promise.all([
    fetchJson(TVPP_VIEW_URL),
    fetchAllTvppCurrentFuture(),
    fetchJson(ALL_FEED_URL),
    fetchJson(MAJOR_FEED_URL),
    fetchJson(STAGED_FEED_URL),
    fetchJson(LIVE_SYNC_URL).catch(() => null),
    fetchJson(REMAINDER_URL).catch(() => null)
  ]);
  const allRows = feedRows(allRowsRaw);
  const majorRows = feedRows(majorRowsRaw);
  const stagedRows = feedRows(stagedRowsRaw);

  const allIndex = indexFeed(allRows);
  const majorIndex = indexFeed(majorRows);
  const stagedIndex = indexFeed(stagedRows);

  const july4Date = '2026-07-04';
  const july4Rows = tvppRows.filter(row => dateKey(row.start_date_time) === july4Date);
  const headlineRows = tvppRows.filter(row => headlineMatch(row.event_name));

  const mapped = [];
  const rejected = [];
  const needsReview = [];
  const july4Audit = [];

  for (const row of tvppRows) {
    const id = String(row.event_id || '').trim();
    const allRow = allIndex.get(id) || null;
    const majorRow = majorIndex.get(id) || null;
    const stagedRow = stagedIndex.get(id) || null;
    const disposition = classifyDisposition(row, allRow, majorRow);
    const proposed = scoreCandidate(row);
    const auditRow = {
      source_record_id: id,
      title: row.event_name || 'Untitled permit event',
      start_date_time: row.start_date_time || null,
      end_date_time: row.end_date_time || null,
      event_type: row.event_type || null,
      event_agency: row.event_agency || null,
      event_borough: row.event_borough || null,
      event_location: row.event_location || null,
      cemsid: row.cemsid || null,
      street_closure_type: row.street_closure_type || null,
      disposition,
      in_all_feed: Boolean(allRow),
      in_major_feed: Boolean(majorRow),
      in_staged_feed: Boolean(stagedRow),
      has_geocode: hasGps(allRow),
      proposed_major_score: proposed.major_score,
      proposed_major_reason: proposed.major_reason,
      rejection_reason: rejectionReason(disposition, row, allRow)
    };

    if (disposition === 'mapped_in_major') mapped.push(auditRow);
    else if (disposition === 'needs_review_missing_geocode') needsReview.push(auditRow);
    else rejected.push(auditRow);

    if (dateKey(row.start_date_time) === july4Date || headlineMatch(row.event_name)) {
      july4Audit.push(auditRow);
    }
  }

  const rejectionCounts = rejected.reduce((acc, row) => {
    const key = row.rejection_reason || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const topRejectionReasons = Object.entries(rejectionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([reason, count]) => ({ reason, count }));

  const report = {
    generated_at_utc: generatedAt,
    audit_scope: 'QA-only source audit for major-events feed direction',
    production_feeds_modified: false,
    source: {
      dataset_id: 'tvpp-9vvx',
      dataset_title: viewMeta?.name || 'NYC Permitted Event Information',
      dataset_url: 'https://data.cityofnewyork.us/City-Government/NYC-Permitted-Event-Information/tvpp-9vvx',
      api_url: TVPP_URL,
      publisher: 'City of New York',
      description: String(viewMeta?.description || '').replace(/\s+/g, ' ').trim(),
      rows_updated_at: viewMeta?.rowsUpdatedAt || null,
      fields: (viewMeta?.columns || []).map(col => ({
        field: col.fieldName,
        name: col.name,
        datatype: col.dataTypeName
      })),
      has_native_lat_lng: false,
      primary_date_field: 'start_date_time',
      primary_end_field: 'end_date_time',
      primary_title_field: 'event_name',
      primary_location_field: 'event_location',
      primary_borough_field: 'event_borough',
      permit_status_fields: ['event_type', 'event_agency', 'street_closure_type'],
      geocode_keys: ['cemsid']
    },
    feed_architecture: {
      all_feed: {
        repo: 'setoxxx/nycif-live-feeds',
        path: 'nycif_all_radar_map_events.json',
        url: ALL_FEED_URL,
        row_count: allRows.length,
        last_metadata_generated_at: '2026-06-27T04:19:14.912841+00:00 (feed-metadata.json)'
      },
      major_feed: {
        repo: 'setoxxx/nycif-live-feeds',
        path: 'nycif_major_radar_map_events.json',
        url: MAJOR_FEED_URL,
        row_count: majorRows.length,
        last_metadata_generated_at: '2026-06-27T04:51:11.085905+00:00 (major-feed-metadata.json)',
        selection_note: 'Subset/scored view derived from all feed; not rebuilt by hourly live-sync QA workflow'
      },
      staged_feed: {
        repo: 'setoxxx/nycif-live-feeds',
        path: 'data/nycif_staged_live_events.json',
        url: STAGED_FEED_URL,
        row_count: stagedRows.length,
        builder: 'scripts/build_staged_production_feed.py (nycif-live-feeds)',
        automation: '.github/workflows/live-sync-qa.yml (hourly + push)'
      },
      qa_sync: {
        script: 'scripts/sync_nyc_open_data.py',
        report: 'data/live_sync_report.json',
        report_only: true,
        note: 'Compares tvpp-9vvx to enriched all feed; does not overwrite production all/major feeds'
      }
    },
    counts: {
      source_rows_current_future: tvppRows.length,
      mapped_rows: mapped.length,
      rejected_rows: rejected.length,
      needs_review_rows: needsReview.length,
      missing_geocode_count: needsReview.length,
      july_4_source_rows: july4Rows.length,
      july_4_mapped_in_all: july4Rows.filter(row => allIndex.has(String(row.event_id))).length,
      july_4_mapped_in_major: july4Rows.filter(row => majorIndex.has(String(row.event_id))).length,
      july_4_mapped_in_staged: july4Rows.filter(row => stagedIndex.has(String(row.event_id))).length,
      headline_july4_source_rows: headlineRows.length,
      headline_july4_in_major: headlineRows.filter(row => majorIndex.has(String(row.event_id))).length
    },
    top_rejection_reasons: topRejectionReasons,
    july_4_headline_events: july4Audit
      .filter(row => headlineMatch(row.title) || dateKey(row.start_date_time) === july4Date)
      .sort((a, b) => String(a.start_date_time).localeCompare(String(b.start_date_time))),
    proposed_output_schema_fields: PROPOSED_MAJOR_FIELDS,
    recommended_next_sources: [
      {
        source_name: 'NYC Permitted Event Information',
        source_url: 'https://data.cityofnewyork.us/resource/tvpp-9vvx.json',
        role: 'Primary official permit/event inventory for public map events',
        status: 'approved_primary'
      },
      {
        source_name: 'NYC Parks events (only if structured/current official feed exists)',
        source_url: 'https://www.nycgovparks.org/events',
        role: 'Supplement for park/festival programming when not represented cleanly in tvpp',
        status: 'evaluate_structure_before_ingest'
      },
      {
        source_name: 'NYC DOT / Open Streets / street activity permits',
        source_url: 'https://data.cityofnewyork.us/browse?q=open%20streets',
        role: 'Supplement for closures, marches, permitted street activity',
        status: 'partially_present_in_tvpp'
      },
      {
        source_name: 'Official citywide event calendars',
        role: 'Cross-check high-attendance civic/holiday events',
        status: 'manual_cross_check_only_for_now'
      }
    ],
    july_4_missing_cause_summary: [
      'tvpp-9vvx contains July 4, 2026 rows (844 current/future rows on that date in remainder-year QA).',
      'Headline July 4 events exist in tvpp but several are absent from nycif_all_radar_map_events.json (enrichment gap).',
      'Major feed is a stale scored subset (generated 2026-06-27) and excludes most July 4 rows even when present in all feed.',
      'Public map default now loads major feed with majorOnly=true, so missing major rows appear as missing July 4 events to users.',
      'Hourly live-sync QA regenerates staged/test artifacts but does not refresh production all/major JSON files.'
    ],
    live_sync_snapshot: liveSync ? {
      generated_at_utc: liveSync.generated_at_utc,
      current_future_rows: liveSync.current_future_rows,
      enriched_rows_loaded: liveSync.enriched_rows_loaded,
      match_counts: liveSync.match_counts,
      unmatched_estimate: liveSync.match_counts?.none
    } : null,
    remainder_year_snapshot: remainder?.july_4 || null,
    safety_language: [
      'Public event listing',
      'Source-listed event',
      'Field/photo candidate',
      'Confirm before traveling',
      'Event details can change'
    ]
  };

  await mkdir(REPORT_DIR, { recursive: true });
  const reportPath = path.join(REPORT_DIR, 'tvpp_major_event_source_audit_report.json');
  const july4Path = path.join(REPORT_DIR, 'tvpp_july4_headline_audit.json');
  const rejectPath = path.join(REPORT_DIR, 'tvpp_major_event_rejected_sample.json');
  const reviewPath = path.join(REPORT_DIR, 'tvpp_major_event_needs_review_sample.json');

  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(july4Path, `${JSON.stringify(report.july_4_headline_events, null, 2)}\n`);
  await writeFile(rejectPath, `${JSON.stringify(rejected.slice(0, 200), null, 2)}\n`);
  await writeFile(reviewPath, `${JSON.stringify(needsReview.slice(0, 200), null, 2)}\n`);

  console.log(`Wrote ${reportPath}`);
  console.log(`source_rows=${report.counts.source_rows_current_future}`);
  console.log(`mapped=${report.counts.mapped_rows} rejected=${report.counts.rejected_rows} needs_review=${report.counts.needs_review_rows}`);
  console.log(`july4_source=${report.counts.july_4_source_rows} july4_major=${report.counts.july_4_mapped_in_major}`);
  console.log(`headline_july4_major=${report.counts.headline_july4_in_major}/${report.counts.headline_july4_source_rows}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
