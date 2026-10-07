import {icon} from '../icons.mjs';
import {showHistory,resetAttachments,restoreAttachments} from './chat.mjs';
import {adopt as adoptQueue} from './queue.mjs';
import {renderResumeCard} from './resume.mjs';
import {PdfPanel,makePdfDivider,setPdfSplitPct,pdfSplitValue,pdfRotationsSnapshot,restorePdfRotations} from './pdf.mjs';
import {deactivateGeogebra} from './ggb.mjs';
import {initCalculator} from './calc.mjs';
import {beginCourse as beginSupport,attachPanels as attachSupport} from './support.mjs';
import toastCore from './generated/toastview.core.js';
import statusCore from './generated/statusview.core.js';
import deskFlagsCore from './generated/deskflags.core.js';
import welcomeCore from './generated/welcomeview.core.js';
import {build,childrenOf,preserveFocus,renderChildren,renderInto} from './view-host.mjs';
import {footValues} from './status-foot.mjs';
import {applyHelpFlags} from './dialogs.mjs';
import deliveryCore from './generated/agentdelivery.core.js';

export function $(s){return document.querySelector(s);}
export const S={supportsImages:true,switching:false,modelCatalog:[],library:[],panels:[],pdfDivider:null,connected:false,connecting:null,busy:false,busySince:0,busyStall:0,healthFails:0,refVisible:true,saveTimer:0,currentSession:'',captureOk:false,includeRefs:true,appConfig:{},quizQueue:[],dialogPending:false,activeCourseName:'',currentTheme:'auto',ggbActive:false,currentCourseId:'',workspace:null,autoCompact:false,bookmarks:[],reviewItems:[],reviewActive:false,attachments:[],attachGen:0,deskVersion:'',engine:'pi',agentLabel:'Pi',capabilities:null,conversationStatus:null,uncertain:false,turnCancelled:false};
/* Motor da conversa corrente e capacidades do transporte (contrato do host:
   `engine`, `agentLabel`, `capabilities` vêm em initialData/connect/troca de
   conversa). Sem metadados, vale o comportamento atual do Pi — a UI não pode
   esconder recurso de um motor só porque o host é mais antigo. A escolha do
   motor da PRÓXIMA conversa mora no `#new-session-engine`; o rótulo e o status
   seguem a conversa, nunca o seletor. */
const CAP_KEYS=['images','permissions','steer','compact','autoCompaction','modelSelection','effort','reviewDraft','handoff','commands','geogebra','quiz','contextUsage'];
const ENGINE_LABELS={pi:'Pi',claude:'Claude Code'};
export function engineLabel(engine){return ENGINE_LABELS[engine==='claude'?'claude':'pi'];}
function defaultCapabilities(engine){const out={};for(const key of CAP_KEYS)out[key]=engine!=='claude';return out;}
function normalizeCapabilities(raw,engine){
 const source=raw&&typeof raw==='object'?raw:null;
 const out={};
 for(const key of CAP_KEYS)out[key]=source&&Object.prototype.hasOwnProperty.call(source,key)?source[key]===true:engine!=='claude';
 return out;
}
export function capabilities(){return S.capabilities||defaultCapabilities(S.engine);}
export function supportsCapability(key){return capabilities()[key]===true;}
/* A fila só avança com a decisão provada do núcleo (`core/agentdelivery.bend` →
   `mayAdvanceQueue`): sem turno aberto, sem pedido de permissão pendente, sem
   entrega incerta e sem cancelamento recente. Os fatos são reais — `busy` do
   turno, `dialogPending` do diálogo aberto/fila, a incerteza fixada pela
   conversa e o cancelamento do último turno. */
export function mayAdvanceQueue(){return deliveryCore.mayAdvanceQueue(!!S.busy,!!S.dialogPending,!!S.uncertain,!!S.turnCancelled);}
/* Metadados do motor chegam em initialData/connect/new-session/open-session/
   switch-course. `capabilities` é o nome congelado; `caps` é aceito por
   compatibilidade com o serviço em transição. */
function applyEngineData(data){
 if(!data||typeof data!=='object'||(data.engine!=='pi'&&data.engine!=='claude'))return false;
 S.engine=data.engine;
 S.agentLabel=String(data.agentLabel||engineLabel(S.engine));
 S.capabilities=normalizeCapabilities(data.capabilities||data.caps,S.engine);
 if(data.conversationStatus!==undefined)S.conversationStatus=data.conversationStatus&&typeof data.conversationStatus==='object'?data.conversationStatus:null;
 else if(typeof data.session==='string')S.conversationStatus=null;
 /* Fatos da fila por conversa: a incerteza vem do registro (o host a mantém
    até outra conversa) e o cancelamento é do turno, não da conversa — some na
    troca e no primeiro turno novo. */
 S.uncertain=!!(S.conversationStatus&&S.conversationStatus.uncertain);
 if(typeof data.session==='string'&&data.session!==S.currentSession)S.turnCancelled=false;
 const picker=$('#new-session-engine');
 if(picker)picker.value=S.engine;
 applyEngineFacts();
 return true;
}
/* O que o motor permite esconde/mostra na interface viva. Idempotente: pode ser
   chamado no boot, em cada troca e a cada connect. */
