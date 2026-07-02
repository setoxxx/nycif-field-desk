/**
 * Normalizer: Public Programs Division Special Events (6v4b-5gp4).
 * No stable event id in live schema sample — sourceRecordId/eventId remain null.
 */

import { asString, createEventLead, splitDateTime } from '../event-lead.mjs';

/**
 * @param {Record<string, unknown>} raw
 * @returns {string|null}
 */
function buildPpdDescription(raw) {
  const parts = ['audience', 'locationtype', 'unit', 'source']
    .map((key) => asString(raw[key]))
    .filter(Boolean);
  return parts.length ? parts.join('; ') : null;
}

/**
 * @param {Record<string, unknown>} raw
 * @param {{ lastFetchedAt?: string|null }} [context]
 */
export function normalizePpdSpecialEvent(raw, context = {}) {
  const parsed = splitDateTime(raw.date_and_time);

  return createEventLead({
    source: 'Public Programs Division Special Events',
    sourceDatasetId: '6v4b-5gp4',
    sourceRecordId: null,
    eventId: null,
    title: asString(raw.event_name),
    eventType: asString(raw.event_type),
    category: asString(raw.category),
    startDate: parsed.date ?? asString(raw.date_and_time),
    startTime: parsed.time,
    endDate: null,
    endTime: null,
    borough: asString(raw.borough),
    locationName: asString(raw.location),
    address: asString(raw.location),
    latitude: null,
    longitude: null,
    description: buildPpdDescription(raw),
    officialUrl: null,
    organizer: asString(raw.group_name_partner) ?? asString(raw.unit) ?? asString(raw.source),
    phone: null,
    email: null,
    isFree: null,
    photoPriorityScore: null,
    rawRecord: raw,
    lastFetchedAt: context.lastFetchedAt ?? null,
  });
}
