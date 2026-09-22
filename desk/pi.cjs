const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
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
 if(deskDir){
  /* A2: o Pi local da Mesa mora em `desk/.pi-local` (package.json próprio,
     fora da árvore npm da Mesa) e vence os demais candidatos automáticos —
     é o que a Mesa instala e atualiza. `desk/node_modules` segue como
     candidato (instalações antigas) e o PATH/global não muda. */
  dirs.push(path.join(deskDir,'.pi-local','node_modules','.bin'));
  dirs.push(path.join(deskDir,'node_modules','.bin'));
 }
 for(const p of files){const hit=existingFile(p);if(hit)return hit;}
 for(const dir of dirs){
  for(const name of BIN_NAMES){const hit=existingFile(path.join(dir,name));if(hit)return hit;}
 }
 for(const name of BIN_NAMES){const hit=whichOnPath(name);if(hit)return hit;}
 for(const p of ['/opt/homebrew/bin/pi','/usr/local/bin/pi']){const hit=existingFile(p);if(hit)return hit;}
 return '';
}

/* PATH: um app aberto pelo Finder nasce com o mínimo do sistema
   (/usr/bin:/bin:/usr/sbin:/sbin), então o que o usuário instalou em casa — bun,
   homebrew, pipx — some do ambiente. O Pi, as skills dele e os servidores MCP
   falham com "no such file or directory" sem que nada esteja errado no pacote.
   Os diretórios do usuário entram antes do PATH herdado, e só os que existem. */
const USER_BIN_DIRS=['.bun/bin','.local/bin','.cargo/bin','.deno/bin'];

function userBinDirs(home=os.homedir()){
 const dirs=USER_BIN_DIRS.map(rel=>path.join(home,...rel.split('/')));
 dirs.push('/opt/homebrew/bin','/usr/local/bin');
 return dirs.filter(dir=>{try{return fs.existsSync(dir);}catch{return false;}});
}

function spawnEnv(piPath){
 const dir=piPath?path.dirname(piPath):'';
 const parts=[dir,...userBinDirs(),process.env.PATH||''].filter(Boolean);
 // A mesa não abre o Obsidian nem usa observational-memory: o contexto do estudo
 // fica só com a conversa; o daily driver do terminal não é afetado.
 return {...process.env,PATH:parts.join(path.delimiter),PI_LEARNING_NO_OBSIDIAN:'1',PI_OM_PASSIVE:'1'};
}

function missingPiMessage(err){
 const msg=err?.message||String(err||'');
 if(!err||err.code==='ENOENT'||/ENOENT|not found|não encontrado/i.test(msg)){
  return 'Pi não encontrado. Rode npm run setup ou indique o caminho em Configurações.';
 }
 return msg;
}

/* ---------- Pi local (A2) ---------- */

/* O Pi instalado pela Mesa mora em `desk/.pi-local`, com package.json PRÓPRIO
   e FORA da árvore npm da Mesa: o npm da pasta do Pi não toca o package.json/
   package-lock.json versionados do desk — o update por git/zip deixa de
   esbarrar em "trabalho local" que o setup inventava. */
function piLocalHome(deskDir){
 return deskDir?path.join(deskDir,'.pi-local'):'';
}

function ensurePiLocalHome(deskDir){
 const home=piLocalHome(deskDir);
 if(!home)return '';
 fs.mkdirSync(home,{recursive:true});
 if(!fs.existsSync(path.join(home,'package.json'))){
  fs.writeFileSync(path.join(home,'package.json'),JSON.stringify({
   name:'mesa-pi-local',
   version:'1.0.0',
   private:true,
   description:'Pi local da Mesa de Estudos — fora da árvore npm do desk',
  },null,2)+'\n');
 }
 return home;
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
 if(deskDir){
  roots.push(path.join(deskDir,'.pi-local','node_modules'));
  roots.push(path.join(deskDir,'node_modules'));
 }
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

module.exports={FALLBACK_LEVELS,USER_BIN_DIRS,resolvePi,spawnEnv,userBinDirs,missingPiMessage,modelsCandidates,loadLevelsModule,piLocalHome,ensurePiLocalHome};
