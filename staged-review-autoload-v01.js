(() => {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('feed') === 'staged' || params.get('review') === 'staged' || params.get('staged') === '1' || params.has('staged');
  if (!requested) return;

  const MAX_TRIES = 80;
  let tries = 0;

  function setStatus(text) {
    const status = document.getElementById('status');
    if (status) status.textContent = text;
    const brandCount = document.getElementById('brandCount');
    if (brandCount) brandCount.textContent = text;
  }

  function addReviewBadge() {
    if (document.getElementById('stagedReviewBadge')) return;
    const shell = document.querySelector('.map-shell');
    if (!shell) return;
    const badge = document.createElement('div');
    badge.id = 'stagedReviewBadge';
    badge.setAttribute('role', 'status');
    badge.textContent = 'STAGED REVIEW MODE';
    badge.style.position = 'absolute';
    badge.style.left = '12px';
    badge.style.bottom = '72px';
    badge.style.zIndex = '1200';
    badge.style.padding = '8px 10px';
    badge.style.borderRadius = '999px';
    badge.style.border = '1px solid rgba(255,255,255,.25)';
    badge.style.background = 'rgba(5,7,11,.86)';
    badge.style.color = '#fff';
    badge.style.font = '700 12px/1 system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
    badge.style.letterSpacing = '.04em';
    badge.style.boxShadow = '0 10px 24px rgba(0,0,0,.25)';
    shell.appendChild(badge);
  }

  function openStagedFeed() {
    tries += 1;
    const button = document.getElementById('loadStagedBtn');
    if (button && !button.disabled) {
      addReviewBadge();
      setStatus('Loading staged review feed...');
      button.click();
      return;
    }
    if (tries < MAX_TRIES) {
      window.setTimeout(openStagedFeed, 250);
    } else {
      setStatus('Staged review requested, but the staged feed button was not ready. Open Filters and tap Load staged feed.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', openStagedFeed, { once: true });
  } else {
    openStagedFeed();
  }
})();
