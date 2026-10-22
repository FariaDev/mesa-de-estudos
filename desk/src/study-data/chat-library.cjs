'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {message: uiMsg}=require('../i18n.mjs');

/* Rótulos pertencem à Mesa, nunca alteram uma sessão nativa. O host fornece
   a lista autorizada a cada leitura/edição; um ID do renderer não abre arquivo. */
const FILE='chat-library.json',MAX_BYTES=2*1024*1024,MAX_ITEMS=10000;
const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const bounded=(x,n)=>typeof x==='string'&&x.length<=n;
function identity(runtime,item){
 const file=String(item.session||item.path||item.id||'');
 if(!file||!path.isAbsolute(file)||!bounded(item.courseId,400))throw Error(uiMsg('err.chatlib.badSession'));
 const rel=path.relative(path.resolve(runtime),path.resolve(file));
 const key=JSON.stringify([item.courseId,rel]);
 const id='chat-'+crypto.createHash('sha256').update(key).digest('hex').slice(0,32);
 return {id,key,file};
}
function read(runtime){
 const file=path.join(runtime,FILE);
 if(!fs.existsSync(file))return {version:1,items:{}};
 const st=fs.lstatSync(file);
 if(!st.isFile()||st.isSymbolicLink()||st.size>MAX_BYTES)throw Error(uiMsg('err.chatlib.invalid'));
 let value;try{value=JSON.parse(fs.readFileSync(file,'utf8'));}catch{throw Error(uiMsg('err.chatlib.unreadable'));}
 if(value.version!==1||!plain(value.items)||Object.keys(value.items).length>MAX_ITEMS)throw Error(uiMsg('err.chatlib.invalid'));
 return value;
}
function labels(raw){
 if(!plain(raw))return {title:'',topic:'',favorite:false};
 return {title:bounded(raw.title,160)?raw.title:'',topic:bounded(raw.topic,80)?raw.topic:'',favorite:raw.favorite===true};
}
function list(runtime,authorized,{courseId='',query='',topic='',favorites=false}={}){
 const store=read(runtime),q=fold(query);
 const out=[];
 for(const entry of authorized){
  const {id,key}=identity(runtime,entry),meta=labels(store.items[key]);
  const item={id,courseId:entry.courseId,courseName:String(entry.courseName||'Livre'),
   title:meta.title||String(entry.title||entry.preview||uiMsg('chatlib.untitled')).replace(/\s+/g,' ').slice(0,160),
   preview:String(entry.preview||'').slice(0,600),topic:meta.topic,favorite:meta.favorite,
   engine:['claude','opencode'].includes(entry.engine)?entry.engine:'pi',at:Number(entry.at||entry.started)||0,current:entry.current===true};
  if(courseId&&item.courseId!==courseId)continue;
  if(topic&&item.topic!==topic)continue;
  if(favorites&&!item.favorite)continue;
  if(q&&!fold([item.title,item.preview,item.topic,item.courseName].join(' ')).includes(q))continue;
  out.push(item);
 }
 return out.sort((a,b)=>Number(b.favorite)-Number(a.favorite)||b.at-a.at||a.title.localeCompare(b.title,'pt-BR'));
}
function fold(x){return String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function resolve(runtime,id,authorized){
 if(typeof id!=='string'||!/^chat-[a-f0-9]{32}$/.test(id))throw Error(uiMsg('err.chatlib.badSession'));
 const found=authorized.find(item=>identity(runtime,item).id===id);
 if(!found)throw Error(uiMsg('err.chatlib.gone'));
 return found;
}
function update(runtime,id,patch,authorized){
 const item=resolve(runtime,id,authorized);
 if(!plain(patch)||Object.keys(patch).some(k=>!['title','topic','favorite'].includes(k)))throw Error(uiMsg('err.chatlib.badPatch'));
 for(const [field,max] of [['title',160],['topic',80]])if(Object.hasOwn(patch,field)&&!bounded(patch[field],max))throw Error(uiMsg('err.chatlib.badLabel'));
 if(Object.hasOwn(patch,'favorite')&&typeof patch.favorite!=='boolean')throw Error(uiMsg('err.chatlib.badFavorite'));
 const store=read(runtime),{key}=identity(runtime,item);
 if(!Object.hasOwn(store.items,key)&&Object.keys(store.items).length>=MAX_ITEMS)throw Error(uiMsg('err.chatlib.labelLimit'));
 store.items[key]={...labels(store.items[key]),...patch};
 store.items[key].title=store.items[key].title.trim();store.items[key].topic=store.items[key].topic.trim();
 const data=JSON.stringify(store);if(Buffer.byteLength(data)>MAX_BYTES)throw Error(uiMsg('err.chatlib.sizeLimit'));
 fs.mkdirSync(runtime,{recursive:true});
 const target=path.join(runtime,FILE),tmp=target+'.'+crypto.randomUUID()+'.tmp';
 try{fs.writeFileSync(tmp,data+'\n',{flag:'wx',mode:0o600});fs.renameSync(tmp,target);}finally{try{fs.unlinkSync(tmp);}catch{}}
 return list(runtime,authorized).find(row=>row.id===id);
}
module.exports={FILE,identity,read,list,resolve,update};
