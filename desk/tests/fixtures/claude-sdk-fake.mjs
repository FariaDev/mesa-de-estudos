/* Fixture do Claude Agent SDK — só para os testes da Mesa (DESK_TEST=1).
 *
 * Substitui `@anthropic-ai/claude-agent-sdk` quando o host recebe
 * `LEARNING_DESK_CLAUDE_SDK_FACTORY=<este arquivo>` em modo de teste. NÃO fala
 * com a nuvem, NÃO autentica e NÃO executa o binário do Claude: a "inferência"
 * é um roteiro local e a persistência é um JSON em pasta temporária. Nunca é
 * injetada na produção — o host só a importa com DESK_TEST=1 e só aceita um
 * caminho dentro de `desk/tests/fixtures/`.
 *
 * Interface consumida pelo adaptador (`desk/src/agents/claude-adapter.cjs`):
 *
 *   import {query, getSessionMessages} from '<fixture>';
 *   const q = query({prompt, options});
 *   for await (const message of q) { ... }   // system/init, user replay,
 *                                            // stream_event, assistant, result
 *   await q.initializationResult();
 *   await q.supportedModels();
 *   await q.getSessionMessages();            // histórico da sessão corrente
 *   await q.interrupt();
 *   q.close();
 *   await getSessionMessages(sessionId, {dir}); // histórico de qualquer sessão
 *
 * `prompt` aceita string OU iterável/async-iterável de blocos do SDK
 * (`{type:'user',message:{role:'user',content:[...]}}`, com blocos `text` e
 * `image`). Para cada item consumido a fixture emite o eco oficial
 * `{type:'user',isReplay:true,uuid:<uuid do item>}` — é a evidência de aceite
 * que o adaptador correlaciona (flag pública `replay-user-messages`). O último
 * texto do usuário escolhe o roteiro por marcador:
 *
 *   [claude:image]             responde citando quantas imagens recebeu
 *   [claude:permission-allow]  chama options.canUseTool('Read',...) e segue
 *   [claude:permission-deny]   idem, negado
 *   [claude:stall]             fica "pensando" até interrupt()/close()
 *   [claude:error]             termina com result de erro
 *   [claude:multi]             deltas fragmentados (texto quebrado em pedaços)
 *
 * Variáveis de ambiente úteis ao host de teste:
 *   FAKE_CLAUDE_LOG       arquivo append (1 JSON por prompt recebido)
 *   FAKE_CLAUDE_STORE     pasta da sessão artificial (default: <cwd>/.claude-fake-sessions)
 *   FAKE_CLAUDE_SCENARIO  roteiro default quando o texto não tem marcador
 *   FAKE_CLAUDE_DELAY_MS  pausa entre deltas (default 8)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';

const SDK_VERSION='2.1.246';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,Math.max(0,Number(ms)||0)));
const uuid=()=>crypto.randomUUID();

/* O adaptador lê o histórico com `getSessionMessages(sessionId,{dir:cwd})`;
   escrever e ler têm de apontar para a MESMA pasta. A ordem: FAKE_CLAUDE_STORE
   (teste), `dir`/`cwd` (o workspace da conversa) e, por fim, a pasta temporária. */
function storeDir(options={}){
 const env={...process.env,...(options.env||{})};
 if(env.FAKE_CLAUDE_STORE)return env.FAKE_CLAUDE_STORE;
 const base=options.dir||options.cwd||env.CLAUDE_CONFIG_DIR;
 return base?path.join(base,'.claude-fake-sessions'):path.join(os.tmpdir(),'mesa-claude-fake');
}

function storeFile(dir,sessionId){return path.join(dir,`session-${sessionId}.json`);}

function readStore(dir,sessionId){
 try{
  const data=JSON.parse(fs.readFileSync(storeFile(dir,sessionId),'utf8'));
  return Array.isArray(data?.messages)?data.messages:[];
 }catch{return [];}
}

