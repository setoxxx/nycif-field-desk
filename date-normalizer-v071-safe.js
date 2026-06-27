(() => {
  const VERSION = 'v0.7.1-window-date-normalizer';
  const FEED_MATCH = /nycif_(major|all)_radar_map_events\.json/i;
  const originalFetch = window.fetch.bind(window);

  function toDateKey(value) {
    if (!value) return '';
    const text = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
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

  function weekStartSunday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function dayNumber(key) {
    const [y, m, d] = key.split('-').map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  }

  const windowStart = weekStartSunday();
  const windowEnd = addDays(windowStart, 13);
  const windowStartN = dayNumber(windowStart);
  const windowEndN = dayNumber(windowEnd);

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
    const startN = dayNumber(startKey);
    const endN = dayNumber(endKey);
    if (!Number.isFinite(startN) || !Number.isFinite(endN)) return [normalizeOne(row, startKey, false)];
    if (endN < windowStartN || startN > windowEndN) return [normalizeOne(row, startKey, false)];
    const from = Math.max(startN, windowStartN);
    const to = Math.min(endN, windowEndN);
    const rows = [];
    for (let n = from; n <= to; n += 1) {
      const dayKey = addDays('1970-01-01', n);
      rows.push(normalizeOne(row, dayKey, n !== startN));
    }
    return rows.length ? rows : [normalizeOne(row, startKey, false)];
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
      return new Response(JSON.stringify(normalized), { status: response.status, statusText: response.statusText, headers });
    } catch (error) {
      console.warn('NYCIF date normalizer skipped feed', error);
      return response;
    }
  };
})();
