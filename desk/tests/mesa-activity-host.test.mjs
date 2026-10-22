import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {ptMatches} from './pt-text.mjs';
const require=createRequire(import.meta.url);
const {createActivityHost}=require('../activity-host.cjs');
const {createActivityStore}=require('../activity-store.cjs');
const spec={title:'Sintético',objective:'Explorar',alternativeMarkdown:'Alternativa',html:'<p>teste</p>',css:'',js:''};
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-host-activity-'));
 let scope={courseId:'mesa-free',conversationId:path.join(root,'A.jsonl'),freeSessionId:'A',generation:1};
 const store=createActivityStore({runtime:root}),events=[],remembered=[];
 const host=createActivityHost({store,runtime:{remember:(...args)=>{remembered.push(args);return true;}},captureScope:()=>({...scope}),
  scopeIsCurrent:s=>JSON.stringify(s)===JSON.stringify(scope),emit:e=>events.push(e)});
 return {host,store,events,remembered,scope:()=>({...scope}),switch:()=>{scope={...scope,conversationId:path.join(root,'B.jsonl'),freeSessionId:'B',generation:2};host.invalidate();},cleanup:()=>fs.rmSync(root,{recursive:true,force:true})};
}
test('published metadata and all shell APIs are bound to original conversation scope',async()=>{
 const f=fixture();try{
  const item=await f.host.publish(f.scope(),spec,{toolCallId:'call-1'});
  assert.equal(f.events[0].conversationId,f.scope().conversationId);
  assert.equal(f.host.list().items[0].scopeRef,item.scopeRef);
  const read=f.host.read(item);assert.equal(read.item.scopeRef,item.scopeRef);assert.equal(read.spec.title,spec.title);
  await f.host.stateSave({...item,state:{attempt:'15 m'}});
  assert.deepEqual(f.host.stateGet(item).state,{attempt:'15 m'});
  /* Revisão pelo host: mesmo id, versão nova, versão anterior preservada. */
  const revision=await f.host.publish(f.scope(),{...spec,activityId:item.id,title:'Sintético v2'},{toolCallId:'call-2'});
  assert.equal(revision.id,item.id);assert.equal(revision.version,2);
  assert.equal(f.store.read({...f.scope(),id:item.id,version:1}).spec.title,spec.title);
  assert.equal(f.store.read({...f.scope(),id:item.id,version:2}).spec.title,'Sintético v2');
  f.switch();assert.throws(()=>f.host.read(item),ptMatches(/sessão mudou/));
  /* Revisão não atravessa conversa: id de outra conversa vira MISSING. */
  await assert.rejects(()=>f.host.publish(f.scope(),{...spec,activityId:item.id},{toolCallId:'call-cross'}),ptMatches(/não encontrada/));
  await assert.rejects(f.host.stateSave({...item,state:{attempt:'não deve cruzar'}}),ptMatches(/sessão mudou/));
  assert.equal(f.host.list().items.length,0);
 }finally{f.cleanup();}
});
test('stale publication and missing call identity never write or emit a document',async()=>{
 const f=fixture();try{
  const old=f.scope();f.switch();await assert.rejects(f.host.publish(old,spec,{toolCallId:'call-1'}),ptMatches(/sessão mudou/));
  await assert.rejects(f.host.publish(f.scope(),spec,{}),/err\.activity\.callerMissing/);
  assert.deepEqual(f.events,[]);assert.equal(f.store.list(f.scope()).length,0);
 }finally{f.cleanup();}
});
