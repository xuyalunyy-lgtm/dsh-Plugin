import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { patchSessionStore } from '../lifecycle-patch.mjs';
const root=new URL('../staging/runtime/dsh/node_modules/@deepseek-ai/',import.meta.url);
const original=new URL('dsh-session/lib/index.js',root);
const candidate=new URL('dsh-session/lib/purge-test-candidate.mjs',root);
let SessionStore,Context;
test.before(async()=>{
  await writeFile(candidate,patchSessionStore(await readFile(original,'utf8')));
  ({SessionStore}=await import(candidate.href));
  ({Context}=await import(new URL('cordis/lib/index.js',root).href));
});
test.after(async()=>{await unlink(candidate).catch(error=>{if(error.code!=='ENOENT')throw error;});});
test('real SessionStore blocks both prepare and stale prepared publication during purge',()=>{
 const store=new SessionStore(new Context());
 const prepared=store.prepare('purge-test');const lease=store.reservePurge('purge-test');
 assert.throws(()=>store.prepare('purge-test'),/删除/);
 assert.throws(()=>store.enter(prepared),/删除/);
 assert.throws(()=>store.prepare('child',{meta:{parentSession:'purge-test'}}),/删除/);
 lease.release({purgeCommitted:false});assert.doesNotThrow(()=>store.prepare('purge-test'));
});
test('committed reservation cannot be released into a reusable ID',()=>{
 const store=new SessionStore(new Context());const lease=store.reservePurge('purged');
 lease.release({purgeCommitted:true});assert.throws(()=>store.prepare('purged'),/删除/);
});
