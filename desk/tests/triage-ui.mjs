import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts,launchDesk,tinyPdf,statusOnline,screenshotDirectory,setTheme,freezeMotion,resizeWindow,reviewShot} from './helpers.mjs';
import {createFakeTriageProfile} from './fake-triage-profile.mjs';

/* "Relatar um problema" (#62) na janela real: Mais opções do tutor → o item →
   o diálogo com o relatório limpo e as saídas (Claude/Codex, Pi, OpenCode e a issue). A Mesa roda no perfil
   falso (`fake-triage-profile.mjs`: casa, vault, matérias, PDFs, `auth.json`,
   JSONL e chaves no `desk.log`), e o teste prova que nada disso aparece na
   tela, no que é copiado nem no endereço da issue. A área de transferência é
   um gravador na página (nada vai para a do sistema) e o navegador é o
   `opened-links.jsonl` do modo de teste. O OpenCode falso só responde a
   `--version` e `models`; qualquer outro subcomando fica registrado e reprova
   (o Pi da janela é o `fake-pi.mjs` de sempre: o comando do Pi só é copiado).
   Imagens (claro/escuro, menu e diálogo) só com MESA_REVIEW_SHOTS. */

if(process.platform==='win32'){console.log('SKIP: o perfil falso usa scripts sh');process.exit(0);}

const SHOT_DIR=screenshotDirectory('relatar-problema');

/** @param {string} text @param {string[]} secrets */
function assertClean(text,secrets,where){
 const lower=text.toLowerCase();
 const leaks=secrets.filter(secret=>lower.includes(secret.toLowerCase()));
 assert.deepEqual(leaks,[],`${where}: vazou do perfil falso ${JSON.stringify(leaks)}`);
}

/* Gravador no lugar de `navigator.clipboard.writeText`: o teste lê o que seria copiado. */
async function installClipboardRecorder(page){
 await page.evaluate(()=>{
  window.__triageCopied=[];
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__triageCopied.push(text);}}});
 });
}

async function openTriageFromMenu(page){
 await page.locator('#chat-more').click();
 await page.locator('#more-triage').waitFor();
 await page.locator('#more-triage').click();
 await page.locator('#triage-dialog[open]').waitFor();
 await page.waitForFunction(()=>document.querySelector('#triage-report')?.textContent.includes('## Ambiente'),null,{timeout:60000});
}

