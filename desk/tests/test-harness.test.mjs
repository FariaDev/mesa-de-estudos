/* O próprio corredor dos testes de janela: nenhum Electron sobra vivo e
   nenhum teste mede a janela errada.

   As fixtures em `fixtures/harness/` sobem um processo que faz o papel do
   Electron do Playwright — grupo de processo próprio e surdo ao SIGTERM, como o
   app preso no fechamento — e o deixam para trás de cada jeito que já
   aconteceu: teste preso no prazo, teste preso que ignora SIGTERM, teste que sai
   sem limpar e teste que reprova. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {runFile} from './run-suite.mjs';
import {closeApp,killLedgerServer} from './proc-tree.mjs';

const require=createRequire(import.meta.url);
const {readEntry,writeEntry,readProcessInfo,processExists,killGroup}=require('../src/agents/opencode-orphans.cjs');

const here=path.dirname(fileURLToPath(import.meta.url));
const FIXTURES=path.join(here,'fixtures','harness');
const unix=process.platform!=='win32';

const childOf=text=>{
 const m=String(text).match(/FILHO (\d+)/);
 assert.ok(m,`a fixture subiu o filho: ${text}`);
 return Number(m[1]);
};
const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
async function gone(pid,ms=3000){
 const end=Date.now()+ms;
 while(Date.now()<end){if(!alive(pid))return true;await new Promise(r=>setTimeout(r,50));}
 return !alive(pid);
}

test('prazo estourado: a guarda do teste mata o Electron surdo ao SIGTERM',{skip:!unix,timeout:30000},async()=>{
 const out=await runFile(FIXTURES,'spawn-test.mjs',{block:'trava',timeout:1500,grace:5000});
 assert.notEqual(out.code,0);
 assert.match(out.text,/estourou o prazo/);
 assert.ok(await gone(childOf(out.text)),'o "Electron" morreu');
});

test('prazo estourado com o teste surdo ao SIGTERM: o corredor mata a árvore com SIGKILL',{skip:!unix,timeout:30000},async()=>{
 const started=Date.now();
 const out=await runFile(FIXTURES,'spawn-test.mjs',{block:'trava-surdo',timeout:1500,grace:1000});
 assert.notEqual(out.code,0);
 assert.ok(Date.now()-started<10000,'não espera o teste preso');
 assert.ok(await gone(childOf(out.text)),'o "Electron" morreu');
});

test('teste que sai sem limpar: o corredor mata o que sobrou e diz quem foi',{skip:!unix,timeout:30000},async()=>{
 const out=await runFile(FIXTURES,'spawn-test.mjs',{block:'sai-sujo',timeout:20000});
 assert.equal(out.code,0);
 const pid=childOf(out.text);
 assert.ok(await gone(pid),'o "Electron" morreu');
 assert.deepEqual(out.orphans,[pid],'o resumo nomeia o processo que sobrou');
});

test('teste que reprova com a guarda: nada sobra para o corredor matar',{skip:!unix,timeout:30000},async()=>{
 const out=await runFile(FIXTURES,'spawn-test.mjs',{block:'sai-guardado',timeout:20000});
 assert.equal(out.code,1);
 assert.ok(await gone(childOf(out.text)),'o "Electron" morreu');
 assert.deepEqual(out.orphans,[],'a guarda limpou antes do corredor');
});

test('closeApp com o app que o teste já fechou não lança',async()=>{
 /* O Playwright descarta o objeto no fechamento: `process()` lança (foi o
    hunt-queue, que fecha e relança o app no meio do roteiro). */
 const closed={process(){throw TypeError("Cannot read properties of undefined (reading '_object')");},close:async()=>{}};
 await closeApp(closed);
});

function firstLine(child,timeoutMs=8000){
 return new Promise((resolve,reject)=>{
  let out='';
  const timer=setTimeout(()=>reject(Error(`o filho não anunciou: ${out}`)),timeoutMs);
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data',chunk=>{out+=chunk;const line=out.split('\n')[0];if(line){clearTimeout(timer);resolve(line);}});
  child.stderr.on('data',chunk=>{out+=chunk;});
  child.on('exit',code=>{clearTimeout(timer);reject(Error(`o filho saiu (${code}): ${out}`));});
 });
}

