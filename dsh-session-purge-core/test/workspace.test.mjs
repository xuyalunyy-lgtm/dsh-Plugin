import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {patchWorkspace} from '../workspace-patch.mjs';
const root=new URL('../staging/runtime/dsh/node_modules/@deepseek-ai/dsh-workspace/lib/',import.meta.url);
const candidate=new URL('purge-test-candidate.mjs',root);
test('workspace patch is valid importable released module and adds coordinator',async()=>{
 try{await writeFile(candidate,patchWorkspace(await readFile(new URL('index.js',root),'utf8')));
 const module=await import(candidate.href);assert.ok(Object.values(module).some(value=>typeof value==='function'&&typeof value.prototype?.purgeArchivedSession==='function'));
 }finally{await unlink(candidate).catch(error=>{if(error.code!=='ENOENT')throw error;});}
});
