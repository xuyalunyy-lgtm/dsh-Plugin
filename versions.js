import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

/** Read local package metadata; never include paths or full manifests in the report. */
export async function readVersions(profileDir) {
  let managerVersion = null;
  let adapterVersion = null;
  try { managerVersion = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8')).version; }
  catch (error) { /* Optional metadata is allowed to be unavailable. */ }
  try {
    const entry = createRequire(join(profileDir, 'package.json')).resolve('dsh-llm-codex');
    adapterVersion = JSON.parse(await readFile(join(dirname(entry), '..', 'package.json'), 'utf8')).version;
  } catch (error) { /* No adapter path or resolution error is disclosed. */ }
  return { managerVersion, adapterVersion };
}
