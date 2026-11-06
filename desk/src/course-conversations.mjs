import * as queue from './queue.mjs';
import {$,S,toast,toastFailure,connectionState,layoutSnapshot,fillSessions,sessionNameParts,applyStudy,connect,invalidateConnect,loadCourse} from './state.mjs';
import {setLegacySession,visibleEngines} from './visible-engines-ui.mjs';
import {resetAttachments,restoreAttachments,showHistory} from './chat.mjs';
import {setResumeRecord} from './resume.mjs';
import {t,formatDate} from './ui-text.mjs';
import {closeTutorPops} from './tutor-header.mjs';
import {sessionEngine} from './engine-facts.mjs';
import {createSessionSwitch,leftBehind} from './session-switch.mjs';

/* Uma troca de sessão por vez (#87): dois cliques rápidos criam um destino
   só; o segundo avisa e não cria outro. */
const sessionSwitch = createSessionSwitch();

/* Conversas da matéria: sessão nova (Pi ou Claude), abrir uma conversa e a
   lista do popover.
   Saiu do main.mjs na #43 fase 2; quem liga os eventos continua lá. */

/* Sessão nova (cabeçalho do tutor): o menu do `#new-session` escolhe o motor
   SÓ da sessão que nasce — a atual continua no motor dela. A escolha do item é
   a confirmação; a sessão atual fica salva. O host devolve os metadados do
   motor criado e o `fillSessions` reajusta título/capacidades. */
/** A troca de sessão está bloqueada por turno, troca ou outra sessão nova em
 * curso? Não conta `S.connecting`: quem descarta o voo (botão Começar) pergunta
 * antes de descartar, para a recusa não apagar o estado da sessão viva.
 * @returns {boolean}
 * @example if (sessionSwitchBlocked()) return newSession(engine); // só o aviso
 */
function sessionSwitchBlocked(){return !!(S.busy||S.switching||sessionSwitch.inFlight);}

async function newSession(options){
 if(sessionSwitchBlocked()||S.connecting){toast(t('session.waitCalling'));return;}
 /* Sem motor pedido, o host escolhe o instalado (#93); um motor explícito
    continua sendo a escolha do item de menu. `carryFrom` leva o digest da
    sessão antiga (#87) e é sempre explícito no par motor + origem. */
 const request=options&&typeof options==='object'?options:{engine:options};
 let engine=request.engine??null;
 if(engine!=null)engine=sessionEngine(engine);
 /* D4=A: fila, rascunho e anexos ficam na conversa antiga; a nova começa
    vazia. Mede antes de trocar, que é quando eles ainda estão aqui. */
 const carried=request.carryFrom||null;
 const stayedBehind=carried?leftBehind({queued:queue.pendingCount(),draft:$('#prompt')?.value||'',attachments:S.attachments.length+S.pdfAttachments.length}):[];
 const outcome=await sessionSwitch.run(async()=>{
  try{
   clearTimeout(S.saveTimer);await window.desk.save(layoutSnapshot());
   const data=await window.desk.newSession(carried?{engine,carryFrom:carried,mode:request.mode||'digest'}:engine);
   S.connected=false;invalidateConnect();setLegacySession(false);
   if(data.workspace){$('#messages').replaceChildren();await loadCourse(data);}
   else fillSessions(data);
   connectionState('');
   if(!data.workspace){
    applyStudy(data.state?.study);
    $('#prompt').value=data.state?.draft||'';
    $('#messages').replaceChildren();
    /* Cache do descritor antes do connect: offline/sem login, a conversa Claude
       continua visível (nada de cair para o Pi). */
    if((Array.isArray(data.messages)&&data.messages.length)||data.cards?.length)showHistory(Array.isArray(data.messages)?data.messages:[],data.cards||[],data.historyIdentity);
    resetAttachments();
    queue.adopt(data.pending);
    restoreAttachments(data.pending);
    setResumeRecord(data.resume);
   }
   await connect();
   return true;
  }catch(e){toastFailure(e);return false;}
 });
 if(outcome.duplicate){toast(t('session.waitCalling'));return;}
 if(!outcome.value)return;
 if(stayedBehind.length)toast(`${t('session.started')} ${t('session.carryLeftBehind')}`);
 else toast(t('session.started'));
}
/* Continuar a conversa aberta em outro motor (#87): a sessão nova leva o
   digest da antiga e a antiga continua na lista, sem escrita. */
function continueSession(engine){
 return newSession({engine,carryFrom:S.currentSession});
}
/* Sessões da matéria: o título do cabeçalho abre a lista com título, data,
   trecho e motor (só o Claude Code leva o nome do motor). A escolha salva e
   restaura rascunho, fila e anexos como sempre, e nada é enviado sozinho.
   Leitura pura: a lista não renomeia nem apaga (a biblioteca, no rodapé, faz). */
