(() => {
  const layersBtn = document.getElementById('layersBtn');
  const layersPanel = document.getElementById('layersPanel');
  const deskBtn = document.getElementById('deskBtn');
  const deskDrawer = document.getElementById('deskDrawer');
  const closeDeskBtn = document.getElementById('closeDeskBtn');

  if (!layersBtn && !deskBtn) {
    return;
  }

  function closeLayers() {
    if (!layersPanel || layersPanel.hidden) return;
    layersPanel.hidden = true;
    layersBtn?.setAttribute('aria-expanded', 'false');
  }

  function closeDesk() {
    if (!deskDrawer || deskDrawer.hidden) return;
    deskDrawer.hidden = true;
    deskBtn?.setAttribute('aria-expanded', 'false');
  }

  function isInside(target, element) {
    return Boolean(element && target instanceof Node && element.contains(target));
  }

  function handleOutsidePointer(event) {
    const target = event.target;

    if (
      layersPanel &&
      !layersPanel.hidden &&
      !isInside(target, layersPanel) &&
      !isInside(target, layersBtn)
    ) {
      closeLayers();
    }

    if (
      deskDrawer &&
      !deskDrawer.hidden &&
      !isInside(target, deskDrawer) &&
      !isInside(target, deskBtn)
    ) {
      closeDesk();
    }
  }

  document.addEventListener('pointerdown', handleOutsidePointer, true);

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    closeLayers();
    closeDesk();
  });

  closeDeskBtn?.addEventListener('click', closeDesk);
})();