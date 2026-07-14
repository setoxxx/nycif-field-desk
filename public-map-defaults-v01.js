(function () {
  const STORAGE_KEY = 'nycif-field-desk-state-v06-safe';
  // Must match the runtime version in discovery-patch-v02.js so the app and
  // this defaults helper never fight over stored preferences.
  const DEFAULT_VERSION = 'public-map-v05';
  const defaults = {
    borough: 'all',
    sort: 'priority',
    dateMode: 'today',
    categories: {
      sports: true,
      civic: true,
      market: true,
      arts: true,
      parks: true,
      fitness: true,
      family: true,
      education: true,
      volunteer: true,
      general: true,
      tours: true,
      government: true,
      services: true,
      jobs: true,
      housing: true,
      environment: true
    }
  };

  function applyDefaults(forceReset) {
    if (forceReset) localStorage.removeItem(STORAGE_KEY);
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (forceReset || existing?.nycifDefaultVersion !== DEFAULT_VERSION) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...defaults,
        nycifDefaultVersion: DEFAULT_VERSION
      }));
    }
  }

  function applyUiCleanup() {
    const debugPanel = document.getElementById('debugPanel');
    const debugRequested = (() => {
      try { return new URL(window.location.href).searchParams.get('debugMap') === '1'; }
      catch { return false; }
    })();
    if (debugPanel && !debugRequested) {
      debugPanel.hidden = true;
      debugPanel.setAttribute('aria-hidden', 'true');
    }

    if (!document.getElementById('nycif-ui-cleanup-style-v05')) {
      const style = document.createElement('style');
      style.id = 'nycif-ui-cleanup-style-v05';
      style.textContent = `
        body.public-map-page .date-chip,
        body.public-map-page #dateChips button {
          min-width: 0 !important;
          font-size: 11px !important;
          line-height: 1.15 !important;
          padding: 6px 9px !important;
          white-space: nowrap;
        }
        @media (max-width: 700px) {
          body.public-map-page .date-chip,
          body.public-map-page #dateChips button {
            font-size: 10px !important;
            padding: 6px 7px !important;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  try {
    const url = new URL(window.location.href);
    const forceReset = url.searchParams.get('resetFilters') === '1';
    applyDefaults(forceReset);
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...defaults,
      nycifDefaultVersion: DEFAULT_VERSION
    }));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyUiCleanup, { once: true });
  } else {
    applyUiCleanup();
  }
})();
