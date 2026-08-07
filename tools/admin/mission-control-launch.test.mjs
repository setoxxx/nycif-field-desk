import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync('admin/mission-control.html', 'utf8');
const js = fs.readFileSync('admin/mission-control-launch-v01.js', 'utf8');
const state = JSON.parse(fs.readFileSync('admin/data/mission-control-launch-state-v01.json', 'utf8'));

assert.match(html, /NYCIF Mission Control/);
assert.match(html, /https:\/\/nycinfocus\.com\/map\//);
assert.doesNotMatch(html + js, /raw\.githubusercontent\.com/i);
assert.doesNotMatch(html + js, /github\.com\/setoxxx\/nycif-live-feeds\/raw/i);
assert.doesNotMatch(html + js, /serviceWorker\.register/i);
assert.equal(state.read_only, true);
assert.equal(state.production_mutation, false);
assert.equal(state.canonical_public_map, 'https://nycinfocus.com/map/');
assert.equal(state.source_policy.browser_raw_github_dependency_allowed, false);
assert.equal(state.cleanup.public_runtime_count, 2);
assert.equal(state.cleanup.unknown_count, 2);
assert.equal(state.operator.god_view_retirement, 'NOT_AUTHORIZED_UNTIL_PARITY_PASS');
console.log('Mission Control launch safety: PASS');
