/* Painel "Componentes" do Sobre: versão instalada e estado de Claude Code,
   Node e Xournal++. As decisões de texto/estrutura são do núcleo
   (`core/dialogsview.bend` → `dialogsview.core.js`); aqui são os fatos de host.

   - Mesa: `app.getVersion()` (ou o que o chamador passar) comparado com a
     última release (cache da checagem do updater).
   - Claude Code (#45): `claude --version` do launcher do usuário (nunca
     `auth status`); a última vem do registry `@anthropic-ai/claude-code`. Sem
     reserva do SDK desde o #51: fora da faixa aceita, a linha diz a faixa.
     Sem resposta do registry = "não deu para conferir" (offline), nunca erro.
   - Node: o que o worker/setup usam é o node do SISTEMA — medido com
     `node --version` (o `process.versions.node` do main do Electron é o
     runtime EMBUTIDO e não serve); sem resposta cai no embutido, rotulado
     como tal. Abaixo de 22.19 o painel avisa. O corte é decisão do núcleo
     (`nodeState`).
   - Xournal++: macOS lê `CFBundleShortVersionString`, Windows roda o `.exe
     --version`; a comparação com `xournalpp/xournalpp/releases/latest` é só
     informativa (com link) — o app não atualiza o Xournal++.

   Cache de 24 h em runtime/update.json (compartilhado com o updater); checagem
   automática 1×/dia cobre Mesa + Claude Code; Node e Xournal++ só sob demanda
   no painel. Somente GETs públicos; zero telemetria. */
const fs=require('node:fs');
const path=require('node:path');
const updater=require('./updater.cjs');
const os=require('node:os');
const toolFacts=require('./tool-facts.cjs');
const claudeEnvironment=require('./src/agents/claude-environment.cjs');
const noticeCore=require('./src/generated/updatenotice.core.js').default;
const TESTED_VERSIONS=require('./src/tested-versions.json');
const dialogsCore=require('./src/generated/dialogsview.core.js').default;
const {message}=require('./src/i18n.mjs');

function coreListToArray(node){
 const out=[];
 for(let current=node;current&&current.$==='Con';current=current.tail)out.push(current.head);
 return out;
}

function defaultRun(cmd,args=[],opts={}){
 return updater.defaultRun(cmd,args,opts);
}

function parseVersion(text){
 const m=/(\d+\.\d+(?:\.\d+)?)/.exec(String(text||''));
 return m?m[1]:'';
}

/* B3: o Node que interessa é o do SISTEMA (o que o worker/setup e o npm usam).
   `process.versions.node` no main do Electron é o runtime EMBUTIDO; medir de
   verdade com `node --version`. Sem resposta = embutido, rotulado como tal. */
async function systemNodeVersion({run=defaultRun,timeout=5000}={}){
 try{
  const r=await run('node',['--version'],{timeout});
  const version=parseVersion(r.stdout);
  if(version)return {version,source:'system'};
 }catch{}
 return {version:String(process.versions.node||''),source:'embedded'};
}

/* Xournal++: .app no macOS (plist), .exe no Windows (--version). */
async function xournalVersion({target,platform=process.platform,run=defaultRun}){
 if(!target)return '';
 try{
  if(platform==='darwin'){
   const app=target.endsWith('.app')?target:target+'.app';
   const plist=path.join(app,'Contents','Info.plist');
   if(!fs.existsSync(plist))return '';
   try{
    const r=await run('/usr/libexec/PlistBuddy',['-c','Print :CFBundleShortVersionString',plist],{timeout:5000});
    return parseVersion(r.stdout);
   }catch{
    const r=await run('plutil',['-extract','CFBundleShortVersionString','raw','-o','-',plist],{timeout:5000});
    return parseVersion(r.stdout);
   }
  }
  if(!fs.existsSync(target))return '';
  const r=await run(target,['--version'],{timeout:8000});
  return parseVersion(r.stdout);
 }catch{return '';}
}

