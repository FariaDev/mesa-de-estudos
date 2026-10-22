/* Diário de trabalho do turno: passos de pensamento, busca e ferramentas, com
   rótulos em PT-BR e resumo no fim. Módulo puro (sem DOM) — a visão fica em
   worklog-view.mjs e a fiação dos eventos em chat.mjs.

   A máquina de estados (classificação da ferramenta, rajadas de pensamento e
   fechos) é o núcleo provado em core/worklog.bend: `toolKind`, `thinkingDelta`,
   `closeThinking` e `finishLog` delegam para o artefato gerado. Para mudar a
   regra, edite o core e rode `npm run build:bend` — o host só traduz.

   A API abaixo é mutável (mexe no log no lugar e ignora o retorno) porque é a
   compatibilidade que chat.mjs, worklog-view.mjs e os testes já usavam; o
   núcleo é imutável e a ponte é o par toCore/toPlain + sync. */
import core from './generated/worklog.core.js';
import {contentParts,displayUserText} from '../text.mjs';
import {artifactPart,isActivityTool} from './timeline.mjs';
import {t} from './ui-text.mjs';
import {wholeNat} from './bend-nat.mjs';

export const STEP={THINKING:'thinking',SEARCH:'search',REFERENCE:'reference',FETCH:'fetch',TOOL:'tool',ERROR:'error'};

/* ---------- ponte plain <-> núcleo ---------- */

const KIND_TO_CORE={thinking:'Thinking',search:'Search',reference:'Reference',fetch:'Fetch',tool:'Tool',error:'ErrorKind'};
const KIND_FROM_CORE={Thinking:STEP.THINKING,Search:STEP.SEARCH,Reference:STEP.REFERENCE,Fetch:STEP.FETCH,Tool:STEP.TOOL,Error:STEP.ERROR,ErrorKind:STEP.ERROR};
const STATUS_TO_CORE={running:'Running',done:'Done',stopped:'Stopped',error:'Failed'};
const STATUS_FROM_CORE={Running:'running',Done:'done',Completed:'done',Stopped:'stopped',Failed:'error'};

/* O núcleo só casa o nome JS de dois construtores: o tipo do passo de
   pensamento e o estado `Running`. Bend exige construtor globalmente novo
   (`Done` colidiria com `Result.Done` — o núcleo chama o fim de `Completed`),
   então esses nomes podem sair qualificados (ex. `Status.Running`); por isso
   perguntamos ao próprio núcleo (pensar num log vazio devolve um passo com os
   construtores dele) e caímos no nome puro do modelo se a sonda falhar. Os
   demais nomes nunca são casados pelo núcleo (só transportados), então o mapa
   por último segmento basta na volta. */
let names=null;
function coreNames(){
 if(names)return names;
 names={thinking:KIND_TO_CORE.thinking,running:STATUS_TO_CORE.running};
 try{
  const probe=core.thinkingDelta(core.createLog(0),'x',0);
  const step=firstStep(probe?.steps);
  if(step?.kind?.$)names.thinking=String(step.kind.$);
  if(step?.status?.$)names.running=String(step.status.$);
 }catch{}
 return names;
}

function firstStep(node){
 const current=Array.isArray(node)?node[0]:node;
 return current&&current.$==='Con'?current.head:null;
}

function kindToCore(kind){
 if(kind===STEP.THINKING)return {$:coreNames().thinking};
 return {$:KIND_TO_CORE[kind]||KIND_TO_CORE.tool};
}

function statusToCore(status){
 if(status==='running')return {$:coreNames().running};
 return {$:STATUS_TO_CORE[status]||STATUS_TO_CORE.running};
}

function nameTail(node){
 const name=String(node?.$??'');
 const cut=name.lastIndexOf('.');
 return cut<0?name:name.slice(cut+1);
}

function natToJs(value){
 const n=Number(value);
 return Number.isFinite(n)?n:0;
}

/* Listas do núcleo são cadeias Con/Nil (construtores {$:"…"}). */
function listToCore(items,convert){
 let out={$:'Nil'};
 const list=Array.isArray(items)?items:[];
 for(let i=list.length-1;i>=0;i--)out={$:'Con',head:convert(list[i]),tail:out};
 return out;
}

function listToPlain(node,convert){
 if(Array.isArray(node))return node.map(convert);
 const out=[];
 let current=node;
 while(current&&current.$==='Con'){out.push(convert(current.head));current=current.tail;}
 return out;
}

