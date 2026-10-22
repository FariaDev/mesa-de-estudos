import {$,toast} from './state.mjs';
import talkCore from './generated/talkview.core.js';
import {build,renderChildren} from './view-host.mjs';
import {assetLocalPath} from './markdown.mjs';
import {renderImageChrome} from './dialogs.mjs';
import {message} from './i18n.mjs';
import {t} from './ui-text.mjs';
import {copiedMark,flashMark} from './icon-motion.mjs';

/* Imagens geradas, cópia e pré-visualização (extraído de chat.mjs, #29). */
function assetFallback(source){return build(talkCore.assetFallback(source));}
/* Fronteira dos assets: `markup` continua dono do HTML do Markdown — a figura
   nasce como placeholder (`figure.asset[data-asset]`) e o `<pre>` realçado sai
   do CODEPLACEHOLDER. A **forma** hidratada (img.plot + figcaption, o `code` de
   fallback e a moldura `.codeblock`) vem do `core/talkview.bend`; ler a imagem
   (IPC `readImage`), o overlay de cópia (clipboard) e os cliques delegados em
   `#messages` ficam aqui. */
function assetRow(source,src,alt,caption){return {$:'AssetRow',src,path:source,alt,caption};}
export function hydrateAssets(root){
 for(const figure of root.querySelectorAll('figure.asset[data-asset]')){
  const source=figure.dataset.asset||'',caption=figure.dataset.caption||'';
  if(!source)continue;
  window.desk.readImage(source).then(hit=>{
   if(!figure.isConnected)return;
   if(!hit){figure.replaceWith(assetFallback(source));return;}
   renderChildren(figure,talkCore.assetKids(assetRow(source,hit.dataUrl,caption||hit.name||'Imagem gerada',caption||hit.name||'')));
   const img=figure.querySelector('img.plot');
   if(img)wrapCopy(img);
  }).catch(()=>{if(figure.isConnected)figure.replaceWith(assetFallback(source));});
 }
 for(const code of root.querySelectorAll('code')){
  if(code.closest('pre'))continue;
  const source=assetLocalPath(code.textContent);
  if(!source)continue;
  window.desk.readImage(source).then(hit=>{
   if(!hit||!code.isConnected)return;
   const figure=build(talkCore.assetFigure(assetRow(source,hit.dataUrl,hit.name||'Imagem gerada',hit.name||'')));
   const img=figure.querySelector('img.plot');
   if(img)wrapCopy(img);
   code.replaceWith(figure);
  }).catch(()=>{/* imagem ilegível: o código fica como texto */});
 }
}
export function bendList(items){let out={$:'Nil'};for(let i=items.length-1;i>=0;i--)out={$:'Con',head:items[i],tail:out};return out;}
function dataUrlToBlob(dataUrl){
 const head=dataUrl.slice(0,dataUrl.indexOf(',')),body=dataUrl.slice(dataUrl.indexOf(',')+1);
 const bin=atob(body),bytes=new Uint8Array(bin.length);
 for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
 return new Blob([bytes],{type:head.slice(5,head.indexOf(';'))||'image/png'});
}
function toPngBlob(src){
 return new Promise((resolve,reject)=>{
  const image=new Image();
  image.onload=()=>{
   try{
    const canvas=document.createElement('canvas');
    canvas.width=image.naturalWidth||image.width;canvas.height=image.naturalHeight||image.height;
    canvas.getContext('2d').drawImage(image,0,0);
    canvas.toBlob(blob=>blob?resolve(blob):reject(Error(message('image.convertFailed'))),'image/png');
   }catch(err){reject(err);}
  };
  image.onerror=()=>reject(Error(message('attach.unreadable')));
  image.src=src;
 });
}
async function copyImageElement(img){
 const src=img?.src||'';
 if(!src)throw Error(message('image.unavailable'));
 const png=src.startsWith('data:image/png')?Promise.resolve(dataUrlToBlob(src)):toPngBlob(src);
 await navigator.clipboard.write([new ClipboardItem({'image/png':png})]);
}
export function wrapCopy(img){
 if(img.closest('.img-wrap'))return img;
 const wrap=document.createElement('span');wrap.className='img-wrap';
 img.replaceWith(wrap);wrap.append(img);
 const copy=document.createElement('button');copy.type='button';copy.className='img-copy';copy.textContent='Copiar';
 copy.addEventListener('click',async e=>{e.stopPropagation();try{await copyImageElement(img);toast(message('toast.imageCopied'));}catch(err){toast(err.message);}});
 wrap.append(copy);
 return wrap;
}
export function openImageDialog(file,source,alt){
 if(!source||$('#image-dialog').open)return;
 $('#image-preview').src=source;
 $('#image-preview').alt=alt||'Imagem';
 renderImageChrome({file:file||'',hasFile:!!file},imageDialogHandlers);
 $('#image-dialog').showModal();
}
const imageDialogHandlers={
 ImageCopy:async()=>{try{await copyImageElement($('#image-preview'));toast(message('toast.imageCopied'));}catch(e){toast(e.message);}},
 ImageOpen:()=>{const file=$('#image-dialog').dataset.path;if(!file)return;window.desk.openImage(file).catch(e=>toast(e.message));},
};
/* Os cliques delegados em #messages e o close do #image-dialog entram na mesma
   posição em que o chat sempre os registrou: o chat chama esta função. */
export function installAssetListeners(){
 $('#messages').addEventListener('click',async e=>{const button=e.target.closest?.('.code-copy');
  if(!button)return;
  e.stopPropagation();
  const pre=button.parentElement?.querySelector('pre');
  if(!pre)return;
  try{await navigator.clipboard.writeText(pre.textContent);
   flashMark(button,copiedMark(),t('talk.copied'));}catch(err){toast(err.message);}});
 $('#messages').addEventListener('click',e=>{const img=e.target.closest?.('img.plot,img.shot');if(img)openImageDialog(img.dataset.path||'',img.src,img.alt);});
 /* A caixa da imagem toma a proporção dela ao carregar (#52); quem põe o `src`
    (o chat, o diálogo do tutor) não precisa saber. */
 const preview=$('#image-preview'),frame=preview.parentElement;
 preview.addEventListener('load',()=>{if(preview.naturalWidth>0&&preview.naturalHeight>0)frame.style.setProperty('--ar',(preview.naturalWidth/preview.naturalHeight).toFixed(4));});
 $('#image-dialog').addEventListener('close',()=>{preview.removeAttribute('src');frame.style.removeProperty('--ar');});
}
