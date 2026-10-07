// Behavioral transport tests: synthetic SDK only, no Claude process or account.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as fx from './claude-fixtures.mjs';
const {ClaudeAdapter}=createRequire(import.meta.url)('../src/agents/claude-adapter.cjs');
async function accepted(t,options={}){
 const sdk=fx.fakeSdk(),recorder=fx.persistRecorder(options.persistence);
 const adapter=new ClaudeAdapter({conversationId:'lifecycle-synthetic',cwd:process.cwd(),sdkLoader:async()=>sdk,persistDelivery:recorder.persist,timeoutMs:2000});
 t.after(()=>adapter.close());const events=fx.collectEvents(adapter);await adapter.connect();
 const sent=adapter.send({id:fx.UUID.a,text:'synthetic prompt'});
 await fx.waitFor(()=>sdk.state.queries.length===1);
 const query=sdk.state.queries[0],item=await fx.takeInput(query);
 query.emit(fx.replayMessage(item));await sent;
 return {adapter,query,item,events,recorder,sdk};
}
test('accepted result without user-message echo settles exactly once',async t=>{
 const {adapter,query,events,recorder}=await accepted(t);
 query.emit(fx.resultMessage());await fx.waitFor(()=>!adapter.snapshot().busy);
 assert.deepEqual(recorder.calls.map(x=>x.status),['transmitting','accepted','settled']);
 assert.equal(events.last('turn_end').uncertain,false);assert.equal(events.of('turn_end').length,1);
});
for(const [name,frame] of [
 ['foreign UUID',fx.resultMessage({userMessageUuid:fx.UUID.wrong})],
 ['nonhuman origin',{...fx.resultMessage(),origin:{kind:'agent'}}],
 ['zero-turn debris',{...fx.resultMessage(),num_turns:0}],
])test(`${name} cannot settle an accepted active turn through the no-echo fallback`,async t=>{
 const {adapter,query,events}=await accepted(t);query.emit(frame);await fx.tick();await fx.tick();
 assert.equal(adapter.snapshot().busy,true);assert.equal(events.of('turn_end').length,0);
 query.emit(fx.resultMessage({userMessageUuid:fx.UUID.a}));await fx.waitFor(()=>!adapter.snapshot().busy);
});
test('foreign result evidence blocks a later uncorrelated result',async t=>{
 const {adapter,query,events}=await accepted(t);
 query.emit(fx.resultMessage({userMessageUuid:fx.UUID.wrong}));query.emit(fx.resultMessage());
 await fx.tick();await fx.tick();assert.equal(events.of('turn_end').length,0);
 query.emit(fx.resultMessage({userMessageUuid:fx.UUID.a}));await fx.waitFor(()=>!adapter.snapshot().busy);
});
test('accepted interrupt followed by normal query exit settles cancellation',async t=>{
 const {adapter,query,events,recorder}=await accepted(t);
 await adapter.cancel();query.end();await fx.waitFor(()=>!adapter.snapshot().busy);
 assert.equal(query.interruptCalls,1);
 assert.equal(recorder.calls.at(-1).status,'settled');
 assert.equal(events.last('turn_end').cancelled,true);assert.equal(events.last('turn_end').uncertain,false);
});
test('iterator failure after explicit cancel still settles cancellation without a fatal query error',async t=>{
 const {adapter,query,events,recorder}=await accepted(t);
 await adapter.cancel();
 query.fail(new Error('runtime_exit sem result'));
 await fx.waitFor(()=>!adapter.snapshot().busy);
 assert.equal(recorder.calls.at(-1).status,'settled');
 assert.equal(events.last('turn_end').cancelled,true);assert.equal(events.last('turn_end').uncertain,false);
 assert.equal(events.of('error').some(e=>e.code==='CLAUDE_QUERY_ERROR'),false,'proven accepted cancellation is not a query crash');
});
test('host close after accepted cancel stays conservative and releases nothing',async t=>{
 const {adapter,events,recorder}=await accepted(t);
 await adapter.cancel();
 adapter.close();
 await fx.waitFor(()=>events.of('turn_end').length===1);
 assert.equal(recorder.calls.at(-1).status,'uncertain');
 assert.equal(events.last('turn_end').cancelled,true);assert.equal(events.last('turn_end').uncertain,true);
});
test('unexpected query crash after acceptance stays uncertain',async t=>{
 const {adapter,query,events,recorder}=await accepted(t);
 query.fail(new Error('synthetic native crash'));await fx.waitFor(()=>!adapter.snapshot().busy);
 assert.equal(recorder.calls.at(-1).status,'uncertain');assert.equal(events.last('turn_end').uncertain,true);
});
test('blocking-limit success envelope reports failure but preserves accepted delivery',async t=>{
 const {adapter,query,events,recorder}=await accepted(t);
 query.emit(fx.resultMessage({terminalReason:'blocking_limit'}));await fx.waitFor(()=>!adapter.snapshot().busy);
 assert.equal(recorder.calls.at(-1).status,'settled');
 assert.equal(events.last('turn_end').isError,true);assert.equal(events.last('turn_end').uncertain,false);
 const limitError=events.of('error').find(e=>e.code==='CLAUDE_RATE_LIMITED');
 assert.ok(limitError,'blocking limit has canonical code');
 assert.equal(limitError.fatal,false,'native result failure does not drop the query');
 assert.equal(limitError.detail.terminalReason,'blocking_limit');
});

