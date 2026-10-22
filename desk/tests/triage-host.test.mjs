import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {registerTriageHost}=require('../triage-host.cjs');

/* Canais do "Relatar um problema" (#62) com `ipcMain` e worker falsos: o
   worker real roda o ambiente da máquina e fica para o `triage-ui.mjs`, que o
   sobe no perfil falso. */

/** `ipcMain` falso: guarda os handlers e chama como o Electron chamaria. */
function createFakeIpcMain(){
 const handlers=new Map();
 return {handle:(channel,fn)=>handlers.set(channel,fn),invoke:(channel,payload)=>handlers.get(channel)({},payload)};
}

function setup(){
 const ipcMain=createFakeIpcMain(),opened=[],workerInputs=[];
 registerTriageHost({ipcMain,openExternal:url=>opened.push(url),electronVersion:'44.7.2',platform:'darwin',
  runWorker:async input=>{workerInputs.push(input);return {ok:true,result:{report:'r'}};}});
 return {ipcMain,opened,workerInputs};
}

test('triage-report passa só motor e modelo, aparados, ao worker',async()=>{
 const {ipcMain,workerInputs}=setup();
 assert.deepEqual(await ipcMain.invoke('triage-report',{engine:'pi',model:'xai/grok-4',session:'/x.jsonl'}),{ok:true,result:{report:'r'}});
 assert.deepEqual(workerInputs[0],{choice:{engine:'pi',model:'xai/grok-4'},electron:'44.7.2',platform:'darwin'});
 await ipcMain.invoke('triage-report',{engine:'x'.repeat(99),model:3});
 assert.deepEqual(workerInputs[1].choice,{engine:'x'.repeat(40),model:''});
 await ipcMain.invoke('triage-report',null);
 assert.equal(workerInputs[2].choice,null);
});

test('triage-open-issue só abre a issue nova do repositório',async()=>{
 const {ipcMain,opened}=setup();
 const good='https://github.com/FariaDev/mesa-e-conversa/issues/new?title=a&body=b';
 assert.deepEqual(await ipcMain.invoke('triage-open-issue',{url:good}),{ok:true});
 const bad=await ipcMain.invoke('triage-open-issue',{url:'https://evil.example/issues/new?x'});
 assert.equal(bad.ok,false);
 assert.match(bad.error,/esperado https:\/\/github\.com\/FariaDev\/mesa-e-conversa\/issues\/new/);
 assert.deepEqual(opened,[good]);
});
