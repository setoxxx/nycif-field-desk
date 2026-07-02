import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildTvppLocationCleanupReport,
  classifyTvppLocationText,
  countLocationCleanupBuckets,
  normalizeTvppLocationText,
  parseTvppLocationCandidate,
} from './tvpp-location-cleanup.mjs';

describe('TVPP location cleanup parser v1', () => {
  const baseLead = {
    sourceDatasetId: 'tvpp-9vvx',
    sourceRecordId: '1',
    eventId: '1',
    title: 'Test Event',
    borough: 'Manhattan',
    eventType: 'Street Event',
    category: null,
    latitude: null,
    longitude: null,
    rawRecord: {},
  };

  it('normalizes EAST/WEST/STREET/AVENUE wording', () => {
    assert.equal(
      normalizeTvppLocationText('EAST 50 STREET between MADISON AVENUE and PARK AVENUE'),
      'E 50 St between MADISON Ave and PARK Ave',
    );
  });

  it('parses park/venue strings into cleanup candidates', () => {
    const item = parseTvppLocationCandidate({
      ...baseLead,
      locationName: 'Central Park: Bethesda Fountain Terrace',
    });
    assert.equal(item.locationCleanup.locationKind, 'venue_or_park');
    assert.equal(item.locationCleanup.bucket, 'park_area_candidate');
    assert.equal(item.locationCleanup.candidateDisplayLocation, 'Central Park, Bethesda Fountain Terrace');
    assert.equal(item.locationCleanup.candidateQuery, 'Central Park Bethesda Fountain Terrace, Manhattan, NY');
    assert.equal(item.lead.latitude, null);
    assert.ok(!('locationCleanup' in item.lead));
  });

  it('parses street between strings into route/intersection candidates', () => {
    const item = parseTvppLocationCandidate({
      ...baseLead,
      locationName: 'EAST 50 STREET between MADISON AVENUE and PARK AVENUE',
    });
    assert.equal(item.locationCleanup.bucket, 'intersection_candidate');
    assert.equal(item.locationCleanup.locationKind, 'route');
    assert.equal(item.locationCleanup.candidateDisplayLocation, 'E 50 St between MADISON Ave and PARK Ave');
    assert.equal(item.lead.longitude, null);
  });

  it('parses multi-segment routes without pretending they are precise points', () => {
    const item = parseTvppLocationCandidate({
      ...baseLead,
      locationName: 'MADISON AVENUE between EAST 51 STREET and EAST 50 STREET, EAST 49 STREET between PARK AVENUE and LEXINGTON AVENUE',
    });
    assert.equal(item.locationCleanup.bucket, 'route_or_multi_segment');
    assert.equal(item.locationCleanup.locationKind, 'multi_segment_route');
    assert.equal(item.locationCleanup.components.segments.length, 2);
    assert.match(item.locationCleanup.candidateQuery, /first segment candidate only/);
    assert.ok(!('latitude' in item.locationCleanup));
    assert.ok(!('longitude' in item.locationCleanup));
  });

  it('flags missing, low-info, and borough-only locations', () => {
    assert.equal(classifyTvppLocationText({ ...baseLead, locationName: 'closed' }).bucket, 'needs_manual_review');
    assert.equal(classifyTvppLocationText({ ...baseLead, borough: null, locationName: null }).bucket, 'missing_location');
    assert.equal(classifyTvppLocationText({ ...baseLead, borough: 'Queens', locationName: null }).bucket, 'borough_only');
  });

  it('builds a report with separate cleanup metadata and no coordinates', () => {
    const report = buildTvppLocationCleanupReport({
      generatedAt: '2026-07-02T12:00:00.000Z',
      fromDate: '2026-07-02',
      limit: 3,
      rowCount: 3,
      leads: [
        { ...baseLead, eventId: '1', locationName: '123 MADISON AVENUE' },
        { ...baseLead, eventId: '2', locationName: 'Central Park: Bethesda Fountain Terrace' },
        { ...baseLead, eventId: '3', locationName: null, borough: 'Queens' },
      ],
    });

    assert.equal(report.itemCount, 3);
    assert.equal(report.bucketCounts.clean_address_candidate, 1);
    assert.equal(report.bucketCounts.park_area_candidate, 1);
    assert.equal(report.bucketCounts.borough_only, 1);
    assert.ok(report.items.every((item) => item.lead.latitude === null));
    assert.ok(report.items.every((item) => !('locationCleanup' in item.lead)));
    assert.deepEqual(countLocationCleanupBuckets(report.items), report.bucketCounts);
  });
});
