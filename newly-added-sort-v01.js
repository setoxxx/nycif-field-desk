(() => {
  const VERSION = 'newly-added-sort-v01';
  const NEW_EVENTS_URL = 'https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/data/nycif_new_events.json';
  const sortSelect = document.getElementById('sortSelect');
  const eventList = document.getElementById('eventList');
  if (!sortSelect || !eventList) return;

  if (![...sortSelect.options].some(option => option.value === 'newly')) {
    const option = document.createElement('option');
    option.value = 'newly';
    option.textContent = 'Newly added';
    sortSelect.insertBefore(option, sortSelect.options[1] || null);
  }

  const exactIds = new Map();
  const sourceDayKeys = new Map();
  let applying = false;

  function dayOf(value) {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value || ''));
    return match ? match[1] : '';
  }

  function sourceIdFrom(value) {
    const text = String(value || '');
    const match = /(?:^|:)(\d+)(?:@\d{4}-\d{2}-\d{2})?$/.exec(text);
    return match ? match[1] : '';
  }

  function recordSignals(record) {
    const firstSeen = Date.parse(record.first_seen_utc || '') || 0;
    const day = dayOf(record.start_date || record.start_date_time || record.id);
    const id = String(record.id || '');
    if (id) {
      exactIds.set(id, Math.max(exactIds.get(id) || 0, firstSeen));
      if (day && id.endsWith(`@${day}@${day}`)) {
        const normalized = id.slice(0, -(`@${day}`.length));
        exactIds.set(normalized, Math.max(exactIds.get(normalized) || 0, firstSeen));
      }
    }
    const sourceId = String(record.source_event_id || record.source?.source_event_id || sourceIdFrom(id));
    if (sourceId && day) {
      const key = `${sourceId}|${day}`;
      sourceDayKeys.set(key, Math.max(sourceDayKeys.get(key) || 0, firstSeen));
    }
  }

  function rankForCard(card) {
    const id = String(card.dataset.id || '');
    if (exactIds.has(id)) return exactIds.get(id) || 1;
    const day = dayOf(id);
    const sourceId = sourceIdFrom(id);
    if (sourceId && day) return sourceDayKeys.get(`${sourceId}|${day}`) || 0;
    return 0;
  }

  function applySort() {
    if (applying || sortSelect.value !== 'newly') return;
    const cards = [...eventList.querySelectorAll(':scope > .event-item')];
    if (cards.length < 2) return;
    applying = true;
    cards
      .map((card, index) => ({ card, index, rank: rankForCard(card) }))
      .sort((a, b) => b.rank - a.rank || a.index - b.index)
      .forEach(({ card, rank }) => {
        card.dataset.newlyAdded = rank > 0 ? 'true' : 'false';
        eventList.appendChild(card);
      });
    applying = false;
  }

  const observer = new MutationObserver(() => {
    if (!applying) queueMicrotask(applySort);
  });
  observer.observe(eventList, { childList: true });
  sortSelect.addEventListener('change', () => queueMicrotask(applySort));

  fetch(`${NEW_EVENTS_URL}?cache=${Date.now()}`, { cache: 'no-store', headers: { Accept: 'application/json' } })
    .then(response => {
      if (!response.ok) throw new Error(`new-events unavailable (${response.status})`);
      return response.json();
    })
    .then(payload => {
      const records = Array.isArray(payload?.events) ? payload.events : [];
      records.forEach(recordSignals);
      applySort();
      window.NYCIF_NEWLY_ADDED_SORT = {
        version: VERSION,
        generatedAtUtc: payload?.generated_at_utc || null,
        newCount: records.length,
      };
    })
    .catch(error => {
      console.warn('[NYCIF] Newly added sort signal unavailable:', error);
      window.NYCIF_NEWLY_ADDED_SORT = { version: VERSION, generatedAtUtc: null, newCount: 0 };
    });
})();