/* ---------------- H1: incerteza hidratada é pegajosa ---------------- */

test('hydrated delivery uncertainty blocks send and controls before query, native change or persist',async t=>{
 const sdk=fx.fakeSdk(),recorder=fx.persistRecorder();
 const adapter=new ClaudeAdapter({conversationId:'lifecycle-uncertain-hydrated',cwd:process.cwd(),sdkLoader:async()=>sdk,persistDelivery:recorder.persist,timeoutMs:2000,deliveryUncertain:true});
 t.after(()=>adapter.close());
 await adapter.connect();
 await assert.rejects(()=>adapter.send({id:fx.UUID.a,text:'não pode sair'}),(e)=>e.code==='CLAUDE_DELIVERY_UNCERTAIN'&&e.notSent===true);
 await assert.rejects(()=>adapter.initializeControls(),(e)=>e.code==='CLAUDE_DELIVERY_UNCERTAIN'&&e.notSent===true);
 await assert.rejects(()=>adapter.setControls({model:'modelo-qualquer'}),(e)=>e.code==='CLAUDE_CONTROLS_BUSY'&&e.detail?.reason==='delivery_uncertain');
 assert.equal(sdk.state.queries.length,0,'no native query is created');
 assert.equal(recorder.calls.length,0,'no delivery transition is persisted');
 assert.equal(adapter.controlsSnapshot().state,'idle','no catalog/native change happened');
 assert.equal(adapter.snapshot().busy,false);
});

test('uncertainty hydration is strict boolean and becomes sticky after a crash',async t=>{
 // Truthy non-boolean NÃO hidrata: o envio segue normal.
 const sdkA=fx.fakeSdk();
 const adapterA=new ClaudeAdapter({conversationId:'lifecycle-uncertain-strict',cwd:process.cwd(),sdkLoader:async()=>sdkA,timeoutMs:2000,deliveryUncertain:'true'});
 t.after(()=>adapterA.close());
 await adapterA.connect();
 const sentA=adapterA.send({id:fx.UUID.a,text:'strict'});
 await fx.waitFor(()=>sdkA.state.queries.length===1);
 const qA=sdkA.state.queries[0],itemA=await fx.takeInput(qA);
 qA.emit(fx.replayMessage(itemA));await sentA;
 qA.emit(fx.resultMessage());await fx.waitFor(()=>!adapterA.snapshot().busy);
 assert.equal(sdkA.state.queries.length,1);

 // Queda depois do aceite torna a incerteza PEGAJOSA neste adaptador.
 const sdkB=fx.fakeSdk(),recB=fx.persistRecorder();
 const adapterB=new ClaudeAdapter({conversationId:'lifecycle-uncertain-sticky',cwd:process.cwd(),sdkLoader:async()=>sdkB,persistDelivery:recB.persist,timeoutMs:2000});
 t.after(()=>adapterB.close());
 await adapterB.connect();
 const sentB=adapterB.send({id:fx.UUID.b,text:'queda'});
 await fx.waitFor(()=>sdkB.state.queries.length===1);
 const qB=sdkB.state.queries[0],itemB=await fx.takeInput(qB);
 qB.emit(fx.replayMessage(itemB));await sentB;
 qB.fail(new Error('synthetic crash'));
 await fx.waitFor(()=>!adapterB.snapshot().busy);
 assert.equal(recB.calls.at(-1).status,'uncertain');
 await assert.rejects(()=>adapterB.send({id:fx.UUID.c,text:'de novo'}),(e)=>e.code==='CLAUDE_DELIVERY_UNCERTAIN'&&e.notSent===true);
 assert.equal(sdkB.state.queries.length,1,'uncertainty never opens a new query by itself');
});

