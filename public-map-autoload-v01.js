(() => {
  const VERSION = 'public-map-autoload-v01';
  const params = new URLSearchParams(window.location.search);
  const publicMode = params.has('view') || document.body.classList.contains('public-map-page');
  if (!publicMode) return;

  function clickIfChecked(id) {
    const input = document.getElementById(id);
    if (input && input.checked) input.click();
  }

  function enableAllCategories() {
    document.querySelectorAll('[data-cat]').forEach(input => {
      if (!input.checked) input.click();
    });
  }

  function loadStagedFeedWhenReady(attempt = 0) {
    enableAllCategories();
    clickIfChecked('majorOnly');
    clickIfChecked('photoOnly');
    clickIfChecked('nypdOnly');

    const staged = document.getElementById('loadStagedBtn');
    if (staged && !staged.disabled) {
      staged.click();
      window.NYCIF_PUBLIC_MAP_AUTOLOAD = { version: VERSION, loaded: true, feed: 'staged', allCategories: true };
      return;
    }

    if (attempt < 60) {
      window.setTimeout(() => loadStagedFeedWhenReady(attempt + 1), 250);
    } else {
      window.NYCIF_PUBLIC_MAP_AUTOLOAD = { version: VERSION, loaded: false, reason: 'staged button not ready' };
    }
  }

  window.addEventListener('DOMContentLoaded', () => loadStagedFeedWhenReady());
  if (document.readyState !== 'loading') loadStagedFeedWhenReady();
})();
