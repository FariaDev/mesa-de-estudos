'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const conversations=require('../agents/conversations.cjs');
const packages=require('./packages.cjs');
const {message}=require('../i18n.mjs');
const {describeReceived}=require('../error-detail.mjs');
const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
/* Instala somente dados do novo escopo. Políticas e extensões vindas do
   pacote ficam no arquivo importado para consulta, sem serem ativadas.
   As anotações de página são reancoradas nas raízes do destino: o caminho
   absoluto do autor NUNCA vira caminho do usuário; item sem material
   continua guardado (trecho/observação) com o caminho vazio. */
function adoptPackage({runtime,result,writeConfiguration}){
 const backups=new Map(),created=[];
 /* Lê o store local recusando link simbólico: adotar não segue link para
   fora do runtime nem grava através dele (o rename abaixo trocaria o link). */
 const readLocal=file=>{
  let stat;
  try{stat=fs.lstatSync(file);}catch{return {};}
  if(stat.isSymbolicLink())throw Error(message('err.pkg.localSymlink',{name:path.basename(file)}));
  if(!stat.isFile())return {};
  let raw;
  try{raw=JSON.parse(fs.readFileSync(file,'utf8'));}catch{throw Error(message('err.pkg.localUnreadable',{name:path.basename(file)}));}
  if(!plain(raw))throw Error(message('err.pkg.localInvalid',{name:path.basename(file),received:describeReceived(raw)}));
  return raw;
 };
 const put=(file,value)=>{
  if(!backups.has(file))backups.set(file,fs.existsSync(file)?fs.readFileSync(file):null);
  const temporary=file+'.'+crypto.randomUUID()+'.tmp';
  try{fs.writeFileSync(temporary,JSON.stringify(value)+'\n',{flag:'wx',mode:0o600});fs.renameSync(temporary,file);}finally{fs.rmSync(temporary,{force:true});}
 };
 const sessions=[];
 try{
  for(const name of ['review.json','bookmarks.json','resume.json','pdf-notes.json']){
   const source=path.join(result.storeDir,name);if(!fs.existsSync(source))continue;
   const target=path.join(runtime,name),old=readLocal(target);
   const incoming=JSON.parse(fs.readFileSync(source,'utf8'));
   /* Anotações: porta o payload (novo portátil ou v1) para caminhos DENTRO do
      destino da matéria importada. Nunca copia o caminho absoluto da origem. */
   const slice=name==='pdf-notes.json'
    ?packages.resolveNoteStore(incoming,{roots:[result.materialsDir,result.learningDir].filter(Boolean)})
    :(plain(incoming)&&Object.hasOwn(incoming,result.courseId)?incoming[result.courseId]:incoming);
   put(target,{...old,[result.courseId]:slice});
  }
  for(const entry of result.record?.conversations||[]){
   const source=path.resolve(result.destination,entry.file);
   if(!source.startsWith(path.resolve(result.conversationsDir)+path.sep))throw Error(message('err.pkg.sessionOutside',{received:describeReceived(entry.file)}));
   if(entry.engine==='claude'){
    const record=JSON.parse(fs.readFileSync(source,'utf8'));
    const file=conversations.createClaudeConversation({runtime,courseId:result.courseId});created.push(file);
    conversations.updateClaudeConversation(file,{messages:record.messages||[],preview:String(record.preview||'Sessão importada').slice(0,160)},{runtime});
    sessions.push({path:file,started:Date.now(),preview:record.preview||'Sessão importada'});
   }else if(entry.engine==='pi'){
    let at=Date.now(),file=path.join(runtime,`pi-${at}.jsonl`);while(fs.existsSync(file))file=path.join(runtime,`pi-${++at}.jsonl`);
    fs.copyFileSync(source,file,fs.constants.COPYFILE_EXCL);created.push(file);
    sessions.push({path:file,started:at,preview:'Sessão importada'});
   }
  }
  writeConfiguration();
  return {sessions};
 }catch(error){
  for(const [file,bytes] of backups)try{if(bytes===null)fs.rmSync(file,{force:true});else fs.writeFileSync(file,bytes);}catch{}
  for(const file of created)try{fs.rmSync(file,{force:true});}catch{}
  throw error;
 }
}
module.exports={adoptPackage};
