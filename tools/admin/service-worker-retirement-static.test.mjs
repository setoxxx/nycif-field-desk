import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = fs.readFileSync('index.html', 'utf8');
const worker = fs.readFileSync('service-worker.js', 'utf8');
const plan = fs.readFileSync('docs/launch/FIELD_DESK_SERVICE_WORKER_PRE_RETIREMENT_QA.md', 'utf8');

assert.match(root, /navigator\.serviceWorker\.register\(["']\.\/service-worker\.js["']\)/);
assert.match(worker, /const\s+CACHE_NAME\s*=\s*['"]nycif-rc-public-map-v12['"]/);
assert.match(worker, /raw\.githubusercontent\.com/);
assert.match(worker, /skipWaiting\(\)/);
assert.match(worker, /clients\.claim\(\)/);

assert.match(plan, /nycif-rc-public-map-v12/);
assert.match(plan, /Match only the exact legacy Field Desk registration\/scope/i);
assert.match(plan, /Delete only the exact legacy cache name/i);
assert.match(plan, /Rollback rehearsal/i);
assert.match(plan, /Do not execute until production approval/i);
assert.match(plan, /Actual unregister\/cache deletion remains a production action/i);

assert.doesNotMatch(plan, /navigator\.serviceWorker\.getRegistrations\(\)[\s\S]*\.unregister\(\)/i);

console.log('Field Desk service-worker retirement static QA: PASS');
