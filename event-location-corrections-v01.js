(() => {
  const VERSION = 'event-location-corrections-v01';

  const CORRECTIONS = [
    {
      id: 'mckinley-square-bronx-market',
      label: 'McKinley Square, Bronx',
      lat: 40.83145,
      lng: -73.90188,
      match(row) {
        const text = normalize([
          row?.id,
          row?.title,
          row?.location,
          row?.display_location,
          row?.borough,
          row?.search_label
        ].join(' '));
        return /bronx/.test(text) && /mckinley square/.test(text);
      }
    }
  ];

  function normalize(value) {
    return String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function isObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function applyCorrection(row) {
    if (!isObject(row)) return row;
    const correction = CORRECTIONS.find(rule => rule.match(row));
    if (!correction) return row;

    return {
      ...row,
      lat: correction.lat,
      lng: correction.lng,
      display_location: correction.label,
      google_maps_url: `https://www.google.com/maps/search/?api=1&query=${correction.lat}%2C${correction.lng}`,
      geocode_confidence: 'manual_high',
      geocode_source: 'nycif_manual_location_correction',
      location_correction_id: correction.id,
      location_correction_note: 'Corrected Bronx McKinley Square market pin; prevented Brooklyn McKinley Avenue/Crescent Street mismatch.'
    };
  }

  function correctPayload(payload) {
    if (Array.isArray(payload)) return payload.map(applyCorrection);
    if (isObject(payload) && Array.isArray(payload.events)) return { ...payload, events: payload.events.map(applyCorrection) };
    return payload;
  }

  function shouldPatch(url) {
    const text = String(url || '');
    return /nycif_(major|all)_radar_map_events\.json|nycif_staged_live_events\.json|radar_map_events|staged_live_events/i.test(text);
  }

  const originalFetch = window.fetch?.bind(window);
  if (!originalFetch || originalFetch.NYCIF_LOCATION_CORRECTIONS) return;

  async function patchedFetch(input, init) {
    const response = await originalFetch(input, init);
    const url = typeof input === 'string' ? input : input?.url;
    if (!shouldPatch(url)) return response;

    const originalJson = response.json.bind(response);
    response.json = async () => correctPayload(await originalJson());
    return response;
  }

  patchedFetch.NYCIF_LOCATION_CORRECTIONS = true;
  window.fetch = patchedFetch;
  window.NYCIF_EVENT_LOCATION_CORRECTIONS = { version: VERSION, corrections: CORRECTIONS.map(rule => rule.id) };
})();
