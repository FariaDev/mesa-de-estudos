export function displayUserText(text){
 if(typeof text!=='string')return '';
 let t=text.replace(/\n\n\[Referências abertas[\s\S]*$/,'').replace(/\n\n\[Conferência visual[\s\S]*$/,'');
 if(/^\/conferir\b/.test(t.trim())||/Conferência visual solicitada pelo usuário/.test(text)){
  const extra=t.replace(/^\/conferir\s*/,'').replace(/^Confira minha resolução e indique o primeiro erro relevante\.?\s*/i,'').trim();
  return extra&&extra!=='Confira minha resolução.'?`Conferir Xournal++\n${extra}`:'Conferir Xournal++';
 }
 return t;
}

export function contentParts(m){
 if(!m)return {text:'',images:[]};
 if(typeof m.content==='string')return {text:m.content,images:[]};
 const parts=m.content||[];
 const text=parts.filter(c=>c&&c.type==='text').map(c=>c.text||'').join('\n');
 const images=parts.filter(c=>c&&c.type==='image'&&(c.data||c.url)).map(c=>c.url||`data:${c.mimeType||'image/png'};base64,${c.data}`);
 return {text,images};
}
