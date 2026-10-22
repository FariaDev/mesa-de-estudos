/* Painel "Componentes" do Sobre: versão instalada e estado de Mesa, Pi, Node e
   Xournal++. As decisões de texto/estrutura são do núcleo
   (`core/dialogsview.bend` → `dialogsview.core.js`); aqui são os fatos de host.

   - Mesa: `app.getVersion()` (ou o que o chamador passar) comparado com a
     última release (cache da checagem do updater).
   - Pi: versão do `package.json` do binário resolvido (`desk/pi.cjs` →
     `resolvePi`) ou `pi --version` com timeout. Comparado SÓ com o registry
     `@earendil-works/pi-coding-agent/latest` (o `@mariozechner/...` está
     deprecado e parado em 0.73.1 — sem fallback: sem resposta = "desconhecido",
     sem erro). Pi local (`desk/.pi-local` — e o `desk/node_modules` antigo)
     ganha o botão "Atualizar Pi"; Pi de PATH/global/Homebrew mostra a versão e
     o comando, e o app não mexe.
   - Node: o que o worker/setup usam é o node do SISTEMA — medido com
     `node --version` (o `process.versions.node` do main do Electron é o
     runtime EMBUTIDO e não serve); sem resposta cai no embutido, rotulado
     como tal. Abaixo de 22.19 o painel avisa (o Pi exige `engines >=22.19.0`).
     O corte é decisão do núcleo (`nodeState`).
   - Xournal++: macOS lê `CFBundleShortVersionString`, Windows roda o `.exe
     --version`; a comparação com `xournalpp/xournalpp/releases/latest` é só
     informativa (com link) — o app não atualiza o Xournal++.

   - Claude Code (#45): `claude --version` do launcher do usuário (nunca
     `auth status`); a última vem do registry `@anthropic-ai/claude-code`. Sem
     reserva do SDK desde o #51: fora da faixa aceita, a linha diz a faixa.
     Sem resposta do registry = "não deu para conferir" (offline), nunca erro.
   - Pi e Claude Code carregam também QUEM instalou e o comando exato
     (`tool-facts.cjs`): o Sobre mostra "Atualizar" com confirmação, ou só o
     comando com "Copiar" se a instalação não for reconhecida.

   Cache de 24 h em runtime/update.json (compartilhado com o updater); checagem
   automática 1×/dia cobre Mesa + Pi + Claude Code; Node e Xournal++ só sob
   demanda no painel.
   Somente GETs públicos; zero telemetria. */
const fs=require('node:fs');
const path=require('node:path');
const updater=require('./updater.cjs');
const {resolvePi}=require('./pi.cjs');
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

/* Pi local = instalado pela própria Mesa: `desk/.pi-local` (o contrato novo)
   ou `desk/node_modules` (instalações anteriores ao .pi-local). A comparação
   resolve o realpath DOS DOIS lados: o caminho do binário e o do desk podem
   atravessar links do sistema (ex.: /var/folders → /private/var/...). */
function piLocalRoot(piPath,deskDir){
 if(!piPath||!deskDir)return '';
 let real=piPath;
 try{real=fs.realpathSync(piPath);}catch{}
 let base=deskDir;
 try{base=fs.realpathSync(deskDir);}catch{}
 for(const rel of ['.pi-local','node_modules']){
  const root=path.join(base,rel)+path.sep;
  if(real.startsWith(root))return rel;
  if(piPath.startsWith(path.join(deskDir,rel)+path.sep))return rel;
 }
 return '';
}

function piIsLocal(piPath,deskDir){
 return !!piLocalRoot(piPath,deskDir);
}

function piPackageVersion(piPath){
 let dir;
 try{dir=path.dirname(fs.realpathSync(piPath));}catch{dir=path.dirname(piPath);}
 for(let i=0;i<6;i++){
  const pkg=path.join(dir,'package.json');
  try{
   const data=JSON.parse(fs.readFileSync(pkg,'utf8'));
   if(data&&data.version&&/pi/i.test(String(data.name||'')))return String(data.version);
  }catch{}
  const up=path.dirname(dir);
  if(up===dir)break;
  dir=up;
 }
 return '';
}

/* Versão do Pi: package.json do binário resolvido; sem achá-lo, `pi --version`
   com timeout (não travar o painel num Pi travado). */
async function piVersion({piPath,run=defaultRun}){
 if(!piPath)return '';
 const found=piPackageVersion(piPath);
 if(found)return found;
 try{
  const r=await run(piPath,['--version'],{timeout:5000});
  return parseVersion(r.stdout);
 }catch{return '';}
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
 const fetcher=id==='claude'?updater.claudeLatest:updater.piLatest;
 return fetcher({cacheFile,fetchJson,now,manual,cacheOnly});
}

