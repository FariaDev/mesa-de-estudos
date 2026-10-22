// Benchmark local com dois PDFs sintéticos e Pi fake; não acessa dados reais.
// node tests/performance-smoke.mjs [--app-dir /payload] [--executable /app/Electron] [--runs 3] [--output /relatorio.json]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {_electron as electron} from '@playwright/test';
import {DESK,FAKE_PI,tinyPdf} from './helpers.mjs';
import {testEnv} from './electron-env.mjs';
function arg(name,fallback){const i=process.argv.indexOf(name);if(i<0)return fallback;assert.ok(process.argv[i+1],`${name} exige um valor`);return process.argv[i+1];}
const appDir=path.resolve(arg('--app-dir',DESK));
const executable=arg('--executable','');
const runs=Number(arg('--runs','3'));
assert.ok(Number.isInteger(runs)&&runs>=1&&runs<=10,'--runs deve estar entre 1 e 10');
const output=arg('--output','');
const samples=[];
for(let run=0;run<runs;run++){
 const runtime=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-performance-'));
 let app;
 try{
  const course=path.join(runtime,'learning','Courses','benchmark');fs.mkdirSync(course,{recursive:true});
  const files=['enunciado.pdf','formulario.pdf'].map((name,i)=>{const file=path.join(course,name);fs.writeFileSync(file,tinyPdf(`Synthetic document ${i+1}`,12));return file;});
  fs.writeFileSync(path.join(runtime,'config.json'),JSON.stringify({vaultPath:path.join(runtime,'learning'),piPath:FAKE_PI,courses:[{id:'benchmark',name:'Benchmark',path:course}],desk:{pinnedExtensions:false,panels:[{label:'Enunciado',prefer:['enunciado']},{label:'Formulario',prefer:['formulario']}]}}));
  fs.writeFileSync(path.join(runtime,'desk.json'),JSON.stringify({courseId:'benchmark',pdfs:files.map(file=>({path:file,page:1}))}));
  const started=performance.now();
  app=await electron.launch({...executable?{executablePath:path.resolve(executable),args:[]}:{args:[path.join(appDir,'main.cjs')]},cwd:appDir,env:testEnv({LEARNING_DESK_RUNTIME:runtime,LEARNING_DESK_PI:FAKE_PI})});
  const page=await app.firstWindow();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-page[data-rendered] canvas').length===2,undefined,{timeout:30000});
  const pdfReadyMs=performance.now()-started;
  const connectStarted=performance.now();await page.evaluate(()=>window.desk.connect());
  const fakePiConnectMs=performance.now()-connectStarted;
  // A conexão pode provocar um novo layout; mede os dois leitores já prontos.
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-page[data-rendered] canvas').length===2,undefined,{timeout:30000});
  const metrics=await app.evaluate(({app})=>app.getAppMetrics().map(p=>({type:p.type,memory:p.memory,cpu:p.cpu})));
  const renderer=await page.evaluate(()=>({jsHeapBytes:performance.memory?.usedJSHeapSize??null,canvasBackingBytes:[...document.querySelectorAll('.pdf-page canvas')].reduce((sum,c)=>sum+c.width*c.height*4,0)}));
  assert.deepEqual(errors,[]);
  samples.push({run:run+1,pdfReadyMs:Math.round(pdfReadyMs),fakePiConnectMs:Math.round(fakePiConnectMs),electronWorkingSetKiB:metrics.reduce((sum,p)=>sum+p.memory.workingSetSize,0),processes:metrics.map(p=>({type:p.type,workingSetKiB:p.memory.workingSetSize})),...renderer});
 }finally{await app?.close();fs.rmSync(runtime,{recursive:true,force:true});}
}
function median(key){const values=samples.map(s=>s[key]).sort((a,b)=>a-b);return values[Math.floor(values.length/2)];}
const report={scenario:'two-synthetic-single-page-pdfs-and-fake-pi',appDir,executable:executable||null,runs,platform:process.platform,arch:process.arch,limitations:'Fresh temporary userData, warm OS caches, hidden test window; memory is summed Electron working sets and excludes the Pi subprocess. No model inference, external GeoGebra, or user documents. pageerror monitoring starts after firstWindow and may miss earlier boot errors.',median:{pdfReadyMs:median('pdfReadyMs'),fakePiConnectMs:median('fakePiConnectMs'),electronWorkingSetKiB:median('electronWorkingSetKiB'),canvasBackingBytes:median('canvasBackingBytes')},samples};
if(output)fs.writeFileSync(path.resolve(output),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
