/**
 * Normalized event lead shape for NYCIF Event Sources v0.
 * Read-only scaffold — not wired to production feeds or map runtime.
 */

/** @typedef {import('./event-source-config.mjs').EventSourceConfig} EventSourceConfig */

/**
 * @typedef {Object} EventLead
 * @property {string|null} source
 * @property {string|null} sourceDatasetId
 * @property {string|null} sourceRecordId
 * @property {string|null} eventId
 * @property {string|null} title
 * @property {string|null} eventType
 * @property {string|null} category
 * @property {string|null} startDate
 * @property {string|null} startTime
 * @property {string|null} endDate
 * @property {string|null} endTime
 * @property {string|null} borough
 * @property {string|null} locationName
 * @property {string|null} address
 * @property {number|null} latitude
 * @property {number|null} longitude
 * @property {string|null} description
 * @property {string|null} officialUrl
 * @property {string|null} organizer
 * @property {string|null} phone
 * @property {string|null} email
 * @property {boolean|null} isFree
 * @property {number|null} photoPriorityScore
 * @property {Record<string, unknown>|null} rawRecord
 * @property {string|null} lastFetchedAt
 */

export const EVENT_LEAD_FIELDS = [
  'source',
  'sourceDatasetId',
  'sourceRecordId',
  'eventId',
  'title',
  'eventType',
  'category',
  'startDate',
  'startTime',
  'endDate',
  'endTime',
  'borough',
  'locationName',
  'address',
  'latitude',
  'longitude',
  'description',
  'officialUrl',
  'organizer',
  'phone',
  'email',
  'isFree',
  'photoPriorityScore',
  'rawRecord',
  'lastFetchedAt',
];

/** @returns {EventLead} */
export function createEmptyEventLead() {
  return Object.fromEntries(EVENT_LEAD_FIELDS.map((field) => [field, null]));
}

/**
 * @param {Partial<EventLead>} partial
 * @returns {EventLead}
 */
export function createEventLead(partial = {}) {
  return { ...createEmptyEventLead(), ...partial };
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
export function asString(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

/**
 * @param {unknown} value
 * @returns {number|null}
 */
export function asNumber(value) {
  if (value == null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/**
 * @param {unknown} value
 * @returns {{ date: string|null, time: string|null }}
 */
export function splitDateTime(value) {
  const text = asString(value);
  if (!text) return { date: null, time: null };
  const iso = text.includes('T') ? text : text.replace(' ', 'T');
  return {
    date: iso.slice(0, 10) || null,
    time: iso.length >= 19 ? iso.slice(11, 19) : null,
  };
}

/**
 * @param {EventLead} lead
 * @returns {boolean}
 */
export function hasEventLeadShape(lead) {
  return EVENT_LEAD_FIELDS.every((field) => Object.prototype.hasOwnProperty.call(lead, field));
}
