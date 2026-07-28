(() => {
  'use strict';

  function install() {
    const controller = window.NYCIF_LIVE_LOCATION_CONTROLLER;
    const locateBtn = document.getElementById('locateBtn');
    const map = window.NYCIF_MAIN_MAP;

    if (!controller || !locateBtn) {
      return;
    }

    let syncing = false;
    let buttonObserver = null;
    let bodyObserver = null;

    function setAttributeIfChanged(element, name, value) {
      if (element.getAttribute(name) !== value) {
        element.setAttribute(name, value);
      }
    }

    function removeSeparateStopControl() {
      document.getElementById('liveLocationStopBtn')?.remove();
    }

    function syncSingleControlState() {
      if (syncing) return;
      syncing = true;
      try {
        const state = controller.getState();
        const tracking = Boolean(state.tracking);
        const following = Boolean(state.following);

        if (locateBtn.dataset.liveTracking !== String(tracking)) {
          locateBtn.dataset.liveTracking = String(tracking);
        }
        if (locateBtn.dataset.liveFollowing !== String(following)) {
          locateBtn.dataset.liveFollowing = String(following);
        }
        setAttributeIfChanged(locateBtn, 'aria-pressed', tracking ? 'true' : 'false');

        let label = 'Start live GPS tracking';
        if (tracking && following) {
          label = 'Stop live GPS tracking';
        } else if (tracking) {
          label = 'Recenter and resume live GPS tracking';
        }
        setAttributeIfChanged(locateBtn, 'aria-label', label);
        setAttributeIfChanged(locateBtn, 'title', label);
        removeSeparateStopControl();
      } finally {
        syncing = false;
      }
    }

    function stopLegacyMapMotion() {
      try { map?.stop?.(); } catch (_) {}
      try { map?.closePopup?.(); } catch (_) {}
    }

    function activateSingleControl(event) {
      const target = event.target?.closest?.('#locateBtn');
      if (!target) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      stopLegacyMapMotion();

      const state = controller.getState();
      if (!state.tracking) {
        controller.start();
      } else if (!state.following) {
        controller.resumeFollowing();
      } else {
        controller.stop();
      }

      window.setTimeout(syncSingleControlState, 0);
    }

    function closeLegacyLocationPopup(event) {
      const popup = event?.popup;
      const source = popup?._source;
      const className = String(source?.options?.icon?.options?.className || '');
      const content = popup?.getContent?.();
      const contentText = typeof content === 'string'
        ? content
        : String(content?.textContent || '');

      if (className.includes('user-location-shell') || /you are here/i.test(contentText)) {
        try { map?.closePopup?.(popup); } catch (_) {}
      }
    }

    document.addEventListener('click', activateSingleControl, true);
    map?.on?.('popupopen', closeLegacyLocationPopup);

    buttonObserver = new MutationObserver(syncSingleControlState);
    buttonObserver.observe(locateBtn, {
      attributes: true,
      attributeFilter: [
        'aria-label',
        'aria-pressed',
        'title',
        'data-live-tracking',
        'data-live-following'
      ]
    });

    if (document.body) {
      bodyObserver = new MutationObserver(removeSeparateStopControl);
      bodyObserver.observe(document.body, { childList: true, subtree: true });
    }

    removeSeparateStopControl();
    syncSingleControlState();

    window.NYCIF_LIVE_LOCATION_HANDOFF = Object.freeze({
      isActive: () => true,
      getButton: () => locateBtn,
      mode: 'single-control'
    });

    window.addEventListener('pagehide', () => {
      buttonObserver?.disconnect();
      bodyObserver?.disconnect();
      document.removeEventListener('click', activateSingleControl, true);
      map?.off?.('popupopen', closeLegacyLocationPopup);
    }, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