function appendStore(dir,sessionId,messages){
 try{
  fs.mkdirSync(dir,{recursive:true});
  const current=readStore(dir,sessionId);
  fs.writeFileSync(storeFile(dir,sessionId),JSON.stringify({sessionId,messages:[...current,...messages]},null,0));
 }catch{}
}

/* Exportado pelo SDK real (histórico de uma sessão). A fixture guarda as
   mensagens cruas que emitiu; o adaptador as normaliza para exibição. A leitura
   usa `storeDir(options)` — MESMA pasta da escrita (FAKE_CLAUDE_STORE do teste
   vence o `dir`/cwd do workspace) — e honra `offset`/`limit` como o SDK. */
export async function getSessionMessages(sessionId,options={}){
 const dir=storeDir(options);
 const all=readStore(dir,String(sessionId||''));
 const offset=Number.isFinite(options.offset)&&options.offset>0?Math.floor(options.offset):0;
 const limit=Number.isFinite(options.limit)&&options.limit>0?Math.floor(options.limit):all.length;
 const rows=all.slice(offset,offset+limit);
 trace('history',{sessionId:String(sessionId||''),dir,offset,limit,count:rows.length,total:all.length});
 return rows;
}

function logPrompt(entry){
 const file=process.env.FAKE_CLAUDE_LOG;
 if(!file)return;
 try{fs.appendFileSync(file,JSON.stringify({at:Date.now(),...entry})+'\n');}catch{}
}

function trace(event,data={}){
 const file=process.env.FAKE_CLAUDE_TRACE;
 if(!file)return;
 try{fs.appendFileSync(file,JSON.stringify({at:Date.now(),event,...data})+'\n');}catch{}
}

function takeBlock(payload,block){
 if(!block||typeof block!=='object')return;
 if(block.type==='text'&&typeof block.text==='string')payload.text.push(block.text);
 else if(block.type==='image')payload.images.push(block);
 else if(block.type==='tool_result'&&typeof block.content==='string')payload.text.push(block.content);
}

function takeMessage(payload,message){
 if(!message||typeof message!=='object')return;
 if(typeof message.content==='string'){payload.text.push(message.content);return;}
 for(const block of Array.isArray(message.content)?message.content:[])takeBlock(payload,block);
}

/* Normaliza UM item do prompt (mensagem do SDK) num fato simples. */
function normalizeItem(item){
 const payload={text:[],images:[]};
 if(typeof item==='string')payload.text.push(item);
 else if(item?.message)takeMessage(payload,item.message);
 else takeBlock(payload,item);
 payload.text=payload.text.join('\n');
 return payload;
}

function asyncIteratorOf(input){
 if(!input||typeof input!=='object'||typeof input==='string')return null;
 if(typeof input[Symbol.asyncIterator]==='function')return input[Symbol.asyncIterator]();
 if(typeof input[Symbol.iterator]==='function')return input[Symbol.iterator]();
 if(typeof input.next==='function')return input;
 return null;
}

function markerOf(text){
 for(const name of ['image','permission-allow','permission-deny','question','rate-limit','multiple-rate','retry','fallback','context-error','blocking-limit','interrupt-exit','no-echo','stall','error','multi']){
  if(String(text||'').includes(`[claude:${name}]`))return name;
 }
 return '';
}

function modelInfo(){return {value:'claude-fake',resolvedModel:'claude-fake',displayName:'Claude Fake (fixture)',description:'Modelo artificial da fixture',supportsEffort:true,supportedEffortLevels:['low','high','max']};}
function modelCatalog(){return [modelInfo(),{value:'claude-lite',resolvedModel:'claude-lite',displayName:'Claude Lite (fixture)',description:'Modelo sem esforço artificial',supportsEffort:false}];}

function initFrame(sessionId,options){
 return {
  type:'system',subtype:'init',
  apiKeySource:'none',
  claude_code_version:SDK_VERSION,
  cwd:String(options.cwd||process.cwd()),
  tools:[],
  mcp_servers:[],
  model:String(options.model||'claude-fake'),
  permissionMode:String(options.permissionMode||'default'),
  slash_commands:[],
  output_style:'default',
  skills:[],
  plugins:[],
  uuid:uuid(),
  session_id:sessionId
 };
}

