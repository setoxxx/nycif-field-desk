#!/usr/bin/env node
/**
 * C5G master geocode reference audit.
 * Report-only. Does not write coordinates into event rows or modify location_cache.
 */
import { readdir, readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const NEEDS_REVIEW_PATH = path.join(ROOT, 'data/prototype_major_events_needs_review.json');
const AUDIT_REPORT_PATH = path.join(ROOT, 'data/reports/master_geocode_reference_audit.json');
const MATCH_SAMPLES_PATH = path.join(ROOT, 'data/reports/master_geocode_reference_match_samples.json');

const SKIP_DIRS = new Set(['node_modules', '.git', '.cursor']);
const SKIP_FILE_RE = [
  /master_geocode_reference_audit\.json$/,
  /master_geocode_reference_match_samples\.json$/,
  /prototype_major_events_needs_review\.json$/
];
const CANDIDATE_NAME_RE = /geocode|location|gazetteer|coordinate|coord|lat|lng|lon|place|venue|borough|neighborhood|geojson/i;
const NYC_BOUNDS = { latMin: 40.4774, latMax: 40.9176, lngMin: -74.2591, lngMax: -73.7004 };
const HEADLINE_JULY4_RE = /\bfireworks\b|\bparade\b|\bindependence day\b|\bnathan'?s?\b|\bblock party\b|\bhuck finn\b|\bholiday\b|\bjuly 4\b|\bjuly 4th\b/i;
const JULY_4_DATE = '2026-07-04';

function norm(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function cacheKey(location, borough) {
  return `${norm(location)}|${norm(borough)}|`;
}

function hasValidCoordinates(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= NYC_BOUNDS.latMin && lat <= NYC_BOUNDS.latMax
    && lng >= NYC_BOUNDS.lngMin && lng <= NYC_BOUNDS.lngMax;
}

function extractLatLng(record) {
  if (!record || typeof record !== 'object') return null;
  let lat = Number(record.lat ?? record.latitude);
  let lng = Number(record.lng ?? record.longitude ?? record.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const geo = record.georeference || record.geo || record.geometry;
    if (geo?.coordinates && Array.isArray(geo.coordinates)) {
      lng = Number(geo.coordinates[0]);
      lat = Number(geo.coordinates[1]);
    }
  }
  if (!hasValidCoordinates(lat, lng)) return null;
  return { lat, lng };
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
    const locOnly = norm(location);
    if (locOnly && !seen.has(locOnly)) {
      seen.add(locOnly);
      keys.push(locOnly);
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

  const boroughSuffix = norm(`${raw} ${borough || ''}`);
  if (boroughSuffix && !seen.has(boroughSuffix)) {
    seen.add(boroughSuffix);
    keys.push(boroughSuffix);
  }

  return keys;
}

function isHeadlineJuly4(row) {
  const text = [row.title, row.event_type, row.event_agency, row.location, row.display_location, row.major_reason]
    .filter(Boolean).join(' ');
  return HEADLINE_JULY4_RE.test(text)
    || (String(row.date || '').slice(0, 10) === JULY_4_DATE && HEADLINE_JULY4_RE.test(text));
}

async function walkFiles(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkFiles(full, out);
      continue;
    }
    out.push(full);
  }
  return out;
}

function relPath(fullPath) {
  return path.relative(ROOT, fullPath).split(path.sep).join('/');
}

function shouldSkipFile(rel) {
  if (!/\.(json|geojson)$/i.test(rel)) return true;
  return SKIP_FILE_RE.some(re => re.test(rel));
}

function looksLikeCandidate(rel, text) {
  if (CANDIDATE_NAME_RE.test(rel)) return true;
  return /"lat"\s*:|"latitude"\s*:|"lng"\s*:|"longitude"\s*:|"georeference"\s*:|"geocode/i.test(text.slice(0, 200000));
}

function detectSchemaFields(records) {
  const fields = new Set();
  for (const record of records.slice(0, 50)) {
    if (!record || typeof record !== 'object') continue;
    Object.keys(record).forEach(key => fields.add(key));
  }
  return [...fields].sort();
}

function summarizeCandidate(rel, payload) {
  const summary = {
    path: rel,
    shape: 'unknown',
    record_count: 0,
    geocoded_record_count: 0,
    schema_fields: [],
    has_lat: false,
    has_lng: false,
    has_latitude: false,
    has_longitude: false,
    has_location_name: false,
    has_address: false,
    has_borough: false,
    has_normalized_key: false,
    has_source_quality: false,
    has_geocode_quality: false,
    index_key_style: null
  };

  let records = [];
  if (Array.isArray(payload)) {
    summary.shape = 'array';
    records = payload;
  } else if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.events)) {
      summary.shape = 'events_wrapper';
      records = payload.events;
    } else if (Array.isArray(payload.features)) {
      summary.shape = 'geojson';
      records = payload.features.map(feature => ({
        ...(feature.properties || {}),
        lat: feature.geometry?.coordinates?.[1],
        lng: feature.geometry?.coordinates?.[0]
      }));
    } else {
      summary.shape = 'dict_cache';
      records = Object.entries(payload).map(([key, value]) => ({
        cache_key: key,
        ...(value && typeof value === 'object' ? value : {})
      }));
      summary.has_normalized_key = true;
      summary.index_key_style = 'normalized_location_borough_pipe';
    }
  }

  summary.record_count = records.length;
  summary.schema_fields = detectSchemaFields(records);

  for (const field of summary.schema_fields) {
    if (field === 'lat') summary.has_lat = true;
    if (field === 'lng') summary.has_lng = true;
    if (field === 'latitude') summary.has_latitude = true;
    if (field === 'longitude') summary.has_longitude = true;
    if (/location|display_location|venue|place|name|title|address|query|cache_key/.test(field)) summary.has_location_name = true;
    if (/address|query/.test(field)) summary.has_address = true;
    if (/borough|county/.test(field)) summary.has_borough = true;
    if (/quality|provider|geocode_confidence|location_quality|source_quality/.test(field)) summary.has_source_quality = true;
    if (/quality|geocode|location_quality|geocode_confidence/.test(field)) summary.has_geocode_quality = true;
  }

  for (const record of records) {
    const coords = extractLatLng(record);
    if (coords) summary.geocoded_record_count += 1;
  }

  return { summary, records };
}

