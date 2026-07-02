#!/usr/bin/env node
/**
 * Dev-only TVPP assignment feed candidate — stdout JSON only.
 * Fetches current/upcoming NYC Permitted Event Information, normalizes to EventLead.
 * Does not write feeds, caches, or production files.
 */

import { getEventSourceById } from './event-source-config.mjs';
import { normalizeEventLead } from './normalizers/index.mjs';
import { fetchSocrataSource } from './socrata-fetch.mjs';
import {
  buildTvppAssignmentFeedReport,
  buildTvppFetchOptions,
  parseTvppAssignmentFeedArgs,
  printTvppAssignmentFeedHelp,
  TVPP_SOURCE_DATASET_ID,
} from './tvpp-assignment-feed.mjs';

/**
 * @param {import('./tvpp-assignment-feed.mjs').TvppAssignmentFeedArgs} args
 * @returns {Promise<Object>}
 */
export async function runTvppAssignmentFeed(args) {
  const source = getEventSourceById(TVPP_SOURCE_DATASET_ID);
  if (!source) {
    throw new Error(`Missing source config for ${TVPP_SOURCE_DATASET_ID}`);
  }

  const fetchOptions = buildTvppFetchOptions(args);
  const { rows, fetchedAt, url } = await fetchSocrataSource(source, fetchOptions);

  console.error(`TVPP assignment feed: ${rows.length} row(s) from ${TVPP_SOURCE_DATASET_ID}`);
  console.error(`  fetch: ${url}`);
  console.error(`  fromDate: ${args.fromDate}, limit: ${args.limit}`);
  if (args.borough) console.error(`  borough filter: ${args.borough}`);
  if (args.eventType) console.error(`  event-type filter: ${args.eventType}`);

  const leads = rows.map((row) => normalizeEventLead(TVPP_SOURCE_DATASET_ID, row, {
    lastFetchedAt: fetchedAt,
  }));

  const generatedAt = new Date().toISOString();
  const report = buildTvppAssignmentFeedReport({
    generatedAt,
    fromDate: args.fromDate,
    limit: args.limit,
    rowCount: rows.length,
    leads,
  });

  console.error(`  leadCount: ${report.leadCount}, dateRange: ${report.dateRange.min ?? 'null'}..${report.dateRange.max ?? 'null'}`);

  return report;
}

async function main() {
  const args = parseTvppAssignmentFeedArgs();

  if (args.help) {
    printTvppAssignmentFeedHelp();
    return;
  }

  const report = await runTvppAssignmentFeed(args);
  const json = args.pretty ? JSON.stringify(report, null, 2) : JSON.stringify(report);
  console.log(json);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
