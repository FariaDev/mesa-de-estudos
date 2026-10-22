/* Visão do diário de trabalho do turno. A árvore vem do núcleo
   `core/worklogview.bend`; este arquivo só traduz o log em fatos, aplica no
   DOM (`view-host.mjs`), injeta os SVG e guarda o fold / o relógio.

   Fronteira (medida com `git show 33cf612:desk/src/worklog-view.mjs` × atual):
   o construtor imperativo antigo (article/head/rows passo a passo) não existe
   mais — virou a árvore do núcleo. O que fica no host é: a âncora estável do
   aplicador (o `article.work` do próprio núcleo, atualizado por `patchTree`
   desde a #70 para não piscar a cada token), o relógio de 1 s, o fold
   (`openIds`/`touched`), `atBottom`/`followBottom`, os fatos de `worklog.mjs`
   e os SVG de `icons.mjs` injetados por `innerHTML` em `fillIcons`. */
import {icon} from '../icons.mjs';
import {atBottom,followBottom} from './state.mjs';
import {build,patchTree,preserveFocus} from './view-host.mjs';
import core from './generated/worklogview.core.js';
import {t} from './ui-text.mjs';
import {STEP,formatDuration,headLine,liveLabel,runningStep,stepDetail,stepLabel,stepPreview} from './worklog.mjs';
import {VIEW_KIND_CORE,VIEW_STATUS_CORE} from './worklog-tags.mjs';
import {mascoteMarkup} from './mascote.mjs';

const STEP_ICON={
 [STEP.THINKING]:'sparkles',[STEP.SEARCH]:'search',[STEP.REFERENCE]:'book',
 [STEP.FETCH]:'globe',[STEP.TOOL]:'wrench',[STEP.ERROR]:'alert',
};

/* Construtores do `worklog.bend` como a view os vê (ver `worklog-tags.mjs`). */
const KIND_CORE=VIEW_KIND_CORE;
const STATUS_CORE=VIEW_STATUS_CORE;

function domainOf(url){
 try{return new URL(String(url||'')).hostname.replace(/^www\./,'');}catch{return '';}
}

function listOf(items){
 let out={$:'Nil'};
 for(let i=items.length-1;i>=0;i--)out={$:'Con',head:items[i],tail:out};
 return out;
}

function stepTime(step,now){
 if(step.kind===STEP.THINKING||step.kind===STEP.ERROR)return '';
 const end=step.status==='running'?now:(step.endedAt||step.startedAt);
 return formatDuration(end-step.startedAt);
}

function stepLinks(step){
 const links=[...(step.results||[])];
 if(step.kind===STEP.FETCH&&!links.length&&step.url)links.push({title:step.pageTitle||step.url,url:step.url});
 return links.map(item=>{
  const url=String(item.url||'');
  return {$:'LinkRow',title:String(item.title||item.url||''),url:url||'#',domain:url?domainOf(url):''};
 });
}

function stepText(step){
 const parts=[];
 if(step.kind===STEP.TOOL&&step.args&&Object.keys(step.args).length)parts.push(`Entrada: ${JSON.stringify(step.args).slice(0,600)}`);
 const detail=stepDetail(step);
 if(detail)parts.push(detail);
 return parts.join('\n\n');
}

export function workRowFrom(log,{live=false,expanded=true,note='',now=Date.now(),openIds=new Set()}={}){
 const current=live?runningStep(log):null;
 const title=live?(current?liveLabel(current):(note||t('work.live.idle'))):headLine(log);
 const meta=live?formatDuration(now-(log.startedAt||now)):'';
 const steps=(log.steps||[]).map(step=>{
  const running=step.status==='running';
  const links=stepLinks(step);
  const text=stepText(step);
  const preview=running?stepPreview(step):'';
  const hasDetail=!!(links.length||text);
  const open=hasDetail&&openIds.has(step.id);
  return {
   $:'StepRow',id:String(step.id||''),
   kind:KIND_CORE[step.kind]||KIND_CORE.tool,
   status:STATUS_CORE[step.status]||STATUS_CORE.running,
   open,hasDetail,label:running?liveLabel(step):stepLabel(step),
   time:stepTime(step,now),preview,text,links:listOf(links),
  };
 });
 return {$:'WorkRow',live:!!live,expanded:!!expanded,title,meta,steps:listOf(steps)};
}

/* Cada slot de ícone guarda o nome do que mostra (`data-slot-icon`): no patch,
   slot com o mesmo nome fica como está, e a ∫ do "pensando" não recomeça a
   animação a cada token (#70). */
function fillSlot(slot,name,markup){
 slot.dataset.slotIcon=name;
 slot.innerHTML=markup;
}
const sameIconSlot=(live,fresh)=>!!fresh.dataset.slotIcon&&live.dataset.slotIcon===fresh.dataset.slotIcon;

