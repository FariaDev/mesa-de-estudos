/* Updater por clique da Mesa: checagem (GitHub releases da tag pública) e
   aplicação (git / bundle / zip) com rollback.

   - Checagem: `releases/latest` com fallback em `tags`; semver contra
     `app.getVersion()`; cache de 24 h no runtime (`update.json`); offline/erro
     = silêncio (status "error", sem drama).
   - Aplicação: o app grava uma CÓPIA DESTE ARQUIVO no tmpdir e a dispara
     destacada (`spawn` detached); o script espera o PID sair, aplica e reabre.
     Por isso este módulo só usa builtins do Node — ele viaja sozinho.
   - Origem: clone (`desk/../.git`) → `git pull --ff-only`; bundle com
     `install-source.json` → atualiza o clone e re-sincroniza (install-app);
     sem git → baixa o zip da tag (codeload) e substitui SÓ a lista explícita
     de arquivos de código, nunca os caminhos protegidos.
   - Invariantes: NUNCA tocar `config.json`, Application Support/%APPDATA%,
     `desk/.runtime/` (só append em `desk.json`/`desk.log` do runtime é do
     app), sessões (`*.jsonl`), PDFs, `.xopp`, `node_modules`, `install-source.json`
     ou templates do usuário (as cópias do vault/matéria estão fora daqui).
     Somente GETs públicos; zero telemetria.
   - Rollback é REQUISITO: falhou no meio → instantâneo do código volta ao
     lugar, o motivo vai para `.runtime/desk.log` e a versão antiga reabre. O
     único estado que pode ficar inconsistente é `node_modules` quando o lock
     mudou e o `npm ci` falhou no meio — aí o rollback refaz o `npm ci` com o
     lock antigo e registra o motivo. */
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const zlib=require('node:zlib');
const {spawn,execFile}=require('node:child_process');
const {promisify}=require('node:util');
const execFileAsync=promisify(execFile);

const RELEASES_URL='https://api.github.com/repos/FariaDev/mesa-de-estudos/releases/latest';
const TAGS_URL='https://api.github.com/repos/FariaDev/mesa-de-estudos/tags';
const PI_REGISTRY_URL='https://registry.npmjs.org/@earendil-works/pi-coding-agent/latest';
const XOURNAL_RELEASES_URL='https://api.github.com/repos/xournalpp/xournalpp/releases/latest';
const XOURNAL_SITE_URL='https://github.com/xournalpp/xournalpp/releases/latest';
const CHECK_TTL=24*60*60*1000;
const CODE_DIRS=new Set(['src','assets','templates','scripts']);
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

function semverParse(value){
 const m=/^v?(\d+)\.(\d+)\.(\d+)/.exec(String(value||'').trim());
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

function writeCache(file,data){
 try{
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
 }catch{}
}

function fresh(entry,now){
 return !!entry&&typeof entry.at==='number'&&now-entry.at>=0&&now-entry.at<CHECK_TTL;
}

/* Um toast por versão: marcar aqui evita o "vX disponível" a cada abertura. */
function markToasted(file,version){
 const cache=readCache(file);
 if(cache.toasted===version)return false;
 cache.toasted=version;
 writeCache(file,cache);
 return true;
}

/* ---------- rede: só GETs públicos, injetáveis nos testes ---------- */

async function defaultFetchJson(url){
 const res=await fetch(url,{headers:{'user-agent':'mesa-de-estudos',accept:'application/json'}});
 if(!res.ok)throw Error('HTTP '+res.status);
 return res.json();
}

async function defaultFetchBuffer(url){
 const res=await fetch(url,{headers:{'user-agent':'mesa-de-estudos'}});
 if(!res.ok)throw Error('HTTP '+res.status);
 return Buffer.from(await res.arrayBuffer());
}

function releaseFromGithub(json){
 if(!json||typeof json!=='object')return null;
 const version=String(json.tag_name||'').replace(/^v/,'').trim();
 if(!semverParse(version))return null;
 return {version,notes:String(json.body||'').slice(0,2000),url:String(json.html_url||'')};
}

/* Fallback `tags`: pega a maior semver listada (a lista não vem garantida em ordem). */
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
  try{release=releaseFromGithub(await fetchJson(RELEASES_URL));}
  catch{}
  if(!release)release=releaseFromTags(await fetchJson(TAGS_URL));
 }catch(e){
  return {status:'error',error:String(e&&e.message||e)||'sem rede',version:'',notes:'',url:'',current,cached:false};
 }
 if(!release)return {status:'error',error:'sem release publicada',version:'',notes:'',url:'',current,cached:false};
 if(cacheFile)writeCache(cacheFile,{...cache,release:{at:now,version:release.version,notes:release.notes,url:release.url}});
 return {status:isNewer(release.version,current)?'update':'current',version:release.version,notes:release.notes,url:release.url,current,cached:false};
}

