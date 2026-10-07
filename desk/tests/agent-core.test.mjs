import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const caps=require('../src/generated/agentcaps.core.js').default;
const delivery=require('../src/generated/agentdelivery.core.js').default;
test('native catalog gates controls and active ownership blocks configuration changes',()=>{
 assert.deepEqual(caps.claudeControlCaps(false,true),caps.claudeCaps());
 assert.equal(caps.claudeControlCaps(true,false).modelSelection,true);
 assert.equal(caps.claudeControlCaps(true,false).effort,false);
 assert.equal(caps.claudeControlCaps(true,true).effort,true);
 assert.equal(delivery.canChangeControls(false,false,false,false),true);
 for(let i=0;i<4;i++){
  const facts=[false,false,false,false];facts[i]=true;
  assert.equal(delivery.canChangeControls(...facts),false);
 }
});
test('Claude busy messages wait; idle text and image messages can be sent',()=>{
 const c=caps.claudeCaps();
 assert.equal(caps.canSteer(c,true),false);
 assert.equal(caps.canSend(c,true,false),false);
 assert.equal(caps.canSend(c,true,true),false);
 assert.equal(caps.canSend(c,false,true),true);
 assert.equal(caps.canSend(c,false,false),true);
 assert.equal(caps.canSteer(caps.piCaps(),true),true);
});
test('acknowledged and uncertain deliveries cannot be retried automatically',()=>{
 assert.equal(delivery.sameNativeIdentity('native-a','native-a'),true);
 assert.equal(delivery.sameNativeIdentity('native-a','native-b'),false);
 assert.equal(delivery.mayRetry(delivery.outcome(true,true)),false);
 assert.equal(delivery.mayRetry(delivery.outcome(false,true)),false);
 assert.equal(delivery.mayRetry(delivery.outcome(false,false)),true);
 assert.equal(delivery.canBegin(false,true),false);
});
test('queue waits for tool/permission, uncertain delivery and confirmed cancellation',()=>{
 assert.equal(delivery.mayAdvanceQueue(false,false,false,false),true);
 for(let blocked=0;blocked<4;blocked++){
  const states=[false,false,false,false];states[blocked]=true;
  assert.equal(delivery.mayAdvanceQueue(...states),false);
 }
});
