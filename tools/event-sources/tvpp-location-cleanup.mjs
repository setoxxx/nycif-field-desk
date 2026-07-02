/**
 * TVPP Location Cleanup Parser v1.
 *
 * Dev-only/read-only parser for turning messy TVPP location text into
 * structured review candidates. This module does not geocode, does not
 * create coordinates, and does not write caches.
 */

export const TVPP_LOCATION_CLEANUP_VERSION = 'v1';

export const TVPP_LOCATION_CLEANUP_BUCKETS = [
  'clean_address_candidate',
  'clean_venue_candidate',
  'intersection_candidate',
  'route_or_multi_segment',
  'park_area_candidate',
  'borough_only',
  'missing_location',
  'needs_manual_review',
];

const BOROUGHS = new Set(['manhattan', 'brooklyn', 'queens', 'bronx', 'staten island']);
const LOW_INFO = new Set(['n/a', 'na', 'none', 'null', 'unknown', 'closed', 'closure', 'celebration', 'parks event', 'event', 'tbd', 'various']);

const STREET_REPLACEMENTS = [
  [/\bEAST\b/gi, 'E'],
  [/\bWEST\b/gi, 'W'],
  [/\bNORTH\b/gi, 'N'],
  [/\bSOUTH\b/gi, 'S'],
  [/\bSTREET\b/gi, 'St'],
  [/\bAVENUE\b/gi, 'Ave'],
  [/\bBOULEVARD\b/gi, 'Blvd'],
  [/\bROAD\b/gi, 'Rd'],
  [/\bPLACE\b/gi, 'Pl'],
  [/\bLANE\b/gi, 'Ln'],
];

/** @param {unknown} value */
export function normalizeTvppLocationText(value) {
  let text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s*:\s*/g, ': ')
    .trim();

  for (const [pattern, replacement] of STREET_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  text = text
    .replace(/\bbetween\b/gi, 'between')
    .replace(/\band\b/gi, 'and')
    .replace(/\s+/g, ' ')
    .trim();

  return text;
}

