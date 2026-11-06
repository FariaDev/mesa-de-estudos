import {$,S,toast,paintComposerSend} from './state.mjs';
import {t,LANGUAGE_EVENT} from './ui-text.mjs';
import {icon} from '../icons.mjs';
import {closeTutorPops} from './tutor-header.mjs';
import attachview from './generated/attachview.core.js';
import attachCore from './generated/attachments.core.js';
import {MAX_CHAT_PDFS} from './chat-pdf.mjs';
import {isPdfFile} from './pdf-drop.mjs';
import {renderChildren} from './view-host.mjs';
import {bendList,openImageDialog} from './chat-assets.mjs';

/* Bandeja de anexos de imagem do composer (extraído de chat.mjs, #29): estado
   vivo em `S.attachments`, compressão, persistência por conversa, colar e
   soltar. O envio, a captura do Xournal++ e o rascunho continuam no chat. */
const ATTACH_TYPES=new Set(['image/png','image/jpeg','image/webp','image/gif']);
/* Números do núcleo (`core/attachments.bend`), não literais: MAX_ATTACH é a
   contagem por mensagem e MAX_ATTACH_BYTES é o teto de bytes crus do envio
   aplicado já ao anexar — a mesma recusa que o main faria depois, um passo
   antes. (maxImages é Nat: em JS chega como BigInt.) */
export const MAX_ATTACH=Number(attachCore.maxImages()),MAX_ATTACH_BYTES=attachCore.maxRawBytes();
const ATTACH_MAX_EDGE=1568;
async function prepareAttachment(file){
 const type=file.type||'image/png';
 if(type==='image/gif')return null;
 try{
  const bmp=await createImageBitmap(file);
  try{
   if(Math.max(bmp.width,bmp.height)<=ATTACH_MAX_EDGE)return null;
   const scale=ATTACH_MAX_EDGE/Math.max(bmp.width,bmp.height);
   const canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(bmp.width*scale));
   canvas.height=Math.max(1,Math.round(bmp.height*scale));
   const ctx=canvas.getContext('2d');
   if(type==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);}
   ctx.drawImage(bmp,0,0,canvas.width,canvas.height);
   const mime=type==='image/jpeg'?'image/jpeg':(type==='image/webp'?'image/webp':'image/png');
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,mime));
   return blob&&blob.size<file.size?blob:null;
  }finally{bmp.close?.();}
 }catch{return null;}
}
function imageFiles(list){return [...(list||[])].filter(file=>file&&ATTACH_TYPES.has(file.type));}
function pdfFiles(list){return [...(list||[])].filter(file=>file&&isPdfFile(file));}
/* A lista de anexos vem de `core/attachview.bend` (a Conversa, aposentada na #50, usava o mesmo
   núcleo); o host resolve os fatos (alt/rótulo/key/handler) e guarda o estado
   vivo — FileReader/compressão, remoção e o `hidden` da caixa. */
const attachmentHandlers={
 RemoveAttachment(e){
  const key=e.currentTarget?.closest?.('.attachment')?.dataset?.key||'';
  if(key.startsWith('pdf-'))S.pdfAttachments=S.pdfAttachments.filter((_item,at)=>at!==Number(key.slice(4)));
  else if(key.startsWith('img-'))S.attachments=S.attachments.filter((_item,at)=>at!==Number(key.slice(4)));
  else return;
  renderAttachments();
  persistTray();
 }
};
function attachmentFacts(){
 return bendList(S.attachments.map((item,at)=>({
  $:'AttachImage',key:`img-${at}`,dataUrl:item.dataUrl,
  alt:item.name?t('attach.alt',{name:item.name}):t('attach.altImage'),
  removeLabel:t('attach.remove',{name:item.name||t('attach.imageWord')}),removeTitle:'',handler:'RemoveAttachment',lazy:false
 })));
}
function pdfFacts(){
 return bendList(S.pdfAttachments.map((item,at)=>({
  $:'AttachFile',key:`pdf-${at}`,name:t('chatpdf.chip',{name:item.name,count:item.pages}),
  removeLabel:t('attach.remove',{name:item.name}),removeTitle:'',handler:'RemoveAttachment'
 })));
}
function renderAttachments(){
  const box=$('#attachments');
  renderChildren(box,attachview.attachmentViews(attachmentFacts(),pdfFacts()),attachmentHandlers);
  box.hidden=!S.attachments.length&&!S.pdfAttachments.length;
  paintComposerSend();
}
/* A bandeja sobrevive ao fechamento: as imagens pendentes são guardadas por
   conversa (`desk/pending.cjs`, núcleo `core/pending.bend`) e voltam no boot.
   Quem esvazia a bandeja (enfileirar, enviar, remover) também persiste — o
   arquivo não pode ficar com um anexo que já foi para um item da fila. */
export function persistTray(){
 window.desk.traySave({images:S.attachments,pdfs:S.pdfAttachments}).catch(e=>toast(e.message));
}
/* `provenance` marca de onde o anexo veio (captura do Xournal++: horário e
   exercício do momento). O main usa isso para avisar que a captura não é do
   exercício ativo, em vez de deixá-la passar por tentativa de agora. */
