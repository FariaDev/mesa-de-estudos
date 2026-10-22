/* Corredor comum dos testes que sobem um Electron cada (`run-hunts`, `run-ui`).
   Cada arquivo roda como processo próprio, com runtime de mentira e porta própria;
   `jobs` por vez. A saída de cada um sai inteira quando ele termina (sem misturar
   linhas de dois Electrons) e os que falham imprimem tudo no fim.

   Saída do arquivo: 0 = ok; 77 = pulado (a primeira linha diz o motivo, com o
   prefixo `PULADO:`); qualquer outro = falha. Pulado não reprova a rodada, mas
   aparece no resumo — nunca some calado.

   Nenhum Electron sobra: no estouro do prazo o teste recebe SIGTERM (a guarda
   dele, `proc-tree.mjs`, mata o que ele subiu e sai) e, 5 s depois, SIGKILL nele
   e em toda a árvore vista. Ao sair, o que o teste deixou vivo morre com
   SIGKILL e o resumo diz quem foi. */
import {spawn} from 'node:child_process';
import path from 'node:path';
import {descendants,killRows,killTree} from './proc-tree.mjs';
import {appendTimingRow,slowest,SUITE_TIMES_FILE,LAUNCH_TIMES_FILE} from './suite-tempos.mjs';

export const SKIPPED=77;

export function parseArgs(argv,{jobs=2}={}){
 const args=[...argv];
 const take=(name,fallback)=>{
  const i=args.indexOf(name);
  if(i<0)return fallback;
  const value=args[i+1];
  args.splice(i,2);
  return value??fallback;
 };
 return {
  jobs:Math.max(1,Number(take('--jobs',String(jobs)))||jobs),
  block:String(take('--filter','')||''),
  timeout:Math.max(10,Number(take('--timeout','600'))||600)*1000,
  verbose:args.includes('--verbose'),
  match:args.find(a=>!a.startsWith('--'))||''
 };
}

/* Um arquivo de teste como processo próprio: {code, text, orphans}. */
export function runFile(dir,file,{block='',timeout=600000,grace=5000,env={}}={}){
 return new Promise(resolve=>{
  const child=spawn(process.execPath,[path.join(dir,file),...(block?[block]:[])],{cwd:path.dirname(dir),env:{...process.env,...env}});
  let text='',timedOut=false,orphans=[];
  /* A árvore do teste, revista a cada segundo: depois que ele morre os filhos
     são adotados pelo launchd e só dá para achá-los por aqui. Um Electron leva
     segundos para subir, então nenhum escapa; o que vive menos que isso a
     guarda do próprio teste (`proc-tree.mjs`) já mata na saída. */
  const seen=new Map();
  const look=()=>{for(const row of descendants(child.pid))seen.set(row.pid,row);};
  const watch=setInterval(look,1000);
  let force=null;
  const timer=setTimeout(()=>{
   timedOut=true;look();
   child.kill('SIGTERM');
   force=setTimeout(()=>{look();killTree(child.pid);child.kill('SIGKILL');},grace);
  },timeout);
  child.stdout.on('data',d=>text+=d);
  child.stderr.on('data',d=>text+=d);
  const stop=()=>{clearTimeout(timer);clearTimeout(force);clearInterval(watch);};
  child.on('error',err=>{stop();resolve({code:1,text:`${text}\n${err.message}`,orphans});});
  child.on('exit',()=>{stop();orphans=killRows([...seen.values()]);});
  child.on('close',code=>{
   stop();
   resolve({code:timedOut?1:(code??1),text:timedOut?`${text}\nestourou o prazo de ${Math.round(timeout/1000)}s`:text,orphans});
  });
 });
}

export async function runSuite({label,dir,files,jobs,block='',timeout=600000,verbose=false}){
 const started=Date.now();
 const run=new Date(started).toISOString();
 const results=[];
 let next=0;
 async function worker(){
  while(next<files.length){
   const file=files[next++];
   const at=Date.now();
   const out=await runFile(dir,file,{block,timeout,env:{MESA_LAUNCH_TIMES:LAUNCH_TIMES_FILE}});
   const ms=Date.now()-at;
   const seconds=Math.round(ms/1000);
   const status=out.code===0?'ok':out.code===SKIPPED?'pulado':'falha';
   results.push({file,status,text:out.text,seconds,ms,orphans:out.orphans||[]});
   appendTimingRow(SUITE_TIMES_FILE,{suite:label,file,ms,status,jobs,run,ts:new Date().toISOString()});
   console.log(`${{ok:'ok   ',pulado:'pulado',falha:'FALHA'}[status]} ${file} (${seconds}s)`);
  }
 }
 await Promise.all(Array.from({length:Math.min(jobs,files.length)},worker));
 results.sort((a,b)=>a.file.localeCompare(b.file));
 for(const r of results){
  if(r.status==='ok'&&!verbose)continue;
  console.log(`\n===== ${r.file} =====\n${r.text.trimEnd()}`);
 }
 const failed=results.filter(r=>r.status==='falha');
 const skipped=results.filter(r=>r.status==='pulado');
 const ok=results.length-failed.length-skipped.length;
 console.log(`\n==== ${label}: ${ok} ok, ${failed.length} com falha, ${skipped.length} pulados em ${Math.round((Date.now()-started)/1000)}s (${jobs} por vez) ====`);
 const top=slowest(results.filter(r=>r.status!=='pulado'),10);
 if(top.length)console.log(`\n10 mais lentos:\n${top.map(r=>`  ${(r.ms/1000).toFixed(1).padStart(6)}s  ${r.file}`).join('\n')}`);
 if(failed.length)console.log(`falharam:\n- ${failed.map(r=>r.file).join('\n- ')}`);
 const leaked=results.filter(r=>r.orphans.length);
 if(leaked.length)console.log(`processos que sobraram vivos (mortos com SIGKILL):\n- ${leaked.map(r=>`${r.file}: ${r.orphans.join(', ')}`).join('\n- ')}`);
 if(skipped.length)console.log(`pulados:\n- ${skipped.map(r=>`${r.file}: ${(r.text.split('\n').find(l=>l.startsWith('PULADO:'))||'PULADO: sem motivo').slice(8)}`).join('\n- ')}`);
 return failed.length?1:0;
}
