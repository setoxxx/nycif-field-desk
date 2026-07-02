/**
 * Pure helpers for Event Sources v4b source-specific query tuning.
 * No network calls — safe for unit tests.
 */

import {
  DEFAULT_SAMPLE_LIMIT,
  formatDateForSoql,
  MAX_SAMPLE_LIMIT,
  parseSamplePipelineArgs,
} from './parks-pipeline.mjs';

/** @typedef {'empty'|'current'|'stale'|'unknown'} FreshnessStatus */
/** @typedef {'use_for_current_feed'|'use_for_historical_context'|'needs_query_fix'|'stale_or_empty'|'skip_for_now'} SourceRecommendationKind */

export const CORE_TUNING_SOURCE_IDS = [
  'tvpp-9vvx',
  'fudw-fgrp',
  '6v4b-5gp4',
  '3vyj-dkjt',
  'tg4x-b46p',
];

/**
 * @typedef {Object} QueryStrategy
 * @property {string} name
 * @property {{ where?: string, order?: string }} fetch
 */

/**
 * @typedef {Object} StrategySummary
 * @property {string} name
 * @property {number} rowCount
 * @property {{ min: string|null, max: string|null }|null} dateRange
 * @property {FreshnessStatus} freshness
 * @property {string[]} sampleDates
 */

/**
 * @typedef {import('./parks-pipeline.mjs').SamplePipelineArgs & { sourceFilter?: string|null }} QueryTuningArgs
 */

/**
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
export function parseDatePrefix(value) {
  if (value == null) return null;
  const text = String(value).trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

/**
 * @param {string[]} dates YYYY-MM-DD
 * @param {string} todayIso YYYY-MM-DD
 * @returns {FreshnessStatus}
 */
export function classifyFreshnessFromDates(dates, todayIso) {
  if (!dates.length) return 'unknown';
  if (dates.some((date) => date >= todayIso)) return 'current';
  return 'stale';
}

/**
 * @param {string[]} dates YYYY-MM-DD
 * @returns {{ min: string|null, max: string|null }}
 */
export function computeDateRangeFromDates(dates) {
  const sorted = [...dates].filter(Boolean).sort();
  if (!sorted.length) {
    return { min: null, max: null };
  }
  return { min: sorted[0], max: sorted[sorted.length - 1] };
}

/**
 * @param {Record<string, unknown>[]} rows
 * @param {(row: Record<string, unknown>) => string|null} extractDate
 * @returns {string[]}
 */
export function extractSampleDates(rows, extractDate) {
  const dates = [];
  for (const row of rows) {
    const parsed = parseDatePrefix(extractDate(row));
    if (parsed) dates.push(parsed);
  }
  return dates;
}

/**
 * @param {string} fromDate YYYY-MM-DD
 * @returns {QueryStrategy[]}
 */
export function buildTvppQueryStrategies(fromDate) {
  return [
    { name: 'default (limit only)', fetch: {} },
    {
      name: 'start_date_time >= today order ASC',
      fetch: {
        where: `start_date_time >= '${fromDate}T00:00:00'`,
        order: 'start_date_time ASC',
      },
    },
    {
      name: 'end_date_time >= today',
      fetch: {
        where: `end_date_time >= '${fromDate}T00:00:00'`,
        order: 'end_date_time ASC',
      },
    },
  ];
}

/**
 * @param {string} fromDate YYYY-MM-DD
 * @returns {QueryStrategy[]}
 */
export function buildParksQueryStrategies(fromDate) {
  return [
    {
      name: 'date >= today order ASC',
      fetch: {
        where: `date >= '${fromDate}T00:00:00.000'`,
        order: 'date ASC',
      },
    },
    {
      name: 'no filter order date DESC',
      fetch: { order: 'date DESC' },
    },
    {
      name: 'no filter order date ASC',
      fetch: { order: 'date ASC' },
    },
  ];
}

/**
 * @returns {QueryStrategy[]}
 */
export function buildPpdQueryStrategies() {
  return [{ name: 'no filter (free-text date_and_time)', fetch: {} }];
}

/**
 * @param {string} fromDate YYYY-MM-DD
 * @returns {QueryStrategy[]}
 */
