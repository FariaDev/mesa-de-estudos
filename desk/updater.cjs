/* Updater por clique da Mesa: checagem (GitHub releases da tag pública) e
   aplicação (git / bundle / zip) com rollback.

   - Checagem: `releases/latest` com fallback em `tags`; semver ESTRICTO contra
     `app.getVersion()` (prerelease/build não vira "versão estável"); cache de
     24 h no runtime (`update.json`) com gravação serializada (duas checagens
     concorrentes não perdem entrada); fetch com prazo (rede presa não segura
     o Sobre) e dedup dos GETs em voo; offline/erro = silêncio (status
     "error", sem drama).
   - Aplicação: o app grava uma CÓPIA DESTE ARQUIVO no tmpdir e a dispara
     destacada (`spawn` detached); o script espera o PID sair, aplica e reabre.
     Por isso este módulo só usa builtins do Node — ele viaja sozinho.
     O arranque do worker tem HANDSHAKE (arquivo de status escrito antes de
     qualquer mutação): quem chamou só fecha o app depois de o worker confirmar
     que subiu — Node ausente do PATH, spawn que falha ou handshake que não
     chega abortam a atualização COM o app ainda de pé.
   - Origem: clone (`desk/../.git`) → `git pull --ff-only` (a branch de
     DESENVOLVIMENTO — a versão final é conferida no package.json; clone com
     trabalho local é recusado antes de qualquer mutação); bundle com
     `install-source.json` → atualiza o clone e re-sincroniza (install-app);
     sem git → baixa o zip da tag (codeload), valida a versão no staging,
     substitui SÓ a lista explícita de arquivos de código (o manifesto gravado
     na instalação define o que é gerenciado: órfão gerenciado sai, arquivo
     local fica), nunca os caminhos protegidos.
   - Invariantes: NUNCA tocar `config.json`, Application Support/%APPDATA%,
     `desk/.runtime/` (só append em `desk.json`/`desk.log` do runtime é do
     app), sessões (`*.jsonl`), PDFs, `.xopp`, `node_modules`, `install-source.json`
     ou templates do usuário (as cópias do vault/matéria estão fora daqui).
     Somente GETs públicos; zero telemetria.
   - A aplicação é uma TRANSAÇÃO: instantâneo dos arquivos que a atualização
     gerencia ANTES de qualquer mutação (nada de percorrer a raiz toda), lock
     compartilhado entre Sobre/Atualizar Pi/CLI, o app tem de ter SAÍDO no
     prazo (senão aborta sem tocar nada) e a instalação anterior permanece até
     a confirmação.
   - Rollback é REQUISITO: falhou no meio → instantâneo volta ao lugar (+ git
     reset para a cabeça antiga no modo git + `npm ci` de recuperação quando as
     dependências foram mexidas + re-sync do payload no bundle), o motivo vai
     para `.runtime/desk.log` e a
     versão antiga reabre. Se a própria recuperação falhar, o BACKUP fica no
     lugar (caminho no log) — nunca apagado em cima de um rollback incompleto. */
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const zlib=require('node:zlib');
const {spawn,execFile}=require('node:child_process');
const {promisify}=require('node:util');
const execFileAsync=promisify(execFile);
/* O contrato do Pi local (`desk/.pi-local`) mora no pi.cjs: o setup e o
   updater usam o MESMO ensure (uma fonte para o diretório+package.json). */
const {ensurePiLocalHome}=require('./pi.cjs');

const RELEASES_URL='https://api.github.com/repos/FariaDev/mesa-de-estudos/releases/latest';
const TAGS_URL='https://api.github.com/repos/FariaDev/mesa-de-estudos/tags';
const PI_REGISTRY_URL='https://registry.npmjs.org/@earendil-works/pi-coding-agent/latest';
const XOURNAL_RELEASES_URL='https://api.github.com/repos/xournalpp/xournalpp/releases/latest';
const XOURNAL_SITE_URL='https://github.com/xournalpp/xournalpp/releases/latest';
const CHECK_TTL=24*60*60*1000;
const CODE_DIRS=new Set(['src','assets','templates','scripts','tests']);
const CODE_ROOT_DIRS=new Set(['core','geogebra','visual-check','.githooks']);
const CODE_ROOT_FILES=new Set(['README.md','AGENTS.md','LICENSE','.gitignore']);
const SKIP_TREE=new Set(['node_modules','.git','.runtime']);

/* ---------- log do runtime (mesmo formato do main.cjs) ---------- */

function appendLog(logFile,line){
 try{
  const text=String(line??'').replace(/\s+$/,'').slice(0,4000);
  if(!text||!logFile)return;
  fs.appendFileSync(logFile,JSON.stringify({t:new Date().toISOString(),src:'update',line:text})+'\n');
 }catch{}
}

/* ---------- semver ---------- */

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

/* ---------- cache de 24 h (runtime/update.json) ---------- */

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

/* ---------- rede: só GETs públicos, injetáveis nos testes ---------- */

/* Prazo nos fetches: rede presa não segura o Sobre (o sinal aborta o request). */
function timedFetch(url,{timeout=15000,headers}={}){
 return fetch(url,{headers,signal:AbortSignal.timeout(timeout)});
}

