/**
 * Pure TVPP location readiness helpers for Event Sources v6.
 * Read-only audit metadata — does not geocode, mutate EventLead, or write caches.
 * No network calls — safe for unit tests.
 */

import {
  sortLeadsByStartDateTime,
  TVPP_SOURCE_DATASET_ID,
  TVPP_SOURCE_NAME,
} from './tvpp-assignment-feed.mjs';
import { computeDateRange } from './source-freshness.mjs';

/** @typedef {import('./event-lead.mjs').EventLead} EventLead */
/** @typedef {'geocode_ready'|'needs_address_cleanup'|'intersection_or_route'|'borough_only'|'missing_location'|'needs_review'} LocationReadinessBucket */
/** @typedef {'high'|'medium'|'low'} LocationReadinessConfidence */

/** @typedef {Object} TvppLocationReadiness
 * @property {LocationReadinessBucket} bucket
 * @property {string[]} labels
 * @property {string[]} reasons
 * @property {LocationReadinessConfidence} confidence
 */

export const LOCATION_READINESS_BUCKETS = [
  'geocode_ready',
  'needs_address_cleanup',
  'intersection_or_route',
  'borough_only',
  'missing_location',
  'needs_review',
];

const NYC_BOROUGHS = new Set([
  'manhattan',
  'brooklyn',
  'queens',
  'bronx',
  'staten island',
]);

const STREET_TYPE_PATTERN = /\b(?:street|st|avenue|ave|boulevard|blvd|road|rd|drive|dr|lane|ln|place|pl|way|court|ct|terrace|ter|parkway|pkwy|broadway|highway|hwy|expressway|expy)\b/i;

const VENUE_KEYWORDS = [
  'park',
  'plaza',
  'promenade',
  'bandshell',
  'field',
  'center',
  'centre',
  'stadium',
  'library',
  'museum',
  'school',
  'church',
  'hall',
  'arena',
  'garden',
  'square',
  'terminal',
  'pier',
  'boardwalk',
  'waterfront',
  'campus',
  'building',
  'complex',
  'lawn',
  'event area',
];

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeLocationText(value) {
  if (value == null) return '';
  return String(value).trim().replace(/\s+/g, ' ');
}

/**
 * @param {EventLead} lead
 * @returns {string}
 */
