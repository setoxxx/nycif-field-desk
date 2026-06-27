(() => {
  const VERSION = 'v0.1-test-map-layer';
  const TEST_FEED_URL = 'https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/data/nycif_live_test_enriched_events.json';
  const NYC_CENTER = [40.7128, -74.0060];
  const state = { loading: false, error: '', feed: null, loadedAt: null, map: null, layer: null, active: false, drawn: 0, skipped: 0 };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const num = value => Number.isFinite(Number(value)) ? Number(value).toLocaleString() : '0';
  const events = () => Array.isArray(state.feed?.events) ? state.feed.events : [];
  const isGpsReady = row => row && row.needs_review === false && Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lng));
  const gpsRows = () => events().filter(isGpsReady);
  const reviewRows = () => events().filter(row => !isGpsReady(row));

  function ensurePanel() {
    if (document.getElementById('testMapPanelV01')) return;
    const toggle = document.createElement('button');
    toggle.id = 'testMapToggleV01';
    toggle.className = 'test-map-toggle-v01';
    toggle.type = 'button';
    toggle.textContent = 'Test Map';

    const panel = document.createElement('aside');
    panel.id = 'testMapPanelV01';
    panel.className = 'test-map-panel-v01';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'NYCIF test map layer panel');
    panel.innerHTML = `
      <header>
        <div>
          <h2>Test Map Layer</h2>
          <p>Draws GPS-ready backend test-feed rows - ${VERSION}</p>
        </div>
        <button class="test-map-close-v01" type="button" aria-label="Close test map panel">x</button>
      </header>
      <div id="testMapBodyV01" class="test-map-body-v01"></div>
    `;

    document.body.append(toggle, panel);
    toggle.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
      render();
      if (!panel.hidden) setTimeout(() => ensureMap(), 60);
    });
    panel.querySelector('.test-map-close-v01')?.addEventListener('click', () => { panel.hidden = true; });
  }

  async function getJson(url) {
    const response = await fetch(`${url}?qa=${Date.now()}`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`test feed HTTP ${response.status}`);
    return response.json();
  }

  function ensureMap() {
    const canvas = document.getElementById('testMapCanvasV01');
    if (!canvas || !window.L) return;
    if (!state.map) {
      state.map = L.map(canvas, { zoomControl: true, closePopupOnClick: false, tap: false }).setView(NYC_CENTER, 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(state.map);
      state.layer = L.layerGroup().addTo(state.map);
    }
    setTimeout(() => state.map.invalidateSize(), 90);
  }

  async function loadAndDraw() {
    state.loading = true;
    state.error = '';
    render();
    try {
      state.feed = await getJson(TEST_FEED_URL);
      state.loadedAt = new Date();
      drawLayer();
    } catch (error) {
      state.error = error?.message || String(error);
      state.active = false;
    } finally {
      state.loading = false;
      render();
      setTimeout(() => ensureMap(), 60);
    }
  }

  function clearLayer() {
    if (state.layer) state.layer.clearLayers();
    state.active = false;
    state.drawn = 0;
    state.skipped = reviewRows().length;
    render();
  }

  function markerIcon(row) {
    const cls = `test-map-marker-v01 test-map-marker-${esc(row.category || 'general')}`;
    return L.divIcon({ className: cls, html: '', iconSize: [18, 18] });
  }

  function popupHtml(row) {
    return `<div class="test-map-popup-v01"><strong>${esc(row.title || 'Untitled')}</strong><span>${esc(row.borough || '')} - ${esc(row.display_time || 'Time TBA')}</span><span>${esc(row.display_location || row.location || '')}</span><span>match: ${esc(row.match_type || 'unknown')} | event_id ${esc(row.source_event_id || '')}</span></div>`;
  }

  function drawLayer() {
    ensureMap();
    if (!state.layer || !window.L) return;
    state.layer.clearLayers();
    const rows = gpsRows();
    const bounds = [];
    rows.forEach(row => {
      const lat = Number(row.lat);
      const lng = Number(row.lng);
      const marker = L.marker([lat, lng], { icon: markerIcon(row), title: row.title || 'NYCIF test event' }).bindPopup(popupHtml(row));
      marker.addTo(state.layer);
      bounds.push([lat, lng]);
    });
    state.drawn = rows.length;
    state.skipped = reviewRows().length;
    state.active = true;
    if (bounds.length && state.map) {
      state.map.fitBounds(bounds, { padding: [24, 24], maxZoom: 13 });
    }
  }

  function metric(label, value) {
    return `<div class="test-map-stat-v01"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
  }

  function reviewList() {
    const rows = reviewRows().slice(0, 8);
    if (!rows.length) return '<li><strong>No skipped rows.</strong> All test feed rows were drawable.</li>';
    return rows.map(row => `<li><strong>${esc(row.title || 'Untitled')}</strong> - ${esc(row.borough || '')} - ${esc(row.display_time || '')} - ${esc(row.display_location || row.location || '')}</li>`).join('');
  }

  function render() {
    ensurePanel();
    const body = document.getElementById('testMapBodyV01');
    if (!body) return;
    const rows = events();
    const ready = gpsRows().length;
    const skipped = reviewRows().length;
    const loaded = state.loadedAt ? state.loadedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Not loaded yet';
    body.innerHTML = `
      <div class="test-map-actions-v01">
        <button id="testMapLoadV01" type="button">Load Test Map Layer</button>
        <button id="testMapClearV01" type="button">Clear Layer</button>
      </div>
      <div class="test-map-stats-v01">
        ${metric('Feed rows', num(rows.length))}
        ${metric('GPS-ready', num(ready))}
        ${metric('Drawn', num(state.drawn))}
        ${metric('Skipped', num(state.active ? state.skipped : skipped))}
      </div>
      <p class="test-map-note-v01">
        Status: ${state.loading ? 'Loading...' : state.error ? `Error: ${esc(state.error)}` : state.active ? 'Test map layer active.' : 'Inactive.'}<br>
        Loaded on device: ${esc(loaded)}<br>
        This mini-map is test-only and does not replace the production map layer.
      </p>
      <div id="testMapCanvasV01" class="test-map-canvas-v01" role="application" aria-label="Test enriched feed map"></div>
      <ol class="test-map-review-v01">${reviewList()}</ol>
    `;
    body.querySelector('#testMapLoadV01')?.addEventListener('click', loadAndDraw);
    body.querySelector('#testMapClearV01')?.addEventListener('click', clearLayer);
    setTimeout(() => ensureMap(), 30);
  }

  window.addEventListener('DOMContentLoaded', () => {
    ensurePanel();
    render();
  });
})();
