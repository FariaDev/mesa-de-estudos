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
/* O contrato do Pi local (`desk/.pi-local`) mora no pi.cjs: o setup e o
   updater usam o MESMO ensure (uma fonte para o diretório+package.json). */
const {ensurePiLocalHome}=require('./pi.cjs');
const {causeText,describeReceived,invalidValue}=require('./src/error-detail.mjs');
const {CHECK_TTL,CLAUDE_REGISTRY_URL,PI_REGISTRY_URL,RELEASES_URL,TAGS_URL,XOURNAL_RELEASES_URL,XOURNAL_SITE_URL,appendLog,cacheWrite,fresh,isNewer,markToasted,readCache,semverCompare,semverParse,writeCache}=require('./updater-core.cjs');
const {LOCK_STALE_MS,acquireLock,defaultRun,doReopen,lockFileOf,needsShell,pidAlive,releaseLock,resolveNode,spawnReopen,spawnWorker,stageWorkerFiles,WORKER_FILES,waitForHandshake,waitForPid,workerEnv,writeHandshake}=require('./updater-worker.cjs');
const {applyZip,assertRealTarget,assertSafeEntries,isProtected,isReplaceable,manifestFile,normalizeRel,readManifest,readZip,removeOrphans,restoreTree,snapshotTree,stripCommonRoot,writeManifest}=require('./updater-files.cjs');
const {checkForUpdates,claudeLatest,defaultFetchBuffer,defaultFetchJson,piLatest,releaseFromGithub,releaseFromTags,sharedFetchJson,timedFetch,xournalLatest}=require('./updater-check.cjs');

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
 let status;
 try{status=(await run('git',['status','--porcelain'],{cwd:sourceDir})).stdout;}catch(e){
  throw Error('git status não respondeu ('+causeText(e)+') — clone recusado');
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
 if(!rootDir||!deskDir||!sourceDir)throw Error(`applyUpdate: caminhos incompletos: recebido rootDir ${describeReceived(rootDir)}, deskDir ${describeReceived(deskDir)}, sourceDir ${describeReceived(sourceDir)}; esperados os três`);
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
 if(!deskDir)throw Error(invalidValue('applyPiOnly: deskDir',deskDir,'caminho absoluto'));
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
  appendLog(args.runtime?path.join(args.runtime,'desk.log'):'',`update: worker caiu (${causeText(e)})`,{level:'error'});
  releaseLock(args.lockFile||'');
  process.exit(1);
 });
}

module.exports={
 RELEASES_URL,TAGS_URL,PI_REGISTRY_URL,CLAUDE_REGISTRY_URL,XOURNAL_RELEASES_URL,XOURNAL_SITE_URL,CHECK_TTL,
 semverParse,semverCompare,isNewer,readCache,writeCache,cacheWrite,fresh,markToasted,
 defaultFetchJson,defaultFetchBuffer,timedFetch,sharedFetchJson,releaseFromGithub,releaseFromTags,
 checkForUpdates,piLatest,claudeLatest,xournalLatest,
 normalizeRel,isProtected,isReplaceable,readZip,assertSafeEntries,stripCommonRoot,applyZip,
 assertRealTarget,manifestFile,readManifest,writeManifest,removeOrphans,
 snapshotTree,restoreTree,readFileSafe,lockChangedSince,installedVersion,defaultRun,needsShell,
 spawnReopen,doReopen,spawnWorker,stageWorkerFiles,WORKER_FILES,waitForPid,pidAlive,resolveNode,workerEnv,
 writeHandshake,waitForHandshake,acquireLock,releaseLock,lockFileOf,LOCK_STALE_MS,
 applyUpdate,applyPiOnly,appendLog,persistResult,
};
