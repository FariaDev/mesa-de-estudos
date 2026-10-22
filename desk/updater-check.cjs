'use strict';

const {CLAUDE_REGISTRY_URL,PI_REGISTRY_URL,RELEASES_URL,TAGS_URL,XOURNAL_RELEASES_URL,cacheWrite,fresh,isNewer,readCache,semverCompare,semverParse}=require('./updater-core.cjs');
const {invalidValue}=require('./src/error-detail.mjs');

/* Atualização — consulta: GETs públicos com prazo (injetáveis nos testes),
   notas da versão e as versões mais novas da Mesa, do Pi, do Claude Code e
   do Xournal++.
   Saiu de updater.cjs na #43 fase 2; o worker copia este arquivo junto
   (`WORKER_FILES`). */

/* Prazo nos fetches: rede presa não segura o Sobre (o sinal aborta o request). */
function timedFetch(url,{timeout=15000,headers}={}){
 return fetch(url,{headers,signal:AbortSignal.timeout(timeout)});
}
/* Metadata GETs may repeat once after a transient failure. Prompts and ZIP
   downloads are not part of this policy; uncertain delivery never retries here. */
async function defaultFetchJson(url){
 for(let attempt=0;attempt<2;attempt++){
  let res;
  try{
   res=await timedFetch(url,{timeout:10000,headers:{'user-agent':'mesa-de-estudos',accept:'application/json'}});
   if(!res.ok){const error=Error('HTTP '+res.status);error.status=res.status;throw error;}
   return await res.json();
  }catch(error){
   const transient=error instanceof TypeError||['TimeoutError','AbortError'].includes(error.name)||[408,429,502,503,504].includes(error.status);
   if(attempt||!transient)throw error;
   const after=res?.headers.get('retry-after');
   const seconds=after===null||after===undefined?NaN:Number(after);
   const delay=after?(Number.isFinite(seconds)?seconds*1000:Date.parse(after)-Date.now()):1000;
   // A long server cooldown belongs to a later manual check, not a sleeping UI.
   if(!Number.isFinite(delay)||delay>3000)throw error;
   await res?.body?.cancel().catch(()=>{});
   await new Promise(resolve=>setTimeout(resolve,Math.max(0,delay)));
  }
 }
}
async function defaultFetchBuffer(url){
 const res=await timedFetch(url,{timeout:120000,headers:{'user-agent':'mesa-de-estudos'}});
 if(!res.ok)throw Error('HTTP '+res.status);
 return Buffer.from(await res.arrayBuffer());
}
/* Dedup dos GETs em voo: checagem automática e botão manual (ou painel e
   updater) que pedem a mesma URL dividem uma única resposta. */
const inflight=new Map();
function sharedFetchJson(url,fetchJson=defaultFetchJson){
 if(inflight.has(url))return inflight.get(url);
 const pending=fetchJson(url).finally(()=>{inflight.delete(url);});
 inflight.set(url,pending);
 return pending;
}
/* Notas da release chegam em Markdown do GitHub; o Sobre despeja em texto puro
   (o botão "Notas da versão" leva ao Markdown bonito no navegador). O essencial
   é aplainado aqui, na fonte: títulos, negrito, código e link perdem a marca,
   bullets viram `•` — qualquer renderizador cru fica legível. */
