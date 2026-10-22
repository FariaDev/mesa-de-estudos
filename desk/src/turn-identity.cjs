'use strict';
/* Identidade de execução do host Pi (achado N1 da revisão final de 2026-10-08).
 *
 * O RPC do Pi NÃO manda `runId`/`message.id` nos eventos de sessão —
 * `docs/rpc.md` ("Session events generally have no command ID") e
 * `docs/json.md` (o `message_update` na fiação é delta-only) —, então o host
 * deriva a identidade dos cercamentos que o protocolo GARANTE:
 *
 * - `agent_start` abre uma corrida e recebe o id `host-run-N`;
 * - `agent_settled` fecha a corrida e APOSENTA as ferramentas conhecidas;
 * - todo evento de pintura leva o `hostRun` da corrida aberta; sem corrida
 *   aberta ele é descartado no host; referenciando ferramenta aposentada ele
 *   segue marcado `stale` (o renderer descarta por IDENTIDADE — nunca compara
 *   texto; a fala nova do turno seguinte fica intacta).
 *
 * Isso NÃO é um carimbo ingênuo "a corrida de agora" na chegada: quando um
 * atraso chega depois do novo `agent_start`, carimbá-lo com a corrida nova
 * seria mentir. A defesa vem dos dois lados: (1) a corrida só existe entre
 * `agent_start` e `agent_settled` — pintura fora desse intervalo é atraso e
 * não passa; (2) ids conhecidos (`toolCallId` de declaração/execução e de
 * `message_end`) são aposentados no fechamento, então um `message_end` ou
 * `tool_execution_end` atrasado que os referencie é reconhecido e descartado
 * mesmo dentro da corrida seguinte.
 *
 * Limite honesto: um `message_update` de bloco atrasado que não referencia
 * nenhum id (delta de texto sem `message.id`) não é distinguível pelo fio
 * quando chega depois do novo `agent_start`. No contrato documentado isso não
 * acontece — o `abort` só responde depois de `waitForIdle`/`agent_settled` —,
 * e a bolha se reconcilia no `message_end`/`*_start` autoritativos. Host que
 * nunca manda `agent_start` (fixtures legadas) continua funcionando com uma
 * corrida implícita: o modo estrito só liga depois do primeiro `agent_start`.
 *
 * `reset()` é para o CORTE de transporte (novo processo/reconexão no mesmo
 * `PiBridge`): o ledger do processo anterior morre com ele, mas o contador
 * `seq` NÃO volta a zero — a corrida nova continua `host-run-N+1`, então o
 * renderer nunca confunde o atraso da corrida antiga com a nova.
 */

/* Eventos que PINTAM estado no renderer. Fora do intervalo de uma corrida eles
   não têm lugar; aposentados por id, seguem marcados `stale`. */
const PAINT=[
 'message_start','message_update','message_end',
 'tool_execution_start','tool_execution_update','tool_execution_end',
 'auto_retry_start','auto_retry_end',
];

/* Ids de ferramenta citados por um evento: declaração (`toolcall_end`),
   execução (`tool_execution_*`) e mensagem final (`content[].toolCall`). */
function toolIdsOf(event){
 const ids=[];
 const direct=event?.toolCallId;
 if(typeof direct==='string'&&direct)ids.push(direct);
 const call=event?.assistantMessageEvent?.toolCall;
 if(call&&typeof call.id==='string'&&call.id)ids.push(call.id);
 const content=event?.message?.content;
 if(Array.isArray(content)){
  for(const part of content){
   if(part&&part.type==='toolCall'&&typeof part.id==='string'&&part.id)ids.push(part.id);
  }
 }
 return ids;
}

function createTurnIdentity({history=160}={}){
 let seq=0,run=null,open=false,contract=false;
 const tools=[];const retired=new Set();
 const retire=()=>{
  for(const id of tools)retired.add(id);
  tools.length=0;
  while(retired.size>history)retired.delete(retired.values().next().value);
 };
 const openRun=()=>{seq+=1;run=`host-run-${seq}`;open=true;return run;};
 /* Corte/reconexão do transporte: zera o ledger e a corrida aberta do
    processo que morreu; `seq` segue monotônico. */
 function reset(){run=null;open=false;tools.length=0;retired.clear();}
 /* Devolve o evento a encaminhar (com `hostRun`/`stale` quando a corrida é
    conhecida) ou `null` quando a pintura não tem corrida aberta (atraso). */
 function arrive(event){
  if(!event||typeof event!=='object')return event;
  if(event.type==='agent_start'){
   contract=true;
   /* Corrida anterior que nunca fechou (steer/corte): nada dela pode pintar
      depois; aposenta o que ela já tinha declarado antes de abrir a nova. */
   if(open)retire();
   openRun();
   return {...event,hostRun:run};
  }
  if(event.type==='agent_settled'){
   const out=run!=null?{...event,hostRun:run}:event;
   open=false;run=null;retire();
   return out;
  }
  if(event.type==='agent_end')return run!=null?{...event,hostRun:run}:event;
  if(!PAINT.includes(event.type))return event;
  if(!open){
   /* Pi real: pintura sem corrida aberta é atraso/ruído — o renderer já não
      tem turno para receber. Host legado (nunca manda `agent_start`): abre uma
      corrida implícita para não apagar o fluxo que sempre funcionou. */
   if(contract)return null;
   openRun();
  }
  const ids=toolIdsOf(event);
  /* Evento com id aposentado segue marcado como `stale`: o renderer descarta
     por IDENTIDADE (nunca por igualdade/sufixo de texto), então a fala nova
     do turno seguinte não pode ser apagada nem truncada. */
  if(ids.some(id=>retired.has(id)))return {...event,hostRun:run,stale:true};
  for(const id of ids)if(!tools.includes(id))tools.push(id);
  return {...event,hostRun:run};
 }
 return {arrive,reset,state:()=>({run,open,contract,retired:[...retired]})};
}

module.exports={createTurnIdentity,toolIdsOf,PAINT};
