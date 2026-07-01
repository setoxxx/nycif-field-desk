/**
 * Normalization stub: NYC Parks Events Listing – Event Listing (fudw-fgrp).
 * Join tables (locations, categories, links, images, organizers) merge by event_id in future work.
 */

import { asNumber, asString, createEventLead, splitDateTime } from '../event-lead.mjs';

/**
 * @param {Record<string, unknown>} raw
 * @param {{ lastFetchedAt?: string|null }} [context]
 */
export function normalizeParksEventListing(raw, context = {}) {
  const start = splitDateTime(raw.start_date_time ?? raw.startdate ?? raw.start_date);
  const end = splitDateTime(raw.end_date_time ?? raw.enddate ?? raw.end_date);

  return createEventLead({
    source: 'NYC Parks Events Listing',
    sourceDatasetId: 'fudw-fgrp',
    sourceRecordId: asString(raw.event_id ?? raw.eventid),
    eventId: asString(raw.event_id ?? raw.eventid),
    title: asString(raw.event_name ?? raw.name ?? raw.title),
    eventType: asString(raw.event_type ?? raw.type),
    category: asString(raw.category ?? raw.event_category),
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
    borough: asString(raw.borough),
    locationName: asString(raw.location ?? raw.location_name ?? raw.park_name),
    address: asString(raw.address),
    latitude: asNumber(raw.latitude ?? raw.lat),
    longitude: asNumber(raw.longitude ?? raw.long ?? raw.lng),
    description: asString(raw.description ?? raw.event_description),
    officialUrl: asString(raw.url ?? raw.event_url ?? raw.website),
    organizer: asString(raw.organizer ?? raw.event_host),
    phone: asString(raw.phone ?? raw.contact_phone),
    email: asString(raw.email ?? raw.contact_email),
    isFree: raw.is_free === true || raw.is_free === 'true' ? true : raw.is_free === false || raw.is_free === 'false' ? false : null,
    photoPriorityScore: null,
    rawRecord: raw,
    lastFetchedAt: context.lastFetchedAt ?? null,
  });
}
