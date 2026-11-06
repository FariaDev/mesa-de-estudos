'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {readConfig,normalize}=require('../../config.cjs');
const {FIELDS:EXECUTABLE_FIELDS}=require('../../executable-host.cjs');
const {remapRuntimePaths}=require('./backup.cjs');

/* A autorização para substituir preferências externas vem do checkbox da
   prévia. As pastas de matéria selecionadas são as cópias do plano do host.
   B-01: a versão nunca escolhe executável. `claudePath`, `xournalPath` e
   `opencodePath` (executable-host.cjs, fonte única) ficam com o valor de antes
   — vazio continua vazio e a detecção automática age — e `piPath` (legado com
   cara de executável) sai do arquivo final. O hostil nunca pode ficar no disco:
   o bytes de antes voltam se a gravação falhar depois do restoreExternal. */
function keepSavedExecutables(restored,saved){
 const next={...(restored||{})};
 for(const field of EXECUTABLE_FIELDS)next[field]=saved&&typeof saved[field]==='string'?saved[field]:'';
 next.piPath=saved&&typeof saved.piPath==='string'?saved.piPath:'';
 return next;
}
/* Só `piPath` sai do arquivo final: é o único `*Path` legado com cara de
   executável que nenhum código mais lê para executar (os executáveis de verdade
   — `claudePath`, `xournalPath`, `opencodePath` — já voltaram ao valor salvo
   pelo `keepSavedExecutables`). Extra do usuário como `libraryPath` fica. */
function stripExecutableLike(merged){
  if(merged&&typeof merged==='object'&&'piPath' in merged)delete merged.piPath;
  return merged;
}
function restoreConfiguration({configFile,runtime,result,services}){
 const warnings=[];
 let config=readConfig(configFile),changed=false;
  let restoredConfig=false,beforeBytes=null,beforeExists=false,beforeMode=0;
  if(result.restoreConfig){
   try{
    const entry=services.externalPlan(result).find(item=>item.ref==='mesa-config.json'&&item.authorized);
    if(!entry||!readConfig(entry.stored))throw Error('configurações da versão ausentes ou ilegíveis');
    const saved=config;
    beforeExists=fs.existsSync(configFile);
    try{beforeBytes=beforeExists?fs.readFileSync(configFile):null;}catch{beforeBytes=null;}
    try{beforeMode=beforeExists?(fs.statSync(configFile).mode&0o777):0;}catch{beforeMode=0;}
    /* Sem os bytes de antes não há para onde voltar: o hostil não pode ficar
       no disco, então nem chama o `restoreExternal`. */
    if(beforeExists&&beforeBytes===null)throw Error('configurações atuais ilegíveis: nada foi restaurado');
    services.restoreExternal(result,{ref:entry.ref,apply:true});
   restoredConfig=true;
   config=keepSavedExecutables(readConfig(configFile),saved);config.runtimePath=runtime;changed=true;
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
   const known=normalize(config),merged=stripExecutableLike({...raw,...known});
   merged.desk={...(raw.desk||{}),...known.desk,panels:known.desk.panels.map((panel,index)=>({...raw.desk?.panels?.[index],...panel}))};
   merged.courses=known.courses.map(course=>({...raw.courses?.find?.(item=>item.id===course.id),...course}));
   fs.mkdirSync(path.dirname(configFile),{recursive:true});
   const temporary=configFile+'.'+crypto.randomUUID()+'.tmp';
   try{fs.writeFileSync(temporary,JSON.stringify(merged,null,2)+'\n',{flag:'wx',mode:0o600});fs.renameSync(temporary,configFile);}finally{fs.rmSync(temporary,{force:true});}
  }catch(error){
    if(restoredConfig){
     try{
      if(beforeExists&&beforeBytes!==null){fs.writeFileSync(configFile,beforeBytes);if(beforeMode)fs.chmodSync(configFile,beforeMode);}
      else if(!beforeExists)fs.rmSync(configFile,{force:true});
     }catch{/* o aviso abaixo já diz que as matérias não foram atualizadas */}
    }
   warnings.push('Não foi possível atualizar as matérias nas configurações: '+error.message);config=readConfig(configFile);}
 }
 result.restoreWarnings=[...(result.restoreWarnings||[]),...warnings];
 return config;
}
module.exports={restoreConfiguration};
