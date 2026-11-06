#!/usr/bin/env node
import fs from 'node:fs';
import {zenModelsFor,launchModelFrom,recordLaunch} from './fake-pi-opencode.mjs';
import {bigCatalog} from './fake-pi-catalog.mjs';

// Fake do Pi para os smokes. Modos de caos via FAKE_OPENCODE_CHAOS (combináveis por vírgula;
// cada modo dispara UMA vez por sessão, mesmo depois de o fake renascer):
// - stream-abort: no primeiro prompt, emite o começo do stream e encerra o processo (Pi morto);
// - desk-error:   no primeiro prompt, emite desk_error no meio do stream;
// - rpc-timeout:  atrasa UMA resposta de get_state além do timeout do ping de saúde; o atraso
//                 pode ser encurtado por FAKE_PI_TIMEOUT_MS (default 30000, mínimo 21000 para
//                 continuar acima do timeout real de 20s do pi-health);
// - state-fail:   aceita o prompt e recusa UMA leitura de get_state logo depois (a leitura que
//                 o main faz após o aceite): a entrega está feita e a falha é só do estado;
// - stall:        responde o prompt, reporta streaming por 65s e depois fica mudo (nenhum
//                 agent_end); o watchdog destrava por volta de 105s — modo do test:watchdog.
const CHAOS=String(process.env.FAKE_OPENCODE_CHAOS||'').split(',').map(v=>v.trim()).filter(Boolean);
const TIMEOUT_DELAY=Math.max(21000,Number(process.env.FAKE_PI_TIMEOUT_MS)||30000);
if(CHAOS.includes('rpc-timeout'))console.error(`[fake-pi] rpc-timeout delay: ${TIMEOUT_DELAY}ms`);
const bootAt=Date.now();

const args=process.argv.slice(2);const session=args[args.indexOf('--session')+1];
/* O que o Pi recebeu em `--append-system-prompt`, lido do arquivo no momento da
   subida: prova o prompt ENVIADO, não só o que o main escreveu (#41). */
const PROMPT_LOG=process.env.FAKE_OPENCODE_PROMPT_LOG||'';
if(PROMPT_LOG){
 const promptFile=args[args.indexOf('--append-system-prompt')+1];
 try{fs.writeFileSync(PROMPT_LOG,fs.readFileSync(promptFile,'utf8'));}catch(error){fs.writeFileSync(PROMPT_LOG,`ERRO ${error.message}`);}
}
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
/* `state-fail`: armado quando um prompt é ACEITO; a próxima leitura de estado
   (a que o main faz logo depois do aceite) é recusada uma vez. */
let stateFailArmed=false;

/* Modo fila/steer (FAKE_OPENCODE_QUEUE_LOG, usado pelo hunt-queue): grava cada prompt
   com o `streamingBehavior` recebido, segura o turno aberto por
   FAKE_OPENCODE_QUEUE_HOLD_MS (default 1200) e responde `eco: <texto>`; um prompt com
   `steer` derruba o turno em curso (agent_end) e responde na hora, e `abort`
   encerra o turno segurado — como o Pi real. Um prompt com `«cai»` mata o
   processo com o pedido em voo (a Mesa precisa recusar o envio sem perder a
   fila). Fora desse modo nada muda. */
