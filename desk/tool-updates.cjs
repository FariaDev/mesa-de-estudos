/* Avisos de atualização do Pi e do Claude Code, e "Atualizar" de dentro da Mesa
   (#45).

   A DECISÃO é do núcleo (`core/updatenotice.bend`): aqui o host entrega fatos
   (versões lidas, tabela "testada com esta Mesa", memória do `desk.json`, o dia
   de hoje) e aplica o que a pessoa fez ("visto", "Lembrar depois", "Ignorar esta
   versão"). A Mesa NUNCA roda um comando por conta própria: `run` só é chamado
   pelo clique de confirmação, com o comando que o próprio host montou.

   Memória no estado de interface (`desk.json`, não no `config.json`):
   `toolNotices.<pi|claude> = {seen, ignored, remindDay}` (versões `X.Y.Z` ou '';
   o dia é o número de dias desde 1970). */
const os=require('node:os');
const {message: uiMsg}=require('./src/i18n.mjs');
const path=require('node:path');
const updater=require('./updater.cjs');
const components=require('./components.cjs');
const toolFacts=require('./tool-facts.cjs');
const toolRun=require('./tool-run.cjs');
const claudeEnvironment=require('./src/agents/claude-environment.cjs');
const noticeCore=require('./src/generated/updatenotice.core.js').default;

const TOOL_IDS=['pi','claude'];
const DAY_MS=24*60*60*1000;
const OUTPUT_EVENT_MS=150;

function isToolId(id){return TOOL_IDS.includes(id);}

function strictVersion(value){
 const text=String(value||'').trim();
 return updater.semverParse(text)?text.replace(/^v/,''):'';
}

/** Memória do `desk.json` → o que o estado guarda: só versões estritas, e o dia
 *  como inteiro seguro. Qualquer outra coisa vira vazio.
 *  @param {unknown} value @returns {Record<string,{seen:string,ignored:string,remindDay:number}>}
 *  @example sanitizeNotices({pi:{seen:'1.3.0',remindDay:'x'}}) // {pi:{seen:'1.3.0',ignored:'',remindDay:0},claude:{...vazio}} */
function sanitizeNotices(value){
 const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 const out={};
 for(const id of TOOL_IDS){
  const entry=source[id]&&typeof source[id]==='object'?source[id]:{};
  const day=Number(entry.remindDay);
  out[id]={
   seen:strictVersion(entry.seen),
   ignored:strictVersion(entry.ignored),
   remindDay:Number.isSafeInteger(day)&&day>0&&day<2**31?day:0,
  };
 }
 return out;
}

function coreMemory(entry){
 return {$:'Memory',seen:components.verOf(entry.seen),ignored:components.verOf(entry.ignored),remindDay:entry.remindDay>>>0};
}

function versionText(ver){
 return ver&&ver.$==='Ver'?`${ver.major}.${ver.minor}.${ver.patch}`:'';
}

function storedMemory(memory){
 return {seen:versionText(memory.seen),ignored:versionText(memory.ignored),remindDay:memory.remindDay>>>0};
}

/**
 * @param {object} deps tudo entra por parâmetro (o main reatribui `state`).
 * @param {string} deps.runtime pasta do runtime (cache e lock)
 * @param {string} deps.deskDir
 * @param {()=>object} deps.config
 * @param {()=>object} deps.state estado de interface (`desk.json`)
 * @param {()=>void} deps.persist
 * @param {()=>Promise<boolean>} deps.isBusy o tutor está respondendo?
 * @param {()=>boolean} deps.hasBridge há tutor conectado?
 * @param {()=>void} deps.relink derruba a ponte para o renderer religar
 * @param {(channel:string,payload:object)=>void} deps.send evento para o renderer
 * @param {(src:string,line:string)=>void} deps.appendLog
 * @param {string[]=} deps.searchDirs só os testes: onde procurar `brew`/`npm`
 *   (um PATH de fakes; o PATH real nunca entra num teste)
 * @param {boolean=} deps.allowRunInTest só os testes: libera `run` com fakes
 */
