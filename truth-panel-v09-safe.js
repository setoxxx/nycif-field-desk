(() => {
  const VERSION = 'v0.9-safe-truth-panel';
  const MAJOR_FEED = 'https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/nycif_major_radar_map_events.json';
  const FULL_FEED = 'https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/nycif_all_radar_map_events.json';
  const NYC_BOUNDS = { minLat: 40.4774, maxLat: 40.9176, minLng: -74.2591, maxLng: -73.7004 };
  const state = { majorRows: null, fullRows: null, fullDateRows: null, fullGpsRows: null, checkedAt: null, checking: false };

  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
  function todayKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  function todayLabel() { return new Date().toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }); }
  function toDateKey(value) {
    if (!value) return '';
    const text = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
    const t = Date.parse(text);
    if (!Number.isFinite(t)) return '';
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function dayNumber(key) { if (!key) return NaN; const [y, m, d] = key.split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 86400000); }
  function eventRange(row) { const start = toDateKey(row.date) || toDateKey(row.start_date_time) || toDateKey(row.start) || toDateKey(row.start_date); const end = toDateKey(row.end_date) || toDateKey(row.end_date_time) || toDateKey(row.end) || start; return { start, end }; }
  function activeMode() { return document.querySelector('#dateChips [data-date-mode].active')?.dataset.dateMode || 'today'; }
  function activeLabel() { return document.querySelector('#dateChips [data-date-mode].active')?.textContent?.trim() || activeMode(); }
  function targetDateKey() { const mode = activeMode(); if (mode === 'today') return todayKey(); if (/^\d{4}-\d{2}-\d{2}$/.test(mode)) return mode; return ''; }
  function hasGps(row) { const lat = Number.parseFloat(row.lat); const lng = Number.parseFloat(row.lng); return Number.isFinite(lat) && Number.isFinite(lng) && lat >= NYC_BOUNDS.minLat && lat <= NYC_BOUNDS.maxLat && lng >= NYC_BOUNDS.minLng && lng <= NYC_BOUNDS.maxLng; }
  function matchesTargetDate(row) { const target = targetDateKey(); if (!target) return false; const { start, end } = eventRange(row); const s = dayNumber(start); const e = dayNumber(end || start); const t = dayNumber(target); return Number.isFinite(s) && Number.isFinite(e) && Number.isFinite(t) && s <= t && e >= t; }
  function markerCount() { return document.querySelectorAll('.leaflet-marker-icon.marker-shell').length; }
  function appListCount() { return document.querySelectorAll('#eventList .event-item').length; }
  function dataWindowMeta() { return document.getElementById('dataWindowMetaV08')?.textContent?.trim() || 'Not loaded'; }
  function brandText() { return document.getElementById('brandCount')?.textContent?.trim() || ''; }
  function statusText() { return document.getElementById('status')?.textContent?.trim() || ''; }
  function narrowFilters() {
    return ['majorOnly', 'photoOnly', 'nypdOnly'].filter(id => document.getElementById(id)?.checked).map(id => ({ majorOnly: 'Major only', photoOnly: 'Photo only', nypdOnly: 'NYPD only' }[id])).join(', ') || 'None';
  }
  function categories() { return [...document.querySelectorAll('[data-cat]')].filter(i => i.checked).map(i => i.closest('label')?.textContent?.trim() || i.dataset.cat).join(', ') || 'None'; }
  async function fetchRows(url) { const res = await fetch(`${url}?truth=${Date.now()}`, { headers: { Accept: 'application/json' } }); if (!res.ok) throw new Error(`HTTP ${res.status}`); const json = await res.json(); return Array.isArray(json) ? json : (json.events || []); }
  async function checkFeeds() {
    state.checking = true; render();
    try {
      const [major, full] = await Promise.all([fetchRows(MAJOR_FEED), fetchRows(FULL_FEED)]);
      state.majorRows = major.length;
      state.fullRows = full.length;
      const targetRows = targetDateKey() ? full.filter(matchesTargetDate) : [];
      state.fullDateRows = targetRows.length;
      state.fullGpsRows = targetRows.filter(hasGps).length;
      state.checkedAt = new Date();
    } catch (error) {
      state.checkedAt = new Date();
      state.error = error.message;
    } finally {
      state.checking = false; render();
    }
  }
  function ensureUi() {
    if (document.getElementById('truthPanelV09')) return;
    const btn = document.createElement('button'); btn.id = 'truthToggleV09'; btn.type = 'button'; btn.textContent = 'Truth';
    const panel = document.createElement('aside'); panel.id = 'truthPanelV09'; panel.hidden = true;
    panel.innerHTML = '<header><strong>Truth Panel</strong><button id="truthCloseV09" type="button">×</button></header><div id="truthBodyV09"></div>';
    document.body.append(btn, panel);
    btn.addEventListener('click', () => { panel.hidden = !panel.hidden; render(); });
    panel.querySelector('#truthCloseV09')?.addEventListener('click', () => { panel.hidden = true; });
  }
  function render() {
    ensureUi();
    const body = document.getElementById('truthBodyV09'); if (!body) return;
    const checked = state.checkedAt ? state.checkedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Not checked';
    const cap = markerCount() >= 640 ? 'Likely active' : 'Not reached';
    body.innerHTML = `
      <dl>
        <div><dt>Today detected</dt><dd>${esc(todayLabel())} (${esc(todayKey())})</dd></div>
        <div><dt>Active date filter</dt><dd>${esc(activeLabel())} / ${esc(activeMode())}</dd></div>
        <div><dt>Major feed rows</dt><dd>${state.majorRows ?? 'Tap check'}</dd></div>
        <div><dt>Full feed rows</dt><dd>${state.fullRows ?? 'Tap check'}</dd></div>
        <div><dt>Rows for selected date</dt><dd>${state.fullDateRows ?? 'Tap check'}</dd></div>
        <div><dt>Selected date GPS rows</dt><dd>${state.fullGpsRows ?? 'Tap check'}</dd></div>
        <div><dt>Markers drawn now</dt><dd>${markerCount()}</dd></div>
        <div><dt>Marker cap</dt><dd>${esc(cap)}</dd></div>
        <div><dt>App desk rows shown</dt><dd>${appListCount()}</dd></div>
        <div><dt>Data Window</dt><dd>${esc(dataWindowMeta())}</dd></div>
        <div><dt>Narrow filters</dt><dd>${esc(narrowFilters())}</dd></div>
        <div><dt>Categories</dt><dd>${esc(categories())}</dd></div>
        <div><dt>Brand/status</dt><dd>${esc(brandText() || statusText())}</dd></div>
        <div><dt>Last feed check</dt><dd>${esc(state.checking ? 'Checking...' : checked)}</dd></div>
      </dl>
      ${state.error ? `<p class="truth-error">${esc(state.error)}</p>` : ''}
      <button id="truthCheckV09" type="button">Check feeds now</button>
      <p class="truth-version">${VERSION}</p>
    `;
    body.querySelector('#truthCheckV09')?.addEventListener('click', checkFeeds);
  }
  window.addEventListener('DOMContentLoaded', () => { ensureUi(); render(); setInterval(render, 2500); });
  document.addEventListener('click', ev => { if (ev.target.closest('[data-date-mode], [data-cat], #majorOnly, #photoOnly, #nypdOnly, #dataWindowLoadV08, #dataWindowPrevV08, #dataWindowNextV08')) setTimeout(render, 200); }, true);
})();
