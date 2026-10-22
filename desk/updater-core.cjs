'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {logEntryLine}=require('./src/log-entry.mjs');

/* Atualização — endereços e listas de código, log do runtime, semver e o
   cache de 24 h (runtime/update.json).
   Saiu de updater.cjs na #43 fase 2; o worker copia este arquivo junto
   (`WORKER_FILES`). */

const RELEASES_URL='https://api.github.com/repos/FariaDev/mesa-de-estudos/releases/latest';
const TAGS_URL='https://api.github.com/repos/FariaDev/mesa-de-estudos/tags';
const PI_REGISTRY_URL='https://registry.npmjs.org/@earendil-works/pi-coding-agent/latest';
const CLAUDE_REGISTRY_URL='https://registry.npmjs.org/@anthropic-ai/claude-code/latest';
const XOURNAL_RELEASES_URL='https://api.github.com/repos/xournalpp/xournalpp/releases/latest';
const XOURNAL_SITE_URL='https://github.com/xournalpp/xournalpp/releases/latest';
const CHECK_TTL=24*60*60*1000;
const CODE_DIRS=new Set(['src','assets','templates','locales','scripts','tests']);
const CODE_ROOT_DIRS=new Set(['core','geogebra','visual-check','.githooks']);
const CODE_ROOT_FILES=new Set(['README.md','AGENTS.md','LICENSE','.gitignore']);
const SKIP_TREE=new Set(['node_modules','.git','.runtime']);
/* O worker escreve no mesmo `desk.log` do main, no mesmo formato (`src/log-entry.mjs`, #43 fase 3). */
function appendLog(logFile,line,{level,...fields}={}){
 try{
  const entry=logEntryLine({area:'update',msg:line,level,fields});
  if(!entry||!logFile)return;
  fs.appendFileSync(logFile,entry);
 }catch{}
}
/* Semver ESTRICTO: só `X.Y.Z` (com ou sem `v`) — prerelease/build
   (`0.4.1-rc.1`, `0.4.1+meta`) não é versão estável e nunca vira "atualização
   disponível"; quem compara contra um prerelease recebe `null`. */
function semverParse(value){
 const m=/^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(value||'').trim());
 return m?[Number(m[1]),Number(m[2]),Number(m[3])]:null;
}
function semverCompare(a,b){
 const left=semverParse(a),right=semverParse(b);
 if(!left||!right)return 0;
 for(let i=0;i<3;i++){if(left[i]!==right[i])return left[i]<right[i]?-1:1;}
 return 0;
}
function isNewer(latest,current){
 return !!semverParse(latest)&&!!semverParse(current)&&semverCompare(latest,current)>0;
}
function readCache(file){
 try{
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  return data&&typeof data==='object'&&!Array.isArray(data)?data:{};
 }catch{return {};}
}
/* Gravação em fila (serializada): ler → mexer → escrever acontece dentro da
   fila, então duas checagens concorrentes (e a marca de toast) não perdem
   entradas do cache por lerem antes e gravarem depois do `await`. */
let cacheQueue=Promise.resolve();
function cacheWrite(file,mutate){
 const next=cacheQueue.then(()=>{
  const cache=file?readCache(file):{};
  const out=mutate(cache)||cache;
  if(file)writeCache(file,out);
  return out;
 });
 cacheQueue=next.catch(()=>{});
 return next;
}
function writeCache(file,data){
 try{
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
 }catch{}
}
function fresh(entry,now){
 return !!entry&&typeof entry.at==='number'&&now-entry.at>=0&&now-entry.at<CHECK_TTL;
}
/* Um toast por versão: marcar aqui evita o "vX disponível" a cada abertura.
   Devolve true só na PRIMEIRA marcação da versão (a leitura/mutação acontece
   dentro da fila — ver cacheWrite). */
function markToasted(file,version){
 let primeira=false;
 const done=cacheWrite(file,cache=>{
  if(cache.toasted===version)return cache;
  primeira=true;
  return {...cache,toasted:version};
 });
 return done.then(()=>primeira);
}

module.exports={RELEASES_URL,TAGS_URL,PI_REGISTRY_URL,CLAUDE_REGISTRY_URL,XOURNAL_RELEASES_URL,XOURNAL_SITE_URL,CHECK_TTL,CODE_DIRS,CODE_ROOT_DIRS,CODE_ROOT_FILES,SKIP_TREE,appendLog,semverParse,semverCompare,isNewer,readCache,cacheWrite,writeCache,fresh,markToasted};
