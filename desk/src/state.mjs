import {icon} from '../icons.mjs';
import {showHistory,resetAttachments,restoreAttachments} from './chat.mjs';
import {adopt as adoptQueue} from './queue.mjs';
import {setResumeRecord} from './resume.mjs';
import {PdfPanel,makePdfDivider,setPdfSplitPct,pdfSplitValue,pdfRotationsSnapshot,restorePdfRotations} from './pdf.mjs';
import {deactivateGeogebra} from './ggb.mjs';
import {initCalculator} from './calc.mjs';
import {beginCourse as beginSupport,attachPanels as attachSupport} from './support.mjs';
import toastCore from './generated/toastview.core.js';
import statusCore from './generated/statusview.core.js';
import tutorHeaderCore from './generated/tutorheader.core.js';
import deskFlagsCore from './generated/deskflags.core.js';
import conferirCore from './generated/conferir.core.js';
import boxCore from './generated/composerbox.core.js';
import {build,renderChildren} from './view-host.mjs';
import {applyHelpFlags} from './dialogs.mjs';
import deliveryCore from './generated/agentdelivery.core.js';
import {captureViewLayout} from './layout-presets.mjs';
import {t,text as translate,formatDate,currentLanguage} from './ui-text.mjs';
import {message,parseMessage} from './i18n.mjs';
import {applyAttrs,applyAttrsOn,applyView} from './live-view.mjs';
import {updateMeter,renderAutoCompact,refreshMeter,installContextMeter,meterUsage} from './context-meter.mjs';
export {refreshMeter};
import {shortModelName} from './model-picker.mjs';import {renderModelPicker,setModelPickerDisabled,loadModelRecents,modelRecentsSnapshot,loadModelFavorites,modelFavoritesSnapshot} from './model-picker-ui.mjs';import {renderEffortStrip,setEffortStripDisabled,effortLevelText} from './effort-strip.mjs';import {knownEngine,sessionEngine,isNativeEngine,defaultEffort,defaultCapability} from './engine-facts.mjs';

export function $(s){return document.querySelector(s);}
export const S={supportsImages:true,switching:false,modelCatalog:[],library:[],panels:[],pdfDivider:null,connected:false,connecting:null,busy:false,connectCancelled:false,busySince:0,busyStall:0,healthFails:0,refVisible:true,saveTimer:0,currentSession:'',sessions:[],captureOk:false,includeRefs:true,appConfig:{},quizQueue:[],dialogPending:false,activeCourseName:'',currentTheme:'auto',currentAccent:'blue',ggbActive:false,currentCourseId:'',workspace:null,autoCompact:false,bookmarks:[],reviewItems:[],reviewActive:false,attachments:[],attachGen:0,deskVersion:'',engine:'pi',capabilities:null,conversationStatus:null,uncertain:false,turnCancelled:false,effortLevels:[],effortLevel:''};
/* Fatos do indicador de modelo e esforço (ticket #14): o estado de conexão
   (`state` + rótulo que o host já usa no ponto) e a escolha em uso. Quem mostra
   é o `tutor-header.mjs`; o evento `desk-tutor-link` evita o ciclo de imports.
   `reason` é o motivo que o motor devolveu quando o estado é `error` (ticket
   #17): quem o diz na coluna é o `tutor-state.mjs`. */
S.link={state:'',label:'',reason:''};
S.choice={model:'',level:'',provider:'',id:''};
function announceLink(){try{window.dispatchEvent(new Event('desk-tutor-link'));}catch{}}
/* `provider` e `id` só escolhem o logo do indicador (2026-10-21). */
export function setTutorChoice(model,level,provider='',id=''){S.choice={model:String(model||''),level:String(level||''),provider:String(provider||''),id:String(id||'')};announceLink();}
/* Motor da conversa corrente e capacidades do transporte (contrato do host:
   `engine`, `capabilities` vêm em initialData/connect/troca de
   conversa). Sem metadados, vale o comportamento atual do Pi — a UI não pode
   esconder recurso de um motor só porque o host é mais antigo. A escolha do
   motor da PRÓXIMA sessão é o item do menu de sessão nova (cabeçalho do tutor);
   o título e o status seguem a sessão aberta, nunca o menu. */
const CAP_KEYS=['images','permissions','steer','compact','autoCompaction','modelSelection','effort','reviewDraft','commands','geogebra','quiz','contextUsage'];
function defaultCapabilities(engine){const out={};for(const key of CAP_KEYS)out[key]=defaultCapability(engine);return out;}
function normalizeCapabilities(raw,engine){
 const source=raw&&typeof raw==='object'?raw:null;
 const out={};
 for(const key of CAP_KEYS)out[key]=source&&Object.prototype.hasOwnProperty.call(source,key)?source[key]===true:defaultCapability(engine);
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
 if(!data||typeof data!=='object'||!knownEngine(data.engine))return false;
 S.engine=data.engine;
 /* O motor da sessão aberta fica num atributo do título (sem texto visível). */
 const engineMark=$('#session-title');if(engineMark)engineMark.dataset.engine=S.engine;
 S.capabilities=normalizeCapabilities(data.capabilities||data.caps,S.engine);
 if(data.conversationStatus!==undefined)S.conversationStatus=data.conversationStatus&&typeof data.conversationStatus==='object'?data.conversationStatus:null;
 else if(typeof data.session==='string')S.conversationStatus=null;
 /* Fatos da fila por conversa: a incerteza vem do registro (o host a mantém
    até outra conversa) e o cancelamento é do turno, não da conversa — some na
    troca e no primeiro turno novo. */
 S.uncertain=!!(S.conversationStatus&&S.conversationStatus.uncertain);
 if(typeof data.session==='string'&&data.session!==S.currentSession)S.turnCancelled=false;
 applyEngineFacts();
 return true;
}
/* O que o motor permite esconde/mostra na interface viva. Idempotente: pode ser
   chamado no boot, em cada troca e a cada connect. */
