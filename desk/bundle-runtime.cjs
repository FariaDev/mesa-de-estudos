'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');

/* A seleção inclui dependências e peers exigidos, além dos opcionais presentes.
   Preserva a localização de versões aninhadas em vez de achatá-las no bundle. */
function runtimePackages(nodeModules,roots,{externalClaude=false}={}){
 const base=path.resolve(nodeModules);
 const queue=[],seen=new Set(),out=[];
 function locate(name,from){
  if(!/^(@[^/]+\/)?[^/]+$/.test(name)||name.includes('\\')||name.split('/').some(part=>part==='.'||part==='..'))throw Error('Pacote inválido: '+name);
  let dir=from;
  while(true){
   const candidate=path.join(dir,'node_modules',name);
   if(fs.existsSync(path.join(candidate,'package.json')))return candidate;
   const parent=path.dirname(dir);if(parent===dir)break;dir=parent;
  }
  return null;
 }
 function add(name,from,optional=false){
  const source=locate(name,from);
  if(!source){if(optional)return;throw Error('Dependência ausente: '+name+' — rode npm ci antes.');}
  const relative=path.relative(base,source),real=fs.realpathSync(source),realBase=fs.realpathSync(base);
  if(!relative||relative.startsWith('..'+path.sep)||path.isAbsolute(relative)||!real.startsWith(realBase+path.sep))throw Error('Dependência fora de node_modules: '+name);
  if(seen.has(source))return;
  seen.add(source);queue.push({source,relative});
 }
 for(const name of roots)add(name,path.dirname(base));
 while(queue.length){
  const entry=queue.shift();out.push(entry);
  const pkg=JSON.parse(fs.readFileSync(path.join(entry.source,'package.json'),'utf8'));
  for(const name of Object.keys(pkg.dependencies||{}))add(name,entry.source,Object.hasOwn(pkg.optionalDependencies||{},name));
  for(const name of Object.keys(pkg.peerDependencies||{}))add(name,entry.source,pkg.peerDependenciesMeta?.[name]?.optional===true);
  for(const name of Object.keys(pkg.optionalDependencies||{})){
   // A Mesa resolve e valida o Claude original antes de criar uma Query e
   // passa pathToClaudeCodeExecutable. O CLI opcional do SDK é redundante;
   // os peers e os demais opcionais (inclusive codecs do PDF.js) continuam.
   if(externalClaude&&pkg.name==='@anthropic-ai/claude-agent-sdk'&&/^@anthropic-ai\/claude-agent-sdk-(?:darwin-(?:arm64|x64)|linux-(?:arm64|x64)(?:-musl)?|win32-(?:arm64|x64))$/.test(name))continue;
   add(name,entry.source,true);
  }
 }
 return out;
}
function stageBundlePayload(desk,dest){
 const modules=fs.readdirSync(desk).filter(file=>/\.(cjs|mjs)$/.test(file)&&fs.statSync(path.join(desk,file)).isFile()).sort();
 /* `free-models.json` é lido pelo `opencode-host.cjs` ao subir (#44). */
 const files=[...modules,'index.html','ggb.html','style.css','package.json','config.example.json','free-models.json'];
 /* Os catálogos ficam em `src/locales` (#72) e `language-host.cjs` os lê ao subir (#41): `src` já entra no payload. Sem eles o app instalado não abre. */
 const dirs=['src','assets','templates'];
 const packages=runtimePackages(path.join(desk,'node_modules'),['marked','katex','dompurify','pdfjs-dist','@anthropic-ai/claude-agent-sdk'],{externalClaude:true});
 for(const file of files)if(!fs.existsSync(path.join(desk,file)))throw Error('Arquivo ausente: '+file);
 fs.mkdirSync(dest,{recursive:true});
 for(const file of files)fs.copyFileSync(path.join(desk,file),path.join(dest,file));
 for(const dir of dirs){
  if(!fs.existsSync(path.join(desk,dir)))continue;
  fs.rmSync(path.join(dest,dir),{recursive:true,force:true});
  fs.cpSync(path.join(desk,dir),path.join(dest,dir),{recursive:true});
 }
 fs.mkdirSync(path.join(dest,'scripts'),{recursive:true});
 fs.copyFileSync(path.join(desk,'scripts','install-app.mjs'),path.join(dest,'scripts','install-app.mjs'));
 const nm=path.join(dest,'node_modules');fs.rmSync(nm,{recursive:true,force:true});fs.mkdirSync(nm,{recursive:true});
 const managed=[...files,...dirs,'scripts/install-app.mjs'];
 for(const pkg of packages){
  const target=path.join(nm,pkg.relative);fs.mkdirSync(path.dirname(target),{recursive:true});
  // Cada dependência selecionada é copiada por sua própria entrada. Copiar
  // node_modules aqui também reintroduziria opcionais omitidos/aninhados.
  fs.cpSync(pkg.source,target,{recursive:true,dereference:true,filter:source=>source===pkg.source||path.basename(source)!=='node_modules'});
  managed.push(path.join('node_modules',pkg.relative));
 }
 return managed;
}

