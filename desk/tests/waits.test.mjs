/* `waits.mjs` sem Electron: `pollUntil` de verdade e as esperas de página
   contra uma página falsa que só guarda o que recebeu (#48). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {pollUntil,layoutStable,nextFrames,pdfRenderIdle} from './waits.mjs';

/** Página falsa: registra `evaluate`/`waitForFunction` e devolve o que foi pedido. */
class RecordingPage{
 constructor(){this.evaluated=[];this.waited=[];}
 async evaluate(fn,arg){this.evaluated.push({fn:String(fn),arg});return undefined;}
 async waitForFunction(fn,arg,options){this.waited.push({fn:String(fn),arg,options});return true;}
}

test('pollUntil devolve o primeiro valor aprovado',async()=>{
 let reads=0;
 const value=await pollUntil(async()=>++reads,count=>count>=3,{interval:1});
 assert.equal(value,3);
 assert.equal(reads,3);
});

test('pollUntil estoura dizendo o que esperava e o último valor visto',async()=>{
 await assert.rejects(
  pollUntil(()=>'meio',value=>value==='fim',{timeout:20,interval:5,what:'o estado "fim"'}),
  /esperava o estado "fim" em 20 ms; último valor visto: "meio"/
 );
});

test('pollUntil com onTimeout return devolve o último valor em vez de lançar',async()=>{
 const value=await pollUntil(()=>7,count=>count>100,{timeout:15,interval:5,onTimeout:'return'});
 assert.equal(value,7);
});

test('layoutStable zera a memória do seletor e espera por quadros',async()=>{
 const page=new RecordingPage();
 await layoutStable(page,'#chat',{frames:6,timeout:1234});
 assert.equal(page.evaluated[0].arg,'#chat');
 assert.deepEqual(page.waited[0].arg,['#chat',6]);
 assert.deepEqual(page.waited[0].options,{polling:'raf',timeout:1234});
});

test('nextFrames pede a quantidade de quadros à página',async()=>{
 const page=new RecordingPage();
 await nextFrames(page,5);
 assert.equal(page.evaluated[0].arg,5);
});

test('pdfRenderIdle zera a memória e espera por quadros com o prazo dado',async()=>{
 const page=new RecordingPage();
 await pdfRenderIdle(page,{frames:9,timeout:777});
 assert.equal(page.waited[0].arg,9);
 assert.deepEqual(page.waited[0].options,{polling:'raf',timeout:777});
});
