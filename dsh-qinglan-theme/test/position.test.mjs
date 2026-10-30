import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { randomUUID } from 'node:crypto';
import { ThemeRepository, INITIAL_DOCUMENT, validDocument } from '../host-store.js';
const source=readFileSync(new URL('../client.js',import.meta.url),'utf8');
const extract=(name,scope={})=>runInNewContext('('+source.match(new RegExp(`    function ${name}\\([^]*?\\n    \\}`))[0]+')',scope);
const defaults=runInNewContext('('+source.match(/const defaults = (\{[^\n]+\});/)[1]+')');
const palettes=runInNewContext('('+source.match(/const palettes = (\{[\s\S]*?\n    \});/)[1]+')');
const sanitize=extract('sanitize',{palettes}), imagePlacement=extract('imagePlacement'), layers=extract('layerPresentation'), reset=extract('backgroundReset',{defaults});
function open(document=structuredClone(INITIAL_DOCUMENT)) {
  const data={document,writes:0};
  const images=new Map();
  const domain={global:{get:()=>data.document,set:async v=>{assert.equal(validDocument(v),true);data.document=structuredClone(v);data.writes++;}},table:()=>({get:k=>images.get(k),entries:()=>images.entries(),put:async(k,v)=>images.set(k,structuredClone(v)),delete:async k=>images.delete(k)})};
  return {repo:new ThemeRepository(domain),data,domain};
}
test('client defaults and legacy input normalize to centered image',()=>{
  assert.equal(sanitize({palette:'sky'}).positionX,50); assert.equal(sanitize({}).positionY,50);
  assert.equal(sanitize({positionX:-20,positionY:130}).positionX,0);
  assert.equal(sanitize({positionX:-20,positionY:130}).positionY,100);
  assert.equal(sanitize({positionX:NaN,positionY:Infinity}).positionX,50);
});
test('CSS placement uses both percentage axes for all image modes',()=>{
  for(const fit of ['cover','contain','repeat']) {
    const style=imagePlacement({fit,positionX:20,positionY:75});
    assert.equal(style.backgroundPosition,'20% 75%');
    assert.equal(style.backgroundSize,fit==='repeat'?'auto 320px':fit);
    assert.equal(style.backgroundRepeat,fit==='repeat'?'repeat':'no-repeat');
  }
  assert.match(source,/\.\.\.imagePlacement\(s\)/);
});
test('image fitting uses visible bounds, not overscan that clips edge positions',()=>{
  for(const fit of ['cover','contain','repeat']) assert.equal(layers({...defaults,fit,image:'image'}).imageInset,0);
});
test('background-control reset restores center and does not touch picture',()=>{
  const before={...defaults,image:'keep',positionX:0,positionY:100};
  const after={...before,...reset()};
  assert.equal(after.positionX,50); assert.equal(after.positionY,50); assert.equal(after.image,'keep');
});
test('Host accepts integer edge positions and rejects invalid values without writes',async()=>{
  const x=open();
  let result=await x.repo.execute({action:'update',expectedRevision:0,patch:{positionX:0,positionY:100}});
  assert.equal(result.state.positionX,0); assert.equal(result.state.positionY,100);
  for(const field of ['positionX','positionY']) for(const value of [-1,101,1.5,NaN,Infinity,'50',null]) {
    await assert.rejects(x.repo.execute({action:'update',expectedRevision:1,patch:{[field]:value}}),{code:'INVALID_INPUT'});
  }
  assert.equal(x.data.writes,1);
});
test('old current and preset states without positions read centered without mutating storage',async()=>{
  const old=structuredClone(INITIAL_DOCUMENT);
  delete old.current.positionX; delete old.current.positionY;
  old.presets=[{id:randomUUID(),name:'Old',state:{...old.current}}];
  const x=open(old); assert.equal(validDocument(old),true);
  const result=await x.repo.execute({action:'read'});
  assert.equal(result.state.positionX,50); assert.equal(result.presets[0].state.positionY,50);
  assert.equal(x.data.writes,0); assert.equal('positionX' in old.current,false);
  const changed=await x.repo.execute({action:'applyPreset',expectedRevision:0,id:old.presets[0].id});
  assert.equal(changed.state.positionX,50); assert.equal(x.data.document.current.positionY,50);
});
test('positions survive presets, restart and reset returns to center',async()=>{
  const x=open();
  await x.repo.execute({action:'update',expectedRevision:0,patch:{positionX:15,positionY:85}});
  const saved=await x.repo.execute({action:'savePreset',expectedRevision:1,name:'Framing'});
  const cleared=await x.repo.execute({action:'reset',expectedRevision:2});
  assert.equal(cleared.state.positionX,50);
  const restarted=new ThemeRepository(x.domain);
  const applied=await restarted.execute({action:'applyPreset',expectedRevision:3,id:saved.presets[0].id});
  assert.equal(applied.state.positionX,15); assert.equal(applied.state.positionY,85);
});
