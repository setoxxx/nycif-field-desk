(() => {
  'use strict';

  const DATA_ROOT = './data/community-help';
  const LINKS_URL = `${DATA_ROOT}/links.json`;
  const DATA_CATEGORIES = [
    'benefits', 'food', 'shelter', 'naloxone', 'jobs', 'youth', 'health',
    'homebase', 'senior', 'family', 'digital', 'restroom',
  ];
  const CACHE_KEY = 'nycif-community-help-geocodes-v02';
  const GEOSEARCH_URL = 'https://geosearch.planninglabs.nyc/v2/search';
  const CATEGORY_META = {
    benefits: { label: 'Benefits / SNAP', icon: '🧾', color: '#1d4ed8' },
    food: { label: 'Free Food', icon: '🥫', color: '#b45309' },
    shelter: { label: 'Shelter Intake', icon: '🏠', color: '#7c3aed' },
    homebase: { label: 'Homebase / Housing Help', icon: '🔑', color: '#6d28d9' },
    naloxone: { label: 'Narcan / Harm Reduction', icon: '🛟', color: '#be123c' },
    jobs: { label: 'Jobs / Workforce', icon: '💼', color: '#047857' },
    youth: { label: 'Youth Services', icon: '🧑‍🤝‍🧑', color: '#9333ea' },
    faith: { label: 'Faith & Community', icon: '🤝', color: '#6d28d9' },
    health: { label: 'Health Services', icon: '⚕️', color: '#0369a1' },
    senior: { label: 'Older-Adult Services', icon: '🧓', color: '#9a3412' },
    family: { label: 'Family Justice Centers', icon: '🫶', color: '#9f1239' },
    digital: { label: 'Computers / Wi-Fi', icon: '💻', color: '#075985' },
    restroom: { label: 'Public Restrooms', icon: '🚻', color: '#374151' },
    tax: { label: 'Free Tax Help', icon: '🧮', color: '#0f766e' },
    legal: { label: 'Legal Help', icon: '⚖️', color: '#334155' },
  };

  const state = {
    directoryLinks: [],
    categoryRows: new Map(),
    enabled: new Set(),
    layers: new Map(),
    geocodeCache: loadCache(),
    busy: new Set(),
  };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));

  function loadCache() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function saveCache() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(state.geocodeCache)); } catch (_) {}
  }

  function isNYCoord(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng)
      && lat >= 40.45 && lat <= 40.95 && lng >= -74.3 && lng <= -73.65;
  }

  function expectedBoroughTokens(value) {
    const key = String(value || '').toLowerCase();
    if (key === 'manhattan') return ['manhattan', 'new york'];
    if (key === 'staten island') return ['staten island', 'richmond'];
    return [key];
  }

  function featureText(feature) {
    const props = feature?.properties || {};
    return [props.label, props.name, props.borough, props.locality, props.county, props.postalcode]
      .filter(Boolean).join(' ').toLowerCase();
  }

  async function geocode(row) {
    const directLat = Number(row.lat);
    const directLng = Number(row.lng);
    if (isNYCoord(directLat, directLng)) return { lat: directLat, lng: directLng, label: row.address };
    const cached = state.geocodeCache[row.id];
    if (cached && isNYCoord(Number(cached.lat), Number(cached.lng))) return cached;
    const query = String(row.address || '').replace(/\s+/g, ' ').trim();
    const response = await fetch(`${GEOSEARCH_URL}?${new URLSearchParams({ text: query, size: '8' })}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`GeoSearch HTTP ${response.status}`);
    const payload = await response.json();
    const zip = (query.match(/\b\d{5}\b/) || [''])[0];
    const hit = (payload.features || []).find((feature) => {
      const coords = feature?.geometry?.coordinates;
      if (!Array.isArray(coords) || coords.length !== 2) return false;
      if (!isNYCoord(Number(coords[1]), Number(coords[0]))) return false;
      const haystack = featureText(feature);
      if (!expectedBoroughTokens(row.borough).some((token) => token && haystack.includes(token))) return false;
      return !(zip && /\b\d{5}\b/.test(haystack) && !haystack.includes(zip));
    });
    if (!hit) throw new Error(`No borough-safe coordinate for ${row.address}`);
    const point = {
      lat: Number(hit.geometry.coordinates[1]),
      lng: Number(hit.geometry.coordinates[0]),
      label: hit.properties?.label || row.address,
    };
    state.geocodeCache[row.id] = point;
    saveCache();
    return point;
  }

  function rowMatchesCategory(row, category) {
    if (row.category === category) return true;
    const services = (row.services || []).join(' ').toLowerCase();
    if (category === 'faith') return services.includes('faith-based') || services.includes('community support');
    return false;
  }

  function popupHtml(row, category) {
    const meta = CATEGORY_META[category] || CATEGORY_META.benefits;
    const services = (row.services || []).map((item) => `<li>${esc(item)}</li>`).join('');
    const phone = String(row.phone || '').replace(/[^0-9+]/g, '');
    const urgent = row.category === 'naloxone'
      ? '<p class="nycif-help-urgent"><strong>Overdose emergency:</strong> Call 911, give naloxone if available, and stay with the person.</p>'
      : row.category === 'family'
        ? '<p class="nycif-help-urgent"><strong>Immediate danger:</strong> Call 911. Use a safer device when seeking help if your device may be monitored.</p>'
        : '';
    return `<article class="nycif-help-popup">
      <div class="nycif-help-tag">${esc(meta.icon)} ${esc(meta.label)}</div>
      <h2>${esc(row.title)}</h2>
      <p>${esc(row.address)}</p>
      ${row.status && row.status !== 'active' ? `<p><strong>Status:</strong> ${esc(row.status)}</p>` : ''}
      ${row.hours ? `<p><strong>Hours:</strong> ${esc(row.hours)}</p>` : ''}
      ${services ? `<ul>${services}</ul>` : ''}
      ${row.access_note ? `<p class="nycif-help-note">${esc(row.access_note)}</p>` : ''}
      ${urgent}
      <div class="nycif-help-actions">
        ${row.phone ? `<a href="tel:${esc(phone)}">Call ${esc(row.phone)}</a>` : ''}
        <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(row.address || '')}" target="_blank" rel="noopener">Directions</a>
        <a href="${esc(row.source_url)}" target="_blank" rel="noopener">Official details</a>
      </div>
      <p class="nycif-help-verified">Verified ${esc(row.last_verified || '')}. Confirm availability before travel.</p>
    </article>`;
  }

  function markerFor(row, point, category) {
    const meta = CATEGORY_META[category] || CATEGORY_META.benefits;
    const icon = L.divIcon({
      className: 'nycif-help-marker-shell',
      html: `<div class="nycif-help-marker" style="--help-color:${esc(meta.color)}">${esc(meta.icon)}</div>`,
      iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -19],
    });
    return L.marker([point.lat, point.lng], { icon, title: row.title, zIndexOffset: 980 })
      .bindPopup(popupHtml(row, category), { maxWidth: 370, minWidth: 260 });
  }

  function installStyles() {
    if (document.getElementById('nycif-community-help-style')) return;
    const style = document.createElement('style');
    style.id = 'nycif-community-help-style';
    style.textContent = `
      .nycif-community-help-block{display:grid;gap:8px;margin-top:4px}.nycif-help-intro{margin:0;font-size:11px;line-height:1.4;color:#374151}.nycif-help-grid{display:grid;grid-template-columns:1fr;gap:6px}.nycif-help-links{display:grid;gap:6px;margin-top:6px}.nycif-help-link{display:block;padding:9px 10px;border-radius:10px;background:#eef2ff;color:#1e3a8a;font-size:11px;font-weight:800;text-decoration:none}.nycif-help-link small{display:block;margin-top:2px;color:#475569;font-weight:600;line-height:1.3}.nycif-help-status{font-size:11px;color:#475569;min-height:14px}.nycif-help-marker{display:grid;place-items:center;width:36px;height:36px;border-radius:999px;background:var(--help-color);border:2px solid #fff;box-shadow:0 8px 22px rgba(0,0,0,.34);font-size:17px}.nycif-help-popup{font:500 12px/1.4 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#111827}.nycif-help-popup h2{margin:7px 0 5px;font-size:16px;line-height:1.2}.nycif-help-popup p{margin:5px 0}.nycif-help-popup ul{margin:7px 0;padding-left:18px}.nycif-help-tag{display:inline-flex;padding:3px 7px;border-radius:999px;background:#e2e8f0;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.03em}.nycif-help-note{color:#475569}.nycif-help-urgent{padding:8px;border-radius:9px;background:#fff1f2;color:#9f1239}.nycif-help-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.nycif-help-actions a{padding:7px 9px;border-radius:9px;background:#0f172a;color:#fff;text-decoration:none;font-weight:800}.nycif-help-verified{font-size:10px;color:#64748b}.nycif-help-master span{font-weight:900}
    `;
    document.head.appendChild(style);
  }

  function setStatus(message) {
    const node = document.getElementById('nycifCommunityHelpStatus');
    if (node) node.textContent = message || '';
  }

  function visibleCategories() {
    const keys = new Set(DATA_CATEGORIES);
    keys.add('faith');
    return Object.keys(CATEGORY_META).filter((key) => keys.has(key));
  }

  function installControls() {
    const panel = document.getElementById('layersPanel');
    if (!panel || document.getElementById('nycifCommunityHelpBlock')) return;
    const block = document.createElement('div');
    block.id = 'nycifCommunityHelpBlock';
    block.className = 'nycif-community-help-block';
    const checks = visibleCategories().map((key) => {
      const meta = CATEGORY_META[key];
      return `<label class="check"><input type="checkbox" data-help-category="${esc(key)}"> <span>${esc(meta.icon)} ${esc(meta.label)}</span></label>`;
    }).join('');
    const links = state.directoryLinks.map((link) => `<a class="nycif-help-link" href="${esc(link.url)}" target="_blank" rel="noopener">${esc(link.title)}<small>${esc(link.description || '')}</small></a>`).join('');
    block.innerHTML = `<hr><p class="panel-label">Community Help</p>
      <label class="check nycif-help-master"><input type="checkbox" id="nycifCommunityHelpMaster"> <span>🧭 Show help resources</span></label>
      <p class="nycif-help-intro">Verified public service locations and official live locators. Permanent resources are separate from events.</p>
      <div class="nycif-help-grid" id="nycifCommunityHelpCategories" hidden>${checks}</div>
      <div class="nycif-help-status" id="nycifCommunityHelpStatus"></div>
      <div class="nycif-help-links" id="nycifCommunityHelpLinks" hidden>${links}</div>`;
    panel.appendChild(block);
    const master = block.querySelector('#nycifCommunityHelpMaster');
    const categories = block.querySelector('#nycifCommunityHelpCategories');
    const locatorLinks = block.querySelector('#nycifCommunityHelpLinks');
    master.addEventListener('change', () => {
      categories.hidden = !master.checked;
      locatorLinks.hidden = !master.checked;
      if (!master.checked) {
        block.querySelectorAll('[data-help-category]').forEach((input) => { input.checked = false; });
        [...state.enabled].forEach(disableCategory);
        setStatus('');
      } else {
        setStatus('Choose a category. Official locator links remain available for categories without a reliable static pin file.');
      }
    });
    block.querySelectorAll('[data-help-category]').forEach((input) => {
      input.addEventListener('change', () => (input.checked ? enableCategory(input.dataset.helpCategory) : disableCategory(input.dataset.helpCategory)));
    });
  }

  function sourceCategory(category) {
    return category === 'faith' ? 'food' : category;
  }

  async function rowsForCategory(category) {
    const source = sourceCategory(category);
    if (!DATA_CATEGORIES.includes(source)) return [];
    if (!state.categoryRows.has(source)) {
      const response = await fetch(`${DATA_ROOT}/${source}.json?cache=${Date.now()}`, { cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`${source} resources HTTP ${response.status}`);
      const payload = await response.json();
      state.categoryRows.set(source, Array.isArray(payload.locations) ? payload.locations : []);
    }
    return state.categoryRows.get(source).filter((row) => rowMatchesCategory(row, category));
  }

  async function enableCategory(category) {
    const map = window.NYCIF_MAIN_MAP;
    if (!map || !window.L || state.busy.has(category)) return;
    state.enabled.add(category);
    const existing = state.layers.get(category);
    if (existing) { existing.addTo(map); return; }
    state.busy.add(category);
    try {
      const rows = await rowsForCategory(category);
      const layer = L.layerGroup().addTo(map);
      state.layers.set(category, layer);
      let added = 0;
      let failed = 0;
      for (const row of rows) {
        if (!state.enabled.has(category)) break;
        setStatus(`Loading ${CATEGORY_META[category].label}: ${added + failed + 1} of ${rows.length}…`);
        try {
          const point = await geocode(row);
          if (state.enabled.has(category)) markerFor(row, point, category).addTo(layer);
          added += 1;
        } catch (error) {
          failed += 1;
          console.warn('[NYCIF Community Help]', row.id, error);
        }
      }
      if (state.enabled.has(category)) setStatus(`${CATEGORY_META[category].label}: ${added} public locations loaded${failed ? `; ${failed} need coordinate review` : ''}.`);
    } catch (error) {
      state.enabled.delete(category);
      setStatus(`Could not load ${CATEGORY_META[category].label}. Use the official locator links below.`);
      console.error('[NYCIF Community Help]', error);
    } finally {
      state.busy.delete(category);
    }
  }

  function disableCategory(category) {
    state.enabled.delete(category);
    const map = window.NYCIF_MAIN_MAP;
    const layer = state.layers.get(category);
    if (map && layer && map.hasLayer(layer)) map.removeLayer(layer);
  }

  async function init() {
    installStyles();
    try {
      const response = await fetch(`${LINKS_URL}?cache=${Date.now()}`, { cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Community Help links HTTP ${response.status}`);
      const payload = await response.json();
      state.directoryLinks = Array.isArray(payload.directory_links) ? payload.directory_links : [];
      installControls();
    } catch (error) {
      console.error('[NYCIF Community Help]', error);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
