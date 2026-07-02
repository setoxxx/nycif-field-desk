#!/usr/bin/env node
/**
 * Dev-only Parks sample pipeline — stdout JSON only.
 * Fetches fudw-fgrp base events, matching join rows, normalizes, enriches, prints JSON.
 * Does not write feeds, caches, or production files.
 */

import { getEventSourceById } from './event-source-config.mjs';
import { asString } from './event-lead.mjs';
import { enrichParksEventLead } from './normalizers/parks-joins.mjs';
import { normalizeEventLead } from './normalizers/index.mjs';
import {
  buildEventIdWhereClause,
  parseSamplePipelineArgs,
  printSamplePipelineHelp,
} from './parks-pipeline.mjs';
import { fetchSocrataSource } from './socrata-fetch.mjs';

/** @type {const} */
const JOIN_SOURCES = [
  { id: 'cpcm-i88g', key: 'locations' },
  { id: 'xtsw-fqvh', key: 'categories' },
  { id: 'ridc-7qqg', key: 'links' },
  { id: 'jk6k-yab4', key: 'organizers' },
];

/**
 * @param {number} limit
 * @returns {Promise<import('./event-lead.mjs').EventLead[]>}
 */
export async function runParksSamplePipeline(limit) {
  const baseSource = getEventSourceById('fudw-fgrp');
  if (!baseSource) {
    throw new Error('Missing fudw-fgrp source config');
  }

  const { rows: baseRows, fetchedAt } = await fetchSocrataSource(baseSource, { limit });
  const eventIds = [...new Set(baseRows.map((row) => asString(row.event_id)).filter(Boolean))];

  console.error(
    `Parks sample pipeline: ${baseRows.length} base row(s), ${eventIds.length} distinct event_id(s)`,
  );

  /** @type {import('./normalizers/parks-joins.mjs').ParksJoinRows} */
  const joins = {};
  const where = buildEventIdWhereClause(eventIds);

  if (where) {
    for (const { id, key } of JOIN_SOURCES) {
      const source = getEventSourceById(id);
      if (!source) {
        throw new Error(`Missing join source config: ${id}`);
      }
      const { rows } = await fetchSocrataSource(source, { where });
      joins[key] = rows;
      console.error(`  ${id} (${key}): ${rows.length} row(s)`);
    }
  } else {
    console.error('  no event_id values in base sample; skipping join fetches');
  }

  return baseRows.map((row) => {
    const baseLead = normalizeEventLead('fudw-fgrp', row, { lastFetchedAt: fetchedAt });
    return enrichParksEventLead(baseLead, joins);
  });
}

async function main() {
  const { limit, pretty, help } = parseSamplePipelineArgs();

  if (help) {
    printSamplePipelineHelp();
    return;
  }

  const leads = await runParksSamplePipeline(limit);
  const json = pretty ? JSON.stringify(leads, null, 2) : JSON.stringify(leads);
  console.log(json);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
