import {ptMatches} from './pt-text.mjs';import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createRequire} from 'node:module';
const {PiBridge}=createRequire(import.meta.url)('../rpc.cjs');
test('stderr em Buffer não derruba a ponte e vira evento com texto',async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'desk-rpc-stderr-'));const file=path.join(dir,'fake-pi');fs.writeFileSync(file,`#!/usr/bin/env node\nprocess.stderr.write('aviso de teste\\n');process.stdin.setEncoding('utf8');let b='';process.stdin.on('data',s=>{b+=s;let i;while((i=b.indexOf('\\n'))>=0){const e=JSON.parse(b.slice(0,i));b=b.slice(i+1);process.stdout.write(JSON.stringify({type:'response',id:e.id,success:true,data:{ok:1}})+'\\n');}});`);fs.chmodSync(file,0o755);const bridge=new PiBridge({cwd:dir,session:path.join(dir,'session'),pi:file});const lines=[];bridge.on('stderr',line=>lines.push(line));try{const state=await bridge.request('get_state',{},3000);assert.deepEqual(state,{ok:1},'a ponte continua respondendo depois do stderr');let hit=false;for(let i=0;i<50&&!hit;i++){await new Promise(r=>setTimeout(r,20));hit=lines.some(line=>line.includes('aviso de teste'));}assert.ok(hit,'o stderr vira evento com o texto (e não com Buffer)');assert.ok(lines.every(line=>typeof line==='string'));}finally{bridge.removeAllListeners();bridge.stop();fs.rmSync(dir,{recursive:true,force:true});}});
test('RPC keeps Unicode line separators inside JSON and propagates errors',async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'desk-rpc-'));const file=path.join(dir,'fake-pi');fs.writeFileSync(file,`#!/usr/bin/env node\nprocess.stdin.setEncoding('utf8');let b='';process.stdin.on('data',s=>{b+=s;let i;while((i=b.indexOf('\\n'))>=0){const e=JSON.parse(b.slice(0,i));b=b.slice(i+1);process.stdout.write(JSON.stringify({type:'response',id:e.id,success:e.type!=='bad',error:'expected failure',data:{value:'a\\u2028b',echo:e.message}})+'\\n');}});`);fs.chmodSync(file,0o755);const bridge=new PiBridge({cwd:dir,session:path.join(dir,'session'),pi:file});try{assert.deepEqual(await bridge.request('get_state'),{value:'a\u2028b'});assert.equal((await bridge.request('prompt',{message:'hello\nworld'})).echo,'hello\nworld');await assert.rejects(bridge.request('bad'),/expected failure/);}finally{bridge.removeAllListeners();bridge.stop();fs.rmSync(dir,{recursive:true,force:true});}});
test('RPC timeout refuses only that request and keeps the bridge alive',async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'desk-rpc-timeout-'));const file=path.join(dir,'fake-pi');fs.writeFileSync(file,`#!/usr/bin/env node\nprocess.stdin.resume();`);fs.chmodSync(file,0o755);const bridge=new PiBridge({cwd:dir,session:path.join(dir,'session'),pi:file});try{await assert.rejects(bridge.request('get_state',{},30),ptMatches(/demorou demais/));assert.ok(bridge.child,'a ponte continua viva (quem detecta um Pi morto é o health)');assert.equal(bridge.pending.size,0,'o pedido recusado sai dos pendentes');await assert.rejects(bridge.request('get_state',{},30),ptMatches(/demorou demais/),'o pedido seguinte também recusa sem derrubar');bridge.stop();assert.equal(bridge.child,null,'stop fecha a ponte');}finally{bridge.removeAllListeners();try{bridge.stop();}catch{}fs.rmSync(dir,{recursive:true,force:true});}});
test('RPC respond keeps extension_ui_response as the envelope type',async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'desk-rpc-respond-'));const file=path.join(dir,'fake-pi');const log=path.join(dir,'in.log');fs.writeFileSync(file,`#!/usr/bin/env node\nconst fs=require('node:fs');process.stdin.setEncoding('utf8');let b='';process.stdin.on('data',s=>{b+=s;let i;while((i=b.indexOf('\\n'))>=0){const line=b.slice(0,i);b=b.slice(i+1);fs.appendFileSync(${JSON.stringify(log)},line+'\\n');try{const e=JSON.parse(line);if(e.id)process.stdout.write(JSON.stringify({type:'response',id:e.id,success:true,data:{}})+'\\n');}catch{}}});`);fs.chmodSync(file,0o755);const bridge=new PiBridge({cwd:dir,session:path.join(dir,'session'),pi:file});try{await bridge.request('get_state');bridge.respond({type:'bash',command:'rm -rf /',id:'ui-1'});let hit=null;for(let i=0;i<50&&!hit;i++){await new Promise(r=>setTimeout(r,20));for(const line of fs.existsSync(log)?fs.readFileSync(log,'utf8').split('\n'):[]){if(!line.trim())continue;try{const entry=JSON.parse(line);if(entry.id==='ui-1')hit=entry;}catch{}}}assert.ok(hit,'the response line should reach the child');assert.equal(hit.type,'extension_ui_response');assert.equal(hit.command,undefined);}finally{bridge.removeAllListeners();bridge.stop();fs.rmSync(dir,{recursive:true,force:true});}});
test('linha torta no stdout vira desk_warn e não derruba a ponte',async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'desk-rpc-garbage-'));const file=path.join(dir,'fake-pi');fs.writeFileSync(file,`#!/usr/bin/env node\nprocess.stdin.setEncoding('utf8');process.stdout.write('){isto-nao-e-json}\\n');let b='';process.stdin.on('data',s=>{b+=s;let i;while((i=b.indexOf('\\n'))>=0){const e=JSON.parse(b.slice(0,i));b=b.slice(i+1);process.stdout.write(JSON.stringify({type:'response',id:e.id,success:true,data:{ok:1}})+'\\n');}});`);fs.chmodSync(file,0o755);const bridge=new PiBridge({cwd:dir,session:path.join(dir,'session'),pi:file});const events=[];bridge.on('event',e=>events.push(e));try{assert.deepEqual(await bridge.request('get_state',{},3000),{ok:1},'a ponte segue respondendo depois do lixo');assert.ok(events.some(e=>e.type==='desk_warn'),'a linha torta vira desk_warn');assert.ok(!events.some(e=>e.type==='desk_error'),'linha torta não vira desk_error (a UI não cai para offline)');assert.ok(bridge.child,'a ponte continua viva');}finally{bridge.removeAllListeners();bridge.stop();fs.rmSync(dir,{recursive:true,force:true});}});

