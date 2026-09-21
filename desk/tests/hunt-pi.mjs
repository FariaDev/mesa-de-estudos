#!/usr/bin/env node
import fs from 'node:fs';

/* Fake do Pi para a caça adversarial (`desk/tests/hunt-chaos.mjs`).
   Não substitui `tests/fake-pi.mjs`: aqui os modos são por TIPO de pedido e o
   objetivo é sujar o protocolo (lixo, fragmento sem newline, resposta dividida
   em bytes, resposta duplicada, evento desconhecido, processo morto no meio de
   um get_messages grande, prompt sem ack, stream que só termina no abort,
   diálogos no meio do stream).

   Modos (HUNT_PI_MODES, vírgula; cada um dispara uma vez por sessão — ou N
   vezes quando HUNT_PI_KILL_MESSAGES manda):
   - garbage-prompt: 2 linhas de lixo + fragmento JSON sem '\n' antes do ack;
   - unknown-prompt: evento desconhecido + response de id nunca pedido;
   - chunks-prompt: o ack do prompt sai em pedaços, com o corte no meio de um
     emoji (testa o setEncoding utf8 da ponte);
   - dup-reply-prompt: ack duplicado;
   - kill-prompt: ack e morre (exit 9) antes de qualquer stream;
   - mute-prompt: nunca responde o ack (testa o timeout de 60s);
   - slow-messages: get_messages demora 1500ms;
   - kill-messages: get_messages começa a escrever a resposta e morre no meio
     (exit 7); HUNT_PI_KILL_MESSAGES controla quantas vezes;
   - devagar: stream palavra a palavra (HUNT_PI_DELAY ms por palavra);
   - trave: stream infinito, só termina no abort (Esc);
   - diálogo: select no meio do stream; a resposta do app retoma;
   - dois: dois extension_ui_request em fila (select + input). */

const MODES=String(process.env.HUNT_PI_MODES||'').split(',').map(s=>s.trim()).filter(Boolean);
const DELAY=Math.max(1,Number(process.env.HUNT_PI_DELAY)||90);
const KILL_MESSAGES=Math.max(1,Number(process.env.HUNT_PI_KILL_MESSAGES)||1);
const KILL_PROMPTS=Math.max(1,Number(process.env.HUNT_PI_KILL_PROMPTS)||1);
const args=process.argv.slice(2);
const session=args[args.indexOf('--session')+1];
const mark=session?`${session}-hunt.json`:'';
function readMark(){try{return JSON.parse(fs.readFileSync(mark,'utf8'));}catch{return {};}}
function take(key,times=1){
 if(!MODES.includes(key))return false;
 const m=readMark(),used=m[key]||0;
 if(used>=times)return false;
 m[key]=used+1;
 try{fs.writeFileSync(mark,JSON.stringify(m));}catch{}
 return true;
}

const model={provider:'test',id:'offline',name:'Pi de caça',input:['text','image']};
function write(obj){process.stdout.write(JSON.stringify(obj)+'\n');}
function reply(id,data){write({type:'response',id,success:true,data});}
function emit(e){write(e);}
function writeSplit(line,parts=3,done=null){
 const buf=Buffer.from(line,'utf8');
 const size=Math.max(2,Math.ceil(buf.length/parts));
 let at=0;
 const step=()=>{
  if(at>=buf.length){if(done)done();return;}
  const end=Math.min(buf.length,at+size);
  process.stdout.write(buf.subarray(at,end));
  at=end;
  if(at<buf.length)setTimeout(step,45);else if(done)done();
 };
 step();
}

