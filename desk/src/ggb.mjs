import {$,S,markCourseTab,updateContextSummary,toast} from './state.mjs';
import {addAttachments} from './chat.mjs';
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
export function sendGgbRect(){
 if(!S.ggbActive)return;
 const ref=$('#references').getBoundingClientRect();
 const bar=$('#ggb-bar');
 window.desk.ggbShow({visible:true,rect:{x:Math.round(ref.left),y:Math.round(ref.top+bar.offsetHeight),width:Math.round(ref.width),height:Math.round(Math.max(0,ref.height-bar.offsetHeight))}}).catch(()=>{});
}
window.addEventListener('resize',()=>{if(S.ggbActive)sendGgbRect();});
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
$('#ggb-shot').onclick=async()=>{
 try{
  const shot=await window.desk.ggbShot();
  if(!shot?.dataUrl)return;
  const file=dataUrlFile(shot.dataUrl);
  if(!file)return;
  const added=await addAttachments([file]);
  if(added)toast('Print do GeoGebra anexado ao chat.');
 }catch(e){toast(e.message);}
};
