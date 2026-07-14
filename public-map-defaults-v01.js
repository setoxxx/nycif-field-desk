(function () {
  const STORAGE_KEY = 'nycif-field-desk-state-v06-safe';
  const DEFAULT_VERSION = 'discovery-live-repair-v03';
  const defaults = {
    borough: 'all',
    sort: 'priority',
    dateMode: 'next7',
    viewMode: 'major',
    sourceFilter: 'all',
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
    },
    majorOnly: false,
    photoOnly: false,
    nypdOnly: false,
    newOnly: false
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

  function applyLiveRepairLayout() {
    const layersPanel = document.getElementById('layersPanel');
    const modeToggle = document.querySelector('.mode-toggle');
    const sourceFilter = document.querySelector('.source-filter-label');
    if (layersPanel && modeToggle && modeToggle.parentElement !== layersPanel) {
      modeToggle.classList.add('mode-toggle--inside-filters');
      layersPanel.insertBefore(modeToggle, sourceFilter || layersPanel.firstChild);
    }

    const locateBtn = document.getElementById('locateBtn');
    if (locateBtn) {
      locateBtn.textContent = '📍';
      locateBtn.setAttribute('aria-label', 'Show my GPS location');
      locateBtn.setAttribute('title', 'Show my GPS location');
    }

    if (!document.getElementById('nycif-live-repair-style-v03')) {
      const style = document.createElement('style');
      style.id = 'nycif-live-repair-style-v03';
      style.textContent = `
        body.public-map-page .mode-toggle.mode-toggle--inside-filters {
          position: static;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 5px;
          max-width: none;
          width: 100%;
          margin: 0 0 7px;
          padding: 0;
        }
        body.public-map-page .mode-toggle--inside-filters .mode-btn {
          min-height: 30px;
          padding: 5px 7px;
          font-size: 10px;
          line-height: 1.15;
        }
        body.public-map-page .date-chip,
        body.public-map-page #dateChips button {
          font-size: 10px !important;
          padding-left: 8px !important;
          padding-right: 8px !important;
          white-space: nowrap;
        }
        body.public-map-page .locate-btn {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 17px;
        }
        @media (max-width: 700px) {
          body.public-map-page .mode-toggle.mode-toggle--inside-filters {
            position: static;
            left: auto;
            bottom: auto;
          }
          body.public-map-page .date-chip,
          body.public-map-page #dateChips button {
            font-size: 9.5px !important;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  try {
    const url = new URL(window.location.href);
    const versionFlag = url.searchParams.get('v');
    const forceReset = url.searchParams.get('resetFilters') === '1'
      || versionFlag === 'discovery-live-repair-v03'
      || versionFlag === 'discovery-taxonomy-v02'
      || versionFlag === 'schema-v1-major-all-v01'
      || versionFlag === 'map-restore-v02'
      || versionFlag === 'data-explorer-v01'
      || versionFlag === 'major-default-qa-01'
      || versionFlag === 'ui-defaults-02'
      || versionFlag === 'c5p-postpublish-02';
    applyDefaults(forceReset);
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...defaults,
      nycifDefaultVersion: DEFAULT_VERSION
    }));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyLiveRepairLayout, { once: true });
  } else {
    applyLiveRepairLayout();
  }
})();
