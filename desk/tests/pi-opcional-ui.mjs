/* Mesa sem Pi (#93): abre e o tutor conversa com o Claude Code ou o OpenCode
   que já existem. O Pi fica FORA do alcance na janela (PATH mínimo, sem
   LEARNING_DESK_PI, HOME do runtime) e cada cenário usa o fake com nome do
   motor: a fixture do SDK do Claude e o `fake-opencode.mjs`. Nada de Pi real,
   Claude real ou OpenCode real. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,newRuntime,seedCourse,writeDeskJson,writeConfigJson,launchDesk,statusOnline,currentEngine,sendEnabled,openTutorMore,DESK} from './helpers.mjs';
import ptBR from '../src/locales/pt-BR.json' with {type: 'json'};

const FAKE_OPENCODE_BIN=path.resolve(import.meta.dirname,'fake-opencode.mjs');
const CLAUDE_FIXTURE=path.join(DESK,'tests','fixtures','claude-sdk-fake.mjs');
const CLAUDE_TEXT='Resposta de teste do Claude (fixture)';
const OPENCODE_TEXT='Resposta do OpenCode falso';
/* Só o Node que roda o fake entra no PATH; `~/.local/bin` (pi e claude reais)
   fica de fora de propósito. */
const NO_PI_PATH=[path.dirname(process.execPath),'/usr/bin','/bin'].join(path.delimiter);
/* Textos que só fazem sentido com Pi instalado (#93, release OpenCode). Sem
   Pi, nenhum deles pode aparecer na janela, nem como rótulo acessível. */
const PI_TEXTS=['firstrun.tutor.codexGrok','settings.pi.missing','settings.folders.pi','slash.list','component.desc.pi','update.pi','update.piConfirm','update.piRestarting','about.credit.pi','component.nodeTooOld'].map(key=>ptBR[key]);

const visibleAndLabels=page=>page.evaluate(()=>{
 const attributes=[...document.querySelectorAll('[aria-label],[title]')]
  .filter(el=>el.getClientRects().length>0)
  .map(el=>`${el.getAttribute('aria-label')||''}\n${el.getAttribute('title')||''}`)
  .join('\n');
 return `${document.body.innerText}\n${attributes}`;
});

async function assertNoPiTexts(page){
 const check=async label=>{
  const text=await visibleAndLabels(page);
  for(const phrase of PI_TEXTS)assert.ok(!text.includes(phrase),`${label}: sem Pi não aparece "${phrase}"`);
 };
 await check('início');
 await page.keyboard.press('ControlOrMeta+,');
 await page.waitForSelector('#settings-dialog[open]');
 await check('Configurações');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('#settings-dialog').open);
 await page.locator('#prompt').fill('/');
 await page.waitForSelector('#slash-menu:not([hidden])',{timeout:5000});
 await check('menu de comandos');
 await page.keyboard.press('Escape');
 await page.locator('#prompt').fill('');
 await page.evaluate(async()=>{const mod=await import('./src/about-update.mjs');await mod.openAbout();});
 await page.waitForSelector('#about-dialog[open]');
 await page.waitForFunction(()=>{const states=[...document.querySelectorAll('#component-rows .component-state')];return states.length>0&&!states.some(el=>el.textContent==='Verificando…');},undefined,{timeout:15000});
 await check('Sobre');
 await page.locator('#about-dialog .dialog-close').click();
 await page.waitForFunction(()=>!document.querySelector('#about-dialog').open);
}

function claudeTrap(runtime){
 const file=path.join(runtime,'claude-fake.sh');
 fs.writeFileSync(file,['#!/bin/sh',
  'case "$1" in',
  '  --version) echo "2.1.296 (Claude Code)";;',
  '  auth) echo \'{"loggedIn":true,"authMethod":"oauth","apiProvider":"firstParty"}\';;',
  '  *) exit 1;;',
  'esac',''].join('\n'));
 fs.chmodSync(file,0o755);
 return file;
}

