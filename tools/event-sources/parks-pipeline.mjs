/**
 * Pure helpers for the dev-only Parks sample pipeline.
 * No network calls — safe for unit tests.
 */

export const DEFAULT_SAMPLE_LIMIT = 3;
export const MAX_SAMPLE_LIMIT = 10;
export const DEFAULT_SAMPLE_ORDER = 'date ASC';

/**
 * @typedef {Object} SamplePipelineArgs
 * @property {number} limit
 * @property {boolean} pretty
 * @property {boolean} help
 * @property {boolean} upcoming
 * @property {string} fromDate YYYY-MM-DD
 * @property {string} order
 */

/**
 * @param {Date} date
 * @returns {string}
 */
export function formatDateForSoql(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * @param {string} fromDate YYYY-MM-DD
 * @returns {string}
 */
export function buildUpcomingDateWhereClause(fromDate) {
  return `date >= '${fromDate}T00:00:00.000'`;
}

/**
 * @param {SamplePipelineArgs} args
 * @returns {{ limit: number, where?: string, order?: string }}
 */
export function buildBaseFetchOptions(args) {
  const options = { limit: args.limit };

  if (args.upcoming) {
    options.where = buildUpcomingDateWhereClause(args.fromDate);
    options.order = args.order;
  }

  return options;
}

/**
 * @param {string[]} argv
 * @param {{ today?: Date }} [context]
 * @returns {SamplePipelineArgs}
 */
export function parseSamplePipelineArgs(argv = process.argv.slice(2), context = {}) {
  const today = context.today ?? new Date();
  let limit = DEFAULT_SAMPLE_LIMIT;
  let pretty = false;
  let help = false;
  let upcoming = true;
  let fromDate = formatDateForSoql(today);
  let order = DEFAULT_SAMPLE_ORDER;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--pretty') {
      pretty = true;
    } else if (arg === '--upcoming') {
      upcoming = true;
    } else if (arg === '--no-upcoming' || arg === '--all-dates') {
      upcoming = false;
    } else if (arg === '--limit') {
      limit = Number(argv[++i]);
    } else if (arg.startsWith('--limit=')) {
      limit = Number(arg.slice('--limit='.length));
    } else if (arg === '--from-date') {
      fromDate = String(argv[++i] ?? fromDate);
    } else if (arg.startsWith('--from-date=')) {
      fromDate = arg.slice('--from-date='.length);
    } else if (arg === '--order') {
      order = String(argv[++i] ?? order);
    } else if (arg.startsWith('--order=')) {
      order = arg.slice('--order='.length);
    }
  }

  if (!Number.isFinite(limit) || limit < 1) {
    limit = DEFAULT_SAMPLE_LIMIT;
  }
  if (limit > MAX_SAMPLE_LIMIT) {
    limit = MAX_SAMPLE_LIMIT;
  }

  return { limit, pretty, help, upcoming, fromDate, order };
}

/**
 * @param {string[]} eventIds
 * @returns {string|null}
 */
export function buildEventIdWhereClause(eventIds) {
  const ids = eventIds.map((id) => String(id).trim()).filter(Boolean);
  if (!ids.length) return null;

  const quoted = ids.map((id) => `'${id.replace(/'/g, "''")}'`);
  return `event_id in (${quoted.join(',')})`;
}

/**
 * @param {Record<string, unknown>[]} rows
 * @returns {Record<string, Record<string, unknown>[]>}
 */
export function groupRowsByEventId(rows) {
  /** @type {Record<string, Record<string, unknown>[]>} */
  const grouped = {};

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const eventId = row.event_id == null ? '' : String(row.event_id).trim();
    if (!eventId) continue;
    if (!grouped[eventId]) grouped[eventId] = [];
    grouped[eventId].push(row);
  }

  return grouped;
}

/**
 * @param {NodeJS.WritableStream} [stream]
 */
export function printSamplePipelineHelp(stream = process.stderr) {
  stream.write(`NYCIF Event Sources v3 — dev Parks sample pipeline (stdout JSON only)

Usage:
  node tools/event-sources/sample-parks-pipeline.mjs [options]

Options:
  --limit N          Sample size for fudw-fgrp base events (default ${DEFAULT_SAMPLE_LIMIT}, max ${MAX_SAMPLE_LIMIT})
  --pretty           Pretty-print JSON to stdout
  --from-date DATE   Upcoming filter start date YYYY-MM-DD (default: today)
  --no-upcoming      Disable upcoming date filter (alias: --all-dates)
  --order EXPR       Socrata $order expression (default: ${DEFAULT_SAMPLE_ORDER})
  --help             Show this help

Notes:
  - upcoming date filter is enabled by default
  - stdout is JSON only; summary logs go to stderr
  - no files, feeds, or caches are written
  - not production feed output or map runtime wiring
`);
}
