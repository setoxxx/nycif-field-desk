(function (root, factory) {
  'use strict';

  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.NYCIF_LIVE_LOCATION = api;
    const install = () => {
      if (!root.NYCIF_LIVE_LOCATION_CONTROLLER) {
        root.NYCIF_LIVE_LOCATION_CONTROLLER = api.install(root);
      }
    };
    if (root.document?.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', install, { once: true });
    } else if (root.document) {
      install();
    }
  }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const STYLE_ID = 'nycif-live-location-styles-v01';
  const STOP_BUTTON_ID = 'liveLocationStopBtn';
  const LIVE_STATE_ID = 'liveLocationState';
  const MAX_ACCEPTED_ACCURACY_METERS = 1000;
  const MIN_MOVEMENT_METERS = 0.75;
  const MIN_HEADING_MOVEMENT_METERS = 3;
  const MIN_UPDATE_INTERVAL_MS = 750;
  const HEADING_SPEED_FLOOR_MPS = 0.5;

  const WATCH_OPTIONS = Object.freeze({
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 3000
  });

  function finite(value) {
    return Number.isFinite(Number(value));
  }

  function toRadians(value) {
    return Number(value) * Math.PI / 180;
  }

  function toDegrees(value) {
    return Number(value) * 180 / Math.PI;
  }

  function distanceMeters(a, b) {
    if (!a || !b) return Infinity;
    const radius = 6371000;
    const lat1 = toRadians(a.lat);
    const lat2 = toRadians(b.lat);
    const dLat = lat2 - lat1;
    const dLng = toRadians(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * radius * Math.asin(Math.sqrt(h));
  }

  function bearingDegrees(a, b) {
    if (!a || !b) return null;
    const lat1 = toRadians(a.lat);
    const lat2 = toRadians(b.lat);
    const dLng = toRadians(b.lng - a.lng);
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2)
      - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    const bearing = (toDegrees(Math.atan2(y, x)) + 360) % 360;
    return finite(bearing) ? bearing : null;
  }

  function normalizePosition(position, previous) {
    const coords = position?.coords || {};
    const lat = Number(coords.latitude);
    const lng = Number(coords.longitude);
    const accuracy = Number(coords.accuracy);
    const timestamp = finite(position?.timestamp) ? Number(position.timestamp) : Date.now();

    if (!finite(lat) || !finite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return { accepted: false, reason: 'invalid_coordinates' };
    }
    if (!finite(accuracy) || accuracy < 0 || accuracy > MAX_ACCEPTED_ACCURACY_METERS) {
      return { accepted: false, reason: 'unusable_accuracy' };
    }

    const next = {
      lat,
      lng,
      accuracy,
      timestamp,
      speed: finite(coords.speed) ? Math.max(0, Number(coords.speed)) : null,
      heading: null,
      headingSource: 'none'
    };

    const moved = previous ? distanceMeters(previous, next) : Infinity;
    const elapsed = previous ? Math.max(0, timestamp - previous.timestamp) : Infinity;
    const accuracyChanged = previous ? Math.abs(previous.accuracy - accuracy) : Infinity;

    if (previous
      && elapsed < MIN_UPDATE_INTERVAL_MS
      && moved < MIN_MOVEMENT_METERS
      && accuracyChanged < 2) {
      return { accepted: false, reason: 'noise', moved, elapsed };
    }

    const reportedHeading = Number(coords.heading);
    if (finite(reportedHeading)
      && reportedHeading >= 0
      && reportedHeading <= 360
      && (next.speed == null || next.speed >= HEADING_SPEED_FLOOR_MPS)) {
      next.heading = reportedHeading % 360;
      next.headingSource = 'device';
    } else if (previous && moved >= MIN_HEADING_MOVEMENT_METERS) {
      next.heading = bearingDegrees(previous, next);
      next.headingSource = next.heading == null ? 'none' : 'movement';
    } else if (previous?.heading != null) {
      next.heading = previous.heading;
      next.headingSource = previous.headingSource || 'previous';
    }

    return { accepted: true, fix: next, moved, elapsed };
  }

  function createController(environment, options = {}) {
    const win = environment?.window || environment || {};
    const doc = options.document || win.document;
    const nav = options.navigator || win.navigator || {};
    const geolocation = options.geolocation || nav.geolocation;
    const map = options.map || win.NYCIF_MAIN_MAP;
    const L = options.L || win.L;
    const locateBtn = options.locateBtn || doc?.getElementById?.('locateBtn');
    const statusEl = options.statusEl || doc?.getElementById?.('status');
    const reducedMotion = options.reducedMotion != null
      ? Boolean(options.reducedMotion)
      : Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);

    if (!doc || !map || !L || !locateBtn) {
      return null;
    }

    let watchId = null;
    let tracking = false;
    let following = true;
    let lastFix = null;
    let marker = null;
    let accuracyCircle = null;
    let markerOwned = false;
    let accuracyOwned = false;
    let programmaticMove = false;
    let disposed = false;
    let stoppedForInactivity = false;
    let programmaticMoveTimer = null;

    const stopBtn = options.stopBtn || ensureStopButton(doc, locateBtn);
    const liveState = options.liveState || ensureLiveState(doc, locateBtn);
    injectStyles(doc);

    function announce(message, exposeInMainStatus = true) {
      if (liveState) liveState.textContent = message;
      if (exposeInMainStatus && statusEl) statusEl.textContent = message;
    }

    function setMarkerTrackingState(active) {
      const element = marker?.getElement?.();
      if (!element) return;
      element.dataset.liveTracking = active ? 'true' : 'false';
      element.classList?.add?.('nycif-live-location-marker');
    }

    function updateButtonState() {
      locateBtn.dataset.liveTracking = tracking ? 'true' : 'false';
      locateBtn.dataset.liveFollowing = following ? 'true' : 'false';
      locateBtn.setAttribute('aria-pressed', tracking ? 'true' : 'false');

      if (!tracking) {
        locateBtn.setAttribute('aria-label', 'Start live GPS tracking');
        locateBtn.setAttribute('title', 'Start live GPS tracking');
      } else if (following) {
        locateBtn.setAttribute('aria-label', 'Recenter live GPS tracking');
        locateBtn.setAttribute('title', 'Recenter live GPS tracking');
      } else {
        locateBtn.setAttribute('aria-label', 'Resume following my live location');
        locateBtn.setAttribute('title', 'Resume following my live location');
      }

      if (stopBtn) {
        stopBtn.hidden = !tracking;
        stopBtn.setAttribute('aria-hidden', tracking ? 'false' : 'true');
      }
      setMarkerTrackingState(tracking);
    }

    function isBaseLocationMarker(layer) {
      const className = String(layer?.options?.icon?.options?.className || '');
      if (className.includes('user-location-shell')) return true;
      const element = layer?.getElement?.();
      return Boolean(element?.classList?.contains?.('user-location-shell'));
    }

    function isBaseAccuracyCircle(layer) {
      if (!layer || typeof layer.getRadius !== 'function' || typeof layer.setRadius !== 'function') return false;
      const color = String(layer.options?.color || '').toLowerCase();
      return color === '#1677ff' && Number(layer.options?.fillOpacity) === 0.08;
    }

    function removeOwnedLayer(layer, owned) {
      if (!layer || !owned || typeof map.removeLayer !== 'function') return;
      try { map.removeLayer(layer); } catch (_) {}
    }

    function adoptLayer(layer) {
      if (!layer) return;
      if (isBaseLocationMarker(layer) && layer !== marker) {
        removeOwnedLayer(marker, markerOwned);
        marker = layer;
        markerOwned = false;
        if (lastFix) marker.setLatLng?.([lastFix.lat, lastFix.lng]);
        updateHeadingVisual();
        setMarkerTrackingState(tracking);
      } else if (isBaseAccuracyCircle(layer) && layer !== accuracyCircle) {
        removeOwnedLayer(accuracyCircle, accuracyOwned);
        accuracyCircle = layer;
        accuracyOwned = false;
        if (lastFix) {
          accuracyCircle.setLatLng?.([lastFix.lat, lastFix.lng]);
          accuracyCircle.setRadius?.(Math.max(5, lastFix.accuracy));
        }
      }
    }

    function scanExistingLayers() {
      if (typeof map.eachLayer !== 'function') return;
      map.eachLayer(adoptLayer);
    }

    function makeMarker(latlng) {
      const icon = L.divIcon({
        className: 'nycif-live-location-shell',
        html: '<span class="nycif-live-location-dot" aria-hidden="true"></span><span class="nycif-live-location-heading" aria-hidden="true"></span>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
      const created = L.marker(latlng, {
        icon,
        interactive: false,
        keyboard: false,
        zIndexOffset: 5000
      });
      created.addTo?.(map);
      return created;
    }

    function ensureLayers() {
      scanExistingLayers();
      const latlng = [lastFix.lat, lastFix.lng];
      if (!accuracyCircle) {
        accuracyCircle = L.circle(latlng, {
          radius: Math.max(5, lastFix.accuracy),
          color: '#1677ff',
          weight: 2,
          fillColor: '#1677ff',
          fillOpacity: 0.08,
          interactive: false
        });
        accuracyCircle.addTo?.(map);
        accuracyOwned = true;
      }
      if (!marker) {
        marker = makeMarker(latlng);
        markerOwned = true;
      }
    }

    function updateHeadingVisual() {
      const element = marker?.getElement?.();
      if (!element) return;
      element.classList?.add?.('nycif-live-location-marker');
      let heading = element.querySelector?.('.nycif-live-location-heading');
      if (!heading && doc.createElement) {
        heading = doc.createElement('span');
        heading.className = 'nycif-live-location-heading';
        heading.setAttribute?.('aria-hidden', 'true');
        element.appendChild?.(heading);
      }
      const hasHeading = lastFix?.heading != null;
      element.dataset.hasHeading = hasHeading ? 'true' : 'false';
      if (element.style?.setProperty) {
        element.style.setProperty('--nycif-live-heading', `${hasHeading ? lastFix.heading : 0}deg`);
      }
    }

    function updateLayers() {
      ensureLayers();
      const latlng = [lastFix.lat, lastFix.lng];
      marker?.setLatLng?.(latlng);
      accuracyCircle?.setLatLng?.(latlng);
      accuracyCircle?.setRadius?.(Math.max(5, lastFix.accuracy));
      updateHeadingVisual();
      setMarkerTrackingState(tracking);
    }

    function endProgrammaticMove() {
      programmaticMove = false;
      if (programmaticMoveTimer != null) {
        win.clearTimeout?.(programmaticMoveTimer);
        programmaticMoveTimer = null;
      }
    }

    function centerOnFix(firstFix = false) {
      if (!lastFix || !following) return;
      const latlng = [lastFix.lat, lastFix.lng];
      const currentZoom = Number(map.getZoom?.() || 0);
      const targetZoom = firstFix ? Math.max(currentZoom, 15) : currentZoom;
      programmaticMove = true;
      map.once?.('moveend', endProgrammaticMove);
      programmaticMoveTimer = win.setTimeout?.(endProgrammaticMove, 1200);
      if (firstFix && typeof map.setView === 'function') {
        map.setView(latlng, targetZoom, { animate: !reducedMotion });
      } else if (typeof map.panTo === 'function') {
        map.panTo(latlng, { animate: !reducedMotion, duration: reducedMotion ? 0 : 0.35 });
      }
    }

    function handlePosition(position) {
      if (!tracking || disposed) return false;
      const normalized = normalizePosition(position, lastFix);
      if (!normalized.accepted) return false;
      const firstFix = !lastFix;
      lastFix = normalized.fix;
      updateLayers();
      if (following) centerOnFix(firstFix);
      if (firstFix) {
        announce('Live GPS is on. Your blue dot will update as you move.');
      }
      return true;
    }

    function stop(config = {}) {
      const { silent = false, inactivity = false } = config;
      if (watchId != null && typeof geolocation?.clearWatch === 'function') {
        try { geolocation.clearWatch(watchId); } catch (_) {}
      }
      watchId = null;
      tracking = false;
      following = false;
      stoppedForInactivity = inactivity;
      updateButtonState();
      if (!silent) {
        announce('Live GPS tracking is off. The dot shows your last known location.');
      }
    }

    function handleError(error) {
      const code = Number(error?.code || 0);
      if (code === 1) {
        stop({ silent: true });
        announce('Location permission was denied. Enable location access in your browser settings to use live GPS.');
      } else if (code === 2) {
        announce('Your location is temporarily unavailable. Live GPS will keep trying.');
      } else if (code === 3) {
        announce('Live GPS is still waiting for a location fix.');
      } else {
        announce('Live GPS could not update your location.');
      }
    }

    function start() {
      if (disposed) return false;
      if (tracking) {
        resumeFollowing();
        return true;
      }
      if (!geolocation || typeof geolocation.watchPosition !== 'function') {
        announce('Live GPS is not available in this browser.');
        return false;
      }
      tracking = true;
      following = true;
      stoppedForInactivity = false;
      updateButtonState();
      announce('Requesting permission for live GPS tracking…');
      try {
        watchId = geolocation.watchPosition(handlePosition, handleError, WATCH_OPTIONS);
      } catch (error) {
        stop({ silent: true });
        announce('Live GPS could not start. Check browser location permissions.');
        return false;
      }
      return true;
    }

    function pauseFollowing() {
      if (!tracking || !following || programmaticMove) return false;
      following = false;
      updateButtonState();
      announce('Live GPS is on. Map following is paused. Tap the location button to recenter.');
      return true;
    }

    function resumeFollowing() {
      if (!tracking) return start();
      following = true;
      updateButtonState();
      centerOnFix(false);
      announce('Live GPS follow mode is on.');
      return true;
    }

    function onLocateCapture(event) {
      if (!tracking) return;
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      resumeFollowing();
    }

    function onLocateBubble() {
      if (!tracking) start();
    }

    function onStopClick(event) {
      event.preventDefault?.();
      event.stopPropagation?.();
      stop();
      locateBtn.focus?.();
    }

    function onManualNavigation() {
      pauseFollowing();
    }

    function onLayerAdd(event) {
      adoptLayer(event?.layer);
    }

    function onVisibilityChange() {
      if (doc.hidden && tracking) {
        stop({ silent: true, inactivity: true });
      } else if (!doc.hidden && stoppedForInactivity) {
        stoppedForInactivity = false;
        announce('Live GPS stopped while the page was inactive. Tap the location button to resume.');
      }
    }

    function destroy() {
      if (disposed) return;
      stop({ silent: true });
      disposed = true;
      locateBtn.removeEventListener?.('click', onLocateCapture, true);
      locateBtn.removeEventListener?.('click', onLocateBubble);
      stopBtn?.removeEventListener?.('click', onStopClick);
      map.off?.('dragstart', onManualNavigation);
      map.off?.('zoomstart', onManualNavigation);
      map.off?.('layeradd', onLayerAdd);
      doc.removeEventListener?.('visibilitychange', onVisibilityChange);
      win.removeEventListener?.('pagehide', destroy);
      win.removeEventListener?.('beforeunload', destroy);
    }

    locateBtn.addEventListener?.('click', onLocateCapture, true);
    locateBtn.addEventListener?.('click', onLocateBubble);
    stopBtn?.addEventListener?.('click', onStopClick);
    map.on?.('dragstart', onManualNavigation);
    map.on?.('zoomstart', onManualNavigation);
    map.on?.('layeradd', onLayerAdd);
    doc.addEventListener?.('visibilitychange', onVisibilityChange);
    win.addEventListener?.('pagehide', destroy);
    win.addEventListener?.('beforeunload', destroy);

    locateBtn.setAttribute('aria-pressed', 'false');
    updateButtonState();
    scanExistingLayers();

    return Object.freeze({
      start,
      stop,
      pauseFollowing,
      resumeFollowing,
      handlePosition,
      handleError,
      destroy,
      getState: () => ({
        tracking,
        following,
        watchId,
        lastFix: lastFix ? { ...lastFix } : null,
        markerLatLng: marker?.getLatLng?.() || null,
        accuracyRadius: accuracyCircle?.getRadius?.() ?? null,
        markerOwned,
        accuracyOwned,
        disposed
      })
    });
  }

  function ensureStopButton(doc, locateBtn) {
    let button = doc.getElementById?.(STOP_BUTTON_ID);
    if (button) return button;
    button = doc.createElement?.('button');
    if (!button) return null;
    button.id = STOP_BUTTON_ID;
    button.className = 'live-location-stop-btn';
    button.type = 'button';
    button.hidden = true;
    button.textContent = 'GPS On · Stop';
    button.setAttribute('aria-label', 'Stop live GPS tracking');
    button.setAttribute('aria-hidden', 'true');
    locateBtn.insertAdjacentElement?.('afterend', button);
    return button;
  }

  function ensureLiveState(doc, locateBtn) {
    let state = doc.getElementById?.(LIVE_STATE_ID);
    if (state) return state;
    state = doc.createElement?.('span');
    if (!state) return null;
    state.id = LIVE_STATE_ID;
    state.className = 'nycif-live-location-state';
    state.setAttribute('role', 'status');
    state.setAttribute('aria-live', 'polite');
    state.setAttribute('aria-atomic', 'true');
    locateBtn.parentNode?.appendChild?.(state);
    return state;
  }

  function injectStyles(doc) {
    if (!doc?.head || doc.getElementById?.(STYLE_ID)) return;
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .nycif-live-location-state {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip: rect(0, 0, 0, 0) !important;
        white-space: nowrap !important;
        border: 0 !important;
      }
      body.public-map-page .map-controls .live-location-stop-btn {
        position: static;
        min-height: 31px;
        border: 0;
        border-radius: 999px;
        padding: 0 10px;
        background: rgba(22, 119, 255, .96);
        color: #fff;
        font-size: 10px;
        font-weight: 900;
        line-height: 1;
        box-shadow: 0 8px 24px rgba(0, 0, 0, .24);
        cursor: pointer;
      }
      body.public-map-page .map-controls .live-location-stop-btn:focus-visible,
      body.public-map-page .map-controls .locate-btn:focus-visible {
        outline: 3px solid #fbbf24;
        outline-offset: 2px;
      }
      body.public-map-page .map-controls .locate-btn[data-live-tracking="true"] {
        background: #1677ff;
        color: #fff;
        box-shadow: 0 0 0 4px rgba(22, 119, 255, .22), 0 8px 24px rgba(0, 0, 0, .24);
      }
      body.public-map-page .map-controls .locate-btn[data-live-following="false"] {
        background: #fff;
        color: #1677ff;
        box-shadow: 0 0 0 3px rgba(22, 119, 255, .38), 0 8px 24px rgba(0, 0, 0, .24);
      }
      .nycif-live-location-shell,
      .user-location-shell.nycif-live-location-marker {
        position: relative;
        overflow: visible !important;
        background: transparent !important;
        border: 0 !important;
      }
      .nycif-live-location-dot,
      .user-location-shell.nycif-live-location-marker .user-location {
        display: block;
        width: 18px;
        height: 18px;
        margin: 6px;
        border: 3px solid #fff;
        border-radius: 999px;
        background: #1677ff;
        box-sizing: border-box;
        box-shadow: 0 2px 10px rgba(0, 0, 0, .45), 0 0 0 5px rgba(22, 119, 255, .18);
      }
      .nycif-live-location-heading {
        position: absolute;
        left: 50%;
        top: -9px;
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-bottom: 14px solid #1677ff;
        filter: drop-shadow(0 1px 1px rgba(0, 0, 0, .42));
        opacity: 0;
        transform: translateX(-50%) rotate(var(--nycif-live-heading, 0deg));
        transform-origin: 50% 24px;
        transition: transform .18s linear, opacity .18s linear;
        pointer-events: none;
      }
      .nycif-live-location-marker[data-has-heading="true"] .nycif-live-location-heading {
        opacity: 1;
      }
      .nycif-live-location-marker[data-live-tracking="false"] {
        opacity: .58;
      }
      @media (prefers-reduced-motion: reduce) {
        .nycif-live-location-heading { transition: none; }
      }
    `;
    doc.head.appendChild(style);
  }

  function install(win) {
    return createController(win);
  }

  return Object.freeze({
    WATCH_OPTIONS,
    distanceMeters,
    bearingDegrees,
    normalizePosition,
    createController,
    install
  });
});