function applyEngineFacts(){
 const caps=capabilities();
 const prompt=$('#prompt');
 if(prompt)prompt.setAttribute('aria-label',t('composer.messageAria'));
 const modelField=$('#model-field');if(modelField)modelField.hidden=caps.modelSelection!==true;
 /* Esforço fica à vista como no Pi: no Claude sem modelo explícito ele aparece
    desligado em "Padrão do Claude", dizendo como ajustar. */
 const effortField=$('#effort-field');if(effortField)effortField.hidden=caps.effort!==true&&!(isNativeEngine(S.engine)&&caps.modelSelection===true);
 if(caps.modelSelection!==true)setModelPickerDisabled(true);
 if(caps.effort!==true)setEffortStripDisabled(true);
 const auto=$('#auto-compact');if(auto&&caps.autoCompaction!==true)auto.hidden=true;
 /* "Resumir contexto" manual: só existe onde o motor compacta; a explicação é
    real (Claude experimental não oferece a compactação pela Mesa — nada de
    chamar o Pi no lugar). O item vive em Mais opções (tutor-header). */
 if(caps.contextUsage!==true)updateMeter(null);
 /* Avisa o cabeçalho do tutor (indicador, popover e Mais opções) para
    re-sincronizar o que depende do motor; o evento evita o ciclo de imports
    state ↔ tutor-header. */
 try{window.dispatchEvent(new Event('desk-engine-facts'));}catch{}
}
/* Fila de toasts e faixa de atividade desenhadas pelo núcleo provado
   (`core/toastview.bend` → `toastview.core.js`). O host mantém os elementos
   vivos e os timers: a saída é uma transição no nó que já está no DOM, e
   recriá-lo cortaria a animação e o `transitionend`. */
const toastQueue=[];

function toastNode(item){return toastCore.toastItem(toastItemFact(item));}
/* Um aviso por vez: quem decide é `toastPush` (núcleo). O host só aplica o
   resultado — o aviso que estava na tela sai na hora (repetido ou não) e o
   tempo conta a partir do novo. */
export function toast(text){
 if(!text||text==='stopped')return;
 const box=$('#toast');if(!box)return;
 const asList=toastQueue.reduceRight((tail,it)=>({$:'Con',head:toastItemFact(it),tail}),{$:'Nil'});
 const next=toastCore.toastPush(asList,translate(String(text)));
 for(const old of toastQueue.splice(0)){clearTimeout(old.timer);old.el.remove();}
 const item={text:next.head.text,closing:next.head.closing};
 toastQueue.push(item);
 const el=item.el=build(toastNode(item));
 box.append(el);
 raiseToast(box);
 const remove=()=>{clearTimeout(item.timer);el.remove();const at=toastQueue.indexOf(item);if(at>=0)toastQueue.splice(at,1);if(!box.childElementCount)lowerToast(box);};
 el.addEventListener('transitionend',remove,{once:true});
 item.timer=setTimeout(()=>{
  item.closing=true;
  applyAttrs(el,toastNode(item));
  item.timer=setTimeout(remove,600);
 },3200);
}
function toastItemFact(item){return{$:'Toast',text:item.text,closing:item.closing};}
/* Nenhum aviso atrás de diálogo aberto (#42): o `#toast` é um popover manual e
   vai para o topo da camada superior a cada aviso — mostrar de novo o põe
   acima de um `<dialog>` modal aberto depois dele. Sem aviso, sai da camada. */
function raiseToast(box){
 if(typeof box.showPopover!=='function')return;
 try{if(box.matches(':popover-open'))box.hidePopover();box.showPopover();}catch{}
}
function lowerToast(box){
 try{if(box.matches?.(':popover-open'))box.hidePopover();}catch{}
}
/* Diálogo aberto com um aviso já na tela: o aviso volta para cima dele. */
if(typeof MutationObserver==='function'&&typeof document!=='undefined'){
 new MutationObserver(records=>{
  if(!records.some(r=>r.target?.tagName==='DIALOG'&&r.target.open))return;
  const box=$('#toast');
  if(box?.childElementCount)raiseToast(box);
 }).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['open']});
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
/* Sem rótulo, o texto de ligado × desligado vem do núcleo (`tutorheader`
   → `linkLabel`); o host só passa o que é dele ("Chamando o tutor", "Tutor sem
   resposta"). O núcleo `statusview` é compartilhado com a Conversa e cairia em
   "Pi desconectado" — por isso o rótulo nunca chega vazio. */
