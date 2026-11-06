// node tests/launch-persist-ui.mjs — janela sobe com estado truncado e o estado
// sobrevive a duas aberturas no mesmo runtime (hunts `data-*` e
// `persist-two-launches`, aposentados com o motor Pi).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,newRuntime,seedCourse,tinyPdf,writeConfigJson,writeDeskJson,launchDesk,statusOnline,setTheme,openStudyContext,closeStudyContext} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

const deskOf=runtime=>{try{return JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8'));}catch{return null;}};

/* Truncado sobe: o prompt existe e nenhum erro de página escapa. */
async function bootsTruncated(ctx,tag,{desk,config}){
 const runtime=ctx.runtime=newRuntime('truncado-'+tag);
 const course=seedCourse(runtime,'calc');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'calc',name:'Cálculo',path:course}]});
 fs.writeFileSync(path.join(runtime,'desk.json'),desk);
 if(config!==undefined)fs.writeFileSync(path.join(runtime,'config.json'),config);
 const app=ctx.app=await launchDesk({runtime});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.waitForSelector('#prompt',{timeout:20000});
 await page.waitForFunction(()=>!document.querySelector('#settings-dialog')?.open||true,undefined,{timeout:5000}).catch(()=>{});
 assert.equal(await page.locator('#prompt').count(),1,`${tag}: o prompt existe`);
 assert.deepEqual(errors,[],`${tag}: sem pageerror (${JSON.stringify(errors)})`);
 await app.close();
 ctx.app=null;
}

await withArtifacts('truncado-desk',async ctx=>{
 await bootsTruncated(ctx,'desk',{desk:'{"courseId":"calc","sessions":['});
});

await withArtifacts('truncado-config',async ctx=>{
 await bootsTruncated(ctx,'config',{desk:'{"courseId":"calc"}',config:'{"vaultPath":'});
});

/* Duas aberturas no mesmo runtime: tema, matéria, rascunho e estudo voltam. */
await withArtifacts('duas-aberturas',async ctx=>{
 const runtime=ctx.runtime=newRuntime('duas-aberturas');
 const calc=seedCourse(runtime,'calc');
 const fis=seedCourse(runtime,'fis');
 fs.writeFileSync(path.join(calc,'Limites.pdf'),tinyPdf('Limites e derivadas'));
 fs.writeFileSync(path.join(fis,'Formulario.pdf'),tinyPdf('Formulario e apoio'));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'calc',name:'Cálculo',path:calc},{id:'fis',name:'Física',path:fis}]});
 writeDeskJson(runtime,{courseId:'calc'});
 let app=ctx.app=await launchDesk({runtime});
 let page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await statusOnline(page);
 await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
 await setTheme(page,'dark');
 await page.locator('#course-tabs button[data-id="fis"]').click();
 await page.waitForFunction(()=>document.querySelector('#course-tabs button[data-id="fis"]')?.classList.contains('active'),undefined,{timeout:20000});
 await page.locator('#prompt').fill('rascunho que sobrevive');
 await openStudyContext(page);
 await page.locator('#exercise-title').fill('Lista 9 · questão 3');
 await closeStudyContext(page);
 await pollUntil(()=>deskOf(runtime),desk=>!!desk&&desk.courseId==='fis'&&desk.draft==='rascunho que sobrevive'&&desk.study?.title==='Lista 9 · questão 3',{timeout:15000,what:'tema, matéria, rascunho e estudo em desk.json'});
 await app.close();
 ctx.app=null;

 app=ctx.app=await launchDesk({runtime});
 page=await app.firstWindow();
 page.on('pageerror',error=>errors.push(error.message));
 await page.waitForSelector('.pdf-panel canvas',{timeout:30000});
 await statusOnline(page);
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark','o tema volta');
 assert.equal(await page.locator('#course-tabs button[data-id="fis"]').getAttribute('aria-selected'),'true','a matéria volta');
 assert.equal(await page.locator('#prompt').inputValue(),'rascunho que sobrevive','o rascunho volta');
 await openStudyContext(page);
 assert.equal(await page.locator('#exercise-title').inputValue(),'Lista 9 · questão 3','o estudo volta');
 assert.deepEqual(errors,[],`sem pageerror (${JSON.stringify(errors)})`);
});
console.log('launch-persist-ui: ok');
