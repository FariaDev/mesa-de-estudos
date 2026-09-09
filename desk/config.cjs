const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {discoverCourses}=require('./courses.cjs');

const HOME_VAULT=path.join(os.homedir(),'Documents','Obsidian Vault');

function defaultDesk(){
 return {
  title:'Mesa de Estudos',
  calculator:true,
  xournal:true,
  conferir:true,
  panels:[
   {label:'Enunciado',prefer:['Limites']},
   {label:'Formulário & apoio',prefer:['Formul'],toggle:'Formulário'}
  ]
 };
}

function asStringList(value){
 if(!Array.isArray(value))return [];
 return value.map(v=>String(v||'').trim()).filter(Boolean);
}

function normalizePanel(raw,fallback,index){
 const base=fallback||{label:`PDF ${index+1}`,prefer:[],toggle:''};
 return {
  label:String(raw?.label||base.label).trim()||base.label,
  prefer:asStringList(raw?.prefer).length?asStringList(raw.prefer):[...base.prefer],
  toggle:String(raw?.toggle||base.toggle||'').trim()
 };
}

function normalizeDesk(raw){
 const fallback=defaultDesk();
 if(!raw||typeof raw!=='object')return fallback;
 const panels=Array.isArray(raw.panels)&&raw.panels.length
  ?raw.panels.slice(0,2).map((p,i)=>normalizePanel(p,fallback.panels[i],i))
  :fallback.panels;
 return {
  title:String(raw.title||fallback.title).trim()||fallback.title,
  calculator:raw.calculator!==false,
  xournal:raw.xournal!==false,
  conferir:raw.conferir!==false,
  panels
 };
}

function emptyConfig(){return {vaultPath:'',runtimePath:'',piPath:'',xournalPath:'',courses:[],desk:defaultDesk()};}

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
  courses,
  desk:normalizeDesk(raw.desk)
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

function nameMatches(name,needles){
 if(!needles?.length)return false;
 const n=String(name||'').normalize('NFD').toLowerCase();
 return needles.some(k=>k&&n.includes(String(k).normalize('NFD').toLowerCase()));
}

function pickPdfs(library,panels){
 const list=library||[];
 const specs=panels?.length?panels:defaultDesk().panels;
 const used=new Set();
 const prefers=specs.map(p=>p.prefer||[]);
 return specs.map((panel,index)=>{
  const rest=list.filter(p=>p&&!used.has(p.path));
  let hit=rest.find(p=>nameMatches(p.name,panel.prefer||[]));
  if(!hit){
   const others=prefers.filter((_,i)=>i!==index).flat();
   hit=rest.find(p=>!nameMatches(p.name,others))||rest[0];
  }
  if(hit)used.add(hit.path);
  return hit||null;
 });
}

module.exports={HOME_VAULT,defaultDesk,normalizeDesk,emptyConfig,normalize,readConfig,writeConfig,homeVaultExists,seedConfig,needsSetup,nameMatches,pickPdfs};