export function connectionState(state,label,reason){
 const dot=$('#status-dot');if(!dot)return;
 const text=String(label||tutorHeaderCore.linkLabel(state==='online'));
 applyAttrs(dot,statusCore.statusDot(connStateOf(state),text),['class','hidden','data-tip','title']);
 /* O ponto mora dentro do indicador de modelo e esforço: o estado e o rótulo
    seguem para ele pelo evento (o `connect()` e a saúde passam por aqui). */
 S.link={state:String(state||''),label:text,reason:state==='error'?String(reason||''):''};
 announceLink();
}
export function activity(text){const box=$('#activity');if(box)applyView(box,toastCore.activityView(translate(String(text||''))));}
/* Passo ao vivo no lugar da linha simples: ponto pulsante + rótulo curto. */
export function activityLive(text){const box=$('#activity');if(box)applyView(box,toastCore.activityLiveView(translate(String(text||''))));}
/* Rolagem: seguir só quando o usuário já está no fim (medido antes da mutação).
   Em janelas baixas (media query `max-height:700px`) o `#chat` vira o scroller
   e o `#messages` cresce com o conteúdo; nos tamanhos normais o `#messages`
   continua sendo o scroller — até que o conteúdo deixe de caber (calculadora
   grande, anexos…). Aí o host liga `body.chat-scroll` e a
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
   `body.chat-scroll`. Em coluna normal o #messages encolhe sozinho (flex) — o
   overflow real só aparece quando nem o piso dele basta; aí o modo rolagem
   liga. No modo rolagem o #messages cresce com o conteúdo, então o modo sai
   quando o normal caberia de novo com o #messages nos 84px mínimos — os dois
   modos medem o mesmo composer, então a conta fecha sem piscar. Entrar leva a
   conversa ao fim quando ela já estava no fim (o composer não deve nascer
   escondendo a última mensagem). Em `max-height:700px` quem manda é a media
   query — a classe não é usada. */
