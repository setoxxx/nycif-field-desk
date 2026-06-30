(() => {
  const VERSION = 'special-overlay-mode-v01';
  const NORMAL_SELECTORS = [
    'input[data-cat]',
    '#majorOnly',
    '#photoOnly',
    '#nypdOnly'
  ];
  const SPECIAL_IDS = ['nightlifeToggle', 'publicIntelToggle'];

  function status(text) {
    const el = document.getElementById('status');
    if (el) el.textContent = text;
  }

  function specialIsOn() {
    return SPECIAL_IDS.some(id => document.getElementById(id)?.checked);
  }

  function dispatchChange(input) {
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function clearNormalFilters() {
    const normalInputs = document.querySelectorAll(NORMAL_SELECTORS.join(','));
    normalInputs.forEach(input => {
      if (input.checked) {
        input.checked = false;
        dispatchChange(input);
      }
    });
  }

  function restoreDefaultEventFilters() {
    const categoryInputs = document.querySelectorAll('input[data-cat]');
    categoryInputs.forEach(input => {
      const cat = input.getAttribute('data-cat');
      const shouldCheck = ['sports', 'parade', 'market', 'arts'].includes(cat);
      if (input.checked !== shouldCheck) {
        input.checked = shouldCheck;
        dispatchChange(input);
      }
    });
  }

  function handleSpecialChange(event) {
    if (event.target.checked) {
      clearNormalFilters();
      document.body.classList.add('nycif-special-overlay-mode');
      status('Special overlay mode on. Normal event filters hidden so intel pins are easier to see.');
      return;
    }
    if (!specialIsOn()) {
      document.body.classList.remove('nycif-special-overlay-mode');
      restoreDefaultEventFilters();
      status('Special overlay mode off. Normal event filters restored.');
    }
  }

  function bind(attempt = 0) {
    const found = SPECIAL_IDS
      .map(id => document.getElementById(id))
      .filter(Boolean);

    found.forEach(input => {
      if (input.dataset.nycifSpecialBound === VERSION) return;
      input.dataset.nycifSpecialBound = VERSION;
      input.addEventListener('change', handleSpecialChange);
    });

    if (found.length < SPECIAL_IDS.length && attempt < 120) {
      window.setTimeout(() => bind(attempt + 1), 250);
    }
  }

  function boot() {
    bind();
    window.NYCIF_SPECIAL_OVERLAY_MODE = { version: VERSION, clearNormalFilters, restoreDefaultEventFilters };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