async function scenario(ctx,tag,engine,extraEnv,answerText){
 const runtime=ctx.runtime=newRuntime(`pi-opcional-${tag}`);
 const folder=seedCourse(runtime,'Calculo');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calculo',name:'Cálculo',path:folder}]});
 /* Sem `session`: o boot precisa escolher o motor instalado (#93). */
 writeDeskJson(runtime,{courseId:'Calculo'});
 fs.chmodSync(FAKE_OPENCODE_BIN,0o755);
 const engineEnv=engine==='claude'
  ? {LEARNING_DESK_CLAUDE:claudeTrap(runtime),LEARNING_DESK_CLAUDE_SDK_FACTORY:CLAUDE_FIXTURE}
  : {LEARNING_DESK_OPENCODE:FAKE_OPENCODE_BIN};
 const app=ctx.app=await launchDesk({runtime,pi:false,env:{
  HOME:runtime,USERPROFILE:runtime,PATH:NO_PI_PATH,LEARNING_DESK_CLAUDE_HOME:'',
  ...engineEnv,...extraEnv,
 }});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await statusOnline(page,{timeout:60000});
 assert.equal(await currentEngine(page),engine,'o motor padrão é o instalado');
 await page.locator('#new-session').click({button:'right'});
 await page.waitForSelector('#new-session-pop:not([hidden])');
 assert.equal(await page.locator('#new-session-pop #new-session-default').count(),0,'sem Pi, o item Padrão/Pi some do menu');
 assert.equal(await page.locator('#new-session-pop #new-session-opencode').count(),1,'a sessão OpenCode continua explícita');
 const menu=await page.evaluate(()=>{
  const pop=document.querySelector('#new-session-pop'),btn=document.querySelector('#new-session');
  const title=pop.querySelector('.conv-head strong').getBoundingClientRect();
  const first=pop.querySelector('button').getBoundingClientRect();
  const walker=document.createTreeWalker(pop.querySelector('button'),NodeFilter.SHOW_TEXT);
  let text;
  while((text=walker.nextNode())&&!text.textContent.trim());
  const range=document.createRange();range.selectNodeContents(text);
  const label=range.getBoundingClientRect();
  const box=pop.getBoundingClientRect();
  return {gap:box.top-btn.getBoundingClientRect().bottom,inside:box.left>=0&&box.right<=innerWidth&&box.bottom<=innerHeight,titleLeft:title.left,textLeft:label.left,itemHeight:first.height,itemPad:parseFloat(getComputedStyle(pop.querySelector('button')).paddingLeft)};
 });
 assert.ok(menu.gap>=8,`o menu respira abaixo do + (${menu.gap} px)`);
 assert.equal(menu.inside,true,'o menu "Nova sessão com…" não sai da janela');
 assert.ok(Math.abs(menu.titleLeft-menu.textLeft)<=1,`o título alinha com o texto dos itens (${menu.titleLeft} × ${menu.textLeft})`);
 assert.ok(Math.abs(menu.itemHeight-28)<=1,'as linhas mantêm a altura dos outros menus');
 assert.ok(menu.itemPad>=6,'as linhas mantêm o padding dos outros menus');
 await page.keyboard.press('Escape');
 const config=await page.evaluate(()=>window.desk.getConfig());
 assert.equal(config.detectedPi,'','o Pi está fora do alcance da janela');
 assert.deepEqual(await page.evaluate(()=>({settings:document.querySelector('#cfg-pi')?.closest('label')?.hidden,credit:document.querySelector('#about-credit-pi')?.hidden})),{settings:true,credit:true},'sem Pi, a linha das Configurações e o crédito somem');
 await assertNoPiTexts(page);
 const session=await page.evaluate(()=>document.querySelector('#session-title').dataset.session);
 if(engine==='claude')assert.match(path.basename(session),/^claude-[0-9a-f-]{36}\.json$/,'conversa nova nasceu com descritor Claude');
 else assert.match(path.basename(session),/^opencode-[0-9a-f-]{36}\.json$/,'conversa nova nasceu com descritor OpenCode');
 /* Compactação automática é do motor, não da Mesa: o item some do menu; o
    "Resumir agora" (manual) continua. */
 await openTutorMore(page);
 await page.locator('#more-context').click();
 assert.equal(await page.locator('#more-auto-compact').isHidden(),true,'sem controle de compactação automática no motor');
 assert.equal(await page.locator('#more-compact-now').isHidden(),false,'compactação manual continua disponível');
 await page.keyboard.press('Escape');
 await page.locator('#prompt').fill(`Oi, tutor ${tag}`);
 await page.locator('#send').click();
 await page.waitForFunction(text=>[...document.querySelectorAll('.message.assistant .body')].some(el=>el.textContent.includes(text)),answerText,{timeout:30000});
 await sendEnabled(page);
 assert.deepEqual(errors,[],'sem erro de página');
 await app.close();ctx.app=null;
}


