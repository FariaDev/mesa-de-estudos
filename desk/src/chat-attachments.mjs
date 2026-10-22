import {$,S,toast} from './state.mjs';
import {t} from './ui-text.mjs';
import attachview from './generated/attachview.core.js';
import attachCore from './generated/attachments.core.js';
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
/* A lista de anexos vem de `core/attachview.bend` (a Conversa, aposentada na #50, usava o mesmo
   núcleo); o host resolve os fatos (alt/rótulo/key/handler) e guarda o estado
   vivo — FileReader/compressão, remoção e o `hidden` da caixa. */
const attachmentHandlers={
 RemoveAttachment(e){
  const key=e.currentTarget?.closest?.('.attachment')?.dataset?.key||'';
  if(!key.startsWith('img-'))return;
  const item=S.attachments[Number(key.slice(4))];
  if(!item)return;
  S.attachments=S.attachments.filter(other=>other!==item);
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
function renderAttachments(){
  const box=$('#attachments');
  renderChildren(box,attachview.imageItemViews(attachmentFacts()),attachmentHandlers);
  box.hidden=!S.attachments.length;
}
/* A bandeja sobrevive ao fechamento: as imagens pendentes são guardadas por
   conversa (`desk/pending.cjs`, núcleo `core/pending.bend`) e voltam no boot.
   Quem esvazia a bandeja (enfileirar, enviar, remover) também persiste — o
   arquivo não pode ficar com um anexo que já foi para um item da fila. */
export function persistTray(){
 window.desk.traySave({images:S.attachments}).catch(e=>toast(e.message));
}
/* `provenance` marca de onde o anexo veio (captura do Xournal++: horário e
   exercício do momento). O main usa isso para avisar que a captura não é do
   exercício ativo, em vez de deixá-la passar por tentativa de agora. */
export async function addAttachments(list,provenance){
 const gen=S.attachGen;let added=0;
 for(const file of imageFiles(list)){
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
  S.attachments.push({dataUrl,mimeType:mime,name,capturedAt:provenance?.capturedAt,exercise:provenance?.exercise,app:provenance?.app});added++;
 }
 if(gen!==S.attachGen)return 0;
 renderAttachments();
 persistTray();
 if(added&&S.connected&&!S.supportsImages)toast(t('attach.noVision'));
 return added;
}
export function clearAttachments(items){S.attachments=items?S.attachments.filter(item=>!items.includes(item)):[];renderAttachments();persistTray();}
export function resetAttachments(){S.attachGen++;S.attachments=[];renderAttachments();}
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
 if(!list.length)return;
 S.attachGen++;
 S.attachments=list;
 renderAttachments();
}
/* Os listeners entram na mesma posição em que o chat sempre os registrou
   (depois do handler de eventos do composer): o chat chama esta função. */
export function installAttachmentListeners(){
 /* Clique na miniatura abre a prévia (o × continua dono do remover): sem isso o
    clique "mudava" a bandeja quando caía no × sobreposto ao canto da imagem. */
 $('#attachments').addEventListener('click',e=>{
   if(e.target.closest?.('.attachment-remove'))return;
   const img=e.target.closest?.('.attachment img');
   if(img)openImageDialog('',img.src,img.alt||'Imagem anexada');
 });
 $('#attach').onclick=()=>$('#attach-input').click();
 $('#attach-input').onchange=()=>{addAttachments($('#attach-input').files);$('#attach-input').value='';};
 document.addEventListener('paste',e=>{
  if(S.busy)return;
  const files=[...(e.clipboardData?.items||[])].filter(item=>item.kind==='file'&&item.type.startsWith('image/')).map(item=>item.getAsFile()).filter(Boolean);
  if(files.length){e.preventDefault();addAttachments(files);}
 });
 document.addEventListener('dragover',e=>{if([...(e.dataTransfer?.types||[])].includes('Files'))e.preventDefault();});
 document.addEventListener('drop',e=>{if([...(e.dataTransfer?.types||[])].includes('Files'))e.preventDefault();});
 const chatEl=$('#chat');
 chatEl.addEventListener('dragover',e=>{if([...(e.dataTransfer?.types||[])].includes('Files')){e.preventDefault();if(!S.busy)chatEl.classList.add('dropping');}});
 chatEl.addEventListener('dragleave',e=>{if(!chatEl.contains(e.relatedTarget))chatEl.classList.remove('dropping');});
 chatEl.addEventListener('drop',e=>{chatEl.classList.remove('dropping');const files=imageFiles(e.dataTransfer?.files);if(files.length){e.preventDefault();if(!S.busy)addAttachments(files);}});
}