function setPlistString(app,key,value){
 const plist=path.join(app,'Contents','Info.plist');
 try{
  execFileSync('plutil',['-replace',key,'-string',String(value),plist],{stdio:'pipe'});
 }catch{
  execFileSync('plutil',['-insert',key,'-string',String(value),plist],{stdio:'inherit'});
 }
}
/* Procedência do bundle: o updater dele (modo bundle) atualiza o clone que o
   originou e re-sincroniza — sem isto não há como voltar à fonte. Fora de um
   clone git não há o que registrar. */
function recordInstallSource(root,dest){
 if(!fs.existsSync(path.join(root,'.git')))return;
 let remote='';
 try{remote=execFileSync('git',['-C',root,'remote','get-url','origin'],{encoding:'utf8'}).trim();}catch{}
 fs.writeFileSync(path.join(dest,'install-source.json'),JSON.stringify({path:root,remote},null,2)+'\n');
}
/* Manifesto da instalação (A1/B1, no espírito do modo zip): o que ESTE payload
   considera gerenciado, gravado no disco. Órfão = estava gerenciado e a
   versão nova não tem — sai do bundle; arquivo local (nunca no manifesto)
   fica. Sem isto, código removido ficava para trás e o app morria. */
function writeManifest(dest,managed,version){
 let previous=[];
 try{previous=JSON.parse(fs.readFileSync(path.join(dest,'.update-manifest.json'),'utf8')).files||[];}catch{}
 for(const rel of previous){
  if(managed.includes(rel))continue;
  /* Manifesto é dado do disco: recusa caminho que saia do payload (absoluto,
     `..`) — delete arbitrário por manifesto adulterado não passa. */
  const partes=String(rel).split(/[\\/]/);
  if(typeof rel!=='string'||!rel||partes.some(p=>p===''||p==='..')||path.isAbsolute(String(rel))||/^[a-zA-Z]:/.test(String(rel)))continue;
  fs.rmSync(path.join(dest,...partes),{recursive:true,force:true});
 }
 fs.writeFileSync(path.join(dest,'.update-manifest.json'),JSON.stringify({version,at:new Date().toISOString(),files:managed},null,2)+'\n');
}
/* Auxiliares fora do payload: o helper do Conferir e o ícone. */
function copyBundleHelpers({desk,root,app}){
 const helper=path.join(root,'visual-check','windows');
 if(fs.existsSync(helper)){
  fs.mkdirSync(path.join(app,'Contents','Resources','visual-check'),{recursive:true});
  fs.copyFileSync(helper,path.join(app,'Contents','Resources','visual-check','windows'));
 }
 const icns=path.join(desk,'assets','mesa.icns');
 if(fs.existsSync(icns))fs.copyFileSync(icns,path.join(app,'Contents','Resources','mesa.icns'));
}
/**
 * Monta o `Mesa de Estudos.app` a partir de `desk/`: versão no Info.plist,
 * payload em Contents/Resources/app, procedência, manifesto e auxiliares. É a
 * parte do `npm run install-app` que não toca no sistema (sem assinatura, sem
 * atalho em ~/Applications, sem LaunchServices): o teste do app empacotado
 * (#51) a roda numa cópia temporária do Electron.app.
 * @param {{desk: string, root: string, app: string, version: string}} input
 * @returns {{dest: string, managed: string[]}}
 * @example installBundle({desk, root, app: '/tmp/x/Mesa de Estudos.app', version: '0.5.0'})
 */
function installBundle({desk,root,app,version}){
 if(!fs.existsSync(path.join(app,'Contents','Info.plist')))throw Error(`installBundle: esperava um .app com Contents/Info.plist, recebeu ${JSON.stringify(app)}`);
 setPlistString(app,'CFBundleShortVersionString',version||'0.0.0');
 const dest=path.join(app,'Contents','Resources','app');
 const managed=stageBundlePayload(desk,dest);
 recordInstallSource(root,dest);
 writeManifest(dest,managed,version||'');
 copyBundleHelpers({desk,root,app});
 fs.utimesSync(app,new Date(),new Date());
 return {dest,managed};
}
module.exports={runtimePackages,stageBundlePayload,installBundle};
