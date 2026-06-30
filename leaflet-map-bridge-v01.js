(() => {
  const VERSION = 'leaflet-map-bridge-v01';

  function publishMap(map) {
    if (!map) return map;
    window.NYCIF_LEAFLET_MAP = map;
    window.NYCIF_MAP_BRIDGE = { version: VERSION, map };
    try {
      window.dispatchEvent(new CustomEvent('nycif:map-ready', { detail: { map } }));
    } catch {
      window.dispatchEvent(new Event('nycif:map-ready'));
    }
    return map;
  }

  function install(attempt = 0) {
    if (!window.L || !L.map) {
      if (attempt < 80) window.setTimeout(() => install(attempt + 1), 100);
      return;
    }
    if (L.map.NYCIF_MAP_BRIDGE_WRAPPED) return;

    const originalMapFactory = L.map.bind(L);
    function bridgedMapFactory(...args) {
      const map = originalMapFactory(...args);
      return publishMap(map);
    }

    Object.assign(bridgedMapFactory, L.map);
    bridgedMapFactory.NYCIF_MAP_BRIDGE_WRAPPED = true;
    L.map = bridgedMapFactory;

    if (L.Map && L.Map.prototype && !L.Map.prototype.NYCIF_MAP_BRIDGE_WRAPPED) {
      const originalInitialize = L.Map.prototype.initialize;
      L.Map.prototype.initialize = function bridgedInitialize(...args) {
        originalInitialize.apply(this, args);
        publishMap(this);
      };
      L.Map.prototype.NYCIF_MAP_BRIDGE_WRAPPED = true;
    }
  }

  install();
})();