async function defaultFetchJson(url){
 const res=await timedFetch(url,{timeout:10000,headers:{'user-agent':'mesa-de-estudos',accept:'application/json'}});
 if(!res.ok)throw Error('HTTP '+res.status);
 return res.json();
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

function releaseFromGithub(json){
 if(!json||typeof json!=='object')return null;
 const version=String(json.tag_name||'').replace(/^v/,'').trim();
 if(!semverParse(version))return null;
 return {version,notes:String(json.body||'').slice(0,2000),url:String(json.html_url||'')};
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
  return {status:isNewer(cached.version,current)?'update':'current',version:cached.version||'',notes:cached.notes||'',url:cached.url||'',current,cached:true};
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
 return {status:isNewer(release.version,current)?'update':'current',version:release.version,notes:release.notes,url:release.url,current,cached:false};
}

/* Versão mais nova do Pi. SÓ o registry `@earendil-works` — o antigo
   `@mariozechner/pi-coding-agent` está deprecado e parado em 0.73.1; usá-lo
   como fallback mentiria a versão. Sem resposta = desconhecido, sem erro. */
async function piLatest({cacheFile='',fetchJson=defaultFetchJson,now=Date.now(),manual=false}={}){
 const cache=cacheFile?readCache(cacheFile):{};
 if(!manual&&fresh(cache.pi,now))return {version:String(cache.pi.version||''),known:!!cache.pi.version};
 try{
  const json=await sharedFetchJson(PI_REGISTRY_URL,fetchJson);
  const version=String(json&&json.version||'').trim();
  if(!semverParse(version))throw Error('resposta sem versão');
  if(cacheFile)await cacheWrite(cacheFile,prev=>({...prev,pi:{at:now,version}}));
  return {version,known:true};
 }catch{return {version:'',known:false};}
}

/* Xournal++ é só informativo (o app não o atualiza): o painel pede sob demanda. */
async function xournalLatest({cacheFile='',fetchJson=defaultFetchJson,now=Date.now(),manual=false}={}){
 const cache=cacheFile?readCache(cacheFile):{};
 if(!manual&&fresh(cache.xournal,now))return {version:String(cache.xournal.version||''),known:!!cache.xournal.version};
 try{
  const json=await sharedFetchJson(XOURNAL_RELEASES_URL,fetchJson);
  const version=String(json&&json.tag_name||'').replace(/^v/,'').trim();
  if(!semverParse(version))throw Error('resposta sem versão');
  if(cacheFile)await cacheWrite(cacheFile,prev=>({...prev,xournal:{at:now,version}}));
  return {version,known:true};
 }catch{return {version:'',known:false};}
}

/* ---------- caminhos: lista explícita + caminhos protegidos ---------- */

function normalizeRel(rel){
 return String(rel||'').replace(/\\/g,'/').replace(/^\.\//,'').replace(/^\/+/,'');
}

/* O cinto de segurança do modo zip: mesmo que a lista de código erre, nada
   destes caminhos sai do zip para o disco do usuário. */
function isProtected(rel){
 const norm=normalizeRel(rel);
 if(!norm)return true;
 const parts=norm.split('/');
 if(parts.some(p=>p==='..'||p===''))return true;
 if(/^[a-zA-Z]:/.test(norm))return true;
 if(/(^|\/)(config\.json|desk\.json|install-source\.json|\.update-manifest\.json)$/i.test(norm))return true;
 if(/(^|\/)\.runtime(\/|$)/.test(norm))return true;
 if(/(^|\/)node_modules(\/|$)/.test(norm))return true;
 if(/\.(jsonl|xopp|pdf|log)$/i.test(norm))return true;
 if(/\.app(\/|$)/.test(norm))return true;
 return false;
}

/* Lista explícita do que o modo zip pode substituir: módulos de código e
   documentos de UI do desk (tests incluído — o manifesto apaga o órfão),
   o miolo de src/assets/templates/scripts/tests e as árvores de código do
   repo (core/geogebra/visual-check/.githooks + raiz).
   Nada fora desta lista é tocado — e a lista nunca inclui o protegido. */
function isReplaceable(rel){
 const norm=normalizeRel(rel);
 if(!norm||isProtected(norm))return false;
 const parts=norm.split('/');
 const [first,second]=parts;
 if(first==='desk'&&parts.length===2){
  return /\.(cjs|mjs|html|css|md|json)$/i.test(second)&&!/^(config|desk)\.json$/.test(second);
 }
 if(first==='desk'&&parts.length>2)return CODE_DIRS.has(second);
 if(parts.length>1)return CODE_ROOT_DIRS.has(first);
 return CODE_ROOT_FILES.has(norm);
}

/* ---------- zip mínimo (leitura): codeload entrega .zip e o worker não pode
   depender de unzip/tar — parsing próprio com inflateRaw do zlib. ---------- */

function readZip(buffer){
 const end=buffer.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));
 if(end<0)throw Error('zip sem diretório central');
 const count=buffer.readUInt16LE(end+10);
 const cdOffset=buffer.readUInt32LE(end+16);
 const entries=[];
 let pos=cdOffset;
 for(let i=0;i<count;i++){
  if(buffer.readUInt32LE(pos)!==0x02014b50)throw Error('zip corrompido (entrada '+i+')');
  const method=buffer.readUInt16LE(pos+10);
  const size=buffer.readUInt32LE(pos+20);
  const nameLen=buffer.readUInt16LE(pos+28);
  const extraLen=buffer.readUInt16LE(pos+30);
  const commentLen=buffer.readUInt16LE(pos+32);
  const localAt=buffer.readUInt32LE(pos+42);
  const name=buffer.toString('utf8',pos+46,pos+46+nameLen);
  pos+=46+nameLen+extraLen+commentLen;
  if(name.endsWith('/'))continue;
  if(buffer.readUInt32LE(localAt)!==0x04034b50)throw Error('zip corrompido (cabeçalho de '+name+')');
  const localNameLen=buffer.readUInt16LE(localAt+26);
  const localExtraLen=buffer.readUInt16LE(localAt+28);
  const dataAt=localAt+30+localNameLen+localExtraLen;
  const raw=buffer.subarray(dataAt,dataAt+size);
  const data=method===0?Buffer.from(raw):method===8?zlib.inflateRawSync(raw):null;
  if(!data)throw Error('zip com método de compressão não suportado ('+method+')');
  entries.push({name,data});
 }
 return entries;
}