/* ---------------- resultado sem eco: aceite, recusa e degradação ---------------- */

test('uncorrelated result before acceptance is ignored until the native query ends',async t=>{
 const sdk=fx.fakeSdk(),recorder=fx.persistRecorder();
 const adapter=new ClaudeAdapter({conversationId:'lifecycle-unaccepted',cwd:process.cwd(),sdkLoader:async()=>sdk,persistDelivery:recorder.persist,timeoutMs:2000});
 t.after(()=>adapter.close());
 const events=fx.collectEvents(adapter);
 await adapter.connect();
 const sent=adapter.send({id:fx.UUID.a,text:'sem aceite'});
 await fx.waitFor(()=>sdk.state.queries.length===1);
 const query=sdk.state.queries[0];await fx.takeInput(query);
 query.emit(fx.resultMessage());await fx.tick();await fx.tick();
 assert.equal(adapter.snapshot().busy,true,'taken is not acceptance: the result is ignored');
 assert.equal(events.of('turn_end').length,0);
 await adapter.cancel();query.end();
 await assert.rejects(()=>sent,(e)=>e.code==='CLAUDE_DELIVERY_UNCERTAIN'&&e.notSent===false);
 await fx.waitFor(()=>!adapter.snapshot().busy);
 assert.equal(recorder.calls.at(-1).status,'uncertain','cancel after yield is never settled without acceptance');
 assert.equal(events.last('turn_end').cancelled,true);
 assert.equal(events.last('turn_end').uncertain,true);
});

test('degraded accepted delivery never settles on an uncorrelated result',async t=>{
 const sdk=fx.fakeSdk(),recorder=fx.persistRecorder({failStatuses:['accepted']});
 const adapter=new ClaudeAdapter({conversationId:'lifecycle-degraded',cwd:process.cwd(),sdkLoader:async()=>sdk,persistDelivery:recorder.persist,timeoutMs:2000});
 t.after(()=>adapter.close());
 const events=fx.collectEvents(adapter);
 await adapter.connect();
 const sent=adapter.send({id:fx.UUID.a,text:'degradado'});
 await fx.waitFor(()=>sdk.state.queries.length===1);
 const query=sdk.state.queries[0],item=await fx.takeInput(query);
 query.emit(fx.replayMessage(item));
 await assert.rejects(()=>sent,(e)=>e.code==='CLAUDE_DELIVERY_UNCERTAIN'&&e.detail?.persistFailure===true);
 assert.equal(adapter.snapshot().busy,true);
 query.emit(fx.resultMessage());await fx.tick();await fx.tick();
 assert.equal(adapter.snapshot().busy,true,'the uncorrelated result cannot settle a degraded turn');
 query.emit(fx.resultMessage({userMessageUuid:fx.UUID.a}));
 await fx.waitFor(()=>!adapter.snapshot().busy);
 assert.equal(recorder.calls.at(-1).status,'uncertain');
 assert.equal(events.last('turn_end').uncertain,true);
});

