const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'city-fleet-operator-layer-v01.js'), 'utf8');

function makeContext(url) {
  const listeners = {};
  const context = {
    URL,
    Date,
    Map,
    Set,
    Number,
    String,
    Array,
    Object,
    Math,
    console,
    location: { href: url },
    document: {
      readyState: 'complete',
      getElementById: () => null,
      head: { appendChild() {} },
      createElement: () => ({ style: {}, appendChild() {}, addEventListener() {} })
    },
    window: {
      setTimeout() {},
      setInterval() { return 1; },
      clearInterval() {},
      L: null,
      NYCIF_MAIN_MAP: null
    },
    setTimeout() {},
    setInterval() { return 1; },
    clearInterval() {},
    fetch() { throw new Error('fetch should not run in this test'); }
  };
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.location = context.location;
  vm.createContext(context);
  return context;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(function publicModeDoesNothing() {
  const ctx = makeContext('https://example.test/map/');
  vm.runInContext(source, ctx);
  assert(!ctx.window.NYCIF_CITY_FLEET, 'City Fleet must not install for public visitors');
})();

(function operatorModeWaitsForMap() {
  const ctx = makeContext('https://example.test/map/?desk=1');
  vm.runInContext(source, ctx);
  assert(!ctx.window.NYCIF_CITY_FLEET, 'City Fleet should wait for Leaflet/main map before installing');
})();

console.log('city-fleet-operator-layer safety tests passed');
