/**
 * Pure helpers for Event Sources v5 TVPP assignment feed candidate.
 * No network calls — safe for unit tests.
 */

import { formatDateForSoql } from './parks-pipeline.mjs';
import { computeDateRange } from './source-freshness.mjs';

/** @typedef {import('./event-lead.mjs').EventLead} EventLead */

export const TVPP_SOURCE_DATASET_ID = 'tvpp-9vvx';
export const TVPP_SOURCE_NAME = 'NYC Permitted Event Information';
export const DEFAULT_TVPP_FEED_LIMIT = 25;
export const MAX_TVPP_FEED_LIMIT = 100;
export const TVPP_FEED_ORDER = 'start_date_time ASC';

/**
 * @typedef {Object} TvppAssignmentFeedArgs
 * @property {number} limit
 * @property {boolean} pretty
 * @property {boolean} help
 * @property {string} fromDate YYYY-MM-DD
 * @property {string|null} borough
 * @property {string|null} eventType
 */

/**
 * @param {string} value
 * @returns {string}
 */
export function escapeSoqlString(value) {
  return String(value).replace(/'/g, "''");
}

/**
 * @param {{ fromDate: string, borough?: string|null, eventType?: string|null }} input
 * @returns {string}
 */
export function buildTvppWhereClause({ fromDate, borough = null, eventType = null }) {
  const clauses = [`start_date_time >= '${fromDate}T00:00:00'`];

  if (borough) {
    clauses.push(`event_borough = '${escapeSoqlString(borough)}'`);
  }
  if (eventType) {
    clauses.push(`event_type = '${escapeSoqlString(eventType)}'`);
  }

  return clauses.join(' AND ');
}

/**
 * @param {TvppAssignmentFeedArgs} args
 * @returns {{ limit: number, where: string, order: string }}
 */
export function buildTvppFetchOptions(args) {
  return {
    limit: args.limit,
    where: buildTvppWhereClause(args),
    order: TVPP_FEED_ORDER,
  };
}

/**
 * @param {string[]} [argv]
 * @param {{ today?: Date }} [context]
 * @returns {TvppAssignmentFeedArgs}
 */
export function parseTvppAssignmentFeedArgs(argv = process.argv.slice(2), context = {}) {
  const today = context.today ?? new Date();
  let limit = DEFAULT_TVPP_FEED_LIMIT;
  let pretty = false;
  let help = false;
  let fromDate = formatDateForSoql(today);
  let borough = null;
  let eventType = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--pretty') {
      pretty = true;
    } else if (arg === '--limit') {
      limit = Number(argv[++i]);
    } else if (arg.startsWith('--limit=')) {
      limit = Number(arg.slice('--limit='.length));
    } else if (arg === '--from-date') {
      fromDate = String(argv[++i] ?? fromDate);
    } else if (arg.startsWith('--from-date=')) {
      fromDate = arg.slice('--from-date='.length);
    } else if (arg === '--borough') {
      borough = String(argv[++i] ?? '').trim() || null;
    } else if (arg.startsWith('--borough=')) {
      borough = arg.slice('--borough='.length).trim() || null;
    } else if (arg === '--event-type') {
      eventType = String(argv[++i] ?? '').trim() || null;
    } else if (arg.startsWith('--event-type=')) {
      eventType = arg.slice('--event-type='.length).trim() || null;
    }
  }

  if (!Number.isFinite(limit) || limit < 1) {
    limit = DEFAULT_TVPP_FEED_LIMIT;
  }
  if (limit > MAX_TVPP_FEED_LIMIT) {
    limit = MAX_TVPP_FEED_LIMIT;
  }

  return { limit, pretty, help, fromDate, borough, eventType };
}

/**
 * @param {EventLead} lead
 * @returns {string}
 */
function leadSortKey(lead) {
  const date = lead.startDate ?? '';
  const time = lead.startTime ?? '';
  return `${date}T${time}`;
}

/**
 * @param {EventLead[]} leads
 * @returns {EventLead[]}
 */
export function sortLeadsByStartDateTime(leads) {
  return [...leads].sort((a, b) => leadSortKey(a).localeCompare(leadSortKey(b)));
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
export function buildTvppAssignmentFeedReport({
  generatedAt,
  fromDate,
  limit,
  rowCount,
  leads,
}) {
  const sortedLeads = sortLeadsByStartDateTime(leads);

  return {
    generatedAt,
    sourceDatasetId: TVPP_SOURCE_DATASET_ID,
    source: TVPP_SOURCE_NAME,
    fromDate,
    limit,
    rowCount,
    leadCount: sortedLeads.length,
    dateRange: computeDateRange(sortedLeads),
    leads: sortedLeads,
  };
}

/**
 * @param {NodeJS.WritableStream} [stream]
 */
export function printTvppAssignmentFeedHelp(stream = process.stderr) {
  stream.write(`NYCIF Event Sources v5 — TVPP assignment feed candidate (stdout JSON only)

Usage:
  node tools/event-sources/sample-tvpp-assignment-feed.mjs [options]

Options:
  --limit N          Max events to fetch (default ${DEFAULT_TVPP_FEED_LIMIT}, max ${MAX_TVPP_FEED_LIMIT})
  --pretty           Pretty-print JSON to stdout
  --from-date DATE   Upcoming filter start date YYYY-MM-DD (default: today)
  --borough NAME     Filter by event_borough (e.g. Manhattan)
  --event-type TYPE  Filter by event_type (e.g. "Street Event")
  --help             Show this help

Query:
  tvpp-9vvx only — start_date_time >= from-date, ordered start_date_time ASC

Notes:
  - stdout is JSON only; summary logs go to stderr
  - no files, feeds, or caches are written
  - photoPriorityScore remains null (scoring out of scope)
  - not production feed output or map runtime wiring
`);
}
