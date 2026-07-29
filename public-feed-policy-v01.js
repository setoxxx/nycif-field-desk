(() => {
  'use strict';

  const params = (() => {
    try { return new URL(window.location.href).searchParams; }
    catch { return new URLSearchParams(); }
  })();
  const hostname = String(window.location.hostname || '').toLowerCase();
  const local = hostname === 'localhost' || hostname === '127.0.0.1';
  const operator = params.get('desk') === '1' || params.get('assignment') === '1';
  const protectedQa = params.get('protectedPerf') === '1'
    || params.get('eventStatusQa') === '1'
    || params.get('markerStatusQa') === '1'
    || /protected-fullscreen-map-qa|event-status-qa|status-markers/i.test(params.get('v') || '');
  const allowFeedOverride = local || operator || protectedQa;
  const allowReview = operator || protectedQa;

  if (!allowFeedOverride && params.has('feeds')) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('feeds');
      window.history.replaceState(window.history.state, '', url.toString());
    } catch {
      // The normal main feed remains the downstream fallback.
    }
  }

  const nativeFetch = window.fetch.bind(window);
  const reviewManifestPattern = /\/data\/schema-v1(?:-discovery)?\/review\/manifest\.json$/i;
  const reviewPagePattern = /\/data\/schema-v1(?:-discovery)?\/review\/pages\/[^/]+\.json$/i;

  function normalizedUrl(input) {
    try {
      const raw = typeof input === 'string' ? input : input?.url;
      const url = new URL(String(raw || ''), window.location.href);
      url.searchParams.delete('cache');
      return url;
    } catch {
      return null;
    }
  }

  function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  window.fetch = function nycifPublicFeedPolicyFetch(input, init) {
    const url = normalizedUrl(input);
    if (!allowReview && url && reviewManifestPattern.test(url.pathname)) {
      return Promise.resolve(jsonResponse({
        schema_version: '1.0',
        layer: 'review',
        generated_at_utc: new Date().toISOString(),
        total: 0,
        page_count: 0,
        page_size: 0,
        pages: []
      }));
    }
    if (!allowReview && url && reviewPagePattern.test(url.pathname)) {
      return Promise.resolve(jsonResponse({
        schema_version: '1.0',
        layer: 'review',
        generated_at_utc: new Date().toISOString(),
        total: 0,
        events: []
      }));
    }
    return nativeFetch(input, init);
  };

  window.NYCIF_PUBLIC_FEED_POLICY = Object.freeze({
    allowFeedOverride,
    allowReview,
    local,
    operator,
    protectedQa
  });
})();
