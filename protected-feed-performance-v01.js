(() => {
  const params = new URL(window.location.href).searchParams;
  const protectedQa = /^protected-fullscreen-map-qa-/i.test(params.get('v') || '')
    || params.get('protectedPerf') === '1';

  if (!protectedQa) {
    return;
  }

  const FEED_RE = /^https:\/\/raw\.githubusercontent\.com\/setoxxx\/nycif-live-feeds\//i;
  const PREFETCH_CONCURRENCY = 4;
  const prefetched = new Map();
  const originalFetch = window.fetch.bind(window);

  const normalizeFeedUrl = input => {
    const raw = typeof input === 'string' ? input : input?.url;
    if (!raw || !FEED_RE.test(raw)) {
      return '';
    }
    try {
      const parsed = new URL(raw);
      parsed.searchParams.delete('cache');
      return parsed.toString();
    } catch {
      return '';
    }
  };

  const fetchFeed = (url, init = {}) => {
    const nextInit = { ...init };
    delete nextInit.cache;
    return originalFetch(url, nextInit);
  };

  const queuePrefetch = url => {
    if (!url || prefetched.has(url)) {
      return prefetched.get(url);
    }
    const request = fetchFeed(url, { headers: { Accept: 'application/json' } })
      .then(response => response.ok ? response : Promise.reject(new Error(`Prefetch failed (${response.status})`)))
      .catch(() => null);
    prefetched.set(url, request);
    return request;
  };

  const prefetchManifestPages = async (manifestUrl, response) => {
    try {
      const manifest = await response.clone().json();
      const pages = Array.isArray(manifest?.pages) ? manifest.pages : [];
      if (!pages.length) return;

      const base = new URL(manifestUrl);
      const layer = /\/review\/manifest\.json$/i.test(base.pathname) ? 'review' : 'approved';
      const root = base.pathname.replace(new RegExp(`/${layer}/manifest\\.json$`, 'i'), '');
      const urls = pages.map(page => {
        const name = String(page.cursor || page.page || '').replace(/\.json$/i, '');
        return `${base.origin}${root}/${layer}/pages/${name}.json`;
      }).filter(Boolean);

      let cursor = 0;
      const workers = Array.from({ length: Math.min(PREFETCH_CONCURRENCY, urls.length) }, async () => {
        while (cursor < urls.length) {
          const url = urls[cursor++];
          await queuePrefetch(url);
        }
      });
      await Promise.all(workers);
    } catch {
      // Prefetch is strictly fail-soft; the authoritative loader still runs.
    }
  };

  window.fetch = async (input, init = {}) => {
    const url = normalizeFeedUrl(input);
    if (!url) {
      return originalFetch(input, init);
    }

    const prefetchedResponse = prefetched.get(url);
    if (prefetchedResponse) {
      const response = await prefetchedResponse;
      if (response) {
        return response.clone();
      }
    }

    const response = await fetchFeed(url, init);
    if (/\/(approved|review)\/manifest\.json$/i.test(new URL(url).pathname)) {
      prefetchManifestPages(url, response);
    }
    return response;
  };
})();
