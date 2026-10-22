// @ts-check
import {$,S,toast} from './state.mjs';
import {t} from './ui-text.mjs';
import {icon} from '../icons.mjs';
import {addAttachments} from './chat-attachments.mjs';
import {closeTutorPops} from './tutor-header.mjs';
import {orientationSize,orientationMatrix} from './phone-orientation.mjs';
import {createPhoneQueue} from './phone-queue.mjs';

/* Foto do celular (#36), no renderer: o botão ao lado do Anexar, o popover com
   o QR code e a entrada das fotos na bandeja de anexos.

   O servidor só existe enquanto o popover está aberto: abrir chama
   `phoneStart`; fechar (Esc, o próprio botão, Parar, recolher a coluna, trocar
   de conversa) chama `phoneStop`. Clicar fora NÃO fecha: a pessoa precisa
   escrever a mensagem enquanto o celular manda as fotos. Parar desliga e deixa
   o popover aberto com "Ligar de novo".

   Cada foto chega sem EXIF e com a rotação à parte (`phone-host.cjs`); aqui ela
   é desenhada já em pé, reduzida ao lado máximo da bandeja e entregue a
   `addAttachments`, que comprime, persiste por conversa e nunca envia. Durante
   a resposta do tutor o Anexar fica travado; as fotos que chegam esperam o fim
   da resposta e entram depois, na ordem. */

const MAX_EDGE=1568; // o mesmo lado máximo da bandeja (`chat-attachments.mjs`)
const ISOLATION_MS=30000;
const QR_QUIET=4;

/** @type {{status: any, isolation: ReturnType<typeof setTimeout>|null, starting: boolean}} */
const phone={status:null,isolation:null,starting:false};

const isOpen=()=>!$('#phone-pop').hidden;

/* ---------- QR ---------- */

/** SVG do QR code (preto no branco nos dois temas: o leitor do celular precisa do contraste). */
function paintQr(qr){
 const box=$('#phone-qr');
 box.replaceChildren();
 if(!qr)return;
 const side=qr.size+2*QR_QUIET;
 const ns='http://www.w3.org/2000/svg';
 const svg=document.createElementNS(ns,'svg');
 svg.setAttribute('viewBox',`0 0 ${side} ${side}`);
 svg.setAttribute('shape-rendering','crispEdges');
 svg.setAttribute('aria-hidden','true');
 const back=document.createElementNS(ns,'rect');
 back.setAttribute('width',String(side));back.setAttribute('height',String(side));back.setAttribute('fill','#fff');
 let d='';
 qr.rows.forEach((row,y)=>{for(let x=0;x<row.length;x++)if(row[x]==='1')d+=`M${x+QR_QUIET} ${y+QR_QUIET}h1v1h-1z`;});
 const path=document.createElementNS(ns,'path');
 path.setAttribute('d',d);path.setAttribute('fill','#000');
 svg.append(back,path);
 box.append(svg);
}

/* ---------- estado ---------- */

function stateText(status){
 if(phone.starting||!status)return t('phone.state.starting');
 if(status.state==='received')return t('phone.state.received',{count:status.count});
 if(status.state==='waiting')return t(status.seen?'phone.state.seen':'phone.state.waiting');
 if(status.state==='expired')return t('phone.state.expired');
 if(status.state==='error')return t('phone.state.error');
 return t('phone.state.stopped');
}

function paintNetworks(status){
 const select=$('#phone-network');
 const list=status?.candidates||[];
 $('#phone-network-field').hidden=list.length<2;
 select.replaceChildren(...list.map(item=>{
  const option=document.createElement('option');
  option.value=item.address;option.textContent=`${item.name} · ${item.address}`;
  option.selected=item.address===status.address;
  return option;
 }));
}

function paint(){
 const status=phone.status,live=status?.state==='waiting'||status?.state==='received';
 $('#phone-state').textContent=stateText(status);
 paintQr(live?status.qr:null);
 $('#phone-qr').hidden=!live;
 $('#phone-address-row').hidden=!live;
 $('#phone-address').textContent=live?status.url:'';
 paintNetworks(status);
 $('#phone-stop').hidden=!live&&!phone.starting;
 $('#phone-restart').hidden=live||phone.starting;
 $('#phone-hint').hidden=!(live&&!status.seen&&status.isolated);
}

/* Sem nenhum celular em 30 s, a rede pode estar isolando os aparelhos (eduroam). */
function armIsolationHint(){
 clearTimeout(phone.isolation);
 phone.isolation=setTimeout(()=>{if(phone.status&&!phone.status.seen){phone.status={...phone.status,isolated:true};paint();}},ISOLATION_MS);
}

async function start(address){
 phone.starting=true;phone.status=null;paint();
 try{phone.status=await window.desk.phoneStart(address?{address}:{});}
 catch(error){phone.status={state:'error',candidates:[]};toast(error.message);}
 finally{phone.starting=false;}
 armIsolationHint();
 paint();
}

