import shortcutCore from './generated/shortcutview.core.js';
import {build, childrenOf, preserveFocus, preserveScroll, renderChildren} from './view-host.mjs';

// Atalhos editáveis da Mesa — catálogo, remapeamento e editor (Como usar → Personalizar…).
//
// O remapeamento não toca nos handlers existentes: este módulo envia ao preload o
// padrão e o atalho atual de cada ação de keydown; o listener do preload (registrado
// antes de qualquer script da página) engole o combo novo e reenvia o padrão como
// KeyboardEvent sintético, e engole o padrão antigo para o handler de origem não
// disparar. O motor vive no preload porque a ordem de init dos módulos do renderer
// não é garantida. Aqui ficam o catálogo, o editor e o gravador.

const STORE='mesa.keys';
const VERSION=1;
const isMac=navigator.userAgent.includes('Mac');

/* Catálogo. combo: padrão no formato 'Mod+Shift+N' (Mod = ⌘ no macOS, Ctrl fora).
   menu: o atalho também vira accelerator no menu nativo (main.cjs).
   keydown: o padrão é tratado por um keydown do renderer (remap precisa de replay).
   fixed: contextual — aparece no editor, mas não é editável nesta versão.
   note: o que mostrar na coluna de nota dos atalhos fixos (ex.: '← →'). */
const CATALOG=[
 {id:'check',label:'Conferir Xournal++',group:'Estudar',combo:'Mod+Shift+C',menu:true,keydown:true},
 {id:'ggb-check',label:'Conferir GeoGebra',group:'Estudar',combo:'Mod+Shift+G',menu:true,keydown:true},
 {id:'chat-toggle',label:'Recolher ou mostrar o chat',group:'Visualização',combo:'Mod+\\',menu:true,keydown:true},
 {id:'pdf-find',label:'Buscar no PDF',group:'Visualização',combo:'Mod+F',keydown:true},
 {id:'invert',label:'Inverter as cores da página',group:'Visualização',combo:'Mod+Shift+I',keydown:true},
 {id:'density',label:'Modo compacto',group:'Visualização',combo:'Mod+Shift+D',keydown:true},
 {id:'help',label:'Como usar',group:'Ajuda',combo:'Mod+/',menu:true,keydown:true},
 {id:'settings',label:'Configurações',group:'Ajuda',combo:'Mod+,',menu:true,keydown:true},
 {id:'new-course',label:'Nova matéria (Configurações)',group:'Arquivo',combo:'Mod+T',keydown:true},
 {id:'send',label:'Enviar mensagem',group:'Conversa',combo:null,fixed:true,note:'⏎'},
 {id:'steer',label:'Interromper e enviar',group:'Conversa',combo:'Mod+Enter',fixed:true},
 {id:'queue',label:'Enfileirar com o Pi ocupado',group:'Conversa',combo:null,fixed:true,note:'⏎'},
 {id:'newline',label:'Quebrar linha na mensagem',group:'Conversa',combo:null,fixed:true,note:'⇧⏎'},
 {id:'stop',label:'Parar a resposta',group:'Conversa',combo:'Esc',fixed:true},
 {id:'page-nav',label:'Página anterior/seguinte',group:'Conversa',combo:null,fixed:true,note:'← →'},
 {id:'tab-cycle',label:'Próxima / anterior matéria',group:'Arquivo',combo:'Mod+Tab',fixed:true},
 {id:'tab-number',label:'Ir para a matéria',group:'Arquivo',combo:null,fixed:true,note:'⌘1…⌘9'},
];

/* Combos de sistema/menu que o editor recusa (comparação ignora Shift). */
const RESERVED=[
 {combo:'Mod+Q',label:'Encerrar o app'},
 {combo:'Mod+M',label:'Minimizar a janela'},
 {combo:'Mod+H',label:'Ocultar o app'},
 {combo:'Mod+Alt+H',label:'Ocultar as outras janelas'},
 {combo:'Mod+Ctrl+F',label:'Tela cheia'},
 {combo:'Mod+Z',label:'Desfazer'},
 {combo:'Mod+X',label:'Recortar'},
 {combo:'Mod+C',label:'Copiar'},
 {combo:'Mod+V',label:'Colar'},
 {combo:'Mod+A',label:'Selecionar tudo'},
 {combo:'Mod+Plus',label:'Zoom do menu Visualizar'},
 {combo:'Mod+=',label:'Aumentar o zoom (menu)'},
 {combo:'Mod+-',label:'Diminuir o zoom (menu)'},
 {combo:'Mod+0',label:'Zoom padrão (menu)'},
];

