import assert from 'node:assert/strict';
import { dedupeMappedLocations, semanticLocationKey } from './build-legal-cannabis-dispensaries.mjs';

function item(overrides = {}) {
  return {
    id: 'legal-dispensary-LIC-100',
    raw_source_id: 'LIC-100',
    title: 'Example Cannabis Retailer',
    address: '100 Main Street, Brooklyn, 11201',
    borough: 'Brooklyn',
    lat: 40.700001,
    lng: -73.990001,
    location_quality: 'source_coordinates',
    ...overrides
  };
}

const duplicateIdLowerQuality = item({
  address: '',
  location_quality: 'source_coordinates_reversed'
});
const duplicateIdHigherQuality = item({
  address: '100 Main Street, Brooklyn, 11201',
  location_quality: 'source_georeference'
});
const differentIdSameLocation = item({
  id: 'legal-dispensary-TPID-200',
  raw_source_id: 'TPID-200',
  title: 'EXAMPLE   CANNABIS RETAILER',
  address: '100 MAIN STREET, BROOKLYN, 11201',
  lat: 40.7000014,
  lng: -73.9900014
});
const distinctLocation = item({
  id: 'legal-dispensary-LIC-300',
  raw_source_id: 'LIC-300',
  title: 'Another Cannabis Retailer',
  address: '300 Other Avenue, Queens, 11373',
  borough: 'Queens',
  lat: 40.740001,
  lng: -73.870001
});

assert.equal(
  semanticLocationKey(duplicateIdHigherQuality),
  semanticLocationKey(differentIdSameLocation)
);
assert.notEqual(
  semanticLocationKey(duplicateIdHigherQuality),
  semanticLocationKey(distinctLocation)
);

const result = dedupeMappedLocations([
  duplicateIdLowerQuality,
  duplicateIdHigherQuality,
  differentIdSameLocation,
  distinctLocation
]);

assert.equal(result.mapped.length, 2);
assert.equal(result.duplicate_id_rows_collapsed, 1);
assert.equal(result.duplicate_semantic_locations_collapsed, 1);

const example = result.mapped.find(row => row.title === 'Example Cannabis Retailer');
assert.ok(example);
assert.equal(example.location_quality, 'source_georeference');
assert.equal(example.source_record_count, 3);
assert.deepEqual(example.duplicate_source_ids, ['TPID-200']);

const ids = result.mapped.map(row => row.id);
assert.equal(new Set(ids).size, ids.length);
const semanticKeys = result.mapped.map(semanticLocationKey);
assert.equal(new Set(semanticKeys).size, semanticKeys.length);

console.log('PASS legal cannabis canonical ID and semantic-location dedupe');
