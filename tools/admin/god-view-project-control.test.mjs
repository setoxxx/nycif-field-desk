import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const html = fs.readFileSync(new URL('../../admin/index.html', import.meta.url), 'utf8');
const script = fs.readFileSync(new URL('../../admin/god-view-project-control-v01.js', import.meta.url), 'utf8');
const state = JSON.parse(fs.readFileSync(new URL('../../admin/data/god-view-project-state-v01.json', import.meta.url), 'utf8'));

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

test('project state records the verified Map v1 gates', () => {
  assert.equal(state.schema_version, 'god-view-project-state-v01');
  assert.equal(state.project.current_stage, 'map_v1_completion');
  assert.equal(state.current_gate.pull_request, 178);
  assert.equal(state.next_gate.pull_request, 177);
  assert.equal(state.future_work_lock.active, true);
  assert.equal(state.deployment.status, 'unverified');
});

test('control renderer is read-only and does not request agency or Newsroom Engine endpoints', () => {
  assert.match(script, /god-view-project-state-v01\.json/);
  assert.doesNotMatch(script, /data\.cityofnewyork\.us|api\.nyc\.gov|nycgovparks\.org/);
  assert.doesNotMatch(script, /data\/newsroom_engine|connector_status\.json|infrastructure_matches\.json/);
  assert.doesNotMatch(script, /POST|PUT|PATCH|DELETE/);
});

test('administrative navigation starts with God View', () => {
  const nav = html.match(/<nav class="admin-nav"[\s\S]*?<\/nav>/)?.[0] || '';
  const firstLink = nav.match(/<a[^>]*>([^<]+)<\/a>/)?.[1];
  assert.equal(firstLink, 'God View');
});
