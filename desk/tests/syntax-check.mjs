import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const files=[];
for(const dir of [root,path.join(root,'src'),path.join(root,'tests')]){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  if(!entry.isFile()||!/\.(cjs|mjs)$/.test(entry.name))continue;
  files.push(path.join(dir,entry.name));
 }
}
let bad=0;
for(const file of files){
 const run=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
 if(run.status!==0){
  bad++;
  console.error(`${path.relative(root,file)}: ${(run.stderr||'erro de sintaxe').trim()}`);
 }
}
if(bad){
 console.error(`check: ${bad} arquivo(s) com erro de sintaxe.`);
 process.exit(1);
}
console.log(`check: sintaxe ok em ${files.length} arquivos.`);
