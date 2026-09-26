import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const files=[];
for(const dir of [root,path.join(root,'src'),path.join(root,'tests')]){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  if(!entry.isFile()||!/\.(cjs|mjs)$/.test(entry.name))continue;
  files.push(path.join(dir,entry.name));
 }
}

/* Um `node --check` por arquivo, vários de uma vez: em série isto custava ~25s
   (cada `node` tem o custo de subir) e era o passo mais lento do `npm test`. */
function check(file){
 return new Promise(resolve=>{
  const child=spawn(process.execPath,['--check',file],{stdio:['ignore','ignore','pipe']});
  let err='';
  child.stderr.on('data',d=>err+=d);
  child.on('error',e=>resolve({file,err:e.message}));
  child.on('close',code=>resolve(code===0?null:{file,err:(err||'erro de sintaxe').trim()}));
 });
}

const bad=[];
let next=0;
const jobs=Math.max(1,Math.min(8,files.length));
await Promise.all(Array.from({length:jobs},async()=>{
 while(next<files.length){
  const file=files[next++];
  const failure=await check(file);
  if(failure)bad.push(failure);
 }
}));

for(const failure of bad.sort((a,b)=>a.file.localeCompare(b.file))){
 console.error(`${path.relative(root,failure.file)}: ${failure.err}`);
}
if(bad.length){
 console.error(`check: ${bad.length} arquivo(s) com erro de sintaxe.`);
 process.exit(1);
}
console.log(`check: sintaxe ok em ${files.length} arquivos.`);
