/* E4 (auditoria rodada 3): a aba Compartilhar do Backup só tem ações
   (Exportar/Importar + "Incluir sessões", que vale por exportação) e nenhum
   campo salvo pelo "Salvar ajustes" — o botão não aparece nela, e segue
   aparecendo em Backup e Restaurar. Captura em
   /tmp/opencode/ui-auditoria/e3-e4 (antes da asserção, para a rodada do
   "antes" também deixar PNG). */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withArtifacts, newRuntime, seedCourse, writeConfigJson, writeDeskJson, launchDesk, statusOnline, resizeWindow, freezeMotion, tinyPdf} from './helpers.mjs';

const OUT = '/tmp/opencode/ui-auditoria/e3-e4';
fs.mkdirSync(OUT, {recursive: true});

await withArtifacts('backup-share', async (ctx) => {
  const runtime = ctx.runtime = newRuntime('e4-share');
  const course = seedCourse(runtime, 'calc');
  fs.writeFileSync(path.join(course, 'Limites.pdf'), tinyPdf('Limites e derivadas'));
  writeConfigJson(runtime, {runtimePath: runtime, vaultPath: runtime, courses: [{id: 'calc', name: 'Cálculo I', path: course}]});
  writeDeskJson(runtime, {courseId: 'calc', courseStates: {calc: {pdfs: [{path: path.join(course, 'Limites.pdf'), page: 1}], study: {title: '', xopp: ''}}}});
  const app = ctx.app = await launchDesk({runtime});
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await resizeWindow(app, page, 1440, 900);
  await statusOnline(page, {timeout: 60000});
  await freezeMotion(page);
  await page.waitForSelector('.pdf-panel canvas', {timeout: 30000});

  await page.locator('#study-menu .nav-trigger').click();
  await page.locator('#study-menu #study-share-open').click();
  await page.waitForSelector('#mesa-backup-panel[open]', {timeout: 15000});
  const save = page.locator('#mesa-backup-panel [data-bkp-save]');
  await page.screenshot({path: path.join(OUT, 'e4-compartilhar-depois-1440x900.png')});
  assert.ok(!(await save.isVisible()), 'Compartilhar não mostra "Salvar ajustes"');

  await page.locator('#mesa-backup-panel [data-bkp-nav="backup"]').click();
  assert.ok(await save.isVisible(), 'Backup mantém "Salvar ajustes"');
  await page.locator('#mesa-backup-panel [data-bkp-nav="restaurar"]').click();
  assert.ok(await save.isVisible(), 'Restaurar mantém "Salvar ajustes"');
  await page.keyboard.press('Escape');
  assert.deepEqual(errors, [], 'sem erro de página');
});
console.log('ok backup-share-ui');
