// @ts-check
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {message: uiMsg}=require('./src/i18n.mjs');
const {causeArg}=require('./src/error-detail.mjs');
const {writeReadableLog}=require('./desk-log.cjs');
const updater=require('./updater.cjs');
const components=require('./components.cjs');
const {readInstallSource,updateOrigin}=require('./update-origin.cjs');
const {createToolUpdates}=require('./tool-updates.cjs');
const {visibleEngines}=require('./visible-engines.cjs');

/* Updater por clique, painel de componentes e acesso ao log. Recebe do main só o
   que usa: `config` e `win` são acessores porque o main os reatribui. */
function registerUpdateHost({ipcMain,app,shell,runtime,deskDir,logFile,testMode,config,win,appendLog,toolHost}){
 const TEST_MODE=testMode;
 /* ---------- updater por clique + painel de componentes ----------
    Somente GETs públicos (releases do GitHub + registry npm); zero telemetria.
    O updater nunca toca `config.json`, Application Support/%APPDATA%, `.runtime/`
    (só o cache `update.json` e o append no `desk.log`), sessões, PDFs nem
    templates do usuário — a lista do que ele substitui é explícita em
    `updater.cjs` (lista de código + caminhos protegidos). Modo de teste não fala
    com a rede (os testes sobrescrevem os handlers com dados falsos). */
 const updateCacheFile=path.join(runtime,'update.json');
 /* #109: o Sobre mostra a MESMA origem que o updater vai usar. O fato vem do
    `install-source.json` (ou da raiz com `.git`); a classificação não adivinha
    pasta pessoal nem log — o caminho só existe aqui e no Sobre. */
 function originFacts(){
  return updateOrigin({packaged:!!app.isPackaged,deskDir,home:os.homedir()});
 }
 function updateContext(){
  const root=path.join(deskDir,'..');
  const bundle=path.resolve(deskDir,'..','..','..');
  const source=readInstallSource(deskDir);
  const mode=source&&source.path?'bundle':fs.existsSync(path.join(root,'.git'))?'git':'zip';
  const reopen=mode==='bundle'?{cmd:'open',args:[bundle]}:{cmd:'npm',args:['start'],cwd:deskDir,shell:process.platform==='win32'};
  /* #80: a chave pública viaja por parâmetro (o worker é uma cópia no tmpdir);
     marcador/ausente faz o updater recusar antes de qualquer download. */
  const publicKey=updater.readUpdatePublicKey(path.join(deskDir,'update-signing-key.pub'));
  return {mode,rootDir:root,deskDir,runtime,sourceInfo:source,reopen,publicKey};
 }
 ipcMain.handle('update-origin',()=>originFacts());
 ipcMain.handle('update-check',(_e,opts)=>{
  /* Origem que não recebe atualização não vira "Atualizada": o Sobre diz que
     não dá para verificar (#109). */
  if(originFacts().kind==='unavailable')return {status:'unverifiable',version:'',notes:'',url:'',current:app.getVersion()};
  if(TEST_MODE)return {status:'unknown',version:'',notes:'',url:'',current:app.getVersion()};
  return updater.checkForUpdates({current:app.getVersion(),manual:!!opts?.manual,cacheFile:updateCacheFile});
 });
 ipcMain.handle('update-apply',async()=>{
  if(TEST_MODE)throw Error(uiMsg('err.update.testMode'));
  const target=updater.readCache(updateCacheFile)?.release?.version;
  if(!target)throw Error(uiMsg('err.update.noneKnown'));
  /* Anti-rollback (auditoria de segurança): metadado público marcando versão
     assinada antiga como `latest` não abre o worker — a anunciada tem de ser
     mais nova que a instalada. */
  const installed=app.getVersion();
  if(!updater.isNewer(target,installed))throw Error(uiMsg('err.update.notNewer',{announced:target,installed}));
  /* A4: lock compartilhado entre Atualizar Mesa e o CLI — dois cliques (ou
     clique + terminal) não abrem dois workers concorrentes. */
  const lock=updater.acquireLock(runtime);
  if(!lock.ok)throw Error(uiMsg('err.update.locked',{file:lock.file}));
  const worker=updater.spawnWorker({...updateContext(),announcedVersion:target,waitPid:process.pid,cacheFile:updateCacheFile,lockFile:lock.file});
  if(!worker.ok){
   updater.releaseLock(lock.file);
   throw Error(worker.error||uiMsg('err.update.startFail'));
  }
  /* A4: handshake — o app SÓ fecha depois de o worker confirmar que subiu
     (Node ausente/spawn falho/handshake perdido deixam a Mesa de pé). */
  const ok=await updater.waitForHandshake(worker.status,15000);
  if(!ok){
   appendLog('update','worker não confirmou o arranque — app segue aberto; atualização abortada');
   updater.releaseLock(lock.file);
   throw Error(uiMsg('err.update.scriptNoStart'));
  }
  appendLog('update',`aplicando v${target} (worker confirmado: ${worker.script})`);
  setTimeout(()=>app.quit(),400);
  return {ok:true,version:target};
 });
 /* Claude Code (#45): avisos, memória do "visto"/"ignorar"/"lembrar depois"
    e o "Atualizar" com confirmação. Os fixtures de teste entram por
    `toolHost.fixtures` (só no modo de teste). */
 const fixtures=testMode?(toolHost.fixtures||{}):{};
 const tools=createToolUpdates({
  runtime,deskDir,config,testMode,appendLog,
  state:toolHost.state,persist:toolHost.persist,isBusy:toolHost.isBusy,hasBridge:toolHost.hasBridge,relink:toolHost.relink,
  send:(channel,payload)=>{const target=win();if(target&&!target.isDestroyed())target.webContents.send(channel,payload);},
  visibleEngines:()=>visibleEngines({testMode:TEST_MODE,env:process.env}),
  ...fixtures,
 });
 const toolFixtures=fixtures;
 ipcMain.handle('components',(_e,opts)=>components.collect({deskDir,config:config(),cacheFile:updateCacheFile,version:app.getVersion(),manual:!!opts?.manual,testMode:TEST_MODE,
  latestOverride:toolFixtures.latestOverride,claudeLauncher:toolFixtures.claudeLauncher}));
 ipcMain.handle('tool-notices',()=>tools.notices());
 ipcMain.handle('tool-notices-opened',()=>tools.opened());
 ipcMain.handle('tool-notice-postpone',(_e,id)=>tools.postpone(id));
 ipcMain.handle('tool-notice-ignore',(_e,id)=>tools.ignore(id));
 ipcMain.handle('tool-update-run',(_e,id)=>tools.run(id));
 /* Resultado REAL da última atualização (C1): gravado pelo worker em
    update.json; o Sobre mostra na reabertura (atualizada/recuperada/incompleta). */
 ipcMain.handle('update-result',()=>{
  if(TEST_MODE)return null;
  const r=updater.readCache(updateCacheFile)?.lastResult;
  return r&&typeof r==='object'?r:null;
 });
 /* Acesso ao desk.log (C1): o resultado de rollback se explica no log. O
    desk.log é JSON por linha, para máquina; o Sobre abre a versão em texto (#43 fase 3). */
 ipcMain.handle('open-log',()=>{
  if(TEST_MODE)return {ok:false};
  let readable;
  try{readable=writeReadableLog({logFile,readableFile:path.join(runtime,'desk-legivel.log')});}
  catch(error){throw Error(uiMsg('err.log.readableFailed',{detail:causeArg(error)}));}
  return shell.openPath(readable);
 });
 ipcMain.handle('open-external',(_e,url)=>{
  if(typeof url!=='string'||!/^https:\/\//.test(url))throw Error(uiMsg('err.update.badLink'));
  return shell.openExternal(url);
 });
 /* Checagem automática 1×/dia (Mesa + Claude Code): silenciosa, não bloqueante, cache no
    runtime. O aviso fica no cabeçalho em toda abertura enquanto houver atualização. */
 function scheduleUpdateCheck(){
  if(TEST_MODE)return;
  setTimeout(async()=>{
   try{
    const target=win();
    /* #109: sem origem válida não há "vX disponível" no cabeçalho — a
       atualização não poderia ser aplicada. Pi/Claude seguem normais. */
    if(originFacts().kind!=='unavailable'){
     const r=await updater.checkForUpdates({current:app.getVersion(),manual:false,cacheFile:updateCacheFile});
     if(r.status==='update'&&r.version&&target&&!target.isDestroyed()){
      target.webContents.send('update-available',{version:r.version});
     }
    }
    await updater.claudeLatest({cacheFile:updateCacheFile});
    const summary=await tools.notices();
    if(target&&!target.isDestroyed())target.webContents.send('tool-notices',summary);
   }catch{/* checagem em segundo plano é best-effort (offline é normal); o Sobre refaz sob demanda */}
  },5000);
 }
 return {scheduleUpdateCheck};
}
module.exports={registerUpdateHost};