export async function addAttachments(list,provenance){
 const gen=S.attachGen;let added=0,imagesAdded=0;
 const images=imageFiles(list),pdfs=pdfFiles(list);
 for(const file of images){
  const name=file.name||'imagem';
  let blob=file,mime=file.type||'image/png';
  const prepared=await prepareAttachment(file);
  if(gen!==S.attachGen)return 0;
  if(prepared){blob=prepared;mime=prepared.type||mime;}
  if(blob.size>MAX_ATTACH_BYTES){toast(t('attach.tooBig',{mb:Math.round(MAX_ATTACH_BYTES/1024/1024),name:file.name||t('attach.imageFallbackName')}));continue;}
  const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();
   reader.onload=()=>resolve(reader.result);
   reader.onerror=()=>reject(reader.error||Error(t('attach.readFailed')));
   reader.readAsDataURL(blob);}).catch(()=>'');
  if(gen!==S.attachGen)return 0;
  if(typeof dataUrl!=='string'||!dataUrl.startsWith('data:image/')){toast(t('attach.unreadable'));continue;}
  if(S.attachments.length>=MAX_ATTACH){toast(t('pdf.attach.max',{max:MAX_ATTACH}));break;}
  S.attachments.push({dataUrl,mimeType:mime,name,capturedAt:provenance?.capturedAt,exercise:provenance?.exercise,app:provenance?.app});added++;imagesAdded++;
 }
 for(const file of pdfs){
  if(S.pdfAttachments.length>=MAX_CHAT_PDFS){toast(t('chatpdf.max',{max:MAX_CHAT_PDFS}));break;}
  try{
   const info=await window.desk.attachChatPDF(file);
   if(gen!==S.attachGen)return 0;
   if(!info?.path){toast(t('chatpdf.unreadable',{name:file.name||'PDF'}));continue;}
   if(S.pdfAttachments.some(item=>item.path===info.path))continue;
   S.pdfAttachments.push({name:info.name||file.name||'PDF',path:info.path,pages:Math.max(1,Math.trunc(Number(info.pages))||1)});added++;
  }catch(e){if(gen!==S.attachGen)return 0;toast(e.message||t('chatpdf.unreadable',{name:file.name||'PDF'}));}
 }
 if(gen!==S.attachGen)return 0;
 const skipped=[...(list||[])].filter(file=>file&&!images.includes(file)&&!pdfs.includes(file));
 if(skipped.length)toast(t('chatpdf.onlyPdfOrImage'));
 renderAttachments();
 persistTray();
 if(imagesAdded&&S.connected&&!S.supportsImages)toast(t('attach.noVision'));
 return added;
}
export function clearAttachments(items,pdfs){
 const drop=(value,gone)=>value.filter(item=>!gone.includes(item));
 if(items===undefined&&pdfs===undefined){S.attachments=[];S.pdfAttachments=[];}
 else{
  if(items)S.attachments=drop(S.attachments,items);
  if(pdfs)S.pdfAttachments=drop(S.pdfAttachments,pdfs);
 }
 renderAttachments();persistTray();
}
export function resetAttachments(){S.attachGen++;S.attachments=[];S.pdfAttachments=[];renderAttachments();}
/* Anexos guardados de uma conversa (o payload `pending` do main): entram na
   bandeja depois do `resetAttachments` do boot/troca — sem regravar. */
export function restoreAttachments(pending){
 const list=(Array.isArray(pending?.attachments)?pending.attachments:[]).map(item=>({
  dataUrl:typeof item?.dataUrl==='string'?item.dataUrl:'',
  mimeType:typeof item?.mimeType==='string'?item.mimeType:'',
  name:typeof item?.name==='string'?item.name:'',
  capturedAt:item?.capturedAt,
  exercise:item?.exercise,
  app:typeof item?.app==='string'?item.app:undefined,
 })).filter(item=>item.dataUrl);
 const pdfs=(Array.isArray(pending?.pdfs)?pending.pdfs:[]).map(item=>({
  name:typeof item?.name==='string'&&item.name?item.name:'PDF',
  path:typeof item?.path==='string'?item.path:'',
  pages:Math.max(1,Math.trunc(Number(item?.pages))||1),
 })).filter(item=>item.path);
 if(!list.length&&!pdfs.length)return;
 S.attachGen++;
 S.attachments=list;
 S.pdfAttachments=pdfs;
 renderAttachments();
}
/* Os listeners entram na mesma posição em que o chat sempre os registrou
   (depois do handler de eventos do composer): o chat chama esta função. */
/* ---------- menu Anexar (#90) ---------- */

/* Anexar deixou de abrir o seletor nativo direto: abre um menu com imagem/PDF,
   foto do celular e a captura do Conferir. Só a fileira fica com quatro
   controles; os três jeitos de anexar continuam a um clique. */