/** @param {unknown} value */
function normalizeForClass(value) {
  return String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** @param {unknown[]} values */
function firstUseful(values) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

/** @param {string} text */
function isLowInfoText(text) {
  const normalized = normalizeForClass(text);
  if (!normalized) return true;
  if (LOW_INFO.has(normalized)) return true;
  return normalized.length < 4;
}

/** @param {string} text */
function looksLikeAddress(text) {
  return /^\d+\s+[A-Za-z0-9]/.test(text) && /\b(St|Ave|Blvd|Rd|Pl|Ln|Drive|Dr|Way|Broadway)\b/i.test(text);
}

/** @param {string} text */
function looksLikeParkOrVenue(text) {
  return /\b(park|garden|plaza|square|promenade|terrace|field|lawn|fountain|playground|beach|pier|terminal|hall|center|centre|museum|library|school|church|theater|theatre)\b/i.test(text);
}

/** @param {string} text */
function splitSegments(text) {
  return text
    .split(/\s*,\s*(?=[A-Z0-9]|E\s|W\s|N\s|S\s)/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

/** @param {string} segment */
function parseBetweenSegment(segment) {
  const match = segment.match(/^(.*?)\s+between\s+(.*?)\s+and\s+(.*?)$/i);
  if (!match) return null;
  return {
    raw: segment,
    street: normalizeTvppLocationText(match[1]),
    from: normalizeTvppLocationText(match[2]),
    to: normalizeTvppLocationText(match[3]),
  };
}

/**
 * @param {Object} lead
 * @returns {Object}
 */
export function classifyTvppLocationText(lead) {
  const raw = lead?.rawRecord || {};
  const originalLocationText = firstUseful([
    lead?.locationName,
    lead?.address,
    raw.event_location,
    raw.location,
  ]);
  const cleanedLocationText = normalizeTvppLocationText(originalLocationText);
  const borough = lead?.borough || raw.event_borough || null;
  const streetSide = raw.event_street_side || null;
  const streetClosureType = raw.street_closure_type || null;
  const labels = [];
  const reasons = [];

  if (!cleanedLocationText) {
    if (borough) {
      labels.push('borough_only');
      reasons.push('Borough exists but no useful TVPP location text was found.');
      return { bucket: 'borough_only', locationKind: 'borough_only', confidence: 'low', originalLocationText, cleanedLocationText, borough, streetSide, streetClosureType, labels, reasons };
    }
    labels.push('missing_location');
    reasons.push('No location text or borough was available.');
    return { bucket: 'missing_location', locationKind: 'missing', confidence: 'high', originalLocationText, cleanedLocationText, borough, streetSide, streetClosureType, labels, reasons };
  }

  if (isLowInfoText(cleanedLocationText)) {
    labels.push('low_information_location');
    reasons.push('Location text is too generic for safe location cleanup.');
    return { bucket: 'needs_manual_review', locationKind: 'unknown', confidence: 'low', originalLocationText, cleanedLocationText, borough, streetSide, streetClosureType, labels, reasons };
  }

  if (borough && BOROUGHS.has(normalizeForClass(cleanedLocationText)) && normalizeForClass(cleanedLocationText) === normalizeForClass(borough)) {
    labels.push('borough_only');
    reasons.push('Location text only repeats the borough.');
    return { bucket: 'borough_only', locationKind: 'borough_only', confidence: 'low', originalLocationText, cleanedLocationText, borough, streetSide, streetClosureType, labels, reasons };
  }

  const segments = splitSegments(cleanedLocationText).map(parseBetweenSegment).filter(Boolean);
  if (segments.length > 1) {
    labels.push('multi_segment_route');
    reasons.push('Multiple route/intersection-style segments detected; use first segment only as a review candidate.');
    return { bucket: 'route_or_multi_segment', locationKind: 'multi_segment_route', confidence: 'medium', originalLocationText, cleanedLocationText, borough, streetSide, streetClosureType, components: { segments }, labels, reasons };
  }

  const oneSegment = parseBetweenSegment(cleanedLocationText);
  if (oneSegment) {
    labels.push('between_segment');
    reasons.push('Street segment between two cross streets detected.');
    return { bucket: 'intersection_candidate', locationKind: 'route', confidence: 'medium', originalLocationText, cleanedLocationText, borough, streetSide, streetClosureType, components: { segments: [oneSegment] }, labels, reasons };
  }

  if (/\b(at|@)\b/i.test(cleanedLocationText) || /\b(&|and)\b/i.test(cleanedLocationText)) {
    labels.push('intersection_text');
    reasons.push('Intersection-style text detected.');
    return { bucket: 'intersection_candidate', locationKind: 'intersection', confidence: 'medium', originalLocationText, cleanedLocationText, borough, streetSide, streetClosureType, labels, reasons };
  }

  if (looksLikeAddress(cleanedLocationText)) {
    labels.push('street_address');
    reasons.push('Street address pattern detected.');
    return { bucket: 'clean_address_candidate', locationKind: 'street_address', confidence: 'high', originalLocationText, cleanedLocationText, borough, streetSide, streetClosureType, labels, reasons };
  }

  if (looksLikeParkOrVenue(cleanedLocationText)) {
    labels.push('park_or_venue');
    reasons.push('Park, venue, or named public place text detected.');
    const bucket = /\bpark\b/i.test(cleanedLocationText) ? 'park_area_candidate' : 'clean_venue_candidate';
    return { bucket, locationKind: 'venue_or_park', confidence: 'medium', originalLocationText, cleanedLocationText, borough, streetSide, streetClosureType, labels, reasons };
  }

  labels.push('needs_operator_review');
  reasons.push('Location text is present but did not match a safe cleanup pattern.');
  return { bucket: 'needs_manual_review', locationKind: 'unknown', confidence: 'low', originalLocationText, cleanedLocationText, borough, streetSide, streetClosureType, labels, reasons };
}

/** @param {Object} cleanup */
function buildCandidateDisplayLocation(cleanup) {
  const segments = cleanup.components?.segments || [];
  if (segments.length) {
    const first = segments[0];
    return `${first.street} between ${first.from} and ${first.to}`;
  }
  if (cleanup.cleanedLocationText.includes(':')) {
    return cleanup.cleanedLocationText.replace(/\s*:\s*/, ', ');
  }
  return cleanup.cleanedLocationText || null;
}

/** @param {Object} cleanup */
function buildCandidateQuery(cleanup) {
  if (['missing_location', 'borough_only', 'needs_manual_review'].includes(cleanup.bucket)) return null;
  const display = buildCandidateDisplayLocation(cleanup);
  if (!display) return null;
  const borough = cleanup.borough ? `, ${cleanup.borough}` : '';
  const suffix = cleanup.locationKind === 'multi_segment_route' ? ' (first segment candidate only)' : '';
  return `${display.replace(/,/g, ' ')}${borough}, NY${suffix}`.replace(/\s+/g, ' ').trim();
}

/** @param {Object} lead */
export function parseTvppLocationCandidate(lead) {
  const classification = classifyTvppLocationText(lead);
  const candidateDisplayLocation = buildCandidateDisplayLocation(classification);
  const candidateQuery = buildCandidateQuery(classification);
  return {
    lead,
    locationCleanup: {
      bucket: classification.bucket,
      confidence: classification.confidence,
      originalLocationText: classification.originalLocationText || null,
      cleanedLocationText: classification.cleanedLocationText || null,
      locationKind: classification.locationKind,
      borough: classification.borough || null,
      candidateQuery,
      candidateDisplayLocation,
      streetSide: classification.streetSide || null,
      streetClosureType: classification.streetClosureType || null,
      components: classification.components || null,
      labels: classification.labels || [],
      reasons: classification.reasons || [],
    },
  };
}

/** @param {{ leads?: Object[] }} input */
function cleanupItems(input) {
  return (input.leads || []).map(parseTvppLocationCandidate);
}

/** @param {Array<{ locationCleanup: { bucket: string } }>} items */
export function countLocationCleanupBuckets(items) {
  return TVPP_LOCATION_CLEANUP_BUCKETS.reduce((counts, bucket) => {
    counts[bucket] = 0;
    return counts;
  }, Object.fromEntries(TVPP_LOCATION_CLEANUP_BUCKETS.map((bucket) => [bucket, 0])));
}

/** @param {Array<{ locationCleanup: { bucket: string } }>} items */
function buildBucketCounts(items) {
  const counts = Object.fromEntries(TVPP_LOCATION_CLEANUP_BUCKETS.map((bucket) => [bucket, 0]));
  for (const item of items) {
    const bucket = item.locationCleanup?.bucket || 'needs_manual_review';
    counts[bucket] = (counts[bucket] || 0) + 1;
  }
  return counts;
}

/**
 * @param {Object} input
 * @returns {Object}
 */
export function buildTvppLocationCleanupReport(input) {
  const items = cleanupItems(input);
  return {
    generatedAt: input.generatedAt,
    sourceDatasetId: 'tvpp-9vvx',
    source: 'NYC Permitted Event Information',
    fromDate: input.fromDate,
    limit: input.limit,
    rowCount: input.rowCount ?? items.length,
    itemCount: items.length,
    bucketCounts: buildBucketCounts(items),
    items,
  };
}