/* ---------------- falha nativa: janela rejeitada × liberada ---------------- */

test('rejected window evidence classifies a result failure; allowed clears it',async t=>{
 {
  const {adapter,query,events,recorder}=await accepted(t);
  query.emit(fx.rateLimitMessage({status:'rejected',rateLimitType:'five_hour',resetsAt:Math.floor(Date.now()/1000)+3600}));
  await fx.tick();
  query.emit(fx.resultMessage({subtype:'error_during_execution',isError:true,terminalReason:'api_error'}));
  await fx.waitFor(()=>!adapter.snapshot().busy);
  const failure=events.of('error').at(-1);
  assert.equal(failure.code,'CLAUDE_RATE_LIMITED');
  assert.equal(failure.detail.usageLimitSource,'rejected_window');
  assert.equal(failure.fatal,false);
  assert.equal(recorder.calls.at(-1).status,'settled','the failure never revokes the accepted delivery');
  assert.equal(events.last('turn_end').isError,true);
  assert.equal(events.last('turn_end').uncertain,false);
 }
 {
  const {adapter,query,events}=await accepted(t);
  query.emit(fx.rateLimitMessage({status:'rejected',rateLimitType:'five_hour',resetsAt:Math.floor(Date.now()/1000)+3600}));
  await fx.tick();
  query.emit(fx.rateLimitMessage({status:'allowed',rateLimitType:'five_hour'}));
  await fx.tick();
  query.emit(fx.resultMessage({subtype:'error_during_execution',isError:true,terminalReason:'api_error'}));
  await fx.waitFor(()=>!adapter.snapshot().busy);
  const failure=events.of('error').at(-1);
  assert.equal(failure.code,'CLAUDE_API_ERROR','a released window is not a usage limit anymore');
  assert.equal(failure.detail.usageLimitSource,null);
 }
});

/* ---------------- recusa/fallback sem evicção ---------------- */

test('model refusal fallback warns with bounded retracted ids, evicts nothing and keeps the turn',async t=>{
 const {adapter,query,events,recorder}=await accepted(t);
 query.emit({
  type:'system',subtype:'model_refusal_fallback',session_id:fx.UUID.session,uuid:fx.newUuid(),
  content:'O modelo original recusou; a resposta veio do fallback.',direction:'retry',scope:'local',
  original_model:'modelo-a',fallback_model:'modelo-b',
  retracted_message_uuids:['u-1','u-2','u-1',42],refused_user_message_uuid:fx.UUID.a,
 });
 await fx.tick();
 const warning=events.of('warning').find(e=>e.code==='CLAUDE_MODEL_FALLBACK');
 assert.ok(warning,'fallback notice has a canonical code');
 assert.equal(warning.message,'O modelo original recusou; a resposta veio do fallback.');
 assert.equal(warning.detail.retractedCount,3);
 assert.deepEqual(warning.detail.retractedMessageUuids,['u-1','u-2']);
 assert.equal('eviction' in warning,false,'DOM eviction is deferred: the adapter removes nothing');
 assert.equal(adapter.snapshot().busy,true);
 assert.equal(events.of('turn_end').length,0);
 query.emit(fx.resultMessage());
 await fx.waitFor(()=>!adapter.snapshot().busy);
 assert.equal(recorder.calls.at(-1).status,'settled');
});

/* ---------------- erro nativo recuperável × autenticação ---------------- */

test('recoverable assistant errors keep the query usable while auth failures may be fatal',async t=>{
 const {adapter,query,events}=await accepted(t);
 query.emit(fx.assistantMessage({uuid:fx.newUuid(),text:'parcial',error:'server_error'}));
 await fx.tick();
 const recoverable=events.of('error').at(-1);
 assert.equal(recoverable.code,'CLAUDE_SERVER_ERROR');
 assert.equal(recoverable.fatal,false);
 assert.equal(adapter.snapshot().busy,true,'recoverable error does not release the turn');
 query.emit(fx.assistantMessage({uuid:fx.newUuid(),text:'sem login',error:'authentication_failed'}));
 await fx.tick();
 const auth=events.of('error').at(-1);
 assert.equal(auth.code,'CLAUDE_AUTH_FAILED');
 assert.equal(auth.fatal,true);
 query.emit(fx.resultMessage());
 await fx.waitFor(()=>!adapter.snapshot().busy);
 assert.equal(events.last('turn_end').uncertain,false);
});

