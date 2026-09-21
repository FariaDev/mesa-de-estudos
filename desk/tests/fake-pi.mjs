#!/usr/bin/env node
import fs from 'node:fs';

// Fake do Pi para os smokes. Modos de caos via FAKE_PI_CHAOS (combináveis por vírgula;
// cada modo dispara UMA vez por sessão, mesmo depois de o fake renascer):
// - stream-abort: no primeiro prompt, emite o começo do stream e encerra o processo (Pi morto);
// - desk-error:   no primeiro prompt, emite desk_error no meio do stream;
// - rpc-timeout:  atrasa UMA resposta de get_state além do timeout do ping de saúde; o atraso
//                 pode ser encurtado por FAKE_PI_TIMEOUT_MS (default 30000, mínimo 21000 para
//                 continuar acima do timeout real de 20s do pi-health);
// - stall:        responde o prompt, reporta streaming por 65s e depois fica mudo (nenhum
//                 agent_end); o watchdog destrava por volta de 105s — modo do test:watchdog.
const CHAOS=String(process.env.FAKE_PI_CHAOS||'').split(',').map(v=>v.trim()).filter(Boolean);
const TIMEOUT_DELAY=Math.max(21000,Number(process.env.FAKE_PI_TIMEOUT_MS)||30000);
if(CHAOS.includes('rpc-timeout'))console.error(`[fake-pi] rpc-timeout delay: ${TIMEOUT_DELAY}ms`);
const bootAt=Date.now();

const args=process.argv.slice(2);const session=args[args.indexOf('--session')+1];
const chaosMark=session?`${session}-chaos-feitos.json`:'';
function readChaos(){try{return JSON.parse(fs.readFileSync(chaosMark,'utf8'));}catch{return {};}}
function chaosWas(key){return !!readChaos()[key];}
function chaosArmed(key){
 if(!CHAOS.includes(key))return false;
 const done=readChaos();
 if(done[key])return false;
 done[key]=true;
 try{fs.writeFileSync(chaosMark,JSON.stringify(done));}catch{}
 return true;
}
let stallUntil=0,timeoutPending=false;

const model={provider:'test',id:'offline',name:'Pi de teste',input:['text','image']};
function reply(e,data){process.stdout.write(JSON.stringify({type:'response',id:e.id,success:true,data})+'\n');}
function emit(event){process.stdout.write(JSON.stringify(event)+'\n');}
function emitText(text){
 emit({type:'message_start',message:{role:'assistant'}});
 emit({type:'message_update',assistantMessageEvent:{type:'text_delta',delta:text}});
 emit({type:'message_end',message:{role:'assistant',content:[{type:'text',text}]}});
 emit({type:'agent_end'});
}

