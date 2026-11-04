/* Casca IPC da instalação (#release OpenCode): uma instalação por vez, o
   progresso chega à janela e a detecção é refeita no fim. O instalador é um
   fake nomeado; nenhum processo real é iniciado. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {createOpenCodeInstallHost}=require('../opencode-install-host.cjs');

function ipc(){
 const handlers=new Map();
 return {handle:(channel,fn)=>handlers.set(channel,fn),call:(channel,...args)=>handlers.get(channel)(...args)};
}

function windowStub(){
 const sent=[];
 return {sent,isDestroyed:()=>false,webContents:{send:(channel,payload)=>sent.push({channel,payload})}};
}

test('uma instalação por vez, progresso na janela e detecção refeita', async()=>{
 const bus=ipc(),win=windowStub();
 let calls=0;
 createOpenCodeInstallHost({
  ipcMain:bus,win:()=>win,home:'/tmp/mesa-home',
  install:async({onProgress})=>{
   calls++;
   onProgress({phase:'download',percent:42});
   await new Promise(resolve=>setTimeout(resolve,5));
   return {ok:true,binary:'/tmp/mesa-home/.opencode/bin/opencode',version:'2.2.4'};
  },
  detect:()=>({detectedOpenCode:'/tmp/mesa-home/.opencode/bin/opencode'}),
 });
 const one=bus.call('opencode-install');
 const two=bus.call('opencode-install');
 assert.equal(one,two,'a segunda chamada recebe a mesma promessa');
 await Promise.resolve();
 assert.equal(calls,1,'a segunda chamada espera a primeira');
 const [first,second]=await Promise.all([one,two]);
 assert.deepEqual(first,second);
 assert.equal(first.ok,true);
 assert.equal(first.detected.detectedOpenCode,first.binary);
 assert.deepEqual(win.sent.map(item=>item.payload.phase),['prepare','download']);
 assert.equal(win.sent[1].payload.percent,42);
 assert.equal(await bus.call('opencode-install-supported'),true);
});

test('erro volta em uma frase, preserva o código e libera a próxima', async()=>{
 const bus=ipc();
 const logs=[];
 let fail=true;
 createOpenCodeInstallHost({
  ipcMain:bus,win:()=>null,
  install:async()=>{
   if(fail)throw Object.assign(Error('sem rede'),{code:'network'});
   return {ok:true,binary:'/bin/opencode',version:'2.2.4'};
  },
  supported:()=>false,
  log:(area,line)=>logs.push([area,line]),
 });
 const error=await bus.call('opencode-install');
 assert.deepEqual(error,{ok:false,code:'network',message:'sem rede'});
 assert.equal(logs[0][0],'opencode-install');
 fail=false;
 assert.equal((await bus.call('opencode-install')).ok,true,'a trava não fica presa');
 assert.equal(await bus.call('opencode-install-supported'),false);
});