function buildReferenceIndex(rel, summary, records) {
  const entries = [];

  for (const record of records) {
    const coords = extractLatLng(record);
    if (!coords) continue;

    const borough = record.borough || record.event_borough || record.physical_county || record.county || '';
    const locationTexts = [
      record.cache_key,
      record.location,
      record.display_location,
      record.address,
      record.physical_address,
      record.query,
      record.title,
      record.name,
      record.legal_name,
      record.event_location
    ].filter(Boolean);

    const keys = new Set();
    for (const text of locationTexts) {
      for (const key of locationLookupKeys(text, borough)) keys.add(key);
      keys.add(norm(text));
    }
    if (record.cache_key) keys.add(String(record.cache_key));

    for (const key of keys) {
      entries.push({
        source_file: rel,
        lookup_key: key,
        lat: coords.lat,
        lng: coords.lng,
        quality: record.quality || record.geocode_confidence || record.location_quality || record.provider || null,
        label: record.display_location || record.location || record.address || record.query || record.title || record.cache_key || key
      });
    }
  }

  const byKey = new Map();
  for (const entry of entries) {
    if (!byKey.has(entry.lookup_key)) byKey.set(entry.lookup_key, []);
    byKey.get(entry.lookup_key).push(entry);
  }
  return byKey;
}

function extractParkVenueTokens(location) {
  const raw = String(location || '').trim();
  const tokens = [];
  if (raw.includes(':')) tokens.push(norm(raw.split(':')[0]));
  const cleaned = norm(raw.replace(/\bbetween\b.*$/i, '').replace(/\bblock party\b/i, ''));
  if (cleaned.length >= 8) tokens.push(cleaned);
  return [...new Set(tokens.filter(Boolean))];
}

