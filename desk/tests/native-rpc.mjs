/* Opt-in: uma conversa temporária com Pi/provedor reais, sem dados de curso.
   Confere persistência antes da resposta, retomada e Codemode pelo RPC do app. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {PiBridge} = require('../../chat/rpc.cjs');
const {spawnArgs,spawnEnv,resolvePi} = require('../../chat/pi.cjs');
const root = fs.mkdtempSync(path.join(os.tmpdir(),'pi-native-rpc-'));
const session = path.join(root,'session.jsonl');
const pi = resolvePi();
const options = {cwd:root,session,pi,env:spawnEnv(pi),promptFile:'Teste técnico isolado. Responda em português. Não acesse dados pessoais, arquivos, serviços externos ou servidores MCP. Use apenas codemode quando solicitado.',extraArgs:spawnArgs()};
let bridge;
try {
 bridge = new PiBridge(options);
 await bridge.request('get_state');
 const handled = await bridge.request('prompt',{message:'/mcp'});
 assert.equal(handled.disposition,'handled');
 assert.equal((await bridge.request('get_state')).isStreaming,false);
 const queued=await bridge.request('follow_up',{message:'Entrada técnica a cancelar antes de executar.'});
 assert.equal(queued.disposition,'queued');assert.equal(bridge.runActive,false);
 assert.equal(bridge.isRunning(await bridge.request('get_state')),true);
 await bridge.request('clear_queue');assert.equal(bridge.isRunning(await bridge.request('get_state')),false);
 let userEnded;
 const userMessage = new Promise(resolve => userEnded = resolve);
 bridge.on('event',e=>{if(e.type==='message_end'&&e.message?.role==='user')userEnded();});
 const accepted = await bridge.request('prompt',{message:'Primeira etapa técnica: se responder a esta mensagem, responda somente EARLY-NATIVE. Esta etapa não impõe regras às mensagens seguintes.'});
 assert.equal(accepted.disposition,'started');
 let userTimer;
 try {await Promise.race([userMessage,new Promise((_,reject)=>userTimer=setTimeout(()=>reject(Error('Mensagem não entrou na sessão')),10000))]);}finally{clearTimeout(userTimer);}
 bridge.removeAllListeners();bridge.stop();
 assert.ok(fs.existsSync(session),'primeira mensagem deve existir antes da primeira resposta');
 assert.match(fs.readFileSync(session,'utf8'),/EARLY-NATIVE/);
 console.log('Pi real: handled não inicia rodada; primeira mensagem preservada ao encerrar após sua entrada, antes da resposta');
 bridge = new PiBridge(options);
 const messages = await bridge.request('get_messages');
 assert.ok(messages.messages.some(m=>m.role==='user'&&JSON.stringify(m.content).includes('EARLY-NATIVE')),'retomada');
 const events=[];
 let finish;
 const settled=new Promise(resolve=>finish=resolve);
 bridge.on('event',e=>{events.push(e);if(e.type==='agent_settled')finish();});
 const result = await bridge.request('prompt',{message:'A etapa EARLY-NATIVE foi encerrada sem aguardar resposta. Esta é uma nova etapa, com autorização explícita para a ferramenta. Use a ferramenta codemode para executar JavaScript que retorna a string "NATIVE-RPC-OK". Não chame outras ferramentas dentro do código. Depois responda apenas NATIVE-RPC-OK.'});
 assert.equal(result.disposition,'started');
 let timer;
 try {await Promise.race([settled,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Rodada real excedeu 60s')),60000);})]);}finally{clearTimeout(timer);}
 assert.ok(events.some(e=>e.type==='tool_execution_start'&&e.toolName==='codemode'),
  'modelo chamou Codemode; diagnóstico: '+JSON.stringify(events.filter(e=>e.type==='message_end').map(e=>({role:e.message?.role,stopReason:e.message?.stopReason,error:e.message?.errorMessage,content:e.message?.content}))).slice(0,2000));
 assert.ok(events.some(e=>e.type==='message_end'&&e.message?.role==='assistant'&&JSON.stringify(e.message.content).includes('NATIVE-RPC-OK')),'resposta do modelo');
 assert.equal((await bridge.request('get_state')).isStreaming,false);
 console.log('Pi/provedor reais: sessão retomada, Codemode executado e resposta final recebida via RPC da Conversa');
}finally{bridge?.removeAllListeners();bridge?.stop();fs.rmSync(root,{recursive:true,force:true});}