function stop(){
 clearTimeout(phone.isolation);
 window.desk.phoneStop().then(status=>{phone.status=status;paint();}).catch(error=>toast(error.message));
}

/* ---------- popover ---------- */

/* Abre para cima do botão, como o de modelo e esforço, sem sair da coluna. */
function place(){
 const pop=$('#phone-pop'),button=$('#phone-photo'),host=pop.offsetParent||pop.parentElement;
 if(!host||!button)return;
 const box=host.getBoundingClientRect(),at=button.getBoundingClientRect(),gutter=8;
 pop.style.bottom=`${Math.round(box.bottom-at.top+4)}px`;
 const left=Math.min(at.left-box.left,box.width-pop.offsetWidth-gutter);
 pop.style.left=`${Math.max(gutter,Math.round(left))}px`;
 const room=at.top-($('#chat')?.getBoundingClientRect().top??0)-8;
 pop.style.maxHeight=room>0?`${Math.max(160,Math.floor(room))}px`:'';
}

export function openPhonePop(){
 if(isOpen())return;
 closeTutorPops();
 $('#phone-pop').hidden=false;
 $('#phone-photo').setAttribute('aria-expanded','true');
 place();
 start('');
}

/** Fecha o popover e desliga o servidor. Sem popover aberto, não faz nada. */
export function closePhonePop({restoreFocus=false}={}){
 if(!isOpen())return;
 const hadFocus=$('#phone-pop').contains(document.activeElement);
 $('#phone-pop').hidden=true;
 $('#phone-photo').setAttribute('aria-expanded','false');
 stop();
 if(restoreFocus&&hadFocus)$('#phone-photo').focus();
}

/* ---------- foto → bandeja ---------- */

/** Desenha a foto em pé, no máximo com o lado da bandeja. PNG segue PNG (texto nítido); o resto vira JPEG. */
async function uprightFile(photo){
 const blob=new Blob([photo.bytes],{type:photo.mimeType});
 const bitmap=await createImageBitmap(blob);
 try{
  const upright=orientationSize(photo.orientation,bitmap.width,bitmap.height);
  const scale=Math.min(1,MAX_EDGE/Math.max(upright.width,upright.height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(upright.width*scale));
  canvas.height=Math.max(1,Math.round(upright.height*scale));
  const ctx=canvas.getContext('2d');
  const type=photo.mimeType==='image/png'?'image/png':'image/jpeg';
  if(type==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);}
  ctx.scale(scale,scale);
  ctx.transform(...orientationMatrix(photo.orientation,bitmap.width,bitmap.height));
  ctx.drawImage(bitmap,0,0);
  const out=await new Promise(resolve=>canvas.toBlob(resolve,type,0.9));
  if(!out)throw Error(t('phone.unreadable'));
  return new File([out],`${photo.name}.${type==='image/png'?'png':'jpg'}`,{type});
 }finally{bitmap.close?.();}
}

async function attachPhoto(photo){
 let file;
 try{file=await uprightFile(photo);}catch{toast(t('phone.unreadable'));return;}
 /* Com o popover aberto o toast cairia em cima dele; ali o `#phone-state` já confirma ("N fotos recebidas"). */
 if(await addAttachments([file])&&!isOpen())toast(t('phone.attached'));
}

/* Uma foto de cada vez, na ordem de chegada; durante a resposta do tutor elas esperam. */
const held=createPhoneQueue({run:attachPhoto,canRun:()=>!S.busy});

function onPhoneEvent(event){
 if(event?.status){
  const isolated=!!phone.status?.isolated&&!event.status.seen;
  phone.status={...event.status,isolated};
  if(event.status.seen)clearTimeout(phone.isolation);
  paint();
 }
 if(event?.photo)held.push(event.photo);
}

/* ---------- ligação ---------- */

function paintLabels(){
 const button=$('#phone-photo');
 button.innerHTML=icon('phone');
 button.setAttribute('aria-label',t('phone.button'));
 button.title=t('phone.buttonTitle');
 $('#phone-pop').setAttribute('aria-label',t('phone.button'));
 paint();
}

export function initPhonePhoto(languageEvent){
 if(!window.desk?.phoneStart)return;
 $('#phone-photo').hidden=false;
 paintLabels();
 window.addEventListener(languageEvent,paintLabels);
 $('#phone-photo').onclick=()=>{if(isOpen())closePhonePop({restoreFocus:true});else openPhonePop();};
 $('#phone-stop').onclick=()=>stop();
 $('#phone-restart').onclick=()=>start($('#phone-network').value);
 $('#phone-network').onchange=()=>start($('#phone-network').value);
 window.desk.onPhoneEvent(onPhoneEvent);
 window.addEventListener('desk-busy',()=>held.release());
 window.addEventListener('desk-conversation-changed',()=>closePhonePop());
 window.addEventListener('resize',()=>{if(isOpen())place();});
}
