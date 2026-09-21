const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {discoverCourses}=require('./courses.cjs');

// Núcleos provados: core/library.bend (escolha dos PDFs) e core/config.bend
// (normalização da configuração). A ponte manda fatos (Maybe/Bool) e o núcleo
// decide — inclusive os defaults e cada herança de slot de painel. I/O e o
// casamento sem acento (nameMatches) continuam aqui. Regerar com
// `npm run build:bend` depois de mexer no core.
const libraryCore=require('./src/generated/library.core.js');
const core=libraryCore.default||libraryCore;
const configCore=require('./src/generated/config.core.js').default;

function toCoreList(items,convert){
 let out={$:'Nil'};
 for(let i=items.length-1;i>=0;i--)out={$:'Con',head:convert(items[i]),tail:out};
 return out;
}

function coreListToArray(node){
 const out=[];
 for(let current=node;current&&current.$==='Con';current=current.tail)out.push(current.head);
 return out;
}

const HOME_VAULT=path.join(os.homedir(),'Documents','Obsidian Vault');

// Fatos para o núcleo: `None` = ausente/inválido (o núcleo usa o default);
// `Some(String(v))` = valor de verdade (o núcleo apara e decide).
const none={$:'None'},some=value=>({$:'Some',value});
const stringFact=value=>value?some(String(value)):none;
const boolFact=value=>typeof value==='boolean'?some(value):none;

function deskFacts(raw){
 if(!raw||typeof raw!=='object')return none;
 return some({
  $:'DeskFacts',
  title:stringFact(raw.title),
  calculator:boolFact(raw.calculator),
  xournal:boolFact(raw.xournal),
  conferir:boolFact(raw.conferir),
  refsToggle:boolFact(raw.refsToggle),
  endDay:boolFact(raw.endDay),
  studyContext:boolFact(raw.studyContext),
  panels:toCoreList(Array.isArray(raw.panels)?raw.panels:[],panel=>{
   const p=panel&&typeof panel==='object'?panel:{};
   return {
    $:'PanelFacts',
    label:stringFact(p.label),
    prefer:toCoreList(Array.isArray(p.prefer)?p.prefer:[],value=>String(value||'')),
    toggle:stringFact(p.toggle)
   };
  })
 });
}

const fromDesk=desk=>({
 title:desk.title,calculator:desk.calculator,xournal:desk.xournal,conferir:desk.conferir,
 refsToggle:desk.refsToggle,endDay:desk.endDay,studyContext:desk.studyContext,
 panels:coreListToArray(desk.panels).map(p=>({label:p.label,prefer:coreListToArray(p.prefer),toggle:p.toggle}))
});

const fromConfig=config=>({
 vaultPath:config.vaultPath,runtimePath:config.runtimePath,piPath:config.piPath,xournalPath:config.xournalPath,
 courses:coreListToArray(config.courses).map(c=>({id:c.id,name:c.name,path:c.path})),
 desk:fromDesk(config.desk)
});

function defaultDesk(){return fromDesk(configCore.defaultDesk());}

function normalizeDesk(raw){return fromDesk(configCore.normalizeDesk(deskFacts(raw)));}

function emptyConfig(){return {vaultPath:'',runtimePath:'',piPath:'',xournalPath:'',courses:[],desk:defaultDesk()};}

function normalize(raw={}){
 return fromConfig(configCore.normalize({
  $:'ConfigFacts',
  vaultPath:stringFact(raw.vaultPath),
  runtimePath:stringFact(raw.runtimePath),
  piPath:stringFact(raw.piPath),
  xournalPath:stringFact(raw.xournalPath),
  courses:toCoreList(Array.isArray(raw.courses)?raw.courses:[],entry=>{
   const c=entry&&typeof entry==='object'?entry:{};
   const p=typeof c.path==='string'?c.path:'';
   return {$:'CourseFacts',id:stringFact(c.id),name:stringFact(c.name),path:stringFact(c.path),base:p?some(path.basename(p)):none};
  }),
  desk:deskFacts(raw.desk)
 }));
}

function readConfig(file){
 try{return normalize(JSON.parse(fs.readFileSync(file,'utf8')));}catch{return null;}
}

function writeConfig(file,config){
 fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,JSON.stringify(normalize(config),null,2)+'\n');
}

function homeVaultExists(){return fs.existsSync(path.join(HOME_VAULT,'Courses'));}

// Xournal++: .app no macOS; .exe nos caminhos comuns do Windows (semeia só se existir).
function detectXournalPath(){
 if(process.platform==='darwin')return fs.existsSync('/Applications/Xournal++.app')?'/Applications/Xournal++.app':'';
 if(process.platform==='win32'){
  const candidates=[
   process.env.ProgramFiles?path.join(process.env.ProgramFiles,'Xournal++','bin','xournalpp.exe'):null,
   process.env.LOCALAPPDATA?path.join(process.env.LOCALAPPDATA,'Programs','Xournal++','bin','xournalpp.exe'):null
  ];
  return candidates.find(p=>p&&fs.existsSync(p))||'';
 }
 return '';
}

function seedConfig({runtimePath}={}){
 const vaultPath=homeVaultExists()?HOME_VAULT:'';
 return normalize({
  vaultPath,
  runtimePath:runtimePath||(vaultPath?path.join(vaultPath,'Code','learning-canvas','desk','.runtime'):''),
  piPath:'',
  xournalPath:detectXournalPath(),
  courses:vaultPath?discoverCourses(vaultPath).map(c=>({id:c.id,name:c.name,path:c.path})):[]
 });
}

function needsSetup(config,courses){
 const usable=!!(config?.vaultPath&&fs.existsSync(config.vaultPath));
 return configCore.needsSetup(usable,toCoreList(courses||[],c=>({$:'Course',id:c.id,name:c.name,path:c.path})));
}

function nameMatches(name,needles){
 if(!needles?.length)return false;
 const n=String(name||'').normalize('NFD').toLowerCase();
 return needles.some(k=>k&&n.includes(String(k).normalize('NFD').toLowerCase()));
}

function pickPdfs(library,panels){
 const list=library||[];
 const specs=panels?.length?panels:defaultDesk().panels;
 const prefers=specs.map(p=>p.prefer||[]);
 // Máscara por índice espelhando o `used` por path de antes: entrada nula
 // nunca é candidata e, escolhido um path, todas as ocorrências dele saem.
 let mask=list.map(entry=>!entry);
 const picked=[];
 for(const [index,panel] of specs.entries()){
  const others=prefers.filter((_,i)=>i!==index).flat();
  const facts=toCoreList(list,entry=>({
   $:'Match',
   self:!!nameMatches(entry&&entry.name,panel.prefer||[]),
   other:!!nameMatches(entry&&entry.name,others)
  }));
  const step=core.pickStep(facts,toCoreList(mask,value=>value));
  let hit=null;
  if(step.at&&step.at.$==='Some'){
   const entry=list[Number(step.at.value)];
   if(entry){
    hit=entry;
    const path=entry.path;
    mask=coreListToArray(step.used);
    for(let i=0;i<list.length;i++)if(list[i]&&list[i].path===path)mask[i]=true;
   }
  }
  picked.push(hit);
 }
 return picked;
}

module.exports={HOME_VAULT,defaultDesk,normalizeDesk,emptyConfig,normalize,readConfig,writeConfig,homeVaultExists,seedConfig,needsSetup,nameMatches,pickPdfs};