function applyEngineFacts(){
 const caps=capabilities();
 const prompt=$('#prompt');
 if(prompt)prompt.setAttribute('aria-label',`Mensagem para ${S.agentLabel}`);
 const connectButton=$('#connect');
 if(connectButton)labelBtn(connectButton,'plug',`Conectar ao ${S.agentLabel}`);
 /* Rótulo do topo sem conexão (offline/sem login/sem binário): vale o rótulo
    do motor — a conversa Claude nunca aparece como "Pi" só porque o connect
    falhou. Com o Pi conectado, o `updateSettings` troca pelo nome do modelo. */
 if(S.engine!=='pi'||!S.connected){const label=$('#pi-label');if(label)label.textContent=S.agentLabel;}
 const modelField=$('#model-field');if(modelField)modelField.hidden=caps.modelSelection!==true;
 const effortField=$('#effort-field');if(effortField)effortField.hidden=caps.effort!==true;
 const modelSelect=$('#model-select');if(modelSelect&&caps.modelSelection!==true)modelSelect.disabled=true;
 const effortSelect=$('#thinking-select');if(effortSelect&&caps.effort!==true)effortSelect.disabled=true;
 const auto=$('#auto-compact');if(auto&&caps.autoCompaction!==true)auto.hidden=true;
 /* "Resumir contexto" manual: só existe onde o motor compacta; a explicação é
    real (Claude experimental não oferece a compactação pela Mesa — nada de
    chamar o Pi no lugar). O botão vive no painel Ajustes (settings-panel). */
 const compactNow=$('#compact-now');
 if(compactNow){
  const canCompact=caps.compact===true;
  compactNow.disabled=!canCompact;
  compactNow.title=canCompact
   ?'Resumir o contexto da conversa principal agora'
   :'Indisponível neste motor: o Claude Code (experimental) não expõe compactação pela Mesa.';
 }
 if(caps.contextUsage!==true)updateMeter(null);
 /* Avisa o painel Ajustes (settings-panel) para re-sincronizar os controles de
    resumo; o evento evita o ciclo de imports state ↔ settings-panel. */
 try{window.dispatchEvent(new Event('desk-engine-facts'));}catch{}
 refreshHint();
}
/* Fila de toasts e faixa de atividade desenhadas pelo núcleo provado
   (`core/toastview.bend` → `toastview.core.js`). O host mantém os elementos
   vivos e os timers: a saída é uma transição no nó que já está no DOM, e
   recriá-lo cortaria a animação e o `transitionend`. */
const toastQueue=[];

/* Attrs que o núcleo decidiu aplicados num elemento vivo (na saída só as
   classes mudam, no mesmo nó). O que o nó novo não traz sai do elemento — por
   padrão `class` e `hidden`, o que permite aplicar `#ctx-tip` sem recriá-lo.
   Controles com estado de host (`#status-dot`, `#session-select`) passam uma
   lista maior: sem ela, um `data-tip`/`disabled` velho sobreviveria ao estado
   novo. */
function applyAttrs(el,node,drop=['class','hidden']){
 const built=build(node);
 for(const attr of built.attributes)el.setAttribute(attr.name,attr.value);
 for(const name of drop)if(!built.hasAttribute(name))el.removeAttribute(name);
 return built;
}
/* Aplica os atributos de um nó de controle vivo: os filhos são do index.html
   (texto, ícone injetado e handlers), então só os attrs entram. */
function applyAttrsOn(selector,node){
 const el=$(selector);
 if(el)applyAttrs(el,node);
}
/* Aplica a árvore da faixa no contêiner fixo do index.html: attrs + filhos.
   Não troca o elemento — o mount tem id/role do HTML e o host guarda estado
   nele (o `_tipText` do medidor, o foco). */
function applyView(mount,node){
 applyAttrs(mount,node);
 preserveFocus(mount,()=>renderChildren(mount,childrenOf(node.kids)));
}
function toastNode(item){return toastCore.toastItem({$:'Toast',text:item.text,closing:item.closing});}
export function toast(text){
 if(!text||text==='stopped')return;
 const box=$('#toast');if(!box)return;
 const item={text:String(text),closing:false};
 if(toastQueue.length>=3){const old=toastQueue.shift();clearTimeout(old.timer);old.el.remove();}
 toastQueue.push(item);
 const el=item.el=build(toastNode(item));
 box.append(el);
 const remove=()=>{clearTimeout(item.timer);el.remove();const at=toastQueue.indexOf(item);if(at>=0)toastQueue.splice(at,1);};
 el.addEventListener('transitionend',remove,{once:true});
 item.timer=setTimeout(()=>{
  item.closing=true;
  applyAttrs(el,toastNode(item));
  item.timer=setTimeout(remove,600);
 },3200);
}
/* O ponto de conexão é árvore do núcleo (`core/statusview.bend` → `statusDot`):
   classe, `data-tip` e `aria-label` vêm dos fatos. O elemento do index.html
   continua o mesmo (o tooltip delega por identidade) e o `title` que o
   tooltip.mjs devolve ao sair do hover não sobrevive à troca de estado. */
function connStateOf(state){
 if(state==='connecting')return{$:'ConnConnecting'};
 if(state==='online')return{$:'ConnOnline'};
 if(state==='error')return{$:'ConnError'};
 return{$:'ConnOff'};
}
export function connectionState(state,label){
 const dot=$('#status-dot');if(!dot)return;
 applyAttrs(dot,statusCore.statusDot(connStateOf(state),String(label||'')),['class','hidden','data-tip','title']);
}
export function activity(text){const box=$('#activity');if(box)applyView(box,toastCore.activityView(String(text||'')));}
/* Passo ao vivo no lugar da linha simples: ponto pulsante + rótulo curto. */
export function activityLive(text){const box=$('#activity');if(box)applyView(box,toastCore.activityLiveView(String(text||'')));}
/* Rolagem: seguir só quando o usuário já está no fim (medido antes da mutação).
   Em janelas baixas (media query `max-height:700px`) o `#chat` vira o scroller
   e o `#messages` cresce com o conteúdo; nos tamanhos normais o `#messages`
   continua sendo o scroller — até que o conteúdo deixe de caber (Ajustes
   aberto, calculadora grande, anexos…). Aí o host liga `body.chat-scroll` e a
   conversa entra no MESMO modo da janela baixa: o `#chat` rola, o `#messages`
   cresce; nesse modo adaptativo o composer fica ao fim, sem cobrir mensagens.
   O que decide é o overflow real da coluna,
   não a altura da janela: o composer nunca mais vaza por cima da calculadora. */
function messageScroller(){
 const chat=$('#chat'),messages=$('#messages');
 if(chat&&messages&&chat.scrollHeight>chat.clientHeight+1)return chat;
 return messages;
}
/* Mede se a coluna precisa do modo de rolagem e liga/desliga
   `body.chat-scroll`. Em coluna normal o painel Ajustes encolhe sozinho
   (flex) — o overflow real só aparece quando nem o piso do painel basta; aí o
   modo rolagem liga. No modo rolagem o painel fica inteiro e o #messages cresce
   com o conteúdo, então o modo sai quando o normal caberia de novo com o painel
   no piso (32px = o toggle) e o #messages nos 84px mínimos — os dois modos
   medem o mesmo composer, então a conta fecha sem piscar. Entrar leva a
   conversa ao fim quando ela já estava no fim (o composer não deve nascer
   escondendo a última mensagem). Em `max-height:700px` quem manda é a media
   query — a classe não é usada. */
