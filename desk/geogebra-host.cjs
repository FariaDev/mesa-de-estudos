// @ts-check
const fs=require('node:fs');const path=require('node:path');
const http=require('node:http');const crypto=require('node:crypto');

const {createGgbBoard,createKeptStore}=require('./ggb-board.cjs');
const {readInstalledPack,contentRoot}=require('./geogebra-pack.cjs');
const {PAGE_URL,installOfflineSession}=require('./ggb-pack-protocol.cjs');
const {message: uiMsg}=require('./src/i18n.mjs');

/* Applet GeoGebra: a view nativa por cima do leitor, a ponte HTTP local que a
   ferramenta do tutor usa e os handlers `ggb-*`. O main entrega só acessores
   (`win`, `deskState`, `courseKey`), `persist`, `appendLog` e `WebContentsView`;
   `resetRestored` é o que `applyCourse`/`hydrateFreeRecord` chamam quando o
   documento muda.

   Sob demanda (#53): a ferramenta do tutor funciona com a aba fechada. O
   `service` (o mesmo para a ponte do Pi e para o MCP do Claude) pede ao renderer
   para abrir a aba, espera o applet e a restauração da matéria e só então
   roda; antes de um comando, o quadro do uso (`ggb-board.cjs`) decide se limpa.
   `ggbPage` e `openDeadlineMs` existem para os testes trocarem o applet da web
   por uma página com nome e o prazo por um curto.

   Offline (#55): com o pacote do GeoGebra baixado (`ggbPackDir`, `geogebra-pack.cjs`)
   a view carrega o `ggb.html` por `mesa-ggb://` e a sessão do applet não tem rede.
   O pacote é escolhido ao criar a view; sem ele, o applet é o da web. */
const OPEN_DEADLINE_MS=25000;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
/**
 * Calculadora GeoGebra numa view própria, com o quadro guardado por matéria.
 * @param {{WebContentsView: typeof import('electron').WebContentsView, win: () => import('./types/host-deps').BrowserWindow,
 *   deskState: () => import('./types/desk-state').DeskState, courseKey?: () => string,
 *   persist: (force?: boolean) => void, runtime: string, appendLog: import('./types/host-deps').AppendLog,
 *   tutorT?: import('./types/host-deps').Translate, ggbPage?: string, openDeadlineMs?: number, ggbPackDir?: string}} deps
 * @example const ggb = createGeogebraHost({WebContentsView, win: () => win, deskState: () => state, persist, runtime, appendLog});
 */
