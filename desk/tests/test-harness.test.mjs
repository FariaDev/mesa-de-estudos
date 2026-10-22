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
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runFile} from './run-suite.mjs';
import {closeApp} from './proc-tree.mjs';

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
    hunt-calc-ggb, que fecha e relança o app no meio do roteiro). */
 const closed={process(){throw TypeError("Cannot read properties of undefined (reading '_object')");},close:async()=>{}};
 await closeApp(closed);
});

/* A prévia do PDF e a medição das atividades abrem janelas escondidas que
   podem vir antes na lista: a janela da Mesa é a da página
   (`resizeWindow`/`pageWindow` em helpers.mjs). */
test('nenhum teste usa BrowserWindow.getAllWindows()[0]',()=>{
 const offenders=fs.readdirSync(here).filter(f=>/\.(mjs|cjs)$/.test(f)&&f!=='test-harness.test.mjs')
  .filter(f=>/getAllWindows\(\)\s*\[\s*0\s*\]/.test(fs.readFileSync(path.join(here,f),'utf8').replace(/\/\*[\s\S]*?\*\//g,'')));
 assert.deepEqual(offenders,[],'use resizeWindow(app,page,…) ou pageWindow(app,page) de helpers.mjs');
});