/* Zip-slip fica barrado antes de qualquer escrita: nada de `..`, absoluto ou
   unidade de disco nos nomes do zip. */
function assertSafeEntries(entries){
 for(const entry of entries){
  const norm=normalizeRel(entry.name);
  if(!norm||norm.split('/').some(p=>p==='..')||/^[a-zA-Z]:/.test(norm)||entry.name.startsWith('/')){
   throw Error('zip com caminho suspeito: '+entry.name);
  }
 }
}

function stripCommonRoot(entries){
 const names=entries.map(e=>normalizeRel(e.name));
 const first=names[0]?names[0].split('/')[0]:null;
 const nested=first&&names.every(n=>n.startsWith(first+'/'));
 return entries.map((entry,i)=>({name:nested?names[i].slice(first.length+1):names[i],data:entry.data}));
}

/* ---------- caminho de verdade: symlink no destino é recusado ---------- */

/* writeFileSync/copyFileSync SEGUEM links: alvo que é symlink (ou que mora
   dentro de um diretório que é) pode pousar fora da raiz gerenciada. O par
   abaixo lê o destino com lstat e recusa antes de qualquer escrita — link para
   fora, link para dentro, tanto faz: conservador, nenhum link é seguido. */
function assertRealTarget(rootDir,abs,rel){
 try{
  const st=fs.lstatSync(abs);
  if(st.isSymbolicLink())throw Error(`alvo é link simbólico (${rel}) — recusado`);
  if(!st.isFile()&&!st.isDirectory())throw Error(`alvo não é arquivo regular (${rel}) — recusado`);
 }catch(e){
  if(e&&e.code==='ENOENT')return; // não existe ainda: nada a seguir
  throw e;
 }
 const root=path.resolve(rootDir);
 let cur=path.dirname(path.resolve(abs));
 while(cur===root||cur.startsWith(root+path.sep)){
  if(cur===root)break;
  let st;
  try{st=fs.lstatSync(cur);}catch(e){if(e&&e.code==='ENOENT')break;throw e;}
  if(st.isSymbolicLink())throw Error(`diretório pai é link simbólico (${cur}) — recusado`);
  cur=path.dirname(cur);
 }
}

/* ---------- manifesto da instalação (B1) ---------- */

/* O que a instalação CONSIDERA gerenciado, por versão, gravado no disco:
   o próximo update apaga o que era gerenciado e sumiu da versão nova
   (órfão) e preserva o que nunca esteve no manifesto (arquivo local). */
function manifestFile(rootDir){
 return path.join(rootDir,'.update-manifest.json');
}

function readManifest(rootDir){
 try{
  const data=JSON.parse(fs.readFileSync(manifestFile(rootDir),'utf8'));
  if(data&&Array.isArray(data.files))return data.files.filter(f=>typeof f==='string');
 }catch{}
 return [];
}

function writeManifest(rootDir,version,files){
 try{
  fs.mkdirSync(path.dirname(manifestFile(rootDir)),{recursive:true});
  fs.writeFileSync(manifestFile(rootDir),JSON.stringify({version,at:new Date().toISOString(),files},null,2)+'\n');
 }catch{}
}

/* Órfão = estava no manifesto anterior e não voltou na versão nova. */
function removeOrphans(rootDir,previous,written,log=()=>{}){
 const now=new Set(written);
 let removed=0;
 for(const rel of previous||[]){
  const norm=normalizeRel(rel);
  if(!norm||now.has(norm))continue;
  /* O manifesto é dado do disco: só apaga o que a lista de código aceita —
     entrada adulterada (`../x`, absoluto) nunca vira delete fora da raiz. */
  if(!isReplaceable(norm)){log('update: entrada de manifesto recusada: '+norm);continue;}
  const target=path.join(rootDir,...norm.split('/'));
  try{
   fs.rmSync(target,{force:true});
   removed++;
   log('update: órfão gerenciado removido: '+norm);
  }catch(e){log('update: órfão não removido ('+norm+'): '+String(e&&e.message||e));}
 }
 return removed;
}

/* Aplica o zip com o staging conferido ANTES da cópia: a versão do
   `package.json` extraído bate com a anunciada, SÓ a lista explícita é
   copiada, protegido nunca, alvo com link simbólico recusado ANTES da
   escrita. Devolve os arquivos escritos (`written`, vira o manifesto novo),
   os criados (o rollback apaga) e os pulados. */
function applyZip(buffer,{rootDir,announcedVersion='',log=()=>{},created=[],written=[]}={}){
 const raw=readZip(buffer);
 assertSafeEntries(raw);
 const entries=stripCommonRoot(raw);
 assertSafeEntries(entries);
 const pkg=entries.find(e=>e.name==='desk/package.json');
 if(!pkg)throw Error('zip sem desk/package.json');
 let version='';
 try{version=String(JSON.parse(pkg.data.toString('utf8')).version||'');}catch{throw Error('desk/package.json ilegível no zip');}
 if(announcedVersion&&version!==String(announcedVersion)){
  throw Error(`a versão do zip (${version}) não bate com a anunciada (${announcedVersion})`);
 }
 let replaced=0,skipped=0;
 for(const entry of entries){
  if(!isReplaceable(entry.name)){skipped++;if(isProtected(entry.name))log('update: ignorado (protegido): '+entry.name);continue;}
  const target=path.join(rootDir,...entry.name.split('/'));
  const rel=path.relative(rootDir,target);
  if(rel.startsWith('..')||path.isAbsolute(rel))throw Error('alvo fora da raiz: '+entry.name);
  assertRealTarget(rootDir,target,rel);
  const existed=fs.existsSync(target);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,entry.data);
  if(!existed)created.push(entry.name);
  written.push(entry.name);
  replaced++;
 }
 return {created,written,replaced,skipped,version};
}

