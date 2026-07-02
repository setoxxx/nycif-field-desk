/**
 * TVPP Location Cleanup Parser v1.
 * Dev-only/read-only parser. It does not geocode, create coordinates, or write caches.
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
  [/\bEAST\b/gi, 'E'], [/\bWEST\b/gi, 'W'], [/\bNORTH\b/gi, 'N'], [/\bSOUTH\b/gi, 'S'],
  [/\bSTREET\b/gi, 'St'], [/\bAVENUE\b/gi, 'Ave'], [/\bBOULEVARD\b/gi, 'Blvd'],
  [/\bROAD\b/gi, 'Rd'], [/\bPLACE\b/gi, 'Pl'], [/\bLANE\b/gi, 'Ln'],
];

export function normalizeTvppLocationText(value) {
  let text = String(value ?? '').replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').replace(/\s*:\s*/g, ': ').trim();
  for (const [pattern, replacement] of STREET_REPLACEMENTS) text = text.replace(pattern, replacement);
  return text.replace(/\bbetween\b/gi, 'between').replace(/\band\b/gi, 'and').replace(/\s+/g, ' ').trim();
}

function norm(value) { return String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim(); }
function firstUseful(values) { for (const value of values) { const text = String(value ?? '').trim(); if (text) return text; } return ''; }
function isLowInfoText(text) { const normalized = norm(text); return !normalized || LOW_INFO.has(normalized) || normalized.length < 4; }
function looksLikeAddress(text) { return /^\d+\s+[A-Za-z0-9]/.test(text) && /\b(St|Ave|Blvd|Rd|Pl|Ln|Drive|Dr|Way|Broadway)\b/i.test(text); }
function looksLikeParkOrVenue(text) { return /\b(park|garden|plaza|square|promenade|terrace|field|lawn|fountain|playground|beach|pier|terminal|hall|center|centre|museum|library|school|church|theater|theatre)\b/i.test(text); }
function splitSegments(text) { return text.split(/\s*,\s*(?=[A-Z0-9]|E\s|W\s|N\s|S\s)/).map((segment) => segment.trim()).filter(Boolean); }
function parseBetweenSegment(segment) {
  const match = segment.match(/^(.*?)\s+between\s+(.*?)\s+and\s+(.*?)$/i);
  if (!match) return null;
  return { raw: segment, street: normalizeTvppLocationText(match[1]), from: normalizeTvppLocationText(match[2]), to: normalizeTvppLocationText(match[3]) };
}

export function classifyTvppLocationText(lead) {
  const raw = lead?.rawRecord || {};
  const originalLocationText = firstUseful([lead?.locationName, lead?.address, raw.event_location, raw.location]);
  const cleanedLocationText = normalizeTvppLocationText(originalLocationText);
  const borough = lead?.borough || raw.event_borough || null;
  const streetSide = raw.event_street_side || null;
  const streetClosureType = raw.street_closure_type || null;
  const base = { originalLocationText, cleanedLocationText, borough, streetSide, streetClosureType };

  if (!cleanedLocationText) {
    if (borough) return { ...base, bucket: 'borough_only', locationKind: 'borough_only', confidence: 'low', labels: ['borough_only'], reasons: ['Borough exists but no useful TVPP location text was found.'] };
    return { ...base, bucket: 'missing_location', locationKind: 'missing', confidence: 'high', labels: ['missing_location'], reasons: ['No location text or borough was available.'] };
  }
  if (isLowInfoText(cleanedLocationText)) return { ...base, bucket: 'needs_manual_review', locationKind: 'unknown', confidence: 'low', labels: ['low_information_location'], reasons: ['Location text is too generic for safe location cleanup.'] };
  if (borough && BOROUGHS.has(norm(cleanedLocationText)) && norm(cleanedLocationText) === norm(borough)) return { ...base, bucket: 'borough_only', locationKind: 'borough_only', confidence: 'low', labels: ['borough_only'], reasons: ['Location text only repeats the borough.'] };

  const segments = splitSegments(cleanedLocationText).map(parseBetweenSegment).filter(Boolean);
  if (segments.length > 1) return { ...base, bucket: 'route_or_multi_segment', locationKind: 'multi_segment_route', confidence: 'medium', components: { segments }, labels: ['multi_segment_route'], reasons: ['Multiple route/intersection-style segments detected; use first segment only as a review candidate.'] };
  const oneSegment = parseBetweenSegment(cleanedLocationText);
  if (oneSegment) return { ...base, bucket: 'intersection_candidate', locationKind: 'route', confidence: 'medium', components: { segments: [oneSegment] }, labels: ['between_segment'], reasons: ['Street segment between two cross streets detected.'] };
  if (/\b(at|@)\b/i.test(cleanedLocationText) || /\b(&|and)\b/i.test(cleanedLocationText)) return { ...base, bucket: 'intersection_candidate', locationKind: 'intersection', confidence: 'medium', labels: ['intersection_text'], reasons: ['Intersection-style text detected.'] };
  if (looksLikeAddress(cleanedLocationText)) return { ...base, bucket: 'clean_address_candidate', locationKind: 'street_address', confidence: 'high', labels: ['street_address'], reasons: ['Street address pattern detected.'] };
  if (looksLikeParkOrVenue(cleanedLocationText)) {
    const bucket = /\bpark\b/i.test(cleanedLocationText) ? 'park_area_candidate' : 'clean_venue_candidate';
    return { ...base, bucket, locationKind: 'venue_or_park', confidence: 'medium', labels: ['park_or_venue'], reasons: ['Park, venue, or named public place text detected.'] };
  }
  return { ...base, bucket: 'needs_manual_review', locationKind: 'unknown', confidence: 'low', labels: ['needs_operator_review'], reasons: ['Location text is present but did not match a safe cleanup pattern.'] };
}

