'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {normalize}=require('./config.cjs');
const {isPlainObject}=require('./desk-state-sanitize.cjs');

/* Escrita da config preservando chaves que o schema não modela (extras do
   usuário) e os defaults do autor (normalize). Saiu do main.cjs na #43 fase 2.

   Exemplo: writeConfigPreservingExtras(configFile,{...config,courses}) */
function writeConfigPreservingExtras(file,next){
 const normalized=normalize(next);
 let raw=null;try{raw=JSON.parse(fs.readFileSync(file,'utf8'));}catch{/* ausente ou ilegível: segue sem os campos extras */}
 const merged=isPlainObject(raw)?{...raw,...normalized}:normalized;
 /* Extras de desk/leitores também pertencem ao usuário: a normalização
    resolve os campos suportados, sem consumir metadados de versões futuras. */
 if(isPlainObject(raw?.desk)){
  merged.desk={...raw.desk,...normalized.desk};
  if(Array.isArray(raw.desk.panels))merged.desk.panels=normalized.desk.panels.map((panel,index)=>({...((isPlainObject(raw.desk.panels[index])&&raw.desk.panels[index])||{}),...panel}));
 }
 if(isPlainObject(raw)&&Array.isArray(raw.courses)){
  const extras=new Map();
  for(const item of raw.courses)if(isPlainObject(item)&&typeof item.id==='string')extras.set(item.id,item);
  merged.courses=normalized.courses.map(course=>({...(extras.get(course.id)||{}),...course}));
 }
 fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,JSON.stringify(merged,null,2)+'\n');
}

module.exports={writeConfigPreservingExtras};
