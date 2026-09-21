import {build,preserveFocus,renderChildren} from './view-host.mjs';
import aux from './generated/auxview.core.js';

// Avisos quando o turno do Pi termina na Mesa: som (WebAudio, sem assets), notificação nativa e selo no Dock.
// Som e notificação são independentes; "Avisar mesmo com a janela em foco" derruba o silêncio de quem está olhando.
// Portado de chat/src/features/notify.mjs. Sem import de state.mjs: os controles são achados por id.
//
// A seção "Avisos de conclusão" (#notify-mode) é a árvore do `core/auxview.bend`
// (`notifyRows`/`notifyGroup`): o núcleo decide as linhas, os rótulos e o
// `checked`; o `change` é a convenção `on:change` → tabela de handlers. WebAudio,
// Notification, badge e localStorage continuam aqui.
const KEY='mesa.notify';
const TITLE='Mesa de Estudos';
const DEFAULTS={sound:true,notify:true,focused:false};
// Modos antigos (um select com 4 opções) migrados sem perder a escolha.
const LEGACY={off:{sound:false,notify:false},notify:{sound:false,notify:true},sound:{sound:true,notify:false},both:{sound:true,notify:true}};
const FALLBACK='Resposta pronta.';
const ERROR_FALLBACK='Erro do Pi.';

// Bipe: pico ~0.12, attack ~10 ms, release ~200 ms; duas notas curtas (~90 ms), a 2ª ~110 ms depois.
const PEAK=0.12,ATTACK=0.01,RELEASE=0.2,NOTE=0.09,DELAY=0.11;

// Id do checkbox → chave da preferência (o id `notify-desktop` vale `notify`).
const FIELDS={sound:'sound',desktop:'notify',focused:'focused'};

let started=false,audio=null,voices=[],errored=false;
const wired=new WeakSet();

const HANDLERS={SetNotify:onNotify};

function $(selector){return document.querySelector(selector);}

function readSettings(){
 try{
  const raw=localStorage.getItem(KEY);
  if(raw&&Object.prototype.hasOwnProperty.call(LEGACY,raw))return {...LEGACY[raw],focused:false};
  const parsed=raw?JSON.parse(raw):null;
  if(parsed&&typeof parsed==='object'){
   return {sound:!!parsed.sound,notify:!!parsed.notify,focused:!!parsed.focused};
  }
 }catch{}
 return {...DEFAULTS};
}

function writeSettings(next){
 const safe={sound:!!next.sound,notify:!!next.notify,focused:!!next.focused};
 try{localStorage.setItem(KEY,JSON.stringify(safe));}catch{}
 return safe;
}

/* As três preferências como o núcleo as recebe (fatos Bool do host). */
function prefsOf(settings){
 return {$:'NotifyPrefs',sound:!!settings.sound,desktop:!!settings.notify,focused:!!settings.focused};
}

/* O `change` de uma linha desenhada pelo Bend: a chave sai do id do checkbox. */
function onNotify(event){
 const input=event.currentTarget;
 const field=FIELDS[String(input?.id||'').replace('notify-','')];
 if(!field)return;
 const current=readSettings();
 current[field]=!!input.checked;
 writeSettings(current);
 syncControls();
}

function syncControls(){
 const group=$('#notify-mode');
 if(!group)return;
 // `notifyControls` = legenda + linhas: o grupo tem um `.set-group-label` no
 // markup estático e ele precisa sobreviver ao render (senão o título visível
 // "Avisos de conclusão" some do diálogo).
 preserveFocus(group,()=>renderChildren(group,aux.notifyControls(prefsOf(readSettings())),HANDLERS));
}

function audioContext(){
 if(audio)return audio;
 const Ctor=window.AudioContext||window.webkitAudioContext;
 if(!Ctor)return null;
 try{audio=new Ctor();}catch{audio=null;}
 return audio;
}

function unlockAudio(){
 try{
  const ctx=audioContext();
  if(ctx&&ctx.state==='suspended')ctx.resume().catch(()=>{});
 }catch{}
}

function stopSound(){
 const now=audio?audio.currentTime:0;
 for(const voice of voices){
  try{
   voice.gain.gain.cancelScheduledValues(now);
   voice.gain.gain.setValueAtTime(0.0001,now);
   voice.osc.stop(now);
  }catch{}
 }
 voices=[];
}

