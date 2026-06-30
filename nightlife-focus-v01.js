(() => {
  const VERSION = 'nightlife-focus-v01';
  const MODE_CLASS = 'nycif-nightlife-mode';
  let previousListMeta = '';

  function qs(selector) {
    return document.querySelector(selector);
  }

  function injectStyles() {
    if (document.getElementById('nycif-nightlife-focus-styles')) return;
    const style = document.createElement('style');
    style.id = 'nycif-nightlife-focus-styles';
    style.textContent = `
      body.${MODE_CLASS} .leaflet-tile-pane {
        filter: grayscale(.85) invert(.92) hue-rotate(180deg) brightness(.76) contrast(.92) saturate(.7);
      }

      body.${MODE_CLASS} .leaflet-marker-icon.marker-shell,
      body.${MODE_CLASS} .leaflet-marker-shadow {
        display: none !important;
      }

      body.${MODE_CLASS} .leaflet-marker-icon.nightlife-marker-shell {
        display: block !important;
      }

      body.${MODE_CLASS} .nightlife-marker {
        transform: scale(1.08);
        background: #020617;
        border-color: rgba(255,255,255,.96);
        box-shadow: 0 0 0 4px rgba(255,255,255,.10), 0 10px 26px rgba(0,0,0,.48);
      }

      body.${MODE_CLASS} .nightlife-marker.group-two {
        background: #374151;
        opacity: .88;
      }

      body.${MODE_CLASS} .map::after {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 402;
        background: radial-gradient(circle at 50% 42%, rgba(15,23,42,0) 0, rgba(15,23,42,.08) 52%, rgba(15,23,42,.22) 100%);
      }

      body.${MODE_CLASS} .layers-panel,
      body.${MODE_CLASS} .desk-drawer,
      body.${MODE_CLASS} .live-alerts-panel {
        background: rgba(15, 23, 42, .96) !important;
        color: #f8fafc !important;
        border-color: rgba(255,255,255,.12) !important;
      }

      body.${MODE_CLASS} .layers-panel .panel-label,
      body.${MODE_CLASS} .layers-panel .check,
      body.${MODE_CLASS} .nightlife-note,
      body.${MODE_CLASS} .list-meta,
      body.${MODE_CLASS} .sort,
      body.${MODE_CLASS} .desk-header p,
      body.${MODE_CLASS} .desk-header h1 {
        color: #e5e7eb !important;
      }

      body.${MODE_CLASS} .layers-panel hr {
        border-top-color: rgba(255,255,255,.14) !important;
      }

      body.${MODE_CLASS} #nightlifeToggle + span,
      body.${MODE_CLASS} .nightlife-check {
        color: #fff !important;
        font-weight: 950 !important;
      }

      body.${MODE_CLASS} .event-list::before {
        content: "🍸 It's 5PM Somewhere mode is on. The map is focused on bars, clubs, lounges and nightlife-adjacent gathering places from NYC Open Data.";
        display: block;
        padding: 12px;
        border-radius: 14px;
        background: rgba(255,255,255,.08);
        color: #f8fafc;
        font-size: 12px;
        font-weight: 800;
        line-height: 1.35;
      }

      body.${MODE_CLASS} .event-list .event-item {
        display: none !important;
      }

      body.${MODE_CLASS} #dateChips,
      body.${MODE_CLASS} .public-intro-v01 {
        opacity: .42;
      }

      body.${MODE_CLASS} .pill.layers-pill,
      body.${MODE_CLASS} .live-alerts-button,
      body.${MODE_CLASS} .near-me-btn,
      body.${MODE_CLASS} .desk-btn {
        background: rgba(15,23,42,.94) !important;
        color: #fff !important;
        border-color: rgba(255,255,255,.16) !important;
      }

      body.${MODE_CLASS} .pill.layers-pill span,
      body.${MODE_CLASS} .live-alerts-dot {
        background: #f59e0b !important;
        color: #111827 !important;
      }
    `;
    document.head.appendChild(style);
  }

  function status(text) {
    const el = document.getElementById('status');
    if (el) el.textContent = text;
  }

  function setListMeta(text) {
    const el = document.getElementById('listMeta');
    if (!el) return;
    if (!previousListMeta && !document.body.classList.contains(MODE_CLASS)) previousListMeta = el.textContent || '';
    el.textContent = text;
  }

  function restoreListMeta() {
    const el = document.getElementById('listMeta');
    if (el && previousListMeta) el.textContent = previousListMeta;
    previousListMeta = '';
  }

  function layerApi() {
    return window.NYCIF_NIGHTLIFE_LAYER || null;
  }

  function fitNightlifeBounds(attempt = 0) {
    const api = layerApi();
    const map = api?.state?.map;
    const spots = api?.state?.spots || [];
    if (!document.body.classList.contains(MODE_CLASS)) return;

    if (!map || !spots.length) {
      if (attempt < 40) window.setTimeout(() => fitNightlifeBounds(attempt + 1), 250);
      return;
    }

    const groupOne = spots.filter(spot => spot.group === 1).length;
    const groupTwo = spots.filter(spot => spot.group === 2).length;
    const points = spots.slice(0, 1500).map(spot => [spot.lat, spot.lng]);
    if (points.length) {
      map.fitBounds(points, { padding: [64, 64], maxZoom: 13 });
      window.setTimeout(() => map.invalidateSize(), 120);
    }
    setListMeta(`🍸 It's 5PM Somewhere · ${spots.length.toLocaleString()} places · ${groupOne.toLocaleString()} strong nightlife · ${groupTwo.toLocaleString()} adjacent`);
    status(`5PM mode: ${spots.length.toLocaleString()} nightlife/gathering spots focused.`);
  }

  function enableFocusMode() {
    document.body.classList.add(MODE_CLASS);
    setListMeta('🍸 Loading 5PM nightlife and gathering spots...');
    fitNightlifeBounds();
  }

  function disableFocusMode() {
    document.body.classList.remove(MODE_CLASS);
    restoreListMeta();
    status('5PM mode off. Regular NYCIF assignments restored.');
  }

  function bindToggle(attempt = 0) {
    const toggle = document.getElementById('nightlifeToggle');
    if (!toggle) {
      if (attempt < 50) window.setTimeout(() => bindToggle(attempt + 1), 200);
      return;
    }
    if (toggle.dataset.nycifFocusBound === '1') return;
    toggle.dataset.nycifFocusBound = '1';
    toggle.addEventListener('change', () => {
      if (toggle.checked) enableFocusMode();
      else disableFocusMode();
    });
    if (toggle.checked) enableFocusMode();
  }

  function boot() {
    injectStyles();
    bindToggle();
    window.NYCIF_NIGHTLIFE_FOCUS = { version: VERSION, enableFocusMode, disableFocusMode, fitNightlifeBounds };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