/* ---------- instantâneo / rollback ---------- */

/* O que o rollback precisa para devolver a versão antiga: SOMENTE os arquivos
   que a atualização gerencia (a lista explícita + o manifesto anterior) —
   nunca a raiz toda (PDFs, config.json e árvores de outros produtos ficam
   fora do instantâneo por construção). `include` é o predicado da lista. */
function snapshotTree(rootDir,backupDir,include){
 const files=[];
 const walk=(rel)=>{
  const abs=rel?path.join(rootDir,rel):rootDir;
  for(const entry of fs.readdirSync(abs,{withFileTypes:true})){
   const childRel=rel?path.join(rel,entry.name):entry.name;
   if(entry.isDirectory()){
    if(SKIP_TREE.has(entry.name)||entry.name.endsWith('.app')||entry.name.startsWith('.test-runtime-'))continue;
    walk(childRel);
    continue;
   }
   if(!entry.isFile())continue;
   if(include&&!include(childRel))continue;
   const dest=path.join(backupDir,childRel);
   fs.mkdirSync(path.dirname(dest),{recursive:true});
   fs.copyFileSync(path.join(rootDir,childRel),dest);
   files.push(childRel);
  }
 };
 walk('');
 return files;
}

function restoreTree(rootDir,backupDir,created=[]){
 const files=[];
 const walk=(rel)=>{
  const abs=rel?path.join(backupDir,rel):backupDir;
  for(const entry of fs.readdirSync(abs,{withFileTypes:true})){
   const childRel=rel?path.join(rel,entry.name):entry.name;
   if(entry.isDirectory()){walk(childRel);continue;}
   if(!entry.isFile())continue;
   const target=path.join(rootDir,childRel);
   /* O update não devia ter feito links, mas se fez o restore não os segue. */
   try{const st=fs.lstatSync(target);if(st.isSymbolicLink())fs.rmSync(target,{force:true});}catch{}
   fs.mkdirSync(path.dirname(target),{recursive:true});
   fs.copyFileSync(path.join(backupDir,childRel),target);
   files.push(childRel);
  }
 };
 walk('');
 /* Arquivo que o update criou (não existia antes) sai junto — nada de orfão
    da versão nova sobrevivendo ao rollback. */
 for(const rel of created){
  if(files.includes(rel))continue;
  fs.rmSync(path.join(rootDir,...normalizeRel(rel).split('/')),{force:true});
 }
 return files;
}

/* ---------- comandos / reopen / worker ---------- */

/* B5: shell só onde é inevitável. npm/npx no Windows são .cmd (spawn direto
   deles não roda sem shell); git/node/executáveis vão DIRETOS — caminhos com
   espaço ou `&` deixam de depender do quoting do shell. */
function needsShell(cmd){
 if(process.platform!=='win32')return false;
 const base=path.win32.basename(String(cmd||''));
 return /^(npm|npx)(\.cmd|\.exe)?$/i.test(base)||/\.(cmd|bat)$/i.test(base);
}

function defaultRun(cmd,args=[],opts={}){
 return execFileAsync(cmd,args,{
  cwd:opts.cwd,
  timeout:opts.timeout||600000,
  maxBuffer:8*1024*1024,
  windowsHide:true,
  /* shell:true apenas para npm/npx no Windows (npm.cmd); nos testes o `run`
     é falso e o chamador decide. */
  shell:!!opts.shell||needsShell(cmd),
 }).then(r=>({stdout:String(r.stdout||''),stderr:String(r.stderr||'')}));
}

/* O app reabre sozinho: bundle = `open "<app>"`; fonte = `npm start` destacado.
   Falha de reabertura é registrada (não silêncio): o worker termina e ninguém
   reabre é estado que o usuário precisa saber explicar. */
function spawnReopen(reopen,env=process.env,log=()=>{}){
 if(!reopen||!reopen.cmd)return;
 try{
  const child=spawn(reopen.cmd,reopen.args||[],{cwd:reopen.cwd||undefined,detached:true,stdio:'ignore',shell:!!reopen.shell||needsShell(reopen.cmd),env});
  child.on('error',err=>log('update: reabertura falhou ('+String(err&&err.message||err)+') — rode npm start à mão'));
  child.unref();
 }catch(e){log('update: reabertura falhou ('+String(e&&e.message||e)+') — rode npm start à mão');}
}

/* Reabrir: em produção um `spawn` destacado (bundle = `open "<app>"`; fonte =
   `npm start`); nos testes, uma função que só registra o pedido. */
function doReopen(reopen,log=()=>{}){
 if(typeof reopen==='function'){try{reopen();}catch{}return;}
 if(reopen)spawnReopen(reopen,undefined,log);
}

/* ESRCH = o processo saiu; EPERM = existe (sem direito de sinal) — continua
   esperando em vez de declarar "saiu" de graça. */
function pidAlive(pid){
 try{process.kill(pid,0);return true;}
 catch(e){return !(e&&e.code==='ESRCH');}
}

function waitForPid(pid,timeoutMs=60000,{pollMs=500}={}){
 return new Promise(resolve=>{
  const started=Date.now();
  const tick=()=>{
   if(!pidAlive(pid))return resolve(true);
   if(Date.now()-started>timeoutMs)return resolve(false);
   setTimeout(tick,pollMs);
  };
  tick();
 });
}

function workerEnv(env=process.env,home=os.homedir()){
 /* O app aberto pelo Finder nasce com o PATH mínimo: node/npm do usuário têm
    de continuar acháveis pelo script destacado (mesma ideia do pi.cjs). */
 const userDirs=['.bun/bin','.local/bin','.cargo/bin','.deno/bin'].map(rel=>path.join(home,...rel.split('/')));
 userDirs.push('/opt/homebrew/bin','/usr/local/bin');
 const parts=[...userDirs.filter(dir=>{try{return fs.existsSync(dir);}catch{return false;}}),env.PATH||''].filter(Boolean);
 return {...env,PATH:parts.join(path.delimiter)};
}