function rowState(entry,{latest='',offline=false}={}){
 /* Sem resposta do registry a Mesa não adivinha, nunca ✓: com a versão
    instalada conhecida isso é "não deu para conferir" (offline, não é erro);
    sem ela, "desconhecido". */
 if(!entry||!entry.version)return {$:'CompUnknown'};
 if(!latest)return offline?{$:'CompOffline'}:{$:'CompUnknown'};
 if(updater.isNewer(latest,entry.version))return {$:'CompOutdated',latest};
 return {$:'CompOk'};
}

/* Versão do texto → registro `Ver` do núcleo (estrita: só X.Y.Z). */
const verOf=claudeEnvironment.versionRecord;

/* A versão em jogo (a oferecida, ou a instalada em dia) passa da testada com
   esta Mesa? É a mesma conta do núcleo, sem memória. */
function aheadOf({installed,latest,tested}){
 return noticeCore.noticeOf(verOf(installed),verOf(latest),verOf(tested),noticeCore.emptyMemory(),0).ahead;
}

function latestFor(id,{override,cacheFile,fetchJson,now,manual,cacheOnly}){
 if(override&&typeof override[id]==='string'){
  return {version:override[id],known:!!override[id]};
 }
 const fetcher=id==='claude'?updater.claudeLatest:null;
 if(!fetcher)return {version:'',known:false};
 return fetcher({cacheFile,fetchJson,now,manual,cacheOnly});
}

/* Fatos do Claude Code (instalada, mais nova, quem instalou, comando, testada).
   É o que o painel e os avisos leem. `latestOverride` e os caminhos injetáveis
   existem para os testes; sem eles vale o mundo real. */
async function collectTools(opts={}){
 const {
  config={},cacheFile='',manual=false,cacheOnly=false,testMode=false,
  fetchJson=updater.defaultFetchJson,run=defaultRun,now=Date.now(),
  claudeLauncher:launcherOpt,latestOverride,home=os.homedir(),
 }=opts;
 const fetchNet=testMode?async()=>{throw Error('modo de teste');}:fetchJson;
 const launcher=launcherOpt!==undefined?launcherOpt:claudeEnvironment.findClaudeLauncher({configuredPath:config.claudePath,home});
 const latestOpts={override:latestOverride,cacheFile,fetchJson:fetchNet,now,manual,cacheOnly};
 const [claudeInstalled,claudeLatest]=await Promise.all([
  toolFacts.claudeInstalledVersion({launcher,run}),
  latestFor('claude',latestOpts),
 ]);
 const claudePlan=toolFacts.updatePlan({id:'claude',install:{kind:'',formula:''},claudeLauncher:launcher});
 const fact=(id,name,installed,latest,plan,extra)=>({
  id,name,installed:String(installed||''),latest:String(latest.version||''),latestKnown:!!latest.known,
  plan,tested:String(TESTED_VERSIONS[id]||''),...extra,
 });
 return {
  claude:fact('claude','Claude Code',claudeInstalled,claudeLatest,claudePlan,{path:launcher,installKind:launcher?'claude':'',localRoot:''}),
 };
}

function stateCode(state){
 return state.$==='CompOutdated'?'outdated':state.$==='CompOk'?'ok':state.$==='CompWarn'?'warn':state.$==='CompOffline'?'offline':'unknown';
}

/* O que o painel precisa para a ação da linha: quem instalou, o comando exato
   (rodar/copiar), a versão testada e o aviso de "mais nova que a testada". */
function toolRowExtras(fact,outdated){
 const target=outdated?fact.latest:fact.installed;
 const ahead=!!target&&aheadOf({installed:fact.installed,latest:fact.latest,tested:fact.tested});
 return {
  install:fact.installKind,
  command:fact.plan.mode==='run'||fact.plan.mode==='copy'?fact.plan.command:'',
  copyOnly:fact.plan.mode==='copy',
  tested:fact.tested,
  ahead,
  warning:ahead?noticeCore.aheadWarning(target,fact.tested):'',
 };
}

