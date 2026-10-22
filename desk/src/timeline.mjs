/* Linha do tempo do turno: blocos de trabalho, falas e artefatos na ordem em
   que acontecem. Módulo puro (sem DOM, sem relógio próprio) — a visão e a
   fiação dos eventos ficam em `chat.mjs`; o histórico projeta os mesmos
   conceitos em `worklog.mjs#historyTurns`.

   Decisão do plano de 2026-10-08: cada rodada (segmento) tem limites
   EXPLÍCITOS (`from`, `to` e o conjunto de IDs dos passos). O conteúdo de um
   segmento é selecionado por ID (`segmentSteps`), nunca por
   `steps.slice(from)` sem fim: resultado de ferramenta concorrente que chega
   tarde atualiza o segmento ORIGINAL já fechado, e o passo não vaza para o
   segmento seguinte.

   O host cria as views e guarda o relógio; aqui só se decide a estrutura. */

/* Ferramentas que publicam um artefato interativo no chat. O nome é o contrato
   com o tutor (Pi usa o nome da extensão; Claude usa o nome MCP). */
export const ACTIVITY_TOOLS=Object.freeze(['mesa_criar_atividade','mcp__mesa__criar_atividade']);

export function isActivityTool(name){
 return ACTIVITY_TOOLS.includes(String(name||''));
}

/* Parte de artefato no histórico: o slot nasce no ponto da declaração da
   ferramenta, antes da próxima fala — e o `toolCallId` é a identidade estável
   para o renderer hidratar (`div.activity-slot[data-activity-call]`). */
export function artifactPart(toolCallId,name='',at=0){
 return {type:'artifact',toolCallId:String(toolCallId||''),name:String(name||''),at};
}

/* Estado dos segmentos do turno corrente. `gen` identifica a geração (troca de
   turno/conversa); IDs de segmento derivam dele + posição. */
export function createTrack(){
 return {gen:0,segs:[]};
}

export function beginTrack(track){
 track.gen+=1;
 return track;
}

export function resetTrack(track){
 track.gen+=1;
 track.segs.length=0;
 return track;
}

/* Abre um segmento novo quando o último está fechado; reusa o aberto.
   `at` é o índice do primeiro passo (limite inferior explícito). */
export function openSegment(track,{at=0,now=0,extra=null}={}){
 const last=track.segs.at(-1);
 if(last&&!last.closed)return {seg:last,created:false};
 const seg={
  id:`seg-${track.gen}-${track.segs.length+1}`,
  from:Number.isFinite(at)?at:0,
  to:Number.isFinite(at)?at:0,
  ids:new Set(),
  closed:false,
  startedAt:now||0,
  endedAt:0,
  reason:'',
  extra:extra||null,
 };
 track.segs.push(seg);
 return {seg,created:true};
}

export function addStep(seg,stepId){
 if(seg&&!seg.closed)seg.ids.add(String(stepId||''));
 return seg;
}

/* Passo pertence ao segmento aberto no momento em que nasceu. */
export function joinStep(track,stepId,{at=0,now=0}={}){
 const {seg}=openSegment(track,{at,now});
 return addStep(seg,stepId);
}

/* Fecha o último segmento aberto. `to` é o número de passos no fecho (limite
   superior explícito) e `ids` continua sendo a fonte de verdade do conteúdo. */
export function closeSegment(track,{now=0,reason=''}={}){
 const seg=track.segs.at(-1);
 if(!seg||seg.closed)return null;
 seg.closed=true;
 seg.endedAt=now||seg.endedAt;
 seg.to=seg.ids.size;
 if(reason)seg.reason=reason;
 return seg;
}

/* Fecha todos os abertos (fim de turno/erro/troca); devolve todos os segmentos
   para o host renderizar recolhido. */
export function closeAll(track,{now=0,reason=''}={}){
 const out=[];
 for(const seg of track.segs){
  if(seg.closed){out.push(seg);continue;}
  seg.closed=true;
  seg.endedAt=now||seg.endedAt;
  seg.to=seg.ids.size;
  if(reason)seg.reason=reason;
  out.push(seg);
 }
 return out;
}

export function segmentOfStep(track,stepId){
 const id=String(stepId||'');
 if(!id)return null;
 for(let i=track.segs.length-1;i>=0;i--)if(track.segs[i].ids.has(id))return track.segs[i];
 return null;
}

/* Passos do segmento na ordem de início do log (não por slice de índice). */
export function segmentSteps(log,seg){
 if(!seg)return [];
 const ids=seg.ids;
 return (log?.steps||[]).filter(step=>ids.has(String(step.id||'')));
}

export function segmentEmpty(seg){
 return !seg||seg.ids.size===0;
}

export function segmentCount(track){
 return track?.segs?.length||0;
}

export function removeSegment(track,seg){
 const at=track.segs.indexOf(seg);
 if(at>=0)track.segs.splice(at,1);
 return at>=0;
}