/* Executável do Node do SISTEMA (o mesmo que o setup e o npm usam): 'node' a
   seco falha no app aberto pelo Finder (PATH mínimo). Procuramos nos mesmos
   diretórios que o workerEnv semeia; `opts.dirs` restringe a busca (injeção
   de teste). Sem achar, o update por clique aborta com mensagem (o terminal
   segue com `npm run update`). */
function resolveNode(env=process.env,home=os.homedir(),opts={}){
 const names=process.platform==='win32'?['node.exe','node.cmd']:['node'];
 const dirs=opts&&opts.dirs?opts.dirs:workerEnv(env,home).PATH.split(path.delimiter);
 for(const dir of dirs){
  if(!dir)continue;
  for(const name of names){
   try{
    const candidate=path.join(dir,name);
    const st=fs.statSync(candidate);
    if(st.isFile())return candidate;
   }catch{}
  }
 }
 return '';
}

/* ---------- handshake do worker (A4) ---------- */

/* O worker escreve um arquivo de status ANTES de qualquer mutação; quem chamou
   só agenda o fechamento do app depois de o arquivo existir. Spawn morto =
   arquivo que não chega = app continua de pé (e o clique falha com mensagem). */
function writeHandshake(file,data){
 try{
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
 }catch{}
}

function waitForHandshake(file,timeoutMs=15000,{pollMs=250}={}){
 return new Promise(resolve=>{
  const started=Date.now();
  const tick=()=>{
   try{
    const data=JSON.parse(fs.readFileSync(file,'utf8'));
    if(data&&data.phase==='started')return resolve(true);
   }catch{}
   if(Date.now()-started>=timeoutMs)return resolve(false);
   setTimeout(tick,pollMs);
  };
  tick();
 });
}

/* ---------- lock de atualização (A4): Sobre × Atualizar Pi × CLI ---------- */

const LOCK_STALE_MS=30*60*1000;
function lockFileOf(runtime){
 return runtime?path.join(runtime,'update.lock'):'';
}

function acquireLock(runtime,opts={}){
 const {now=Date.now(),staleMs=LOCK_STALE_MS}=opts||{};
 const file=lockFileOf(runtime);
 if(!file)return {ok:true,file:'',release(){}};
 let presa=false;
 try{
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  if(data&&typeof data.at==='number'&&now-data.at<staleMs){
   return {ok:false,file,reason:'já existe uma atualização em andamento (ou o lock ficou preso; apague '+file+')'};
  }
  presa=true; // sem dono no prazo: o lock é quebrado
 }catch{}
 try{
  if(presa)fs.rmSync(file,{force:true}); // stale: sai da frente para o wx criar o nosso
  fs.writeFileSync(file,JSON.stringify({pid:process.pid,at:now,cmd:String(process.argv[1]||'')})+'\n',{flag:'wx'});
 }catch(e){
  if(e&&e.code==='EEXIST')return {ok:false,file,reason:'já existe uma atualização em andamento'};
  return {ok:false,file,reason:'não foi possível criar o lock ('+String(e&&e.message||e)+')'};
 }
 return {ok:true,file,release(){releaseLock(file);}};
}

function releaseLock(file){
 if(!file)return;
 try{fs.rmSync(file,{force:true});}catch{}
}

/* O worker é uma CÓPIA deste arquivo no tmpdir: o update pode substituir o
   original em pleno voo sem quebrar quem já está rodando. O executável é o
   node do sistema RESOLVIDO (não o literal 'node'), o spawn tem listener de
   `error` e o chamador recebe o caminho do handshake. */
function spawnWorker(args,opts={}){
 const env=opts.env||process.env,home=opts.home||os.homedir(),spawnFn=opts.spawn||spawn;
 const node=resolveNode(env,home,{dirs:opts.dirs});
 if(!node){
  return {ok:false,error:'Node do sistema não foi encontrado — o script pós-fechamento precisa dele. Confira a instalação do Node (22.19+) ou rode npm run update no terminal.'};
 }
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-update-'));
 const script=path.join(dir,'update-worker.cjs');
 fs.copyFileSync(__filename,script);
 /* O worker viaja sozinho: o contrato do Pi local (`require('./pi.cjs')` no
    ensure) tem de estar do lado da cópia. */
 try{fs.copyFileSync(path.join(__dirname,'pi.cjs'),path.join(dir,'pi.cjs'));}catch{}
 const payload=path.join(dir,'args.json');
 const status=path.join(dir,'status.json');
 fs.writeFileSync(payload,JSON.stringify({...args,_status:status}));
 let child;
 try{
  child=spawnFn(node,[script,'--apply',payload],{detached:true,stdio:'ignore',env:workerEnv(env,home)});
 }catch(e){
  try{fs.rmSync(dir,{recursive:true,force:true});}catch{}
  return {ok:false,error:'não foi possível iniciar o script de atualização ('+String(e&&e.message||e)+')'};
 }
 /* Sem listener o spawn que falha (ENOENT etc.) derrubaria o processo pai. */
 child.on('error',err=>{
  appendLog(args.runtime?path.join(args.runtime,'desk.log'):'','update: spawn do worker falhou ('+String(err&&err.message||err)+')');
 });
 child.unref();
 return {ok:true,script,payload,status,node,child};
}

/* ---------- aplicação ---------- */

function readFileSafe(file){
 try{return fs.readFileSync(file);}catch{return null;}
}

function lockChangedSince(before,lockFile){
 const after=readFileSafe(lockFile);
 if(!before&&!after)return false;
 if(!before||!after)return true;
 return !before.equals(after);
}