function tone(ctx,frequency,delay){
 const at=ctx.currentTime+delay;
 const osc=ctx.createOscillator();
 const gain=ctx.createGain();
 osc.type='sine';
 osc.frequency.setValueAtTime(frequency,at);
 gain.gain.setValueAtTime(0,at);
 gain.gain.linearRampToValueAtTime(PEAK,at+ATTACK);
 gain.gain.exponentialRampToValueAtTime(0.0001,at+ATTACK+RELEASE);
 osc.connect(gain);
 gain.connect(ctx.destination);
 osc.start(at);
 osc.stop(at+NOTE);
 voices.push({osc,gain});
 osc.addEventListener('ended',()=>{voices=voices.filter(voice=>voice.osc!==osc);});
}

function beep(){
 try{
  const ctx=audioContext();
  if(!ctx)return;
  if(ctx.state==='suspended')ctx.resume().catch(()=>{});
  stopSound();
  tone(ctx,660,0);
  tone(ctx,880,DELAY);
 }catch{}
}

// Texto curto e limpo para a notificação (até 140 caracteres, como no chat).
function normalize(text){
 return String(text||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,140);
}

function assistantPreview(){
 const bodies=document.querySelectorAll('.message.assistant .body');
 const node=bodies.length?bodies[bodies.length-1]:null;
 const text=node?(node.innerText||node.textContent||''):'';
 return normalize(text)||FALLBACK;
}

function focused(){
 return document.hasFocus()&&document.visibilityState==='visible';
}

function nativeNotify(body){
 try{window.desk.notify({title:TITLE,body}).catch(()=>{});}catch{}
}

function setBadge(value){
 try{window.desk.badge(value).catch(()=>{});}catch{}
}

// Um aviso só: som e notificação leem as mesmas opções.
// Com a janela em foco e sem "Avisar mesmo com a janela em foco", não faz nada.
function announce(preview){
 const current=readSettings();
 if(!current.sound&&!current.notify)return;
 const away=!focused();
 if(!away&&!current.focused)return;
 if(current.sound)beep();
 if(!current.notify)return;
 nativeNotify(preview);
 if(away)setBadge(1);
}

function onIdle(){
 announce(assistantPreview());
}

function onFocus(){
 stopSound();
 setBadge(0);
}

function onEvent(e){
 if(!e||typeof e!=='object')return;
 if(e.type==='agent_start'){errored=false;return;} // turno novo: o erro antigo não engole mais um aviso
 if(e.type==='agent_end'){
  if(errored){errored=false;return;} // desk_error já avisou; o agent_end logo depois não duplica
  onIdle();
  return;
 }
 if(e.type==='desk_error'){
  errored=true;
  announce(normalize(e.message)||ERROR_FALLBACK);
 }
}

/* Controles separados: Som, Notificação e "avisar mesmo com a janela em foco".
   O id do grupo (#notify-mode) também serve para quem procurava o controle antigo.
   Se o markup não existir, o grupo é montado dentro de .set-sec[data-sec="avisos"] (fallback: antes de menu/.dialog-actions). */
function ensureGroup(form){
 let group=$('#notify-mode');
 if(group)return group;
 group=build(aux.notifyGroup(prefsOf(readSettings())),HANDLERS);
 const box=form.querySelector('.set-sec[data-sec="avisos"]');
 if(box)box.append(group);
 else{
  const menu=form.querySelector('menu')||form.querySelector('.dialog-actions');
  if(menu)menu.before(group);
  else form.append(group);
 }
 return group;
}

function buildSettings(){
 const form=$('#settings-form');
 if(form&&!$('#notify-sound'))ensureGroup(form);
 syncControls();
 const dialog=$('#settings-dialog');
 if(dialog&&!wired.has(dialog)){
  wired.add(dialog);
  dialog.addEventListener('close',syncControls);
  dialog.addEventListener('toggle',()=>{if(dialog.open)syncControls();});
 }
}

export async function init(){
 buildSettings(); // controles sincronizam mesmo em modo de teste (o diálogo abre normalmente)
 // Sem a API de teste, assume modo de teste (não registra listeners nem toca som).
 const test=typeof window.desk.testMode==='function'?await window.desk.testMode().catch(()=>true):true;
 if(test||started)return;
 started=true;
 window.desk.onEvent(onEvent);
 window.addEventListener('focus',onFocus);
 document.addEventListener('pointerdown',unlockAudio,{once:true});
 document.addEventListener('keydown',unlockAudio,{once:true});
}

// Auto-inicializa: o script entra no fim do body, mas espera o DOMContentLoaded se ainda estiver carregando.
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{init().catch(()=>{});},{once:true});
else init().catch(()=>{});
