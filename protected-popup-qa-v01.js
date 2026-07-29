(() => {
  const enabled = (() => {
    try {
      const params = new URL(location.href).searchParams;
      const version = String(params.get('v') || '');
      return params.get('popupQa') === '1'
        || params.get('protectedPopupQa') === '1'
        || /protected-fullscreen-map-qa|popup-qa/i.test(version);
    } catch {
      return false;
    }
  })();

  if (!enabled) {
    return;
  }

  function ready(fn) {
    if (document.body) {
      fn();
      return;
    }
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  }

  function mapInstance() {
    return window.NYCIF_MAIN_MAP || null;
  }

  function returnFromPopup(popup, popupEl) {
    const stackedBack = popupEl?.querySelector?.('.nycif-popup-back');
    if (stackedBack) {
      stackedBack.click();
      window.setTimeout(() => syncPopup(popup), 0);
      window.setTimeout(() => syncPopup(popup), 180);
      return;
    }

    const map = mapInstance();
    if (map && typeof map.closePopup === 'function') {
      map.closePopup(popup);
      const container = map.getContainer?.();
      if (container) {
        container.setAttribute('tabindex', container.getAttribute('tabindex') || '0');
        container.focus?.({ preventScroll: true });
      }
    }
  }

  function ensureReturnButton(popup, popupEl) {
    if (!popupEl || popupEl.querySelector('.nycif-popup-return')) {
      return;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nycif-popup-return';
    button.setAttribute('aria-label', 'Return to map or previous event list');
    button.setAttribute('title', 'Return');
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10.8 5.2 12.2 6.6 8.8 10H20v2H8.8l3.4 3.4-1.4 1.4L5 11z"/></svg>';
    button.addEventListener('click', evt => {
      evt.preventDefault();
      evt.stopPropagation();
      returnFromPopup(popup, popupEl);
    });

    const close = popupEl.querySelector('.leaflet-popup-close-button');
    if (close && close.parentElement) {
      close.parentElement.insertBefore(button, close);
      return;
    }

    popupEl.querySelector('.leaflet-popup-content-wrapper')?.appendChild(button);
  }

  function syncPopup(popup) {
    const popupEl = popup?.getElement?.();
    if (!popupEl) {
      return;
    }

    document.body.classList.add('nycif-popup-qa-enabled', 'nycif-popup-qa-open');
    popupEl.classList.add('nycif-popup-qa-centered');
    popupEl.setAttribute('role', popupEl.getAttribute('role') || 'dialog');
    popupEl.setAttribute('aria-modal', 'false');

    const close = popupEl.querySelector('.leaflet-popup-close-button');
    if (close) {
      close.setAttribute('aria-label', 'Close event details');
      close.setAttribute('title', 'Close');
    }

    ensureReturnButton(popup, popupEl);

    const map = mapInstance();
    map?.getContainer?.()?.classList.add('nycif-popup-qa-map-visible');
    map?.invalidateSize?.({ animate: false });
  }

  function install() {
    document.body.classList.add('nycif-popup-qa-enabled');
    const map = mapInstance();
    if (!map) {
      window.setTimeout(install, 60);
      return;
    }
    if (map.__nycifProtectedPopupQaInstalled) {
      return;
    }
    map.__nycifProtectedPopupQaInstalled = true;

    map.on('popupopen', event => {
      window.setTimeout(() => syncPopup(event.popup), 0);
      window.setTimeout(() => syncPopup(event.popup), 220);
      window.setTimeout(() => syncPopup(event.popup), 620);
    });

    map.on('popupclose', () => {
      document.body.classList.remove('nycif-popup-qa-open');
    });

    const openPopup = map._popup;
    if (openPopup) {
      syncPopup(openPopup);
    }
  }

  ready(install);
})();