export function buildSafetyQueryStrategies(fromDate) {
  return [
    {
      name: 'event_date >= today order ASC',
      fetch: {
        where: `event_date >= '${fromDate}'`,
        order: 'event_date ASC',
      },
    },
    {
      name: 'no filter order event_date DESC',
      fetch: { order: 'event_date DESC' },
    },
    {
      name: 'no filter order event_date ASC',
      fetch: { order: 'event_date ASC' },
    },
  ];
}

/**
 * @param {string} fromDate YYYY-MM-DD
 * @returns {QueryStrategy[]}
 */
export function buildFilmQueryStrategies(fromDate) {
  return [
    {
      name: 'startdatetime >= today order ASC',
      fetch: {
        where: `startdatetime >= '${fromDate}T00:00:00'`,
        order: 'startdatetime ASC',
      },
    },
    {
      name: 'enddatetime >= today order ASC',
      fetch: {
        where: `enddatetime >= '${fromDate}T00:00:00'`,
        order: 'enddatetime ASC',
      },
    },
    {
      name: 'no filter order startdatetime DESC',
      fetch: { order: 'startdatetime DESC' },
    },
    {
      name: 'no filter order startdatetime ASC',
      fetch: { order: 'startdatetime ASC' },
    },
  ];
}

/**
 * @param {string} sourceDatasetId
 * @param {string} fromDate YYYY-MM-DD
 * @returns {QueryStrategy[]}
 */
export function buildQueryStrategiesForSource(sourceDatasetId, fromDate) {
  switch (sourceDatasetId) {
    case 'tvpp-9vvx':
      return buildTvppQueryStrategies(fromDate);
    case 'fudw-fgrp':
      return buildParksQueryStrategies(fromDate);
    case '6v4b-5gp4':
      return buildPpdQueryStrategies();
    case '3vyj-dkjt':
      return buildSafetyQueryStrategies(fromDate);
    case 'tg4x-b46p':
      return buildFilmQueryStrategies(fromDate);
    default:
      throw new Error(`Unsupported tuning source ${sourceDatasetId}`);
  }
}

/**
 * @param {string} sourceDatasetId
 * @returns {(row: Record<string, unknown>) => string|null}
 */
export function getDateExtractorForSource(sourceDatasetId) {
  switch (sourceDatasetId) {
    case 'tvpp-9vvx':
      return (row) => (row.start_date_time == null ? null : String(row.start_date_time));
    case 'fudw-fgrp':
      return (row) => (row.date == null ? null : String(row.date));
    case '6v4b-5gp4':
      return (row) => (row.date_and_time == null ? null : String(row.date_and_time));
    case '3vyj-dkjt':
      return (row) => (row.event_date == null ? null : String(row.event_date));
    case 'tg4x-b46p':
      return (row) => {
        if (row.startdatetime != null) return String(row.startdatetime);
        if (row.enddatetime != null) return String(row.enddatetime);
        return null;
      };
    default:
      throw new Error(`Unsupported tuning source ${sourceDatasetId}`);
  }
}

/**
 * @param {string} name
 * @param {Record<string, unknown>[]} rows
 * @param {(row: Record<string, unknown>) => string|null} extractDate
 * @param {string} todayIso YYYY-MM-DD
 * @returns {StrategySummary}
 */
export function summarizeStrategyResult(name, rows, extractDate, todayIso) {
  const rowCount = rows.length;
  if (rowCount === 0) {
    return {
      name,
      rowCount: 0,
      dateRange: null,
      freshness: 'empty',
      sampleDates: [],
    };
  }

  const sampleDates = extractSampleDates(rows, extractDate);
  const dateRange = sampleDates.length ? computeDateRangeFromDates(sampleDates) : null;
  const freshness = classifyFreshnessFromDates(sampleDates, todayIso);

  return {
    name,
    rowCount,
    dateRange,
    freshness,
    sampleDates,
  };
}

/**
 * @param {string} sourceDatasetId
 * @param {StrategySummary[]} strategies
 * @param {string} todayIso YYYY-MM-DD
 * @returns {string}
 */
