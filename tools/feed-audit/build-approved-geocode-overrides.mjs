#!/usr/bin/env node
/**
 * C5G2 review-only approved geocode override builder.
 * Does not modify production feeds, location_cache, prototype rows, or preview feeds.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyRow,
  buildReferenceIndex,
  buildTokenIndex,
  summarizeCandidate,
  isHeadlineJuly4,
  norm,
  cacheKey
} from './audit-master-geocode-reference.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MASTER_REFERENCE = 'data/location_cache.json';
const NEEDS_REVIEW_PATH = path.join(ROOT, 'data/prototype_major_events_needs_review.json');
const AUDIT_REPORT_PATH = path.join(ROOT, 'data/reports/master_geocode_reference_audit.json');
const MATCH_SAMPLES_PATH = path.join(ROOT, 'data/reports/master_geocode_reference_match_samples.json');
const CACHE_PATH = path.join(ROOT, 'data/location_cache.json');

const APPROVED_PATH = path.join(ROOT, 'data/approved_major_event_geocodes.json');
const GEOCODE_REVIEW_PATH = path.join(ROOT, 'data/approved_major_event_geocodes_needs_review.json');
const REPORT_PATH = path.join(ROOT, 'data/reports/approved_major_event_geocodes_report.json');

const SAFETY_NOTE = 'Proposed geocode from master reference audit. Human QA required before promotion to preview or production feeds.';

function uniqueCoordSignature(matches) {
  return [...new Set(matches.map(m => `${Number(m.lat).toFixed(5)},${Number(m.lng).toFixed(5)}`))];
}

function pickMasterExactMatch(row, exactMatches) {
  const masterHits = exactMatches.filter(hit => hit.source_file === MASTER_REFERENCE);
  if (masterHits.length === 0) return null;

  const coordSets = uniqueCoordSignature(masterHits);
  if (coordSets.length !== 1) return null;

  const hit = masterHits[0];
  const borough = row.borough || row.event_borough || '';
  const location = row.location || row.display_location || '';
  const parkPrefix = location.includes(':') ? location.split(':')[0].trim() : '';
  const normalizedKey = hit.matched_key || hit.lookup_key || cacheKey(location, borough);

  const keyMatchesLocation = [
    cacheKey(location, borough),
    cacheKey(row.display_location, borough),
    norm(location),
    norm(row.display_location),
    norm(parkPrefix),
    norm(`${location} ${borough}`)
  ].includes(normalizedKey) || normalizedKey.includes(norm(parkPrefix));

  if (!keyMatchesLocation && !normalizedKey.includes(norm(parkPrefix))) return null;

  return {
    ...hit,
    normalized_location_key: normalizedKey
  };
}

function buildApprovedRow(row, hit) {
  return {
    source_record_id: String(row.source_record_id || '').trim(),
    title: row.title,
    event_location: row.location || row.display_location,
    borough: row.borough || null,
    normalized_location_key: hit.normalized_location_key || hit.lookup_key,
    matched_reference_file: MASTER_REFERENCE,
    matched_reference_key: hit.lookup_key || hit.matched_key,
    lat: hit.lat,
    lng: hit.lng,
    match_method: hit.match_method === 'exact_key' ? 'normalized_exact' : hit.match_method,
    match_confidence: hit.quality || 'geocoded',
    approval_status: 'proposed_exact_match',
    safety_note: SAFETY_NOTE
  };
}

function buildGeocodeReviewRow(row, classification, reviewReasons) {
  const methods = [
    ...new Set([
      ...(classification.exact_matches || []).map(item => item.match_method),
      ...(classification.possible_matches || []).map(item => item.match_method)
    ].filter(Boolean))
  ];

  return {
    source_record_id: String(row.source_record_id || '').trim(),
    title: row.title,
    event_location: row.location || row.display_location,
    borough: row.borough || null,
    possible_matches: classification.possible_matches || [],
    exact_matches_non_master: (classification.exact_matches || []).filter(hit => hit.source_file !== MASTER_REFERENCE),
    match_methods: methods,
    review_reasons: reviewReasons,
    headline_july_4: classification.headline_july_4 || isHeadlineJuly4(row),
    approval_status: 'needs_human_review'
  };
}

async function loadMasterIndex() {
  const cacheRaw = await readFile(CACHE_PATH, 'utf8');
  const cache = JSON.parse(cacheRaw);
  const { summary, records } = summarizeCandidate(MASTER_REFERENCE, cache);
  return buildReferenceIndex(MASTER_REFERENCE, summary, records);
}

async function loadAuditIndexes(auditReport) {
  const indexes = [[MASTER_REFERENCE, await loadMasterIndex()]];
  for (const rel of auditReport.candidate_geocode_files || []) {
    if (rel === MASTER_REFERENCE) continue;
    try {
      const payload = JSON.parse(await readFile(path.join(ROOT, rel), 'utf8'));
      const { summary, records } = summarizeCandidate(rel, payload);
      if (summary.geocoded_record_count > 0) {
        indexes.push([rel, buildReferenceIndex(rel, summary, records)]);
      }
    } catch {
      // skip unreadable candidates
    }
  }
  return indexes;
}

async function main() {
  const generatedAt = new Date().toISOString();
  const [needsReviewRaw, auditReportRaw, matchSamplesRaw] = await Promise.all([
    readFile(NEEDS_REVIEW_PATH, 'utf8'),
    readFile(AUDIT_REPORT_PATH, 'utf8'),
    readFile(MATCH_SAMPLES_PATH, 'utf8')
  ]);

  const needsReview = JSON.parse(needsReviewRaw);
  const auditReport = JSON.parse(auditReportRaw);
  JSON.parse(matchSamplesRaw);

  const indexes = await loadAuditIndexes(auditReport);
  const tokenIndex = buildTokenIndex(indexes);
  const classifications = needsReview.map(row => {
    const classification = classifyRow(row, indexes, tokenIndex);
    return { row, classification };
  });

  const approved = [];
  const geocodeReview = [];
  let unmatchedCount = 0;

  for (const { row, classification } of classifications) {
    const masterHit = classification.disposition === 'exact_match'
      ? pickMasterExactMatch(row, classification.exact_matches)
      : null;

    if (masterHit) {
      approved.push(buildApprovedRow(row, masterHit));
      continue;
    }

    if (classification.disposition === 'possible_match') {
      const reasons = ['possible_match_requires_human_review'];
      if (classification.headline_july_4) reasons.push('headline_july_4_requires_geocode_review');
      geocodeReview.push(buildGeocodeReviewRow(row, classification, reasons));
      continue;
    }

    if (classification.disposition === 'exact_match') {
      geocodeReview.push(buildGeocodeReviewRow(row, classification, [
        'exact_match_non_master_source',
        'requires_master_reference_confirmation'
      ]));
      continue;
    }

    unmatchedCount += 1;
  }

  const headlineApproved = approved.filter(row => isHeadlineJuly4(row)).length;
  const headlineReview = geocodeReview.filter(row => row.headline_july_4).length;

  const report = {
    phase: 'C5G2',
    mode: 'review_only_geocode_overrides',
    generated_at: generatedAt,
    production_feeds_modified: false,
    public_ui_modified: false,
    wordpress_modified: false,
    master_reference_file: MASTER_REFERENCE,
    audit_report: 'data/reports/master_geocode_reference_audit.json',
    match_samples: 'data/reports/master_geocode_reference_match_samples.json',
    tvpp_needs_review_rows: needsReview.length,
    exact_matches_promoted_to_proposed_geocodes: approved.length,
    possible_matches_routed_to_review: geocodeReview.filter(row => row.review_reasons.includes('possible_match_requires_human_review')).length,
    exact_non_master_routed_to_review: geocodeReview.filter(row => row.review_reasons.includes('exact_match_non_master_source')).length,
    geocode_review_rows: geocodeReview.length,
    unmatched_count: unmatchedCount,
    headline_july_4_proposed_exact_count: headlineApproved,
    headline_july_4_needs_review_count: headlineReview,
    headline_july_4_unmatched_count: unmatchedCount > 0
      ? classifications.filter(({ classification }) => classification.headline_july_4 && classification.disposition === 'unmatched').length
      : 0,
    approved_geocode_file: 'data/approved_major_event_geocodes.json',
    needs_review_geocode_file: 'data/approved_major_event_geocodes_needs_review.json',
    production_publish_blocked: true,
    c5_required_for_publish: true,
    explicit_howard_approval_required: true,
    promotion_rules: [
      'Only location_cache.json master exact matches with single coordinate set are proposed.',
      'Possible/fuzzy matches routed to needs_review geocode file.',
      'Non-master exact matches require human confirmation.',
      'Unmatched rows are reported only; not auto-approved.'
    ]
  };

  await mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await writeFile(APPROVED_PATH, `${JSON.stringify(approved, null, 2)}\n`);
  await writeFile(GEOCODE_REVIEW_PATH, `${JSON.stringify(geocodeReview, null, 2)}\n`);
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Wrote ${APPROVED_PATH}`);
  console.log(`Wrote ${GEOCODE_REVIEW_PATH}`);
  console.log(`Wrote ${REPORT_PATH}`);
  console.log(`exact_matches_promoted=${report.exact_matches_promoted_to_proposed_geocodes}`);
  console.log(`geocode_review_rows=${report.geocode_review_rows}`);
  console.log(`unmatched_count=${report.unmatched_count}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
