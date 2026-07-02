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
import {
  buildBaseFetchOptions,
  buildEventIdWhereClause,
  buildUpcomingDateWhereClause,
  DEFAULT_SAMPLE_LIMIT,
  DEFAULT_SAMPLE_ORDER,
  groupRowsByEventId,
  MAX_SAMPLE_LIMIT,
  parseSamplePipelineArgs,
} from './parks-pipeline.mjs';
import { parseCostFree } from './normalizers/parks-event-listing.mjs';
import {
  buildMultiSourceFreshnessReport,
  buildSourceFetchOptions,
  buildSourceFreshnessEntry,
  classifyFreshness,
  computeDateRange,
  CORE_SAMPLE_SOURCE_IDS,
  parseMultiSourceFreshnessArgs,
  selectSampleSourceIds,
} from './source-freshness.mjs';
import {
  buildFilmQueryStrategies,
  buildParksQueryStrategies,
  buildPpdQueryStrategies,
  buildQueryStrategiesForSource,
  buildQueryTuningReport,
  buildSafetyQueryStrategies,
  buildSourceTuningEntry,
  buildTvppQueryStrategies,
  classifyFreshnessFromDates,
  computeDateRangeFromDates,
  CORE_TUNING_SOURCE_IDS,
  extractSampleDates,
  getDateExtractorForSource,
  parseDatePrefix,
  parseQueryTuningArgs,
  recommendSourceStrategy,
  selectTuningSourceIds,
  summarizeStrategyResult,
} from './query-tuning.mjs';
import {
  buildTvppAssignmentFeedReport,
  buildTvppFetchOptions,
  buildTvppWhereClause,
  DEFAULT_TVPP_FEED_LIMIT,
  escapeSoqlString,
  MAX_TVPP_FEED_LIMIT,
  parseTvppAssignmentFeedArgs,
  sortLeadsByStartDateTime,
  TVPP_FEED_ORDER,
  TVPP_SOURCE_DATASET_ID,
} from './tvpp-assignment-feed.mjs';

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

  it('maps cost_free "1" to isFree true and "0" to false', () => {
    const paid = normalizeParksEventListing({ event_id: '1', title: 'Paid', cost_free: '0' });
    const free = normalizeParksEventListing({ event_id: '2', title: 'Free', cost_free: '1' });
    const unknown = normalizeParksEventListing({ event_id: '3', title: 'Unknown', cost_free: 'maybe' });

    assert.equal(paid.isFree, false);
    assert.equal(free.isFree, true);
    assert.equal(unknown.isFree, null);
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

describe('parks sample pipeline helpers', () => {
  const fixedToday = new Date('2026-07-01T12:00:00');

  it('uses default CLI limit and enables upcoming filter by default', () => {
    const args = parseSamplePipelineArgs([], { today: fixedToday });
    assert.equal(args.limit, DEFAULT_SAMPLE_LIMIT);
    assert.equal(args.pretty, false);
    assert.equal(args.help, false);
    assert.equal(args.upcoming, true);
    assert.equal(args.fromDate, '2026-07-01');
    assert.equal(args.order, DEFAULT_SAMPLE_ORDER);
  });

  it('parses custom limit, pretty flag, and from-date', () => {
    const args = parseSamplePipelineArgs(
      ['--limit', '5', '--pretty', '--from-date', '2026-08-15'],
      { today: fixedToday },
    );
    assert.equal(args.limit, 5);
    assert.equal(args.pretty, true);
    assert.equal(args.fromDate, '2026-08-15');
    assert.equal(args.upcoming, true);
  });

  it('caps limit at max', () => {
    const args = parseSamplePipelineArgs(['--limit=99'], { today: fixedToday });
    assert.equal(args.limit, MAX_SAMPLE_LIMIT);
  });

  it('disables upcoming filter with --no-upcoming', () => {
    const args = parseSamplePipelineArgs(['--no-upcoming'], { today: fixedToday });
    assert.equal(args.upcoming, false);
  });

  it('disables upcoming filter with --all-dates alias', () => {
    const args = parseSamplePipelineArgs(['--all-dates'], { today: fixedToday });
    assert.equal(args.upcoming, false);
  });

  it('buildUpcomingDateWhereClause uses Parks date literal style', () => {
    assert.equal(
      buildUpcomingDateWhereClause('2026-07-01'),
      "date >= '2026-07-01T00:00:00.000'",
    );
  });

  it('buildBaseFetchOptions applies upcoming where and default order', () => {
    const options = buildBaseFetchOptions({
      limit: 3,
      upcoming: true,
      fromDate: '2026-07-01',
      order: DEFAULT_SAMPLE_ORDER,
      pretty: false,
      help: false,
    });

    assert.equal(options.limit, 3);
    assert.equal(options.where, "date >= '2026-07-01T00:00:00.000'");
    assert.equal(options.order, 'date ASC');
  });

  it('buildBaseFetchOptions omits filter when upcoming disabled', () => {
    const options = buildBaseFetchOptions({
      limit: 3,
      upcoming: false,
      fromDate: '2026-07-01',
      order: DEFAULT_SAMPLE_ORDER,
      pretty: false,
      help: false,
    });

    assert.equal(options.limit, 3);
    assert.equal(options.where, undefined);
    assert.equal(options.order, undefined);
  });

  it('parseCostFree handles Parks numeric string flags', () => {
    assert.equal(parseCostFree('1'), true);
    assert.equal(parseCostFree('0'), false);
    assert.equal(parseCostFree('maybe'), null);
    assert.equal(parseCostFree(null), null);
  });

  it('buildEventIdWhereClause escapes single quotes', () => {
    assert.equal(
      buildEventIdWhereClause(['100073', "O'Brien"]),
      "event_id in ('100073','O''Brien')",
    );
  });

  it('buildEventIdWhereClause returns null for empty ids', () => {
    assert.equal(buildEventIdWhereClause([]), null);
  });

  it('groupRowsByEventId groups rows correctly', () => {
    const grouped = groupRowsByEventId([
      { event_id: '1', name: 'A' },
      { event_id: '2', name: 'B' },
      { event_id: '1', name: 'C' },
      { title: 'missing id' },
    ]);

    assert.equal(grouped['1'].length, 2);
    assert.equal(grouped['2'].length, 1);
    assert.equal(grouped['1'][0].name, 'A');
    assert.equal(grouped['1'][1].name, 'C');
  });
});

describe('multi-source freshness helpers', () => {
  const fixedToday = new Date('2026-07-01T12:00:00');
  const todayIso = '2026-07-01';

  it('classifies freshness as empty, current, stale, and unknown', () => {
    assert.equal(classifyFreshness([], todayIso), 'empty');
    assert.equal(classifyFreshness([{ startDate: '2026-08-01' }], todayIso), 'current');
    assert.equal(classifyFreshness([{ startDate: '2025-01-01' }], todayIso), 'stale');
    assert.equal(classifyFreshness([{ startDate: null }], todayIso), 'unknown');
  });

  it('computes date range from lead startDate values', () => {
    assert.deepEqual(
      computeDateRange([
        { startDate: '2026-08-01' },
        { startDate: '2026-10-21T00:00:00.000' },
        { startDate: '2026-09-15' },
      ]),
      { min: '2026-08-01', max: '2026-10-21' },
    );
  });

  it('builds source freshness entry and multi-source report shape', () => {
    const leads = [{ startDate: '2026-08-01', title: 'A' }];
    const entry = buildSourceFreshnessEntry({
      sourceDatasetId: 'tvpp-9vvx',
      source: 'NYC Permitted Event Information',
      rowCount: 1,
      leads,
      todayIso,
    });

    assert.equal(entry.sourceDatasetId, 'tvpp-9vvx');
    assert.equal(entry.leadCount, 1);
    assert.equal(entry.freshness, 'current');
    assert.deepEqual(entry.dateRange, { min: '2026-08-01', max: '2026-08-01' });

    const report = buildMultiSourceFreshnessReport([entry], 3, '2026-07-01T00:00:00.000Z');
    assert.equal(report.limit, 3);
    assert.equal(report.sources.length, 1);
    assert.equal(report.generatedAt, '2026-07-01T00:00:00.000Z');
  });

  it('filters sample sources by dataset id', () => {
    const args = parseMultiSourceFreshnessArgs(['--source', '3vyj-dkjt'], { today: fixedToday });
    assert.deepEqual(selectSampleSourceIds(args), ['3vyj-dkjt']);
  });

  it('caps CLI limit via shared parser', () => {
    const args = parseMultiSourceFreshnessArgs(['--limit=99'], { today: fixedToday });
    assert.equal(args.limit, MAX_SAMPLE_LIMIT);
  });

  it('buildSourceFetchOptions applies source-specific upcoming filters', () => {
    const args = parseMultiSourceFreshnessArgs(['--from-date', '2026-07-01'], { today: fixedToday });

    const tvpp = buildSourceFetchOptions('tvpp-9vvx', args);
    assert.match(tvpp.where ?? '', /start_date_time >= '2026-07-01T00:00:00'/);
    assert.equal(tvpp.order, 'start_date_time ASC');

    const safety = buildSourceFetchOptions('3vyj-dkjt', args);
    assert.equal(safety.where, "event_date >= '2026-07-01'");

    const ppd = buildSourceFetchOptions('6v4b-5gp4', args);
    assert.equal(ppd.where, undefined);

    const allDates = buildSourceFetchOptions('tvpp-9vvx', {
      ...args,
      upcoming: false,
    });
    assert.equal(allDates.where, undefined);
  });

  it('lists all core sample source ids', () => {
    assert.deepEqual(CORE_SAMPLE_SOURCE_IDS, [
      'tvpp-9vvx',
      'fudw-fgrp',
      '6v4b-5gp4',
      '3vyj-dkjt',
      'tg4x-b46p',
    ]);
  });
});

describe('query tuning helpers', () => {
  const todayIso = '2026-07-01';
  const parksExtract = (row) => (row.date == null ? null : String(row.date));

  it('builds expected strategy sets per source', () => {
    assert.equal(buildTvppQueryStrategies(todayIso).length, 3);
    assert.equal(buildParksQueryStrategies(todayIso).length, 3);
    assert.equal(buildPpdQueryStrategies().length, 1);
    assert.equal(buildSafetyQueryStrategies(todayIso).length, 3);
    assert.equal(buildFilmQueryStrategies(todayIso).length, 4);

    const tvpp = buildQueryStrategiesForSource('tvpp-9vvx', todayIso);
    assert.ok(tvpp.some((strategy) => strategy.name.includes('start_date_time >=')));
    assert.ok(tvpp.some((strategy) => strategy.name.includes('end_date_time >=')));

    const parks = buildQueryStrategiesForSource('fudw-fgrp', todayIso);
    assert.ok(parks.some((strategy) => strategy.name.includes('date >=')));
    assert.ok(parks.some((strategy) => strategy.name.includes('DESC')));
  });

  it('parses date prefixes from mixed formats', () => {
    assert.equal(parseDatePrefix('2026-07-01T10:00:00.000'), '2026-07-01');
    assert.equal(parseDatePrefix('2019-10-12'), '2019-10-12');
    assert.equal(parseDatePrefix('not a date'), null);
    assert.equal(parseDatePrefix(null), null);
  });

  it('classifies freshness from parsed dates', () => {
    assert.equal(classifyFreshnessFromDates([], todayIso), 'unknown');
    assert.equal(classifyFreshnessFromDates(['2026-07-01'], todayIso), 'current');
    assert.equal(classifyFreshnessFromDates(['2019-10-12'], todayIso), 'stale');
    assert.equal(classifyFreshnessFromDates(['2019-10-12', '2026-08-01'], todayIso), 'current');
  });

  it('computes date range from parsed dates', () => {
    assert.deepEqual(computeDateRangeFromDates([]), { min: null, max: null });
    assert.deepEqual(computeDateRangeFromDates(['2026-08-01', '2026-07-01']), {
      min: '2026-07-01',
      max: '2026-08-01',
    });
  });

  it('summarizes empty strategy results', () => {
    const summary = summarizeStrategyResult('test empty', [], parksExtract, todayIso);
    assert.equal(summary.rowCount, 0);
    assert.equal(summary.freshness, 'empty');
    assert.equal(summary.dateRange, null);
    assert.deepEqual(summary.sampleDates, []);
  });

  it('summarizes current and stale strategy results', () => {
    const current = summarizeStrategyResult(
      'current sample',
      [{ date: '2026-07-15' }, { date: '2026-08-01' }],
      parksExtract,
      todayIso,
    );
    assert.equal(current.rowCount, 2);
    assert.equal(current.freshness, 'current');
    assert.deepEqual(current.dateRange, { min: '2026-07-15', max: '2026-08-01' });
    assert.deepEqual(current.sampleDates, ['2026-07-15', '2026-08-01']);

    const stale = summarizeStrategyResult(
      'stale sample',
      [{ date: '2019-10-12' }],
      parksExtract,
      todayIso,
    );
    assert.equal(stale.freshness, 'stale');
  });

  it('extracts sample dates from rows', () => {
    const dates = extractSampleDates(
      [{ date: '2026-07-01T00:00:00.000' }, { date: 'bad' }, {}],
      parksExtract,
    );
    assert.deepEqual(dates, ['2026-07-01']);
  });

  it('falls back to enddatetime when film permit startdatetime is absent', () => {
    const filmExtract = getDateExtractorForSource('tg4x-b46p');
    const dates = extractSampleDates(
      [{ enddatetime: '2026-03-28T04:00:00.000' }],
      filmExtract,
    );
    assert.deepEqual(dates, ['2026-03-28']);
  });

  it('recommends current feed when filtered strategy is current', () => {
    const recommendation = recommendSourceStrategy('tvpp-9vvx', [
      { name: 'start_date_time >= today order ASC', rowCount: 3, freshness: 'current' },
      { name: 'default (limit only)', rowCount: 3, freshness: 'current' },
    ], todayIso);
    assert.match(recommendation, /^use_for_current_feed/);
  });

  it('recommends needs_query_fix when unfiltered is current but filter is empty', () => {
    const recommendation = recommendSourceStrategy('fudw-fgrp', [
      { name: 'date >= today order ASC', rowCount: 0, freshness: 'empty' },
      { name: 'no filter order date DESC', rowCount: 3, freshness: 'current' },
    ], todayIso);
    assert.match(recommendation, /^needs_query_fix/);
  });

  it('recommends stale_or_empty when all strategies have zero rows', () => {
    const recommendation = recommendSourceStrategy('3vyj-dkjt', [
      { name: 'event_date >= today order ASC', rowCount: 0, freshness: 'empty' },
      { name: 'no filter order event_date DESC', rowCount: 0, freshness: 'empty' },
    ], todayIso);
    assert.match(recommendation, /^stale_or_empty/);
  });

  it('recommends historical context when unfiltered rows are stale', () => {
    const recommendation = recommendSourceStrategy('3vyj-dkjt', [
      { name: 'event_date >= today order ASC', rowCount: 0, freshness: 'empty' },
      { name: 'no filter order event_date DESC', rowCount: 3, freshness: 'stale' },
    ], todayIso);
    assert.match(recommendation, /^use_for_historical_context/);
  });

  it('recommends stale_or_empty for PPD free-text stale samples', () => {
    const recommendation = recommendSourceStrategy('6v4b-5gp4', [
      { name: 'no filter (free-text date_and_time)', rowCount: 3, freshness: 'stale' },
    ], todayIso);
    assert.match(recommendation, /^stale_or_empty/);
    assert.match(recommendation, /free-text/i);
  });

  it('parses query tuning CLI args and filters by source', () => {
    const fixedToday = new Date('2026-07-01T12:00:00');
    const args = parseQueryTuningArgs(['--limit', '5', '--pretty', '--source', 'tvpp-9vvx'], {
      today: fixedToday,
    });
    assert.equal(args.limit, 5);
    assert.equal(args.pretty, true);
    assert.equal(args.sourceFilter, 'tvpp-9vvx');
    assert.deepEqual(selectTuningSourceIds(args), ['tvpp-9vvx']);
    assert.deepEqual(selectTuningSourceIds({ sourceFilter: null }), CORE_TUNING_SOURCE_IDS);
  });

  it('rejects unsupported source filter', () => {
    assert.throws(
      () => selectTuningSourceIds({ sourceFilter: 'dot-trafalrt' }),
      /Unsupported source dot-trafalrt/,
    );
  });

  it('builds source tuning entry and report envelope', () => {
    const strategies = [
      summarizeStrategyResult('date >= today order ASC', [], parksExtract, todayIso),
    ];
    const entry = buildSourceTuningEntry('fudw-fgrp', 'Parks Event Listing', strategies, todayIso);
    assert.equal(entry.sourceDatasetId, 'fudw-fgrp');
    assert.equal(entry.strategies.length, 1);
    assert.match(entry.recommendation, /^stale_or_empty/);

    const report = buildQueryTuningReport([entry], todayIso, '2026-07-01T12:00:00.000Z');
    assert.equal(report.today, todayIso);
    assert.equal(report.sources.length, 1);
  });
});

describe('TVPP assignment feed helpers', () => {
  const fixedToday = new Date('2026-07-01T12:00:00');
  const todayIso = '2026-07-01';

  it('uses default CLI limit and from-date', () => {
    const args = parseTvppAssignmentFeedArgs([], { today: fixedToday });
    assert.equal(args.limit, DEFAULT_TVPP_FEED_LIMIT);
    assert.equal(args.pretty, false);
    assert.equal(args.help, false);
    assert.equal(args.fromDate, todayIso);
    assert.equal(args.borough, null);
    assert.equal(args.eventType, null);
  });

  it('parses limit, pretty, from-date, borough, and event-type', () => {
    const args = parseTvppAssignmentFeedArgs(
      ['--limit', '10', '--pretty', '--from-date', '2026-08-01', '--borough', 'Manhattan', '--event-type', 'Street Event'],
      { today: fixedToday },
    );
    assert.equal(args.limit, 10);
    assert.equal(args.pretty, true);
    assert.equal(args.fromDate, '2026-08-01');
    assert.equal(args.borough, 'Manhattan');
    assert.equal(args.eventType, 'Street Event');
  });

  it('caps limit at max', () => {
    const args = parseTvppAssignmentFeedArgs(['--limit=250'], { today: fixedToday });
    assert.equal(args.limit, MAX_TVPP_FEED_LIMIT);
  });

  it('builds TVPP SoQL where clause with optional filters', () => {
    assert.equal(
      buildTvppWhereClause({ fromDate: todayIso }),
      "start_date_time >= '2026-07-01T00:00:00'",
    );
    assert.equal(
      buildTvppWhereClause({ fromDate: todayIso, borough: 'Manhattan' }),
      "start_date_time >= '2026-07-01T00:00:00' AND event_borough = 'Manhattan'",
    );
    assert.equal(
      buildTvppWhereClause({ fromDate: todayIso, eventType: 'Street Event' }),
      "start_date_time >= '2026-07-01T00:00:00' AND event_type = 'Street Event'",
    );
    assert.equal(
      buildTvppWhereClause({ fromDate: todayIso, borough: "O'Brien", eventType: 'Festival' }),
      "start_date_time >= '2026-07-01T00:00:00' AND event_borough = 'O''Brien' AND event_type = 'Festival'",
    );
  });

  it('escapes single quotes in SoQL string literals', () => {
    assert.equal(escapeSoqlString("O'Brien"), "O''Brien");
  });

  it('builds TVPP fetch options with order and limit', () => {
    const args = parseTvppAssignmentFeedArgs(['--limit', '50', '--borough', 'Brooklyn'], {
      today: fixedToday,
    });
    const options = buildTvppFetchOptions(args);
    assert.equal(options.limit, 50);
    assert.equal(options.order, TVPP_FEED_ORDER);
    assert.match(options.where, /start_date_time >= '2026-07-01T00:00:00'/);
    assert.match(options.where, /event_borough = 'Brooklyn'/);
  });

  it('sorts leads by start date/time ascending', () => {
    const sorted = sortLeadsByStartDateTime([
      { startDate: '2026-08-01', startTime: '12:00:00', title: 'B' },
      { startDate: '2026-07-01', startTime: '18:00:00', title: 'A' },
      { startDate: '2026-07-01', startTime: '09:00:00', title: 'C' },
    ]);
    assert.deepEqual(sorted.map((lead) => lead.title), ['C', 'A', 'B']);
  });

  it('builds TVPP assignment feed report envelope', () => {
    const leads = [
      { startDate: '2026-07-01', startTime: '10:00:00', title: 'Event A', photoPriorityScore: null },
      { startDate: '2026-07-15', startTime: '14:00:00', title: 'Event B', photoPriorityScore: null },
    ];
    const report = buildTvppAssignmentFeedReport({
      generatedAt: '2026-07-01T12:00:00.000Z',
      fromDate: todayIso,
      limit: 25,
      rowCount: 2,
      leads,
    });

    assert.equal(report.sourceDatasetId, TVPP_SOURCE_DATASET_ID);
    assert.equal(report.fromDate, todayIso);
    assert.equal(report.limit, 25);
    assert.equal(report.rowCount, 2);
    assert.equal(report.leadCount, 2);
    assert.deepEqual(report.dateRange, { min: '2026-07-01', max: '2026-07-15' });
    assert.equal(report.leads[0].title, 'Event A');
    assert.equal(report.leads.every((lead) => lead.photoPriorityScore === null), true);
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
