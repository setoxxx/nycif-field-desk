import { normalizeFilmPermit } from './film-permits.mjs';
import { enrichParksEventLead } from './parks-joins.mjs';
import { normalizeParksEventListing } from './parks-event-listing.mjs';
import { normalizePpdSpecialEvent } from './ppd-special-events.mjs';
import { normalizeSafetyEvent } from './safety-events.mjs';
import { normalizeTvppPermittedEvent } from './tvpp-permitted-events.mjs';

/** @typedef {import('../event-lead.mjs').EventLead} EventLead */

/**
 * @typedef {(raw: Record<string, unknown>, context?: { lastFetchedAt?: string|null }) => EventLead} EventLeadNormalizer
 */

/** @type {Record<string, EventLeadNormalizer>} */
export const EVENT_LEAD_NORMALIZERS = {
  'tvpp-9vvx': normalizeTvppPermittedEvent,
  'fudw-fgrp': normalizeParksEventListing,
  '6v4b-5gp4': normalizePpdSpecialEvent,
  '3vyj-dkjt': normalizeSafetyEvent,
  'tg4x-b46p': normalizeFilmPermit,
};

/**
 * @param {string} sourceDatasetId
 * @param {Record<string, unknown>} raw
 * @param {{ lastFetchedAt?: string|null }} [context]
 * @returns {EventLead}
 */
export function normalizeEventLead(sourceDatasetId, raw, context = {}) {
  const normalizer = EVENT_LEAD_NORMALIZERS[sourceDatasetId];
  if (!normalizer) {
    throw new Error(`No event lead normalizer registered for source ${sourceDatasetId}`);
  }
  return normalizer(raw, context);
}

export {
  enrichParksEventLead,
  normalizeFilmPermit,
  normalizeParksEventListing,
  normalizePpdSpecialEvent,
  normalizeSafetyEvent,
  normalizeTvppPermittedEvent,
};
