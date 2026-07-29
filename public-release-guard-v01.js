(() => {
  'use strict';

  const schema = window.NYCIF_EVENT_FEED_SCHEMA_V1;
  if (!schema || schema.__nycifPublicReleaseGuardV01) return;

  const DEFAULT_TIMEZONE = schema.DEFAULT_TIMEZONE || 'America/New_York';
  const policy = window.NYCIF_PUBLIC_FEED_POLICY || { allowReview: false };
  const originalProjectEnvelope = schema.projectEnvelope.bind(schema);
  const originalProjectEvent = typeof schema.projectEvent === 'function'
    ? schema.projectEvent.bind(schema)
    : null;

  const scalarFields = [
    'date', 'description', 'event_group_id', 'parent_event_id', 'event_role',
    'neighborhood', 'address', 'audience'
  ];
  const arrayFields = ['interests', 'tags'];

  function rawRows(payload) {
    return Array.isArray(payload) ? payload : (Array.isArray(payload?.events) ? payload.events : []);
  }

  function partsInZone(date, timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).formatToParts(date);
    return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  }

  function offsetMsAt(timestamp, timeZone) {
    const date = new Date(timestamp);
    const p = partsInZone(date, timeZone);
    const representedAsUtc = Date.UTC(
      Number(p.year), Number(p.month) - 1, Number(p.day),
      Number(p.hour), Number(p.minute), Number(p.second)
    );
    return representedAsUtc - Math.floor(timestamp / 1000) * 1000;
  }

  function offsetLabel(offsetMs) {
    const minutes = Math.round(offsetMs / 60000);
    const sign = minutes >= 0 ? '+' : '-';
    const abs = Math.abs(minutes);
    return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
  }

  function normalizeWallTime(value, timeZone = DEFAULT_TIMEZONE) {
    const text = String(value || '').trim();
    if (!text || /^\d{4}-\d{2}-\d{2}$/.test(text)) return value;
    if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(text)) return text;

    const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?\s*(am|pm)?$/i.exec(text);
    if (!match) return value;

    let hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = Number(match[6] || 0);
    const milliseconds = Number(String(match[7] || '0').padEnd(3, '0'));
    const ampm = String(match[8] || '').toLowerCase();
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    if (hour > 23 || minute > 59 || second > 59) return value;

    const wallUtc = Date.UTC(
      Number(match[1]), Number(match[2]) - 1, Number(match[3]),
      hour, minute, second, milliseconds
    );
    let instant = wallUtc;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      instant = wallUtc - offsetMsAt(instant, timeZone);
    }
    const offset = offsetMsAt(instant, timeZone);
    const fraction = milliseconds ? `.${String(milliseconds).padStart(3, '0')}` : '';
    return `${match[1]}-${match[2]}-${match[3]}T${String(hour).padStart(2, '0')}:${match[5]}:${String(second).padStart(2, '0')}${fraction}${offsetLabel(offset)}`;
  }

  function enrichEvent(projected, raw, dataLayer) {
    const event = projected || {};
    const source = raw && typeof raw.source === 'object' ? raw.source : {};
    const timezone = String(raw?.timezone || event.timezone || DEFAULT_TIMEZONE);

    scalarFields.forEach(field => {
      if (raw && Object.hasOwn(raw, field)) event[field] = raw[field];
    });
    arrayFields.forEach(field => {
      event[field] = Array.isArray(raw?.[field]) ? [...raw[field]] : [];
    });

    event.timezone = timezone;
    event.start_date_time = normalizeWallTime(raw?.start_date_time ?? event.start_date_time, timezone);
    event.end_date_time = normalizeWallTime(raw?.end_date_time ?? event.end_date_time, timezone);
    event.source = {
      ...source,
      ...(event.source || {})
    };
    event.nycif = {
      ...(raw?.nycif || {}),
      ...(event.nycif || {})
    };

    if (!event.event_role) event.event_role = 'public_event';
    if (!Object.hasOwn(event, 'parent_event_id')) event.parent_event_id = null;
    if (!Object.hasOwn(event, 'event_group_id')) event.event_group_id = null;
    if (dataLayer === 'review_supplemental') {
      event.nycif.data_layer = 'review_supplemental';
      event.nycif.production_feed = false;
      event.nycif.promotion_allowed = false;
      event.nycif.manual_review_status = event.nycif.manual_review_status || 'pending';
    }
    return event;
  }

  function projectEnvelope(payload, dataLayer, generatedAtUtc) {
    if (dataLayer === 'review_supplemental' && !policy.allowReview) {
      return {
        schema_version: schema.SCHEMA_VERSION || '1.0',
        generated_at_utc: generatedAtUtc || payload?.generated_at_utc || new Date().toISOString(),
        total: 0,
        next_cursor: null,
        events: []
      };
    }
    const rows = rawRows(payload);
    const envelope = originalProjectEnvelope(payload, dataLayer, generatedAtUtc);
    envelope.events = (envelope.events || []).map((event, index) => enrichEvent(event, rows[index] || {}, dataLayer));
    envelope.total = envelope.events.length;
    return envelope;
  }

  function projectEvent(row, index, dataLayer) {
    const projected = originalProjectEvent
      ? originalProjectEvent(row, index, dataLayer)
      : originalProjectEnvelope({ events: [row] }, dataLayer).events[0];
    return enrichEvent(projected, row || {}, dataLayer);
  }

  function nycDateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: DEFAULT_TIMEZONE,
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const p = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
    return `${p.year}-${p.month}-${p.day}`;
  }

  function addCalendarDays(key, amount) {
    const [year, month, day] = key.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + amount, 12));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }

  function dateChipModel(baseDate) {
    const first = nycDateKey(baseDate && typeof baseDate.getTime === 'function' ? baseDate : new Date());
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return Array.from({ length: 8 }, (_, offset) => {
      const key = addCalendarDays(first, offset);
      const [year, month, day] = key.split('-').map(Number);
      const weekday = dayNames[new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay()];
      const label = offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : `${weekday} ${month}/${day}`;
      return { key, label, offset };
    });
  }

  window.NYCIF_EVENT_FEED_SCHEMA_V1 = {
    ...schema,
    __nycifPublicReleaseGuardV01: true,
    projectEnvelope,
    projectEvent,
    dateChipModel,
    normalizeWallTime,
    nycDateKey
  };

  window.NYCIF_PUBLIC_RELEASE_GUARD = Object.freeze({
    version: 'public-release-guard-v01',
    normalizeWallTime,
    nycDateKey,
    dateChipModel
  });
})();
