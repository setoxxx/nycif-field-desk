(() => {
  const VERSION = 'popup-autoclose-fix-v01';
  let lastPopup = null;
  let lock = false;

  function popupEls() {
    return Array.from(document.querySelectorAll('.leaflet-popup'));
  }

  function closePopup(el) {
    const close = el?.querySelector?.('.leaflet-popup-close-button');
    if (close) close.click();
    else el?.remove?.();
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

  document.addEventListener('click', event => {
    if (event.target?.closest?.('.leaflet-marker-icon, .marker-shell, .marker')) {
      setTimeout(keepOnlyNewest, 0);
      setTimeout(keepOnlyNewest, 80);
    }
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && lastPopup) {
      closePopup(lastPopup);
      lastPopup = null;
    }
  });

  const observer = new MutationObserver(keepOnlyNewest);
  observer.observe(document.body, { childList: true, subtree: true });
  window.NYCIF_POPUP_AUTOCLOSE_FIX = { version: VERSION, active: true };
})();
