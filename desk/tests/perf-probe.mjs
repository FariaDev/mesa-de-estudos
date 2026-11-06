// Sonda de desempenho da #67 (opt-in, fora do `npm run ui`): abre a Mesa com
// runtime sintético e Pi de mentira e mede, sem material de curso:
//   launch   tempo até a janela utilizável (página carregada, tutor ligado, campo pronto)
//   pdf      PDF de N páginas nos dois leitores: primeira página pintada, salto
//            ao fim, canvases vivos e heap depois do passeio
//   session  sessão longa do tutor: abrir um histórico de M mensagens, depois K
//            turnos ao vivo; heap (depois de GC) e nós do DOM antes e depois
//   idle     trabalho repetido do renderizador em repouso: deltas do CDP
//            (layouts, recálculos de estilo, tempo de script e de tarefa) em S s
//   tabs     o mesmo repouso em cada aba (matéria, Livre e Caderno)
//   stream   stream longo do tutor com Markdown e KaTeX: CPU e repinturas
//   history  histórico longo carregado, em repouso
//   mascot   Guia aberto na busca sem resultado (a mascote anima)
//   background  repouso visível, escondido e minimizado (pior caso: o Playwright
//            força os interruptores que impedem o throttling)
//   streamHidden  stream com a janela escondida, no mesmo pior caso
//   scroll   rolagem de um PDF longo: CPU, layouts e páginas que entram na vista
//
// A CPU sai em porcentagem de UM núcleo (100 = um núcleo cheio), por processo,
// de `app.getAppMetrics()` e confirmada pelos ticks de /proc no Linux.
//
// Rodar em desk/:  node tests/perf-probe.mjs [--runs 3] [--pages 600] [--history 300]
//                  [--turns 30] [--idle 10] [--scroll 6] [--output arquivo.json]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {performance} from 'node:perf_hooks';
import {launchDesk,newRuntime,seedCourse,seedSession,writeDeskJson,writeConfigJson,statusOnline,sendEnabled} from './helpers.mjs';
import {multiPagePdf} from './synthetic-pdf.mjs';

const require=createRequire(import.meta.url);
const conversations=require('../src/agents/conversations.cjs');
const FAKE_OPENCODE_BIN=path.resolve(import.meta.dirname,'fake-opencode.mjs');

function numberArg(name,fallback){
 const i=process.argv.indexOf(name);
 if(i<0)return fallback;
 const value=Number(process.argv[i+1]);
 assert.ok(Number.isInteger(value)&&value>0,`${name}: recebido ${JSON.stringify(process.argv[i+1])}, esperado inteiro > 0`);
 return value;
}
const RUNS=numberArg('--runs',3),PAGES=numberArg('--pages',600),HISTORY=numberArg('--history',300),TURNS=numberArg('--turns',30),IDLE_S=numberArg('--idle',10),SCROLL_S=numberArg('--scroll',6);
const outIndex=process.argv.indexOf('--output');
const STREAM_FULL=process.argv.includes('--stream-full');
const OUTPUT=outIndex<0?'':path.resolve(process.argv[outIndex+1]);

/* Histórico sintético: fala do aluno e resposta com Markdown e KaTeX, como numa lista. */
function historyMessages(count){
 return Array.from({length:count},(_,i)=>({
  role:i%2===0?'user':'assistant',
  content:[{type:'text',text:i%2===0?`Pergunta ${i/2+1}: como resolvo a questão ${i/2+1}?`:`Comece pela definição.\n\n- passo 1: escreva $f(x)=x^2+${i}$\n- passo 2: derive\n\n$$\\int_0^1 x^{${i}}\\,dx=\\frac{1}{${i+1}}$$\n\nConfira o sinal no fim.`}],
  timestamp:1700000000000+i,
 }));
}
function historyRecords(count){return historyMessages(count).map(message=>({type:'message',message}));}