function installedVersion(dir){
 try{return String(JSON.parse(fs.readFileSync(path.join(dir,'package.json'),'utf8')).version||'');}catch{return '';}
}

async function npmCi({deskDir,run}){
 await run('npm',['ci'],{cwd:deskDir,timeout:20*60*1000});
}

/* Resultado real da aplicação, persistido no cache do runtime: é o que o
   Sobre mostra na reabertura (atualizada / recuperada / incompleta). */
function persistResult(cacheFile,result){
 if(!cacheFile)return Promise.resolve();
 return cacheWrite(cacheFile,cache=>({...cache,lastResult:{...result,at:Date.now()}}));
}

/* Pós-aplicação no macOS: a lógica do install-app (sync + codesign + registra
   no LaunchServices) re-rodando quando há bundle. Falha do install-app em modo
   git/zip não derruba o update (a fonte está íntegra; o bundle fica
   desatualizado e o motivo vai para o log) — em modo bundle é o próprio apply
   e aí sim vira rollback. */
async function syncBundle({mode,sourceDir,run,log}){
 if(process.platform!=='darwin')return;
 const installScript=path.join(sourceDir,'desk','scripts','install-app.mjs');
 const bundle=path.join(sourceDir,'Mesa de Estudos.app');
 if(mode==='bundle'){
  await run('node',[installScript],{cwd:path.join(sourceDir,'desk')});
  return;
 }
 if(!fs.existsSync(bundle))return;
 try{await run('node',[installScript],{cwd:path.join(sourceDir,'desk')});}
 catch(e){log('update: install-app falhou ('+String(e&&e.message||e)+') — fonte atualizada, bundle desatualizado; rode npm run install-app');}
}

/* Modo git: o pull só é seguro num clone sem trabalho local — `git reset
   --hard` do rollback destruiria essas mudanças. Política EXPLÍCITA: o update
   recusa clones sujos (modificação em arquivo rastreado) antes de qualquer
   mutação; arquivos não rastreados (`??`) sobrevivem ao reset e não bloqueiam. */
async function assertCleanClone(sourceDir,run){
 let status='';
 try{status=(await run('git',['status','--porcelain'],{cwd:sourceDir})).stdout;}catch(e){
  throw Error('git status não respondeu ('+String(e&&e.message||e)+') — clone recusado');
 }
 const sujos=status.split('\n').filter(l=>l.trim()&&!l.startsWith('??'));
 if(sujos.length){
  throw Error('o clone tem trabalho local (git status não limpo: '+sujos.length+' arquivo(s)) — atualização abortada para não destruir mudanças; commit/stash e rode de novo');
 }
}

/* O coração do updater: uma TRANSAÇÃO verificável.
   `ok:false` = abortado antes de qualquer mutação ou rollback aplicado, e a
   versão antiga sobe de novo sozinha (o `reopen` roda nos caminhos que tocam
   o disco). A versão devolvida em `version` é a CONFERIDA no package.json —
   nunca a anunciada sem conferência. */
