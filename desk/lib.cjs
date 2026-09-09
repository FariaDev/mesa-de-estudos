function overlaps(bounds,area){
 return bounds.x<area.x+area.width&&bounds.x+(bounds.width||0)>area.x&&bounds.y<area.y+area.height&&bounds.y+(bounds.height||0)>area.y;
}

function placeWindow(displays,primaryId,savedBounds){
 const list=displays||[];
 if(savedBounds&&list.some(d=>d.workArea&&overlaps(savedBounds,d.workArea)))return savedBounds;
 const external=list.find(d=>d.id!==primaryId);
 const target=external||list.find(d=>d.id===primaryId)||list[0];
 if(!target?.workArea)return {width:Math.min(1600,savedBounds?.width||1200),height:Math.min(1020,savedBounds?.height||800)};
 const wa=target.workArea;
 return {x:wa.x+20,y:wa.y+20,width:Math.min(1600,Math.max(900,wa.width-40)),height:Math.min(1020,Math.max(650,wa.height-40))};
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
 const m=String(file||'').match(/pi-(\d+)\.jsonl$/);
 return m?Number(m[1]):0;
}

function formatSessionLabel({started,preview,path}){
 const t=started||sessionStartedFromPath(path);
 const d=t?new Date(t):null;
 const when=d&&!Number.isNaN(d.getTime())?d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'Conversa';
 const note=(preview||'').replace(/\s+/g,' ').trim();
 return note?`${when} · ${note.slice(0,40)}`:when;
}

function sessionPreviewFromJsonl(raw){
 if(!raw)return '';
 for(const line of String(raw).split('\n').slice(0,80)){
  if(!line.trim())continue;
  let e;try{e=JSON.parse(line);}catch{continue;}
  const msg=e.message||e;
  const role=msg.role||e.role;
  if(role!=='user')continue;
  let text='';
  if(typeof msg.content==='string')text=msg.content;
  else if(Array.isArray(msg.content))text=msg.content.filter(c=>c&&(c.type==='text'||typeof c==='string')).map(c=>c.text||c).join(' ');
  else if(typeof e.text==='string')text=e.text;
  text=text.replace(/\n\n\[Referências abertas[\s\S]*$/,'').replace(/\n\n\[Conferência visual[\s\S]*$/,'');
  if(/^\/conferir\b/.test(text.trim()))text='Conferir Xournal++';
  text=text.replace(/\s+/g,' ').trim();
  if(text)return text.slice(0,48);
 }
 return '';
}

module.exports={placeWindow,chooseXournal,xournalCandidates,sessionStartedFromPath,formatSessionLabel,sessionPreviewFromJsonl};
