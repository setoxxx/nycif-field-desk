const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'event-feed-schema-v1.js'), 'utf8');
const sandbox = { window: {}, URL };
vm.runInNewContext(source, sandbox, { filename: 'event-feed-schema-v1.js' });
const schema = sandbox.window.NYCIF_EVENT_FEED_SCHEMA_V1;

function schemaRow(overrides = {}) {
  return {
    id: 'test-event',
    title: 'Test event',
    category: 'market',
    timezone: 'America/New_York',
    latitude: 40.752,
    longitude: -73.968,
    borough: 'Manhattan',
    location: 'Dag Hammarskjold Plaza',
    source: { dataset: 'test', source_event_id: 'test-event' },
    nycif: {},
    ...overrides
  };
}

function projected(overrides, dataLayer = 'approved_staged') {
  return schema.projectEvent(schemaRow(overrides), 0, dataLayer);
}

const cases = [
  ['reported nested Rally-Demonstration', { nycif: { event_type: 'Rally-Demonstration' } }, 'civic'],
  ['explicit protest', { title: 'Protest for Housing Justice' }, 'civic'],
  ['demonstration', { title: 'Demonstration Against the Proposed Cuts' }, 'civic'],
  ['tenant-rights rally', { title: 'Community Rally for Tenant Rights' }, 'civic'],
  ['climate march', { title: 'March for Climate Justice' }, 'civic'],
  ['picket line', { title: 'Workers Picket Outside Headquarters' }, 'civic'],
  ['sit-in', { title: 'Student Sit-In for School Funding' }, 'civic'],
  ['walkout', { title: 'Union Walkout and Press Conference' }, 'civic'],
  ['vigil', { title: 'Candlelight Vigil for Victims' }, 'civic'],
  ['real farmers market', { title: 'Union Square Farmers Market' }, 'market'],
  ['real holiday market', { title: 'Bryant Park Holiday Market and Vendor Fair' }, 'market'],
  ['road rally false positive', { title: 'Classic Car Road Rally' }, 'market'],
  ['pep rally false positive', { title: 'School Pep Rally', category: 'general' }, 'general'],
  ['marching band false positive', { title: 'Marching Band Showcase', category: 'arts' }, 'arts']
];

for (const [label, overrides, expected] of cases) {
  assert.equal(projected(overrides).category, expected, label);
}

const legacy = schema.projectEvent({
  id: 'legacy-rally',
  title: 'Public Rally',
  category: 'market',
  event_type: 'Rally-Demonstration',
  timezone: 'America/New_York',
  lat: 40.752,
  lng: -73.968,
  source_dataset: 'legacy-test',
  source_event_id: 'legacy-rally'
}, 0, 'approved_staged');
assert.equal(legacy.category, 'civic', 'legacy approved row should be corrected');

console.log(`${cases.length + 1} civic-action category regression checks passed`);