export function syncChatScrollMode(){
 const chat=$('#chat');if(!chat)return;
 const compact=window.matchMedia?.('(max-height:700px)')?.matches===true;
 const on=document.body.classList.contains('chat-scroll');
 if(compact){if(on)document.body.classList.remove('chat-scroll');return;}
 const messages=$('#messages');
 if(on&&messages){
  const panel=$('#pi-settings-panel');
  const panelH=panel?panel.getBoundingClientRect().height:0;
  const panelFloor=panel?32:0;
  const chrome=chat.scrollHeight-messages.getBoundingClientRect().height;
  if(chrome-panelH+panelFloor+84>chat.clientHeight+1)return;
  document.body.classList.remove('chat-scroll');
  return;
 }
 if(chat.scrollHeight>chat.clientHeight+1){
  const stick=!messages||messages.scrollHeight-messages.scrollTop-messages.clientHeight<=80;
  document.body.classList.add('chat-scroll');
  if(stick)chat.scrollTop=chat.scrollHeight;
 }
}
let chatScrollWatch=null,chatScrollFrame=0;
/* O ResizeObserver entrega no meio do próprio layout: ligar/desligar
   `body.chat-scroll` ali dentro re-dispara notificações ainda na mesma entrega
   ("ResizeObserver loop completed with undelivered notifications"). O sync do
   observador vai para o próximo frame (singular); as chamadas explícitas
   (histórico/Ajustes) continuam síncronas, que é o contrato delas. */
function scheduleChatScrollMode(){
 cancelAnimationFrame(chatScrollFrame);
 chatScrollFrame=requestAnimationFrame(()=>{chatScrollFrame=0;syncChatScrollMode();});
}
/* A coluna muda de tamanho por causa dela mesma (janela/divisória) ou do que
   entra nela (Ajustes, estudo, anexos, fila, mensagens). Observar o #chat e os
   filhos cobre os dois: o RO avisa quando qualquer um desses caixas muda. */
function watchChatScroll(){
 const chat=$('#chat');if(!chat||chatScrollWatch)return;
 chatScrollWatch=new ResizeObserver(scheduleChatScrollMode);
 chatScrollWatch.observe(chat);
 for(const el of [chat.querySelector('.chat-head'),$('#pi-settings-panel'),$('#study-context'),$('#messages'),$('#activity'),$('#composer')]){
  if(el)chatScrollWatch.observe(el);
 }
 syncChatScrollMode();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watchChatScroll,{once:true});else watchChatScroll();