/* A sessão longa é do OpenCode, o motor do release: o JSONL Pi não é mais
   aberto por `resumeSession` (só leitura na lista), então semear ali mediria
   uma tela vazia. O fake recebe o mesmo histórico no arquivo de seed. */
function seedRuntime(tag,{pages=0,history=0,engine='pi'}={}){
 const runtime=newRuntime(tag),course=seedCourse(runtime,'Sonda');
 const pdfs=pages?['Longo-A.pdf','Longo-B.pdf'].map(name=>{const file=path.join(course,name);fs.writeFileSync(file,multiPagePdf(pages,(n,total)=>`${name} - pagina ${n} de ${total}`));return {path:file,page:1,zoom:1};}):[];
 let session;
 if(engine==='opencode'){
  const messages=historyMessages(history);
  session=conversations.createClaudeConversation({runtime,courseId:'Sonda',engine:'opencode'});
  const nativeId=`ses_${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  conversations.updateClaudeConversation(session,{nativeSessionId:nativeId,nativeEstablished:true,messages,preview:'Sonda'},{runtime});
  const wire=messages.map((message,i)=>({id:`msg${String(i).padStart(8,'0')}`,type:message.role,time:{created:message.timestamp},...(message.role==='user'?{text:message.content[0].text}:{content:message.content})}));
  fs.writeFileSync(path.join(runtime,'opencode-seed.json'),JSON.stringify({sessions:{[nativeId]:{messages:wire}}}));
 }else session=seedSession(runtime,historyRecords(history));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Sonda',name:'Sonda',path:course}],desk:{panels:[{label:'A',prefer:['Longo-A']},{label:'B',prefer:['Longo-B']}]}});
 writeDeskJson(runtime,{courseId:'Sonda',session,pdfs,layoutVersion:1});
 return runtime;
}

/* Sessão OpenCode (o motor do release) para a sonda de stream: o fake de
   `fake-opencode.mjs` responde ao pedido "stream longo" com a resposta de 12
   parágrafos e 24 fórmulas, token a token. */
function seedStreamRuntime(tag){
 const runtime=newRuntime(tag),course=seedCourse(runtime,'Sonda');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Sonda',name:'Sonda',path:course}]});
 const session=conversations.createClaudeConversation({runtime,courseId:'Sonda',engine:'opencode'});
 writeDeskJson(runtime,{courseId:'Sonda',session,layoutVersion:1});
 return runtime;
}
const launchStreamDesk=runtime=>{
 fs.chmodSync(FAKE_OPENCODE_BIN,0o755);
 return launchDesk({runtime,pi:false,env:{LEARNING_DESK_OPENCODE:FAKE_OPENCODE_BIN,FAKE_OPENCODE_STREAM:'long',FAKE_OPENCODE_STREAM_DELTAS:'240',FAKE_OPENCODE_STREAM_DELTA_MS:'25'}});
};
/* Contadores do renderizador do chat: `marked.parse`/`markup` e blocos
   repintados por repintura (a regressão do stream incremental). */
async function rendererStats(page){
 return page.evaluate(async()=>{
  const markdown=await import('./src/markdown.mjs');
  let paint=null;
  try{const stream=await import('./src/chat-stream-view.mjs');paint=stream.streamPaintStats?.()||null;}catch{/* base sem o aplicador incremental */}
  return {paint,markup:markdown.markupStats?.()||null};
 });
}
async function resetRendererStats(page){
 await page.evaluate(async()=>{
  const markdown=await import('./src/markdown.mjs');
  markdown.resetMarkupStats?.();
  try{const stream=await import('./src/chat-stream-view.mjs');stream.resetStreamPaintStats?.();}catch{/* base sem o aplicador incremental */}
 });
}

async function heapAfterGc(page){
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('HeapProfiler.collectGarbage');
 const {usedSize}=await cdp.send('Runtime.getHeapUsage');
 await cdp.detach();
 return {heapMiB:+(usedSize/1048576).toFixed(1),domNodes:await page.evaluate(()=>document.getElementsByTagName('*').length)};
}

/* CPU por processo. `percentCPUUsage` é a média desde a chamada anterior (a
   primeira volta 0); no Linux os ticks de /proc confirmam a leitura. */
async function cpuRead(app){
 return app.evaluate(({app})=>app.getAppMetrics().map(metric=>({pid:metric.pid,type:metric.type,cpu:Math.max(0,metric.cpu?.percentCPUUsage||0)})));
}
const CLK_TCK=Number(process.env.CLK_TCK)||100;
function procTicks(pid){
 try{
  const stat=fs.readFileSync(`/proc/${pid}/stat`,'utf8');
  const fields=stat.slice(stat.lastIndexOf(')')+2).split(' ');
  return Number(fields[11])+Number(fields[12]);
 }catch{return 0;}
}
/* Roda `work` e mede a CPU dos processos do Electron no intervalo. Devolve o
   que `work` devolveu, mais a porcentagem de UM núcleo (100 = um núcleo cheio). */
async function cpuWindow(app,work){
 const before=await cpuRead(app);
 const startTicks=new Map(before.map(metric=>[metric.pid,procTicks(metric.pid)]));
 const started=performance.now();
 const detail=await work();
 const seconds=(performance.now()-started)/1000;
 const after=await cpuRead(app);
 const byType={},procByType={};
 let cpuPct=0,procPct=0,procMs=0;
 for(const metric of after){
  cpuPct+=metric.cpu;byType[metric.type]=(byType[metric.type]||0)+metric.cpu;
  const ticks=Math.max(0,procTicks(metric.pid)-(startTicks.get(metric.pid)||0));
  const pct=ticks/CLK_TCK/seconds*100;
  procPct+=pct;procByType[metric.type]=(procByType[metric.type]||0)+pct;
  procMs+=ticks/CLK_TCK*1000;
 }
 const round=object=>Object.fromEntries(Object.entries(object).map(([key,value])=>[key,+value.toFixed(2)]));
 return {seconds:+seconds.toFixed(1),cpuPct:+cpuPct.toFixed(2),byType:round(byType),procPct:+procPct.toFixed(2),procByType:round(procByType),procMs:Math.round(procMs),...detail};
}
/* Animações rodando na página, por nome: o trabalho repetido que não aparece
   em contador de layout (a faixa do PDF anima no compositor). */
function runningAnimations(page){
 return page.evaluate(()=>{
  const byName={};
  let running=0;
  for(const animation of document.getAnimations()){
   if(animation.playState!=='running')continue;
   running++;
   const name=animation.animationName||animation.constructor.name;
   byName[name]=(byName[name]||0)+1;
  }
  return {running,byName};
 });
}
async function cdpMetrics(page){
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Performance.enable');
 const read=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(metric=>[metric.name,metric.value]));
 const before=await read();
 return {cdp,read,delta:async()=>{const after=await read();await cdp.detach();const out={};for(const key of Object.keys(after))out[key]=after[key]-(before[key]||0);return out;}};
}

function launchRuntime(runtime){
 const seed=path.join(runtime,'opencode-seed.json');
 if(!fs.existsSync(seed))return launchDesk({runtime,env:{LEARNING_VAULT:runtime}});
 fs.chmodSync(FAKE_OPENCODE_BIN,0o755);
 return launchDesk({runtime,pi:false,env:{LEARNING_DESK_OPENCODE:FAKE_OPENCODE_BIN,FAKE_OPENCODE_SEED:seed,LEARNING_VAULT:runtime}});
}
async function withDesk(runtime,run,launch=launchRuntime){
 const started=performance.now();
 const app=await launch(runtime);
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
  const panel=page.locator('.pdf-panel').nth(0);
  await panel.locator('.pager').click();
  const field=panel.locator('.page-number');
  await field.fill(String(PAGES));await field.press('Enter');
  await pagesPainted(page,[[0,PAGES]],60000);
  const jumpMs=Math.round(performance.now()-jumpStarted);
  const canvases=await page.evaluate(()=>[...document.querySelectorAll('.pdf-page canvas')].length);
  return {firstPaintMs,jumpMs,canvases,...await heapAfterGc(page)};
 });
}

async function probeSession(){
 return withDesk(seedRuntime('perf-session',{history:HISTORY,engine:'opencode'}),async(app,started)=>{
  const page=await app.firstWindow();
  await page.waitForFunction(count=>document.querySelectorAll('#messages .message').length>=count,Math.min(HISTORY,40),{timeout:120000});
  const historyMs=Math.round(performance.now()-started);
  await statusOnline(page,{timeout:60000});
  const readyMs=Math.round(performance.now()-started);
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
  return {historyMs,readyMs,msPerTurn,before,after:await heapAfterGc(page)};
 });
}

async function probeIdle(){
 return withDesk(seedRuntime('perf-idle',{pages:8,history:20}),async(app)=>{
  const page=await app.firstWindow();
  await statusOnline(page,{timeout:60000});
  await pagesPainted(page,[[0,1],[1,1]],60000);
  // espera fixa: o aquecimento (compilação, GC) não é o repouso que se mede
  await page.waitForTimeout(2000);
  const metrics=await cdpMetrics(page);
  const result=await cpuWindow(app,()=>page.waitForTimeout(IDLE_S*1000));
  const delta=await metrics.delta();
  return {...result,layouts:delta.LayoutCount,styleRecalcs:delta.RecalcStyleCount,scriptMs:Math.round(delta.ScriptDuration*1000),taskMs:Math.round(delta.TaskDuration*1000),animations:await runningAnimations(page)};
 });
}

/* Repouso em cada aba: matéria, Livre e Caderno. */
async function probeTabs(){
 return withDesk(seedRuntime('perf-tabs',{pages:8,history:20}),async(app)=>{
  const page=await app.firstWindow();
  await statusOnline(page,{timeout:60000});
  await pagesPainted(page,[[0,1],[1,1]],60000);
  const out={};
  for(const [name,id] of [['course','Sonda'],['free','mesa-free'],['review','review']]){
   const tab=page.locator(`#course-tabs button[data-id="${id}"]`);
   if(!(await tab.count()))continue;
   await tab.click();
   // espera fixa: a troca de aba termina antes da janela de repouso
   await page.waitForTimeout(800);
   out[name]=await cpuWindow(app,()=>page.waitForTimeout(IDLE_S*1000));
   out[name].animations=await runningAnimations(page);
  }
  return out;
 });
}

