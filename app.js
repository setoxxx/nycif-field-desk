const VERSION = '0.2.0';
const NYC_CENTER = [40.7128, -74.0060];

const FEEDS = {
  major: 'https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/nycif_major_radar_map_events.json',
  full: 'https://raw.githubusercontent.com/setoxxx/nycif-live-feeds/main/nycif_all_radar_map_events.json'
};

const BOROUGHS = ['All', 'Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];

const state = {
  feed: 'major',
  events: [],
  fullLoaded: false,
  search: '',
  borough: 'all',
  sort: 'priority',
  dateMode: 'today',
  userLocation: null,
  categories: {
    sports: true,
    parade: true,
    market: true,
    arts: true,
    parks: false,
    general: false
  },
  majorOnly: false,
  photoOnly: false,
  nypdOnly: false,
  maxMarkers: 650
};

const els = {
  map: document.getElementById('map'),
  status: document.getElementById('status'),
  brandCount: document.getElementById('brandCount'),
  layersBtn: document.getElementById('layersBtn'),
  layersPanel: document.getElementById('layersPanel'),
  locateBtn: document.getElementById('locateBtn'),
  nearMeBtn: document.getElementById('nearMeBtn'),
  deskBtn: document.getElementById('deskBtn'),
  deskDrawer: document.getElementById('deskDrawer'),
  closeDeskBtn: document.getElementById('closeDeskBtn'),
  loadAllBtn: document.getElementById('loadAllBtn'),
  majorOnly: document.getElementById('majorOnly'),
  photoOnly: document.getElementById('photoOnly'),
  nypdOnly: document.getElementById('nypdOnly'),
  searchInput: document.getElementById('searchInput'),
  sortSelect: document.getElementById('sortSelect'),
  dateChips: document.getElementById('dateChips'),
  boroughs: document.getElementById('boroughs'),
  listMeta: document.getElementById('listMeta'),
  eventList: document.getElementById('eventList')
};

const map = L.map(els.map, {
  zoomControl: true,
  closePopupOnClick: false,
  tap: false
}).setView(NYC_CENTER, 11);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const markers = L.layerGroup().addTo(map);
let userMarker = null;
let userAccuracy = null;

function status(text) {
  els.status.textContent = text;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function normalize(value) {
  return String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function parseDate(value) {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t) : null;
}

function dateKey(date) {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayKey() {
  return dateKey(new Date());
}

function tomorrowKey() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return dateKey(d);
}

function isWeekendDate(date) {
  if (!date) return false;
  const day = date.getDay();
  return day === 0 || day === 6;
}

function timeLabel(date) {
  if (!date) return 'Time not listed';
  return date.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function isNYCoord(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= 40.4774 && lat <= 40.9176
    && lng >= -74.2591 && lng <= -73.7004;
}

function milesBetween(a, b) {
  if (!a || !b) return null;
  const R = 3958.8;
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function distanceLabel(event) {
  if (!state.userLocation) return '';
  const miles = milesBetween(state.userLocation, event);
  if (!Number.isFinite(miles)) return '';
  return miles < 0.1 ? 'nearby' : `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
}

function category(row) {
  const text = normalize([
    row.title, row.event_type, row.type, row.location, row.display_location, row.lane,
    row.nypd_notice, row.verification_status, row.icon
  ].join(' '));
  const icon = row.icon || '';

  if (icon === '🌈' || /pride/.test(text)) return { key: 'parade', emoji: '🌈', label: 'Pride / parade' };
  if (icon === '🚴' || /criterium|cycling|bike/.test(text)) return { key: 'sports', emoji: '🚴', label: 'Cycling / sports' };
  if (icon === '🏟️' || /world cup|fifa|fan zone|sport|soccer|race|marathon|run|walk|yankee|citi field/.test(text)) return { key: 'sports', emoji: icon || '🏟️', label: 'Sports / World Cup' };
  if (icon === '📣' || /parade|march|rally|vigil|ceremony|memorial|civic|street event|block party/.test(text)) return { key: 'parade', emoji: icon || '📣', label: 'Parade / civic' };
  if (icon === '🛍️' || /market|food|vendor|feast|fair|merchandise|pop[- ]?up/.test(text)) return { key: 'market', emoji: icon || '🛍️', label: 'Market / street fair' };
  if (icon === '🎭' || /music|concert|arts|dance|theater|theatre|film|production|performance|festival/.test(text)) return { key: 'arts', emoji: icon || '🎭', label: 'Arts / production' };
  if (icon === '🌳' || /park|family|kids|children|beach|garden|nature/.test(text)) return { key: 'parks', emoji: icon || '🌳', label: 'Parks / family' };
  return { key: 'general', emoji: icon || '📍', label: 'General event' };
}

function isNypd(event) {
  return event.verification_status === 'nypd_field_intel'
    || /nypd/i.test(event.source_file || '')
    || event._manual_priority === 'NYPD'
    || /NYPD Field Intel/i.test(event.title || '');
}

function isPhotoPick(event) {
  if (event.photo_pick === true || event.photoPick === true) return true;
  const text = event.searchText;
  return /world cup|fan zone|pride|parade|march|street fair|festival|market|rally|vigil|ceremony|waterfront|dumbo|rockefeller|hudson yards|citi field|yankee|criterium/.test(text);
}

function priority(event) {
  let score = Number.parseInt(event.expected_crowd_score || event.priority_score || 0, 10) || 0;
  if (isNypd(event)) score += 1000;
  if (event.photoPick) score += 250;
  if (event.crowd_level === 'very_high') score += 400;
  if (event.crowd_level === 'high') score += 260;
  if (event.crowd_level === 'medium_high') score += 160;
  if (event.category.key === 'parade') score += 75;
  if (event.category.key === 'market') score += 45;
  return score;
}

function crowdLabel(event) {
  const level = event.crowd_level || '';
  const reason = event.major_reason || '';
  if (!level && !reason) return '';
  const clean = level.replace('_', ' ');
  return [clean, reason].filter(Boolean).join(' — ');
}

function makeEvent(row, index) {
  const lat = Number.parseFloat(row.lat);
  const lng = Number.parseFloat(row.lng);
  if (!isNYCoord(lat, lng)) return null;

  const cat = category(row);
  const start = parseDate(row.start_date_time || row.start || row.date);
  const title = row.title || row.name || 'Untitled event';
  const location = row.display_location || row.location || row.address || '';
  const event = {
    ...row,
    id: String(row.id || `event-${index}`),
    title,
    location,
    borough: row.borough || '',
    type: row.event_type || row.type || '',
    lat,
    lng,
    start,
    dateKey: dateKey(start) || (row.date || row.start_date_time || '').slice(0, 10),
    category: cat,
    searchText: normalize([
      title, location, row.borough, row.event_type, row.type, row.lane,
      row.nypd_notice, row.verification_status, row.source_file, row.major_reason,
      row.crowd_level
    ].join(' '))
  };

  event.photoPick = isPhotoPick(event);
  event.priority = priority(event);
  event.marker = makeMarker(event);

  return event;
}

function popupHtml(event) {
  const source = isNypd(event) ? 'NYPD Field Intel' : (event.assignment_feed === 'major' ? 'Major Assignment Feed' : 'NYCIF Live Feed');
  const crowd = crowdLabel(event);
  const nypd = event.nypd_notice || '';
  const sourceUrl = event.source_url || event.url || event.event_url || '';
  const distance = distanceLabel(event);

  return `
    <article class="popup-card">
      <div class="popup-source ${isNypd(event) ? 'is-nypd' : ''}">${esc(source)}</div>
      <div class="popup-category"><span>${esc(event.category.emoji)}</span> ${esc(event.category.label)}</div>
      <h2>${esc(event.title)}</h2>
      ${isNypd(event) ? '<div class="popup-priority">High-priority field item</div>' : ''}
      <dl>
        <div><dt>Time</dt><dd>${esc(timeLabel(event.start))}</dd></div>
        ${distance ? `<div><dt>Distance</dt><dd>${esc(distance)}</dd></div>` : ''}
        ${event.borough ? `<div><dt>Borough</dt><dd>${esc(event.borough)}</dd></div>` : ''}
        ${event.location ? `<div><dt>Location</dt><dd>${esc(event.location)}</dd></div>` : ''}
        ${crowd ? `<div><dt>Assignment read</dt><dd>${esc(crowd)}</dd></div>` : ''}
      </dl>
      ${event.photoPick ? `<div class="popup-photo">📸 Camera-friendly assignment</div>` : ''}
      ${nypd ? `<div class="popup-nypd"><b>NYPD Field Intel:</b> ${esc(nypd)}</div>` : ''}
      ${sourceUrl ? `<a class="popup-link" target="_blank" rel="noopener" href="${esc(sourceUrl)}">Source</a>` : ''}
    </article>
  `;
}

function makeMarker(event) {
  const classes = [
    'marker',
    `marker--${event.category.key}`,
    event.photoPick ? 'marker--photo' : '',
    isNypd(event) ? 'marker--nypd' : '',
    event.crowd_level ? `marker--${event.crowd_level}` : ''
  ].filter(Boolean).join(' ');

  const marker = L.marker([event.lat, event.lng], {
    icon: L.divIcon({
      className: 'marker-shell',
      html: `<span class="${classes}"><span class="emoji">${event.category.emoji}</span></span>`,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
      popupAnchor: [0, -24]
    }),
    title: event.title,
    alt: event.title,
    riseOnHover: true,
    bubblingMouseEvents: false
  }).bindPopup(popupHtml(event), {
    maxWidth: 320,
    minWidth: 230,
    autoPan: true,
    keepInView: true,
    closeButton: true,
    autoClose: false,
    closeOnClick: false,
    closeOnEscapeKey: false
  });

  marker.on('click tap', ev => {
    if (ev?.originalEvent) {
      L.DomEvent.preventDefault(ev.originalEvent);
      L.DomEvent.stop(ev.originalEvent);
    }
    marker.setPopupContent(popupHtml(event));
    marker.openPopup();
  });

  marker.on('popupopen', ev => {
    const el = ev?.popup?.getElement?.();
    if (!el) return;
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
  });

  return marker;
}

function dateMatches(event) {
  if (state.dateMode === 'all') return true;
  if (!event.dateKey) return false;
  if (state.dateMode === 'today') return event.dateKey === todayKey();
  if (state.dateMode === 'tomorrow') return event.dateKey === tomorrowKey();
  if (state.dateMode === 'weekend') return isWeekendDate(event.start);
  return true;
}

function eventMatches(event) {
  if (!dateMatches(event)) return false;
  if (!state.categories[event.category.key]) return false;
  if (state.majorOnly && !(event.assignment_feed === 'major' || event.field_default || event.photoPick || isNypd(event))) return false;
  if (state.photoOnly && !event.photoPick) return false;
  if (state.nypdOnly && !isNypd(event)) return false;
  if (state.borough !== 'all' && event.borough !== state.borough) return false;
  if (state.search && !event.searchText.includes(state.search)) return false;
  return true;
}

function sortEvents(a, b) {
  if (state.sort === 'near') {
    const da = milesBetween(state.userLocation, a) ?? 999999;
    const db = milesBetween(state.userLocation, b) ?? 999999;
    return da - db || b.priority - a.priority;
  }
  if (state.sort === 'borough') return (a.borough || 'zz').localeCompare(b.borough || 'zz') || b.priority - a.priority;
  if (state.sort === 'type') return (a.type || 'zz').localeCompare(b.type || 'zz') || b.priority - a.priority;
  if (state.sort === 'time') return (a.start?.getTime() || 9999999999999) - (b.start?.getTime() || 9999999999999);
  return b.priority - a.priority || ((a.start?.getTime() || 9999999999999) - (b.start?.getTime() || 9999999999999));
}

function updateChrome(visible) {
  const nypdCount = visible.filter(isNypd).length;
  const photoCount = visible.filter(e => e.photoPick).length;
  const nearNote = state.userLocation && state.sort === 'near' ? ' · near me' : '';
  if (els.brandCount) {
    els.brandCount.textContent = `${visible.length} live${nypdCount ? ` · ${nypdCount} NYPD` : ''}${photoCount ? ` · ${photoCount} photo` : ''}`;
  }
  status(`${visible.length} assignment${visible.length === 1 ? '' : 's'} · ${state.feed === 'major' ? 'Fast major feed' : 'Full feed'}${nearNote} · v${VERSION}`);
}

function render() {
  markers.clearLayers();

  const visible = state.events.filter(eventMatches).sort(sortEvents);
  const draw = visible.slice(0, state.maxMarkers);

  draw.forEach(event => markers.addLayer(event.marker));

  const photoCount = visible.filter(e => e.photoPick).length;
  const nypdCount = visible.filter(isNypd).length;
  const nearMode = state.userLocation && state.sort === 'near';
  els.listMeta.textContent = `${draw.length < visible.length ? `${draw.length} shown of ${visible.length}` : `${visible.length} visible`} assignments · ${photoCount} photo picks · ${nypdCount} NYPD${nearMode ? ' · sorted near you' : ''}`;

  els.eventList.innerHTML = visible.slice(0, 60).map(event => {
    const distance = distanceLabel(event);
    return `
      <button type="button" class="event-item" data-id="${esc(event.id)}">
        <span class="item-top">
          <span class="item-source">${esc(event.category.emoji)} ${esc(event.category.label)}</span>
          <span class="item-tags">
            ${distance ? `<span class="item-tag near">${esc(distance)}</span>` : ''}
            ${event.photoPick ? '<span class="item-tag">📸</span>' : ''}
            ${isNypd(event) ? '<span class="item-tag danger">NYPD</span>' : ''}
          </span>
        </span>
        <strong>${esc(event.title)}</strong>
        <span>${esc(timeLabel(event.start))}</span>
        <small>${esc([event.borough, event.location, crowdLabel(event)].filter(Boolean).join(' • '))}</small>
      </button>
    `;
  }).join('') || '<div class="empty">No assignments match this view.</div>';

  els.eventList.querySelectorAll('[data-id]').forEach(button => {
    button.addEventListener('click', () => {
      const event = state.events.find(e => e.id === button.dataset.id);
      if (!event) return;
      map.flyTo([event.lat, event.lng], Math.max(map.getZoom(), 15), { duration: 0.55 });
      setTimeout(() => {
        event.marker.setPopupContent(popupHtml(event));
        event.marker.openPopup();
      }, 420);
      setDesk(false);
    });
  });

  updateChrome(visible);
  return visible;
}

async function loadFeed(kind) {
  const url = FEEDS[kind];
  status(`Loading ${kind === 'major' ? 'major field assignments' : 'full event database'}…`);

  const response = await fetch(`${url}?cache=${Date.now()}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${kind} feed HTTP ${response.status}`);

  const json = await response.json();
  const rows = Array.isArray(json) ? json : (json.events || []);
  const events = rows.map(makeEvent).filter(Boolean);

  if (kind === 'major') {
    state.events = events;
    state.feed = 'major';
  } else {
    const existing = new Map(state.events.map(e => [e.id, e]));
    events.forEach(event => existing.set(event.id, event));
    state.events = [...existing.values()];
    state.feed = 'full';
    state.fullLoaded = true;
  }

  const visible = render();
  if (visible.length) {
    const bounds = visible.slice(0, 200).map(e => [e.lat, e.lng]);
    map.fitBounds(bounds, { padding: [44, 44], maxZoom: 12 });
  }
  setTimeout(() => map.invalidateSize(), 120);
}

function setLayers(open) {
  els.layersPanel.hidden = !open;
  els.layersBtn.setAttribute('aria-expanded', String(open));
  setTimeout(() => map.invalidateSize(), 100);
}

function setDesk(open) {
  els.deskDrawer.hidden = !open;
  els.deskBtn.setAttribute('aria-expanded', String(open));
  setTimeout(() => map.invalidateSize(), 100);
}

function buildBoroughs() {
  els.boroughs.innerHTML = BOROUGHS.map(b => {
    const value = b === 'All' ? 'all' : b;
    return `<button type="button" class="${state.borough === value ? 'active' : ''}" data-borough="${esc(value)}">${esc(b)}</button>`;
  }).join('');

  els.boroughs.addEventListener('click', ev => {
    const button = ev.target.closest('[data-borough]');
    if (!button) return;
    state.borough = button.dataset.borough;
    els.boroughs.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === button));
    render();
  });
}

function buildDateChips() {
  if (!els.dateChips) return;
  els.dateChips.querySelectorAll('[data-date-mode]').forEach(button => {
    button.classList.toggle('active', button.dataset.dateMode === state.dateMode);
  });
  els.dateChips.addEventListener('click', ev => {
    const button = ev.target.closest('[data-date-mode]');
    if (!button) return;
    state.dateMode = button.dataset.dateMode;
    els.dateChips.querySelectorAll('[data-date-mode]').forEach(b => b.classList.toggle('active', b === button));
    render();
  });
}

function setUserLocation(latitude, longitude, accuracy) {
  const here = [latitude, longitude];
  state.userLocation = { lat: latitude, lng: longitude };

  if (userMarker) {
    userMarker.setLatLng(here);
  } else {
    const icon = L.divIcon({
      className: 'user-location-shell',
      html: '<span class="user-location">🗽</span>',
      iconSize: [36, 44],
      iconAnchor: [18, 42],
      popupAnchor: [0, -38]
    });
    userMarker = L.marker(here, { icon, zIndexOffset: 4000 }).addTo(map).bindPopup(`<strong>You are here</strong><br>Accuracy: ${Math.round(accuracy || 0)} meters`);
  }

  if (userAccuracy) {
    userAccuracy.setLatLng(here);
    userAccuracy.setRadius(accuracy || 0);
  } else {
    userAccuracy = L.circle(here, {
      radius: accuracy || 0,
      color: '#d40000',
      weight: 2,
      fillColor: '#d40000',
      fillOpacity: 0.08
    }).addTo(map);
  }
}

function locateUser(options = {}) {
  if (!navigator.geolocation) {
    status('Location is not available in this browser.');
    return;
  }

  status('Finding your location…');

  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude, longitude, accuracy } = pos.coords;
    setUserLocation(latitude, longitude, accuracy);

    if (options.sortNear) {
      state.sort = 'near';
      els.sortSelect.value = 'near';
    }

    map.flyTo([latitude, longitude], Math.max(map.getZoom(), 14), { duration: 0.6 });
    userMarker.openPopup();
    render();
    status(options.sortNear ? 'Sorted assignments near you.' : 'Location updated.');
  }, err => {
    status(`Location failed: ${err.message}`);
  }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 });
}

function bindUi() {
  els.layersBtn.addEventListener('click', () => setLayers(els.layersPanel.hidden));
  els.deskBtn.addEventListener('click', () => setDesk(els.deskDrawer.hidden));
  els.closeDeskBtn.addEventListener('click', () => setDesk(false));
  els.locateBtn.addEventListener('click', () => locateUser());
  els.nearMeBtn.addEventListener('click', () => locateUser({ sortNear: true }));

  els.loadAllBtn.addEventListener('click', async () => {
    if (state.fullLoaded) {
      status('Full feed already loaded.');
      return;
    }
    els.loadAllBtn.disabled = true;
    els.loadAllBtn.textContent = 'Loading all events…';
    try {
      await loadFeed('full');
      els.loadAllBtn.textContent = 'All events loaded';
    } catch (error) {
      els.loadAllBtn.disabled = false;
      els.loadAllBtn.textContent = 'Load all events';
      status(`Full feed failed: ${error.message}`);
    }
  });

  els.majorOnly.addEventListener('change', () => {
    state.majorOnly = els.majorOnly.checked;
    render();
  });
  els.photoOnly.addEventListener('change', () => {
    state.photoOnly = els.photoOnly.checked;
    render();
  });
  els.nypdOnly.addEventListener('change', () => {
    state.nypdOnly = els.nypdOnly.checked;
    render();
  });
  document.querySelectorAll('[data-cat]').forEach(input => {
    input.addEventListener('change', () => {
      state.categories[input.dataset.cat] = input.checked;
      render();
    });
  });
  els.searchInput.addEventListener('input', () => {
    state.search = normalize(els.searchInput.value);
    render();
  });
  els.sortSelect.addEventListener('change', () => {
    state.sort = els.sortSelect.value;
    if (state.sort === 'near' && !state.userLocation) {
      locateUser({ sortNear: true });
      return;
    }
    render();
  });

  map.on('click tap', ev => {
    if (ev?.originalEvent) L.DomEvent.stopPropagation(ev.originalEvent);
  });
}

async function boot() {
  bindUi();
  buildBoroughs();
  buildDateChips();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }

  try {
    await loadFeed('major');
  } catch (error) {
    status(`Major feed failed: ${error.message}`);
  }
}

boot();
