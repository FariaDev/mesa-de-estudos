const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {discoverCourses}=require('./courses.cjs');

const HOME_VAULT=path.join(os.homedir(),'Documents','Obsidian Vault');

function emptyConfig(){return {vaultPath:'',runtimePath:'',piPath:'',xournalPath:'',courses:[]};}

function normalize(raw={}){
 const courses=Array.isArray(raw.courses)?raw.courses.filter(c=>c&&(c.path||c.id)).map(c=>({
  id:String(c.id||path.basename(c.path||'')).trim(),
  name:String(c.name||c.id||'').trim(),
  path:String(c.path||'').trim()
 })).filter(c=>c.id&&c.path):[];
 return {
  vaultPath:String(raw.vaultPath||''),
  runtimePath:String(raw.runtimePath||''),
  piPath:String(raw.piPath||''),
  xournalPath:String(raw.xournalPath||''),
  courses
 };
}

function readConfig(file){
 try{return normalize(JSON.parse(fs.readFileSync(file,'utf8')));}catch{return null;}
}

function writeConfig(file,config){
 fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,JSON.stringify(normalize(config),null,2)+'\n');
}

function homeVaultExists(){return fs.existsSync(path.join(HOME_VAULT,'Courses'));}

function seedConfig({runtimePath}={}){
 const vaultPath=homeVaultExists()?HOME_VAULT:'';
 return normalize({
  vaultPath,
  runtimePath:runtimePath||(vaultPath?path.join(vaultPath,'Code','learning-canvas','desk','.runtime'):''),
  piPath:'',
  xournalPath:process.platform==='darwin'&&fs.existsSync('/Applications/Xournal++.app')?'/Applications/Xournal++.app':'',
  courses:vaultPath?discoverCourses(vaultPath).map(c=>({id:c.id,name:c.name,path:c.path})):[]
 });
}

function needsSetup(config,courses){
 return !((config?.vaultPath&&fs.existsSync(config.vaultPath))||(courses&&courses.length));
}

module.exports={HOME_VAULT,emptyConfig,normalize,readConfig,writeConfig,homeVaultExists,seedConfig,needsSetup};
