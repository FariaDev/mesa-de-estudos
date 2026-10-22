'use strict';
const http=require('node:http');
const crypto=require('node:crypto');
const materialModel=require('./material-model.cjs');
const {message}=require('./src/i18n.mjs');
const {describeReceived,invalidValue}=require('./src/error-detail.mjs');
const MAX_BYTES=1100000;
const MAX_OPTIONS_BYTES=2000;

const isText=(value,max)=>typeof value==='string'&&value.trim()!==''&&value.length<=max;
const isOptions=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&JSON.stringify(value).length<=MAX_OPTIONS_BYTES;
/* Cada campo com o formato esperado (#43 fase 3): o tutor lê qual campo errou e o que mandou. */
/** @type {Array<[string, (value: unknown) => boolean, string]>} */
const PDF_FIELDS=[
 ['title',value=>isText(value,120),'string(1..120)'],
 ['markdown',value=>isText(value,262144),'string(1..262144)'],
 /* `modelo` e `opcoes` são opcionais: sem eles o pedido vale como antes (a
    Mesa resolve o modelo da matéria ou o Livre). Valores inválidos voltam
    ao tutor como erro para ele corrigir, nunca viram um modelo qualquer. */
 ['modelo',value=>value===undefined||(typeof value==='string'&&materialModel.isKnownModel(value)),materialModel.MODEL_IDS.join('|')],
 ['opcoes',value=>value===undefined||isOptions(value),`object(JSON ..${MAX_OPTIONS_BYTES})`],
];
/**
 * O primeiro campo do pedido de PDF fora do formato, como mensagem marcada; `''` quando está tudo certo.
 * @param {unknown} payload
 * @returns {string}
 * @example pdfRequestProblem({title: 'Limites', markdown: '# a'}) // ''
 */
function pdfRequestProblem(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))return message('err.pdfbridge.invalid',{field:'payload',received:describeReceived(payload),expected:'object'});
 const wrong=PDF_FIELDS.find(([field,valid])=>!valid(payload[field]));
 return wrong?message('err.pdfbridge.invalid',{field:wrong[0],received:describeReceived(payload[wrong[0]]),expected:wrong[2]}):'';
}

/* Ponte exclusiva do tutor principal: credencial efêmera por conversa,
   escopo capturado no grant, sem caminhos fornecidos pelo modelo. A resposta
   vai ao modelo: `tutorText` põe a mensagem marcada na língua dele (#43 fase 3). */
/** @param {{createMaterial?: (scope: object, request: object) => Promise<unknown>, tutorText?: (raw: string) => string}} [options] */
function createTutorMaterialBridge({createMaterial,tutorText=raw=>raw}={}){
 if(typeof createMaterial!=='function')throw Error(invalidValue('createMaterial',createMaterial,'function'));
 const grants=new Map(),jobs=new Set();let port=0,startPromise=null,closed=false;
 const reply=(res,status,data)=>{if(!res.destroyed){res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));}};
 const refuse=(res,status,raw)=>reply(res,status,{error:tutorText(raw)});
 const server=http.createServer(async(req,res)=>{
  const token=String(req.headers['x-mesa-token']||''),grant=grants.get(token);
  if(req.method!=='POST'||req.url!=='/pdf'){refuse(res,404,message('err.pdfbridge.unavailable',{method:describeReceived(req.method),route:describeReceived(req.url)}));return;}
  if(!grant){refuse(res,403,message('err.pdfbridge.notAuthorized'));return;}
  if(!/^application\/json(?:;|$)/i.test(String(req.headers['content-type']||''))){refuse(res,415,message('err.bridge.badContentType',{received:describeReceived(req.headers['content-type'])}));return;}
  let bytes=0,chunks=[];
  try{
   for await(const chunk of req){bytes+=chunk.length;if(bytes>MAX_BYTES){refuse(res,413,message('err.pdfbridge.tooBig',{max:MAX_BYTES}));return;}chunks.push(chunk);}
   let payload;
   try{payload=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{refuse(res,400,message('err.bridge.badJson',{bytes}));return;}
   const problem=pdfRequestProblem(payload);
   if(problem)throw Error(problem);
   if(grants.get(token)!==grant)throw Error(message('err.pdf.sessionChanged'));
   const controller=new AbortController();jobs.add(controller);grant.jobs.add(controller);
   const cancel=()=>{if(!res.writableEnded)controller.abort();};res.on('close',cancel);
   try{
    const data=await createMaterial(grant.scope,{title:payload.title,markdown:payload.markdown,modelo:payload.modelo,opcoes:payload.opcoes,signal:controller.signal});
    reply(res,200,data);
   }finally{res.removeListener('close',cancel);jobs.delete(controller);grant.jobs.delete(controller);}
  }catch(error){refuse(res,400,error.message||message('err.pdfbridge.failed'));}
 });
 server.requestTimeout=65000;server.headersTimeout=10000;
 return {
  start(){if(closed)return Promise.reject(Error('Ponte de material encerrada: close() já rodou.'));if(!startPromise)startPromise=new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{server.removeListener('error',reject);port=server.address().port;resolve();});});return startPromise;},
  grant(scope){if(!port||closed)throw Error(`Ponte de material ainda indisponível (porta ${port}, ${closed?'encerrada':'sem start()'}).`);const token=crypto.randomBytes(32).toString('hex');grants.set(token,{scope:{...scope},jobs:new Set()});return {url:`http://127.0.0.1:${port}/pdf`,token};},
  revoke(token){const grant=grants.get(token);grants.delete(token);for(const job of grant?.jobs||[])job.abort();},
  async close(){closed=true;for(const job of jobs)job.abort();grants.clear();await startPromise?.catch(()=>{});if(server.listening)await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});port=0;},
 };
}
module.exports={createTutorMaterialBridge,pdfRequestProblem};
