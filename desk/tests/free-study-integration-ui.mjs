/* Fluxo UI + preload/IPC/host e impressão Electron REAIS, com Pi simulado e
   seletor nativo respondido pelo teste. Sem API Livre simulada, login ou dados
   reais. Runtime/userData sintéticos; roda separado do gate unitário. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {FAKE_PI,launchDesk,tinyPdf,withArtifacts} from './helpers.mjs';

const runtime=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-free-integrated-ui-'));
const piWrap=path.join(runtime,'pi-wrap.mjs');
const cwdLog=path.join(runtime,'pi-cwd.jsonl');
fs.writeFileSync(piWrap,`#!/usr/bin/env node\nimport fs from 'node:fs';\nfs.appendFileSync(${JSON.stringify(cwdLog)},JSON.stringify({cwd:process.cwd(),args:process.argv.slice(2)})+'\\n');\nawait import(${JSON.stringify(pathToFileURL(FAKE_PI).href)});\n`);
fs.chmodSync(piWrap,0o755);
fs.writeFileSync(path.join(runtime,'config.json'),JSON.stringify({runtimePath:runtime,vaultPath:runtime,courses:[],desk:{customPreference:{keep:true},panels:[{label:'Material',customTag:'preservar'}]},customUserValue:'preservar'},null,2));
const original=path.join(runtime,'original.pdf'),originalBytes=tinyPdf('Material original da sessao',3);
fs.writeFileSync(original,originalBytes);
const parent=path.join(runtime,'materias');fs.mkdirSync(parent);
const collision=path.join(parent,'Materia revisada');fs.mkdirSync(collision);fs.writeFileSync(path.join(collision,'nao-substituir.txt'),'preservar');
const launches=()=>fs.readFileSync(cwdLog,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
const stubPicker=(app,paths)=>app.evaluate(({dialog},paths)=>{dialog.showOpenDialog=async()=>({canceled:paths===null,filePaths:paths||[]});},paths);
async function facts(page){return page.evaluate(async()=>{const {S}=await import('./src/state.mjs');return {courseId:S.currentCourseId,session:S.currentSession,workspace:S.workspace,library:S.library,connected:S.connected,busy:S.busy,rotation:S.panels[0]?.rotation,path:S.panels[0]?.path};});}
async function ready(page){await page.waitForFunction(()=>{const S=window.__mesaState;return !S.busy&&!S.connecting&&!S.switching;},undefined,{timeout:30000});}
async function waitSession(page,session){await page.waitForFunction(s=>{const S=window.__mesaState;return S.currentSession===s&&S.connected&&!S.connecting&&!S.switching;},session,{timeout:30000});}
async function connectIfNeeded(page){await page.evaluate(async()=>{const {connect}=await import('./src/state.mjs');await connect();});await ready(page);}
async function boot(ctx){ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_PI:piWrap}});const page=await ctx.app.firstWindow();page.on('dialog',d=>d.accept());await page.waitForSelector('.pdf-panel',{state:'attached'});await page.waitForFunction(()=>typeof window.desk.freePromote==='function');await page.evaluate(async()=>{window.__mesaState=(await import('./src/state.mjs')).S;});await page.waitForTimeout(350);if(await page.locator('#welcome-dialog').evaluate(el=>el.open))await page.keyboard.press('Escape');return page;}

await withArtifacts('free-study-integration-ui',async ctx=>{
 ctx.runtime=runtime;
 let page=await boot(ctx);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 assert.equal(await page.locator('#free-bar').isVisible(),true,'Livre funciona sem configurar matéria');
 assert.equal(await page.locator('#free-empty').isVisible(),true,'sessão avulsa começa sem PDF');
 assert.equal(await page.locator('#course-tabs button[data-id="mesa-free"]').count(),1,'aba fixa não é duplicada');
 assert.equal(await page.evaluate(()=>!!window.deskFreeBridge),false,'APIs livres reais do preload, sem ponte simulada');
 await connectIfNeeded(page);
 const a=await facts(page),sessionA=a.session;
 assert.equal(a.workspace.kind,'free');
 const freeLaunch=launches().at(-1),freeCwd=freeLaunch.cwd;
 assert.ok(freeLaunch.args.includes('--no-context-files'),'sessão Livre não herda contexto de ancestrais');
 assert.ok(!freeLaunch.args.some(arg=>/[\\/]context-mode[\\/]index\.ts$|[\\/](learning-session|code-study-guard|anki-cards)\.ts$/.test(arg)),'perfil real não carrega extensões da matéria no Livre');
 assert.ok(fs.realpathSync(freeCwd).startsWith(fs.realpathSync(path.join(runtime,'free'))+path.sep),'motor inicia no workspace livre');
 await page.locator('#prompt').fill('pensar profundo sobre a sessao A');await page.locator('#send').click();
 await page.waitForFunction(()=>document.querySelector('#messages')?.textContent.includes('É o OD.'),undefined,{timeout:20000});await ready(page);
 assert.match(fs.readFileSync(sessionA,'utf8'),/É o OD\./,'histórico realmente persistido na sessão nativa');
 await page.locator('#free-title').fill('Sessao A');await page.locator('#free-title').press('Enter');
 await page.waitForFunction(()=>{const S=window.__mesaState;return S.workspace?.title==='Sessao A'&&!document.querySelector('#free-title').disabled;});
 await stubPicker(ctx.app,null);await page.locator('#free-empty-open').click();
 await page.waitForFunction(()=>!document.querySelector('#free-open-pdf').disabled);
 assert.equal((await facts(page)).workspace.materials.length,0,'cancelar seleção não importa PDF');
 await stubPicker(ctx.app,[original]);await page.locator('#free-empty-open').click();
 await page.waitForFunction(()=>{const S=window.__mesaState;return S.workspace?.materials?.length===1&&S.panels[0]?.doc&&!!document.querySelector('.pdf-page[data-rendered] canvas');},undefined,{timeout:30000});
 const imported=await facts(page),copy=imported.workspace.materials[0].path;
 assert.notEqual(copy,original,'seleção explícita gera cópia gerenciada');assert.equal(imported.path,copy,'importar abre o PDF automaticamente');assert.deepEqual(fs.readFileSync(copy),originalBytes);assert.deepEqual(fs.readFileSync(original),originalBytes);
 await page.locator('.pdf-panel .rotate').click();await page.waitForFunction(()=>{const S=window.__mesaState;return S.panels[0].rotation===90;});
 await page.locator('#prompt').fill('rascunho A ainda nao enviado');
 await ready(page);await page.locator('#new-session').click();
 await page.waitForFunction(old=>{const S=window.__mesaState;return S.currentSession!==old&&S.connected&&!S.connecting;},sessionA,{timeout:30000});
 const b=await facts(page),sessionB=b.session;
 assert.equal(b.workspace.kind,'free');assert.equal(b.workspace.materials.length,0,'sessão B sem materiais de A');assert.deepEqual(b.library,[]);assert.equal(await page.locator('#prompt').inputValue(),'');assert.equal(await page.locator('#free-empty').isVisible(),true);assert.doesNotMatch(await page.locator('#messages').textContent(),/É o OD\./,'histórico de A não aparece em B');
 assert.match(await page.evaluate(p=>window.desk.readPDF(p).then(()=>'autorizado',e=>e.message),copy),/biblioteca|seletor/i,'PDF de A não é autorizado em B');
 await page.locator('#prompt').fill('rascunho B');
 await page.selectOption('#session-select',sessionA);await waitSession(page,sessionA);
 assert.equal(await page.locator('#prompt').inputValue(),'rascunho A ainda nao enviado');assert.equal((await facts(page)).rotation,90,'orientação isolada volta em A');assert.match(await page.locator('#messages').textContent(),/É o OD\./);
 // Restart por UI: o app volta à mesma sessão com biblioteca/layout/histórico.
 await page.evaluate(async()=>{const {S,layoutSnapshot}=await import('./src/state.mjs');clearTimeout(S.saveTimer);await window.desk.save(layoutSnapshot());});
 await ctx.app.close();ctx.app=null;page=await boot(ctx);page.on('pageerror',e=>errors.push(e.message));await connectIfNeeded(page);
 assert.equal((await facts(page)).session,sessionA);assert.equal((await facts(page)).workspace.title,'Sessao A');assert.equal((await facts(page)).rotation,90);assert.equal(await page.locator('#prompt').inputValue(),'rascunho A ainda nao enviado');assert.match(await page.locator('#messages').textContent(),/É o OD\./);
 // Geração REAL pela prévia editável e confirmação de teclado.
 await page.locator('#free-generate-pdf').click();await page.waitForSelector('#free-pdf-dialog[open]');
 assert.equal(await page.locator('#free-pdf-content').inputValue(),'É o OD.','origem vem do texto cru do histórico');
 await page.locator('#free-pdf-title').fill('Resumo revisado');await page.locator('#free-pdf-content').fill('# Resumo revisado\n\nMaterial verificado pelo usuario.\n\n$$a^2+b^2=c^2$$');
 await page.waitForSelector('#free-pdf-preview .katex');await page.locator('#free-pdf-title').press('Enter');
 await page.waitForFunction(()=>{const S=window.__mesaState;return !document.querySelector('#free-pdf-dialog').open&&S.workspace?.materials?.length===2&&S.panels[0]?.doc&&S.panels[0].path!==S.workspace.materials[0].path;},undefined,{timeout:60000});
 const generated=await facts(page),generatedPath=generated.path;assert.equal(fs.readFileSync(generatedPath).subarray(0,5).toString(),'%PDF-');
 const generatedText=await page.evaluate(async()=>{const {S}=await import('./src/state.mjs');return (await (await S.panels[0].doc.getPage(1)).getTextContent()).items.map(x=>x.str).join(' ');});
 assert.match(generatedText,/Resumo revisado/);assert.match(generatedText,/Material verificado pelo usuario/,'PDF final contém o conteúdo revisado');
 assert.equal(await page.locator('#prompt').inputValue(),'rascunho A ainda nao enviado','gerar não perde rascunho do chat');
 // Cancelar promoção preserva dados; colisão preserva destino existente.
 await page.locator('#free-promote').click();await page.locator('#free-promote-name').fill('Materia revisada');await stubPicker(ctx.app,null);await page.locator('#free-promote-save').click();
 await page.waitForFunction(()=>/cancelada/.test(document.querySelector('#free-promote-error').textContent));assert.equal((await facts(page)).courseId,'mesa-free');assert.equal(fs.readdirSync(parent).length,1);
 await stubPicker(ctx.app,[parent]);await page.locator('#free-promote-save').click();
 await page.waitForFunction(()=>{const S=window.__mesaState;return S.workspace?.kind==='course'&&S.connected&&!S.connecting&&!document.querySelector('#free-promote-save').disabled;},undefined,{timeout:30000});
 const promoted=await facts(page),courseId=promoted.courseId;
 assert.equal(promoted.session,sessionA,'promoção transfere a conversa nativa');assert.match(await page.locator('#messages').textContent(),/É o OD\./,'promoção conserva histórico');assert.equal(await page.locator('#prompt').inputValue(),'rascunho A ainda nao enviado');assert.equal(promoted.library.length,2);assert.equal(await page.locator(`#course-tabs button[data-id="${courseId}"]`).getAttribute('aria-selected'),'true','nova matéria já aparece ativa');
 const cfg=JSON.parse(fs.readFileSync(path.join(runtime,'config.json'),'utf8'));assert.equal(cfg.customUserValue,'preservar');assert.deepEqual(cfg.desk.customPreference,{keep:true});assert.equal(cfg.desk.panels[0].customTag,'preservar');assert.equal(cfg.courses.some(x=>x.id==='mesa-free'),false);
 const newCourse=cfg.courses.find(x=>x.id===courseId);assert.notEqual(newCourse.path,collision);assert.equal(fs.readFileSync(path.join(collision,'nao-substituir.txt'),'utf8'),'preservar');assert.ok(promoted.path.startsWith(newCourse.path+path.sep));
 assert.notEqual(launches().at(-1).cwd,freeCwd,'promoção não reutiliza processo Livre');assert.ok(launches().at(-1).cwd.includes(courseId),'reconexão usa contexto da matéria nova');assert.equal(launches().at(-1).args.includes('--no-context-files'),false,'promoção restaura o perfil normal da matéria');
 await page.locator('#course-tabs button[data-id="mesa-free"]').click();await waitSession(page,sessionB);assert.equal(await page.locator('#session-select').isEnabled(),true,'seletor destrava depois de trocar matéria');assert.equal((await facts(page)).workspace.kind,'free');assert.equal(await page.locator('#prompt').inputValue(),'rascunho B');assert.equal((await facts(page)).library.length,0);
 await page.selectOption('#session-select',sessionA);await waitSession(page,sessionA);assert.equal((await facts(page)).courseId,courseId,'recibo Livre redireciona para matéria promovida');assert.match(await page.locator('#messages').textContent(),/É o OD\./);assert.deepEqual(fs.readFileSync(original),originalBytes,'original continua intacto após todos os fluxos');
 assert.deepEqual(errors,[],'nenhum erro de renderer no fluxo integrado');
});
console.log('free-study-integration-ui: PASS — UI/IPC reais, impressão PDF, isolamento A/B/restart, rotação, cancelamentos e promoção/reconexão; motor Pi simulado.');