const attachPop=()=>$('#attach-pop');
function attachMenuOpen(){const pop=attachPop();return !!pop&&!pop.hidden;}
function attachItems(){return [...(attachPop()?.querySelectorAll('button[role="menuitem"]')||[])].filter(el=>!el.hidden&&!el.disabled);}
function placeAttachMenu(){
 const pop=attachPop(),button=$('#attach');
 if(!pop||pop.hidden||!button)return;
 const host=pop.offsetParent||pop.parentElement;
 if(!host)return;
 const box=host.getBoundingClientRect(),at=button.getBoundingClientRect();
 pop.style.bottom=`${Math.round(box.bottom-at.top+4)}px`;
 pop.style.left=`${Math.max(8,Math.round(at.left-box.left))}px`;
}
function closeAttachMenu({restoreFocus=false}={}){
 if(!attachMenuOpen())return;
 const hadFocus=attachPop().contains(document.activeElement);
 attachPop().hidden=true;
 $('#attach')?.setAttribute('aria-expanded','false');
 if(restoreFocus&&hadFocus)$('#attach')?.focus();
}
function openAttachMenu(){
 const pop=attachPop();
 if(!pop)return;
 closeTutorPops();
 closeAttachMenu();
 pop.hidden=false;
 $('#attach')?.setAttribute('aria-expanded','true');
 placeAttachMenu();
 attachItems()[0]?.focus();
}
function paintAttachLabels(){
 const file=$('#attach-file');
 if(file)file.innerHTML=`${icon('paperclip')} <span>${t('composer.attachFile')}</span>`;
}
function initAttachMenu(){
 $('#attach')?.addEventListener('click',()=>{if(attachMenuOpen())closeAttachMenu({restoreFocus:true});else openAttachMenu();});
 $('#attach')?.addEventListener('keydown',event=>{
  if(event.key==='ArrowDown'){event.preventDefault();openAttachMenu();}
 });
 $('#attach-file')?.addEventListener('click',()=>{closeAttachMenu();$('#attach-input')?.click();});
 /* A captura do Conferir e a Foto do celular fecham o menu antes de agir. */
 $('#check')?.addEventListener('click',()=>closeAttachMenu());
 $('#phone-photo')?.addEventListener('click',()=>closeAttachMenu());
 attachPop()?.addEventListener('keydown',event=>{
  const items=attachItems();
  if(!items.length)return;
  const at=items.indexOf(document.activeElement);
  if(event.key==='Escape'){event.preventDefault();closeAttachMenu({restoreFocus:true});return;}
  if(event.key==='Tab'){closeAttachMenu();return;}
  if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
  event.preventDefault();
  const next=event.key==='Home'?0:event.key==='End'?items.length-1:(at+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;
  items[next]?.focus();
 });
 document.addEventListener('click',event=>{
  if(!attachMenuOpen())return;
  if(event.target?.closest?.('#attach-pop, #attach'))return;
  closeAttachMenu();
 });
 window.addEventListener('resize',()=>{if(attachMenuOpen())placeAttachMenu();});
 window.addEventListener(LANGUAGE_EVENT,paintAttachLabels);
 paintAttachLabels();
}

export function installAttachmentListeners(){
 /* Clique na miniatura abre a prévia (o × continua dono do remover): sem isso o
    clique "mudava" a bandeja quando caía no × sobreposto ao canto da imagem. */
 $('#attachments').addEventListener('click',e=>{
   if(e.target.closest?.('.attachment-remove'))return;
   const img=e.target.closest?.('.attachment img');
   if(img)openImageDialog('',img.src,img.alt||t('attach.altImage'));
 });
 initAttachMenu();
 $('#attach-input').onchange=()=>{addAttachments($('#attach-input').files);$('#attach-input').value='';};
 document.addEventListener('paste',e=>{
  /* Colar durante a resposta entra na bandeja como o texto digitado: o envio
     com o tutor ocupado enfileira (followUp) pelo caminho do texto, levando o
     anexo no item da fila. */
  const files=[...(e.clipboardData?.items||[])].filter(item=>item.kind==='file'&&item.type.startsWith('image/')).map(item=>item.getAsFile()).filter(Boolean);
  if(files.length){e.preventDefault();addAttachments(files);}
 });
 document.addEventListener('dragover',e=>{if([...(e.dataTransfer?.types||[])].includes('Files'))e.preventDefault();});
 document.addEventListener('drop',e=>{if([...(e.dataTransfer?.types||[])].includes('Files'))e.preventDefault();});
 const chatEl=$('#chat');
 chatEl.addEventListener('dragover',e=>{if([...(e.dataTransfer?.types||[])].includes('Files')){e.preventDefault();chatEl.classList.add('dropping');}});
 chatEl.addEventListener('dragleave',e=>{if(!chatEl.contains(e.relatedTarget))chatEl.classList.remove('dropping');});
 chatEl.addEventListener('drop',e=>{chatEl.classList.remove('dropping');const files=[...(e.dataTransfer?.files||[])];if(files.length){e.preventDefault();addAttachments(files);}});
}
