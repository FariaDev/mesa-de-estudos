'use strict';

const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {message: uiMsg}=require('./src/i18n.mjs');
const {causeArg}=require('./src/error-detail.mjs');
const {spawn,execFile}=require('node:child_process');
const {promisify}=require('node:util');
const {appendLog}=require('./updater-core.cjs');

/* Atualização — processo: comandos sem shell, reabrir o app, esperar o pid,
   ambiente e node do worker, handshake e lock.
   Saiu de updater.cjs na #43 fase 2; o worker copia este arquivo junto
   (`WORKER_FILES`). */

/* O worker viaja sozinho: cada `require` local do updater tem de estar ao lado
   da cópia, no mesmo caminho relativo — o contrato do Pi local (`pi.cjs`), as
   partes do updater e o `src/i18n.mjs`. A #41 trouxe o i18n e a cópia seguia
   levando só o pi.cjs: o worker morria antes do handshake (#43 fase 2).
   O `src/error-detail.mjs` (#43 fase 3) tira caminho pessoal das causas, e o
   `src/log-entry.mjs` dá o formato da linha do `desk.log`. */
const WORKER_FILES=['pi.cjs','src/i18n.mjs','src/error-detail.mjs','src/log-entry.mjs','updater-core.cjs','updater-check.cjs','updater-files.cjs','updater-worker.cjs'];

/**
 * Monta em `dir` a cópia do updater que o worker executa, com os módulos que ela requer.
 * @param {string} dir pasta vazia no tmpdir
 * @returns {string} caminho do `update-worker.cjs`
 * @example const script=stageWorkerFiles(fs.mkdtempSync(path.join(os.tmpdir(),'mesa-update-')));
 */
function stageWorkerFiles(dir){
 const script=path.join(dir,'update-worker.cjs');
 fs.copyFileSync(path.join(__dirname,'updater.cjs'),script);
 for(const rel of WORKER_FILES){
  const target=path.join(dir,rel);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.copyFileSync(path.join(__dirname,rel),target);
 }
 return script;
}

const execFileAsync=promisify(execFile);
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
  return {ok:false,error:uiMsg('err.update.nodeMissing')};
 }
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-update-'));
 let script;
 try{script=stageWorkerFiles(dir);}
 catch(e){
  try{fs.rmSync(dir,{recursive:true,force:true});}catch{}
  return {ok:false,error:uiMsg('err.update.startFailWith',{error:causeArg(e)})};
 }
 const payload=path.join(dir,'args.json');
 const status=path.join(dir,'status.json');
 fs.writeFileSync(payload,JSON.stringify({...args,_status:status}));
 let child;
 try{
  child=spawnFn(node,[script,'--apply',payload],{detached:true,stdio:'ignore',env:workerEnv(env,home)});
 }catch(e){
  try{fs.rmSync(dir,{recursive:true,force:true});}catch{}
  return {ok:false,error:uiMsg('err.update.startFailWith',{error:causeArg(e)})};
 }
 /* Sem listener o spawn que falha (ENOENT etc.) derrubaria o processo pai. */
 child.on('error',err=>{
  appendLog(args.runtime?path.join(args.runtime,'desk.log'):'','update: spawn do worker falhou ('+String(err&&err.message||err)+')');
 });
 child.unref();
 return {ok:true,script,payload,status,node,child};
}

module.exports={WORKER_FILES,stageWorkerFiles,needsShell,defaultRun,spawnReopen,doReopen,pidAlive,waitForPid,workerEnv,resolveNode,writeHandshake,waitForHandshake,LOCK_STALE_MS,lockFileOf,acquireLock,releaseLock,spawnWorker};
