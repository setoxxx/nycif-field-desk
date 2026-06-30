(() => {
  function injectStyles() {
    if (document.getElementById('nycif-ui-polish-v01')) return;
    const style = document.createElement('style');
    style.id = 'nycif-ui-polish-v01';
    style.textContent = `
      .locate-btn {
        display: none !important;
      }

      .near-me-btn {
        top: calc(env(safe-area-inset-top, 0px) + 58px) !important;
        right: calc(env(safe-area-inset-right, 0px) + 8px) !important;
        min-height: 36px !important;
        padding: 0 13px !important;
        background: rgba(255,255,255,.94) !important;
        color: #111827 !important;
        border: 1px solid rgba(17, 24, 39, .12) !important;
        box-shadow: 0 8px 24px rgba(0,0,0,.18) !important;
      }

      .live-alerts-button {
        top: calc(env(safe-area-inset-top, 0px) + 58px) !important;
        left: calc(env(safe-area-inset-left, 0px) + 8px) !important;
        min-height: 36px !important;
      }

      .live-alerts-panel {
        top: calc(env(safe-area-inset-top, 0px) + 102px) !important;
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
        .near-me-btn,
        .live-alerts-button {
          top: calc(env(safe-area-inset-top, 0px) + 56px) !important;
        }
        .live-alerts-panel {
          top: calc(env(safe-area-inset-top, 0px) + 100px) !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectStyles, { once: true });
  else injectStyles();
})();
