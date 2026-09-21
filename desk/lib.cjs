const path=require('node:path');
const core=require('./src/generated/sessions.core.js').default;

/* Rótulos/preview de sessão: o núcleo Bend (core/sessions.bend) decide; o host
   faz o split/JSON.parse, o filtro por arquivo e a data local (componentes).
   Mesmo núcleo do chat/lib.cjs — a lógica não é mais duplicada.
   Degradação defensiva (issue bendlang/bend#798): se o núcleo falhar, o
   preview e o rótulo caem em extratores locais em vez de derrubar a lista de
   sessões ou engolir para vazio. */
const toList=xs=>xs.reduceRight((tail,head)=>({$:'Con',head,tail}),{$:'Nil'});

const IMAGE_EXT=/\.(?:png|jpe?g|gif|webp|svg)$/i;
const LOCAL_IMAGE_PREFIX=/^(?:file:\/\/|\.{0,2}[\\/]|[\\/]|desk[\\/]|[a-zA-Z]:[\\/])/i;

function imageCandidates(input,{learningRoot='',roots=[]}={}){
 if(typeof input!=='string')return [];
 let raw=input.trim();
 if(raw.length>4096)return [];
 if(raw.startsWith('<')&&raw.endsWith('>'))raw=raw.slice(1,-1);
 if(/^file:\/\//i.test(raw))raw=raw.replace(/^file:\/\//i,'');
 try{raw=decodeURIComponent(raw);}catch{}
 raw=raw.replace(/[?#].*$/,'').trim();
 if(!raw||!LOCAL_IMAGE_PREFIX.test(raw)||!IMAGE_EXT.test(raw))return [];
 const base=learningRoot?path.resolve(learningRoot):'';
 if(!base)return [];
 const candidates=path.isAbsolute(raw)?[path.resolve(raw)]:roots.map(root=>path.resolve(root,raw));
 const out=[];
 for(const candidate of candidates){
  if(candidate===base||!candidate.startsWith(base+path.sep))continue;
  if(!IMAGE_EXT.test(candidate))continue;
  out.push(candidate);
 }
 return out;
}

function overlaps(bounds,area){
 return bounds.x<area.x+area.width&&bounds.x+(bounds.width||0)>area.x&&bounds.y<area.y+area.height&&bounds.y+(bounds.height||0)>area.y;
}

/* Com monitor externo conectado, a Mesa vai para ele; sem externo, fica no
   interno. Os bounds salvos só mandam dentro da tela alvo — é onde a janela foi
   ajustada; na outra tela vale só o tamanho, adaptado ao workArea. `internal` é
   o sinal direto; `id !== primaryId` fica como reserva (o externo pode ser o
   primário). */
function placeWindow(displays,primaryId,savedBounds){
 const list=displays||[];
 const external=list.find(d=>d.internal===false)||list.find(d=>d.id!==primaryId);
 const target=external||list.find(d=>d.internal===true)||list.find(d=>d.id===primaryId)||list[0];
 if(!target?.workArea)return {width:Math.min(1600,savedBounds?.width||1200),height:Math.min(1020,savedBounds?.height||800)};
 if(savedBounds&&overlaps(savedBounds,target.workArea))return savedBounds;
 const wa=target.workArea;
 return {
  x:wa.x+20,
  y:wa.y+20,
  width:Math.max(900,Math.min(1600,savedBounds?.width||1600,wa.width-40)),
  height:Math.max(650,Math.min(1020,savedBounds?.height||1020,wa.height-40)),
 };
}

function xournalCandidates(windows){
 return (windows||[]).filter(w=>{
  const b=w.bounds||{};
  const width=b.Width??b.width??0;
  const height=b.Height??b.height??0;
  return /^xournal(?:\+\+|pp)?$/i.test(w.app||'')&&width>100&&height>100;
 });
}

function chooseXournal(windows){
 const selected=xournalCandidates(windows);
 if(selected.length!==1)throw Error(selected.length?'Há várias janelas do Xournal++. Deixe só a resolução visível.':'Abra a resolução no Xournal++ e mantenha a janela não minimizada no desktop atual.');
 return selected[0];
}

function sessionStartedFromPath(file){
 return Number(core.sessionStartedFromPath(String(file||'')));
}

function pad2(n){return String(n).padStart(2,'0');}

/* Preview local (só quando o núcleo falha): primeira mensagem user do JSONL,
   espaços colapsados e corte de 48 — sem os cortes de marcador do núcleo.
   Garante que o preview degrade com texto em vez de engolir para vazio
   (issue bendlang/bend#798). */
function degradedPreview(raw){
 for(const line of String(raw||'').split('\n')){
  if(!line.trim())continue;
  let e;try{e=JSON.parse(line);}catch{continue;}
  const msg=e?.message||e;
  if(msg?.role!=='user')continue;
  const content=msg.content;
  const text=typeof content==='string'?content
   :Array.isArray(content)?content.filter(part=>part&&(part.type==='text'||typeof part==='string')).map(part=>typeof part==='string'?part:String(part.text||'')).join(' ')
   :typeof e?.text==='string'?e.text:'';
  const clean=String(text||'').replace(/\s+/g,' ').trim();
  if(clean)return clean.slice(0,48);
 }
 return '';
}

/* Rótulo local (só quando o núcleo falha): mesma forma do núcleo — data
   `dd/mm, hh:mm` (ou "Conversa") + separador + nota em 40. */
function labelFallback(preview,valid,d){
 const when=valid?`${pad2(d.getDate())}/${pad2(d.getMonth()+1)}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`:'Conversa';
 const note=String(preview||'').replace(/\s+/g,' ').trim().slice(0,40);
 return note?`${when} · ${note}`:when;
}

function parseSessionMessages(raw){
 const msgs=[];
 for(const line of String(raw||'').split('\n').slice(0,80)){
  if(!line.trim())continue;
  let e;try{e=JSON.parse(line);}catch{continue;}
  const msg=e.message||e;
  const role=msg.role||e.role;
  let body=null;
  if(typeof msg.content==='string')body={$:'BodyString',text:msg.content};
  else if(Array.isArray(msg.content)){
   const parts=msg.content.filter(c=>c&&(c.type==='text'||typeof c==='string')).map(c=>typeof c==='string'?c:(c.text||''));
   body={$:'BodyParts',parts:toList(parts)};
  }
  else if(typeof e.text==='string')body={$:'BodyField',text:e.text};
  if(!body)continue;
  msgs.push({$:'SessionMsg',isUser:role==='user',body});
 }
 return toList(msgs);
}

function formatSessionLabel({started,preview,path}){
 const t=started||sessionStartedFromPath(path);
 const d=t?new Date(t):null;
 const valid=!!(d&&!Number.isNaN(d.getTime()));
 try{
  return core.formatSessionLabel('',String(preview||''),false,valid,
   valid?BigInt(d.getDate()):0n,valid?BigInt(d.getMonth()+1):0n,valid?BigInt(d.getHours()):0n,valid?BigInt(d.getMinutes()):0n);
 }catch{
  /* O núcleo não deve falhar com o preview tail-safe; se algo inesperado
     acontecer, o rótulo degrada em vez de derrubar a lista de sessões (#798). */
  return labelFallback(preview,valid,d);
 }
}

function sessionPreviewFromJsonl(raw){
 try{
  return core.sessionPreview(parseSessionMessages(raw),core.mesaCuts());
 }catch{
  /* Degradação defensiva: o núcleo aguenta 100k; se ainda assim falhar, o
     preview local entra no lugar do vazio (#798). */
  return degradedPreview(raw);
 }
}

module.exports={placeWindow,chooseXournal,xournalCandidates,sessionStartedFromPath,formatSessionLabel,sessionPreviewFromJsonl,imageCandidates};
