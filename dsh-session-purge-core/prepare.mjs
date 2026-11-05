import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {patchSource as backend} from './backend-patch.mjs';
import {patchSource as derived,packages} from './derived-patch.mjs';
import {patchSessionStore} from './lifecycle-patch.mjs';
import {patchWorkspace} from './workspace-patch.mjs';
import {buildArchive} from './archive.mjs';
import {patchIdle} from './idle-patch.mjs';
const require=createRequire(import.meta.url);
const asar=require('../../dsh-desktop-quick-actions/node_modules/@electron/asar');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function prepare(source,output){
 source=resolve(source);output=resolve(output);
 const manifest=JSON.parse(asar.extractFile(source,'package.json'));
 if(manifest.version!=='0.2.2-rc.1'||manifest.dshBuildCommit!=='c59d10aff167ad7eefead4b3a9082fb57c8fbfe8')throw Error('Unreviewed Desktop build');
 const prefix='dsh/node_modules/@deepseek-ai/';
 const originals=Object.fromEntries([...packages,'dsh-session-persistence-jsonl','dsh-session','dsh-workspace','dsh-agent-loop'].map(name=>[name,asar.extractFile(source,(prefix+name+'/lib/index.js').replaceAll('/', '\\')).toString()]));
 const changed={...derived(Object.fromEntries(packages.map(name=>[name,originals[name]]))),
 'dsh-session-persistence-jsonl':backend(originals['dsh-session-persistence-jsonl']),
 'dsh-session':patchSessionStore(originals['dsh-session']),
 'dsh-workspace':patchWorkspace(originals['dsh-workspace']),
 'dsh-agent-loop':patchIdle(originals['dsh-agent-loop'])};
 await mkdir(output); // Refuse reusing an earlier candidate.
 const payload=resolve(output,'payload');await mkdir(payload);
 const files=[];
 for(const [name,text]of Object.entries(changed)){
  const target=resolve(payload,name+'.js');await writeFile(target,text,{flag:'wx'});
  files.push({path:prefix+name+'/lib/index.js',payload:target,originalSha256:hash(originals[name]),patchedSha256:hash(text)});
 }
 const plan={version:1,status:'candidate-not-installed',target:source,originalArchiveSha256:hash(await readFile(source)),desktopVersion:manifest.version,buildCommit:manifest.dshBuildCommit,files};
 Object.assign(plan,await buildArchive(plan,resolve(output,'app.asar')));
 await writeFile(resolve(output,'plan.json'),JSON.stringify(plan,null,2)+'\n',{flag:'wx'});
 return plan;
}
if(process.argv[1]===import.meta.filename){if(process.argv.length!==4)throw Error('Usage: node prepare.mjs <installed app.asar> <new candidate directory>');console.log(JSON.stringify(await prepare(process.argv[2],process.argv[3]),null,2));}
