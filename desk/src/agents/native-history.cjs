const {message}=require('../i18n.mjs');
const {describeReceived}=require('../error-detail.mjs');
// Full export reads only the descriptor's explicit native ID via the official
// SDK. Offsets count entries returned by its display-message API, after the
// SDK's internal filtering; user entries can contain tool-result blocks.
async function readNativeHistory({sessionId,dir,sdkLoader,maxBytes=32*1024*1024,maxRows=10000}){
 if(!/^[0-9a-f-]{36}$/i.test(sessionId||''))throw Error(message('err.history.badId',{received:describeReceived(sessionId)}));
 const sdk=await sdkLoader();
 if(typeof sdk.getSessionMessages!=='function')throw Error(message('err.history.sdkMissing'));
 const rows=[];let bytes=0,offset=0;
 for(;;){
  const page=await sdk.getSessionMessages(sessionId,{dir,offset,limit:200});
  if(!Array.isArray(page))throw Error(message('err.history.badPage',{received:describeReceived(page)}));
  if(!page.length)return rows;
  bytes+=Buffer.byteLength(JSON.stringify(page));offset+=page.length;
  if(bytes>maxBytes||offset>maxRows)throw Error(message('err.history.tooBig',{rows:offset,bytes,maxRows,maxBytes}));
  rows.push(...page);
 }
}
module.exports={readNativeHistory};