export function recommendSourceStrategy(sourceDatasetId, strategies, todayIso) {
  const withRows = strategies.filter((strategy) => strategy.rowCount > 0);
  const filteredCurrent = strategies.filter(
    (strategy) => strategy.freshness === 'current' && strategy.name.includes('>='),
  );
  const anyCurrent = strategies.filter((strategy) => strategy.freshness === 'current');
  const filteredEmpty = strategies.filter(
    (strategy) => strategy.freshness === 'empty' && strategy.name.includes('>='),
  );
  const unfiltered = strategies.filter((strategy) => strategy.name.startsWith('no filter'));

  if (filteredCurrent.length > 0) {
    return `use_for_current_feed — "${filteredCurrent[0].name}" returned current rows`;
  }

  if (anyCurrent.length > 0 && filteredEmpty.length > 0) {
    return 'needs_query_fix — unfiltered sample has current dates but date filter returns empty';
  }

  if (withRows.length === 0) {
    return 'stale_or_empty — all strategies returned zero rows';
  }

  if (withRows.every((strategy) => strategy.freshness === 'stale')) {
    if (sourceDatasetId === '6v4b-5gp4') {
      return 'stale_or_empty — PPD date_and_time is free-text; sampled dates remain old';
    }
    if (sourceDatasetId === 'tg4x-b46p') {
      return 'skip_for_now — Film Permits optional source; sampled permit dates are not current';
    }
    if (unfiltered.some((strategy) => strategy.rowCount > 0)) {
      return 'use_for_historical_context — dataset has rows but no upcoming dates under tested filters';
    }
    return 'stale_or_empty — sampled dates are all before today';
  }

  if (withRows.some((strategy) => strategy.freshness === 'unknown')) {
    return 'needs_query_fix — rows returned but dates could not be parsed reliably';
  }

  if (sourceDatasetId === 'tg4x-b46p') {
    return 'skip_for_now — Film Permits optional source; review strategy table before feed use';
  }

  void todayIso;
  return 'skip_for_now — inconclusive; review strategy table';
}

/**
 * @param {string} sourceDatasetId
 * @param {string} sourceName
 * @param {StrategySummary[]} strategies
 * @param {string} todayIso
 * @returns {{ sourceDatasetId: string, source: string, strategies: StrategySummary[], recommendation: string }}
 */
export function buildSourceTuningEntry(sourceDatasetId, sourceName, strategies, todayIso) {
  return {
    sourceDatasetId,
    source: sourceName,
    strategies,
    recommendation: recommendSourceStrategy(sourceDatasetId, strategies, todayIso),
  };
}

/**
 * @param {Object[]} sources
 * @param {string} todayIso
 * @param {string} generatedAt
 * @returns {{ generatedAt: string, today: string, sources: Object[] }}
 */
export function buildQueryTuningReport(sources, todayIso, generatedAt) {
  return { generatedAt, today: todayIso, sources };
}

/**
 * @param {string[]} [argv]
 * @param {{ today?: Date }} [context]
 * @returns {QueryTuningArgs}
 */
export function parseQueryTuningArgs(argv = process.argv.slice(2), context = {}) {
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
 * @param {QueryTuningArgs} args
 * @returns {string[]}
 */
export function selectTuningSourceIds(args) {
  if (args.sourceFilter) {
    if (!CORE_TUNING_SOURCE_IDS.includes(args.sourceFilter)) {
      throw new Error(`Unsupported source ${args.sourceFilter}`);
    }
    return [args.sourceFilter];
  }
  return [...CORE_TUNING_SOURCE_IDS];
}

/**
 * @param {Date} [today]
 * @returns {string}
 */
export function todayIsoDate(today = new Date()) {
  return formatDateForSoql(today);
}

/**
 * @param {NodeJS.WritableStream} [stream]
 */
export function printQueryTuningHelp(stream = process.stderr) {
  stream.write(`NYCIF Event Sources v4b — source query tuning report (stdout JSON only)

Usage:
  node tools/event-sources/tune-event-source-queries.mjs [options]

Options:
  --limit N          Sample size per strategy (default ${DEFAULT_SAMPLE_LIMIT}, max ${MAX_SAMPLE_LIMIT})
  --pretty           Pretty-print JSON to stdout
  --from-date DATE   "Today" for date filters YYYY-MM-DD (default: today)
  --source ID        Tune one core source dataset id
  --help             Show this help

Core sources tuned:
  tvpp-9vvx, fudw-fgrp, 6v4b-5gp4, 3vyj-dkjt, tg4x-b46p

Notes:
  - Special Traffic Updates (dot-trafalrt) is documented_only and skipped
  - stdout is JSON only; summary logs go to stderr
  - no files, feeds, or caches are written
  - diagnoses whether empty/stale results need query adjustment
`);
}

export { DEFAULT_SAMPLE_LIMIT, MAX_SAMPLE_LIMIT };