function streamFrame(sessionId,event,uuidValue=null){
 return {type:'stream_event',event,parent_tool_use_id:null,uuid:uuidValue||uuid(),session_id:sessionId};
}

function assistantFrame(sessionId,content,{stopReason='end_turn',aborted=false,error,userMessageUuid=null,messageId=null}={}){
 return {
  type:'assistant',
  message:{
   id:messageId||`msg_${uuid()}`,type:'message',role:'assistant',model:'claude-fake',
   content,stop_reason:aborted?null:stopReason,
   usage:{input_tokens:12,output_tokens:24,cache_creation_input_tokens:0,cache_read_input_tokens:0,service_tier:'standard'}
  },
  parent_tool_use_id:null,
  ...(aborted?{aborted:true}:{}),
  ...(error?{error}:{}),
  ...(userMessageUuid?{user_message_uuid:userMessageUuid}:{}),
  uuid:uuid(),
  session_id:sessionId
 };
}

function userFrame(sessionId,content,{synthetic=false,replay=false,uuidValue=null}={}){
 return {
  type:'user',
  message:{role:'user',content},
  parent_tool_use_id:null,
  ...(synthetic?{isSynthetic:true}:{}),
  ...(replay?{isReplay:true}:{}),
  uuid:uuidValue||uuid(),
  session_id:sessionId
 };
}

function resultFrame(sessionId,{text='',subtype='success',isError=false,interrupted=false,userMessageUuid=null}={}){
 const base={
  type:'result',subtype,duration_ms:5,duration_api_ms:3,is_error:isError,num_turns:1,
  stop_reason:isError?null:'end_turn',total_cost_usd:0,
  usage:{input_tokens:12,output_tokens:24,cache_creation_input_tokens:0,cache_read_input_tokens:0,service_tier:'standard'},
  modelUsage:{},
  permission_denials:[],
  ...(interrupted?{interrupted:true}:{}),
  ...(userMessageUuid?{user_message_uuid:userMessageUuid}:{}),
  uuid:uuid(),session_id:sessionId
 };
 if(subtype==='success')base.result=text;
 else base.errors=[text||'erro simulado da fixture'];
 return base;
}

function chunkText(text,mode){
 if(mode==='multi')return text.match(/.{1,4}/gs)||[text];
 return [text];
}

/**
 * Cria uma "query" do SDK falso. Devolve um AsyncGenerator com os métodos de
 * controle do SDK real (initializationResult/supportedModels/getSessionMessages/
 * interrupt/close) — o adaptador consome sem saber que é fixture.
 */
