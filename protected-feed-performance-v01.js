(() => {
  const params = new URL(window.location.href).searchParams;
  const protectedQa = /^protected-fullscreen-map-qa-/i.test(params.get('v') || '')
    || params.get('protectedPerf') === '1';

  if (!protectedQa) {
    return;
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    let url = typeof input === 'string' ? input : input?.url;
    if (!url || !/^https:\/\/raw\.githubusercontent\.com\/setoxxx\/nycif-live-feeds\//i.test(url)) {
      return originalFetch(input, init);
    }

    try {
      const parsed = new URL(url);
      parsed.searchParams.delete('cache');
      url = parsed.toString();
    } catch {
      return originalFetch(input, init);
    }

    const nextInit = { ...init };
    delete nextInit.cache;
    return originalFetch(url, nextInit);
  };

  const listingPattern = /^(\d[\d,]*) event(s)?( · | today| tomorrow| on )/i;
  const relabel = node => {
    if (!node || typeof node.textContent !== 'string') {
      return;
    }
    const text = node.textContent.trim();
    if (!listingPattern.test(text)) {
      return;
    }
    node.textContent = text.replace(listingPattern, (_, count, plural, suffix) => {
      const noun = Number(count.replace(/,/g, '')) === 1 ? 'event listing' : 'event listings';
      return `${count} ${noun}${suffix}`;
    });
  };

  const watchedIds = new Set(['brandCount', 'listMeta', 'status']);
  const observer = new MutationObserver(records => {
    records.forEach(record => {
      const target = record.target.nodeType === Node.TEXT_NODE ? record.target.parentElement : record.target;
      if (target?.id && watchedIds.has(target.id)) {
        relabel(target);
      }
    });
  });

  const start = () => {
    watchedIds.forEach(id => {
      const node = document.getElementById(id);
      if (!node) return;
      relabel(node);
      observer.observe(node, { childList: true, characterData: true, subtree: true });
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
