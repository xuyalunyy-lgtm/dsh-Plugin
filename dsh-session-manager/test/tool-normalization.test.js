import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeToolRequest } from '../index.js';

test('tool list tolerates strict-adapter empty unused fields only', () => {
  assert.deepEqual(normalizeToolRequest({action:'list',workspaceId:'',sessionId:'',expectedToken:'',requestId:'',query:'',archived:false,offset:0,limit:50}), {action:'list',query:'',archived:false,offset:0,limit:50});
  assert.equal(normalizeToolRequest({action:'list',sessionId:'nonempty'}).sessionId,'nonempty');
});
test('tool create/delete/move do not drop meaningful parameters', () => {
  assert.deepEqual(normalizeToolRequest({action:'create',workspaceId:'target',sessionId:'',expectedToken:'',requestId:'unique',query:'',archived:false,offset:0,limit:50}), {action:'create',workspaceId:'target',requestId:'unique'});
  assert.deepEqual(normalizeToolRequest({action:'delete',workspaceId:'',sessionId:'id',expectedToken:'token',requestId:'unique',query:'',archived:false,offset:0,limit:50}), {action:'delete',sessionId:'id',expectedToken:'token',requestId:'unique'});
  const input={action:'move',workspaceId:'target',sessionId:'id',expectedToken:'token',requestId:'unique',query:'',archived:false,offset:0,limit:50};
  assert.deepEqual(normalizeToolRequest(input), {action:'move',workspaceId:'target',sessionId:'id',expectedToken:'token',requestId:'unique'});
  assert.equal(input.query,'');
  assert.deepEqual(normalizeToolRequest({action:'list',items:[]}),{action:'list'});
  assert.deepEqual(normalizeToolRequest({action:'list',items:[{sessionId:'',expectedToken:''}]}),{action:'list'});
  assert.deepEqual(normalizeToolRequest({action:'batchDelete',items:[{sessionId:'',expectedToken:''}]}),{action:'batchDelete',items:[{sessionId:'',expectedToken:''}]});
  assert.equal(normalizeToolRequest({action:'create',items:[{sessionId:'',expectedToken:'meaningful'}]}).items.length,1);
  const batch={action:'batchDelete',items:[{sessionId:'one',expectedToken:'token'}],requestId:'batch-request-0001',sessionId:'',expectedToken:'',workspaceId:'',query:'',archived:false,includeHidden:false,hidden:false,expectedVisibilityRevision:0,offset:0,limit:50};
  assert.deepEqual(normalizeToolRequest(batch),{action:'batchDelete',items:batch.items,requestId:batch.requestId});
  assert.equal(normalizeToolRequest({action:'delete',items:batch.items}).items,batch.items);
  assert.deepEqual(normalizeToolRequest({action:'batchDelete',items:[]}),{action:'batchDelete',items:[]});
  assert.equal(normalizeToolRequest({...input,query:'meaningful'}).query,'meaningful');
});
