'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {readConfig,normalize}=require('../../config.cjs');
const {remapRuntimePaths}=require('./backup.cjs');

/* A autorização para substituir preferências externas vem do checkbox da
   prévia. As pastas de matéria selecionadas são as cópias do plano do host. */
function restoreConfiguration({configFile,runtime,result,services}){
 const warnings=[];
 let config=readConfig(configFile),changed=false;
 if(result.restoreConfig){
  try{
   const entry=services.externalPlan(result).find(item=>item.ref==='mesa-config.json'&&item.authorized);
   if(!entry||!readConfig(entry.stored))throw Error('configurações da versão ausentes ou ilegíveis');
   services.restoreExternal(result,{ref:entry.ref,apply:true});
   config=readConfig(configFile);config.runtimePath=runtime;changed=true;
  }catch(error){warnings.push('Configurações pessoais preservadas: '+error.message);}
 }
 const groups=Array.isArray(result.materialsRemapped)?result.materialsRemapped:[];
 if(groups.length){
  config=config||normalize({});
  for(const group of groups){
   if(!group.courseId||!path.isAbsolute(group.to||'')||!fs.existsSync(group.to))continue;
   if(group.from)config=remapRuntimePaths(config,group.from,group.to);
   const index=config.courses.findIndex(course=>course.id===group.courseId);
   if(index>=0)config.courses[index]={...config.courses[index],path:group.to};
   else config.courses.push({id:group.courseId,name:group.name||group.courseId,path:group.to});
   changed=true;
  }
 }
 if(changed){
  try{
   if(fs.existsSync(configFile)&&fs.lstatSync(configFile).isSymbolicLink())throw Error('o arquivo de configurações é um link simbólico');
   let raw={};try{raw=JSON.parse(fs.readFileSync(configFile,'utf8'));}catch{}
   if(!raw||typeof raw!=='object'||Array.isArray(raw))raw={};
   for(const group of groups)if(group.from&&group.to)raw=remapRuntimePaths(raw,group.from,group.to);
   const known=normalize(config),merged={...raw,...known};
   merged.desk={...(raw.desk||{}),...known.desk,panels:known.desk.panels.map((panel,index)=>({...raw.desk?.panels?.[index],...panel}))};
   merged.courses=known.courses.map(course=>({...raw.courses?.find?.(item=>item.id===course.id),...course}));
   fs.mkdirSync(path.dirname(configFile),{recursive:true});
   const temporary=configFile+'.'+crypto.randomUUID()+'.tmp';
   try{fs.writeFileSync(temporary,JSON.stringify(merged,null,2)+'\n',{flag:'wx',mode:0o600});fs.renameSync(temporary,configFile);}finally{fs.rmSync(temporary,{force:true});}
  }catch(error){warnings.push('Não foi possível atualizar as matérias nas configurações: '+error.message);config=readConfig(configFile);}
 }
 result.restoreWarnings=[...(result.restoreWarnings||[]),...warnings];
 return config;
}
module.exports={restoreConfiguration};