function createGeogebraHost({WebContentsView,win,deskState,courseKey=()=>'',persist,runtime,appendLog,tutorT=key=>key,ggbPage=path.join(__dirname,'ggb.html'),openDeadlineMs=OPEN_DEADLINE_MS,ggbPackDir=''}){
 let offline=false;
 let ggbRestored=false,restoring=Promise.resolve(false);
 const ggbBridgeFile=path.join(runtime,'ggb-bridge.json');
 let ggbView=null,ggbRect=null,ggbVisible=false,ggbServer=null,ggbPort=0,ggbToken='';
 /* `ggbRestored` vale por documento do applet: o ggb.html recarrega no resize e
    cada `did-finish-load` reabre a janela para reaplicar o snapshot da matéria. */
 let ggbDocumentLoaded=false,ggbCaptureBusy=false;
 function restoreGgbConstruction(){
  if(!ggbView||ggbView.webContents.isDestroyed()||!ggbDocumentLoaded)return;
  if(ggbRestored)return;
  /* Documento sem snapshot guardado também conta como restaurado: senão o primeiro
     snapshot gravado depois (do uso do tutor) voltaria por cima do que o aluno
     desenhou no meio (#53). */
  ggbRestored=true;
  const b64=deskState().ggbBase64;
  if(!b64)return;
  restoring=ggbView.webContents.executeJavaScript(`(async()=>{const wait=t=>new Promise(r=>setTimeout(r,t));for(let i=0;i<60&&!window.__ggbReady;i++)await wait(500);if(!window.__ggbReady)return false;try{window.ggbApplet.setBase64(${JSON.stringify(b64)});return true}catch(e){return false}})()`,true).catch(()=>false/* applet ainda carregando ou view destruída: a próxima abertura restaura de novo */);
 }
 function ensureGgbView(){
  if(!ggbView){
   ggbView=new WebContentsView({webPreferences:{partition:'persist:geogebra',sandbox:true,contextIsolation:true,nodeIntegration:false,spellcheck:false}});
   win().contentView.addChildView(ggbView);
   /* O applet recarrega sozinho quando a view muda de tamanho: no documento novo
      o snapshot da matéria é reaplicado assim que o applet fica pronto. */
   ggbView.webContents.on('did-finish-load',()=>{
    ggbDocumentLoaded=true;
    ggbRestored=false;
    if(ggbVisible)restoreGgbConstruction();
   });
   const failed=error=>appendLog('ggb',`applet não carregou: ${error.message}`);
   offline=!!readInstalledPack(ggbPackDir);
   if(!offline)ggbView.webContents.loadFile(ggbPage).catch(failed);
   else{
    let blocked=0;
    installOfflineSession(ggbView.webContents.session,{contentDir:contentRoot(ggbPackDir),pageFile:path.join(__dirname,'ggb.html'),onBlocked:url=>{if(blocked++<5)appendLog('ggb',`rede recusada no GeoGebra offline: ${String(url).slice(0,200)}`);}});
    ggbView.webContents.loadURL(PAGE_URL).catch(failed);
   }
  }
  return ggbView;
 }
 function placeGgbView(){
  const owner=win();
  if(!ggbView||!ggbRect||!owner||owner.isDestroyed())return;
  ggbView.setBounds({x:ggbRect.x,y:ggbRect.y,width:Math.max(1,ggbRect.width),height:Math.max(1,ggbRect.height)});
 }
 function hideGgbView(){ggbRect=null;ggbVisible=false;if(ggbView&&!ggbView.webContents.isDestroyed())ggbView.setVisible(false);}
 /* Arrasto do divisor do chat (ajustes do GeoGebra): a view nativa fica acima
    do DOM, não acompanha `--chat` e recarrega o applet a cada tamanho novo. No
    começo do arrasto ela vira uma captura (o renderer mostra a imagem no lugar)
    e some; o próximo `ggb-view` a devolve no retângulo final, uma vez só. A
    aba segue ativa e a construção não é tocada. */
 async function freezeGgbView(){
  if(!ggbView||ggbView.webContents.isDestroyed()||!ggbVisible)return {dataUrl:''};
  let dataUrl='';
  try{
   const image=await ggbView.webContents.capturePage();
   if(image&&!image.isEmpty())dataUrl=`data:image/png;base64,${image.toPNG().toString('base64')}`;
  }catch(error){appendLog('ggb',`captura do arrasto falhou: ${error.message}`);}
  if(!ggbView.webContents.isDestroyed())ggbView.setVisible(false);
  return {dataUrl};
 }
 async function captureGgbSnapshot(){
  try{
   if(!ggbView||ggbView.webContents.isDestroyed()||!ggbVisible)return {saved:false};
   const data=await ggbView.webContents.executeJavaScript('(function(){if(!window.__ggbReady)return null;try{return window.ggbApplet&&typeof window.ggbApplet.getBase64==="function"?window.ggbApplet.getBase64():null}catch(e){return null}})()',true);
   if(typeof data==='string'&&data&&data.length<=400000){
    deskState().ggbBase64=data;
    persist();
    return {saved:true,size:data.length};
   }
  }catch{/* applet indisponível: devolve saved:false */}
  return {saved:false};
 }
 /* O resize da janela recarrega o applet (o ggb.html só mede o layout no load):
    guarda a construção viva ANTES do documento novo, para o restore não voltar
    apenas ao último snapshot salvo. */
 function captureGgbConstruction(){
  if(ggbCaptureBusy||!ggbView||ggbView.webContents.isDestroyed()||!ggbVisible)return;
  ggbCaptureBusy=true;
  captureGgbSnapshot().finally(()=>{ggbCaptureBusy=false;});
 }
 async function ggbExec(expression){
  if(!ggbView||ggbView.webContents.isDestroyed()||!ggbVisible)throw Error(tutorT('ggb.err.openFirst'));
  const wc=ggbView.webContents;
  const ready=await wc.executeJavaScript('Promise.resolve(window.__ggbReady===true)',true);
  if(!ready)throw Error(tutorT('ggb.err.loadingOrFailed'));
  return wc.executeJavaScript(expression,true);
 }
 function ggbSummary(){
  return ggbExec(`(async()=>{const A=window.ggbApplet;const names=String(A.getAllObjectNames()||'').split('\\n').map(s=>s.trim()).filter(Boolean);const lines=[];for(const n of names.slice(0,80)){let d='';try{d=String(A.getCommandString(n)||'')}catch{/* objeto sem este texto: tenta o próximo */}if(!d){try{d=String(A.getDefinitionString(n)||'')}catch{/* objeto sem este texto: segue sem definição */}}let v='';try{v=String(A.getValueString(n)||'')}catch{/* objeto sem valor textual */}lines.push(\`\${n}\${d?\`: \${d}\`:''}\${v?\` = \${v}\`:''}\`);}return {objects:lines.join('\\n'),count:names.length};})()`);
 }
 async function ggbRun(command){
  const ok=await ggbExec(`(function(){try{return {ok:!!window.ggbApplet.evalCommand(${JSON.stringify(command)})}}catch(e){return {ok:false,error:String(e&&e.message||e)}}})()`);
  let state=null;
  try{state=await ggbSummary();}catch{/* sem resumo: devolve só o resultado do comando */}
  return {...(ok||{}),state};
 }
 /* O applet real atrás do quadro (`ggb-board.cjs`): tudo passa por `ggbExec`,
    que exige a aba aberta e o applet pronto. Limpar apaga os objetos e deixa a
    vista como o aluno a configurou. */
 const boardApplet={
  summary:()=>ggbSummary(),
  snapshot:async()=>String(await ggbExec('Promise.resolve(window.ggbApplet.getBase64())')||''),
  load:b64=>ggbExec(`(async()=>{window.ggbApplet.setBase64(${JSON.stringify(b64)});return true})()`).then(()=>{}),
  clear:()=>ggbExec(`(async()=>{const A=window.ggbApplet;String(A.getAllObjectNames()||'').split('\\n').map(s=>s.trim()).filter(Boolean).forEach(n=>A.deleteObject(n));return true})()`).then(()=>{}),
 };
 const board=createGgbBoard({applet:boardApplet,store:createKeptStore(path.join(runtime,'ggb'),line=>appendLog('ggb',line)),key:()=>courseKey()||'default',onChange:status=>{
  const owner=win();
  if(owner&&!owner.isDestroyed())owner.webContents.send('ggb-board',status);
 }});
 const viewAlive=()=>!!ggbView&&!ggbView.webContents.isDestroyed();
 const appletReady=()=>viewAlive()?ggbView.webContents.executeJavaScript('Promise.resolve(window.__ggbReady===true)',true).catch(()=>false):Promise.resolve(false);
 async function waitUntil(condition,deadline){
  while(!(await condition())){
   if(Date.now()>=deadline)return false;
   await sleep(50);
  }
  return true;
 }
 /* Abre a aba (se fechada) e espera: view visível, documento carregado, matéria
    restaurada e applet pronto. Sem isso o primeiro comando limparia o snapshot
    que ainda ia chegar. Erro em uma frase, sem jargão. */
 async function ensureReady(){
  const deadline=Date.now()+openDeadlineMs;
  if(!ggbVisible){
   const owner=win();
   if(!owner||owner.isDestroyed())throw Error(tutorT('ggb.err.noWindow'));
   owner.webContents.send('ggb-open');
   const shown=await waitUntil(()=>ggbVisible&&viewAlive()&&ggbDocumentLoaded,deadline);
   if(!shown)throw Error(tutorT('ggb.err.tabTimeout'));
  }
  restoreGgbConstruction();
  await Promise.race([restoring,sleep(Math.max(0,deadline-Date.now()))]);
  if(!(await waitUntil(appletReady,deadline)))throw Error(tutorT(offline?'ggb.err.appletTimeoutOffline':'ggb.err.appletTimeout'));
 }
 /* Um pedido do tutor por vez: o quadro decide limpar com base no que viu. */
 let queue=Promise.resolve();
 const serial=job=>{const next=queue.then(job);queue=next.catch(()=>{});return next;};
 const service={
  run:({command,continuar=false})=>serial(async()=>{
   await ensureReady();
   const used=await board.beforeUse({kind:'run',continues:continuar===true});
   const result=await ggbRun(command);
   board.afterRun(result.state);
   captureGgbSnapshot();
   return {...result,board:used};
  }),
  state:()=>serial(async()=>{await ensureReady();const state=await ggbSummary();return {ok:!!state,state};}),
  screenshot:()=>serial(async()=>{
   await ensureReady();
   const image=await ggbView.webContents.capturePage();
   if(image.isEmpty())throw Error(tutorT('ggb.err.shotEmpty'));
   return {png:image.toPNG().toString('base64')};
  }),
 };
 function ggbReply(res,code,payload){
  res.on('error',()=>{});
  res.writeHead(code,{'content-type':'application/json; charset=utf-8'});
  res.end(JSON.stringify(payload));
 }
 function readBody(req,res,cap=65536){
  const declared=Number(req.headers['content-length'])||0;
  if(declared>cap){ggbReply(res,413,{error:tutorT('ggb.err.bodyTooBig')});req.destroy();return Promise.reject(Error(tutorT('ggb.err.bodyTooBig')));}
  return new Promise((resolve,reject)=>{
   let size=0;const chunks=[];
   req.on('data',chunk=>{size+=chunk.length;if(size>cap){ggbReply(res,413,{error:tutorT('ggb.err.bodyTooBig')});req.destroy();reject(Error(tutorT('ggb.err.bodyTooBig')));return;}chunks.push(chunk);});
   req.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));
   req.on('error',reject);
  });
 }
 function startGgbBridge(){
  if(ggbServer)return;
  ggbToken=crypto.randomBytes(24).toString('base64url');
  ggbServer=http.createServer(async(req,res)=>{
   try{
    const token=typeof req.headers['x-desk-token']==='string'?req.headers['x-desk-token']:'';
    const given=Buffer.from(token),expected=Buffer.from(ggbToken);
    if(given.length!==expected.length||!crypto.timingSafeEqual(given,expected)){ggbReply(res,403,{error:tutorT('ggb.err.badToken')});return;}
    const action=new URL(req.url,'http://127.0.0.1').pathname.replace(/\/+$/,'');
    if(req.method!=='POST'||!['/run','/state','/screenshot'].includes(action)){ggbReply(res,404,{error:'Rota desconhecida.'});return;}
    const body=await readBody(req,res);
    let payload={};
    try{payload=body?JSON.parse(body):{};}catch{ggbReply(res,400,{error:tutorT('ggb.err.badJson')});return;}
    if(action==='/run'){
     const command=typeof payload.command==='string'?payload.command.trim():'';
     if(!command||command.length>2000){ggbReply(res,400,{error:tutorT('ggb.err.needCommand')});return;}
     ggbReply(res,200,await service.run({command,continuar:payload.continuar===true}));
    }else if(action==='/state'){
     ggbReply(res,200,await service.state());
    }else{
     ggbReply(res,200,await service.screenshot());
    }
   }catch(e){ggbReply(res,500,{error:String(e&&e.message||e)});}
  });
  ggbServer.on('error',()=>{ggbServer=null;ggbPort=0;try{fs.rmSync(ggbBridgeFile,{force:true});}catch{/* arquivo já não existe */}});
  ggbServer.listen(0,'127.0.0.1',()=>{
   ggbPort=ggbServer.address().port;
   try{fs.writeFileSync(ggbBridgeFile,JSON.stringify({port:ggbPort,token:ggbToken}),{mode:0o600});}catch(error){appendLog('ggb',`ponte do GeoGebra sem arquivo de descoberta: ${error.message}`);}
  });
 }
 function register(ipcMain){
  ipcMain.handle('ggb-view',(_e,payload)=>{
   if(payload?.visible){
    const rect=payload.rect||{};
    ggbRect={x:Math.max(0,Number(rect.x)||0),y:Math.max(0,Number(rect.y)||0),width:Math.max(1,Number(rect.width)||0),height:Math.max(1,Number(rect.height)||0)};
    /* `covered` (#52): uma sobreposição de página inteira está aberta. A view
       se esconde mas a aba segue ativa, com o mesmo retângulo e a mesma
       construção, e a ponte do tutor continua valendo; ao fechar volta igual. */
    ensureGgbView();placeGgbView();ggbView.setVisible(payload.covered!==true);ggbVisible=true;
    restoreGgbConstruction();
   }else hideGgbView();
  });
  ipcMain.handle('ggb-freeze',()=>freezeGgbView());
  ipcMain.handle('ggb-snapshot',()=>captureGgbSnapshot());
  ipcMain.handle('ggb-board',()=>board.status());
  ipcMain.handle('ggb-restore',()=>serial(async()=>{await ensureReady();const result=await board.restore();await captureGgbSnapshot();return result;}));
  ipcMain.handle('ggb-shot',async()=>{
   if(!ggbView||ggbView.webContents.isDestroyed()||!ggbVisible)throw Error(uiMsg('ggb.err.openFirst'));
   const ready=await ggbView.webContents.executeJavaScript('Promise.resolve(window.__ggbReady===true)',true).catch(()=>false);
   if(!ready)throw Error(uiMsg('ggb.err.loading'));
   const image=await ggbView.webContents.capturePage();
   if(image.isEmpty())throw Error(uiMsg('ggb.err.shotEmpty'));
   return {dataUrl:'data:image/png;base64,'+image.toPNG().toString('base64')};
  });
 }
 function close(){
  try{if(ggbServer){ggbServer.close();ggbServer=null;}}catch{/* encerrando: o servidor já parou */}
  try{fs.rmSync(ggbBridgeFile,{force:true});}catch{/* encerrando: o arquivo já não existe */}
 }
 return {bridgeFile:ggbBridgeFile,register,start:startGgbBridge,close,placeView:placeGgbView,hideView:hideGgbView,captureConstruction:captureGgbConstruction,service,boardStatus:()=>board.status(),isOffline:()=>offline,newRequest:()=>board.newRequest(),
  /* O documento do applet mudou (matéria ou sessão livre): o quadro de uso começa de novo. */
  resetRestored(){ggbRestored=false;board.reset();}};
}
module.exports={createGeogebraHost};