function hitToCore(item){
 return {$:'Hit',title:String(item?.title??''),url:String(item?.url??'')};
}

function hitToPlain(hit){
 return {title:String(hit?.title??''),url:String(hit?.url??'')};
}

/* `args` era o objeto cru no passo plain; no núcleo vira string JSON. */
function argsToJson(args){
 try{return JSON.stringify(args||{})||'{}';}catch{return '{}';}
}

function argsFromJson(json){
 try{const parsed=JSON.parse(String(json||'{}'));return parsed==null?{}:parsed;}catch{return {};}
}

function sameJson(a,b){
 try{return JSON.stringify(a)===JSON.stringify(b);}catch{return false;}
}

function toCoreStep(step){
 return {
  $:'Step',
  id:String(step?.id??''),
  kind:kindToCore(step?.kind),
  status:statusToCore(step?.status),
  startedAt:wholeNat(step?.startedAt),
  endedAt:wholeNat(step?.endedAt),
  payload:{
   $:'Payload',
   text:String(step?.text??''),
   toolName:String(step?.toolName??''),
   argsJson:argsToJson(step?.args),
   query:String(step?.query??''),
   url:String(step?.url??''),
   domain:String(step?.domain??''),
   pageTitle:String(step?.pageTitle??''),
   hits:listToCore(step?.results,hitToCore),
   resultText:String(step?.resultText??''),
   error:String(step?.error??''),
  },
 };
}

function toPlainStep(step){
 const payload=step?.payload||{};
 return {
  id:String(step?.id??''),
  kind:KIND_FROM_CORE[nameTail(step?.kind)]||STEP.TOOL,
  status:STATUS_FROM_CORE[nameTail(step?.status)]||'running',
  startedAt:natToJs(step?.startedAt),
  endedAt:natToJs(step?.endedAt),
  text:String(payload.text??''),
  toolName:String(payload.toolName??''),
  args:argsFromJson(payload.argsJson),
  query:String(payload.query??''),
  url:String(payload.url??''),
  domain:String(payload.domain??''),
  pageTitle:String(payload.pageTitle??''),
  results:listToPlain(payload.hits,hitToPlain),
  resultText:String(payload.resultText??''),
  error:String(payload.error??''),
 };
}

export function toCore(log){
 return {
  $:'Log',
  startedAt:wholeNat(log?.startedAt),
  endedAt:wholeNat(log?.endedAt),
  reason:String(log?.reason??''),
  text:String(log?.text??''),
  steps:listToCore(log?.steps,toCoreStep),
 };
}

export function toPlain(log){
 return {
  startedAt:natToJs(log?.startedAt),
  endedAt:natToJs(log?.endedAt),
  reason:String(log?.reason??''),
  text:String(log?.text??''),
  steps:listToPlain(log?.steps,toPlainStep),
 };
}

/* Reconcilia o log do núcleo no objeto plain MUTANDO-O: reusa o passo antigo
   quando id e posição batem, para quem guardou a referência (a visão e os
   testes) continuar enxergando as mudanças. */
export function sync(plain,next){
 plain.startedAt=natToJs(next?.startedAt);
 plain.endedAt=natToJs(next?.endedAt);
 plain.reason=String(next?.reason??'');
 plain.text=String(next?.text??'');
 const previous=Array.isArray(plain.steps)?plain.steps:[];
 const fresh=listToPlain(next?.steps,toPlainStep);
 const merged=fresh.map((step,index)=>{
  const old=previous[index];
  if(!old||old.id!==step.id)return step;
  const keptArgs=old.args;
  Object.assign(old,step);
  if(keptArgs!==undefined&&sameJson(keptArgs,step.args))old.args=keptArgs;
  return old;
 });
 if(Array.isArray(plain.steps))plain.steps.length=0;
 else plain.steps=[];
 plain.steps.push(...merged);
}

/* ---------- rótulos e resumo ---------- */

export function formatDuration(ms){
 const s=Math.max(1,Math.round(Number(ms||0)/1000));
 if(s<60)return t('work.duration.s',{s});
 const m=Math.floor(s/60),rest=s%60;
 return rest?t('work.duration.minSec',{m,s:rest}):t('work.duration.min',{m});
}

/* Nome técnico da ferramenta → tipo do passo (decisão do núcleo; a ordem
   importa lá: open_reference também "casa" com busca, então vem antes). */
export function toolKind(name){
 const kind=core.toolKind(String(name||''));
 return KIND_FROM_CORE[nameTail(kind)]||STEP.TOOL;
}

