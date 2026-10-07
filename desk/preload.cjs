const {contextBridge,ipcRenderer}=require('electron');
const MAX_NOTIFY=200,MAX_KEYMAP=40,MAX_KEY=40,MAX_ACCEL=40;
/* Tetos da aba Livre (mesmos do núcleo `core/freeworkspaces.bend`): o preload
   corta cedo; o main revalida e quem decide é o store. */
const MAX_FREE_TITLE=120,MAX_FREE_NAME=240,MAX_FREE_MARKDOWN=262144;

function fail(message){throw Error(message);}
function asPlain(value,message){if(value==null)return {};if(typeof value!=='object'||Array.isArray(value))fail(message);return value;}
function asString(value,message,max){if(typeof value!=='string')fail(message);if(value.length>max)fail(message);return value;}

/* ---------- chat lateral: validação do preload ----------
   O preload corta cedo o que é obviamente inválido (id, refs, tamanho do texto/
   rascunho); o main revalida e decide escopo/limites de domínio. */
const MAX_SIDE_TEXT=200000,MAX_SIDE_REFS=2,MAX_SIDE_PATH=4096;
const SIDE_ID=/^sc-[0-9a-f-]{1,80}$/;
function sidechatId(value,message){
 const id=asString(value,message,80);
 if(!SIDE_ID.test(id))fail(message);
 return id;
}
function sidechatRefs(raw){
 if(raw==null)return [];
 if(!Array.isArray(raw)||raw.length>MAX_SIDE_REFS)fail('Referências inválidas.');
 return raw.map(item=>{
  const ref=asPlain(item,'Referência inválida.');
  const path=asString(ref.path||'','Referência inválida.',MAX_SIDE_PATH);
  if(!path)fail('Referência inválida.');
  const page=ref.page==null?1:Number(ref.page);
  if(!Number.isFinite(page)||page<1)fail('Referência inválida.');
  return {path,page:Math.trunc(page)};
 });
}
function sidechatArgs(value,{refs=false,fresh=false}={}){
 const raw=asPlain(value,'Pedido inválido.');
 const out={id:sidechatId(raw.id,'Chat lateral inválido.')};
 if(refs)out.refs=sidechatRefs(raw.refs);
 if(fresh&&raw.fresh!==undefined){if(typeof raw.fresh!=='boolean')fail('Pedido inválido.');out.fresh=raw.fresh;}
 return out;
}
/* `sidechatOpen` não tem id: ele abre/retoma o chat da conversa principal. */
function sidechatOpenArgs(value){
 const raw=asPlain(value,'Pedido inválido.');
 const out={refs:sidechatRefs(raw.refs)};
 if(raw.fresh!==undefined){if(typeof raw.fresh!=='boolean')fail('Pedido inválido.');out.fresh=raw.fresh;}
 return out;
}
function sidechatText(value,message){
 const text=asString(value,message,MAX_SIDE_TEXT);
 if(!text.trim())fail(message);
 return text;
}

/* ---------- IPC: mensagem limpa e um aviso por erro ---------- */

/* O Electron embrulha toda rejeição de `invoke` em
   `Error invoking remote method '<canal>': Error: <mensagem>`. O renderer só
   quer a mensagem original; a limpeza aqui vale para toda a ponte. */
const INVOKE_PREFIX=/^Error invoking remote method '[^']*':\s*(?:Error:\s*)?/;
function cleanIpcError(error){
 const raw=String(error&&error.message!==undefined?error.message:error||'');
 const message=raw.replace(INVOKE_PREFIX,'').trim()||'Falha na operação.';
 const clean=Error(message);
 if(error&&typeof error==='object'&&typeof error.name==='string'&&error.name!=='Error')clean.name=error.name;
 return clean;
}

/* `desk_error` × rejeição do `invoke` são o MESMO erro quando o Pi cai no meio
   de uma conexão/ping: sem dedupe o usuário vê dois avisos iguais. Guardamos a
   rejeição dos canais de conexão (o renderer já mostra um toast e ajusta o
   estado no catch) e seguramos o evento por um instante; se a rejeição chegar,
   o evento não é repassado. Evento sem rejeição (queda no meio do stream, por
   exemplo) segue normalmente. */
