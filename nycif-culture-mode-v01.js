/*
 * NYCIF Culture Mode — staging-only overlay plugin for the Field Desk map.
 *
 * Self-contained, additive: it attaches to the shared window.NYCIF_MAIN_MAP and
 * adds an optional "Culture" layer (culturally relevant licensed businesses,
 * neighborhood name labels, a universal pet layer, and clearly-UNVERIFIED
 * name-match pins). It NEVER modifies the events pipeline, the public feed URL,
 * or the base map. It is loaded only on the staging page (city-engine-culture.html),
 * not on the public index.html.
 *
 * Fail-closed: it reads a precomputed, validated Culture feed and refuses to show
 * anything unless the release gate passed and the feed shape checks out. Business
 * names never become classifications — name matches are shown as separate,
 * clearly-unverified pins.
 *
 * Feed source: public mirror of the pipeline's live-pull output, following the
 * repo's existing raw.githubusercontent pattern.
 */
(() => {
  'use strict';

  const FEED_BASE =
    'https://raw.githubusercontent.com/setoxxx/nycif-open-data/culture-map-preview/culture-feed';
  const RELEASE_URL = `${FEED_BASE}/culture-feed-release.json`;
  const FEED_URL = `${FEED_BASE}/culture-feed-current.json`;
  const SUPPORTED_CONTRACT = 'nycif.culture-feed.v1';
  const MAX_FEED_AGE_DAYS = 60;

  const BOROUGH_COLORS = {
    Manhattan: '#e8590c',
    Brooklyn: '#1971c2',
    Queens: '#c2255c',
    Bronx: '#2f9e44',
    'Staten Island': '#7048e8',
  };
  const STRENGTH_RANK = { strong: 3, moderate: 2, weak: 1 };

  const TAG_LABELS = {
    caribbean_food: 'Caribbean / West Indian food', west_indian_grocery: 'West Indian grocery',
    caribbean_bakery: 'Caribbean bakery', caribbean_music: 'Caribbean music', caribbean_salon: 'Afro-Caribbean beauty',
    pakistani_food: 'Pakistani food', south_asian_grocery: 'South Asian grocery', pakistani_clothing: 'Pakistani clothing',
    south_asian_jewelry: 'South Asian jewelry', south_asian_travel: 'South Asian travel', south_asian_food: 'South Asian / Indian food',
    kosher_food: 'Kosher food', kosher_grocery: 'Kosher grocery', judaica: 'Judaica', halal_food: 'Halal food', halal_grocery: 'Halal grocery',
    chinese_food: 'Chinese food', chinese_grocery: 'Chinese grocery', chinese_bakery: 'Chinese bakery',
    korean_food: 'Korean food', korean_grocery: 'Korean grocery', greek_food: 'Greek food', greek_grocery: 'Greek grocery',
    russian_ukrainian_food: 'Russian / Ukrainian food', russian_grocery: 'Russian grocery', ukrainian_food: 'Ukrainian food',
    levantine_arab_food: 'Levantine / Arab food', arab_grocery: 'Arab grocery', dominican_food: 'Dominican food', dominican_grocery: 'Dominican grocery',
    guyanese_food: 'Guyanese food', italian_food: 'Italian food', italian_grocery: 'Italian grocery', italian_bakery: 'Italian bakery',
    polish_food: 'Polish food', polish_grocery: 'Polish deli', filipino_food: 'Filipino food', filipino_grocery: 'Filipino grocery',
    west_african_food: 'West African food', west_african_grocery: 'West African grocery', mexican_food: 'Mexican food', mexican_grocery: 'Mexican grocery',
    bangladeshi_food: 'Bangladeshi food', bangladeshi_grocery: 'Bangladeshi grocery', sri_lankan_food: 'Sri Lankan food',
    thai_food: 'Thai food', thai_grocery: 'Thai grocery', turkish_food: 'Turkish food', bukharian_food: 'Bukharian food', bukharian_grocery: 'Bukharian grocery',
    albanian_food: 'Albanian food', himalayan_food: 'Himalayan food', indonesian_food: 'Indonesian food', brazilian_food: 'Brazilian food',
    latin_american_food: 'Latin American food', latin_american_grocery: 'Latin American grocery', haitian_food: 'Haitian food',
    taiwanese_food: 'Taiwanese food', soul_food: 'Soul food', irish_food: 'Irish food',
    cultural_clothing: 'Cultural clothing', cultural_sweets: 'Cultural sweets', cultural_music_media: 'Cultural music / media',
    cultural_beauty: 'Cultural hair / beauty', religious_goods: 'Religious goods', cultural_sporting_goods: 'Cultural sporting goods', cultural_books: 'Cultural books',
  };
  const tagLabel = (t) => TAG_LABELS[t] || t;
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const state = {
    feed: null, on: false, labels: [], layers: null, map: null, loaded: false, error: null,
    hiddenEventLayers: [], // event-environment overlays detached while Culture is on
    filterState: { business: true, universal: true, nameMatch: true, labels: true },
  };

  function loadJson(url) {
    return fetch(url, { cache: 'no-store' }).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    });
  }

  // Fail-closed validation (mirror of the pipeline's client checks).
  function validate(feed) {
    if (!feed || feed.contract !== SUPPORTED_CONTRACT) return 'unsupported_contract';
    if (!feed.manifest_digest) return 'missing_digest';
    if (!Array.isArray(feed.areas) || !Array.isArray(feed.businesses) || !Array.isArray(feed.matches)) return 'malformed';
    if (feed.generated_at) {
      const ageDays = (Date.now() - Date.parse(feed.generated_at)) / 86400000;
      if (Number.isFinite(ageDays) && ageDays > MAX_FEED_AGE_DAYS) return 'stale';
    }
    return 'ok';
  }

  function bestMatchAnywhere(feed, businessId) {
    const list = feed.matches.filter((m) => m.business_id === businessId)
      .sort((a, b) => b.relevance_score - a.relevance_score);
    return list[0] || null;
  }

  function ensureLayers() {
    if (state.layers) return;
    const L = window.L;
    state.layers = {
      business: L.layerGroup(),
      universal: L.layerGroup(),
      nameMatch: L.layerGroup(),
      labels: L.layerGroup(),
    };
  }

  function renderBusinesses(feed) {
    const L = window.L;
    state.layers.business.clearLayers();
    feed.businesses.forEach((b) => {
      if (!b.coordinates) return;
      const boroughGuess = Object.keys(BOROUGH_COLORS).find((k) =>
        (feed.areas.find((a) => a.area_id === (bestMatchAnywhere(feed, b.business_id) || {}).area_id) || {}).borough === k);
      const color = BOROUGH_COLORS[boroughGuess] || '#b3261e';
      const m = bestMatchAnywhere(feed, b.business_id);
      const verified = m && m.disposition === 'ACCEPTED';
      const tags = (b.cultural_tags || []).map(tagLabel).join(', ');
      L.circleMarker([b.coordinates.lat, b.coordinates.lng], {
        radius: 6, weight: 2, color: '#fff', fillColor: color, fillOpacity: 0.9,
      }).bindPopup(
        `<strong>${esc(b.business_name)}</strong><br>${esc(b.business_category || '')}<br>${esc(tags)}` +
        `<br><em>${verified ? 'Verified / confirmed' : 'Manually reviewed'}</em>`
      ).addTo(state.layers.business);
    });
  }

  function renderUniversal(feed) {
    const L = window.L;
    state.layers.universal.clearLayers();
    (feed.universal_places || []).forEach((p) => {
      if (!p.coordinates) return;
      const icon = L.divIcon({ className: 'nycif-culture-universal-pin', html: '🐾', iconSize: [22, 22], iconAnchor: [11, 11] });
      L.marker([p.coordinates.lat, p.coordinates.lng], { icon })
        .bindPopup(`<strong>${esc(p.name)}</strong><br>${p.place_type === 'pet_park' ? 'Pet park / dog run' : 'Pet store'} · for everyone`)
        .addTo(state.layers.universal);
    });
  }

  function renderNameMatches(feed) {
    const L = window.L;
    state.layers.nameMatch.clearLayers();
    (feed.name_lead_places || []).forEach((p) => {
      if (!p.coordinates) return;
      const icon = L.divIcon({ className: 'nycif-culture-namematch-pin', html: '?', iconSize: [22, 22], iconAnchor: [11, 11] });
      L.marker([p.coordinates.lat, p.coordinates.lng], { icon })
        .bindPopup(
          `<strong>${esc(p.name)}</strong><br><em>Possible match — unverified</em><br>` +
          `Name suggests: ${esc(tagLabel(p.hinted_tag))}<br>Not a confirmed cultural business.`
        ).addTo(state.layers.nameMatch);
    });
  }

  function estimateSize(name) {
    const charW = 9.2, maxW = 150, full = name.length * charW;
    const lines = Math.max(1, Math.ceil(full / maxW));
    return { w: Math.min(maxW, full) + 10, h: lines * 18 + 6 };
  }

  function renderLabels(feed) {
    const L = window.L;
    state.layers.labels.clearLayers();
    state.labels = [];
    feed.areas.forEach((a) => {
      const p = a.label_point;
      if (!p || p.lat == null) return;
      const name = String(a.geography_name || '').split('(')[0].trim();
      const boroughClass = 'nycif-hood-' + String(a.borough || '').toLowerCase().replace(/\s+/g, '-');
      const marker = L.marker([p.lat, p.lng], { opacity: 0, interactive: false, keyboard: false })
        .bindTooltip(name, { permanent: true, direction: 'center', className: `nycif-culture-hood-label ${boroughClass}` })
        .addTo(state.layers.labels);
      state.labels.push({ marker, latlng: [p.lat, p.lng], size: estimateSize(name), priority: (a.business_count || 0) * 10 + (STRENGTH_RANK[a.context_strength] || 0) });
    });
    declutter();
  }

  function declutter() {
    const map = state.map;
    if (!map || !state.labels.length) return;
    const placed = [];
    const hit = (b) => placed.some((p) => !(b.x + b.w < p.x || b.x > p.x + p.w || b.y + b.h < p.y || b.y > p.y + p.h));
    [...state.labels].sort((a, b) => b.priority - a.priority).forEach((item) => {
      const el = item.marker.getTooltip() && item.marker.getTooltip().getElement();
      if (!el) return;
      const pt = map.latLngToContainerPoint(item.latlng);
      const box = { x: pt.x - item.size.w / 2, y: pt.y - item.size.h / 2, w: item.size.w, h: item.size.h };
      if (hit(box)) { el.style.display = 'none'; } else { el.style.display = ''; placed.push(box); }
    });
  }

  function renderAll() {
    if (!state.feed) return;
    ensureLayers();
    renderBusinesses(state.feed);
    renderUniversal(state.feed);
    renderNameMatches(state.feed);
    renderLabels(state.feed);
  }

  // ---- Environment switch: Culture and Events are mutually exclusive. --------

  function isOwnLayer(l) {
    return !!state.layers && Object.values(state.layers).some((lg) => lg === l);
  }

  // Show only the culture sublayers whose filter checkbox is on.
  function applyFilterVisibility() {
    if (!state.on || !state.layers || !state.map) return;
    const map = state.map;
    [['business'], ['universal'], ['nameMatch'], ['labels']].forEach(([k]) => {
      const lg = state.layers[k];
      if (!lg) return;
      if (state.filterState[k]) lg.addTo(map); else map.removeLayer(lg);
    });
    if (state.filterState.labels) requestAnimationFrame(declutter);
  }

  // Turn the event map OFF: detach every non-basemap overlay currently on the
  // map (the event environment), remember them, then show the culture layers.
  function enterCulture() {
    const L = window.L;
    ensureLayers();
    state.hiddenEventLayers = [];
    state.map.eachLayer((l) => {
      if (l instanceof L.TileLayer) return;              // keep the base map
      if (L.GridLayer && l instanceof L.GridLayer) return;
      if (isOwnLayer(l)) return;                          // never our own layers
      state.hiddenEventLayers.push(l);
    });
    state.hiddenEventLayers.forEach((l) => state.map.removeLayer(l));
    applyFilterVisibility();
    state.map.on('moveend zoomend', declutter);
    requestAnimationFrame(declutter);
  }

  // Turn the event map back ON: remove culture layers, re-attach the events.
  function exitCulture() {
    if (state.layers) Object.values(state.layers).forEach((lg) => state.map.removeLayer(lg));
    (state.hiddenEventLayers || []).forEach((l) => { try { l.addTo(state.map); } catch (e) { /* ignore */ } });
    state.hiddenEventLayers = [];
    state.map.off('moveend zoomend', declutter);
  }

  function setMode(on) {
    if (on === state.on) return;
    state.on = on;
    const btn = document.getElementById('cultureModeBtn');
    if (btn) {
      btn.setAttribute('aria-pressed', String(on));
      btn.classList.toggle('is-on', on);
      // The button flips to "Events" so people know they can switch back.
      btn.innerHTML = on ? '<span>📅</span><b>Events</b>' : '<span>🎭</span><b>Culture</b>';
      btn.title = on ? 'Switch back to the event map' : 'Switch to the culture map';
    }
    const legend = document.getElementById('cultureLegend');
    if (legend) legend.hidden = !on;
    applyPanelMode(on);
    if (!state.map) return;
    if (on) enterCulture(); else exitCulture();
  }

  // ---- Filters panel: partition at the "Show help resources" divider. -------
  // Everything ABOVE the Community Help block = event filters (hidden in Culture
  // mode). The help block + the culture filters below it belong to Culture.

  function ensureCultureFilters() {
    const panel = document.getElementById('layersPanel');
    if (!panel || document.getElementById('nycif-culture-filters')) return;
    const block = document.createElement('div');
    block.id = 'nycif-culture-filters';
    block.className = 'nycif-culture-filter-block';
    block.hidden = true;
    block.innerHTML =
      '<hr><p class="panel-label">Culture layer</p>' +
      '<label class="check"><input type="checkbox" data-culture-layer="business" checked> <span>🏬 Cultural businesses</span></label>' +
      '<label class="check"><input type="checkbox" data-culture-layer="universal" checked> <span>🐾 Pet stores &amp; parks <small>for everyone</small></span></label>' +
      '<label class="check"><input type="checkbox" data-culture-layer="nameMatch" checked> <span>❓ Unverified name matches</span></label>' +
      '<label class="check"><input type="checkbox" data-culture-layer="labels" checked> <span>🏷️ Neighborhood labels</span></label>';
    const divider = document.getElementById('nycifCommunityHelpBlock');
    if (divider && divider.parentNode === panel) panel.insertBefore(block, divider.nextSibling);
    else panel.appendChild(block);
    block.querySelectorAll('input[data-culture-layer]').forEach((inp) => {
      inp.addEventListener('change', () => {
        state.filterState[inp.getAttribute('data-culture-layer')] = inp.checked;
        applyFilterVisibility();
      });
    });
  }

  function applyPanelMode(on) {
    const panel = document.getElementById('layersPanel');
    if (!panel) return;
    ensureCultureFilters();
    // The divider is the Community Help block if present, else the culture block.
    const divider = document.getElementById('nycifCommunityHelpBlock')
      || document.getElementById('nycif-culture-filters');
    let beforeDivider = true;
    Array.from(panel.children).forEach((child) => {
      if (child === divider) beforeDivider = false;
      if (child.id === 'nycif-culture-filters') return; // handled below
      // Hide event filters (everything above the divider) while Culture is on.
      if (beforeDivider) child.classList.toggle('nycif-hidden-in-culture', on);
    });
    const cf = document.getElementById('nycif-culture-filters');
    if (cf) cf.hidden = !on;
  }

  function makeButton() {
    const controls = document.querySelector('.map-controls');
    if (!controls || document.getElementById('cultureModeBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'cultureModeBtn';
    btn.type = 'button';
    btn.className = 'pill nycif-culture-pill';
    btn.setAttribute('aria-pressed', 'false');
    btn.title = 'Switch to the culture map';
    btn.innerHTML = '<span>🎭</span><b>Culture</b>';
    btn.addEventListener('click', () => {
      if (state.error) { alert('Culture layer unavailable: ' + state.error); return; }
      if (!state.loaded) return;
      setMode(!state.on);
    });
    // Place the Culture control to the LEFT, stacked directly on top of the
    // Filters button: wrap both in a vertical stack where Filters used to sit.
    const filters = document.getElementById('layersBtn');
    if (filters && filters.parentNode === controls) {
      const stack = document.createElement('div');
      stack.className = 'nycif-culture-stack';
      controls.insertBefore(stack, filters);
      stack.appendChild(btn);      // Culture on top
      stack.appendChild(filters);  // Filters below
    } else {
      controls.appendChild(btn);
    }

    const legend = document.createElement('div');
    legend.id = 'cultureLegend';
    legend.className = 'nycif-culture-legend';
    legend.hidden = true;
    legend.innerHTML =
      '<strong>Culture layer</strong> · sample/staging' +
      '<span class="k"><i class="dot"></i> business</span>' +
      '<span class="k">🐾 pet (everyone)</span>' +
      '<span class="k"><i class="q">?</i> unverified name match</span>';
    controls.parentNode.appendChild(legend);
  }

  function loadFeed() {
    loadJson(RELEASE_URL)
      .then((rel) => {
        if (!rel || rel.release_allowed !== true || rel.failure_count !== 0) throw new Error('release gate closed');
        return loadJson(FEED_URL);
      })
      .then((feed) => {
        const verdict = validate(feed);
        if (verdict !== 'ok' && verdict !== 'stale') throw new Error(verdict);
        state.feed = feed;
        state.loaded = true;
        renderAll();
      })
      .catch((err) => { state.error = err.message || 'load failed'; });
  }

  function init() {
    const map = window.NYCIF_MAIN_MAP;
    if (!map || !window.L) return false;
    state.map = map;
    makeButton();
    loadFeed();
    return true;
  }

  if (!init()) {
    let tries = 0;
    const timer = setInterval(() => { tries += 1; if (init() || tries > 120) clearInterval(timer); }, 100);
  }
})();