function buildCandidateDisplayLocation(cleanup) {
  const segments = cleanup.components?.segments || [];
  if (segments.length) { const first = segments[0]; return `${first.street} between ${first.from} and ${first.to}`; }
  if (cleanup.cleanedLocationText?.includes(':')) return cleanup.cleanedLocationText.replace(/\s*:\s*/, ', ');
  return cleanup.cleanedLocationText || null;
}

function buildCandidateQuery(cleanup) {
  if (['missing_location', 'borough_only', 'needs_manual_review'].includes(cleanup.bucket)) return null;
  const display = buildCandidateDisplayLocation(cleanup);
  if (!display) return null;
  const borough = cleanup.borough ? `, ${cleanup.borough}` : '';
  const suffix = cleanup.locationKind === 'multi_segment_route' ? ' (first segment candidate only)' : '';
  return `${display.replace(/,/g, ' ')}${borough}, NY${suffix}`.replace(/\s+/g, ' ').trim();
}

export function parseTvppLocationCandidate(lead) {
  const classification = classifyTvppLocationText(lead);
  return {
    lead,
    locationCleanup: {
      bucket: classification.bucket,
      confidence: classification.confidence,
      originalLocationText: classification.originalLocationText || null,
      cleanedLocationText: classification.cleanedLocationText || null,
      locationKind: classification.locationKind,
      borough: classification.borough || null,
      candidateQuery: buildCandidateQuery(classification),
      candidateDisplayLocation: buildCandidateDisplayLocation(classification),
      streetSide: classification.streetSide || null,
      streetClosureType: classification.streetClosureType || null,
      components: classification.components || null,
      labels: classification.labels || [],
      reasons: classification.reasons || [],
    },
  };
}

export function countLocationCleanupBuckets(items) {
  const counts = Object.fromEntries(TVPP_LOCATION_CLEANUP_BUCKETS.map((bucket) => [bucket, 0]));
  for (const item of items || []) {
    const bucket = item.locationCleanup?.bucket || 'needs_manual_review';
    counts[bucket] = (counts[bucket] || 0) + 1;
  }
  return counts;
}

export function buildTvppLocationCleanupReport(input) {
  const items = (input.leads || []).map(parseTvppLocationCandidate);
  return {
    generatedAt: input.generatedAt,
    sourceDatasetId: 'tvpp-9vvx',
    source: 'NYC Permitted Event Information',
    fromDate: input.fromDate,
    limit: input.limit,
    rowCount: input.rowCount ?? items.length,
    itemCount: items.length,
    bucketCounts: countLocationCleanupBuckets(items),
    items,
  };
}