async function applyUpdate(opts={}){
 const {
  mode='zip',rootDir='',deskDir='',runtime='',announcedVersion='',sourceInfo=null,
  waitPid=0,reopen=null,run=defaultRun,fetchBuffer=defaultFetchBuffer,
  cacheFile='',lockFile='',pidTimeout=120000,
  snapshot=snapshotTree,restore=restoreTree, /* injeção de teste (mesma ideia do run) */
 }=opts;
 const logFile=runtime?path.join(runtime,'desk.log'):'';
 const log=line=>appendLog(logFile,line);
 const finish=(result)=>{
  releaseLock(lockFile);
  doReopen(reopen,log);
  return result;
 };
 const sourceDir=mode==='zip'?rootDir:(mode==='bundle'?String(sourceInfo&&sourceInfo.path||''):rootDir);
 /* Snapshot cobre só o que a atualização gerencia: o payload do bundle (que o
    install-app reescreve por inteiro, node_modules incluso) ou, em git/zip, a
    lista explícita + o manifesto anterior — nunca a raiz toda. */
 const snapshotRoot=mode==='bundle'?deskDir:sourceDir;
 const npmCiDir=mode==='bundle'?path.join(sourceDir,'desk'):deskDir;
 if(!rootDir||!deskDir||!sourceDir)throw Error('applyUpdate: caminhos incompletos');
 log(`update: começando (${mode} → v${announcedVersion||'?'} em ${rootDir})`);
 /* A4: o app tem de ter SAÍDO no prazo — sem "aplica mesmo assim" (duas
    instâncias escrevendo os mesmos arquivos). Aborta SEM tocar nada. */
 if(waitPid){
  const gone=await waitForPid(waitPid,pidTimeout);
  if(!gone){
   const reason='o app não encerrou no prazo — atualização abortada sem tocar nada';
   log('update: FALHOU ('+reason+')');
   releaseLock(lockFile);
   /* A4: o app NUNCA saiu — reabrir abriria uma segunda instância à toa. */
   return {ok:false,mode,version:announcedVersion,reason};
  }
 }
 const lockBefore=readFileSafe(path.join(npmCiDir,'package-lock.json'));
 let backup=null,created=[],written=[],head='',depsTouched=false,diverged=false,confirmedVersion=announcedVersion,cloneClean=false;
 try{
  const manifestRoot=mode==='bundle'?deskDir:rootDir;
  const previous=readManifest(manifestRoot);
  backup=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-update-backup-'));
  const snapshotInclude=mode==='bundle'
   ?null // o payload inteiro é gerenciado pelo install-app
   :rel=>isReplaceable(rel)||normalizeRel(rel)==='.update-manifest.json';
  snapshot(snapshotRoot,backup,snapshotInclude);
  if(mode==='bundle'){
   /* O Info.plist mora fora do payload; entra no backup com nome reservado. */
   const plist=path.join(path.resolve(deskDir,'..','..','..'),'Contents','Info.plist');
   if(fs.existsSync(plist))fs.copyFileSync(plist,path.join(backup,'__Info.plist__'));
  }
  if(mode==='zip'){
   const buffer=await fetchBuffer(`https://codeload.github.com/FariaDev/mesa-de-estudos/zip/refs/tags/v${announcedVersion}`);
   /* `created`/`written` são do chamador: se a cópia morrer no meio, o
      rollback ainda sabe o que apagar e o que era gerenciado. */
   const result=applyZip(buffer,{rootDir,announcedVersion,log,created,written});
   log(`update: zip aplicado (${result.replaced} arquivo(s) de código, ${result.skipped} pulado(s))`);
   writeManifest(manifestRoot,announcedVersion,written);
   removeOrphans(rootDir,previous,written,log);
  }else{
   head=(await run('git',['rev-parse','HEAD'],{cwd:sourceDir})).stdout.trim();
   await assertCleanClone(sourceDir,run);
   /* Passou do portão: o clone estava limpo — o reset do rollback sabe disso. */
   cloneClean=true;
   await run('git',['pull','--ff-only'],{cwd:sourceDir});
   log('update: git pull --ff-only ok (branch de desenvolvimento do clone)');
   if(mode==='bundle')log(`update: re-sincronizando o bundle a partir de ${sourceDir}`);
  }
  /* A1: "dependências mexidas" é estado INDEPENDENTE — vale desde que o lock
     mudou (antes do npm ci começar) e NÃO volta a false quando o ci termina;
     qualquer falha depois disso refaz o npm ci no rollback. */
  if(lockChangedSince(lockBefore,path.join(npmCiDir,'package-lock.json'))){
   log('update: package-lock.json mudou — rodando npm ci');
   depsTouched=true;
   await npmCi({deskDir:npmCiDir,run});
  }
  /* A3: "vX no lugar" só depois de conferir a versão INSTALADA no
     package.json. No modo git o pull segue a branch de desenvolvimento —
     divergir da tag anunciada é aviso explícito, não sucesso silencioso. */
  const finalVersion=installedVersion(npmCiDir);
  if(announcedVersion&&finalVersion&&finalVersion!==String(announcedVersion)){
   diverged=true;
   confirmedVersion=finalVersion;
   log(`update: aviso — a versão instalada é v${finalVersion}, não a v${announcedVersion} anunciada (o modo git segue a branch de desenvolvimento)`);
  }else if(finalVersion){
   confirmedVersion=finalVersion;
  }
  await syncBundle({mode,sourceDir,run,log});
  fs.rmSync(backup,{recursive:true,force:true});
  backup=null;
  if(diverged){
   log(`update: concluído — v${confirmedVersion||'?'} no lugar (divergente da v${announcedVersion} anunciada)`);
  }else{
   log(`update: concluído — v${confirmedVersion||'?'} no lugar (conferida no package.json)`);
  }
  persistResult(cacheFile,{status:'applied',mode,version:confirmedVersion||''});
  return finish({ok:true,mode,version:confirmedVersion||'',announced:announcedVersion,diverged});
 }catch(e){
  const reason=String(e&&e.message||e)||'falha desconhecida';
  if(!backup){
   /* Falha depois do commit (backup já dispensado) — raro, mas não há como
      piorar: o update está no lugar; reporta como sucesso perdido? Não:
      reporta a falha sem rollback possível. */
   log(`update: FALHOU (${reason}) — após o commit do backup; versão aplicada permanece`);
   persistResult(cacheFile,{status:'applied',mode,version:confirmedVersion||announcedVersion});
   return finish({ok:false,mode,version:confirmedVersion||announcedVersion,reason});
  }
  log(`update: FALHOU (${reason}) — rollback para a versão anterior`);
  try{
   /* A5: o reset só é seguro quando o clone estava LIMPO no portão (o reset
      descartaria trabalho do usuário); recusado no portão, nada é mexido. */
   if(head&&cloneClean){try{await run('git',['reset','--hard',head],{cwd:sourceDir});}catch(err){log('update: git reset falhou ('+String(err&&err.message||err)+')');}}
   restore(snapshotRoot,backup,created);
   /* Info.plist do bundle de volta (o install-app mexe nele fora do payload). */
   const plistBackup=path.join(backup,'__Info.plist__');
   if(fs.existsSync(plistBackup)){
    fs.copyFileSync(plistBackup,path.join(path.resolve(deskDir,'..','..','..'),'Contents','Info.plist'));
   }
   log('update: rollback aplicado; a versão anterior sobe de novo');
   /* O único estado que o rollback de código não cobre sozinho: lock trocado
      com dependências mexidas (npm ci morto no meio, node_modules da versão
      nova). Refaz o ci com o lock antigo e registra o motivo no desk.log. */
   if(depsTouched){
    try{await npmCi({deskDir:npmCiDir,run});log('update: npm ci de recuperação ok (lock antigo de volta)');}
    catch(err2){log('update: npm ci de recuperação TAMBÉM falhou ('+String(err2&&err2.message||err2)+') — rode npm ci à mão; node_modules pode estar inconsistente');}
   }
   /* A1: as dependências do payload do bundle NÃO vivem no instantâneo (o
      install-app apaga e reescreve o node_modules) — a recuperação é
      RE-RODAR o sync: o install-app copia os runtimeDeps do clone já
      restaurado (lock antigo, ci de recuperação acima), reescreve o payload
      e re-assina. Sem sync, o fallback re-assina a cópia devolvida e avisa
      que as dependências podem estar inconsistentes. */
   if(mode==='bundle'&&process.platform==='darwin'){
    try{
     await syncBundle({mode,sourceDir,run,log});
     log('update: payload do bundle re-sincronizado após o rollback (dependências refeitas do clone restaurado)');
    }catch(err2){
     log('update: sync de recuperação falhou ('+String(err2&&err2.message||err2)+') — dependências do payload podem estar inconsistentes');
     const bundle=path.resolve(deskDir,'..','..','..');
     try{await run('codesign',['--force','--deep','--sign','-',bundle],{timeout:120000});log('update: bundle re-assinado (ad-hoc) após o rollback');}
     catch(err3){log('update: re-assinatura do bundle falhou ('+String(err3&&err3.message||err3)+')');}
    }
   }else if(process.platform==='darwin'){
    /* git/zip com bundle instalado do lado: melhor esforço — devolve o
       bundle à versão restaurada; falha não piora o rollback (só log). */
    await syncBundle({mode,sourceDir,run,log});
   }
   persistResult(cacheFile,{status:'recovered',mode,version:confirmedVersion||announcedVersion,reason});
   return finish({ok:false,mode,version:confirmedVersion||announcedVersion,reason});
  }catch(err){
   /* A5: rollback incompleto NUNCA apaga o backup — é a última cópia da
      instalação anterior; o caminho vai no log. */
   const detail=String(err&&err.message||err);
   log(`update: rollback incompleto (${detail}) — backup PRESERVADO em ${backup}`);
   persistResult(cacheFile,{status:'incomplete',mode,version:announcedVersion,reason:`${reason}; rollback incompleto: ${detail}`});
   return finish({ok:false,mode,version:announcedVersion,reason:`${reason} (rollback incompleto: ${detail}; backup em ${backup})`,incomplete:true,backup});
  }
 }
}