function messages(){
 if(!session||!fs.existsSync(session))return [];
 return fs.readFileSync(session,'utf8').split('\n').filter(Boolean).flatMap(line=>{try{return [JSON.parse(line).message].filter(Boolean);}catch{return [];}});
}
function emitWorklog(){
 emit({type:'message_start',message:{role:'assistant'}});
 emit({type:'message_update',assistantMessageEvent:{type:'thinking_delta',delta:'Vou considerar '}});
 emit({type:'message_update',assistantMessageEvent:{type:'thinking_delta',delta:'a pergunta com calma.'}});
 const thought=[{type:'thinking',thinking:'Vou considerar a pergunta com calma.'},{type:'toolCall',id:'search-pensar',name:'web_search',arguments:{query:'kojima xbox'}}];
 emit({type:'message_end',message:{role:'assistant',content:thought}});
 emit({type:'tool_execution_start',toolCallId:'search-pensar',toolName:'web_search',args:{query:'kojima xbox'}});
 const result={content:[{type:'text',text:'1. [OD](https://example.com/od)'}],details:{query:'kojima xbox',results:[{title:'OD',url:'https://example.com/od'}]}};
 emit({type:'tool_execution_end',toolCallId:'search-pensar',toolName:'web_search',result,isError:false});
 const text='É o OD.';
 emit({type:'message_start',message:{role:'assistant'}});
 emit({type:'message_update',assistantMessageEvent:{type:'text_delta',delta:text}});
 emit({type:'message_end',message:{role:'assistant',content:[{type:'text',text}]}});
 emit({type:'agent_end'});
 if(session){
  const now=Date.now();
  const lines=[
   {type:'message',message:{role:'assistant',content:thought,timestamp:now}},
   {type:'message',message:{role:'toolResult',toolCallId:'search-pensar',toolName:'web_search',isError:false,content:result.content,details:result.details,timestamp:now}},
   {type:'message',message:{role:'assistant',content:[{type:'text',text}],timestamp:now}},
  ];
  fs.appendFileSync(session,lines.map(line=>JSON.stringify(line)).join('\n')+'\n');
 }
}
let pendingQuiz=null;let autoCompaction=true;
function quizSpec(text){
 if(/quiz multi/i.test(text))return {multi:true,question:'Quais afirmações são verdadeiras para \\(x^2\\)?',options:[{label:'A soma dá \\(2\\)',value:'sum'},{label:'O produto dá \\(1\\)',value:'product'},{label:'A derivada é \\(0\\)',value:'derivative'}],correct:['sum','product'],explanation:'Soma e produto conferem para \\(x^2 \\ge 0\\).'};
 return {multi:false,question:'Quanto vale \\(2+2\\)?',options:[{label:'\\(3\\)',value:'three'},{label:'\\(4\\)',value:'four'},{label:'\\(5\\)',value:'five'}],correct:'four',explanation:'Pela definição: \\(2+2=4\\).'};
}
function emitQuiz(text){
 const spec=quizSpec(text),toolCallId='call_quiz_'+Date.now();
 const options=spec.options.map((option,index)=>({...option,index:index+1}));
 const toolArgs={question:spec.question,details:'Pergunta de teste',options:spec.options,multiSelect:spec.multi,correctAnswer:spec.correct,explanation:spec.explanation};
 emit({type:'tool_execution_start',toolCallId,toolName:'quiz',args:toolArgs});
 emit({type:'tool_execution_update',toolCallId,toolName:'quiz',args:toolArgs,partialResult:{content:[{type:'text',text:'Awaiting user response...'}],details:{options:options.map(option=>({index:option.index,label:option.label}))}}});
 emit({type:'extension_ui_request',id:'ui-'+toolCallId,method:'select',title:`${spec.multi?'Quiz (múltipla escolha)':'Quiz'} · ${spec.question}`,options:[...spec.options.map(option=>option.label),'Não sei']});
 pendingQuiz={toolCallId,uiId:'ui-'+toolCallId,spec,options};
}
function gradeQuiz(response){
 const {toolCallId,spec,options}=pendingQuiz;pendingQuiz=null;
 const byLabel=new Map(options.map(option=>[option.label,option]));
 const raw=response.cancelled?'':String(response.value??'');
 let labels=[];
 if(!response.cancelled){
  if(spec.multi&&raw.trim().startsWith('[')){try{labels=JSON.parse(raw).map(String);}catch{labels=[];}}
  else labels=[raw];
 }
 labels=labels.filter(label=>byLabel.has(label));
 const dontKnow=!response.cancelled&&(raw==='Não sei'||(spec.multi&&labels.length>0&&labels.every(label=>label==='Não sei')));
 const realLabels=dontKnow?[]:labels.filter(label=>label!=='Não sei');
 const answers=realLabels.map(label=>{const option=byLabel.get(label);return {label:option.label,value:option.value,index:option.index};}).sort((a,b)=>a.index-b.index);
 const correctLabels=Array.isArray(spec.correct)?spec.correct:[spec.correct];
 const correctIndices=options.filter(option=>correctLabels.includes(option.value)).map(option=>option.index);
 const selected=answers.map(answer=>answer.index);
 const correct=!dontKnow&&selected.length===correctIndices.length&&selected.every((value,index)=>value===correctIndices[index]);
 const details={status:response.cancelled?'cancelled':'answered',question:spec.question,mode:spec.multi?'multi-select':'single-select',answers,dontKnow,correct,correctIndices,options:options.map(option=>({index:option.index,label:option.label})),explanation:spec.explanation};
 emit({type:'tool_execution_end',toolCallId,toolName:'quiz',result:{content:[{type:'text',text:'User answered the test quiz.'}],details},isError:false});
 emitText(details.correct?'Boa! Resposta correta.':(details.dontKnow?'Sem problema; vamos revisar esse ponto.':'Quase: reveja a resolução com calma.'));
}
function abortMidStream(){
 emit({type:'message_start',message:{role:'assistant'}});
 emit({type:'message_update',assistantMessageEvent:{type:'text_delta',delta:'A resposta começou e vai'}});
 emit({type:'message_update',assistantMessageEvent:{type:'text_delta',delta:'cair no meio.'}});
 setTimeout(()=>process.exit(9),150);
}
function deskErrorMidStream(){
 emit({type:'message_start',message:{role:'assistant'}});
 emit({type:'message_update',assistantMessageEvent:{type:'text_delta',delta:'Começou a responder…'}});
 setTimeout(()=>emit({type:'desk_error',message:'Falha de teste no meio da resposta.'}),250);
}
function stallMidStream(){
 stallUntil=Date.now()+65000;
 emit({type:'message_start',message:{role:'assistant'}});
 emit({type:'message_update',assistantMessageEvent:{type:'text_delta',delta:'Vou travar agora…'}});
}
process.stdin.setEncoding('utf8');let buffer='';
process.stdin.on('data',chunk=>{buffer+=chunk;let end;while((end=buffer.indexOf('\n'))>=0){const raw=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!raw.trim())continue;const e=JSON.parse(raw);
 if(e.type==='extension_ui_response'){if(pendingQuiz&&e.id===pendingQuiz.uiId)gradeQuiz(e);continue;}
 if(e.type==='get_commands')reply(e,{commands:[{name:'help',description:'Mostrar os comandos',argumentHint:'[assunto]'}]});
 else if(e.type==='get_state'){
  const late=(CHAOS.includes('rpc-timeout')&&!chaosWas('rpc-timeout')&&Date.now()-bootAt>10000)||timeoutPending;
  if(late){
   timeoutPending=true;
   setTimeout(()=>{timeoutPending=false;reply(e,{model,thinkingLevel:'off',isStreaming:stallUntil>Date.now(),pendingMessageCount:0,autoCompactionEnabled:autoCompaction});},TIMEOUT_DELAY);
   return;
  }
  reply(e,{model,thinkingLevel:'off',isStreaming:stallUntil>Date.now(),pendingMessageCount:0,autoCompactionEnabled:autoCompaction});
 }
 else if(e.type==='set_auto_compaction'){autoCompaction=!!e.enabled;reply(e,{});}
 else if(e.type==='get_session_stats'){const n=messages().length;const tokens=12000+n*5000;reply(e,{contextUsage:{tokens,contextWindow:200000,percent:Math.min(99,tokens/1000)}});}
 else if(e.type==='get_messages')reply(e,{messages:messages()});
 else if(e.type==='get_available_models')reply(e,{models:[model]});
 else if(e.type==='compact')reply(e,{summary:'Resumo da conversa de teste.',firstKeptEntryId:'x',tokensBefore:12000+messages().length*180});
 else if(e.type==='prompt'){
  const content=[{type:'text',text:e.message}];
  if(Array.isArray(e.images))content.push(...e.images);
  fs.appendFileSync(session,JSON.stringify({type:'message',message:{role:'user',content}})+'\n');reply(e,{});
  if(chaosArmed('stream-abort'))abortMidStream();
  else if(chaosArmed('desk-error'))deskErrorMidStream();
  else if(chaosArmed('stall'))stallMidStream();
  else if(/quiz/i.test(e.message))emitQuiz(e.message);
  else if(/pensar profundo/i.test(e.message))emitWorklog();
  else if(/teorema/i.test(e.message))emitText('A identidade de Pitágoras: $a^2 + b^2 = c^2$ vale em triângulos retângulos.\n\n$$E = mc^2$$');
}
 else if(e.id)reply(e,{});
}});
