#!/usr/bin/env node
/**
 * Dev-only source query tuning diagnostic — stdout JSON only.
 * Tests candidate Socrata query strategies per core source.
 * Does not write feeds, caches, or production files.
 */

import { getEventSourceById } from './event-source-config.mjs';
import {
  buildQueryStrategiesForSource,
  buildQueryTuningReport,
  buildSourceTuningEntry,
  getDateExtractorForSource,
  parseQueryTuningArgs,
  printQueryTuningHelp,
  selectTuningSourceIds,
  summarizeStrategyResult,
  todayIsoDate,
} from './query-tuning.mjs';
import { fetchSocrataSource } from './socrata-fetch.mjs';

/**
 * @param {import('./event-source-config.mjs').EventSourceConfig} source
 * @param {import('./query-tuning.mjs').QueryStrategy} strategy
 * @param {number} limit
 * @param {string} todayIso
 * @returns {Promise<import('./query-tuning.mjs').StrategySummary>}
 */
async function runStrategy(source, strategy, limit, todayIso) {
  const extractDate = getDateExtractorForSource(source.id);
  const fetchOptions = { limit, ...strategy.fetch };
  const { rows, url } = await fetchSocrataSource(source, fetchOptions);

  console.error(`  ${strategy.name}: ${rows.length} row(s)`);
  console.error(`    ${url}`);

  return summarizeStrategyResult(strategy.name, rows, extractDate, todayIso);
}

/**
 * @param {import('./event-source-config.mjs').EventSourceConfig} source
 * @param {import('./query-tuning.mjs').QueryTuningArgs} args
 * @param {string} todayIso
 * @returns {Promise<ReturnType<typeof buildSourceTuningEntry>>}
 */
async function tuneSource(source, args, todayIso) {
  const strategies = buildQueryStrategiesForSource(source.id, args.fromDate);
  console.error(`Tuning ${source.id} (${source.name}) — ${strategies.length} strateg(ies)`);

  /** @type {import('./query-tuning.mjs').StrategySummary[]} */
  const summaries = [];
  for (const strategy of strategies) {
    summaries.push(await runStrategy(source, strategy, args.limit, todayIso));
  }

  const entry = buildSourceTuningEntry(source.id, source.name, summaries, todayIso);
  console.error(`  recommendation: ${entry.recommendation}`);
  return entry;
}

async function main() {
  const args = parseQueryTuningArgs();

  if (args.help) {
    printQueryTuningHelp();
    return;
  }

  const todayIso = args.fromDate || todayIsoDate();
  const sourceIds = selectTuningSourceIds(args);
  const generatedAt = new Date().toISOString();

  console.error(`Query tuning report — today=${todayIso}, limit=${args.limit}, sources=${sourceIds.join(', ')}`);

  /** @type {ReturnType<typeof buildSourceTuningEntry>[]} */
  const sources = [];
  for (const sourceId of sourceIds) {
    const source = getEventSourceById(sourceId);
    if (!source) {
      throw new Error(`Missing source config: ${sourceId}`);
    }
    sources.push(await tuneSource(source, args, todayIso));
  }

  const report = buildQueryTuningReport(sources, todayIso, generatedAt);
  const json = args.pretty ? JSON.stringify(report, null, 2) : JSON.stringify(report);
  console.log(json);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