export function query({prompt,options={}}={}){
 const sessionId=String(options.resume||options.sessionId||uuid());
 trace('query',{sessionId,resume:options.resume||null,newSession:options.sessionId||null});
 const state={interrupted:false,closed:false,model:options.model||null,effort:options.effort||null,permissionMode:String(options.permissionMode||'default'),abort:new AbortController()};
 const wake=[];
 const notify=()=>{while(wake.length)wake.shift()();};

 /* Um turno: eco de aceite (isReplay), roteiro, frames finais e persistência. */
 async function* turn(payload,wireUuid){
  const dir=storeDir({cwd:options.cwd,env:options.env});
  const delay=Number(process.env.FAKE_CLAUDE_DELAY_MS||options.delayMs||8);
  state.interrupted=false;
  state.abort=new AbortController();
  const marker=markerOf(payload.text)||String(process.env.FAKE_CLAUDE_SCENARIO||'text');
  logPrompt({text:payload.text,images:payload.images.length,marker,streaming:!!wireUuid,model:state.model,effort:state.effort});
  /* Eco oficial: o adaptador usa este frame como ACEITE (correlação por uuid). */
  const stored=[];
  if(wireUuid){
   const replay=userFrame(sessionId,[{type:'text',text:payload.text},...payload.images],{replay:true,uuidValue:wireUuid});
   stored.push(userFrame(sessionId,[{type:'text',text:payload.text},...payload.images]));
   yield replay;
  }else{
   stored.push(userFrame(sessionId,[{type:'text',text:payload.text},...payload.images]));
  }

  /* Roteiro "pensando" sem resposta: só interrupt()/close() encerra. */
  if(marker==='stall'||marker==='interrupt-exit'){
   while(!state.interrupted&&!state.closed)await Promise.race([sleep(100),new Promise(resolve=>wake.push(resolve))]);
   if(marker==='interrupt-exit'){appendStore(dir,sessionId,stored);state.closed=true;return;}
   yield assistantFrame(sessionId,[{type:'text',text:'Interrompido.'}],{aborted:true,userMessageUuid:wireUuid});
   yield resultFrame(sessionId,{text:'Interrompido pela Mesa.',subtype:'error_during_execution',isError:true,interrupted:true,userMessageUuid:wireUuid});
   appendStore(dir,sessionId,stored);
   return;
  }

  /* Permissão: pede ao host (canUseTool) quando ele oferece; sem host, o
     marcador decide. `Read` é ferramenta permitida pela ponte; o caminho fica
     dentro do cwd da conversa para a política de caminhos aprovar. */
  let permissionText='';
  if(marker==='retry'){
   yield {type:'system',subtype:'api_retry',session_id:sessionId,uuid:uuid(),attempt:2,max_retries:4,retry_delay_ms:500,error_status:529};
   await sleep(700);permissionText='Retry concluído (fixture).';
  }
  if(marker==='fallback'){
   yield {type:'system',subtype:'model_refusal_fallback',session_id:sessionId,uuid:uuid(),content:'Troca de modelo artificial (fixture).',original_model:'claude-fake',fallback_model:'claude-lite',direction:'retry',scope:'local',retracted_message_uuids:[]};
   await sleep(500);permissionText='Fallback concluído (fixture).';
  }
  if(marker==='multiple-rate'){
   for(const rateLimitType of ['five_hour','seven_day'])yield {type:'rate_limit_event',session_id:sessionId,uuid:uuid(),rate_limit_info:{status:'rejected',rateLimitType,resetsAt:Math.floor(Date.now()/1000)+60}};
   await sleep(600);
   yield {type:'rate_limit_event',session_id:sessionId,uuid:uuid(),rate_limit_info:{status:'allowed',rateLimitType:'five_hour'}};
   trace('rate-release',{type:'five_hour'});await sleep(800);
   yield {type:'rate_limit_event',session_id:sessionId,uuid:uuid(),rate_limit_info:{status:'allowed',rateLimitType:'seven_day'}};
   permissionText='Janelas liberadas (fixture).';
  }
  if(marker==='rate-limit'){
   const rateLimitType='five_hour',resetsAt=Math.floor(Date.now()/1000)+60;
   yield {type:'rate_limit_event',session_id:sessionId,uuid:uuid(),rate_limit_info:{status:'rejected',rateLimitType,resetsAt}};
   await sleep(Number(process.env.FAKE_CLAUDE_RATE_DELAY_MS||500));
   if(state.interrupted||state.closed){yield resultFrame(sessionId,{text:'Limite interrompido.',subtype:'error_during_execution',isError:true,interrupted:true,userMessageUuid:wireUuid});return;}
   yield {type:'rate_limit_event',session_id:sessionId,uuid:uuid(),rate_limit_info:{status:'allowed',rateLimitType}};
   permissionText='Limite liberado (fixture).';
  }
  if(marker==='question'){
   const questions=[
    {header:'Método',question:'Qual caminho vamos seguir?',options:[{label:'Detalhado',description:'Passo a passo'},{label:'Direto',description:'Resposta curta'}],multiSelect:false},
    {header:'Revisão',question:'O que revisar?',options:[{label:'Álgebra',description:'Contas'},{label:'Gráfico',description:'Desenho'}],multiSelect:true}
   ];
   const answer=await options.canUseTool('AskUserQuestion',{questions},{signal:state.abort.signal,toolUseID:`question_${uuid()}`});
   permissionText=answer.behavior==='allow'?`Perguntas respondidas: ${JSON.stringify(answer.updatedInput?.answers)}`:'Perguntas canceladas (fixture).';
  }
  if(marker==='permission-allow'||marker==='permission-deny'){
   let answer=null;
   if(typeof options.canUseTool==='function'){
    const target=path.join(String(options.cwd||process.cwd()),'fixture-read.txt');
    try{
     answer=await options.canUseTool('Read',{file_path:target},{
      signal:state.abort.signal,
      requestId:`perm_${uuid()}`,
      title:'Ler arquivo de teste',
      description:'Permitir a leitura do arquivo de teste?',
     });
    }catch{answer=null;}
   }
   const allowed=answer?answer.behavior==='allow':marker==='permission-allow';
   const toolUse={type:'tool_use',id:`toolu_${uuid()}`,name:'Read',input:{file_path:'fixture-read.txt'}};
   const toolUseFrame=assistantFrame(sessionId,[toolUse],{userMessageUuid:wireUuid});
   const toolResultFrame=userFrame(sessionId,[{type:'tool_result',tool_use_id:toolUse.id,content:allowed?'ok':'negado',is_error:!allowed}]);
   yield toolUseFrame;
   yield toolResultFrame;
   stored.push(toolUseFrame,toolResultFrame);
   permissionText=allowed?'Permissão concedida (fixture).':'Permissão negada (fixture).';
  }

  const errorTurn=marker==='error';
  const imageNote=payload.images.length?`Recebi ${payload.images.length} bloco(s) de imagem.`:'';
  const answer=errorTurn?'Falha simulada da fixture.'
   :(marker==='image'?`${imageNote||'Recebi 0 bloco(s) de imagem.'}\n${permissionText}`.trim()
   :(`${[imageNote,permissionText,'Resposta de teste do Claude (fixture).'].filter(Boolean).join(' ')}${payload.text?`\nVocê disse: ${payload.text.split('\n')[0].slice(0,160)}`:''}`.trim()));

  const chunks=chunkText(answer,marker);
  const streamMessageId=`msg_${uuid()}`;
  yield streamFrame(sessionId,{type:'message_start',message:{id:streamMessageId,role:'assistant',model:'claude-fake',content:[]}});
  yield streamFrame(sessionId,{type:'content_block_start',index:0,content_block:{type:'text',text:''}});
  let streamed='';
  for(const chunk of chunks){
   if(state.interrupted||state.closed)break;
   streamed+=chunk;
   yield streamFrame(sessionId,{type:'content_block_delta',index:0,delta:{type:'text_delta',text:chunk}});
   await sleep(delay);
  }
  yield streamFrame(sessionId,{type:'content_block_stop',index:0});
  yield streamFrame(sessionId,{type:'message_delta',delta:{stop_reason:'end_turn'},usage:{output_tokens:24}});
  yield streamFrame(sessionId,{type:'message_stop'});

  if(state.interrupted||state.closed){
   yield assistantFrame(sessionId,[{type:'text',text:streamed}],{aborted:true,userMessageUuid:wireUuid});
   yield resultFrame(sessionId,{text:'Interrompido pela Mesa.',subtype:'error_during_execution',isError:true,interrupted:true,userMessageUuid:wireUuid});
   appendStore(dir,sessionId,stored);
   return;
  }

  const final=assistantFrame(sessionId,[{type:'text',text:answer}],{stopReason:'end_turn',error:errorTurn?'server_error':undefined,userMessageUuid:marker==='no-echo'?null:wireUuid,messageId:streamMessageId});
  yield final;
  const result=resultFrame(sessionId,{text:answer,subtype:errorTurn?'error_during_execution':'success',isError:errorTurn,userMessageUuid:marker==='no-echo'?null:wireUuid});
  if(marker==='context-error')result.terminal_reason='prompt_too_long';
  if(marker==='blocking-limit')result.terminal_reason='blocking_limit';
  yield result;
  appendStore(dir,sessionId,[...stored,final]);
 }

 async function* run(){
  yield initFrame(sessionId,options);
  const iterator=asyncIteratorOf(prompt);
  if(!iterator){
   const payload=normalizeItem(prompt);
   if(payload.text||payload.images.length)yield* turn(payload,null);
   return;
  }
  for(;;){
   if(state.closed)return;
   trace('awaiting-item');
   const {value,done}=await iterator.next();
   trace('item',{done:!!done,text:typeof value?.message?.content!=='undefined'?'msg':String(value)});
   if(done)return;
   const payload=normalizeItem(value);
   if(!payload.text&&!payload.images.length)continue;
   yield* turn(payload,typeof value?.uuid==='string'?value.uuid:null);
  }
 }

 const iterator=run();
 iterator.initializationResult=async()=>({
  commands:[],models:modelCatalog(),agents:[],output_style:'default',
  account:{apiProvider:'firstParty'},
  claude_code_version:SDK_VERSION,session_id:sessionId
 });
 iterator.supportedModels=async()=>modelCatalog();
 iterator.supportedCommands=async()=>[];
 iterator.getSessionMessages=async()=>readStore(storeDir({cwd:options.cwd,env:options.env}),sessionId);
 iterator.setPermissionMode=async mode=>{state.permissionMode=String(mode);};
 iterator.setModel=async model=>{state.model=model||null;trace('set-model',{model:state.model,sessionId});};
 iterator.applyFlagSettings=async settings=>{state.effort=settings.effortLevel??null;trace('set-effort',{effort:state.effort,sessionId});};
 iterator.interrupt=async()=>{state.interrupted=true;state.abort.abort();notify();return {still_queued:[]};};
 iterator.close=async()=>{state.closed=true;state.abort.abort();notify();};
 iterator.stop=()=>iterator.close();
 return iterator;
}

