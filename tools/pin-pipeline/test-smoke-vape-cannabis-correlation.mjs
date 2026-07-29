import assert from 'node:assert/strict';
import { dedupeLocations, semanticLocationKey } from './build-smoke-vape-cannabis-correlation.mjs';

const duplicateA = {
  id: 'license-a',
  location_kind: 'licensed_smoke_vape_retailer',
  title: 'Gardenia Deli',
  address: '404 8 Avenue, New York, 10001',
  borough: 'Manhattan',
  lat: 40.750001,
  lng: -73.995001
};
const duplicateB = {
  ...duplicateA,
  id: 'license-b',
  title: 'GARDENIA   DELI',
  address: '404 8 AVENUE, NEW YORK, 10001',
  lat: 40.7500014,
  lng: -73.9950014
};
const distinctBusiness = {
  ...duplicateA,
  id: 'license-c',
  title: 'Different Newsstand'
};
const distinctKind = {
  ...duplicateA,
  id: 'dispensary-a',
  location_kind: 'legal_cannabis_dispensary'
};

assert.equal(semanticLocationKey(duplicateA), semanticLocationKey(duplicateB));
assert.notEqual(semanticLocationKey(duplicateA), semanticLocationKey(distinctBusiness));
assert.notEqual(semanticLocationKey(duplicateA), semanticLocationKey(distinctKind));

const result = dedupeLocations([duplicateA, duplicateB, distinctBusiness, distinctKind]);
assert.equal(result.locations.length, 3);
assert.equal(result.duplicate_locations_collapsed, 1);
const gardenia = result.locations.find(item => item.title === 'Gardenia Deli');
assert.ok(gardenia);
assert.equal(gardenia.source_record_count, 2);
assert.deepEqual(gardenia.duplicate_source_ids, ['license-b']);

const outputKeys = result.locations.map(semanticLocationKey);
assert.equal(new Set(outputKeys).size, outputKeys.length);
console.log('PASS correlation semantic location dedupe');
