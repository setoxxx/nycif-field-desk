/**
 * Normalization stub: Public Programs Division Special Events (6v4b-5gp4).
 */

import { asNumber, asString, createEventLead, splitDateTime } from '../event-lead.mjs';

/**
 * @param {Record<string, unknown>} raw
 * @param {{ lastFetchedAt?: string|null }} [context]
 */
export function normalizePpdSpecialEvent(raw, context = {}) {
  const start = splitDateTime(raw.start_date_time ?? raw.startdate ?? raw.event_date);
  const end = splitDateTime(raw.end_date_time ?? raw.enddate);

  return createEventLead({
    source: 'Public Programs Division Special Events',
    sourceDatasetId: '6v4b-5gp4',
    sourceRecordId: asString(raw.event_id ?? raw.id ?? raw.objectid),
    eventId: asString(raw.event_id ?? raw.id),
    title: asString(raw.event_name ?? raw.name ?? raw.title),
    eventType: asString(raw.event_type ?? raw.type),
    category: asString(raw.category ?? raw.program),
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
    borough: asString(raw.borough),
    locationName: asString(raw.location ?? raw.event_location ?? raw.site),
    address: asString(raw.address ?? raw.location_address),
    latitude: asNumber(raw.latitude ?? raw.lat),
    longitude: asNumber(raw.longitude ?? raw.long ?? raw.lng),
    description: asString(raw.description ?? raw.event_description),
    officialUrl: asString(raw.url ?? raw.event_url),
    organizer: asString(raw.organizer ?? raw.agency),
    phone: asString(raw.phone),
    email: asString(raw.email),
    isFree: null,
    photoPriorityScore: null,
    rawRecord: raw,
    lastFetchedAt: context.lastFetchedAt ?? null,
  });
}