test('killLedgerServer mata o serve provado pelo ledger e não toca em pid reciclado',{skip:!unix,timeout:20000},async()=>{
 const runtime=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-harness-ledger-'));
 const fake=path.join(here,'fake-opencode-stubborn.mjs');
 const child=spawn(process.execPath,[fake,'serve','--hostname','127.0.0.1','--port','0'],{detached:true,stdio:['ignore','pipe','pipe']});
 const entry=()=>{
  const info=readProcessInfo(child.pid);
  return {pid:child.pid,pgid:child.pid,binary:fake,commandLine:info.commandLine,startTime:info.startTime,
    ownerPid:process.pid,ownerStartTime:readProcessInfo(process.pid)?.startTime||''};
 };
 try{
  await firstLine(child);
  writeEntry(runtime,{...entry(),startTime:'Thu Nov  5 09:00:00 2026'});
  assert.deepEqual(await killLedgerServer(runtime),[],'hora de início diferente: não mata');
  assert.equal(processExists(child.pid),true,'o processo alheio continua vivo');
  writeEntry(runtime,entry());
  assert.deepEqual(await killLedgerServer(runtime),[child.pid]);
  assert.equal(await gone(child.pid),true,'o serve registrado morreu');
 }finally{
  if(child.pid&&processExists(child.pid)){try{killGroup({pid:child.pid,pgid:child.pid,signal:'SIGKILL'});}catch{/* já saiu */}}
  fs.rmSync(runtime,{recursive:true,force:true});
 }
});

test('a guarda de órfão do fake não segura os comandos curtos',{skip:!unix,timeout:15000},async()=>{
 const fake=path.join(here,'fake-opencode.mjs');
 const run=(arg)=>new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[fake,arg],{stdio:['ignore','pipe','pipe'],env:{...process.env,MESA_TEST_OWNER_PID:String(process.pid)}});
  const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error(`${arg} não saiu: a guarda segurou o processo`));},3000);
  child.on('exit',code=>{clearTimeout(timer);resolve(code);});
 });
 assert.equal(await run('--version'),0);
 assert.equal(await run('models'),0);
});

test('fake serve sai quando o processo do teste dono morre',{skip:!unix,timeout:20000},async()=>{
 const runtime=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-harness-owner-'));
 const fake=path.join(here,'fake-opencode.mjs');
 const dead=spawn(process.execPath,['-e','process.exit(0)'],{stdio:'ignore'});
 await new Promise(resolve=>dead.on('exit',resolve));
 const helper=path.join(here,'fake-opencode-orphan-parent.cjs');
 const parent=spawn(process.execPath,[helper,runtime,fake],
  {stdio:['ignore','pipe','pipe'],env:{...process.env,MESA_TEST_OWNER_PID:String(dead.pid),FAKE_OPENCODE_IGNORE_PARENT_DEATH:''}});
 try{
  const pid=Number(JSON.parse(await firstLine(parent)).pid);
  assert.equal(processExists(pid),true);
  assert.equal(await gone(pid,5000),true,'o fake saiu quando o dono do teste morreu, com o pai ainda vivo');
 }finally{
  try{parent.kill('SIGKILL');}catch{/* já saiu */}
  const entry=readEntry(runtime);
  if(entry&&processExists(entry.pid)){try{killGroup({pid:entry.pid,pgid:entry.pid,signal:'SIGKILL'});}catch{/* já saiu */}}
  fs.rmSync(runtime,{recursive:true,force:true});
 }
});

/* A prévia do PDF e a medição das atividades abrem janelas escondidas que
   podem vir antes na lista: a janela da Mesa é a da página
   (`resizeWindow`/`pageWindow` em helpers.mjs). */
test('nenhum teste usa BrowserWindow.getAllWindows()[0]',()=>{
 const offenders=fs.readdirSync(here).filter(f=>/\.(mjs|cjs)$/.test(f)&&f!=='test-harness.test.mjs')
  .filter(f=>/getAllWindows\(\)\s*\[\s*0\s*\]/.test(fs.readFileSync(path.join(here,f),'utf8').replace(/\/\*[\s\S]*?\*\//g,'')));
 assert.deepEqual(offenders,[],'use resizeWindow(app,page,…) ou pageWindow(app,page) de helpers.mjs');
});
