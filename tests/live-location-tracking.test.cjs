'use strict';

const assert = require('node:assert/strict');
const liveLocation = require('../live-location-tracking-v01.js');

class FakeClassList {
  constructor(initial = '') {
    this.values = new Set(String(initial).split(/\s+/).filter(Boolean));
  }
  add(...names) { names.forEach(name => this.values.add(name)); }
  contains(name) { return this.values.has(name); }
}

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = String(tagName).toUpperCase();
    this.id = '';
    this.className = '';
    this.classList = new FakeClassList();
    this.dataset = {};
    this.style = { values: {}, setProperty: (name, value) => { this.style.values[name] = value; } };
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.hidden = false;
    this.textContent = '';
    this.listeners = new Map();
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  insertAdjacentElement(_position, child) {
    if (!this.parentNode) return child;
    const index = this.parentNode.children.indexOf(this);
    child.parentNode = this.parentNode;
    this.parentNode.children.splice(index + 1, 0, child);
    return child;
  }
  querySelector(selector) {
    if (selector === '.nycif-live-location-heading') {
      return this.children.find(child => String(child.className).split(/\s+/).includes('nycif-live-location-heading')) || null;
    }
    return null;
  }
  addEventListener(type, listener, options) {
    const key = `${type}:${options === true || options?.capture ? 'capture' : 'bubble'}`;
    if (!this.listeners.has(key)) this.listeners.set(key, []);
    this.listeners.get(key).push(listener);
  }
  removeEventListener(type, listener, options) {
    const key = `${type}:${options === true || options?.capture ? 'capture' : 'bubble'}`;
    const list = this.listeners.get(key) || [];
    this.listeners.set(key, list.filter(item => item !== listener));
  }
  focus() { this.focused = true; }
}

class FakeDocument {
  constructor() {
    this.head = new FakeElement('head');
    this.hidden = false;
    this.nodes = new Map();
    this.listeners = new Map();
  }
  register(element) { if (element.id) this.nodes.set(element.id, element); return element; }
  getElementById(id) { return this.nodes.get(id) || null; }
  createElement(tagName) {
    const element = new FakeElement(tagName);
    const originalSet = element.setAttribute.bind(element);
    element.setAttribute = (name, value) => {
      originalSet(name, value);
      if (name === 'id') { element.id = String(value); this.nodes.set(element.id, element); }
    };
    return element;
  }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item !== listener));
  }
  emit(type) { (this.listeners.get(type) || []).forEach(listener => listener()); }
}

class FakeMap {
  constructor() {
    this.layers = [];
    this.handlers = new Map();
    this.center = { lat: 40.7128, lng: -74.006 };
    this.zoom = 12;
    this.panCount = 0;
    this.setViewCount = 0;
  }
  on(type, listener) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type).push({ listener, once: false });
  }
  once(type, listener) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type).push({ listener, once: true });
  }
  off(type, listener) {
    this.handlers.set(type, (this.handlers.get(type) || []).filter(item => item.listener !== listener));
  }
  emit(type, payload = {}) {
    const handlers = [...(this.handlers.get(type) || [])];
    handlers.forEach(item => item.listener(payload));
    this.handlers.set(type, (this.handlers.get(type) || []).filter(item => !item.once));
  }
  addLayer(layer) { this.layers.push(layer); this.emit('layeradd', { layer }); return layer; }
  removeLayer(layer) { this.layers = this.layers.filter(item => item !== layer); }
  eachLayer(callback) { [...this.layers].forEach(callback); }
  getZoom() { return this.zoom; }
  getCenter() { return { ...this.center }; }
  setView(latlng, zoom) {
    this.center = { lat: Number(latlng[0]), lng: Number(latlng[1]) };
    this.zoom = zoom;
    this.setViewCount += 1;
    this.emit('moveend');
  }
  panTo(latlng) {
    this.center = { lat: Number(latlng[0]), lng: Number(latlng[1]) };
    this.panCount += 1;
    this.emit('moveend');
  }
}

class FakeMarker {
  constructor(latlng, options, map) {
    this.latlng = { lat: Number(latlng[0]), lng: Number(latlng[1]) };
    this.options = options || {};
    this.map = map;
    this.element = new FakeElement('div');
    this.element.className = this.options.icon?.options?.className || '';
    this.element.classList = new FakeClassList(this.element.className);
  }
  addTo(map) { map.addLayer(this); return this; }
  setLatLng(latlng) { this.latlng = { lat: Number(latlng[0]), lng: Number(latlng[1]) }; return this; }
  getLatLng() { return { ...this.latlng }; }
  getElement() { return this.element; }
}

class FakeCircle {
  constructor(latlng, options) {
    this.latlng = { lat: Number(latlng[0]), lng: Number(latlng[1]) };
    this.options = options || {};
    this.radius = Number(options?.radius || 0);
  }
  addTo(map) { map.addLayer(this); return this; }
  setLatLng(latlng) { this.latlng = { lat: Number(latlng[0]), lng: Number(latlng[1]) }; return this; }
  getLatLng() { return { ...this.latlng }; }
  setRadius(radius) { this.radius = Number(radius); return this; }
  getRadius() { return this.radius; }
}

