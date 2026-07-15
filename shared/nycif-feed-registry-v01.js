(() => {
  'use strict';

  const VERSION = 'nycif-feed-registry-v02';
  const SAFE_REF = /^[A-Za-z0-9._/-]+$/;
  const scriptUrl = document.currentScript?.src || location.href;
  const sharedDir = new URL('.', scriptUrl);
  const repoRoot = new URL('../', sharedDir);
  const discoveryUrl = new URL('discovery-patch-v02.js', repoRoot).href;

  const text = value => String(value ?? '').trim();

  function queryFeedRef() {
    try {
      const requested = new URL(location.href).searchParams.get('feeds');
      return requested && SAFE_REF.test(requested) ? requested : '';
    } catch {
      return '';
    }
  }

  function parseDiscoverySource(source) {
    const refMatch = String(source || '').match(/const\s+DEFAULT_FEED_REF\s*=\s*['"]([^'"]+)['"]/);
    const rootMatch = String(source || '').match(/const\s+FEED_ROOT\s*=\s*['"]([^'"]+)['"]/);
    return {
      defaultFeedRef: refMatch && SAFE_REF.test(refMatch[1]) ? refMatch[1] : 'main',
      feedRoot: rootMatch ? rootMatch[1] : 'schema-v1-discovery'
    };
  }

  function buildConfiguration(runtime = {}) {
    const requested = queryFeedRef();
    const defaultFeedRef = SAFE_REF.test(text(runtime.defaultFeedRef)) ? text(runtime.defaultFeedRef) : 'main';
    const branch = requested || defaultFeedRef;
    const feedRoot = text(runtime.feedRoot) || 'schema-v1-discovery';
    const liveFeedsBase = 'https://raw.githubusercontent.com/setoxxx/nycif-live-feeds';
    const host = `${liveFeedsBase}/${branch}`;
    const mainHost = `${liveFeedsBase}/main`;
    const backendBlob = 'https://github.com/setoxxx/nycif-live-feeds/blob/main';

    return {
      version: VERSION,
      branch,
      defaultFeedRef,
      branchOverride: requested || null,
      feedRoot,
      host,
      mainHost,
      backendBlob,
      masterFiles: {
        runtimeDiscovery: discoveryUrl,
        registry: new URL('shared/nycif-feed-registry-v01.js', repoRoot).href,
        schema: new URL('event-feed-schema-v1.js', repoRoot).href,
        backendProjector: `${backendBlob}/scripts/project_events_discovery_v02.py`
      },
      interfaces: {
        godView: new URL('admin/', repoRoot).href,
        calendar: new URL('admin/calendar.html', repoRoot).href,
        fieldDeskMap: repoRoot.href,
        publicMap: 'https://nycinfocus.com/map/',
        liveFeedsRepo: 'https://github.com/setoxxx/nycif-live-feeds',
        fieldDeskRepo: 'https://github.com/setoxxx/nycif-field-desk'
      },
      runtime: {
        major: `${host}/data/${feedRoot}/major/events.json`,
        approvedManifest: `${host}/data/${feedRoot}/approved/manifest.json`,
        approvedPagesTemplate: `${host}/data/${feedRoot}/approved/pages/{cursor}.json`,
        reviewManifest: `${host}/data/${feedRoot}/review/manifest.json`,
        reviewPagesTemplate: `${host}/data/${feedRoot}/review/pages/{cursor}.json`
      },
      fallbacks: {
        discoveryMajor: `${host}/data/events_discovery_v02_major.json`,
        legacySchemaMajor: `${host}/data/events_schema_v1_major.json`,
        emergencyMajor: `${mainHost}/nycif_major_radar_map_events.json`
      },
      diagnostics: {
        pipelineDashboard: `${mainHost}/status/nycif-live-pipeline-dashboard.json`,
        deltaReport: `${mainHost}/data/live_delta_report.json`,
        coverageReport: `${mainHost}/data/reports/multi_source_coverage_report.json`,
        stagedFeed: `${mainHost}/data/nycif_staged_live_events.json`
      },
      pipeline: {
        rawPermitSnapshot: `${mainHost}/data/raw_nyc_open_data_snapshot.json`,
        testEnrichedFeed: `${mainHost}/data/nycif_live_test_enriched_events.json`,
        stagedFeed: `${mainHost}/data/nycif_staged_live_events.json`,
        stagedManifest: `${mainHost}/data/staged_live_manifest.json`,
        citywideSnapshot: `${mainHost}/data/nyc_citywide_events_calendar_snapshot.json`,
        parksEventsSnapshot: `${mainHost}/data/nyc_parks_bigapps_events_snapshot.json`,
        parksFacilityReference: `${mainHost}/data/nyc_parks_facility_reference.json`
      },
      scripts: {
        syncPermits: `${backendBlob}/scripts/sync_nyc_open_data.py`,
        enrichPermits: `${backendBlob}/scripts/build_test_enriched_feed.py`,
        stagePermits: `${backendBlob}/scripts/build_staged_production_feed.py`,
        syncCitywide: `${backendBlob}/scripts/sync_nyc_citywide_events_calendar.py`,
        syncParksEvents: `${backendBlob}/scripts/sync_nyc_parks_bigapps_events.py`,
        buildParksReference: `${backendBlob}/scripts/build_nyc_parks_facility_reference.py`,
        projectDiscovery: `${backendBlob}/scripts/project_events_discovery_v02.py`
      },
      localSnapshots: {
        index: new URL('admin/data/index.json', repoRoot).href,
        projectStatus: new URL('admin/data/project-status.json', repoRoot).href,
        sourceFreshness: new URL('admin/data/source-freshness.json', repoRoot).href,
        tvppCandidates: new URL('admin/data/tvpp-candidates.json', repoRoot).href,
        tvppTriage: new URL('admin/data/tvpp-triage.json', repoRoot).href,
        tvppLocationReadiness: new URL('admin/data/tvpp-location-readiness.json', repoRoot).href,
        xriStatus: new URL('admin/data/xri-status.json', repoRoot).href
      }
    };
  }

  async function loadConfiguration() {
    const runtime = window.NYCIF_DISCOVERY_V02;
    if (runtime && runtime.feedRoot) return buildConfiguration(runtime);

    try {
      const response = await fetch(`${discoveryUrl}?registry=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return buildConfiguration(parseDiscoverySource(await response.text()));
    } catch {
      return buildConfiguration({ defaultFeedRef: 'main', feedRoot: 'schema-v1-discovery' });
    }
  }

  function catalog(config) {
    return {
      authoritative: [
        { name: 'Primary major assignments', url: config.runtime.major, usedBy: 'Map + Calendar', openWhen: 'Troubleshooting major/top assignments' },
        { name: 'Approved manifest', url: config.runtime.approvedManifest, usedBy: 'Map + Calendar', openWhen: 'Checking page inventory, date range, or page count' },
        { name: 'Approved pages template', url: config.runtime.approvedPagesTemplate, usedBy: 'Map + Calendar', openWhen: 'Usually do not open directly; manifest supplies page cursors' }
      ],
      fallback: [
        { name: 'Discovery major fallback', url: config.fallbacks.discoveryMajor, usedBy: 'Automatic fallback', openWhen: 'Only when primary major feed fails' },
        { name: 'Legacy schema major fallback', url: config.fallbacks.legacySchemaMajor, usedBy: 'Automatic fallback', openWhen: 'Only when newer major feeds fail' },
        { name: 'Emergency major feed', url: config.fallbacks.emergencyMajor, usedBy: 'Automatic emergency fallback', openWhen: 'Last-resort troubleshooting only' }
      ],
      diagnostics: [
        { name: 'Pipeline dashboard', url: config.diagnostics.pipelineDashboard, usedBy: 'God View live pipeline', openWhen: 'Checking staged counts and pipeline status' },
        { name: 'Delta report', url: config.diagnostics.deltaReport, usedBy: 'God View live pipeline', openWhen: 'Checking newly added, changed, or removed events' },
        { name: 'Coverage report', url: config.diagnostics.coverageReport, usedBy: 'God View live pipeline', openWhen: 'Checking permit/calendar/Parks overlap gaps' },
        { name: 'Staged feed', url: config.diagnostics.stagedFeed, usedBy: 'Pipeline QA only', openWhen: 'Backend troubleshooting; not the final runtime feed' }
      ],
      localSnapshots: Object.entries(config.localSnapshots).map(([name, url]) => ({
        name,
        url,
        usedBy: 'Legacy/local God View panels',
        openWhen: 'Reference only; does not power the map or calendar'
      }))
    };
  }

  function lineage(config) {
    return [
      {
        lane: 'direct',
        laneLabel: 'DIRECT APPROVED',
        sourceName: 'NYC Open Data Events / SAPO permits',
        datasetId: 'tvpp-9vvx',
        original: [
          { label: 'Original Socrata JSON', url: 'https://data.cityofnewyork.us/resource/tvpp-9vvx.json' },
          { label: 'Dataset page', url: 'https://data.cityofnewyork.us/d/tvpp-9vvx' }
        ],
        transformations: [
          { label: '1. Sync raw snapshot', url: config.scripts.syncPermits },
          { label: '2. Enrich and resolve locations', url: config.scripts.enrichPermits },
          { label: '3. Build staged approved-shaped feed', url: config.scripts.stagePermits },
          { label: '4. Project discovery taxonomy', url: config.scripts.projectDiscovery }
        ],
        intermediate: [
          { label: 'Normalized raw snapshot', url: config.pipeline.rawPermitSnapshot },
          { label: 'Enriched test feed', url: config.pipeline.testEnrichedFeed },
          { label: 'Staged feed', url: config.pipeline.stagedFeed }
        ],
        outputs: [
          { label: 'Approved runtime manifest', url: config.runtime.approvedManifest },
          { label: 'Major runtime feed', url: config.runtime.major }
        ],
        currentUse: 'Primary direct event source for the approved map and calendar runtime.',
        duplicateRule: 'Primary identity: event_id. Supporting matches: CEMSID, then normalized title + borough + location + date.'
      },
      {
        lane: 'review',
        laneLabel: 'REVIEW / SUPPLEMENTAL',
        sourceName: 'NYC Citywide Events Calendar API',
        datasetId: 'nyc-citywide-events-calendar-api',
        original: [
          { label: 'Public events page', url: 'https://www.nyc.gov/events/' },
          { label: 'Calendar API endpoint', url: 'https://api.nyc.gov/calendar/search' }
        ],
        transformations: [
          { label: '1. Sync and normalize calendar API', url: config.scripts.syncCitywide },
          { label: '2. Project unlinked rows to review lane', url: config.scripts.projectDiscovery }
        ],
        intermediate: [
          { label: 'Citywide normalized snapshot', url: config.pipeline.citywideSnapshot }
        ],
        outputs: [
          { label: 'Combined review manifest', url: config.runtime.reviewManifest },
          { label: 'Coverage/overlap report', url: config.diagnostics.coverageReport }
        ],
        currentUse: 'Coverage and review source. It is not silently promoted into the approved map/calendar lane.',
        duplicateRule: 'Source identity: id + sequence + start time. Cross-source audit compares title + date and preserves unlinked rows for review.'
      },
      {
        lane: 'review',
        laneLabel: 'REVIEW / SUPPLEMENTAL',
        sourceName: 'NYC Parks BigApps public events',
        datasetId: 'nyc-parks-bigapps-events',
        original: [
          { label: 'Original Parks events JSON', url: 'https://www.nycgovparks.org/xml/events_300_rss.json' },
          { label: 'Parks BigApps page', url: 'https://www.nycgovparks.org/bigapps' }
        ],
        transformations: [
          { label: '1. Sync events and published coordinates', url: config.scripts.syncParksEvents },
          { label: '2. Project unlinked rows to review lane', url: config.scripts.projectDiscovery }
        ],
        intermediate: [
          { label: 'Parks normalized event snapshot', url: config.pipeline.parksEventsSnapshot }
        ],
        outputs: [
          { label: 'Combined review manifest', url: config.runtime.reviewManifest },
          { label: 'Coverage/overlap report', url: config.diagnostics.coverageReport }
        ],
        currentUse: 'Supplemental Parks event coverage with source coordinates. Review-only unless separately approved.',
        duplicateRule: 'Source identity: Parks GUID/ID. Cross-source title + date overlap is audited before any promotion.'
      },
      {
        lane: 'reference',
        laneLabel: 'ENRICHMENT ONLY',
        sourceName: 'NYC Parks BigApps facility reference feeds',
        datasetId: 'DPR_* facility feeds',
        original: [
          { label: 'Facility feed template', url: 'https://www.nycgovparks.org/bigapps/DPR_Parks_001.json' },
          { label: 'Parks BigApps page', url: 'https://www.nycgovparks.org/bigapps' }
        ],
        transformations: [
          { label: 'Build Parks facility coordinate reference', url: config.scripts.buildParksReference }
        ],
        intermediate: [],
        outputs: [
          { label: 'Facility reference artifact', url: config.pipeline.parksFacilityReference }
        ],
        currentUse: 'Location/GPS enrichment only. This does not create new events and should not be counted as a separate event source.',
        duplicateRule: 'Matches facility names, property IDs, boroughs and published coordinates; it enriches an existing event rather than adding another event row.'
      }
    ];
  }

  window.NYCIF_FEED_REGISTRY_V01 = {
    VERSION,
    SAFE_REF,
    repoRoot: repoRoot.href,
    discoveryUrl,
    parseDiscoverySource,
    buildConfiguration,
    loadConfiguration,
    catalog,
    lineage
  };
})();