/* Fatos do Pi e do Claude Code (instalada, mais nova, quem instalou, comando,
   testada). É o que o painel e os avisos leem. `latestOverride` e os
   caminhos injetáveis existem para os testes; sem eles vale o mundo real. */
async function collectTools(opts={}){
 const {
  deskDir='',config={},cacheFile='',manual=false,cacheOnly=false,testMode=false,
  fetchJson=updater.defaultFetchJson,run=defaultRun,now=Date.now(),
  envPath=process.env.LEARNING_DESK_PI||'',piPath:piPathOpt,
  claudeLauncher:launcherOpt,latestOverride,home=os.homedir(),readOnly=false,
 }=opts;
 const fetchNet=testMode?async()=>{throw Error('modo de teste');}:fetchJson;
 const piPath=piPathOpt!==undefined?piPathOpt:resolvePi({configPath:String(config.piPath||''),deskDir,envPath});
 const localRoot=piLocalRoot(piPath,deskDir);
 const launcher=launcherOpt!==undefined?launcherOpt:claudeEnvironment.findClaudeLauncher({configuredPath:config.claudePath,home});
 const latestOpts={override:latestOverride,cacheFile,fetchJson:fetchNet,now,manual,cacheOnly};
 const [piInstalled,piLatest,claudeInstalled,claudeLatest]=await Promise.all([
  /* `readOnly`: os avisos (ao abrir a Mesa e depois de cada comando) leem o
     package.json do Pi e NÃO o executam (`pi --version` carrega extensões). */
  piPath?(readOnly?piPackageVersion(piPath):piVersion({piPath,run})):'',
  latestFor('pi',latestOpts),
  toolFacts.claudeInstalledVersion({launcher,run}),
  latestFor('claude',latestOpts),
 ]);
 const install=toolFacts.piInstall({piPath,localRoot});
 const piPlan=toolFacts.updatePlan({id:'pi',install,claudeLauncher:''});
 const claudePlan=toolFacts.updatePlan({id:'claude',install:{kind:'',formula:''},claudeLauncher:launcher});
 const fact=(id,name,installed,latest,plan,extra)=>({
  id,name,installed:String(installed||''),latest:String(latest.version||''),latestKnown:!!latest.known,
  plan,tested:String(TESTED_VERSIONS[id]||''),...extra,
 });
 return {
  pi:fact('pi','Pi',piInstalled,piLatest,piPlan,{path:piPath,installKind:install.kind,localRoot}),
  claude:fact('claude','Claude Code',claudeInstalled,claudeLatest,claudePlan,{path:launcher,installKind:launcher?'claude':'',localRoot:''}),
  piPath,piLocal:!!localRoot,
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

/* Linhas na ordem do núcleo (`componentIds`): pi, claude, node, xournal (a Mesa fica fora da lista). */
async function collect(opts={}){
 const {
  config={},cacheFile='',version='',manual=false,testMode=false,
  fetchJson=updater.defaultFetchJson,run=defaultRun,now=Date.now(),
  platform=process.platform,nodeVersion,nodeSource,
 }=opts;
 const fetchNet=testMode?async()=>{throw Error('modo de teste');}:fetchJson;
 const cache=cacheFile?updater.readCache(cacheFile):{};
 const byId={};
 /* `piPath` e companhia são injeção de teste: sem eles, o mundo real. */
 const tools=await collectTools(opts);
 const {piPath,piLocal}=tools;
 const localRoot=tools.pi.localRoot;

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

 /* Pi: só o registry @earendil-works; o local vira o botão de sempre, os demais
    instaladores viram "Atualizar" com o comando exato (ou só o comando). */
 {
  const fact=tools.pi;
  const state=rowState({version:fact.installed},{latest:fact.latest,offline:true});
  const outdated=state.$==='CompOutdated';
  const localHint=localRoot==='node_modules'
   ?message('component.hint.piNodeModules')
   :message('component.hint.piLocal');
  const hints={
   '':message('component.hint.piMissing'),
   local:localHint,
   brew:message('component.hint.piBrew'),
   npm:message('component.hint.piNpm'),
   unknown:outdated?message('component.hint.piUnknownOutdated'):message('component.hint.piUnknown'),
  };
  byId.pi={
   id:'pi',label:'Pi',version:fact.installed,
   state:stateCode(state),latest:fact.latest,note:'',
   hint:hints[fact.installKind]??'',link:'',linkLabel:'',
   canUpdate:piLocal&&outdated,
   ...toolRowExtras(fact,outdated),
  };
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
    22.19 é do núcleo (o Pi exige engines >=22.19.0). */
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
 return {rows,piPath,piLocal};
}

module.exports={piIsLocal,piLocalRoot,piPackageVersion,piVersion,systemNodeVersion,xournalVersion,collectTools,aheadOf,verOf,collect};
