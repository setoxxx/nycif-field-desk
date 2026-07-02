#!/usr/bin/env node
/**
 * Dev-only TVPP location readiness audit — stdout JSON only.
 * Classifies normalized TVPP EventLead location text for future geocoding safety.
 * Does not geocode, write caches, or production files.
 */

import { parseTvppAssignmentFeedArgs } from './tvpp-assignment-feed.mjs';
import { runTvppAssignmentFeed } from './sample-tvpp-assignment-feed.mjs';
import {
  buildTvppLocationReadinessReport,
  printTvppLocationReadinessHelp,
} from './tvpp-location-readiness.mjs';

/**
 * @param {import('./tvpp-assignment-feed.mjs').TvppAssignmentFeedArgs} args
 * @returns {Promise<Object>}
 */
export async function runTvppLocationReadinessAudit(args) {
  const feedReport = await runTvppAssignmentFeed({ ...args, withTriage: false });
  const report = buildTvppLocationReadinessReport({
    generatedAt: new Date().toISOString(),
    fromDate: args.fromDate,
    limit: args.limit,
    rowCount: feedReport.rowCount,
    leads: feedReport.leads,
  });

  console.error('TVPP location readiness audit complete');
  console.error(`  itemCount: ${report.itemCount}`);
  console.error(`  locationBucketCounts: ${JSON.stringify(report.locationBucketCounts)}`);

  return report;
}

async function main() {
  const args = parseTvppAssignmentFeedArgs();

  if (args.help) {
    printTvppLocationReadinessHelp();
    return;
  }

  const report = await runTvppLocationReadinessAudit(args);
  const json = args.pretty ? JSON.stringify(report, null, 2) : JSON.stringify(report);
  console.log(json);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