function fillIcons(root,log,live){
 const mark=root.querySelector('.work-mark');
 if(mark){
  if(live){
   const current=runningStep(log);
   /* Pensando (ou ainda sem passo): a ∫ pequena, pensando, no lugar da faísca
      (#61; a Folhinha saiu na #64). Busca, leitura e ferramenta seguem com o
      ícone do passo. */
   const thinking=!current||current.kind===STEP.THINKING;
   mark.dataset.mascot=thinking?'integral':'';
   const name=thinking?'mascote-integral':STEP_ICON[current.kind]||'sparkles';
   fillSlot(mark,name,thinking?mascoteMarkup({personagem:'integral',humor:'pensando',tamanho:20}):icon(name));
  }else{
   const failed=!!log?.reason||(log?.steps||[]).some(step=>step.status==='error');
   fillSlot(mark,failed?'alert':'check',icon(failed?'alert':'check'));
  }
 }
 const chevron=root.querySelector('.work-chevron');
 if(chevron)fillSlot(chevron,'chevronDown',icon('chevronDown'));
 for(const node of root.querySelectorAll('.work-step')){
  const iconEl=node.querySelector('.step-icon');
  const kindIcon=STEP_ICON[node.dataset.kind]||'wrench';
  if(iconEl)fillSlot(iconEl,kindIcon,icon(kindIcon));
  if(node.dataset.status==='running')continue;
  const status=node.querySelector('.step-status');
  const statusIcon=node.dataset.status==='error'?'alert':node.dataset.status==='stopped'?'stop':'check';
  if(status)fillSlot(status,statusIcon,icon(statusIcon));
 }
}

export function createWorkLogView(){
 /* A âncora (`article.work[data-live][data-expanded]`) é o nó do próprio
    `core/worklogview.bend`: o host não repete a forma (classe/data-*) — só
    troca os filhos a cada render. Os SVG de `icons.mjs` seguem sendo asset do
    host, re-injetados por `fillIcons` (mesma convenção de `pdf.mjs`/`calc.mjs`). */
 const root=build(core.workLog(workRowFrom({steps:[]},{live:true,expanded:true})));

 const openIds=new Set();
 let log=null,live=false,timer=0,touched=false,expanded=true,note='';

 const handlers={
  toggleWork(){
   touched=true;
   expanded=root.dataset.expanded!=='true';
   paint();
  },
  toggleStep(event){
   const row=event.currentTarget.closest('.work-step');
   if(!row||row.dataset.detail!=='true')return;
   const id=row.dataset.key;
   if(!id)return;
   if(openIds.has(id))openIds.delete(id);else openIds.add(id);
   paint();
  },
 };

 function paint(now=Date.now()){
  if(!log)return;
  const stick=atBottom();
  const fresh=build(core.workLog(workRowFrom(log,{live,expanded,note,now,openIds})),handlers);
  fillIcons(fresh,log,live);
  preserveFocus(root,()=>patchTree(root,fresh,sameIconSlot));
  followBottom(stick);
 }

 function stopTimer(){if(timer){clearInterval(timer);timer=0;}}
 /* O tick de 1s só mexe no relógio (meta do turno e tempo do passo running),
    como o pré-rewrite fazia. Um `paint()` inteiro aqui trocaria os nós vivos
    a cada segundo e derrubaria seleção/rolagem do detalhe aberto. */
 function tick(){
  if(!live||!root.isConnected){stopTimer();return;}
  const stick=atBottom();
  const now=Date.now();
  const meta=root.querySelector('.work-meta');
  if(meta)meta.textContent=formatDuration(now-(log.startedAt||now));
  for(const step of log.steps||[]){
   if(step.status!=='running')continue;
   const row=[...root.querySelectorAll('.work-step')].find(node=>node.dataset.key===String(step.id||''));
   const time=row?.querySelector('.step-time');
   if(time)time.textContent=stepTime(step,now);
  }
  followBottom(stick);
 }
 function ensureTimer(){
  if(timer||!live)return;
  timer=setInterval(tick,1000);
 }

 function render(nextLog,{live:isLive=false,note:nextNote=''}={}){
  log=nextLog;
  const wasLive=live;
  live=!!isLive;
  note=nextNote;
  if(live){
   if(!wasLive&&!touched)expanded=true;
   ensureTimer();
  }else{
   stopTimer();
   if(!touched)expanded=false;
  }
  for(const id of [...openIds]){
   const step=(log.steps||[]).find(item=>item.id===id);
   const links=step?stepLinks(step):[];
   const text=step?stepText(step):'';
   if(!step||!(links.length||text))openIds.delete(id);
  }
  paint();
 }

 function destroy(){
  stopTimer();
  root.remove();
 }

 return {el:root,render,destroy};
}
