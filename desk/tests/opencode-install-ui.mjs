/* Primeira abertura sem motor (#release OpenCode): a tela oferece a instalação
   do OpenCode, mostra o progresso, o erro e a atualização do 1.x, e não fala
   do Pi. O instalador é o fake nomeado (`fake-opencode-install.cjs`); nada
   baixa da rede nem toca no HOME real. Imagens só com MESA_REVIEW_SHOTS. */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,newRuntime,writeConfigJson,tinyPdf,launchDesk,screenshotDirectory,setTheme,freezeMotion,resizeWindow} from './helpers.mjs';

const FIXTURE=path.resolve(import.meta.dirname,'fake-opencode-install.cjs');
const NO_PI_PATH=[path.dirname(process.execPath),'/usr/bin','/bin'].join(path.delimiter);
const SHOT_DIR=screenshotDirectory('instalar-open-code');

async function nextUntil(page,step){
 for(let guard=0;guard<12&&await page.locator('#setup-card').getAttribute('data-step')!==step;guard++)await page.locator('#setup-next').click();
 assert.equal(await page.locator('#setup-card').getAttribute('data-step'),step);
}

async function shot(page,name){
 await page.mouse.move(2,2);
 await page.screenshot({path:path.join(SHOT_DIR,name)});
}

async function shotTrail(page,name){
 await page.mouse.move(2,2);
 const box=await page.locator('#setup-trail').boundingBox();
 const pad=10;
 await page.screenshot({path:path.join(SHOT_DIR,name),clip:{x:Math.max(0,box.x-pad),y:Math.max(0,box.y-pad),width:box.width+pad*2,height:box.height+pad*2}});
}

function shotHash(name){
 return crypto.createHash('sha256').update(fs.readFileSync(path.join(SHOT_DIR,name))).digest('hex');
}

function assertDarkDiffers(names){
 for(const name of names){
  const light=shotHash(`${name}-claro-1440x900.png`),dark=shotHash(`${name}-escuro-1440x900.png`);
  assert.notEqual(light,dark,`${name}: o tema escuro precisa diferir do claro (${light})`);
 }
}

async function toTutor(page,app,pdfs){
 await nextUntil(page,'name');
 await page.locator('#first-run-name').fill('Cálculo I');
 await page.locator('#setup-next').click();
 await app.evaluate(({dialog},paths)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:paths});},[pdfs]);
 await page.locator('#first-run-pick').click();
 await page.waitForFunction(()=>!document.querySelector('#setup-next').disabled);
 await page.locator('#setup-next').click();
 await page.waitForSelector('#setup-pi[data-pi="missing"]');
}

async function scenario(tag,mode){
 const runtime=newRuntime(`opencode-install-${tag}`);
 const home=path.join(runtime,'home');
 const pdfs=path.join(runtime,'pdfs','Calculo');
 fs.mkdirSync(home,{recursive:true});fs.mkdirSync(pdfs,{recursive:true});
 fs.writeFileSync(path.join(pdfs,'Limites.pdf'),tinyPdf('Limites',2));
 writeConfigJson(runtime,{runtimePath:runtime,courses:[]});
 const app=await launchDesk({runtime,pi:false,env:{HOME:home,USERPROFILE:home,PATH:NO_PI_PATH,LEARNING_DESK_CLAUDE_HOME:'',LEARNING_DESK_OPENCODE_INSTALL_FIXTURE:FIXTURE,LEARNING_DESK_OPENCODE_INSTALL_MODE:mode}});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.waitForSelector('body[data-first-run="true"]',{timeout:30000});
 await resizeWindow(app,page,1440,900);
 await freezeMotion(page);
 await toTutor(page,app,pdfs);
 return {app,page,errors,runtime,home,pdfs};
}

