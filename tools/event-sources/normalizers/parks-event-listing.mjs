/**
 * Normalizer: NYC Parks Events Listing – Event Listing (fudw-fgrp).
 * Borough, address, geo, organizer, eventType, and category require join tables (future work).
 */

import { asString, createEventLead } from '../event-lead.mjs';

/**
 * @param {unknown} value
 * @returns {boolean|null}
 */
function parseCostFree(value) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return null;
}

/**
 * @param {Record<string, unknown>} raw
 * @param {{ lastFetchedAt?: string|null }} [context]
 */
export function normalizeParksEventListing(raw, context = {}) {
  return createEventLead({
    source: 'NYC Parks Events Listing – Event Listing',
    sourceDatasetId: 'fudw-fgrp',
    sourceRecordId: asString(raw.event_id),
    eventId: asString(raw.event_id),
    title: asString(raw.title),
    eventType: null,
    category: null,
    startDate: asString(raw.date),
    startTime: asString(raw.start_time),
    endDate: asString(raw.date),
    endTime: asString(raw.end_time),
    borough: null,
    locationName: asString(raw.location_description),
    address: null,
    latitude: null,
    longitude: null,
    description: asString(raw.description) ?? asString(raw.snippet) ?? asString(raw.notice),
    officialUrl: asString(raw.url),
    organizer: null,
    phone: asString(raw.phone),
    email: asString(raw.email),
    isFree: parseCostFree(raw.cost_free),
    photoPriorityScore: null,
    rawRecord: raw,
    lastFetchedAt: context.lastFetchedAt ?? null,
  });
}