function createToolUpdates(deps){
 const {
  runtime,deskDir,config,state,persist,isBusy,hasBridge,relink,send,appendLog,
  testMode=false,env=process.env,home=os.homedir(),now=Date.now,
  run=updater.defaultRun,fetchJson=updater.defaultFetchJson,
  runTool=toolRun.runTool,latestOverride,piPath,claudeLauncher,searchDirs,allowRunInTest=false,
 }=deps;
 const cacheFile=path.join(runtime,'update.json');
 let running=null;

 const toolOpts=extra=>({
  deskDir,config:config(),cacheFile,testMode,fetchJson,run,now:now(),
  latestOverride,piPath,claudeLauncher,home,readOnly:true,...extra,
 });
 const today=()=>Math.floor(now()/DAY_MS);
 const entryOf=id=>sanitizeNotices(state().toolNotices)[id];
 const remember=(id,memory)=>{
  const current=sanitizeNotices(state().toolNotices);
  current[id]=storedMemory(memory);
  state().toolNotices=current;
  persist();
 };

 /** Aviso de uma ferramenta, já decidido pelo núcleo. */
 function noticeOf(fact,entry){
  return noticeCore.noticeOf(
   components.verOf(fact.installed),components.verOf(fact.latest),components.verOf(fact.tested),
   coreMemory(entry),today());
 }

 function summarize(tools){
  const items={};
  const lines=[];
  let dot=false;
  for(const id of TOOL_IDS){
   const fact=tools[id];
   const notice=noticeOf(fact,entryOf(id));
   items[id]={available:notice.available,unreachable:notice.unreachable,showLine:notice.showLine,showDot:notice.showDot,ahead:notice.ahead};
   if(notice.showLine)lines.push({id,name:fact.name,version:fact.latest,ahead:notice.ahead});
   dot=dot||notice.showDot;
  }
  return {lines,dot,items};
 }

 /** Só o que já se sabe (cache): é o que o ponto do ⚙ lê ao abrir a Mesa. */
 async function notices({cacheOnly=true,manual=false}={}){
  const tools=await components.collectTools(toolOpts({cacheOnly,manual}));
  return summarize(tools);
 }

 /** Abrir o Sobre vê as versões disponíveis: o ponto some e só volta com uma
  *  mais nova. As linhas continuam (ver, não é ignorar). */
 async function opened(){
  const tools=await components.collectTools(toolOpts({cacheOnly:true}));
  for(const id of TOOL_IDS){
   const fact=tools[id];
   const next=noticeCore.afterOpen(coreMemory(entryOf(id)),components.verOf(fact.installed),components.verOf(fact.latest));
   remember(id,next);
  }
  return summarize(tools);
 }

 async function answer(id,decide){
  if(!isToolId(id))throw Error(`ferramenta desconhecida: ${JSON.stringify(id)}; esperado ${TOOL_IDS.join(' ou ')}`);
  const tools=await components.collectTools(toolOpts({cacheOnly:true}));
  remember(id,decide(coreMemory(entryOf(id)),tools[id]));
  return summarize(tools);
 }

 const postpone=id=>answer(id,memory=>noticeCore.afterPostpone(memory,today()));
 const ignore=id=>answer(id,(memory,fact)=>noticeCore.afterIgnore(memory,components.verOf(fact.latest)));

 /** Roda a atualização depois da confirmação. Nunca rejeita por falha do
  *  comando: devolve `{ok:false,...}` com a saída; só recusa o que não deveria
  *  ter chegado aqui (id, instalação sem comando, tutor respondendo, outra
  *  atualização em curso). */
 async function runUpdate(id){
  if(!isToolId(id))throw Error(`ferramenta desconhecida: ${JSON.stringify(id)}; esperado ${TOOL_IDS.join(' ou ')}`);
  if(testMode&&!allowRunInTest)throw Error(uiMsg('err.update.testMode'));
  if(running)throw Error(uiMsg('err.update.running'));
  if(await isBusy())throw Error(uiMsg('err.update.tutorBusy'));
  const before=(await components.collectTools(toolOpts({cacheOnly:true})))[id];
  if(before.plan.mode!=='run')throw Error(uiMsg('err.update.noCommand',{id,kind:before.installKind||'—'}));
  const lock=updater.acquireLock(runtime);
  if(!lock.ok)throw Error(uiMsg('err.update.locked',{file:lock.file}));
  running=id;
  try{
   return await execute(id,before);
  }finally{
   running=null;
   updater.releaseLock(lock.file);
  }
 }

 async function execute(id,before){
  const file=toolFacts.executableIn(before.plan.file,env,home,searchDirs);
  if(!file){
   const sentence=noticeCore.doneSentence(before.name,false,components.verOf(before.installed),components.verOf(before.installed),before.installed,before.installed,false);
   return {ok:false,sentence,output:uiMsg('err.tool.notFound',{file:before.plan.file}),relink:false,notices:await notices()};
  }
  appendLog('update',`${id}: rodando ${before.plan.command}`);
  let lastSent=0;
  const result=await runTool({
   file,args:before.plan.args,env:{...updater.workerEnv(env,home),NO_COLOR:'1'},cwd:home,
   onOutput:text=>{
    const at=Date.now();
    if(at-lastSent<OUTPUT_EVENT_MS)return;
    lastSent=at;
    send('tool-run-output',{id,output:text});
   },
  });
  const after=(await components.collectTools(toolOpts({cacheOnly:true})))[id];
  const improved=result.ok&&noticeCore.verNewer(components.verOf(after.installed),components.verOf(before.installed));
  const relinked=!!(improved&&hasBridge());
  if(relinked)relink();
  /* O tutor religa com a versão nova só se ela couber na faixa aceita (#51). */
  const tutorUsesIt=id==='pi'||claudeEnvironment.claudeFit(after.installed||null).accepted;
  const sentence=noticeCore.doneSentence(
   before.name,result.ok,components.verOf(before.installed),components.verOf(after.installed),
   before.installed,after.installed,relinked&&tutorUsesIt);
  appendLog('update',`${id}: ${result.ok?'terminou':'falhou'} (${before.installed||'?'} → ${after.installed||'?'})`);
  return {ok:result.ok,sentence,output:result.output||result.error,relink:relinked,notices:await notices()};
 }

 return {notices,opened,postpone,ignore,run:runUpdate,collectTools:opts=>components.collectTools(toolOpts(opts||{}))};
}

module.exports={TOOL_IDS,sanitizeNotices,createToolUpdates};
