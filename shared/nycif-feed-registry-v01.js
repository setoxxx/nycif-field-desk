(() => {
  'use strict';

  const VERSION = 'nycif-feed-registry-v01';
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

    return {
      version: VERSION,
      branch,
      defaultFeedRef,
      branchOverride: requested || null,
      feedRoot,
      host,
      mainHost,
      masterFiles: {
        runtimeDiscovery: discoveryUrl,
        registry: new URL('shared/nycif-feed-registry-v01.js', repoRoot).href,
        schema: new URL('event-feed-schema-v1.js', repoRoot).href
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
        approvedPagesTemplate: `${host}/data/${feedRoot}/approved/pages/{cursor}.json`
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
        { name: 'Staged feed', url: config.diagnostics.stagedFeed, usedBy: 'Pipeline QA only', openWhen: 'Backend troubleshooting; not the map/calendar runtime feed' }
      ],
      localSnapshots: Object.entries(config.localSnapshots).map(([name, url]) => ({
        name,
        url,
        usedBy: 'Legacy/local God View panels',
        openWhen: 'Reference only; does not power the map or calendar'
      }))
    };
  }

  window.NYCIF_FEED_REGISTRY_V01 = {
    VERSION,
    SAFE_REF,
    repoRoot: repoRoot.href,
    discoveryUrl,
    parseDiscoverySource,
    buildConfiguration,
    loadConfiguration,
    catalog
  };
})();
