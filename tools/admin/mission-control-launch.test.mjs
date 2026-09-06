import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync('admin/mission-control.html', 'utf8');
const js = fs.readFileSync('admin/mission-control-launch-v01.js', 'utf8');
const state = JSON.parse(fs.readFileSync('admin/data/mission-control-launch-state-v01.json', 'utf8'));
const contract = JSON.parse(fs.readFileSync('docs/mission-control/MISSION_CONTROL_SUMMARY_CONTRACT.json', 'utf8'));
const runtimeJoined = html + js + JSON.stringify(state);

assert.match(html, /NYCIF Mission Control/);
assert.match(html, /https:\/\/nycinfocus\.com\/map\//);
assert.doesNotMatch(runtimeJoined, /raw\.githubusercontent\.com/i);
assert.doesNotMatch(runtimeJoined, /github\.com\/setoxxx\/nycif-live-feeds\/raw/i);
assert.doesNotMatch(runtimeJoined, /serviceWorker\.register/i);
assert.doesNotMatch(runtimeJoined, /api[_-]?key|secret[_-]?key|access[_-]?token|bearer\s+[a-z0-9._-]+/i);

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

assert.equal(contract.artifact_name, 'mission-control-summary.json');
assert.equal(contract.publication_state, 'CONTRACT_ONLY_NO_HOSTED_ARTIFACT_YET');
assert.match(contract.authority, /never a new event, location, ranking, or verification authority/i);
assert.equal(contract.fail_closed.missing_artifact, 'UNAVAILABLE_PENDING_READER_SAFE_AGGREGATE');
assert.equal(contract.fail_closed.malformed_artifact, 'UNAVAILABLE_PENDING_READER_SAFE_AGGREGATE');
assert.equal(contract.fail_closed.invent_missing_counts, false);
assert.equal(contract.fail_closed.fallback_to_raw_github, false);
assert.equal(contract.fail_closed.fallback_to_field_desk_legacy_feed, false);
assert.equal(contract.fail_closed.fallback_to_private_endpoint, false);
assert.ok(contract.forbidden_content.includes('private source paths'));
assert.ok(contract.forbidden_content.includes('ranking formulas'));
assert.ok(contract.forbidden_content.includes('credentials'));
assert.ok(contract.forbidden_content.includes('precise sensitive location data'));
assert.ok(contract.forbidden_content.includes('raw.githubusercontent.com URLs'));
assert.deepEqual(contract.source_labels, ['Permitted Events', 'Citywide Calendar', 'Parks BigApps']);

console.log('Mission Control launch safety and reader-safe contract: PASS');