/* Linhas na ordem do núcleo (`componentIds`): claude, node, xournal (a Mesa fica fora da lista). */
async function collect(opts={}){
 const {
  config={},cacheFile='',version='',manual=false,testMode=false,
  fetchJson=updater.defaultFetchJson,run=defaultRun,now=Date.now(),
  platform=process.platform,nodeVersion,nodeSource,
 }=opts;
 const fetchNet=testMode?async()=>{throw Error('modo de teste');}:fetchJson;
 const cache=cacheFile?updater.readCache(cacheFile):{};
 const byId={};
 const tools=await collectTools(opts);

 /* Mesa: a checagem do updater (cache 24 h) é a única fonte da última release. */
 {
  const release=cache.release;
  const state=release
   ? rowState({version}, {latest:String(release.version||'')})
   : {$:'CompUnknown'};
  byId.mesa={id:'mesa',label:'Mesa',version:String(version||''),
   state:state.$==='CompOutdated'?'outdated':state.$==='CompOk'?'ok':'unknown',
   latest:String(release&&release.version||''),note:'',hint:'',link:'',linkLabel:'',canUpdate:false};
 }

 /* Claude Code: o launcher do usuário (`claude --version`), o único que a Mesa
    usa (#51). Fora da faixa aceita, a linha diz a mesma frase da coluna do tutor. */
 {
  const fact=tools.claude;
  const state=rowState({version:fact.installed},{latest:fact.latest,offline:true});
  const outdated=state.$==='CompOutdated';
  const fit=fact.installed?claudeEnvironment.claudeFit(fact.installed):null;
  byId.claude={
   id:'claude',label:'Claude Code',version:fact.installed,
   state:stateCode(state),latest:fact.latest,note:'',
   hint:fact.path?(fit&&!fit.accepted?fit.notice:''):message('component.hint.claudeMissing'),
   link:'',linkLabel:'',canUpdate:false,
   ...toolRowExtras(fact,outdated),
  };
 }

 /* Node: B3 — mede o node do SISTEMA (o que o worker/setup usam); o corte
    22.19 é do núcleo. */
 {
  const info=nodeVersion===undefined?await systemNodeVersion({run}):{version:String(nodeVersion||''),source:nodeSource||'system'};
  const [major,minor]=String(info.version||'').split('.').map(n=>Number(n)||0);
  const state=!info.version?{$:'CompUnknown'}:dialogsCore.nodeState(major,minor);
  byId.node={
   id:'node',label:info.source==='system'?message('component.node.system'):message('component.node.embedded'),version:String(info.version||''),
   state:state.$==='CompWarn'?'warn':state.$==='CompOk'?'ok':'unknown',
   latest:'',note:state.$==='CompWarn'?String(state.note||''):'',
   hint:info.source==='system'?'':message('component.hint.nodeEmbedded'),
   link:'',linkLabel:'',canUpdate:false,
  };
 }

 /* Xournal++: informativo — última release só sob demanda; link oficial sempre. */
 {
  const target=String(config.xournalPath||'')||(platform==='darwin'?'/Applications/Xournal++.app':'');
  const installed=await xournalVersion({target,platform,run});
  const latest=manual?await updater.xournalLatest({cacheFile,fetchJson:fetchNet,now,manual}):{version:(cache.xournal&&cache.xournal.version)||'',known:!!(cache.xournal&&cache.xournal.version)};
  const state=target&&installed?rowState({version:installed},{latest:latest.version}):{$:'CompUnknown'};
  byId.xournal={
   id:'xournal',label:'Xournal++',version:installed,
   state:state.$==='CompOutdated'?'outdated':state.$==='CompOk'?'ok':'unknown',
   latest:latest.version,note:'',
   hint:target?'':message('component.hint.xournalUnset'),
   link:updater.XOURNAL_SITE_URL,linkLabel:message('component.openSite'),canUpdate:false,
  };
 }

 const rows=coreListToArray(dialogsCore.componentIds()).map(id=>byId[id]).filter(Boolean);
 return {rows};
}

module.exports={systemNodeVersion,xournalVersion,collectTools,aheadOf,verOf,collect};
