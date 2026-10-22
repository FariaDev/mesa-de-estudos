import * as worklog from './worklog.mjs';
import * as timeline from './timeline.mjs';
import {$,S,activity,activityLive} from './state.mjs';
import {t as uiT} from './ui-text.mjs';
import {createWorkLogView} from './worklog-view.mjs';
import {activitySlots,assistantAnchors,retiredHostRuns,retiredTurnTools,turnState} from './chat-turn-state.mjs';
import {message,updateMessage} from './chat-message-view.mjs';

/* Coluna do tutor — o turno ao vivo: blocos de fala por mensagem e índice,
   diário de trabalho, ferramentas, slots de atividade e o recolhimento.
   Saiu de chat.mjs na #43 fase 2. */

function resetAssistantBuffers(){
 turnState.assistant=null;turnState.assistantText='';turnState.assistantId=null;turnState.assistantKey=null;turnState.assistantEnded=false;turnState.messageEnded=false;turnState.thinkingOpenKey=null;turnState.assistantBlocks.clear();assistantAnchors.clear();turnState.assistantLoose=[];
}
/* Identidade sintética por sequência de `message_start` (Pi sem id): cada
   mensagem ganha a PRÓXIMA identidade e os blocos ficam por (id, contentIndex).
   Uma mensagem ainda ABERTA conserva a identidade (re-stream do mesmo bloco
   não duplica a fala); depois do `message_end`, a próxima abre a identidade
   seguinte. */
function nextAssistantId(){
 turnState.assistantSeq+=1;turnState.assistantId=`host-msg-${turnState.assistantSeq}`;
 turnState.assistantBlocks.clear();assistantAnchors.clear();turnState.assistantLoose=[];
 return turnState.assistantId;
}
function ensureAssistantId(){
 return turnState.assistantId!=null?turnState.assistantId:nextAssistantId();
}
/* Resultado do `tool_execution_end`: o pi manda `{content,details}`; o Claude
   manda a string e os `details` (quando cabem) num campo próprio. */
function toolResultFor(e){
 const result=e?.result;
 if(e?.details!==undefined&&(result==null||typeof result!=='object'))return {content:result??'',details:e.details};
 return result;
}
/* Evento atrasado de turno encerrado/trocado: nada pinta no DOM. O `runId`
   (quando existe) distingue gerações; `turnClosed` cobre hosts sem id. Sem
   `agent_start` (Pi que abre direto na mensagem), só evento de TRABALHO
   (pensamento/ferramenta) abre a rodada enquanto o app está ocupado — um turno
   só de texto continua sem diário, como sempre. Depois de recolher
   (Parar/erro/atraso) o `busy` já caiu e o evento é descartado. */
function opensTurn(e){
 if(e.type==='tool_execution_start')return true;
 if(e.type!=='message_update')return false;
 const kind=e.assistantMessageEvent?.type;
 return kind==='thinking_start'||kind==='thinking_delta'||kind==='toolcall_end';
}
function staleEvent(e){
 if(e?.stale===true)return true;
 if(retiredToolEvent(e))return true;
 if(turnState.stoppedTurn)return true;
 const eventRun=e?.runId??e?.hostRun??null;
 if(eventRun!=null&&retiredHostRuns.has(String(eventRun)))return true;
 if(turnState.turnClosed===false)return eventRun!=null&&turnState.turnRunId!=null&&eventRun!==turnState.turnRunId;
 const tracked=e.type==='message_start'||e.type==='message_end'||e.type==='tool_execution_end'||e.type==='message_update'||e.type==='tool_execution_start';
 if(!tracked)return false;
 if(!turnState.promptArmed&&!S.busy)return true;
 if(opensTurn(e))openTurnLog();
 return false;
}
/* Id de ferramenta citado por um evento que já pertence a um turno recolhido:
   a pintura atrasada não pode reaproveitar a identidade (N1). */
function retiredToolEvent(e){
 const direct=String(e?.toolCallId??'');
 if(direct&&retiredTurnTools.has(direct))return true;
 const call=e?.assistantMessageEvent?.toolCall;
 if(call?.id!=null&&retiredTurnTools.has(String(call.id)))return true;
 const content=e?.message?.content;
 if(Array.isArray(content)){
  for(const part of content){
   if(part?.type==='toolCall'&&part.id!=null&&retiredTurnTools.has(String(part.id)))return true;
  }
 }
 return false;
}
/* Um `message_end` atrasado que cita ferramenta aposentada é atraso
   comprovado por IDENTIDADE (nunca pelo texto): o host já o entrega marcado
   `stale`, o renderer descarta e NÃO toca no bloco da fala nova. Igualdade ou
   sufixo de texto jamais autoriza apagar/truncar fala legítima. */
