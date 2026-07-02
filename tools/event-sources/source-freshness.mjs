/**
 * Pure helpers for Event Sources v4 multi-source freshness reporting.
 * No network calls — safe for unit tests.
 */

import {
  buildUpcomingDateWhereClause,
  DEFAULT_SAMPLE_LIMIT,
  DEFAULT_SAMPLE_ORDER,
  formatDateForSoql,
  MAX_SAMPLE_LIMIT,
  parseSamplePipelineArgs,
} from './parks-pipeline.mjs';

/** @typedef {import('./event-lead.mjs').EventLead} EventLead */
/** @typedef {'empty'|'current'|'stale'|'unknown'} FreshnessStatus */

export const CORE_SAMPLE_SOURCE_IDS = [
  'tvpp-9vvx',
  'fudw-fgrp',
  '6v4b-5gp4',
  '3vyj-dkjt',
  'tg4x-b46p',
];

/**
 * @typedef {import('./parks-pipeline.mjs').SamplePipelineArgs & { sourceFilter?: string|null }} MultiSourceFreshnessArgs
 */

/**
 * @param {string[]} [argv]
 * @param {{ today?: Date }} [context]
 * @returns {MultiSourceFreshnessArgs}
 */
export function parseMultiSourceFreshnessArgs(argv = process.argv.slice(2), context = {}) {
  const base = parseSamplePipelineArgs(argv, context);
  let sourceFilter = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--source') {
      sourceFilter = String(argv[++i] ?? '');
    } else if (arg.startsWith('--source=')) {
      sourceFilter = arg.slice('--source='.length);
    }
  }

  return { ...base, sourceFilter: sourceFilter || null };
}

/**
 * @param {MultiSourceFreshnessArgs} args
 * @returns {string[]}
 */
export function selectSampleSourceIds(args) {
  if (args.sourceFilter) {
    if (!CORE_SAMPLE_SOURCE_IDS.includes(args.sourceFilter)) {
      throw new Error(`Unsupported source ${args.sourceFilter}`);
    }
    return [args.sourceFilter];
  }
  return [...CORE_SAMPLE_SOURCE_IDS];
}

/**
 * @param {string} sourceDatasetId
 * @param {MultiSourceFreshnessArgs} args
 * @returns {{ limit: number, where?: string, order?: string }}
 */
export function buildSourceFetchOptions(sourceDatasetId, args) {
  const options = { limit: args.limit };

  if (!args.upcoming) {
    return options;
  }

  switch (sourceDatasetId) {
    case 'tvpp-9vvx':
      options.where = `start_date_time >= '${args.fromDate}T00:00:00'`;
      options.order = 'start_date_time ASC';
      break;
    case 'fudw-fgrp':
      options.where = buildUpcomingDateWhereClause(args.fromDate);
      options.order = DEFAULT_SAMPLE_ORDER;
      break;
    case '3vyj-dkjt':
      options.where = `event_date >= '${args.fromDate}'`;
      options.order = 'event_date ASC';
      break;
    case 'tg4x-b46p':
      options.where = `startdatetime >= '${args.fromDate}T00:00:00'`;
      options.order = 'startdatetime ASC';
      break;
    case '6v4b-5gp4':
      // date_and_time is free-text in live schema; upcoming filter omitted for safety
      break;
    default:
      break;
  }

  return options;
}

/**
 * @param {string|null|undefined} startDate
 * @returns {string|null}
 */
export function parseLeadStartDate(startDate) {
  if (startDate == null) return null;
  const text = String(startDate).trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

/**
 * @param {EventLead[]} leads
 * @param {string} [todayIso] YYYY-MM-DD
 * @returns {FreshnessStatus}
 */
export function classifyFreshness(leads, todayIso = formatDateForSoql(new Date())) {
  if (!leads.length) return 'empty';

  const dates = leads.map((lead) => parseLeadStartDate(lead.startDate)).filter(Boolean);
  if (!dates.length) return 'unknown';
  if (dates.some((date) => date >= todayIso)) return 'current';
  return 'stale';
}

/**
 * @param {EventLead[]} leads
 * @returns {{ min: string|null, max: string|null }}
 */
export function computeDateRange(leads) {
  const dates = leads
    .map((lead) => parseLeadStartDate(lead.startDate))
    .filter(Boolean)
    .sort();

  if (!dates.length) {
    return { min: null, max: null };
  }

  return { min: dates[0], max: dates[dates.length - 1] };
}

/**
 * @param {Object} input
 * @param {string} input.sourceDatasetId
 * @param {string} input.source
 * @param {number} input.rowCount
 * @param {EventLead[]} input.leads
 * @param {string} [input.todayIso]
 * @returns {Object}
 */
export function buildSourceFreshnessEntry({ sourceDatasetId, source, rowCount, leads, todayIso }) {
  return {
    sourceDatasetId,
    source,
    rowCount,
    leadCount: leads.length,
    dateRange: computeDateRange(leads),
    freshness: classifyFreshness(leads, todayIso),
    leads,
  };
}

/**
 * @param {Object[]} sources
 * @param {number} limit
 * @param {string} generatedAt
 * @returns {{ generatedAt: string, limit: number, sources: Object[] }}
 */
export function buildMultiSourceFreshnessReport(sources, limit, generatedAt) {
  return { generatedAt, limit, sources };
}

/**
 * @param {NodeJS.WritableStream} [stream]
 */
export function printMultiSourceFreshnessHelp(stream = process.stderr) {
  stream.write(`NYCIF Event Sources v4 — multi-source freshness report (stdout JSON only)

Usage:
  node tools/event-sources/sample-event-sources.mjs [options]

Options:
  --limit N          Sample size per source (default ${DEFAULT_SAMPLE_LIMIT}, max ${MAX_SAMPLE_LIMIT})
  --pretty           Pretty-print JSON to stdout
  --from-date DATE   Upcoming filter start date YYYY-MM-DD (default: today)
  --all-dates        Disable upcoming date filter where applicable
  --source ID        Sample one core source dataset id
  --help             Show this help

Core sources sampled:
  tvpp-9vvx, fudw-fgrp, 6v4b-5gp4, 3vyj-dkjt, tg4x-b46p

Notes:
  - Special Traffic Updates (dot-trafalrt) is documented_only and skipped
  - stdout is JSON only; summary logs go to stderr
  - no files, feeds, or caches are written
`);
}

export { DEFAULT_SAMPLE_LIMIT, MAX_SAMPLE_LIMIT };
