(() => {
  const SOURCE_LABEL = 'NYCinFocus.com';
  const FEED_URL_HINT = 'nycif-live-feeds';
  const rowsById = new Map();
  const originalFetch = window.fetch ? window.fetch.bind(window) : null;

  function clean(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
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

  function toCalendarDate(date) {
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

  function eventLocation(row, fallback = {}) {
    return clean(row?.display_location || row?.location || row?.address || fallback.location || 'New York City');
  }

  function eventDescription(row, fallback = {}) {
    const location = eventLocation(row, fallback);
    const borough = clean(row?.borough || '');
    const link = sourceUrl(row);
    return [
      `Saved from ${SOURCE_LABEL}`,
      borough ? `Borough: ${borough}` : '',
      location ? `Location: ${location}` : '',
      link ? `Source: ${link}` : '',
      'Event details can change. Confirm before traveling.'
    ].filter(Boolean).join('\n');
  }

  function makeIcs(row, fallback = {}) {
    const title = eventTitle(row, fallback.title);
    const location = eventLocation(row, fallback);
    const link = sourceUrl(row);
    const { start, end } = parseEventDate(row, fallback.timeText);
    const uid = clean(row?.id || row?.source_event_id || `${title}-${start.toISOString()}`).replace(/[^a-zA-Z0-9._-]+/g, '-');
    const description = eventDescription(row, fallback);

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//NYCinFocus.com//Field Desk//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}@nycinfocus.com`,
      `DTSTAMP:${toCalendarDate(new Date())}`,
      `DTSTART:${toCalendarDate(start)}`,
      `DTEND:${toCalendarDate(end)}`,
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

  function googleCalendarHref(row, fallback = {}) {
    const { start, end } = parseEventDate(row, fallback.timeText);
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: eventTitle(row, fallback.title),
      dates: `${toCalendarDate(start)}/${toCalendarDate(end)}`,
      details: eventDescription(row, fallback),
      location: eventLocation(row, fallback)
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
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

  function injectStyles() {
    if (document.getElementById('nycif-calendar-split-styles')) return;
    const style = document.createElement('style');
    style.id = 'nycif-calendar-split-styles';
    style.textContent = `
      .calendar-split-wrap {
        display: flex;
        flex-direction: column;
        gap: 6px;
        width: 100%;
        min-width: min(250px, 100%);
        margin: 6px 0;
      }
      .calendar-split-label {
        align-self: flex-start;
        padding: 4px 10px;
        border-radius: 999px;
        background: #d93025;
        color: #fff;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: .02em;
        box-shadow: 0 4px 12px rgba(217,48,37,.25);
      }
      .calendar-split {
        display: grid;
        grid-template-columns: 1fr 1fr;
        overflow: hidden;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,.16);
        box-shadow: 0 10px 24px rgba(0,0,0,.18);
      }
      .calendar-segment {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: 46px;
        padding: 10px 12px;
        text-decoration: none;
        font-size: 14px;
        font-weight: 800;
        line-height: 1;
        white-space: nowrap;
        transition: transform .15s ease, opacity .15s ease, filter .15s ease;
      }
      .calendar-segment:hover {
        opacity: .96;
        filter: saturate(1.08);
      }
      .calendar-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 999px;
        font-size: 14px;
        font-weight: 900;
        flex: 0 0 auto;
      }
      .calendar-google {
        background: #ffffff;
        color: #202124;
        border-right: 1px solid rgba(0,0,0,.1);
      }
      .calendar-google .calendar-icon {
        background: conic-gradient(from -45deg, #4285f4 0 25%, #34a853 0 50%, #fbbc05 0 75%, #ea4335 0 100%);
        color: #fff;
      }
      .calendar-apple {
        background: #111111;
        color: #ffffff;
      }
      .calendar-apple .calendar-icon {
        background: rgba(255,255,255,.14);
        color: #fff;
        font-size: 17px;
      }
      .quick-actions .calendar-split-wrap,
      .field-actions .calendar-split-wrap {
        flex-basis: 100%;
      }
      @media (max-width: 640px) {
        .calendar-segment {
          min-height: 50px;
          font-size: 15px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function buildCalendarSplit(row, fallback = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'calendar-split-wrap';

    const label = document.createElement('div');
    label.className = 'calendar-split-label';
    label.textContent = 'Add to Calendar';

    const split = document.createElement('div');
    split.className = 'calendar-split';

    const google = document.createElement('a');
    google.className = 'calendar-segment calendar-google';
    google.href = googleCalendarHref(row, fallback);
    google.target = '_blank';
    google.rel = 'noopener';
    google.setAttribute('aria-label', `Add ${fallback.title || 'event'} to Google Calendar from ${SOURCE_LABEL}`);
    google.innerHTML = '<span class="calendar-icon" aria-hidden="true">G</span><span>Google</span>';
    google.addEventListener('click', () => {
      const status = document.getElementById('status');
      if (status) status.textContent = `Opening Google Calendar with ${SOURCE_LABEL} in the subject.`;
    });

    const apple = document.createElement('a');
    apple.className = 'calendar-segment calendar-apple';
    apple.href = calendarHref(row, fallback);
    apple.download = calendarFilename(row, fallback.title || 'event');
    apple.setAttribute('aria-label', `Add ${fallback.title || 'event'} to Apple Calendar from ${SOURCE_LABEL}`);
    apple.innerHTML = '<span class="calendar-icon" aria-hidden="true"></span><span>Apple</span>';
    apple.addEventListener('click', () => {
      const status = document.getElementById('status');
      if (status) status.textContent = `Apple Calendar file created with ${SOURCE_LABEL} in the subject.`;
    });

    split.appendChild(google);
    split.appendChild(apple);
    wrap.appendChild(label);
    wrap.appendChild(split);
    return wrap;
  }

  function addCalendarToActionGroup(group) {
    if (!group || group.querySelector('.calendar-split-wrap')) return;
    const copyButton = group.querySelector('[data-copy-id]');
    const id = copyButton?.getAttribute('data-copy-id') || group.closest('[data-id]')?.getAttribute('data-id') || '';
    const row = rowForId(id);
    const card = group.closest('.event-item, .popup-card');
    const title = card?.querySelector('strong, h2')?.textContent || '';
    const timeText = card?.querySelector('span:not(.item-tag):not(.item-source), dd')?.textContent || '';
    const location = card?.querySelector('small')?.textContent || '';
    const calendarControl = buildCalendarSplit(row, { title, timeText, location });

    const copy = group.querySelector('[data-copy-id]');
    if (copy) copy.insertAdjacentElement('beforebegin', calendarControl);
    else group.appendChild(calendarControl);
  }

  function enhance() {
    injectStyles();
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
