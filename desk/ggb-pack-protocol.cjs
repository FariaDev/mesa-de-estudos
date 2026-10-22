'use strict';
const fs=require('node:fs');
const path=require('node:path');

/* Protocolo `mesa-ggb:` do GeoGebra offline (#55), instalado SÓ na sessão da view
   do applet (`persist:geogebra`), como o `mesa-activity:` do Chart.js:
     mesa-ggb://app/ggb.html            → o `ggb.html` da Mesa
     mesa-ggb://app/pack/<caminho>      → arquivo de `<pacote>/GeoGebra/<caminho>`
   Mesma origem para a página e para o pacote, então o GWT do applet faz fetch/XHR
   sem CORS. Com o pacote, a sessão também recusa TODO pedido de rede
   (`blockNetwork`): o GeoGebra offline não fala com ninguém. */
const GGB_SCHEME='mesa-ggb';
const GGB_HOST='app';
const PAGE_URL=`${GGB_SCHEME}://${GGB_HOST}/ggb.html`;
const NETWORK_PROTOCOLS=new Set(['http:','https:','ws:','wss:','ftp:']);
const CONTENT_TYPES=new Map(Object.entries({
 '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8',
 '.png':'image/png','.gif':'image/gif','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon',
 '.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.otf':'font/otf','.eot':'application/vnd.ms-fontobject',
 '.wasm':'application/wasm','.mp3':'audio/mpeg','.ogg':'audio/ogg',
}));
const notFound=()=>new Response('não encontrado',{status:404});
const typeOf=file=>CONTENT_TYPES.get(path.extname(file).toLowerCase())||'application/octet-stream';

/**
 * Caminho real de um arquivo do pacote, ou `null` se o pedido sair da pasta.
 * @param {string} contentDir `<pacote>/GeoGebra`
 * @param {string} relative parte da URL depois de `/pack/`, ainda codificada
 * @returns {string|null}
 * @example resolvePackFile('/p/GeoGebra','HTML5/5.0/web3d/web3d.nocache.js') // '/p/GeoGebra/HTML5/5.0/web3d/web3d.nocache.js'
 * @example resolvePackFile('/p/GeoGebra','..%2Fpack.json') // null
 */
function resolvePackFile(contentDir,relative){
 let decoded;
 try{decoded=decodeURIComponent(String(relative));}catch{return null;}
 if(!decoded||decoded.includes('\0')||decoded.includes('\\')||decoded.split('/').includes('..'))return null;
 const file=path.resolve(contentDir,decoded);
 try{
  const real=fs.realpathSync(file),base=fs.realpathSync(contentDir);
  if(!real.startsWith(base+path.sep)||!fs.statSync(real).isFile())return null;
  return real;
 }catch{return null;}
}

/**
 * Atende `mesa-ggb:`. `contentDir` e `pageFile` entram por parâmetro.
 * @param {{contentDir:string,pageFile:string}} options
 * @returns {(request:{url:string})=>Promise<Response>}
 */
function createGgbProtocolHandler({contentDir,pageFile}){
 return async request=>{
  let url;
  try{url=new URL(request.url);}catch{return notFound();}
  if(url.protocol!==`${GGB_SCHEME}:`||url.host!==GGB_HOST)return notFound();
  const file=url.pathname==='/ggb.html'?pageFile:url.pathname.startsWith('/pack/')?resolvePackFile(contentDir,url.pathname.slice('/pack/'.length)):null;
  if(!file)return notFound();
  try{return new Response(await fs.promises.readFile(file),{status:200,headers:{'content-type':typeOf(file),'cache-control':'no-store'}});}
  catch{return notFound();}
 };
}

/**
 * Recusa pedidos de rede da sessão; só o esquema local, `data:` e `blob:` passam.
 * @param {{webRequest:{onBeforeRequest:Function}}} session
 * @param {(url:string)=>void} [onBlocked]
 */
function blockNetwork(session,onBlocked=()=>{}){
 session.webRequest.onBeforeRequest((details,callback)=>{
  let blocked;
  try{blocked=NETWORK_PROTOCOLS.has(new URL(details.url).protocol);}catch{blocked=true;}
  if(blocked)onBlocked(details.url);
  callback({cancel:blocked});
 });
}

/**
 * Liga o GeoGebra offline na sessão da view: protocolo próprio e rede fechada.
 * @param {{protocol:{handle:Function},webRequest:object}} session
 * @param {{contentDir:string,pageFile:string,onBlocked?:(url:string)=>void}} options
 */
function installOfflineSession(session,{contentDir,pageFile,onBlocked}){
 session.protocol.handle(GGB_SCHEME,createGgbProtocolHandler({contentDir,pageFile}));
 blockNetwork(session,onBlocked);
}

module.exports={GGB_SCHEME,GGB_HOST,PAGE_URL,resolvePackFile,createGgbProtocolHandler,blockNetwork,installOfflineSession};
