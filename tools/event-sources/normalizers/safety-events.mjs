/**
 * Normalization stub: Safety Events (3vyj-dkjt).
 */

import { asNumber, asString, createEventLead, splitDateTime } from '../event-lead.mjs';

/**
 * @param {Record<string, unknown>} raw
 * @param {{ lastFetchedAt?: string|null }} [context]
 */
export function normalizeSafetyEvent(raw, context = {}) {
  const start = splitDateTime(raw.start_date_time ?? raw.startdate ?? raw.event_date);
  const end = splitDateTime(raw.end_date_time ?? raw.enddate);

  return createEventLead({
    source: 'Safety Events',
    sourceDatasetId: '3vyj-dkjt',
    sourceRecordId: asString(raw.event_id ?? raw.id ?? raw.objectid),
    eventId: asString(raw.event_id ?? raw.id),
    title: asString(raw.event_name ?? raw.name ?? raw.title),
    eventType: asString(raw.event_type ?? raw.type),
    category: asString(raw.category),
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
    borough: asString(raw.borough),
    locationName: asString(raw.location ?? raw.event_location),
    address: asString(raw.address),
    latitude: asNumber(raw.latitude ?? raw.lat),
    longitude: asNumber(raw.longitude ?? raw.long ?? raw.lng),
    description: asString(raw.description ?? raw.event_description),
    officialUrl: asString(raw.url),
    organizer: asString(raw.organizer ?? raw.agency),
    phone: asString(raw.phone),
    email: asString(raw.email),
    isFree: null,
    photoPriorityScore: null,
    rawRecord: raw,
    lastFetchedAt: context.lastFetchedAt ?? null,
  });
}
