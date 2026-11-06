/* Provedores do OpenCode na janela real (#105), contra o `fake-opencode.mjs`:
   a primeira abertura mostra ChatGPT e Grok, o login OAuth abre o navegador e
   religa o tutor; em Configurações, a chave de API entra, o seletor ganha o
   modelo novo e a chave não aparece em log, DOM, retorno de triagem nem erro.
   Nenhuma conta real é usada. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {withArtifacts,newRuntime,seedCourse,writeDeskJson,writeConfigJson,launchDesk,statusOnline,tinyPdf} from './helpers.mjs';

const require=createRequire(import.meta.url);
const conversations=require('../src/agents/conversations.cjs');
const FAKE_OPENCODE_BIN=path.resolve(import.meta.dirname,'fake-opencode.mjs');
const MODEL={id:'gpt-5.5',providerID:'openai',name:'GPT-5.5',variants:[],cost:[{input:1,output:2}],limit:{context:400000}};
const KEY='sk-teste-mesa-nao-vaza-1234567890';
fs.chmodSync(FAKE_OPENCODE_BIN,0o755);

async function nextUntil(page,step){
 for(let guard=0;guard<12&&await page.locator('#setup-card').getAttribute('data-step')!==step;guard++)await page.locator('#setup-next').click();
 assert.equal(await page.locator('#setup-card').getAttribute('data-step'),step);
}

async function toTutor(page,app,pdfs){
 await page.waitForSelector('#setup-card',{timeout:30000});
 await nextUntil(page,'name');
 await page.locator('#first-run-name').fill('Cálculo I');
 await page.locator('#setup-next').click();
 await app.evaluate(({dialog},paths)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:paths});},[pdfs]);
 await page.locator('#first-run-pick').click();
 await page.waitForFunction(()=>!document.querySelector('#setup-next').disabled);
 await page.locator('#setup-next').click();
 await page.waitForSelector('#setup-card[data-step="tutor"]',{timeout:15000});
}

async function openSettings(page){
 await page.locator('#settings-trigger').click();
 await page.waitForSelector('#settings-pop',{state:'visible',timeout:5000});
 await page.locator('#settings-pop #settings').click();
 await page.locator('#settings-tabs [data-sec="pastas"]').click();
 await page.waitForSelector('#cfg-opencode-providers .op-provider',{timeout:30000});
}

function seeded(tag){
 const runtime=newRuntime(tag),folder=seedCourse(runtime,'Calculo');
 const pdfs=path.join(runtime,'pdfs','Calculo');
 fs.mkdirSync(pdfs,{recursive:true});
 fs.writeFileSync(path.join(pdfs,'Limites.pdf'),tinyPdf('Limites',2));
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calculo',name:'Cálculo',path:folder}]});
 const session=conversations.createClaudeConversation({runtime,courseId:'Calculo',engine:'opencode'});
 writeDeskJson(runtime,{courseId:'Calculo',session,courseStates:{Calculo:{session,sessions:[{path:session}]}}});
 return {runtime,folder,pdfs};
}

async function catalogHas(page,id){
 await page.waitForFunction(async id=>{const {S}=await import('./src/state.mjs');return S.modelCatalog.some(model=>model.id===id);},id,{timeout:30000});
}

await withArtifacts('opencode-providers-ui',async ctx=>{
 /* 1. Primeira abertura: ChatGPT e Grok aparecem; o OAuth do ChatGPT abre o
    navegador, conecta e o tutor liga sozinho com o catálogo novo. */
 const first=ctx.runtime=newRuntime('opencode-providers-primeira');
 const home=path.join(first,'home'),pdfs=path.join(first,'pdfs','Calculo');
 fs.mkdirSync(home,{recursive:true});fs.mkdirSync(pdfs,{recursive:true});
 fs.writeFileSync(path.join(pdfs,'Limites.pdf'),tinyPdf('Limites',2));
 writeConfigJson(first,{runtimePath:first,courses:[]});
 let app=ctx.app=await launchDesk({runtime:first,pi:false,env:{HOME:home,USERPROFILE:home,LEARNING_DESK_OPENCODE:FAKE_OPENCODE_BIN,FAKE_OPENCODE_OAUTH:'complete',FAKE_OPENCODE_OAUTH_POLLS:'1',FAKE_OPENCODE_LOGIN_MODELS:JSON.stringify([MODEL])}});
 let page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.waitForSelector('body[data-first-run="true"]',{timeout:30000});
 await toTutor(page,app,pdfs);
 await page.waitForSelector('#setup-providers .op-provider[data-provider="openai"]',{timeout:30000});
 assert.equal(await page.locator('#setup-providers .op-provider[data-provider="openai"]').getAttribute('data-state'),'off');
 assert.equal(await page.locator('#setup-providers .op-provider[data-provider="xai"]').getAttribute('data-state'),'off');
 assert.equal(await page.locator('#setup-providers .op-provider[data-provider="openai"] [data-action="login"]').count(),1,'ChatGPT tem login por dentro');
 assert.equal(await page.locator('#setup-providers .op-provider[data-provider="xai"] [data-action="login"]').textContent(),'Entrar');
 await page.locator('#setup-providers .op-provider[data-provider="openai"] [data-action="login"]').click();
 await page.waitForSelector('#setup-providers .op-provider[data-provider="openai"][data-state="connected"]',{timeout:30000,state:'attached'});
 await page.waitForFunction(()=>document.querySelector('#setup-next')?.textContent.trim()==='Continuar',undefined,{timeout:60000});
 await catalogHas(page,MODEL.id);
 const opened=fs.readFileSync(path.join(first,'opened-links.jsonl'),'utf8');
 assert.match(opened,/https:\/\/auth\.example\.test\/openai\?code=FAKE-/,'o navegador recebeu o endereço do provedor');
 assert.doesNotMatch(await page.locator('#setup-providers').innerText(),new RegExp(KEY),'a tela não mostra chave');
 assert.deepEqual(errors,[],'primeira abertura sem erro de página');
 await app.close();ctx.app=null;

 /* 2. Configurações: chave de API do ChatGPT entra, o modelo novo aparece no
    catálogo e a chave não vaza para log, DOM, triagem nem erro. */
 const settings=seeded('opencode-providers-config');
 ctx.runtime=settings.runtime;
 app=ctx.app=await launchDesk({runtime:settings.runtime,pi:false,env:{LEARNING_DESK_OPENCODE:FAKE_OPENCODE_BIN,FAKE_OPENCODE_KEY:'accept',FAKE_OPENCODE_LOGIN_MODELS:JSON.stringify([MODEL])}});
 page=await app.firstWindow();
 const settingsErrors=[];page.on('pageerror',error=>settingsErrors.push(error.message));
 await statusOnline(page,{timeout:60000});
 await openSettings(page);
 await page.locator('#cfg-opencode-providers .op-provider[data-provider="openai"] [data-action="key"]').click();
 await page.locator('#cfg-opencode-providers [data-role="key-input"]').fill(KEY);
 await page.locator('#cfg-opencode-providers [data-role="key-input"]').press('Enter');
 await page.waitForSelector('#cfg-opencode-providers .op-provider[data-provider="openai"][data-state="connected"]',{timeout:30000});
 await page.waitForSelector('#cfg-opencode-providers .op-login[data-phase="complete"]',{timeout:30000});
 await catalogHas(page,MODEL.id);
 await statusOnline(page,{timeout:60000});
 const visible=await page.locator('#cfg-opencode-providers').innerText();
 assert.doesNotMatch(visible,new RegExp(KEY),'a chave não fica na tela');
 assert.equal(await page.locator('#cfg-opencode-providers [data-role="key-input"]').count(),0,'o campo da chave sai do DOM');
 const log=fs.readFileSync(path.join(settings.runtime,'desk.log'),'utf8');
 assert.ok(!log.includes(KEY),'a chave não vai para o log');
 const triage=await page.evaluate(()=>window.desk.triageReport({engine:'opencode',model:'gpt-5.5'}));
 assert.ok(!JSON.stringify(triage).includes(KEY),'a chave não vai para o relatório de triagem');
 assert.deepEqual(settingsErrors,[],'Configurações sem erro de página');
 await app.close();ctx.app=null;

 /* 3. Cancelar o OAuth e recusar a chave em Configurações: frases próprias,
    tentativa cancelada e nenhum eco do segredo. */
 const rejected=seeded('opencode-providers-erro');
 ctx.runtime=rejected.runtime;
 app=ctx.app=await launchDesk({runtime:rejected.runtime,pi:false,env:{LEARNING_DESK_OPENCODE:FAKE_OPENCODE_BIN,FAKE_OPENCODE_OAUTH:'pending',FAKE_OPENCODE_KEY:'reject'}});
 page=await app.firstWindow();
 const rejectedErrors=[];page.on('pageerror',error=>rejectedErrors.push(error.message));
 await statusOnline(page,{timeout:60000});
 await openSettings(page);
 await page.locator('#cfg-opencode-providers .op-provider[data-provider="xai"] [data-action="login"]').click();
 await page.waitForSelector('#cfg-opencode-providers .op-login[data-phase="waiting"]',{timeout:30000});
 await page.locator('#cfg-opencode-providers .op-login [data-action="cancel"]').click();
 await page.waitForSelector('#cfg-opencode-providers .op-login[data-phase="cancelled"]',{timeout:15000});
 assert.match(await page.locator('#cfg-opencode-providers .op-login').innerText(),/cancelado/i);
 assert.equal(await page.locator('#cfg-opencode-providers .op-provider[data-provider="xai"]').getAttribute('data-state'),'off');
 await page.locator('#cfg-opencode-providers .op-provider[data-provider="openai"] [data-action="key"]').click();
 await page.locator('#cfg-opencode-providers [data-role="key-input"]').fill(KEY);
 await page.locator('#cfg-opencode-providers [data-role="key-input"]').press('Enter');
 await page.waitForSelector('#cfg-opencode-providers .op-login[data-phase="failed"]',{timeout:30000});
 const failed=await page.locator('#cfg-opencode-providers .op-login').innerText();
 assert.match(failed,/recusou|inválida/i,'a frase diz que a chave foi recusada');
 assert.ok(!failed.includes(KEY),'o erro não ecoa a chave');
 assert.ok(!fs.readFileSync(path.join(rejected.runtime,'desk.log'),'utf8').includes(KEY),'a chave recusada não vai para o log');
 assert.deepEqual(rejectedErrors,[],'erro de login sem erro de página');
 await app.close();ctx.app=null;
});
console.log('ok opencode-providers-ui');
