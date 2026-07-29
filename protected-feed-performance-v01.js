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
  const manifestWarmups = new Map();
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

  const warmManifest = manifestUrl => {
    if (!manifestUrl || manifestWarmups.has(manifestUrl)) {
      return manifestWarmups.get(manifestUrl);
    }
    const warmup = (async () => {
      const response = await queuePrefetch(manifestUrl);
      if (response) {
        await prefetchManifestPages(manifestUrl, response);
      }
      return response;
    })().catch(() => null);
    manifestWarmups.set(manifestUrl, warmup);
    return warmup;
  };

  const warmSiblingManifests = url => {
    try {
      const parsed = new URL(url);
      const marker = '/major/';
      const at = parsed.pathname.indexOf(marker);
      if (at < 0) return;
      const root = parsed.pathname.slice(0, at);
      warmManifest(`${parsed.origin}${root}/approved/manifest.json`);
      warmManifest(`${parsed.origin}${root}/review/manifest.json`);
    } catch {
      // Startup warming is optional and fail-soft.
    }
  };

  window.fetch = async (input, init = {}) => {
    const url = normalizeFeedUrl(input);
    if (!url) {
      return originalFetch(input, init);
    }

    const pathname = new URL(url).pathname;
    if (/\/major\//i.test(pathname)) {
      warmSiblingManifests(url);
    }

    const prefetchedResponse = prefetched.get(url);
    if (prefetchedResponse) {
      const response = await prefetchedResponse;
      if (response) {
        if (/\/(approved|review)\/manifest\.json$/i.test(pathname)) {
          await (manifestWarmups.get(url) || prefetchManifestPages(url, response));
        }
        return response.clone();
      }
    }

    const response = await fetchFeed(url, init);
    if (/\/(approved|review)\/manifest\.json$/i.test(pathname)) {
      // Hold the manifest response until its page files are warm. The main
      // runtime then consumes those cached responses back-to-back, allowing
      // its 40 ms render scheduler to collapse page-level updates into one
      // consolidated marker/list redraw per layer.
      await prefetchManifestPages(url, response);
    }
    return response;
  };
})();
