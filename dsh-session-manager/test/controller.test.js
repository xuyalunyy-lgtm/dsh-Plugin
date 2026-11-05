import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createController, assertSafeHistory, createHttpHandler, isEmptyHistory } from '../controller.js';
import { apply, parameters } from '../index.js';

const copy = value => structuredClone(value);
// Mirrors the released format codec relationship: the last inherited marker
// must exist exactly at the persisted cut. A permissive inspect mock hid the
// original runtime-only migration failure, so keep this read-back check strict.
function validateStoredSeed(row) {
  const markers = row.events.filter(event => event.type === 'session/end-seed' && event.data.inherited === true);
  if (row.header.isSeeded && markers.at(-1)?.seq !== row.inheritedEventCount) throw Error('seeded Session lacks an inherited end-seed marker');
  if (!row.header.isSeeded && (row.inheritedEventCount !== 0 || markers.length)) throw Error('unseeded Session has inherited history');
}
function fixture(events = []) {
  const stored = new Map(), archived = new Set(), pinned = new Set(), activities = new Map(), calls = [], receipts = new Map();
  const failures = {}, agents = new Map(); let revision = 0;
  const receiptTable = { get: id => receipts.get(id), entries: () => receipts.entries(), get size() { return receipts.size; }, async put(id, value) { if (failures.receipt?.(value)) throw Error('receipt disk failure'); receipts.set(id, copy(value)); } };
  const workspaces = ['one','two'].map((id,index) => ({ id, title: id, path: `D:\\workspace${index}`, sessionIds: index === 0 ? ['source'] : [], async status() { return failures.missingDir ? 'missing-dir' : 'ok'; }, async attachSession(id) { calls.push(['attach',id]); if (failures.attach) throw Error('attach'); if (stored.get(id).header.cwd !== this.path) throw Error('immutable cwd mismatch'); if (!this.sessionIds.includes(id)) this.sessionIds.push(id); } }));
  function add(id, events, extra = {}) { stored.set(id, { header: { version: 4, id, createdAt: 1, cwd: workspaces[0].path, isSeeded: false, agentPreset: 'main', ...extra }, inheritedEventCount: 0, events: copy(events), revision: ++revision }); }
  add('source', events);
  const handle = (id, access = 'write') => ({
    get header() { return copy(stored.get(id).header); },
    get inheritedEventCount() { return stored.get(id).inheritedEventCount; },
    async read() { const row = stored.get(id); if (access === 'read') validateStoredSeed(row); return { events: copy(row.events) }; },
    async append(events) { calls.push(['append',id]); if (failures.append) { const first = events.slice(0,1); stored.get(id).events.push(...copy(first)); throw Error('append failed'); } stored.get(id).events.push(...copy(events)); stored.get(id).revision = ++revision; },
    async flush() { calls.push(['flush',id]); if (failures.flush) throw Error('flush'); },
    async close() { calls.push(['close',id]); if (failures.close) throw Error('close'); },
  });
  const ctx = {
    workspaceRegistry: {
      list: () => workspaces,
      get: id => workspaces.find(w => w.id === id),
      async archiveSession(id) { calls.push(['archive',id]); if (failures.archive?.(id)) throw Error('archive'); if (activities.get(id)?.length) throw Error('active'); archived.add(id); pinned.delete(id); failures.afterArchive?.(id); },
      async unarchiveSession(id) { calls.push(['restore',id]); if (failures.restore) throw Error('restore'); archived.delete(id); },
      async pinSession(id) { pinned.add(id); },
    },
    workspaceController: { async *follow() { yield { type: 'baseline', value: { items: [], archivedSessionIds: [...archived], pinnedSessionIds: [...pinned] } }; } },
    sessionQuery: {
      async observeSession(id) {
        calls.push(['observe',id]);
        const row = ctx.sessions.get(id);
        if (!row) throw Error('not live');
        return { source: 'live', header: copy(row.header), events: copy(row.events), inheritedEventCount: row.inheritedEventCount, [Symbol.dispose]() { calls.push(['dispose',id]); } };
      },
    },
    sessionController: {
      async list() { return { items: [...stored].map(([id, row]) => ({ sessionId: id, cwd: row.header.cwd, updatedAt: 10, running: agents.get(id)?.status === 'running', projections: { values: {} } })) }; },
      async create({ workspaceId, sessionId }) { calls.push(['create',sessionId]); add(sessionId, [], { cwd: workspaces.find(w => w.id === workspaceId).path }); if (failures.create) throw Error('created but response failed'); return { sessionId }; },
    },
    sessionPersistence: {
      async stat(id) {
        const row = stored.get(id);
        if (!row) return undefined;
        // JSONL stat reconstructs key order and fills the delegation default.
        const header = row.header;
        return { header: { version: header.version, id: header.id, createdAt: header.createdAt, ...(header.cwd === undefined ? {} : { cwd: header.cwd }), ...(header.parentSession === undefined ? {} : { parentSession: header.parentSession }), isSeeded: header.isSeeded, ...(header.origin === undefined ? {} : { origin: header.origin }), delegationDepth: header.delegationDepth ?? 0, ...(header.agentPreset === undefined ? {} : { agentPreset: header.agentPreset }) }, revision: String(row.revision), eventCount: row.events.length };
      },
      async create(header, options) { calls.push(['persist-create',header.id]); if (stored.has(header.id)) throw Error('exists'); stored.set(header.id,{header:copy(header), events:[], inheritedEventCount:options.inheritedEventCount, revision:++revision}); return handle(header.id); },
      async open(id, access) { if (!stored.has(id)) throw Error('not found'); if (access === 'read') calls.push(['inspect',id]); return handle(id, access); }, async flush() {},
    },
    sessions: { get() {}, async flush() {} },
    agents: { get: id => agents.get(id), list: () => [...agents.values()] },
    agentPresets: { async resolve() { return { id: 'main' }; } },
    async waterfall(_name, { sessionId }, next) { return [...(activities.get(sessionId) || []), ...await next()]; },
    get(name) {
      if (name === 'jobs') return { list: id => failures.jobs === true || failures.jobOwner === id ? [{ owner:id, status:'running' }] : [] };
      if (name === 'subagents') return { async listDescendants(id) { calls.push(['descendants',id]); if (failures.descendants) throw Error('historical catalog unavailable'); return failures.descendantRows ?? []; } };
      return undefined;
    },
  };
  let visibilityData = { revision: 0, hiddenWorkspaceIds: [], receipts: [] };
  const visibility = {
    get: () => copy(visibilityData),
    async set(next) {
      if (failures.visibility === 'before') throw Error('before visibility commit');
      visibilityData = copy(next);
      if (failures.visibility === 'after') throw Error('after visibility commit');
    },
  };
  const controller = createController(ctx, receiptTable, { now: () => 100, visibility });
  const token = async () => (await controller.dispatch({action:'list'})).items.find(row => row.sessionId === 'source')?.token;
  const move = async (requestId = 'request-move-00001') => controller.dispatch({ action:'move', sessionId:'source', workspaceId:'two', expectedToken:await token(), requestId });
  return { ctx, controller, stored, archived, pinned, activities, calls, failures, agents, receipts, receiptTable, token, move, add, workspaces, visibility };
}
const closed = () => [
  {type:'turn/start',seq:0,time:1,data:{turn:1}},
  {type:'step/start',seq:1,time:2,data:{turn:1,step:1}},
  {type:'step/end',seq:2,time:3,data:{turn:1,step:1}},
  {type:'turn/end',seq:3,time:4,data:{turn:1,reason:{kind:'completed'}}},
];