/* Stream longo do tutor (Markdown e KaTeX token a token), no motor OpenCode. */
async function probeStream(){
 return withDesk(seedStreamRuntime('perf-stream'),async(app)=>{
  const page=await app.firstWindow();
  await statusOnline(page,{timeout:60000});
  await sendEnabled(page,{timeout:60000});
  if(STREAM_FULL)await page.evaluate(()=>{globalThis.__mesaStreamFull=true;});
  await resetRendererStats(page);
  const metrics=await cdpMetrics(page);
  const result=await cpuWindow(app,async()=>{
   await page.locator('#prompt').fill('stream longo de teste');
   await page.locator('#send').click();
   await page.waitForFunction(()=>document.querySelector('#send').disabled,undefined,{timeout:10000});
   await page.waitForFunction(()=>([...document.querySelectorAll('#messages .message.assistant .body')].at(-1)?.textContent?.length||0)>200,undefined,{timeout:10000});
   await page.waitForFunction(()=>!document.querySelector('#send').disabled,undefined,{timeout:120000});
   const chars=await page.evaluate(()=>[...document.querySelectorAll('#messages .message.assistant .body')].at(-1)?.textContent?.length||0);
   return {chars};
  });
  const delta=await metrics.delta();
  return {...result,scriptMs:Math.round(delta.ScriptDuration*1000),taskMs:Math.round(delta.TaskDuration*1000),layouts:delta.LayoutCount,styleRecalcs:delta.RecalcStyleCount,animations:await runningAnimations(page),renderer:await rendererStats(page)};
 },launchStreamDesk);
}

