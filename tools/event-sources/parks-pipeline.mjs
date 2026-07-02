/**
 * Pure helpers for the dev-only Parks sample pipeline.
 * No network calls — safe for unit tests.
 */

export const DEFAULT_SAMPLE_LIMIT = 3;
export const MAX_SAMPLE_LIMIT = 10;

/**
 * @typedef {Object} SamplePipelineArgs
 * @property {number} limit
 * @property {boolean} pretty
 * @property {boolean} help
 */

/**
 * @param {string[]} [argv]
 * @returns {SamplePipelineArgs}
 */
export function parseSamplePipelineArgs(argv = process.argv.slice(2)) {
  let limit = DEFAULT_SAMPLE_LIMIT;
  let pretty = false;
  let help = false;

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
    }
  }

  if (!Number.isFinite(limit) || limit < 1) {
    limit = DEFAULT_SAMPLE_LIMIT;
  }
  if (limit > MAX_SAMPLE_LIMIT) {
    limit = MAX_SAMPLE_LIMIT;
  }

  return { limit, pretty, help };
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
  node tools/event-sources/sample-parks-pipeline.mjs [--limit N] [--pretty] [--help]

Options:
  --limit N   Sample size for fudw-fgrp base events (default ${DEFAULT_SAMPLE_LIMIT}, max ${MAX_SAMPLE_LIMIT})
  --pretty    Pretty-print JSON to stdout
  --help      Show this help

Notes:
  - stdout is JSON only; summary logs go to stderr
  - no files, feeds, or caches are written
  - not production feed output or map runtime wiring
`);
}
