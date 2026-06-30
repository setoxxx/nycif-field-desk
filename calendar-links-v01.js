(() => {
  const SOURCE_LABEL = 'NYCinFocus.com';
  const FEED_URL_HINT = 'nycif-live-feeds';
  const rowsById = new Map();
  const originalFetch = window.fetch ? window.fetch.bind(window) : null;

  function clean(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function htmlEscape(value) {
    return clean(value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch]));
  }

  function icsEscape(value) {
    return clean(value)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  }

  function pad(number) {
    return String(number).padStart(2, '0');
  }

  function toIcsDate(date) {
    return [
      date.getUTCFullYear(),
      pad(date.getUTCMonth() + 1),
      pad(date.getUTCDate()),
      'T',
      pad(date.getUTCHours()),
      pad(date.getUTCMinutes()),
      pad(date.getUTCSeconds()),
      'Z'
    ].join('');
  }

  function parseEventDate(row, fallbackText) {
    const startRaw = row?.start_date_time || row?.start || row?.date || '';
    const endRaw = row?.end_date_time || row?.end || '';
    const start = startRaw ? new Date(startRaw) : null;
    const end = endRaw ? new Date(endRaw) : null;
    if (start && Number.isFinite(start.getTime())) {
      const safeEnd = end && Number.isFinite(end.getTime()) && end > start ? end : new Date(start.getTime() + 60 * 60 * 1000);
      return { start, end: safeEnd };
    }

    const fallback = fallbackText ? new Date(fallbackText) : null;
    if (fallback && Number.isFinite(fallback.getTime())) {
      return { start: fallback, end: new Date(fallback.getTime() + 60 * 60 * 1000) };
    }

    const now = new Date();
    return { start: now, end: new Date(now.getTime() + 60 * 60 * 1000) };
  }

  function sourceUrl(row) {
    return clean(row?.source_url || row?.url || row?.event_url || row?.official_source_url || 'https://nycinfocus.com/');
  }

  function eventTitle(row, fallbackTitle) {
    const base = clean(row?.title || row?.name || fallbackTitle || 'NYC event');
    return `${SOURCE_LABEL} — ${base}`;
  }

  function makeIcs(row, fallback = {}) {
    const title = eventTitle(row, fallback.title);
    const location = clean(row?.display_location || row?.location || row?.address || fallback.location || 'New York City');
    const borough = clean(row?.borough || '');
    const link = sourceUrl(row);
    const { start, end } = parseEventDate(row, fallback.timeText);
    const uid = clean(row?.id || row?.source_event_id || `${title}-${start.toISOString()}`).replace(/[^a-zA-Z0-9._-]+/g, '-');
    const description = [
      `Saved from ${SOURCE_LABEL}`,
      borough ? `Borough: ${borough}` : '',
      location ? `Location: ${location}` : '',
      link ? `Source: ${link}` : '',
      'Event details can change. Confirm before traveling.'
    ].filter(Boolean).join('\n');

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//NYCinFocus.com//Field Desk//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}@nycinfocus.com`,
      `DTSTAMP:${toIcsDate(new Date())}`,
      `DTSTART:${toIcsDate(start)}`,
      `DTEND:${toIcsDate(end)}`,
      `SUMMARY:${icsEscape(title)}`,
      `LOCATION:${icsEscape(location)}`,
      `DESCRIPTION:${icsEscape(description)}`,
      link ? `URL:${link}` : '',
      'END:VEVENT',
      'END:VCALENDAR'
    ].filter(Boolean).join('\r\n');
  }

  function calendarHref(row, fallback) {
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(makeIcs(row, fallback))}`;
  }

  function calendarFilename(row, fallbackTitle) {
    const title = clean(row?.title || fallbackTitle || 'nyc-event').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'nyc-event';
    return `nycinfocus-${title}.ics`;
  }

  function rememberRows(json) {
    const rows = Array.isArray(json) ? json : Array.isArray(json?.events) ? json.events : [];
    rows.forEach((row, index) => {
      if (!row || typeof row !== 'object') return;
      const fallbackId = `event-${index}`;
      [row.id, row.source_event_id, row.event_id, fallbackId].forEach(value => {
        const key = clean(value);
        if (key) rowsById.set(key, row);
      });
    });
  }

  if (originalFetch) {
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      try {
        const url = String(args[0]?.url || args[0] || '');
        if (url.includes(FEED_URL_HINT)) {
          response.clone().json().then(rememberRows).catch(() => {});
        }
      } catch {}
      return response;
    };
  }

  function rowForId(id) {
    return rowsById.get(clean(id)) || null;
  }

  function addCalendarToActionGroup(group) {
    if (!group || group.querySelector('.calendar-action')) return;
    const copyButton = group.querySelector('[data-copy-id]');
    const id = copyButton?.getAttribute('data-copy-id') || group.closest('[data-id]')?.getAttribute('data-id') || '';
    const row = rowForId(id);
    const card = group.closest('.event-item, .popup-card');
    const title = card?.querySelector('strong, h2')?.textContent || '';
    const timeText = card?.querySelector('span:not(.item-tag):not(.item-source), dd')?.textContent || '';
    const location = card?.querySelector('small')?.textContent || '';

    const link = document.createElement('a');
    link.className = 'field-action calendar-action';
    link.textContent = 'Add to calendar';
    link.href = calendarHref(row, { title, timeText, location });
    link.download = calendarFilename(row, title);
    link.setAttribute('aria-label', `Add ${title || 'event'} to calendar from ${SOURCE_LABEL}`);
    link.addEventListener('click', () => {
      const status = document.getElementById('status');
      if (status) status.textContent = `Calendar file created with ${SOURCE_LABEL} in the subject.`;
    });

    const copy = group.querySelector('[data-copy-id]');
    if (copy) copy.insertAdjacentElement('beforebegin', link);
    else group.appendChild(link);
  }

  function enhance() {
    document.querySelectorAll('.field-actions, .quick-actions').forEach(addCalendarToActionGroup);
  }

  const observer = new MutationObserver(enhance);
  function start() {
    enhance();
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
