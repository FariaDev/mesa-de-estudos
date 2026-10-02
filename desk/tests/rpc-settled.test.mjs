import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
for(const app of ['desk','chat']){
 const file=path.resolve(import.meta.dirname,'../../',app,'rpc.cjs');
 test(`${app}: end is not idle; settled closes retries, queue and compaction`,{skip:!fs.existsSync(file)},async()=>{
  const {PiBridge}=require(file),root=fs.mkdtempSync(path.join(os.tmpdir(),'rpc-settled-')),pi=path.join(root,'pi');
  fs.writeFileSync(pi,`#!/usr/bin/env node
const emit=e=>process.stdout.write(JSON.stringify(e)+'\\n');let buffer='';process.stdin.setEncoding('utf8');process.stdin.on('data',data=>{buffer+=data;let i;while((i=buffer.indexOf('\\n'))>=0){const e=JSON.parse(buffer.slice(0,i));buffer=buffer.slice(i+1);if(e.events)for(const event of e.events)emit(event);emit({type:'response',id:e.id,success:true,data:['prompt','follow_up'].includes(e.type)?{disposition:['handled','queued'].includes(e.message)?e.message:'started'}:{isStreaming:false,isCompacting:!!e.compact,pendingMessageCount:0}});}});
`);fs.chmodSync(pi,0o755);
  const b=new PiBridge({cwd:root,session:path.join(root,'session'),pi});
  try{
   await b.request('prompt',{message:'start'});assert.equal(b.isRunning(await b.request('get_state')),true,'accepted before first agent_start');
   await b.request('get_state',{events:[{type:'agent_start'},{type:'agent_end',willRetry:false}]});
   assert.equal(b.isRunning(await b.request('get_state')),true,'even willRetry=false is not settled');
   await b.request('get_state',{events:[{type:'auto_retry_start',attempt:1},{type:'compaction_start'}]});
   assert.equal(b.isRunning(await b.request('get_state')),true,'retry/compaction gap');
   await b.request('get_state',{events:[{type:'agent_settled'}]});assert.equal(b.isRunning(),false);
   assert.equal(b.isRunning(await b.request('get_state',{compact:true})),true,'manual compaction');
   await b.request('prompt',{message:'late',events:[{type:'agent_start'},{type:'agent_end'},{type:'agent_settled'}]});
   assert.equal(b.isRunning(),false,'late acceptance must not reopen settled run');
   await b.request('prompt',{message:'handled'});assert.equal(b.isRunning(),false,'handled does not start a run');
   await b.request('follow_up',{message:'queued'});assert.equal(b.isRunning(),false,'queued alone does not start a run');
   assert.equal(b.isRunning({pendingMessageCount:1}),true,'queue still counts as busy');
   assert.equal(b.isRunning({pendingMessageCount:0}),false,'cleared queue cannot leave a sticky run');
  }finally{b.removeAllListeners();b.stop();fs.rmSync(root,{recursive:true,force:true});}
 });
}
