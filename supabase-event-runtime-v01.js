(() => {
  'use strict';

  const VERSION = 'supabase-event-runtime-v01';
  const SUPABASE_ORIGIN = 'https://oggwpvdirkrnzoolparx.supabase.co';
  const RPC_URL = `${SUPABASE_ORIGIN}/rest/v1/rpc/nycif_events_reader_v1`;
  const PUBLISHABLE_KEY = 'sb_publishable_V5PfbUnBmRxlVVS6TtOHHQ_av0Fzo3Z';
  const LIVE_FEEDS_HOST = 'raw.githubusercontent.com';
  const LIVE_FEEDS_PREFIX = '/setoxxx/nycif-live-feeds/';
  const LOCAL_EVENT_PATHS = [
    /^\/data\/schema-v1(?:-discovery)?\/major\/events\.json$/,
    /^\/data\/events_discovery_v02_major\.json$/,
    /^\/data\/events_schema_v1_major\.json$/,
    /^\/nycif_major_radar_map_events\.json$/,
    /^\/data\/schema-v1(?:-discovery)?\/approved\/manifest\.json$/,
    /^\/data\/schema-v1(?:-discovery)?\/approved\/pages\//,
    /^\/data\/schema-v1(?:-discovery)?\/review\/manifest\.json$/,
    /^\/data\/schema-v1(?:-discovery)?\/review\/pages\//,
    /^\/data\/schema-v1(?:-discovery)?\/approximate\/approximate-stacks\.json$/,
    /^\/data\/photographer_assignment_calendar_2mo\.json$/,
    /^\/data\/photographer_viral_recurrence_matches\.json$/
  ];
  const originalFetch = window.fetch.bind(window);

  let authorityPromise = null;
  let lastMetadata = null;
  const intercepted = [];

  const jsonResponse = payload => new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });

  function pointCoordinates(feature) {
    if (feature?.geometry?.type !== 'Point' || !Array.isArray(feature.geometry.coordinates)) return null;
    const [lng, lat] = feature.geometry.coordinates.map(Number);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }

  function schemaRow(feature) {
    const p = feature?.properties || {};
    const point = pointCoordinates(feature);
    const sourceDataset = String(p.source_dataset || 'unknown');
    const sourceEventId = String(p.source_event_id || p.occurrence_id || p.id || 'unknown');
    const publicUrl = typeof p.public_url === 'string' && /^https?:\/\//i.test(p.public_url) ? p.public_url : null;
    const eventDate = String(p.event_date || '').slice(0, 10);
    const category = String(p.category || p.public_subtype || 'general');
    const eventRole = String(p.event_role || 'public_event');
    const isMajor = p.is_major === true;
    const photoPick = p.photo_pick === true;

    return {
      id: String(p.occurrence_id || p.id || `${sourceDataset}:${sourceEventId}:${eventDate}`),
      title: String(p.title || 'Untitled event'),
      category,
      start_date_time: p.start_date_time || null,
      end_date_time: p.end_date_time || null,
      timezone: String(p.timezone || 'America/New_York'),
      borough: p.borough || null,
      location: p.location || null,
      latitude: point ? point.lat : null,
      longitude: point ? point.lng : null,
      significance: p.significance || null,
      event_role: eventRole,
      parent_event_id: null,
      interests: [],
      tags: [],
      official_url: publicUrl,
      source: {
        dataset: sourceDataset,
        source_event_id: sourceEventId,
        url: publicUrl
      },
      nycif: {
        data_layer: 'approved_staged',
        production_feed: true,
        event_date: eventDate || null,
        event_type: p.public_subtype || category || null,
        event_role: eventRole,
        coordinate_status: point ? 'map_ready' : 'list_only',
        map_eligibility_state: p.map_eligibility_state || (point ? 'MAP_READY' : 'LIST_ONLY'),
        certified_pin: point ? p.certified_pin !== false : false,
        display_disposition: p.display_disposition || (point ? 'standalone_public_event' : 'list_only'),
        is_major: isMajor,
        photo_pick: photoPick
      }
    };
  }

  async function loadAuthority() {
    if (!authorityPromise) {
      authorityPromise = originalFetch(RPC_URL, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          apikey: PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: '{}'
      }).then(async response => {
        if (!response.ok) {
          const detail = await response.text().catch(() => '');
          throw new Error(`Supabase events reader HTTP ${response.status}${detail ? `: ${detail.slice(0, 180)}` : ''}`);
        }
        const payload = await response.json();
        if (payload?.type !== 'FeatureCollection' || !Array.isArray(payload.features)) {
          throw new Error('Supabase events reader returned an invalid FeatureCollection');
        }
        if (payload?.metadata?.authority !== 'supabase_event_authority' || payload?.metadata?.event_data_origin !== 'supabase_only') {
          throw new Error('Supabase events reader authority metadata failed closed');
        }
        lastMetadata = payload.metadata;
        const rows = payload.features.map(schemaRow);
        return {
          rows,
          majorRows: rows.filter(row => row.nycif?.is_major === true),
          generatedAtUtc: payload.metadata.generated_at_utc || new Date().toISOString(),
          windowStart: payload.metadata.reader_window_start || null,
          windowEnd: payload.metadata.reader_window_end || null
        };
      }).catch(error => {
        authorityPromise = null;
        throw error;
      });
    }
    return authorityPromise;
  }

  function requestUrl(input) {
    try {
      if (input instanceof Request) return new URL(input.url);
      return new URL(String(input), location.href);
    } catch {
      return null;
    }
  }

  function isLegacyRuntimeRequest(url) {
    if (!url) return false;
    const backendRepoRequest = url.hostname === LIVE_FEEDS_HOST && url.pathname.startsWith(LIVE_FEEDS_PREFIX);
    const localEventRequest = url.origin === location.origin && LOCAL_EVENT_PATHS.some(pattern => pattern.test(url.pathname));
    return backendRepoRequest || localEventRequest;
  }

  function recordIntercept(url) {
    intercepted.push(url.href);
    if (intercepted.length > 50) intercepted.shift();
  }

  async function virtualLegacyResponse(url) {
    recordIntercept(url);
    const path = url.pathname;

    if (path.includes('/data/') && path.endsWith('/major/events.json')) {
      const authority = await loadAuthority();
      return jsonResponse({
        generated_at_utc: authority.generatedAtUtc,
        total: authority.majorRows.length,
        events: authority.majorRows
      });
    }

    if (path.endsWith('/data/events_discovery_v02_major.json')
      || path.endsWith('/data/events_schema_v1_major.json')
      || path.endsWith('/nycif_major_radar_map_events.json')) {
      const authority = await loadAuthority();
      return jsonResponse({
        generated_at_utc: authority.generatedAtUtc,
        total: authority.majorRows.length,
        events: authority.majorRows
      });
    }

    if (path.endsWith('/approved/manifest.json')) {
      const authority = await loadAuthority();
      return jsonResponse({
        generated_at_utc: authority.generatedAtUtc,
        total: authority.rows.length,
        pages: [{
          cursor: 'supabase-today-plus-7',
          page: 'supabase-today-plus-7.json',
          earliest_date: authority.windowStart,
          latest_date: authority.windowEnd,
          count: authority.rows.length
        }]
      });
    }

    if (path.includes('/approved/pages/')) {
      const authority = await loadAuthority();
      return jsonResponse({
        generated_at_utc: authority.generatedAtUtc,
        total: authority.rows.length,
        events: authority.rows,
        next_cursor: null
      });
    }

    if (path.endsWith('/review/manifest.json')) {
      const authority = await loadAuthority();
      return jsonResponse({ generated_at_utc: authority.generatedAtUtc, total: 0, pages: [] });
    }

    if (path.includes('/review/pages/')) {
      const authority = await loadAuthority();
      return jsonResponse({ generated_at_utc: authority.generatedAtUtc, total: 0, events: [], next_cursor: null });
    }

    if (path.endsWith('/approximate/approximate-stacks.json')) {
      const authority = await loadAuthority();
      return jsonResponse({
        type: 'FeatureCollection',
        generated_at_utc: authority.generatedAtUtc,
        features: []
      });
    }

    if (path.endsWith('/data/photographer_assignment_calendar_2mo.json')
      || path.endsWith('/data/photographer_viral_recurrence_matches.json')) {
      return jsonResponse([]);
    }

    return jsonResponse({
      generated_at_utc: lastMetadata?.generated_at_utc || new Date().toISOString(),
      events: [],
      pages: [],
      features: []
    });
  }

  window.fetch = function nycifSupabaseEventsFetch(input, init) {
    const url = requestUrl(input);
    if (isLegacyRuntimeRequest(url)) {
      return virtualLegacyResponse(url);
    }
    return originalFetch(input, init);
  };

  window.NYCIF_SUPABASE_EVENTS_RUNTIME_V01 = {
    VERSION,
    authority: 'supabase_event_authority',
    eventDataOrigin: 'supabase_only',
    supabaseOrigin: SUPABASE_ORIGIN,
    rpcPath: '/rest/v1/rpc/nycif_events_reader_v1',
    getMetadata: () => lastMetadata ? { ...lastMetadata } : null,
    getInterceptedLegacyRequests: () => [...intercepted]
  };
})();
