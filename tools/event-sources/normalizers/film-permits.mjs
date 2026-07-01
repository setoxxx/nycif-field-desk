/**
 * Normalization stub: Film Permits (tg4x-b46p).
 */

import { asString, createEventLead, splitDateTime } from '../event-lead.mjs';

/**
 * @param {Record<string, unknown>} raw
 * @param {{ lastFetchedAt?: string|null }} [context]
 */
export function normalizeFilmPermit(raw, context = {}) {
  const start = splitDateTime(raw.startdatetime ?? raw.start_date_time);
  const end = splitDateTime(raw.enddatetime ?? raw.end_date_time);

  return createEventLead({
    source: 'Film Permits',
    sourceDatasetId: 'tg4x-b46p',
    sourceRecordId: asString(raw.eventid ?? raw.event_id),
    eventId: asString(raw.eventid ?? raw.event_id),
    title: asString(raw.subcategoryname ?? raw.eventtype ?? raw.category),
    eventType: asString(raw.eventtype),
    category: asString(raw.category),
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
    organizer: null,
    phone: null,
    email: null,
    isFree: null,
    photoPriorityScore: null,
    rawRecord: raw,
    lastFetchedAt: context.lastFetchedAt ?? null,
  });
}
