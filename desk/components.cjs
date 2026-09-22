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
  platform=process.platform,nodeVersion,nodeSource,envPath=process.env.LEARNING_DESK_PI||'',
  piPath:piPathOpt,
 }=opts;
 const fetchNet=testMode?async()=>{throw Error('modo de teste');}:fetchJson;
 const cache=cacheFile?updater.readCache(cacheFile):{};
 const byId={};
 /* `piPath` é injeção de teste: sem ele, o binário é o resolvido de verdade. */
 const piPath=piPathOpt!==undefined?piPathOpt:resolvePi({configPath:String(config.piPath||''),deskDir,envPath});
 const localRoot=piLocalRoot(piPath,deskDir);
 const piLocal=!!localRoot;

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
  const localHint=localRoot==='node_modules'
   ?'Em desk/node_modules (atualizável pela Mesa; vai para desk/.pi-local na próxima).'
   :'Em desk/.pi-local (atualizável pela Mesa).';
  byId.pi={
   id:'pi',label:'Pi',version:installed,
   state:state.$==='CompOutdated'?'outdated':state.$==='CompOk'?'ok':'unknown',
   latest:latest.version,note:'',
   hint:!pi?'Não encontrado — rode npm run setup.':local?localHint:'Fora da pasta da Mesa — atualize no terminal: npm install -g @earendil-works/pi-coding-agent@latest',
   link:'',linkLabel:'',
   canUpdate:local&&state.$==='CompOutdated',
  };
 }

 /* Node: B3 — mede o node do SISTEMA (o que o worker/setup usam); o corte
    22.19 é do núcleo (o Pi exige engines >=22.19.0). */
 {
  const info=nodeVersion===undefined?await systemNodeVersion({run}):{version:String(nodeVersion||''),source:nodeSource||'system'};
  const [major,minor]=String(info.version||'').split('.').map(n=>Number(n)||0);
  const state=!info.version?{$:'CompUnknown'}:dialogsCore.nodeState(major,minor);
  byId.node={
   id:'node',label:info.source==='system'?'Node (sistema)':'Node (embutido)',version:String(info.version||''),
   state:state.$==='CompWarn'?'warn':state.$==='CompOk'?'ok':'unknown',
   latest:'',note:state.$==='CompWarn'?String(state.note||''):'',
   hint:info.source==='system'?'':'não achamos o node do sistema; este número é o runtime embutido do Electron',
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
   hint:target?'Fora da Mesa: atualize pelo site oficial.':'Não configurado (Mesa → Configurações).',
   link:updater.XOURNAL_SITE_URL,linkLabel:'Ver página',canUpdate:false,
  };
 }

 const rows=coreListToArray(dialogsCore.componentIds()).map(id=>byId[id]).filter(Boolean);
 return {rows,piPath,piLocal};
}

module.exports={piIsLocal,piLocalRoot,piPackageVersion,piVersion,systemNodeVersion,xournalVersion,collect};
