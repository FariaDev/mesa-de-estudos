// Sonda de desempenho da #67 (opt-in, fora do `npm run ui`): abre a Mesa com
// runtime sintético e Pi de mentira e mede, sem material de curso:
//   launch   tempo até a janela utilizável (página carregada, tutor ligado, campo pronto)
//   pdf      PDF de N páginas nos dois leitores: primeira página pintada, salto
//            ao fim, canvases vivos e heap depois do passeio
//   session  sessão longa do tutor: abrir um histórico de M mensagens, depois K
//            turnos ao vivo; heap (depois de GC) e nós do DOM antes e depois
//   idle     trabalho repetido do renderizador em repouso: deltas do CDP
//            (layouts, recálculos de estilo, tempo de script e de tarefa) em S s
//
// Rodar em desk/:  node tests/perf-probe.mjs [--runs 3] [--pages 600] [--history 300]
//                  [--turns 30] [--idle 10] [--output arquivo.json]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {launchDesk,newRuntime,seedCourse,seedSession,writeDeskJson,writeConfigJson,statusOnline,sendEnabled} from './helpers.mjs';
import {multiPagePdf} from './synthetic-pdf.mjs';

function numberArg(name,fallback){
 const i=process.argv.indexOf(name);
 if(i<0)return fallback;
 const value=Number(process.argv[i+1]);
 assert.ok(Number.isInteger(value)&&value>0,`${name}: recebido ${JSON.stringify(process.argv[i+1])}, esperado inteiro > 0`);
 return value;
}
const RUNS=numberArg('--runs',3),PAGES=numberArg('--pages',600),HISTORY=numberArg('--history',300),TURNS=numberArg('--turns',30),IDLE_S=numberArg('--idle',10);
const outIndex=process.argv.indexOf('--output');
const OUTPUT=outIndex<0?'':path.resolve(process.argv[outIndex+1]);

/* Histórico sintético: fala do aluno e resposta com Markdown e KaTeX, como numa lista. */
function historyRecords(count){
 return Array.from({length:count},(_,i)=>i%2===0
  ?{type:'message',message:{role:'user',content:[{type:'text',text:`Pergunta ${i/2+1}: como resolvo a questão ${i/2+1}?`}]}}
  :{type:'message',message:{role:'assistant',content:[{type:'text',text:`Comece pela definição.\n\n- passo 1: escreva $f(x)=x^2+${i}$\n- passo 2: derive\n\n$$\\int_0^1 x^{${i}}\\,dx=\\frac{1}{${i+1}}$$\n\nConfira o sinal no fim.`}]}});
}

function seedRuntime(tag,{pages=0,history=0}={}){
 const runtime=newRuntime(tag),course=seedCourse(runtime,'Sonda');
 const pdfs=pages?['Longo-A.pdf','Longo-B.pdf'].map(name=>{const file=path.join(course,name);fs.writeFileSync(file,multiPagePdf(pages,(n,total)=>`${name} - pagina ${n} de ${total}`));return {path:file,page:1,zoom:1};}):[];
 const session=seedSession(runtime,historyRecords(history));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Sonda',name:'Sonda',path:course}],desk:{panels:[{label:'A',prefer:['Longo-A']},{label:'B',prefer:['Longo-B']}]}});
 writeDeskJson(runtime,{courseId:'Sonda',session,pdfs,layoutVersion:1});
 return runtime;
}

async function heapAfterGc(page){
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('HeapProfiler.collectGarbage');
 const {usedSize}=await cdp.send('Runtime.getHeapUsage');
 await cdp.detach();
 return {heapMiB:+(usedSize/1048576).toFixed(1),domNodes:await page.evaluate(()=>document.getElementsByTagName('*').length)};
}

async function withDesk(runtime,run){
 const started=performance.now();
 const app=await launchDesk({runtime,env:{LEARNING_VAULT:runtime}});
 try{return await run(app,started);}
 finally{await app.close().catch(()=>{});fs.rmSync(runtime,{recursive:true,force:true});}
}

async function probeLaunch(){
 return withDesk(seedRuntime('perf-launch'),async(app,started)=>{
  const page=await app.firstWindow();
  const windowMs=performance.now()-started;
  await page.waitForFunction(()=>document.readyState==='complete');
  const loadedMs=performance.now()-started;
  await statusOnline(page,{timeout:60000});
  await sendEnabled(page,{timeout:60000});
  return {windowMs:Math.round(windowMs),loadedMs:Math.round(loadedMs),usableMs:Math.round(performance.now()-started)};
 });
}

