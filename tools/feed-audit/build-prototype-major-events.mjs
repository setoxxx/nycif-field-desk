#!/usr/bin/env node
/**
 * Prototype major-event builder from tvpp-9vvx.
 * Review-only outputs. Does not modify production feeds, public UI, or location cache.
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CACHE_PATH = path.join(ROOT, 'data/location_cache.json');
const PROTOTYPE_PATH = path.join(ROOT, 'data/prototype_major_events.json');
const REVIEW_PATH = path.join(ROOT, 'data/prototype_major_events_needs_review.json');
const REPORT_PATH = path.join(ROOT, 'data/reports/prototype_major_events_report.json');

const SOURCE_URL = 'https://data.cityofnewyork.us/resource/tvpp-9vvx.json';
const METADATA_URL = 'https://data.cityofnewyork.us/api/views/tvpp-9vvx.json';
const SOURCE_NAME = 'NYC Permitted Event Information';
const JULY_4_DATE = '2026-07-04';
const SAFETY_NOTE = 'Source-listed public event listing. Field/photo candidate. Confirm before traveling. Event details can change.';

const NYC_BOUNDS = { latMin: 40.4774, latMax: 40.9176, lngMin: -74.2591, lngMax: -73.7004 };

const MAJOR_SIGNALS = [
  { re: /\bjuly 4\b|\bjuly 4th\b|\bindependence day\b|\bfireworks\b/i, reason: 'holiday_or_fireworks', score: 100 },
  { re: /\bparade\b|\bmarch\b/i, reason: 'parade_or_march', score: 90 },
  { re: /\bstreet fair\b|\bfestival\b|\bcultural event\b/i, reason: 'festival_or_cultural_event', score: 75 },
  { re: /\bmarket\b|\bpop-?up\b|\bsidewalk sale\b/i, reason: 'market_or_popup', score: 55 },
  { re: /\bwaterfront\b|\bplaza\b|\bopen street\b|\bpublic gathering\b/i, reason: 'waterfront_plaza_open_street', score: 60 },
  { re: /\bstreet closure\b|\bblock party\b|\bstreet event\b|\bproduction event\b/i, reason: 'street_activity', score: 50 }
];

const ROUTINE_SIGNALS = [
  { re: /\bsport - youth\b|\bsport - adult\b|\blittle league\b|\bsoccer\b|\bbaseball\b|\bbasketball\b|\btennis\b|\bsoftball\b|\bvolleyball\b|\bcricket\b|\bfootball\b|\bflag football\b/i, reason: 'routine_sports_permit', score: -45 },
  { re: /\bpicnic\b|\bbarbecue\b|\bbbq\b/i, reason: 'routine_picnic_or_barbecue', score: -30 },
  { re: /\bparks event\b|\bclosed\b|\bno amplified sound\b/i, reason: 'routine_parks_permit', score: -20 }
];

const HEADLINE_JULY4_RE = /\bfireworks\b|\bparade\b|\bindependence day\b|\bnathan'?s?\b|\bblock party\b|\bholiday\b|\bjuly 4\b|\bjuly 4th\b/i;
const VAGUE_LOCATION_RE = /^(n\/a|na|none|closed|tbd|park event|parks event)$/i;
const PERMIT_HEAVY_TYPES_RE = /^sport -|special event$/i;

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'NYCIF-prototype-major-builder/1.0' },
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
  return response.json();
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function dateKey(value) {
  return String(value || '').slice(0, 10);
}

function norm(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function countBy(rows, keyFn) {
  const counts = {};
  for (const row of rows) {
    const key = keyFn(row) || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
}

function isMissingLocation(row) {
  return !String(row.event_location || '').trim();
}

function isVagueLocationText(text) {
  const value = String(text || '').trim();
  if (!value) return true;
  if (VAGUE_LOCATION_RE.test(value)) return true;
  if (value.length < 8 && !value.includes(':')) return true;
  return false;
}

function isVagueLocation(row) {
  return isVagueLocationText(row.event_location);
}

function isHeadlineJuly4(row) {
  return HEADLINE_JULY4_RE.test(String(row.event_name || ''))
    || (dateKey(row.start_date_time) === JULY_4_DATE && HEADLINE_JULY4_RE.test(auditText(row)));
}

function auditText(row) {
  return [
    row.event_name,
    row.event_type,
    row.event_agency,
    row.event_location,
    row.street_closure_type
  ].filter(Boolean).join(' ');
}

function hasStrongNonRoutineSignal(reasons) {
  return reasons.some(reason => !reason.startsWith('routine_'));
}

function isPermitHeavyType(eventType) {
  return PERMIT_HEAVY_TYPES_RE.test(String(eventType || '').trim());
}

function timeNeedsReview(row) {
  const start = String(row.start_date_time || '');
  if (!start) return false;
  const isMidnight = /T00:00:00/.test(start) || /T0?:00:00/.test(start.slice(11));
  return isMidnight && isPermitHeavyType(row.event_type);
}

function scoreRecord(row) {
  const text = auditText(row);
  const reasons = [];
  let score = 0;

  for (const signal of MAJOR_SIGNALS) {
    if (signal.re.test(text)) {
      score += signal.score;
      reasons.push(signal.reason);
    }
  }

  for (const signal of ROUTINE_SIGNALS) {
    if (signal.re.test(text)) {
      score += signal.score;
      reasons.push(signal.reason);
    }
  }

  if (String(row.event_type || '').toLowerCase().includes('parade')) {
    score += 20;
    if (!reasons.includes('parade_or_march')) reasons.push('parade_event_type');
  }

  const agency = String(row.event_agency || '');
  const routineType = /^sport -/i.test(String(row.event_type || ''));
  if (/police department|street activity permit office/i.test(agency) && !routineType) {
    score += 15;
    reasons.push('official_permit_agency');
  }

  return {
    score,
    reasons,
    isPossibleMajor: score >= 50,
    isStrongCandidate: score >= 100
  };
}

function cacheKey(location, borough) {
  return `${norm(location)}|${norm(borough)}|`;
}

function locationLookupKeys(eventLocation, borough) {
  const keys = [];
  const seen = new Set();
  const add = (location) => {
    const key = cacheKey(location, borough);
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  };

  const raw = String(eventLocation || '').trim();
  if (!raw) return keys;

  add(raw);
  add(raw.split(',')[0].trim());

  if (raw.includes(':')) {
    const [parkName, ...rest] = raw.split(':');
    const afterColon = rest.join(':').trim();
    add(parkName.trim());
    if (afterColon) {
      add(afterColon.split(',')[0].trim());
      add(`${parkName.trim()}: ${afterColon.split(',')[0].trim()}`);
    }
  }

  const streetMatch = raw.match(/([A-Z0-9][A-Z0-9\s'/.-]{3,}?)\s+between\s+/i);
  if (streetMatch) add(streetMatch[1].trim());

  return keys;
}

function inNycBounds(lat, lng) {
  return lat >= NYC_BOUNDS.latMin && lat <= NYC_BOUNDS.latMax
    && lng >= NYC_BOUNDS.lngMin && lng <= NYC_BOUNDS.lngMax;
}

function lookupGeocode(cache, eventLocation, borough) {
  const keys = locationLookupKeys(eventLocation, borough);
  for (const key of keys) {
    const entry = cache[key];
    if (!entry || entry.quality !== 'geocoded') continue;
    const lat = Number(entry.lat);
    const lng = Number(entry.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (!inNycBounds(lat, lng)) continue;
    return { lat, lng, normalized_location_key: key, cache_quality: entry.quality };
  }
  return { lat: null, lng: null, normalized_location_key: keys[0] || cacheKey(eventLocation, borough), cache_quality: null };
}

function derivePublicEventType(eventType, reasons) {
  if (reasons.includes('holiday_or_fireworks')) return 'holiday_citywide_event';
  if (reasons.includes('parade_or_march') || reasons.includes('parade_event_type')) return 'parade_or_march';
  if (reasons.includes('festival_or_cultural_event')) return 'festival_or_cultural_event';
  if (reasons.includes('market_or_popup')) return 'market_or_popup';
  if (reasons.includes('waterfront_plaza_open_street')) return 'public_space_event';
  if (reasons.includes('street_activity')) return 'street_activity';
  return String(eventType || 'public_event').toLowerCase().replace(/\s+/g, '_');
}

function derivePhotoPick(score, reasons) {
  return score >= 75 || reasons.some(r => [
    'holiday_or_fireworks',
    'parade_or_march',
    'parade_event_type',
    'festival_or_cultural_event'
  ].includes(r));
}

function buildBaseRow(row, scoring, geo) {
  const photoPick = derivePhotoPick(scoring.score, scoring.reasons);
  return {
    id: `prototype-tvpp-${String(row.event_id || '').trim()}`,
    source_name: SOURCE_NAME,
    source_url: SOURCE_URL,
    source_record_id: String(row.event_id || '').trim(),
    title: row.event_name || 'Untitled permit event',
    date: dateKey(row.start_date_time),
    start_date_time: row.start_date_time || null,
    end_date_time: row.end_date_time || null,
    borough: row.event_borough || null,
    location: row.event_location || null,
    display_location: row.event_location || null,
    lat: geo.lat,
    lng: geo.lng,
    event_agency: row.event_agency || null,
    event_type: row.event_type || null,
    street_closure_type: row.street_closure_type || null,
    community_board: row.community_board ?? null,
    police_precinct: row.police_precinct ?? null,
    cemsid: row.cemsid ?? null,
    major_score: scoring.score,
    major_reason: scoring.reasons.join(', ') || 'no_strong_major_signal',
    major_reason_tags: scoring.reasons,
    photo_pick: photoPick,
    instagramable_signal: photoPick ? 'field_photo_candidate' : null,
    expected_crowd_signal: 'source_listed_public_event',
    public_event_type: derivePublicEventType(row.event_type, scoring.reasons),
    safety_note: SAFETY_NOTE
  };
}

function decideDisposition(row, scoring, geo, flags) {
  const headline = isHeadlineJuly4(row);
  const reviewReasons = [];
  const routineSports = scoring.reasons.includes('routine_sports_permit');
  const onJuly4 = dateKey(row.start_date_time) === JULY_4_DATE;

  if (!scoring.isPossibleMajor && !headline) {
    return { bucket: 'rejected', reviewReasons: ['below_major_candidate_threshold'] };
  }

  if (flags.vague_location) reviewReasons.push('vague_location');
  if (!geo.lat || !geo.lng) reviewReasons.push('missing_geocode');
  if (flags.time_needs_review) reviewReasons.push('time_needs_review');
  if (routineSports && onJuly4) reviewReasons.push('july_4_routine_sports_review');
  if (routineSports && !hasStrongNonRoutineSignal(scoring.reasons)) reviewReasons.push('routine_sports_permit');
  if (headline && !scoring.isPossibleMajor) reviewReasons.push('headline_july_4_requires_review');

  const mustReview = reviewReasons.length > 0
    || !geo.lat
    || flags.vague_location
    || (routineSports && onJuly4)
    || (routineSports && !hasStrongNonRoutineSignal(scoring.reasons));

  if (mustReview || headline && (!geo.lat || flags.vague_location || flags.time_needs_review)) {
    return { bucket: 'needs_review', reviewReasons: [...new Set(reviewReasons.length ? reviewReasons : ['needs_review'])] };
  }

  if (!scoring.isPossibleMajor) {
    return { bucket: 'needs_review', reviewReasons: ['headline_july_4_requires_review'] };
  }

  return { bucket: 'mapped', reviewReasons: [] };
}

async function fetchCurrentUpcomingRows(windowStart, windowEnd) {
  const rows = [];
  let offset = 0;
  const limit = 50000;
  const where = `start_date_time >= '${windowStart}T00:00:00' AND start_date_time <= '${windowEnd}T23:59:59'`;

  while (true) {
    const params = new URLSearchParams({
      $limit: String(limit),
      $offset: String(offset),
      $order: 'start_date_time,event_id',
      $where: where
    });
    const page = await fetchJson(`${SOURCE_URL}?${params.toString()}`);
    if (!Array.isArray(page) || page.length === 0) break;
    rows.push(...page);
    if (page.length < limit) break;
    offset += limit;
    if (offset >= 300000) break;
  }

  const queriedUrl = `${SOURCE_URL}?$where=${encodeURIComponent(where)}&$order=${encodeURIComponent('start_date_time,event_id')}`;
  return { rows, queriedUrl };
}

function headlineCoverage(allProcessed) {
  const headlines = allProcessed.filter(item => item.headline);
  return headlines.map(item => ({
    source_record_id: item.base.source_record_id,
    title: item.base.title,
    date: item.base.date,
    disposition: item.bucket,
    major_score: item.base.major_score,
    review_reasons: item.reviewReasons
  }));
}

async function main() {
  const generatedAt = new Date().toISOString();
  const windowStart = todayIsoDate();
  const windowEnd = `${windowStart.slice(0, 4)}-12-31`;

  const [metadata, fetched, cacheRaw] = await Promise.all([
    fetchJson(METADATA_URL),
    fetchCurrentUpcomingRows(windowStart, windowEnd),
    readFile(CACHE_PATH, 'utf8')
  ]);
  const cache = JSON.parse(cacheRaw);

  const mapped = [];
  const needsReview = [];
  const rejected = [];
  const processed = [];

  for (const row of fetched.rows) {
    const scoring = scoreRecord(row);
    const geo = lookupGeocode(cache, row.event_location, row.event_borough);
    const flags = {
      vague_location: isVagueLocation(row),
      time_needs_review: timeNeedsReview(row)
    };
    const headline = isHeadlineJuly4(row);
    const disposition = decideDisposition(row, scoring, geo, flags);
    const base = buildBaseRow(row, scoring, geo);
    const item = { base, bucket: disposition.bucket, reviewReasons: disposition.reviewReasons, headline };

    if (disposition.bucket === 'mapped') {
      mapped.push({
        ...base,
        verification_status: 'source_listed',
        review_status: 'approved_for_prototype'
      });
    } else if (disposition.bucket === 'needs_review') {
      needsReview.push({
        ...base,
        verification_status: 'needs_review',
        review_status: 'needs_review',
        review_reasons: disposition.reviewReasons,
        missing_geocode: !geo.lat || !geo.lng,
        vague_location: flags.vague_location,
        time_needs_review: flags.time_needs_review,
        normalized_location_key: geo.normalized_location_key
      });
    } else {
      rejected.push({
        source_record_id: base.source_record_id,
        title: base.title,
        date: base.date,
        event_type: base.event_type,
        major_score: base.major_score,
        review_status: 'rejected',
        rejection_reasons: disposition.reviewReasons
      });
    }

    processed.push(item);
  }

  mapped.sort((a, b) => b.major_score - a.major_score || String(a.start_date_time).localeCompare(String(b.start_date_time)));
  needsReview.sort((a, b) => b.major_score - a.major_score || String(a.start_date_time).localeCompare(String(b.start_date_time)));

  const july4Processed = processed.filter(item => item.base.date === JULY_4_DATE);
  const july4Mapped = mapped.filter(row => row.date === JULY_4_DATE);
  const july4Review = needsReview.filter(row => row.date === JULY_4_DATE);

  const needsReviewByReason = {};
  for (const row of needsReview) {
    for (const reason of row.review_reasons || ['unknown']) {
      needsReviewByReason[reason] = (needsReviewByReason[reason] || 0) + 1;
    }
  }

  const report = {
    generated_at: generatedAt,
    source_url: SOURCE_URL,
    metadata_url: METADATA_URL,
    query_window: { start: windowStart, end: windowEnd },
    queried_url: fetched.queriedUrl,
    source_rows: fetched.rows.length,
    mapped_rows: mapped.length,
    needs_review_rows: needsReview.length,
    rejected_rows: rejected.length,
    july_4_source_rows: july4Processed.length,
    july_4_mapped_rows: july4Mapped.length,
    july_4_needs_review_rows: july4Review.length,
    headline_july_4_coverage: headlineCoverage(processed),
    missing_geocode_count: needsReview.filter(row => row.missing_geocode).length,
    vague_location_count: needsReview.filter(row => row.vague_location).length,
    time_needs_review_count: needsReview.filter(row => row.time_needs_review).length,
    top_rejection_reasons: Object.entries(
    rejected.reduce((acc, row) => {
      for (const reason of row.rejection_reasons || ['unknown']) {
        acc[reason] = (acc[reason] || 0) + 1;
      }
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
      .map(([reason, count]) => ({ reason, count })),
    top_review_reasons: Object.entries(needsReviewByReason)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([reason, count]) => ({ reason, count })),
    records_by_event_type: countBy(fetched.rows, row => row.event_type),
    records_by_event_agency: countBy(fetched.rows, row => row.event_agency),
    records_by_borough: countBy(fetched.rows, row => row.event_borough),
    mapped_by_event_type: countBy(mapped, row => row.event_type),
    needs_review_by_reason: Object.entries(needsReviewByReason)
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => ({ reason, count })),
    source_freshness: {
      dataset_title: metadata?.name || SOURCE_NAME,
      rows_updated_at: metadata?.rowsUpdatedAt || null,
      rows_updated_at_iso: metadata?.rowsUpdatedAt
        ? new Date(Number(metadata.rowsUpdatedAt)).toISOString()
        : null,
      builder_generated_at: generatedAt,
      dataset_description: String(metadata?.description || '').replace(/\s+/g, ' ').trim()
    },
    limitations: [
      'Prototype only.',
      'No production feed overwrite.',
      'Cache-only geocoding.',
      'tvpp has no native lat/lng.',
      'Permit times may not equal public-facing event times.',
      'Human QA required before promotion.'
    ],
    production_feeds_modified: false,
    public_ui_modified: false,
    wordpress_modified: false
  };

  await mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await writeFile(PROTOTYPE_PATH, `${JSON.stringify(mapped, null, 2)}\n`);
  await writeFile(REVIEW_PATH, `${JSON.stringify(needsReview, null, 2)}\n`);
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Wrote ${PROTOTYPE_PATH}`);
  console.log(`Wrote ${REVIEW_PATH}`);
  console.log(`Wrote ${REPORT_PATH}`);
  console.log(`source_rows=${report.source_rows}`);
  console.log(`mapped_rows=${report.mapped_rows}`);
  console.log(`needs_review_rows=${report.needs_review_rows}`);
  console.log(`rejected_rows=${report.rejected_rows}`);
  console.log(`july_4_mapped_rows=${report.july_4_mapped_rows}`);
  console.log(`july_4_needs_review_rows=${report.july_4_needs_review_rows}`);
  console.log(`top_review_reasons=${report.top_review_reasons.slice(0, 5).map(r => `${r.reason}:${r.count}`).join(', ')}`);
  console.log(`top_rejection_reasons=${report.top_rejection_reasons.slice(0, 5).map(r => `${r.reason}:${r.count}`).join(', ')}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
