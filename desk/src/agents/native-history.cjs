// Full export reads only the descriptor's explicit native ID via the official
// SDK. Offsets count entries returned by its display-message API, after the
// SDK's internal filtering; user entries can contain tool-result blocks.
async function readNativeHistory({sessionId,dir,sdkLoader,maxBytes=32*1024*1024,maxRows=10000}){
 if(!/^[0-9a-f-]{36}$/i.test(sessionId||''))throw Error('Identidade nativa inválida para exportar.');
 const sdk=await sdkLoader();
 if(typeof sdk.getSessionMessages!=='function')throw Error('Histórico indisponível no SDK do Claude.');
 const rows=[];let bytes=0,offset=0;
 for(;;){
  const page=await sdk.getSessionMessages(sessionId,{dir,offset,limit:200});
  if(!Array.isArray(page))throw Error('Formato de histórico inesperado do Claude.');
  if(!page.length)return rows;
  bytes+=Buffer.byteLength(JSON.stringify(page));offset+=page.length;
  if(bytes>maxBytes||offset>maxRows)throw Error('O histórico excedeu o limite desta exportação. Nenhum arquivo parcial foi gravado.');
  rows.push(...page);
 }
}
module.exports={readNativeHistory};
