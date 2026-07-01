/**
 * NYCIF Event Sources v0 — read-only source inventory.
 * Does not affect production feeds, map runtime, or caches.
 */

/**
 * @typedef {'core'|'core_join'|'enrichment'|'optional'|'later'} EventSourcePriority
 * @typedef {'socrata_json'|'html_scrape'} EventSourceType
 *
 * @typedef {Object} EventSourceConfig
 * @property {string} id
 * @property {string} name
 * @property {string} url
 * @property {EventSourcePriority} priority
 * @property {EventSourceType} type
 * @property {'documented_only'|undefined} [status]
 * @property {string|undefined} [joinKey]
 */

/** @type {EventSourceConfig[]} */
export const EVENT_SOURCES = [
  {
    id: 'tvpp-9vvx',
    name: 'NYC Permitted Event Information',
    url: 'https://data.cityofnewyork.us/resource/tvpp-9vvx.json',
    priority: 'core',
    type: 'socrata_json',
  },
  {
    id: 'fudw-fgrp',
    name: 'NYC Parks Events Listing – Event Listing',
    url: 'https://data.cityofnewyork.us/resource/fudw-fgrp.json',
    priority: 'core',
    type: 'socrata_json',
  },
  {
    id: 'cpcm-i88g',
    name: 'NYC Parks Events Listing – Event Locations',
    url: 'https://data.cityofnewyork.us/resource/cpcm-i88g.json',
    priority: 'core_join',
    type: 'socrata_json',
    joinKey: 'event_id',
  },
  {
    id: 'xtsw-fqvh',
    name: 'NYC Parks Events Listing – Event Categories',
    url: 'https://data.cityofnewyork.us/resource/xtsw-fqvh.json',
    priority: 'core_join',
    type: 'socrata_json',
    joinKey: 'event_id',
  },
  {
    id: 'ridc-7qqg',
    name: 'NYC Parks Events Listing – Event Links',
    url: 'https://data.cityofnewyork.us/resource/ridc-7qqg.json',
    priority: 'enrichment',
    type: 'socrata_json',
    joinKey: 'event_id',
  },
  {
    id: '6eti-k994',
    name: 'NYC Parks Events Listing – Event Images',
    url: 'https://data.cityofnewyork.us/resource/6eti-k994.json',
    priority: 'enrichment',
    type: 'socrata_json',
    joinKey: 'event_id',
  },
  {
    id: 'jk6k-yab4',
    name: 'NYC Parks Events Listing – Event Organizers',
    url: 'https://data.cityofnewyork.us/resource/jk6k-yab4.json',
    priority: 'enrichment',
    type: 'socrata_json',
    joinKey: 'event_id',
  },
  {
    id: '6v4b-5gp4',
    name: 'Public Programs Division Special Events',
    url: 'https://data.cityofnewyork.us/resource/6v4b-5gp4.json',
    priority: 'core',
    type: 'socrata_json',
  },
  {
    id: '3vyj-dkjt',
    name: 'Safety Events',
    url: 'https://data.cityofnewyork.us/resource/3vyj-dkjt.json',
    priority: 'core',
    type: 'socrata_json',
  },
  {
    id: 'tg4x-b46p',
    name: 'Film Permits',
    url: 'https://data.cityofnewyork.us/resource/tg4x-b46p.json',
    priority: 'optional',
    type: 'socrata_json',
  },
  {
    id: 'dot-trafalrt',
    name: 'Special Traffic Updates',
    url: 'https://www.nyc.gov/html/dot/html/motorist/trafalrt.shtml',
    priority: 'later',
    type: 'html_scrape',
    status: 'documented_only',
  },
];

/** @type {ReadonlySet<string>} */
export const SOCRATA_DATASET_IDS = new Set(
  EVENT_SOURCES.filter((source) => source.type === 'socrata_json').map((source) => source.id),
);

/**
 * @param {string} id
 * @returns {EventSourceConfig|undefined}
 */
export function getEventSourceById(id) {
  return EVENT_SOURCES.find((source) => source.id === id);
}

/**
 * @param {EventSourcePriority} [priority]
 * @returns {EventSourceConfig[]}
 */
export function listEventSources(priority) {
  if (!priority) return [...EVENT_SOURCES];
  return EVENT_SOURCES.filter((source) => source.priority === priority);
}

/**
 * @param {EventSourceConfig} source
 * @returns {boolean}
 */
export function isFetchableSocrataSource(source) {
  return source.type === 'socrata_json' && source.status !== 'documented_only';
}

/**
 * @param {string} datasetId
 * @returns {string}
 */
export function socrataResourceUrl(datasetId) {
  return `https://data.cityofnewyork.us/resource/${datasetId}.json`;
}
