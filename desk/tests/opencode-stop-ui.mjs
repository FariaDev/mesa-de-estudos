// Parar durante o connect() do renderer (#57, revisão): o botão nasce com o
// busy otimista antes de o prompt sair. O `pi-abort` chega ao serviço sem envio
// (`_sending===false`), mas o envio não pode seguir assim mesmo — e a interface
// tem que sair do turno na hora. O `opencode serve` falso segura o MCP por um
// arquivo de controle, então o connect demora de verdade.
// Uso: `node tests/opencode-stop-ui.mjs`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withArtifacts,newRuntime,seedCourse,writeDeskJson,writeConfigJson,launchDesk,statusOnline,sendEnabled} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

const require=createRequire(import.meta.url);
const conversations=require('../src/agents/conversations.cjs');
const FAKE_OPENCODE_BIN=path.resolve(import.meta.dirname,'fake-opencode.mjs');
const readQueue=file=>fs.existsSync(file)?fs.readFileSync(file,'utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line)):[];

await withArtifacts('opencode-stop',async ctx=>{
 const runtime=ctx.runtime=newRuntime('opencode-stop'),folder=seedCourse(runtime,'Calculo');
 const queueLog=path.join(runtime,'queue.jsonl'),pendingFile=path.join(runtime,'mcp-pending');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calculo',name:'Cálculo',path:folder}]});
 const session=conversations.createClaudeConversation({runtime,courseId:'Calculo',engine:'opencode'});
 writeDeskJson(runtime,{courseId:'Calculo',session,courseStates:{Calculo:{session,sessions:[{path:session}]}}});
 fs.chmodSync(FAKE_OPENCODE_BIN,0o755);
 const app=ctx.app=await launchDesk({runtime,opencode:false,env:{LEARNING_DESK_OPENCODE:FAKE_OPENCODE_BIN,FAKE_OPENCODE_QUEUE_LOG:queueLog,FAKE_OPENCODE_MCP_PENDING_FILE:pendingFile}});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await statusOnline(page,{timeout:60000});

 /* 1. Parar no mesmo instante do Enviar: antes do connect e do prompt. */
 const immediate=await page.evaluate(async()=>{
  const {send}=await import('./src/chat.mjs');
  const {S}=await import('./src/state.mjs');
  const run=send('fala imediata');
  window.dispatchEvent(new Event('desk-stop'));
  await window.desk.abort(S.sendAttemptId||'').catch(()=>{});
  return {sent:await run,busy:S.busy};
 });
 assert.equal(immediate.sent,false,'o envio desiste antes do prompt');
 assert.equal(immediate.busy,false,'a coluna sai do turno');
 await new Promise(resolve=>setTimeout(resolve,300));// espera fixa: o save do envio ainda terminava
 assert.deepEqual(readQueue(queueLog).filter(entry=>String(entry.message||'').includes('fala imediata')),[],'o prompt interrompido não saiu');

 /* 2. Parar durante um connect de verdade (MCP preso): a interface sai em
    menos de 1 s e o envio não sai quando o connect termina. */
 fs.writeFileSync(pendingFile,'1');
 const slow=page.evaluate(async()=>{
  const {send}=await import('./src/chat.mjs');
  const {S}=await import('./src/state.mjs');
  S.connected=false;
  const sent=await send('fala durante o connect');
  return {sent,toast:document.querySelector('#toast')?.textContent||'',busy:S.busy,connected:S.connected,connecting:!!S.connecting,uncertain:S.uncertain,link:S.link?.state};
 });
 await pollUntil(()=>page.evaluate(async()=>{const {S}=await import('./src/state.mjs');return !!S.connecting;}),value=>value,{what:'o connect em voo',timeout:5000});
 await page.waitForFunction(()=>!document.querySelector('#stop').hidden,undefined,{timeout:5000});
 const stoppedAt=Date.now();
 await page.evaluate(()=>document.querySelector('#stop').click());
 await sendEnabled(page,{timeout:1000});
 assert.ok(Date.now()-stoppedAt<1000,`a interface saiu do turno em ${Date.now()-stoppedAt} ms`);
 const slowResult=await slow;
 assert.equal(slowResult.sent,false,'o envio durante o connect foi cancelado');
 assert.equal((await page.evaluate(async()=>{const {S}=await import('./src/state.mjs');return S.busy;})),false);

 /* Libera o MCP, deixa a conexão cancelada terminar e manda a fala nova. */
 fs.rmSync(pendingFile,{force:true});
 await pollUntil(()=>page.evaluate(async()=>{const {S}=await import('./src/state.mjs');return !!S.connecting;}),value=>!value,{what:'a conexão cancelada terminar',timeout:15000});
 await page.evaluate(async()=>{
  const {send}=await import('./src/chat.mjs');
  const {S}=await import('./src/state.mjs');
  S.connected=false;
  S.connectCancelled=false;
  return send('fala nova');
 });
 await page.waitForFunction(()=>[...document.querySelectorAll('.message.assistant .body')].some(el=>el.textContent.includes('Resposta do OpenCode falso')),undefined,{timeout:30000});
 await sendEnabled(page,{timeout:30000});
 const sent=readQueue(queueLog).map(entry=>String(entry.message||''));
 assert.equal(sent.some(text=>text.includes('fala imediata')),false,'nada da fala imediata saiu');
 assert.equal(sent.some(text=>text.includes('fala durante o connect')),false,'nada da fala do connect saiu');
 assert.equal(sent.filter(text=>text.includes('fala nova')).length,1,'a fala nova saiu uma vez');
 assert.deepEqual(errors,[],'sem erro de página');
 await app.close();ctx.app=null;
});
console.log('ok opencode-stop-ui');
