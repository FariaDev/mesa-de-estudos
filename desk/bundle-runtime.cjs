'use strict';
const fs=require('node:fs');
const path=require('node:path');

/* A seleção inclui dependências e peers exigidos, além dos opcionais presentes.
   Preserva a localização de versões aninhadas em vez de achatá-las no bundle. */
function runtimePackages(nodeModules,roots){
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
  for(const name of Object.keys(pkg.optionalDependencies||{}))add(name,entry.source,true);
 }
 return out;
}
function stageBundlePayload(desk,dest){
 const modules=fs.readdirSync(desk).filter(file=>/\.(cjs|mjs)$/.test(file)&&fs.statSync(path.join(desk,file)).isFile()).sort();
 const files=[...modules,'index.html','ggb.html','style.css','package.json','config.example.json'];
 const dirs=['src','assets','templates'];
 const packages=runtimePackages(path.join(desk,'node_modules'),['marked','katex','dompurify','pdfjs-dist','@anthropic-ai/claude-agent-sdk']);
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
  fs.cpSync(pkg.source,target,{recursive:true,dereference:true});
  managed.push(path.join('node_modules',pkg.relative));
 }
 return managed;
}
module.exports={runtimePackages,stageBundlePayload};