function domainOf(url){
 try{return new URL(String(url||'')).hostname.replace(/^www\./,'');}catch{return '';}
}

function textOf(content){
 if(typeof content==='string')return content;
 const parts=Array.isArray(content)?content:[];
 return parts.filter(part=>part&&part.type==='text').map(part=>String(part.text||'')).join('\n');
}

export function createLog(now=Date.now()){
 return {startedAt:now,endedAt:0,reason:'',steps:[],text:''};
}

export function runningStep(log){
 const steps=log?.steps||[];
 for(let i=steps.length-1;i>=0;i--)if(steps[i].status==='running')return steps[i];
 return null;
}

/* Pensamento: cada rajada de deltas vira um passo; a rajada fecha na primeira
   coisa que não é pensamento (texto, ferramenta, fim de mensagem). O passo
   tocado é sempre o último — devolve ele, como a API antiga. */
export function thinkingDelta(log,delta,now=Date.now()){
 const text=String(delta||'');
 if(!text)return null;
 sync(log,core.thinkingDelta(toCore(log),text,wholeNat(now)));
 return log.steps.at(-1)||null;
}

export function closeThinking(log,now=Date.now()){
 sync(log,core.closeThinking(toCore(log),wholeNat(now)));
}

/* Conteúdo autoritativo de `thinking_end`: o delta é só pintura. Substitui o
   texto do passo indicado (ou do último pensamento do log) para um re-stream
   não duplicar pensamento no passo. */
export function replaceThinking(log,text,step=null){
 const steps=log?.steps||[];
 let target=step&&steps.includes(step)?step:null;
 if(!target)for(let i=steps.length-1;i>=0;i--)if(steps[i].kind===STEP.THINKING){target=steps[i];break;}
 if(!target)return null;
 target.text=String(text||'');
 return target;
}

function makeToolStep({id,name,args,now}){
 const kind=toolKind(name);
 const step={
  id:id||`ferramenta-${kind}-${now}`,kind,toolName:String(name||''),args:args||{},
  status:'running',startedAt:now,endedAt:0,query:'',url:'',domain:'',
  pageTitle:'',results:[],resultText:'',error:'',
 };
 if(kind===STEP.SEARCH||kind===STEP.REFERENCE)step.query=String(args?.query||'').trim();
 if(kind===STEP.FETCH){step.url=String(args?.url||'').trim();step.domain=domainOf(step.url);}
 return step;
}

/* Resultado da ferramenta (evento ao vivo `tool_execution_end` ou a mensagem
   `toolResult` do JSONL): os dois têm content/details/isError no mesmo formato. */
function applyResult(step,result,isError,now){
 step.endedAt=now||Date.now();
 step.status=isError?'error':'done';
 const details=result&&typeof result==='object'?(result.details||{}):{};
 if(Array.isArray(details.results)){
  step.results=details.results
   .filter(item=>item&&(item.url||item.title))
   .slice(0,6)
   .map(item=>({title:String(item.title||item.url||''),url:String(item.url||'')}));
 }
 if(!step.url&&details.source)step.url=String(details.source);
 if(details.title)step.pageTitle=String(details.title);
 if(!step.domain&&step.url)step.domain=domainOf(step.url);
 step.resultText=textOf(result&&typeof result==='object'?result.content:result).trim();
 if(isError)step.error=step.resultText||'A ferramenta falhou.';
 return step;
}

/* Idempotente por id: a DECLARAÇÃO da chamada (`toolcall_end`/`content_block_start`)
   reserva a posição do passo e a EXECUÇÃO atualiza o mesmo ID — nunca duplica o
   passo quando os dois eventos chegam. Id ausente mantém o comportamento antigo
   (passo novo). */
export function findToolStep(log,id){
 const key=String(id||'');
 if(!key)return null;
 const steps=log?.steps||[];
 for(let i=steps.length-1;i>=0;i--)if(String(steps[i].id||'')===key)return steps[i];
 return null;
}

export function startTool(log,{id,name,args,now=Date.now()}={}){
 const existing=findToolStep(log,id);
 if(existing)return existing;
 const step=makeToolStep({id,name,args,now});
 log.steps.push(step);
 return step;
}

export function finishTool(log,{id,result,isError,now=Date.now()}={}){
 const steps=log.steps||[];
 for(let i=steps.length-1;i>=0;i--){
  if(steps[i].id===id&&steps[i].status==='running')return applyResult(steps[i],result,isError,now);
 }
 return null;
}

