/* NYCIF Admin Dashboard — read-only data panels v1 */

const SNAPSHOT_RESOURCES = [
  { key: 'index', path: './data/index.json' },
  { key: 'projectStatus', path: './data/project-status.json' },
  { key: 'sourceFreshness', path: './data/source-freshness.json' },
  { key: 'tvppCandidates', path: './data/tvpp-candidates.json' },
  { key: 'tvppTriage', path: './data/tvpp-triage.json' },
  { key: 'tvppLocationReadiness', path: './data/tvpp-location-readiness.json' },
];

const PUBLIC_FIELD_DESK_URL = 'https://setoxxx.github.io/nycif-field-desk/?v=c5p-postpublish-02&resetFilters=1';
const PUBLIC_NYCINFOCUS_MAP_URL = 'https://nycinfocus.com/map/';

const TRIAGE_BUCKETS = [
  'strong_assignment',
  'possible_assignment',
  'logistics_or_closure',
  'low_value',
  'needs_review',
];

const LOCATION_BUCKETS = [
  'geocode_ready',
  'needs_address_cleanup',
  'intersection_or_route',
  'borough_only',
  'missing_location',
  'needs_review',
];

const XRI_PHASES = [
  { id: 'XRI-G0', label: 'Registry design', status: 'complete' },
  { id: 'XRI-G1', label: 'Asset inventory', status: 'complete' },
  { id: 'XRI-G2', label: 'Source tiers and candidate schema', status: 'complete' },
  { id: 'XRI-G3', label: 'Fixtures and validation contract', status: 'complete' },
  { id: 'XRI-G4', label: 'Read-only candidate extractor prototype', status: 'held' },
];

const SENSITIVE_FIELD_PATTERN = /^(phone|email|rawRecord|password|token|secret|apiKey)$/i;

