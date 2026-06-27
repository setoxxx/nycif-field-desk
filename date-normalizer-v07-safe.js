(() => {
  const VERSION = 'v0.7-safe-date-normalizer';
  const FEED_MATCH = /nycif_(major|all)_radar_map_events\.json/i;
  const originalFetch = window.fetch.bind(window);

  function isIsoDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').slice(0, 10));
  }

  function toDateKey(value) {
    if (!value) return '';
    const text = String(value);
    if (isIsoDate(text)) return text.slice(0, 10);
    const t = Date.parse(text);
    if (!Number.isFinite(t)) return '';
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function addDays(key, days) {
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function daysBetween(startKey, endKey) {
    const [sy, sm, sd] = startKey.split('-').map(Number);
    const [ey, em, ed] = endKey.split('-').map(Number);
    const start = Date.UTC(sy, sm - 1, sd);
    const end = Date.UTC(ey, em - 1, ed);
    return Math.max(0, Math.round((end - start) / 86400000));
  }

  function normalizeOne(row, dayKey, suffix) {
    const item = { ...row };
    const baseId = String(row.id || row.event_id || row.title || 'event');
    item.id = suffix ? `${baseId}--${dayKey}` : baseId;
    item.date = dayKey;
    item.start_date_time = dayKey;
    item._display_date = dayKey;
    item._date_normalized = VERSION;
    return item;
  }

  function expandRow(row) {
    const startKey = toDateKey(row.date) || toDateKey(row.start_date_time) || toDateKey(row.start) || toDateKey(row.start_date);
    if (!startKey) return [row];
    const endKey = toDateKey(row.end_date) || toDateKey(row.end_date_time) || toDateKey(row.end) || startKey;
    const span = Math.min(daysBetween(startKey, endKey), 370);
    if (span <= 0) return [normalizeOne(row, startKey, false)];
    const rows = [];
    for (let i = 0; i <= span; i += 1) {
      const dayKey = addDays(startKey, i);
      rows.push(normalizeOne(row, dayKey, true));
    }
    return rows;
  }

  function normalizePayload(payload) {
    const rows = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.events) ? payload.events : null);
    if (!rows) return payload;
    const normalized = rows.flatMap(expandRow);
    if (Array.isArray(payload)) return normalized;
    return { ...payload, events: normalized, _normalized_by: VERSION };
  }

  window.fetch = async function patchedFetch(input, init) {
    const response = await originalFetch(input, init);
    const url = typeof input === 'string' ? input : input?.url || '';
    if (!FEED_MATCH.test(url)) return response;
    try {
      const copy = response.clone();
      const json = await copy.json();
      const normalized = normalizePayload(json);
      const headers = new Headers(response.headers);
      headers.set('content-type', 'application/json; charset=utf-8');
      headers.set('x-nycif-normalized', VERSION);
      return new Response(JSON.stringify(normalized), {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch (error) {
      console.warn('NYCIF date normalizer skipped feed', error);
      return response;
    }
  };
})();