const CONNECTION_CHANNELS=new Set(['pi-connect','pi-health']);
const EVENT_HOLD_MS=150,REJECTION_WINDOW_MS=3000;
const eventHandlers=new Set(),heldErrors=[],recentRejections=[],connectionInFlight=new Map();
function markInFlight(channel,delta){
 const count=(connectionInFlight.get(channel)||0)+delta;
 if(count>0)connectionInFlight.set(channel,count);else connectionInFlight.delete(channel);
}
function connectionPending(){for(const count of connectionInFlight.values())if(count>0)return true;return false;}
function emitEvent(data){for(const fn of eventHandlers){try{fn(data);}catch{}}}
function claimRejection(message){
 for(let i=recentRejections.length-1;i>=0;i--){
  const item=recentRejections[i];
  if(item.used||item.message!==message)continue;
  if(Date.now()-item.at>REJECTION_WINDOW_MS)continue;
  item.used=true;
  return true;
 }
 return false;
}
function noteConnectionFailure(message){
 /* Uma falha nova com a mesma mensagem supera as anteriores: o evento que
    chegar pertence à falha mais recente (as antigas já tiveram sua chance). */
 for(const item of recentRejections)if(!item.used&&item.message===message)item.used=true;
 const item={message,at:Date.now(),used:false};
 recentRejections.push(item);while(recentRejections.length>8)recentRejections.shift();
 for(const entry of heldErrors){
  if(entry.dropped||entry.data.message!==message)continue;
  entry.dropped=true;clearTimeout(entry.timer);
  item.used=true;
 }
}
function invoke(channel,...args){
 const track=CONNECTION_CHANNELS.has(channel);
 if(track)markInFlight(channel,1);
 return ipcRenderer.invoke(channel,...args).catch(error=>{
  const clean=cleanIpcError(error);
  if(track)noteConnectionFailure(clean.message);
  throw clean;
 }).finally(()=>{if(track)markInFlight(channel,-1);});
}
function deliverEvent(data){
 if(!(data&&data.type==='desk_error'&&typeof data.message==='string'&&data.message)){emitEvent(data);return;}
 if(claimRejection(data.message))return;
 /* Só segura o evento enquanto uma conexão/ping está em voo: se ela rejeitar
    com a mesma mensagem, o toast dela já cobre o erro e o evento não passa. */
 if(!connectionPending()){emitEvent(data);return;}
 const entry={data,dropped:false,timer:setTimeout(()=>{
  const at=heldErrors.indexOf(entry);if(at>=0)heldErrors.splice(at,1);
  if(!entry.dropped)emitEvent(entry.data);
 },EVENT_HOLD_MS)};
 heldErrors.push(entry);
}
ipcRenderer.on('pi-event',(_e,data)=>deliverEvent(data));

/* ---------- atalhos editáveis ---------- */

/* O listener é registrado aqui, antes de qualquer script da página: a busca e a
   paleta também escutam keydown em captura, mas registram depois (a ordem dos
   imports dinâmicos não é garantida), então este é o primeiro a ver a tecla. O
   remap não toca nos handlers existentes: engole o combo novo e reenvia o padrão
   como KeyboardEvent sintético, e engole o padrão antigo para o handler de origem
   não disparar. O editor de atalhos do renderer envia o padrão e o atalho atual
   de cada ação por window.desk.setKeymap. */
const keys={entries:[],capture:false,replaying:false,onCapture:null};

function normalizeInit(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const init={
  key:typeof raw.key==='string'?raw.key.slice(0,24):'',
  code:typeof raw.code==='string'?raw.code.slice(0,24):'',
  metaKey:raw.metaKey===true,
  ctrlKey:raw.ctrlKey===true,
  altKey:raw.altKey===true,
  shiftKey:raw.shiftKey===true,
 };
 if(!init.key&&!init.code)return null;
 if(!init.metaKey&&!init.ctrlKey&&!init.altKey)return null;
 return init;
}

