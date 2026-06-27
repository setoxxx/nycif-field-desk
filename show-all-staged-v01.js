(() => {
  const VERSION = 'show-all-staged-v01';

  function qs(selector) { return document.querySelector(selector); }
  function status(text) { const el = qs('#status'); if (el) el.textContent = text; }

  function clickIfNeeded(selector, shouldBeChecked = true) {
    const input = qs(selector);
    if (!input) return;
    if (!!input.checked !== shouldBeChecked) input.click();
  }

  function enableAllCategories() {
    document.querySelectorAll('[data-cat]').forEach(input => {
      if (!input.checked) input.click();
    });
  }

  function clearNarrowFilters() {
    ['#majorOnly', '#photoOnly', '#nypdOnly'].forEach(selector => clickIfNeeded(selector, false));
  }

  function clickAllDate() {
    qs('[data-date-mode="all"]')?.click();
  }

  function clickStaged() {
    const staged = qs('#loadStagedBtn');
    if (!staged) {
      status('Show all staged: staged button is not ready yet. Open Layers and try again.');
      return;
    }
    if (!/loaded/i.test(staged.textContent || '')) staged.click();
  }

  function showAllStaged() {
    status('Show all staged: enabling all categories, clearing narrow filters, switching to All dates...');
    enableAllCategories();
    clearNarrowFilters();
    clickAllDate();
    window.setTimeout(clickStaged, 120);
    window.setTimeout(() => status('Show all staged active. Staged feed should show all dates/categories with phone-safe marker cap.'), 1600);
  }

  function ensureButton() {
    if (qs('#showAllStagedBtn')) return;
    const anchor = qs('#loadStagedBtn') || qs('#loadAllBtn');
    if (!anchor) return;
    const button = document.createElement('button');
    button.id = 'showAllStagedBtn';
    button.className = 'load-all staged-feed-test';
    button.type = 'button';
    button.textContent = 'Show all staged';
    button.addEventListener('click', showAllStaged);
    anchor.insertAdjacentElement('afterend', button);
  }

  document.addEventListener('click', event => {
    if (event.target?.closest?.('#layersBtn')) window.setTimeout(ensureButton, 80);
  }, true);

  window.addEventListener('DOMContentLoaded', () => {
    window.setTimeout(ensureButton, 500);
    window.setTimeout(ensureButton, 1500);
  });

  if (document.readyState !== 'loading') {
    window.setTimeout(ensureButton, 500);
    window.setTimeout(ensureButton, 1500);
  }

  window.NYCIF_SHOW_ALL_STAGED = { version: VERSION, active: true };
})();
