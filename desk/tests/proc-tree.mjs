/* Árvore de processos de um teste, para ninguém sobrar vivo.

   O Playwright sobe o Electron em grupo de processo próprio (`detached`) e só o
   mata no `exit` do Node. Se o teste morre por sinal (SIGKILL do corredor) o
   Electron fica órfão; se recebe SIGTERM, o Playwright tenta fechar o app com
   educação e espera para sempre quando o app não responde. Aqui a limpeza é
   por SIGKILL, na árvore inteira, lida do `ps` antes de qualquer morte (depois,
   os órfãos já foram adotados pelo launchd e somem da árvore).

   Cada processo é identificado por pid + hora de início, para um pid reciclado
   nunca levar o SIGKILL de outro. */
import {execFileSync} from 'node:child_process';

const WIN=process.platform==='win32';

/* Todos os processos: pid, pai, grupo e início. Sem `ps` (Windows), vazio. */
export function processTable(){
 if(WIN)return [];
 let out;
 try{out=execFileSync('ps',['-A','-o','pid=,ppid=,pgid=,lstart='],{encoding:'utf8',maxBuffer:16*1024*1024});}catch{return [];}
 const rows=[];
 for(const line of out.split('\n')){
  const m=line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.+?)\s*$/);
  if(m)rows.push({pid:+m[1],ppid:+m[2],pgid:+m[3],start:m[4]});
 }
 return rows;
}

/* Descendentes de `root` (sem ele), mais os membros dos grupos que algum
   descendente lidera — o Electron do Playwright é líder do próprio grupo. */
export function descendants(root,table=processTable()){
 const children=new Map();
 for(const row of table){
  if(!children.has(row.ppid))children.set(row.ppid,[]);
  children.get(row.ppid).push(row);
 }
 const found=new Map(),queue=[root];
 while(queue.length){
  for(const row of children.get(queue.shift())||[]){
   if(found.has(row.pid))continue;
   found.set(row.pid,row);queue.push(row.pid);
  }
 }
 const leaders=new Set([...found.values()].filter(row=>row.pid===row.pgid).map(row=>row.pid));
 for(const row of table)if(leaders.has(row.pgid)&&row.pid!==root&&!found.has(row.pid))found.set(row.pid,row);
 return [...found.values()];
}

/* SIGKILL em quem ainda é o mesmo processo (pid + início). Devolve os mortos. */
export function killRows(rows){
 if(!rows.length)return [];
 const alive=new Map(processTable().map(row=>[row.pid,row]));
 const killed=[];
 for(const row of rows){
  const now=alive.get(row.pid);
  if(!now||now.start!==row.start)continue;
  try{process.kill(row.pid,'SIGKILL');killed.push(row.pid);}catch{/* já morreu */}
 }
 return killed;
}

/* Mata a árvore inteira abaixo de `root` (no Windows, `taskkill /T`). */
export function killTree(root){
 if(WIN){
  try{execFileSync('taskkill',['/PID',String(root),'/T','/F'],{stdio:'ignore'});}catch{/* sem filhos */}
  return [];
 }
 return killRows(descendants(root));
}

/* Guarda do processo de teste: na saída (normal ou por SIGTERM/SIGINT/SIGHUP)
   mata com SIGKILL tudo o que o teste subiu. Os sinais não esperam o
   fechamento educado do Playwright, que trava quando o app não responde. */
let guarded=false;
export function guardChildren(){
 if(guarded||WIN)return;
 guarded=true;
 process.on('exit',()=>{killTree(process.pid);});
 for(const [signal,code] of [['SIGTERM',143],['SIGINT',130],['SIGHUP',129]]){
  process.on(signal,()=>{killTree(process.pid);process.exit(code);});
 }
}

/* `app.close()` do Playwright espera o Electron sair e não tem prazo: preso no
   fechamento, o teste trava com ele. Aqui o fechamento tem prazo; estourou,
   o app morre com SIGKILL (árvore e grupo) e o teste reprova dizendo isso — app
   que não fecha é defeito, não detalhe de teste. */
export async function closeApp(app,{timeout=15000}={}){
 if(!app)return;
 /* App que o próprio teste já fechou: o Playwright descartou o objeto e
    `process()` lança. Nada a fechar. */
 let pid;
 try{pid=app.process()?.pid;}catch{return;}
 const closed=app.close().then(()=>true,()=>true);
 let timer;
 const late=new Promise(resolve=>{timer=setTimeout(()=>resolve(false),timeout);});
 const ok=await Promise.race([closed,late]);
 clearTimeout(timer);
 if(ok||!pid)return;
 killTree(pid);
 if(!WIN){try{process.kill(-pid,'SIGKILL');}catch{/* grupo já foi */}}
 try{process.kill(pid,'SIGKILL');}catch{/* já foi */}
 throw Error(`o app não fechou em ${Math.round(timeout/1000)} s; morto com SIGKILL`);
}