export function getLeadLocationText(lead) {
  const parts = [lead.locationName, lead.address]
    .map((value) => normalizeLocationText(value))
    .filter(Boolean);
  return [...new Set(parts)].join(' | ');
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function hasStreetTypeKeyword(text) {
  return STREET_TYPE_PATTERN.test(text);
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function hasStreetNumber(text) {
  return /\b\d+\s+[A-Za-z]/.test(text);
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isIntersectionOrRouteText(text) {
  const normalized = text.toLowerCase();
  if (/\bbetween\b/.test(normalized)) return true;
  if (/\bfrom\b.+\bto\b/.test(normalized)) return true;
  if (/\b(?:&| and )\b/.test(normalized) && hasStreetTypeKeyword(text)) return true;
  return false;
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function hasVenuePrefix(text) {
  return /^[^:|]+:\s*.+/.test(text);
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function looksLikeVenueOrPark(text) {
  const normalized = text.toLowerCase();
  return VENUE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

/**
 * @param {EventLead} lead
 * @param {string} locationText
 * @returns {boolean}
 */
export function isBoroughOnlyLocation(lead, locationText) {
  if (!locationText) {
    return Boolean(normalizeLocationText(lead.borough));
  }

  const normalized = locationText.toLowerCase();
  const borough = normalizeLocationText(lead.borough).toLowerCase();

  if (borough && normalized === borough) return true;
  if (NYC_BOROUGHS.has(normalized) && !hasStreetTypeKeyword(locationText) && !hasStreetNumber(locationText)) {
    return true;
  }

  return false;
}

/**
 * @param {EventLead} lead
 * @returns {TvppLocationReadiness}
 */
export function classifyTvppLocationReadiness(lead) {
  const locationText = getLeadLocationText(lead);
  /** @type {string[]} */
  const labels = [];
  /** @type {string[]} */
  const reasons = [];

  if (lead.latitude != null || lead.longitude != null) {
    labels.push('existing_coordinates');
  }

  if (!locationText) {
    if (normalizeLocationText(lead.borough)) {
      labels.push('borough_only');
      return {
        bucket: 'borough_only',
        labels,
        reasons: ['No location text; borough is the only geographic hint'],
        confidence: 'high',
      };
    }

    labels.push('missing_location');
    return {
      bucket: 'missing_location',
      labels,
      reasons: ['No locationName, address, or borough present'],
      confidence: 'high',
    };
  }

  if (isBoroughOnlyLocation(lead, locationText)) {
    labels.push('borough_only');
    return {
      bucket: 'borough_only',
      labels,
      reasons: ['Location text is borough-only without street detail'],
      confidence: 'high',
    };
  }

  if (isIntersectionOrRouteText(locationText)) {
    labels.push('intersection_or_route');
    if (hasStreetTypeKeyword(locationText)) labels.push('street_segment');
    return {
      bucket: 'intersection_or_route',
      labels,
      reasons: ['Location appears to describe an intersection or route segment'],
      confidence: 'high',
    };
  }

  if (hasVenuePrefix(locationText) || /event area/i.test(locationText)) {
    labels.push('venue_prefix');
    if (looksLikeVenueOrPark(locationText)) labels.push('venue_or_park');
    return {
      bucket: 'needs_address_cleanup',
      labels,
      reasons: ['Venue or event-area prefix should be cleaned before geocoding'],
      confidence: 'medium',
    };
  }

  if (hasStreetNumber(locationText) && hasStreetTypeKeyword(locationText)) {
    labels.push('street_address');
    return {
      bucket: 'geocode_ready',
      labels,
      reasons: ['Street number and street type present'],
      confidence: 'high',
    };
  }

  if (hasStreetTypeKeyword(locationText) && !looksLikeVenueOrPark(locationText)) {
    labels.push('street_segment');
    return {
      bucket: 'geocode_ready',
      labels,
      reasons: ['Street-type location text without intersection markers'],
      confidence: 'medium',
    };
  }

  if (looksLikeVenueOrPark(locationText)) {
    labels.push('venue_or_park');
    return {
      bucket: 'needs_review',
      labels,
      reasons: ['Park or venue text without a clear street address'],
      confidence: 'medium',
    };
  }

  labels.push('needs_human_review');
  return {
    bucket: 'needs_review',
    labels,
    reasons: ['Location text present but not confidently classified for geocoding'],
    confidence: 'low',
  };
}

/**
 * @param {EventLead[]} leads
 * @returns {{ lead: EventLead, locationReadiness: TvppLocationReadiness }[]}
 */
export function classifyTvppLocationReadinessLeads(leads) {
  return sortLeadsByStartDateTime(leads).map((lead) => ({
    lead,
    locationReadiness: classifyTvppLocationReadiness(lead),
  }));
}

/**
 * @param {{ lead: EventLead, locationReadiness: TvppLocationReadiness }[]} items
 * @returns {Record<LocationReadinessBucket, number>}
 */
export function countLocationReadinessBuckets(items) {
  /** @type {Record<LocationReadinessBucket, number>} */
  const counts = {
    geocode_ready: 0,
    needs_address_cleanup: 0,
    intersection_or_route: 0,
    borough_only: 0,
    missing_location: 0,
    needs_review: 0,
  };

  for (const item of items) {
    counts[item.locationReadiness.bucket] += 1;
  }

  return counts;
}

/**
 * @param {Object} input
 * @param {string} input.generatedAt
 * @param {string} input.fromDate
 * @param {number} input.limit
 * @param {number} input.rowCount
 * @param {EventLead[]} input.leads
 * @returns {Object}
 */
export function buildTvppLocationReadinessReport({
  generatedAt,
  fromDate,
  limit,
  rowCount,
  leads,
}) {
  const items = classifyTvppLocationReadinessLeads(leads);

  return {
    generatedAt,
    sourceDatasetId: TVPP_SOURCE_DATASET_ID,
    source: TVPP_SOURCE_NAME,
    fromDate,
    limit,
    rowCount,
    itemCount: items.length,
    dateRange: computeDateRange(items.map((item) => item.lead)),
    locationBucketCounts: countLocationReadinessBuckets(items),
    items,
  };
}

/**
 * @param {NodeJS.WritableStream} [stream]
 */
export function printTvppLocationReadinessHelp(stream = process.stderr) {
  stream.write(`NYCIF Event Sources v6 — TVPP location readiness audit (stdout JSON only)

Usage:
  node tools/event-sources/sample-tvpp-location-readiness.mjs [options]

Options:
  --limit N          Max TVPP events to inspect (default 25, max 100)
  --pretty           Pretty-print JSON to stdout
  --from-date DATE   Upcoming filter start date YYYY-MM-DD (default: today)
  --borough NAME     Filter by event_borough
  --event-type TYPE  Filter by event_type
  --help             Show this help

Notes:
  - read-only location readiness audit; no GPS coordinates generated
  - no geocoding API calls and no cache writes
  - locationReadiness metadata is separate from EventLead
  - stdout JSON only; summary logs go to stderr
`);
}
