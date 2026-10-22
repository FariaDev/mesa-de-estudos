import {$,S,markCourseTab,updateContextSummary,toast} from './state.mjs';
import {text,t} from './ui-text.mjs';
import boardCore from './generated/ggbboard.core.js';
import {addAttachments} from './chat.mjs';
import overlayCore from './generated/overlay.core.js';
import {toNat} from './bend-nat.mjs';
import {overlayWatch} from './overlay-watch.mjs';
export function activateGeogebra(){
 if(S.ggbActive)return;
 S.ggbActive=true;
 $('#references').classList.add('ggb');
 $('#ggb-bar').hidden=false;
 markCourseTab('geogebra');
 updateContextSummary();
 sendGgbRect();
}
export function deactivateGeogebra(){
 if(!S.ggbActive)return;
 S.ggbActive=false;
 $('#references').classList.remove('ggb');
 $('#ggb-bar').hidden=true;
 window.desk.ggbSnapshot().catch(()=>{});
 window.desk.ggbShow({visible:false}).catch(()=>{});
}
/* WebContentsView fica acima do DOM: toda sobreposição de página inteira
   precisa tirar a view de cima, senão ela tampa a tela cheia, o diálogo ou a
   imagem (#52). UMA lista de seletores vale para todas; sobreposição nova entra
   aqui (ou ganha `dialog[open]`), nunca num caso por tela. A decisão é do núcleo
   (`core/overlay.bend`): "coberta" esconde a view sem fechar, então a construção
   e o retângulo ficam e ela volta no mesmo lugar. */
export const OVERLAY_SELECTOR='dialog[open],#command-palette:not([hidden]),.activity-fullscreen';
const openOverlays=()=>document.querySelectorAll(OVERLAY_SELECTOR).length;
/* Arrasto do divisor do chat (ajustes do GeoGebra): a view nativa não segue o
   DOM e recarrega o applet a cada tamanho, então durante o arrasto ela vira uma
   captura parada (`ggbFreeze` no host) e o retângulo só vai uma vez, no fim. */
const ggbDrag={frozen:false,shot:null,freezing:Promise.resolve()};
function ggbArea(){
 const ref=$('#references').getBoundingClientRect(),bar=$('#ggb-bar');
 return {x:Math.round(ref.left),y:Math.round(ref.top+bar.offsetHeight),width:Math.round(ref.width),height:Math.round(Math.max(0,ref.height-bar.offsetHeight)),top:bar.offsetHeight};
}
function showFreezeShot(dataUrl,area){
 const shot=document.createElement('img');
 shot.className='ggb-freeze';
 shot.alt='';
 shot.setAttribute('aria-hidden','true');
 shot.src=dataUrl;
 shot.style.cssText=`top:${area.top}px;width:${area.width}px;height:${area.height}px`;
 $('#references').append(shot);
 return shot;
}
export async function freezeGgbView(){
 if(!S.ggbActive||ggbDrag.frozen)return;
 ggbDrag.frozen=true;
 const area=ggbArea();
 ggbDrag.freezing=window.desk.ggbFreeze().catch(()=>({dataUrl:''}));
 const {dataUrl}=await ggbDrag.freezing;
 if(ggbDrag.frozen&&dataUrl)ggbDrag.shot=showFreezeShot(dataUrl,area);
}
/* Espera o congelamento: num clique rápido no divisor, o host esconderia a
   view DEPOIS de o retângulo final tê-la mostrado. */
export async function thawGgbView(){
 if(!ggbDrag.frozen)return;
 await ggbDrag.freezing;
 ggbDrag.frozen=false;
 const shot=ggbDrag.shot;ggbDrag.shot=null;
 if(S.ggbActive)await sendGgbRect();
 shot?.remove();
}
export function sendGgbRect(){
 if(ggbDrag.frozen)return Promise.resolve();
 const state=overlayCore.viewState(!!S.ggbActive,openOverlays()).$;
 if(state==='ViewOff')return Promise.resolve();
 const {x,y,width,height}=ggbArea();
 return window.desk.ggbShow({visible:true,covered:state==='ViewCovered',rect:{x,y,width,height}}).catch(()=>{});
}
window.addEventListener('resize',()=>{if(S.ggbActive)sendGgbRect();});
/* A coluna das referências muda de largura sem `resize` da janela (divisor pelo
   teclado, chat recolhido, fim do arrasto): a view acompanha, um quadro por vez. */
if(typeof ResizeObserver==='function'){
 let pending=0,last='';
 new ResizeObserver(()=>{
  if(!S.ggbActive||pending)return;
  pending=requestAnimationFrame(()=>{
   pending=0;
   const area=ggbArea(),key=`${area.x},${area.y},${area.width},${area.height}`;
   if(key===last)return;
   last=key;sendGgbRect();
  });
 }).observe($('#references'));
}
new MutationObserver(overlayWatch({active:()=>!!S.ggbActive,count:openOverlays,onChange:sendGgbRect})).observe(document.body,{subtree:true,attributes:true,attributeFilter:['hidden','open','class']});
/* O print chega em data URL. O CSP do renderer (`connect-src 'self' file:`)
   barra `fetch(data:...)` — o caminho antigo caía em "Failed to fetch" e o
   anexo nunca entrava. Decodificar o base64 em bytes resolve sem afrouxar o
   CSP; o `addAttachments` do chat usa FileReader e segue lendo o File. */
function dataUrlFile(dataUrl,name='geogebra.png'){
 const match=/^data:([^;,]*)(;base64)?,([\s\S]*)$/.exec(String(dataUrl||''));
 if(!match)return null;
 const type=match[1]||'image/png';
 let bytes;
 try{
  bytes=match[2]?Uint8Array.from(atob(match[3]),character=>character.charCodeAt(0)):new TextEncoder().encode(decodeURIComponent(match[3]));
 }catch{return null;}
 return new File([bytes],name,{type});
}
/* Quadro limpo por uso (#53): o host avisa quando o tutor limpou o quadro e
   quantas construções ficaram guardadas; o botão só existe com algo a voltar.
   O aviso é discreto e some sozinho (a trilha do que foi guardado é o botão). */
let noteTimer=0;
function showBoardNote(note){
 const el=$('#ggb-board-note');
 clearTimeout(noteTimer);
 el.textContent=note?text(note):'';
 el.hidden=!note;
 if(note)noteTimer=setTimeout(()=>{el.hidden=true;el.textContent='';},12000);
}
export function showBoardStatus(status){
 const back=$('#ggb-back');
 const kept=Math.max(0,Number(status?.kept)||0);
 back.hidden=!status?.canGoBack;
 back.textContent=text(boardCore.backLabel());
 back.title=text(boardCore.backTitle(toNat(kept)));
 if(status?.note)showBoardNote(status.note);
}
window.desk.onGgbBoard?.(showBoardStatus);
window.desk.ggbBoard?.().then(showBoardStatus).catch(()=>{});
window.addEventListener('desk-language',()=>window.desk.ggbBoard?.().then(showBoardStatus).catch(()=>{}));
$('#ggb-back').onclick=async()=>{
 try{
  const result=await window.desk.ggbRestore();
  if(result&&result.restored===false)showBoardNote(boardCore.nothingToRestoreNote());
 }catch(e){toast(e.message);}
};
$('#ggb-shot').onclick=async()=>{
 try{
  const shot=await window.desk.ggbShot();
  if(!shot?.dataUrl)return;
  const file=dataUrlFile(shot.dataUrl);
  if(!file)return;
  const added=await addAttachments([file]);
  if(added)toast(t('ggb.shotAttached'));
 }catch(e){toast(e.message);}
};