/* Atualizar Pi (só o LOCAL): o Pi mora em desk/.pi-local com package.json
   próprio, FORA da árvore npm da Mesa — o npm daqui não toca o
   package.json/lock versionados e o git pull nunca encontra trabalho local
   inventado pelo setup. Roda no pós-fechamento porque o npm mexe no
   node_modules em uso. Sem rollback — o npm é que cuida da transação; o
   motivo de qualquer falha vai para o desk.log. */
async function applyPiOnly(opts={}){
 const {deskDir='',runtime='',waitPid=0,reopen=null,run=defaultRun,pidTimeout=120000,lockFile=''}=opts;
 const logFile=runtime?path.join(runtime,'desk.log'):'';
 const log=line=>appendLog(logFile,line);
 const finish=(result)=>{
  releaseLock(lockFile);
  doReopen(reopen,log);
  return result;
 };
 if(!deskDir)throw Error('applyPiOnly: deskDir ausente');
 log('update: atualizando o Pi local (@earendil-works/pi-coding-agent@latest em desk/.pi-local)');
 if(waitPid){
  const gone=await waitForPid(waitPid,pidTimeout);
  if(!gone){
   const reason='o app não encerrou no prazo — atualização do Pi abortada';
   log('update: FALHOU ('+reason+')');
   return finish({ok:false,reason});
  }
 }
 try{
  /* A2: o Pi local mora em `desk/.pi-local` (package.json próprio, fora da
     árvore npm da Mesa) — ver pi.cjs. Cria a pasta se a instalação é antiga. */
  const piHome=ensurePiLocalHome(deskDir);
  await run('npm',['install','@earendil-works/pi-coding-agent@latest'],{cwd:piHome,timeout:20*60*1000});
  log('update: Pi atualizado (desk/.pi-local)');
  return finish({ok:true});
 }catch(e){
  const reason=String(e&&e.message||e)||'falha desconhecida';
  log(`update: FALHOU ao atualizar o Pi (${reason}) — mantendo o que já está instalado`);
  return finish({ok:false,reason});
 }
}

/* ---------- entrada do worker (cópia deste arquivo no tmpdir) ---------- */

if(require.main===module&&process.argv[2]==='--apply'){
 let args={};
 try{args=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));}catch{}
 /* Handshake (A4): o arquivo de status sai ANTES de qualquer mutação — quem
    chamou só fecha o app depois de ver este arquivo. */
 if(args._status)writeHandshake(args._status,{pid:process.pid,phase:'started',at:Date.now()});
 (async()=>{
  const result=args.piOnly?await applyPiOnly(args):await applyUpdate(args);
  process.exit(result&&result.ok?0:1);
 })().catch(e=>{
  appendLog(args.runtime?path.join(args.runtime,'desk.log'):'',`update: worker caiu (${String(e&&e.message||e)})`);
  releaseLock(args.lockFile||'');
  process.exit(1);
 });
}

module.exports={
 RELEASES_URL,TAGS_URL,PI_REGISTRY_URL,XOURNAL_RELEASES_URL,XOURNAL_SITE_URL,CHECK_TTL,
 semverParse,semverCompare,isNewer,readCache,writeCache,cacheWrite,fresh,markToasted,
 defaultFetchJson,defaultFetchBuffer,timedFetch,sharedFetchJson,releaseFromGithub,releaseFromTags,
 checkForUpdates,piLatest,xournalLatest,
 normalizeRel,isProtected,isReplaceable,readZip,assertSafeEntries,stripCommonRoot,applyZip,
 assertRealTarget,manifestFile,readManifest,writeManifest,removeOrphans,
 snapshotTree,restoreTree,readFileSafe,lockChangedSince,installedVersion,defaultRun,needsShell,
 spawnReopen,doReopen,spawnWorker,waitForPid,pidAlive,resolveNode,workerEnv,
 writeHandshake,waitForHandshake,acquireLock,releaseLock,lockFileOf,LOCK_STALE_MS,
 applyUpdate,applyPiOnly,appendLog,persistResult,
};
