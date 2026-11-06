import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { patchSource, BASELINE_MAIN_SHA256 } from './patch.mjs';
import { buildArchive } from '../dsh-session-purge-core/archive.mjs';

const require = createRequire(import.meta.url);
const asar = require('../../dsh-desktop-quick-actions/node_modules/@electron/asar');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const target = 'D:\\xuyl\\tool\\dsh_app\\resources\\app.asar';
const originalArchiveSha256 = '12b95a06a6cd37bfe7d0505e8a23afa3e7b26d42e7d5c078b10463e96c13a008';

if (process.argv.length !== 3) throw new Error('Usage: node prepare.mjs <new-output-directory>');
const output = resolve(process.argv[2]);
if (hash(await readFile(target)) !== originalArchiveSha256) throw new Error('Installed archive differs; preserve current patches and review the new baseline first');
const manifest = JSON.parse(asar.extractFile(target, 'package.json').toString('utf8'));
if (manifest.version !== '0.2.2-rc.1' || manifest.dshBuildCommit !== 'c59d10aff167ad7eefead4b3a9082fb57c8fbfe8') throw new Error('Unsupported Desktop version/build');
const original = asar.extractFile(target, 'lib\\main.js').toString('utf8');
const patched = patchSource(original);
await mkdir(output);
const payload = join(output, 'main.mjs');
await writeFile(payload, patched, { flag: 'wx' });
execFileSync(process.execPath, ['--check', payload], { stdio: 'inherit', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, windowsHide: true });
const plan = {
  version: 1,
  kind: 'dsh-desktop-update-policy',
  status: 'candidate-not-installed',
  target,
  originalArchiveSha256,
  desktopVersion: manifest.version,
  buildCommit: manifest.dshBuildCommit,
  defaultUpdatesEnabled: false,
  settingsPath: 'C:\\Users\\Administrator\\AppData\\Roaming\\@deepseek-ai\\dsh-desktop\\desktop\\settings.json',
  files: [{ path: 'lib/main.js', payload, originalSha256: BASELINE_MAIN_SHA256, patchedSha256: hash(patched) }],
};
Object.assign(plan, await buildArchive(plan, join(output, 'app.asar')));
await writeFile(join(output, 'plan.json'), JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(plan, null, 2));
