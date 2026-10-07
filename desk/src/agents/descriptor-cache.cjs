const fs=require('node:fs');
// Display-only cache. Transport operations still validate the real descriptor.
class DescriptorCache{
 constructor({read,stat=fs.statSync}){this.read=read;this.stat=stat;this.meta=new Map();}
 get(file,{messages=false}={}){
  let stamp;try{const s=this.stat(file);stamp=[s.dev,s.ino,s.size,s.mtimeMs,s.ctimeMs].join(':');}catch{return null;}
  const hit=this.meta.get(file);
  if(hit?.stamp===stamp){
   if(!messages)return hit.value;
   if(this.fullFile===file&&this.fullStamp===stamp)return this.fullRecord;
  }
  const record=this.read(file);
  let value=null;
  if(record){value={};for(const key of ['schemaVersion','engine','id','nativeSessionId','nativeEstablished','courseId','started','preview','model','effort','pinnedExecutable','delivery'])if(record[key]!==undefined)value[key]=record[key];}
  this.meta.set(file,{stamp,value});
  if(this.meta.size>1000)this.meta.delete(this.meta.keys().next().value);
  if(messages){this.fullFile=file;this.fullStamp=stamp;this.fullRecord=record;}
  return messages?record:value;
 }
}
module.exports={DescriptorCache};
