/* Nome do arquivo da captura do Conferir (puro, sem DOM). O anexo se chama
   como o programa capturado: "Xournal++" → xournal.png (o nome de sempre),
   "OneNote" → onenote.png. Acento e símbolos saem; nome que não sobra nada
   vira "janela.png". */
export function captureFileName(app){
 const base=String(app??'')
  .normalize('NFD').replace(/[̀-ͯ]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,'');
 return `${base.slice(0,40)||'janela'}.png`;
}
