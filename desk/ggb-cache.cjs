'use strict';

const fs=require('node:fs');
const path=require('node:path');

/* Cache em disco do applet do GeoGebra por matéria (`runtime/ggb/<id>.b64`).
   Saiu do main.cjs na #43 fase 2; `written` lembra o último valor gravado para
   não regravar o mesmo base64 a cada persistência. */
const MAX_GGB_CHARS=400000;

/**
 * Cria o cache do applet.
 * @param {{dir:string, log:(area:string, line:string)=>void}} options pasta e log
 * @returns {{persist:(id:string, value:string)=>void, read:(id:string)=>string,
 *   remember:(id:string, value:string)=>void, clear:()=>void}}
 * @example const ggbCache=createGgbCache({dir:path.join(runtime,'ggb'),log:appendLog});
 */
function createGgbCache({dir,log}){
 const written=new Map();
 function persist(id,value){
  if(!id)return;
  const file=path.join(dir,`${id}.b64`);
  if(!value){if(written.has(id)){try{fs.rmSync(file,{force:true});}catch{/* cache em disco; ficar para trás é inofensivo */}written.delete(id);}return;}
  if(written.get(id)===value)return;
  try{fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(file,value);written.set(id,value);}catch(error){log('ggb',`cache do applet não gravado: ${error.message}`);}
 }
 function read(id){
  if(!id)return '';
  try{
   const text=fs.readFileSync(path.join(dir,`${id}.b64`),'utf8').trim();
   return text&&text.length<=MAX_GGB_CHARS&&/^[A-Za-z0-9+/=\r\n]+$/.test(text)?text:'';
  }catch{return '';}
 }
 return {persist,read,remember:(id,value)=>{written.set(id,value);},clear:()=>{written.clear();}};
}

module.exports={createGgbCache};
