/* Rascunho de revisão no OpenCode (#93): o mesmo `generateReviewDraft` do Pi e
   do Claude, contra o `opencode serve` falso. Prova que a consulta é
   temporária, que NÃO registra o MCP `mesa` (sem ferramenta nenhuma) e que o
   JSON do modelo passa pela validação de sempre. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createFakeOpencodeServe} from './fake-opencode.mjs';
import {trackTempDir} from './temp-dir.mjs';

const require=createRequire(import.meta.url);
const {createOpenCodeDraftBridge}=require('../src/agents/opencode-review-draft.cjs');
const {OpenCodeAdapter}=require('../src/agents/opencode-adapter.cjs');
const {generateReviewDraft,draftPrompt}=require('../review-draft.cjs');

const PASSWORD='senha-do-rascunho';
const DRAFT={question:'Limite lateral',attempt:'Dividi por x',difficulty:'Sinal pela direita'};

test('rascunho no OpenCode: consulta temporária, sem MCP e sem sessão salva', async (t) => {
 const serve=await createFakeOpencodeServe({password:PASSWORD,reply:()=>JSON.stringify(DRAFT)});
 const cwd=trackTempDir(fs.mkdtempSync(path.join(os.tmpdir(),'mesa-oc-draft-')));
 const bridge=createOpenCodeDraftBridge({
  cwd,
  systemPrompt:draftPrompt('pt-BR'),
  acquire:async()=>({baseUrl:serve.url,password:PASSWORD,binary:'/fake/opencode'}),
  readVersion:async()=> 'opencode v2.2.4',
  selection:{model:null,effort:null},
 });
 t.after(async()=>{bridge.stop();await serve.close();fs.rmSync(cwd,{recursive:true,force:true});});
 const item=await generateReviewDraft({bridge,context:{question:'Quanto é 2 + 2?',attempt:'Somei.',answer:'É 4.'},ref:null});
 assert.deepEqual(item,{...DRAFT,ref:{name:'',path:'',page:1}});
 assert.equal(serve.requests.some((entry)=>String(entry.url).includes('/experimental/mcp')),false,'o rascunho não registra o MCP mesa');
 const prompts=serve.requests.filter((entry)=>String(entry.url).endsWith('/prompt'));
 assert.equal(prompts.length,1,'uma consulta só');
 assert.match(String(prompts[0].body.text),/"answer":"É 4\."/,'o contexto vai como dado');
 assert.equal(fs.readdirSync(cwd).some((name)=>name.endsWith('.json')||name.endsWith('.jsonl')),false,'sem sessão salva na pasta');
});

test('a sessão temporária some depois do rascunho, inclusive em cancelamento e erro (#93)', async (t) => {
 const serve=await createFakeOpencodeServe({password:PASSWORD,reply:()=>JSON.stringify(DRAFT),turnDelayMs:80});
 const cwd=trackTempDir(fs.mkdtempSync(path.join(os.tmpdir(),'mesa-oc-draft-limpa-')));
 t.after(async()=>{await serve.close();fs.rmSync(cwd,{recursive:true,force:true});});
 const bridge=()=>createOpenCodeDraftBridge({cwd,systemPrompt:draftPrompt('pt-BR'),acquire:async()=>({baseUrl:serve.url,password:PASSWORD,binary:'/fake/opencode'}),readVersion:async()=> 'opencode v2.2.4'});
 const item=await generateReviewDraft({bridge:bridge(),context:{question:'Quanto é 2 + 2?',attempt:'Somei.',answer:'É 4.'},ref:null});
 assert.equal(item.difficulty,DRAFT.difficulty);
 await new Promise((resolve)=>setTimeout(resolve,50));
 assert.equal(serve.sessions.size,0,'o rascunho apaga a sessão temporária');
 const deleted=serve.requests.find((entry)=>entry.method==='DELETE');
 assert.ok(deleted,'o DELETE foi pedido ao servidor');
 assert.match(String(deleted.url),/^\/api\/session\/[^/?]+\?location%5Bdirectory%5D=/,'o DELETE leva a pasta na query, como o 2.2.4 exige');

 const promptsBefore=serve.requests.filter((entry)=>String(entry.url).endsWith('/prompt')).length;
 const controller=new AbortController();
 const cancelled=generateReviewDraft({bridge:bridge(),context:{question:'Quanto é 2 + 2?',attempt:'Somei.',answer:'É 4.'},ref:null,signal:controller.signal});
 const deadline=Date.now()+5000;
 while(Date.now()<deadline&&serve.requests.filter((entry)=>String(entry.url).endsWith('/prompt')).length<=promptsBefore)await new Promise((resolve)=>setTimeout(resolve,10));
 controller.abort();
 await assert.rejects(cancelled,/(?:cancelled|cancelad)/i);
 await new Promise((resolve)=>setTimeout(resolve,50));
 assert.equal(serve.sessions.size,0,'o cancelamento também apaga a sessão');

 const failed=await createFakeOpencodeServe({password:PASSWORD,reply:()=>'não é JSON'});
 t.after(async()=>{await failed.close();});
 const broken=createOpenCodeDraftBridge({cwd,systemPrompt:draftPrompt('pt-BR'),acquire:async()=>({baseUrl:failed.url,password:PASSWORD,binary:'/fake/opencode'}),readVersion:async()=> 'opencode v2.2.4'});
 await assert.rejects(generateReviewDraft({bridge:broken,context:{question:'Quanto é 2 + 2?',attempt:'Somei.',answer:'É 4.'},ref:null}));
 await new Promise((resolve)=>setTimeout(resolve,50));
 assert.equal(failed.sessions.size,0,'o erro do rascunho também apaga a sessão');
});

test('a conversa normal não apaga a sessão quando o serviço para (#93)', async (t) => {
 const serve=await createFakeOpencodeServe({password:PASSWORD,reply:()=>'Resposta'});
 const cwd=trackTempDir(fs.mkdtempSync(path.join(os.tmpdir(),'mesa-oc-normal-')));
 const adapter=new OpenCodeAdapter({
  conversationId:'normal',sessionId:'',directory:cwd,
  acquire:async()=>({baseUrl:serve.url,password:PASSWORD,binary:'/fake/opencode'}),
  readVersion:async()=> 'opencode v2.2.4',log:()=>{},
 });
 t.after(async()=>{adapter.stop();await serve.close();fs.rmSync(cwd,{recursive:true,force:true});});
 const events=[];adapter.on('event',(event)=>events.push(event));
 await adapter.send({id:'u1',text:'oi'});
 const deadline=Date.now()+5000;
 while(Date.now()<deadline&&!events.some((event)=>event.type==='turn_end'))await new Promise((resolve)=>setTimeout(resolve,10));
 adapter.stop();
 await new Promise((resolve)=>setTimeout(resolve,50));
 assert.equal(serve.sessions.size,1,'a sessão de estudo fica no servidor');
});