await withArtifacts('opencode-install-ui',async ctx=>{
 const ok=await scenario('ok','ok');
 ctx.app=ok.app;ctx.runtime=ok.runtime;
 let page=ok.page;
 const visible=await page.locator('#setup').innerText();
 assert.doesNotMatch(visible,/\bPi\b/,'quem não tem Pi não vê o nome no passo do tutor');
 assert.equal(await page.locator('#setup-codex-grok').isHidden(),true);
 assert.equal(await page.locator('#setup-tutor-actions #install-opencode').textContent(),'Instalar o OpenCode');
 assert.equal(await page.locator('#setup-next').evaluate(el=>el.classList.contains('primary')),false,'Pular por agora fica secundário enquanto instalar é a oferta principal');
 await shot(page,'sem-motor-claro-1440x900.png');
 await shotTrail(page,'etapas-ampliadas-claro.png');
 await setTheme(page,'dark');
 await shot(page,'sem-motor-escuro-1440x900.png');
 await shotTrail(page,'etapas-ampliadas-escuro.png');
 await setTheme(page,'light');

 const sizeBefore=await page.locator('#setup-tutor-actions #install-opencode').evaluate(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height};});
 await page.locator('#setup-tutor-actions #install-opencode').click();
 await page.waitForSelector('#setup-install',{timeout:10000});
 const busy=page.locator('#setup-tutor-actions #install-opencode');
 await busy.waitFor({state:'visible'});
 assert.equal(await busy.isDisabled(),true,'o botão continua no lugar, desabilitado, durante a instalação');
 assert.equal(await busy.textContent(),'Instalar o OpenCode','o botão não troca de rótulo');
 assert.deepEqual(await busy.evaluate(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height};}),sizeBefore,'o botão não muda de tamanho durante a instalação');
 await page.waitForFunction(()=>document.querySelector('.setup-install-percent')?.textContent==='40%');
 // espera fixa: o 12% chega ~300 ms depois; o valor não pode cair
 await page.waitForTimeout(300);
 assert.equal(await page.locator('.setup-install-percent').textContent(),'40%','a barra não volta atrás quando chega um percentual menor');
 assert.match(await page.locator('#setup-install .setup-install-text').textContent(),/Baixando o OpenCode/);
 await shot(page,'instalando-claro-1440x900.png');
 await setTheme(page,'dark');
 await shot(page,'instalando-escuro-1440x900.png');
 await setTheme(page,'light');
 await page.waitForFunction(()=>document.querySelector('.setup-install-text')?.textContent.includes('Instalando'));
 assert.equal(await page.locator('#setup-install progress').evaluate(el=>el.hasAttribute('value')),false,'fase sem percentual usa barra indeterminada');
 assert.equal(await page.locator('.setup-install-percent').textContent(),'','sem percentual, o número esvazia sem empurrar o texto');
 await shot(page,'instalando-fase-claro-1440x900.png');
 await setTheme(page,'dark');
 await shot(page,'instalando-fase-escuro-1440x900.png');
 await setTheme(page,'light');
 await page.waitForSelector('#setup-install-done',{timeout:15000});
 assert.equal(await page.locator('#setup-install-done').textContent(),'OpenCode 2.2.4 instalado.');
 assert.equal(await page.locator('#setup-tutor-actions #connect').textContent(),'Chamar o tutor');
 assert.equal(await page.locator('#setup-tutor-actions #install-opencode').count(),0,'depois de instalar, o botão de instalar sai');
 await shot(page,'instalado-claro-1440x900.png');
 await setTheme(page,'dark');
 await shot(page,'instalado-escuro-1440x900.png');
 await setTheme(page,'light');

 await page.locator('#setup-next').click();
 await page.waitForSelector('#setup-card[data-step="ready"]');
 const login=await page.locator('#setup-ready-login code').textContent();
 assert.match(login,/\/\.opencode\/bin\/opencode auth login$/,'o comando de login mostra o caminho completo do binário instalado');
 await shot(page,'pronto-sem-conta-claro-1440x900.png');
 await setTheme(page,'dark');
 await shot(page,'pronto-sem-conta-escuro-1440x900.png');
 assert.deepEqual(ok.errors,[],'sem erro de página no caminho feliz');
 await ok.app.close();ctx.app=null;

 const bad=await scenario('erro','error');
 ctx.app=bad.app;ctx.runtime=bad.runtime;
 page=bad.page;
 await page.locator('#setup-tutor-actions #install-opencode').click();
 await page.waitForSelector('#setup-install-error',{timeout:10000});
 const error=await page.locator('#setup-install-error').innerText();
 assert.match(error,/Sem conexão/,'o erro tem título curto');
 assert.match(error,/Não deu para baixar o OpenCode\. Confira sua internet e tente de novo\./,'o erro tem uma frase humana');
 assert.doesNotMatch(error,/fixture|sem rede para baixar/,'nenhum texto cru da causa aparece na tela');
 assert.equal(await page.locator('#setup-tutor-actions #install-opencode').textContent(),'Tentar de novo','o erro devolve um botão de tentar de novo');
 await shot(page,'erro-claro-1440x900.png');
 await setTheme(page,'dark');
 await shot(page,'erro-escuro-1440x900.png');
 assert.deepEqual(bad.errors,[],'sem erro de página no caminho de erro');
 await bad.app.close();ctx.app=null;

 const old=await scenario('antigo','ok');
 ctx.app=old.app;ctx.runtime=old.runtime;
 page=old.page;
 await page.evaluate(async()=>{
  const mod=await import('./src/first-run.mjs');
  await mod.enterFirstRun({needsSetup:true,detectedOpenCode:'',detectedOpenCodeOldVersion:'1.19.5',config:{}},{});
 });
 await toTutor(page,old.app,old.pdfs);
 assert.match(await page.locator('#setup-pi').innerText(),/1\.19\.5/);
 assert.equal(await page.locator('#setup-tutor-actions #install-opencode').textContent(),'Atualizar para a 2.2.4');
 await shot(page,'atualizacao-1x-claro-1440x900.png');
 await setTheme(page,'dark');
 await shot(page,'atualizacao-1x-escuro-1440x900.png');
 await setTheme(page,'light');
 /* Regressão: a confirmação pedia {version} e o t() lançava antes de abrir o
    diálogo; o botão de atualizar do 1.x não fazia nada. */
 await page.evaluate(()=>{window.__confirmMsg='';window.confirm=(msg)=>{window.__confirmMsg=msg;return true;};});
 await page.locator('#setup-tutor-actions #install-opencode').click();
 await page.waitForSelector('#setup-install-done',{timeout:30000});
 assert.match(await page.evaluate(()=>window.__confirmMsg),/1\.19\.5/,'a confirmação nomeia a versão antiga');
 assert.equal(await page.locator('#setup-install-done').textContent(),'OpenCode 2.2.4 instalado.');
 assert.deepEqual(old.errors,[],'sem erro de página na atualização');
 await old.app.close();ctx.app=null;

 assertDarkDiffers(['sem-motor','instalando','instalado','pronto-sem-conta','atualizacao-1x','erro']);
});
console.log('ok opencode-install-ui');
