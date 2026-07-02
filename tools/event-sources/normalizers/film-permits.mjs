/**
 * Normalizer: Film Permits (tg4x-b46p).
 * Film permits are production/permit street-closure activity, not necessarily public events.
 */

import { asString, createEventLead, splitDateTime } from '../event-lead.mjs';

/**
 * @param {Record<string, unknown>} raw
 * @param {{ lastFetchedAt?: string|null }} [context]
 */
export function normalizeFilmPermit(raw, context = {}) {
  const start = splitDateTime(raw.startdatetime);
  const end = splitDateTime(raw.enddatetime);

  return createEventLead({
    source: 'Film Permits',
    sourceDatasetId: 'tg4x-b46p',
    sourceRecordId: asString(raw.eventid),
    eventId: asString(raw.eventid),
    title: asString(raw.subcategoryname) ?? asString(raw.eventtype) ?? asString(raw.category) ?? 'Film Permit',
    eventType: asString(raw.eventtype),
    category: asString(raw.category) ?? asString(raw.subcategoryname),
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
    borough: asString(raw.borough),
    locationName: asString(raw.parkingheld),
    address: asString(raw.parkingheld),
    latitude: null,
    longitude: null,
    description: asString(raw.parkingheld),
    officialUrl: null,
    organizer: asString(raw.eventagency),
    phone: null,
    email: null,
    isFree: null,
    photoPriorityScore: null,
    rawRecord: raw,
    lastFetchedAt: context.lastFetchedAt ?? null,
  });
}
