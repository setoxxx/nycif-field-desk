/**
 * Read-only Socrata fetch helper for NYCIF Event Sources v0.
 * Does not write to disk, caches, or production feeds.
 */

import { isFetchableSocrataSource } from './event-source-config.mjs';

/**
 * @typedef {import('./event-source-config.mjs').EventSourceConfig} EventSourceConfig
 */

/**
 * @typedef {Object} SocrataFetchOptions
 * @property {number} [limit]
 * @property {string} [where]
 * @property {string} [order]
 * @property {number} [offset]
 * @property {Record<string, string>} [params] Additional Socrata query params
 */

/**
 * @typedef {Object} SocrataFetchResult
 * @property {Record<string, unknown>[]} rows
 * @property {string} url
 * @property {string} fetchedAt
 * @property {EventSourceConfig} source
 */

/**
 * @param {EventSourceConfig} source
 * @param {SocrataFetchOptions} [options]
 * @returns {string}
 */
export function buildSocrataRequestUrl(source, options = {}) {
  if (!isFetchableSocrataSource(source)) {
    throw new Error(`Source ${source.id} is not fetchable via Socrata JSON`);
  }

  const url = new URL(source.url);
  if (options.limit != null) url.searchParams.set('$limit', String(options.limit));
  if (options.where) url.searchParams.set('$where', options.where);
  if (options.order) url.searchParams.set('$order', options.order);
  if (options.offset != null) url.searchParams.set('$offset', String(options.offset));

  for (const [key, value] of Object.entries(options.params || {})) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

/**
 * @param {EventSourceConfig} source
 * @param {SocrataFetchOptions} [options]
 * @returns {Promise<SocrataFetchResult>}
 */
export async function fetchSocrataSource(source, options = {}) {
  const url = buildSocrataRequestUrl(source, options);
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'NYCIF-event-sources-v0/1.0',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Socrata fetch failed for ${source.id}: HTTP ${response.status}`);
  }

  const rows = await response.json();
  if (!Array.isArray(rows)) {
    throw new Error(`Socrata fetch for ${source.id} did not return a JSON array`);
  }

  return {
    rows,
    url,
    fetchedAt: new Date().toISOString(),
    source,
  };
}