export function syncChatScrollMode(){
 const chat=$('#chat');if(!chat)return;
 const compact=window.matchMedia?.('(max-height:700px)')?.matches===true;
 const on=document.body.classList.contains('chat-scroll');
 if(compact){
  if(on){
   document.body.classList.remove('chat-scroll');
   /* O modo rolagem leva a coluna ao fim para mostrar o composer. Ao encolher
      para a janela baixa (composer sticky) a conversa vazia não tem o que
      seguir: o deslocamento herdado só esconderia o cabeçalho (sessões,
      exportar, recolher). Com mensagens, a posição do usuário é mantida. */
   if(!$('#messages')?.querySelector('.message'))chat.scrollTop=0;
  }
  return;
 }
 const messages=$('#messages');
 if(on&&messages){
  const chrome=chat.scrollHeight-messages.getBoundingClientRect().height;
  if(chrome+84>chat.clientHeight+1)return;
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
   (histórico) continuam síncronas, que é o contrato delas. */
function scheduleChatScrollMode(){
 cancelAnimationFrame(chatScrollFrame);
 chatScrollFrame=requestAnimationFrame(()=>{chatScrollFrame=0;syncChatScrollMode();});
}
/* A coluna muda de tamanho por causa dela mesma (janela/divisória) ou do que
   entra nela (estudo, anexos, fila, mensagens). Observar o #chat e os
   filhos cobre os dois: o RO avisa quando qualquer um desses caixas muda. */
function watchChatScroll(){
 const chat=$('#chat');if(!chat||chatScrollWatch)return;
 chatScrollWatch=new ResizeObserver(scheduleChatScrollMode);
 chatScrollWatch.observe(chat);
 for(const el of [chat.querySelector('.chat-head'),$('#goes-along'),$('#messages'),$('#activity'),$('#composer')]){
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
export function layoutSnapshot(){return {draft:$('#prompt').value,study:studySnapshot(),pdfs:pdfSnapshot(),pdfRotations:pdfRotationsSnapshot(),pdfSplit:pdfSplitValue(),referenceVisible:S.refVisible,chatWidth:parseInt(getComputedStyle(document.documentElement).getPropertyValue('--chat')),calcHeight:calcHeightPx(),theme:S.currentTheme,accent:S.currentAccent,viewLayout:captureViewLayout(),modelRecents:modelRecentsSnapshot(),modelFavorites:modelFavoritesSnapshot()};}
export function save(immediate=false){clearTimeout(S.saveTimer);if(immediate){window.desk.save(layoutSnapshot()).catch(e=>toast(e.message));return;}S.saveTimer=setTimeout(()=>window.desk.save(layoutSnapshot()).catch(e=>toast(e.message)),400);}
export function refs(){return S.includeRefs?S.panels.filter((p,i)=>p.path&&(i===0||S.refVisible)).map(p=>({path:p.path,page:p.page})):[];}
/* A linha "Vai junto" (ticket #15) acima da caixa de mensagem diz o que segue
   com a próxima mensagem: matéria, lista/questão ativa, rascunho .xopp e os
   materiais abertos com a página. O texto é decisão do `core/composerbox.bend`;
   aqui só se juntam os fatos vivos (o nome do arquivo sai do caminho). Com a
   flag `studyContext` desligada o contexto de estudo não vai (nem a matéria). */
function fileName(path){return String(path||'').split(/[/\\]/).at(-1);}
function bendStrings(items){return items.reduceRight((tail,head)=>({$:'Con',head,tail}),{$:'Nil'});}
/* Os fatos entram crus: quem decide o que vai (a flag `studyContext` leva a
   matéria, a questão e o rascunho) é o núcleo. */
function openRefs(){return bendStrings(refs().map(r=>`${fileName(r.path)} p.${r.page}`));}
/* Os mesmos fatos alimentam o texto (título e acessibilidade) e a árvore em
   partes — `goes-lead`, `goes-course`, `goes-rest` — que o CSS corta na ordem
   certa: o nome da matéria cede antes da lista/questão e da página. */
function goesAlongFacts(){
 const study=S.appConfig.desk?.studyContext!==false;
 const facts=studySnapshot();
 return [study,S.activeCourseName||'',facts.title||'',fileName(facts.xopp),!!S.includeRefs,openRefs()];
}
export function updateContextSummary(){
 const el=$('#context-summary');
 if(!el)return;
 const facts=goesAlongFacts();
 /* O idioma entra na chave: a troca refaz a linha com o mesmo fato (#41). */
 const key=JSON.stringify([currentLanguage(),...facts]);
 if(el.dataset.goes!==key){renderChildren(el,boxCore.goesTree(...facts));el.dataset.goes=key;}
 el.title=el.textContent;
 const note=$('#context-pop-refs');
 if(note)note.textContent=translate(boxCore.refsNote(!!S.includeRefs,openRefs(),S.appConfig.desk?.conferir!==false));
}
/** Na aba Livre o nome da "matéria" é o da língua atual (o host manda o gravado); chamado na troca de idioma. */
export function relabelFreeCourseName(){
 if(S.workspace?.kind!=='free')return;
 S.activeCourseName=t('free.tab');
 updateWindowTitle();
}
export function updateWindowTitle(){document.title=[S.appConfig.desk?.title||'Mesa de Estudos',S.activeCourseName,S.panels[0]?.doc?`p. ${S.panels[0].page}`:''].filter(Boolean).join(' — ');}
/* Medidor de contexto e compactação automática: context-meter.mjs (#43 fase 2). */
installContextMeter();
/* O título da sessão no cabeçalho do tutor: o rótulo que o host monta
   (`courseSessions`) leva o prefixo do motor ("Claude Code · ") quando a sessão
   é do Claude Code; o cabeçalho mostra só o título e guarda o motor em
   `data-engine`. Sem rótulo conhecido, cai para "Sessão". */
const ENGINE_PREFIX='Claude Code · ';
export function sessionTitleOf(session){
 const label=String(session?.label||'').trim();
 const bare=label.startsWith(ENGINE_PREFIX)?label.slice(ENGINE_PREFIX.length).trim():label;
 return bare||t('session.untitled');
}
/* O nome que o cabeçalho e a lista mostram (#23, #27): o rótulo do host abre com
   a data ("10/10, 13:27 · assunto"), e a data já mora na linha de meta da lista
   de sessões. Aqui o rótulo se separa em data e assunto (fatos) e o núcleo
   (`tutorheader.sessionName`) escolhe o texto: o assunto, ou, sem assunto,
   "Sessão de <data e hora>" — duas sessões sem assunto não ficam iguais. O
   rótulo que vai ao disco e à busca de comandos não muda de formato. */
/* O núcleo `sessions` grava o preview do `/conferir` em português; a exibição traduz (#41). */
const STORED_CONFERIR_LABEL='Conferir Xournal++';
const DATE_PREFIX=/^(\d{2}\/\d{2},\s\d{2}:\d{2})(?:\s·\s)?/;
const WHEN_FORMAT={day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'};
/* A data da sessão sai de `started` no idioma da interface; o prefixo do rótulo
   (sempre em português, é o que vai ao disco) só serve quando falta o horário. */
function sessionWhen(session,prefix){
 const started=Number(session?.started||0);
 return started>0?formatDate(started,WHEN_FORMAT):prefix;
}
export function sessionNameParts(session){
 const bare=sessionTitleOf(session);
 const found=DATE_PREFIX.exec(bare);
 const when=found?sessionWhen(session,found[1]):'';
 const subject=bare.replace(DATE_PREFIX,'').trim();
 /* Sem data e sem assunto o título já é "Sessão"; ele próprio vira o assunto. */
 const shown=subject===STORED_CONFERIR_LABEL?t('conferir.sessionLabel'):subject;
 const text=translate(tutorHeaderCore.sessionName(shown||(when?'':bare),when));
 return {name:text,subject:!!subject,when};
}
export function sessionNameOf(session){return sessionNameParts(session).name;}
export function paintSessionTitle(){
 const title=$('#session-title');if(!title)return;
 const current=S.sessions.find(s=>s.path===S.currentSession);
 const text=sessionNameOf(current);
 title.dataset.session=S.currentSession||'';
 title.dataset.engine=current?.engine||S.engine;
 const span=title.querySelector('.session-title-text');
 if(span)span.textContent=text;
 title.setAttribute('aria-label',t('session.aria',{name:text}));
}
export function fillSessions(data){
 /* Metadados do motor (engine/capabilities) entram ANTES do
    connect: o título, o menu de sessão nova e os controles gated dependem da
    sessão que está abrindo. */
 if(data&&typeof data==='object')applyEngineData(data);
 if(!data||typeof data!=='object')return;
 if(Array.isArray(data.sessions))S.sessions=data.sessions.filter(s=>s&&typeof s.path==='string'&&s.path).map(s=>({path:s.path,label:String(s.label||s.path),engine:sessionEngine(s.engine),preview:String(s.preview||''),started:Number(s.started||0)}));
 const previousSession=S.currentSession;
 S.currentSession=data.session||S.currentSession;
 if(previousSession!==S.currentSession)window.dispatchEvent(new Event('desk-conversation-changed'));
 paintSessionTitle();
}
export function applyStudy(study={}){$('#exercise-title').value=study.title||'';$('#pick-xopp').dataset.path=study.xopp||'';paintPickXopp();updateContextSummary();}
/* Sem arquivo o botão diz o que faz; com arquivo, o nome dele (#41: o texto padrão segue o idioma). */
export function paintPickXopp(){const button=$('#pick-xopp'),file=button.dataset.path||'';button.textContent=file?file.split(/[/\\]/).at(-1):t('composer.pickXoppDefault');button.title=file||t('composer.pickXoppTitle');}
/* O requisito de visão saiu daqui: anexar a captura não exige modelo com
   imagem — o aviso fica no `addAttachments`/envio. disabled/title do #check são
   só deste applier; o hidden é do `core/deskflags.bend` (flag conferir). */
function conferirEnabled(){return S.captureOk&&!S.busy;}
/* O Conferir captura o Xournal++ ou o programa que a pessoa escolheu (#35). O
   nome vem de `S.conferirApp` (`{app,key}` ou nulo = Xournal++); o texto do
   botão e a dica são do `core/conferir.bend`. */
export function conferirAppName(){return S.conferirApp?.app||conferirCore.defaultApp();}
export function conferirShortcut(){return `${IS_MAC?'⌘':'Ctrl+'}⇧C`;}
function paintCheckLabel(el,app){
 const paintedAs=`${currentLanguage()}|${app}`;
 if(el.dataset.app===paintedAs&&el.querySelector('.label-full'))return;
 el.dataset.app=paintedAs;
 const full=document.createElement('span'),short=document.createElement('span');
 full.className='label-full';full.textContent=translate(conferirCore.buttonLabel(app));
 short.className='label-short';short.textContent=translate(conferirCore.shortLabel());
 el.innerHTML=icon('scan')+' ';
 el.append(full,short);
}
export function updateCheckButton(){
 const el=$('#check');if(!el)return;
 el.disabled=!conferirEnabled();
 const app=conferirAppName();
 paintCheckLabel(el,app);
 /* Em degrau `compact` o botão fica só com o ícone: o nome acessível segue completo (#43 ajustes pós-41). */
 el.setAttribute('aria-label',translate(conferirCore.buttonLabel(app)));
 /* Durante a resposta o botão segue travado, mas legível e com o motivo (#42). */
 el.title=S.captureOk?translate(conferirCore.hintFor(!!S.busy,app,conferirShortcut())):t('check.unavailable',{label:translate(conferirCore.buttonLabel(app))});
 el.classList.toggle('waiting',!!S.busy&&!!S.captureOk);
 paintWritingProgramLabels();
}
/* Configurações > Recursos: os dois rótulos seguem o programa escolhido no Conferir;
   sem escolha dizem "programa de escrita", como os prompts do tutor (#41, fase 1). */
function paintWritingProgramLabels(){
 const chosen=S.conferirApp?.app||'';
 const label=(id,named,generic)=>{const el=document.getElementById(id);if(el)el.textContent=chosen?t(named,{app:chosen}):t(generic);};
 label('cfg-desk-xournal-label','settings.features.xournal','settings.features.xournalGeneric');
 label('cfg-desk-conferir-label','settings.features.conferir','settings.features.conferirGeneric');
}
export function setBusy(value){S.busy=value;if(value){if(!S.busySince)S.busySince=Date.now();}else{S.busySince=0;S.busyStall=0;}setTabsDisabled(value||!!S.connecting||S.switching);const locked=value||!!S.connecting||S.switching;const title=$('#session-title');if(title)title.disabled=locked;setModelPickerDisabled(value||S.uncertain||!S.connected||capabilities().modelSelection!==true);setEffortStripDisabled(value||S.uncertain||!S.connected||capabilities().effort!==true);applyAttrsOn('#send',boxCore.sendButton(value));applyAttrsOn('#stop',boxCore.stopButton(value));$('#attach').disabled=value;$('#send').disabled=value;updateCheckButton();if(value)activity(message('tutor.thinking'));else if(S.connected)activity('');window.dispatchEvent(new CustomEvent('desk-busy',{detail:{busy:!!value}}));}
/* A trava das abas de matéria é árvore do núcleo (`core/tabsview.bend`,
   `courseTabsAt`: a matéria atual fica livre, as outras travam com a dica —
   #42); aqui só se registra o fato e o `main.mjs` re-renderiza as abas. O
   título da sessão e a sessão nova continuam travados direto. */
function setTabsDisabled(value){
 S.tabsLocked=!!value;
 for(const control of document.querySelectorAll('#session-title,#new-session'))control.disabled=!!value;
 window.dispatchEvent(new Event('desk-tabs-lock'));
}
const IS_MAC=typeof navigator!=='undefined'&&navigator.userAgent.includes('Mac');
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
 const claudeModel=result?.state?.selection?.model;
 renderModelPicker({catalog:S.modelCatalog,engine:S.engine,selected:S.engine==='claude'&&result?.state?.selection?['anthropic',claudeModel&&claudeModel!=='default'?claudeModel:'']:(current?[current.provider,current.id]:null)});
  const levels=result?.levels||[];
 const level=result?.state?.thinkingLevel||defaultEffort(S.engine);
 S.effortLevels=levels.length||!isNativeEngine(S.engine)?levels:['default'];
 S.effortLevel=level;
 paintEffortStrip();
 const picked=current?S.modelCatalog.find(m=>m.provider===current.provider&&m.id===current.id):null;
 /* O indicador mostra o nome curto: "DeepSeek: DeepSeek V4.1 Flash" vira "DeepSeek V4.1 Flash" (ajustes do indicador). */
 const source=S.engine==='claude'?{provider:'anthropic',id:''}:(picked||{provider:'',id:''});
 setTutorChoice(picked?shortModelName(translate(picked.name||picked.id)):'',level,source.provider,source.id);
 setModelPickerDisabled(S.busy||S.uncertain||capabilities().modelSelection!==true);
 setEffortStripDisabled(S.busy||S.uncertain||capabilities().effort!==true);
}
const effortLabel=level=>effortLevelText(level,S.engine,t);
/* A faixa de esforço (acabamento da #59) com os níveis do motor; travada no Claude sem modelo, ela diz como ajustar. */
function paintEffortStrip(){renderEffortStrip({levels:S.effortLevels||[],value:S.effortLevel||'',label:effortLabel,title:isNativeEngine(S.engine)&&capabilities().effort!==true?t('effort.pickModel'):''});}
/* A troca de idioma (#41) refaz o que a coluna do tutor escreveu por JS: os
   rótulos de esforço, o medidor, a compactação automática e a linha "Vai junto".
   O que a coluna pinta sozinha (estado, cabeçalho) escuta o evento por conta. */
/* A divisória dos leitores nasce no boot; a troca de idioma refaz o título. */
function paintReadersDividerTitle(){if(S.pdfDivider)S.pdfDivider.title=t('layout.readersResizeTitle');}
export function relabelTutorColumn(){
 applyEngineFacts();
 paintReadersDividerTitle();
 paintSessionTitle();
 paintPickXopp();
 updateContextSummary();
 updateCheckButton();
 paintEffortStrip();
 renderModelPicker();
 if(S.lastUsage!==undefined)updateMeter(S.lastUsage);
 renderAutoCompact({autoCompactionEnabled:S.autoCompact});
}
export async function settings(change){
 if(S.uncertain&&(change?.model||change?.level)){toast(message('controls.uncertain'));return;}
 if(change?.model&&capabilities().modelSelection!==true){toast(message('controls.noModel'));return;}
 if(change?.level&&capabilities().effort!==true){toast(message('controls.noEffort'));return;}
 setModelPickerDisabled(true);setEffortStripDisabled(true);
 try{updateSettings(await window.desk.settings(change));}catch(e){toast(e.message);try{updateSettings(await window.desk.settings({}));}catch{}}
 finally{setModelPickerDisabled(S.busy||S.uncertain||capabilities().modelSelection!==true);setEffortStripDisabled(S.busy||S.uncertain||capabilities().effort!==true);}
}
export const THEME_LABELS={auto:'Tema: auto',light:'Tema: claro',dark:'Tema: escuro'};
/* O glifo do item de tema acompanha o estado (mesmo mapa do `themeIcon` do
   núcleo): auto = contraste, claro = sol, escuro = lua. */
export const THEME_ICONS={auto:'contrast',light:'sun',dark:'moon'};
export function applyTheme(value){
 S.currentTheme=['light','dark'].includes(value)?value:'auto';
 if(S.currentTheme==='auto')delete document.documentElement.dataset.theme;
 else document.documentElement.dataset.theme=S.currentTheme;
 /* O select das Configurações acompanha a troca pela busca de comandos; a troca pelo próprio select vale na hora (o `change` aplica e salva). */
 const mode=$('#theme-mode');if(mode)mode.value=S.currentTheme;
}
/* Cor de acento (ticket #9): estado de interface, como o tema. O nome é o que
   o `desk.json` grava (núcleo `core/accent.bend`); azul é o padrão e sai do
   atributo. O grupo de opções das Configurações acompanha a troca, venha ela
   dos botões ou da busca de comandos. */
export const ACCENTS=[['blue','Azul'],['violet','Violeta'],['green','Verde'],['orange','Laranja'],['pink','Rosa'],['graphite','Grafite']];
export function applyAccent(value){
 S.currentAccent=ACCENTS.some(([id])=>id===value)?value:'blue';
 if(S.currentAccent==='blue')delete document.documentElement.dataset.accent;
 else document.documentElement.dataset.accent=S.currentAccent;
 /* A marca do cabeçalho segue o acento, como o Dock (#61, app-icon-host.cjs);
    a da primeira abertura em tela cheia (#64) também. As opções das
    Configurações e as do passo Boas-vindas (#70) marcam a mesma escolha. */
 for(const brand of document.querySelectorAll('.brand-icon'))brand.setAttribute('src',`assets/app-icon/mesa-${S.currentAccent}.svg`);
 for(const option of document.querySelectorAll('.accent-option[data-accent]')){
  const on=option.dataset.accent===S.currentAccent;
  option.setAttribute('aria-checked',String(on));
  option.tabIndex=on?0:-1;
 }
}
export function labelBtn(el,name,text){if(!el)return;el.innerHTML=`${icon(name)}${text?` <span>${text}</span>`:''}`;}
/* Cancelar a chamada (ticket #17): o host derruba o processo que está subindo
   e o `connect()` pendente rejeita; o catch dele lê `S.connectCancelled` para
   voltar a "desligado" em vez de "sem resposta". */
/* Falha de quem chama o tutor (sessão nova, abrir sessão, /compact, enviar):
   se o `connect()` não atendeu, a coluna já escreve o motivo com as saídas —
   um aviso flutuante repetiria o mesmo texto (#27). Outras falhas seguem como
   aviso. */
export function toastFailure(error){
 if(error&&error.connectFailure===true)return;
 toast(error&&error.message?error.message:String(error));
}
export async function cancelConnect(){
 if(!S.connecting)return false;
 S.connectCancelled=true;
 try{await window.desk.connectCancel();}catch{}
 return true;
}
/* Ligar/ligando/sem resposta moram na coluna (`tutor-state.mjs`, bloco
   `#tutor-state`): o estado e o motivo seguem por `S.link`; a linha
   `#activity` não repete "Chamando o tutor…" nem o erro de conexão. */
export async function connect(){
 if(S.connected)return;
 if(S.connecting)return S.connecting;
 S.connectCancelled=false;
 setTabsDisabled(true);connectionState('connecting',message('tutor.link.connecting'));
 let hung=0;
 S.connecting=(async()=>{
  const timer=setTimeout(()=>{hung=1;},90000);
  try{
   const result=await window.desk.connect();
   /* Metadados do motor ANTES de qualquer gating/estado: o host roteia o
      connect pelo motor da conversa (nunca inicia Pi numa conversa Claude). */
   applyEngineData(result);
   S.connected=true;S.healthFails=0;S.modelCatalog=result.models||[];if(result.captureAvailable!=null)S.captureOk=!!result.captureAvailable;updateSettings(result);fillSessions(result);updateWindowTitle();connectionState('online');activity(message('tutor.ready'));
   setTimeout(()=>{if(S.connected&&!S.busy&&$('#activity').textContent===translate(message('tutor.ready')))activity('');},2500);
   if(result.conversationStatus?.uncertain)toast(message('tutor.uncertainDelivery'));
   if(result.messages?.length)showHistory(result.messages);
  }catch(e){
   if(S.connectCancelled){
    /* Cancelar é decisão da pessoa: volta a desligado, sem erro nem aviso. */
    S.connected=false;connectionState('');
    const stop=Error(message('tutor.error.cancelled'));stop.cancelled=true;stop.connectFailure=true;
    throw stop;
   }
   /* Sem aviso flutuante: a coluna já escreve o motivo (e a instrução do motor) com Chamar de novo ao lado (#23). */
   S.connected=false;connectionState('error',message('tutor.link.error'),hung?message('tutor.error.timeout'):e.message);
   if(e&&typeof e==='object')e.connectFailure=true;
   throw e;
  }finally{
   clearTimeout(timer);
   S.connecting=null;setTabsDisabled(S.busy||S.switching);
  }
 })();
 return S.connecting;
}
export function markCourseTab(id){
 for(const t of document.querySelectorAll('#course-tabs button[role="tab"]')){
  const active=t.dataset.id===id;t.classList.toggle('active',active);t.setAttribute('aria-selected',String(active));
 }
 /* O seletor da janela estreita acompanha a aba marcada (main.mjs). */
 window.dispatchEvent(new CustomEvent('desk-tab-marked',{detail:{id}}));
 updateWindowTitle();
}
/* Fatos das abas de matéria: a árvore é do `core/tabsview.bend` (o `main.mjs`
   aplica com o view-host); aqui ficam só os fatos que o resto do host usa — o
   nome da matéria ativa (título da janela e resumo de contexto), o id (aba
   ativa) e o "desabilitado" de conexão/troca. */
function updateCourseFacts(data){
 S.activeCourseName=data.workspace?.kind==='free'?t('free.tab'):(data.course||'');
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
 applyAttrsOn('#context-edit',deskFlagsCore.contextEditButton(facts));
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
 S.captureOk=!!data.captureAvailable;S.conferirApp=data.state?.conferirApp||null;
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
 applyAccent(data.state.accent);loadModelRecents(data.state.modelRecents);loadModelFavorites(data.state.modelFavorites);
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
 paintReadersDividerTitle();
 if(desk.two)S.panels[0].el.classList.add('pinned');
 /* Visibilidade do 2º painel ANTES do primeiro await: junto com o chrome
    (desk-chrome) o boot fica visível inteiro de uma vez — teste e usuário não
    leem o layout pela metade enquanto os PDFs carregam. */
 if(desk.two){
  S.refVisible=data.state.referenceVisible!==false;S.panels[1].el.hidden=!S.refVisible;if(S.pdfDivider)S.pdfDivider.hidden=!S.refVisible;$('#pdf-grid').classList.toggle('single',!S.refVisible);$('#reference-toggle')?.setAttribute('aria-pressed',String(S.refVisible));
  if(Number.isFinite(Number(data.state.pdfSplit)))setPdfSplitPct(Number(data.state.pdfSplit));
 }else{
  S.refVisible=false;$('#pdf-grid').classList.add('single');
 }
 updateCheckButton();
 updateCourseFacts(data);
 updateWindowTitle();
 /* Registro do "Encerrar por hoje" (Retomar/Esquecer) no bloco da coluna, acima do resumo de
    contexto: o título do cartão leva a matéria, então só depois dos fatos da
    matéria — e nada é enviado aqui. */
 setResumeRecord(data.resume);
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
 window.dispatchEvent(new CustomEvent('desk-layout-ready',{detail:{layout:data.state.viewLayout??null}}));
 save();
 return true;
}
/* O Pi esperando resposta (quiz na tela ou `#pi-dialog` aberto) não é ocioso
   mesmo com o `busy` solto: trocar de matéria embora abandonaria a pergunta. */
function piPromptPending(){return !!(S.dialogPending||S.quizQueue.length);}
async function waitIdle(){for(let i=0;i<80;i++){if(!S.busy&&!S.connecting&&!piPromptPending())return true;await new Promise(r=>setTimeout(r,150));}return !S.busy&&!S.connecting&&!piPromptPending();}
/* `{connect:false}`: a primeira matéria criada na primeira abertura não liga o
   tutor sozinha quando o Pi não foi encontrado (o aviso da coluna já diz). */
export async function switchCourse(id,{connect:autoConnect=true}={}){
 if(S.switching)return;
 /* Com o turno aberto a troca é recusada pelo host; avisar antes do `waitIdle`
    evita 12 s de silêncio no atalho (⌘2) até o toast de recusa. */
 if(S.busy){toast(message('course.stopFirst'));return;}
 if(piPromptPending()){toast(message('course.answerFirst'));return;}
 await waitIdle();
 deactivateGeogebra();
 const tab=document.querySelector(`#course-tabs button[data-id="${CSS.escape(id)}"]`);
 if(!tab||tab.classList.contains('active'))return;
 S.switching=true;setTabsDisabled(true);
 try{
  clearTimeout(S.saveTimer);await window.desk.save(layoutSnapshot());
  const data=await window.desk.switchCourse(id);
  /* A matéria troca junto com a conversa ativa dela: metadados do motor antes
     do vazio e do connect para o rótulo e as capacidades já serem os novos. */
  applyEngineData(data);
  S.connected=false;connectionState('');$('#messages').replaceChildren();
  /* Fatos da matéria e aba ativos antes dos PDFs montarem (o `loadCourse`
     antigo chamava `renderTabs(data); updateWindowTitle()` logo depois do IPC);
     o `loadCourse` abaixo refaz os mesmos fatos com a biblioteca pronta. */
  updateCourseFacts(data);
  markCourseTab(id);
  renderModelPicker({catalog:[],selected:null});S.effortLevels=[];S.effortLevel='';paintEffortStrip();setTutorChoice('','');
  setBusy(false);await loadCourse(data);if(autoConnect)connect().catch(()=>{});
 }catch(e){toast(e.message);}finally{S.switching=false;setTabsDisabled(S.busy||!!S.connecting);}
}
/* O motivo que o motor devolveu pode já ser mensagem do catálogo ("O tutor parou
   (7)…"): então ela vale sozinha; texto cru entra em "Conexão perdida: …". */
function lostConnection(reason){
 const raw=String(reason??'');
 return parseMessage(raw)?raw:message('tutor.error.lost',{reason:raw});
}
let healthPending=false;
setInterval(async()=>{
 if(healthPending||!S.connected||S.connecting||document.hidden)return;
 healthPending=true;
 try{
 if(!S.busy){
  S.busyStall=0;
  try{const data=await window.desk.health();S.healthFails=0;connectionState('online');if(capabilities().contextUsage===true)updateMeter(meterUsage(data));}
  catch(e){S.connected=false;connectionState('error','',lostConnection(e.message));}
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
   connectionState('error','',message('tutor.error.lostSilent'));setBusy(false);
   toast(message('tutor.stalled'));
  }
  return;
 }
 S.healthFails=0;
 if(capabilities().contextUsage===true)updateMeter(meterUsage(data));
 if(data.isRunning||data.isStreaming||data.isCompacting||data.pendingMessageCount){S.busyStall=0;return;}
 if(!S.busySince||Date.now()-S.busySince<=60000)return;
 S.busyStall++;
 if(S.busyStall>=3){S.busyStall=0;setBusy(false);toast(message('tutor.inactive'));}
 }finally{healthPending=false;}
},15000);
function deskLogError(line){try{window.desk.logError(String(line??'').slice(0,4000)).catch(()=>{});}catch{}}
window.addEventListener('error',e=>deskLogError(e?.error?.stack||e?.message||e));
window.addEventListener('unhandledrejection',e=>{const reason=e?.reason;deskLogError(reason&&(reason.stack||reason.message)||reason||'rejeição sem motivo');});
