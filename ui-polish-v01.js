(() => {
  function injectStyles() {
    if (document.getElementById('nycif-ui-polish-v01')) return;
    const style = document.createElement('style');
    style.id = 'nycif-ui-polish-v01';
    style.textContent = `
      .locate-btn,
      .user-location-shell,
      .user-location {
        display: none !important;
      }

      .status {
        display: none !important;
      }

      .leaflet-overlay-pane svg path[stroke="#d40000"] {
        display: none !important;
      }

      .pill.layers-pill {
        top: calc(env(safe-area-inset-top, 0px) + 8px) !important;
        left: calc(env(safe-area-inset-left, 0px) + 8px) !important;
      }

      .live-alerts-button {
        top: calc(env(safe-area-inset-top, 0px) + 8px) !important;
        left: calc(env(safe-area-inset-left, 0px) + 102px) !important;
        min-height: 36px !important;
      }

      .live-alerts-panel {
        top: calc(env(safe-area-inset-top, 0px) + 52px) !important;
        left: calc(env(safe-area-inset-left, 0px) + 8px) !important;
      }

      .near-me-btn {
        top: calc(env(safe-area-inset-top, 0px) + 8px) !important;
        right: calc(env(safe-area-inset-right, 0px) + 8px) !important;
        min-height: 36px !important;
        padding: 0 13px !important;
        background: rgba(255,255,255,.94) !important;
        color: #111827 !important;
        border: 1px solid rgba(17, 24, 39, .12) !important;
        box-shadow: 0 8px 24px rgba(0,0,0,.18) !important;
      }

      .live-alerts-close {
        display: none !important;
      }

      .event-item .quick-actions .calendar-split-pill {
        background: #ffffff !important;
        border: 1px solid rgba(17, 24, 39, .10) !important;
        box-shadow: 0 4px 14px rgba(0,0,0,.08) !important;
      }

      .event-item .quick-actions .calendar-split-pill .calendar-split-segment {
        background: #f3f4f6 !important;
        color: #111827 !important;
        border: 1px solid rgba(17, 24, 39, .10) !important;
        text-shadow: none !important;
      }

      .event-item .quick-actions .calendar-split-pill .calendar-split-segment:hover,
      .event-item .quick-actions .calendar-split-pill .calendar-split-segment:active {
        background: #e5e7eb !important;
        color: #111827 !important;
        border-color: rgba(17, 24, 39, .16) !important;
      }

      .event-item .quick-actions .calendar-split-pill .calendar-split-icon {
        background: #ffffff !important;
        color: #2563eb !important;
        border-color: rgba(17, 24, 39, .14) !important;
      }

      .event-item .quick-actions .calendar-split-pill .calendar-split-icon::before {
        background: #c9ccd3 !important;
      }

      .event-item .quick-actions .calendar-split-pill .calendar-split-icon span,
      .event-item .quick-actions .calendar-split-pill .calendar-split-segment > span:last-child {
        color: inherit !important;
      }

      @media (max-width: 720px) {
        .brand-card {
          display: none !important;
        }

        .pill.layers-pill,
        .live-alerts-button,
        .near-me-btn {
          top: calc(env(safe-area-inset-top, 0px) + 8px) !important;
        }

        .live-alerts-button {
          left: calc(env(safe-area-inset-left, 0px) + 94px) !important;
        }

        .live-alerts-panel {
          top: calc(env(safe-area-inset-top, 0px) + 52px) !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function closePanel(panel, button) {
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    if (button) button.setAttribute('aria-expanded', 'false');
  }

  function closeFloatingPanels(except) {
    const layersPanel = document.getElementById('layersPanel');
    const layersBtn = document.getElementById('layersBtn');
    const livePanel = document.getElementById('liveAlertsPanel');

    if (except !== 'layers') closePanel(layersPanel, layersBtn);
    if (except !== 'live') closePanel(livePanel, null);
  }

  function bindAutoClose() {
    if (window.NYCIF_UI_POLISH_AUTOCLOSE) return;
    window.NYCIF_UI_POLISH_AUTOCLOSE = true;

    document.addEventListener('click', event => {
      const target = event.target;
      const layersPanel = document.getElementById('layersPanel');
      const layersBtn = document.getElementById('layersBtn');
      const livePanel = document.getElementById('liveAlertsPanel');

      const insideLayers = !!target.closest?.('#layersPanel, #layersBtn');
      const insideLive = !!target.closest?.('#liveAlertsPanel, #liveAlertsBtn');

      if (target.closest?.('#layersBtn')) {
        closeFloatingPanels('layers');
        return;
      }
      if (target.closest?.('#liveAlertsBtn')) {
        closeFloatingPanels('live');
        return;
      }
      if (target.closest?.('#deskBtn, #nearMeBtn, #map, .leaflet-container, .desk-drawer, .event-item')) {
        closeFloatingPanels(null);
        return;
      }
      if (!insideLayers && !insideLive) {
        closeFloatingPanels(null);
        return;
      }

      if (layersPanel && livePanel && insideLayers && !livePanel.hidden) closePanel(livePanel, null);
      if (layersPanel && livePanel && insideLive && !layersPanel.hidden) closePanel(layersPanel, layersBtn);
    }, true);

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeFloatingPanels(null);
    });
  }

  function boot() {
    injectStyles();
    bindAutoClose();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
