(() => {
  'use strict';

  const VERSION = 'city-fleet-operator-layer-v01';
  const DEFAULT_STALE_MS = 90 * 1000;
  const NYC = { minLat: 40.4774, maxLat: 40.9176, minLng: -74.2591, maxLng: -73.7004 };

  function operatorMode() {
    try {
      const p = new URL(location.href).searchParams;
      return p.get('desk') === '1' || p.get('assignment') === '1';
    } catch {
      return false;
    }
  }

  if (!operatorMode()) return;

  const state = {
    enabled: false,
    layer: null,
    markers: new Map(),
    rows: [],
    timer: null,
    feedUrl: null,
    agencies: new Set(),
    staleMs: DEFAULT_STALE_MS
  };

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function clean(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function isNycCoord(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng)
      && lat >= NYC.minLat && lat <= NYC.maxLat
      && lng >= NYC.minLng && lng <= NYC.maxLng;
  }

  function resolveFeedUrl() {
    try {
      const raw = new URL(location.href).searchParams.get('cityFleetFeed');
      if (!raw) return null;
      const url = new URL(raw, location.href);
      if (url.protocol !== 'https:') return null;
      return url.href;
    } catch {
      return null;
    }
  }

  function normalizeRow(row) {
    if (!row || typeof row !== 'object') return null;
    const lat = Number(row.lat ?? row.latitude);
    const lng = Number(row.lng ?? row.longitude);
    if (!isNycCoord(lat, lng)) return null;
    const id = clean(row.id || row.vehicle_id || row.device_id || row.unit_id);
    if (!id) return null;
    const updated = Date.parse(row.updated_at || row.timestamp || row.last_update || '');
    return {
      id,
      agency: clean(row.agency || row.department || 'CITY'),
      vehicleType: clean(row.vehicle_type || row.type || row.asset_type || 'Vehicle'),
      label: clean(row.label || row.unit || row.name || id),
      lat,
      lng,
      heading: Number.isFinite(Number(row.heading)) ? Number(row.heading) : null,
      speed: Number.isFinite(Number(row.speed)) ? Number(row.speed) : null,
      updatedAt: Number.isFinite(updated) ? updated : Date.now(),
      status: clean(row.status || ''),
      source: clean(row.source || 'Authorized City Fleet Feed')
    };
  }

  function stale(row) {
    return Date.now() - row.updatedAt > state.staleMs;
  }

  function popupHtml(row) {
    const ageSec = Math.max(0, Math.round((Date.now() - row.updatedAt) / 1000));
    return `<article class="nycif-city-fleet-popup">
      <div class="tag">Authorized City Fleet</div>
      <h2>${esc(row.agency)} · ${esc(row.label)}</h2>
      <p><strong>${esc(row.vehicleType)}</strong></p>
      ${row.status ? `<p>Status: ${esc(row.status)}</p>` : ''}
      ${row.speed != null ? `<p>Speed: ${esc(Math.round(row.speed))}</p>` : ''}
      ${row.heading != null ? `<p>Heading: ${esc(Math.round(row.heading))}°</p>` : ''}
      <p>Last update: ${esc(ageSec)} sec ago${stale(row) ? ' · STALE' : ''}</p>
      <p class="muted">${esc(row.source)}</p>
    </article>`;
  }

  function markerIcon(row) {
    const isStale = stale(row);
    return window.L.divIcon({
      className: 'nycif-city-fleet-marker-shell',
      html: `<div class="nycif-city-fleet-marker${isStale ? ' is-stale' : ''}" title="${esc(row.agency)} ${esc(row.label)}">🚙</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -18]
    });
  }

  function upsertMarker(row) {
    let marker = state.markers.get(row.id);
    if (!marker) {
      marker = window.L.marker([row.lat, row.lng], {
        icon: markerIcon(row),
        title: `${row.agency} ${row.label}`,
        zIndexOffset: 4500
      }).bindPopup(popupHtml(row), { maxWidth: 320, minWidth: 220 });
      marker.addTo(state.layer);
      state.markers.set(row.id, marker);
    } else {
      marker.setLatLng([row.lat, row.lng]);
      marker.setIcon(markerIcon(row));
      marker.setPopupContent(popupHtml(row));
    }
  }

  function removeMissing(validIds) {
    for (const [id, marker] of state.markers.entries()) {
      if (validIds.has(id)) continue;
      state.layer.removeLayer(marker);
      state.markers.delete(id);
    }
  }

  function updateStatus(text) {
    const el = document.getElementById('nycif-city-fleet-status');
    if (el) el.textContent = text;
  }

  function render(rows) {
    const filtered = rows.filter(row => !state.agencies.size || state.agencies.has(row.agency));
    const ids = new Set(filtered.map(row => row.id));
    filtered.forEach(upsertMarker);
    removeMissing(ids);
    const liveCount = filtered.filter(row => !stale(row)).length;
    const staleCount = filtered.length - liveCount;
    updateStatus(`${filtered.length.toLocaleString()} vehicle${filtered.length === 1 ? '' : 's'} · ${liveCount.toLocaleString()} live · ${staleCount.toLocaleString()} stale`);
  }

  async function loadFeed() {
    if (!state.feedUrl) {
      updateStatus('No authorized City Fleet feed configured. Add ?cityFleetFeed=https://... in operator mode.');
      return;
    }
    try {
      const response = await fetch(state.feedUrl, { cache: 'no-store', credentials: 'include', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      const raw = Array.isArray(json) ? json : Array.isArray(json?.vehicles) ? json.vehicles : [];
      state.rows = raw.map(normalizeRow).filter(Boolean);
      if (state.enabled) render(state.rows);
      updateAgencyOptions();
    } catch (error) {
      updateStatus(`City Fleet feed unavailable: ${error.message || error}`);
    }
  }

  function setEnabled(enabled) {
    state.enabled = enabled;
    const checkbox = document.getElementById('nycifCityFleetToggle');
    if (checkbox) checkbox.checked = enabled;
    if (!state.layer) state.layer = window.L.layerGroup();
    if (enabled) {
      state.layer.addTo(window.NYCIF_MAIN_MAP);
      render(state.rows);
      loadFeed();
      if (!state.timer) state.timer = window.setInterval(loadFeed, 15000);
    } else {
      if (window.NYCIF_MAIN_MAP?.hasLayer?.(state.layer)) window.NYCIF_MAIN_MAP.removeLayer(state.layer);
      if (state.timer) window.clearInterval(state.timer);
      state.timer = null;
      updateStatus('City Fleet hidden.');
    }
  }

  function updateAgencyOptions() {
    const select = document.getElementById('nycifCityFleetAgency');
    if (!select) return;
    const agencies = [...new Set(state.rows.map(row => row.agency).filter(Boolean))].sort();
    const selected = select.value;
    select.innerHTML = '<option value="">All agencies</option>' + agencies.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
    if (agencies.includes(selected)) select.value = selected;
  }

  function ensureUi() {
    const panel = document.getElementById('layersPanel');
    if (!panel || document.getElementById('nycifCityFleetBlock')) return;
    const block = document.createElement('div');
    block.id = 'nycifCityFleetBlock';
    block.className = 'nycif-city-fleet-block';
    block.innerHTML = `
      <hr>
      <p class="panel-label">Operator layers</p>
      <label class="check"><input type="checkbox" id="nycifCityFleetToggle"> <span>🚙 City Fleet <small>authorized feed only</small></span></label>
      <label class="nycif-city-fleet-filter"><span>Agency</span><select id="nycifCityFleetAgency"><option value="">All agencies</option></select></label>
      <p id="nycif-city-fleet-status" class="nycif-city-fleet-status">City Fleet ready · operator-only · no feed configured.</p>
    `;
    panel.appendChild(block);
    block.querySelector('#nycifCityFleetToggle')?.addEventListener('change', event => setEnabled(event.target.checked));
    block.querySelector('#nycifCityFleetAgency')?.addEventListener('change', event => {
      state.agencies.clear();
      if (event.target.value) state.agencies.add(event.target.value);
      if (state.enabled) render(state.rows);
    });
  }

  function injectStyles() {
    if (document.getElementById('nycif-city-fleet-style')) return;
    const style = document.createElement('style');
    style.id = 'nycif-city-fleet-style';
    style.textContent = `
      .nycif-city-fleet-block { display:grid; gap:8px; }
      .nycif-city-fleet-filter { display:grid; gap:5px; font-size:11px; font-weight:800; }
      .nycif-city-fleet-filter select { width:100%; border:1px solid rgba(0,0,0,.14); border-radius:10px; padding:8px 10px; background:#fff; color:#111; }
      .nycif-city-fleet-status { margin:0; font-size:10px; line-height:1.35; color:#4b5563; }
      .nycif-city-fleet-marker { display:grid; place-items:center; width:32px; height:32px; border-radius:999px; border:2px solid #fff; background:#1f2937; box-shadow:0 8px 20px rgba(0,0,0,.3); font-size:16px; }
      .nycif-city-fleet-marker.is-stale { opacity:.45; filter:grayscale(1); }
      .nycif-city-fleet-popup { min-width:220px; max-width:300px; font:500 12px/1.4 system-ui,-apple-system,sans-serif; color:#111827; }
      .nycif-city-fleet-popup .tag { display:inline-flex; border-radius:999px; padding:2px 7px; background:#e5e7eb; font-size:10px; font-weight:900; text-transform:uppercase; }
      .nycif-city-fleet-popup h2 { margin:6px 0 4px; font-size:15px; }
      .nycif-city-fleet-popup p { margin:3px 0; }
      .nycif-city-fleet-popup .muted { color:#6b7280; font-size:11px; }
    `;
    document.head.appendChild(style);
  }

  function boot() {
    if (!window.L || !window.NYCIF_MAIN_MAP) {
      window.setTimeout(boot, 100);
      return;
    }
    state.feedUrl = resolveFeedUrl();
    injectStyles();
    ensureUi();
    window.NYCIF_CITY_FLEET = { version: VERSION, state, setEnabled, loadFeed, normalizeRow };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
