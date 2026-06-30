(() => {
  const VERSION = 'nightlife-layer-v03';
  const DATA_URL = './data/nycif_nightlife_spots.json';
  const REPORT_URL = './data/reports/nightlife_pin_report.json';

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
      id: clean(row.id || row.raw_source_id || `nightlife-${index}`),
      title: clean(row.title || 'Nightlife spot'),
      address: clean(row.address || ''),
      borough: clean(row.borough || ''),
      license: clean(row.license || ''),
      group: Number(row.group || 2),
      subtype: clean(row.subtype || ''),
      subtypeLabel: clean(row.subtype_label || row.subtypeLabel || 'Nightlife / gathering spot'),
      lat,
      lng,
      source: clean(row.source || 'NYC Open Data'),
      sourceUrl: clean(row.source_url || row.sourceUrl || ''),
      locationQuality: clean(row.location_quality || row.locationQuality || '')
    };
  }

  function injectStyles() {
    if (document.getElementById('nycif-nightlife-layer-styles')) return;
    const style = document.createElement('style');
    style.id = 'nycif-nightlife-layer-styles';
    style.textContent = `
      .nightlife-marker {
        display: grid;
        place-items: center;
        width: 30px;
        height: 30px;
        border-radius: 999px;
        background: #111827;
        color: #fff;
        border: 2px solid rgba(255,255,255,.92);
        box-shadow: 0 8px 22px rgba(0,0,0,.28);
        font-size: 16px;
      }
      .nightlife-marker.group-two { background: #4b5563; }
      .nightlife-popup {
        min-width: 220px;
        max-width: 280px;
        color: #111827;
        font: 500 12px/1.35 system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
      }
      .nightlife-popup .source {
        display: inline-flex;
        border-radius: 999px;
        padding: 3px 7px;
        background: rgba(17,24,39,.08);
        font-size: 10px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: .04em;
      }
      .nightlife-popup h2 { margin: 7px 0 5px; font-size: 15px; line-height: 1.15; }
      .nightlife-popup p { margin: 4px 0; }
      .nightlife-popup a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-top: 8px;
        min-height: 29px;
        padding: 0 10px;
        border-radius: 999px;
        background: #111827;
        color: #fff !important;
        text-decoration: none !important;
        font-weight: 900;
      }
      .nightlife-note {
        display: block;
        margin-top: 4px;
        color: #6b7280;
        font-size: 10px;
        line-height: 1.25;
      }
      .nightlife-debug {
        margin-top: 8px;
        padding: 8px;
        border-radius: 12px;
        background: rgba(245, 158, 11, .14);
        color: #111827;
        font-size: 10px;
        line-height: 1.3;
      }
      body.nycif-nightlife-mode .nightlife-debug { color: #f8fafc; background: rgba(245, 158, 11, .18); }
    `;
    document.head.appendChild(style);
  }

  function status(text) {
    const el = document.getElementById('status');
    if (el) el.textContent = text;
    const meta = document.getElementById('listMeta');
    if (meta && state.enabled) meta.textContent = text;
  }

  function debug(text) {
    const el = document.getElementById('nightlifeDebug');
    if (!el) return;
    el.hidden = false;
    el.textContent = text;
  }

  function addFilterControl(attempt = 0) {
    const panel = document.getElementById('layersPanel');
    if (!panel) {
      if (attempt < 40) window.setTimeout(() => addFilterControl(attempt + 1), 250);
      return;
    }
    if (document.getElementById('nightlifeToggle')) return;

    const hr = document.createElement('hr');
    hr.className = 'nightlife-filter-break';
    const label = document.createElement('label');
    label.className = 'check nightlife-check';
    label.innerHTML = '<input type="checkbox" id="nightlifeToggle"> <span>🍸 5PM Spots</span>';
    const note = document.createElement('small');
    note.className = 'nightlife-note';
    note.textContent = 'Bars, clubs, lounges + nightlife-adjacent places from the NYCIF pin pipeline.';
    const debugBox = document.createElement('div');
    debugBox.id = 'nightlifeDebug';
    debugBox.className = 'nightlife-debug';
    debugBox.hidden = true;

    panel.appendChild(hr);
    panel.appendChild(label);
    panel.appendChild(note);
    panel.appendChild(debugBox);

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
    if (!window.L || !L.map || L.map.NYCIF_NIGHTLIFE_WRAPPED) return;
    const original = L.map.bind(L);
    function wrappedMap(...args) {
      const map = original(...args);
      window.NYCIF_LEAFLET_MAP = map;
      state.map = map;
      window.setTimeout(() => { if (state.enabled) enableLayer(); }, 250);
      return map;
    }
    wrappedMap.NYCIF_NIGHTLIFE_WRAPPED = true;
    L.map = wrappedMap;
  }

  async function loadJson(url, fallback) {
    try {
      const response = await fetch(`${url}?cache=${Date.now()}`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.warn('[NYCIF nightlife]', url, error);
      return fallback;
    }
  }

  async function fetchRows() {
    if (state.loaded || state.loading) return;
    state.loading = true;
    status('Loading 5PM spots from NYCIF pin pipeline...');
    try {
      const [rows, report] = await Promise.all([
        loadJson(DATA_URL, []),
        loadJson(REPORT_URL, null)
      ]);
      state.report = report;
      state.spots = Array.isArray(rows) ? rows.map(normalizeSpot).filter(Boolean) : [];
      state.loaded = true;
      if (state.spots.length) {
        const groupOne = state.spots.filter(spot => spot.group === 1).length;
        const groupTwo = state.spots.filter(spot => spot.group === 2).length;
        status(`5PM Spots loaded: ${state.spots.length.toLocaleString()} mapped places (${groupOne.toLocaleString()} strong, ${groupTwo.toLocaleString()} adjacent).`);
      } else {
        const review = report?.needs_review ?? 0;
        const rejected = report?.rejected ?? 0;
        status('5PM pin file is ready, but no mapped pins have been generated yet.');
        debug(`Pipeline output is wired. Mapped: 0. Needs review/geocode: ${review}. Rejected: ${rejected}. Run tools/pin-pipeline/build-nightlife-pins.mjs to populate data/nycif_nightlife_spots.json.`);
      }
    } finally {
      state.loading = false;
    }
  }

  function popupHtml(spot) {
    const apple = `https://maps.apple.com/?daddr=${spot.lat},${spot.lng}&q=${encodeURIComponent(spot.title)}`;
    const groupLabel = spot.group === 1 ? 'Strong nightlife match' : 'Nightlife-adjacent';
    return `<article class="nightlife-popup"><div class="source">🍸 ${esc(groupLabel)}</div><h2>${esc(spot.title)}</h2><p><strong>${esc(spot.subtypeLabel)}</strong></p>${spot.license ? `<p>${esc(spot.license)}</p>` : ''}${spot.address ? `<p>${esc(spot.address)}</p>` : ''}${spot.borough ? `<p>${esc(spot.borough)}</p>` : ''}${spot.locationQuality ? `<p><small>Location: ${esc(spot.locationQuality)}</small></p>` : ''}<p><small>Source: ${esc(spot.source)}</small></p><a href="${apple}" target="_blank" rel="noopener">Directions</a></article>`;
  }

  function markerFor(spot) {
    const icon = L.divIcon({
      className: 'nightlife-marker-shell',
      html: `<div class="nightlife-marker ${spot.group === 2 ? 'group-two' : ''}" title="${esc(spot.title)}">🍸</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -15]
    });
    return L.marker([spot.lat, spot.lng], { icon, title: spot.title }).bindPopup(popupHtml(spot));
  }

  function drawLayer() {
    if (!state.map || !window.L || !state.enabled) return;
    if (!state.layer) state.layer = L.layerGroup();
    state.layer.clearLayers();
    state.spots.forEach(spot => state.layer.addLayer(markerFor(spot)));
    state.layer.addTo(state.map);
    window.NYCIF_NIGHTLIFE_FOCUS?.fitNightlifeBounds?.();
  }

  async function enableLayer() {
    captureMap();
    if (!state.map) {
      status('5PM Spots waiting for map...');
      window.setTimeout(enableLayer, 300);
      return;
    }
    await fetchRows();
    drawLayer();
  }

  function disableLayer() {
    if (state.layer) state.layer.remove();
    const debugBox = document.getElementById('nightlifeDebug');
    if (debugBox) debugBox.hidden = true;
    status('5PM Spots hidden.');
  }

  function boot() {
    injectStyles();
    captureMap();
    addFilterControl();
    window.NYCIF_NIGHTLIFE_LAYER = { version: VERSION, state, enableLayer, disableLayer };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
