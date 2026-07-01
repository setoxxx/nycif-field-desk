/**
 * Normalization stub: NYC Permitted Event Information (tvpp-9vvx).
 */

import { asNumber, asString, createEventLead, splitDateTime } from '../event-lead.mjs';

/**
 * @param {Record<string, unknown>} raw
 * @param {{ lastFetchedAt?: string|null }} [context]
 */
export function normalizeTvppPermittedEvent(raw, context = {}) {
  const start = splitDateTime(raw.start_date_time);
  const end = splitDateTime(raw.end_date_time);

  return createEventLead({
    source: 'NYC Permitted Event Information',
    sourceDatasetId: 'tvpp-9vvx',
    sourceRecordId: asString(raw.event_id),
    eventId: asString(raw.event_id),
    title: asString(raw.event_name),
    eventType: asString(raw.event_type),
    category: asString(raw.event_agency),
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
    borough: asString(raw.event_borough),
    locationName: asString(raw.event_location),
    address: asString(raw.event_location),
    latitude: asNumber(raw.latitude ?? raw.lat),
    longitude: asNumber(raw.longitude ?? raw.long ?? raw.lng),
    description: asString(raw.street_closure_type),
    officialUrl: null,
    organizer: asString(raw.event_agency),
    phone: null,
    email: null,
    isFree: null,
    photoPriorityScore: null,
    rawRecord: raw,
    lastFetchedAt: context.lastFetchedAt ?? null,
  });
}
