import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const backup=require('../src/study-data/backup.cjs');
const {createActivityStore}=require('../activity-store.cjs');
const spec={title:'MRUV sintético',objective:'Explorar aceleração',alternativeMarkdown:'s(3)=6+4,5a',html:'<p>Explorar</p>',css:'',js:''};

test('activity documents and attempt state remain reachable after backup relocation',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-activity-backup-'));
 try{
  const source=path.join(root,'source'),target=path.join(root,'target'),dest=path.join(root,'snapshots');
  fs.mkdirSync(source);fs.mkdirSync(target);
  const conversationId=path.join(source,'pi-synthetic.jsonl');fs.writeFileSync(conversationId,'');
  const store=createActivityStore({runtime:source});
  const item=await store.publish({conversationId,toolCallId:'call-synthetic',generation:1,spec});
  await store.stateSave({conversationId,id:item.id,version:item.version,hash:item.hash,state:{a:2,attempt:'15 m'}});
  const snapshot=await backup.backupNow({runtime:source,root:dest,reason:'manual'});
  const manifest=backup.readManifest(snapshot.path);
  assert.ok(manifest.entries.some(entry=>entry.path?.includes('activities/')||entry.rel?.includes('activities/')),'snapshot contains activity files');
  const plan=await backup.prepareRestore({runtime:target,root:dest,snapshotId:snapshot.snapshotId});
  await backup.applyRestore({runtime:target,planId:plan.planId});
  const restored=createActivityStore({runtime:target}),restoredConversation=path.join(target,'pi-synthetic.jsonl');
  assert.equal(restored.list({conversationId:restoredConversation}).length,1,'activity remains attached to relocated native conversation');
  assert.deepEqual(restored.read({conversationId:restoredConversation,id:item.id,version:item.version}).spec,store.read({conversationId,id:item.id,version:item.version}).spec);
  assert.deepEqual(restored.stateGet({conversationId:restoredConversation,id:item.id,version:item.version,hash:item.hash}).state,{a:2,attempt:'15 m'});
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
