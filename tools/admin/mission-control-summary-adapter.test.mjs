import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const source = fs.readFileSync('admin/mission-control-summary-adapter-v01.js', 'utf8');
assert.doesNotMatch(source, /serviceWorker\.register/i);
assert.doesNotMatch(source, /fetch\([^)]*raw\.githubusercontent\.com/i);
assert.match(source, /credentials:\s*'omit'/);
assert.match(source, /NO_READER_SAFE_SUMMARY_URL_CONFIGURED/);
assert.match(source, /INVALID_READER_SAFE_SUMMARY_CONTRACT/);
assert.match(source, /UNAVAILABLE_PENDING_READER_SAFE_AGGREGATE/);

const context = {
  URL,
  console,
  window: {
    location: { href: 'https://nycinfocus.com/admin/mission-control.html' },
  },
  fetch: async () => { throw new Error('fetch should not be called without configured URL'); },
};
vm.createContext(context);
vm.runInContext(source, context);
const adapter = context.window.NYCIF_MISSION_CONTROL_SUMMARY_ADAPTER;
assert.ok(adapter);
assert.equal(adapter.isAllowedReaderSafeUrl('https://raw.githubusercontent.com/a/b/c.json'), false);
assert.equal(adapter.isAllowedReaderSafeUrl('http://example.com/summary.json'), false);
assert.equal(adapter.isAllowedReaderSafeUrl('https://example.com/summary.json'), true);
assert.equal(adapter.isAllowedReaderSafeUrl('/public-data/current/mission-control-summary.json'), true);

const unavailable = await adapter.load();
assert.equal(unavailable.status, adapter.unavailableStatus);
assert.equal(unavailable.reason, 'NO_READER_SAFE_SUMMARY_URL_CONFIGURED');
assert.equal(unavailable.summary, null);

const valid = {
  schema_version: 'nycif-mission-control-summary-v1',
  generated_at: '2026-08-07T16:50:00Z',
  release_id: 'release-abcdef1',
  release_sha: 'abcdef1',
  data_health: 'READY',
  sources: [
    { label: 'Permitted Events', health: 'FRESH', last_success_age_seconds: 60, safe_event_count: 12, last_release_id: 'release-abcdef1' },
    { label: 'Citywide Calendar', health: 'STALE', last_success_age_seconds: 7200, safe_event_count: 8, last_release_id: 'release-abcdef1' },
    { label: 'Parks BigApps', health: 'UNAVAILABLE', last_success_age_seconds: null, safe_event_count: null, last_release_id: 'release-abcdef1' },
  ],
  daily_event_count: 20,
  new_event_count: 3,
  projector_status: 'PASS',
  reconciliation_status: 'PASS',
  silent_identity_loss: 0,
  unsupported_exact_pins: 0,
  duplicate_exact_occurrences: 0,
  daily_health: 'READY',
  anonymous_audit_status: 'PENDING',
};
assert.equal(adapter.validateSummary(valid), true);
assert.equal(adapter.validateSummary({ ...valid, daily_event_count: -1 }), false);
assert.equal(adapter.validateSummary({ ...valid, secret: 'x' }), false);
assert.equal(adapter.validateSummary({ ...valid, sources: valid.sources.slice(0, 2) }), false);
assert.equal(adapter.validateSummary({ ...valid, release_sha: 'not-a-sha' }), false);

console.log('Mission Control summary prehost adapter: PASS');
