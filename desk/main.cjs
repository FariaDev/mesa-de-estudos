const {app,BrowserWindow,ipcMain,dialog,shell,Menu,screen,systemPreferences}=require('electron');
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
const {promisify}=require('node:util');const {execFile}=require('node:child_process');
const execFileAsync=promisify(execFile);
const {PiBridge}=require('./rpc.cjs');
const {placeWindow,chooseXournal,sessionStartedFromPath,formatSessionLabel,sessionPreviewFromJsonl}=require('./lib.cjs');
const {courseLibrary,mergeCourses}=require('./courses.cjs');
const {readConfig,writeConfig,seedConfig,needsSetup,normalize,pickPdfs}=require('./config.cjs');
const {resolvePi,spawnEnv,FALLBACK_LEVELS,loadLevelsModule}=require('./pi.cjs');

app.setName('Mesa de Estudos');
const deskDir=__dirname;
const envRuntime=process.env.LEARNING_DESK_RUNTIME;
const envVault=process.env.LEARNING_VAULT;
const persistConfig=!envRuntime;

function defaultUserData(){
 try{return app.getPath('userData');}catch{return path.join(os.homedir(),'.mesa-de-estudos');}
}

const configDir=envRuntime||defaultUserData();
fs.mkdirSync(configDir,{recursive:true});
const configFile=path.join(configDir,'config.json');
let config=readConfig(configFile);
if(!config){
 if(envVault)config=normalize({vaultPath:envVault,runtimePath:envRuntime||'',piPath:process.env.LEARNING_DESK_PI||'',xournalPath:'',courses:[]});
 else{
  config=seedConfig({runtimePath:envRuntime||''});
  if(persistConfig&&(config.vaultPath||config.courses.length))writeConfig(configFile,config);
 }
}
if(envVault)config.vaultPath=envVault;
if(process.env.LEARNING_DESK_PI)config.piPath=process.env.LEARNING_DESK_PI;

const runtime=envRuntime||config.runtimePath||path.join(configDir,'runtime');
fs.mkdirSync(runtime,{recursive:true});
app.setPath('userData',path.join(runtime,'electron'));

const stateFile=path.join(runtime,'desk.json');let state={};try{state=JSON.parse(fs.readFileSync(stateFile,'utf8'));}catch{}
let courses=mergeCourses(config);
let courseId=courses.some(c=>c.id===state.courseId)?state.courseId:(courses.find(c=>c.id==='Calculus I')?.id||courses[0]?.id||'');
let course=courses.find(c=>c.id===courseId)?.path||'';
const courseStates=state.courseStates||{};
const allowed=new Set();let win,bridge,lastPersist='',levelsMod;const pdfDisk=new Map();
if(!app.requestSingleInstanceLock())app.quit();app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});
let session=state.session||path.join(runtime,`pi-${Date.now()}.jsonl`);

function piBinary(){return resolvePi({configPath:config.piPath,deskDir,envPath:process.env.LEARNING_DESK_PI||''});}
function captureHelper(){return [path.join(__dirname,'..','visual-check','windows'),config.vaultPath&&path.join(config.vaultPath,'Code','learning-canvas','visual-check','windows')].filter(Boolean).find(p=>fs.existsSync(p));}
function captureAvailable(){return process.platform==='darwin'&&!!captureHelper();}

