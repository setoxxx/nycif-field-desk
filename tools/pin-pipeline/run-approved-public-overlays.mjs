import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APPROVED_PUBLIC_OVERLAY_RUN = [
  {
    label: 'Build 5PM base inventory dependency',
    script: 'build-nightlife-pins.mjs',
    reason: 'Required upstream source for nightlife-noise correlation and Active 5PM Feed.'
  },
  {
    label: 'Build nightlife-noise correlation dependency',
    script: 'build-nightlife-noise-correlation.mjs',
    reason: 'Required upstream source for Active 5PM Feed.'
  },
  {
    label: 'Build approved public Active 5PM Feed',
    script: 'build-active-nightlife-feed.mjs',
    reason: 'Approved public overlay under Issue #17.'
  },
  {
    label: 'Build smoke/vape complaint dependency',
    script: 'build-smoke-intel-pins.mjs',
    reason: 'Required upstream complaint source for Smoke/Vape/Cannabis Correlation.'
  },
  {
    label: 'Build licensed smoke/vape retailer dependency',
    script: 'build-licensed-smoke-vape-retailers.mjs',
    reason: 'Required upstream regulated-location source for Smoke/Vape/Cannabis Correlation.'
  },
  {
    label: 'Build approved public Legal Cannabis Dispensaries / Registered Retail Dealers',
    script: 'build-legal-cannabis-dispensaries.mjs',
    reason: 'Approved public overlay under Issue #17.'
  },
  {
    label: 'Build approved public Smoke/Vape/Cannabis Correlation',
    script: 'build-smoke-vape-cannabis-correlation.mjs',
    reason: 'Approved public overlay under Issue #17.'
  }
];

const REQUIRED_ENV = {
  NYCIF_CANNABIS_DISPENSARY_SOURCE_URL: 'https://data.ny.gov/resource/gttd-5u6y.json?$limit=5000'
};

function runNode(scriptName, envOverrides = {}) {
  const script = path.join(__dirname, scriptName);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      stdio: 'inherit',
      env: {
        ...process.env,
        ...envOverrides
      }
    });

    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptName} exited with code ${code}`));
    });
  });
}

console.log('NYCIF approved public overlay scheduled rebuild');
console.log('Scope: Issue #17 approved public overlays plus required data dependencies only.');
console.log('Approved overlays: Active 5PM Feed, Legal Cannabis Dispensaries / Registered Retail Dealers, Smoke/Vape/Cannabis Correlation.');
console.log('Excluded from public map UI: raw Smoke/Vape Complaints, full Licensed Smoke/Vape Retailers inventory, full 5PM Spots base inventory.');
console.log('');

for (const step of APPROVED_PUBLIC_OVERLAY_RUN) {
  console.log(`\n=== ${step.label} ===`);
  console.log(step.reason);
  await runNode(step.script, REQUIRED_ENV);
}

console.log('\nCompleted approved public overlay rebuild path.');
