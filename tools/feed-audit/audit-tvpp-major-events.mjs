#!/usr/bin/env node
/**
 * Report-only NYC Open Data audit for tvpp-9vvx.
 * Writes QA JSON only. Does not modify production feeds or public UI.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REPORT_DIR = path.join(ROOT, 'data/reports');

const SOURCE_URL = 'https://data.cityofnewyork.us/resource/tvpp-9vvx.json';
const METADATA_URL = 'https://data.cityofnewyork.us/api/views/tvpp-9vvx.json';
const SOURCE_NAME = 'NYC Permitted Event Information';
const JULY_4_DATE = '2026-07-04';

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

const VAGUE_LOCATION_RE = /^(n\/a|na|none|closed|tbd|park event|parks event)$/i;

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'NYCIF-tvpp-report-audit/1.0' },
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

function countBy(rows, keyFn) {
  const counts = {};
  for (const row of rows) {
    const key = keyFn(row) || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
}

function isMissingLocation(row) {
  const text = String(row.event_location || '').trim();
  return !text;
}

function isVagueLocation(row) {
  const text = String(row.event_location || '').trim();
  if (!text) return true;
  if (VAGUE_LOCATION_RE.test(text)) return true;
  if (text.length < 8 && !text.includes(':')) return true;
  return false;
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

  const isPossibleMajor = score >= 50;
  const isRejectedRoutine = score < 50 && reasons.some(r => r.startsWith('routine_'));

  let rejectionReason = null;
  if (!isPossibleMajor) {
    if (isRejectedRoutine) rejectionReason = reasons.find(r => r.startsWith('routine_')) || 'routine_permit';
    else if (score < 50) rejectionReason = 'below_major_candidate_threshold';
  }

  if (isMissingLocation(row)) rejectionReason = rejectionReason || 'missing_location';
  if (isVagueLocation(row) && isPossibleMajor) rejectionReason = rejectionReason || 'vague_location_needs_review';

  return {
    score,
    reasons,
    isPossibleMajor,
    isRejectedRoutine,
    rejectionReason,
    needsGeocode: true,
    needsReview: isVagueLocation(row) || isMissingLocation(row)
  };
}

function normalizeRecord(row) {
  const scoring = scoreRecord(row);
  return {
    source_record_id: String(row.event_id || '').trim(),
    source_name: SOURCE_NAME,
    source_url: SOURCE_URL,
    title: row.event_name || 'Untitled permit event',
    start_date_time: row.start_date_time || null,
    end_date_time: row.end_date_time || null,
    date: dateKey(row.start_date_time),
    event_type: row.event_type || null,
    event_agency: row.event_agency || null,
    borough: row.event_borough || null,
    display_location: row.event_location || null,
    street_closure_type: row.street_closure_type || null,
    cemsid: row.cemsid || null,
    lat: null,
    lng: null,
    major_score: scoring.score,
    major_reason: scoring.reasons.join(', ') || 'no_strong_major_signal',
    possible_major_candidate: scoring.isPossibleMajor,
    needs_geocode: scoring.needsGeocode,
    needs_review: scoring.needsReview,
    rejection_reason: scoring.rejectionReason,
    safety_note: 'Source-listed public event listing. Confirm before traveling. Event details can change.'
  };
}

async function fetchCurrentUpcomingRows(windowStart, windowEnd) {
  const rows = [];
  let offset = 0;
  const limit = 50000;
  const where = `start_date_time >= '${windowStart}T00:00:00' AND start_date_time <= '${windowEnd}T23:59:59'`;
  const queriedUrl = `${SOURCE_URL}?$where=${encodeURIComponent(where)}&$order=${encodeURIComponent('start_date_time,event_id')}`;

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

  return { rows, queriedUrl };
}

function topRejectionReasons(rows) {
  const counts = {};
  for (const row of rows) {
    if (row.possible_major_candidate) continue;
    const key = row.rejection_reason || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([reason, count]) => ({ reason, count }));
}

async function main() {
  const generatedAt = new Date().toISOString();
  const windowStart = todayIsoDate();
  const windowEnd = `${windowStart.slice(0, 4)}-12-31`;

  const [metadata, fetched] = await Promise.all([
    fetchJson(METADATA_URL),
    fetchCurrentUpcomingRows(windowStart, windowEnd)
  ]);

  const normalized = fetched.rows.map(normalizeRecord);
  const july4Rows = normalized.filter(row => row.date === JULY_4_DATE);
  const possibleMajorCandidates = normalized.filter(row => row.possible_major_candidate);
  const july4MajorCandidates = july4Rows.filter(row => row.possible_major_candidate);
  const rejectedRoutineSports = normalized.filter(row => row.rejection_reason === 'routine_sports_permit');

  const highScoreCandidates = [...possibleMajorCandidates]
    .sort((a, b) => b.major_score - a.major_score)
    .slice(0, 25);

  const headlineJuly4 = july4Rows.filter(row =>
    /\bjuly 4\b|\bindependence day\b|\bfireworks\b|\bparade\b|\bnathan/i.test(row.title || '')
  );

  const report = {
    source_url: SOURCE_URL,
    metadata_url: METADATA_URL,
    queried_url: fetched.queriedUrl,
    generated_at: generatedAt,
    query_window: { start: windowStart, end: windowEnd },
    source_rows: normalized.length,
    july_4_rows: july4Rows.length,
    july_4_candidate_major_rows: july4MajorCandidates.length,
    records_by_event_type: countBy(normalized, row => row.event_type),
    records_by_event_agency: countBy(normalized, row => row.event_agency),
    records_by_borough: countBy(normalized, row => row.borough),
    records_missing_location: normalized.filter(row => !row.display_location).length,
    records_needing_geocode: normalized.filter(row => row.needs_geocode).length,
    possible_major_candidates: possibleMajorCandidates.length,
    sample_high_score_candidates: highScoreCandidates.slice(0, 10),
    sample_july_4_rows: headlineJuly4.slice(0, 15).length ? headlineJuly4.slice(0, 15) : july4Rows.slice(0, 15),
    sample_rejected_routine_sports: rejectedRoutineSports.slice(0, 15),
    top_rejection_reasons: topRejectionReasons(normalized),
    source_freshness: {
      dataset_title: metadata?.name || SOURCE_NAME,
      rows_updated_at: metadata?.rowsUpdatedAt || null,
      rows_updated_at_iso: metadata?.rowsUpdatedAt
        ? new Date(Number(metadata.rowsUpdatedAt)).toISOString()
        : null,
      audit_generated_at: generatedAt,
      dataset_description: String(metadata?.description || '').replace(/\s+/g, ' ').trim()
    },
    limitations: [
      'Report-only audit. Does not modify production feed JSON or public map UI.',
      'tvpp-9vvx has no native latitude/longitude fields; all rows are marked needs_geocode.',
      'Major candidacy is heuristic scoring over source text only; not proof of crowd size, popularity, or editorial priority.',
      'Dataset description references approved applications within the next month; verify future-date coverage during QA.',
      'Do not fabricate times or locations beyond source fields.',
      'Vague or missing event_location values should route to needs_review before map publication.'
    ],
    july_4_summary: {
      date: JULY_4_DATE,
      source_rows_on_date: july4Rows.length,
      possible_major_candidates_on_date: july4MajorCandidates.length,
      headline_rows_sample_count: headlineJuly4.length,
      contains_july_4_rows: july4Rows.length > 0,
      contains_major_public_interest_candidates: july4MajorCandidates.length > 0
    }
  };

  const samples = {
    generated_at: generatedAt,
    source_url: SOURCE_URL,
    possible_major_candidates: possibleMajorCandidates.slice(0, 100),
    july_4_rows: july4Rows.slice(0, 100),
    july_4_major_candidates: july4MajorCandidates.slice(0, 100),
    rejected_routine_sports: rejectedRoutineSports.slice(0, 100),
    needs_review_location: normalized.filter(row => row.needs_review).slice(0, 100),
    high_score_candidates: highScoreCandidates
  };

  await mkdir(REPORT_DIR, { recursive: true });
  const reportPath = path.join(REPORT_DIR, 'major_event_source_audit_tvpp_9vvx.json');
  const samplesPath = path.join(REPORT_DIR, 'major_event_source_audit_tvpp_9vvx_samples.json');
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(samplesPath, `${JSON.stringify(samples, null, 2)}\n`);

  console.log(`Wrote ${reportPath}`);
  console.log(`Wrote ${samplesPath}`);
  console.log(`source_rows=${report.source_rows} july_4_rows=${report.july_4_rows} july_4_major_candidates=${report.july_4_candidate_major_rows}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