const QUEUE_LOG=process.env.FAKE_OPENCODE_QUEUE_LOG||'';
const RPC_LOG=process.env.FAKE_PI_RPC_LOG||'';
const QUEUE_HOLD=Number(process.env.FAKE_OPENCODE_QUEUE_HOLD_MS)||1200;
let streaming=false,holdTimer=0;
function queueRecord(e){
 if(!QUEUE_LOG)return;
 /* `images` entra na conta para o hunt-queue provar que o anexo do item
    guardado chegou ao Pi depois de fechar/reabrir o app. */
 try{fs.appendFileSync(QUEUE_LOG,JSON.stringify({message:e.message,streamingBehavior:e.streamingBehavior||'',inFlight:!!holdTimer||streaming,images:Array.isArray(e.images)?e.images.length:0})+'\n');}catch{}
}
function queuePrompt(e){
 const text=String(e.message||'');
 const steer=e.streamingBehavior==='steer';
 queueRecord(e);
 if(session&&text)fs.appendFileSync(session,JSON.stringify({type:'message',message:{role:'user',content:[{type:'text',text}]}})+'\n');
 if(steer&&holdTimer){clearTimeout(holdTimer);holdTimer=0;}
 if(steer&&streaming){streaming=false;emit({type:'agent_end',willRetry:true});}
 reply(e,{});
 stateFailArmed=chaosArmed('state-fail');
 if(text.includes('«cai»')){setTimeout(()=>process.exit(7),120);return;}
 /* `streaming` ligado já na resposta: o `get_state` que o main pede logo depois
    do prompt é o que decide se a Mesa segue ocupada. */
 streaming=true;

 if(process.env.FAKE_PI_SETTLED_GAP&&text.includes('settle-test')){
  emit({type:'agent_start'});
  holdTimer=setTimeout(()=>{
   streaming=false;
   process.stdout.write(JSON.stringify({type:'agent_end',willRetry:false})+'\n');
   emit({type:'auto_retry_start',attempt:1,maxAttempts:3,delayMs:2200});
   holdTimer=setTimeout(()=>{holdTimer=0;emit({type:'agent_start'});emitText('Resposta após continuação.');},2200);
  },500);
  return;
 }
 const body=`eco: ${text.split('\n')[0]}`;
 holdTimer=setTimeout(()=>{
  holdTimer=0;streaming=false;
  emit({type:'agent_start'});
  emitText(body);
 },steer?80:QUEUE_HOLD);
}

/* FAKE_PI_TEXT_ONLY=1: modelo sem imagem (o aviso de anexo); FAKE_OPENCODE_SECOND_MODEL=1:
   segundo modelo no catálogo, para trocar de modelo pelo indicador. O esforço
   escolhido (`set_thinking_level`) e o modelo (`set_model`) ficam guardados e
   voltam em `get_state`. */
/* FAKE_PI_REASONING=1: os modelos anunciam raciocínio e a Mesa oferece os níveis de esforço
   (sem isso o Pi real só devolve 'off' e o seletor fica com uma opção). */
const REASONING=process.env.FAKE_PI_REASONING==='1';
const MODELS=[{provider:'test',id:'offline',name:'Pi de teste',input:process.env.FAKE_PI_TEXT_ONLY==='1'?['text']:['text','image'],...(REASONING?{reasoning:true}:{})}];
if(process.env.FAKE_OPENCODE_SECOND_MODEL==='1')MODELS.push({provider:'test',id:'offline-vision',name:'Pi com visão',input:['text','image'],...(REASONING?{reasoning:true}:{})});
/* FAKE_OPENCODE_MANY_MODELS=1 (#59): catálogo de vários provedores, para o seletor agrupar, filtrar e guardar recentes.
   Com um número maior que 1 (ajustes do seletor), o catálogo chega a esse total com modelos do OpenRouter
   no formato real ("Fabricante: Modelo", `:free`), como o Pi do usuário com ~450 modelos. */
const MANY=Number(process.env.FAKE_OPENCODE_MANY_MODELS||0);
if(MANY>=1)MODELS.push(...[['xai','grok-4','Grok 4'],['xai','grok-4-fast','Grok 4 Fast'],['anthropic','sonnet-5','Sonnet 5'],['openai','gpt-5.5','GPT 5.5'],['meu-provedor','caseiro','Modelo caseiro']].map(([provider,id,name])=>({provider,id,name,input:['text','image'],...(REASONING?{reasoning:true}:{})})));
if(MANY>1)MODELS.push(...bigCatalog(Math.max(0,MANY-MODELS.length),{reasoning:REASONING}));
/* FAKE_PI_OPENCODE=1 (#44): provedor `opencode` com a chave no ambiente, como o Pi real. FAKE_PI_OPENCODE_LOG grava, sem a chave, que ela chegou. */
MODELS.push(...zenModelsFor(process.env));
recordLaunch(process.env.FAKE_PI_OPENCODE_LOG,process.env,args);
let model=launchModelFrom(args,MODELS)||MODELS[0];let thinking='off';
function reply(e,data){process.stdout.write(JSON.stringify({type:'response',id:e.id,success:true,data})+'\n');}
function refuse(e,error){process.stdout.write(JSON.stringify({type:'response',id:e.id,success:false,error})+'\n');}
function emit(event){process.stdout.write(JSON.stringify(event)+'\n');if(event.type==='agent_end'&&!event.willRetry)process.stdout.write(JSON.stringify({type:'agent_settled'})+'\n');}
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
/* Turno longo do item 15: pensamento recolhido + ferramenta + texto que passa
   da vista, com uma imagem opcional que termina de carregar depois do texto. */