export function addError(log,message,now=Date.now()){
 const error=String(message||'').trim()||'Erro';
 log.steps.push({id:`erro-${log.steps.length+1}`,kind:STEP.ERROR,status:'error',startedAt:now,endedAt:now,text:'',error,results:[],resultText:''});
 return log.steps.at(-1);
}

export function finishLog(log,{now=Date.now(),reason=''}={}){
 sync(log,core.finishLog(toCore(log),wholeNat(now),String(reason||'')));
}

export function liveLabel(step){
 if(!step)return '';
 switch(step.kind){
  case STEP.THINKING:return t('work.live.thinking');
  case STEP.SEARCH:return step.query?t('work.live.search',{query:step.query}):t('work.live.searchNoQuery');
  case STEP.REFERENCE:return step.query?t('work.live.reference',{query:step.query}):t('work.live.referenceNoQuery');
  case STEP.FETCH:return step.domain?t('work.live.fetch',{domain:step.domain}):t('work.live.fetchNoDomain');
  case STEP.ERROR:return step.error||t('work.error');
  default:return t('work.live.tool',{tool:step.toolName||t('work.toolFallback')});
 }
}

export function stepLabel(step){
 const duration=step.endedAt&&step.startedAt?formatDuration(step.endedAt-step.startedAt):'';
 switch(step.kind){
  case STEP.THINKING:return duration?t('work.step.thought',{duration}):t('work.step.thoughtNoDuration');
  case STEP.SEARCH:return step.query?t('work.step.search',{query:step.query}):t('work.step.searchNoQuery');
  case STEP.REFERENCE:return step.query?t('work.step.reference',{query:step.query}):t('work.step.referenceNoQuery');
  case STEP.FETCH:return step.domain?t('work.step.fetch',{domain:step.domain}):t('work.step.fetchNoDomain');
  case STEP.ERROR:return t('work.error');
  default:return t('work.step.tool',{tool:step.toolName||t('work.toolFallback')});
 }
}

export function stepDetail(step){
 if(step.kind===STEP.THINKING)return String(step.text||'').trim();
 if(step.error)return String(step.error||'').trim();
 if(step.resultText&&!step.results.length&&step.kind!==STEP.FETCH)return step.resultText.slice(0,6000);
 return '';
}

export function stepPreview(step){
 if(step.kind!==STEP.THINKING)return '';
 const text=String(step.text||'').replace(/\s+/g,' ').trim();
 if(!text)return '';
 return text.length>200?`…${text.slice(-200)}`:text;
}

export function countsLabel(steps){
 const counts=[[STEP.SEARCH,'work.counts.search'],[STEP.REFERENCE,'work.counts.reference'],[STEP.FETCH,'work.counts.page'],[STEP.TOOL,'work.counts.tool']];
 const parts=[];
 for(const [kind,key] of counts){
  const n=(steps||[]).filter(step=>step.kind===kind).length;
  if(n)parts.push(t(key,{count:n}));
 }
 return parts.join(' · ');
}

export function headLine(log){
 const steps=log.steps||[];
 const toolish=steps.some(step=>step.kind!==STEP.THINKING&&step.kind!==STEP.ERROR);
 const ended=Number(log.endedAt)>0?Number(log.endedAt):Date.now();
 const startedRaw=Number(log.startedAt);
 const started=startedRaw>=0&&startedRaw<=ended?startedRaw:ended;
 const elapsed=Math.max(0,ended-started);
 const duration=formatDuration(elapsed);
 const base=log.reason==='stopped'
  ?t('work.head.stopped',{duration})
  :log.reason
   ?t('work.head.interrupted',{duration})
   :toolish?t('work.head.worked',{duration}):t('work.head.thought',{duration});
 const counts=countsLabel(steps.filter(step=>step.status!=='running'));
 return counts?`${base} · ${counts}`:base;
}

function stampOf(message){
 const ts=Number(message?.timestamp);
 if(Number.isFinite(ts)&&ts>0)return ts;
 const parsed=Date.parse(message?.createdAt||message?.created_at||'')||0;
 return parsed>0?parsed:0;
}