/* Stream com a janela escondida, também sem throttling (ver `background`):
   quanto custa repintar o que ninguém está vendo no pior caso. */
async function probeStreamHidden(){
 return withDesk(seedStreamRuntime('perf-stream-hidden'),async(app)=>{
  const page=await app.firstWindow();
  await statusOnline(page,{timeout:60000});
  await sendEnabled(page,{timeout:60000});
  await resetRendererStats(page);
  const windowAction=action=>app.evaluate(({BrowserWindow},action)=>{
   const win=BrowserWindow.getAllWindows().find(item=>!item.isDestroyed()&&item.webContents.getURL().includes('index.html'));
   if(!win)throw Error('janela principal não encontrada');
   if(action==='hide')win.hide();
   else if(action==='show')win.show();
   return {visible:win.isVisible(),minimized:win.isMinimized()};
  },action);
  return cpuWindow(app,async()=>{
   await page.locator('#prompt').fill('stream longo de teste');
   await page.locator('#send').click();
   await page.waitForFunction(()=>([...document.querySelectorAll('#messages .message.assistant .body')].at(-1)?.textContent?.length||0)>200,undefined,{timeout:10000});
   await windowAction('hide');
   // espera fixa: a janela esconde antes da janela de medição
   await page.waitForTimeout(500);
   await page.waitForFunction(()=>!document.querySelector('#send').disabled,undefined,{timeout:120000});
   await windowAction('show');
   const chars=await page.evaluate(()=>[...document.querySelectorAll('#messages .message.assistant .body')].at(-1)?.textContent?.length||0);
   return {chars};
  });
 },launchStreamDesk);
}