function emitLongTurn(){
 const image=process.env.FAKE_OPENCODE_LONG_IMAGE?`\n\n![Figura de teste](${process.env.FAKE_OPENCODE_LONG_IMAGE})`:'';
 const body=Array.from({length:60},(_,i)=>`Parágrafo ${i+1}: a resposta longa continua para provar que a conversa acompanha o fim do turno.`).join('\n\n')+image;
 const thought='Vou montar uma resposta longa com uma ferramenta no meio.';
 emit({type:'message_start',message:{role:'assistant'}});
 emit({type:'message_update',assistantMessageEvent:{type:'thinking_start'}});
 emit({type:'message_update',assistantMessageEvent:{type:'thinking_delta',delta:thought}});
 emit({type:'message_update',assistantMessageEvent:{type:'thinking_end',content:thought}});
 emit({type:'message_end',message:{role:'assistant',content:[{type:'thinking',thinking:thought}]}});
 emit({type:'tool_execution_start',toolCallId:'long-tool',toolName:'web_search',args:{query:'resposta longa'}});
 emit({type:'tool_execution_end',toolCallId:'long-tool',toolName:'web_search',result:{content:[{type:'text',text:'resultado de teste'}]},isError:false});
 setTimeout(()=>emitText(body),Number(process.env.FAKE_OPENCODE_LONG_HOLD_MS)||0);
}

/* Stream token a token (Markdown e KaTeX), para medir o custo de repintar a
   resposta a cada delta. `FAKE_PI_STREAM_DELTAS` e `FAKE_PI_STREAM_DELTA_MS`
   controlam o tamanho e o ritmo; o texto cresce como numa resposta de verdade. */