test('Pi 0.99: aceite preserva disposition; recusa explícita não é entrega incerta', async () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'native-rpc-'));
 const file = path.join(dir, 'fake-pi');
 fs.writeFileSync(file, `#!/usr/bin/env node
process.stdin.setEncoding('utf8');let b='';process.stdin.on('data',s=>{b+=s;let i;while((i=b.indexOf('\\n'))>=0){const e=JSON.parse(b.slice(0,i));b=b.slice(i+1);process.stdout.write(JSON.stringify({type:'response',id:e.id,success:e.message!=='refuse',error:'not accepted',data:{disposition:e.message}})+'\\n');}});`);
 fs.chmodSync(file, 0o755);
 const bridge = new PiBridge({cwd:dir,session:path.join(dir,'session'),pi:file});
 try {
  for (const disposition of ['started','queued','handled']) assert.deepEqual(await bridge.request('prompt',{message:disposition}),{disposition});
  await assert.rejects(bridge.request('prompt',{message:'refuse'}), error => error.notSent === true && /not accepted/.test(error.message));
  await assert.rejects(bridge.request('get_state',{message:'refuse'}), error => error.notSent !== true);
 } finally {bridge.removeAllListeners();bridge.stop();fs.rmSync(dir,{recursive:true,force:true});}
});

/* N1 da revisão final: a corrida 1 fica com a mensagem aberta e a ferramenta
   `t1` declarada; o abort só responde depois do `agent_settled` (contrato do
   Pi). A corrida 2 recebe os atrasos da 1: `message_end`/`tool_execution_end`
   com `t1` aposentado NÃO podem ser reencaminhados. O delta sem id é o limite
   honesto documentado — sai carimbado com a corrida aberta e se reconcilia no
   fluxo autoritativo. */