function text(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function byId(id) {
  return document.getElementById(id);
}

function el(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = text(value);
  return node;
}

function clear(node) {
  node.replaceChildren();
  return node;
}

function appendList(parent, items) {
  const values = (items || []).filter(Boolean);
  if (!values.length) {
    parent.appendChild(el('div', 'empty', 'No items.'));
    return;
  }
  const list = el('ul', 'list');
  for (const item of values) list.appendChild(el('li', null, item));
  parent.appendChild(list);
}

function statCard(label, value, detail) {
  const card = el('div', 'stat');
  card.appendChild(el('div', 'label', label));
  card.appendChild(el('div', 'value', value));
  if (detail) card.appendChild(el('div', 'detail', detail));
  return card;
}

function chips(values, tone) {
  const wrap = el('div', 'chips');
  const list = Array.isArray(values) ? values : [values];
  if (!list.filter(Boolean).length) {
    wrap.appendChild(el('span', 'muted', '—'));
    return wrap;
  }
  for (const value of list.filter(Boolean)) {
    wrap.appendChild(el('span', tone ? `chip ${tone}` : 'chip', value));
  }
  return wrap;
}

function table(columns, rows) {
  const wrap = el('div', 'table-wrap');
  const tableNode = document.createElement('table');
  const thead = document.createElement('thead');
  const trHead = document.createElement('tr');
  for (const column of columns) trHead.appendChild(el('th', null, column.label));
  thead.appendChild(trHead);
  tableNode.appendChild(thead);

  const tbody = document.createElement('tbody');
  if (!rows.length) {
    const row = document.createElement('tr');
    const cell = el('td', 'empty', 'No rows in this snapshot section.');
    cell.colSpan = columns.length;
    row.appendChild(cell);
    tbody.appendChild(row);
  } else {
    for (const item of rows) {
      const row = document.createElement('tr');
      for (const column of columns) {
        const cell = document.createElement('td');
        const value = column.value(item);
        if (value instanceof Node) cell.appendChild(value);
        else cell.textContent = text(value);
        row.appendChild(cell);
      }
      tbody.appendChild(row);
    }
  }
  tableNode.appendChild(tbody);
  wrap.appendChild(tableNode);
  return wrap;
}

function summaryCards(snapshot, fields) {
  const grid = el('div', 'grid');
  for (const field of fields) {
    grid.appendChild(statCard(field.label, field.value(snapshot), field.detail ? field.detail(snapshot) : null));
  }
  return grid;
}

function sanitizeLead(lead) {
  if (!lead || typeof lead !== 'object') return lead;
  const safe = { ...lead };
  for (const key of Object.keys(safe)) {
    if (SENSITIVE_FIELD_PATTERN.test(key)) safe[key] = '[hidden — sensitive field]';
  }
  return safe;
}

async function loadJsonSnapshot(resource) {
  try {
    const response = await fetch(resource.path);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return { key: resource.key, path: resource.path, data: await response.json(), error: null };
  } catch (error) {
    return {
      key: resource.key,
      path: resource.path,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function renderLoadErrors(results) {
  const failures = results.filter((result) => result.error);
  const panel = byId('load-errors-panel');
  const target = clear(byId('load-errors'));
  panel.hidden = failures.length === 0;
  if (!failures.length) return;
  for (const failure of failures) {
    const notice = el('div', 'notice danger');
    notice.appendChild(el('div', null, `${failure.path}: ${failure.error}`));
    target.appendChild(notice);
  }
}

function summarizeFreshness(sourceFreshness) {
  if (!sourceFreshness?.sources?.length) return 'unknown';
  const counts = sourceFreshness.sources.reduce((acc, source) => {
    const key = source.freshness || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const parts = Object.entries(counts).map(([key, count]) => `${key}: ${count}`);
  return parts.join(', ') || 'unknown';
}

function summarizeLocationReadiness(locationReadiness) {
  if (!locationReadiness?.locationBucketCounts) return 'unknown';
  const counts = locationReadiness.locationBucketCounts;
  const blocked = (counts.needs_address_cleanup || 0) + (counts.intersection_or_route || 0) + (counts.missing_location || 0);
  const ready = counts.geocode_ready || 0;
  if (ready > 0 && blocked === 0) return 'ready';
  if (blocked > 0) return `${blocked} need work`;
  return 'review snapshot';
}

function renderSystemOverview(data, results) {
  const target = clear(byId('system-overview'));
  const loadedCount = results.filter((result) => result.data).length;
  const totalCount = results.length;
  const needsReview = data.tvppTriage?.bucketCounts?.needs_review ?? '—';
  const candidateCount = data.tvppCandidates?.itemCount ?? data.tvppCandidates?.rowCount ?? '—';

  target.appendChild(statCard(
    'Admin snapshots available',
    `${loadedCount}/${totalCount}`,
    loadedCount === totalCount ? 'All required snapshots loaded.' : 'One or more snapshots failed to load.',
  ));
  target.appendChild(statCard(
    'Source freshness status',
    summarizeFreshness(data.sourceFreshness),
    data.sourceFreshness ? 'From source-freshness.json sample.' : 'Snapshot not loaded.',
  ));
  target.appendChild(statCard(
    'TVPP candidates count',
    candidateCount,
    'Leads/candidates only — not approved assignments.',
  ));
  target.appendChild(statCard(
    'TVPP needs-review count',
    needsReview,
    'Operator triage bucket; not a publish gate.',
  ));
  target.appendChild(statCard(
    'Location readiness status',
    summarizeLocationReadiness(data.tvppLocationReadiness),
    'From tvpp-location-readiness.json buckets.',
  ));
  target.appendChild(statCard(
    'XRI status',
    'G0–G3 complete',
    'G4 held — registry not live-processing production data.',
  ));
  target.appendChild(statCard(
    'Public map review status',
    data.projectStatus?.publicMapStatus?.productionWired ? 'production wired' : 'review links only',
    data.projectStatus?.publicMapStatus?.summary || 'Use Live Map Review panel below.',
  ));
}

function renderProjectStatus(projectStatus) {
  const target = clear(byId('project-status'));
  if (!projectStatus) {
    target.appendChild(el('div', 'empty', 'project-status.json did not load.'));
    return;
  }

  const completedPhases = [
    'Admin data snapshots v0 (admin/data/)',
    'Event Sources dev tooling (freshness, TVPP candidate feed, triage, location readiness)',
    'Static admin dashboard skeleton at /admin/',
    'Admin dashboard data panels v1 (this page)',
  ];

  target.appendChild(summaryCards(projectStatus, [
    { label: 'Current phase', value: () => 'Admin Dashboard Data Panels v1' },
    { label: 'Admin mode', value: (data) => data.adminMode },
    { label: 'Event sources', value: (data) => data.eventSourcesStatus?.summary },
    { label: 'Production feed writes', value: (data) => String(data.eventSourcesStatus?.productionFeedWrites ?? false) },
  ]));

  const completed = el('div', null);
  completed.appendChild(el('h3', null, 'Completed phases (safe)'));
  appendList(completed, completedPhases);
  target.appendChild(completed);

  const nextStep = el('div', 'notice ok');
  nextStep.appendChild(el('div', null, 'Next recommended safe step: Admin Dashboard Data Panels QA v1 — verify snapshot loading, panel accuracy, and read-only guardrails before any XRI-G4 or production wiring work.'));
  target.appendChild(nextStep);

  const warnings = el('div', null);
  warnings.appendChild(el('h3', null, 'Safety warnings'));
  appendList(warnings, projectStatus.warnings || []);
  target.appendChild(warnings);
}

function renderSourceFreshness(sourceFreshness) {
  const target = clear(byId('source-freshness'));
  if (!sourceFreshness) {
    target.appendChild(el('div', 'empty', 'source-freshness.json did not load.'));
    return;
  }

  target.appendChild(summaryCards(sourceFreshness, [
    { label: 'Generated', value: (data) => data.generatedAt },
    { label: 'Sample limit', value: (data) => data.limit },
    { label: 'Purpose', value: (data) => data.purpose },
  ]));

  target.appendChild(table([
    { label: 'Source', value: (row) => row.source },
    { label: 'Dataset', value: (row) => row.sourceDatasetId },
    { label: 'Status', value: (row) => row.freshness },
    { label: 'Rows', value: (row) => row.rowCount },
    { label: 'Leads', value: (row) => row.leadCount },
    { label: 'Date range', value: (row) => `${text(row.dateRange?.min)} to ${text(row.dateRange?.max)}` },
    { label: 'Last checked', value: (row) => row.lastCheckedAt || row.lastFetchedAt || sourceFreshness.generatedAt },
    { label: 'Recommendation', value: (row) => row.recommendation },
    { label: 'Warnings', value: (row) => chips(row.warnings, row.warnings?.length ? 'warn' : null) },
  ], sourceFreshness.sources || []));

  if ((sourceFreshness.documentedOnlySources || []).length) {
    const documented = el('div', null);
    documented.appendChild(el('h3', null, 'Documented-only sources'));
    documented.appendChild(table([
      { label: 'Source', value: (row) => row.source },
      { label: 'Dataset', value: (row) => row.sourceDatasetId },
      { label: 'Status', value: (row) => row.status },
      { label: 'Freshness', value: (row) => row.freshness },
      { label: 'Recommendation', value: (row) => row.recommendation },
      { label: 'Warnings', value: (row) => chips(row.warnings, 'warn') },
    ], sourceFreshness.documentedOnlySources));
    target.appendChild(documented);
  }

  if ((sourceFreshness.warnings || []).length) {
    const box = el('div', 'notice warn');
    appendList(box, sourceFreshness.warnings);
    target.appendChild(box);
  }
}

function renderCandidates(tvppCandidates, tvppTriage) {
  const target = clear(byId('tvpp-candidates'));
  if (!tvppCandidates) {
    target.appendChild(el('div', 'empty', 'tvpp-candidates.json did not load.'));
    return;
  }

  target.appendChild(el('div', 'notice', 'All rows below are TVPP leads/candidates from dev snapshots. They are not approved assignments and do not appear on the public map from this dashboard.'));

  target.appendChild(summaryCards(tvppCandidates, [
    { label: 'Source', value: (data) => data.source },
    { label: 'Total candidates', value: (data) => data.itemCount ?? data.rowCount },
    { label: 'From date', value: (data) => data.fromDate },
    { label: 'Date range', value: (data) => `${text(data.dateRange?.min)} to ${text(data.dateRange?.max)}` },
  ]));

  if (tvppTriage?.bucketCounts) {
    target.appendChild(el('h3', null, 'Triage buckets'));
    const grid = el('div', 'grid');
    for (const bucket of TRIAGE_BUCKETS) {
      grid.appendChild(statCard(bucket, tvppTriage.bucketCounts[bucket] ?? 0, 'Snapshot count'));
    }
    target.appendChild(grid);
  }

  const triageByEventId = new Map();
  for (const item of tvppTriage?.items || []) {
    const id = item.lead?.eventId || item.lead?.sourceRecordId;
    if (id) triageByEventId.set(String(id), item.triage);
  }

  const leads = (tvppCandidates.leads || []).map(sanitizeLead);
  const strongRows = leads.filter((lead) => triageByEventId.get(String(lead.eventId))?.bucket === 'strong_assignment');
  const reviewRows = leads.filter((lead) => triageByEventId.get(String(lead.eventId))?.bucket === 'needs_review');

  target.appendChild(el('h3', null, `Strongest candidates (${strongRows.length})`));
  target.appendChild(table([
    { label: 'Title', value: (lead) => lead.title },
    { label: 'Borough', value: (lead) => lead.borough },
    { label: 'Start', value: (lead) => `${text(lead.startDate)} ${text(lead.startTime)}` },
    { label: 'Location', value: (lead) => lead.locationName },
    { label: 'Bucket', value: (lead) => triageByEventId.get(String(lead.eventId))?.bucket || '—' },
  ], strongRows.slice(0, 8)));

  target.appendChild(el('h3', null, `Needs-review rows (${reviewRows.length})`));
  target.appendChild(table([
    { label: 'Title', value: (lead) => lead.title },
    { label: 'Borough', value: (lead) => lead.borough },
    { label: 'Start', value: (lead) => `${text(lead.startDate)} ${text(lead.startTime)}` },
    { label: 'Location', value: (lead) => lead.locationName },
    { label: 'Reasons', value: (lead) => chips(triageByEventId.get(String(lead.eventId))?.reasons, 'warn') },
  ], reviewRows.slice(0, 12)));
}

function renderBucketCounts(parent, counts, bucketOrder) {
  const grid = el('div', 'grid');
  for (const bucket of bucketOrder) {
    grid.appendChild(statCard(bucket, counts?.[bucket] ?? 0, 'Snapshot count'));
  }
  parent.appendChild(grid);
}

function groupBy(items, bucketGetter, bucketOrder) {
  const groups = new Map(bucketOrder.map((bucket) => [bucket, []]));
  for (const item of items || []) {
    const bucket = bucketGetter(item) || 'needs_review';
    if (!groups.has(bucket)) groups.set(bucket, []);
    groups.get(bucket).push(item);
  }
  return groups;
}

function renderTriage(tvppTriage) {
  const target = clear(byId('tvpp-triage'));
  if (!tvppTriage) {
    target.appendChild(el('div', 'empty', 'tvpp-triage.json did not load.'));
    return;
  }

  target.appendChild(el('div', 'notice', 'Triage buckets classify candidate leads for operator review. They do not approve, reject, or publish events.'));
  renderBucketCounts(target, tvppTriage.bucketCounts, TRIAGE_BUCKETS);

  const groups = groupBy(tvppTriage.items, (item) => item.triage?.bucket, TRIAGE_BUCKETS);
  for (const bucket of TRIAGE_BUCKETS) {
    const details = document.createElement('details');
    details.open = bucket === 'strong_assignment' || bucket === 'needs_review';
    details.appendChild(el('summary', null, `${bucket} (${groups.get(bucket).length})`));
    const body = el('div', 'detail-body');
    body.appendChild(table([
      { label: 'Title', value: (item) => sanitizeLead(item.lead)?.title },
      { label: 'Borough', value: (item) => item.lead?.borough },
      { label: 'Date/time', value: (item) => `${text(item.lead?.startDate)} ${text(item.lead?.startTime)} to ${text(item.lead?.endDate)} ${text(item.lead?.endTime)}` },
      { label: 'Location', value: (item) => item.lead?.locationName },
      { label: 'Labels', value: (item) => chips(item.triage?.labels) },
      { label: 'Reasons', value: (item) => chips(item.triage?.reasons) },
      { label: 'Confidence', value: (item) => item.triage?.confidence },
    ], groups.get(bucket)));
    details.appendChild(body);
    target.appendChild(details);
  }
}

function renderLocationReadiness(locationReadiness) {
  const target = clear(byId('tvpp-location-readiness'));
  if (!locationReadiness) {
    target.appendChild(el('div', 'empty', 'tvpp-location-readiness.json did not load.'));
    return;
  }

  target.appendChild(el('div', 'notice warn', 'No geocode approval happens on this dashboard. Location readiness buckets are visibility hints only.'));
  renderBucketCounts(target, locationReadiness.locationBucketCounts, LOCATION_BUCKETS);

  const highlightBuckets = ['needs_address_cleanup', 'intersection_or_route', 'geocode_ready', 'missing_location'];
  const groups = groupBy(locationReadiness.items, (item) => item.locationReadiness?.bucket, LOCATION_BUCKETS);

  for (const bucket of highlightBuckets) {
    const rows = groups.get(bucket) || [];
    if (!rows.length) continue;
    const details = document.createElement('details');
    details.open = bucket === 'needs_address_cleanup' || bucket === 'intersection_or_route';
    details.appendChild(el('summary', null, `${bucket} (${rows.length})`));
    const body = el('div', 'detail-body');
    body.appendChild(table([
      { label: 'Title', value: (item) => sanitizeLead(item.lead)?.title },
      { label: 'Borough', value: (item) => item.lead?.borough },
      { label: 'Location', value: (item) => item.lead?.locationName },
      { label: 'Address', value: (item) => item.lead?.address },
      { label: 'Labels', value: (item) => chips(item.locationReadiness?.labels) },
      { label: 'Reasons', value: (item) => chips(item.locationReadiness?.reasons) },
    ], rows.slice(0, 15)));
    details.appendChild(body);
    target.appendChild(details);
  }
}

function renderLiveMapReview() {
  const links = clear(byId('live-map-links'));
  const fieldDesk = document.createElement('a');
  fieldDesk.href = PUBLIC_FIELD_DESK_URL;
  fieldDesk.target = '_blank';
  fieldDesk.rel = 'noopener noreferrer';
  fieldDesk.textContent = 'GitHub Pages Field Desk map';
  links.appendChild(fieldDesk);

  const nycInFocus = document.createElement('a');
  nycInFocus.href = PUBLIC_NYCINFOCUS_MAP_URL;
  nycInFocus.target = '_blank';
  nycInFocus.rel = 'noopener noreferrer';
  nycInFocus.textContent = 'nycinfocus.com/map/';
  links.appendChild(nycInFocus);

  const preview = byId('live-map-preview');
  preview.innerHTML = '';
  const iframe = document.createElement('iframe');
  iframe.src = PUBLIC_NYCINFOCUS_MAP_URL;
  iframe.title = 'Read-only preview of nycinfocus.com/map/';
  iframe.loading = 'lazy';
  iframe.referrerPolicy = 'no-referrer';
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
  preview.appendChild(iframe);
}

function renderXriStatus() {
  const target = clear(byId('xri-status'));
  const grid = el('div', 'xri-grid');

  for (const phase of XRI_PHASES) {
    const item = el('div', 'xri-item');
    const label = el('div', null);
    label.appendChild(el('div', null, phase.id));
    label.appendChild(el('div', 'detail', phase.label));
    item.appendChild(label);
    const tone = phase.status === 'complete' ? 'ok' : 'warn';
    item.appendChild(el('span', `chip ${tone}`, phase.status === 'complete' ? 'complete' : 'not started / held'));
    grid.appendChild(item);
  }

  target.appendChild(grid);
  const warning = el('div', 'notice warn');
  warning.appendChild(el('div', null, 'XRI registry is designed through G3 but is not live-processing production data yet. Do not start XRI-G4 without explicit approval.'));
  target.appendChild(warning);
}

function renderOperatorNotes(data) {
  const target = clear(byId('operator-notes'));
  const notes = [
    'Admin snapshots are not production feed JSON.',
    'This dashboard has no write, publish, approval, rejection, geocoding, or cache controls.',
    'TVPP rows are candidate leads only — not approved map assignments.',
  ];

  const sourceWarnings = data.sourceFreshness?.sources || [];
  if (sourceWarnings.some((source) => source.freshness === 'stale')) notes.push('Stale source: one or more source samples are stale.');
  if (sourceWarnings.some((source) => source.freshness === 'empty')) notes.push('Empty source: one or more sources returned zero rows under the sample filter.');
  if ((data.sourceFreshness?.documentedOnlySources || []).length) {
    notes.push('Documented-only source: Special Traffic Updates is listed but not scraped.');
  }

  const needsReview = data.tvppTriage?.bucketCounts?.needs_review || 0;
  if (needsReview > 0) notes.push(`${needsReview} TVPP candidate row(s) are in the needs_review triage bucket.`);

  appendList(target, notes);
}

function updateTimestamp(data) {
  const timestamp = data.projectStatus?.generatedAt || data.index?.generatedAt || 'unavailable';
  byId('snapshot-timestamp').textContent = `Snapshot: ${timestamp}`;
}

function render(results) {
  renderLoadErrors(results);
  const data = Object.fromEntries(results.map((result) => [result.key, result.data]));

  updateTimestamp(data);
  renderSystemOverview(data, results);
  renderProjectStatus(data.projectStatus);
  renderSourceFreshness(data.sourceFreshness);
  renderCandidates(data.tvppCandidates, data.tvppTriage);
  renderTriage(data.tvppTriage);
  renderLocationReadiness(data.tvppLocationReadiness);
  renderLiveMapReview();
  renderXriStatus();
  renderOperatorNotes(data);
}

Promise.all(SNAPSHOT_RESOURCES.map(loadJsonSnapshot)).then(render);