function previewFile(file){
 try{return sessionPreviewFromJsonl(fs.readFileSync(file,'utf8').slice(0,200000));}catch{return '';}
}
function courseSessions(){
 const map=new Map();
 for(const s of courseStates[courseId]?.sessions||[]){
  if(s?.path&&fs.existsSync(s.path))map.set(s.path,{path:s.path,started:s.started||sessionStartedFromPath(s.path),preview:s.preview||''});
 }
 if(session){
  const prev=map.get(session);
  const exists=fs.existsSync(session);
  map.set(session,{path:session,started:prev?.started||sessionStartedFromPath(session)||Date.now(),preview:prev?.preview||(exists?previewFile(session):'')});
 }
 return [...map.values()].sort((a,b)=>(b.started||0)-(a.started||0)).map(s=>({...s,label:formatSessionLabel(s)}));
}
function rememberSession(){
 if(!session)return;
 const list=(courseStates[courseId]?.sessions||[]).filter(s=>s.path&&s.path!==session&&fs.existsSync(s.path));
 list.push({path:session,started:sessionStartedFromPath(session)||Date.now(),preview:fs.existsSync(session)?previewFile(session):''});
 courseStates[courseId]={...(courseStates[courseId]||{}),sessions:list};
}
function persist(){
 if(courseId)courseStates[courseId]={pdfs:state.pdfs,referenceVisible:state.referenceVisible,chatWidth:state.chatWidth,calcHeight:state.calcHeight,draft:state.draft,session,sessions:courseSessions()};
 const payload=JSON.stringify({...state,session,courseId,courseStates,bounds:win&&!win.isDestroyed()?win.getBounds():state.bounds});
 if(payload===lastPersist)return;
 lastPersist=payload;
 try{fs.writeFileSync(stateFile,payload);}catch(e){console.error(e);}
}
function validPdf(p){if(typeof p!=='string'||!allowed.has(p))throw Error('Escolha um PDF pela biblioteca ou pelo seletor.');return p;}
function prepareCourse(){
 const root=path.join(runtime,'learning');const target=path.join(root,'Courses',courseId||'default');fs.mkdirSync(target,{recursive:true});
 const templates=path.join(__dirname,'templates');
 const pick=(...cands)=>cands.find(p=>p&&fs.existsSync(p));
 const link=(source,dest)=>{if(!source||fs.existsSync(dest)||!fs.existsSync(source))return;try{fs.symlinkSync(source,dest);}catch{fs.cpSync(source,dest,{recursive:true});}};
 for(const name of ['TUTOR.md','LEARNER.md','.pi']){
  link(pick(course&&path.join(course,name),config.vaultPath&&path.join(config.vaultPath,name),path.join(templates,name)),path.join(root,name));
 }
 if(course)for(const name of ['_state.md','Sources','TUTOR.md','LEARNER.md','.pi'])link(path.join(course,name),path.join(target,name));
 return target;
}
function connect(){
 if(!bridge){
  const pi=piBinary();
  bridge=new PiBridge({cwd:process.env.LEARNING_DESK_PI_CWD||prepareCourse(),session,pi,env:spawnEnv(pi),extraArgs:process.env.LEARNING_DESK_TEST_ARGS?JSON.parse(process.env.LEARNING_DESK_TEST_ARGS):[]});
  bridge.on('event',e=>{if(win&&!win.isDestroyed())win.webContents.send('pi-event',e);});
 }
 return bridge;
}
async function assertIdle(message){
 if(!bridge)return;
 const current=await bridge.request('get_state');
 if(current.isStreaming||current.pendingMessageCount)throw Error(message);
}
function stopBridge(){bridge?.removeAllListeners();bridge?.stop();bridge=null;}

function applyCourse(id){
 const selected=courses.find(c=>c.id===id);
 courseId=selected?id:'';
 course=selected?.path||'';
 const saved=courseStates[courseId]||{};
 state={...state,pdfs:saved.pdfs||[],referenceVisible:saved.referenceVisible!==false,chatWidth:saved.chatWidth||390,calcHeight:saved.calcHeight||220,draft:saved.draft||''};
 session=saved.session||path.join(runtime,`pi-${Date.now()}.jsonl`);
}