/* Abre (ou reencontra) o bloco de fala corrente; sem chave recua para a bolha
   aberta de sempre. */
function rememberLooseBlock(block){
 if(!block||block.key)return block;
 if(!turnState.assistantLoose.includes(block)){
  turnState.assistantLoose.push(block);
  if(turnState.assistantLoose.length>8)turnState.assistantLoose.shift();
 }
 return block;
}
function openAssistantBlock(key){
 if(key&&turnState.assistantBlocks.has(key)){
  const block=turnState.assistantBlocks.get(key);
  turnState.assistant=block.el;turnState.assistantText=block.text;turnState.assistantKey=key;
  return block;
 }
 if(!key){
  const loose=turnState.assistantLoose.find(block=>block.el===turnState.assistant)||(turnState.assistant&&turnState.assistantKey===null&&turnState.assistant.isConnected&&!turnState.assistantEnded?{el:turnState.assistant,text:turnState.assistantText,key:null}:null);
  if(loose){turnState.assistant=loose.el;turnState.assistantText=loose.text;turnState.assistantKey=null;return rememberLooseBlock(loose);}
 }
 const el=message('assistant','');
 const block={el,text:'',key:key||null};
 if(key){turnState.assistantBlocks.set(key,block);if(turnState.assistantBlocks.size>64)turnState.assistantBlocks.delete(turnState.assistantBlocks.keys().next().value);}
 else rememberLooseBlock(block);
 turnState.assistant=el;turnState.assistantText='';turnState.assistantKey=key||null;
 return block;
}
function resetAssistantBlock(key){
 const block=openAssistantBlock(key);
 block.text='';turnState.assistantText='';
 updateMessage(block.el,'',[],true);
 return block;
}
function appendAssistantDelta(delta,key){
 const block=openAssistantBlock(key);
 block.text+=String(delta||'');turnState.assistantText=block.text;
 updateMessage(block.el,turnState.assistantText,[],true);
 return block;
}
/* Liquida um bloco final: reusa o bloco da chave; sem chave, ADOTA a bolha
   corrente sem identidade (deltas sem contentIndex) em vez de criar outra; e,
   ao criar, insere no ponto lógico (`anchor`) — nunca depois de uma ferramenta
   de índice maior. O slot da atividade já está ancorado no segmento: não se
   mexe nele. */
function settleAssistantBlock(key,text,images=[],anchor=null){
 let block=key?turnState.assistantBlocks.get(key):null;
 if(block){
  turnState.assistant=block.el;turnState.assistantText=block.text;turnState.assistantKey=key;
 }else{
  if(key){
   /* Host sem `contentIndex` (N2): a fala veio por delta sem chave; adota o
      balão da fila em ordem — o `message_end` não pode duplicar a primeira
      fala nem fundir texto→ferramenta→texto. */
   while(turnState.assistantLoose.length&&!turnState.assistantLoose[0].el?.isConnected)turnState.assistantLoose.shift();
   if(turnState.assistantLoose.length){
    block=turnState.assistantLoose.shift();
    block.key=key;turnState.assistantBlocks.set(key,block);
    if(turnState.assistantBlocks.size>64)turnState.assistantBlocks.delete(turnState.assistantBlocks.keys().next().value);
    turnState.assistant=block.el;turnState.assistantText=block.text;turnState.assistantKey=key;
   }
  }
  if(!block){
   block=turnState.assistant&&turnState.assistantKey===null&&turnState.assistant.isConnected&&!turnState.assistantEnded?{el:turnState.assistant,text:turnState.assistantText,key:null}:null;
   if(!block){
    const el=message('assistant','');
    if(anchor&&anchor.isConnected&&anchor.parentNode)anchor.parentNode.insertBefore(el,anchor);
    block={el,text:'',key:key||null};
   }
   if(key){
    block.key=key;turnState.assistantBlocks.set(key,block);
    if(turnState.assistantBlocks.size>64)turnState.assistantBlocks.delete(turnState.assistantBlocks.keys().next().value);
   }
   turnState.assistant=block.el;turnState.assistantText=block.text;turnState.assistantKey=key||null;
  }
 }
 block.text=String(text||'');turnState.assistantText=block.text;
 updateMessage(block.el,turnState.assistantText,images);
 return block;
}
/* O `message_end` pode trazer a ferramenta no `content` sem o `toolcall_end`
   (quadros parciais do Claude): o passo existe e a âncora é reconstruída pelo
   id; ferramenta sem passo não reserva posição. */
