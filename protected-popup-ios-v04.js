(() => {
  const enabled = (() => {
    try {
      const params = new URL(location.href).searchParams;
      return params.get('popupQa') === '1'
        || params.get('protectedPopupQa') === '1'
        || /protected-fullscreen-map-qa|popup-qa/i.test(String(params.get('v') || ''));
    } catch {
      return false;
    }
  })();
  if (!enabled) return;

  const map = () => window.NYCIF_MAIN_MAP || null;
  const gap = 10;
  const dateGap = 14;
  const mobileDownShift = 34;

  function cssNumber(name) {
    const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
    return Number.isFinite(value) ? value : 0;
  }

  function clamp(value, min, max) {
    return max < min ? min : Math.min(max, Math.max(min, value));
  }

  function ensureSponsor(popupEl) {
    popupEl.querySelectorAll('.nycif-sponsored-card').forEach(node => node.remove());
    const stack = popupEl.querySelector('.popup-stack-scroll');
    if (stack) {
      const items = [...stack.querySelectorAll(':scope > .popup-stack-item')];
      items.forEach((item, index) => {
        if ((items.length === 1 && index === 0) || (items.length > 1 && (index + 1) % 3 === 0)) {
          item.after(sponsorCard(index + 1));
        }
      });
      return;
    }
    const content = popupEl.querySelector('.leaflet-popup-content');
    const event = content?.querySelector(':scope > .popup-card:not(.popup-card--picker)');
    if (content && event) event.after(sponsorCard(1));
  }

  function sponsorCard(slot) {
    const card = document.createElement('article');
    card.className = 'nycif-sponsored-card';
    card.dataset.slot = String(slot);
    card.setAttribute('aria-label', 'Sponsored placement');
    card.innerHTML = '<span class="nycif-sponsored-label">Sponsored</span><strong>Advertise with NYC In Focus</strong><span>Local advertising placement</span>';
    return card;
  }

  function positionPopup(popup) {
    const instance = map();
    const popupEl = popup?.getElement?.();
    const container = instance?.getContainer?.();
    if (!instance || !popupEl || !container || !window.L) return;

    popup.options.autoPan = false;
    popup.options.keepInView = false;
    ensureSponsor(popupEl);

    const viewport = window.visualViewport;
    const width = viewport?.width || window.innerWidth;
    const height = viewport?.height || window.innerHeight;
    const offsetLeft = viewport?.offsetLeft || 0;
    const offsetTop = viewport?.offsetTop || 0;
    const left = offsetLeft + cssNumber('--nycif-safe-left') + gap;
    const right = offsetLeft + width - cssNumber('--nycif-safe-right') - gap;
    const top = offsetTop + cssNumber('--nycif-safe-top') + gap;
    const bottom = offsetTop + height - cssNumber('--nycif-safe-bottom') - gap;
    const dateRect = document.getElementById('dateChips')?.getBoundingClientRect?.();
    const clearTop = dateRect?.height ? Math.max(top, dateRect.bottom + dateGap) : top;

    popupEl.style.setProperty('--nycif-popup-max-height', `${Math.max(180, bottom - clearTop - 8)}px`);
    const popupRect = popupEl.getBoundingClientRect();
    const popupWidth = Math.min(popupRect.width || 360, right - left);
    const popupHeight = Math.min(popupRect.height || 420, bottom - clearTop);
    const desiredX = left + (right - left) / 2;
    const desiredY = top + (bottom - top) / 2 + mobileDownShift;
    const centerX = clamp(desiredX, left + popupWidth / 2, right - popupWidth / 2);
    const centerY = clamp(desiredY, clearTop + popupHeight / 2, bottom - popupHeight / 2);
    const containerRect = container.getBoundingClientRect();
    const layerPoint = instance.containerPointToLayerPoint(window.L.point(
      centerX - containerRect.left,
      centerY - containerRect.top
    ));

    popupEl.style.left = `${Math.round(layerPoint.x)}px`;
    popupEl.style.top = `${Math.round(layerPoint.y)}px`;
    popupEl.style.right = 'auto';
    popupEl.style.bottom = 'auto';
    popupEl.style.transform = 'translate(-50%, -50%)';
    popupEl.dataset.nycifViewportMode = viewport ? 'visual-viewport-v04' : 'layout-viewport-v04';
  }

  function sync() {
    const popup = map()?._popup;
    if (popup?.isOpen?.()) positionPopup(popup);
  }

  function schedule() {
    requestAnimationFrame(sync);
  }

  function install() {
    const instance = map();
    if (!instance) {
      setTimeout(install, 60);
      return;
    }
    if (instance.__nycifIosPopupV04) return;
    instance.__nycifIosPopupV04 = true;
    instance.on('popupopen', event => {
      [0, 100, 300, 700].forEach(delay => setTimeout(() => positionPopup(event.popup), delay));
    });
    instance.on('move zoom resize moveend zoomend', schedule);
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('orientationchange', schedule, { passive: true });
    window.visualViewport?.addEventListener('resize', schedule, { passive: true });
    window.visualViewport?.addEventListener('scroll', schedule, { passive: true });
    sync();
  }

  install();
})();
