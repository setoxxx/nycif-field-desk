(() => {
  const VERSION = 'popup-autoclose-fix-v05-hide-close-button';
  let lastPopup = null;
  let lock = false;

  function injectPopupArtifactCss() {
    if (document.getElementById('nycif-popup-artifact-fix')) return;
    const style = document.createElement('style');
    style.id = 'nycif-popup-artifact-fix';
    style.textContent = `
      .leaflet-popup-pane {
        z-index: 1400 !important;
      }
      .leaflet-popup {
        margin-bottom: 22px !important;
        z-index: 1401 !important;
      }
      .leaflet-popup-content-wrapper {
        background: transparent !important;
        border: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        padding: 0 !important;
        overflow: visible !important;
      }
      .leaflet-popup-content {
        margin: 0 !important;
        width: min(340px, calc(100vw - 28px)) !important;
        min-width: 0 !important;
        max-width: calc(100vw - 28px) !important;
        overflow: visible !important;
      }
      .leaflet-popup-tip-container {
        width: 28px !important;
        height: 14px !important;
        margin-left: -14px !important;
        overflow: hidden !important;
      }
      .leaflet-popup-tip {
        background: #fff !important;
        border: 0 !important;
        box-shadow: 0 7px 16px rgba(0, 0, 0, .16) !important;
      }
      .popup-card {
        display: block !important;
        position: relative !important;
        background: #fff !important;
        border: 1px solid rgba(17, 24, 39, .10) !important;
        border-radius: 18px !important;
        padding: 13px !important;
        box-shadow: 0 16px 42px rgba(0, 0, 0, .24) !important;
        max-height: min(68dvh, 540px) !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        -webkit-overflow-scrolling: touch !important;
        overscroll-behavior: contain !important;
      }
      .popup-card h2 {
        font-size: 18px !important;
        line-height: 1.12 !important;
        margin-right: 0 !important;
      }
      .popup-card dl {
        display: grid !important;
        gap: 8px !important;
      }
      .popup-card dl div {
        min-width: 0 !important;
      }
      .popup-card dd {
        overflow-wrap: anywhere !important;
        word-break: normal !important;
      }
      .popup-card dt + dd,
      .popup-card dd {
        max-width: 100% !important;
      }
      .popup-card dl div:has(dt:nth-child(1)) dd {
        max-height: 120px !important;
        overflow-y: auto !important;
        padding-right: 4px !important;
        -webkit-overflow-scrolling: touch !important;
      }
      .popup-card dl div dd:empty {
        display: none !important;
      }
      .popup-card .field-actions {
        position: sticky !important;
        bottom: -13px !important;
        margin: 10px -13px -13px !important;
        padding: 9px 13px 13px !important;
        background: linear-gradient(to top, #fff 78%, rgba(255,255,255,.92)) !important;
        z-index: 3 !important;
      }
      .leaflet-popup-close-button {
        display: none !important;
      }
      @media (max-width: 700px) {
        .leaflet-popup-content {
          width: min(350px, calc(100vw - 18px)) !important;
          max-width: calc(100vw - 18px) !important;
        }
        .popup-card {
          max-height: 62dvh !important;
          padding: 12px !important;
        }
        .popup-card dl div:has(dt:nth-child(1)) dd {
          max-height: 105px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function popupEls() {
    return Array.from(document.querySelectorAll('.leaflet-popup'));
  }

  function closePopup(el) {
    const close = el?.querySelector?.('.leaflet-popup-close-button');
    if (close) close.click();
    else el?.remove?.();
  }

  function closeActivePopup() {
    if (!lastPopup) return;
    closePopup(lastPopup);
    lastPopup = null;
  }

  function keepOnlyNewest() {
    if (lock) return;
    lock = true;
    window.requestAnimationFrame(() => {
      const popups = popupEls();
      if (popups.length > 1) {
        const newest = popups[popups.length - 1];
        popups.slice(0, -1).forEach(closePopup);
        lastPopup = newest;
      } else if (popups.length === 1) {
        lastPopup = popups[0];
      } else {
        lastPopup = null;
      }
      lock = false;
    });
  }

  function isInsidePopupOrMarker(event) {
    return !!event.target?.closest?.('.leaflet-popup, .popup-card, .leaflet-marker-icon, .marker-shell, .marker, .field-action');
  }

  function closeIfMapBackgroundClick(event) {
    if (!lastPopup) return;
    if (isInsidePopupOrMarker(event)) return;
    if (event.target?.closest?.('.leaflet-container')) closeActivePopup();
  }

  function closeIfMapPanGesture(event) {
    if (!lastPopup) return;
    if (isInsidePopupOrMarker(event)) return;
    if (event.target?.closest?.('.leaflet-container')) closeActivePopup();
  }

  injectPopupArtifactCss();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectPopupArtifactCss, { once: true });
  }

  document.addEventListener('click', event => {
    if (event.target?.closest?.('.leaflet-marker-icon, .marker-shell, .marker')) {
      setTimeout(keepOnlyNewest, 0);
      setTimeout(keepOnlyNewest, 80);
    }
  }, true);

  document.addEventListener('click', closeIfMapBackgroundClick, false);
  document.addEventListener('pointerdown', closeIfMapPanGesture, true);
  document.addEventListener('touchmove', closeIfMapPanGesture, true);
  document.addEventListener('wheel', closeIfMapPanGesture, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeActivePopup();
  });

  const observer = new MutationObserver(keepOnlyNewest);
  observer.observe(document.body, { childList: true, subtree: true });
  window.NYCIF_POPUP_AUTOCLOSE_FIX = { version: VERSION, active: true, artifactCss: true, longContentFix: true, mobilePanClose: true, closeButtonHidden: true };
})();