function rememberToolAnchors(content,contentIndexes){
 if(!turnState.turnLog||!turnState.turnTrack||!Array.isArray(content))return;
 for(let i=0;i<content.length;i++){
  const part=content[i];
  if(!part||part.type!=='toolCall')continue;
  const id=String(part.id||'');if(!id||assistantAnchors.has(id))continue;
  const step=worklog.findToolStep(turnState.turnLog,id);
  if(!step)continue;
  const seg=timeline.segmentOfStep(turnState.turnTrack,step.id);
  const el=seg?.view?.el;
  if(!el)continue;
  assistantAnchors.set(id,{index:contentIndexes?.[i]??i,el});
 }
}
/* Primeira ferramenta desta mensagem cujo índice lógico vem DEPOIS da fala. */
function assistantAnchorAfter(contentIndex){
 let found=null;
 for(const anchor of assistantAnchors.values()){
  if(!Number.isInteger(anchor.index)||anchor.index<=contentIndex)continue;
  if(!anchor.el?.isConnected)continue;
  if(!found||anchor.index<found.index)found=anchor;
 }
 return found?.el||null;
}
/* Diário do turno: nasce no agent_start e é uma linha do tempo de RODADAS
   (segmentos). Cada rodada nasce no primeiro passo depois de uma fala e recolhe
   quando a próxima fala chega, então o trabalho fica entre o que veio antes e o
   que veio depois. O log do turno continua um só (relógio/runningStep); o passo
   pertence ao segmento pelo ID — resultado tardio de ferramenta concorrente
   atualiza o segmento ORIGINAL, já fechado, e não vaza para o próximo. */
function openTurnLog(){
 if(turnState.turnLog)return;
 turnState.turnLog=worklog.createLog(Date.now());
 turnState.turnTrack=timeline.beginTrack(timeline.createTrack());
 turnState.turnClosed=false;
 turnState.turnActivityCalls=new Set();
 clearInterval(turnState.liveTick);
 turnState.liveTick=setInterval(paintLive,1000);
 openSegment();
}
function openSegment(){
 openTurnLog();
 const {seg,created}=timeline.openSegment(turnState.turnTrack,{at:(turnState.turnLog?.steps||[]).length,now:Date.now()});
 if(created){
  seg.view=createWorkLogView();
  $('#messages').append(seg.view.el);
  renderSegment(seg,{live:true});
  paintLive();
 }
 return seg;
}
function segmentLog(seg){
 return {startedAt:seg.startedAt,endedAt:seg.endedAt,reason:seg.reason,text:'',steps:timeline.segmentSteps(turnState.turnLog,seg)};
}
function renderSegment(seg,{live,note=''}={}){
 if(!seg?.view||!seg.view.el?.isConnected)return;
 seg.view.render(segmentLog(seg),{live:live!==undefined?live:!seg.closed,note});
}
/* Declaração (`toolcall_end`/`content_block_start`) e execução separam-se: a
   declaração reserva a posição (passo idempotente por ID) e a execução atualiza
   o MESMO passo. Só a declaração de ferramenta publica slot de atividade. */
