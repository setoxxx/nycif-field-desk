(() => {
  const TARGETS = [
    'nycif_major_radar_map_events.json',
    'nycif_all_radar_map_events.json'
  ];
  const originalFetch = window.fetch.bind(window);
  const audit = { version: 'assignment-dedupe-fetch-v01', removed: 0, samples: [] };
  window.NYCIF_ASSIGNMENT_DEDUPE_AUDIT = audit;

  function isTarget(input) {
    const url = typeof input === 'string' ? input : String(input?.url || '');
    return TARGETS.some(name => url.includes(name));
  }

  function norm(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function dateKey(row) {
    const raw = String(row?.start_date_time || row?.start || row?.date || '');
    const match = raw.match(/^\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : '';
  }

  function sourceId(row) {
    return String(row?.source_event_id || row?.event_id || row?.permit_id || '').trim();
  }

  function looksOneDayStreetEvent(row) {
    const text = norm([
      row?.title,
      row?.name,
      row?.event_name,
      row?.event_type,
      row?.type,
      row?.major_reason,
      row?.location,
      row?.display_location,
      row?.source_file
    ].join(' '));
    return /block party|street event|street activity|street fair|permit/.test(text);
  }

  function contentKey(row) {
    return [
      norm(row?.title || row?.name || row?.event_name),
      norm(row?.borough),
      norm(row?.display_location || row?.location || row?.address),
      Number(row?.lat || 0).toFixed(5),
      Number(row?.lng || 0).toFixed(5)
    ].join('|');
  }

  function duplicateKey(row) {
    const sid = sourceId(row);
    if (sid) return 'source|' + sid;
    if (looksOneDayStreetEvent(row)) return 'street|' + contentKey(row);
    return '';
  }

  function score(row) {
    let value = Number(row?.expected_crowd_score || row?.priority_score || row?.priority || 0) || 0;
    if (row?.assignment_feed === 'major') value += 100;
    if (row?.field_default) value += 50;
    if (row?.photo_pick || row?.photoPick) value += 25;
    return value;
  }

  function choose(a, b) {
    const da = dateKey(a);
    const db = dateKey(b);
    if (da && db && da !== db) return da < db ? a : b;
    return score(b) > score(a) ? b : a;
  }

  function dedupeRows(rows) {
    const keyed = new Map();
    const passthrough = [];
    for (const row of rows) {
      const key = duplicateKey(row);
      if (!key) {
        passthrough.push(row);
        continue;
      }
      if (!keyed.has(key)) {
        keyed.set(key, row);
        continue;
      }
      const keptBefore = keyed.get(key);
      const keptAfter = choose(keptBefore, row);
      const removed = keptAfter === keptBefore ? row : keptBefore;
      keyed.set(key, keptAfter);
      audit.removed += 1;
      if (audit.samples.length < 12) {
        audit.samples.push({
          key,
          removed_title: removed?.title || removed?.name || removed?.event_name || '',
          removed_date: dateKey(removed),
          kept_date: dateKey(keptAfter),
          source_event_id: sourceId(row) || sourceId(keptBefore)
        });
      }
    }
    return [...passthrough, ...keyed.values()];
  }

  window.fetch = async function patchedFetch(input, init) {
    const response = await originalFetch(input, init);
    if (!isTarget(input)) return response;
    try {
      const json = await response.clone().json();
      const rows = Array.isArray(json) ? json : (Array.isArray(json?.events) ? json.events : null);
      if (!rows) return response;
      const clean = dedupeRows(rows);
      const payload = Array.isArray(json) ? clean : { ...json, events: clean, dedupe_audit: { ...audit } };
      return new Response(JSON.stringify(payload), {
        status: response.status,
        statusText: response.statusText,
        headers: { 'content-type': 'application/json; charset=utf-8' }
      });
    } catch (error) {
      audit.error = String(error?.message || error);
      return response;
    }
  };
})();
