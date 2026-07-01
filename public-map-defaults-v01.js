(function () {
  const STORAGE_KEY = 'nycif-field-desk-state-v06-safe';
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

  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('resetFilters') === '1') {
      localStorage.removeItem(STORAGE_KEY);
    }

    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (!existing || existing.nycifDefaultVersion !== 'major-only-v01') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...defaults,
        nycifDefaultVersion: 'major-only-v01'
      }));
    }
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...defaults,
      nycifDefaultVersion: 'major-only-v01'
    }));
  }
})();
