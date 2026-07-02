/**
 * Pure TVPP assignment triage helpers for Event Sources v5b.
 * Dev/operator metadata only — does not mutate EventLead or implement production scoring.
 * No network calls — safe for unit tests.
 */

import {
  sortLeadsByStartDateTime,
  TVPP_SOURCE_DATASET_ID,
  TVPP_SOURCE_NAME,
} from './tvpp-assignment-feed.mjs';
import { computeDateRange } from './source-freshness.mjs';

/** @typedef {import('./event-lead.mjs').EventLead} EventLead */
/** @typedef {'strong_assignment'|'possible_assignment'|'logistics_or_closure'|'low_value'|'needs_review'} TriageBucket */
/** @typedef {'high'|'medium'|'low'} TriageConfidence */

/** @typedef {Object} TvppTriage
 * @property {TriageBucket} bucket
 * @property {string[]} labels
 * @property {string[]} reasons
 * @property {TriageConfidence} confidence
 */

const LOW_INFORMATION_TITLES = new Set([
  '',
  'closed',
  'test',
  'n/a',
  'na',
  'none',
  'unknown',
  'tbd',
  'pending',
]);

const VISUAL_EVENT_KEYWORDS = [
  'parade',
  'procession',
  'festival',
  'fair',
  'march',
  'celebration',
  'block party',
  'block-party',
  'plaza',
  'cultural',
  'community',
  'ceremony',
  'memorial',
  'carnival',
  'concert',
];

const CLOSURE_KEYWORDS = [
  'closed',
  'closure',
  'street closure',
  'no parking',
  'setup',
  'teardown',
  'detour',
];

const PARK_KEYWORDS = ['park', 'plaza', 'playground', 'promenade'];