/* Histórico longo: o repouso não pode crescer com o número de mensagens. */
async function probeHistory(){
 return withDesk(seedRuntime('perf-history',{history:HISTORY,engine:'opencode'}),async(app)=>{
  const page=await app.firstWindow();
  await page.waitForFunction(count=>document.querySelectorAll('#messages .message').length>=count,Math.min(HISTORY,40),{timeout:120000});
  await statusOnline(page,{timeout:60000});
  // espera fixa: histórico carregado e pintado antes da janela de repouso
  await page.waitForTimeout(1500);
  const result=await cpuWindow(app,()=>page.waitForTimeout(IDLE_S*1000));
  return {...result,animations:await runningAnimations(page),...await heapAfterGc(page)};
 });
}

/* Mascote visível: Guia aberto na busca sem resultado (o ∇ anima). */
async function probeMascot(){
 return withDesk(seedRuntime('perf-mascot'),async(app)=>{
  const page=await app.firstWindow();
  await statusOnline(page,{timeout:60000});
  await page.evaluate(async()=>{const guide=await import('./src/guide.mjs');document.querySelector('#help-dialog').showModal();guide.openGuide();});
  await page.locator('#guide-search').fill('zzzz-sem-resultado');
  await page.waitForFunction(()=>!document.querySelector('#guide-empty').hidden,undefined,{timeout:5000});
  // espera fixa: a montagem da mascote entra antes da janela de repouso
  await page.waitForTimeout(600);
  const result=await cpuWindow(app,()=>page.waitForTimeout(IDLE_S*1000));
  return {...result,animations:await runningAnimations(page)};
 });
}

/* Janela escondida e minimizada no PIOR CASO: o Playwright força os
   interruptores que impedem o throttling, então isto não é o comportamento da
   janela da pessoa (que usa o padrão do Chromium). Serve para ver o custo de
   animação/repintura quando nada é throttlado. */
