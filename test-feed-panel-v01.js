(() => {
  const VERSION = 'v0.1-test-feed-panel';
  const TEST_FEED_URL = 'https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/data/nycif_live_test_enriched_events.json';
  const MANIFEST_URL = 'https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/data/test_enriched_feed_manifest.json';
  const state = { loading: false, error: '', manifest: null, feed: null, loadedAt: null };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const num = value => Number.isFinite(Number(value)) ? Number(value).toLocaleString() : '0';
  const pct = (part, whole) => whole ? `${Math.round((Number(part) / Number(whole)) * 100)}%` : '0%';
  const events = () => Array.isArray(state.feed?.events) ? state.feed.events : [];
  const gpsReady = rows => rows.filter(row => row && row.needs_review === false && Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lng))).length;
  const needsReview = rows => rows.filter(row => row && row.needs_review === true);
  const countsBy = (rows, key) => rows.reduce((acc, row) => { const value = row?.[key] || 'blank'; acc[value] = (acc[value] || 0) + 1; return acc; }, {});

  function ensurePanel() {
    if (document.getElementById('testFeedPanelV01')) return;
    const toggle = document.createElement('button');
    toggle.id = 'testFeedToggleV01';
    toggle.type = 'button';
    toggle.className = 'test-feed-toggle-v01';
    toggle.textContent = 'Test Feed';

    const panel = document.createElement('aside');
    panel.id = 'testFeedPanelV01';
    panel.className = 'test-feed-panel-v01';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'NYCIF test enriched feed panel');
    panel.innerHTML = `
      <header>
        <div>
          <h2>Test Enriched Feed</h2>
          <p>Backend QA display check - ${VERSION}</p>
        </div>
        <button class="test-feed-close-v01" type="button" aria-label="Close test feed panel">x</button>
      </header>
      <div id="testFeedBodyV01" class="test-feed-body-v01"></div>
    `;

    document.body.append(toggle, panel);
    toggle.addEventListener('click', () => { panel.hidden = !panel.hidden; render(); });
    panel.querySelector('.test-feed-close-v01')?.addEventListener('click', () => { panel.hidden = true; });
  }

  async function getJson(url) {
    const finalUrl = `${url}?qa=${Date.now()}`;
    const response = await fetch(finalUrl, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`${url.split('/').pop()} HTTP ${response.status}`);
    return response.json();
  }

  async function load() {
    state.loading = true;
    state.error = '';
    render();
    try {
      const [manifest, feed] = await Promise.all([getJson(MANIFEST_URL), getJson(TEST_FEED_URL)]);
      state.manifest = manifest;
      state.feed = feed;
      state.loadedAt = new Date();
    } catch (error) {
      state.error = error?.message || String(error);
    } finally {
      state.loading = false;
      render();
    }
  }

  function metric(label, value) {
    return `<div class="test-feed-card-v01"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
  }

  function matchRows(matchCounts) {
    const order = ['event_id', 'location_cache', 'text_date_location', 'cemsid', 'none'];
    return order.map(key => `<dt>${esc(key)}</dt><dd>${num(matchCounts?.[key] || 0)}</dd>`).join('');
  }

  function reviewList(rows) {
    const sample = rows.slice(0, 10);
    if (!sample.length) return '<li><strong>No review rows in current sample.</strong><span>Every test-feed event has displayable GPS.</span></li>';
    return sample.map(row => `
      <li>
        <strong>${esc(row.title || 'Untitled')}</strong>
        <span>${esc(row.borough || 'No borough')} - ${esc(row.display_time || 'Time TBA')} - ${esc(row.display_location || row.location || 'No location')}</span>
        <span>event_id ${esc(row.source_event_id || 'none')} - cemsid ${esc((row.source_cemsid || []).join(', ') || 'none')}</span>
        <em class="test-feed-pill-v01">needs review</em>
      </li>
    `).join('');
  }

  function render() {
    ensurePanel();
    const body = document.getElementById('testFeedBodyV01');
    if (!body) return;

    const rows = events();
    const reviewRows = needsReview(rows);
    const ready = gpsReady(rows);
    const manifest = state.manifest || {};
    const matchCounts = manifest.match_counts || countsBy(rows, 'match_type');
    const generated = manifest.generated_at_utc ? new Date(manifest.generated_at_utc).toLocaleString() : 'Not loaded yet';
    const loaded = state.loadedAt ? state.loadedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Not loaded yet';

    body.innerHTML = `
      <div class="test-feed-actions-v01">
        <button id="testFeedLoadV01" type="button">Load Test Feed</button>
        <button id="testFeedRefreshV01" type="button">Refresh</button>
      </div>
      <div class="test-feed-grid-v01">
        ${metric('Test events', num(manifest.test_feed_events ?? rows.length))}
        ${metric('GPS-ready', `${num(manifest.gps_ready_events ?? ready)} (${pct(manifest.gps_ready_events ?? ready, manifest.test_feed_events ?? rows.length)})`)}
        ${metric('Needs review', num(manifest.needs_review_events ?? reviewRows.length))}
        ${metric('Cache entries', num(manifest.location_cache_entries_loaded || 0))}
      </div>
      <p class="test-feed-status-v01">
        Generated: ${esc(generated)}<br>
        Loaded on device: ${esc(loaded)}<br>
        Production feed: ${manifest.production_feed === false ? 'false / safe test feed' : esc(manifest.production_feed ?? 'unknown')}<br>
        ${state.loading ? 'Loading test feed...' : state.error ? `Error: ${esc(state.error)}` : 'Ready.'}
      </p>
      <dl class="test-feed-match-v01">${matchRows(matchCounts)}</dl>
      <h3 style="margin:0 0 8px;color:#fff;font-size:13px;">First 10 needs-review rows</h3>
      <ol class="test-feed-list-v01">${reviewList(reviewRows)}</ol>
    `;

    body.querySelector('#testFeedLoadV01')?.addEventListener('click', load);
    body.querySelector('#testFeedRefreshV01')?.addEventListener('click', load);
  }

  window.addEventListener('DOMContentLoaded', () => {
    ensurePanel();
    render();
  });
})();
