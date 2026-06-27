(() => {
  const VERSION = 'v0.8-safe-data-window';
  const FULL_FEED = 'https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/nycif_all_radar_map_events.json';
  const PAGE_SIZE = 60;
  const NYC_BOUNDS = { minLat: 40.4774, maxLat: 40.9176, minLng: -74.2591, maxLng: -73.7004 };

  const state = {
    loaded: false,
    rows: [],
    filtered: [],
    page: 0,
    status: 'Not loaded'
  };

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function toDateKey(value) {
    if (!value) return '';
    const text = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
    const t = Date.parse(text);
    if (!Number.isFinite(t)) return '';
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function tomorrowKey() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function dayNumber(key) {
    if (!key) return NaN;
    const [y, m, d] = key.split('-').map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  }

  function activeDateMode() {
    return document.querySelector('#dateChips [data-date-mode].active')?.dataset.dateMode || 'today';
  }

  function eventDayRange(row) {
    const start = toDateKey(row.date) || toDateKey(row.start_date_time) || toDateKey(row.start) || toDateKey(row.start_date);
    const end = toDateKey(row.end_date) || toDateKey(row.end_date_time) || toDateKey(row.end) || start;
    return { start, end };
  }

  function matchesDate(row, mode) {
    if (mode === 'all') return true;
    const { start, end } = eventDayRange(row);
    if (!start) return false;
    const s = dayNumber(start);
    const e = dayNumber(end || start);
    let target = todayKey();
    if (mode === 'tomorrow') target = tomorrowKey();
    else if (/^\d{4}-\d{2}-\d{2}$/.test(mode)) target = mode;
    else if (mode === 'weekend') {
      const startN = s;
      const endN = Number.isFinite(e) ? e : s;
      for (let n = startN; n <= endN; n += 1) {
        const d = new Date(n * 86400000);
        const day = d.getUTCDay();
        if (day === 0 || day === 6) return true;
      }
      return false;
    }
    const t = dayNumber(target);
    return Number.isFinite(s) && Number.isFinite(e) && s <= t && e >= t;
  }

  function hasNyCoord(row) {
    const lat = Number.parseFloat(row.lat);
    const lng = Number.parseFloat(row.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) && lat >= NYC_BOUNDS.minLat && lat <= NYC_BOUNDS.maxLat && lng >= NYC_BOUNDS.minLng && lng <= NYC_BOUNDS.maxLng;
  }

  function categoryAllowed(row) {
    const text = `${row.title || ''} ${row.event_type || ''} ${row.type || ''} ${row.lane || ''} ${row.icon || ''}`.toLowerCase();
    const cat = (() => {
      if (/world cup|sport|soccer|race|marathon|run|walk|bike|cycling|baseball|yankee|citi field/.test(text)) return 'sports';
      if (/pride|parade|march|rally|vigil|civic|ceremony|street event|block party/.test(text)) return 'parade';
      if (/market|food|vendor|feast|fair|merchandise|pop/.test(text)) return 'market';
      if (/music|concert|arts|dance|theater|theatre|film|production|performance/.test(text)) return 'arts';
      if (/park|family|kids|children|beach|garden|nature/.test(text)) return 'parks';
      return 'general';
    })();
    const input = document.querySelector(`[data-cat="${cat}"]`);
    return !input || input.checked;
  }

  function currentFilters(row) {
    if (!hasNyCoord(row)) return false;
    if (!matchesDate(row, activeDateMode())) return false;
    if (!categoryAllowed(row)) return false;
    const borough = document.querySelector('#boroughs button.active')?.dataset.borough || 'all';
    if (borough !== 'all' && row.borough !== borough) return false;
    const search = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();
    if (search) {
      const hay = `${row.title || ''} ${row.location || ''} ${row.display_location || ''} ${row.borough || ''} ${row.event_type || ''} ${row.type || ''}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  }

  function eventTime(row) {
    if (row.start_time) return row.start_time;
    const value = row.start_date_time || row.start || row.date;
    const text = String(value || '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return 'Time not listed';
    const d = new Date(text);
    if (!Number.isFinite(d.getTime())) return 'Time not listed';
    return d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function mapsUrl(row) {
    return `https://maps.apple.com/?daddr=${encodeURIComponent(`${row.lat},${row.lng}`)}&q=${encodeURIComponent(row.title || 'NYC event')}`;
  }

  function ensureUi() {
    if (document.getElementById('dataWindowV08')) return;
    const host = document.getElementById('eventList');
    if (!host) return;
    const box = document.createElement('section');
    box.id = 'dataWindowV08';
    box.innerHTML = `
      <header>
        <strong>Data Window</strong>
        <span id="dataWindowMetaV08">${esc(state.status)}</span>
      </header>
      <div class="data-window-actions">
        <button type="button" id="dataWindowLoadV08">Load Data Window</button>
        <button type="button" id="dataWindowPrevV08">Prev 60</button>
        <button type="button" id="dataWindowNextV08">Next 60</button>
      </div>
      <div id="dataWindowListV08" class="data-window-list"></div>
    `;
    host.parentNode.insertBefore(box, host);
    document.getElementById('dataWindowLoadV08')?.addEventListener('click', loadFullData);
    document.getElementById('dataWindowPrevV08')?.addEventListener('click', () => { state.page = Math.max(0, state.page - 1); render(); });
    document.getElementById('dataWindowNextV08')?.addEventListener('click', () => { const maxPage = Math.max(0, Math.ceil(state.filtered.length / PAGE_SIZE) - 1); state.page = Math.min(maxPage, state.page + 1); render(); });
  }

  async function loadFullData() {
    ensureUi();
    state.status = 'Loading full feed...';
    renderMeta();
    const response = await fetch(`${FULL_FEED}?window=${Date.now()}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Full feed HTTP ${response.status}`);
    const json = await response.json();
    state.rows = Array.isArray(json) ? json : (json.events || []);
    state.loaded = true;
    state.status = `${state.rows.length.toLocaleString()} rows loaded`;
    state.page = 0;
    applyFilters();
    render();
  }

  function applyFilters() {
    if (!state.loaded) return;
    state.filtered = state.rows.filter(currentFilters);
    const maxPage = Math.max(0, Math.ceil(state.filtered.length / PAGE_SIZE) - 1);
    if (state.page > maxPage) state.page = maxPage;
  }

  function renderMeta() {
    const meta = document.getElementById('dataWindowMetaV08');
    if (!meta) return;
    const pages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
    meta.textContent = state.loaded ? `${state.filtered.length.toLocaleString()} matching · page ${state.page + 1}/${pages} · ${state.status}` : state.status;
  }

  function render() {
    ensureUi();
    applyFilters();
    renderMeta();
    const list = document.getElementById('dataWindowListV08');
    if (!list) return;
    if (!state.loaded) {
      list.innerHTML = '<div class="data-window-empty">Tap Load Data Window to browse the full feed in safe chunks.</div>';
      return;
    }
    const start = state.page * PAGE_SIZE;
    const pageRows = state.filtered.slice(start, start + PAGE_SIZE);
    list.innerHTML = pageRows.map(row => `
      <article class="data-window-item">
        <strong>${esc(row.title || 'Untitled event')}</strong>
        <span>${esc(eventTime(row))}</span>
        <small>${esc([row.borough, row.display_location || row.location, row.event_type || row.type].filter(Boolean).join(' • '))}</small>
        <a href="${esc(mapsUrl(row))}" target="_blank" rel="noopener">Directions</a>
      </article>
    `).join('') || '<div class="data-window-empty">No full-feed rows match this view.</div>';
  }

  window.addEventListener('DOMContentLoaded', () => {
    ensureUi();
    render();
    document.addEventListener('click', ev => {
      if (ev.target.closest('[data-date-mode], #boroughs button, [data-cat], #majorOnly, #photoOnly, #nypdOnly')) setTimeout(() => { state.page = 0; render(); }, 120);
    }, true);
    document.getElementById('searchInput')?.addEventListener('input', () => { state.page = 0; render(); });
    document.getElementById('sortSelect')?.addEventListener('change', () => { state.page = 0; render(); });
  });
})();
