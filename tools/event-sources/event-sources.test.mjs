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

  it('normalizes tvpp permitted events with common lead fields', () => {
    const lead = normalizeTvppPermittedEvent({
      event_id: '947413',
      event_name: 'FWC2026',
      start_date_time: '2026-07-01T10:00:00.000',
      end_date_time: '2026-07-01T18:00:00.000',
      event_type: 'Street Event',
      event_agency: 'Street Activity Permit Office',
      event_borough: 'Manhattan',
      event_location: 'MADISON AVENUE between EAST 51 STREET and EAST 50 STREET',
    }, { lastFetchedAt: '2026-07-01T12:00:00.000Z' });

    assert.equal(lead.sourceDatasetId, 'tvpp-9vvx');
    assert.equal(lead.eventId, '947413');
    assert.equal(lead.title, 'FWC2026');
    assert.equal(lead.startDate, '2026-07-01');
    assert.equal(lead.startTime, '10:00:00');
    assert.equal(lead.borough, 'Manhattan');
    assert.ok(hasEventLeadShape(lead));
    for (const field of EVENT_LEAD_FIELDS) {
      assert.ok(Object.prototype.hasOwnProperty.call(lead, field), `missing field ${field}`);
    }
  });

  it('normalizes parks, ppd, safety, and film permit stubs', () => {
    const parks = normalizeParksEventListing({
      event_id: '100073',
      event_name: 'Summer Concert',
      start_date_time: '2026-08-01T19:00:00',
      borough: 'Brooklyn',
      location: 'Prospect Park',
    });
    assert.equal(parks.sourceDatasetId, 'fudw-fgrp');
    assert.equal(parks.eventId, '100073');

    const ppd = normalizePpdSpecialEvent({
      event_id: 'ppd-1',
      event_name: 'Community Day',
      start_date_time: '2026-09-01T12:00:00',
      borough: 'Queens',
    });
    assert.equal(ppd.sourceDatasetId, '6v4b-5gp4');

    const safety = normalizeSafetyEvent({
      event_id: 'safe-1',
      event_name: 'Safety Fair',
      start_date_time: '2026-10-01T09:00:00',
      borough: 'Bronx',
    });
    assert.equal(safety.sourceDatasetId, '3vyj-dkjt');

    const film = normalizeFilmPermit({
      eventid: 'film-1',
      category: 'Film',
      subcategoryname: 'Feature Production',
      borough: 'Manhattan',
      parkingheld: 'BROADWAY between W 42 STREET and W 43 STREET',
      startdatetime: '2026-11-01T06:00:00',
      enddatetime: '2026-11-01T20:00:00',
    });
    assert.equal(film.sourceDatasetId, 'tg4x-b46p');
    assert.equal(film.locationName, film.address);
    assert.equal(film.latitude, null);
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
