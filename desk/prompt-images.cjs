// @ts-check
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {imageCandidates}=require('./lib.cjs');
const {message}=require('./src/i18n.mjs');

/* Imagens do tutor (#43 fase 2: saiu do main.cjs): leitura de imagem do
   material dentro de `learning/`, anexos do prompt medidos e encolhidos
   (os tetos e tipos vêm do núcleo `core/attachments.bend`) e o corte de
   imagens antigas do histórico que volta para a tela. */

/**
 * Cria as funções de imagem do tutor.
 * @param {{runtime: string, deskDir: string, learningRoot: string,
 *   nativeImage: typeof import('electron').nativeImage}} options
 *   `nativeImage` é o do Electron (encolhe a imagem grande antes do envio)
 * Devolve readableImage, promptImages e trimMessageImages.
 * @example const {promptImages}=createPromptImages({runtime,deskDir,learningRoot,nativeImage});
 */
function createPromptImages({runtime,deskDir,learningRoot,nativeImage}){
 const IMAGE_MIME={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',svg:'image/svg+xml'};
 function readableImage(input){
  const roots=[path.dirname(deskDir),deskDir,runtime];
  let base;
  try{base=fs.realpathSync(learningRoot);}catch{return null;}
  for(const file of imageCandidates(input,{learningRoot,roots})){
   try{
    const real=fs.realpathSync(file);
    if(real!==base&&!real.startsWith(base+path.sep))continue;
    const stat=fs.statSync(real);
    if(!stat.isFile()||stat.size>25*1024*1024)continue;
    const mime=IMAGE_MIME[path.extname(real).slice(1).toLowerCase()];
    if(!mime)continue;
    return {file:real,mime,bytes:fs.readFileSync(real)};
   }catch{/* arquivo sumiu ou ilegível: tenta o próximo candidato */}
  }
  return null;
 }
 const PROMPT_IMAGE=/^data:(image\/png|image\/jpe?g|image\/webp|image\/gif);base64,([A-Za-z0-9+/=]+)$/;
 /* Envio de imagens: núcleo Bend (core/attachments.bend). O host mede bytes,
    encolhe (nativeImage) e mapeia o motivo; o núcleo decide tetos e tipos — os
    números vêm de lá, não daqui. */
 const attachCore=require('./src/generated/attachments.core.js').default;
 const PROMPT_IMAGE_MAX_RAW=attachCore.maxRawBytes(),PROMPT_IMAGE_MAX_SEND=attachCore.maxSendBytes(),PROMPT_IMAGE_MAX_TOTAL=attachCore.maxTotalBytes();
 const coreList=xs=>xs.reduceRight((tail,head)=>({$:'Con',head,tail}),{$:'Nil'});
 const coreArray=node=>{const out=[];for(let current=node;current&&current.$==='Con';current=current.tail)out.push(current.head);return out;};
 const attachMB=bytes=>Math.round(bytes/1024/1024);
 const ATTACH_MSG={
  'AttachError.BadType':message('err.attach.badType'),
  'AttachError.ImageTooLarge':message('err.attach.imageTooLarge',{mb:attachMB(PROMPT_IMAGE_MAX_RAW)}),
  'AttachError.FileTooLarge':message('err.attach.fileTooLarge'),
  'AttachError.ReducedTooLarge':message('err.attach.reducedTooLarge',{mb:attachMB(PROMPT_IMAGE_MAX_SEND)}),
  'AttachError.TotalTooLarge':message('err.attach.totalTooLarge',{mb:attachMB(PROMPT_IMAGE_MAX_TOTAL)})
 };
 const attachError=reason=>Error(ATTACH_MSG[reason?.$]||message('err.attach.invalid'));
 function shrinkPromptImage(mime,bytes){
  if(mime==='image/gif'&&bytes.length<=4*1024*1024)return {mime,bytes};
  let image;
  try{image=nativeImage.createFromBuffer(bytes);}catch{return {mime,bytes};}
  if(image.isEmpty())return {mime,bytes};
  const {width,height}=image.getSize();
  const scale=Math.min(1,2000/Math.max(width||1,height||1));
  if(scale>=1&&bytes.length<=4*1024*1024)return {mime,bytes};
  const resized=scale<1?image.resize({width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale)),quality:'good'}):image;
  let out;
  try{out=mime==='image/png'?{mime:'image/png',bytes:resized.toPNG()}:{mime:'image/jpeg',bytes:resized.toJPEG(85)};}catch{return {mime,bytes};}
  return out.bytes?.length&&out.bytes.length<bytes.length?out:{mime,bytes};
 }
 function promptImages(input){
  const facts=[],shrunkList=[];
  let total=0;
  for(const item of (Array.isArray(input)?input:[]).slice(0,4)){
   const raw=typeof item==='string'?item:item?.dataUrl;
   const match=typeof raw==='string'?PROMPT_IMAGE.exec(raw):null;
   let overRaw=false,overSend=false,overTotal=false,shrunk=null;
   if(match){
    const bytes=Buffer.from(match[2],'base64');
    overRaw=!bytes.length||bytes.length>PROMPT_IMAGE_MAX_RAW;
    if(!overRaw){
     const mime=match[1]==='image/jpg'?'image/jpeg':match[1];
     shrunk=shrinkPromptImage(mime,bytes);
     overSend=shrunk.bytes.length>PROMPT_IMAGE_MAX_SEND;
     if(!overSend){total+=shrunk.bytes.length;overTotal=total>PROMPT_IMAGE_MAX_TOTAL;}
    }
   }
   facts.push({$:'SendIn',mime:match?match[1]:'',valid:!!match,overRaw,overSend,overTotal});
   shrunkList.push(shrunk);
  }
  const out=attachCore.promptImages(coreList(facts));
  if(out.$!=='SendResult.Ok')throw attachError(out.reason);
  return coreArray(out.mimes).map((mime,i)=>({type:'image',data:shrunkList[i].bytes.toString('base64'),mimeType:mime}));
 }
 function trimMessageImages(messages,keep=6){
  const list=Array.isArray(messages)?messages:[];
  let left=keep;
  for(let i=list.length-1;i>=0;i--){
   const content=list[i]?.content;
   if(!Array.isArray(content)||!content.some(part=>part&&part.type==='image'))continue;
   if(left>0){left--;continue;}
   list[i].content=content.filter(part=>!part||part.type!=='image');
  }
  return list;
 }
 return {readableImage,promptImages,trimMessageImages};
}

module.exports={createPromptImages};