/* Versão mais nova do Pi. SÓ o registry `@earendil-works` — o antigo
   `@mariozechner/pi-coding-agent` está deprecado e parado em 0.73.1; usá-lo
   como fallback mentiria a versão. Sem resposta = desconhecido, sem erro. */
async function piLatest({cacheFile='',fetchJson=defaultFetchJson,now=Date.now(),manual=false}={}){
 const cache=cacheFile?readCache(cacheFile):{};
 if(!manual&&fresh(cache.pi,now))return {version:String(cache.pi.version||''),known:!!cache.pi.version};
 try{
  const json=await fetchJson(PI_REGISTRY_URL);
  const version=String(json&&json.version||'').trim();
  if(!semverParse(version))throw Error('resposta sem versão');
  if(cacheFile)writeCache(cacheFile,{...cache,pi:{at:now,version}});
  return {version,known:true};
 }catch{return {version:'',known:false};}
}

/* Xournal++ é só informativo (o app não o atualiza): o painel pede sob demanda. */
async function xournalLatest({cacheFile='',fetchJson=defaultFetchJson,now=Date.now(),manual=false}={}){
 const cache=cacheFile?readCache(cacheFile):{};
 if(!manual&&fresh(cache.xournal,now))return {version:String(cache.xournal.version||''),known:!!cache.xournal.version};
 try{
  const json=await fetchJson(XOURNAL_RELEASES_URL);
  const version=String(json&&json.tag_name||'').replace(/^v/,'').trim();
  if(!semverParse(version))throw Error('resposta sem versão');
  if(cacheFile)writeCache(cacheFile,{...cache,xournal:{at:now,version}});
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
 if(/(^|\/)(config\.json|desk\.json|install-source\.json)$/i.test(norm))return true;
 if(/(^|\/)\.runtime(\/|$)/.test(norm))return true;
 if(/(^|\/)node_modules(\/|$)/.test(norm))return true;
 if(/\.(jsonl|xopp|pdf|log)$/i.test(norm))return true;
 if(/\.app(\/|$)/.test(norm))return true;
 return false;
}

/* Lista explícita do que o modo zip pode substituir: módulos de código e
   documentos de UI do desk, o miolo de src/assets/templates/scripts e as
   árvores de código do repo (core/geogebra/visual-check/.githooks + raiz).
   Nada fora desta lista é tocado — e a lista nunca inclui o protegido. */
function isReplaceable(rel){
 const norm=normalizeRel(rel);
 if(!norm||isProtected(norm))return false;
 const parts=norm.split('/');
 const [first,second]=parts;
 if(first==='desk'&&parts.length===2){
  return /\.(cjs|mjs|html|css|md)$/i.test(second)||/^(package(-lock)?|config\.example)\.json$/.test(second);
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

/* Aplica o zip num staging conferido: versão do `package.json` extraído bate
   com a anunciada, SÓ lista explícita é copiada, protegido nunca. Devolve os
   arquivos criados (para o rollback apagar) e os pulados. */
function applyZip(buffer,{rootDir,announcedVersion='',log=()=>{},created=[]}={}){
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
  const existed=fs.existsSync(target);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,entry.data);
  if(!existed)created.push(entry.name);
  replaced++;
 }
 return {created,replaced,skipped,version};
}

/* ---------- instantâneo / rollback ---------- */

/* O que o rollback precisa para devolver a versão antiga inteira: o código
   atual antes de qualquer mutação. Pula árvores pesadas/de usuário. */
function snapshotTree(rootDir,backupDir){
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

function defaultRun(cmd,args=[],opts={}){
 return execFileAsync(cmd,args,{
  cwd:opts.cwd,
  timeout:opts.timeout||600000,
  maxBuffer:8*1024*1024,
  windowsHide:true,
  /* npm/git precisam de shell no Windows (npm.cmd); nos testes o `run` é falso. */
  shell:!!opts.shell||process.platform==='win32',
 }).then(r=>({stdout:String(r.stdout||''),stderr:String(r.stderr||'')}));
}

/* O app reabre sozinho: bundle = `open "<app>"`; fonte = `npm start` destacado. */
function spawnReopen(reopen,env=process.env){
 if(!reopen||!reopen.cmd)return;
 try{
  const child=spawn(reopen.cmd,reopen.args||[],{cwd:reopen.cwd||undefined,detached:true,stdio:'ignore',shell:!!reopen.shell||process.platform==='win32',env});
  child.unref();
 }catch{}
}

/* Reabrir: em produção um `spawn` destacado (bundle = `open "<app>"`; fonte =
   `npm start`); nos testes, uma função que só registra o pedido. */
function doReopen(reopen){
 if(typeof reopen==='function'){try{reopen();}catch{}return;}
 if(reopen)spawnReopen(reopen);
}

function waitForPid(pid,timeoutMs=60000){
 return new Promise(resolve=>{
  const started=Date.now();
  const tick=()=>{
   try{process.kill(pid,0);}
   catch(e){if(e&&e.code==='ESRCH')return resolve(true);return resolve(true);}
   if(Date.now()-started>timeoutMs)return resolve(false);
   setTimeout(tick,500);
  };
  tick();
 });
}

function workerEnv(env=process.env){
 /* O app aberto pelo Finder nasce com o PATH mínimo: node/npm do usuário têm
    de continuar acháveis pelo script destacado (mesma ideia do pi.cjs). */
 const userDirs=['.bun/bin','.local/bin','.cargo/bin','.deno/bin'].map(rel=>path.join(os.homedir(),...rel.split('/')));
 userDirs.push('/opt/homebrew/bin','/usr/local/bin');
 const parts=[...userDirs.filter(dir=>{try{return fs.existsSync(dir);}catch{return false;}}),env.PATH||''].filter(Boolean);
 return {...env,PATH:parts.join(path.delimiter)};
}

/* O worker é uma CÓPIA deste arquivo no tmpdir: o update pode substituir o
   original em pleno voo sem quebrar quem já está rodando. */
function spawnWorker(args,env=process.env){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-update-'));
 const script=path.join(dir,'update-worker.cjs');
 fs.copyFileSync(__filename,script);
 const payload=path.join(dir,'args.json');
 fs.writeFileSync(payload,JSON.stringify(args));
 const child=spawn('node',[script,'--apply',payload],{detached:true,stdio:'ignore',env:workerEnv(env)});
 child.unref();
 return {script,payload};
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

async function npmCi({deskDir,run}){
 await run('npm',['ci'],{cwd:deskDir,timeout:20*60*1000});
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

/* O coração do updater. `ok:false` = rollback aplicado e a versão antiga sobe
   de novo sozinha (o `reopen` roda nos dois caminhos). */
async function applyUpdate(opts={}){
 const {
  mode='zip',rootDir='',deskDir='',runtime='',announcedVersion='',sourceInfo=null,
  waitPid=0,reopen=null,run=defaultRun,fetchBuffer=defaultFetchBuffer,
 }=opts;
 const logFile=runtime?path.join(runtime,'desk.log'):'';
 const log=line=>appendLog(logFile,line);
 const sourceDir=mode==='zip'?rootDir:(mode==='bundle'?String(sourceInfo&&sourceInfo.path||''):rootDir);
 const snapshotRoot=mode==='bundle'?deskDir:sourceDir;
 const npmCiDir=mode==='bundle'?path.join(sourceDir,'desk'):deskDir;
 if(!rootDir||!deskDir||!sourceDir)throw Error('applyUpdate: caminhos incompletos');
 log(`update: começando (${mode} → v${announcedVersion||'?'} em ${rootDir})`);
 if(waitPid){const gone=await waitForPid(waitPid,120000);if(!gone)log('update: o app não saiu no prazo; aplicando mesmo assim');}
 const lockBefore=readFileSafe(path.join(npmCiDir,'package-lock.json'));
 const backup=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-update-backup-'));
 let created=[],head='',npmStarted=false;
 try{
  snapshotTree(snapshotRoot,backup);
  if(mode==='zip'){
   const buffer=await fetchBuffer(`https://codeload.github.com/FariaDev/mesa-de-estudos/zip/refs/tags/v${announcedVersion}`);
   /* `created` é do chamador: se a cópia morrer no meio, o rollback ainda sabe
      o que foi criado para apagar. */
   const result=applyZip(buffer,{rootDir,announcedVersion,log,created});
   log(`update: zip aplicado (${result.replaced} arquivo(s) de código, ${result.skipped} pulado(s))`);
  }else{
   head=(await run('git',['rev-parse','HEAD'],{cwd:sourceDir})).stdout.trim();
   await run('git',['pull','--ff-only'],{cwd:sourceDir});
   log('update: git pull --ff-only ok');
   if(mode==='bundle')log(`update: re-sincronizando o bundle a partir de ${sourceDir}`);
  }
  npmStarted=false;
  if(lockChangedSince(lockBefore,path.join(npmCiDir,'package-lock.json'))){
   log('update: package-lock.json mudou — rodando npm ci');
   npmStarted=true;
   await npmCi({deskDir:npmCiDir,run});
   npmStarted=false;
  }
  await syncBundle({mode,sourceDir,run,log});
  fs.rmSync(backup,{recursive:true,force:true});
  log(`update: concluído — v${announcedVersion||'?'} no lugar`);
  doReopen(reopen);
  return {ok:true,mode,version:announcedVersion};
 }catch(e){
  const reason=String(e&&e.message||e)||'falha desconhecida';
  log(`update: FALHOU (${reason}) — rollback para a versão anterior`);
  try{
   if(head){try{await run('git',['reset','--hard',head],{cwd:sourceDir});}catch(err){log('update: git reset falhou ('+String(err&&err.message||err)+')');}}
   restoreTree(snapshotRoot,backup,created);
   log('update: rollback aplicado; a versão anterior sobe de novo');
   /* O único estado que o rollback não cobre sozinho: lock trocado com o
      `npm ci` morto no meio (node_modules inconsistente). Refaz o ci com o
      lock antigo e registra o motivo no desk.log. */
   if(npmStarted){
    try{await npmCi({deskDir:npmCiDir,run});log('update: npm ci de recuperação ok (lock antigo de volta)');}
    catch(err2){log('update: npm ci de recuperação TAMBÉM falhou ('+String(err2&&err2.message||err2)+') — rode npm ci à mão; node_modules pode estar inconsistente');}
   }
  }catch(err){
   log('update: rollback incompleto ('+String(err&&err.message||err)+')');
  }
  try{fs.rmSync(backup,{recursive:true,force:true});}catch{}
  doReopen(reopen);
  return {ok:false,mode,version:announcedVersion,reason};
 }
}

/* Atualizar Pi (só o local, em desk/node_modules): roda no pós-fechamento
   porque o npm mexe no node_modules em uso. Sem rollback — o npm é que cuida
   da transação; o motivo de qualquer falha vai para o desk.log. */
async function applyPiOnly(opts={}){
 const {deskDir='',runtime='',waitPid=0,reopen=null,run=defaultRun}=opts;
 const logFile=runtime?path.join(runtime,'desk.log'):'';
 const log=line=>appendLog(logFile,line);
 if(!deskDir)throw Error('applyPiOnly: deskDir ausente');
 log('update: atualizando o Pi local (@earendil-works/pi-coding-agent@latest)');
 if(waitPid)await waitForPid(waitPid,120000);
 try{
  await run('npm',['install','@earendil-works/pi-coding-agent@latest'],{cwd:deskDir,timeout:20*60*1000});
  log('update: Pi atualizado');
  doReopen(reopen);
  return {ok:true};
 }catch(e){
  const reason=String(e&&e.message||e)||'falha desconhecida';
  log(`update: FALHOU ao atualizar o Pi (${reason}) — mantendo o que já está instalado`);
  doReopen(reopen);
  return {ok:false,reason};
 }
}

/* ---------- entrada do worker (cópia deste arquivo no tmpdir) ---------- */

if(require.main===module&&process.argv[2]==='--apply'){
 let args={};
 try{args=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));}catch{}
 (async()=>{
  const result=args.piOnly?await applyPiOnly(args):await applyUpdate(args);
  process.exit(result&&result.ok?0:1);
 })().catch(e=>{
  appendLog(args.runtime?path.join(args.runtime,'desk.log'):'',`update: worker caiu (${String(e&&e.message||e)})`);
  process.exit(1);
 });
}

module.exports={
 RELEASES_URL,TAGS_URL,PI_REGISTRY_URL,XOURNAL_RELEASES_URL,XOURNAL_SITE_URL,CHECK_TTL,
 semverParse,semverCompare,isNewer,readCache,writeCache,fresh,markToasted,
 defaultFetchJson,defaultFetchBuffer,releaseFromGithub,releaseFromTags,
 checkForUpdates,piLatest,xournalLatest,
 normalizeRel,isProtected,isReplaceable,readZip,assertSafeEntries,stripCommonRoot,applyZip,
 snapshotTree,restoreTree,readFileSafe,lockChangedSince,defaultRun,spawnReopen,doReopen,spawnWorker,waitForPid,workerEnv,
 applyUpdate,applyPiOnly,appendLog,
};
