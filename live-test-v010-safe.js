(() => {
  const VERSION = 'v0.10-safe-live-test';
  const RAW_FEED = 'https://data.cityofnewyork.us/resource/tvpp-9vvx.json?$limit=500&$order=start_date_time ASC';
  const ENRICHED_FEED = 'https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/nycif_all_radar_map_events.json';
  const state = { raw: [], enriched: [], testedAt: null, loading: false, error: '' };

  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
  function norm(value) { return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function idOfRaw(row) { return String(row.event_id || row.id || row.permit_number || '').trim(); }
  function idOfEnriched(row) { return String(row.source_event_id || row.event_id || row.id || '').trim(); }
  function rawLocation(row) { return row.event_location || row.location || row.display_location || ''; }
  function rawName(row) { return row.event_name || row.title || ''; }
  function rawBorough(row) { return row.event_borough || row.borough || ''; }
  function rawStart(row) { return row.start_date_time || row.start || row.date || ''; }
  function hasGps(row) { const lat = Number.parseFloat(row.lat); const lng = Number.parseFloat(row.lng); return Number.isFinite(lat) && Number.isFinite(lng); }
  function fallbackKey(row) { return [norm(rawName(row)), norm(rawBorough(row)), norm(rawLocation(row)), String(rawStart(row)).slice(0, 10)].join('|'); }
  function enrichedFallbackKey(row) { return [norm(row.title), norm(row.borough), norm(row.location || row.display_location), String(row.start_date_time || row.date || '').slice(0, 10)].join('|'); }

  function buildIndexes() {
    const byId = new Map();
    const byFallback = new Map();
    for (const row of state.enriched) {
      const id = idOfEnriched(row);
      if (id) byId.set(id, row);
      const fk = enrichedFallbackKey(row);
      if (fk.replace(/\|/g, '')) byFallback.set(fk, row);
    }
    return { byId, byFallback };
  }

  function compare() {
    const { byId, byFallback } = buildIndexes();
    const rows = state.raw.map(raw => {
      const id = idOfRaw(raw);
      const byOfficialId = id ? byId.get(id) : null;
      const byText = byOfficialId ? null : byFallback.get(fallbackKey(raw));
      const match = byOfficialId || byText || null;
      return { raw, match, matchType: byOfficialId ? 'event_id' : (byText ? 'text/date/location' : 'none') };
    });
    const matched = rows.filter(r => r.match);
    const gpsMatched = matched.filter(r => hasGps(r.match));
    const missing = rows.filter(r => !r.match).slice(0, 8);
    const matchedNoGps = matched.filter(r => !hasGps(r.match)).slice(0, 8);
    return { rows, matched, gpsMatched, missing, matchedNoGps };
  }

  async function fetchJson(url) {
    const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}live_test=${Date.now()}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return Array.isArray(json) ? json : (json.events || []);
  }

  async function runTest() {
    state.loading = true; state.error = ''; render();
    try {
      const [raw, enriched] = await Promise.all([fetchJson(RAW_FEED), fetchJson(ENRICHED_FEED)]);
      state.raw = raw;
      state.enriched = enriched;
      state.testedAt = new Date();
    } catch (error) {
      state.error = error.message || String(error);
    } finally {
      state.loading = false; render();
    }
  }

  function ensureUi() {
    if (document.getElementById('liveTestPanelV010')) return;
    const button = document.createElement('button');
    button.id = 'liveTestToggleV010';
    button.type = 'button';
    button.textContent = 'Live Test';
    const panel = document.createElement('aside');
    panel.id = 'liveTestPanelV010';
    panel.hidden = true;
    panel.innerHTML = '<header><strong>Live Data Test</strong><button id="liveTestCloseV010" type="button">×</button></header><div id="liveTestBodyV010"></div>';
    document.body.append(button, panel);
    button.addEventListener('click', () => { panel.hidden = !panel.hidden; render(); });
    panel.querySelector('#liveTestCloseV010')?.addEventListener('click', () => { panel.hidden = true; });
  }

  function rowLine(item) {
    const raw = item.raw;
    const id = idOfRaw(raw) || 'no id';
    return `<li><strong>${esc(rawName(raw) || 'Untitled')}</strong><span>${esc(id)} · ${esc(rawBorough(raw))} · ${esc(rawLocation(raw))}</span></li>`;
  }

  function render() {
    ensureUi();
    const body = document.getElementById('liveTestBodyV010');
    if (!body) return;
    const cmp = compare();
    const tested = state.testedAt ? state.testedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Not tested';
    const matchPct = state.raw.length ? Math.round((cmp.matched.length / state.raw.length) * 100) : 0;
    const gpsPct = cmp.matched.length ? Math.round((cmp.gpsMatched.length / cmp.matched.length) * 100) : 0;
    body.innerHTML = `
      <p class="live-test-note">Read-only comparison. This does not change the map or saved feed.</p>
      <dl>
        <div><dt>Raw NYC rows sampled</dt><dd>${state.raw.length}</dd></div>
        <div><dt>Enriched rows loaded</dt><dd>${state.enriched.length}</dd></div>
        <div><dt>Matched raw → enriched</dt><dd>${cmp.matched.length} (${matchPct}%)</dd></div>
        <div><dt>Matched with GPS</dt><dd>${cmp.gpsMatched.length} (${gpsPct}%)</dd></div>
        <div><dt>Need enrichment</dt><dd>${cmp.rows.length - cmp.matched.length}</dd></div>
        <div><dt>Matched but no GPS</dt><dd>${cmp.matchedNoGps.length}</dd></div>
        <div><dt>Last test</dt><dd>${state.loading ? 'Testing...' : esc(tested)}</dd></div>
      </dl>
      ${state.error ? `<p class="live-test-error">${esc(state.error)}</p>` : ''}
      <button id="liveTestRunV010" type="button">Run Live Test</button>
      <section><h3>Live rows needing enrichment</h3><ol>${cmp.missing.map(rowLine).join('') || '<li>None in current sample.</li>'}</ol></section>
      <section><h3>Matched but missing GPS</h3><ol>${cmp.matchedNoGps.map(rowLine).join('') || '<li>None in current sample.</li>'}</ol></section>
      <p class="live-test-version">${VERSION}</p>
    `;
    body.querySelector('#liveTestRunV010')?.addEventListener('click', runTest);
  }

  window.addEventListener('DOMContentLoaded', () => { ensureUi(); render(); });
})();
