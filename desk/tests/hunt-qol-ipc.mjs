// Preload/IPC reais e persistência normal em userData temporário, sem override
// de runtime, login ou material pessoal. Inclui File nativo e sessão Livre.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {_electron as electron} from '@playwright/test';
import {DESK,FAKE_PI,tinyPdf,withArtifacts} from './helpers.mjs';
import {ptText} from './pt-text.mjs';
import {testEnv} from './electron-env.mjs';
const free=createRequire(import.meta.url)('../free-workspaces.cjs');
await withArtifacts('qol-ipc',async ctx=>{
 const userData=ctx.runtime=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-qol-userdata-'));
 const runtime=path.join(userData,'runtime'),course=path.join(userData,'materials');
 fs.mkdirSync(course,{recursive:true});fs.mkdirSync(runtime,{recursive:true});
 const base=path.join(course,'Base.pdf'),other=path.join(course,'Other.pdf');
 fs.writeFileSync(base,tinyPdf('Base document'));fs.writeFileSync(other,tinyPdf('Other reader'));
 const dropped=path.join(userData,'External.pdf'),bad=path.join(userData,'Fake.pdf');
 fs.writeFileSync(dropped,tinyPdf('Dropped external document'));fs.writeFileSync(bad,'not a PDF');
 fs.writeFileSync(path.join(userData,'config.json'),JSON.stringify({vaultPath:userData,piPath:FAKE_PI,courses:[{id:'QOL',name:'QOL',path:course}],desk:{panels:[{label:'Base',prefer:['Base']},{label:'Other',prefer:['Other']}]}}));
 fs.writeFileSync(path.join(runtime,'desk.json'),JSON.stringify({courseId:'QOL',pdfs:[{path:base,page:1},{path:other,page:1}]}));
 const record=free.createWorkspace(runtime,{sessionId:'qol-free',title:'Synthetic free workspace'});
 const imported=free.importPdf(runtime,record.id,{sourcePath:other,name:'Free existing.pdf'});
 const entry=path.join(userData,'entry.cjs');
 fs.writeFileSync(entry,`require('electron').app.setPath('userData',__dirname);require(${JSON.stringify(path.join(DESK,'main.cjs'))});`);
 const env=testEnv({LEARNING_DESK_PI:FAKE_PI});
 for(const key of ['LEARNING_DESK_RUNTIME','LEARNING_VAULT','LEARNING_DESK_CLAUDE'])delete env[key];
 async function launch(){
  const app=ctx.app=await electron.launch({args:[entry],cwd:DESK,env});
  const page=await app.firstWindow();
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-page[data-rendered] canvas').length>=2,undefined,{timeout:30000});
  await page.evaluate(()=>{const input=document.createElement('input');input.type='file';input.id='native-drop-file';input.hidden=true;document.body.append(input);});
  return {app,page};
 }
 let {app,page}=await launch();
 await page.locator('#native-drop-file').setInputFiles(dropped);
 const opened=await page.evaluate(()=>window.desk.openDroppedPDF(document.querySelector('#native-drop-file').files[0],1));
 assert.equal(opened.path,dropped);assert.equal(opened.name,'External.pdf');
 assert.ok((await page.evaluate(p=>window.desk.readPDF(p),dropped)).length>100);
 const synthetic=ptText(await page.evaluate(()=>Promise.resolve().then(()=>window.desk.openDroppedPDF(new File(['%PDF-1.7'],'fake.pdf'),0)).then(()=>null,e=>e.message)));
 assert.match(synthetic,/PDF local/);
 await page.locator('#native-drop-file').setInputFiles(bad);
 const invalid=ptText(await page.evaluate(()=>window.desk.openDroppedPDF(document.querySelector('#native-drop-file').files[0],0).then(()=>null,e=>e.message)));
 assert.match(invalid,/cabeçalho PDF/);
 assert.match(ptText(await page.evaluate(p=>window.desk.readPDF(p).then(()=>'',e=>e.message),bad)),/biblioteca|seletor/);
 assert.deepEqual(await page.evaluate(p=>window.desk.pdfPageLabelsSave({path:p,offset:10}),base),{offset:10});
 assert.match(ptText(await page.evaluate(p=>window.desk.pdfPageLabelsSave({path:p,offset:1.5}).then(()=>'',e=>e.message),base)),/inteiro/);
 assert.match(ptText(await page.evaluate(p=>window.desk.pdfPageLabelsGet(p).then(()=>'',e=>e.message),bad)),/biblioteca|seletor/);
 const presetLayout={chatWidth:470,calcHeight:180,pdfSplit:0.6,chatCollapsed:true,calculatorCollapsed:true,referenceVisible:true,minimized:[false,false]};
 const presets=await page.evaluate(layout=>window.desk.layoutPresetsSave({action:'upsert',preset:{name:'Pessoal persistido',layout}}),presetLayout);
 assert.equal(presets.presets.length,1);
 await page.evaluate(async layout=>{
  const {applyViewLayout}=await import('./src/layout-presets.mjs');
  const {save}=await import('./src/state.mjs');applyViewLayout(layout);save(true);
 },presetLayout);
 await page.waitForFunction(()=>window.desk.init().then(data=>data.state.viewLayout?.chatWidth===470));
 await app.close();ctx.app=null;
 ({page}=await launch());
 assert.deepEqual(await page.evaluate(p=>window.desk.pdfPageLabelsGet(p),base),{offset:10});
 const persisted=await page.evaluate(()=>window.desk.layoutPresetsGet());
 assert.deepEqual(persisted,presets,'layouts pessoais persistem em userData normal');
 const restoredView=await page.evaluate(async()=>{
  const {captureViewLayout}=await import('./src/layout-presets.mjs');return captureViewLayout();
 });
 assert.equal(restoredView.chatWidth,470);assert.equal(restoredView.chatCollapsed,true);assert.equal(restoredView.calculatorCollapsed,true);
 await page.evaluate(async firstPdf=>{
  const data=await window.desk.switchCourse('mesa-free');
  const {S,loadCourse,layoutSnapshot}=await import('./src/state.mjs');
  await loadCourse(data);await S.panels[0].load(firstPdf);await window.desk.save(layoutSnapshot());
 },imported.material.path);
 const before=await page.evaluate(()=>window.desk.init());
 assert.equal(before.state.pdfs[0].path,imported.material.path);
 await page.locator('#native-drop-file').setInputFiles(dropped);
 const inFree=await page.evaluate(()=>window.desk.openDroppedPDF(document.querySelector('#native-drop-file').files[0],1));
 assert.notEqual(inFree.path,dropped);assert.ok(fs.realpathSync(inFree.path).startsWith(fs.realpathSync(path.join(runtime,'free'))+path.sep));
 assert.equal(inFree.data.state.pdfs[1].path,inFree.path);
 assert.equal(inFree.data.state.pdfs[0].path,before.state.pdfs[0].path,'drop no leitor 2 preserva o leitor 1');
 assert.deepEqual(fs.readFileSync(inFree.path),fs.readFileSync(dropped));
 assert.equal(path.basename(inFree.path),'External.pdf','extensão não é duplicada no Livre');
 assert.equal(inFree.data.workspace.sessionId,record.id);
 console.log('QOL IPC PASSED: File nativo, validação PDF, numeração/layouts/view persistidos em userData normal e importação no leitor alvo do Livre.');
});