function declareTool({id,name,args,pending=false,contentIndex=null}={}){
 if(id==null||id==='')return null;
 ensureAssistantId();
 let step=worklog.findToolStep(turnState.turnLog,id);
 let seg=step?timeline.segmentOfStep(turnState.turnTrack,step.id):null;
 if(!step){
  seg=openSegment();
  worklog.closeThinking(turnState.turnLog);
  step=worklog.startTool(turnState.turnLog,{id,name,args,now:Date.now()});
  timeline.addStep(seg,step.id);
 }else{
  worklog.closeThinking(turnState.turnLog);
  /* A execução do mesmo ID não abre rodada nova: o passo já tem lugar. */
  if(!seg)seg=openSegment();
  timeline.addStep(seg,step.id);
 }
 closeAssistantForTool();
 if(Number.isInteger(contentIndex)&&seg?.view?.el)assistantAnchors.set(String(step.id),{index:contentIndex,el:seg.view.el});
 if(timeline.isActivityTool(name))ensureActivitySlot(id,{status:pending?'pending':'running',anchor:seg?.view?.el||null});
 /* Declaração/execução são raras (ao contrário do delta de pensamento):
    repinta o segmento dono na hora para o passo acompanhar o slot. */
 if(seg)renderSegment(seg,{live:!seg.closed});
 paintLive();
 return step;
}
function closeAssistantForTool(){
 turnState.assistant=null;turnState.assistantText='';turnState.assistantKey=null;turnState.assistantEnded=false;turnState.thinkingOpenKey=null;
}
/* Slot de atividade: shell EXTERNO ao diário (irmão do `article.work`), nunca
   repintado pelo `renderSegment`; o renderer de atividades hidrata pelo evento
   e o slot permanece no lugar original mesmo com o texto final chegando. */
