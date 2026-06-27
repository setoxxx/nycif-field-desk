(() => {
  const VERSION = 'v0.12-safe-live-test-fallback';
  const RAW_BASE = 'https://data.cityofnewyork.us/resource/tvpp-9vvx.json';
  const ENRICHED = 'https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/nycif_all_radar_map_events.json';
  const state = { raw: [], enriched: [], loading: false, error: '', warning: '', queryMode: 'not run', testedAt: null };

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = v => String(v ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const dayNum = key => { const parts = String(key || '').slice(0,10).split('-').map(Number); return parts.length === 3 ? Math.floor(Date.UTC(parts[0], parts[1]-1, parts[2]) / 86400000) : NaN; };
  const isCurrentFuture = r => { const start = r.start_date_time || r.start || r.date || ''; const s = dayNum(start); const t = dayNum(todayKey()); return Number.isFinite(s) && Number.isFinite(t) && s >= t; };
  const rawId = r => String(r.event_id || r.id || r.permit_number || '').trim();
  const richId = r => String(r.source_event_id || r.event_id || r.id || '').trim();
  const rawName = r => r.event_name || r.title || '';
  const rawBoro = r => r.event_borough || r.borough || '';
  const rawLoc = r => r.event_location || r.location || r.display_location || '';
  const rawStart = r => r.start_date_time || r.start || r.date || '';
  const hasGps = r => Number.isFinite(parseFloat(r.lat)) && Number.isFinite(parseFloat(r.lng));
  const ids = v => String(v || '').split(',').map(x => x.trim()).filter(Boolean);
  const rawCems = r => ids(r.cemsid || r.source_cemsid);
  const richCems = r => ids(r.source_cemsid || r.cemsid);
  const cemsKey = (b, c) => `${norm(b)}|${String(c).trim()}`;
  const rawTextKey = r => [norm(rawName(r)), norm(rawBoro(r)), norm(rawLoc(r)), String(rawStart(r)).slice(0,10)].join('|');
  const richTextKey = r => [norm(r.title), norm(r.borough), norm(r.location || r.display_location), String(r.start_date_time || r.date || '').slice(0,10)].join('|');

  function urls() {
    const today = todayKey();
    const strict = `${RAW_BASE}?$limit=500&$order=start_date_time ASC&$where=start_date_time >= '${today}T00:00:00'`;
    const fallback = `${RAW_BASE}?$limit=1000&$order=start_date_time DESC`;
    return { strict, fallback };
  }

  function indexes() {
    const byId = new Map(), byCems = new Map(), byText = new Map();
    for (const r of state.enriched) {
      const id = richId(r); if (id) byId.set(id, r);
      for (const c of richCems(r)) byCems.set(cemsKey(r.borough, c), r);
      const tk = richTextKey(r); if (tk.replace(/\|/g, '')) byText.set(tk, r);
    }
    return { byId, byCems, byText };
  }

  function compare() {
    const ix = indexes();
    const rows = state.raw.map(raw => {
      const id = rawId(raw);
      const idMatch = id ? ix.byId.get(id) : null;
      const cemsMatch = idMatch ? null : rawCems(raw).map(c => ix.byCems.get(cemsKey(rawBoro(raw), c))).find(Boolean);
      const textMatch = (idMatch || cemsMatch) ? null : ix.byText.get(rawTextKey(raw));
      const match = idMatch || cemsMatch || textMatch || null;
      const matchType = idMatch ? 'event_id' : cemsMatch ? 'cemsid' : textMatch ? 'text/date/location' : 'none';
      return { raw, match, matchType };
    });
    const matched = rows.filter(x => x.match);
    const gps = matched.filter(x => hasGps(x.match));
    const types = rows.reduce((a, x) => { a[x.matchType] = (a[x.matchType] || 0) + 1; return a; }, {});
    return { rows, matched, gps, types, missing: rows.filter(x => !x.match).slice(0,8), noGps: matched.filter(x => !hasGps(x.match)).slice(0,8) };
  }

  async function getJson(url) {
    const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}qa=${Date.now()}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return Array.isArray(json) ? json : (json.events || []);
  }

  async function getRawRows() {
    const u = urls();
    try {
      state.queryMode = 'strict server date filter';
      state.warning = '';
      return await getJson(u.strict);
    } catch (err) {
      state.queryMode = 'fallback client date filter';
      state.warning = `Strict NYC date query failed (${err.message}); fallback query used.`;
      const all = await getJson(u.fallback);
      const filtered = all.filter(isCurrentFuture);
      return filtered.length ? filtered.slice(0,500) : all.slice(0,500);
    }
  }

  async function run() {
    state.loading = true; state.error = ''; render();
    try {
      const [raw, enriched] = await Promise.all([getRawRows(), getJson(ENRICHED)]);
      state.raw = raw; state.enriched = enriched; state.testedAt = new Date();
    } catch (e) { state.error = e.message || String(e); }
    finally { state.loading = false; render(); }
  }

  function ensure() {
    if (document.getElementById('liveTestPanelV010')) return;
    const b = document.createElement('button'); b.id = 'liveTestToggleV010'; b.type = 'button'; b.textContent = 'Live Test';
    const p = document.createElement('aside'); p.id = 'liveTestPanelV010'; p.hidden = true;
    p.innerHTML = '<header><strong>Live Data Test</strong><button id="liveTestCloseV010" type="button">×</button></header><div id="liveTestBodyV010"></div>';
    document.body.append(b, p);
    b.addEventListener('click', () => { p.hidden = !p.hidden; render(); });
    p.querySelector('#liveTestCloseV010')?.addEventListener('click', () => { p.hidden = true; });
  }

  function line(x) {
    const r = x.raw;
    const c = rawCems(r).join(', ') || 'no cemsid';
    return `<li><strong>${esc(rawName(r) || 'Untitled')}</strong><span>${esc(rawId(r) || 'no id')} · cemsid ${esc(c)} · ${esc(rawBoro(r))} · ${esc(rawLoc(r))}</span></li>`;
  }

  function render() {
    ensure();
    const body = document.getElementById('liveTestBodyV010'); if (!body) return;
    const c = compare();
    const matchPct = state.raw.length ? Math.round(c.matched.length / state.raw.length * 100) : 0;
    const gpsPct = c.matched.length ? Math.round(c.gps.length / c.matched.length * 100) : 0;
    const tested = state.testedAt ? state.testedAt.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}) : 'Not tested';
    body.innerHTML = `<p class="live-test-note">Read-only QA comparison. Tries current/future NYC rows first; uses fallback if Socrata rejects the date query. Does not change map or saved feed.</p><dl><div><dt>Raw NYC rows sampled</dt><dd>${state.raw.length}</dd></div><div><dt>Enriched rows loaded</dt><dd>${state.enriched.length}</dd></div><div><dt>Matched raw → enriched</dt><dd>${c.matched.length} (${matchPct}%)</dd></div><div><dt>Matched with GPS</dt><dd>${c.gps.length} (${gpsPct}%)</dd></div><div><dt>Matched by event ID</dt><dd>${c.types.event_id || 0}</dd></div><div><dt>Matched by CEMSID</dt><dd>${c.types.cemsid || 0}</dd></div><div><dt>Matched by text/date</dt><dd>${c.types['text/date/location'] || 0}</dd></div><div><dt>Need enrichment</dt><dd>${c.rows.length - c.matched.length}</dd></div><div><dt>Matched but no GPS</dt><dd>${c.noGps.length}</dd></div><div><dt>Query mode</dt><dd>${esc(state.queryMode)}</dd></div><div><dt>Last test</dt><dd>${state.loading ? 'Testing...' : esc(tested)}</dd></div></dl>${state.warning ? `<p class="live-test-error">${esc(state.warning)}</p>` : ''}${state.error ? `<p class="live-test-error">${esc(state.error)}</p>` : ''}<button id="liveTestRunV010" type="button">Run Live Test</button><section><h3>Live rows needing enrichment</h3><ol>${c.missing.map(line).join('') || '<li>None in current sample.</li>'}</ol></section><section><h3>Matched but missing GPS</h3><ol>${c.noGps.map(line).join('') || '<li>None in current sample.</li>'}</ol></section><p class="live-test-version">${VERSION}</p>`;
    body.querySelector('#liveTestRunV010')?.addEventListener('click', run);
  }

  window.addEventListener('DOMContentLoaded', () => { ensure(); render(); });
})();
