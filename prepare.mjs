import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import asar from '@electron/asar';
import { patchMain, BASELINE_MAIN_SHA256 } from './main-patch.mjs';
import { buildPatchedArchive, verifyArchivePair } from './archive-patch.mjs';

export const EXPECTED_ARCHIVE_SHA256='04b32e3a872826ba15cfb2081c6a929a8d4ecaa65e09a2543e5a6b30e2eff1f0';
const hash=data=>createHash('sha256').update(data).digest('hex');
export async function prepare(sourcePath,outputDirectory) {
  const source=resolve(sourcePath),out=resolve(outputDirectory);
  const original=await readFile(source);
  if(hash(original)!==EXPECTED_ARCHIVE_SHA256)throw new Error('Installed archive differs from reviewed baseline; refusing patch.');
  const manifest=JSON.parse(asar.extractFile(source,'package.json').toString('utf8'));
  if(manifest.name!=='@deepseek-ai/dsh-desktop'||manifest.version!=='0.2.1-rc.3')throw new Error('Desktop version mismatch');
  const oldMain=asar.extractFile(source,'lib/main.js').toString('utf8');
  if(hash(Buffer.from(oldMain))!==BASELINE_MAIN_SHA256)throw new Error('Desktop main entry checksum mismatch');
  const patched=Buffer.from(patchMain(oldMain));
  await mkdir(out,{recursive:true});
  await writeFile(resolve(out,'main.mjs'),patched,{flag:'wx'});
  const archive=resolve(out,'app.asar');
  await buildPatchedArchive(source,archive,patched);
  await verifyArchivePair(source,archive);
  const plan={schema:1,createdAt:new Date().toISOString(),desktopVersion:manifest.version,
    target:source,executable:resolve(dirname(source),'..','DeepSeek Harness.exe'),
    originalSha256:hash(original),patchedSha256:hash(await readFile(archive)),
    originalMainSha256:hash(Buffer.from(oldMain)),patchedMainSha256:hash(patched),
    archive,backup:resolve(dirname(source),`app.asar.safe-restart-${hash(original).slice(0,12)}.bak`),
    note:'Apply only when all processes from this installation have exited. No restart or shutdown is performed by installer.'};
  await writeFile(resolve(out,'plan.json'),JSON.stringify(plan,null,2)+'\n',{flag:'wx'});
  return plan;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(process.argv.length!==4)throw new Error('Usage: node prepare.mjs <original-app.asar> <new-output-directory>');
  console.log(JSON.stringify(await prepare(process.argv[2],process.argv[3]),null,2));
}