/* Espera as páginas `[[leitor, página], …]` pintadas (canvas presente e `data-rendered`). */
const pagesPainted=(page,pairs,timeout)=>page.waitForFunction(list=>list.every(([panel,n])=>!!document.querySelectorAll('.pdf-panel')[panel]?.querySelector(`.pdf-page[data-page="${n}"][data-rendered] canvas`)),pairs,{timeout});

async function probePdf(){
 return withDesk(seedRuntime('perf-pdf',{pages:PAGES}),async(app,started)=>{
  const page=await app.firstWindow();
  await pagesPainted(page,[[0,1],[1,1]],120000);
  const firstPaintMs=Math.round(performance.now()-started);
  const jumpStarted=performance.now();
  const field=page.locator('.pdf-panel').nth(0).locator('.page-number');
  await field.fill(String(PAGES));await field.press('Enter');
  await pagesPainted(page,[[0,PAGES]],60000);
  const jumpMs=Math.round(performance.now()-jumpStarted);
  const canvases=await page.evaluate(()=>[...document.querySelectorAll('.pdf-page canvas')].length);
  return {firstPaintMs,jumpMs,canvases,...await heapAfterGc(page)};
 });
}

async function probeSession(){
 return withDesk(seedRuntime('perf-session',{history:HISTORY}),async(app,started)=>{
  const page=await app.firstWindow();
  await page.waitForFunction(count=>document.querySelectorAll('#messages .message').length>=count,Math.min(HISTORY,40),{timeout:120000});
  const historyMs=Math.round(performance.now()-started);
  await statusOnline(page,{timeout:60000});
  const before=await heapAfterGc(page);
  const turnsStarted=performance.now();
  for(let turn=1;turn<=TURNS;turn++){
   const count=await page.locator('#messages .message.assistant').count();
   await sendEnabled(page,{timeout:60000});
   await page.locator('#prompt').fill(`teorema ${turn}`);
   await page.locator('#send').click();
   await page.waitForFunction(n=>document.querySelectorAll('#messages .message.assistant').length>n,count,{timeout:30000});
  }
  const msPerTurn=Math.round((performance.now()-turnsStarted)/TURNS);
  return {historyMs,msPerTurn,before,after:await heapAfterGc(page)};
 });
}

async function probeIdle(){
 return withDesk(seedRuntime('perf-idle',{pages:8,history:20}),async(app)=>{
  const page=await app.firstWindow();
  await statusOnline(page,{timeout:60000});
  await pagesPainted(page,[[0,1],[1,1]],60000);
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const read=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
  // espera fixa: a janela de medição em repouso é o que se mede
  await page.waitForTimeout(2000);
  const a=await read();
  await page.waitForTimeout(IDLE_S*1000); // espera fixa: janela de medição em repouso
  const b=await read();
  await cdp.detach();
  const delta=key=>b[key]-a[key];
  return {seconds:IDLE_S,layouts:delta('LayoutCount'),styleRecalcs:delta('RecalcStyleCount'),scriptMs:Math.round(delta('ScriptDuration')*1000),taskMs:Math.round(delta('TaskDuration')*1000)};
 });
}

const median=values=>[...values].sort((x,y)=>x-y)[Math.floor(values.length/2)];
function summarize(samples){
 if(typeof samples[0]!=='object'||samples[0]===null)return median(samples);
 return Object.fromEntries(Object.keys(samples[0]).map(key=>[key,summarize(samples.map(s=>s[key]))]));
}

const probes={launch:probeLaunch,pdf:probePdf,session:probeSession,idle:probeIdle};
const only=(process.argv.find(a=>a.startsWith('--only='))||'').slice(7).split(',').filter(Boolean);
const report={pages:PAGES,history:HISTORY,turns:TURNS,runs:RUNS,platform:`${process.platform}-${process.arch}`,median:{},samples:{}};
for(const [name,probe] of Object.entries(probes)){
 if(only.length&&!only.includes(name))continue;
 const samples=[];
 for(let run=0;run<RUNS;run++)samples.push(await probe());
 report.samples[name]=samples;
 report.median[name]=summarize(samples);
 console.log(name,JSON.stringify(report.median[name]));
}
if(OUTPUT)fs.writeFileSync(OUTPUT,JSON.stringify(report,null,2)+'\n');
