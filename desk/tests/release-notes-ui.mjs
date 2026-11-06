// node tests/release-notes-ui.mjs — a janela de novidades abre uma vez depois de
// atualizar, ensina a instalar e a entrar nas contas, e reabre pelo menu ⚙.
// Instalação nova não a vê. Capturas em /tmp/mesa-capturas-perto.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,freezeMotion,resizeWindow,setTheme} from './helpers.mjs';

const shots='/tmp/mesa-capturas-perto';
fs.mkdirSync(shots,{recursive:true});
const DIALOG='#release-notes-dialog';
const FIXTURE=path.resolve(import.meta.dirname,'fake-opencode-install.cjs');
const NO_PI_PATH=[path.dirname(process.execPath),'/usr/bin','/bin'].join(path.delimiter);

await withArtifacts('release-notes',async ctx=>{
 const runtime=ctx.runtime=newRuntime('release-notes');
 const course=seedCourse(runtime,'calc');
 writeConfigJson(runtime,{vaultPath:runtime,courses:[{id:'calc',name:'Cálculo',path:course}]});
 writeDeskJson(runtime,{courseId:'calc',releaseNotesSeen:'1.0.2'});
 let app=ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_RELEASE_VERSION:'1.1.0'}});
 let page=await app.firstWindow();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await resizeWindow(app,page,1440,900);
 await freezeMotion(page);
 await page.waitForSelector(`${DIALOG}[open]`,{timeout:30000});

 /* B4: o primeiro h2 agora é o título do cabeçalho ("Novidades"); a nota
    da versão segue abaixo, com o OpenCode. */
 assert.equal(await page.locator(`${DIALOG} #release-notes-title`).textContent(),'Novidades');
 assert.match(await page.locator(`${DIALOG} .release-note h2`).first().textContent(),/OpenCode/);
 const logins=await page.locator(`${DIALOG} [data-login]`).evaluateAll(rows=>rows.map(row=>row.dataset.login));
 assert.deepEqual(logins,['go','chatgpt','claude','grok','others'],'os provedores que a janela ensina');
 const commands=await page.locator(`${DIALOG} .release-command code`).allTextContents();
 assert.ok(commands.some(line=>/auth login opencode-go$/.test(line)),'OpenCode Go');
 assert.equal(await page.locator(`${DIALOG} [data-login="go"] .release-signup`).count(),1,'o Go tem onde assinar');
 assert.equal(await page.locator(`${DIALOG} .release-card`).count(),5,'a parte de baixo são cartões curtos');
 assert.ok(commands.some(line=>/auth login openai$/.test(line)),'ChatGPT');
 assert.ok(commands.includes('claude auth login')&&commands.some(line=>/auth login claude-agent$/.test(line)),'Claude: conta e ligação');
 assert.ok(commands.some(line=>/auth login xai$/.test(line)),'Grok');
 assert.equal(await page.locator(`${DIALOG} .release-body`).evaluate(body=>body.scrollWidth<=body.clientWidth),true,'sem rolagem lateral');
 for(const theme of ['light','dark']){
  await setTheme(page,theme);
  await page.locator(`${DIALOG} .release-body`).evaluate(body=>{body.scrollTop=0;});
  await page.locator(DIALOG).screenshot({path:path.join(shots,`novidades-${theme}.png`)});
 }
 /* Captura inteira, sem o corte da altura da janela. */
 await page.addStyleTag({content:`${DIALOG}{max-height:none!important;position:fixed;top:0}.release-body{overflow:visible!important}`});
 await resizeWindow(app,page,1100,1500);
 await page.locator(DIALOG).screenshot({path:path.join(shots,'novidades-inteira.png')});

 await page.locator('#release-close').click();
 await page.waitForFunction(selector=>!document.querySelector(selector),DIALOG);
 await app.close();

 const saved=JSON.parse(fs.readFileSync(path.join(runtime,'desk.json'),'utf8'));
 assert.equal(saved.releaseNotesSeen,'1.1.0','a versão vista fica guardada');

 /* Na partida seguinte, nada de janela sozinha; o menu reabre. */
 app=ctx.app=await launchDesk({runtime,env:{LEARNING_DESK_RELEASE_VERSION:'1.1.0'}});
 page=await app.firstWindow();
 page.on('pageerror',error=>errors.push(error.message));
 await page.waitForSelector('#settings-pop',{state:'attached',timeout:30000});
 await page.waitForFunction(()=>document.querySelector('#session-title')?.textContent?.trim());
 assert.equal(await page.locator(DIALOG).count(),0,'não repete');
  await page.locator('#settings-menu .nav-trigger, #settings-menu button').first().click();
  await page.locator('#settings-pop #release-notes').click();
  await page.waitForSelector(`${DIALOG}[open]`);
  /* B4 (auditoria rodada 8): o cabeçalho tem o × dos outros diálogos, com o
     nome acessível traduzido; o "Entendi" continua e o Esc segue fechando. */
  const dismiss=page.locator('#release-dismiss');
  assert.equal(await dismiss.count(),1,'o × do cabeçalho existe');
  assert.equal(await dismiss.getAttribute('aria-label'),'Fechar','nome acessível em pt-BR');
  await dismiss.click();
  await page.waitForFunction(selector=>!document.querySelector(selector),DIALOG);
  await page.locator('#settings-menu .nav-trigger, #settings-menu button').first().click();
  await page.locator('#settings-pop #release-notes').click();
  await page.waitForSelector(`${DIALOG}[open]`);
  await page.keyboard.press('Escape');
  await page.waitForFunction(selector=>!document.querySelector(selector),DIALOG);
  await page.locator('#settings-menu .nav-trigger, #settings-menu button').first().click();
  await page.locator('#settings-pop #release-notes').click();
  await page.waitForSelector(`${DIALOG}[open]`);
  await page.locator('#release-close').click();
  assert.deepEqual(errors,[]);
 await app.close();

 /* Quem já tem matéria e veio do Pi instala por aqui: o fake nomeado não baixa
    nada nem toca no HOME real. O erro devolve "Tentar de novo". */
 for(const mode of ['error','ok']){
  const other=newRuntime(`release-notes-${mode}`),home=path.join(other,'home');
  fs.mkdirSync(home,{recursive:true});
  const otherCourse=seedCourse(other,'calc');
  writeConfigJson(other,{vaultPath:other,courses:[{id:'calc',name:'Cálculo',path:otherCourse}]});
  writeDeskJson(other,{courseId:'calc',releaseNotesSeen:'1.0.2'});
  app=ctx.app=await launchDesk({runtime:other,opencode:false,env:{HOME:home,USERPROFILE:home,PATH:NO_PI_PATH,LEARNING_DESK_CLAUDE_HOME:'',LEARNING_DESK_OPENCODE_INSTALL_FIXTURE:FIXTURE,LEARNING_DESK_OPENCODE_INSTALL_MODE:mode,LEARNING_DESK_RELEASE_VERSION:'1.1.0'}});
  page=await app.firstWindow();
  page.on('pageerror',error=>errors.push(error.message));
  await page.waitForSelector(`${DIALOG}[open]`,{timeout:30000});
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'release-install','o foco começa em instalar');
  await page.locator('#release-install').click();
  if(mode==='error'){
   await page.waitForSelector('.release-install-error',{timeout:30000});
   assert.equal(await page.locator('#release-install').textContent(),'Tentar de novo');
  }else{
   await page.waitForSelector('.release-install-ok',{timeout:30000});
   assert.equal(await page.locator('#release-install').count(),0,'instalado, o botão sai');
   await page.locator('#release-close').click();
   await page.waitForFunction(selector=>!document.querySelector(selector),DIALOG);
  }
  await app.close();
 }
 assert.deepEqual(errors,[]);
 console.log('ok janela de novidades: abre uma vez, ensina o login, instala e reabre pelo menu');
});
