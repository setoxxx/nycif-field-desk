import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const html = fs.readFileSync(new URL('../../admin/index.html', import.meta.url), 'utf8');
const projectScript = fs.readFileSync(new URL('../../admin/god-view-project-control-v01.js', import.meta.url), 'utf8');
const recoveryScript = fs.readFileSync(new URL('../../admin/god-view-recovery-v01.js', import.meta.url), 'utf8');
const legacyScript = fs.readFileSync(new URL('../../admin/legacy-admin-data-v01.js', import.meta.url), 'utf8');
const state = JSON.parse(fs.readFileSync(new URL('../../admin/data/god-view-project-state-v01.json', import.meta.url), 'utf8'));
const recovery = JSON.parse(fs.readFileSync(new URL('../../admin/data/god-view-recovery-manifest-v01.json', import.meta.url), 'utf8'));
const sourceGuide = fs.readFileSync(new URL('../../docs/god-view-master-source-of-truth-v01.md', import.meta.url), 'utf8');
const recoveryPrompt = fs.readFileSync(new URL('../../docs/god-view-master-recovery-prompt-v01.md', import.meta.url), 'utf8');

const IMMUTABLE_BASELINE = 'acb27c958b4aba4b75d229e3170fe7ff256e7b53';

test('God View is the project control center and leads with Map v1 completion', () => {
  assert.match(html, /NYCIF God View — Project Control Center/);
  assert.match(html, /Finish and freeze Map v1/);
  assert.match(html, /Now, Next, Later/);
  assert.match(html, /How the current system works/);
});

test('God View preserves source governance and historical diagnostics', () => {
  assert.match(html, /live-pipeline-panel-v01\.js/);
  assert.match(html, /legacy-admin-data-v01\.js/);
  assert.match(html, /id="live-pipeline-section"/);
  assert.match(html, /id="project-status"/);
  assert.match(html, /id="xri"/);
});

test('project state records the verified Map v1 gates and recovery source', () => {
  assert.equal(state.schema_version, 'god-view-project-state-v01');
  assert.equal(state.project.current_stage, 'map_v1_completion');
  assert.equal(state.current_gate.pull_request, 178);
  assert.equal(state.current_gate.pull_request_state, 'open');
  assert.equal(state.next_gate.pull_request, 177);
  assert.equal(state.next_gate.pull_request_state, 'open');
  assert.equal(state.future_work_lock.active, true);
  assert.equal(state.deployment.status, 'unverified');
  assert.equal(state.recovery_manifest, './data/god-view-recovery-manifest-v01.json');
});

test('project and recovery renderers are read-only and request no agency or Newsroom Engine endpoints', () => {
  const scripts = `${projectScript}\n${recoveryScript}`;
  assert.match(projectScript, /god-view-project-state-v01\.json/);
  assert.match(recoveryScript, /god-view-recovery-manifest-v01\.json/);
  assert.doesNotMatch(scripts, /data\.cityofnewyork\.us|api\.nyc\.gov|nycgovparks\.org/);
  assert.doesNotMatch(scripts, /data\/newsroom_engine|connector_status\.json|infrastructure_matches\.json/);
  assert.doesNotMatch(scripts, /\bPOST\b|\bPUT\b|\bPATCH\b|\bDELETE\b/);
});

test('administrative navigation starts with God View', () => {
  const nav = html.match(/<nav class="admin-nav"[\s\S]*?<\/nav>/)?.[0] || '';
  const firstLink = nav.match(/<a[^>]*>([^<]+)<\/a>/)?.[1];
  assert.equal(firstLink, 'God View');
});

test('recovery manifest preserves the immutable baseline and unmerged state', () => {
  assert.equal(recovery.schema_version, 'god-view-recovery-manifest-v01');
  assert.equal(recovery.recovery_anchors.pre_god_view_baseline_sha, IMMUTABLE_BASELINE);
  assert.equal(recovery.recovery_anchors.merge_commit_sha, null);
  assert.equal(recovery.pull_request.number, 122);
  assert.equal(recovery.pull_request.draft_when_verified, true);
  assert.equal(recovery.pull_request.merged_when_verified, false);
  assert.notEqual(recovery.recovery_anchors.pre_god_view_baseline_sha, 'main');
});

test('human recovery documents contain the immutable baseline and protected-surface rules', () => {
  assert.match(sourceGuide, new RegExp(IMMUTABLE_BASELINE));
  assert.match(recoveryPrompt, new RegExp(IMMUTABLE_BASELINE));
  assert.match(sourceGuide, /public-map runtime|Public-map runtime/);
  assert.match(sourceGuide, /Assignment Desk Calendar functionality/);
  assert.match(recoveryPrompt, /Do not modify the public map/);
});

test('recovery panel is inserted once before deployment and its renderer is loaded once', () => {
  assert.match(legacyScript, /if\(byId\('recovery'\)\)return/);
  assert.match(legacyScript, /const anchor=byId\('deployment'\)/);
  assert.match(legacyScript, /anchor\.before\(section\)/);
  assert.match(legacyScript, /script\[data-god-view-recovery\]/);
  assert.match(legacyScript, /god-view-recovery-v01\.js/);
});

test('missing recovery information cannot produce a healthy state', () => {
  assert.match(recoveryScript, /Recovery information unavailable/);
  assert.match(recoveryScript, /Do not treat recovery status as healthy/);
  assert.match(recoveryScript, /dataset\.recoveryState = 'error'/);
  assert.doesNotMatch(recoveryScript, /catch\([^)]*\)\s*\{[^}]*dataset\.recoveryState = 'current'/s);
});

test('recovery status uses the same 72-hour freshness rule', () => {
  assert.match(recoveryScript, /72 \* 60 \* 60 \* 1000/);
  assert.match(recoveryScript, /Recovery manifest is stale or invalid/);
});

test('held feature PRs remain recorded as open and outside the active stage', () => {
  const byNumber = new Map(state.held_pull_requests.map(item => [item.pull_request, item]));
  assert.equal(byNumber.get(118)?.state, 'open');
  assert.equal(byNumber.get(106)?.state, 'open');
  assert.equal(byNumber.get(106)?.mergeable, false);
  assert.equal(state.project.current_stage, 'map_v1_completion');
});
