#!/usr/bin/env node
/**
 * Dev-only multi-source freshness report — stdout JSON only.
 * Samples core NYC event sources, normalizes leads, reports freshness.
 * Does not write feeds, caches, or production files.
 */

import { getEventSourceById } from './event-source-config.mjs';
import { normalizeEventLead } from './normalizers/index.mjs';
import { fetchSocrataSource } from './socrata-fetch.mjs';
import { runParksSamplePipeline } from './sample-parks-pipeline.mjs';
import {
  buildMultiSourceFreshnessReport,
  buildSourceFetchOptions,
  buildSourceFreshnessEntry,
  CORE_SAMPLE_SOURCE_IDS,
  parseMultiSourceFreshnessArgs,
  printMultiSourceFreshnessHelp,
  selectSampleSourceIds,
} from './source-freshness.mjs';
import { formatDateForSoql } from './parks-pipeline.mjs';

/**
 * @param {import('./source-freshness.mjs').MultiSourceFreshnessArgs} args
 * @returns {Promise<import('./source-freshness.mjs').Object[]>}
 */
export async function runMultiSourceFreshnessReport(args, context = {}) {
  const sourceIds = selectSampleSourceIds(args);
  const today = context.today ?? new Date();
  const todayIso = formatDateForSoql(today);
  /** @type {Object[]} */
  const sources = [];

  for (const sourceDatasetId of sourceIds) {
    const sourceConfig = getEventSourceById(sourceDatasetId);
    if (!sourceConfig) {
      throw new Error(`Missing source config for ${sourceDatasetId}`);
    }

    console.error(`Sampling ${sourceDatasetId} (${sourceConfig.name})`);

    if (sourceDatasetId === 'fudw-fgrp') {
      const leads = await runParksSamplePipeline(args);
      sources.push(buildSourceFreshnessEntry({
        sourceDatasetId,
        source: sourceConfig.name,
        rowCount: leads.length,
        leads,
        todayIso,
      }));
      console.error(`  freshness: ${sources[sources.length - 1].freshness}, leads: ${leads.length}`);
      continue;
    }

    const fetchOptions = buildSourceFetchOptions(sourceDatasetId, args);
    const { rows, fetchedAt, url } = await fetchSocrataSource(sourceConfig, fetchOptions);
    const leads = rows.map((row) => normalizeEventLead(sourceDatasetId, row, { lastFetchedAt: fetchedAt }));

    console.error(`  fetch: ${url}`);
    console.error(`  rows: ${rows.length}, leads: ${leads.length}`);

    const entry = buildSourceFreshnessEntry({
      sourceDatasetId,
      source: sourceConfig.name,
      rowCount: rows.length,
      leads,
      todayIso,
    });
    sources.push(entry);
    console.error(`  freshness: ${entry.freshness}, dateRange: ${entry.dateRange.min ?? 'null'}..${entry.dateRange.max ?? 'null'}`);
  }

  console.error(`Skipped documented_only source: dot-trafalrt (Special Traffic Updates)`);
  console.error(`Core catalog: ${CORE_SAMPLE_SOURCE_IDS.join(', ')}`);

  return sources;
}

import { pathToFileURL } from 'node:url';

async function main() {
  const args = parseMultiSourceFreshnessArgs();

  if (args.help) {
    printMultiSourceFreshnessHelp();
    return;
  }

  const generatedAt = new Date().toISOString();
  const sourceReports = await runMultiSourceFreshnessReport(args);
  const report = buildMultiSourceFreshnessReport(sourceReports, args.limit, generatedAt);
  const json = args.pretty ? JSON.stringify(report, null, 2) : JSON.stringify(report);
  console.log(json);
}

const isMainProcess = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainProcess) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