/* Rótulos das teclas no combo exibido. */
const KEY_LABEL={'=':'+','-':'−',Enter:'⏎',Escape:'Esc',Space:'Espaço',Up:'↑',Down:'↓',Left:'←',Right:'→',Backspace:'⌫',Delete:'⌦',Plus:'+'};
/* Combos fixos sem modificador — só exibição; a gravação continua exigindo ⌘/⌥/⌃. */
const PLAIN_LABEL={Esc:'Esc'};
const NAMED={ArrowUp:'Up',ArrowDown:'Down',ArrowLeft:'Left',ArrowRight:'Right'};
const CODE_TOKEN={Equal:'=',Minus:'-',Slash:'/',Comma:',',Period:'.',Semicolon:';',Quote:"'",BracketLeft:'[',BracketRight:']',Backslash:'\\',Backquote:'`',Space:'Space',NumpadAdd:'=',NumpadSubtract:'-'};
const MODS=new Set(['Mod','Ctrl','Alt','Shift']);
/* Tecla final aceita: letra/dígito, F1–F24, nomes conhecidos ou um símbolo. */
const TOKEN_RE=/^([A-Za-z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Plus|Space|Enter|Escape|Tab|Backspace|Delete|Up|Down|Left|Right|Home|End|PageUp|PageDown|[^\sA-Za-z0-9+])$/;

const Nil={$:'Nil'};
const bendList=xs=>xs.reduceRight((tail,head)=>({$:'Con',head,tail}),Nil);

let overrides={};
let dialog=null,listEl=null,statusEl=null;
let capturing=null;
let statusText='',statusKind='info',statusConflict=false;
let started=false,openBound=false;

function actionOf(id){
 return CATALOG.find(a=>a.id===id)||null;
}

function labelOf(id){
 return actionOf(id)?.label||id;
}

/** Combo efetivo da ação: override gravado ou padrão do catálogo. */
export function effective(id){
 return overrides[id]||actionOf(id)?.combo||null;
}

/* ---------- combos ---------- */

function parseAccel(value){
 if(typeof value!=='string'||!value||value.length>24)return null;
 const parts=value.split('+');
 let token=parts.pop();
 if(!TOKEN_RE.test(token))return null;
 if(!parts.length||parts.length>3)return null;
 if(new Set(parts).size!==parts.length)return null;
 if(!parts.every(part=>MODS.has(part)))return null;
 if(!parts.some(part=>part==='Mod'||part==='Ctrl'||part==='Alt'))return null;
 if(/^[A-Za-z]$/.test(token))token=token.toLowerCase();
 return {mods:parts,token};
}

/* Forma canônica (letra minúscula) usada para comparar e guardar. */
function canonical(accel){
 const parsed=parseAccel(accel);
 if(!parsed)return null;
 return [...parsed.mods,parsed.token].join('+');
}

function partsOf(accel){
 return accel.split('+');
}

/* Igualdade exata ou, em ações loose, ignorando Shift. */
function same(action,left,right){
 const a=canonical(left),b=canonical(right);
 if(!a||!b)return false;
 if(a===b)return true;
 if(!action?.loose)return false;
 const one=new Set(partsOf(a).filter(part=>part!=='Shift'));
 const two=new Set(partsOf(b).filter(part=>part!=='Shift'));
 return one.size===two.size&&[...one].every(part=>two.has(part));
}

function reservedHit(accel){
 return RESERVED.find(item=>same({loose:true},item.combo,accel))||null;
}

/* Partes exibidas: glifos no macOS (ordem do chat: ⌃⌥⇧⌘), texto fora. */
function displayParts(accel){
 const parsed=parseAccel(accel);
 if(!parsed)return PLAIN_LABEL[accel]?[PLAIN_LABEL[accel]]:[];
 const glyph=KEY_LABEL[parsed.token]||(parsed.token.length===1?parsed.token.toUpperCase():parsed.token);
 if(isMac){
  const mods=(parsed.mods.includes('Ctrl')?'⌃':'')+(parsed.mods.includes('Alt')?'⌥':'')+(parsed.mods.includes('Shift')?'⇧':'')+(parsed.mods.includes('Mod')?'⌘':'');
  return [...mods,glyph];
 }
 const mods=[];
 if(parsed.mods.includes('Mod')||parsed.mods.includes('Ctrl'))mods.push('Ctrl');
 if(parsed.mods.includes('Alt'))mods.push('Alt');
 if(parsed.mods.includes('Shift'))mods.push('Shift');
 return [...new Set(mods),glyph];
}

export function format(accel){
 return displayParts(accel).join(isMac?'':'+');
}

/* Combo canônico → accelerator do Electron (o que main.cjs põe no menu). */
function toElectron(accel){
 const parsed=parseAccel(accel);
 if(!parsed)return null;
 const parts=parsed.mods.map(part=>part==='Mod'?'CmdOrCtrl':part);
 const key=/^[A-Za-z]$/.test(parsed.token)?parsed.token.toUpperCase():parsed.token;
 parts.push(key);
 return parts.join('+');
}

/* Accel do evento (o code físico evita depender do layout) → combo canônico. */
function tokenFromEvent(e){
 const code=String(e.code||'');
 let hit=/^Key([A-Z])$/.exec(code);
 if(hit)return hit[1].toLowerCase();
 hit=/^Digit([0-9])$/.exec(code);
 if(hit)return hit[1];
 hit=/^Numpad([0-9])$/.exec(code);
 if(hit)return hit[1];
 if(CODE_TOKEN[code])return CODE_TOKEN[code];
 const key=String(e.key||'');
 if(/^F(?:[1-9]|1[0-9]|2[0-4])$/.test(key))return key;
 if(key===' ')return 'Space';
 if(key==='+'||key==='=')return '=';
 if(key==='_'||key==='-')return '-';
 if(key.length===1)return key.toLowerCase();
 return NAMED[key]||null;
}

function comboFromEvent(e){
 const token=tokenFromEvent(e);
 if(!token)return null;
 const parts=[];
 if(isMac){
  if(e.metaKey)parts.push('Mod');
  if(e.ctrlKey)parts.push('Ctrl');
 }else if(e.ctrlKey){
  parts.push('Mod');
 }
 if(e.altKey)parts.push('Alt');
 if(e.shiftKey)parts.push('Shift');
 parts.push(token);
 return parts.join('+');
}

/* Tecla (key/code) do combo — vira o init enviado ao motor do preload. */
function baseKeyFor(token){
 if(/^[A-Za-z]$/.test(token))return {key:token.toLowerCase(),code:`Key${token.toUpperCase()}`};
 if(/^[0-9]$/.test(token))return {key:token,code:`Digit${token}`};
 const named={
  '=':['=','Equal'],'-':['-','Minus'],'/':['/','Slash'],',':[',','Comma'],'.':['.','Period'],';':[';','Semicolon'],"'":["'",'Quote'],
  '[':['[','BracketLeft'],']':[']','BracketRight'],'\\':['\\','Backslash'],'`':['`','Backquote'],Plus:['+','NumpadAdd'],
  Space:[' ','Space'],Enter:['Enter','Enter'],Escape:['Escape','Escape'],Tab:['Tab','Tab'],Backspace:['Backspace','Backspace'],Delete:['Delete','Delete'],
  Up:['ArrowUp','ArrowUp'],Down:['ArrowDown','ArrowDown'],Left:['ArrowLeft','ArrowLeft'],Right:['ArrowRight','ArrowRight'],
  Home:['Home','Home'],End:['End','End'],PageUp:['PageUp','PageUp'],PageDown:['PageDown','PageDown'],
 };
 if(named[token])return {key:named[token][0],code:named[token][1]};
 if(/^F(?:[1-9]|1[0-9]|2[0-4])$/.test(token))return {key:token,code:token};
 return {key:token,code:''};
}

/* Combo → init do motor: tecla física (key/code) + modificadores. */
export function comboToInit(accel){
 const parsed=parseAccel(accel);
 const base=baseKeyFor(parsed?parsed.token:'');
 const init={key:base.key,code:base.code,metaKey:false,ctrlKey:false,altKey:false,shiftKey:false};
 for(const part of parsed?parsed.mods:[]){
  if(part==='Mod'){
   if(isMac)init.metaKey=true;
   else init.ctrlKey=true;
  }else if(part==='Ctrl')init.ctrlKey=true;
  else if(part==='Alt')init.altKey=true;
  else if(part==='Shift')init.shiftKey=true;
 }
 return init;
}

/* ---------- persistência ---------- */

function load(){
 const next={};
 let raw=null;
 try{
  raw=JSON.parse(localStorage.getItem(STORE)||'null');
 }catch{}
 const stored=raw&&typeof raw==='object'&&raw.overrides&&typeof raw.overrides==='object'?raw.overrides:null;
 if(stored){
  for(const action of CATALOG){
   if(action.fixed)continue;
   const value=stored[action.id];
   if(!parseAccel(value))continue;
   if(reservedHit(value))continue;
   if(same(action,value,action.combo))continue;
   const clash=CATALOG.some(other=>{
    if(other.id===action.id)return false;
    const current=next[other.id]??other.combo;
    return !!current&&same(other,current,value);
   });
   if(clash)continue;
   next[action.id]=canonical(value);
  }
 }
 overrides=next;
}

function persist(){
 try{
  if(Object.keys(overrides).length)localStorage.setItem(STORE,JSON.stringify({v:VERSION,overrides}));
  else localStorage.removeItem(STORE);
 }catch{}
}

/* ---------- main ---------- */

/* Menu nativo (accelerators) + motor de remap do preload: padrão e atual de cada
   ação de keydown. O preload intercepta antes de qualquer script da página, então
   o remap não depende da ordem em que os módulos registram seus listeners. */
export function apply(){
 const menu={};
 for(const action of CATALOG){
  if(action.menu)menu[action.id]=toElectron(effective(action.id));
 }
 const keys=[];
 for(const action of CATALOG){
  if(!action.keydown||action.fixed)continue;
  const current=effective(action.id);
  if(!current||!parseAccel(current))continue;
  const defaults=[action.combo,...(action.variants||[])].filter(Boolean).map(comboToInit);
  if(!defaults.length)continue;
  const entry={id:action.id,current:comboToInit(current),defaults};
  if(action.loose)entry.loose=true;
  keys.push(entry);
 }
 try{
  const pending=window.desk?.setKeymap?.({menu,keys});
  if(pending&&typeof pending.catch==='function')pending.catch(()=>{});
 }catch{}
}

/* O gravador precisa ver todos os combos: o preload para de interceptar. */
function setCapture(active){
 try{
  window.desk?.setKeyCapture?.(active===true);
 }catch{}
}

/* Tabela “Atalhos” do Como usar: cada linha com data-key mostra o combo atual. */
function syncHelpKeys(){
 const host=document.getElementById('help-dialog');
 if(!host)return;
 for(const row of host.querySelectorAll('tr[data-key]')){
  const action=actionOf(row.dataset.key);
  if(!action)continue;
  const cell=row.querySelector('td:first-child');
  if(!cell)continue;
  const accel=effective(action.id);
  /* Sem combo próprio (ex.: ← →): o markup já explica; não apagar. */
  if(!accel)continue;
  paintKeys(cell,accel);
 }
}

function paintKeys(cell,accel){
 const parts=displayParts(accel);
 if(!parts.length)return;
 cell.replaceChildren();
 for(const part of parts){
  const kbd=document.createElement('kbd');
  kbd.textContent=part;
  cell.append(kbd);
 }
}

function sync(){
 syncHelpKeys();
 refresh();
}

function applyAll(){
 apply();
 sync();
}

/* ---------- conflitos ---------- */

function conflictFor(accel,id){
 const reserved=reservedHit(accel);
 if(reserved)return `“${reserved.label}” é reservado pelo app.`;
 for(const action of CATALOG){
  if(action.id===id)continue;
  const current=effective(action.id);
  if(current&&same(action,current,accel))return `“${action.label}” já usa ${format(current)}.`;
 }
 return '';
}

/* ---------- editor ---------- */

function actionIdFrom(event){
 return event.currentTarget?.closest?.('[data-action]')?.dataset?.action||'';
}

const editorHandlers={
 Record:event=>{
  const id=actionIdFrom(event);
  if(!id)return;
  if(capturing===id)cancelCapture('Gravação cancelada.');
  else startCapture(id);
 },
 Reset:event=>{const id=actionIdFrom(event);if(id)restoreOne(id);},
 ResetAll:()=>restoreAll(),
 Done:()=>dialog?.close(),
};

function editorSections(){
 const groups=[];
 for(const action of CATALOG){
  let group=groups.find(item=>item.title===action.group);
  if(!group){group={title:action.group,rows:[]};groups.push(group);}
  const shown=format(effective(action.id));
  group.rows.push(shortcutCore.skRow(
   action.id,
   action.label,
   shown,
   !!action.fixed,
   action.note||'',
   !!overrides[action.id],
  ));
 }
 return bendList(groups.map((group,index)=>shortcutCore.skSection(`keys-group-${index}`,group.title,bendList(group.rows))));
}

function editorFact(open=!!dialog?.open){
 return shortcutCore.skDialog(
  !!open,
  capturing||'',
  !!statusConflict,
  statusText,
  statusKind,
  Object.keys(overrides).length>0,
  editorSections(),
 );
}

function editorTree(open=!!dialog?.open){
 return shortcutCore.shortcutDialog(editorFact(open));
}

function refs(){
 listEl=dialog?.querySelector('.keys-groups')||null;
 statusEl=dialog?.querySelector('#keys-status')||null;
}

function setStatus(text,kind='info',conflict=false){
 statusText=text||'';
 statusKind=kind;
 statusConflict=!!conflict;
 refresh();
}

function refresh(){
 if(!dialog)return;
 const parts=childrenOf(editorTree().kids);
 const groups=parts[1];
 const status=parts[2];
 const footer=parts[3];
 preserveFocus(dialog,()=>{
  if(listEl&&groups)preserveScroll(listEl,()=>renderChildren(listEl,groups.kids,editorHandlers));
  if(statusEl&&status)statusEl.replaceWith(build(status,editorHandlers));
  const menu=dialog.querySelector('menu');
  if(menu&&footer)menu.replaceWith(build(footer,editorHandlers));
 });
 refs();
}

function ensureEditor(){
 if(dialog)return;
 const old=document.getElementById('keys-dialog');
 dialog=build(editorTree(false),editorHandlers);
 if(old)old.replaceWith(dialog);
 else document.body.append(dialog);
 refs();
 /* Esc: durante a gravação cancela só a captura; depois fecha o diálogo. */
 dialog.addEventListener('cancel',e=>{
  if(!capturing)return;
  e.preventDefault();
  cancelCapture('Gravação cancelada.');
 });
 dialog.addEventListener('close',()=>{
  cancelCapture('');
  setStatus('','info');
 });
}

/** Abre o editor (usado pelo botão “Personalizar atalhos…” do Como usar). */
export function openEditor(){
 ensureEditor();
 sync();
 setStatus('','info');
 if(!dialog.open)dialog.showModal();
 const first=dialog.querySelector('.keys-rec');
 (first||dialog.querySelector('#keys-done'))?.focus();
}

/* Botão “Personalizar atalhos…” no rodapé do Como usar. Se o markup não o
   trouxer, cria antes do Fechar — sem ele o editor não teria porta de entrada. */
function bindOpenButton(){
 const host=document.getElementById('help-dialog');
 if(!host)return;
 let button=document.getElementById('keys-customize');
 if(!button){
  const actions=host.querySelector('.dialog-actions');
  if(!actions)return;
  button=document.createElement('button');
  button.type='button';
  button.id='keys-customize';
  button.textContent='Personalizar…';
  const close=actions.querySelector('.primary')||actions.lastElementChild;
  actions.insertBefore(button,close||null);
 }
 if(openBound)return;
 openBound=true;
 button.setAttribute('aria-haspopup','dialog');
 button.setAttribute('aria-controls','keys-dialog');
 button.addEventListener('click',()=>openEditor());
}

function startCapture(id){
 if(capturing&&capturing!==id)cancelCapture('');
 capturing=id;
 setCapture(true);
 refresh();
 setStatus(`Pressione a nova combinação para “${labelOf(id)}”. Esc cancela.`,'info');
}

function cancelCapture(message=''){
 const id=capturing;
 stopCapture();
 refresh();
 if(id&&message)setStatus(message,'info');
}

function stopCapture(){
 capturing=null;
 setCapture(false);
}

function commit(id,accel){
 const action=actionOf(id);
 if(!action)return;
 const value=canonical(accel);
 if(!value)return;
 if(same(action,value,action.combo))delete overrides[id];
 else overrides[id]=value;
 persist();
 stopCapture();
 applyAll();
 setStatus(`“${action.label}” agora é ${format(accel)}.`,'ok');
}

function restoreOne(id){
 delete overrides[id];
 persist();
 stopCapture();
 applyAll();
 const accel=actionOf(id)?.combo;
 setStatus(accel?`“${labelOf(id)}” voltou ao padrão (${format(accel)}).`:`“${labelOf(id)}” ficou sem atalho.`,'ok');
}

function restoreAll(){
 overrides={};
 persist();
 stopCapture();
 applyAll();
 setStatus('Todos os atalhos voltaram ao padrão.','ok');
}

function captureKey(init){
 if(init.key==='Escape'){
  cancelCapture('Gravação cancelada.');
  return;
 }
 if(['Shift','Alt','Meta','Control','AltGraph'].includes(init.key))return;
 const combo=comboFromEvent(init);
 if(!combo){
  setStatus('Não entendi esta tecla — tente outra.','error');
  return;
 }
 if(!parseAccel(combo)){
  setStatus('Use ⌘, ⌥ ou ⌃ junto com uma tecla.','error');
  return;
 }
 const conflict=conflictFor(combo,capturing);
 if(conflict){
  setStatus(`Conflito: ${conflict}`,'error',true);
  return;
 }
 commit(capturing,combo);
}

/* O preload manda cada tecla enquanto o gravador está aberto (a página fica surda). */
function onCaptureKey(init){
 if(!capturing||!init)return;
 /* Tab continua navegando e cancela a gravação. */
 if(init.key==='Tab'){
  cancelCapture('Gravação cancelada.');
  return;
 }
 captureKey(init);
}

/* Rede de segurança: se alguma tecla escapar do preload durante a gravação, o
   Esc cancela a captura e não deixa o diálogo fechar. */
window.addEventListener('keydown',e=>{
 if(!capturing)return;
 if(e.key==='Escape'){
  e.preventDefault();
  e.stopPropagation();
  cancelCapture('Gravação cancelada.');
 }
},true);

/* Rótulos por plataforma no HTML estático: fora do macOS os glifos ⌘/⇧ viram
   Ctrl/Shift (os `data-key` da ajuda já são dinâmicos; isto cobre a prosa, os
   <kbd> e os title/aria-label). Roda uma vez, no boot, sobre o HTML estático —
   o texto dinâmico das conversas nunca é tocado. */
function swapGlyphs(text,kbd){
 return kbd
  ? String(text).replace(/⌘/g,'Ctrl').replace(/⇧/g,'Shift')
  : String(text).replace(/⌘⇧/g,'Ctrl+Shift+').replace(/⌘ /g,'Ctrl+').replace(/⌘/g,'Ctrl+').replace(/⇧/g,'Shift+');
}
export function applyPlatformKeys(){
 if(isMac||typeof document==='undefined')return;
 const nodes=[];const walker=document.createTreeWalker(document,NodeFilter.SHOW_TEXT);
 while(walker.nextNode())nodes.push(walker.currentNode);
 for(const node of nodes){
  const inKbd=!!node.parentElement?.closest?.('kbd');
  node.textContent=swapGlyphs(node.textContent,inKbd);
 }
 for(const el of document.querySelectorAll('[title]'))el.title=swapGlyphs(el.title,false);
 for(const el of document.querySelectorAll('[aria-label]'))el.setAttribute('aria-label',swapGlyphs(el.getAttribute('aria-label'),false));
}
applyPlatformKeys();

export function init(){
 if(started)return;
 started=true;
 load();
 bindOpenButton();
 try{
  window.desk?.onCaptureKey?.(onCaptureKey);
 }catch{}
 applyAll();
 /* Atalhos disponíveis para outros módulos (e para os testes de UI). */
 try{
  window.mesaKeys={format,effective,open:openEditor,sync:applyAll};
 }catch{}
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