test('Pi: atraso da corrida anterior com ferramenta aposentada não é reencaminhado (N1)', async () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'desk-rpc-run-'));
 const file = path.join(dir, 'fake-pi');
 fs.writeFileSync(file, `#!/usr/bin/env node
const out = event => process.stdout.write(JSON.stringify(event) + '\\n');
let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', data => {
 buffer += data;
 let at;
 while ((at = buffer.indexOf('\\n')) >= 0) {
  const e = JSON.parse(buffer.slice(0, at));
  buffer = buffer.slice(at + 1);
  if (e.type === 'abort') {
   out({type: 'response', id: e.id, success: true});
   out({type: 'agent_end', willRetry: false});
   out({type: 'agent_settled', aborted: true});
   continue;
  }
  if (e.type === 'prompt') {
   out({type: 'response', id: e.id, success: true, data: {disposition: 'started'}});
   out({type: 'agent_start'});
   out({type: 'message_start', message: {role: 'assistant'}});
   if (e.message === 'um') {
    out({type: 'message_update', assistantMessageEvent: {type: 'toolcall_end', contentIndex: 1, toolCall: {id: 't1', name: 'x', arguments: {}}}});
    out({type: 'tool_execution_start', toolCallId: 't1', toolName: 'x', args: {}});
    continue;
   }
   /* Atraso da corrida 1 dentro da corrida 2. */
   out({type: 'message_update', assistantMessageEvent: {type: 'text_delta', delta: 'Fala atrasada.', contentIndex: 2}});
   out({type: 'message_end', message: {role: 'assistant', content: [{type: 'toolCall', id: 't1', name: 'x', arguments: {}}, {type: 'text', text: 'Fala atrasada.'}]}});
   out({type: 'tool_execution_end', toolCallId: 't1', toolName: 'x', result: {content: [], details: {}}, isError: false});
   out({type: 'message_end', message: {role: 'assistant', content: [{type: 'text', text: 'Fala nova.'}]}});
   out({type: 'agent_end', willRetry: false});
   out({type: 'agent_settled'});
   continue;
  }
  out({type: 'response', id: e.id, success: true, data: {}});
 }
});
`);
 fs.chmodSync(file, 0o755);
 const bridge = new PiBridge({cwd: dir, session: path.join(dir, 'session'), pi: file});
 const events = [];
 bridge.on('event', event => events.push(event));
 try {
  assert.deepEqual(await bridge.request('prompt', {message: 'um'}), {disposition: 'started'});
  for (let i = 0; i < 100 && !events.some(e => e.type === 'tool_execution_start' && e.toolCallId === 't1'); i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(events.some(e => e.type === 'tool_execution_start' && e.toolCallId === 't1'), 'a declaração da corrida 1 passou');
  await bridge.request('abort', {}, 3000);
  assert.deepEqual(await bridge.request('prompt', {message: 'dois'}), {disposition: 'started'});
  for (let i = 0; i < 200 && !events.some(e => e.type === 'agent_settled' && e.hostRun === 'host-run-2'); i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(events.some(e => e.type === 'agent_settled' && e.hostRun === 'host-run-1'), 'o settle da corrida 1 sai carimbado com a corrida 1');
  const lateToolEnds = events.filter(e => e.type === 'tool_execution_end');
  assert.equal(lateToolEnds.length, 1, 'o tool_execution_end atrasado chega marcado para descarte');
  assert.equal(lateToolEnds[0].stale, true, 'tool_execution_end com id aposentado sai stale (não pinta)');
  const lateEnds = events.filter(e => e.type === 'message_end' && e.message?.content?.some(part => part.type === 'toolCall' && part.id === 't1'));
  assert.equal(lateEnds.length, 1, 'o message_end atrasado chega marcado para descarte/limpeza');
  assert.equal(lateEnds[0].stale, true, 'message_end com id aposentado sai stale (não pinta)');
  assert.ok(events.some(e => e.type === 'message_end' && e.message?.content?.some(part => part.text === 'Fala nova.')), 'o message_end da corrida 2 passa');
  const lateDelta = events.find(e => e.type === 'message_update' && e.assistantMessageEvent?.delta === 'Fala atrasada.');
  assert.ok(lateDelta, 'o delta sem id é o limite honesto: o host não consegue atribuí-lo');
  assert.equal(lateDelta.hostRun, 'host-run-2', 'o delta atrasado sai com a corrida aberta (reconciliado no fluxo autoritativo)');
  assert.ok(events.every(e => !(e.type.startsWith('message_') || e.type.startsWith('tool_execution_')) || e.hostRun), 'todo evento de pintura sai carimbado');
 } finally {bridge.removeAllListeners(); bridge.stop(); fs.rmSync(dir, {recursive: true, force: true});}
});

/* R3 residual: o processo velho declara `t1` e MORRE; o próximo pedido no
   MESMO PiBridge sobe um processo novo que reusa `t1`. O ledger do processo
   morto não pode invalidar a identidade nativa do processo novo, e o contador
   `host-run-N` continua — o renderer nunca confunde a corrida velha com a
   nova. */