export function atBottom(threshold=80){
 const el=messageScroller();
 if(!el)return true;
 return el.scrollHeight-el.scrollTop-el.clientHeight<=threshold;
}
export function followBottom(stick){
 if(!stick)return;
 const el=messageScroller();
 if(el)el.scrollTop=el.scrollHeight;
}
function pdfSnapshot(){return S.panels.map(p=>({path:p.path,page:p.page,zoom:p.zoom,rotation:p.rotation||0,scrollX:p.scrollX||0,scrollY:p.scrollY||0,invert:!!p.invert,minimized:!!p.minimized}));}
export function calcHeightPx(){return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--calc'))||220;}
export function studySnapshot(){return {title:$('#exercise-title').value.trim(),xopp:$('#pick-xopp').dataset.path||''};}
/* Páginas abertas (caminho + página) para o registro do Encerrar: os PDFs da
   mesa na ordem dos painéis — a forma e o teto saem do núcleo (`core/resume.bend`). */
export function pageRefs(){return S.panels.filter(p=>p.path).map(p=>({path:p.path,page:p.page}));}
export function layoutSnapshot(){return {draft:$('#prompt').value,study:studySnapshot(),pdfs:pdfSnapshot(),pdfRotations:pdfRotationsSnapshot(),pdfSplit:pdfSplitValue(),referenceVisible:S.refVisible,chatWidth:parseInt(getComputedStyle(document.documentElement).getPropertyValue('--chat')),calcHeight:calcHeightPx(),theme:S.currentTheme};}
export function save(immediate=false){clearTimeout(S.saveTimer);if(immediate){window.desk.save(layoutSnapshot()).catch(e=>toast(e.message));return;}S.saveTimer=setTimeout(()=>window.desk.save(layoutSnapshot()).catch(e=>toast(e.message)),400);}
export function refs(){return S.includeRefs?S.panels.filter((p,i)=>p.path&&(i===0||S.refVisible)).map(p=>({path:p.path,page:p.page})):[];}
/* Estado das referências no composer (pedido 4): texto claro + detalhes no
   popover. O toggle continua sendo o `#include-refs`; este botão só informa. */
function refsStateText(list){if(!S.includeRefs||!list.length)return 'Sem referências';return 'PDF e página incluídos';}
export function updateRefsState(){
 const button=$('#refs-state');
 if(!button)return;
 const list=refs();
 const text=refsStateText(list);
 if(button.textContent!==text)button.textContent=text;
 button.dataset.state=text==='Sem referências'?'off':'on';
 button.title=text==='Sem referências'
  ?'Nenhuma referência de PDF vai junto desta mensagem — clique para ver os detalhes'
  :'Clique para ver quais caminhos e páginas vão junto desta mensagem';
}
export function updateContextSummary(){
 const parts=[];const enabled=S.appConfig.desk?.studyContext!==false;if(enabled&&S.activeCourseName)parts.push(S.activeCourseName);const study=enabled?studySnapshot():{};if(study.title)parts.push(study.title);if(study.xopp)parts.push(study.xopp.split(/[/\\]/).at(-1));
 const open=refs();if(open.length)parts.push(open.map(r=>`${r.path.split(/[/\\]/).at(-1)} p.${r.page}`).join(', '));
 $('#context-summary').textContent='Contexto enviado: '+(parts.length?parts.join(' · '):'nenhum');
 $('#context-summary').title=$('#context-summary').textContent;
 updateRefsState();
}
export function updateWindowTitle(){document.title=[S.appConfig.desk?.title||'Mesa de Estudos',S.activeCourseName,S.panels[0]?.doc?`p. ${S.panels[0].page}`:''].filter(Boolean).join(' — ');}
function compactCount(value){
 const n=Math.max(0,Number(value)||0);
 if(n<10000)return n.toLocaleString('pt-BR');
 if(n<1000000)return `${(n/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})} mil`;
 return `${(n/1000000).toLocaleString('pt-BR',{maximumFractionDigits:1})} mi`;
}
/* O medidor é nó vivo do index.html (a barra anima por transição de largura);
   as decisões — `hidden`, cortes warn/hot, `%` e largura — vêm do
   `statusview.ctxMeter`/`meterText`/`meterWidth`, mas o nó do medidor não é
   recriado: `hidden`/`class` entram no `#ctx-meter` e a largura/texto nos
   `i`/`em` que já estão lá (recriá-los cortaria a animação). A porcentagem
   chega ao núcleo já arredondada (contrato do statusview), então o corte
   acompanha o mostrador. O texto do balão (tokens formatados) é fato do host
   e vai pelo `#ctx-tip` da onda 4. */
function updateMeter(usage){
 const meter=$('#ctx-meter');if(!meter)return;
 if(capabilities().contextUsage!==true)usage=null;
 const visible=!!usage&&Number.isFinite(usage.percent);
 const pct=visible?Math.round(Math.min(100,Math.max(0,Number(usage.percent)))):0;
 const nat=BigInt(pct);
 applyAttrs(meter,statusCore.ctxMeter(visible,nat));
 if(!visible){footValues({context:'',tip:''});return;}
 const bar=meter.querySelector('i');if(bar)bar.setAttribute('style',statusCore.meterWidth(nat));
 const em=meter.querySelector('em');if(em)em.textContent=statusCore.meterText(nat);
 const text=`Contexto do modelo: ${pct}% · ${compactCount(usage.tokens)} de ${compactCount(usage.contextWindow)} tokens usados · /compact compacta`;
 meter.title=text;
 setMeterTip(text);
 footValues({context:statusCore.meterText(nat),tip:text});
}
/* O balão do medidor é árvore do núcleo (`core/statusview.bend` → `ctxTip`):
   texto e `hidden` são fatos; medir, posicionar e os eventos de hover/foco (e o
   clique no rodapé) ficam aqui. O `#ctx-tip` é nó vivo do index.html: o host
   guarda o texto corrente em `_tipText` para o toggle do rodapé. */
function paintMeterTip(hidden){
 const meter=$('#ctx-meter'),tip=$('#ctx-tip');
 if(!meter||!tip)return;
 applyView(tip,statusCore.ctxTip(meter._tipText||'',!!hidden));
}
function placeMeterTip(){
 const meter=$('#ctx-meter'),tip=$('#ctx-tip');
 if(!meter||!tip)return;
 const r=meter.getBoundingClientRect();
 tip.style.left=Math.round(Math.max(8,Math.min(r.left,innerWidth-tip.offsetWidth-8)))+'px';
 tip.style.top=Math.round(r.bottom+6)+'px';
}
function setMeterTip(text){
 const meter=$('#ctx-meter'),tip=$('#ctx-tip');
 if(!meter||!tip)return;
 meter._tipText=String(text||'');
 if(tip.textContent===meter._tipText){placeMeterTip();return;}
 paintMeterTip(tip.hidden);
 placeMeterTip();
}
function wireMeterTip(){
 const meter=$('#ctx-meter');if(!meter)return;
 const hide=()=>{paintMeterTip(true);};
 const show=()=>{const tip=$('#ctx-tip');if(!tip||!meter._tipText)return;paintMeterTip(false);setMeterTip(meter._tipText);};
 meter.addEventListener('mouseenter',show);
 meter.addEventListener('mouseleave',hide);
 meter.addEventListener('focusin',show);
 meter.addEventListener('focusout',hide);
}
wireMeterTip();
/* Com o balão aberto, um resize pode deixá-lo fora da janela: reposiciona com a
   mesma lógica do `setMeterTip` (mede o medidor e trava nas bordas). */
window.addEventListener('resize',()=>{const tip=$('#ctx-tip');if(tip&&!tip.hidden)placeMeterTip();});
export function toggleMeterTip(){
 const meter=$('#ctx-meter'),tip=$('#ctx-tip');
 if(!meter||!tip||meter.hidden)return;
 if(!tip.hidden){paintMeterTip(true);return;}
 const text=meter._tipText||'';
 if(!text)return;
 paintMeterTip(false);setMeterTip(text);
}
export async function refreshMeter(){
 /* O medidor é genérico: quem informa o uso é `health().contextUsage`; motor
    sem a capacidade não mostra medidor (o host pode responder sem ele). */
 if(capabilities().contextUsage!==true){updateMeter(null);return;}
 try{const data=await window.desk.health();if(data?.contextUsage)updateMeter(data.contextUsage);}catch{}
}
/* O botão é árvore do núcleo (`statusview.autoCompact`): `hidden` sem conexão,
   `aria-pressed` + `.on` e o tooltip em `data-tip`. O elemento do index.html
   fica (o texto e o `onclick` são dele); o `title` estático vira o `data-tip`
   do núcleo e **sai do nó** (drop) — o `tooltip.mjs` prefere `title` e o
   `data-tip` ficaria inerte até o primeiro arm/reset. */
const AUTO_COMPACT_TIP=$('#auto-compact')?.getAttribute('title')||'';
function renderAutoCompact(piState){
 const button=$('#auto-compact');if(!button)return;
 S.autoCompact=!!piState?.autoCompactionEnabled;
 const canAuto=capabilities().autoCompaction===true;
 applyAttrs(button,statusCore.autoCompact(!!S.connected&&canAuto,S.autoCompact,AUTO_COMPACT_TIP),['class','hidden','title']);
}
$('#auto-compact').onclick=async()=>{
 if(capabilities().autoCompaction!==true){toast('A compactação automática não está disponível neste motor.');return;}
 const button=$('#auto-compact');
 try{
  const r=await window.desk.autoCompaction(button.getAttribute('aria-pressed')!=='true');
  renderAutoCompact({autoCompactionEnabled:r?.autoCompactionEnabled});
  updateMeter(r?.contextUsage);
  toast(`Compactação automática ${r?.autoCompactionEnabled?'ativada':'desativada'}.`);
 }catch(e){toast(e.message);}
};
/* As opções do seletor de conversa são árvore do núcleo
   (`statusview.sessionSelect`): o rótulo visível e o `selected` da conversa
   corrente saem daqui. O `disabled` é fato do turno (`setBusy`) e o render
   preserva o estado vivo — quem o escreve continua sendo o host. O elemento
   do index.html fica (o `onchange` é dele). */
function sessionChoices(sessions){
 let out={$:'Nil'};
 for(let i=(sessions||[]).length-1;i>=0;i--){
  const s=sessions[i]||{};
  out={$:'Con',head:{$:'SessionChoice',label:String(s.label||s.path||''),path:String(s.path||'')},tail:out};
 }
 return out;
}
export function fillSessions(data){
 /* Metadados do motor (engine/agentLabel/capabilities) entram ANTES do
    connect: o rótulo, o seletor da próxima conversa e os controles gated
    dependem da conversa que está abrindo. */
 if(data&&typeof data==='object')applyEngineData(data);
 const sel=$('#session-select');if(!sel)return;
 const previousSession=S.currentSession;
 S.currentSession=data.session||S.currentSession;
 if(previousSession!==S.currentSession)window.dispatchEvent(new Event('desk-conversation-changed'));
 const node=statusCore.sessionSelect(S.currentSession,!!(S.busy||S.connecting||S.switching),sessionChoices(data.sessions));
 applyAttrs(sel,node);
 renderChildren(sel,childrenOf(node.kids));
 /* Caminho fora da lista: o app zera a seleção (o browser escolheria a 1ª). */
 if(S.currentSession)sel.value=S.currentSession;
}
export function applyStudy(study={}){$('#exercise-title').value=study.title||'';$('#pick-xopp').dataset.path=study.xopp||'';$('#pick-xopp').textContent=study.xopp?study.xopp.split(/[/\\]/).at(-1):'Rascunho .xopp';$('#pick-xopp').title=study.xopp||'Associar arquivo do Xournal++';updateContextSummary();}
/* O requisito de visão saiu daqui: anexar a captura não exige modelo com
   imagem — o aviso fica no `addAttachments`/envio. disabled/title do #check são
   só deste applier; o hidden é do `core/deskflags.bend` (flag conferir). */
function conferirEnabled(){return S.captureOk&&!S.busy;}
function updateCheckButton(){const el=$('#check');if(!el)return;el.disabled=!conferirEnabled();el.title=S.captureOk?'Anexar a captura do Xournal++ à mensagem':'Conferir Xournal++ indisponível neste computador';}
export function setBusy(value){S.busy=value;footValues({busy:value});if(value){if(!S.busySince)S.busySince=Date.now();}else{S.busySince=0;S.busyStall=0;}setTabsDisabled(value||!!S.connecting||S.switching);const locked=value||!!S.connecting||S.switching;if($('#session-select'))$('#session-select').disabled=locked;if($('#new-session-engine'))$('#new-session-engine').disabled=locked;$('#model-select').disabled=value||S.uncertain||!S.connected||capabilities().modelSelection!==true;$('#thinking-select').disabled=value||S.uncertain||!S.connected||capabilities().effort!==true;$('#stop').hidden=!value;$('#attach').disabled=value;$('#send').disabled=value;updateCheckButton();refreshHint();if(value)activity(`${S.agentLabel} está pensando…`);else if(S.connected)activity('');}
function setTabsDisabled(value){
 for(const control of document.querySelectorAll('#course-tabs button,#session-select,#new-session-engine,#new-session'))control.disabled=!!value;
}
/* Dica do composer reativa ao estado. Ocupado: o ⏎ enfileira (queue.mjs) e o
   ⌘/Ctrl+⏎ interrompe e envia (steer) — o mesmo texto da Conversa. Motor sem
   steer não promete interrupção: só anuncia que o ⏎ enfileira. */
const IS_MAC=typeof navigator!=='undefined'&&navigator.userAgent.includes('Mac');
export function refreshHint(){
 const hint=$('#composer-hint');
 if(!hint)return;
 /* A dica só anuncia a captura quando o recurso existe: flag `conferir` ligada
    E captura disponível neste computador (o menu nativo segue a mesma flag). */
 const capture=S.appConfig.desk?.conferir!==false&&!!S.captureOk;
 const capturePart=capture?` · ${IS_MAC?'⌘':'Ctrl+'}⇧C anexa a captura do Xournal++`:'';
 if(S.busy){
  if(capabilities().steer!==true){hint.textContent=`${S.agentLabel} respondendo… ⏎ enfileira`;return;}
  hint.textContent=`${S.agentLabel} respondendo… ⏎ enfileira · ${IS_MAC?'⌘⏎':'Ctrl+⏎'} interrompe e envia`;
  return;
 }
 hint.textContent=`⏎ envia · ⇧⏎ quebra linha${capturePart} · ← → muda a página · rolagem contínua`;
}
refreshHint();
function updateSettings(result){
 if(result?.engine)applyEngineData(result);
 if(Array.isArray(result?.models))S.modelCatalog=result.models;
 const current=result?.state?.model;
 /* Imagem: a capacidade do motor é estrutural (Claude transporte) e o modelo,
    quando conhecido, ainda precisa listar `image` — nunca dizemos "visão
    validada". Sem modelo conhecido (ex.: Claude), vale a capacidade. */
 const known=!!current&&Array.isArray(current.input);
 S.supportsImages=capabilities().images===true&&(!known||current.input.includes('image'));
 updateMeter(result?.contextUsage||result?.state?.contextUsage);
 renderAutoCompact(result?.state);
 updateCheckButton();
 $('#model-select').replaceChildren(...S.modelCatalog.map(m=>new Option(`${m.name||m.id} · ${m.provider}`,JSON.stringify([m.provider,m.id]))));
 if(S.engine==='claude'&&result?.state?.selection)$('#model-select').value=JSON.stringify(['anthropic',result.state.selection.model||'']);
 else if(current)$('#model-select').value=JSON.stringify([current.provider,current.id]);
 const labels={default:'Padrão do Claude',off:'Desligado',minimal:'Mínimo',low:'Baixo',medium:'Médio',high:'Alto',xhigh:'Muito alto',max:'Máximo'};
 $('#thinking-select').replaceChildren(...(result?.levels||[]).map(l=>new Option(labels[l]||l,l)));
 $('#thinking-select').value=result?.state?.thinkingLevel||(S.engine==='claude'?'default':'off');
 const level=result?.state?.thinkingLevel||(S.engine==='claude'?'default':'off');
 const picked=current?S.modelCatalog.find(m=>m.provider===current.provider&&m.id===current.id):null;
 footValues({model:picked?`${picked.name||picked.id} · ${picked.provider}`:'',level:labels[level]||level});
 $('#model-select').disabled=S.busy||S.uncertain||capabilities().modelSelection!==true;
 $('#thinking-select').disabled=S.busy||S.uncertain||capabilities().effort!==true;
 /* O rótulo do topo segue a conversa: com modelo conhecido (Pi), o nome do
    modelo; sem ele (Claude), o rótulo do motor. */
 $('#pi-label').textContent=(S.engine==='pi'&&(current?.name||current?.id))||S.agentLabel||'Pi';
 /* A dica anuncia a captura conforme a flag/disponibilidade medidas agora. */
 refreshHint();
}
export async function settings(change){
 if(S.uncertain&&(change?.model||change?.level)){toast('A entrega anterior está incerta; comece outra conversa para mudar os controles.');return;}
 if(change?.model&&capabilities().modelSelection!==true){toast('A escolha de modelo não está disponível neste motor.');return;}
 if(change?.level&&capabilities().effort!==true){toast('A escolha de esforço não está disponível neste motor.');return;}
 $('#model-select').disabled=true;$('#thinking-select').disabled=true;
 try{updateSettings(await window.desk.settings(change));}catch(e){toast(e.message);try{updateSettings(await window.desk.settings({}));}catch{}}
 finally{$('#model-select').disabled=S.busy||S.uncertain||capabilities().modelSelection!==true;$('#thinking-select').disabled=S.busy||S.uncertain||capabilities().effort!==true;}
}
export const THEME_LABELS={auto:'Tema: auto',light:'Tema: claro',dark:'Tema: escuro'};
/* O glifo do item de tema acompanha o estado (mesmo mapa do `themeIcon` do
   núcleo): auto = contraste, claro = sol, escuro = lua. */
export const THEME_ICONS={auto:'contrast',light:'sun',dark:'moon'};
export function applyTheme(value){
 S.currentTheme=['light','dark'].includes(value)?value:'auto';
 if(S.currentTheme==='auto')delete document.documentElement.dataset.theme;
 else document.documentElement.dataset.theme=S.currentTheme;
 const btn=$('#theme-cycle');if(btn)labelBtn(btn,THEME_ICONS[S.currentTheme],THEME_LABELS[S.currentTheme]);
 /* O select das Configurações acompanha a troca pelo menu (o Salvar manda). */
 const mode=$('#theme-mode');if(mode)mode.value=S.currentTheme;
}
export function labelBtn(el,name,text){if(!el)return;el.innerHTML=`${icon(name)}${text?` <span>${text}</span>`:''}`;}
/* O vazio da conversa é árvore do núcleo (`core/welcomeview.bend`): o título é
   a matéria da troca e o clique do botão cai na tabela do view-host. O SVG do
   botão é asset do host (`icons.mjs`), como nas abas. */
export function showWelcome(title){
 const box=$('#messages');if(!box)return;
 renderInto(box,welcomeCore.welcomeView(String(title||'')),{Connect:()=>connect().catch(()=>{})});
 labelBtn($('#connect'),'plug',`Conectar ao ${S.agentLabel}`);
}
export async function connect(){
 if(S.connected)return;
 if(S.connecting)return S.connecting;
 setTabsDisabled(true);$('#pi-label').textContent='Conectando…';connectionState('connecting',`Conectando ao ${S.agentLabel}`);activity(`Abrindo a sessão do ${S.agentLabel}…`);
 const picker=$('#new-session-engine');if(picker)picker.disabled=true;
 let hung=0;
 S.connecting=(async()=>{
  const timer=setTimeout(()=>{hung=1;},90000);
  try{
   const result=await window.desk.connect();
   /* Metadados do motor ANTES de qualquer gating/estado: o host roteia o
      connect pelo motor da conversa (nunca inicia Pi numa conversa Claude). */
   applyEngineData(result);
   S.connected=true;S.healthFails=0;S.modelCatalog=result.models||[];if(result.captureAvailable!=null)S.captureOk=!!result.captureAvailable;updateSettings(result);fillSessions(result);updateWindowTitle();connectionState('online',`${S.agentLabel} conectado`);activity(`${S.agentLabel} conectado.`);
   setTimeout(()=>{if(S.connected&&!S.busy&&$('#activity').textContent===`${S.agentLabel} conectado.`)activity('');},2500);
   if(result.conversationStatus?.uncertain)toast('Há uma entrega incerta nesta conversa — confira antes de reenviar.');
   if(result.messages?.length)showHistory(result.messages);else $('#welcome')?.remove();
  }catch(e){
   toast(hung?`A conexão do ${S.agentLabel} demorou demais; a interface foi destravada. Tente de novo.`:e.message);
   S.connected=false;$('#pi-label').textContent=S.agentLabel;connectionState('error',`Falha ao conectar ao ${S.agentLabel}`);activity(hung?`A conexão do ${S.agentLabel} demorou demais.`:`Erro de conexão: ${e.message}`);
   throw e;
  }finally{
   clearTimeout(timer);
   S.connecting=null;setTabsDisabled(S.busy||S.switching);
   if(picker)picker.disabled=S.busy||S.switching;
  }
 })();
 return S.connecting;
}
export function markCourseTab(id){
 for(const t of document.querySelectorAll('#course-tabs button[role="tab"]')){
  const active=t.dataset.id===id;t.classList.toggle('active',active);t.setAttribute('aria-selected',String(active));
 }
 updateWindowTitle();
}
/* Fatos das abas de matéria: a árvore é do `core/tabsview.bend` (o `main.mjs`
   aplica com o view-host); aqui ficam só os fatos que o resto do host usa — o
   nome da matéria ativa (título da janela e resumo de contexto), o id (aba
   ativa) e o "desabilitado" de conexão/troca. */
function updateCourseFacts(data){
 S.activeCourseName=data.course||'';
 S.currentCourseId=data.courseId||'';
 setTabsDisabled(S.busy||!!S.connecting||S.switching);
}
function applyDesk(desk){
 const title=desk?.title||'Mesa de Estudos';
 const brand=$('.brand strong');if(brand)brand.textContent=title;
 const specs=desk?.panels?.length?desk.panels:[{label:'Enunciado'},{label:'Formulário & apoio',toggle:'Formulário'}];
 const two=specs.length>1;
 /* `#reference-toggle` (hidden e rótulo) e `#xournal` (hidden) são decididos
    pelo `core/tabsview.bend` e aplicados no `renderMenus` do `main.mjs` — o
    mesmo fato do `desk` normalizado. O `aria-pressed` do toggle continua no
    host: o clique o atualiza sem re-render. */
 const flags={refsToggle:desk?.refsToggle!==false,endDay:desk?.endDay!==false,studyContext:desk?.studyContext!==false,conferir:desk?.conferir!==false};
 if(!flags.refsToggle)S.includeRefs=true;
 /* Os controles vivos do composer/sidebar (botão de referências, contexto de
    estudo, Conferir e o divisor da calculadora) são view do
    `core/deskflags.bend`: a flag vira `hidden` e, sem o botão de referências,
    o `aria-pressed` fica forçado em true (as referências seguem ligadas). Só
    atributos entram — texto, ícone e handlers são do index.html. O `#end-day`
    saiu daqui: virou item do menu Estudar, decidido pelo `core/tabsview.bend`
    com o fato `endDay` do `menuFactsOf`. */
 const facts={$:'DeskFlags',refsToggle:flags.refsToggle,includeRefs:!!S.includeRefs,studyContext:flags.studyContext,conferir:desk?.conferir!==false,calculator:desk?.calculator!==false};
 applyAttrsOn('#include-refs',deskFlagsCore.includeRefsButton(facts));
 applyAttrsOn('#study-context',deskFlagsCore.studyContextRow(facts));
 applyAttrsOn('#check',deskFlagsCore.conferirButton(facts));
 applyAttrsOn('#calc-divider',deskFlagsCore.calcDivider(facts));
 /* Itens do texto da ajuda: a decisão (`hidden`) vem do Bend (dialogsview). */
 applyHelpFlags(flags);
 /* A visibilidade da calculadora é decisão do `core/calcview.bend`; o render
    de boot do adaptador acontece antes do config, então re-aplicamos a view
    aqui com o fato já resolvido. */
 initCalculator();
 return {title,specs,two,flags};
}
let courseLoadGeneration=0;
export async function loadCourse(data,{publishWorkspace=true}={}){
 const loadGeneration=++courseLoadGeneration;
 const previousCourseId=S.currentCourseId;
 const previousSession=S.currentSession;
 S.workspace=data.workspace||{kind:data.courseId==='mesa-free'?'free':'course',id:data.courseId||''};
 updateCourseFacts(data);
 S.quizQueue=[];
 resetAttachments();
 S.captureOk=!!data.captureAvailable;
 S.appConfig={...(data.config||S.appConfig),platform:data.platform||S.appConfig.platform};
 S.deskVersion=data.deskVersion||S.deskVersion;
 const desk=applyDesk(S.appConfig.desk);
 fillSessions(data);
 /* Matéria diferente com a MESMA sessão (promoção Livre→matéria transfere a
    conversa): o `fillSessions` avisa na troca de sessão; aqui o escopo também
    mudou para quem congela matéria+sessão (chat lateral/avisos). */
 if(previousCourseId!==S.currentCourseId&&previousSession===S.currentSession)window.dispatchEvent(new Event('desk-conversation-changed'));
 $('#prompt').value=data.state.draft||'';
 applyTheme(data.state.theme);
 // Esconder o recurso não apaga a questão nem o arquivo associado.
 applyStudy(data.state.study);
 /* Fila e bandeja guardadas da conversa: a faixa volta com o que ainda não foi
    aceito pelo Pi e os anexos pendentes voltam para a bandeja. Fila de outra
    execução nasce segurada — nada é enviado sozinho. */
 adoptQueue(data.pending);
 restoreAttachments(data.pending);
 for(const p of S.panels){p.version++;p.resize.disconnect();clearTimeout(p.resizeTimer);clearTimeout(p.zoomTimer);cancelAnimationFrame(p._visibleFrame);p.cancelRenders();}
 $('#pdf-grid').replaceChildren();S.library=data.library||[];
 /* Orientação por caminho: o mapa da matéria volta antes dos painéis, então o
    `load` de cada leitor já encontra a volta salva (legado sem mapa = 0). */
 restorePdfRotations(data.state.pdfRotations);
 /* Histórico Claude cacheado no descritor: o `init`/troca de conversa já o
    entrega e ele NÃO depende do connect ter dado certo — offline ou sem login,
    o que já foi conversado continua na tela (nunca um fallback para o Pi). O
    connect bem-sucedido reaplica a mesma lista depois. */
 if(Array.isArray(data.messages))showHistory(data.messages);
 /* Favoritos nomeados da matéria (popover do leitor): a lista inteira vem do
    main a cada troca de matéria — o nav.mjs monta as linhas do popover com isto. */
 S.bookmarks=Array.isArray(data.bookmarks)?data.bookmarks:[];
 S.reviewItems=Array.isArray(data.review)?data.review:[];
 S.panels=desk.specs.map((spec,i)=>new PdfPanel(i,spec.label));
 S.pdfDivider=desk.two?makePdfDivider():null;
 if(S.pdfDivider)S.pdfDivider.title='Arraste para redimensionar os leitores';
 if(desk.two)S.panels[0].el.classList.add('pinned');
 /* Visibilidade do 2º painel ANTES do primeiro await: junto com o chrome
    (desk-chrome) o boot fica visível inteiro de uma vez — teste e usuário não
    leem o layout pela metade enquanto os PDFs carregam. */
 if(desk.two){
  S.refVisible=data.state.referenceVisible!==false;S.panels[1].el.hidden=!S.refVisible;if(S.pdfDivider)S.pdfDivider.hidden=!S.refVisible;$('#pdf-grid').classList.toggle('single',!S.refVisible);$('#reference-toggle').setAttribute('aria-pressed',String(S.refVisible));
  if(Number.isFinite(Number(data.state.pdfSplit)))setPdfSplitPct(Number(data.state.pdfSplit));
 }else{
  S.refVisible=false;$('#pdf-grid').classList.add('single');
 }
 updateCheckButton();
 updateCourseFacts(data);
 updateWindowTitle();
 /* Registro do "Encerrar por hoje" (Retomar/Dispensar) acima do resumo de
    contexto: o título do cartão leva a matéria, então só depois dos fatos da
    matéria — e nada é enviado aqui. */
 renderResumeCard(data.resume);
 /* O chrome da matéria (abas + menus) é do `core/tabsview.bend`, aplicado no
    `renderTabsView`/`renderMenus` do main.mjs: avisar aqui fecha o vão antes do
    carregamento dos PDFs — abas e itens de menu ficam prontos no mesmo tick que
    os controles do composer (chrome pela metade deixa o #course-tabs vazio). */
 /* Publicar antes dos awaits invalida resultados da conversa anterior e
    atualiza as abas junto com os fatos do host. Ações livres publicam depois
    de aplicar, para não invalidar a própria geração que as protege. */
 if(publishWorkspace)window.dispatchEvent(new CustomEvent('desk-workspace',{detail:data}));
 window.dispatchEvent(new Event('desk-chrome'));
 const preferred=data.preferred||[];
 const loads=[];
 for(let i=0;i<S.panels.length;i++){
  const saved=data.state.pdfs?.[i];
  if(saved?.path&&!S.library.some(p=>p.path===saved.path)){S.library.push({path:saved.path,name:saved.path.split(/[/\\]/).at(-1)});S.panels[i].populate();}
  const path=saved?.path||preferred[i];
  if(saved?.minimized)S.panels[i].toggleMinimized(true);
  if(path)loads.push(S.panels[i].load(path,saved||{}));
 }
 /* A área de apoio entra depois dos painéis (e com os caminhos já definidos):
    por matéria ela decide Formulário×Chat lateral e move o painel 2 para o slot
    — o estado do leitor vive no painel, nenhum PDF recarrega por causa disso. */
 beginSupport({courseId:S.currentCourseId,two:desk.two,formLabel:desk.specs[1]?.label,referenceVisible:S.refVisible});
 attachSupport(S.panels,S.pdfDivider);
 await Promise.all(loads);
 if(loadGeneration!==courseLoadGeneration)return false;
 updateContextSummary();
 document.documentElement.style.setProperty('--chat',(data.state.chatWidth||390)+'px');
 document.documentElement.style.setProperty('--calc',(data.state.calcHeight||220)+'px');
 save();
 return true;
}
/* O Pi esperando resposta (quiz na tela ou `#pi-dialog` aberto) não é ocioso
   mesmo com o `busy` solto: trocar de matéria embora abandonaria a pergunta. */
function piPromptPending(){return !!(S.dialogPending||S.quizQueue.length);}
async function waitIdle(){for(let i=0;i<80;i++){if(!S.busy&&!S.connecting&&!piPromptPending())return true;await new Promise(r=>setTimeout(r,150));}return !S.busy&&!S.connecting&&!piPromptPending();}
export async function switchCourse(id){
 if(S.switching)return;
 /* Com o turno aberto a troca é recusada pelo host; avisar antes do `waitIdle`
    evita 12 s de silêncio no atalho (⌘2) até o toast de recusa. */
 if(S.busy){toast('Pare a resposta antes de trocar de matéria.');return;}
 if(piPromptPending()){toast(`${S.agentLabel} está esperando sua resposta: responda antes de trocar de matéria.`);return;}
 await waitIdle();
 deactivateGeogebra();
 const tab=document.querySelector(`#course-tabs button[data-id="${CSS.escape(id)}"]`);
 if(!tab||tab.classList.contains('active'))return;
 S.switching=true;setTabsDisabled(true);
 const picker=$('#new-session-engine');if(picker)picker.disabled=true;
 try{
  clearTimeout(S.saveTimer);await window.desk.save(layoutSnapshot());
  const data=await window.desk.switchCourse(id);
  /* A matéria troca junto com a conversa ativa dela: metadados do motor antes
     do vazio e do connect para o rótulo e as capacidades já serem os novos. */
  applyEngineData(data);
  S.connected=false;connectionState('',`${S.agentLabel} desconectado`);showWelcome(data.course);
  /* Fatos da matéria e aba ativos antes dos PDFs montarem (o `loadCourse`
     antigo chamava `renderTabs(data); updateWindowTitle()` logo depois do IPC);
     o `loadCourse` abaixo refaz os mesmos fatos com a biblioteca pronta. */
  updateCourseFacts(data);
  markCourseTab(id);
  $('#pi-label').textContent=S.agentLabel;$('#model-select').replaceChildren(new Option('Conecte ao Pi',''));$('#thinking-select').replaceChildren(new Option('—',''));footValues({model:'',level:''});
  setBusy(false);await loadCourse(data);connect().catch(()=>{});
 }catch(e){toast(e.message);}finally{S.switching=false;setTabsDisabled(S.busy||!!S.connecting);if(picker)picker.disabled=S.busy||!!S.connecting;}
}
let healthPending=false;
setInterval(async()=>{
 if(healthPending||!S.connected||S.connecting||document.hidden)return;
 healthPending=true;
 try{
 if(!S.busy){
  S.busyStall=0;
  try{const data=await window.desk.health();S.healthFails=0;connectionState('online',`${S.agentLabel} conectado`);if(capabilities().contextUsage===true&&data?.contextUsage)updateMeter(data.contextUsage);}
  catch(e){S.connected=false;connectionState('error',`${S.agentLabel} desconectado`);activity(`Conexão perdida: ${e.message}`);toast(e.message);}
  return;
 }
 let data=null;
 try{data=await window.desk.health();}catch{}
 if(!data){
  /* Ocupado: health mudo é a única evidência de ponte morta (o timeout não
     mata mais a conexão) — duas falhas seguidas (30s) destravam a UI. */
  S.healthFails=(S.healthFails||0)+1;
  if(S.healthFails>=2){
   S.healthFails=0;S.connected=false;
   connectionState('error',`${S.agentLabel} desconectado`);setBusy(false);
   activity(`Conexão perdida: o ${S.agentLabel} não respondeu.`);toast(`O ${S.agentLabel} parou de responder; a interface foi destravada.`);
  }
  return;
 }
 S.healthFails=0;
 if(capabilities().contextUsage===true&&data.contextUsage)updateMeter(data.contextUsage);
 if(data.isRunning||data.isStreaming||data.isCompacting||data.pendingMessageCount){S.busyStall=0;return;}
 if(!S.busySince||Date.now()-S.busySince<=60000)return;
 S.busyStall++;
 if(S.busyStall>=3){S.busyStall=0;setBusy(false);toast(`A resposta do ${S.agentLabel} não estava ativa; a interface foi destravada.`);}
 }finally{healthPending=false;}
},15000);
function deskLogError(line){try{window.desk.logError(String(line??'').slice(0,4000)).catch(()=>{});}catch{}}
window.addEventListener('error',e=>deskLogError(e?.error?.stack||e?.message||e));
window.addEventListener('unhandledrejection',e=>{const reason=e?.reason;deskLogError(reason&&(reason.stack||reason.message)||reason||'rejeição sem motivo');});