function normalizeEntry(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const id=typeof raw.id==='string'?raw.id:'';
 if(!/^[a-z][a-z0-9-]{0,23}$/.test(id))return null;
 const current=normalizeInit(raw.current);
 if(!current)return null;
 const defaults=(Array.isArray(raw.defaults)?raw.defaults:[]).slice(0,4).map(normalizeInit).filter(Boolean);
 if(!defaults.length)return null;
 return {id,current,defaults,loose:raw.loose===true};
}

function comboOf(event){
 return {
  key:String(event.key||''),
  code:String(event.code||''),
  metaKey:!!event.metaKey,
  ctrlKey:!!event.ctrlKey,
  altKey:!!event.altKey,
  shiftKey:!!event.shiftKey,
 };
}

function sameInit(left,right,loose){
 if(!left||!right)return false;
 if(!loose&&left.shiftKey!==right.shiftKey)return false;
 if(left.metaKey!==right.metaKey||left.ctrlKey!==right.ctrlKey||left.altKey!==right.altKey)return false;
 const codes=!!left.code&&!!right.code&&left.code===right.code;
 const names=!!left.key&&!!right.key&&left.key.toLowerCase()===right.key.toLowerCase();
 return codes||names;
}

/* Combo remapeado → reenvia o padrão; combo padrão de ação remapeada → engole. */
function matchKey(combo){
 if(keys.capture)return null;
 for(const entry of keys.entries){
  if(!sameInit(combo,entry.current,entry.loose))continue;
  if(entry.defaults.some(init=>sameInit(init,entry.current,true)))return null;
  return {replay:entry.defaults[0]};
 }
 for(const entry of keys.entries){
  if(entry.defaults.some(init=>sameInit(init,entry.current,true)))continue;
  if(entry.defaults.some(init=>sameInit(combo,init,entry.loose)))return {replay:null};
 }
 return null;
}

function dispatchKey(init,target){
 if(!init||keys.replaying)return;
 keys.replaying=true;
 try{
  const event=new KeyboardEvent('keydown',{
   key:init.key,
   code:init.code,
   metaKey:init.metaKey,
   ctrlKey:init.ctrlKey,
   altKey:init.altKey,
   shiftKey:init.shiftKey,
   bubbles:true,
   cancelable:true,
  });
  const active=document.activeElement;
  /* Alvo é o elemento focado: handlers que ignoram atalhos dentro de diálogos
     (busca, paleta) continuam valendo. */
  const node=target&&typeof target.dispatchEvent==='function'?target
   :active&&active!==document.body&&typeof active.dispatchEvent==='function'?active
    :window;
  node.dispatchEvent(event);
 }catch{}
 keys.replaying=false;
}

function onWindowKey(event){
 if(keys.replaying)return;
 if(keys.capture){
  /* Gravador aberto: a página toda fica surda e o editor recebe a tecla
     (Tab continua navegando; Esc não fecha o diálogo — o editor decide). */
  if(event.key!=='Tab')event.preventDefault();
  event.stopImmediatePropagation();
  if(typeof keys.onCapture==='function')keys.onCapture(comboOf(event));
  return;
 }
 if(event.isComposing)return;
 const hit=matchKey(comboOf(event));
 if(!hit)return;
 event.preventDefault();
 event.stopImmediatePropagation();
 if(hit.replay&&!event.repeat)dispatchKey(hit.replay,event.target);
}
window.addEventListener('keydown',onWindowKey,true);

/* Clique no menu nativo: reaproveita o reenvio para a ação continuar valendo
   mesmo com o atalho fora do padrão. */
ipcRenderer.on('mesa-key',(_e,raw)=>{const init=normalizeInit(raw);if(init)dispatchKey(init,null);});