function emitStreamTurn(){
 const paragraphs=Array.from({length:12},(_,i)=>[
  `## Passo ${i+1}`,
  `A ideia central é aplicar $f(x)=x^{${i+1}}+${i}$ e conferir o sinal.`,
  `- derive termo a termo\n- simplifique antes de substituir\n- confira a unidade no fim`,
  `$$\\int_0^1 x^{${i+1}}\\,dx=\\frac{1}{${i+2}}$$`,
  `Um trecho de código para fixar:\n\n\`\`\`js\nconst derivada = (x) => ${i+1} * x ** ${i};\n\`\`\``,
 ].join('\n\n'));
 const full=paragraphs.join('\n\n')+'\n\nFim da resposta longa do tutor.';
 const chunks=Math.max(1,Number(process.env.FAKE_PI_STREAM_DELTAS)||240);
 const step=Math.max(1,Math.ceil(full.length/chunks));
 const delay=Math.max(0,Number(process.env.FAKE_PI_STREAM_DELTA_MS)||25);
 streaming=true;
 emit({type:'agent_start'});
 emit({type:'message_start',message:{role:'assistant'}});
 let at=0;
 const timer=setInterval(()=>{
  if(at>=full.length){
   clearInterval(timer);
   streaming=false;
   emit({type:'message_end',message:{role:'assistant',content:[{type:'text',text:full}]}});
   emit({type:'agent_end'});
   return;
  }
  emit({type:'message_update',assistantMessageEvent:{type:'text_delta',delta:full.slice(at,at+step)}});
  at+=step;
 },delay);
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
let autoCompaction=true;
/* Só o texto do aluno decide a resposta do fake: o `pi-prompt` real acrescenta, depois dele,
   o bloco de menções e o `[Contexto da Mesa]`, que carregam caminhos (pastas como
   `quizzical-…` na worktree) e não são fala do aluno. */
const CONTEXT_MARKERS=['\n\n[Contexto da Mesa]','\n\n[Desk context]','\n\n[Ferramenta pedida na Mesa'];
function studentText(message){
 let text=String(message??'');
 /* O chat lateral põe o contexto ANTES da fala (`sidechat.cjs` CONTEXT_START/CONTEXT_END). */
 const sideEnd='\n[Fim do contexto do chat lateral]\n\n';
 if(text.startsWith('[Contexto do chat lateral]')&&text.includes(sideEnd))text=text.slice(text.indexOf(sideEnd)+sideEnd.length);
 const cuts=CONTEXT_MARKERS.map(marker=>text.indexOf(marker)).filter(at=>at>=0);
 return cuts.length?text.slice(0,Math.min(...cuts)):text;
}
function quizSpec(text){
 if(/quiz multi/i.test(text))return {multi:true,question:'Quais afirmações são verdadeiras para \\(x^2\\)?',options:[{label:'A soma dá \\(2\\)',value:'sum'},{label:'O produto dá \\(1\\)',value:'product'},{label:'A derivada é \\(0\\)',value:'derivative'}],correct:['sum','product'],explanation:'Soma e produto conferem para \\(x^2 \\ge 0\\).'};
 return {multi:false,question:'Quanto vale \\(2+2\\)?',options:[{label:'\\(3\\)',value:'three'},{label:'\\(4\\)',value:'four'},{label:'\\(5\\)',value:'five'}],correct:'four',explanation:'Pela definição: \\(2+2=4\\).'};
}
async function emitQuiz(text){
 const spec=quizSpec(text),toolCallId='call_quiz_'+Date.now();
 const toolArgs={question:spec.question,details:'Pergunta de teste',options:spec.options,multiSelect:spec.multi,correctAnswer:spec.correct,explanation:spec.explanation};
 /* O caminho Claude/OpenCode declara a ferramenta em `toolcall_end` antes de
    executá-la; o fake reproduz a ordem com este interruptor. */
 if(process.env.FAKE_PI_QUIZ_TOOLCALL==='1'){
  emit({type:'message_start',message:{role:'assistant'}});
  emit({type:'message_update',assistantMessageEvent:{type:'toolcall_end',contentIndex:1,toolCall:{id:toolCallId,name:'mesa_quiz',arguments:toolArgs}}});
 }
 emit({type:'tool_execution_start',toolCallId,toolName:'mesa_quiz',args:toolArgs});
 let bridge=null;
 try{bridge=JSON.parse(process.env.LEARNING_DESK_CARD_BRIDGE||'');}catch{/* sem ponte: o cartão não aparece */}
 if(!bridge||typeof bridge.url!=='string'||typeof bridge.token!=='string'){
  emit({type:'tool_execution_end',toolCallId,toolName:'mesa_quiz',result:{content:[{type:'text',text:'sem ponte de cartão'}]},isError:true});
  emitText('Não consegui mostrar o cartão.');
  return;
 }
 try{
  const response=await fetch(String(bridge.url).replace(/\/activity$/,'/card'),{method:'POST',headers:{'content-type':'application/json','x-mesa-token':bridge.token},body:JSON.stringify({kind:'quiz',args:toolArgs})});
  if(!response.ok)throw Error(`HTTP ${response.status}`);
 }catch(error){
  emit({type:'tool_execution_end',toolCallId,toolName:'mesa_quiz',result:{content:[{type:'text',text:String(error.message||error)}]},isError:true});
  emitText(`Não consegui mostrar o cartão: ${error.message||error}`);
  return;
 }
 emit({type:'tool_execution_end',toolCallId,toolName:'mesa_quiz',result:{content:[{type:'text',text:'Mostrado ao aluno.'}]},isError:false});
 emitText('Deixei o cartão; responda por lá.');
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
/* Turno que o provedor recusa (modelo, chave, limite): o Pi real fecha a mensagem
   do assistente sem texto e com `errorMessage` (v1.0.2: o lateral ficava mudo). */
function providerErrorTurn(){
 emit({type:'message_start',message:{role:'assistant'}});
 emit({type:'message_end',message:{role:'assistant',content:[],stopReason:'error',errorMessage:'Erro de teste do provedor.'}});
 emit({type:'agent_end'});
}
function stallMidStream(){
 stallUntil=Date.now()+65000;
 emit({type:'message_start',message:{role:'assistant'}});
 emit({type:'message_update',assistantMessageEvent:{type:'text_delta',delta:'Vou travar agora…'}});
}
process.stdin.setEncoding('utf8');let buffer='';
process.stdin.on('data',chunk=>{buffer+=chunk;let end;while((end=buffer.indexOf('\n'))>=0){const raw=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!raw.trim())continue;const e=JSON.parse(raw);
 if(RPC_LOG){try{fs.appendFileSync(RPC_LOG,`${e.type}\n`);}catch{}}
 if(e.type==='get_commands')reply(e,{commands:[{name:'help',description:'Mostrar os comandos',argumentHint:'[assunto]'}]});
 else if(e.type==='get_state'){
  const failFile=process.env.FAKE_PI_STATE_FAILURE_FILE;
  if(failFile&&fs.existsSync(failFile)){fs.rmSync(failFile);refuse(e,'Estado indisponível (teste)');return;}
  if(stateFailArmed){
   stateFailArmed=false;
   refuse(e,'estado da sessão indisponível (teste)');
   return;
  }
  const late=(CHAOS.includes('rpc-timeout')&&!chaosWas('rpc-timeout')&&Date.now()-bootAt>10000)||timeoutPending;
  if(late){
   timeoutPending=true;
   setTimeout(()=>{timeoutPending=false;reply(e,{model,thinkingLevel:thinking,isStreaming:stallUntil>Date.now(),pendingMessageCount:0,autoCompactionEnabled:autoCompaction});},TIMEOUT_DELAY);
   return;
  }
  reply(e,{model,thinkingLevel:thinking,isStreaming:streaming||stallUntil>Date.now(),pendingMessageCount:0,autoCompactionEnabled:autoCompaction});
 }
 else if(e.type==='set_auto_compaction'){autoCompaction=!!e.enabled;reply(e,{});}
 else if(e.type==='get_session_stats'){const n=messages().length;const tokens=12000+n*5000;reply(e,{contextUsage:{tokens,contextWindow:200000,percent:Math.min(99,tokens/1000)}});}
 else if(e.type==='get_messages')reply(e,{messages:messages()});
 else if(e.type==='get_available_models')reply(e,{models:MODELS});
 else if(e.type==='set_model'){model=MODELS.find(m=>m.provider===e.provider&&m.id===e.modelId)||model;reply(e,{});}
 else if(e.type==='set_thinking_level'){thinking=String(e.level||'off');reply(e,{});}
 else if(e.type==='compact')reply(e,{summary:'Resumo da conversa de teste.',firstKeptEntryId:'x',tokensBefore:12000+messages().length*180});
 else if(QUEUE_LOG&&e.type==='abort'){
  reply(e,{});
  if(holdTimer){clearTimeout(holdTimer);holdTimer=0;}
  if(streaming){streaming=false;setTimeout(()=>emit({type:'agent_end'}),80);}
 }
 else if(e.type==='prompt'){
  if(process.env.FAKE_PI_REVIEW_DRAFT&&args.includes('--no-tools')){reply(e,{});setTimeout(()=>emitText(process.env.FAKE_PI_REVIEW_DRAFT),Number(process.env.FAKE_PI_REVIEW_DELAY)||0);return;}
  if(process.env.FAKE_OPENCODE_REFUSAL_LOG&&String(e.message).startsWith('falhar')){fs.appendFileSync(process.env.FAKE_OPENCODE_REFUSAL_LOG,JSON.stringify({at:Date.now(),message:e.message})+'\n');emit({type:'response',id:e.id,success:false,error:'Recusa de teste antes do aceite'});return;}
  if(QUEUE_LOG){queuePrompt(e);return;}
  const content=[{type:'text',text:e.message}];
  if(Array.isArray(e.images))content.push(...e.images);
  fs.appendFileSync(session,JSON.stringify({type:'message',message:{role:'user',content}})+'\n');reply(e,{});
  stateFailArmed=chaosArmed('state-fail');
  if(chaosArmed('stream-abort'))abortMidStream();
  else if(chaosArmed('desk-error'))deskErrorMidStream();
  else if(chaosArmed('stall'))stallMidStream();
  else if(/falha do provedor/i.test(studentText(e.message)))providerErrorTurn();
  else if(/^\[Resultado do cartão:/.test(studentText(e.message)))emitText('Recebi o resultado do cartão.');
  else if(/quiz/i.test(studentText(e.message)))void emitQuiz(e.message);
  else if(/stream longo/i.test(studentText(e.message)))emitStreamTurn();
  else if(/resposta longa/i.test(studentText(e.message)))emitLongTurn();
  else if(/pensar profundo/i.test(studentText(e.message)))emitWorklog();
  else if(/teorema/i.test(studentText(e.message)))emitText('A identidade de Pitágoras: $a^2 + b^2 = c^2$ vale em triângulos retângulos.\n\n$$E = mc^2$$');
}
 else if(e.id)reply(e,{});
}});
