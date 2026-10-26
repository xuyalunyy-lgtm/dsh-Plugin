import {test} from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQuota, queryQuota } from '../quota.js';
import { createController } from '../controller.js';
const token='DO-NOT-LEAK';
const auth={auth_mode:'chatgpt',tokens:{access_token:token,account_id:'private-account'}};
const signal=()=>AbortSignal.timeout(1000);
test('quota converts percentages and preserves actual window instead of assuming 5h/week',()=>{
  const q=normalizeQuota({email:'private@example.com',rate_limit:{allowed:true,limit_reached:false,primary_window:{used_percent:30,limit_window_seconds:604800,reset_at:1800000000}}},0);
  assert.equal(q.windows[0].remainingPercent,70); assert.equal(q.windows[0].windowSeconds,604800); assert.equal(q.checkedAt,'1970-01-01T00:00:00.000Z'); assert.equal(JSON.stringify(q).includes('private'),false);
});
test('unknown and malformed percent are not displayed as 100% or 0%',()=>{
  for(const v of [undefined,null,'30',-1,101]) { const q=normalizeQuota({rate_limit:{primary_window:{used_percent:v}}}); assert.equal(q.state,'unavailable'); assert.equal(q.windows[0].remainingPercent,null); }
  assert.equal(normalizeQuota({}).reason,'NO_WINDOWS');
});
test('zero and full limits remain valid and reset fallback is bounded',()=>{
  const q=normalizeQuota({rate_limit:{primary_window:{used_percent:0,reset_after_seconds:60},secondary_window:{used_percent:100}}},0);
  assert.equal(q.windows[0].remainingPercent,100); assert.equal(q.windows[1].remainingPercent,0); assert.equal(q.windows[0].resetAt,'1970-01-01T00:01:00.000Z');
});
test('API key mode never makes a subscription usage request',async()=>{
  let calls=0;
  const q=await queryQuota({},signal(),{readCredential:async()=>({auth_mode:'apikey',OPENAI_API_KEY:token}),transport:async()=>{calls++;}});
  assert.equal(q.reason,'API_KEY'); assert.equal(calls,0);
});
test('usage only calls fixed GET endpoint with no history, no redirects or refresh',async()=>{
  let calls=0;
  const q=await queryQuota({},signal(),{readCredential:async()=>auth,transport:async()=>({fetch:async(url,options)=>{
    calls++; assert.equal(url,'https://chatgpt.com/backend-api/wham/usage'); assert.equal(options.method,'GET'); assert.equal(options.redirect,'error'); assert.equal(options.body,undefined);
    return new Response(JSON.stringify({plan_type:'pro',email:token,rate_limit:{primary_window:{used_percent:25}}}));
  }})});
  assert.equal(calls,1); assert.equal(q.windows[0].remainingPercent,75); assert.equal(JSON.stringify(q).includes(token),false);
});
test('401 rejects without reading the error body or retrying',async()=>{
  let calls=0;
  await assert.rejects(queryQuota({},signal(),{readCredential:async()=>auth,transport:async()=>({fetch:async()=>{calls++;return new Response(token,{status:401});}})}),e=>e.code==='AUTH'&&!e.message.includes(token));
  assert.equal(calls,1);
});
test('quota rejects oversized or invalid response rather than returning raw contents',async()=>{
  for(const body of ['{oops','x'.repeat(262145)]) await assert.rejects(queryQuota({},signal(),{readCredential:async()=>auth,transport:async()=>({fetch:async()=>new Response(body)})}),e=>e.code==='QUOTA_FORMAT');
});

test('quota dispatch uses existing settings and never edits config or generates text',async()=>{
 let count=0;
 const controller=createController({llm:{listProviders:()=>[{id:'codex'}]},configEditor:{entries:()=>[{options:{name:'dsh-llm-codex',config:{proxy:'http://127.0.0.1:7897'}}}],edit:()=>assert.fail('must not edit')},quotaQuery:async(raw,signal)=>{count++;assert.equal(raw.proxy,'http://127.0.0.1:7897');assert.equal(signal.aborted,false);return {state:'available',windows:[]};}});
 assert.equal((await controller.dispatch({action:'quota'})).quota.state,'available');assert.equal(count,1);await controller.close();
});
