(() => {
  const VERSION = 'v0.5-safe';
  const FEEDS = {
    major: 'https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/nycif_major_radar_map_events.json',
    full: 'https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/nycif_all_radar_map_events.json'
  };
  const state = { majorCount: null, fullCount: null, todayFull: null, todayGeo: null, loadedFull: false };

  function parseDate(value) {
    const t = value ? Date.parse(value) : NaN;
    return Number.isFinite(t) ? new Date(t) : null;
  }
  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function dateKey(date) {
    if (!date) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function hasNyCoord(row) {
    const lat = Number.parseFloat(row.lat);
    const lng = Number.parseFloat(row.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 40.4774 && lat <= 40.9176 && lng >= -74.2591 && lng <= -73.7004;
  }
  function rowsFrom(json) { return Array.isArray(json) ? json : (json.events || []); }

  async function countFeed(kind) {
    const res = await fetch(`${FEEDS[kind]}?stats=${Date.now()}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`${kind} feed ${res.status}`);
    const rows = rowsFrom(await res.json());
    if (kind === 'major') state.majorCount = rows.length;
    if (kind === 'full') {
      state.fullCount = rows.length;
      const tk = todayKey();
      const today = rows.filter(row => {
        const d = parseDate(row.start_date_time || row.start || row.date);
        const dk = dateKey(d) || String(row.date || row.start_date_time || '').slice(0, 10);
        return dk === tk;
      });
      state.todayFull = today.length;
      state.todayGeo = today.filter(hasNyCoord).length;
    }
    render();
  }

  function text(id) { return (document.getElementById(id)?.textContent || '').trim(); }
  function checked(id) { return !!document.getElementById(id)?.checked; }
  function activeDate() { return document.querySelector('[data-date-mode].active')?.textContent?.trim() || 'Unknown'; }
  function activeCats() {
    return [...document.querySelectorAll('[data-cat]')]
      .filter(input => input.checked)
      .map(input => input.closest('label')?.textContent?.trim() || input.dataset.cat)
      .join(', ');
  }
  function markerCount() { return document.querySelectorAll('.leaflet-marker-icon.marker-shell').length; }
  function listCount() { return document.querySelectorAll('#eventList .event-item').length; }

  function ensureUi() {
    if (document.getElementById('statsPanelV05')) return;
    const btn = document.createElement('button');
    btn.id = 'statsToggleV05';
    btn.type = 'button';
    btn.textContent = 'Stats';
    const panel = document.createElement('aside');
    panel.id = 'statsPanelV05';
    panel.hidden = true;
    panel.innerHTML = '<header><strong>Field Stats</strong><button type="button" id="statsCloseV05">×</button></header><div id="statsBodyV05">Loading stats...</div>';
    document.body.append(btn, panel);
    btn.addEventListener('click', () => { panel.hidden = !panel.hidden; render(); });
    panel.querySelector('#statsCloseV05').addEventListener('click', () => { panel.hidden = true; });
  }

  function render() {
    ensureUi();
    const body = document.getElementById('statsBodyV05');
    if (!body) return;
    const fullStatus = /Full feed|full event database|All events loaded|Full Today Test/i.test(text('status') + ' ' + text('listMeta'));
    if (fullStatus) state.loadedFull = true;
    const markers = markerCount();
    const list = listCount();
    const capNote = markers >= 640 ? 'Marker cap likely active' : 'Marker cap not reached';
    body.innerHTML = `
      <dl>
        <div><dt>Mode</dt><dd>${activeDate()}</dd></div>
        <div><dt>Major feed rows</dt><dd>${state.majorCount ?? 'checking...'}</dd></div>
        <div><dt>Full feed rows</dt><dd>${state.fullCount ?? 'tap refresh'}</dd></div>
        <div><dt>Today rows in full feed</dt><dd>${state.todayFull ?? 'tap refresh'}</dd></div>
        <div><dt>Today geocoded rows</dt><dd>${state.todayGeo ?? 'tap refresh'}</dd></div>
        <div><dt>Markers drawn now</dt><dd>${markers}</dd></div>
        <div><dt>Desk items shown</dt><dd>${list}</dd></div>
        <div><dt>Phone safety</dt><dd>${capNote}</dd></div>
        <div><dt>Full feed loaded in app</dt><dd>${state.loadedFull ? 'Yes/likely' : 'Not yet'}</dd></div>
        <div><dt>Narrow filters</dt><dd>${checked('majorOnly') ? 'Major ' : ''}${checked('photoOnly') ? 'Photo ' : ''}${checked('nypdOnly') ? 'NYPD ' : 'None'}</dd></div>
        <div><dt>Categories</dt><dd>${activeCats() || 'None'}</dd></div>
      </dl>
      <button type="button" id="statsRefreshV05">Refresh stats</button>
      <p>${VERSION}</p>
    `;
    body.querySelector('#statsRefreshV05')?.addEventListener('click', () => refreshAll());
  }

  function refreshAll() {
    countFeed('major').catch(() => {});
    countFeed('full').catch(() => {});
    render();
  }

  window.addEventListener('DOMContentLoaded', () => {
    ensureUi();
    countFeed('major').catch(() => {});
    setTimeout(render, 800);
    setInterval(render, 2500);
  });
})();
