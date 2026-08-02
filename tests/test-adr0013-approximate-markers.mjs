import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('app-schema-v1-major-all-v01.js', 'utf8');
const css = fs.readFileSync('adr0013-approximate-markers.css', 'utf8');

for (const token of [
  'approximate-clustered-events',
  'approximate-facility-events',
  'approximateMunicipalityPane',
  'approximateParkPane',
  'approximateFacilityPane',
  'Approximate location',
  'Open event list',
  "coordinate_status === 'approximate'",
  'loadApproximateMarkers',
  'renderApproximateMarkers'
]) {
  assert.ok(app.includes(token), `missing ${token}`);
}
assert.ok(app.includes("['approximateMunicipalityPane', 420]"));
assert.ok(app.includes("['approximateParkPane', 430]"));
assert.ok(app.includes("['approximateFacilityPane', 440]"));
assert.ok(css.includes('rgba(25,103,201,.68)'));
assert.ok(css.includes('rgba(198,95,17,.72)'));
assert.ok(!app.includes("coordinate_status: 'map_ready', display_disposition: 'approximate_marker'"));
console.log('ADR-0013 source separation and rendering contract: PASS');
