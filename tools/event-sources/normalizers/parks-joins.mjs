/**
 * Pure Parks join enrichment for normalized fudw-fgrp EventLeads.
 * Fixture-only — not wired to production feeds or map runtime.
 */

import { asNumber, asString, createEventLead } from '../event-lead.mjs';

/** @typedef {import('../event-lead.mjs').EventLead} EventLead */

/**
 * @typedef {Object} ParksJoinRows
 * @property {Record<string, unknown>[]} [locations] cpcm-i88g
 * @property {Record<string, unknown>[]} [categories] xtsw-fqvh
 * @property {Record<string, unknown>[]} [links] ridc-7qqg
 * @property {Record<string, unknown>[]} [organizers] jk6k-yab4
 */

/**
 * @param {Record<string, unknown>[]} [rows]
 * @param {string|null|undefined} eventId
 * @returns {Record<string, unknown>[]}
 */
function rowsForEventId(rows, eventId) {
  if (!eventId || !rows?.length) return [];
  return rows.filter((row) => asString(row.event_id) === eventId);
}

/**
 * @param {Record<string, unknown>[]} links
 * @returns {string|null}
 */
function pickOfficialUrl(links) {
  const preferred = links.find((link) => {
    const name = asString(link.link_name)?.toLowerCase() ?? '';
    return name.includes('official') || name.includes('more') || name.includes('info');
  });
  const chosen = preferred ?? links[0];
  return asString(chosen?.link_url);
}

/**
 * @param {Record<string, unknown>[]} categories
 * @returns {string|null}
 */
function joinCategoryNames(categories) {
  const names = categories.map((row) => asString(row.name)).filter(Boolean);
  return names.length ? names.join(', ') : null;
}

/**
 * @param {EventLead} baseLead Normalized lead from fudw-fgrp
 * @param {ParksJoinRows} [joins]
 * @returns {EventLead}
 */
export function enrichParksEventLead(baseLead, joins = {}) {
  const eventId = baseLead.eventId;
  const locations = rowsForEventId(joins.locations, eventId);
  const categories = rowsForEventId(joins.categories, eventId);
  const links = rowsForEventId(joins.links, eventId);
  const organizers = rowsForEventId(joins.organizers, eventId);

  /** @type {Partial<EventLead>} */
  const patch = {};

  const location = locations[0];
  if (location) {
    const borough = asString(location.borough);
    if (borough) patch.borough = borough;

    patch.locationName = asString(location.name) ?? baseLead.locationName;

    const address = asString(location.address);
    if (address) patch.address = address;

    const latitude = asNumber(location.lat);
    const longitude = asNumber(location.long);
    if (latitude != null) patch.latitude = latitude;
    if (longitude != null) patch.longitude = longitude;
  }

  if (categories.length) {
    const category = joinCategoryNames(categories);
    if (category) patch.category = category;
  }

  if (links.length) {
    const officialUrl = pickOfficialUrl(links);
    if (officialUrl) patch.officialUrl = officialUrl;
  }

  const organizerRow = organizers[0];
  const organizer = asString(organizerRow?.event_organizer);
  if (organizer) patch.organizer = organizer;

  return createEventLead({ ...baseLead, ...patch });
}
