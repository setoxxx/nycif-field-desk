import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  EVENT_SOURCES,
  getEventSourceById,
  isFetchableSocrataSource,
  socrataResourceUrl,
} from './event-source-config.mjs';
import { EVENT_LEAD_FIELDS, hasEventLeadShape } from './event-lead.mjs';
import {
  EVENT_LEAD_NORMALIZERS,
  enrichParksEventLead,
  normalizeEventLead,
  normalizeFilmPermit,
  normalizeParksEventListing,
  normalizePpdSpecialEvent,
  normalizeSafetyEvent,
  normalizeTvppPermittedEvent,
} from './normalizers/index.mjs';
import { buildSocrataRequestUrl } from './socrata-fetch.mjs';
import {
  inferSimpleValueType,
  selectFetchableSchemaSources,
  summarizeRowsForSchema,
} from './schema-inspect.mjs';

const EXPECTED_SOURCE_IDS = [
  'tvpp-9vvx',
  'fudw-fgrp',
  'cpcm-i88g',
  'xtsw-fqvh',
  'ridc-7qqg',
  '6eti-k994',
  'jk6k-yab4',
  '6v4b-5gp4',
  '3vyj-dkjt',
  'tg4x-b46p',
  'dot-trafalrt',
];

const PARKS_JOIN_IDS = ['cpcm-i88g', 'xtsw-fqvh', 'ridc-7qqg', '6eti-k994', 'jk6k-yab4'];

describe('event source inventory', () => {
  it('includes all configured source IDs and URLs', () => {
    assert.equal(EVENT_SOURCES.length, EXPECTED_SOURCE_IDS.length);
    for (const id of EXPECTED_SOURCE_IDS) {
      const source = getEventSourceById(id);
      assert.ok(source, `missing source ${id}`);
      assert.ok(source.url, `missing url for ${id}`);
    }
  });

  it('uses Socrata resource URLs for JSON datasets', () => {
    for (const source of EVENT_SOURCES) {
      if (source.type !== 'socrata_json') continue;
      assert.equal(source.url, socrataResourceUrl(source.id));
      assert.match(source.url, /^https:\/\/data\.cityofnewyork\.us\/resource\/[^/]+\.json$/);
    }
  });

  it('marks Special Traffic Updates as documented_only and not fetchable', () => {
    const dot = getEventSourceById('dot-trafalrt');
    assert.ok(dot);
    assert.equal(dot.type, 'html_scrape');
    assert.equal(dot.status, 'documented_only');
    assert.equal(dot.priority, 'later');
    assert.equal(isFetchableSocrataSource(dot), false);
  });

  it('declares join_key event_id on Parks join-table configs', () => {
    for (const id of PARKS_JOIN_IDS) {
      const source = getEventSourceById(id);
      assert.ok(source);
      assert.equal(source.joinKey, 'event_id');
      assert.equal(source.priority === 'core_join' || source.priority === 'enrichment', true);
    }
  });
});

describe('Socrata request URL builder', () => {
  it('supports limit, where, and order parameters', () => {
    const source = getEventSourceById('tvpp-9vvx');
    const url = buildSocrataRequestUrl(source, {
      limit: 10,
      where: "start_date_time >= '2026-07-01T00:00:00'",
      order: 'start_date_time',
    });
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get('$limit'), '10');
    assert.ok(parsed.searchParams.get('$where')?.includes('2026-07-01'));
    assert.equal(parsed.searchParams.get('$order'), 'start_date_time');
  });

  it('rejects documented_only sources', () => {
    const dot = getEventSourceById('dot-trafalrt');
    assert.throws(() => buildSocrataRequestUrl(dot, { limit: 1 }), /not fetchable/i);
  });
});

