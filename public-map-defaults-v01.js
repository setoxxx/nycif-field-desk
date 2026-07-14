(function () {
  const STORAGE_KEY = 'nycif-field-desk-state-v06-safe';
  const DEFAULT_VERSION = 'discovery-ui-cleanup-v04';
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

  function stripDateCounts() {
    const dateChips = document.getElementById('dateChips');
    if (!dateChips) return;
    dateChips.querySelectorAll('button').forEach(button => {
      const cleaned = String(button.textContent || '')
        .replace(/\s*\([\d,]+\)\s*$/u, '')
        .trim();
      if (cleaned && cleaned !== button.textContent) {
        button.textContent = cleaned;
      }
    });
  }

  function removeLibertyMarker() {
    document.querySelectorAll('.user-location').forEach(marker => {
      marker.textContent = '';
      marker.setAttribute('aria-hidden', 'true');
    });
  }

  function applyUiCleanup() {
    const layersPanel = document.getElementById('layersPanel');
    const modeToggle = document.querySelector('.mode-toggle');
    const sourceFilter = document.querySelector('.source-filter-label');
    if (layersPanel && modeToggle && modeToggle.parentElement !== layersPanel) {
      modeToggle.classList.add('mode-toggle--inside-filters');
      layersPanel.insertBefore(modeToggle, sourceFilter || layersPanel.firstChild);
    }

    const locateBtn = document.getElementById('locateBtn');
    if (locateBtn) {
      locateBtn.textContent = '⌖';
      locateBtn.setAttribute('aria-label', 'Show my GPS location');
      locateBtn.setAttribute('title', 'Show my GPS location');
    }

    const debugPanel = document.getElementById('debugPanel');
    if (debugPanel) {
      debugPanel.hidden = true;
      debugPanel.setAttribute('aria-hidden', 'true');
    }

    const indexStatus = document.getElementById('indexStatus');
    if (indexStatus) {
      indexStatus.hidden = true;
      indexStatus.setAttribute('aria-hidden', 'true');
    }

    stripDateCounts();
    removeLibertyMarker();

    if (!document.getElementById('nycif-ui-cleanup-style-v04')) {
      const style = document.createElement('style');
      style.id = 'nycif-ui-cleanup-style-v04';
      style.textContent = `
        body.public-map-page .debug-panel,
        body.public-map-page .index-status {
          display: none !important;
        }
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
        body.public-map-page .date-chips {
          width: min(700px, calc(100vw - 18px));
        }
        body.public-map-page .date-chip-track {
          gap: 3px;
        }
        body.public-map-page .date-chip,
        body.public-map-page #dateChips button {
          min-width: 0 !important;
          font-size: 9px !important;
          line-height: 1.1 !important;
          padding: 5px 6px !important;
          white-space: nowrap;
        }
        body.public-map-page .locate-btn {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 19px;
          line-height: 1;
        }
        body.public-map-page .user-location {
          position: relative;
          display: block;
          width: 17px;
          height: 17px;
          border: 3px solid #fff;
          border-radius: 50%;
          background: #1677ff;
          box-shadow: 0 0 0 3px rgba(22, 119, 255, .28), 0 2px 8px rgba(0, 0, 0, .28);
        }
        @media (max-width: 700px) {
          body.public-map-page .mode-toggle.mode-toggle--inside-filters {
            position: static;
            left: auto;
            bottom: auto;
          }
          body.public-map-page .date-chip,
          body.public-map-page #dateChips button {
            font-size: 8.5px !important;
            padding: 5px !important;
          }
        }
      `;
      document.head.appendChild(style);
    }

    const observer = new MutationObserver(() => {
      stripDateCounts();
      removeLibertyMarker();
      const liveDebugPanel = document.getElementById('debugPanel');
      if (liveDebugPanel && !liveDebugPanel.hidden) liveDebugPanel.hidden = true;
      const liveIndexStatus = document.getElementById('indexStatus');
      if (liveIndexStatus && !liveIndexStatus.hidden) liveIndexStatus.hidden = true;
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  try {
    const url = new URL(window.location.href);
    const versionFlag = url.searchParams.get('v');
    const forceReset = url.searchParams.get('resetFilters') === '1'
      || versionFlag === 'discovery-ui-cleanup-v04'
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
    document.addEventListener('DOMContentLoaded', applyUiCleanup, { once: true });
  } else {
    applyUiCleanup();
  }
})();
