(() => {
  'use strict';

  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = {
    lastInvoker: null,
    lastInvokerWasInDesk: false,
    openPopup: null,
    announceTimer: null,
    reducedMotionRetryTimer: null,
    retryingEventId: null
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function focusSafely(node) {
    if (!node || typeof node.focus !== 'function' || !node.isConnected) return;
    window.requestAnimationFrame(() => node.focus({ preventScroll: true }));
  }

  function logicalPopupRestoreTarget() {
    const desk = byId('deskDrawer');
    if (state.lastInvokerWasInDesk && desk?.hidden) return byId('deskBtn');
    return state.lastInvoker;
  }

  function setPressedState(container, activeClass, currentValue) {
    if (!container) return;
    container.querySelectorAll('button').forEach(button => {
      const active = button.classList.contains(activeClass);
      button.setAttribute('aria-pressed', String(active));
      if (currentValue && active) button.setAttribute('aria-current', currentValue);
      else button.removeAttribute('aria-current');
    });
  }

  function normalizeSelectionStates() {
    setPressedState(byId('dateChips'), 'active', 'date');
    setPressedState(byId('boroughs'), 'active');
  }

  function normalizeMarker(marker) {
    if (!(marker instanceof HTMLElement)) return;
    if (!marker.matches('.leaflet-marker-icon, .marker-cluster')) return;

    marker.setAttribute('role', 'button');
    marker.setAttribute('aria-haspopup', 'dialog');
    if (!marker.hasAttribute('tabindex')) marker.tabIndex = 0;

    const title = marker.getAttribute('title') || marker.textContent.trim();
    if (title && !marker.getAttribute('aria-label')) marker.setAttribute('aria-label', title);

    if (!marker.dataset.a11ySpaceKey) {
      marker.dataset.a11ySpaceKey = 'true';
      marker.addEventListener('keydown', event => {
        if (event.key === ' ') {
          event.preventDefault();
          marker.click();
        }
      });
    }
  }

  function normalizeEventCard(button) {
    if (!(button instanceof HTMLButtonElement) || !button.classList.contains('event-item')) return;
    if (button.dataset.a11yNormalized === 'true') return;
    button.dataset.a11yNormalized = 'true';

    const title = button.querySelector('strong')?.textContent?.trim() || 'event';
    button.setAttribute('aria-label', `Open details for ${title}`);

    const links = [...button.querySelectorAll('a')];
    if (!links.length) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'event-item-wrap';
    button.before(wrapper);
    wrapper.appendChild(button);

    links.forEach(link => {
      link.classList.add('event-item-directions');
      link.setAttribute('aria-label', `Get directions for ${title}`);
      wrapper.appendChild(link);
    });
  }

  function normalizePopup(popup) {
    if (!(popup instanceof HTMLElement) || popup.dataset.a11yNormalized === 'true') return;
    popup.dataset.a11yNormalized = 'true';

    const content = popup.querySelector('.leaflet-popup-content');
    const heading = popup.querySelector('h1, h2, h3');
    const close = popup.querySelector('.leaflet-popup-close-button');
    if (!content) return;

    clearTimeout(state.reducedMotionRetryTimer);
    state.reducedMotionRetryTimer = null;
    state.retryingEventId = null;

    content.setAttribute('role', 'dialog');
    content.setAttribute('aria-modal', 'false');
    content.tabIndex = -1;

    if (heading) {
      if (!heading.id) heading.id = `nycif-popup-title-${Math.random().toString(36).slice(2, 9)}`;
      content.setAttribute('aria-labelledby', heading.id);
    } else {
      content.setAttribute('aria-label', 'Event details');
    }

    if (close) close.setAttribute('aria-label', 'Close event details');
    state.openPopup = popup;
    focusSafely(content);
  }

  function restorePopupFocus() {
    if (state.openPopup && !state.openPopup.isConnected) {
      state.openPopup = null;
      focusSafely(logicalPopupRestoreTarget());
    }
  }

  function announceResultChanges() {
    const meta = byId('listMeta');
    if (!meta) return;
    clearTimeout(state.announceTimer);
    state.announceTimer = window.setTimeout(() => {
      const text = meta.textContent.trim();
      if (text) meta.setAttribute('aria-label', `Event results: ${text}`);
    }, 250);
  }

  function normalizeNode(node) {
    if (!(node instanceof HTMLElement)) return;
    if (node.matches('.leaflet-marker-icon, .marker-cluster')) normalizeMarker(node);
    if (node.matches('button.event-item')) normalizeEventCard(node);
    if (node.matches('.leaflet-popup')) normalizePopup(node);

    node.querySelectorAll?.('.leaflet-marker-icon, .marker-cluster').forEach(normalizeMarker);
    node.querySelectorAll?.('button.event-item').forEach(normalizeEventCard);
    node.querySelectorAll?.('.leaflet-popup').forEach(normalizePopup);
  }

  function installReducedMotion() {
    if (!reduceMotion) return;
    document.documentElement.classList.add('reduce-motion');

    const map = window.NYCIF_MAIN_MAP;
    if (!map) return;
    map.options.zoomAnimation = false;
    map.options.fadeAnimation = false;
    map.options.markerZoomAnimation = false;

    const originalPanTo = map.panTo.bind(map);
    map.panTo = (latlng, options = {}) => originalPanTo(latlng, { ...options, animate: false });
    const originalFlyTo = map.flyTo.bind(map);
    map.flyTo = (latlng, zoom, options = {}) => {
      const target = window.L?.latLng ? L.latLng(latlng) : null;
      const sameCenter = target && map.getCenter().distanceTo(target) < 1;
      const sameZoom = zoom == null || Math.abs(map.getZoom() - zoom) < 0.01;
      if (sameCenter && sameZoom) return map;
      return originalFlyTo(latlng, zoom, { ...options, animate: false });
    };
  }

  function installReducedMotionListActivationFallback() {
    if (!reduceMotion) return;

    document.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof Element) || target.closest('a')) return;
      const button = target.closest('button.event-item');
      if (!(button instanceof HTMLButtonElement)) return;

      const eventId = button.dataset.id || '';
      if (!eventId || state.retryingEventId === eventId) return;

      clearTimeout(state.reducedMotionRetryTimer);
      state.reducedMotionRetryTimer = window.setTimeout(() => {
        state.reducedMotionRetryTimer = null;
        if (document.querySelector('.leaflet-popup')) return;
        const desk = byId('deskDrawer');
        if (!desk?.hidden) return;

        const escapedId = window.CSS?.escape ? CSS.escape(eventId) : eventId.replace(/["\\]/g, '\\$&');
        const currentButton = document.querySelector(`button.event-item[data-id="${escapedId}"]`);
        if (!(currentButton instanceof HTMLButtonElement)) return;

        state.retryingEventId = eventId;
        currentButton.click();
        window.setTimeout(() => {
          if (state.retryingEventId === eventId) state.retryingEventId = null;
        }, 1500);
      }, 750);
    }, true);
  }

  function installPanelFocusManagement() {
    const deskButton = byId('deskBtn');
    const desk = byId('deskDrawer');
    const closeDesk = byId('closeDeskBtn');
    const search = byId('searchInput');
    const layersButton = byId('layersBtn');
    const layers = byId('layersPanel');

    deskButton?.addEventListener('click', () => {
      window.setTimeout(() => {
        if (desk && !desk.hidden) focusSafely(search || desk);
      }, 0);
    });
    closeDesk?.addEventListener('click', () => focusSafely(deskButton));

    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      if (state.openPopup) {
        window.NYCIF_MAIN_MAP?.closePopup();
        return;
      }
      if (desk && !desk.hidden) {
        closeDesk?.click();
        return;
      }
      if (layers && !layers.hidden) {
        layersButton?.click();
        focusSafely(layersButton);
      }
    });
  }

  function installObservers() {
    const observer = new MutationObserver(records => {
      let shouldSyncSelections = false;
      let shouldAnnounceResults = false;

      records.forEach(record => {
        record.addedNodes.forEach(normalizeNode);
        if (record.target === byId('dateChips') || record.target === byId('boroughs')) shouldSyncSelections = true;
        if (record.target === byId('listMeta') || record.target.closest?.('#listMeta')) shouldAnnounceResults = true;
      });

      if (shouldSyncSelections) normalizeSelectionStates();
      if (shouldAnnounceResults) announceResultChanges();
      restorePopupFocus();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden']
    });
  }

  document.addEventListener('focusin', event => {
    const target = event.target;
    if (target instanceof HTMLElement && target.matches('.leaflet-marker-icon, .marker-cluster, button.event-item')) {
      state.lastInvoker = target;
      state.lastInvokerWasInDesk = Boolean(target.closest('#deskDrawer'));
    }
  });

  normalizeNode(document.body);
  normalizeSelectionStates();
  announceResultChanges();
  installReducedMotion();
  installReducedMotionListActivationFallback();
  installPanelFocusManagement();
  installObservers();
})();