describe('event lead normalizers', () => {
  it('registers core source normalizer stubs', () => {
    assert.ok(EVENT_LEAD_NORMALIZERS['tvpp-9vvx']);
    assert.ok(EVENT_LEAD_NORMALIZERS['fudw-fgrp']);
    assert.ok(EVENT_LEAD_NORMALIZERS['6v4b-5gp4']);
    assert.ok(EVENT_LEAD_NORMALIZERS['3vyj-dkjt']);
    assert.ok(EVENT_LEAD_NORMALIZERS['tg4x-b46p']);
  });

  it('normalizes tvpp permitted events from live schema fields', () => {
    const lead = normalizeTvppPermittedEvent({
      event_id: '947413',
      event_name: 'FWC2026',
      start_date_time: '2026-07-01T10:00:00.000',
      end_date_time: '2026-07-01T18:00:00.000',
      event_type: 'Street Event',
      event_agency: 'Street Activity Permit Office',
      event_borough: 'Manhattan',
      event_location: 'MADISON AVENUE between EAST 51 STREET and EAST 50 STREET',
      street_closure_type: 'Partial',
      latitude: '40.7614',
      lat: '40.7614',
      longitude: '-73.9776',
      lng: '-73.9776',
    }, { lastFetchedAt: '2026-07-01T12:00:00.000Z' });

    assert.equal(lead.sourceDatasetId, 'tvpp-9vvx');
    assert.equal(lead.eventId, '947413');
    assert.equal(lead.title, 'FWC2026');
    assert.equal(lead.startDate, '2026-07-01');
    assert.equal(lead.startTime, '10:00:00');
    assert.equal(lead.borough, 'Manhattan');
    assert.equal(lead.description, 'Partial');
    assert.equal(lead.latitude, null);
    assert.equal(lead.longitude, null);
    assert.ok(hasEventLeadShape(lead));
  });

  it('falls back to cemsid for tvpp record id when event_id absent', () => {
    const lead = normalizeTvppPermittedEvent({
      cemsid: 'CEMS-99',
      event_name: 'Fallback Event',
      start_date_time: '2026-07-02T09:00:00',
    });
    assert.equal(lead.sourceRecordId, 'CEMS-99');
    assert.equal(lead.eventId, 'CEMS-99');
    assert.ok(hasEventLeadShape(lead));
  });

  it('normalizes parks listing from live schema fields without join-table assumptions', () => {
    const parks = normalizeParksEventListing({
      event_id: '100073',
      title: 'Summer Concert',
      date: '2026-08-01',
      start_time: '19:00:00',
      end_time: '21:00:00',
      cost_free: 'true',
      location_description: 'Prospect Park Bandshell',
      description: 'Outdoor music',
      url: 'https://example.com/event',
      phone: '212-555-0100',
      email: 'events@example.com',
      borough: 'Brooklyn',
      latitude: '40.6602',
      organizer: 'NYC Parks',
      category: 'Music',
    });

    assert.equal(parks.sourceDatasetId, 'fudw-fgrp');
    assert.equal(parks.eventId, '100073');
    assert.equal(parks.title, 'Summer Concert');
    assert.equal(parks.startDate, '2026-08-01');
    assert.equal(parks.startTime, '19:00:00');
    assert.equal(parks.endDate, '2026-08-01');
    assert.equal(parks.endTime, '21:00:00');
    assert.equal(parks.locationName, 'Prospect Park Bandshell');
    assert.equal(parks.isFree, true);
    assert.equal(parks.borough, null);
    assert.equal(parks.address, null);
    assert.equal(parks.latitude, null);
    assert.equal(parks.longitude, null);
    assert.equal(parks.organizer, null);
    assert.equal(parks.eventType, null);
    assert.equal(parks.category, null);
    assert.ok(hasEventLeadShape(parks));
  });

  it('normalizes ppd special events from date_and_time without inventing ids', () => {
    const ppd = normalizePpdSpecialEvent({
      event_name: 'Community Day',
      event_type: 'Festival',
      category: 'Community',
      date_and_time: '2026-09-01T12:00:00',
      borough: 'Queens',
      location: 'Flushing Meadows',
      group_name_partner: 'Queens Borough President',
      audience: 'Families',
      locationtype: 'Park',
      unit: 'PPD',
      source: 'NYC Parks',
      event_id: 'should-not-use',
      id: 'also-ignore',
    });

    assert.equal(ppd.sourceDatasetId, '6v4b-5gp4');
    assert.equal(ppd.eventId, null);
    assert.equal(ppd.sourceRecordId, null);
    assert.equal(ppd.title, 'Community Day');
    assert.equal(ppd.startDate, '2026-09-01');
    assert.equal(ppd.startTime, '12:00:00');
    assert.equal(ppd.organizer, 'Queens Borough President');
    assert.equal(ppd.description, 'Families; Park; PPD; NYC Parks');
    assert.ok(hasEventLeadShape(ppd));
  });

  it('normalizes safety events from program/community_site without inventing ids', () => {
    const safety = normalizeSafetyEvent({
      program: 'Fire Safety Outreach',
      community_site: 'Bronx Community Center',
      event_date: '2026-10-01',
      name_of_org: 'FDNY',
      borough: 'Bronx',
      address: '123 Main St',
      latitude: '40.8448',
      longitude: '-73.8648',
      served_by: 'FDNY',
      handonsdisp1: 'Hands-on demo',
      event_id: 'ignore-me',
      event_name: 'ignore-me',
    });

    assert.equal(safety.sourceDatasetId, '3vyj-dkjt');
    assert.equal(safety.eventId, null);
    assert.equal(safety.sourceRecordId, null);
    assert.equal(safety.title, 'Fire Safety Outreach');
    assert.equal(safety.eventType, 'Fire Safety Outreach');
    assert.equal(safety.startDate, '2026-10-01');
    assert.equal(safety.startTime, null);
    assert.equal(safety.locationName, 'Bronx Community Center');
    assert.equal(safety.latitude, 40.8448);
    assert.equal(safety.longitude, -73.8648);
    assert.equal(safety.organizer, 'FDNY');
    assert.ok(hasEventLeadShape(safety));
  });

  it('normalizes film permits and maps eventagency to organizer', () => {
    const film = normalizeFilmPermit({
      eventid: 'film-1',
      category: 'Film',
      subcategoryname: 'Feature Production',
      eventtype: 'Television',
      eventagency: 'Mayor\'s Office of Media and Entertainment',
      borough: 'Manhattan',
      parkingheld: 'BROADWAY between W 42 STREET and W 43 STREET',
      startdatetime: '2026-11-01T06:00:00',
      enddatetime: '2026-11-01T20:00:00',
    });

    assert.equal(film.sourceDatasetId, 'tg4x-b46p');
    assert.equal(film.eventId, 'film-1');
    assert.equal(film.title, 'Feature Production');
    assert.equal(film.organizer, 'Mayor\'s Office of Media and Entertainment');
    assert.equal(film.locationName, film.address);
    assert.equal(film.latitude, null);
    assert.ok(hasEventLeadShape(film));
  });

  it('routes normalizeEventLead by source dataset id', () => {
    const lead = normalizeEventLead('tvpp-9vvx', {
      event_id: '1',
      event_name: 'Test Event',
      start_date_time: '2026-07-04T00:00:00',
    });
    assert.equal(lead.sourceDatasetId, 'tvpp-9vvx');
    assert.equal(lead.title, 'Test Event');
  });
});

