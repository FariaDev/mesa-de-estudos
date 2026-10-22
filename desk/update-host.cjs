// @ts-check
const fs=require('node:fs');const path=require('node:path');
const {message: uiMsg}=require('./src/i18n.mjs');
const {causeArg}=require('./src/error-detail.mjs');
const {writeReadableLog}=require('./desk-log.cjs');
const updater=require('./updater.cjs');
const components=require('./components.cjs');
const {createToolUpdates}=require('./tool-updates.cjs');

/* Updater por clique, painel de componentes e acesso ao log. Recebe do main só o
   que usa: `config` e `win` são acessores porque o main os reatribui. */
function registerUpdateHost({ipcMain,app,shell,runtime,deskDir,logFile,testMode,config,win,piBinary,appendLog,toolHost}){
 const TEST_MODE=testMode;
 /* ---------- updater por clique + painel de componentes ----------
    Somente GETs públicos (releases do GitHub + registry npm); zero telemetria.
    O updater nunca toca `config.json`, Application Support/%APPDATA%, `.runtime/`
    (só o cache `update.json` e o append no `desk.log`), sessões, PDFs nem
    templates do usuário — a lista do que ele substitui é explícita em
    `updater.cjs` (lista de código + caminhos protegidos). Modo de teste não fala
    com a rede (os testes sobrescrevem os handlers com dados falsos). */
 const updateCacheFile=path.join(runtime,'update.json');
 function updateContext(){
  const root=path.join(deskDir,'..');
  const bundle=path.resolve(deskDir,'..','..','..');
  let source=null;try{source=JSON.parse(fs.readFileSync(path.join(deskDir,'install-source.json'),'utf8'));}catch{/* sem install-source.json: instalação por git ou zip */}
  const mode=source&&source.path?'bundle':fs.existsSync(path.join(root,'.git'))?'git':'zip';
  const reopen=mode==='bundle'?{cmd:'open',args:[bundle]}:{cmd:'npm',args:['start'],cwd:deskDir,shell:process.platform==='win32'};
  return {mode,rootDir:root,deskDir,runtime,sourceInfo:source,reopen};
 }
 ipcMain.handle('update-check',(_e,opts)=>{
  if(TEST_MODE)return {status:'unknown',version:'',notes:'',url:'',current:app.getVersion()};
  return updater.checkForUpdates({current:app.getVersion(),manual:!!opts?.manual,cacheFile:updateCacheFile});
 });
 ipcMain.handle('update-apply',async()=>{
  if(TEST_MODE)throw Error(uiMsg('err.update.testMode'));
  const target=updater.readCache(updateCacheFile)?.release?.version;
  if(!target)throw Error(uiMsg('err.update.noneKnown'));
  /* A4: lock compartilhado entre Atualizar Mesa, Atualizar Pi e o CLI — dois
     cliques (ou clique + terminal) não abrem dois workers concorrentes. */
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
 ipcMain.handle('update-pi',async()=>{
  if(TEST_MODE)throw Error(uiMsg('err.update.testMode'));
  const ctx=updateContext();
  const pi=piBinary();
  if(!components.piIsLocal(pi,deskDir))throw Error(uiMsg('err.update.piNotLocal'));
  const lock=updater.acquireLock(runtime);
  if(!lock.ok)throw Error(uiMsg('err.update.locked',{file:lock.file}));
  const worker=updater.spawnWorker({...ctx,piOnly:true,waitPid:process.pid,cacheFile:updateCacheFile,lockFile:lock.file});
  if(!worker.ok){
   updater.releaseLock(lock.file);
   throw Error(worker.error||uiMsg('err.update.startFail'));
  }
  const ok=await updater.waitForHandshake(worker.status,15000);
  if(!ok){
   appendLog('update','worker do Pi não confirmou o arranque — app segue aberto; atualização abortada');
   updater.releaseLock(lock.file);
   throw Error(uiMsg('err.update.piScriptNoStart'));
  }
  appendLog('update','atualizando o Pi local (worker confirmado)');
  setTimeout(()=>app.quit(),400);
  return {ok:true};
 });
 /* Pi e Claude Code (#45): avisos, memória do "visto"/"ignorar"/"lembrar
    depois" e o "Atualizar" com confirmação. Os fixtures de teste entram por
    `toolHost.fixtures` (só no modo de teste). */
 const fixtures=testMode?(toolHost.fixtures||{}):{};
 const tools=createToolUpdates({
  runtime,deskDir,config,testMode,appendLog,
  state:toolHost.state,persist:toolHost.persist,isBusy:toolHost.isBusy,hasBridge:toolHost.hasBridge,relink:toolHost.relink,
  send:(channel,payload)=>{const target=win();if(target&&!target.isDestroyed())target.webContents.send(channel,payload);},
  ...fixtures,
 });
 const toolFixtures=fixtures;
 ipcMain.handle('components',(_e,opts)=>components.collect({deskDir,config:config(),cacheFile:updateCacheFile,version:app.getVersion(),manual:!!opts?.manual,testMode:TEST_MODE,
  latestOverride:toolFixtures.latestOverride,piPath:toolFixtures.piPath,claudeLauncher:toolFixtures.claudeLauncher}));
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
 /* Checagem automática 1×/dia (Mesa + Pi): silenciosa, não bloqueante, cache no
    runtime. O aviso fica no cabeçalho em toda abertura enquanto houver atualização. */
 function scheduleUpdateCheck(){
  if(TEST_MODE)return;
  setTimeout(async()=>{
   try{
    const r=await updater.checkForUpdates({current:app.getVersion(),manual:false,cacheFile:updateCacheFile});
    const target=win();
    if(r.status==='update'&&r.version&&target&&!target.isDestroyed()){
     target.webContents.send('update-available',{version:r.version});
    }
    await updater.piLatest({cacheFile:updateCacheFile});
    await updater.claudeLatest({cacheFile:updateCacheFile});
    const summary=await tools.notices();
    if(target&&!target.isDestroyed())target.webContents.send('tool-notices',summary);
   }catch{/* checagem em segundo plano é best-effort (offline é normal); o Sobre refaz sob demanda */}
  },5000);
 }
 return {scheduleUpdateCheck};
}
module.exports={registerUpdateHost};