const SPORTS_KEYWORDS = ['race', 'marathon', 'run', '5k', '10k', 'tournament', 'soccer', 'baseball'];

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeTextForTriage(value) {
  if (value == null) return '';
  return String(value).trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * @param {unknown} title
 * @returns {boolean}
 */
export function isLowInformationTitle(title) {
  const normalized = normalizeTextForTriage(title);
  if (!normalized) return true;
  if (LOW_INFORMATION_TITLES.has(normalized)) return true;
  return normalized.length < 3;
}

/**
 * @param {string} text
 * @param {string[]} keywords
 * @returns {boolean}
 */
function containsAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

/**
 * @param {EventLead} lead
 * @returns {boolean}
 */
function hasActionableLocation(lead) {
  const location = normalizeTextForTriage(lead.locationName || lead.address);
  return location.length > 5;
}

/**
 * @param {EventLead} lead
 * @returns {TvppTriage}
 */
export function classifyTvppLead(lead) {
  const title = normalizeTextForTriage(lead.title);
  const eventType = normalizeTextForTriage(lead.eventType);
  const location = normalizeTextForTriage(lead.locationName || lead.address);
  const description = normalizeTextForTriage(lead.description);
  const combined = `${title} ${eventType} ${location} ${description}`.trim();

  /** @type {string[]} */
  const labels = [];
  /** @type {string[]} */
  const reasons = [];

  if (eventType.includes('street event')) labels.push('street_event');
  if (eventType.includes('special event')) labels.push('special_event');
  if (containsAny(combined, ['parade', 'procession', 'march'])) labels.push('parade_or_procession');
  if (containsAny(combined, ['festival', 'fair', 'carnival'])) labels.push('festival_or_fair');
  if (containsAny(combined, ['community', 'cultural', 'block party', 'block-party', 'neighborhood'])) {
    labels.push('community_event');
  }
  if (containsAny(combined, PARK_KEYWORDS)) labels.push('park_event');
  if (containsAny(combined, ['ceremony', 'memorial', 'vigil', 'celebration'])) {
    labels.push('ceremony_or_memorial');
  }
  if (containsAny(combined, SPORTS_KEYWORDS)) labels.push('sports_or_race');

  const hasClosureSignals = containsAny(`${title} ${description}`, CLOSURE_KEYWORDS);
  const hasVisualSignals = containsAny(combined, VISUAL_EVENT_KEYWORDS);
  const isStreetEvent = eventType.includes('street event');
  const isSpecialEvent = eventType.includes('special event');
  const lowTitle = isLowInformationTitle(lead.title);
  const meaningfulTitle = Boolean(title) && !lowTitle;
  const actionableLocation = hasActionableLocation(lead);
  const hasBoroughAndDate = Boolean(lead.borough && lead.startDate);

  if (!location) labels.push('missing_location');
  if (lowTitle) labels.push('low_information_title');
  if (hasClosureSignals) labels.push('closure_or_logistics');

  /** @type {TriageBucket} */
  let bucket = 'needs_review';
  /** @type {TriageConfidence} */
  let confidence = 'low';

  if (hasVisualSignals && hasClosureSignals) {
    bucket = 'needs_review';
    labels.push('needs_human_review');
    reasons.push('Conflicting visual-event and closure/logistics signals');
    confidence = 'low';
  } else if (hasClosureSignals && (lowTitle || title === 'closed')) {
    bucket = 'logistics_or_closure';
    reasons.push('Title or description indicates closure or logistics activity');
    confidence = title === 'closed' ? 'high' : 'medium';
  } else if (lowTitle && !actionableLocation && !hasVisualSignals && !isStreetEvent) {
    bucket = 'low_value';
    reasons.push('Low-information title with weak or missing location detail');
    confidence = 'high';
  } else if (isStreetEvent || (hasVisualSignals && (meaningfulTitle || actionableLocation))) {
    bucket = 'strong_assignment';
    if (isStreetEvent) {
      reasons.push('Street Event type with actionable event detail');
    } else {
      reasons.push('Visual or community event signals with enough detail to act on');
    }
    confidence = isStreetEvent && meaningfulTitle ? 'high' : 'medium';
  } else if (isSpecialEvent && meaningfulTitle && hasBoroughAndDate) {
    bucket = 'possible_assignment';
    reasons.push('Special Event with meaningful title, borough, and date');
    confidence = actionableLocation ? 'medium' : 'low';
  } else if (hasClosureSignals) {
    bucket = 'logistics_or_closure';
    reasons.push('Closure or logistics keywords detected');
    confidence = 'medium';
  } else if (!title && (eventType || location)) {
    bucket = 'needs_review';
    labels.push('needs_human_review');
    reasons.push('Missing title but event type or location is present');
    confidence = 'low';
  } else {
    bucket = 'needs_review';
    labels.push('needs_human_review');
    reasons.push('Signals did not match a confident triage bucket');
    confidence = 'low';
  }

  return {
    bucket,
    labels: [...new Set(labels)],
    reasons,
    confidence,
  };
}

/**
 * @param {EventLead[]} leads
 * @returns {{ lead: EventLead, triage: TvppTriage }[]}
 */
export function classifyTvppLeads(leads) {
  return sortLeadsByStartDateTime(leads).map((lead) => ({
    lead,
    triage: classifyTvppLead(lead),
  }));
}

/**
 * @param {{ lead: EventLead, triage: TvppTriage }[]} items
 * @returns {Record<TriageBucket, number>}
 */
export function countTriageBuckets(items) {
  /** @type {Record<TriageBucket, number>} */
  const counts = {
    strong_assignment: 0,
    possible_assignment: 0,
    logistics_or_closure: 0,
    low_value: 0,
    needs_review: 0,
  };

  for (const item of items) {
    counts[item.triage.bucket] += 1;
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
export function buildTvppTriagedFeedReport({
  generatedAt,
  fromDate,
  limit,
  rowCount,
  leads,
}) {
  const items = classifyTvppLeads(leads);
  const sortedLeads = items.map((item) => item.lead);
  const base = {
    generatedAt,
    sourceDatasetId: TVPP_SOURCE_DATASET_ID,
    source: TVPP_SOURCE_NAME,
    fromDate,
    limit,
    rowCount,
    leadCount: sortedLeads.length,
    itemCount: items.length,
    dateRange: computeDateRange(sortedLeads),
    bucketCounts: countTriageBuckets(items),
    items,
  };

  return base;
}