function openedLinks(runtime){
 const file=path.join(runtime,'opened-links.jsonl');
 return fs.existsSync(file)?fs.readFileSync(file,'utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line).url):[];
}

await withArtifacts('relatar-problema',async ctx=>{
 const profile=createFakeTriageProfile();
 try{
  for(const pdf of fs.readdirSync(path.join(profile.vault),{recursive:true}).filter(name=>String(name).endsWith('.pdf')))fs.writeFileSync(path.join(profile.vault,String(pdf)),tinyPdf('Lista'));
  ctx.runtime=profile.runtime;
  ctx.app=await launchDesk({runtime:profile.runtime,env:{HOME:profile.home,USERPROFILE:profile.home,LEARNING_CANVAS_DIR:profile.env.LEARNING_CANVAS_DIR}});
  const page=await ctx.app.firstWindow();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await statusOnline(page);
  await resizeWindow(ctx.app,page,1440,900);
  await freezeMotion(page);
  await installClipboardRecorder(page);

  /* O item mora em Mais opções, antes de Recolher o tutor. */
  await page.locator('#chat-more').click();
  const items=await page.locator('#chat-more-pop button[role="menuitem"]').evaluateAll(nodes=>nodes.map(node=>node.id));
  assert.equal(items.at(-2),'more-triage',`ordem do menu: ${items.join(', ')}`);
  assert.equal(items.at(-1),'chat-collapse');
  assert.equal((await page.locator('#more-triage').textContent()).trim(),'Relatar um problema');
  for(const theme of ['light','dark']){await setTheme(page,theme);await reviewShot(page,SHOT_DIR,`menu-${theme}.png`);}
  await page.keyboard.press('Escape');

  await openTriageFromMenu(page);
  const report=await page.locator('#triage-report').textContent();
  assertClean(report,profile.secrets,'relatório na tela');
  assertClean(await page.locator('#triage-dialog').textContent(),profile.secrets,'diálogo');
  assert.match(report,/<matéria 1>/);
  assert.match(report,/\[oculto\]/);
  assert.match(await page.locator('#triage-opencode-note').textContent(),/Usa o modelo grátis opencode\/deepseek-v4\.1-flash-free\. Modelos grátis podem guardar o que recebem/);
  for(const theme of ['light','dark']){await setTheme(page,theme);await reviewShot(page,SHOT_DIR,`dialogo-${theme}.png`);}

  /* Pi: o modelo que a pessoa já usa (recentes e favoritos do seletor), com o aviso de custo. */
  const piModels=await page.locator('#triage-pi-model option').evaluateAll(nodes=>nodes.map(node=>node.value));
  assert.ok(piModels.includes('xai/grok-4')&&piModels.includes('anthropic/claude-sonnet-5-5'),`modelos do Pi: ${piModels.join(', ')}`);
  assert.ok(!piModels.some(model=>model.endsWith('-free')||model==='opencode/big-pickle'),'grátis do Zen não entra no Pi (#57)');
  await page.locator('#triage-pi-model').selectOption('anthropic/claude-sonnet-5-5');
  assert.match(await page.locator('#triage-pi-note').textContent(),/Usa o modelo anthropic\/claude-sonnet-5-5 da sua conta, pelo Pi: pode cobrar/);

  /* Copiar prompt e comandos: o texto copiado também sai limpo. */
  await page.locator('#triage-copy-agent').click();
  await page.locator('#triage-copy-opencode').click();
  await page.locator('#triage-copy-pi').click();
  await page.waitForFunction(()=>window.__triageCopied.length===3);
  const [prompt,command,piCopied]=await page.evaluate(()=>window.__triageCopied);
  assert.match(piCopied,/^pi --model anthropic\/claude-sonnet-5-5 'Você está no repositório/);
  assertClean(piCopied,profile.secrets,'comando do Pi copiado');
  assert.match(prompt,/Faça nesta ordem/);
  assert.match(command,/^opencode run --model opencode\/deepseek-v4\.1-flash-free '/);
  assertClean(prompt,profile.secrets,'prompt copiado');
  assertClean(command,profile.secrets,'comando copiado');
  assert.match(await page.locator('#triage-status').textContent(),/Copiado/);

  /* Abrir issue: só o endereço da issue nova, com o relatório limpo. */
  await page.locator('#triage-open-issue').click();
  await page.waitForFunction(()=>/navegador/.test(document.querySelector('#triage-status')?.textContent||''));
  const links=openedLinks(profile.runtime);
  assert.equal(links.length,1,`links abertos: ${JSON.stringify(links)}`);
  const url=new URL(links[0]);
  assert.equal(`${url.origin}${url.pathname}`,'https://github.com/FariaDev/mesa-e-conversa/issues/new');
  assertClean(`${url.searchParams.get('title')}\n${url.searchParams.get('body')}`,profile.secrets,'issue no navegador');
  assert.equal(fs.existsSync(profile.forbiddenLog),false,'o OpenCode ou o Pi falso receberam um subcomando além de --version/models');

  /* Inglês: o item e o diálogo seguem o idioma da interface. */
  await page.keyboard.press('Escape');
  await page.evaluate(async()=>{const text=await import('./src/ui-text.mjs');text.setUiLanguage('en');});
  await page.locator('#chat-more').click();
  assert.equal((await page.locator('#more-triage').textContent()).trim(),'Report a problem');
  await page.locator('#more-triage').click();
  await page.waitForFunction(()=>document.querySelector('#triage-report')?.textContent.includes('## Ambiente'),null,{timeout:60000});
  assert.equal((await page.locator('#triage-title').textContent()).trim(),'Report a problem');
  assert.match(await page.locator('#triage-opencode-note').textContent(),/Free models may keep what they receive/);
  await reviewShot(page,SHOT_DIR,'dialogo-en-dark.png');

  assert.deepEqual(errors,[],`erros na página: ${errors.join(' | ')}`);
  console.log('PASS: Relatar um problema mostra o relatório limpo e as saídas (Claude/Codex, Pi, OpenCode, issue), sem vazar o perfil');
 }finally{profile.cleanup();}
});
