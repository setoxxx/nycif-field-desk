/**
 * Normalizer: Safety Events (3vyj-dkjt).
 * Outreach/site visit records — no stable event id in live schema sample.
 */

import { asNumber, asString, createEventLead } from '../event-lead.mjs';

/**
 * @param {Record<string, unknown>} raw
 * @param {{ lastFetchedAt?: string|null }} [context]
 */
export function normalizeSafetyEvent(raw, context = {}) {
  return createEventLead({
    source: 'Safety Events',
    sourceDatasetId: '3vyj-dkjt',
    sourceRecordId: null,
    eventId: null,
    title: asString(raw.program) ?? asString(raw.community_site) ?? asString(raw.name_of_org),
    eventType: asString(raw.program),
    category: asString(raw.served_by) ?? asString(raw.citywide_outreach),
    startDate: asString(raw.event_date),
    startTime: null,
    endDate: null,
    endTime: null,
    borough: asString(raw.borough),
    locationName: asString(raw.community_site) ?? asString(raw.name_of_org),
    address: asString(raw.address),
    latitude: asNumber(raw.latitude),
    longitude: asNumber(raw.longitude),
    description: asString(raw.handonsdisp1) ?? asString(raw.agedisp),
    officialUrl: null,
    organizer: asString(raw.name_of_org) ?? asString(raw.served_by),
    phone: null,
    email: null,
    isFree: null,
    photoPriorityScore: null,
    rawRecord: raw,
    lastFetchedAt: context.lastFetchedAt ?? null,
  });
}
