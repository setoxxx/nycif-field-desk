import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function listBuilders() {
  const entries = await fs.readdir(__dirname);
  return entries
    .filter(name => /^build-.*\.mjs$/.test(name))
    .sort()
    .map(name => path.join(__dirname, name));
}

function runNode(script) {
  return new Promise((resolve, reject) => {
    console.log(`Running ${script}`);
    const child = spawn(process.execPath, [script], { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`${script} exited with code ${code}`));
    });
  });
}

const builders = await listBuilders();
if (!builders.length) throw new Error('No pin builders found.');

for (const builder of builders) {
  await runNode(builder);
}

console.log(`Completed ${builders.length} pin builder(s).`);
