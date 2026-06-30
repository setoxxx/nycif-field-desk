(() => {
  const VERSION = 'nightlife-layer-v01';
  const ENDPOINT = 'https://data.cityofnewyork.us/resource/hdtn-j62g.json';
  const FETCH_LIMIT = 50000;
  const SOURCE_LABEL = 'NYC Open Data';

  const GROUP_ONE = [
    { key: 'bar_tavern', label: 'Bars / taverns', terms: ['bar', 'tavern', 'pub', 'sports bar'] },
    { key: 'lounge_club', label: 'Lounges / clubs', terms: ['lounge', 'nightclub', 'night club', 'club', 'cabaret', 'dance club', 'dance hall'] },
    { key: 'music_stage', label: 'Music / comedy / karaoke', terms: ['karaoke', 'comedy club', 'live music', 'music venue'] },
    { key: 'beer_wine', label: 'Beer / wine gathering spots', terms: ['beer garden', 'wine bar', 'brewery', 'taproom', 'microbrewery', 'micro brewer'] },
    { key: 'liquor_onprem', label: 'On-premises liquor', terms: ['on-premises liquor', 'on premises liquor', 'on premise liquor', 'tavern wine', 'club liquor', 'cabaret liquor', 'restaurant brewer'] },
    { key: 'hookah_billiards', label: 'Hookah / billiards', terms: ['hookah', 'billiards', 'pool hall'] }
  ];

  const GROUP_TWO = [
    { key: 'restaurant_nightlife', label: 'Restaurants with nightlife potential', terms: ['restaurant', 'restaurant wine', 'eating place beer', 'cafe', 'café', 'rooftop restaurant'] },
    { key: 'hotel_event', label: 'Hotel / event spaces', terms: ['hotel liquor', 'hotel', 'event space', 'banquet hall', 'catering establishment', 'caterer'] },
    { key: 'social_private', label: 'Social / private clubs', terms: ['private club', 'social club', 'fraternal', 'members club'] },
    { key: 'entertainment', label: 'Entertainment venues', terms: ['theater', 'theatre', 'bowling alley', 'arcade'] }
  ];

  const EXCLUDE_TERMS = [
    'liquor store', 'wine store', 'package store', 'grocery store', 'drug store', 'supermarket',
    'wholesale', 'wholesaler', 'distributor', 'importer', 'manufacturer', 'warehouse',
    'temporary permit', 'special event permit', 'one-day permit', 'one day permit', 'farm winery',
    'off-premises', 'off premises', 'off premise'
  ];

  const state = {
    map: null,
    layer: null,
    rows: [],
    spots: [],
    loaded: false,
    loading: false,
    enabled: false,
    stats: null
  };

  function clean(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function norm(value) {
    return clean(value).toLowerCase();
  }

  function esc(value) {
    return clean(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function allText(row) {
    return Object.entries(row || {})
      .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
      .map(([key, value]) => `${key} ${value}`)
      .join(' ')
      .toLowerCase();
  }

  function field(row, names) {
    const keys = Object.keys(row || {});
    for (const wanted of names) {
      const direct = row[wanted];
      if (direct !== undefined && clean(direct)) return clean(direct);
      const hit = keys.find(key => norm(key) === norm(wanted) || norm(key).includes(norm(wanted)));
      if (hit && clean(row[hit])) return clean(row[hit]);
    }
    return '';
  }

  function numberFrom(value) {
    if (value === null || value === undefined) return NaN;
    if (typeof value === 'number') return value;
    const parsed = Number.parseFloat(String(value).replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  function coordsFrom(row) {
    const directLat = field(row, ['latitude', 'lat', 'y']);
    const directLng = field(row, ['longitude', 'lng', 'lon', 'long', 'x']);
    let lat = numberFrom(directLat);
    let lng = numberFrom(directLng);

    const locationKeys = ['location', 'the_geom', 'geocoded_column', 'geocoded_location'];
    for (const key of locationKeys) {
      const value = row?.[key];
      if (!value) continue;
      if (typeof value === 'object') {
        if (!Number.isFinite(lat)) lat = numberFrom(value.latitude || value.lat);
        if (!Number.isFinite(lng)) lng = numberFrom(value.longitude || value.lon || value.lng);
        if (Array.isArray(value.coordinates) && value.coordinates.length >= 2) {
          const a = numberFrom(value.coordinates[0]);
          const b = numberFrom(value.coordinates[1]);
          if (Math.abs(a) > Math.abs(b)) { lng = a; lat = b; }
          else { lat = a; lng = b; }
        }
      }
    }

    if (isNYCoord(lat, lng)) return { lat, lng };
    return null;
  }

  function isNYCoord(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 40.4774 && lat <= 40.9176 && lng >= -74.2591 && lng <= -73.7004;
  }

  function ruleHit(text, rule) {
    return rule.terms.some(term => text.includes(term));
  }

  function matchCategory(row) {
    const text = allText(row);
    if (!text) return null;
    if (EXCLUDE_TERMS.some(term => text.includes(term))) return null;

    const groupOne = GROUP_ONE.find(rule => ruleHit(text, rule));
    if (groupOne) return { group: 1, ...groupOne };

    const groupTwo = GROUP_TWO.find(rule => ruleHit(text, rule));
    if (groupTwo) return { group: 2, ...groupTwo };

    return null;
  }

  function titleFrom(row) {
    return field(row, ['dba', 'trade_name', 'business_name', 'premises_name', 'premise_name', 'entity_name', 'licensee_name', 'name', 'corporation_name']) || 'Nightlife spot';
  }

  function addressFrom(row) {
    const address = field(row, ['address', 'premises_address', 'premise_address', 'street_address', 'location_address']);
    const city = field(row, ['city', 'premises_city', 'premise_city']);
    const zip = field(row, ['zip', 'zipcode', 'zip_code', 'premises_zip']);
    return [address, city, zip].filter(Boolean).join(', ');
  }

  function boroughFrom(row) {
    const raw = field(row, ['borough', 'boro', 'county']);
    const text = norm(raw);
    if (/new york|manhattan/.test(text)) return 'Manhattan';
    if (/kings|brooklyn/.test(text)) return 'Brooklyn';
    if (/queens/.test(text)) return 'Queens';
    if (/bronx/.test(text)) return 'Bronx';
    if (/richmond|staten/.test(text)) return 'Staten Island';
    return clean(raw);
  }

  function licenseText(row) {
    return field(row, ['license_type_name', 'license_type', 'license_class', 'license_class_code', 'license_category', 'license', 'type', 'category', 'industry']);
  }

  function normalizeSpot(row, index) {
    const match = matchCategory(row);
    if (!match) return null;
    const coords = coordsFrom(row);
    if (!coords) return null;
    const title = titleFrom(row);
    const address = addressFrom(row);
    const borough = boroughFrom(row);
    const license = licenseText(row);
    const sourceId = field(row, ['serial_number', 'license_number', 'record_id', 'id', 'objectid', 'license_id']) || `nightlife-${index}`;
    return {
      id: `nightlife-${sourceId}`,
      title,
      address,
      borough,
      license,
      lat: coords.lat,
      lng: coords.lng,
      group: match.group,
      subtype: match.key,
      subtypeLabel: match.label,
      source: SOURCE_LABEL,
      sourceUrl: ENDPOINT,
      raw: row
    };
  }

  function dedupe(spots) {
    const seen = new Set();
    return spots.filter(spot => {
      const key = [norm(spot.title), norm(spot.address), spot.lat.toFixed(5), spot.lng.toFixed(5)].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function injectStyles() {
    if (document.getElementById('nycif-nightlife-layer-styles')) return;
    const style = document.createElement('style');
    style.id = 'nycif-nightlife-layer-styles';
    style.textContent = `
      .nightlife-marker {
        display: grid;
        place-items: center;
        width: 30px;
        height: 30px;
        border-radius: 999px;
        background: #111827;
        color: #fff;
        border: 2px solid rgba(255,255,255,.92);
        box-shadow: 0 8px 22px rgba(0,0,0,.28);
        font-size: 16px;
      }
      .nightlife-marker.group-two {
        background: #4b5563;
      }
      .nightlife-popup {
        min-width: 220px;
        max-width: 280px;
        color: #111827;
        font: 500 12px/1.35 system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
      }
      .nightlife-popup .source {
        display: inline-flex;
        border-radius: 999px;
        padding: 3px 7px;
        background: rgba(17,24,39,.08);
        font-size: 10px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: .04em;
      }
      .nightlife-popup h2 {
        margin: 7px 0 5px;
        font-size: 15px;
        line-height: 1.15;
      }
      .nightlife-popup p {
        margin: 4px 0;
      }
      .nightlife-popup a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-top: 8px;
        min-height: 29px;
        padding: 0 10px;
        border-radius: 999px;
        background: #111827;
        color: #fff !important;
        text-decoration: none !important;
        font-weight: 900;
      }
      .nightlife-note {
        display: block;
        margin-top: 4px;
        color: #6b7280;
        font-size: 10px;
        line-height: 1.25;
      }
    `;
    document.head.appendChild(style);
  }

  function addFilterControl(attempt = 0) {
    const panel = document.getElementById('layersPanel');
    if (!panel) {
      if (attempt < 40) window.setTimeout(() => addFilterControl(attempt + 1), 250);
      return;
    }
    if (document.getElementById('nightlifeToggle')) return;

    const hr = document.createElement('hr');
    hr.className = 'nightlife-filter-break';
    const label = document.createElement('label');
    label.className = 'check nightlife-check';
    label.innerHTML = '<input type="checkbox" id="nightlifeToggle"> <span>🍸 5PM Spots</span>';
    const note = document.createElement('small');
    note.className = 'nightlife-note';
    note.textContent = 'Bars, clubs, lounges + nightlife-adjacent places from NYC Open Data.';
    panel.appendChild(hr);
    panel.appendChild(label);
    panel.appendChild(note);

    label.querySelector('input').addEventListener('change', event => {
      state.enabled = event.target.checked;
      if (state.enabled) enableLayer();
      else disableLayer();
    });
  }

  function status(text) {
    const el = document.getElementById('status');
    if (el) el.textContent = text;
  }

  function captureMap() {
    if (window.NYCIF_LEAFLET_MAP) {
      state.map = window.NYCIF_LEAFLET_MAP;
      return;
    }
    if (!window.L || !L.map || L.map.NYCIF_NIGHTLIFE_WRAPPED) return;
    const original = L.map.bind(L);
    function wrappedMap(...args) {
      const map = original(...args);
      window.NYCIF_LEAFLET_MAP = map;
      state.map = map;
      window.setTimeout(() => { if (state.enabled) enableLayer(); }, 250);
      return map;
    }
    wrappedMap.NYCIF_NIGHTLIFE_WRAPPED = true;
    L.map = wrappedMap;
  }

  async function fetchRows() {
    if (state.loaded || state.loading) return;
    state.loading = true;
    status('Loading 5PM nightlife spots from NYC Open Data...');
    const url = `${ENDPOINT}?$limit=${FETCH_LIMIT}`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const rows = await response.json();
      state.rows = Array.isArray(rows) ? rows : [];
      const spots = dedupe(state.rows.map(normalizeSpot).filter(Boolean));
      state.spots = spots;
      const groupOne = spots.filter(spot => spot.group === 1).length;
      const groupTwo = spots.filter(spot => spot.group === 2).length;
      state.stats = { rows: state.rows.length, spots: spots.length, groupOne, groupTwo };
      state.loaded = true;
      status(`5PM Spots loaded: ${spots.length.toLocaleString()} mapped places (${groupOne.toLocaleString()} strong, ${groupTwo.toLocaleString()} adjacent).`);
    } catch (error) {
      console.error('[NYCIF nightlife]', error);
      status(`5PM Spots failed to load: ${error.message || error}`);
    } finally {
      state.loading = false;
    }
  }

  function popupHtml(spot) {
    const apple = `https://maps.apple.com/?daddr=${spot.lat},${spot.lng}&q=${encodeURIComponent(spot.title)}`;
    const groupLabel = spot.group === 1 ? 'Strong nightlife match' : 'Nightlife-adjacent';
    return `<article class="nightlife-popup"><div class="source">🍸 ${esc(groupLabel)}</div><h2>${esc(spot.title)}</h2><p><strong>${esc(spot.subtypeLabel)}</strong></p>${spot.license ? `<p>${esc(spot.license)}</p>` : ''}${spot.address ? `<p>${esc(spot.address)}</p>` : ''}${spot.borough ? `<p>${esc(spot.borough)}</p>` : ''}<p><small>Source: ${esc(SOURCE_LABEL)}</small></p><a href="${apple}" target="_blank" rel="noopener">Directions</a></article>`;
  }

  function markerFor(spot) {
    const icon = L.divIcon({
      className: 'nightlife-marker-shell',
      html: `<div class="nightlife-marker ${spot.group === 2 ? 'group-two' : ''}" title="${esc(spot.title)}">🍸</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -15]
    });
    return L.marker([spot.lat, spot.lng], { icon, title: spot.title }).bindPopup(popupHtml(spot));
  }

  function drawLayer() {
    if (!state.map || !window.L || !state.enabled) return;
    if (!state.layer) state.layer = L.layerGroup();
    state.layer.clearLayers();
    state.spots.forEach(spot => state.layer.addLayer(markerFor(spot)));
    state.layer.addTo(state.map);
  }

  async function enableLayer() {
    captureMap();
    if (!state.map) {
      status('5PM Spots waiting for map...');
      window.setTimeout(enableLayer, 300);
      return;
    }
    await fetchRows();
    drawLayer();
  }

  function disableLayer() {
    if (state.layer) state.layer.remove();
    status('5PM Spots hidden.');
  }

  function boot() {
    injectStyles();
    captureMap();
    addFilterControl();
    window.NYCIF_NIGHTLIFE_LAYER = { version: VERSION, state, enableLayer, disableLayer };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