/* Auto-teste da fixture (`node tests/fixtures/claude-sdk-fake.mjs`): valida as
   formas oficiais e o eco de aceite sem Electron nem host. */
async function selfTest(){
 const store=fs.mkdtempSync(path.join(os.tmpdir(),'claude-fake-selftest-'));
 const previous=process.env.FAKE_CLAUDE_STORE;
 process.env.FAKE_CLAUDE_STORE=store;
 try{
  const items=[{type:'user',message:{role:'user',content:[{type:'text',text:'oi [claude:image]'},{type:'image',source:{type:'base64',media_type:'image/png',data:'aGk='}}]},uuid:'11111111-1111-4111-8111-111111111111'}];
  const q=query({prompt:items,options:{cwd:store}});
  const seen=[];
  let replay=null;
  for await(const message of q){
   seen.push(message.type+(message.subtype?`:${message.subtype}`:''));
   if(message.type==='user'&&message.isReplay)replay=message;
  }
  const stored=await q.getSessionMessages();
  const models=await q.supportedModels();
  const init=await q.initializationResult();
  await q.close();
  const ok=seen[0]==='system:init'&&!!replay&&replay.uuid===items[0].uuid
   &&seen.includes('stream_event')&&seen.includes('assistant')&&seen.at(-1)==='result:success'
   &&stored.length>=2&&models[0].value==='claude-fake'&&!!init.session_id;
  if(!ok)throw Error(`fixture self-test falhou: ${JSON.stringify({seen,replay:replay?.uuid,stored:stored.length})}`);
  return {seen,stored:stored.length};
 }finally{
  if(previous===undefined)delete process.env.FAKE_CLAUDE_STORE;else process.env.FAKE_CLAUDE_STORE=previous;
  fs.rmSync(store,{recursive:true,force:true});
 }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const result=await selfTest();
 console.log('FAKE SDK SELF-TEST PASSED:',JSON.stringify(result));
}
