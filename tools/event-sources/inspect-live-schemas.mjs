#!/usr/bin/env node
/**
 * Dev-only live schema inspection for NYCIF Event Sources v1.
 * Read-only: prints to stdout, writes no feeds/caches/production files.
 *
 * Usage: node tools/event-sources/inspect-live-schemas.mjs
 */

import { fetchSocrataSource } from './socrata-fetch.mjs';
import { selectFetchableSchemaSources, summarizeRowsForSchema } from './schema-inspect.mjs';

const SAMPLE_LIMIT = 3;

/**
 * @param {import('./event-source-config.mjs').EventSourceConfig} source
 * @param {import('./schema-inspect.mjs').SchemaRowSummary} summary
 * @param {string} fetchUrl
 */
function printSourceSection(source, summary, fetchUrl) {
  console.log('='.repeat(72));
  console.log(`Source: ${source.name}`);
  console.log(`Key/ID: ${source.id}`);
  console.log(`URL: ${source.url}`);
  console.log(`Priority: ${source.priority}`);
  if (source.joinKey) console.log(`Join key: ${source.joinKey}`);
  console.log(`Fetch URL: ${fetchUrl}`);
  console.log(`Returned row count: ${summary.rowCount}`);
  console.log(`Has empty rows: ${summary.hasEmptyRows}`);
  console.log(`Observed fields (${summary.fieldNames.length}):`);
  for (const field of summary.fieldNames) {
    const types = summary.fieldTypes[field].join('|');
    console.log(`  - ${field}: ${types}`);
  }
  console.log('');
}

async function main() {
  const sources = selectFetchableSchemaSources();

  console.log('NYCIF Event Sources v1 — live schema spot-check');
  console.log(`Sample limit: ${SAMPLE_LIMIT} row(s) per source`);
  console.log(`Fetchable Socrata sources: ${sources.length}`);
  console.log('Skipped: documented_only and non-Socrata HTML sources');
  console.log('');

  for (const source of sources) {
    try {
      const { rows, url } = await fetchSocrataSource(source, { limit: SAMPLE_LIMIT });
      const summary = summarizeRowsForSchema(rows);
      printSourceSection(source, summary, url);
    } catch (error) {
      console.log('='.repeat(72));
      console.log(`Source: ${source.name}`);
      console.log(`Key/ID: ${source.id}`);
      console.log(`URL: ${source.url}`);
      console.log(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
      console.log('');
    }
  }

  console.log('='.repeat(72));
  console.log('Skipped source: Special Traffic Updates (dot-trafalrt)');
  console.log('Reason: html_scrape, status=documented_only — intentionally not fetched');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