function position(latitude, longitude, accuracy, timestamp, extras = {}) {
  return {
    timestamp,
    coords: { latitude, longitude, accuracy, heading: null, speed: null, ...extras }
  };
}

const doc = new FakeDocument();
const controls = new FakeElement('div');
const locateBtn = new FakeElement('button');
locateBtn.id = 'locateBtn';
controls.appendChild(locateBtn);
doc.register(locateBtn);
const statusEl = new FakeElement('div');
statusEl.id = 'status';
doc.register(statusEl);

const map = new FakeMap();
const fakeL = {
  divIcon: options => ({ options }),
  marker: (latlng, options) => new FakeMarker(latlng, options, map),
  circle: (latlng, options) => new FakeCircle(latlng, options)
};

const geo = {
  nextId: 41,
  success: null,
  error: null,
  options: null,
  cleared: [],
  watchPosition(success, error, options) {
    this.success = success;
    this.error = error;
    this.options = options;
    return this.nextId++;
  },
  clearWatch(id) { this.cleared.push(id); }
};

const windowListeners = new Map();
const fakeWindow = {
  document: doc,
  navigator: { geolocation: geo },
  NYCIF_MAIN_MAP: map,
  L: fakeL,
  matchMedia: () => ({ matches: false }),
  setTimeout,
  clearTimeout,
  addEventListener(type, listener) { windowListeners.set(type, listener); },
  removeEventListener(type) { windowListeners.delete(type); }
};

const controller = liveLocation.createController(fakeWindow, {
  document: doc,
  navigator: fakeWindow.navigator,
  geolocation: geo,
  map,
  L: fakeL,
  locateBtn,
  statusEl,
  reducedMotion: true
});

assert(controller, 'Controller should initialize');
assert.equal(controller.start(), true, 'Tracking should start');
assert.equal(controller.getState().tracking, true, 'Tracking state should be true');
assert.equal(controller.getState().following, true, 'Follow mode should start enabled');
assert.equal(locateBtn.getAttribute('aria-pressed'), 'true', 'Location control should expose pressed state');
assert.deepEqual(geo.options, liveLocation.WATCH_OPTIONS, 'watchPosition options changed unexpectedly');

geo.success(position(40.7000, -73.9900, 18, 1000, { heading: 90, speed: 1.5 }));
let state = controller.getState();
assert.deepEqual(state.markerLatLng, { lat: 40.7, lng: -73.99 }, 'First GPS fix did not place the blue dot');
assert.equal(state.accuracyRadius, 18, 'Accuracy circle did not use reported accuracy');
assert.equal(state.lastFix.heading, 90, 'Device heading was not retained');
assert.equal(map.setViewCount, 1, 'First GPS fix should center and zoom the map');

geo.success(position(40.7006, -73.9892, 12, 3000));
state = controller.getState();
assert.deepEqual(state.markerLatLng, { lat: 40.7006, lng: -73.9892 }, 'Sequential GPS fix did not move the blue dot');
assert.equal(state.accuracyRadius, 12, 'Accuracy radius did not update');
assert(state.lastFix.heading != null, 'Movement-derived direction was not calculated');
assert.equal(map.panCount, 1, 'Follow mode should pan after movement');

map.emit('dragstart');
assert.equal(controller.getState().following, false, 'Manual map drag should pause follow mode');
const centerBeforePausedUpdate = map.getCenter();
geo.success(position(40.7012, -73.9884, 10, 5000));
assert.deepEqual(map.getCenter(), centerBeforePausedUpdate, 'Paused follow mode should not fight a manual map pan');
assert.deepEqual(controller.getState().markerLatLng, { lat: 40.7012, lng: -73.9884 }, 'Blue dot should keep moving while follow mode is paused');

controller.resumeFollowing();
assert.equal(controller.getState().following, true, 'Recenter should resume follow mode');
assert.deepEqual(map.getCenter(), { lat: 40.7012, lng: -73.9884 }, 'Recenter should move to the latest GPS fix');

const watchId = controller.getState().watchId;
controller.stop();
assert.equal(controller.getState().tracking, false, 'Stop should disable tracking');
assert(geo.cleared.includes(watchId), 'Stop should clear the active geolocation watch');
assert.equal(locateBtn.getAttribute('aria-pressed'), 'false', 'Location control should expose stopped state');

controller.start();
geo.error({ code: 1 });
assert.equal(controller.getState().tracking, false, 'Permission denial should stop tracking');
assert.match(statusEl.textContent, /permission was denied/i, 'Permission denial should have a reader-safe message');

controller.start();
const destroyWatchId = controller.getState().watchId;
controller.destroy();
assert.equal(controller.getState().disposed, true, 'Destroy should mark the controller disposed');
assert(geo.cleared.includes(destroyWatchId), 'Destroy should clear the active watch');

const first = liveLocation.normalizePosition(position(40.7, -73.99, 10, 1000), null);
assert.equal(first.accepted, true, 'Valid position should be accepted');
const noisy = liveLocation.normalizePosition(position(40.7000001, -73.9900001, 10.5, 1200), first.fix);
assert.equal(noisy.accepted, false, 'Noisy sub-threshold update should be rejected');
assert.equal(noisy.reason, 'noise', 'Noisy update should have an explicit reason');

console.log('live-location-tracking.test.cjs: all assertions passed');
