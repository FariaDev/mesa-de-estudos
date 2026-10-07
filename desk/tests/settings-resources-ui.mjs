/* Integração Electron isolada: preferências, persistência e aviso do updater.
   O tutor e a rede são falsos; nunca abre a mesa instalada. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {_electron as electron} from '@playwright/test';
import {DESK,deskEnv,newRuntime,seedCourse,writeConfigJson,writeDeskJson} from './helpers.mjs';
const runtime=newRuntime('settings-resources');
const course=seedCourse(runtime,'Recursos');
const xopp=path.join(course,'rascunho.xopp');fs.writeFileSync(xopp,'fixture');
const panels=[{label:'Lista própria',prefer:['exercicios'],toggle:''}];
writeConfigJson(runtime,{runtimePath:runtime,vaultPath:runtime,courses:[{id:'Recursos',name:'Recursos',path:course}],desk:{title:'Mesa personalizada',panels}});
writeDeskJson(runtime,{courseId:'Recursos',study:{title:'Questão preservada',xopp}});
const fields=['endDay','studyContext','calculator','xournal','conferir','refsToggle'];
// Exercita a persistência normal em userData temporário. O override de runtime
// dos smokes comuns deliberadamente não grava configurações.
const entry=path.join(runtime,'entry.cjs');
fs.writeFileSync(entry,`require('electron').app.setPath('userData',__dirname);require(${JSON.stringify(path.join(DESK,'main.cjs'))});`);
async function launch(){
 const env=deskEnv(runtime);delete env.LEARNING_DESK_RUNTIME;
 return electron.launch({args:[entry],cwd:DESK,env});
}
let app;
async function openSettings(page){
 await page.locator('#mesa-menu .nav-trigger').click();
 await page.locator('#settings').click();
 await page.waitForSelector('#settings-dialog[open]');
}
async function saveSettings(page){
 await page.locator('#settings-save').click();
 await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
 await page.waitForSelector('.pdf-panel');
}
try{
 app=await launch();
 let page=await app.firstWindow();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.waitForSelector('.pdf-panel');
 assert.deepEqual(await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(el=>el.id);return ids.filter((id,i)=>ids.indexOf(id)!==i);}),[],'IDs únicos');
 await page.locator('#exercise-title').fill('Questão preservada');
 await page.waitForTimeout(500);
 await openSettings(page);
 for(const key of fields)assert.equal(await page.locator('#cfg-desk-'+key).isChecked(),true);
 assert.equal(await page.locator('#cfg-title').inputValue(),'Mesa personalizada');
 await page.locator('#cfg-desk-endDay').uncheck();
 await page.locator('#settings-dialog button[value="cancel"]').last().click();
 await openSettings(page);
 assert.equal(await page.locator('#cfg-desk-endDay').isChecked(),true,'Cancelar descarta flags');
 for(const key of fields)await page.locator('#cfg-desk-'+key).uncheck();
 await page.locator('#cfg-title').fill('Minha mesa');
 await saveSettings(page);
 assert.equal(await page.locator('#study-context').isHidden(),true);
 assert.equal(await page.locator('#calculator').isHidden(),true);
 assert.equal(await page.locator('#check').isHidden(),true);
 assert.equal(await page.locator('#include-refs').isHidden(),true);
 assert.equal(await page.locator('#exercise-title').inputValue(),'Questão preservada','esconder preserva estudo');
 assert.doesNotMatch(await page.locator('#context-summary').textContent(),/Questão preservada/);
 await page.locator('#study-menu .nav-trigger').click();
 assert.equal(await page.locator('#end-day').isHidden(),true);
 assert.equal(await page.locator('#xournal').isHidden(),true);
 await page.keyboard.press('Escape');
 let cfg=JSON.parse(fs.readFileSync(path.join(runtime,'config.json'),'utf8'));
 for(const key of fields)assert.equal(cfg.desk[key],false);
 assert.deepEqual(cfg.desk.panels,panels,'painéis personalizados preservados');
 await app.close();app=null;
 app=await launch();page=await app.firstWindow();
 page.on('pageerror',e=>errors.push(e.message));
 await page.waitForSelector('.pdf-panel');
 await openSettings(page);
 for(const key of fields)assert.equal(await page.locator('#cfg-desk-'+key).isChecked(),false,'persistiu '+key);
 assert.equal(await page.locator('#cfg-title').inputValue(),'Minha mesa');
 for(const key of fields)await page.locator('#cfg-desk-'+key).check();
 await saveSettings(page);
 assert.equal(await page.locator('#study-context').isVisible(),true);
 assert.equal(await page.locator('#exercise-title').inputValue(),'Questão preservada','reativar restaura estudo');
 assert.equal(await page.locator('#pick-xopp').getAttribute('data-path'),xopp,'associação xopp sobrevive a desativar/reabrir/reativar');
 assert.equal(await page.locator('#calculator').isVisible(),true);
 await app.evaluate(({ipcMain,BrowserWindow})=>{
  ipcMain.removeHandler('update-check');
  ipcMain.handle('update-check',()=>({status:'update',version:'9.9.9',notes:'Versão de teste',url:''}));
  BrowserWindow.getAllWindows()[0].webContents.send('update-available',{version:'9.9.9'});
 });
 await page.locator('#update-notice').waitFor({state:'visible'});
 assert.equal(await page.locator('#update-notice').isVisible(),true);
 await page.waitForTimeout(4500);
 assert.equal(await page.locator('#update-notice').isVisible(),true,'aviso persiste além do toast');
 await page.locator('#update-notice').click();
 await page.waitForSelector('#about-dialog[open]');
 await page.waitForSelector('#update-apply');
 assert.match(await page.locator('#about-update').textContent(),/9\.9\.9/);
 await page.keyboard.press('Escape');
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(900,650));
 await page.locator('#update-notice').click();
 await page.waitForSelector('#about-dialog[open]');
 await page.keyboard.press('Escape');
 await openSettings(page);
 await page.locator('[data-sec="mesa"]').scrollIntoViewIfNeeded();
 await page.screenshot({path:path.join(runtime,'settings.png')});
 await page.keyboard.press('Escape');
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:path.join(runtime,'update.png')});
 assert.equal(await page.locator('#update-notice').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),true,'aviso cabe na janela');
 await app.evaluate(({ipcMain})=>{
  ipcMain.removeHandler('update-check');ipcMain.handle('update-check',()=>({status:'current',current:'9.9.9'}));
 });
 await page.locator('#update-notice').click();
 await page.waitForFunction(()=>document.querySelector('#update-notice').hidden);
 assert.deepEqual(errors,[]);
 console.log('PASSED: cancelar, salvar, persistir, reativar, preservar painéis/questão e aviso clicável/persistente (900×650).');
 console.log('Screenshots:',runtime);
}finally{if(app)await app.close();}