describe('parks join enrichment', () => {
  const baseParksLead = () => normalizeParksEventListing({
    event_id: '100073',
    title: 'Summer Concert',
    date: '2026-08-01',
    start_time: '19:00:00',
    end_time: '21:00:00',
    location_description: 'Prospect Park Bandshell',
    url: 'https://example.com/listing',
  });

  it('fills location fields from cpcm-i88g join rows', () => {
    const base = baseParksLead();
    const enriched = enrichParksEventLead(base, {
      locations: [{
        event_id: '100073',
        name: 'Prospect Park Bandshell',
        address: 'Prospect Park West',
        borough: 'Brooklyn',
        lat: '40.6602',
        long: '-73.9690',
      }],
    });

    assert.equal(enriched.borough, 'Brooklyn');
    assert.equal(enriched.locationName, 'Prospect Park Bandshell');
    assert.equal(enriched.address, 'Prospect Park West');
    assert.equal(enriched.latitude, 40.6602);
    assert.equal(enriched.longitude, -73.969);
    assert.ok(hasEventLeadShape(enriched));
  });

  it('fills category from xtsw-fqvh join rows', () => {
    const enriched = enrichParksEventLead(baseParksLead(), {
      categories: [
        { event_id: '100073', name: 'Music' },
        { event_id: '100073', name: 'Outdoor' },
      ],
    });

    assert.equal(enriched.category, 'Music, Outdoor');
    assert.equal(enriched.eventType, null);
    assert.ok(hasEventLeadShape(enriched));
  });

  it('fills officialUrl from ridc-7qqg join rows', () => {
    const enriched = enrichParksEventLead(baseParksLead(), {
      links: [
        { event_id: '100073', link_name: 'Tickets', link_url: 'https://example.com/tickets' },
        { event_id: '100073', link_name: 'More Info', link_url: 'https://example.com/info' },
      ],
    });

    assert.equal(enriched.officialUrl, 'https://example.com/info');
    assert.ok(hasEventLeadShape(enriched));
  });

  it('fills organizer from jk6k-yab4 join rows', () => {
    const enriched = enrichParksEventLead(baseParksLead(), {
      organizers: [{ event_id: '100073', event_organizer: 'NYC Parks' }],
    });

    assert.equal(enriched.organizer, 'NYC Parks');
    assert.ok(hasEventLeadShape(enriched));
  });

  it('leaves base lead unchanged when join rows are missing', () => {
    const base = baseParksLead();
    const enriched = enrichParksEventLead(base, {});

    assert.equal(enriched.title, base.title);
    assert.equal(enriched.borough, null);
    assert.equal(enriched.category, null);
    assert.equal(enriched.organizer, null);
    assert.equal(enriched.officialUrl, 'https://example.com/listing');
    assert.ok(hasEventLeadShape(enriched));
  });

  it('does not mutate the original base lead', () => {
    const base = baseParksLead();
    const snapshot = { ...base };

    enrichParksEventLead(base, {
      locations: [{
        event_id: '100073',
        name: 'Prospect Park Bandshell',
        borough: 'Brooklyn',
        lat: '40.6602',
        long: '-73.9690',
      }],
    });

    assert.deepEqual(base, snapshot);
  });
});

