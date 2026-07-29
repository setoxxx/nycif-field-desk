(() => {
  const enabled = (() => {
    try {
      const params = new URL(location.href).searchParams;
      const version = String(params.get('v') || '');
      return params.get('eventStatusQa') === '1'
        || params.get('markerStatusQa') === '1'
        || /protected-fullscreen-map-qa|event-status-qa|status-markers/i.test(version);
    } catch {
      return false;
    }
  })();

  if (!enabled || !window.L || !window.L.Marker) {
    return;
  }

  const STATUS_CLASSES = [
    'nycif-marker--upcoming',
    'nycif-marker--live',
    'nycif-marker--ended',
    'nycif-marker--unknown'
  ];

  const STATUS_LABELS = {
    upcoming: 'Upcoming',
    live: 'Live now',
    ended: 'Ended',
    unknown: 'Time unknown'
  };

  const TIME_ZONE_OFFSET = '-04:00';

  function hasMeaningfulTime(value) {
    const text = String(value || '');
    return /T\d{1,2}:\d{2}/.test(text) || /T\d{1,2}:\d{2}\s*(am|pm)/i.test(text);
  }

  function dateOnly(value) {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value || '').trim());
    return match ? match[1] : '';
  }

  function nycDateKey(date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date || new Date());
    const byType = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${byType.year}-${byType.month}-${byType.day}`;
  }

  function parseClock(value, endOfDay) {
    const text = String(value || '').trim();
    if (!text) {
      return null;
    }

    const day = dateOnly(text);
    const match12 = text.match(/T(\d{1,2}):(\d{2})\s*(am|pm)/i);
    if (day && match12) {
      let hour = Number(match12[1]);
      const minute = Number(match12[2]);
      const ampm = String(match12[3]).toLowerCase();
      if (ampm === 'pm' && hour < 12) hour += 12;
      if (ampm === 'am' && hour === 12) hour = 0;
      return new Date(`${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00${TIME_ZONE_OFFSET}`);
    }

    if (hasMeaningfulTime(text)) {
      const parsed = new Date(text);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (day) {
      return new Date(`${day}T${endOfDay ? '23:59:59' : '00:00:00'}${TIME_ZONE_OFFSET}`);
    }

    return null;
  }

  function firstDateOnly(...values) {
    for (const value of values) {
      const day = dateOnly(value);
      if (day) {
        return day;
      }
    }
    return '';
  }

  function endInfoFor(event, startDay) {
    const explicitRaw = event?.end_date_time || event?.end || '';
    const explicitEnd = parseClock(explicitRaw, true);
    const explicitEndDay = dateOnly(explicitRaw);

    if (explicitEnd) {
      return {
        date: explicitEnd,
        // A marker can only be "Live now" when the feed gives a real end time.
        // Date-only end values are useful for "ended" after the date passes,
        // but they are not precise enough to claim the event is happening now.
        liveReliable: hasMeaningfulTime(explicitRaw),
        endedReliable: hasMeaningfulTime(explicitRaw) || Boolean(explicitEndDay && (!startDay || explicitEndDay > startDay))
      };
    }

    const uiEndDay = firstDateOnly(event?.endDay);
    if (uiEndDay && startDay && uiEndDay > startDay) {
      return {
        date: parseClock(uiEndDay, true),
        liveReliable: false,
        endedReliable: true
      };
    }

    return { date: null, liveReliable: false, endedReliable: false };
  }

  function eventStatus(event, now = new Date()) {
    const startRaw = event?.start_date_time || event?.start || event?.date || event?.dateKey || event?.startDay || '';
    const start = parseClock(startRaw, false);
    const startDay = firstDateOnly(startRaw, event?.date, event?.dateKey, event?.startDay);
    const end = endInfoFor(event, startDay);
    const today = nycDateKey(now);

    if (end.date && end.endedReliable && now > end.date) {
      return 'ended';
    }
    if (start && now < start) {
      return 'upcoming';
    }
    if (start && end.date && end.liveReliable && now >= start && now <= end.date) {
      return 'live';
    }

    // No reliable end time: never imply an indefinite live event.
    // Same-day single-time rows such as "10:00 AM" become unknown after start,
    // not live-until-midnight. Older single-time rows can safely recede as ended.
    if (start) {
      if (startDay && today > startDay) {
        return 'ended';
      }
      return now < start ? 'upcoming' : 'unknown';
    }

    if (startDay && today > startDay) {
      return 'ended';
    }
    return 'unknown';
  }

  function stackStatus(events) {
    const list = Array.isArray(events) ? events.filter(Boolean) : [];
    if (!list.length) {
      return 'unknown';
    }
    const statuses = list.map(event => eventStatus(event));
    if (statuses.includes('live')) {
      return 'live';
    }
    if (statuses.every(status => status === 'ended')) {
      return 'ended';
    }
    if (statuses.includes('upcoming')) {
      return 'upcoming';
    }
    return 'unknown';
  }

  function labelFor(status) {
    return STATUS_LABELS[status] || STATUS_LABELS.unknown;
  }

  function currentEvents(marker) {
    const stack = marker && marker.__nycifStack;
    return Array.isArray(stack?.events) ? stack.events : [];
  }

  function selectedEvent(marker) {
    const stack = marker && marker.__nycifStack;
    return stack?.selected || (Array.isArray(stack?.events) ? stack.events[0] : null);
  }

  function applyMarkerStatus(marker) {
    const events = currentEvents(marker);
    const status = stackStatus(events);
    const label = labelFor(status);
    const root = marker?.getElement?.();
    const icon = root?.querySelector?.('.marker');

    if (!icon) {
      return;
    }

    icon.classList.remove(...STATUS_CLASSES);
    icon.classList.add(`nycif-marker--${status}`);
    icon.dataset.eventStatus = status;
    icon.dataset.eventStatusLabel = label;

    const title = root.getAttribute('title') || marker.options?.title || events[0]?.title || 'NYC In Focus event marker';
    const cleanTitle = String(title).replace(/\s+—\s+(Upcoming|Live now|Ended|Time unknown)$/i, '');
    const accessible = `${cleanTitle} — ${label}`;
    root.setAttribute('title', accessible);
    root.setAttribute('aria-label', accessible);
    root.dataset.nycifEventStatus = status;
  }

  function popupStatusLine(marker) {
    const event = selectedEvent(marker);
    const events = event ? [event] : currentEvents(marker);
    const status = event ? eventStatus(event) : stackStatus(events);
    const label = labelFor(status);
    const popupEl = marker?.getPopup?.()?.getElement?.();
    const card = popupEl?.querySelector?.('.popup-card');

    if (!card || card.querySelector('.nycif-status-line')) {
      return;
    }

    const line = document.createElement('p');
    line.className = `nycif-status-line nycif-status-line--${status}`;
    line.textContent = `Status: ${label}`;
    line.setAttribute('aria-label', `Event status: ${label}`);

    const heading = card.querySelector('h2');
    if (heading && heading.nextSibling) {
      card.insertBefore(line, heading.nextSibling);
    } else if (heading) {
      heading.after(line);
    } else {
      card.prepend(line);
    }
  }

  function syncListStatuses() {
    document.querySelectorAll('.event-item').forEach(item => {
      if (item.querySelector('.nycif-list-status')) {
        return;
      }
      const title = item.querySelector('strong')?.textContent?.trim();
      if (!title) {
        return;
      }
      const matching = [];
      window.NYCIF_MAIN_MAP?.eachLayer?.(layer => {
        const events = currentEvents(layer);
        events.forEach(event => {
          if (event?.title === title) matching.push(event);
        });
      });
      if (!matching.length) {
        return;
      }
      const status = stackStatus(matching);
      const label = labelFor(status);
      const tags = item.querySelector('.item-tags');
      if (!tags) {
        return;
      }
      const chip = document.createElement('span');
      chip.className = `item-tag nycif-list-status nycif-list-status--${status}`;
      chip.textContent = label;
      tags.prepend(chip);
    });
  }

  function installMarkerHooks(marker) {
    if (!marker || marker.__nycifStatusHooksInstalled) {
      return;
    }
    marker.__nycifStatusHooksInstalled = true;
    marker.on('popupopen', () => {
      window.setTimeout(() => popupStatusLine(marker), 0);
    });
  }

  const originalOnAdd = window.L.Marker.prototype.onAdd;
  window.L.Marker.prototype.onAdd = function patchedStatusOnAdd(map) {
    const result = originalOnAdd.call(this, map);
    installMarkerHooks(this);
    window.setTimeout(() => {
      applyMarkerStatus(this);
      syncListStatuses();
    }, 0);
    return result;
  };

  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(syncListStatuses);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.NYCIF_EVENT_STATUS_MARKERS = {
    enabled: true,
    eventStatus,
    stackStatus,
    applyMarkerStatus,
    syncListStatuses
  };
})();
