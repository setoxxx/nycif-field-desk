/**
 * Admin Data Snapshots v0 — read-only JSON under admin/data/.
 * Uses existing Event Sources dev tooling. Does not geocode, write feeds, or touch map runtime.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { getEventSourceById } from './event-source-config.mjs';
import { hasEventLeadShape } from './event-lead.mjs';
import { normalizeEventLead } from './normalizers/index.mjs';
import { runMultiSourceFreshnessReport } from './sample-event-sources.mjs';
import { fetchSocrataSource } from './socrata-fetch.mjs';
import { parseMultiSourceFreshnessArgs } from './source-freshness.mjs';
import {
  buildTvppAssignmentFeedReport,
  buildTvppFetchOptions,
  DEFAULT_TVPP_FEED_LIMIT,
  MAX_TVPP_FEED_LIMIT,
  parseTvppAssignmentFeedArgs,
  TVPP_SOURCE_DATASET_ID,
} from './tvpp-assignment-feed.mjs';
import { buildTvppLocationCleanupReport } from './tvpp-location-cleanup.mjs';
import { buildTvppLocationReadinessReport } from './tvpp-location-readiness.mjs';
import { buildTvppTriagedFeedReport } from './tvpp-triage.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = path.resolve(__dirname, '../..');
export const ADMIN_DATA_DIR = path.join(REPO_ROOT, 'admin', 'data');
export const SNAPSHOT_TOOL = 'build-admin-data-snapshots';
export const SNAPSHOT_VERSION = 'v0';

export const ADMIN_SNAPSHOT_FILENAMES = [
  'project-status.json',
  'source-freshness.json',
  'tvpp-candidates.json',
  'tvpp-triage.json',
  'tvpp-location-readiness.json',
  'tvpp-location-cleanup.json',
  'index.json',
];

/** Paths that must never be written by the snapshot builder. */
export const FORBIDDEN_SNAPSHOT_WRITE_PREFIXES = [
  'data/nycif_staged_live_events.json',
  'data/location_cache.json',
  'sw.js',
  'service-worker.js',
  'index.html',
  'map/',
  'wordpress/',
  'xri/',
  '.github/workflows/',
];

/**
 * @typedef {Object} AdminSnapshotBuildArgs
 * @property {number} limit
 * @property {boolean} pretty
 * @property {boolean} help
 * @property {string} fromDate
 * @property {string|null} borough
 * @property {string|null} eventType
 */

/**
 * @param {string} filename
 * @param {string} [adminDataDir]
 * @returns {string}
 */
export function resolveAdminDataFilePath(filename, adminDataDir = ADMIN_DATA_DIR) {
  if (!ADMIN_SNAPSHOT_FILENAMES.includes(filename)) {
    throw new Error(`Disallowed admin snapshot filename: ${filename}`);
  }

  const resolved = path.resolve(adminDataDir, filename);
  const adminRoot = path.resolve(adminDataDir);
  if (resolved !== adminRoot && !resolved.startsWith(`${adminRoot}${path.sep}`)) {
    throw new Error(`Path escapes admin/data: ${filename}`);
  }

  return resolved;
}

/**
 * @param {string} filePath
 * @param {string} [adminDataDir]
 */
export function assertWritableAdminPath(filePath, adminDataDir = ADMIN_DATA_DIR) {
  const resolved = path.resolve(filePath);
  const adminRoot = path.resolve(adminDataDir);
  if (resolved !== adminRoot && !resolved.startsWith(`${adminRoot}${path.sep}`)) {
    throw new Error(`Write blocked outside admin/data: ${filePath}`);
  }
}

/**
 * @param {string} relativePath
 * @returns {boolean}
 */
