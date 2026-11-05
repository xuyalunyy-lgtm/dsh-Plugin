import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url);
const {Pickle}=require('../../dsh-desktop-quick-actions/node_modules/@electron/asar/lib/pickle.js');
const hash=b=>createHash('sha256').update(b).digest('hex');
function decode(bytes){const size=Pickle.createFromBuffer(bytes.subarray(0,8)).createIterator().readUInt32();return {header:JSON.parse(Pickle.createFromBuffer(bytes.subarray(8,8+size)).createIterator().readString()),offset:8+size};}
function encode(header){const body=Pickle.createEmpty();body.writeString(JSON.stringify(header));const bytes=body.toBuffer();const prefix=Pickle.createEmpty();prefix.writeUInt32(bytes.length);return Buffer.concat([prefix.toBuffer(),bytes]);}
function entry(header,path){let node=header;for(const part of path.split('/')){if(!part||part==='..'||part==='.')throw Error('Invalid entry');node=node.files?.[part];if(!node)throw Error('Missing entry: '+path);}if(node.link||node.unpacked||!/^\d+$/.test(node.offset))throw Error('Not packed regular entry: '+path);return node;}
/** Append replacement payloads without repacking original assets or unpacked links. */
export async function buildArchive(plan,destination){
 if(resolve(plan.target)===resolve(destination))throw Error('Cannot overwrite installed archive');
 const source=await readFile(plan.target);if(hash(source)!==plan.originalArchiveSha256)throw Error('Installed archive changed');
 const parsed=decode(source),header=structuredClone(parsed.header),payload=source.subarray(parsed.offset);const replacements=[];
 let next=payload.length;
 for(const file of plan.files){
  const node=entry(header,file.path),old=payload.subarray(Number(node.offset),Number(node.offset)+node.size);
  if(hash(old)!==file.originalSha256)throw Error('Source entry hash mismatch');
  const bytes=await readFile(file.payload);if(hash(bytes)!==file.patchedSha256)throw Error('Candidate entry hash mismatch');
  const blockSize=4*1024*1024,blocks=[];for(let i=0;i<=bytes.length;i+=blockSize)blocks.push(hash(bytes.subarray(i,i+blockSize)));
  Object.assign(node,{offset:String(next),size:bytes.length,integrity:{algorithm:'SHA256',hash:hash(bytes),blockSize,blocks}});next+=bytes.length;replacements.push(bytes);
 }
 const result=Buffer.concat([encode(header),payload,...replacements]);await writeFile(destination,result,{flag:'wx'});
 const checked=await readFile(destination),final=decode(checked);
 if(!checked.subarray(final.offset,final.offset+payload.length).equals(payload))throw Error('Original payload changed');
 for(const file of plan.files){const node=entry(final.header,file.path);if(hash(checked.subarray(final.offset+Number(node.offset),final.offset+Number(node.offset)+node.size))!==file.patchedSha256)throw Error('Output entry mismatch');}
 return {archive:resolve(destination),sha256:hash(checked),preservedPayloadBytes:payload.length};
}
