/* Link de atividade só abre depois de confirmar (#81), na janela real: a
   atividade (gerada pelo modelo, aqui pelo Pi sintético) tem um link https; o
   clique abre o diálogo da Mesa com o domínio de destino, Cancelar não abre e
   Abrir abre. O navegador do sistema vira um registro no processo principal
   (`shell.openExternal`), então nada sai da máquina do teste. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {launchDesk,withArtifacts,DESK,enterFree,freezeMotion} from './helpers.mjs';
import {pollUntil} from './waits.mjs';

await withArtifacts('activity-link-ui',async ctx=>{
 ctx.runtime=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-activity-link-'));
 const pi=path.join(DESK,'tests/fixtures/mesa-interactive-pi.mjs');fs.chmodSync(pi,0o755);
 fs.writeFileSync(path.join(ctx.runtime,'config.json'),JSON.stringify({runtimePath:ctx.runtime,vaultPath:ctx.runtime,courses:[]}));
 ctx.app=await launchDesk({runtime:ctx.runtime,env:{LEARNING_DESK_PI:pi}});
 const page=await ctx.app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await ctx.app.evaluate(({shell})=>{globalThis.__openedLinks=[];shell.openExternal=async url=>{globalThis.__openedLinks.push(url);};});
 const opened=()=>ctx.app.evaluate(()=>globalThis.__openedLinks);
 await enterFree(page);
 await page.evaluate(async()=>{await (await import('./src/state.mjs')).connect();});
 await freezeMotion(page);

 await page.locator('#prompt').fill('Crie uma atividade com link.');
 await page.locator('#send').click();
 await page.locator('.activity-slot .activity-card[data-state="ready"]').waitFor({timeout:12000});
 const frame=page.frames().find(f=>f.url().startsWith('mesa-activity://act-'));
 assert.ok(frame,'o quadro da atividade está na página');
 const dialog=page.locator('#link-dialog');
 /* O clique de verdade (isTrusted) entra pelo teclado: foco no link dentro do
    quadro e Enter. O mouse do Playwright não chega ao iframe do quadro neste
    ambiente (os eventos caem no próprio iframe), e o Enter é o mesmo clique
    que a pessoa faz com Tab + Enter. */
 const activateLink=async()=>{
  await page.evaluate(()=>document.querySelector('iframe.activity-iframe').focus());
  await frame.evaluate(()=>document.querySelector('#ver').focus());
  await page.keyboard.press('Enter');
 };

 /* Cancelar: o diálogo mostra o destino e nada abre. */
 await activateLink();
 await dialog.waitFor({state:'visible'});
 assert.equal(await page.locator('#link-host').textContent(),'exemplo.com','domínio de destino em destaque');
 assert.equal(await page.locator('#link-path').textContent(),'/ver/resposta?caso=1','caminho do destino');
 assert.deepEqual(await opened(),[],'antes da confirmação, nada abre');
 await page.locator('#link-dialog button[value="cancel"]').click();
 await page.waitForFunction(()=>!document.querySelector('#link-dialog').open);
 assert.deepEqual(await opened(),[],'cancelar não abre');

 /* Abrir: o mesmo endereço que foi mostrado chega ao navegador. */
 await activateLink();
 await dialog.waitFor({state:'visible'});
 await page.locator('#link-dialog button[value="ok"]').click();
 await pollUntil(opened,list=>list.length>0,{what:'o link aberto depois do Abrir'});
 assert.deepEqual(await opened(),['https://exemplo.com/ver/resposta?caso=1'],'abre o destino confirmado');
 assert.deepEqual(errors,[],'sem erro na página');
});