/* O motor instalado DEPOIS de a janela abrir (#93): o "+" e o "Chamar de novo"
   não podem continuar presos ao motor da sessão que não existe mais. */
async function lateEngine(ctx,tag,via){
 const runtime=ctx.runtime=newRuntime(`pi-opcional-${tag}`);
 const folder=seedCourse(runtime,'Calculo');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'Calculo',name:'Cálculo',path:folder}]});
 writeDeskJson(runtime,{courseId:'Calculo'});
 fs.chmodSync(FAKE_OPENCODE_BIN,0o755);
 const late=path.join(runtime,'opencode-instalado-depois.mjs');
 const app=ctx.app=await launchDesk({runtime,pi:false,env:{HOME:runtime,USERPROFILE:runtime,PATH:NO_PI_PATH,LEARNING_DESK_CLAUDE_HOME:'',LEARNING_DESK_OPENCODE:late}});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.waitForFunction(()=>document.querySelector('#tutor-state')?.dataset.state==='off',undefined,{timeout:60000});
 assert.equal(await currentEngine(page),'opencode','sem motor, a conversa nova já nasce no OpenCode');
 await page.locator('#new-session').click();
 assert.equal(await page.locator('#new-session-pop #new-session-default').count(),0,'sem Pi, o menu não oferece o Padrão/Pi');
 assert.equal(await page.locator('#new-session-pop #new-session-opencode').count(),1);
 await page.keyboard.press('Escape');
 if(via==='connect'){
  /* Sem OpenCode, a sessão nova já falhou e a tela oferece instalar pelas
     novidades; "Chamar de novo" não repete a mesma falha (#96c61fa). */
  await page.waitForFunction(()=>document.querySelector('#tutor-state')?.dataset.state==='error',undefined,{timeout:60000});
  const clue=await page.locator('#tutor-state').innerText();
  assert.match(clue,/OpenCode não está instalado|OpenCode is not installed/,'a coluna diz qual motor faltou, sem falar do Pi');
  assert.doesNotMatch(clue,/\bPi\b/,'a coluna não fala do Pi');
  assert.equal(await page.locator('#tutor-state #connect').count(),0,'sem OpenCode, "Chamar de novo" não repete a falha');
  await page.locator('#tutor-state #state-opencode-install').click();
  await page.waitForSelector('#release-notes-dialog[open]');
  await page.locator('#release-close').click();
  await page.waitForFunction(()=>!document.querySelector('#release-notes-dialog')?.open);
 }
 fs.copyFileSync(FAKE_OPENCODE_BIN,late);fs.chmodSync(late,0o755);
 /* Sem OpenCode, o estado não oferece "Chamar de novo": depois de instalar,
    a conversa segue numa sessão nova (o caminho do release). */
 await page.locator('#new-session').click();
 await statusOnline(page,{timeout:60000});
 assert.equal(await currentEngine(page),'opencode',`${via}: o motor encontrado agora assume a conversa nova`);
 const session=await page.evaluate(()=>document.querySelector('#session-title').dataset.session);
 assert.match(path.basename(session),/^opencode-[0-9a-f-]{36}\.json$/,'a sessão nova nasceu com descritor OpenCode');
 await page.locator('#prompt').fill('Oi, tutor instalado depois');
 await page.locator('#send').click();
 await page.waitForFunction(text=>[...document.querySelectorAll('.message.assistant .body')].some(el=>el.textContent.includes(text)),OPENCODE_TEXT,{timeout:30000});
 await sendEnabled(page);
 assert.deepEqual(errors,[],'sem erro de página');
 await app.close();ctx.app=null;
}

await withArtifacts('pi-opcional',async ctx=>{
 await scenario(ctx,'claude','claude',{},CLAUDE_TEXT);
 await scenario(ctx,'opencode','opencode',{},OPENCODE_TEXT);
 await lateEngine(ctx,'opencode-depois-plus','plus');
 await lateEngine(ctx,'opencode-depois-retry','connect');
});
console.log('ok pi-opcional-ui');
