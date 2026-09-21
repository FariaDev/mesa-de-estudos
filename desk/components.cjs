/* Painel "Componentes" do Sobre: versão instalada e estado de Mesa, Pi, Node e
   Xournal++. As decisões de texto/estrutura são do núcleo
   (`core/dialogsview.bend` → `dialogsview.core.js`); aqui são os fatos de host.

   - Mesa: `app.getVersion()` (ou o que o chamador passar) comparado com a
     última release (cache da checagem do updater).
   - Pi: versão do `package.json` do binário resolvido (`desk/pi.cjs` →
     `resolvePi`) ou `pi --version` com timeout. Comparado SÓ com o registry
     `@earendil-works/pi-coding-agent/latest` (o `@mariozechner/...` está
     deprecado e parado em 0.73.1 — sem fallback: sem resposta = "desconhecido",
     sem erro). Pi local (desk/node_modules) ganha o botão "Atualizar Pi"; Pi de
     PATH/global/Homebrew mostra a versão e o comando, e o app não mexe.
   - Node: `process.versions.node`; abaixo de 22.19 o painel avisa (o Pi exige
     `engines >=22.19.0`). O corte é decisão do núcleo (`nodeState`).
   - Xournal++: macOS lê `CFBundleShortVersionString`, Windows roda o `.exe
     --version`; a comparação com `xournalpp/xournalpp/releases/latest` é só
     informativa (com link) — o app não atualiza o Xournal++.

   Cache de 24 h em runtime/update.json (compartilhado com o updater); checagem
   automática 1×/dia cobre Mesa + Pi; Node e Xournal++ só sob demanda no painel.
   Somente GETs públicos; zero telemetria. */
const fs=require('node:fs');
const path=require('node:path');
const updater=require('./updater.cjs');
const {resolvePi}=require('./pi.cjs');
const dialogsCore=require('./src/generated/dialogsview.core.js').default;

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

/* Pi local = binário dentro de desk/node_modules (só ele é atualizável pela Mesa). */
function piIsLocal(piPath,deskDir){
 if(!piPath||!deskDir)return false;
 let real=piPath;
 try{real=fs.realpathSync(piPath);}catch{}
 const root=path.join(deskDir,'node_modules')+path.sep;
 return real.startsWith(root)||piPath.startsWith(root);
}

function piPackageVersion(piPath){
 let dir='';
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

function rowState(entry,{latest=''}={}){
 /* Sem resposta do registry a Mesa não adivinha: "desconhecido", nunca ✓. */
 if(!entry||!latest)return {$:'CompUnknown'};
 if(updater.isNewer(latest,entry.version))return {$:'CompOutdated',latest};
 return {$:'CompOk'};
}

/* Linhas na ordem do núcleo (`componentIds`): mesa, pi, node, xournal. */
async function collect(opts={}){
 const {
  deskDir='',config={},cacheFile='',version='',manual=false,testMode=false,
  fetchJson=updater.defaultFetchJson,run=defaultRun,now=Date.now(),
  platform=process.platform,nodeVersion=process.versions.node,envPath=process.env.LEARNING_DESK_PI||'',
  piPath:piPathOpt,
 }=opts;
 const fetchNet=testMode?async()=>{throw Error('modo de teste');}:fetchJson;
 const cache=cacheFile?updater.readCache(cacheFile):{};
 const byId={};
 /* `piPath` é injeção de teste: sem ele, o binário é o resolvido de verdade. */
 const piPath=piPathOpt!==undefined?piPathOpt:resolvePi({configPath:String(config.piPath||''),deskDir,envPath});
 const piLocal=piIsLocal(piPath,deskDir);

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

 /* Pi: só o registry @earendil-works; local vira botão, de PATH vira dica. */
 {
  const pi=piPath;
  const local=piLocal;
  const installed=pi?await piVersion({piPath:pi,run}):'';
  const latest=await updater.piLatest({cacheFile,fetchJson:fetchNet,now,manual});
  const state=!pi||!installed?{$:'CompUnknown'}
   :rowState({version:installed},{latest:latest.version});
  byId.pi={
   id:'pi',label:'Pi',version:installed,
   state:state.$==='CompOutdated'?'outdated':state.$==='CompOk'?'ok':'unknown',
   latest:latest.version,note:'',
   hint:!pi?'Não encontrado — rode npm run setup.':local?'Em desk/node_modules (atualizável pela Mesa).':'Fora de desk/node_modules — atualize no terminal: npm install -g @earendil-works/pi-coding-agent@latest',
   link:'',linkLabel:'',
   canUpdate:local&&state.$==='CompOutdated',
  };
 }

 /* Node: o corte 22.19 é do núcleo (o Pi exige engines >=22.19.0). */
 {
  const [major,minor]=String(nodeVersion||'').split('.').map(n=>Number(n)||0);
  const state=dialogsCore.nodeState(major,minor);
  byId.node={
   id:'node',label:'Node',version:String(nodeVersion||''),
   state:state.$==='CompWarn'?'warn':'ok',
   latest:'',note:state.$==='CompWarn'?String(state.note||''):'',
   hint:'',link:'',linkLabel:'',canUpdate:false,
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
   hint:target?'Fora da Mesa: atualize pelo site oficial.':'Não configurado (Mesa → Configurações).',
   link:updater.XOURNAL_SITE_URL,linkLabel:'Ver página',canUpdate:false,
  };
 }

 const rows=coreListToArray(dialogsCore.componentIds()).map(id=>byId[id]).filter(Boolean);
 return {rows,piPath,piLocal};
}

module.exports={piIsLocal,piPackageVersion,piVersion,xournalVersion,collect};