function extractStreetTokens(location) {
  const raw = String(location || '');
  const tokens = [];
  const between = raw.match(/([A-Z0-9][A-Z0-9\s'/.-]{3,}?)\s+between\s+/i);
  if (between) tokens.push(norm(between[1]));
  const street = raw.match(/\b(\d+\s+[A-Z0-9][A-Z0-9\s'/.-]{2,}?\s+(?:street|st|avenue|ave|boulevard|blvd|road|rd|place|plaza|parkway|pkwy))\b/i);
  if (street) tokens.push(norm(street[1]));
  return [...new Set(tokens.filter(t => t.length >= 6))];
}

function coordSignature(matches) {
  return matches.map(m => `${m.lat.toFixed(5)},${m.lng.toFixed(5)}`).sort().join('|');
}

function strictExactKeys(row) {
  const borough = row.borough || row.event_borough || '';
  const keys = new Set();
  const add = (location) => {
    const raw = String(location || '').trim();
    if (!raw) return;
    keys.add(cacheKey(raw, borough));
    keys.add(norm(raw));
    keys.add(norm(`${raw} ${borough || ''}`));
    if (raw.includes(':')) {
      const park = raw.split(':')[0].trim();
      keys.add(cacheKey(park, borough));
      keys.add(norm(park));
    }
    const firstSegment = raw.split(',')[0].trim();
    if (firstSegment && firstSegment !== raw) {
      keys.add(cacheKey(firstSegment, borough));
      keys.add(norm(firstSegment));
    }
  };
  add(row.location);
  add(row.display_location);
  return [...keys];
}

function findExactMatches(row, indexes) {
  const uniqueKeys = strictExactKeys(row);
  const hits = [];

  for (const [, index] of indexes) {
    for (const key of uniqueKeys) {
      const matches = index.get(key) || [];
      for (const match of matches) {
        hits.push({ ...match, matched_key: key, match_method: 'exact_key' });
      }
    }
  }

  return hits;
}

function buildTokenIndex(indexes) {
  const parkIndex = new Map();
  const streetIndex = new Map();

  for (const [sourceFile, index] of indexes) {
    for (const [key, entries] of index.entries()) {
      const label = norm(entries[0]?.label || key);
      const parkToken = label.includes(':') ? norm(label.split(':')[0]) : '';
      if (parkToken.length >= 8) {
        if (!parkIndex.has(parkToken)) parkIndex.set(parkToken, []);
        parkIndex.get(parkToken).push({ source_file: sourceFile, lookup_key: key, ...entries[0] });
      }
      for (const token of extractStreetTokens(label)) {
        if (!streetIndex.has(token)) streetIndex.set(token, []);
        streetIndex.get(token).push({ source_file: sourceFile, lookup_key: key, ...entries[0] });
      }
    }
  }

  return { parkIndex, streetIndex };
}

function findPossibleMatches(row, indexes, tokenIndex, exactHits) {
  const possible = [];
  const parkTokens = extractParkVenueTokens(row.location || row.display_location);
  const streetTokens = extractStreetTokens(row.location || row.display_location);

  if (exactHits.length > 1 && new Set(exactHits.map(h => coordSignature([h]))).size > 1) {
    possible.push({
      match_method: 'multiple_exact_candidates',
      reason: 'Multiple reference records matched with different coordinates',
      candidates: exactHits.slice(0, 5)
    });
    return possible;
  }

  for (const token of parkTokens) {
    const hits = tokenIndex.parkIndex.get(token) || [];
    for (const hit of hits.slice(0, 3)) {
      possible.push({
        source_file: hit.source_file,
        match_method: 'park_or_venue_substring',
        matched_token: token,
        lookup_key: hit.lookup_key,
        lat: hit.lat,
        lng: hit.lng,
        label: hit.label
      });
    }
  }

  for (const token of streetTokens) {
    const hits = tokenIndex.streetIndex.get(token) || [];
    for (const hit of hits.slice(0, 3)) {
      possible.push({
        source_file: hit.source_file,
        match_method: 'street_or_intersection_substring',
        matched_token: token,
        lookup_key: hit.lookup_key,
        lat: hit.lat,
        lng: hit.lng,
        label: hit.label
      });
    }
  }

  const substringSources = indexes.filter(([sourceFile]) => /location_cache|preview_major_feed|preview_all_feed/.test(sourceFile));
  for (const token of parkTokens.filter(t => t.length >= 8)) {
    for (const [sourceFile, index] of substringSources) {
      let added = 0;
      for (const [key, entries] of index.entries()) {
        if (!key.includes(token)) continue;
        possible.push({
          source_file: sourceFile,
          match_method: 'park_or_venue_substring',
          matched_token: token,
          lookup_key: key,
          lat: entries[0].lat,
          lng: entries[0].lng,
          label: entries[0].label
        });
        added += 1;
        if (added >= 2) break;
      }
    }
  }

  return possible;
}

function classifyRow(row, indexes, tokenIndex) {
  const exactHits = findExactMatches(row, indexes);
  const uniqueCoordSets = new Set(exactHits.map(h => `${h.lat.toFixed(5)},${h.lng.toFixed(5)}`));
  let disposition = 'unmatched';
  let exactMatches = [];
  let possibleMatches = [];

  if (exactHits.length > 0 && uniqueCoordSets.size === 1) {
    disposition = 'exact_match';
    exactMatches = exactHits;
  } else if (exactHits.length > 0) {
    disposition = 'possible_match';
    possibleMatches = findPossibleMatches(row, indexes, tokenIndex, exactHits);
    if (possibleMatches.length === 0) {
      possibleMatches = [{
        match_method: 'multiple_exact_candidates',
        reason: 'Multiple exact key matches with different coordinates',
        candidates: exactHits.slice(0, 5)
      }];
    }
  } else {
    possibleMatches = findPossibleMatches(row, indexes, tokenIndex, exactHits);
    if (possibleMatches.length > 0) disposition = 'possible_match';
  }

  return {
    source_record_id: row.source_record_id,
    title: row.title,
    date: row.date,
    borough: row.borough,
    location: row.location,
    headline_july_4: isHeadlineJuly4(row),
    disposition,
    exact_matches: exactMatches.slice(0, 5),
    possible_matches: possibleMatches.slice(0, 5)
  };
}

function sampleRows(rows, disposition, limit = 12) {
  return rows.filter(row => row.disposition === disposition).slice(0, limit);
}

function countDisposition(rows, disposition, headlineOnly = false) {
  return rows.filter(row => row.disposition === disposition && (!headlineOnly || row.headline_july_4)).length;
}

async function main() {
  const generatedAt = new Date().toISOString();
  const allFiles = await walkFiles(ROOT);
  const scannedFiles = [];
  const candidateSummaries = [];
  const indexes = [];

  for (const fullPath of allFiles) {
    const rel = relPath(fullPath);
    if (shouldSkipFile(rel)) continue;

    let text = '';
    try {
      const info = await stat(fullPath);
      if (!info.isFile() || info.size > 50 * 1024 * 1024) continue;
      text = await readFile(fullPath, 'utf8');
    } catch {
      continue;
    }

    scannedFiles.push(rel);
    if (!looksLikeCandidate(rel, text)) continue;

    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      continue;
    }

    const { summary, records } = summarizeCandidate(rel, payload);
    if (summary.geocoded_record_count === 0) continue;

    candidateSummaries.push(summary);
    indexes.push([rel, buildReferenceIndex(rel, summary, records)]);
  }

  candidateSummaries.sort((a, b) => b.geocoded_record_count - a.geocoded_record_count);

  const needsReview = JSON.parse(await readFile(NEEDS_REVIEW_PATH, 'utf8'));
  const tokenIndex = buildTokenIndex(indexes);
  const classifications = needsReview.map(row => classifyRow(row, indexes, tokenIndex));

  const exactMatchCount = countDisposition(classifications, 'exact_match');
  const possibleMatchCount = countDisposition(classifications, 'possible_match');
  const unmatchedCount = countDisposition(classifications, 'unmatched');
  const headlineExact = countDisposition(classifications, 'exact_match', true);
  const headlinePossible = countDisposition(classifications, 'possible_match', true);
  const headlineUnmatched = countDisposition(classifications, 'unmatched', true);

  const perSourceExact = {};
  for (const row of classifications) {
    if (row.disposition !== 'exact_match') continue;
    for (const hit of row.exact_matches) {
      perSourceExact[hit.source_file] = (perSourceExact[hit.source_file] || 0) + 1;
    }
  }

  const recommendedMaster = 'data/location_cache.json';
  const recommendedSecondary = candidateSummaries
    .map(item => item.path)
    .filter(item => item !== recommendedMaster)
    .slice(0, 5);

  const report = {
    phase: 'C5G',
    mode: 'audit_only',
    generated_at: generatedAt,
    production_feeds_modified: false,
    public_ui_modified: false,
    wordpress_modified: false,
    scanned_files_count: scannedFiles.length,
    candidate_geocode_files: candidateSummaries.map(item => item.path),
    candidate_file_summaries: candidateSummaries,
    recommended_master_reference_file: recommendedMaster,
    recommended_secondary_reference_files: recommendedSecondary,
    recommended_master_rationale: 'Primary normalized location|borough cache used by existing NYCIF pin pipelines; largest geocoded reference index in repo with quality/provider metadata.',
    tvpp_needs_review_rows: needsReview.length,
    exact_match_count: exactMatchCount,
    possible_match_count: possibleMatchCount,
    unmatched_count: unmatchedCount,
    headline_july_4_exact_match_count: headlineExact,
    headline_july_4_possible_match_count: headlinePossible,
    headline_july_4_unmatched_count: headlineUnmatched,
    exact_matches_by_source_file: perSourceExact,
    matching_methods_used: [
      'exact_key: normalize(full location)|normalize(borough)',
      'exact_key: normalize(display_location)|normalize(borough)',
      'exact_key: normalize(park_or_venue prefix before colon)',
      'exact_key: normalize(first comma segment)|normalize(borough)',
      'possible_match: park_or_venue_substring',
      'possible_match: street_or_intersection_substring',
      'possible_match: multiple_exact_candidates'
    ],
    sample_exact_matches: sampleRows(classifications, 'exact_match', 12),
    sample_possible_matches: sampleRows(classifications, 'possible_match', 12),
    sample_unmatched_headline_july_4: classifications.filter(row => row.headline_july_4 && row.disposition === 'unmatched').slice(0, 12),
    risks: [
      'Street/intersection and park substring matches are not approval-ready without human QA.',
      'Strict exact keys reduce false positives but many tvpp event locations remain unmatched.',
      'location_cache.json is dominated by smoke/vape retailer address keys and weakly overlaps tvpp event locations.',
      'Secondary datasets (nightlife, retailers) can produce misleading possible matches for shared street names.',
      'Multiple reference hits with different coordinates must remain needs_review.',
      'Possible matches must not be promoted without approved override workflow (C5G2).'
    ],
    limitations: [
      'Audit-only: no coordinates written to event rows.',
      'No live geocoding APIs called.',
      'data/location_cache.json not modified.',
      'Production feeds not modified.'
    ],
    recommended_next_step: 'C5G2 — build review-only approved geocode override/reference layer using location_cache as master lookup plus human QA for possible matches; do not publish production feeds.'
  };

  const samples = {
    generated_at: generatedAt,
    exact_matches: sampleRows(classifications, 'exact_match', 25),
    possible_matches: sampleRows(classifications, 'possible_match', 25),
    unmatched_headline_july_4: classifications.filter(row => row.headline_july_4 && row.disposition === 'unmatched').slice(0, 25)
  };

  await mkdir(path.dirname(AUDIT_REPORT_PATH), { recursive: true });
  await writeFile(AUDIT_REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(MATCH_SAMPLES_PATH, `${JSON.stringify(samples, null, 2)}\n`);

  console.log(`Wrote ${AUDIT_REPORT_PATH}`);
  console.log(`Wrote ${MATCH_SAMPLES_PATH}`);
  console.log(`scanned_files_count=${report.scanned_files_count}`);
  console.log(`candidate_geocode_files=${report.candidate_geocode_files.length}`);
  console.log(`exact_match_count=${report.exact_match_count}`);
  console.log(`possible_match_count=${report.possible_match_count}`);
  console.log(`unmatched_count=${report.unmatched_count}`);
  console.log(`headline_july_4_exact=${report.headline_july_4_exact_match_count}`);
  console.log(`headline_july_4_possible=${report.headline_july_4_possible_match_count}`);
  console.log(`headline_july_4_unmatched=${report.headline_july_4_unmatched_count}`);
  console.log(`recommended_master_reference_file=${report.recommended_master_reference_file}`);
}

const isMainModule = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMainModule) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

export {
  norm,
  cacheKey,
  strictExactKeys,
  isHeadlineJuly4,
  classifyRow,
  buildReferenceIndex,
  buildTokenIndex,
  summarizeCandidate,
  hasValidCoordinates
};