function ensureActivitySlot(toolCallId,{status='pending',anchor=null,artifactId=null,version=null}={}){
 const id=String(toolCallId||'');
 if(!id)return null;
 let el=activitySlots.get(id);
 if(el&&!el.isConnected){activitySlots.delete(id);el=null;}
 if(!el){
  const escaped=typeof CSS!=='undefined'&&CSS.escape?CSS.escape(id):id.replace(/"/g,'\\"');
  el=$('#messages').querySelector(`.activity-slot[data-activity-call="${escaped}"]`);
 }
 let created=false;
 if(!el){
  el=document.createElement('div');
  el.className='activity-slot';
  el.dataset.activityCall=id;
  el.dataset.status=status;
  if(anchor&&anchor.isConnected){
   /* Vários slots do MESMO bloco de trabalho ficam na ordem de declaração:
      insere depois do último slot já ancorado, não logo após o `article.work`. */
   let at=anchor;
   while(at.nextElementSibling?.classList?.contains('activity-slot'))at=at.nextElementSibling;
   at.after(el);
  }else $('#messages').append(el);
  created=true;
 }
 activitySlots.set(id,el);
 if(status&&el.dataset.status!==status)el.dataset.status=status;
 /* Identidade ESTÁVEL do artefato (publicação → revisão): o renderer usa
    `data-activity-id`/`data-activity-version` como chave de montagem, para um
    slot reciclado nunca conservar o documento de outra atividade. */
 if(artifactId!=null&&artifactId!=='')el.dataset.activityId=String(artifactId);
 if(version!=null&&version!=='')el.dataset.activityVersion=String(version);
 turnState.turnActivityCalls.add(id);
 if(created)window.dispatchEvent(new CustomEvent('desk-activity-slot',{detail:{toolCallId:id,element:el}}));
 return el;
}
function activitySlotElement(toolCallId,status='pending'){
 const el=document.createElement('div');
 el.className='activity-slot';
 el.dataset.activityCall=String(toolCallId||'');
 el.dataset.status=status;
 return el;
}
/* Detalhes do resultado (`{kind:'activity',artefatoId,version,…}`) viram
   atributos do slot — a chamada segue dona da posição; a identidade da revisão
   vem do artefato, como no timeline de referência. */
function activityDetailsOf(result){
 const details=result&&typeof result==='object'?result.details:null;
 if(!details||typeof details!=='object')return {};
 return {
  artifactId:details.artifactId??details.activityId??null,
  version:details.version??null,
 };
}
function finishActivitySlots(reason){
 for(const id of turnState.turnActivityCalls){
  const el=activitySlots.get(id);
  if(!el?.isConnected)continue;
  if(el.dataset.status!=='pending'&&el.dataset.status!=='running')continue;
  const step=worklog.findToolStep(turnState.turnLog,id);
  const failed=step?.status==='error'||reason==='error'||reason==='blocked';
  el.dataset.status=failed?'error':'stopped';
 }
}
function liveWorkShown(){return !!document.querySelector('#messages .work[data-live="true"]');}
function paintLive(){
 if(!turnState.turnLog)return;
 if(S.quizQueue&&S.quizQueue.length)return; /* o quiz manda na linha do composer */
 /* Um aviso de limite visível manda na faixa: o relógio do turno não apaga o
    motivo da pausa a cada segundo (a limpeza é do `agent_settled`/RESUMED). */
 if(turnState.limitShown)return;
 /* Com o diário vivo na conversa, a faixa de baixo repetia o mesmo rótulo e o
    relógio (2026-10-21, captura do autor: "pensando" duas vezes). Ela só fala
    quando não há diário à vista. */
 if(liveWorkShown()){activity('');return;}
 const step=worklog.runningStep(turnState.turnLog);
 const text=step?worklog.liveLabel(step):uiT('tutor.thinking');
 activityLive(`${text} · ${worklog.formatDuration(Date.now()-turnState.turnLog.startedAt)}`);
}
function renderTurn(note=''){
 if(!turnState.turnLog)return;
 const seg=turnState.turnTrack?.segs.at(-1);
 if(seg&&!seg.closed)renderSegment(seg,{live:true,note});
 paintLive();
}
/* A fala fecha a rodada (idempotente enquanto a mensagem escreve): o bloco vira
   a tarja recolhida e o próximo passo abre outro embaixo. Rodada sem passo
   (o "Pi está pensando…" que abriu o turno) não vira tarja: some. */
function closeSegment(){
 if(!turnState.turnTrack)return;
 const seg=timeline.closeSegment(turnState.turnTrack,{now:Date.now()});
 if(!seg)return;
 if(timeline.segmentEmpty(seg)){seg.view?.destroy();timeline.removeSegment(turnState.turnTrack,seg);return;}
 renderSegment(seg,{live:false});
}
/* Deltas de pensamento chegam em rajada: repinta no máximo a cada ~90ms. */
function scheduleTurn(){
 if(turnState.renderTimer)return;
 turnState.renderTimer=setTimeout(()=>{turnState.renderTimer=0;if(turnState.turnLog)renderTurn();},90);
}
/* Aposenta os ids de ferramenta do turno recolhido: um evento atrasado que os
   cite não volta a pintar aqui (N1). Teto para não crescer sem fim. */
function retireTurnTools(){
 const add=id=>{
  const value=String(id??'');
  if(!value)return;
  retiredTurnTools.add(value);
  while(retiredTurnTools.size>256)retiredTurnTools.delete(retiredTurnTools.values().next().value);
 };
 if(turnState.turnLog)for(const step of turnState.turnLog.steps||[])if(step?.id!=null)add(step.id);
 for(const id of turnState.turnActivityCalls)add(id);
}
/* A corrida recolhida também é conhecida pelo carimbo do host: um evento
   atrasado que a cite é descartado mesmo com o turno novo ainda sem
   `agent_start`. Só identidade, nunca texto. */
function retireHostRun(){
 if(turnState.turnRunId==null)return;
 const value=String(turnState.turnRunId);
 if(!value)return;
 retiredHostRuns.add(value);
 while(retiredHostRuns.size>64)retiredHostRuns.delete(retiredHostRuns.values().next().value);
}
function settleTurn({reason=''}={}){
 turnState.promptArmed=false;
 retireTurnTools();
 retireHostRun();
 if(!turnState.turnLog){
  turnState.turnClosed=true;
  clearInterval(turnState.liveTick);turnState.liveTick=0;clearTimeout(turnState.renderTimer);turnState.renderTimer=0;
  return;
 }
 worklog.finishLog(turnState.turnLog,{now:Date.now(),reason});
 const segs=timeline.closeAll(turnState.turnTrack,{now:turnState.turnLog.endedAt,reason});
 for(const seg of segs){
  if(timeline.segmentEmpty(seg)){seg.view?.destroy();continue;}
  renderSegment(seg,{live:false});
 }
 finishActivitySlots(reason);
 turnState.turnLog=null;turnState.turnTrack=null;turnState.turnClosed=true;
 resetAssistantBuffers();
 clearInterval(turnState.liveTick);turnState.liveTick=0;
 clearTimeout(turnState.renderTimer);turnState.renderTimer=0;
}

export {resetAssistantBuffers,nextAssistantId,ensureAssistantId,toolResultFor,staleEvent,resetAssistantBlock,appendAssistantDelta,settleAssistantBlock,rememberToolAnchors,assistantAnchorAfter,openTurnLog,openSegment,renderSegment,declareTool,ensureActivitySlot,activitySlotElement,activityDetailsOf,paintLive,renderTurn,closeSegment,scheduleTurn,settleTurn};
