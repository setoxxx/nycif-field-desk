(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const loader = window.NYCIF_FEED_LOADER_V01;
  const reviewedKey = 'nycif-assignment-desk-reviewed-v04';
  const debug = (() => { try { return new URL(location.href).searchParams.get('debugCalendar') === '1'; } catch { return false; } })();
  const state = {
    events: [],
    diagnostics: null,
    aborter: null,
    loadToken: 0,
    selectedDate: '',
    monthOffset: 0,
    reviewed: loadReviewed(),
    filters: { q: '', borough: '', eventType: '', category: '', group: '', coordinate: '', verification: '', source: '', major: false, photo: false }
  };

  function text(value) { return String(value ?? '').trim(); }
  function esc(value) { return text(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
  function el(tag, className, value) { const node = document.createElement(tag); if (className) node.className = className; if (value !== undefined) node.textContent = value; return node; }
  function loadReviewed() { try { return new Set(JSON.parse(localStorage.getItem(reviewedKey) || '[]')); } catch { return new Set(); } }
  function saveReviewed() { try { localStorage.setItem(reviewedKey, JSON.stringify([...state.reviewed].slice(-100000))); } catch {} }
  function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
  function currentMonth() { const now = new Date(); return new Date(now.getFullYear(), now.getMonth() + state.monthOffset, 1); }
  function dateLabel(key) { const date = new Date(`${key}T12:00:00`); return Number.isNaN(date.getTime()) ? key : date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); }
  function timeRange(event) { return [event.start, event.end].filter(Boolean).join('–') || 'Time not listed'; }

  function assignmentScore(event) {
    let score = 0;
    if (event.major) score += 500;
    if (event.significance === 'major') score += 200;
    if (event.photoPick) score += 120;
    score += Number(event.majorScore || 0);
    score += Number(event.priorityScore || 0);
    score += Math.min(100, Number(event.expectedCrowdScore || 0) / 10);
    if (/very_high/i.test(event.crowdLevel)) score += 55;
    else if (/high/i.test(event.crowdLevel)) score += 30;
    if (/verified|confirmed|field_intel|nypd/i.test(event.verification)) score += 40;
    if (event.majorReason) score += 30;
    if (event.group === 'parade') score += 90;
    if (event.group === 'march') score += 75;
    if (event.group === 'street') score += 60;
    if (event.group === 'sports') score += 35;
    if (event.group === 'civic') score += 30;
    if (event.group === 'virtual') score += 15;
    return score;
  }

  function isTop(event) { return event.major || event.photoPick || assignmentScore(event) >= 180; }
  function ranked(events) { return [...events].sort((a, b) => assignmentScore(b) - assignmentScore(a) || `${a.start} ${a.title}`.localeCompare(`${b.start} ${b.title}`)); }

  function matches(event) {
    const f = state.filters;
    const haystack = [event.title, event.borough, event.location, event.eventType, event.category, event.group, event.sourceDataset, event.sourceEventId, event.majorReason].join(' ').toLowerCase();
    if (f.q && !haystack.includes(f.q)) return false;
    if (f.borough && event.borough !== f.borough) return false;
    if (f.eventType && event.eventType !== f.eventType) return false;
    if (f.category && event.category !== f.category) return false;
    if (f.group && (f.group === 'top' ? !isTop(event) : event.group !== f.group)) return false;
    if (f.coordinate && event.coordinateStatus !== f.coordinate) return false;
    if (f.verification && event.verification !== f.verification) return false;
    if (f.source && !(event.sourceFeed === f.source || (event.sourceFeeds || []).includes(f.source))) return false;
    if (f.major && !event.major) return false;
    if (f.photo && !event.photoPick) return false;
    return true;
  }

  function filtered() { return state.events.filter(event => event.date && matches(event)); }

  function populateSelect(id, values) {
    const select = $(id);
    const current = select.value;
    while (select.options.length > 1) select.remove(1);
    [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b)).forEach(value => {
      const option = document.createElement('option'); option.value = value; option.textContent = value; select.append(option);
    });
    select.value = current;
  }

  function populateFilters() {
    populateSelect('boroughFilter', state.events.map(event => event.borough));
    populateSelect('eventTypeFilter', state.events.map(event => event.eventType));
    populateSelect('categoryFilter', state.events.map(event => event.category));
    populateSelect('coordinateFilter', state.events.map(event => event.coordinateStatus));
    populateSelect('verificationFilter', state.events.map(event => event.verification));
  }

  function groupByDate(events) {
    const map = new Map();
    events.forEach(event => { if (!map.has(event.date)) map.set(event.date, []); map.get(event.date).push(event); });
    for (const [key, rows] of map) map.set(key, ranked(rows));
    return map;
  }

  function visualClass(event) {
    if (isTop(event)) return 'major';
    if (['parade', 'march', 'street'].includes(event.group)) return 'street';
    if (event.group === 'virtual') return 'virtual';
    return 'standard';
  }

  function calendarEvent(event) {
    const box = el('span', `calendar-event ${visualClass(event)}`);
    box.append(el('span', 'calendar-event-title', `${event.start || 'Time TBA'} · ${event.title}`));
    box.append(el('span', 'calendar-event-meta', `${event.borough || 'Borough TBA'} · ${event.eventType || 'Event'}`));
    return box;
  }

  function renderMonth() {
    const events = filtered();
    const grouped = groupByDate(events);
    const month = currentMonth();
    const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
    const monthEvents = events.filter(event => event.date.startsWith(prefix));
    $('monthTitle').textContent = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    $('monthSummary').textContent = `${monthEvents.length.toLocaleString()} events · ${monthEvents.filter(isTop).length.toLocaleString()} top assignments · ${monthEvents.filter(event => ['parade','march','street'].includes(event.group)).length.toLocaleString()} parade/street · ${monthEvents.filter(event => event.group === 'virtual').length.toLocaleString()} virtual`;
    const root = $('calendarMonth'); root.replaceChildren();
    const weekdays = el('div', 'weekday-row');
    ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].forEach(day => weekdays.append(el('div', 'weekday', day)));
    root.append(weekdays);
    const grid = el('div', 'month-grid');
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const cursor = new Date(first); cursor.setDate(cursor.getDate() - first.getDay());
    const end = new Date(last); end.setDate(end.getDate() + (6 - last.getDay()));
    const today = dateKey(new Date());
    while (cursor <= end) {
      const key = dateKey(cursor); const rows = grouped.get(key) || [];
      const button = el('button', 'day-cell'); button.type = 'button'; button.dataset.date = key;
      if (cursor.getMonth() !== month.getMonth()) button.classList.add('other-month');
      if (key === today) button.classList.add('today');
      if (key === state.selectedDate) button.classList.add('selected');
      button.setAttribute('aria-label', `${dateLabel(key)}: ${rows.length} events`);
      const top = el('div', 'day-top'); const wrap = el('span', 'date-number-wrap');
      wrap.append(el('span', 'day-number', cursor.getDate()));
      if (cursor.getMonth() !== month.getMonth()) wrap.append(el('span', 'day-month', cursor.toLocaleDateString('en-US', { month: 'short' })));
      top.append(wrap, el('span', 'event-count', `${rows.length} event${rows.length === 1 ? '' : 's'}`)); button.append(top);
      rows.slice(0, 4).forEach(event => button.append(calendarEvent(event)));
      if (rows.length > 4) button.append(el('span', 'more-label', `+ ${rows.length - 4} more`));
      button.addEventListener('click', () => { state.selectedDate = key; renderAll(); $('dailyEvents').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      grid.append(button); cursor.setDate(cursor.getDate() + 1);
    }
    root.append(grid);
    renderMetrics(monthEvents);
  }

  function badge(value, className = '') { return el('span', `badge ${className}`, value); }

  function eventCard(event, rank) {
    const article = el('article', `event-card ${visualClass(event)}`);
    const header = el('div', 'event-card-header'); const title = el('div');
    title.append(el('h4', '', event.title)); const badges = el('div', 'event-badges');
    if (rank) badges.append(badge(`Top #${rank}`, 'rank'));
    badges.append(badge(event.borough || 'Borough TBA'), badge(event.eventType || 'Event'), badge(event.sourceFeed));
    title.append(badges); header.append(title, el('span', 'review-label', state.reviewed.has(event.id) ? 'Reviewed' : 'Not reviewed')); article.append(header);
    const meta = el('div', 'event-meta');
    const fields = [
      ['Date', dateLabel(event.date)], ['Time', timeRange(event)], ['Borough', event.borough || 'Missing'], ['Location', event.location || 'Missing'],
      ['Event type', event.eventType], ['Category', event.category], ['Assignment score', Math.round(assignmentScore(event))], ['Major reason', event.majorReason || '—'],
      ['Verification', event.verification || 'Not listed'], ['Coordinate status', event.coordinateStatus || 'Not listed'], ['Source feed', event.sourceFeed],
      ['Source dataset', event.sourceDataset || 'Not listed'], ['Source event ID', event.sourceEventId || 'Not listed']
    ];
    fields.forEach(([label, value]) => { const row = el('div'); row.innerHTML = `<strong>${esc(label)}:</strong> ${esc(value)}`; meta.append(row); });
    article.append(meta);
    const actions = el('div', 'event-actions');
    if (event.sourceUrl) { const link = el('a', '', 'Open source'); link.href = event.sourceUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; actions.append(link); }
    if (event.latitude != null && event.longitude != null) { const link = el('a', '', 'Open Google Maps'); link.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.latitude},${event.longitude}`)}`; link.target = '_blank'; link.rel = 'noopener noreferrer'; actions.append(link); }
    const review = el('button', '', state.reviewed.has(event.id) ? 'Reviewed in this browser' : 'Mark reviewed'); review.type = 'button'; review.disabled = state.reviewed.has(event.id);
    review.addEventListener('click', () => { state.reviewed.add(event.id); saveReviewed(); renderDay(); }); actions.append(review); article.append(actions);
    return article;
  }

  function section(title, events, rankedSection = false) {
    if (!events.length) return null;
    const block = el('section', 'desk-section'); const heading = el('div', 'desk-section-heading');
    heading.append(el('h3', '', title), el('span', '', `${events.length} event${events.length === 1 ? '' : 's'}`)); block.append(heading);
    const list = el('div', 'event-list'); events.forEach((event, index) => list.append(eventCard(event, rankedSection ? index + 1 : 0))); block.append(list); return block;
  }

  function dailySections(events) {
    const remaining = ranked(events); const used = new Set();
    const take = predicate => remaining.filter(event => !used.has(event.id) && predicate(event)).map(event => (used.add(event.id), event));
    const top = take(isTop).slice(0, 8); top.forEach(event => used.add(event.id));
    return [
      ['Top Assignments', top, true],
      ['Parades, Marches, Rallies and Street Events', take(event => ['parade','march','street'].includes(event.group)), false],
      ['Virtual and Online Events', take(event => event.group === 'virtual'), false],
      ['Sports and Entertainment', take(event => event.group === 'sports'), false],
      ['Civic, Government and Community Events', take(event => event.group === 'civic'), false],
      ['Other Events', take(() => true), false]
    ];
  }

  function renderDay() {
    const root = $('dailyEvents'); root.replaceChildren();
    if (!state.selectedDate) { root.append(el('div', 'empty-state', 'Select a date to view assignments.')); return; }
    const rows = ranked(filtered().filter(event => event.date === state.selectedDate));
    $('dayLabel').textContent = dateLabel(state.selectedDate);
    $('daySummary').textContent = `${rows.length} matching event${rows.length === 1 ? '' : 's'} · ${rows.filter(isTop).length} top assignment${rows.filter(isTop).length === 1 ? '' : 's'}`;
    $('markAllReviewed').disabled = !rows.length;
    if (!rows.length) { root.append(el('div', 'empty-state', 'No assignments match the active filters for this date.')); return; }
    dailySections(rows).forEach(([title, events, rankedSection]) => { const block = section(title, events, rankedSection); if (block) root.append(block); });
  }

  function renderMetrics(monthEvents) {
    const metrics = [
      ['Mirrored', state.events.length], ['This month', monthEvents.length], ['Top', monthEvents.filter(isTop).length],
      ['Virtual', monthEvents.filter(event => event.group === 'virtual').length], ['List-only', monthEvents.filter(event => !event.mapReady).length],
      ['Pages', state.diagnostics ? `${state.diagnostics.approvedPagesLoaded}/${state.diagnostics.approvedPageCount}` : '—']
    ];
    const root = $('statusMetrics'); root.hidden = false; root.replaceChildren();
    metrics.forEach(([label, value]) => { const item = el('div', 'metric'); item.append(el('strong', '', typeof value === 'number' ? value.toLocaleString() : value), el('span', '', label)); root.append(item); });
  }

  function renderMirrorStatus() {
    if (!state.diagnostics) return;
    const d = state.diagnostics; const fields = [
      ['Active feed branch', d.branch], ['Feed root', d.feedRoot], ['Major feed URL used', d.majorFeedUrl || 'None'], ['Major fallback used', d.majorFallbackUsed || 'No'],
      ['Approved manifest URL', d.approvedManifestUrl], ['Approved page count', d.approvedPageCount], ['Approved pages loaded', d.approvedPagesLoaded], ['Approved pages failed', d.approvedPagesFailed],
      ['Major event count', d.majorEventCount], ['Approved event count', d.approvedEventCount], ['Deduplicated total', d.deduplicatedTotal || state.events.length],
      ['Events with valid dates', d.eventsWithValidDates || state.events.filter(event => event.date).length], ['Events without valid dates', d.eventsWithoutValidDates || 0],
      ['Map-ready events', d.mapReadyEvents || state.events.filter(event => event.mapReady).length], ['Non-map-ready calendar events', d.nonMapReadyEvents || state.events.filter(event => !event.mapReady).length],
      ['Virtual-event count', d.virtualEvents || state.events.filter(event => event.group === 'virtual').length], ['Last successful refresh', d.lastSuccessfulRefresh ? new Date(d.lastSuccessfulRefresh).toLocaleString() : 'Not completed']
    ];
    const root = $('mirrorStatus'); root.replaceChildren(); fields.forEach(([label, value]) => { const row = el('div', 'mirror-field'); row.append(el('strong', '', label), el('span', '', String(value ?? '—'))); root.append(row); });
    const warnings = $('mirrorWarnings'); warnings.hidden = !d.warnings?.length; warnings.innerHTML = d.warnings?.length ? `<strong>Partial-load warnings</strong><ul>${d.warnings.slice(-20).map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : '';
    if (debug) { $('debugPanel').hidden = false; $('debugReport').textContent = JSON.stringify({ configuration: loader.configuration(), diagnostics: d, duplicateIds: d.duplicates, invalidDateRecords: d.invalidDates, recordsLackingCoordinates: state.events.filter(event => !event.mapReady).map(event => event.id), normalizationErrors: d.normalizationErrors }, null, 2); }
  }

  function renderAll() { renderMonth(); renderDay(); renderMirrorStatus(); }

  function readFilters() {
    state.filters = {
      q: $('searchFilter').value.trim().toLowerCase(), borough: $('boroughFilter').value, eventType: $('eventTypeFilter').value,
      category: $('categoryFilter').value, group: $('groupFilter').value, coordinate: $('coordinateFilter').value,
      verification: $('verificationFilter').value, source: $('feedSourceFilter').value, major: $('majorOnly').checked, photo: $('photoOnly').checked
    };
    renderAll();
  }

  function updateProgress(payload) {
    if (!payload?.diagnostics) return;
    state.diagnostics = payload.diagnostics;
    const d = payload.diagnostics; const progress = $('loadProgress');
    progress.hidden = false; progress.max = Math.max(1, d.approvedPageCount || 1); progress.value = d.approvedPagesLoaded || 0;
    $('loadStatus').textContent = payload.phase === 'major-loading' ? 'Loading top assignments…'
      : payload.phase === 'approved-progress' ? `Mirroring approved pages ${d.approvedPagesLoaded}/${d.approvedPageCount}…`
      : payload.phase === 'partial' ? `Mirror loaded with warnings: ${payload.events.length.toLocaleString()} events.`
      : payload.phase === 'complete' ? `Data mirror complete: ${payload.events.length.toLocaleString()} events loaded.`
      : payload.phase === 'error' ? 'The NYCIF event mirror could not be loaded.'
      : `Loaded ${payload.events.length.toLocaleString()} major assignments; indexing all approved pages…`;
    if (payload.events && (payload.phase !== 'approved-progress' || d.approvedPagesLoaded % 4 === 0 || d.approvedPagesLoaded === d.approvedPageCount)) {
      state.events = payload.events; populateFilters(); renderAll();
    } else renderMirrorStatus();
  }

  async function load() {
    if (!loader) { $('loadStatus').textContent = 'The shared NYCIF feed loader is unavailable.'; return; }
    if (state.aborter) state.aborter.abort(); state.aborter = new AbortController(); const token = ++state.loadToken;
    $('refreshData').disabled = true; $('loadProgress').hidden = false; $('loadStatus').textContent = 'Starting the NYCIF data mirror…';
    try {
      const result = await loader.loadMirror({ signal: state.aborter.signal, onProgress: updateProgress });
      if (token !== state.loadToken) return;
      state.events = result.events; state.diagnostics = result.diagnostics; populateFilters(); renderAll();
      if (!state.selectedDate) state.selectedDate = dateKey(new Date());
      $('loadStatus').textContent = result.diagnostics.fatal ? 'The NYCIF event mirror could not be loaded.' : `${result.diagnostics.partial ? 'Partial mirror' : 'Data mirror complete'}: ${result.events.length.toLocaleString()} deduplicated events.`;
    } catch (error) {
      if (error.name !== 'AbortError') $('loadStatus').textContent = `Mirror load failed: ${error.message}`;
    } finally {
      if (token === state.loadToken) $('refreshData').disabled = false;
    }
  }

  function clearFilters() {
    ['searchFilter','boroughFilter','eventTypeFilter','categoryFilter','groupFilter','coordinateFilter','verificationFilter','feedSourceFilter'].forEach(id => $(id).value = '');
    $('majorOnly').checked = false; $('photoOnly').checked = false; readFilters();
  }

  function bind() {
    $('previousMonth').addEventListener('click', () => { state.monthOffset -= 1; renderAll(); });
    $('todayMonth').addEventListener('click', () => { state.monthOffset = 0; state.selectedDate = dateKey(new Date()); renderAll(); });
    $('nextMonth').addEventListener('click', () => { state.monthOffset += 1; renderAll(); });
    $('refreshData').addEventListener('click', load); $('clearFilters').addEventListener('click', clearFilters);
    ['searchFilter','boroughFilter','eventTypeFilter','categoryFilter','groupFilter','coordinateFilter','verificationFilter','feedSourceFilter','majorOnly','photoOnly'].forEach(id => $(id).addEventListener(id === 'searchFilter' ? 'input' : 'change', readFilters));
    $('markAllReviewed').addEventListener('click', () => { filtered().filter(event => event.date === state.selectedDate).forEach(event => state.reviewed.add(event.id)); saveReviewed(); renderDay(); });
  }

  state.selectedDate = dateKey(new Date()); bind(); renderAll(); load();
})();
