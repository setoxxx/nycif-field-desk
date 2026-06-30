(() => {
  const STORAGE_KEY = 'nycif-live-alerts-v02';
  const FEED_HINT = 'nycif-live-feeds';
  const DEFAULT_DURATION_MINUTES = 120;
  const NOW_GRACE_MINUTES = 10;
  const EARTH_RADIUS_MILES = 3958.8;

  const state = {
    enabled: false,
    radiusMiles: 1,
    userLocation: null,
    rows: [],
    alertedKeys: new Set(),
    circle: null,
    panel: null,
    button: null,
    alertBox: null,
    lastMatchCount: 0
  };

  const originalFetch = window.fetch ? window.fetch.bind(window) : null;

  function clean(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function loadPrefs() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (Number.isFinite(Number(saved.radiusMiles))) state.radiusMiles = Number(saved.radiusMiles);
      state.enabled = saved.enabled === true;
    } catch {}
  }

  function savePrefs() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: state.enabled, radiusMiles: state.radiusMiles }));
  }

  function milesBetween(a, b) {
    if (!a || !b) return Infinity;
    const toRad = deg => deg * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(x));
  }

  function rowId(row, index = 0) {
    return clean(row?.id || row?.source_event_id || row?.event_id || `${row?.title || 'event'}-${row?.start_date_time || row?.start || row?.date || index}`);
  }

  function parseRows(json) {
    const rows = Array.isArray(json) ? json : Array.isArray(json?.events) ? json.events : [];
    if (!rows.length) return;
    const merged = new Map(state.rows.map((row, index) => [rowId(row, index), row]));
    rows.forEach((row, index) => {
      if (!row || typeof row !== 'object') return;
      const lat = Number.parseFloat(row.lat);
      const lng = Number.parseFloat(row.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      merged.set(rowId(row, index), row);
    });
    state.rows = [...merged.values()];
    checkHappeningNow(false);
    updatePanelStatus();
  }

  if (originalFetch) {
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      try {
        const url = String(args[0]?.url || args[0] || '');
        if (url.includes(FEED_HINT)) response.clone().json().then(parseRows).catch(() => {});
      } catch {}
      return response;
    };
  }

  function injectStyles() {
    if (document.getElementById('nycif-live-alert-styles')) return;
    const style = document.createElement('style');
    style.id = 'nycif-live-alert-styles';
    style.textContent = `
      .live-alerts-button {
        position: absolute;
        left: 12px;
        top: 62px;
        z-index: 1180;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        min-height: 36px;
        padding: 8px 12px;
        border: 1px solid rgba(255,255,255,.35);
        border-radius: 999px;
        background: rgba(255,255,255,.92);
        color: #121212;
        font: 850 13px/1 system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
        box-shadow: 0 8px 22px rgba(0,0,0,.18);
        backdrop-filter: blur(12px) saturate(1.2);
        -webkit-backdrop-filter: blur(12px) saturate(1.2);
        cursor: pointer;
      }
      .live-alerts-dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: #d40000;
        box-shadow: 0 0 0 4px rgba(212,0,0,.12);
      }
      .live-alerts-button.is-on .live-alerts-dot { animation: nycifLivePulse 1.5s infinite; }
      @keyframes nycifLivePulse {
        0% { box-shadow: 0 0 0 0 rgba(212,0,0,.35); }
        70% { box-shadow: 0 0 0 9px rgba(212,0,0,0); }
        100% { box-shadow: 0 0 0 0 rgba(212,0,0,0); }
      }
      .live-alerts-panel {
        position: absolute;
        left: 12px;
        top: 106px;
        z-index: 1181;
        width: min(330px, calc(100vw - 24px));
        padding: 14px;
        border-radius: 18px;
        background: rgba(255,255,255,.97);
        color: #161616;
        border: 1px solid rgba(0,0,0,.1);
        box-shadow: 0 18px 50px rgba(0,0,0,.22);
        font: 500 13px/1.35 system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
        backdrop-filter: blur(16px) saturate(1.15);
        -webkit-backdrop-filter: blur(16px) saturate(1.15);
      }
      .live-alerts-panel[hidden], .live-alert-toast[hidden] { display: none; }
      .live-alerts-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
      .live-alerts-header strong { display: inline-flex; align-items: center; gap: 7px; font-size: 15px; }
      .live-alerts-close { border: 0; border-radius: 999px; width: 30px; height: 30px; background: #111; color: #fff; cursor: pointer; font-weight: 900; }
      .live-alerts-help { color: #4c4c4c; margin: 0 0 12px; }
      .live-alerts-field { display: grid; gap: 7px; margin: 12px 0; }
      .live-alerts-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .live-alerts-select { appearance: none; border: 1px solid rgba(0,0,0,.14); border-radius: 12px; background: #f5f7fb; color: #111; padding: 9px 12px; font-weight: 800; }
      .live-alerts-primary { width: 100%; border: 0; border-radius: 14px; background: #d40000; color: #fff; padding: 11px 12px; font-weight: 900; cursor: pointer; box-shadow: 0 8px 18px rgba(212,0,0,.22); }
      .live-alerts-primary.is-on { background: #111; }
      .live-alerts-status { margin-top: 10px; padding: 9px 10px; border-radius: 12px; background: rgba(0,122,255,.08); color: #14345a; font-size: 12px; }
      .happening-now-list { display: grid; gap: 8px; margin-top: 10px; }
      .happening-now-item { border: 1px solid rgba(212,0,0,.14); background: #fff7f7; color: #161616; border-radius: 12px; padding: 9px 10px; }
      .happening-now-item strong { display: block; font-size: 12.5px; margin-bottom: 3px; }
      .happening-now-item small { display: block; color: #5b5b5b; }
      .happening-badge { display: inline-flex; align-items: center; gap: 5px; border-radius: 999px; background: #d40000; color: #fff; padding: 3px 7px; font-size: 11px; font-weight: 900; margin-bottom: 6px; }
      .live-alert-radius-circle { position: absolute; z-index: 670; border-radius: 50%; border: 2px solid rgba(212,0,0,.7); background: rgba(212,0,0,.08); box-shadow: 0 0 0 1px rgba(255,255,255,.65) inset; pointer-events: none; transform: translate(-50%, -50%); }
      .live-alert-toast { position: absolute; left: 50%; bottom: 86px; transform: translateX(-50%); z-index: 1220; width: min(380px, calc(100vw - 24px)); border-radius: 18px; background: rgba(17,17,17,.95); color: #fff; padding: 14px; box-shadow: 0 18px 52px rgba(0,0,0,.35); font: 500 13px/1.35 system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; }
      .live-alert-toast strong { display: block; margin-bottom: 4px; font-size: 15px; }
      .live-alert-toast small { display: block; color: rgba(255,255,255,.72); margin-top: 6px; }
      .live-alert-toast-actions { display: flex; gap: 8px; margin-top: 10px; }
      .live-alert-toast-actions button { flex: 1; border: 0; border-radius: 999px; padding: 9px 10px; font-weight: 800; cursor: pointer; }
      .live-alert-toast-actions .dismiss { background: rgba(255,255,255,.14); color: #fff; }
      .live-alert-toast-actions .open { background: #fff; color: #111; }
      @media (max-width: 640px) { .live-alerts-button { top: 58px; font-size: 12px; } .live-alerts-panel { top: 102px; } }
    `;
    document.head.appendChild(style);
  }

  function mapShell() { return document.querySelector('.map-shell') || document.body; }

  function buildUi() {
    if (state.button) return;
    const shell = mapShell();
    const button = document.createElement('button');
    button.id = 'liveAlertsBtn';
    button.className = 'live-alerts-button';
    button.type = 'button';
    button.innerHTML = '<span class="live-alerts-dot" aria-hidden="true"></span><span>Live Alerts</span>';
    button.addEventListener('click', () => openPanel(true));
    shell.appendChild(button);
    state.button = button;

    const panel = document.createElement('section');
    panel.id = 'liveAlertsPanel';
    panel.className = 'live-alerts-panel';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="live-alerts-header"><strong><span class="live-alerts-dot" aria-hidden="true"></span> Happening Now</strong><button class="live-alerts-close" type="button" aria-label="Close live alerts">x</button></div>
      <p class="live-alerts-help">Turn this on to approve location and find events happening now inside your radius, based on this device's clock.</p>
      <div class="live-alerts-field"><label class="live-alerts-row"><span>Search radius</span><select class="live-alerts-select" id="liveAlertRadius"><option value="0.25">0.25 mi</option><option value="0.5">0.5 mi</option><option value="1">1 mi</option><option value="2">2 mi</option><option value="5">5 mi</option><option value="10">10 mi</option><option value="25">25 mi</option></select></label></div>
      <button class="live-alerts-primary" id="liveAlertToggle" type="button">Turn on Happening Now</button>
      <div class="live-alerts-status" id="liveAlertStatus">Location is only requested after you turn this on.</div>
      <div class="happening-now-list" id="happeningNowList"></div>
    `;
    shell.appendChild(panel);
    state.panel = panel;

    const alertBox = document.createElement('div');
    alertBox.id = 'liveAlertToast';
    alertBox.className = 'live-alert-toast';
    alertBox.hidden = true;
    shell.appendChild(alertBox);
    state.alertBox = alertBox;

    panel.querySelector('.live-alerts-close').addEventListener('click', () => { panel.hidden = true; });
    const radiusSelect = panel.querySelector('#liveAlertRadius');
    radiusSelect.value = String(state.radiusMiles);
    radiusSelect.addEventListener('change', () => { state.radiusMiles = Number(radiusSelect.value) || 1; savePrefs(); updateRadiusCircle(); checkHappeningNow(false); updatePanelStatus(); });
    panel.querySelector('#liveAlertToggle').addEventListener('click', toggleAlerts);
    updateButtonState();
  }

  function openPanel(open) { state.panel.hidden = !open; if (open && !state.enabled) updatePanelStatus('Choose a radius, then turn on Happening Now to approve location.'); }

  function updateButtonState() {
    if (!state.button || !state.panel) return;
    state.button.classList.toggle('is-on', state.enabled);
    const toggle = state.panel.querySelector('#liveAlertToggle');
    if (toggle) { toggle.classList.toggle('is-on', state.enabled); toggle.textContent = state.enabled ? 'Happening Now On' : 'Turn on Happening Now'; }
  }

  function updatePanelStatus(customText) {
    const el = state.panel?.querySelector('#liveAlertStatus');
    if (!el) return;
    if (customText) { el.textContent = customText; return; }
    if (!state.enabled) { el.textContent = 'Location is only requested after you turn this on.'; return; }
    const loaded = state.rows.length ? `${state.rows.length.toLocaleString()} events loaded` : 'Waiting for event feed';
    const matchText = state.lastMatchCount ? `${state.lastMatchCount} happening now inside radius` : 'No events happening now inside radius';
    el.textContent = `${loaded} · device time ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · ${state.radiusMiles} mi radius · ${matchText}`;
  }

  function requestLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('Location is not available in this browser.')); return; }
      navigator.geolocation.getCurrentPosition(
        position => { const { latitude, longitude, accuracy } = position.coords; state.userLocation = { lat: latitude, lng: longitude, accuracy }; resolve(state.userLocation); },
        error => reject(error),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 }
      );
    });
  }

  async function toggleAlerts() {
    if (state.enabled) { openPanel(true); checkHappeningNow(true); return; }
    updatePanelStatus('Requesting location approval...');
    try {
      await requestLocation();
      state.enabled = true;
      savePrefs();
      updateButtonState();
      updatePanelStatus('Happening Now is on. Drawing your radius now.');
      const locateBtn = document.getElementById('locateBtn');
      if (locateBtn) locateBtn.click();
      setTimeout(updateRadiusCircle, 450);
      setTimeout(() => checkHappeningNow(true), 700);
    } catch (error) { updatePanelStatus(`Location approval failed: ${error.message || error}`); }
  }

  function currentZoom() {
    const tile = document.querySelector('.leaflet-tile[src*="tile.openstreetmap.org"]');
    const match = tile?.getAttribute('src')?.match(/\/(\d+)\/\d+\/\d+\.png/);
    return match ? Number(match[1]) : 12;
  }

  function userMarkerPoint() {
    const marker = document.querySelector('.user-location-shell');
    if (!marker) return null;
    const markerRect = marker.getBoundingClientRect();
    const shellRect = mapShell().getBoundingClientRect();
    return { x: markerRect.left + markerRect.width / 2 - shellRect.left, y: markerRect.top + markerRect.height / 2 - shellRect.top };
  }

  function updateRadiusCircle() {
    if (!state.enabled || !state.userLocation) return;
    const shell = mapShell();
    if (!state.circle) { const circle = document.createElement('div'); circle.className = 'live-alert-radius-circle'; shell.appendChild(circle); state.circle = circle; }
    const point = userMarkerPoint();
    if (!point) return;
    const meters = state.radiusMiles * 1609.344;
    const metersPerPixel = 156543.03392 * Math.cos(state.userLocation.lat * Math.PI / 180) / (2 ** currentZoom());
    const radiusPx = Math.max(24, meters / metersPerPixel);
    state.circle.style.width = `${radiusPx * 2}px`;
    state.circle.style.height = `${radiusPx * 2}px`;
    state.circle.style.left = `${point.x}px`;
    state.circle.style.top = `${point.y}px`;
  }

  function eventStart(row) {
    const raw = row?.start_date_time || row?.start || row?.date || '';
    const t = raw ? Date.parse(raw) : NaN;
    return Number.isFinite(t) ? new Date(t) : null;
  }

  function eventEnd(row, start) {
    const raw = row?.end_date_time || row?.end || '';
    const t = raw ? Date.parse(raw) : NaN;
    if (Number.isFinite(t)) return new Date(t);
    return new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60000);
  }

  function happeningNow(row, now = new Date()) {
    if (!state.userLocation) return null;
    const lat = Number.parseFloat(row?.lat);
    const lng = Number.parseFloat(row?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const start = eventStart(row);
    if (!start) return null;
    const end = eventEnd(row, start);
    const startWithGrace = new Date(start.getTime() - NOW_GRACE_MINUTES * 60000);
    if (now < startWithGrace || now > end) return null;
    const miles = milesBetween(state.userLocation, { lat, lng });
    if (miles > state.radiusMiles) return null;
    return { row, start, end, miles };
  }

  function checkHappeningNow(showQuietState) {
    if (!state.enabled || !state.userLocation || !state.rows.length) { updatePanelStatus(); return; }
    const now = new Date();
    const matches = state.rows.map(row => happeningNow(row, now)).filter(Boolean).sort((a, b) => a.miles - b.miles || a.start - b.start);
    state.lastMatchCount = matches.length;
    updatePanelStatus();
    renderHappeningList(matches);
    updateRadiusCircle();

    const fresh = matches.find(match => {
      const key = `${rowId(match.row)}-${match.start.toISOString()}`;
      if (state.alertedKeys.has(key)) return false;
      state.alertedKeys.add(key);
      return true;
    });
    if (fresh) showAlert(fresh);
    else if (showQuietState && !matches.length) showQuietAlert();
  }

  function titleFor(row) { return clean(row?.title || row?.name || 'NYC event'); }
  function locationFor(row) { return clean(row?.display_location || row?.location || row?.address || row?.borough || 'New York City'); }
  function shortTime(date) { return date.toLocaleString([], { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' }); }

  function renderHappeningList(matches) {
    const list = document.getElementById('happeningNowList');
    if (!list) return;
    if (!state.enabled) { list.innerHTML = ''; return; }
    if (!matches.length) { list.innerHTML = '<div class="happening-now-item"><span class="happening-badge">LIVE</span><strong>No matches right now</strong><small>Try a larger radius or load more events.</small></div>'; return; }
    list.innerHTML = matches.slice(0, 6).map(match => `<div class="happening-now-item"><span class="happening-badge">Happening Now</span><strong>${titleFor(match.row)}</strong><small>${shortTime(match.start)} · ${match.miles.toFixed(match.miles < 10 ? 1 : 0)} mi away</small><small>${locationFor(match.row)}</small></div>`).join('');
  }

  function showAlert(match) {
    const row = match.row;
    state.alertBox.innerHTML = `<strong>Happening Now nearby</strong><div>${titleFor(row)}</div><small>${shortTime(match.start)} · ${match.miles.toFixed(match.miles < 10 ? 1 : 0)} mi away</small><small>${locationFor(row)}</small><div class="live-alert-toast-actions"><button type="button" class="open">Open Event List</button><button type="button" class="dismiss">Dismiss</button></div>`;
    state.alertBox.hidden = false;
    state.alertBox.querySelector('.dismiss').addEventListener('click', () => { state.alertBox.hidden = true; });
    state.alertBox.querySelector('.open').addEventListener('click', () => { state.alertBox.hidden = true; document.getElementById('deskBtn')?.click(); });
  }

  function showQuietAlert() {
    state.alertBox.innerHTML = `<strong>Happening Now is on</strong><div>No events are happening now inside your ${state.radiusMiles} mi radius based on this device's time.</div><div class="live-alert-toast-actions"><button type="button" class="dismiss">OK</button></div>`;
    state.alertBox.hidden = false;
    state.alertBox.querySelector('.dismiss').addEventListener('click', () => { state.alertBox.hidden = true; });
  }

  function boot() {
    loadPrefs();
    injectStyles();
    buildUi();
    if (state.enabled) updatePanelStatus('Happening Now was previously on. Click Live Alerts to refresh location approval.');
    window.addEventListener('resize', updateRadiusCircle);
    setInterval(updateRadiusCircle, 1000);
    setInterval(() => checkHappeningNow(false), 60000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
