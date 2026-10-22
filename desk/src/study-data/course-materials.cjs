'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {message: uiMsg}=require('../i18n.mjs');
const pdf=require('../../material-pdf.cjs');
const materialModel=require('../../material-model.cjs');
const FILE='pdf-drafts.json';
const MAX_MATERIAL_BYTES=128*1024*1024;

/* A pasta de destino é revalidada a cada publicação: se `Materiais da Mesa`
   virar link (ou o caminho da matéria mudar) entre a checagem e o link, a
   publicação é recusada e o arquivo recém-criado sai. */
function assertDirectory(dir){
 const st=fs.lstatSync(dir,{throwIfNoEntry:false});
 if(!st||st.isSymbolicLink()||!st.isDirectory()||fs.realpathSync(dir)!==dir)throw Error(uiMsg('err.material.badFolder'));
 return dir;
}
function materialDirectory(course){
 const root=fs.realpathSync(course.path),dir=path.join(root,'Materiais da Mesa');
 fs.mkdirSync(dir,{recursive:true});
 return assertDirectory(dir);
}
const key=(runtime,scope)=>JSON.stringify([scope.courseId,path.relative(runtime,scope.session)]);
function read(runtime){
 const file=path.join(runtime,FILE);if(!fs.existsSync(file))return {};
 const st=fs.lstatSync(file);if(!st.isFile()||st.isSymbolicLink()||st.size>8*1024*1024)throw Error(uiMsg('err.material.draftsInvalid'));
 let store;try{store=JSON.parse(fs.readFileSync(file,'utf8'));}catch{throw Error(uiMsg('err.material.draftsUnreadable'));}
 if(!store||typeof store!=='object'||Array.isArray(store))throw Error(uiMsg('err.material.draftsInvalid'));return store;
}
function write(runtime,store){
 const file=path.join(runtime,FILE),temporary=file+'.'+crypto.randomUUID()+'.tmp';
 const data=JSON.stringify(store);if(Buffer.byteLength(data)>8*1024*1024)throw Error(uiMsg('err.material.draftLimit'));
 try{fs.writeFileSync(temporary,data,{flag:'wx',mode:0o600});fs.renameSync(temporary,file);}finally{fs.rmSync(temporary,{force:true});}
}
function getDraft(runtime,scope){const draft=read(runtime)[key(runtime,scope)];return draft?{...draft,...materialModel.draftModel(draft)}:null;}
function prepareDraft(runtime,scope,{title,markdown,model,options,modelSource}){
 if(typeof title!=='string'||!title.trim()||title.length>pdf.MAX_TITLE_CHARS||typeof markdown!=='string'||!markdown.trim()||markdown.length>pdf.MAX_MARKDOWN_CHARS)throw Error(uiMsg('err.material.badContent'));
 const store=read(runtime),draft={id:crypto.randomUUID(),title:title.trim(),markdown,...materialModel.draftModel({model,options,modelSource})};store[key(runtime,scope)]=draft;write(runtime,store);return draft;
}
function clearDraft(runtime,scope,id){const store=read(runtime),k=key(runtime,scope);if(store[k]?.id===id){delete store[k];write(runtime,store);}}

/* Lê os bytes do objeto ABERTO (fstat), não de um caminho que pode ter sido
   trocado: o que é validado é o que foi lido. O_NOFOLLOW recusa link no
   caminho onde o sistema oferece. */
function readMaterial(file){
 if(!path.isAbsolute(String(file||'')))throw Error(uiMsg('err.material.pdfUnavailable'));
 const link=fs.lstatSync(file,{throwIfNoEntry:false});
 if(!link||link.isSymbolicLink())throw Error(uiMsg('err.material.pdfUnavailable'));
 let fd=null;
 try{
  fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
  const st=fs.fstatSync(fd);
  if(!st.isFile()||st.size>MAX_MATERIAL_BYTES)throw Error(uiMsg('err.material.pdfUnavailable'));
  const bytes=fs.readFileSync(fd);
  if(bytes.length!==st.size)throw Error(uiMsg('err.material.changedWhileReading',{read:bytes.length,size:st.size}));
  return bytes;
 }catch(error){
  if(['ENOENT','EISDIR','ELOOP','ENOTDIR','EMLINK'].includes(error.code))throw Error(uiMsg('err.material.pdfUnavailable'));
  throw error;
 }finally{if(fd!==null)try{fs.closeSync(fd);}catch{}}
}

/* Publica o temporário no nome final sem NUNCA sobrescrever e sem nome parcial
   visível: link é atômico; onde ele não existe (EPERM/EXDEV), a cópia
   exclusiva é o único recurso do sistema de arquivos. */
function commitExclusive(temporary,target){
 try{fs.linkSync(temporary,target);return true;}
 catch(error){
  if(error.code==='EEXIST')return false;
  if(!['EPERM','EXDEV','ENOTSUP','EOPNOTSUPP','ENOSYS'].includes(error.code))throw error;
 }
 try{fs.copyFileSync(temporary,target,fs.constants.COPYFILE_EXCL);return true;}
 catch(error){if(error.code==='EEXIST')return false;throw error;}
}

/* Copia somente um material do manifesto capturado pelo host. Publicação
   exclusiva e bytes conferidos preservam o original e arquivos homônimos. */
function addToCourse({workspace,materialId,course}){
 const material=workspace?.materials?.find(item=>item.id===materialId);
 if(!material)throw Error(uiMsg('err.material.notInFree'));
 if(!course||!path.isAbsolute(course.path))throw Error(uiMsg('err.material.badTarget'));
 const originalRoot=fs.realpathSync(course.path),source=material.path;
 const bytes=readMaterial(source);
 if(!bytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw Error(uiMsg('err.material.notValidPdf'));
 const hash=crypto.createHash('sha256').update(bytes).digest('hex');
 const root=materialDirectory(course);
 const stem=pdf.sanitizeStem(path.basename(material.name||'Material.pdf','.pdf'));
 const temp=path.join(root,'.mesa-copy-'+crypto.randomUUID()+'.tmp');
 try{
  const fd=fs.openSync(temp,'wx',0o600);
  try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  for(let n=1;n<=200;n++){
   assertDirectory(root);
   if(fs.realpathSync(course.path)!==originalRoot)throw Error(uiMsg('err.material.folderChanged'));
   const name=stem+(n===1?'':`-${n}`)+'.pdf',target=path.join(root,name);
   if(!commitExclusive(temp,target))continue;
   try{
    if(fs.realpathSync(course.path)!==originalRoot||fs.realpathSync(root)!==root)throw Error(uiMsg('err.material.folderChanged'));
    if(crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex')!==hash)throw Error(uiMsg('err.material.copyMismatch'));
   }catch(error){fs.rmSync(target,{force:true});throw error;}
   return {name,path:target,courseId:course.id,courseName:course.name,bytes:bytes.length};
  }
  throw Error(uiMsg('err.material.noFreeName'));
 }finally{fs.rmSync(temp,{force:true});}
}
module.exports={FILE,getDraft,prepareDraft,clearDraft,addToCourse,materialDirectory};
