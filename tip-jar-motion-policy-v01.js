(() => {
  'use strict';

  if (window.NYCIF_TIP_JAR_MOTION_POLICY) return;

  const nativeSetTimeout = window.setTimeout.bind(window);
  let active = true;

  function guardedSetTimeout(callback, delay, ...args) {
    const milliseconds = Number(delay);
    const source = typeof callback === 'function'
      ? Function.prototype.toString.call(callback)
      : '';
    const unsolicitedTipMotion = active
      && milliseconds >= 5000
      && milliseconds <= 14000
      && source.includes('scheduleRandomShake')
      && source.includes('panel.hidden');

    if (unsolicitedTipMotion) return 0;
    return nativeSetTimeout(callback, delay, ...args);
  }

  window.setTimeout = guardedSetTimeout;
  window.NYCIF_TIP_JAR_MOTION_POLICY = Object.freeze({
    version: 'tip-jar-motion-policy-v01',
    restore() {
      active = false;
      if (window.setTimeout === guardedSetTimeout) {
        window.setTimeout = nativeSetTimeout;
      }
    }
  });
})();
