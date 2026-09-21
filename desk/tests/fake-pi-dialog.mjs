#!/usr/bin/env node
/* Fake do Pi para exercitar o `#pi-dialog` (pergunta do Pi) no hunt-shell:
   - prompt com "pergunta" → extension_ui_request method=input (com prefill/placeholder)
   - prompt com "escolha"  → method=select (com prefill casando uma opção)
   - prompt com "confirmar"→ method=confirm (sem campo)
   A resposta volta no extension_ui_response e vira texto + agent_end. */
const args=process.argv.slice(2);const session=args[args.indexOf('--session')+1];
const model={provider:'test',id:'dialog',name:'Pi de diálogo',input:['text','image']};
function reply(e,data){process.stdout.write(JSON.stringify({type:'response',id:e.id,success:true,data})+'\n');}
function emit(event){process.stdout.write(JSON.stringify(event)+'\n');}
function emitText(text){
 emit({type:'message_start',message:{role:'assistant'}});
 emit({type:'message_update',assistantMessageEvent:{type:'text_delta',delta:text}});
 emit({type:'message_end',message:{role:'assistant',content:[{type:'text',text}]}});
 emit({type:'agent_end'});
}
const pending=new Map();
function ask(e,spec){
 const id='dlg-'+spec.method;
 pending.set(id,spec);
 emit({type:'extension_ui_request',id,method:spec.method,title:spec.title,message:spec.message,...spec.extra});
}
function answer(id,response){
 const spec=pending.get(id);if(!spec)return;
 pending.delete(id);
 const value=response.cancelled?'(cancelado)':(response.confirmed===true?'(confirmado)':String(response.value??'(vazio)'));
 emitText(`${spec.label}: ${value}`);
}
process.stdin.setEncoding('utf8');let buffer='';
process.stdin.on('data',chunk=>{buffer+=chunk;let end;while((end=buffer.indexOf('\n'))>=0){const raw=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!raw.trim())continue;let e;try{e=JSON.parse(raw);}catch{continue;}
 if(e.type==='extension_ui_response'){answer(e.id,e);continue;}
 if(e.type==='get_state')reply(e,{model,thinkingLevel:'off',isStreaming:false,pendingMessageCount:0,autoCompactionEnabled:true});
 else if(e.type==='get_messages')reply(e,{messages:[]});
 else if(e.type==='get_available_models')reply(e,{models:[model]});
 else if(e.type==='get_commands')reply(e,{commands:[]});
 else if(e.type==='get_session_stats')reply(e,{contextUsage:{tokens:1000,contextWindow:200000,percent:1}});
 else if(e.type==='prompt'){
  if(session)try{const fs=require('node:fs');fs.appendFileSync(session,JSON.stringify({type:'message',message:{role:'user',content:[{type:'text',text:String(e.message||'').slice(0,200)}]}})+'\n');}catch{}
  reply(e,{});
  const text=String(e.message||'');
  if(/escolha/i.test(text))ask(e,{method:'select',title:'Escolha uma opção',message:'Qual você prefere?',label:'Escolha',extra:{options:['Alfa','Beta','Gama'],prefill:'Beta'}});
  else if(/confirmar/i.test(text))ask(e,{method:'confirm',title:'Confirmar',message:'Posso continuar?',label:'Confirmação',extra:{}});
  else if(/pergunta/i.test(text))ask(e,{method:'input',title:'Assunto',message:'Digite o assunto',label:'Assunto',extra:{placeholder:'ex.: limites',prefill:'pré-preenchido'}});
  else emitText('Sem pergunta.');
 }
 else if(e.id)reply(e,{});
}});