/* Histórico: reconstrói os turnos das mensagens do JSONL (role/content do Pi),
   pareando cada toolCall com seu toolResult. Sem tempos de parede por parte, a
   duração do turno usa as mensagens; o passo de ferramenta usa o resultado.

   `parts` guarda a linha do tempo do turno — rodadas de trabalho, falas e
   artefatos intercalados na ordem em que aconteceram — para o transcript não
   jogar todo o trabalho para cima da última fala. Um artefato entra no ponto da
   DECLARAÇÃO da ferramenta (`toolCallId` estável), antes da próxima fala; os
   passos seguintes continuam no bloco de trabalho aberto, como ao vivo. Os
   campos antigos (`steps`, `text`, `assistantImages`) continuam agregados para
   quem já os consumia. */
export function historyTurns(messages){
 const results=new Map();
 for(const message of messages||[]){
  if(message?.role==='toolResult'&&message.toolCallId)results.set(message.toolCallId,message);
 }
 const turns=[];
 let turn=null;
 let currentWork=null;
 const flush=()=>{
  if(turn&&(turn.steps.length||turn.text.trim()||turn.userText||turn.userImages.length||turn.assistantImages.length))turns.push(turn);
  turn=null;
  currentWork=null;
 };
 const emptyTurn=at=>({startedAt:at,endedAt:0,steps:[],parts:[],text:'',userText:'',userImages:[],assistantImages:[],userTime:0,time:0});
 const pushStep=step=>{
  if(!currentWork){currentWork={type:'work',startedAt:0,endedAt:0,steps:[]};turn.parts.push(currentWork);}
  if(!currentWork.steps.length)currentWork.startedAt=step.startedAt;
  currentWork.steps.push(step);
  if(step.endedAt)currentWork.endedAt=Math.max(currentWork.endedAt,step.endedAt);
  turn.steps.push(step);
  return currentWork;
 };
 for(const message of messages||[]){
  if(!message||typeof message!=='object')continue;
  if(message.role==='user'){
   flush();
   const {text,images}=contentParts(message);
   turn={...emptyTurn(stampOf(message)),userText:displayUserText(text),userImages:images,userTime:stampOf(message)};
   continue;
  }
  if(message.role==='assistant'){
   if(!turn)turn=emptyTurn(stampOf(message));
   const {images}=contentParts(message);
   const at=stampOf(message);
   let spoken=null;
   for(const part of Array.isArray(message.content)?message.content:[]){
    if(!part)continue;
    if(part.type==='thinking'){
     const text=String(part.thinking??part.text??'').trim();
     if(text)pushStep({id:`pensar-${turn.steps.length+1}`,kind:STEP.THINKING,status:'done',startedAt:at,endedAt:0,text});
    }else if(part.type==='toolCall'){
     const step=makeToolStep({id:part.id,name:part.name,args:part.arguments,now:at});
     const result=results.get(part.id);
     if(result)applyResult(step,result,result.isError,stampOf(result));
     else{step.status='stopped';step.endedAt=at;}
     pushStep(step);
     if(isActivityTool(part.name))turn.parts.push(artifactPart(step.id,step.toolName,at));
    }else if(part.type==='text'){
     const text=String(part.text||'').trim();
     if(!text)continue;
     turn.text+=turn.text?`\n\n${text}`:text;
     /* Blocos de fala CONSECUTIVOS da mesma mensagem ficam na mesma fala (a
        Mesa sempre mostrou a mensagem inteira num balão); só trabalho ou
        artefato no meio abre uma fala nova. */
     if(spoken&&turn.parts.at(-1)===spoken)spoken.text+=`\n\n${text}`;
     else{spoken={type:'text',text,images:[],time:at};turn.parts.push(spoken);}
     currentWork=null;
    }
   }
   /* As imagens do assistente também sobrevivem ao histórico: entram na última
      fala da mensagem; sem fala, viram um turno visual no ponto certo. */
   if(images.length){
    turn.assistantImages.push(...images);
    if(spoken)spoken.images.push(...images);
    else{turn.parts.push({type:'text',text:'',images:[...images],time:at});currentWork=null;}
   }
   if(at){turn.time=at;turn.endedAt=Math.max(turn.endedAt,at);}
   continue;
  }
  if(message.role==='toolResult'&&turn){
   const at=stampOf(message);
   if(at)turn.endedAt=Math.max(turn.endedAt,at);
   /* O resultado fecha a rodada visual do bloco que contém a chamada. */
   if(currentWork&&at&&message.toolCallId&&currentWork.steps.some(step=>String(step.id)===String(message.toolCallId)))currentWork.endedAt=Math.max(currentWork.endedAt,at);
  }
 }
 flush();
 return turns;
}
