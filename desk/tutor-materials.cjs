'use strict';
const http=require('node:http');
const crypto=require('node:crypto');
const MAX_BYTES=1100000;

/* Ponte exclusiva do tutor principal: credencial efêmera por conversa,
   escopo capturado no grant, sem caminhos fornecidos pelo modelo. */
function createTutorMaterialBridge({createMaterial}={}){
 if(typeof createMaterial!=='function')throw Error('Gerador de material ausente.');
 const grants=new Map(),jobs=new Set();let port=0,startPromise=null,closed=false;
 const reply=(res,status,data)=>{if(!res.destroyed){res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));}};
 const server=http.createServer(async(req,res)=>{
  const token=String(req.headers['x-mesa-token']||''),grant=grants.get(token);
  if(req.method!=='POST'||req.url!=='/pdf'){reply(res,404,{error:'Ação indisponível.'});return;}
  if(!grant){reply(res,403,{error:'Esta conversa não está autorizada a gerar material.'});return;}
  if(!/^application\/json(?:;|$)/i.test(String(req.headers['content-type']||''))){reply(res,415,{error:'Conteúdo inválido.'});return;}
  let bytes=0,chunks=[];
  try{
   for await(const chunk of req){bytes+=chunk.length;if(bytes>MAX_BYTES){reply(res,413,{error:'Conteúdo acima do limite.'});return;}chunks.push(chunk);}
   const payload=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   if(!payload||typeof payload.title!=='string'||!payload.title.trim()||payload.title.length>160||typeof payload.markdown!=='string'||!payload.markdown.trim()||payload.markdown.length>262144)throw Error('Informe título e conteúdo do PDF dentro dos limites.');
   if(grants.get(token)!==grant)throw Error('A conversa mudou; gere o PDF na conversa atual.');
   const controller=new AbortController();jobs.add(controller);grant.jobs.add(controller);
   const cancel=()=>{if(!res.writableEnded)controller.abort();};res.on('close',cancel);
   try{
    const data=await createMaterial(grant.scope,{title:payload.title,markdown:payload.markdown,signal:controller.signal});
    reply(res,200,data);
   }finally{res.removeListener('close',cancel);jobs.delete(controller);grant.jobs.delete(controller);}
  }catch(error){reply(res,400,{error:error.message||'Não foi possível gerar o PDF.'});}
 });
 server.requestTimeout=65000;server.headersTimeout=10000;
 return {
  start(){if(closed)return Promise.reject(Error('Ponte de material encerrada.'));if(!startPromise)startPromise=new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{server.removeListener('error',reject);port=server.address().port;resolve();});});return startPromise;},
  grant(scope){if(!port||closed)throw Error('Ponte de material ainda indisponível.');const token=crypto.randomBytes(32).toString('hex');grants.set(token,{scope:{...scope},jobs:new Set()});return {url:`http://127.0.0.1:${port}/pdf`,token};},
  revoke(token){const grant=grants.get(token);grants.delete(token);for(const job of grant?.jobs||[])job.abort();},
  async close(){closed=true;for(const job of jobs)job.abort();grants.clear();await startPromise?.catch(()=>{});if(server.listening)await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});port=0;},
 };
}
module.exports={createTutorMaterialBridge};