test('Pi: reinício no MESMO bridge não herda ids aposentados (R3)', async () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'desk-rpc-restart-'));
 const file = path.join(dir, 'fake-pi');
 const phaseFile = path.join(dir, 'phase');
 fs.writeFileSync(phaseFile, '0');
 fs.writeFileSync(file, `#!/usr/bin/env node
const fs = require('node:fs');
let phase = 0;
try { phase = Number(fs.readFileSync(process.env.PROBE_PHASE, 'utf8')) || 0; } catch {}
fs.writeFileSync(process.env.PROBE_PHASE, String(phase + 1));
const out = event => process.stdout.write(JSON.stringify(event) + '\\n');
let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', data => {
 buffer += data;
 let at;
 while ((at = buffer.indexOf('\\n')) >= 0) {
  const raw = buffer.slice(0, at);
  buffer = buffer.slice(at + 1);
  if (!raw.trim()) continue;
  const e = JSON.parse(raw);
  if (e.type === 'get_state') out({type: 'response', id: e.id, success: true, data: {isStreaming: false}});
  else if (e.type === 'prompt') {
   out({type: 'response', id: e.id, success: true, data: {disposition: 'started'}});
   out({type: 'agent_start'});
   out({type: 'message_start', message: {role: 'assistant'}});
   out({type: 'tool_execution_start', toolCallId: 't1', toolName: 'x', args: {}});
   if (phase === 0) setTimeout(() => process.exit(9), 120);
   else {
    out({type: 'tool_execution_end', toolCallId: 't1', toolName: 'x', result: {content: []}, isError: false});
    out({type: 'agent_end', willRetry: false});
    out({type: 'agent_settled'});
   }
  } else if (e.id) out({type: 'response', id: e.id, success: true, data: {}});
 }
});
`);
 fs.chmodSync(file, 0o755);
 const bridge = new PiBridge({cwd: dir, session: path.join(dir, 'session'), pi: file, env: {...process.env, PROBE_PHASE: phaseFile}});
 const events = [];
 bridge.on('event', event => events.push(event));
 try {
  await bridge.request('get_state', {}, 3000);
  await bridge.request('prompt', {message: 'um'}, 3000);
  for (let i = 0; i < 200 && !events.some(e => e.type === 'desk_error'); i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(events.some(e => e.type === 'desk_error'), 'a queda do filho vira desk_error');
  const crashed = bridge.identity.state();
  assert.equal(crashed.open, true, 'a corrida 1 ainda estava aberta quando o processo morreu');
  /* O próximo pedido sobe o processo novo NO MESMO bridge. */
  await bridge.request('get_state', {}, 3000);
  await bridge.request('prompt', {message: 'dois'}, 3000);
  for (let i = 0; i < 200 && !events.some(e => e.type === 'agent_settled'); i++) await new Promise(resolve => setTimeout(resolve, 10));
  const starts = events.filter(e => e.type === 'tool_execution_start' && e.toolCallId === 't1');
  assert.equal(starts.length, 2, 'as duas declarações nativas do MESMO id chegam');
  assert.equal(starts[0].stale, undefined, 'a declaração do processo 1 é da corrida 1');
  assert.equal(starts[1].stale, undefined, 'o id reusado pelo processo 2 NÃO sai stale (ledger resetado)');
  assert.equal(starts[1].hostRun, 'host-run-2', 'o contador de corrida continua no mesmo bridge');
  const settles = events.filter(e => e.type === 'agent_settled');
  assert.deepEqual(settles.map(e => e.hostRun), ['host-run-2'], 'só a corrida nova settle (a antiga morreu sem fechar)');
  assert.deepEqual(bridge.identity.state().retired, ['t1'], 'o settle novo aposenta o t1 da corrida nova');
  const ends = events.filter(e => e.type === 'tool_execution_end');
  assert.equal(ends.length, 1, 'o end do processo novo passa (não é confundido com atraso do morto)');
  assert.equal(ends[0].stale, undefined);
 } finally {bridge.removeAllListeners(); bridge.stop(); fs.rmSync(dir, {recursive: true, force: true});}
});

/* Regressão da #49: `stop()` passava os quatro fatos de `facts()` para o
   `onStop` de três, e o `seq` virava o tamanho da fila (0), repetindo ids
   `desk-N` depois de religar. */
test('stop mantém o seq: o próximo pedido nunca repete id', () => {
 const bridge = new PiBridge({cwd: os.tmpdir(), session: path.join(os.tmpdir(), 'nunca-usada'), pi: '/inexistente'});
 bridge.seq = 7;
 bridge.stop();
 assert.equal(bridge.stopped, true);
 assert.equal(bridge.seq, 7);
});
