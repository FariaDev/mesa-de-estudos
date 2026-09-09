const fs=require('node:fs');const path=require('node:path');
const {pathToFileURL}=require('node:url');

const FALLBACK_LEVELS=['off','minimal','low','medium','high'];
const BIN_NAMES=process.platform==='win32'?['pi.cmd','pi.exe','pi']:['pi'];

function existingFile(p){
 try{return p&&fs.existsSync(p)&&fs.statSync(p).isFile()?p:'';}catch{return '';}
}

function whichOnPath(name){
 for(const dir of (process.env.PATH||'').split(path.delimiter)){
  const hit=existingFile(path.join(dir,name));
  if(hit)return hit;
 }
 return '';
}

function resolvePi({configPath='',deskDir='',envPath=''}={}){
 const files=[envPath,configPath].filter(Boolean);
 const dirs=[];
 if(deskDir)dirs.push(path.join(deskDir,'node_modules','.bin'));
 for(const p of files){const hit=existingFile(p);if(hit)return hit;}
 for(const dir of dirs){
  for(const name of BIN_NAMES){const hit=existingFile(path.join(dir,name));if(hit)return hit;}
 }
 for(const name of BIN_NAMES){const hit=whichOnPath(name);if(hit)return hit;}
 for(const p of ['/opt/homebrew/bin/pi','/usr/local/bin/pi']){const hit=existingFile(p);if(hit)return hit;}
 return '';
}

function spawnEnv(piPath){
 const dir=piPath?path.dirname(piPath):'';
 const parts=[dir,process.env.PATH||''].filter(Boolean);
 return {...process.env,PATH:parts.join(path.delimiter),PI_LEARNING_NO_OBSIDIAN:'1'};
}

function missingPiMessage(err){
 const msg=err?.message||String(err||'');
 if(!err||err.code==='ENOENT'||/ENOENT|not found|não encontrado/i.test(msg)){
  return 'Pi não encontrado. Rode npm run setup ou indique o caminho em Configurações.';
 }
 return msg;
}

function modelsCandidates(piPath,deskDir){
 const out=[];
 const add=p=>{if(p&&!out.includes(p))out.push(p);};
 const pkgs=['@earendil-works/pi-coding-agent','@mariozechner/pi-coding-agent'];
 const ais=['@earendil-works/pi-ai','@mariozechner/pi-ai'];
 const roots=[];
 if(piPath){
  try{roots.push(path.dirname(fs.realpathSync(piPath)));}catch{roots.push(path.dirname(piPath));}
  roots.push(path.dirname(piPath));
 }
 if(deskDir)roots.push(path.join(deskDir,'node_modules'));
 roots.push('/opt/homebrew/lib/node_modules','/usr/local/lib/node_modules');
 for(const root of roots){
  for(const pkg of pkgs)for(const ai of ais){
   add(path.join(root,pkg,'node_modules',ai,'dist','models.js'));
   add(path.join(root,'..',pkg,'node_modules',ai,'dist','models.js'));
   add(path.join(root,'..','..',pkg,'node_modules',ai,'dist','models.js'));
  }
  add(path.join(root,'..','lib','node_modules','@earendil-works','pi-coding-agent','node_modules','@earendil-works','pi-ai','dist','models.js'));
 }
 return out;
}

async function loadLevelsModule(piPath,deskDir){
 for(const file of modelsCandidates(piPath,deskDir)){
  if(!existingFile(file))continue;
  try{return await import(pathToFileURL(file).href);}catch{}
 }
 return null;
}

module.exports={FALLBACK_LEVELS,resolvePi,spawnEnv,missingPiMessage,modelsCandidates,loadLevelsModule};