describe('schema inspection helpers', () => {
  it('skips documented_only sources in schema inspector planner', () => {
    const selected = selectFetchableSchemaSources();
    assert.ok(!selected.some((source) => source.id === 'dot-trafalrt'));
    assert.equal(isFetchableSocrataSource(getEventSourceById('dot-trafalrt')), false);
  });

  it('selects fetchable Socrata sources', () => {
    const selected = selectFetchableSchemaSources();
    assert.equal(selected.length, 10);
    for (const source of selected) {
      assert.equal(source.type, 'socrata_json');
      assert.notEqual(source.status, 'documented_only');
    }
  });

  it('summarizes empty rows', () => {
    const summary = summarizeRowsForSchema([]);
    assert.equal(summary.rowCount, 0);
    assert.equal(summary.hasEmptyRows, false);
    assert.deepEqual(summary.fieldNames, []);
    assert.deepEqual(summary.fieldTypes, {});
  });

  it('summarizes rows with different fields', () => {
    const summary = summarizeRowsForSchema([
      { event_id: '1', event_name: 'A' },
      { event_id: '2', borough: 'Manhattan' },
      {},
    ]);

    assert.equal(summary.rowCount, 3);
    assert.equal(summary.hasEmptyRows, true);
    assert.deepEqual(summary.fieldNames, ['borough', 'event_id', 'event_name']);
    assert.deepEqual(summary.fieldTypes.event_id, ['string']);
    assert.deepEqual(summary.fieldTypes.event_name, ['string']);
    assert.deepEqual(summary.fieldTypes.borough, ['string']);
  });

  it('infers simple value types', () => {
    assert.equal(inferSimpleValueType(null), 'null');
    assert.equal(inferSimpleValueType('text'), 'string');
    assert.equal(inferSimpleValueType(42), 'integer');
    assert.equal(inferSimpleValueType(3.14), 'number');
    assert.equal(inferSimpleValueType(true), 'boolean');
    assert.equal(inferSimpleValueType({ nested: true }), 'object');
    assert.equal(inferSimpleValueType([1, 2]), 'array');
  });
});
