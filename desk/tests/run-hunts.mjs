/* Corre os hunts (`tests/hunt-*.mjs`) em paralelo.
   Cada hunt sobe o próprio Electron com runtime de mentira e porta própria, então
   dá para rodar vários de uma vez sem que um atropele o outro — em série a rodada
   passa de sete minutos; dois por vez (o default) corta boa parte disso.

   Uso:
     node tests/run-hunts.mjs                    # todos, 2 por vez
     node tests/run-hunts.mjs fila               # só os arquivos que casam
     node tests/run-hunts.mjs --jobs 4           # mais paralelismo
     node tests/run-hunts.mjs fila --filter nota # 1º argv de cada hunt (bloco/cenário)

   A saída de cada hunt sai inteira quando ele termina (sem misturar linhas de
   dois Electrons) e os que falham imprimem tudo no fim, para copiar o erro. */
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const args=process.argv.slice(2);
function takeOpt(name,fallback){
 const i=args.indexOf(name);
 if(i<0)return fallback;
 const value=args[i+1];
 args.splice(i,2);
 return value??fallback;
}
/* Dois por vez é o default: cada hunt sobe um Electron inteiro, e com três a
   máquina satura (o app demora a pintar e o cenário estoura o timeout — falso
   negativo). `--jobs 3`/`4` numa máquina folgada, `--jobs 1` para investigar. */
const jobs=Math.max(1,Number(takeOpt('--jobs','2'))||2);
const block=String(takeOpt('--filter','')||'');
const verbose=args.includes('--verbose');
const match=args.find(a=>!a.startsWith('--'))||'';

/* `hunt-pi.mjs` NÃO é caça: é o Pi de mentira que os outros hunts sobem como
   `LEARNING_DESK_PI`. Chamado sozinho ele espera prompt para sempre (o modo
   `mute-prompt` existe justamente para testar timeout) — fora da lista. */
const MOCKS=new Set(['hunt-pi.mjs']);
const files=fs.readdirSync(here).filter(f=>/^hunt-.*\.mjs$/.test(f)&&!MOCKS.has(f)&&f.includes(match)).sort();
if(!files.length){
 console.log(`nenhum hunt casa com "${match}"`);
 process.exit(1);
}

function run(file){
 return new Promise(resolve=>{
  const child=spawn(process.execPath,[path.join(here,file),...(block?[block]:[])],{cwd:path.dirname(here),env:process.env});
  let text='';
  child.stdout.on('data',d=>text+=d);
  child.stderr.on('data',d=>text+=d);
  child.on('error',err=>resolve({code:1,text:`${text}\n${err.message}`}));
  child.on('close',code=>resolve({code:code??1,text}));
 });
}

const started=Date.now();
const results=[];
let next=0;
async function worker(){
 while(next<files.length){
  const file=files[next++];
  const at=Date.now();
  const out=await run(file);
  const seconds=Math.round((Date.now()-at)/1000);
  results.push({file,code:out.code,text:out.text,seconds});
  console.log(`${out.code===0?'ok   ':'FALHA'} ${file} (${seconds}s)`);
 }
}
await Promise.all(Array.from({length:Math.min(jobs,files.length)},worker));

results.sort((a,b)=>a.file.localeCompare(b.file));
for(const r of results){
 if(r.code===0&&!verbose)continue;
 console.log(`\n===== ${r.file} =====\n${r.text.trimEnd()}`);
}
const failed=results.filter(r=>r.code!==0);
console.log(`\n==== hunts: ${results.length-failed.length} ok, ${failed.length} com falha em ${Math.round((Date.now()-started)/1000)}s (${jobs} por vez) ====`);
if(failed.length)console.log(`- ${failed.map(r=>r.file.replace(/^hunt-|\.mjs$/g,'')).join('\n- ')}`);
process.exit(failed.length?1:0);
