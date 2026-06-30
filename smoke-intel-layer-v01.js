(() => {
  const VERSION = 'public-complaint-intel-layer-v01';
  const DATA_URL = './data/nycif_smoke_cannabis_vape_intel.json';
  const REPORT_URL = './data/reports/smoke_cannabis_vape_intel_report.json';

  const state = {
    map: null,
    layer: null,
    spots: [],
    report: null,
    loaded: false,
    loading: false,
    enabled: false
  };

  function clean(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function esc(value) {
    return clean(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function isNYCoord(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 40.4774 && lat <= 40.9176 && lng >= -74.2591 && lng <= -73.7004;
  }

  function normalizeSpot(row, index) {
    const lat = Number.parseFloat(row.lat);
    const lng = Number.parseFloat(row.lng);
    if (!isNYCoord(lat, lng)) return null;
    return {
      id: clean(row.id || row.raw_source_id || `public-intel-${index}`),
      title: clean(row.title || row.subtype_label || 'Public complaint intel'),
      address: clean(row.address || ''),
      borough: clean(row.borough || ''),
      subtypeLabel: clean(row.subtype_label || 'Public complaint intel'),
      descriptor: clean(row.descriptor || ''),
      complaintType: clean(row.complaint_type || ''),
      icon: clean(row.icon || '⚠️'),
      note: clean(row.data_note || 'Public complaint record; not proof of illegal activity.'),
      createdDate: clean(row.created_date || ''),
      lat,
      lng,
      source: clean(row.source || 'NYC public data'),
      sourceUrl: clean(row.source_url || '')
    };
  }

  function injectStyles() {
    if (document.getElementById('nycif-public-intel-layer-styles')) return;
    const style = document.createElement('style');
    style.id = 'nycif-public-intel-layer-styles';
    style.textContent = `
      .public-intel-marker {
        display: grid;
        place-items: center;
        width: 30px;
        height: 30px;
        border-radius: 999px;
        background: #14532d;
        color: #fff;
        border: 2px solid rgba(255,255,255,.92);
        box-shadow: 0 8px 22px rgba(0,0,0,.28);
        font-size: 15px;
      }
      .public-intel-popup {
        min-width: 220px;
        max-width: 285px;
        color: #111827;
        font: 500 12px/1.35 system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
      }
      .public-intel-popup .source {
        display: inline-flex;
        border-radius: 999px;
        padding: 3px 7px;
        background: rgba(20,83,45,.10);
        font-size: 10px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: .04em;
      }
      .public-intel-popup h2 { margin: 7px 0 5px; font-size: 15px; line-height: 1.15; }
      .public-intel-popup p { margin: 4px 0; }
      .public-intel-popup .note { color: #6b7280; font-size: 11px; }
      .public-intel-popup a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-top: 8px;
        min-height: 29px;
        padding: 0 10px;
        border-radius: 999px;
        background: #14532d;
        color: #fff !important;
        text-decoration: none !important;
        font-weight: 900;
      }
      .public-intel-note {
        display: block;
        margin-top: 4px;
        color: #6b7280;
        font-size: 10px;
        line-height: 1.25;
      }
      body.nycif-nightlife-mode .public-intel-note { color: #e5e7eb; }
    `;
    document.head.appendChild(style);
  }

  function status(text) {
    const el = document.getElementById('status');
    if (el) el.textContent = text;
  }

  function addFilterControl(attempt = 0) {
    const panel = document.getElementById('layersPanel');
    if (!panel) {
      if (attempt < 40) window.setTimeout(() => addFilterControl(attempt + 1), 250);
      return;
    }
    if (document.getElementById('publicIntelToggle')) return;

    const label = document.createElement('label');
    label.className = 'check public-intel-check';
    label.innerHTML = '<input type="checkbox" id="publicIntelToggle"> <span>🌿 Smoke / Vape Intel</span>';
    const note = document.createElement('small');
    note.className = 'public-intel-note';
    note.textContent = 'Public complaint intel from generated NYCIF JSON. Complaints are not proof of illegal activity.';
    panel.appendChild(label);
    panel.appendChild(note);

    label.querySelector('input').addEventListener('change', event => {
      state.enabled = event.target.checked;
      if (state.enabled) enableLayer();
      else disableLayer();
    });
  }

  function captureMap() {
    if (window.NYCIF_LEAFLET_MAP) {
      state.map = window.NYCIF_LEAFLET_MAP;
      return;
    }
    if (!window.L || !L.map || L.map.NYCIF_PUBLIC_INTEL_WRAPPED) return;
    const original = L.map.bind(L);
    function wrappedMap(...args) {
      const map = original(...args);
      window.NYCIF_LEAFLET_MAP = map;
      state.map = map;
      window.setTimeout(() => { if (state.enabled) enableLayer(); }, 250);
      return map;
    }
    wrappedMap.NYCIF_PUBLIC_INTEL_WRAPPED = true;
    L.map = wrappedMap;
  }

  async function loadJson(url, fallback) {
    try {
      const response = await fetch(`${url}?cache=${Date.now()}`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.warn('[NYCIF public intel]', url, error);
      return fallback;
    }
  }

  async function fetchRows() {
    if (state.loaded || state.loading) return;
    state.loading = true;
    status('Loading public complaint intel pins...');
    try {
      const [rows, report] = await Promise.all([loadJson(DATA_URL, []), loadJson(REPORT_URL, null)]);
      state.report = report;
      state.spots = Array.isArray(rows) ? rows.map(normalizeSpot).filter(Boolean) : [];
      state.loaded = true;
      if (state.spots.length) status(`Public complaint intel loaded: ${state.spots.length.toLocaleString()} mapped pins.`);
      else status('Public complaint intel file is ready, but no mapped pins have been generated yet.');
    } finally {
      state.loading = false;
    }
  }

  function popupHtml(spot) {
    const apple = `https://maps.apple.com/?daddr=${spot.lat},${spot.lng}&q=${encodeURIComponent(spot.title)}`;
    return `<article class="public-intel-popup"><div class="source">${esc(spot.icon)} ${esc(spot.subtypeLabel)}</div><h2>${esc(spot.title)}</h2>${spot.complaintType ? `<p><strong>${esc(spot.complaintType)}</strong></p>` : ''}${spot.descriptor ? `<p>${esc(spot.descriptor)}</p>` : ''}${spot.address ? `<p>${esc(spot.address)}</p>` : ''}${spot.borough ? `<p>${esc(spot.borough)}</p>` : ''}${spot.createdDate ? `<p><small>${esc(spot.createdDate)}</small></p>` : ''}<p class="note">${esc(spot.note)}</p><p><small>Source: ${esc(spot.source)}</small></p><a href="${apple}" target="_blank" rel="noopener">Directions</a></article>`;
  }

  function markerFor(spot) {
    const icon = L.divIcon({ className: 'public-intel-marker-shell', html: `<div class="public-intel-marker" title="${esc(spot.title)}">${esc(spot.icon)}</div>`, iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -15] });
    return L.marker([spot.lat, spot.lng], { icon, title: spot.title }).bindPopup(popupHtml(spot));
  }

  function drawLayer() {
    if (!state.map || !window.L || !state.enabled) return;
    if (!state.layer) state.layer = L.layerGroup();
    state.layer.clearLayers();
    state.spots.forEach(spot => state.layer.addLayer(markerFor(spot)));
    state.layer.addTo(state.map);
  }

  async function enableLayer() {
    captureMap();
    if (!state.map) {
      status('Public complaint intel waiting for map...');
      window.setTimeout(enableLayer, 300);
      return;
    }
    await fetchRows();
    drawLayer();
  }

  function disableLayer() {
    if (state.layer) state.layer.remove();
    status('Public complaint intel hidden.');
  }

  function boot() {
    injectStyles();
    captureMap();
    addFilterControl();
    window.NYCIF_PUBLIC_INTEL_LAYER = { version: VERSION, state, enableLayer, disableLayer };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
