(() => {
  'use strict';

  function install() {
    const controller = window.NYCIF_LIVE_LOCATION_CONTROLLER;
    const initialButton = document.getElementById('locateBtn');
    const map = window.NYCIF_MAIN_MAP;

    if (!controller || !initialButton || typeof initialButton.cloneNode !== 'function') {
      return;
    }

    let activeButton = initialButton;
    let handedOff = false;
    let observer = null;

    const mirroredAttributes = [
      'aria-label',
      'aria-pressed',
      'title',
      'data-live-tracking',
      'data-live-following'
    ];

    function syncFromControllerButton(source, target) {
      mirroredAttributes.forEach(name => {
        const value = source.getAttribute(name);
        if (value == null) {
          target.removeAttribute(name);
        } else {
          target.setAttribute(name, value);
        }
      });
      target.className = source.className;
      target.disabled = source.disabled;
      target.setAttribute('data-live-handoff', 'true');
    }

    function labelLiveLocationMarker() {
      document.querySelectorAll('.user-location-shell, .nycif-live-location-shell').forEach(marker => {
        if (marker.getAttribute('role') === 'button' || marker.hasAttribute('tabindex')) {
          marker.setAttribute('aria-label', 'Your live location');
          marker.setAttribute('title', 'Your live location');
        }
      });
    }

    function stopLegacyMapMotion() {
      try { map?.stop?.(); } catch (_) {}
      try { map?.closePopup?.(); } catch (_) {}
    }

    function activateLiveControl(event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      stopLegacyMapMotion();
      const state = controller.getState();
      if (state.tracking) {
        controller.resumeFollowing();
      } else {
        controller.start();
      }
      window.setTimeout(labelLiveLocationMarker, 0);
    }

    function onDelegatedLiveClick(event) {
      const target = event.target?.closest?.('#locateBtn[data-live-handoff="true"]');
      if (!target) {
        return;
      }
      activateLiveControl(event);
    }

    function onLiveControlKeydown(event) {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      activateLiveControl(event);
    }

    function onMapLayerAdd() {
      window.setTimeout(labelLiveLocationMarker, 0);
    }

    function handOffControl() {
      if (handedOff || !controller.getState().tracking) {
        return;
      }

      const source = activeButton;
      const replacement = source.cloneNode(true);
      syncFromControllerButton(source, replacement);
      replacement.addEventListener('keydown', onLiveControlKeydown);

      const restoreFocus = document.activeElement === source;
      source.replaceWith(replacement);
      activeButton = replacement;
      handedOff = true;

      observer = new MutationObserver(() => syncFromControllerButton(source, replacement));
      observer.observe(source, {
        attributes: true,
        attributeFilter: mirroredAttributes
      });

      window.NYCIF_LIVE_LOCATION_HANDOFF = Object.freeze({
        isActive: () => handedOff,
        getButton: () => activeButton
      });

      labelLiveLocationMarker();

      if (restoreFocus) {
        replacement.focus({ preventScroll: true });
      }
    }

    function afterInitialActivation() {
      window.setTimeout(handOffControl, 0);
      window.setTimeout(labelLiveLocationMarker, 0);
    }

    initialButton.addEventListener('click', afterInitialActivation);
    document.addEventListener('click', onDelegatedLiveClick, true);
    map?.on?.('layeradd', onMapLayerAdd);

    window.addEventListener('pagehide', () => {
      observer?.disconnect();
      document.removeEventListener('click', onDelegatedLiveClick, true);
      map?.off?.('layeradd', onMapLayerAdd);
    }, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