contextBridge.exposeInMainWorld('desk',{
 init:()=>invoke('init'),switchCourse:id=>invoke('switch-course',id),settings:change=>invoke('pi-settings',change),openPDF:()=>invoke('open-pdf'),readPDF:p=>invoke('read-pdf',p),readImage:p=>invoke('read-image',p),openImage:p=>invoke('open-image',p),ggbShow:p=>invoke('ggb-view',p),ggbShot:()=>invoke('ggb-shot'),ggbSnapshot:()=>invoke('ggb-snapshot'),save:s=>invoke('save-state',s),
 connect:()=>invoke('pi-connect'),health:()=>invoke('pi-health'),prompt:p=>invoke('pi-prompt',p),abort:()=>invoke('pi-abort'),compact:i=>invoke('pi-compact',i),commands:()=>invoke('pi-commands'),autoCompaction:e=>invoke('pi-auto-compaction',e),respond:d=>invoke('pi-response',d),newSession:engine=>invoke('new-session',{engine}),openSession:p=>invoke('open-session',p),captureReady:()=>invoke('capture-ready'),openXournal:()=>invoke('open-xournal'),exportChat:()=>invoke('export-chat'),
 /* Aba Livre: sessões avulsas do workspace virtual `mesa-free`. O renderer não
    passa escopo nem caminho — o main captura o workspace ativo, guarda o
    escopo antes/depois dos awaits nativos e revalida antes de gravar. */
 freeOpenPdf:()=>invoke('free-open-pdf'),
 freeSaveMaterial:p=>{const raw=asPlain(p,'Pedido inválido.');return invoke('free-save-material',{title:asString(raw.title||'','Título inválido.',MAX_FREE_TITLE),markdown:asString(raw.markdown||'','Conteúdo inválido.',MAX_FREE_MARKDOWN),draftId:asString(raw.draftId||'','Rascunho inválido.',64)});},
 freePromote:p=>{const raw=asPlain(p,'Pedido inválido.');return invoke('free-promote',{name:asString(raw.name||'','Nome inválido.',MAX_FREE_NAME)});},
 freeRename:p=>{const raw=asPlain(p,'Pedido inválido.');return invoke('free-rename',{title:asString(raw.title||'','Título inválido.',MAX_FREE_TITLE)});},
 onTutorMaterial:fn=>ipcRenderer.on('tutor-material',(_e,data)=>{if(typeof fn==='function')fn(data);}),
 /* Chat lateral: canais próprios, escopados à conversa principal atual. */
 sidechatOpen:p=>invoke('sidechat-open',sidechatOpenArgs(p)),
 sidechatRead:p=>invoke('sidechat-read',sidechatArgs(p)),
 sidechatPrompt:p=>invoke('sidechat-prompt',{...sidechatArgs(p),text:sidechatText(asPlain(p,'Pedido inválido.').text,'Mensagem inválida.')}),
 sidechatAbort:p=>invoke('sidechat-abort',sidechatArgs(p)),
 sidechatSave:p=>invoke('sidechat-save',{...sidechatArgs(p),draft:asString(asPlain(p,'Pedido inválido.').draft??'','Rascunho inválido.',MAX_SIDE_TEXT)}),
 sidechatContext:p=>invoke('sidechat-context',sidechatArgs(p,{refs:true})),
 sidechatRespond:p=>{
  const raw=asPlain(p,'Pedido inválido.');
  const value=sidechatArgs(raw);
  const response=asPlain(raw.response,'Resposta inválida.');
  const responseId=asString(response.id||'','Resposta inválida.',200);
  if(!responseId)fail('Resposta inválida.');
  const clean={id:responseId};
  if(typeof response.value==='string')clean.value=asString(response.value,'Resposta inválida.',4000);
  if(response.confirmed===true)clean.confirmed=true;
  if(response.cancelled===true)clean.cancelled=true;
  if(response.answers!==undefined){
   const answers=asPlain(response.answers,'Resposta inválida.');
   const entries=Object.entries(answers);
   if(entries.length>16)fail('Resposta inválida.');
   const out=Object.create(null);
   for(const [question,item] of entries){
    if(!question||question.length>4000)fail('Resposta inválida.');
    if(typeof item==='string')out[question]=asString(item,'Resposta inválida.',4000);
    else if(Array.isArray(item)&&item.length<=32&&item.every(entry=>typeof entry==='string'&&entry.length<=4000))out[question]=item;
    else fail('Resposta inválida.');
   }
   clean.answers=out;
  }
  return invoke('sidechat-respond',{...value,response:clean});
 },
 onSidechatEvent:fn=>ipcRenderer.on('sidechat-event',(_e,data)=>{if(typeof fn==='function')fn(data);}),
 getConfig:()=>invoke('get-config'),saveConfig:c=>invoke('save-config',c),pickFolder:()=>invoke('pick-folder'),pickFile:()=>invoke('pick-file'),pickXopp:()=>invoke('pick-xopp'),detectPi:()=>invoke('detect-pi'),logError:line=>invoke('desk-log',line),
 /* Fila e bandeja guardadas: `{items, held}` / `{images, held}`. */
 pendingSave:p=>invoke('pending-save',p),traySave:p=>invoke('tray-save',p),
 endDaySave:p=>invoke('end-day-save',p),resumeClear:()=>invoke('resume-clear'),bookmarksSave:p=>invoke('bookmarks-save',p),reviewSave:p=>invoke('review-save',p),reviewDraft:p=>invoke('review-draft',p),reviewDraftCancel:id=>invoke('review-draft-cancel',id),
 updateCheck:o=>invoke('update-check',o),updateApply:()=>invoke('update-apply'),updatePi:()=>invoke('update-pi'),updateResult:()=>invoke('update-result'),components:o=>invoke('components',o),openExternal:url=>invoke('open-external',url),openLog:()=>invoke('open-log'),
 testMode:()=>invoke('test-mode'),
 conversations:()=>invoke('conversation-list'),
 notify:payload=>{const value=asPlain(payload,'Aviso inválido.');asString(value.body||'','Aviso inválido.',MAX_NOTIFY);return invoke('notify',value);},
 badge:value=>{if(value!=null&&(typeof value!=='number'||!Number.isFinite(value)))fail('Selo inválido.');return invoke('badge',value);},
 setKeymap:payload=>{
  const value=asPlain(payload,'Mapa de atalhos inválido.');
  const menu=asPlain(value.menu,'Mapa de atalhos inválido.');
  const entries=Object.entries(menu);
  if(entries.length>MAX_KEYMAP)fail('Mapa de atalhos inválido.');
  for(const [id,accel] of entries){
   if(typeof id!=='string'||id.length>MAX_KEY)fail('Mapa de atalhos inválido.');
   if(accel!=null&&(typeof accel!=='string'||accel.length>MAX_ACCEL))fail('Atalho inválido.');
  }
  const rawKeys=value.keys==null?[]:value.keys;
  if(!Array.isArray(rawKeys)||rawKeys.length>MAX_KEYMAP)fail('Mapa de atalhos inválido.');
  keys.entries=rawKeys.map(normalizeEntry).filter(Boolean);
  return invoke('set-keymap',{menu});
 },
 setKeyCapture:active=>{keys.capture=active===true;return keys.capture;},
 onCaptureKey:fn=>{keys.onCapture=typeof fn==='function'?fn:null;},
 onEvent:fn=>{if(typeof fn==='function')eventHandlers.add(fn);},
 onMenuCheck:fn=>ipcRenderer.on('menu-check',fn),
 onMenuGeogebra:fn=>ipcRenderer.on('menu-geogebra',fn),
 onMenuChatToggle:fn=>ipcRenderer.on('menu-chat-toggle',fn),
 onMenuStop:fn=>ipcRenderer.on('menu-stop',fn),
 onMenuHelp:fn=>ipcRenderer.on('menu-help',fn),
 onMenuSettings:fn=>ipcRenderer.on('menu-settings',fn),
 onMenuAbout:fn=>ipcRenderer.on('menu-about',fn),
 onUpdateAvailable:fn=>ipcRenderer.on('update-available',(_e,data)=>{if(typeof fn==='function')fn(data);}),
 onHandoff:fn=>ipcRenderer.on('handoff-received',(_e,data)=>{if(typeof fn==='function')fn(data);}),
 onHandoffProblem:fn=>ipcRenderer.on('handoff-problem',(_e,data)=>{if(typeof fn==='function')fn(data);})
});