async function openConversation(file){
 if(!file||file===S.currentSession)return false;
 if(S.busy||S.connecting||S.switching){toast(t('session.waitConnecting'));return false;}
 try{
  clearTimeout(S.saveTimer);await window.desk.save(layoutSnapshot());
   const data=await window.desk.openSession(file);
   S.connected=false;invalidateConnect();setLegacySession(false);
  if(data.workspace){$('#messages').replaceChildren();await loadCourse(data);}
  else fillSessions(data);
  connectionState('');
  if(!data.workspace){
   applyStudy(data.state?.study);
   $('#prompt').value=data.state?.draft||'';
   $('#messages').replaceChildren();
   if((Array.isArray(data.messages)&&data.messages.length)||data.cards?.length)showHistory(Array.isArray(data.messages)?data.messages:[],data.cards||[],data.historyIdentity);
   resetAttachments();queue.adopt(data.pending);restoreAttachments(data.pending);setResumeRecord(data.resume);
  }
  /* Motor antigo: histórico legível, sem connect e sem composer (#release OpenCode). */
  if(!visibleEngines().includes(S.engine)){setLegacySession(true);return true;}
  await connect();
  return true;
 }catch(e){toastFailure(e);return false;}
}
function conversationWhen(value){
 const stamp=Number(value)||0;if(!stamp)return '';
 const date=new Date(stamp),today=new Date();
 const sameDay=date.toDateString()===today.toDateString();
 return formatDate(date,sameDay?{hour:'2-digit',minute:'2-digit'}:{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
}
/* Rótulo do motor na lista (#57): os nativos e o Pi antigo, só para a
   linhagem ("continua de Pi"). O título da sessão fica limpo. */
const ENGINE_LABEL_KEYS={claude:'engine.claudeExperimental',opencode:'engine.opencode',pi:'engine.legacyPi'};
function conversationEngineLabel(engine){return Object.hasOwn(ENGINE_LABEL_KEYS,engine)?t(ENGINE_LABEL_KEYS[engine]):'';}
function fallbackConversations(){
 return S.sessions.map(session=>({id:session.path,title:session.label,preview:session.preview,at:session.started,engine:session.engine,origin:session.origin}));
}
async function renderConversations(){
 const list=$('#conv-list');if(!list)return;
 let items=null;
 try{if(typeof window.desk.conversations==='function')items=await window.desk.conversations();}catch{}
 if(!Array.isArray(items)||!items.length)items=fallbackConversations();
 list.replaceChildren();
 if(!items.length){const empty=document.createElement('p');empty.className='conv-empty';empty.textContent=t('session.empty');list.append(empty);return;}
 for(const item of items){
  const name=sessionNameParts({label:String(item.title||item.label||'')});
  const entry={...item,id:String(item.id||item.path||''),title:name.name,named:name.subject||!name.when,preview:String(item.preview||''),engine:item.engine||S.engine,at:Number(item.at||item.started||0)};
  const button=document.createElement('button');
  button.type='button';button.className='conv-row'+(entry.id===S.currentSession?' current':'');
  button.dataset.id=entry.id;
  const head=document.createElement('span');head.className='conv-title';head.textContent=entry.title;
  /* Data e motor (o motor só quando não é o padrão): título renomeado na
     biblioteca não leva mais a data no rótulo. Sem assunto o nome já traz a
     data e a hora ("Sessão de 10/10, 13:27"): a meta não a repete. */
  const from=entry.origin?conversationEngineLabel(entry.origin.engine):'';
  const lineage=from?t('session.continuesFrom',{engine:from}):'';
  const meta=document.createElement('span');meta.className='conv-meta';meta.textContent=[entry.named?conversationWhen(entry.at):'',conversationEngineLabel(entry.engine),lineage].filter(Boolean).join(' · ');meta.hidden=!meta.textContent;
  button.append(head,meta);
  /* A prévia só entra quando acrescenta algo: o título que o host monta já é o
     começo dela (a mesma frase cortada em 40 e em 48 caracteres), e repeti-lo
     em outra linha é ruído (#23). */
  const lead=entry.title.replace(/…$/,'').trim();
  if(!entry.preview||!lead||!entry.preview.startsWith(lead)){
   const preview=document.createElement('span');preview.className='conv-preview';preview.textContent=entry.preview||t('session.noPreview');
   button.append(preview);
  }
  button.addEventListener('click',async()=>{closeTutorPops({restoreFocus:true});await openConversation(entry.id);});
  list.append(button);
 }
}

export {newSession,sessionSwitchBlocked,continueSession,openConversation,renderConversations};
