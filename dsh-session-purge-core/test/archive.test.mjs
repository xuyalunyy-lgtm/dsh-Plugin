import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';import {buildArchive} from '../archive.mjs';
const require=createRequire(import.meta.url);const asar=require('../../../dsh-desktop-quick-actions/node_modules/@electron/asar');const hash=b=>createHash('sha256').update(b).digest('hex');
test('archive candidate preserves unrelated packed and unpacked metadata and verifies replacements',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dsh-purge-archive-'));try{
 const {mkdir}=await import('node:fs/promises');await mkdir(join(dir,'input'));await writeFile(join(dir,'input','one.js'),'original');await writeFile(join(dir,'input','other.txt'),'untouched');
 const source=join(dir,'source.asar'),out=join(dir,'candidate.asar'),patch=join(dir,'one.js');await asar.createPackage(join(dir,'input'),source);await writeFile(patch,'replacement');
 const plan={target:source,originalArchiveSha256:hash(await readFile(source)),files:[{path:'one.js',payload:patch,originalSha256:hash('original'),patchedSha256:hash('replacement')}]};
 await buildArchive(plan,out);assert.equal(asar.extractFile(out,'one.js').toString(),'replacement');assert.equal(asar.extractFile(out,'other.txt').toString(),'untouched');assert.equal(asar.extractFile(source,'one.js').toString(),'original');
 await assert.rejects(buildArchive(plan,source),/overwrite/);await assert.rejects(buildArchive({...plan,originalArchiveSha256:'bad'},join(dir,'bad.asar')),/changed/);
 }finally{assert.ok(resolve(dir).startsWith(resolve(tmpdir())));await rm(dir,{recursive:true,force:true});}
});
