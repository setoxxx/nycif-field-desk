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

  function appleCalendarHref(row, fallback) {
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
      .calendar-split-pill {
        display: inline-grid;
        grid-template-columns: 1fr 1fr;
        align-items: center;
        overflow: hidden;
        min-width: 166px;
        min-height: 34px;
        border-radius: 999px;
        border: 1px solid rgba(0,0,0,.12);
        background: rgba(246,246,247,.92);
        box-shadow: inset 0 1px 0 rgba(255,255,255,.75), 0 5px 14px rgba(0,0,0,.12);
        backdrop-filter: blur(14px) saturate(1.2);
        -webkit-backdrop-filter: blur(14px) saturate(1.2);
        vertical-align: middle;
      }
      .calendar-split-segment {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-height: 34px;
        padding: 7px 11px;
        text-decoration: none;
        font-size: 12.5px;
        font-weight: 700;
        line-height: 1;
        white-space: nowrap;
        color: #111;
        transition: background .15s ease, opacity .15s ease;
      }
      .calendar-split-segment:hover {
        background: rgba(0,0,0,.045);
      }
      .calendar-split-segment:focus-visible {
        outline: 2px solid rgba(0,122,255,.9);
        outline-offset: -3px;
      }
      .calendar-split-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        font-size: 12px;
        font-weight: 800;
        flex: 0 0 auto;
      }
      .calendar-android {
        border-right: 1px solid rgba(0,0,0,.1);
      }
      .calendar-android .calendar-split-icon {
        background: linear-gradient(135deg, #34a853, #3ddc84);
        color: #fff;
      }
      .calendar-apple .calendar-split-icon {
        background: #111;
        color: #fff;
        font-size: 14px;
      }
      .event-item .quick-actions .calendar-split-pill {
        flex: 1 1 166px;
      }
      @media (prefers-color-scheme: dark) {
        .calendar-split-pill {
          border-color: rgba(255,255,255,.16);
          background: rgba(32,32,34,.88);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.12), 0 5px 14px rgba(0,0,0,.22);
        }
        .calendar-split-segment {
          color: #fff;
        }
        .calendar-split-segment:hover {
          background: rgba(255,255,255,.08);
        }
        .calendar-android {
          border-right-color: rgba(255,255,255,.14);
        }
      }
      @media (max-width: 640px) {
        .calendar-split-pill {
          min-width: 180px;
          min-height: 38px;
        }
        .calendar-split-segment {
          min-height: 38px;
          font-size: 13px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function buildCalendarSplit(row, fallback = {}) {
    const split = document.createElement('span');
    split.className = 'calendar-split-pill';
    split.setAttribute('aria-label', 'Add this event to calendar');

    const android = document.createElement('a');
    android.className = 'calendar-split-segment calendar-android';
    android.href = googleCalendarHref(row, fallback);
    android.target = '_blank';
    android.rel = 'noopener';
    android.setAttribute('aria-label', `Add ${fallback.title || 'event'} to Google Calendar from ${SOURCE_LABEL}`);
    android.innerHTML = '<span class="calendar-split-icon" aria-hidden="true">G</span><span>Google</span>';
    android.addEventListener('click', event => {
      event.stopPropagation();
      const status = document.getElementById('status');
      if (status) status.textContent = `Opening Google Calendar with ${SOURCE_LABEL} in the subject.`;
    });

    const apple = document.createElement('a');
    apple.className = 'calendar-split-segment calendar-apple';
    apple.href = appleCalendarHref(row, fallback);
    apple.download = calendarFilename(row, fallback.title || 'event');
    apple.setAttribute('aria-label', `Add ${fallback.title || 'event'} to Apple Calendar from ${SOURCE_LABEL}`);
    apple.innerHTML = '<span class="calendar-split-icon" aria-hidden="true"></span><span>Apple</span>';
    apple.addEventListener('click', event => {
      event.stopPropagation();
      const status = document.getElementById('status');
      if (status) status.textContent = `Apple Calendar file created with ${SOURCE_LABEL} in the subject.`;
    });

    split.appendChild(android);
    split.appendChild(apple);
    return split;
  }

  function addCalendarToEventListActions(group) {
    if (!group || group.querySelector('.calendar-split-pill')) return;
    const copyButton = group.querySelector('[data-copy-id]');
    const id = copyButton?.getAttribute('data-copy-id') || group.closest('[data-id]')?.getAttribute('data-id') || '';
    const row = rowForId(id);
    const card = group.closest('.event-item');
    if (!card) return;
    const title = card.querySelector('strong')?.textContent || '';
    const timeText = card.querySelector('strong + span')?.textContent || '';
    const location = card.querySelector('small')?.textContent || '';
    const calendarControl = buildCalendarSplit(row, { title, timeText, location });

    const copy = group.querySelector('[data-copy-id]');
    if (copy) copy.insertAdjacentElement('beforebegin', calendarControl);
    else group.appendChild(calendarControl);
  }

  function enhance() {
    injectStyles();
    document.querySelectorAll('.event-item .quick-actions').forEach(addCalendarToEventListActions);
  }

  const observer = new MutationObserver(enhance);
  function start() {
    enhance();
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
