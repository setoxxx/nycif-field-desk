import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync('admin/mission-control.html', 'utf8');
const js = fs.readFileSync('admin/mission-control-launch-v01.js', 'utf8');
const state = JSON.parse(fs.readFileSync('admin/data/mission-control-launch-state-v01.json', 'utf8'));
const joined = html + js + JSON.stringify(state);

assert.match(html, /NYCIF Mission Control/);
assert.match(html, /https:\/\/nycinfocus\.com\/map\//);
assert.doesNotMatch(joined, /raw\.githubusercontent\.com/i);
assert.doesNotMatch(joined, /github\.com\/setoxxx\/nycif-live-feeds\/raw/i);
assert.doesNotMatch(joined, /serviceWorker\.register/i);
assert.doesNotMatch(joined, /api[_-]?key|secret[_-]?key|access[_-]?token|bearer\s+[a-z0-9._-]+/i);
assert.equal(state.read_only, true);
assert.equal(state.production_mutation, false);
assert.equal(state.canonical_public_map, 'https://nycinfocus.com/map/');
assert.equal(state.source_policy.browser_raw_github_dependency_allowed, false);
assert.equal(state.source_policy.private_repository_url_allowed, false);
assert.equal(state.source_policy.credentials_exposed, false);
assert.equal(state.cleanup.public_runtime_count, 2);
assert.equal(state.cleanup.unknown_count, 2);
assert.equal(state.operator.god_view_retirement, 'NOT_AUTHORIZED_UNTIL_PARITY_PASS');
assert.match(state.metrics.daily_events, /^UNAVAILABLE_/);
assert.match(state.metrics.new_events, /^UNAVAILABLE_/);
assert.equal(state.operator.assignment_desk.write_controls, false);
assert.equal(state.release.hosted_endpoint_status, 'BLOCKED_NO_READER_SAFE_ENDPOINT');
assert.equal(state.release.anonymous_browser_audit, 'NOT_RUN_NO_ENDPOINT');
console.log('Mission Control launch safety: PASS');
