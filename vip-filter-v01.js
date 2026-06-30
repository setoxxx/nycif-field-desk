(() => {
  const STORAGE_KEY = 'nycif-vip-filter-v01';
  let active = false;
  let savedState = null;

  function qs(selector) {
    return document.querySelector(selector);
  }

  function qsa(selector) {
    return [...document.querySelectorAll(selector)];
  }

  function checked(id) {
    const el = document.getElementById(id);
    return !!el?.checked;
  }

  function setChecked(id, value) {
    const el = document.getElementById(id);
    if (!el || el.checked === value) return;
    el.click();
  }

  function setCategory(key, value) {
    const el = qs(`[data-cat="${key}"]`);
    if (!el || el.checked === value) return;
    el.click();
  }

  function currentState() {
    return {
      majorOnly: checked('majorOnly'),
      photoOnly: checked('photoOnly'),
      nypdOnly: checked('nypdOnly'),
      categories: Object.fromEntries(qsa('[data-cat]').map(input => [input.dataset.cat, input.checked]))
    };
  }

  function restoreState(state) {
    if (!state) return;
    setChecked('majorOnly', !!state.majorOnly);
    setChecked('photoOnly', !!state.photoOnly);
    setChecked('nypdOnly', !!state.nypdOnly);
    Object.entries(state.categories || {}).forEach(([key, value]) => setCategory(key, !!value));
  }

  function saveActive() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ active }));
  }

  function setStatus(text) {
    const status = document.getElementById('status');
    if (status) status.textContent = text;
  }

  function applyVip() {
    if (!active) savedState = currentState();
    active = true;

    setChecked('majorOnly', false);
    setChecked('photoOnly', true);
    setChecked('nypdOnly', false);

    setCategory('parade', true);
    setCategory('market', true);
    setCategory('arts', true);
    setCategory('sports', true);
    setCategory('parks', false);
    setCategory('general', false);

    updateButton();
    saveActive();
    setStatus('VIP assignments on: newsworthy parades, popups, arts, sports and photo-friendly events.');
  }

  function clearVip() {
    active = false;
    restoreState(savedState);
    savedState = null;
    updateButton();
    saveActive();
    setStatus('VIP assignments off. Restored previous filters.');
  }

  function toggleVip() {
    if (active) clearVip();
    else applyVip();
  }

  function injectStyles() {
    if (document.getElementById('nycif-vip-filter-styles')) return;
    const style = document.createElement('style');
    style.id = 'nycif-vip-filter-styles';
    style.textContent = `
      .vip-filter-button {
        border: 1px solid rgba(212, 0, 0, .24);
        border-radius: 999px;
        background: linear-gradient(180deg, #fff, #fff4f4);
        color: #9b0000;
        font-weight: 900;
        letter-spacing: .01em;
        box-shadow: 0 4px 12px rgba(212, 0, 0, .12);
      }
      .vip-filter-button.is-active {
        background: #d40000;
        color: #fff;
        border-color: #d40000;
        box-shadow: 0 6px 18px rgba(212, 0, 0, .28);
      }
      .vip-filter-button .vip-dot {
        display: inline-block;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: currentColor;
        margin-right: 5px;
      }
    `;
    document.head.appendChild(style);
  }

  function updateButton() {
    const button = document.getElementById('vipFilterBtn');
    if (!button) return;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }

  function ensureVipButton(attempt = 0) {
    injectStyles();
    const boroughs = document.getElementById('boroughs');
    if (!boroughs) {
      if (attempt < 40) window.setTimeout(() => ensureVipButton(attempt + 1), 250);
      return;
    }
    if (document.getElementById('vipFilterBtn')) {
      updateButton();
      return;
    }

    const button = document.createElement('button');
    button.id = 'vipFilterBtn';
    button.type = 'button';
    button.className = 'vip-filter-button';
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = '<span class="vip-dot" aria-hidden="true"></span>VIP';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      toggleVip();
    });
    boroughs.insertAdjacentElement('afterbegin', button);
    updateButton();
  }

  function boot() {
    try {
      active = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').active === true;
    } catch {}
    ensureVipButton();
    document.addEventListener('click', () => window.setTimeout(ensureVipButton, 100), true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
