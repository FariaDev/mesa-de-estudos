/* Codex e Grok pelo Pi (#93): a Mesa não traduz nem bloqueia o provedor que o
   Pi anuncia no catálogo; o modelo escolhido chega ao Pi como
   `set_model {provider, modelId}`. O allowlist de ferramentas é o mesmo de
   qualquer provedor (`--tools` do catálogo da Mesa) — provado em
   `pi-no-native-tools.test.mjs`. Login real não existe aqui: o que se prova é
   o caminho dos argumentos e do provedor, não a inferência. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fakeIpcMain} from './fake-electron-shell.mjs';
import {fakeTutorBridge} from './fake-tutor-bridge.mjs';

const require=createRequire(import.meta.url);
const {registerTutorSessionIpc}=require('../tutor-session-ipc.cjs');

function hostWithCatalog(models){
 const chosen=[];
 const bridge=fakeTutorBridge({get_state: {model: {id: 'm'}}, get_messages: {messages: []}, get_available_models: {models},
  set_model: (params)=>{chosen.push(params); return {};}});
 const ipcMain=fakeIpcMain();
 const live={session:'/s.jsonl',bridge,levelsMod:{getSupportedThinkingLevels:()=>['off']},languageHost:{logText:text=>text},
  opencodeHost:{liveReady:async()=>{},annotate:models=>models,rememberModel:()=>{}}};
 registerTutorSessionIpc({ipcMain,live,runtime:'/rt',deskDir:'/desk',pendingDialogs:new Set(),appendLog:()=>{},
  engine:()=>'pi',connect:()=>bridge,stopBridge:()=>{},assertIdle:async()=>{},persist:()=>{},
  courseSessions:()=>[],conversationData:()=>({engine:'pi'}),captureAvailable:()=>false,trimMessageImages:messages=>messages,
  piBinary:()=>'',isNative:kind=>kind==='claude'||kind==='opencode'});
 return {ipcMain,bridge,chosen};
}

test('o modelo openai-codex do Pi chega ao Pi sem tradução', async () => {
 const {ipcMain,chosen}=hostWithCatalog([{provider:'openai-codex',id:'gpt-5.5-codex',name:'GPT-5.5 Codex'}]);
 await ipcMain.invoke('pi-settings',{model:{provider:'openai-codex',id:'gpt-5.5-codex'}});
 assert.deepEqual(chosen,[{provider:'openai-codex',modelId:'gpt-5.5-codex'}]);
});

test('o modelo xai do Pi chega ao Pi sem tradução', async () => {
 const {ipcMain,chosen}=hostWithCatalog([{provider:'xai',id:'grok-5',name:'Grok 5'}]);
 await ipcMain.invoke('pi-settings',{model:{provider:'xai',id:'grok-5'}});
 assert.deepEqual(chosen,[{provider:'xai',modelId:'grok-5'}]);
});

test('provedor fora do catálogo continua recusado', async () => {
 const {ipcMain,chosen}=hostWithCatalog([{provider:'xai',id:'grok-5'}]);
 await assert.rejects(async()=>ipcMain.invoke('pi-settings',{model:{provider:'openai-codex',id:'gpt-5.5-codex'}}),/err\.model\.notInTutor/);
 assert.deepEqual(chosen,[]);
});