function plainifyNotes(text){
 return String(text||'')
  .replace(/^#{1,6}\s+/gm,'')
  .replace(/\*\*([^*]+)\*\*/g,'$1')
  .replace(/__([^_]+)__/g,'$1')
  .replace(/`{1,3}([^`]+)`{1,3}/g,'$1')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'$1')
  .replace(/^\s*[-*+]\s+/gm,'• ')
  .replace(/\n{3,}/g,'\n\n')
  .trim();
}
/* O corte do Sobre é na fronteira de palavra (nada de "dicas" no meio de
   "dicas de uso") e avisa com reticências que tem mais na página. */
function clipNotes(text,limit=2000){
 const s=String(text||'');
 if(s.length<=limit)return s;
 return s.slice(0,limit).replace(/\s+\S*$/,'')+'…';
}
function releaseFromGithub(json){
 if(!json||typeof json!=='object')return null;
 const version=String(json.tag_name||'').replace(/^v/,'').trim();
 if(!semverParse(version))return null;
 return {version,notes:clipNotes(plainifyNotes(json.body)),url:String(json.html_url||'')};
}
/* Fallback `tags`: pega a maior semver listada (a lista não vem garantida em
   ordem). Sem URL — não há botão de notas a mostrar (o núcleo omite). */
function releaseFromTags(json){
 const list=Array.isArray(json)?json:[];
 let best=null;
 for(const item of list.slice(0,40)){
  const version=String(item&&item.name||'').replace(/^v/,'').trim();
  if(!semverParse(version))continue;
  if(!best||semverCompare(version,best.version)>0)best={version,notes:'',url:''};
 }
 return best;
}
/* Checagem da Mesa. Cache 24 h vale para a checagem automática; o botão manual
   força a rede. Erro de rede nunca é exceção para o chamador. */
async function checkForUpdates({current='',manual=false,cacheFile='',fetchJson=defaultFetchJson,now=Date.now()}={}){
 const cache=cacheFile?readCache(cacheFile):{};
 const cached=cache.release;
 if(!manual&&fresh(cached,now)){
  return {status:isNewer(cached.version,current)?'update':'current',version:cached.version||'',notes:cached.notes||'',url:cached.url||'',current,cached:true,checkedAt:Number(cached.at)||0};
 }
 let release=null;
 try{
  try{release=releaseFromGithub(await sharedFetchJson(RELEASES_URL,fetchJson));}
  catch{}
  if(!release)release=releaseFromTags(await sharedFetchJson(TAGS_URL,fetchJson));
 }catch(e){
  return {status:'error',error:String(e&&e.message||e)||'sem rede',version:'',notes:'',url:'',current,cached:false};
 }
 if(!release)return {status:'error',error:'sem release publicada',version:'',notes:'',url:'',current,cached:false};
 if(cacheFile)await cacheWrite(cacheFile,prev=>({...prev,release:{at:now,version:release.version,notes:release.notes,url:release.url}}));
 return {status:isNewer(release.version,current)?'update':'current',version:release.version,notes:release.notes,url:release.url,current,cached:false,checkedAt:now};
}
/* Versão mais nova do Pi. SÓ o registry `@earendil-works` — o antigo
   `@mariozechner/pi-coding-agent` está deprecado e parado em 0.73.1; usá-lo
   como fallback mentiria a versão. Sem resposta = desconhecido, sem erro. */
async function registryLatest(key,url,{cacheFile='',fetchJson=defaultFetchJson,now=Date.now(),manual=false,cacheOnly=false}={}){
 const cache=cacheFile?readCache(cacheFile):{};
 if(!manual&&fresh(cache[key],now))return {version:String(cache[key].version||''),known:!!cache[key].version};
 /* `cacheOnly`: quem só quer saber o que já se sabe (o ponto do ⚙ ao abrir a
    Mesa) não dispara rede; o cache velho vale, a checagem diária refaz. */
 if(cacheOnly)return {version:String(cache[key]?.version||''),known:!!cache[key]?.version};
 try{
  const json=await sharedFetchJson(url,fetchJson);
  const version=String(json&&json.version||'').trim();
  if(!semverParse(version))throw Error(invalidValue('version da resposta',json&&json.version,'semver x.y.z'));
  if(cacheFile)await cacheWrite(cacheFile,prev=>({...prev,[key]:{at:now,version}}));
  return {version,known:true};
 }catch{return {version:'',known:false};}
}
function piLatest(options={}){return registryLatest('pi',PI_REGISTRY_URL,options);}
/* Claude Code (#45): o pacote npm `@anthropic-ai/claude-code`, na mesma
   checagem diária do Pi. Só lê a versão; sem resposta = desconhecido. */
function claudeLatest(options={}){return registryLatest('claude',CLAUDE_REGISTRY_URL,options);}
/* Xournal++ é só informativo (o app não o atualiza): o painel pede sob demanda. */
async function xournalLatest({cacheFile='',fetchJson=defaultFetchJson,now=Date.now(),manual=false}={}){
 const cache=cacheFile?readCache(cacheFile):{};
 if(!manual&&fresh(cache.xournal,now))return {version:String(cache.xournal.version||''),known:!!cache.xournal.version};
 try{
  const json=await sharedFetchJson(XOURNAL_RELEASES_URL,fetchJson);
  const version=String(json&&json.tag_name||'').replace(/^v/,'').trim();
  if(!semverParse(version))throw Error(invalidValue('tag_name da resposta',json&&json.tag_name,'v?x.y.z'));
  if(cacheFile)await cacheWrite(cacheFile,prev=>({...prev,xournal:{at:now,version}}));
  return {version,known:true};
 }catch{return {version:'',known:false};}
}

module.exports={timedFetch,defaultFetchJson,defaultFetchBuffer,sharedFetchJson,releaseFromGithub,releaseFromTags,checkForUpdates,piLatest,claudeLatest,xournalLatest};
