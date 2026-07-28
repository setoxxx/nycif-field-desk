(() => {
  'use strict';

  const controller = window.NYCIF_LIVE_LOCATION_CONTROLLER;
  const initialButton = document.getElementById('locateBtn');

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
  }

  function onLiveControlClick(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const state = controller.getState();
    if (state.tracking) {
      controller.resumeFollowing();
    } else {
      controller.start();
    }
  }

  function handOffControl() {
    if (handedOff || !controller.getState().tracking) {
      return;
    }

    const source = activeButton;
    const replacement = source.cloneNode(true);
    syncFromControllerButton(source, replacement);
    replacement.addEventListener('click', onLiveControlClick);

    const restoreFocus = document.activeElement === source;
    source.replaceWith(replacement);
    activeButton = replacement;
    handedOff = true;

    observer = new MutationObserver(() => syncFromControllerButton(source, replacement));
    observer.observe(source, {
      attributes: true,
      attributeFilter: mirroredAttributes
    });

    if (restoreFocus) {
      replacement.focus({ preventScroll: true });
    }
  }

  function afterInitialActivation() {
    window.setTimeout(handOffControl, 0);
  }

  initialButton.addEventListener('click', afterInitialActivation);

  window.addEventListener('pagehide', () => {
    observer?.disconnect();
  }, { once: true });
})();
