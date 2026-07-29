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

  const POPUP_VERSION = 'protected-popup-qa-v02';
  const SPONSOR_AFTER_EVERY = 3;

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

  function sponsoredCard(slotIndex) {
    const card = document.createElement('article');
    card.className = 'nycif-sponsored-card';
    card.dataset.slot = String(slotIndex);
    card.setAttribute('aria-label', 'Sponsored advertising placeholder');
    card.innerHTML = [
      '<span class="nycif-sponsored-label">Sponsored</span>',
      '<strong>Advertise with NYC In Focus</strong>',
      '<span>Reach people planning where to go next in New York City.</span>'
    ].join('');
    return card;
  }

  function syncSponsoredSlots(popupEl) {
    popupEl?.querySelectorAll?.('.nycif-sponsored-card').forEach(card => card.remove());
    if (!popupEl) {
      return;
    }

    const stackScroll = popupEl.querySelector('.popup-stack-scroll');
    if (stackScroll) {
      const items = [...stackScroll.querySelectorAll('.popup-stack-item')];
      if (!items.length) {
        return;
      }
      let slot = 1;
      items.forEach((item, index) => {
        const shouldInsert = items.length === 1
          ? index === 0
          : (index + 1) % SPONSOR_AFTER_EVERY === 0;
        if (shouldInsert) {
          item.after(sponsoredCard(slot));
          slot += 1;
        }
      });
      return;
    }

    const card = popupEl.querySelector('.popup-card:not(.popup-card--picker)');
    if (card) {
      card.appendChild(sponsoredCard(1));
    }
  }

  function centerPopup(popup, popupEl) {
    const map = mapInstance();
    if (!map || !popupEl || !window.L) {
      return;
    }

    popup.options.autoPan = false;
    popup.options.keepInView = false;

    const size = map.getSize?.();
    if (!size || !Number.isFinite(size.x) || !Number.isFinite(size.y)) {
      return;
    }

    const centerPoint = map.containerPointToLayerPoint(window.L.point(size.x / 2, size.y / 2));
    popupEl.style.left = `${Math.round(centerPoint.x)}px`;
    popupEl.style.top = `${Math.round(centerPoint.y)}px`;
    popupEl.style.right = 'auto';
    popupEl.style.bottom = 'auto';
    popupEl.style.transform = 'translate(-50%, -50%)';
    popupEl.dataset.nycifPopupCentered = 'true';
  }

  function syncPopup(popup) {
    const popupEl = popup?.getElement?.();
    if (!popupEl) {
      return;
    }

    document.body.classList.add('nycif-popup-qa-enabled', 'nycif-popup-qa-open');
    document.body.dataset.nycifPopupQaVersion = POPUP_VERSION;
    popupEl.classList.add('nycif-popup-qa-centered');
    popupEl.setAttribute('role', popupEl.getAttribute('role') || 'dialog');
    popupEl.setAttribute('aria-modal', 'false');

    const close = popupEl.querySelector('.leaflet-popup-close-button');
    if (close) {
      close.setAttribute('aria-label', 'Close event details');
      close.setAttribute('title', 'Close');
    }

    ensureReturnButton(popup, popupEl);
    syncSponsoredSlots(popupEl);
    centerPopup(popup, popupEl);

    const map = mapInstance();
    map?.getContainer?.()?.classList.add('nycif-popup-qa-map-visible');
    map?.invalidateSize?.({ animate: false });
  }

  function syncActivePopup() {
    const map = mapInstance();
    const popup = map?._popup;
    if (popup?.isOpen?.()) {
      syncPopup(popup);
    }
  }

  function install() {
    document.body.classList.add('nycif-popup-qa-enabled');
    document.body.dataset.nycifPopupQaVersion = POPUP_VERSION;
    const map = mapInstance();
    if (!map) {
      window.setTimeout(install, 60);
      return;
    }
    if (map.__nycifProtectedPopupQaInstalled === POPUP_VERSION) {
      return;
    }
    map.__nycifProtectedPopupQaInstalled = POPUP_VERSION;

    map.on('popupopen', event => {
      window.setTimeout(() => syncPopup(event.popup), 0);
      window.setTimeout(() => syncPopup(event.popup), 120);
      window.setTimeout(() => syncPopup(event.popup), 320);
      window.setTimeout(() => syncPopup(event.popup), 700);
    });

    map.on('popupclose', () => {
      document.body.classList.remove('nycif-popup-qa-open');
    });

    map.on('move zoom resize moveend zoomend', () => {
      window.requestAnimationFrame(syncActivePopup);
    });

    window.addEventListener('resize', () => {
      window.requestAnimationFrame(syncActivePopup);
    });

    syncActivePopup();
  }

  ready(install);
})();
