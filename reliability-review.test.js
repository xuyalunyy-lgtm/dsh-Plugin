import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, createController } from './state.js';

function fixture() {
  let stored=initialState(), now=Date.UTC(2026,9,23,9), sequence=0, fail=false;
  const make=()=>createController({load:()=>stored,save:async next=>{if(fail)throw Error('review disk failure');stored=structuredClone(next);},clock:()=>now,id:()=>`review-task-${++sequence}`});
  return {make,stored:()=>structuredClone(stored),advance:ms=>{now+=ms;},fail:value=>{fail=value;}};
}
const request={action:'add',date:'2026-10-23',title:'Review fixture',requestId:'review-request-000001'};

test('review: an identical retry across controller restart creates only one task',async()=>{
  const f=fixture();let controller=f.make();
  try {
    const first=await controller.dispatch(request);assert.equal(first.ok,true);
    const task=first.state.tasks[0];assert.equal(typeof task.editToken,'string');
    await controller.close();controller=f.make();
    const repeated=await controller.dispatch(request);assert.equal(repeated.ok,true);
    assert.equal(repeated.state.tasks.length,1);assert.equal(repeated.state.tasks[0].id,task.id);
    const mismatch=await controller.dispatch({...request,title:'Changed payload'});assert.equal(mismatch.ok,false);
    assert.equal(mismatch.code,'REQUEST_ID_REUSED');
    assert.equal(f.stored().tasks[0].title,'Review fixture');
  }finally{await controller.close();}
});

test('review: retrying a committed add after deletion does not resurrect the task',async()=>{
  const f=fixture(),controller=f.make();
  try {
    const added=await controller.dispatch(request),task=added.state.tasks[0];
    assert.equal((await controller.dispatch({action:'delete',id:task.id,expectedToken:task.editToken})).ok,true);
    const retried=await controller.dispatch(request);assert.equal(retried.ok,true);
    assert.equal(retried.state.tasks.length,0);assert.equal(retried.state.trash.length,1);
  }finally{await controller.close();}
});

test('review: failed save leaves neither task nor a successful receipt',async()=>{
  const f=fixture(),controller=f.make();
  try {
    const before=f.stored();f.fail(true);
    assert.equal((await controller.dispatch(request)).ok,false);assert.deepEqual(f.stored(),before);
    f.fail(false);const retried=await controller.dispatch(request);assert.equal(retried.ok,true);assert.equal(retried.state.tasks.length,1);
    const again=await controller.dispatch(request);assert.equal(again.ok,true);assert.equal(again.state.tasks.length,1);
  }finally{await controller.close();}
});

test('review: stale edit tokens stay stale after text is changed back or task is restored',async()=>{
  const f=fixture(),controller=f.make();
  try {
    const added=await controller.dispatch(request),a=added.state.tasks[0];
    const updated=await controller.dispatch({action:'update',id:a.id,title:'B',expectedToken:a.editToken});assert.equal(updated.ok,true);
    const changedBack=await controller.dispatch({action:'update',id:a.id,title:a.title,expectedToken:updated.state.tasks[0].editToken});assert.equal(changedBack.ok,true);
    const stale=await controller.dispatch({action:'update',id:a.id,time:'10:00',expectedToken:a.editToken});assert.equal(stale.ok,false);assert.equal(stale.code,'CONFLICT');
    const current=changedBack.state.tasks[0];
    const deleted=await controller.dispatch({action:'delete',id:a.id,expectedToken:current.editToken});assert.equal(deleted.ok,true);
    const restored=await controller.dispatch({action:'restore',id:a.id,expectedToken:deleted.state.trash[0].task.editToken});assert.equal(restored.ok,true);
    assert.equal((await controller.dispatch({action:'delete',id:a.id,expectedToken:current.editToken})).ok,false);
    assert.equal(f.stored().tasks.length,1);
  }finally{await controller.close();}
});

test('review: focus accounting does not invalidate the editable task baseline',async()=>{
  const f=fixture(),controller=f.make();
  try {
    const added=await controller.dispatch(request),task=added.state.tasks[0];
    assert.equal((await controller.dispatch({action:'focusStart',id:task.id})).ok,true);
    f.advance(1000);assert.equal((await controller.dispatch({action:'focusPause'})).ok,true);
    const edited=await controller.dispatch({action:'update',id:task.id,title:'Edited after focus',expectedToken:task.editToken});
    assert.equal(edited.ok,true);assert.equal(edited.state.tasks[0].focusMs,1000);
  }finally{await controller.close();}
});

test('review: exported backups exclude edit tokens and request receipts; replacement invalidates old editors',async()=>{
  const f=fixture(),controller=f.make();
  try {
    const added=await controller.dispatch(request),task=added.state.tasks[0];
    const {backup}=await controller.dispatch({action:'export'});
    const serialized=JSON.stringify(backup);assert.equal(serialized.includes('editToken'),false);assert.equal(serialized.includes(request.requestId),false);
    const preview=await controller.dispatch({action:'importPreview',backup});assert.equal(preview.ok,true);
    const replaced=await controller.dispatch({action:'import',backup,mode:'replace',token:preview.preview.token});assert.equal(replaced.ok,true);
    const stale=await controller.dispatch({action:'update',id:task.id,done:true,expectedToken:task.editToken});assert.equal(stale.ok,false);assert.equal(stale.code,'CONFLICT');
    assert.equal(f.stored().tasks[0].done,false);
  }finally{await controller.close();}
});