let streaming=false,streamTimer=null,heldTurn=false,pendingDialog=null;
function stopStream(){
 if(streamTimer){clearInterval(streamTimer);streamTimer=null;}
 if(streaming){streaming=false;emit({type:'agent_end'});}
 heldTurn=false;
}
function emitText(text,delay=DELAY){
 if(streaming)return;
 streaming=true;
 emit({type:'message_start',message:{role:'assistant'}});
 const words=String(text).split(/(\s+)/).filter(w=>w.length);
 const finish=(finalText=text)=>{
  clearInterval(streamTimer);streamTimer=null;streaming=false;
  emit({type:'message_end',message:{role:'assistant',content:[{type:'text',text:finalText}]}});
  emit({type:'agent_end'});
 };
 if(take('chunks-event')&&words.length){
  /* O primeiro delta (com emoji) sai dividido em bytes: o corte pode cair no
     meio do caractere; o setEncoding('utf8') do host precisa remontar. */
  const first=`🐛 ${words[0]}`;
  const line=JSON.stringify({type:'message_update',assistantMessageEvent:{type:'text_delta',delta:first}})+'\n';
  const rest=words.slice(1);
  const finalText=first+rest.join('');
  writeSplit(line,4,()=>{
   let j=0;
   streamTimer=setInterval(()=>{
    if(j>=rest.length){finish(finalText);return;}
    emit({type:'message_update',assistantMessageEvent:{type:'text_delta',delta:rest[j++]}});
   },delay);
  });
  return;
 }
 let i=0;
 streamTimer=setInterval(()=>{
  if(i>=words.length){finish();return;}
  emit({type:'message_update',assistantMessageEvent:{type:'text_delta',delta:words[i++]}});
 },delay);
}
function messages(){
 if(!session||!fs.existsSync(session))return [];
 return fs.readFileSync(session,'utf8').split('\n').filter(Boolean).flatMap(line=>{try{return [JSON.parse(line).message].filter(Boolean);}catch{return [];}});
}
function onPrompt(e){
 const text=String(e.message||'');
 try{fs.appendFileSync(session,JSON.stringify({type:'message',message:{role:'user',content:[{type:'text',text}]}})+'\n');}catch{}
 if(take('garbage-prompt')){
  process.stdout.write('lixo no stdout do Pi\n');
  process.stdout.write('{"type":"quase_json"\n');
  process.stdout.write('{"type":"message_up');
 }
 if(take('unknown-prompt')){
  emit({type:'evento_do_futuro',x:1});
  write({type:'response',id:'id-nunca-pedido',success:true,data:{}});
 }
 if(take('dup-reply-prompt')){
  reply(e.id,{ok:true});
  setTimeout(()=>reply(e.id,{ok:true}),40);
 }else if(take('chunks-prompt')){
  writeSplit(JSON.stringify({type:'response',id:e.id,success:true,data:{ok:true,flavor:'eco🐛fim'}})+'\n');
 }else{
  reply(e.id,{ok:true});
 }
 if(take('kill-prompt',KILL_PROMPTS)){setTimeout(()=>process.exit(9),30);return;}
 if(take('mute-prompt'))return;
 if(take('dialog-prompt')&&/diálogo/i.test(text)){
  streaming=true;
  emit({type:'message_start',message:{role:'assistant'}});
  emit({type:'message_update',assistantMessageEvent:{type:'text_delta',delta:'Antes do diálogo. '}});
  setTimeout(()=>emit({type:'extension_ui_request',id:'ui-caça-1',method:'select',title:'Escolha da caça',options:['Alfa','Beta']}),200);
  pendingDialog={kind:'one',step:0};
  return;
 }
 if(take('two-dialogs-prompt')&&/dois/i.test(text)){
  streaming=true;
  emit({type:'message_start',message:{role:'assistant'}});
  emit({type:'message_update',assistantMessageEvent:{type:'text_delta',delta:'Começando os dois diálogos. '}});
  emit({type:'extension_ui_request',id:'ui-caça-2a',method:'select',title:'Primeiro',options:['Um','Dois']});
  emit({type:'extension_ui_request',id:'ui-caça-2b',method:'input',title:'Segundo',placeholder:'texto'});
  pendingDialog={kind:'two',done:new Set()};
  return;
 }
 if(/trave/i.test(text)){
  streaming=true;heldTurn=true;
  emit({type:'message_start',message:{role:'assistant'}});
  emit({type:'message_update',assistantMessageEvent:{type:'text_delta',delta:'Vou travar no meio…'}});
  streamTimer=setInterval(()=>{
   if(!heldTurn)return;
   emit({type:'message_update',assistantMessageEvent:{type:'text_delta',delta:' travei mais um pouco'}});
  },2000);
  return;
 }
 emitText(`Eco de caça: ${text}`);
}
function dialogResponse(e){
 if(!pendingDialog)return;
 if(pendingDialog.kind==='one'){
  pendingDialog=null;
  emit({type:'message_update',assistantMessageEvent:{type:'text_delta',delta:`Resposta ${e.value??'(cancelado)'}.`}});
  emit({type:'message_end',message:{role:'assistant',content:[{type:'text',text:`Antes do diálogo. Resposta ${e.value??'(cancelado)'}.`}]}});
  emit({type:'agent_end'});
  streaming=false;
  return;
 }
 pendingDialog.done.add(e.id);
 if(pendingDialog.done.size>=2){
  pendingDialog=null;
  emit({type:'message_update',assistantMessageEvent:{type:'text_delta',delta:'Fim dos diálogos.'}});
  emit({type:'message_end',message:{role:'assistant',content:[{type:'text',text:'Começando os dois diálogos. Fim dos diálogos.'}]}});
  emit({type:'agent_end'});
  streaming=false;
 }
}

let buffer='';
process.stdin.setEncoding('utf8');
process.stdin.on('data',chunk=>{
 buffer+=chunk;
 let end;
 while((end=buffer.indexOf('\n'))>=0){
  const raw=buffer.slice(0,end);buffer=buffer.slice(end+1);
  if(!raw.trim())continue;
  let e;try{e=JSON.parse(raw);}catch{continue;}
  if(e.type==='extension_ui_response'){dialogResponse(e);continue;}
  if(e.type==='clear_queue'){reply(e.id,{});continue;}
  if(e.type==='abort'){stopStream();reply(e.id,{});continue;}
  if(e.type==='prompt'){onPrompt(e);continue;}
  if(e.type==='get_messages'){
   if(take('slow-messages')){setTimeout(()=>reply(e.id,{messages:messages()}),1500);continue;}
   if(take('kill-messages',KILL_MESSAGES)){
    const payload=JSON.stringify({type:'response',id:e.id,success:true,data:{messages:messages()}});
    process.stdout.write(payload.slice(0,Math.max(20,Math.floor(payload.length/2))));
    setTimeout(()=>process.exit(7),250);
    continue;
   }
   reply(e.id,{messages:messages()});
   continue;
  }
  if(e.type==='get_state'){reply(e.id,{model,thinkingLevel:'off',isStreaming:streaming||heldTurn,pendingMessageCount:0,autoCompactionEnabled:true});continue;}
  if(e.type==='get_session_stats'){const n=messages().length;const tokens=12000+n*800;reply(e.id,{contextUsage:{tokens,contextWindow:200000,percent:Math.min(99,tokens/1000)}});continue;}
  if(e.type==='get_commands'){reply(e.id,{commands:[{name:'help',description:'Mostrar os comandos'}]});continue;}
  if(e.type==='get_available_models'){reply(e.id,{models:[model]});continue;}
  if(e.type==='set_auto_compaction'){reply(e.id,{});continue;}
  if(e.type==='compact'){reply(e.id,{summary:'Resumo de caça.',firstKeptEntryId:'x',tokensBefore:1000});continue;}
  if(e.type==='set_model'||e.type==='set_thinking_level'){reply(e.id,{});continue;}
  if(e.id)reply(e.id,{});
 }
});