async function probeBackground(){
 return withDesk(seedRuntime('perf-background',{pages:8}),async(app)=>{
  const page=await app.firstWindow();
  await statusOnline(page,{timeout:60000});
  await pagesPainted(page,[[0,1],[1,1]],60000);
  const windowAction=action=>app.evaluate(({BrowserWindow},action)=>{
   const win=BrowserWindow.getAllWindows().find(item=>!item.isDestroyed()&&item.webContents.getURL().includes('index.html'));
   if(!win)throw Error('janela principal não encontrada');
   if(action==='hide')win.hide();
   else if(action==='show')win.show();
   else if(action==='minimize')win.minimize();
   else if(action==='restore')win.restore();
   return {visible:win.isVisible(),minimized:win.isMinimized()};
  },action);
  const out={};
  out.visible=await cpuWindow(app,()=>page.waitForTimeout(IDLE_S*1000));
  out.visible.visibility=await page.evaluate(()=>document.visibilityState);
  out.visible.animations=await runningAnimations(page);
  await windowAction('hide');
  // espera fixa: a visibilidade da página muda depois do hide
  await page.waitForTimeout(800);
  out.hidden=await cpuWindow(app,()=>page.waitForTimeout(IDLE_S*1000));
  out.hidden.visibility=await page.evaluate(()=>document.visibilityState);
  out.hidden.animations=await runningAnimations(page);
  await windowAction('show');
  await page.waitForTimeout(400);
  await windowAction('minimize');
  // espera fixa: a minimização termina antes da janela de repouso
  await page.waitForTimeout(800);
  out.minimized=await cpuWindow(app,()=>page.waitForTimeout(IDLE_S*1000));
  out.minimized.visibility=await page.evaluate(()=>document.visibilityState);
  out.minimized.animations=await runningAnimations(page);
  await windowAction('restore');
  return out;
 });
}

/* Rolagem de um PDF longo: o custo por gesto e quantas páginas entram na vista. */
async function probeScroll(){
 return withDesk(seedRuntime('perf-scroll',{pages:PAGES}),async(app)=>{
  const page=await app.firstWindow();
  await pagesPainted(page,[[0,1],[1,1]],120000);
  await page.evaluate(()=>{
   const doc=document.querySelector('.pdf-panel .pdf-document');
   window.__perf={rendered:0};
   window.__perf.observer=new MutationObserver(records=>{
    for(const record of records)if(record.target?.dataset?.rendered)window.__perf.rendered++;
   });
   window.__perf.observer.observe(doc,{subtree:true,attributes:true,attributeFilter:['data-rendered']});
  });
  const metrics=await cdpMetrics(page);
  const result=await cpuWindow(app,async()=>{
   const steps=await page.evaluate(ms=>new Promise(resolve=>{
    const box=document.querySelector('.pdf-panel .pdf-viewport');
    const started=performance.now();
    let count=0;
    const tick=()=>{
     if(performance.now()-started>=ms)return resolve(count);
     box.scrollTop+=700;
     count++;
     requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
   }),SCROLL_S*1000);
   return {steps};
  });
  const delta=await metrics.delta();
  const detail=await page.evaluate(()=>{
   const panel=document.querySelector('.pdf-panel');
   const box=panel?.querySelector('.pdf-viewport');
   window.__perf.observer?.disconnect();
   return {rendered:window.__perf.rendered,scrollTop:Math.round(box?.scrollTop||0),pages:panel?.querySelectorAll('.pdf-page').length||0};
  });
  return {...result,...detail,scriptMs:Math.round(delta.ScriptDuration*1000),taskMs:Math.round(delta.TaskDuration*1000),layouts:delta.LayoutCount,styleRecalcs:delta.RecalcStyleCount};
 });
}

const median=values=>[...values].sort((x,y)=>x-y)[Math.floor(values.length/2)];
function summarize(samples){
 if(typeof samples[0]!=='object'||samples[0]===null)return median(samples);
 return Object.fromEntries(Object.keys(samples[0]).map(key=>[key,summarize(samples.map(s=>s[key]))]));
}

const probes={launch:probeLaunch,pdf:probePdf,session:probeSession,idle:probeIdle,tabs:probeTabs,stream:probeStream,history:probeHistory,mascot:probeMascot,background:probeBackground,scroll:probeScroll,streamHidden:probeStreamHidden};
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