export function isForbiddenSnapshotWritePath(relativePath) {
  const normalized = String(relativePath).replace(/\\/g, '/');
  return FORBIDDEN_SNAPSHOT_WRITE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

/**
 * @param {string} generatedAt
 * @returns {Object}
 */
export function buildProjectStatusSnapshot(generatedAt) {
  return {
    generatedAt,
    tool: SNAPSHOT_TOOL,
    version: SNAPSHOT_VERSION,
    projectName: 'NYCIF Field Desk',
    adminMode: 'read_only',
    snapshotsPurpose: 'visibility-only admin data for operators; not production feed output',
    publicMapStatus: {
      summary: 'Production map operational and gated; Event Sources work does not modify map runtime.',
      productionWired: false,
      note: 'Admin snapshots are not consumed by the public map.',
    },
    adminDashboardStatus: {
      summary: 'Static admin skeleton exists; data panels not wired yet.',
      dataSnapshots: 'v0 generated under admin/data/',
      wiringStatus: 'not_wired',
    },
    eventSourcesStatus: {
      summary: 'Dev tooling covers inventory, normalizers, freshness, TVPP candidate feed, triage, and location readiness audit.',
      productionFeedWrites: false,
      geocoding: false,
    },
    productionMapWiringStatus: {
      summary: 'No admin snapshot or Event Sources dev output is wired into the live map.',
      feedUrlChanged: false,
      mapRuntimeChanged: false,
    },
    warnings: [
      'Admin data snapshots are visibility-only and must not be treated as production feed JSON.',
      'Snapshots do not create GPS coordinates, call geocoding APIs, or write geocode caches.',
      'Triage and locationReadiness metadata are operator hints only — not approval or map visibility controls.',
    ],
    masterCompletionTracker: [
      {
        area: 'Production map current scope',
        completion: '85–90%',
        summary: 'Existing map/feeds are operational and gated. Remaining work is geocodes, QA, more sources, and controlled promotion.',
      },
      {
        area: 'Event Sources dev tooling',
        completion: '94–97%',
        summary: 'Source inventory, normalizers, sample pipelines, freshness, query tuning, TVPP candidate feed, triage, and location readiness audit are built.',
      },
      {
        area: 'TVPP assignment-feed candidate',
        completion: '89–93%',
        summary: 'TVPP is current, normalized, sampled, triaged, and location-audited. No geocoding, production feed file, scoring, or map wiring.',
      },
      {
        area: 'Event API pipeline overall',
        completion: '82–87% dev-side / 0% production-side',
        summary: 'Dev proof is strong. Production output, scheduled generation, cache/feed writes, and map integration are intentionally not done.',
      },
      {
        area: 'Admin / Operator dashboard',
        completion: '35–40%',
        summary: 'Requirement documented; static skeleton exists; admin data snapshots v0 available; data panels not wired.',
      },
      {
        area: 'XRI registry roadmap',
        completion: '33%',
        summary: 'G0–G3 merged. G4–G11 not started.',
      },
      {
        area: 'XRI registry implementation',
        completion: '0%',
        summary: 'No extractor, registry DB, reconciliation, seed workflow, UI, feeds, or WordPress integration.',
      },
      {
        area: 'WordPress / nycinfocus.com integration',
        completion: '0%',
        summary: 'Intentionally untouched.',
      },
      {
        area: 'Full NYCIF platform vision',
        completion: '60–68%',
        summary: 'Production map exists and Event Sources intelligence is stronger, but admin dashboard, XRI, WordPress, production event feed integration, and automation remain incomplete.',
      },
    ],
  };
}

/**
 * @param {import('./source-freshness.mjs').FreshnessStatus} freshness
 * @param {string} sourceDatasetId
 * @returns {string}
 */
export function deriveFreshnessRecommendation(freshness, sourceDatasetId) {
  switch (freshness) {
    case 'current':
      return 'use_for_current_feed';
    case 'stale':
      return sourceDatasetId === '6v4b-5gp4'
        ? 'stale_or_empty — PPD date_and_time is free-text; sampled dates may be old'
        : 'use_for_historical_context';
    case 'empty':
      return 'stale_or_empty';
    case 'unknown':
      return 'needs_query_fix';
    default:
      return 'skip_for_now';
  }
}

/**
 * @param {Object} entry
 * @returns {string[]}
 */
export function buildFreshnessWarnings(entry) {
  /** @type {string[]} */
  const warnings = [];

  if (entry.freshness === 'empty') {
    warnings.push('No rows returned under the upcoming sample filter.');
  }
  if (entry.freshness === 'stale') {
    warnings.push('Sampled dates appear older than today under the current filter.');
  }
  if (entry.freshness === 'unknown') {
    warnings.push('Could not infer current/upcoming dates from sampled rows.');
  }
  if (entry.rowCount === 0) {
    warnings.push('Zero rows fetched.');
  }

  return warnings;
}

/**
 * @param {Object} entry
 * @param {import('./event-source-config.mjs').EventSourceConfig|undefined} sourceConfig
 * @returns {Object}
 */
export function summarizeSourceFreshnessForAdmin(entry, sourceConfig) {
  return {
    sourceDatasetId: entry.sourceDatasetId,
    source: entry.source,
    url: sourceConfig?.url ?? null,
    rowCount: entry.rowCount,
    leadCount: entry.leadCount,
    freshness: entry.freshness,
    dateRange: entry.dateRange,
    recommendation: deriveFreshnessRecommendation(entry.freshness, entry.sourceDatasetId),
    warnings: buildFreshnessWarnings(entry),
  };
}

/**
 * @param {import('./event-source-config.mjs').EventSourceConfig} sourceConfig
 * @returns {Object}
 */
export function buildDocumentedOnlySourceEntry(sourceConfig) {
  return {
    sourceDatasetId: sourceConfig.id,
    source: sourceConfig.name,
    url: sourceConfig.url,
    status: 'documented_only',
    freshness: 'skipped',
    recommendation: 'skip_for_now — HTML source; not scraped in Event Sources v0',
    warnings: ['Special Traffic Updates is HTML-only; Event Sources v0 does not scrape it.'],
  };
}

/**
 * @param {Object} input
 * @param {string} input.generatedAt
 * @param {Object[]} input.sourceEntries
 * @param {number} input.limit
 * @returns {Object}
 */
export function buildSourceFreshnessSnapshot({ generatedAt, sourceEntries, limit }) {
  const dotSource = getEventSourceById('dot-trafalrt');
  const documentedOnlySources = dotSource ? [buildDocumentedOnlySourceEntry(dotSource)] : [];

  return {
    generatedAt,
    tool: SNAPSHOT_TOOL,
    version: SNAPSHOT_VERSION,
    purpose: 'admin_visibility_only',
    limit,
    sources: sourceEntries,
    documentedOnlySources,
    warnings: [
      'Not production feed output.',
      'documented_only sources are listed but not fetched.',
    ],
  };
}

/**
 * @param {Object} report
 * @returns {Object}
 */
export function buildTvppCandidatesSnapshot(report) {
  return {
    generatedAt: report.generatedAt,
    tool: SNAPSHOT_TOOL,
    version: SNAPSHOT_VERSION,
    purpose: 'admin_visibility_only',
    sourceDatasetId: report.sourceDatasetId,
    source: report.source,
    fromDate: report.fromDate,
    limit: report.limit,
    rowCount: report.rowCount,
    itemCount: report.leadCount,
    dateRange: report.dateRange,
    leads: report.leads,
  };
}

/**
 * @param {Object} report
 * @returns {Object}
 */
export function buildTvppTriageSnapshot(report) {
  return {
    generatedAt: report.generatedAt,
    tool: SNAPSHOT_TOOL,
    version: SNAPSHOT_VERSION,
    purpose: 'admin_visibility_only',
    sourceDatasetId: report.sourceDatasetId,
    source: report.source,
    fromDate: report.fromDate,
    limit: report.limit,
    rowCount: report.rowCount,
    itemCount: report.itemCount,
    dateRange: report.dateRange,
    bucketCounts: report.bucketCounts,
    items: report.items,
  };
}

/**
 * @param {Object} report
 * @returns {Object}
 */
export function buildTvppLocationReadinessSnapshot(report) {
  return {
    generatedAt: report.generatedAt,
    tool: SNAPSHOT_TOOL,
    version: SNAPSHOT_VERSION,
    purpose: 'admin_visibility_only',
    sourceDatasetId: report.sourceDatasetId,
    source: report.source,
    fromDate: report.fromDate,
    limit: report.limit,
    rowCount: report.rowCount,
    itemCount: report.itemCount,
    dateRange: report.dateRange,
    locationBucketCounts: report.locationBucketCounts,
    items: report.items,
  };
}

/**
 * @param {Object} report
 * @returns {Object}
 */
export function buildTvppLocationCleanupSnapshot(report) {
  return {
    generatedAt: report.generatedAt,
    tool: SNAPSHOT_TOOL,
    version: SNAPSHOT_VERSION,
    purpose: 'admin_visibility_only',
    sourceDatasetId: report.sourceDatasetId,
    source: report.source,
    fromDate: report.fromDate,
    limit: report.limit,
    rowCount: report.rowCount,
    itemCount: report.itemCount,
    bucketCounts: report.bucketCounts,
    items: report.items,
  };
}

/**
 * @param {string} generatedAt
 * @param {Record<string, string>} files
 * @returns {Object}
 */
export function buildAdminSnapshotIndex(generatedAt, files) {
  return {
    generatedAt,
    tool: SNAPSHOT_TOOL,
    version: SNAPSHOT_VERSION,
    adminMode: 'read_only',
    purpose: 'admin_visibility_only',
    files,
  };
}

/**
 * @param {AdminSnapshotBuildArgs} args
 * @param {{ today?: Date, adminDataDir?: string }} [context]
 * @returns {Promise<{ snapshots: Record<string, Object>, filesWritten: string[] }>}
 */
export async function buildAdminDataSnapshots(args, context = {}) {
  const today = context.today ?? new Date();
  const generatedAt = today.toISOString();
  const adminDataDir = context.adminDataDir ?? ADMIN_DATA_DIR;

  const freshnessArgs = parseMultiSourceFreshnessArgs([
    '--limit', String(Math.min(args.limit, 3)),
    '--from-date', args.fromDate,
  ], { today });

  console.error('Admin Data Snapshots v0 — building read-only admin/data files');
  console.error(`  tvppLimit: ${args.limit}, freshnessSampleLimit: ${freshnessArgs.limit}`);

  const freshnessEntries = await runMultiSourceFreshnessReport(freshnessArgs, { today });
  const sourceEntries = freshnessEntries.map((entry) => {
    const sourceConfig = getEventSourceById(entry.sourceDatasetId);
    return summarizeSourceFreshnessForAdmin(entry, sourceConfig);
  });

  const tvppSource = getEventSourceById(TVPP_SOURCE_DATASET_ID);
  if (!tvppSource) {
    throw new Error(`Missing source config for ${TVPP_SOURCE_DATASET_ID}`);
  }

  const fetchOptions = buildTvppFetchOptions(args);
  const { rows, fetchedAt } = await fetchSocrataSource(tvppSource, fetchOptions);
  const leads = rows.map((row) => normalizeEventLead(TVPP_SOURCE_DATASET_ID, row, {
    lastFetchedAt: fetchedAt,
  }));

  console.error(`  TVPP rows fetched: ${rows.length}`);

  const tvppBase = {
    generatedAt,
    fromDate: args.fromDate,
    limit: args.limit,
    rowCount: rows.length,
    leads,
  };

  const candidatesReport = buildTvppAssignmentFeedReport(tvppBase);
  const triageReport = buildTvppTriagedFeedReport(tvppBase);
  const locationReport = buildTvppLocationReadinessReport(tvppBase);
  const cleanupReport = buildTvppLocationCleanupReport(tvppBase);

  const snapshots = {
    'project-status.json': buildProjectStatusSnapshot(generatedAt),
    'source-freshness.json': buildSourceFreshnessSnapshot({
      generatedAt,
      sourceEntries,
      limit: freshnessArgs.limit,
    }),
    'tvpp-candidates.json': buildTvppCandidatesSnapshot(candidatesReport),
    'tvpp-triage.json': buildTvppTriageSnapshot(triageReport),
    'tvpp-location-readiness.json': buildTvppLocationReadinessSnapshot(locationReport),
    'tvpp-location-cleanup.json': buildTvppLocationCleanupSnapshot(cleanupReport),
  };

  validateAdminSnapshots(snapshots);

  const filesWritten = await writeAdminSnapshots(snapshots, {
    pretty: args.pretty,
    adminDataDir,
  });

  const indexPath = 'index.json';
  const index = buildAdminSnapshotIndex(generatedAt, Object.fromEntries(
    [...Object.keys(snapshots), indexPath].map((name) => [name, `admin/data/${name}`]),
  ));
  const indexFilePath = resolveAdminDataFilePath(indexPath, adminDataDir);
  assertWritableAdminPath(indexFilePath, adminDataDir);
  await mkdir(adminDataDir, { recursive: true });
  await writeFile(
    indexFilePath,
    args.pretty ? `${JSON.stringify(index, null, 2)}\n` : `${JSON.stringify(index)}\n`,
    'utf8',
  );
  filesWritten.push(indexFilePath);

  console.error(`  wrote ${filesWritten.length} file(s) under admin/data/`);

  return { snapshots: { ...snapshots, [indexPath]: index }, filesWritten };
}

/**
 * @param {Record<string, Object>} snapshots
 */
export function validateAdminSnapshots(snapshots) {
  const projectStatus = snapshots['project-status.json'];
  if (projectStatus?.adminMode !== 'read_only') {
    throw new Error('project-status.json must include adminMode: "read_only"');
  }

  for (const lead of snapshots['tvpp-candidates.json']?.leads ?? []) {
    if (!hasEventLeadShape(lead)) {
      throw new Error('TVPP candidate lead failed EventLead shape validation');
    }
    if ('triage' in lead || 'locationReadiness' in lead || 'locationCleanup' in lead) {
      throw new Error('TVPP candidate lead must not include triage, locationReadiness, or locationCleanup');
    }
    if (lead.latitude != null || lead.longitude != null) {
      throw new Error('TVPP candidate leads must not receive GPS coordinates in snapshots');
    }
  }

  for (const item of snapshots['tvpp-triage.json']?.items ?? []) {
    if ('triage' in item.lead || 'locationReadiness' in item.lead || 'locationCleanup' in item.lead) {
      throw new Error('Triage snapshot must keep triage separate from lead');
    }
    if (!item.triage) {
      throw new Error('Triage snapshot item missing triage metadata');
    }
  }

  for (const item of snapshots['tvpp-location-readiness.json']?.items ?? []) {
    if ('locationReadiness' in item.lead || 'triage' in item.lead || 'locationCleanup' in item.lead) {
      throw new Error('Location readiness snapshot must keep locationReadiness separate from lead');
    }
    if (item.lead.latitude != null || item.lead.longitude != null) {
      throw new Error('Location readiness snapshot must not create GPS coordinates');
    }
    if (!item.locationReadiness) {
      throw new Error('Location readiness snapshot item missing locationReadiness metadata');
    }
  }

  for (const item of snapshots['tvpp-location-cleanup.json']?.items ?? []) {
    if ('locationCleanup' in item.lead || 'locationReadiness' in item.lead || 'triage' in item.lead) {
      throw new Error('Location cleanup snapshot must keep locationCleanup separate from lead');
    }
    if (item.lead.latitude != null || item.lead.longitude != null) {
      throw new Error('Location cleanup snapshot must not create GPS coordinates');
    }
    if (!item.locationCleanup) {
      throw new Error('Location cleanup snapshot item missing locationCleanup metadata');
    }
    if ('latitude' in item.locationCleanup || 'longitude' in item.locationCleanup) {
      throw new Error('locationCleanup metadata must not contain GPS coordinates');
    }
  }
}

/**
 * @param {Record<string, Object>} snapshots
 * @param {{ pretty?: boolean, adminDataDir?: string }} [options]
 * @returns {Promise<string[]>}
 */
export async function writeAdminSnapshots(snapshots, options = {}) {
  const { pretty = false, adminDataDir = ADMIN_DATA_DIR } = options;
  /** @type {string[]} */
  const filesWritten = [];

  await mkdir(adminDataDir, { recursive: true });

  for (const filename of Object.keys(snapshots)) {
    if (!ADMIN_SNAPSHOT_FILENAMES.includes(filename)) {
      throw new Error(`Refusing to write disallowed snapshot file: ${filename}`);
    }

    const filePath = resolveAdminDataFilePath(filename, adminDataDir);
    assertWritableAdminPath(filePath, adminDataDir);

    const relativeFromRepo = path.relative(REPO_ROOT, filePath).replace(/\\/g, '/');
    if (isForbiddenSnapshotWritePath(relativeFromRepo)) {
      throw new Error(`Refusing to write forbidden path: ${relativeFromRepo}`);
    }

    const payload = pretty
      ? `${JSON.stringify(snapshots[filename], null, 2)}\n`
      : `${JSON.stringify(snapshots[filename])}\n`;

    await writeFile(filePath, payload, 'utf8');
    filesWritten.push(filePath);
  }

  return filesWritten;
}

/**
 * @param {string[]} [argv]
 * @param {{ today?: Date }} [context]
 * @returns {AdminSnapshotBuildArgs}
 */
export function parseAdminSnapshotArgs(argv = process.argv.slice(2), context = {}) {
  const tvppArgs = parseTvppAssignmentFeedArgs(argv, context);
  return {
    limit: tvppArgs.limit,
    pretty: tvppArgs.pretty,
    help: tvppArgs.help,
    fromDate: tvppArgs.fromDate,
    borough: tvppArgs.borough,
    eventType: tvppArgs.eventType,
  };
}

/**
 * @param {NodeJS.WritableStream} [stream]
 */
export function printAdminSnapshotHelp(stream = process.stderr) {
  stream.write(`NYCIF Admin Data Snapshots v0 (writes admin/data/ JSON only)

Usage:
  node tools/event-sources/build-admin-data-snapshots.mjs [options]

Options:
  --limit N          Max TVPP events to include (default ${DEFAULT_TVPP_FEED_LIMIT}, max ${MAX_TVPP_FEED_LIMIT})
  --pretty           Write pretty-printed JSON files
  --from-date DATE   TVPP upcoming filter start date YYYY-MM-DD (default: today)
  --borough NAME     Filter TVPP by event_borough
  --event-type TYPE  Filter TVPP by event_type
  --help             Show this help

Files written:
  admin/data/project-status.json
  admin/data/source-freshness.json
  admin/data/tvpp-candidates.json
  admin/data/tvpp-triage.json
  admin/data/tvpp-location-readiness.json
  admin/data/tvpp-location-cleanup.json
  admin/data/index.json

Notes:
  - read-only admin visibility only; not production feed output
  - no GPS coordinates, geocoding APIs, or geocode cache writes
  - no map runtime, service worker, deploy config, WordPress, or XRI changes
  - triage, locationReadiness, and locationCleanup remain separate metadata
  - admin/index.html is not wired by this script
`);
}

async function main() {
  const args = parseAdminSnapshotArgs();

  if (args.help) {
    printAdminSnapshotHelp();
    return;
  }

  await buildAdminDataSnapshots(args);
}

const isMainProcess = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainProcess) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
