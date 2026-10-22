/* Tempos dos testes de janela e hunts, para comparar rodadas (issue #48).

   Duas trilhas, ambas em `desk/.runtime/` (fora do git), uma linha JSON por
   registro:
   - `suite-tempos.jsonl`: o corredor (`run-suite.mjs`) grava uma linha por
     arquivo: {suite,file,ms,status,jobs,run,ts}. `run` é o início da rodada e
     agrupa as linhas dela.
   - `launch-tempos.jsonl`: `launchDesk` (`helpers.mjs`) grava, quando o corredor
     pede por `MESA_LAUNCH_TIMES`, quanto levou do `electron.launch` até a janela
     pintada: {file,launchMs,paintMs,ts}.

   Sem argumentos o módulo é um relatório: média por arquivo e total por
   rodada, por suíte. `node tests/suite-tempos.mjs [--suite hunts|janelas]`. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
export const RUNTIME_DIR=path.resolve(here,'..','.runtime');
export const SUITE_TIMES_FILE=path.join(RUNTIME_DIR,'suite-tempos.jsonl');
export const LAUNCH_TIMES_FILE=path.join(RUNTIME_DIR,'launch-tempos.jsonl');

/** Acrescenta uma linha JSON; erro de disco nunca reprova um teste. */
export function appendTimingRow(file,row){
 try{
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.appendFileSync(file,JSON.stringify(row)+'\n');
 }catch{/* medir não pode derrubar o teste */}
}

/** Linhas de um .jsonl (as ilegíveis são ignoradas). */
export function readTimingRows(file){
 let text;
 try{text=fs.readFileSync(file,'utf8');}catch{return [];}
 const rows=[];
 for(const line of text.split('\n')){
  if(!line.trim())continue;
  try{rows.push(JSON.parse(line));}catch{/* linha truncada */}
 }
 return rows;
}

/** Os `count` mais lentos, do maior para o menor.
 *  slowest([{file:'a',ms:5},{file:'b',ms:9}],1) → [{file:'b',ms:9}] */
export function slowest(rows,count=10){
 return [...rows].sort((a,b)=>b.ms-a.ms||a.file.localeCompare(b.file)).slice(0,count);
}

/** Agrupa linhas por rodada (`run`), na ordem em que apareceram. */
export function groupByRun(rows){
 const runs=new Map();
 for(const row of rows){
  if(!runs.has(row.run))runs.set(row.run,[]);
  runs.get(row.run).push(row);
 }
 return [...runs.entries()].map(([run,items])=>({run,suite:items[0].suite,jobs:items[0].jobs,rows:items}));
}

/** Média de `ms` por arquivo ao longo das rodadas dadas. */
export function meanByFile(runs){
 const sums=new Map();
 for(const run of runs){
  for(const row of run.rows){
   const acc=sums.get(row.file)||{file:row.file,total:0,count:0};
   acc.total+=row.ms;acc.count++;
   sums.set(row.file,acc);
  }
 }
 return [...sums.values()].map(acc=>({file:acc.file,ms:Math.round(acc.total/acc.count),count:acc.count}));
}

const seconds=ms=>(ms/1000).toFixed(1)+'s';

function printReport(suite){
 const runs=groupByRun(readTimingRows(SUITE_TIMES_FILE)).filter(run=>!suite||run.suite===suite);
 if(!runs.length){console.log('sem rodadas em '+SUITE_TIMES_FILE);return;}
 for(const run of runs){
  const wall=Math.max(...run.rows.map(r=>Date.parse(r.ts)))-Date.parse(run.run);
  const failed=run.rows.filter(r=>r.status==='falha').length;
  console.log(`${run.run} ${run.suite} jobs=${run.jobs} arquivos=${run.rows.length} falhas=${failed} total=${seconds(wall)}`);
 }
 console.log('\nmédia por arquivo (mais lentos):');
 for(const row of slowest(meanByFile(runs),15))console.log(`  ${seconds(row.ms).padStart(7)}  ${row.file} (${row.count}x)`);
 const launches=readTimingRows(LAUNCH_TIMES_FILE);
 if(launches.length){
  const mean=key=>Math.round(launches.reduce((sum,row)=>sum+(row[key]||0),0)/launches.length);
  console.log(`\njanelas abertas: ${launches.length}, launch médio ${mean('launchMs')} ms, pintada média ${mean('paintMs')} ms`);
 }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const at=process.argv.indexOf('--suite');
 printReport(at>0?process.argv[at+1]:'');
}
