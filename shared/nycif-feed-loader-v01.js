(() => {
  'use strict';

  const SAFE_REF = /^[A-Za-z0-9._/-]+$/;
  const CONCURRENCY = 4;
  const text = value => String(value ?? '').trim();
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const bool = value => value === true || value === 1 || /^(true|yes|1)$/i.test(text(value));
  const first = (row, keys) => {
    for (const key of keys) {
      if (row && row[key] !== undefined && row[key] !== null && text(row[key])) return row[key];
    }
    return '';
  };

  function activeRef() {
    const discovery = window.NYCIF_DISCOVERY_V02 || {};
    try {
      const requested = new URL(location.href).searchParams.get('feeds');
      if (requested && SAFE_REF.test(requested)) return requested;
    } catch {}
    return SAFE_REF.test(text(discovery.defaultFeedRef)) ? discovery.defaultFeedRef : 'main';
  }

  function configuration() {
    const discovery = window.NYCIF_DISCOVERY_V02 || {};
    const branch = activeRef();
    const feedRoot = text(discovery.feedRoot) || 'schema-v1';
    const host = `https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/${branch}`;
    return {
      branch,
      feedRoot,
      host,
      major: `${host}/data/${feedRoot}/major/events.json`,
      majorFallback: `${host}/data/events_discovery_v02_major.json`,
      majorLegacyFallback: `${host}/data/events_schema_v1_major.json`,
      majorEmergency: 'https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/nycif_major_radar_map_events.json',
      approvedManifest: `${host}/data/${feedRoot}/approved/manifest.json`,
      approvedPage: cursor => `${host}/data/${feedRoot}/approved/pages/${String(cursor).replace(/\.json$/i, '')}.json`
    };
  }

  function validDate(value) {
    const schema = window.NYCIF_EVENT_FEED_SCHEMA_V1;
    const candidate = text(value).slice(0, 10);
    return schema && schema.validCalendarDate ? schema.validCalendarDate(candidate) || '' : (/^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : '');
  }

  function eventDate(projected, raw) {
    return validDate(projected?.nycif?.event_date)
      || validDate(raw?.nycif?.event_date)
      || validDate(raw?.date)
      || validDate(projected?.date)
      || validDate(projected?.start_date_time)
      || validDate(raw?.start_date_time)
      || '';
  }

  function safeUrl(value) {
    const schema = window.NYCIF_EVENT_FEED_SCHEMA_V1;
    if (schema && schema.safeExternalUrl) return schema.safeExternalUrl(value);
    try {
      const url = new URL(text(value));
      return /^https?:$/.test(url.protocol) ? url.href : null;
    } catch { return null; }
  }

  function clock(value) {
    const raw = text(value);
    if (!raw) return '';
    const isoMatch = raw.match(/T(\d{2}):(\d{2})/);
    if (isoMatch) {
      const date = new Date(raw);
      if (!Number.isNaN(date.getTime())) {
        return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }).format(date);
      }
    }
    return raw;
  }

  function classify(event) {
    const haystack = [event.title, event.eventType, event.category, event.location, event.tags.join(' '), event.interests.join(' ')].join(' ').toLowerCase();
    if (/\b(virtual|online|webinar|zoom|remote|webcast|livestream|live stream)\b/.test(haystack) || event.coordinateStatus === 'virtual') return 'virtual';
    if (/\bparade\b/.test(haystack)) return 'parade';
    if (/\b(march|rally|protest|demonstration|vigil|picket)\b/.test(haystack)) return 'march';
    if (/\b(street fair|festival|block party|bazaar|market|pop[- ]?up|merchandise fair)\b/.test(haystack)) return 'street';
    if (/\b(sport|game|match|race|run|marathon|cycling|criterium|tournament|red carpet|premiere|concert|performance)\b/.test(haystack)) return 'sports';
    if (/\b(hearing|government|meeting|community board|ceremony|press conference|town hall|memorial|groundbreaking|ribbon cutting)\b/.test(haystack)) return 'civic';
    return 'other';
  }

  function normalize(raw, sourceFeed, sourceUrl, index) {
    const schema = window.NYCIF_EVENT_FEED_SCHEMA_V1;
    if (!schema || !schema.projectEvent) throw new Error('NYCIF event schema is unavailable');
    const layer = raw?.nycif?.data_layer || (sourceFeed === 'approved' ? 'approved_staged' : 'approved_staged');
    const projected = schema.projectEvent(raw, index, layer);
    const nycif = { ...(raw?.nycif || {}), ...(projected?.nycif || {}) };
    const source = { ...(raw?.source || {}), ...(projected?.source || {}) };
    const date = eventDate(projected, raw);
    const latitude = projected?.latitude == null || projected.latitude === '' ? null : Number(projected.latitude);
    const longitude = projected?.longitude == null || projected.longitude === '' ? null : Number(projected.longitude);
    const mapReady = nycif.coordinate_status === 'map_ready' && Number.isFinite(latitude) && Number.isFinite(longitude);
    const event = {
      id: text(projected?.id || raw?.id || `${source.dataset || 'unknown'}:${source.source_event_id || index}:${date}`),
      title: text(projected?.title || raw?.title) || 'Untitled event',
      date,
      startDateTime: text(projected?.start_date_time || raw?.start_date_time),
      endDateTime: text(projected?.end_date_time || raw?.end_date_time),
      start: clock(projected?.start_date_time || raw?.start_date_time || raw?.start_time),
      end: clock(projected?.end_date_time || raw?.end_date_time || raw?.end_time),
      borough: text(projected?.borough || raw?.borough),
      location: text(projected?.location || raw?.location || raw?.display_location),
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
      category: text(projected?.category || raw?.category) || 'general',
      eventType: text(nycif.event_type || raw?.event_type || raw?.type) || 'Event',
      eventRole: text(projected?.event_role || raw?.event_role) || 'public_event',
      interests: Array.isArray(raw?.interests) ? raw.interests.map(text).filter(Boolean) : [],
      tags: Array.isArray(raw?.tags) ? raw.tags.map(text).filter(Boolean) : [],
      sourceDataset: text(source.dataset || raw?.source_dataset),
      sourceEventId: text(source.source_event_id || raw?.source_event_id),
      sourceUrl: safeUrl(source.source_url || raw?.source_url || raw?.url),
      verification: text(nycif.verification_status || raw?.verification_status),
      dataLayer: text(nycif.data_layer || layer),
      coordinateStatus: text(nycif.coordinate_status) || (mapReady ? 'map_ready' : 'list_only'),
      mapReady,
      significance: text(projected?.significance || raw?.significance),
      major: sourceFeed !== 'approved' || projected?.significance === 'major' || bool(nycif.is_major),
      majorScore: num(nycif.major_score || raw?.major_score || raw?.priority_score),
      majorReason: text(nycif.major_reason || raw?.major_reason),
      photoPick: bool(nycif.photo_pick || raw?.photo_pick),
      priorityScore: num(nycif.priority_score || raw?.priority_score),
      expectedCrowdScore: num(nycif.expected_crowd_score || raw?.expected_crowd_score),
      crowdLevel: text(nycif.crowd_level || raw?.crowd_level),
      parentEventId: text(projected?.parent_event_id || raw?.parent_event_id),
      sourceFeed,
      sourceUrlResolved: sourceUrl
    };
    event.group = classify(event);
    if (event.group === 'virtual') {
      if (!event.borough) event.borough = 'Virtual';
      if (!event.location) event.location = 'Online';
    }
    return event;
  }

  function stableIdentity(event) {
    return event.id || [event.sourceDataset, event.sourceEventId, event.date].join('|') || [event.title, event.date, event.location].join('|').toLowerCase();
  }

  function mergeEvent(existing, incoming) {
    if (!existing) return incoming;
    const preferred = incoming.major && !existing.major ? incoming : existing;
    const other = preferred === incoming ? existing : incoming;
    return {
      ...other,
      ...preferred,
      sourceFeed: preferred.sourceFeed,
      major: existing.major || incoming.major,
      photoPick: existing.photoPick || incoming.photoPick,
      majorScore: Math.max(existing.majorScore, incoming.majorScore),
      priorityScore: Math.max(existing.priorityScore, incoming.priorityScore),
      expectedCrowdScore: Math.max(existing.expectedCrowdScore, incoming.expectedCrowdScore),
      sourceFeeds: [...new Set([...(existing.sourceFeeds || [existing.sourceFeed]), ...(incoming.sourceFeeds || [incoming.sourceFeed])])]
    };
  }

  async function fetchJson(url, signal) {
    const separator = url.includes('?') ? '&' : '?';
    const response = await fetch(`${url}${separator}cache=${Date.now()}`, { cache: 'no-store', signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function rows(payload) {
    return Array.isArray(payload) ? payload : (Array.isArray(payload?.events) ? payload.events : []);
  }

  function pageList(manifest) {
    return Array.isArray(manifest?.pages)
      ? manifest.pages.filter(page => text(page?.cursor || page?.page)).map(page => ({ ...page, cursor: text(page.cursor || page.page).replace(/\.json$/i, '') }))
      : [];
  }

  async function loadMajor(config, signal, diagnostics) {
    const chain = [
      ['major', config.major],
      ['fallback', config.majorFallback],
      ['fallback', config.majorLegacyFallback],
      ['emergency', config.majorEmergency]
    ];
    for (const [source, url] of chain) {
      try {
        const payload = await fetchJson(url, signal);
        diagnostics.majorFeedUrl = url;
        diagnostics.majorFallbackUsed = source === 'major' ? null : source;
        diagnostics.majorLoaded = true;
        return rows(payload).map((row, index) => normalize(row, source, url, index));
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        diagnostics.warnings.push(`${source} feed failed: ${error.message}`);
      }
    }
    return [];
  }

  async function loadMirror(options = {}) {
    const config = configuration();
    const signal = options.signal;
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
    const diagnostics = {
      branch: config.branch,
      feedRoot: config.feedRoot,
      majorFeedUrl: '',
      majorFallbackUsed: null,
      approvedManifestUrl: config.approvedManifest,
      approvedPageCount: 0,
      approvedPagesLoaded: 0,
      approvedPagesFailed: 0,
      majorEventCount: 0,
      approvedEventCount: 0,
      duplicates: [],
      invalidDates: [],
      normalizationErrors: [],
      warnings: [],
      pageCursors: [],
      lastSuccessfulRefresh: null,
      majorLoaded: false,
      manifestLoaded: false,
      fatal: false
    };
    const byId = new Map();
    const ingest = events => {
      for (const event of events) {
        if (!event.date) diagnostics.invalidDates.push(event.id);
        const key = stableIdentity(event);
        if (byId.has(key)) diagnostics.duplicates.push(key);
        byId.set(key, mergeEvent(byId.get(key), event));
      }
    };

    onProgress({ phase: 'major-loading', diagnostics, events: [] });
    const major = await loadMajor(config, signal, diagnostics);
    diagnostics.majorEventCount = major.length;
    ingest(major);
    onProgress({ phase: diagnostics.majorLoaded ? 'major-loaded' : 'major-failed', diagnostics, events: [...byId.values()] });

    let manifest = null;
    try {
      manifest = await fetchJson(config.approvedManifest, signal);
      diagnostics.manifestLoaded = true;
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      diagnostics.warnings.push(`approved manifest failed: ${error.message}`);
    }

    const pages = pageList(manifest);
    diagnostics.approvedPageCount = pages.length;
    diagnostics.pageCursors = pages.map(page => page.cursor);
    let cursorIndex = 0;
    async function worker() {
      while (cursorIndex < pages.length) {
        const page = pages[cursorIndex++];
        const url = config.approvedPage(page.cursor);
        try {
          const payload = await fetchJson(url, signal);
          const normalized = [];
          rows(payload).forEach((row, index) => {
            try { normalized.push(normalize(row, 'approved', url, index)); }
            catch (error) { diagnostics.normalizationErrors.push(`${page.cursor}:${index}:${error.message}`); }
          });
          diagnostics.approvedEventCount += normalized.length;
          diagnostics.approvedPagesLoaded += 1;
          ingest(normalized);
        } catch (error) {
          if (error.name === 'AbortError') throw error;
          diagnostics.approvedPagesFailed += 1;
          diagnostics.warnings.push(`approved page ${page.cursor} failed: ${error.message}`);
        }
        onProgress({ phase: 'approved-progress', diagnostics, events: [...byId.values()] });
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, Math.max(1, pages.length)) }, worker));

    const events = [...byId.values()];
    diagnostics.deduplicatedTotal = events.length;
    diagnostics.eventsWithValidDates = events.filter(event => event.date).length;
    diagnostics.eventsWithoutValidDates = events.length - diagnostics.eventsWithValidDates;
    diagnostics.mapReadyEvents = events.filter(event => event.mapReady).length;
    diagnostics.nonMapReadyEvents = events.length - diagnostics.mapReadyEvents;
    diagnostics.virtualEvents = events.filter(event => event.group === 'virtual').length;
    diagnostics.fatal = !diagnostics.majorLoaded && !diagnostics.manifestLoaded;
    diagnostics.partial = diagnostics.approvedPagesFailed > 0 || !diagnostics.majorLoaded || !diagnostics.manifestLoaded;
    diagnostics.lastSuccessfulRefresh = diagnostics.fatal ? null : new Date().toISOString();
    onProgress({ phase: diagnostics.fatal ? 'error' : (diagnostics.partial ? 'partial' : 'complete'), diagnostics, events });
    return { config, diagnostics, events };
  }

  window.NYCIF_FEED_LOADER_V01 = { configuration, normalize, stableIdentity, loadMirror, validDate };
})();