test('list supplies workspace contract and cached token; unknown parameters rejected', async () => {
  const f = fixture(closed());
  const one = await f.controller.dispatch({ action:'list' });
  assert.equal(one.ok,true); assert.equal(one.total,1); assert.equal(one.items[0].workspaceId,'one'); assert.equal(one.workspaces[1].path,'D:\\workspace1');
  const before = f.calls.filter(call => call[0] === 'inspect').length;
  const two = await f.controller.dispatch({ action:'list', query:'source' });
  assert.equal(one.items[0].token,two.items[0].token); assert.equal(f.calls.filter(call => call[0] === 'inspect').length,before);
  assert.equal((await f.controller.dispatch({action:'list',x:1})).code,'INVALID_REQUEST');
});
test('create is deterministic, durable and idempotent across controller restart', async () => {
  const f = fixture(); const request = {action:'create',workspaceId:'two',requestId:'create-request-00001'};
  const [a,b] = await Promise.all([f.controller.dispatch(request),f.controller.dispatch(request)]);
  assert.equal(a.ok,true); assert.deepEqual(a,b); assert.equal(f.calls.filter(c => c[0] === 'create').length,1);
  const resumed = createController(f.ctx,f.receiptTable);
  assert.deepEqual(await resumed.dispatch(request),a);
  assert.equal((await resumed.dispatch({...request,workspaceId:'one'})).code,'REQUEST_ID_REUSED');
});
test('create response loss retries same durable ID instead of creating twice', async () => {
  const f = fixture(); f.failures.create = true;
  const request={action:'create',workspaceId:'two',requestId:'create-response-loss'};
  assert.equal((await f.controller.dispatch(request)).code,'WRITE_UNCERTAIN');
  f.failures.create=false;
  assert.equal((await f.controller.dispatch(request)).ok,true);
  assert.equal(f.calls.filter(c=>c[0]==='create').length,1);
});
test('move preserves all history/preset, appends target cwd and archives only source', async () => {
  const events=[...closed(),{type:'working-directory/change',seq:4,time:9,data:{cwd:'D:\\old-directory'}}];
  const f=fixture(events); f.pinned.add('source');
  const result=await f.move(); assert.equal(result.ok,true); assert.notEqual(result.sessionId,'source');
  const child=f.stored.get(result.sessionId);
  assert.deepEqual(child.events.slice(0,events.length),events);
  assert.deepEqual(child.events[events.length], { type:'session/end-seed', seq:events.length, time:100, data:{inherited:true} });
  assert.equal(child.events.at(-1).seq,events.length+1);
  assert.equal(child.events.at(-1).data.cwd,f.workspaces[1].path);
  assert.equal(child.header.cwd,f.workspaces[1].path); assert.equal(child.header.agentPreset,'main'); assert.equal(child.header.parentSession,'source');
  assert.equal(child.inheritedEventCount,events.length); assert(f.archived.has('source')); assert(!f.archived.has(result.sessionId));
  assert(f.workspaces[1].sessionIds.includes(result.sessionId));
  const flush=f.calls.findIndex(c=>c[0]==='flush'&&c[1]===result.sessionId), attach=f.calls.findIndex(c=>c[0]==='attach'); assert(flush<attach);
});
test('empty-source move writes inherited marker at zero and remains cold-readable',async()=>{
  const f=fixture();const result=await f.move();assert.equal(result.ok,true);
  const row=f.stored.get(result.sessionId);assert.equal(row.inheritedEventCount,0);assert.equal(row.events.length,2);
  assert.deepEqual(row.events[0],{type:'session/end-seed',seq:0,time:100,data:{inherited:true}});
  assert.equal(row.events[1].type,'working-directory/change');assert.equal(row.events[1].seq,1);validateStoredSeed(row);
});
test('moving previously inherited history preserves old markers and appends final inherited cut',async()=>{
  const f=fixture([{type:'session/end-seed',seq:0,time:1,data:{inherited:true}},{type:'working-directory/change',seq:1,time:2,data:{cwd:'D:\\old'}}]);
  f.stored.get('source').header.isSeeded=true;f.stored.get('source').inheritedEventCount=0;
  const result=await f.move();assert.equal(result.ok,true);const row=f.stored.get(result.sessionId);
  assert.equal(row.inheritedEventCount,2);assert.equal(row.events[2].data.inherited,true);validateStoredSeed(row);
});
test('unreadable archived session yields disabled placeholder without blocking healthy rows',async()=>{
  const f=fixture();f.add('broken',[{type:'working-directory/change',seq:0,time:1,data:{cwd:'D:\\old'}}],{isSeeded:true});f.archived.add('broken');f.archived.add('source');
  const result=await f.controller.dispatch({action:'list',archived:true});assert.equal(result.ok,true);assert.equal(result.total,2);
  const broken=result.items.find(row=>row.sessionId==='broken'),healthy=result.items.find(row=>row.sessionId==='source');
  assert.match(broken.readError,/inherited end-seed marker/);assert.equal(Object.hasOwn(broken,'token'),false);assert.equal(typeof healthy.token,'string');
});
test('move retries after receipt barrier loss without duplicating target', async () => {
  const f=fixture(closed()); const request={action:'move',sessionId:'source',workspaceId:'two',expectedToken:await f.token(),requestId:'move-receipt-loss-1'};
  f.failures.receipt=value=>value.stage==='done';
  assert.equal((await f.controller.dispatch(request)).code,'WRITE_UNCERTAIN');
  f.failures.receipt=undefined;
  const resumed=createController(f.ctx,f.receiptTable);
  assert.equal((await resumed.dispatch(request)).ok,true);
  assert.equal(f.calls.filter(c=>c[0]==='persist-create').length,1);
});
test('partial append failure preserves complete source, restores pin and archives partial target',async()=>{
  const f=fixture(closed()); f.pinned.add('source'); f.failures.append=true;
  const result=await f.move(); assert.equal(result.ok,false); assert(!f.archived.has('source')); assert(f.pinned.has('source')); assert(f.archived.has(result.sessionId)); assert.deepEqual(f.stored.get('source').events,closed());
});
test('rollback retry also archives partial target after first archive failure',async()=>{
  const f=fixture(closed()); f.failures.append=true; f.failures.archive=id=>id!=='source';
  const request={action:'move',sessionId:'source',workspaceId:'two',expectedToken:await f.token(),requestId:'rollback-retry-0001'};
  assert.equal((await f.controller.dispatch(request)).code,'RECOVERY_REQUIRED');
  f.failures.archive=undefined;
  const result=await f.controller.dispatch(request); assert.equal(result.ok,false); assert(!f.archived.has('source')); assert(f.archived.has(result.sessionId));
});
test('rollback and frozen-source recovery do not require a surviving target workspace',async()=>{
  const f=fixture(closed()); f.failures.append=true; f.failures.restore=true;
  const request={action:'move',sessionId:'source',workspaceId:'two',expectedToken:await f.token(),requestId:'missing-target-001'};
  assert.equal((await f.controller.dispatch(request)).code,'RECOVERY_REQUIRED');
  f.failures.restore=false; f.workspaces.pop();
  assert.equal((await f.controller.dispatch(request)).ok,false); assert(!f.archived.has('source'));
  const g=fixture(closed()); const input={action:'move',sessionId:'source',workspaceId:'two',expectedToken:await g.token(),requestId:'frozen-target-0001'};
  g.failures.receipt=value=>value.stage==='done'; assert.equal((await g.controller.dispatch(input)).code,'WRITE_UNCERTAIN');
  g.failures.receipt=undefined;g.workspaces.pop();
  assert.equal((await g.controller.dispatch(input)).code,'WORKSPACE_NOT_FOUND');assert(!g.archived.has('source'));
});
test('delete is reversible native archival and restore requires fresh token',async()=>{
  const f=fixture(closed()); const request={action:'delete',sessionId:'source',expectedToken:await f.token(),requestId:'delete-request-001'};
  const result=await f.controller.dispatch(request); assert.equal(result.ok,true); assert(f.archived.has('source')); assert(f.stored.has('source'));
  assert.deepEqual(await f.controller.dispatch(request),result);
  const row=(await f.controller.dispatch({action:'list',archived:true})).items[0];
  assert.equal((await f.controller.dispatch({action:'restore',sessionId:'source',expectedToken:row.token,requestId:'restore-request-01'})).ok,true); assert(!f.archived.has('source'));
});
test('running/background/queued/open-turn histories reject move/delete without mutation',async()=>{
  for(const mode of ['running','activity','job','queue','turn','step','call']){
    const f=fixture(closed());
    if(mode==='running')f.agents.set('source',{status:'running'});
    if(mode==='activity')f.activities.set('source',[{kind:'terminal'}]);
    if(mode==='job')f.failures.jobs=true;
    if(mode==='queue')f.stored.get('source').events.push({type:'agent/inbox/spliced',seq:4,time:5,data:{target:'next-turn',start:0,inserted:[{id:'pending'}]}});
    if(mode==='turn')f.stored.get('source').events.push({type:'turn/start',seq:4,time:5,data:{turn:2}});
    if(mode==='step')f.stored.get('source').events.push({type:'step/start',seq:4,time:5,data:{turn:2,step:1}});
    if(mode==='call')f.stored.get('source').events.push({type:'tool/call',seq:4,time:5,data:{callId:'a'}});
    const result=await f.move(); assert.equal(result.code,'SESSION_BUSY',mode); assert.equal(f.calls.filter(c=>c[0]==='archive').length,0,mode);
    assert.equal((await f.controller.dispatch({action:'delete',sessionId:'source',expectedToken:await f.token(),requestId:'delete-busy-00001'})).code,'SESSION_BUSY',mode);
  }
});
test('coordination history moves byte-for-byte and inherited target remains deletable',async()=>{
  const records=[
    {type:'goal/change',data:{version:1,operation:'complete',goal:{phase:'complete'}}},
    {type:'schedule/change',data:{operation:'delete',id:'old-reminder'}},
    {type:'team/member',data:{version:2,teamId:'source',member:{id:'old-child',name:'reviewer',phase:'active'}}},
    {type:'team/task',data:{version:2,teamId:'source',task:{id:'task-1',revision:1,status:'completed'}}},
    {type:'subagent/catalog',data:{version:0,childId:'old-child',mode:'continuable',label:'old'}},
    {type:'subagent/descriptor',data:{version:3,mode:'continuable',provider:'fork',label:'inherited'}},
    {type:'tool-workflow/run-start',data:{runId:'old-run',name:'done'}},
    {type:'tool-workflow/run-end',data:{runId:'old-run',stopReason:'completed'}},
    {type:'user/message',surfaceOp:'append',data:{id:'m1',role:'user',source:{kind:'user'},content:[{type:'text',text:'unchanged'},{type:'file',attachment:{attachmentId:'file-ref',name:'a',bytes:12}}]}},
    {type:'tool/result',surfaceOp:{op:'replace',startSeq:12,endSeq:12},sourceEventSeqs:[12],data:{message:{toolCallId:'finished',content:[{type:'text',text:'result preserved'}]}}},
  ];
  const events=[...closed(),...records.map((record,index)=>({...record,seq:index+4,time:index+5}))];
  const f=fixture(events);f.failures.descendantRows=[{kind:'diagnostic',id:'old-child',reason:'unavailable'}];
  const result=await f.move();assert.equal(result.ok,true);const target=f.stored.get(result.sessionId);
  assert.deepEqual(target.events.slice(0,events.length),events);assert.equal(target.inheritedEventCount,events.length);
  // Mirrors the installed native projection selectors (not a runtime proof):
  // Team uses new header.id; catalog excludes seq < inheritedEventCount.
  assert.equal(target.events.filter(event=>event.type.startsWith('team/')&&event.data.teamId===target.header.id).length,0);
  assert.equal(target.events.filter(event=>event.type==='subagent/catalog'&&event.seq>=target.inheritedEventCount).length,0);
  const listed=await f.controller.dispatch({action:'list'}),row=listed.items.find(item=>item.sessionId===result.sessionId);
  const before=f.calls.filter(call=>call[0]==='descendants').length;
  assert.equal((await f.controller.dispatch({action:'delete',sessionId:result.sessionId,expectedToken:row.token,requestId:'delete-inherited-01'})).ok,true);
  assert.equal(f.calls.filter(call=>call[0]==='descendants').length,before);
});
test('ordinary historical coordination does not block source deletion or revive missing cold children',async()=>{
  const f=fixture([...closed(),{type:'team/member',seq:4,time:5,data:{version:2,teamId:'source',member:{id:'gone',name:'old',phase:'active'}}},{type:'subagent/catalog',seq:5,time:6,data:{childId:'gone'}}]);
  f.failures.descendants=true;
  assert.equal((await f.controller.dispatch({action:'delete',sessionId:'source',expectedToken:await f.token(),requestId:'delete-old-history1'})).ok,true);
});
test('native subagent identities remain rejected',()=>{
  const f=fixture(); f.stored.get('source').header.origin='subagent';
  assert.throws(()=>assertSafeHistory({meta:f.stored.get('source').header,events:[]},'delete'),/子智能体/);
});
test('actual child subtree work blocks move/delete with clear reasons, including idle queues/jobs',async()=>{
  for(const mode of ['running','queue','job','provisioning','unreadable-live','nested']){
    const f=fixture(closed());
    f.add('child',mode==='queue'?[{type:'agent/inbox/spliced',seq:0,time:1,data:{target:'next-turn',start:0,inserted:[{id:'pending'}]}}]:[],{origin:'subagent',parentSession:'source'});
    f.agents.set('child',{id:'child',status:mode==='running'?'running':'inactive',session:{header:f.stored.get('child').header}});
    if(mode==='job')f.failures.jobOwner='child';
    if(mode==='provisioning')f.stored.get('source').events.push({type:'team/member',seq:4,time:5,data:{version:2,teamId:'source',member:{id:'materializing',name:'reviewer',phase:'provisioning'}}});
    if(mode==='unreadable-live')f.stored.delete('child');
    if(mode==='nested'){
      f.add('grandchild',[],{origin:'subagent',parentSession:'child'});
      f.agents.set('grandchild',{id:'grandchild',status:'running',session:{header:f.stored.get('grandchild').header}});
    }
    const result=await f.move();assert.equal(result.code,mode==='unreadable-live'?'STATE_UNAVAILABLE':'SESSION_BUSY',mode);assert.match(result.error,/子智能体|正在创建/,mode);
    assert(!f.archived.has('source'));assert.equal(f.calls.filter(call=>call[0]==='persist-create').length,0);
    const deleted=await f.controller.dispatch({action:'delete',sessionId:'source',expectedToken:await f.token(),requestId:'delete-child-busy01'});assert.equal(deleted.ok,false,mode);
  }
});
test('cold readable catalog child queue blocks but stale catalog diagnostic does not',async()=>{
  const f=fixture([...closed(),{type:'subagent/catalog',seq:4,time:5,data:{childId:'cold'}}]);
  f.add('cold',[{type:'agent/inbox/spliced',seq:0,time:1,data:{target:'next-step',start:0,inserted:[{id:'waiting'}]}}],{origin:'subagent',parentSession:'source'});
  f.failures.descendantRows=[{kind:'child',id:'cold',mode:'continuable',label:'cold reviewer',activity:'inactive'}];
  const busy=await f.move();assert.equal(busy.code,'SESSION_BUSY');assert.match(busy.error,/排队输入/);
  f.stored.delete('cold');f.failures.descendantRows=[{kind:'diagnostic',id:'cold',reason:'unavailable'}];
  f.failures.jobOwner='cold';const job=await f.move('move-cold-job-0001');assert.equal(job.code,'SESSION_BUSY');assert.match(job.error,/后台任务/);
  f.failures.jobOwner=undefined;
  assert.equal((await f.move('move-old-catalog-01')).ok,true);
});
test('ordinary fork runtime lineage and inherited transient queues do not become owned child activity',async()=>{
  const f=fixture(closed());f.add('fork',[],{parentSession:'source'});f.agents.set('fork',{id:'fork',status:'running',session:{header:f.stored.get('fork').header}});
  assert.equal((await f.move()).ok,true);
  const events=[{type:'agent/inbox/spliced',seq:0,time:1,data:{target:'next-turn',start:0,inserted:[{id:'old'}]}},{type:'session/end-seed',seq:1,time:2,data:{inherited:true}}];
  assert.doesNotThrow(()=>assertSafeHistory({meta:{id:'new',isSeeded:true},inheritedEventCount:1,events},'delete'));
});
test('old UNSUPPORTED_HISTORY receipt remains exact and fresh request can migrate',async()=>{
  const f=fixture([...closed(),{type:'goal/change',seq:4,time:5,data:{}}]);
  const request={action:'move',sessionId:'source',workspaceId:'two',expectedToken:await f.token(),requestId:'legacy-request-001'};
  const {createHash}=await import('node:crypto');const fingerprint=createHash('sha256').update(JSON.stringify(request)).digest('hex');
  const failure={ok:false,code:'UNSUPPORTED_HISTORY',error:'旧版本拒绝'};
  f.receipts.set(request.requestId,{fingerprint,request,createdAt:1,stage:'done',result:failure});
  assert.deepEqual(await f.controller.dispatch(request),failure);
  assert.equal((await f.controller.dispatch({...request,requestId:'fresh-history-0001'})).ok,true);
});
test('empty flag is based on conservative full history, never title alone',async()=>{
  const setup=['session/title','working-directory/change','agent-preset/selected','model/selection','approval/policy','session/end-seed'].map((type,seq)=>({type,seq,time:seq,data:{title:'renamed blank'}}));
  assert.equal(isEmptyHistory({events:[]}),true);assert.equal(isEmptyHistory({events:setup}),true);
  for(const type of ['user/message','assistant/message','tool/call','tool/result','goal/change','team/task','subagent/catalog','tool-workflow/run-start','unknown/record','agent/inbox/spliced','request/context','request/header'])assert.equal(isEmptyHistory({events:[{type,data:{}}]}),false,type);
  const f=fixture(setup.filter(event=>event.type!=='session/end-seed'));const listed=await f.controller.dispatch({action:'list'});assert.equal(listed.items[0].empty,true);
  const g=fixture([{type:'session/title',seq:0,time:1,data:{title:'新会话'}},{type:'goal/change',seq:1,time:2,data:{}}]);assert.equal((await g.controller.dispatch({action:'list'})).items[0].empty,false);
});
async function batchRequest(f, ids=['source','second'],requestId='batch-delete-00001'){
  const rows=(await f.controller.dispatch({action:'list'})).items;
  return {action:'batchDelete',items:ids.map(sessionId=>({sessionId,expectedToken:rows.find(row=>row.sessionId===sessionId).token})),requestId};
}
test('batch deletion settles partial safety failures and exact retry never rearchives restored success',async()=>{
  const f=fixture();f.add('second',[]);f.agents.set('second',{status:'running'});
  const request=await batchRequest(f);const result=await f.controller.dispatch(request);
  assert.equal(result.ok,true);assert.equal(result.succeeded,1);assert.equal(result.failed,1);assert.equal(result.results[1].code,'SESSION_BUSY');assert(f.archived.has('source'));assert(!f.archived.has('second'));
  await f.ctx.workspaceRegistry.unarchiveSession('source');f.agents.delete('second');
  const before=f.calls.filter(call=>call[0]==='archive').length;
  const restarted=createController(f.ctx,f.receiptTable,{visibility:f.visibility});assert.deepEqual(await restarted.dispatch(request),result);
  assert.equal(f.calls.filter(call=>call[0]==='archive').length,before);assert(!f.archived.has('source'));assert(!f.archived.has('second'));
});
test('batch uncertainty stops remaining items, gates new writes and retries only unfinished child',async()=>{
  const f=fixture();f.add('second',[]);const request=await batchRequest(f);let armed=true;
  f.failures.receipt=value=>armed&&value.request?.action==='delete'&&value.request.sessionId==='source'&&value.stage==='done';
  assert.equal((await f.controller.dispatch(request)).code,'WRITE_UNCERTAIN');assert(f.archived.has('source'));assert(!f.archived.has('second'));
  assert.equal((await f.controller.dispatch({action:'create',workspaceId:'two',requestId:'blocked-create-0001'})).code,'PENDING');
  const restarted=createController(f.ctx,f.receiptTable,{visibility:f.visibility});assert.equal((await restarted.dispatch({action:'restore',sessionId:'source',expectedToken:'x',requestId:'blocked-restore-01'})).code,'PENDING');
  armed=false;const result=await restarted.dispatch(request);assert.equal(result.ok,true);assert.equal(result.succeeded,2);assert(f.archived.has('second'));
});
test('uncertain batch child never overwrites a native restore before its exact retry',async()=>{
  const f=fixture();f.add('second',[]);const request=await batchRequest(f);
  f.failures.receipt=value=>value.request?.action==='delete'&&value.request.sessionId==='source'&&value.stage==='done';
  assert.equal((await f.controller.dispatch(request)).code,'WRITE_UNCERTAIN');assert(f.archived.has('source'));
  await f.ctx.workspaceRegistry.unarchiveSession('source');f.failures.receipt=undefined;
  const result=await f.controller.dispatch(request);assert.equal(result.ok,true);assert.equal(result.results[0].code,'CONFLICT');assert.equal(result.succeeded,1);assert.equal(result.failed,1);assert(!f.archived.has('source'));assert(f.archived.has('second'));
});
test('batch parent receipt loss replays settled children without overwriting later native restore',async()=>{
  const f=fixture();f.add('second',[]);const request=await batchRequest(f);f.failures.receipt=value=>value.request?.action==='batchDelete'&&value.stage==='done';
  assert.equal((await f.controller.dispatch(request)).code,'WRITE_UNCERTAIN');await f.ctx.workspaceRegistry.unarchiveSession('source');
  f.failures.receipt=undefined;const before=f.calls.filter(call=>call[0]==='archive').length;
  const result=await f.controller.dispatch(request);assert.equal(result.ok,true);assert.equal(result.succeeded,2);assert.equal(f.calls.filter(call=>call[0]==='archive').length,before);assert(!f.archived.has('source'));
});
test('batch format and capacity are preflighted before every side effect',async()=>{
  const f=fixture();const valid=await batchRequest(f,['source']);
  for(const items of [[],Array(51).fill(valid.items[0]),[valid.items[0],valid.items[0]],[{sessionId:'source'}],[{...valid.items[0],extra:1}]]) assert.equal((await f.controller.dispatch({...valid,items})).code,'INVALID_REQUEST');
  assert.equal(f.calls.filter(call=>call[0]==='archive').length,0);
  for(let i=0;i<4095;i++)f.receipts.set(`full-${i}`,{stage:'done'});
  assert.equal((await f.controller.dispatch(valid)).code,'JOURNAL_FULL');assert.equal(f.calls.filter(call=>call[0]==='archive').length,0);
});
test('batch conflict results remain stable and request ID parameter changes are rejected',async()=>{
  const f=fixture();f.add('second',[]);const request=await batchRequest(f);request.items[1].expectedToken='stale';
  const result=await f.controller.dispatch(request);assert.equal(result.ok,true);assert.equal(result.results[1].code,'CONFLICT');
  assert.equal((await f.controller.dispatch({...request,items:[request.items[0]]})).code,'REQUEST_ID_REUSED');
});
test('token conflict and late source change cancel without losing content',async()=>{
  const f=fixture(closed()); const token=await f.token(); f.stored.get('source').events.push({type:'working-directory/change',seq:4,time:5,data:{cwd:'D:\\changed'}});
  assert.equal((await f.controller.dispatch({action:'move',sessionId:'source',workspaceId:'two',expectedToken:token,requestId:'conflict-request-01'})).code,'CONFLICT');
  const g=fixture(closed()); g.failures.afterArchive=id=>{if(id==='source')g.stored.get(id).events.push({type:'working-directory/change',seq:4,time:5,data:{cwd:'D:\\race'}});};
  assert.equal((await g.move()).code,'CONFLICT'); assert(!g.archived.has('source')); assert.equal(g.stored.get('source').events.length,5);
});
test('same-workspace/missing directory and full journal fail before session writes',async()=>{
  const f=fixture(); assert.equal((await f.controller.dispatch({action:'move',sessionId:'source',workspaceId:'one',expectedToken:await f.token(),requestId:'same-workspace-001'})).code,'SAME_WORKSPACE');
  f.failures.missingDir=true; assert.equal((await f.move()).code,'WORKSPACE_UNAVAILABLE');
  const g=fixture(); for(let i=0;i<4096;i++)g.receipts.set(String(i),{});
  assert.equal((await g.controller.dispatch({action:'create',workspaceId:'two',requestId:'full-journal-00001'})).code,'JOURNAL_FULL');
});
function response(){return {status:0,headersSent:false,writeHead(status){this.status=status;this.headersSent=true;},end(text){this.body=JSON.parse(text);}};}
function request(body={},headers={'content-type':'application/json'}){const req=Readable.from([JSON.stringify(body)]);req.method='POST';req.headers=headers;return req;}
test('prepared precondition failure settles while applying uncertainty retains exact request',async()=>{
  const f=fixture(); const request={action:'create',workspaceId:'two',requestId:'prepared-failure-01'};
  f.failures.receipt=value=>value.stage==='applying';
  assert.equal((await f.controller.dispatch(request)).code,'WRITE_UNCERTAIN');
  f.failures.receipt=undefined; f.failures.missingDir=true;
  assert.equal((await f.controller.dispatch(request)).code,'WORKSPACE_UNAVAILABLE');
  assert.equal(f.receipts.get(request.requestId).stage,'done');
  const g=fixture();g.failures.create=true;
  assert.equal((await g.controller.dispatch(request)).code,'WRITE_UNCERTAIN');
  g.failures.missingDir=true;
  assert.equal((await g.controller.dispatch(request)).code,'WRITE_UNCERTAIN');
  assert.equal(g.receipts.get(request.requestId).stage,'applying');
});
test('HTTP rejects unauthenticated/non-owner before reading body or dispatch',async()=>{
  for(const admission of [{rejection:401},{peer:{principal:{kind:'guest'}}}]){
    let called=0;const handler=createHttpHandler({admit:()=>admission},async()=>{called++;});const res=response();await handler(request(),res);assert.equal(res.status,admission.rejection||403);assert.equal(called,0);
  }
});
test('HTTP owner dispatch shares contract and rejects invalid content/oversized JSON',async()=>{
  const handler=createHttpHandler({admit:()=>({peer:{principal:{kind:'owner'}}})},async input=>({ok:true,action:input.action}));
  const res=response();await handler(request({action:'list'}),res);assert.equal(res.body.action,'list');
  const bad=response();await handler(request({},{}),bad);assert.equal(bad.status,415);
  const large=response();await handler(request({query:'a'.repeat(17000)}),large);assert.equal(large.status,413);
});
test('purge refuses an unpatched host without reserving a receipt', async () => {
  const f=fixture(); f.archived.add('source');
  const row=(await f.controller.dispatch({action:'list',archived:true})).items[0];
  assert.equal(row.purgeRevision,undefined);
  const result=await f.controller.dispatch({action:'purge',sessionId:'source',expectedToken:row.token,expectedStorageRevision:'1',requestId:'purge-unsupported-0001'});
  assert.equal(result.code,'UNSUPPORTED_RUNTIME'); assert.equal(f.receipts.size,0); assert.ok(f.stored.has('source'));
});
test('purge retries a lost response after logs disappear using the original frozen request', async () => {
  const f=fixture(); f.archived.add('source'); let committed; let calls=0;
  f.ctx.workspaceRegistry.purgeArchivedSession=async request=>{
    calls++; if(committed){assert.deepEqual(request,committed);return;}
    committed=copy(request); f.stored.delete(request.sessionId); f.archived.delete(request.sessionId);
    throw Object.assign(Error('response lost'),{purgeCommitted:true});
  };
  const row=(await f.controller.dispatch({action:'list',archived:true})).items[0];
  const request={action:'purge',sessionId:'source',expectedToken:row.token,expectedStorageRevision:row.purgeRevision,requestId:'purge-response-lost-001'};
  assert.equal((await f.controller.dispatch(request)).code,'WRITE_UNCERTAIN');
  const restarted=createController(f.ctx,f.receiptTable);
  const result=await restarted.dispatch(request); assert.equal(result.ok,true); assert.equal(calls,2);
  assert.deepEqual(await restarted.dispatch(request),result); assert.equal(calls,2);
  assert.equal((await restarted.dispatch({...request,expectedStorageRevision:'changed'})).code,'REQUEST_ID_REUSED');
});
test('concurrent identical purge requests invoke the host once', async () => {
  const f=fixture();f.archived.add('source');let calls=0;
  f.ctx.workspaceRegistry.purgeArchivedSession=async request=>{calls++;f.stored.delete(request.sessionId);};
  const row=(await f.controller.dispatch({action:'list',archived:true})).items[0];
  const request={action:'purge',sessionId:'source',expectedToken:row.token,expectedStorageRevision:row.purgeRevision,requestId:'purge-concurrent-001'};
  const [a,b]=await Promise.all([f.controller.dispatch(request),f.controller.dispatch(request)]);
  assert.equal(a.ok,true);assert.deepEqual(a,b);assert.equal(calls,1);
});
test('purge requires archived state before invoking the host', async () => {
  const f=fixture();let calls=0;f.ctx.workspaceRegistry.purgeArchivedSession=async()=>{calls++;};
  const request={action:'purge',sessionId:'source',expectedToken:await f.token(),expectedStorageRevision:'1',requestId:'purge-active-refused-001'};
  assert.equal((await f.controller.dispatch(request)).code,'INVALID_STATE');assert.equal(calls,0);assert.ok(f.stored.has('source'));
});
test('purge definite precommit refusal settles without deleting and remains replayable', async () => {
  const f=fixture();f.archived.add('source');let calls=0;
  f.ctx.workspaceRegistry.purgeArchivedSession=async()=>{calls++;throw Object.assign(Error('会话仍被引用'),{code:'PURGE_REFERENCED',purgeCommitted:false});};
  const row=(await f.controller.dispatch({action:'list',archived:true})).items[0];
  const request={action:'purge',sessionId:'source',expectedToken:row.token,expectedStorageRevision:row.purgeRevision,requestId:'purge-refused-00001'};
  const result=await f.controller.dispatch(request);assert.equal(result.code,'PURGE_REFERENCED');assert.ok(f.stored.has('source'));
  assert.deepEqual(await f.controller.dispatch(request),result);assert.equal(calls,1);
});
test('plugin registers shared service, tool and exact owner-auth HTTP route',async()=>{
  // Test apply's shape without depending on a profile-installed zod module.
  assert.equal(typeof apply,'function');assert.equal(parameters.properties.action.enum.length,9);assert.equal(parameters.additionalProperties,false);
});
