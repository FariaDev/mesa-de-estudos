import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {draftContext,parseDraft,generateReviewDraft}=require('../review-draft.cjs');
const core=require('../src/generated/review.core.js').default;
const ref={name:'PDF',path:'/local/lista.pdf',page:2};
const result={question:'Limite lateral',attempt:'Dividi por x',difficulty:'Sinal pela direita'};
class Bridge extends EventEmitter{
 stopped=0;request(){return Promise.resolve({});}stop(){this.stopped++;}
}
test('draft validates model JSON, applies limits and preserves only the supplied reference',()=>{
 assert.deepEqual(parseDraft(JSON.stringify({...result,ref:{path:'/inventado'}}),ref),{...result,ref});
 assert.equal(parseDraft(JSON.stringify({...result,attempt:'x'.repeat(1000)}),ref).attempt.length,400);
 assert.throws(()=>parseDraft('not JSON',ref),/válida/);assert.throws(()=>parseDraft('{"question":"","attempt":"","difficulty":""}',ref),/sem questão/);
 assert.throws(()=>parseDraft('{"question":"Q","attempt":[]}',ref),/questão, tentativa/);
 assert.equal(draftContext({answer:'a'.repeat(30000)}).answer.length,16000);
});
test('completed model draft stops worker and removes listeners',async()=>{
 const b=new Bridge(),p=generateReviewDraft({bridge:b,context:{},ref});
 b.emit('event',{type:'message_end',message:{role:'assistant',content:[{type:'text',text:JSON.stringify(result)}]}});b.emit('event',{type:'agent_end'});
 assert.deepEqual(await p,{...result,ref});assert.equal(b.stopped,1);assert.equal(b.listenerCount('event'),0);
});
test('cancel, timeout and native retry abort drafts rather than leaving workers running',async()=>{
 for(const type of ['cancel','timeout','retry']){
  const b=new Bridge(),controller=new AbortController();
  const p=generateReviewDraft({bridge:b,context:{},ref,signal:controller.signal,timeoutMs:type==='timeout'?5:1000});
  if(type==='cancel')controller.abort();if(type==='retry')b.emit('event',{type:'auto_retry_start'});
  await assert.rejects(p);assert.equal(b.stopped,1);assert.equal(b.listenerCount('event'),0);
 }
});
test('late model results cannot overwrite edits, cancelled dialogs or another draft',()=>{
 assert.equal(core.canFillDraft(true,true,true),true);
 for(const facts of [[false,true,true],[true,false,true],[true,true,false]])assert.equal(core.canFillDraft(...facts),false);
});
