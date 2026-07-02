/**
 * Pure helpers for NYCIF Event Sources v1 live schema spot-check.
 * No network calls — safe for unit tests.
 */

import { EVENT_SOURCES, isFetchableSocrataSource } from './event-source-config.mjs';

/**
 * @typedef {import('./event-source-config.mjs').EventSourceConfig} EventSourceConfig
 */

/**
 * @typedef {Object} SchemaRowSummary
 * @property {number} rowCount
 * @property {boolean} hasEmptyRows
 * @property {string[]} fieldNames
 * @property {Record<string, string[]>} fieldTypes
 */

/**
 * @param {EventSourceConfig[]} [sources]
 * @returns {EventSourceConfig[]}
 */
export function selectFetchableSchemaSources(sources = EVENT_SOURCES) {
  return sources.filter(isFetchableSocrataSource);
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function inferSimpleValueType(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  const kind = typeof value;
  if (kind === 'object') return 'object';
  if (kind === 'boolean') return 'boolean';
  if (kind === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  if (kind === 'string') return 'string';
  return kind;
}

/**
 * @param {Record<string, unknown>[]} rows
 * @returns {SchemaRowSummary}
 */
export function summarizeRowsForSchema(rows) {
  const fieldTypeSets = /** @type {Record<string, Set<string>>} */ ({});
  let hasEmptyRows = false;

  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).length === 0) {
      hasEmptyRows = true;
      continue;
    }

    for (const [field, value] of Object.entries(row)) {
      if (!fieldTypeSets[field]) fieldTypeSets[field] = new Set();
      fieldTypeSets[field].add(inferSimpleValueType(value));
    }
  }

  const fieldNames = Object.keys(fieldTypeSets).sort();
  const fieldTypes = Object.fromEntries(
    fieldNames.map((field) => [field, [...fieldTypeSets[field]].sort()]),
  );

  return {
    rowCount: rows.length,
    hasEmptyRows,
    fieldNames,
    fieldTypes,
  };
}
