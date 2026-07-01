(function () {
  const STORAGE_KEY = 'nycif-field-desk-state-v06-safe';
  const DEFAULT_VERSION = 'major-only-v02';
  const defaults = {
    borough: 'all',
    sort: 'priority',
    dateMode: 'today',
    categories: {
      sports: false,
      parade: false,
      market: false,
      arts: false,
      parks: false,
      general: false
    },
    majorOnly: true,
    photoOnly: false,
    nypdOnly: false,
    newOnly: false
  };

  function applyDefaults(forceReset) {
    if (forceReset) {
      localStorage.removeItem(STORAGE_KEY);
    }

    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (forceReset || !existing || existing.nycifDefaultVersion !== DEFAULT_VERSION) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...defaults,
        nycifDefaultVersion: DEFAULT_VERSION
      }));
    }
  }

  try {
    const url = new URL(window.location.href);
    const forceReset = url.searchParams.get('resetFilters') === '1'
      || url.searchParams.get('v') === 'ui-defaults-02';
    applyDefaults(forceReset);
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...defaults,
      nycifDefaultVersion: DEFAULT_VERSION
    }));
  }
})();