function initialData(){
 const library=course?courseLibrary(course):[];
 allowed.clear();
 for(const p of library)allowed.add(p.path);
 for(const p of state.pdfs||[])if(p?.path&&fs.existsSync(p.path))allowed.add(p.path);
 const cfg=normalize(config);
 return {
  library,state,
  course:courses.find(c=>c.id===courseId)?.name||'',
  courseId,courses:courses.map(({id,name})=>({id,name})),
  session,sessions:courseSessions(),
  config:cfg,
  preferred:(pickPdfs(library,cfg.desk.panels)||[]).map(p=>p?.path||null),
  needsSetup:needsSetup(config,courses),
  captureAvailable:captureAvailable(),
  detectedPi:piBinary(),
  platform:process.platform
 };
}

function buildMenu(){
 const study=[{label:'Conferir Xournal++',accelerator:'CmdOrCtrl+Shift+C',enabled:captureAvailable(),click:()=>{if(win&&!win.isDestroyed())win.webContents.send('menu-check');}},{label:'Parar',click:()=>{if(win&&!win.isDestroyed())win.webContents.send('menu-stop');}}];
 Menu.setApplicationMenu(Menu.buildFromTemplate([
  {label:'Mesa de Estudos',submenu:[{label:'Sobre a Mesa de Estudos',click:()=>{if(win&&!win.isDestroyed())win.webContents.send('menu-about');}},{label:'Configurações…',accelerator:'CmdOrCtrl+,',click:()=>{if(win&&!win.isDestroyed())win.webContents.send('menu-settings');}},{type:'separator'},{role:'quit'}]},
  {label:'Editar',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
  {label:'Estudar',submenu:study},
  {label:'Visualizar',submenu:[{role:'reload'},{role:'togglefullscreen'}]},
  {label:'Ajuda',submenu:[{label:'Como usar',accelerator:'CmdOrCtrl+/',click:()=>{if(win&&!win.isDestroyed())win.webContents.send('menu-help');}},{label:'Sobre',click:()=>{if(win&&!win.isDestroyed())win.webContents.send('menu-about');}}]}
 ]));
}

app.whenReady().then(()=>{
 if(process.platform==='darwin')app.dock.setIcon(path.join(__dirname,'assets','mesa-1024.png'));
 app.setAboutPanelOptions({applicationName:'Mesa de Estudos',applicationVersion:'0.3.2',copyright:'© 2026 Lucas Faria. Colaboração: Grok (xAI). Licença MIT.',iconPath:path.join(__dirname,'assets','mesa-1024.png')});
 const displays=screen.getAllDisplays();
 const placed=placeWindow(displays,screen.getPrimaryDisplay().id,state.bounds);
 win=new BrowserWindow({width:placed.width,height:placed.height,...(placed.x!=null?{x:placed.x,y:placed.y}:{}),minWidth:900,minHeight:650,title:'Mesa de Estudos',backgroundColor:'#ffffff',backgroundThrottling:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,spellcheck:false}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(e,url)=>{if(url!==win.webContents.getURL())e.preventDefault();});
 buildMenu();
 win.on('close',()=>persist());win.loadFile(path.join(__dirname,'index.html'));
});

ipcMain.handle('init',initialData);
ipcMain.handle('switch-course',async(_e,id)=>{
 const selected=courses.find(c=>c.id===id);if(!selected)throw Error('Matéria não encontrada.');
 await assertIdle('Pare a resposta antes de trocar de matéria.');
 persist();stopBridge();applyCourse(id);persist();return initialData();
});
ipcMain.handle('open-pdf',async()=>{const r=await dialog.showOpenDialog(win,{filters:[{name:'PDF',extensions:['pdf']}],properties:['openFile']});if(r.canceled)return null;const p=r.filePaths[0];allowed.add(p);return {name:path.basename(p),path:p};});
ipcMain.handle('read-pdf',(_e,p)=>{
 p=validPdf(p);
 const st=fs.statSync(p);
 const hit=pdfDisk.get(p);
 if(hit&&hit.mtime===st.mtimeMs&&hit.size===st.size)return hit.bytes;
 const bytes=new Uint8Array(fs.readFileSync(p));
 pdfDisk.set(p,{mtime:st.mtimeMs,size:st.size,bytes});
 if(pdfDisk.size>6)pdfDisk.delete(pdfDisk.keys().next().value);
 return bytes;
});
ipcMain.handle('save-state',(_e,value)=>{
 const pdfs=(value.pdfs||[]).slice(0,2).filter(p=>!p?.path||allowed.has(p.path)).map(p=>({path:p.path,page:p.page,zoom:p.zoom,scrollX:Number(p.scrollX)||0,scrollY:Number(p.scrollY)||0}));
 const calcHeight=Math.max(72,Math.min(900,Number(value.calcHeight)||state.calcHeight||220));
 state={...state,draft:typeof value.draft==='string'?value.draft.slice(0,100000):'',pdfs,referenceVisible:!!value.referenceVisible,chatWidth:Math.max(300,Math.min(700,Number(value.chatWidth)||390)),calcHeight};
 persist();
});
ipcMain.handle('get-config',()=>({config:normalize(config),detectedPi:piBinary(),captureAvailable:captureAvailable(),platform:process.platform,needsSetup:needsSetup(config,courses)}));
ipcMain.handle('pick-folder',async()=>{const r=await dialog.showOpenDialog(win,{properties:['openDirectory']});return r.canceled?null:r.filePaths[0];});
ipcMain.handle('pick-file',async()=>{const r=await dialog.showOpenDialog(win,{properties:['openFile']});return r.canceled?null:r.filePaths[0];});
ipcMain.handle('detect-pi',()=>piBinary());
ipcMain.handle('save-config',async(_e,next)=>{
 await assertIdle('Pare a resposta antes de mudar as configurações.');
 const incoming=normalize(next||{});
 if(incoming.runtimePath&&path.resolve(incoming.runtimePath)!==path.resolve(runtime)){
  throw Error('A pasta de dados em uso não pode mudar agora. Reabra o aplicativo depois de alterar o runtime.');
 }
 if(persistConfig)writeConfig(configFile,incoming);
 config=incoming;
 courses=mergeCourses(config);
 persist();stopBridge();
 if(!courses.some(c=>c.id===courseId))applyCourse(courses[0]?.id||'');
 persist();buildMenu();
 return initialData();
});

ipcMain.handle('pi-connect',async()=>{
 persist();
 const b=connect();
 const commands=await b.request('get_commands');
 const hasConferir=!!commands?.commands?.some(c=>c.name==='conferir');
 const s=await b.request('get_state');
 const messages=await b.request('get_messages');
 const models=await b.request('get_available_models');
 return {state:s,models:models?.models||[],levels:await levelsFor(s.model),messages:messages?.messages||[],session,sessions:courseSessions(),canConferir:hasConferir,captureAvailable:captureAvailable()};
});

async function levelsFor(model){
 if(!levelsMod)levelsMod=await loadLevelsModule(piBinary(),deskDir);
 if(!levelsMod?.getSupportedThinkingLevels)return FALLBACK_LEVELS;
 return model?levelsMod.getSupportedThinkingLevels(model):['off'];
}
ipcMain.handle('pi-settings',async(_e,change)=>{const b=connect();let current=await b.request('get_state');if(current.isStreaming||current.pendingMessageCount)throw Error('Aguarde ou pare a resposta antes de mudar o modelo.');if(change.model){const catalog=await b.request('get_available_models');const found=catalog.models?.find(m=>m.provider===change.model.provider&&m.id===change.model.id);if(!found)throw Error('Modelo não disponível no Pi.');await b.request('set_model',{provider:found.provider,modelId:found.id});}if(change.level){current=await b.request('get_state');if(!(await levelsFor(current.model)).includes(change.level))throw Error('Este esforço não é suportado pelo modelo.');await b.request('set_thinking_level',{level:change.level});}current=await b.request('get_state');return {state:current,levels:await levelsFor(current.model)};});

ipcMain.handle('pi-prompt',async(_e,payload)=>{
 if(typeof payload.text!=='string'||payload.text.length>100000)throw Error('Mensagem inválida.');
 let message=payload.text;const refs=(payload.refs||[]).slice(0,2).map(r=>`${validPdf(r.path)}#page=${Math.max(1,Math.trunc(r.page)||1)}`);
 if(refs.length)message+='\n\n[Referências abertas na mesa, indicadas pelo usuário como contexto: '+refs.map(r=>JSON.stringify(r)).join('; ')+'. Consulte essas páginas se necessário. A presença do PDF não significa que seu conteúdo já foi lido.]';
 const b=connect();await b.request('prompt',{message,streamingBehavior:'followUp'});const current=await b.request('get_state');return {streaming:!!current?.isStreaming};
});
ipcMain.handle('pi-abort',async()=>{if(bridge){await bridge.request('clear_queue');await bridge.request('abort');}});
ipcMain.handle('pi-response',(_e,data)=>{connect().respond(data);});
ipcMain.handle('new-session',async()=>{
 await assertIdle('Pare a resposta antes de começar outra conversa.');
 rememberSession();stopBridge();session=path.join(runtime,`pi-${Date.now()}.jsonl`);persist();
 return {session,sessions:courseSessions()};
});
ipcMain.handle('open-session',async(_e,file)=>{
 if(typeof file!=='string')throw Error('Sessão inválida.');
 if(file===session)return {session,sessions:courseSessions()};
 const allowedSessions=courseSessions();
 if(!allowedSessions.some(s=>s.path===file))throw Error('Sessão não encontrada nesta matéria.');
 if(!fs.existsSync(file))throw Error('Arquivo da sessão não existe mais.');
 await assertIdle('Pare a resposta antes de trocar de conversa.');
 rememberSession();stopBridge();session=file;persist();
 return {session,sessions:courseSessions()};
});
ipcMain.handle('capture-ready',async()=>{
 if(process.platform!=='darwin')throw Error('Conferir Xournal++ está disponível só no macOS.');
 let status=systemPreferences.getMediaAccessStatus('screen');
 if(status!=='granted'){
  if(status==='not-determined'){try{await systemPreferences.askForMediaAccess('screen');}catch{}}
  status=systemPreferences.getMediaAccessStatus('screen');
  if(status!=='granted')throw Error('Autorize Gravação de Tela para Mesa de Estudos em Ajustes > Privacidade e Segurança > Gravação de Tela. Depois reabra o aplicativo.');
 }
 const helper=captureHelper();
 if(!helper)throw Error('A conferência visual não está instalada.');
 const {stdout}=await execFileAsync(helper,[],{timeout:15000,maxBuffer:1024*1024});
 let listed;try{listed=JSON.parse(stdout);}catch{throw Error('Não foi possível listar as janelas do Xournal++.');}
 if(!listed.permission)throw Error('Autorize Gravação de Tela para Mesa de Estudos em Ajustes > Privacidade e Segurança > Gravação de Tela. Depois reabra o aplicativo.');
 const window=chooseXournal(listed.windows);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-visual-'));
 try{
  const file=path.join(dir,'attempt.png');
  await execFileAsync('/usr/sbin/screencapture',['-x','-o',`-l${window.id}`,file],{timeout:15000});
  const bytes=fs.readFileSync(file);
  if(bytes.length<100||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('A captura não produziu uma imagem PNG válida.');
  return {title:window.title||'Xournal++',dataUrl:'data:image/png;base64,'+bytes.toString('base64')};
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
ipcMain.handle('open-xournal',()=>{
 const target=config.xournalPath||(process.platform==='darwin'?'/Applications/Xournal++.app':'');
 if(!target)throw Error('Indique o caminho do Xournal++ em Configurações.');
 return shell.openPath(target);
});
app.on('window-all-closed',()=>app.quit());app.on('before-quit',()=>{bridge?.removeAllListeners();bridge?.stop();persist();});