/* ---------------- reabertura depois do interrupt ---------------- */

test('after an interrupt exit the next send resumes the exact native id without sessionId',async t=>{
 const {adapter,query,events,recorder,sdk}=await accepted(t);
 await adapter.cancel();query.end();
 await fx.waitFor(()=>!adapter.snapshot().busy);
 assert.equal(recorder.calls.at(-1).status,'settled');
 const second=adapter.send({id:fx.UUID.b,text:'depois do interrupt'});
 await fx.waitFor(()=>sdk.state.queries.length===2);
 const q2=sdk.state.queries[1];
 assert.equal(q2.options.resume,fx.UUID.session,'reopens resuming the exact id');
 assert.equal(q2.options.sessionId,undefined,'sessionId and resume never combine');
 const item2=await fx.takeInput(q2);
 q2.emit(fx.replayMessage(item2));await second;
 q2.emit(fx.resultMessage());await fx.waitFor(()=>!adapter.snapshot().busy);
 assert.equal(events.of('turn_end').length,2);
});

/* ---------------- perguntas: chaves exatas hostis ---------------- */

test('malicious question exact keys survive as own enumerable answers without prototype mutation',async t=>{
 const {adapter,query,events}=await accepted(t);
 const questions=[
  {header:'Proto',question:'__proto__',options:[{label:'aceito',description:''}],multiSelect:false},
  {header:'Construtor',question:'constructor',options:[{label:'também',description:''}],multiSelect:false},
 ];
 const answers=JSON.parse('{"__proto__":"aceito","constructor":"também"}');
 const pending=query.options.canUseTool('AskUserQuestion',{questions},{requestId:'ask-proto',toolUseID:'t-proto'});
 await fx.tick();
 const responded=adapter.respond({id:'ask-proto',answers});
 assert.equal(responded.ok,true,'exact keys are valid answers');
 const resolved=await pending;
 assert.equal(resolved.behavior,'allow');
 const out=resolved.updatedInput.answers;
 const protoDesc=Object.getOwnPropertyDescriptor(out,'__proto__');
 assert.ok(protoDesc,'__proto__ becomes an OWN property');
 assert.equal(protoDesc.value,'aceito');
 assert.equal(protoDesc.enumerable,true);
 assert.equal(Object.getPrototypeOf(out),Object.prototype,'the answers object prototype is untouched');
 assert.equal(out.constructor,'também');
 assert.equal({}.aceito,undefined,'no global prototype was polluted');
 query.emit(fx.resultMessage());
 await fx.waitFor(()=>!adapter.snapshot().busy);
});

test('retry reports bounded metadata while keeping the accepted turn active',async t=>{
 const {adapter,query,events}=await accepted(t);
 const frame={type:'system',subtype:'api_retry',session_id:fx.UUID.session,uuid:fx.newUuid(),attempt:2,max_retries:4,retry_delay_ms:100,error_status:529};
 query.emit(frame);query.emit(frame);
 await fx.tick();await fx.tick();assert.equal(adapter.snapshot().busy,true);assert.equal(events.of('turn_end').length,0);
 const warnings=events.of('warning').filter(e=>e.code==='CLAUDE_OVERLOADED');
 assert.equal(warnings.length,1,'the same attempt is deduplicated per turn');
 const warning=warnings[0];assert.ok(warning);assert.equal(warning.detail.attempt,2);assert.equal(warning.detail.errorStatus,529);
 assert.equal(warning.detail.maxRetries,4);assert.equal(warning.detail.retryDelayMs,100);
 query.emit(fx.resultMessage());await fx.waitFor(()=>!adapter.snapshot().busy);
});
