(() => {
  const VERSION = 'v0.1-staged-marker-layer';
  const STAGED_URL = 'https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/data/nycif_staged_live_events.json';
  const CENTER = [40.7128, -74.0060];
  const state = { loading: false, error: '', feed: null, loadedAt: null, map: null, layer: null, active: false, drawn: 0 };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const num = value => Number.isFinite(Number(value)) ? Number(value).toLocaleString() : '0';
  const events = () => Array.isArray(state.feed?.events) ? state.feed.events : [];
  const isReady = row => row && row.production_ready === true && row.needs_review === false && Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lng));
  const readyRows = () => events().filter(isReady);
  const skippedRows = () => events().filter(row => !isReady(row));

  function ensurePanel() {
    if (document.getElementById('stagedMarkerPanelV01')) return;
    const toggle = document.createElement('button');
    toggle.id = 'stagedMarkerToggleV01';
    toggle.className = 'staged-map-toggle-v01';
    toggle.type = 'button';
    toggle.textContent = 'Staged Map';

    const panel = document.createElement('aside');
    panel.id = 'stagedMarkerPanelV01';
    panel.className = 'staged-map-panel-v01';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'NYCIF staged marker map layer');
    panel.innerHTML = `
      <header>
        <div>
          <h2>Staged Marker Layer</h2>
          <p>Draws production-ready staged-feed rows - ${VERSION}</p>
        </div>
        <button class="staged-map-close-v01" type="button" aria-label="Close staged marker panel">x</button>
      </header>
      <div id="stagedMarkerBodyV01" class="staged-map-body-v01"></div>
    `;

    document.body.append(toggle, panel);
    toggle.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
      render();
      if (!panel.hidden) setTimeout(() => ensureMap(), 60);
    });
    panel.querySelector('.staged-map-close-v01')?.addEventListener('click', () => { panel.hidden = true; });
  }

  async function getJson(url) {
    const response = await fetch(`${url}?qa=${Date.now()}`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`staged feed HTTP ${response.status}`);
    return response.json();
  }

  function ensureMap() {
    const canvas = document.getElementById('stagedMarkerCanvasV01');
    if (!canvas || !window.L) return;
    if (!state.map) {
      state.map = L.map(canvas, { zoomControl: true, closePopupOnClick: false, tap: false }).setView(CENTER, 11);
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
      state.feed = await getJson(STAGED_URL);
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
    render();
  }

  function popupHtml(row) {
    return `<strong>${esc(row.title || 'Untitled')}</strong><br>${esc(row.borough || '')} - ${esc(row.display_time || 'Time TBA')}<br>${esc(row.display_location || row.location || '')}<br>match: ${esc(row.match_type || 'unknown')} | staged ready<br>event_id ${esc(row.source_event_id || '')}`;
  }

  function drawLayer() {
    ensureMap();
    if (!state.layer || !window.L) return;
    state.layer.clearLayers();
    const rows = readyRows();
    const bounds = [];
    rows.forEach(row => {
      const lat = Number(row.lat);
      const lng = Number(row.lng);
      L.circleMarker([lat, lng], { radius: 7, weight: 2, opacity: 1, fillOpacity: 0.85 }).bindPopup(popupHtml(row)).addTo(state.layer);
      bounds.push([lat, lng]);
    });
    state.drawn = rows.length;
    state.active = true;
    if (bounds.length && state.map) {
      state.map.fitBounds(bounds, { padding: [24, 24], maxZoom: 13 });
    }
  }

  function metric(label, value) {
    return `<div class="staged-map-stat-v01"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
  }

  function skippedList() {
    const rows = skippedRows().slice(0, 8);
    if (!rows.length) return '<li><strong>No skipped staged rows.</strong> All staged rows were drawable.</li>';
    return rows.map(row => `<li><strong>${esc(row.title || 'Untitled')}</strong> - ${esc(row.borough || '')} - ${esc(row.display_time || '')} - ${esc(row.display_location || row.location || '')}</li>`).join('');
  }

  function render() {
    ensurePanel();
    const body = document.getElementById('stagedMarkerBodyV01');
    if (!body) return;
    const rows = events();
    const ready = readyRows().length;
    const skipped = skippedRows().length;
    const loaded = state.loadedAt ? state.loadedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Not loaded yet';
    body.innerHTML = `
      <div class="staged-map-actions-v01">
        <button id="stagedMarkerLoadV01" type="button">Load Staged Markers</button>
        <button id="stagedMarkerClearV01" type="button">Clear Staged Layer</button>
      </div>
      <div class="staged-map-stats-v01">
        ${metric('Staged rows', num(rows.length))}
        ${metric('Drawable', num(ready))}
        ${metric('Drawn', num(state.drawn))}
        ${metric('Skipped', num(skipped))}
      </div>
      <p class="staged-map-note-v01">
        Status: ${state.loading ? 'Loading...' : state.error ? `Error: ${esc(state.error)}` : state.active ? 'Staged marker layer active.' : 'Inactive.'}<br>
        Loaded on device: ${esc(loaded)}<br>
        This staged layer does not replace the production map feed.
      </p>
      <div id="stagedMarkerCanvasV01" class="staged-map-canvas-v01" role="application" aria-label="Staged marker feed map"></div>
      <ol class="test-map-review-v01">${skippedList()}</ol>
    `;
    body.querySelector('#stagedMarkerLoadV01')?.addEventListener('click', loadAndDraw);
    body.querySelector('#stagedMarkerClearV01')?.addEventListener('click', clearLayer);
    setTimeout(() => ensureMap(), 30);
  }

  window.addEventListener('DOMContentLoaded', () => {
    ensurePanel();
    render();
  });
})();
