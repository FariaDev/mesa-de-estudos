/* Nomes dos leitores no idioma da interface (auditoria de UI/UX, rodada 7, D1):
   em EN, Ajustes → Leitores mostrava o default em português ("Enunciado")
   enquanto a barra do mesmo leitor mostra "Problems" (e "Formulário" no
   lugar de "Formula sheet"). Aqui se prova na janela real, nos dois temas e
   em 1440×900 e 900×650: com o config em PT e a interface em EN, os campos
   mostram "Problems"/"Formula sheet & support"/"Formula sheet" como a barra;
   salvar sem tocar nos nomes NÃO grava inglês no config.json; nome editado
   de verdade grava o digitado; de volta ao PT, o original aparece.
   Capturas em /tmp/opencode/ui-rodada7-consertos/ (olho humano). */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {_electron as electron} from '@playwright/test';
import {DESK, deskEnv, newRuntime, seedCourse, tinyPdf, writeConfigJson, withArtifacts, freezeMotion, resizeWindow, setTheme} from './helpers.mjs';
import {layoutStable, pollUntil} from './waits.mjs';

const OUT = '/tmp/opencode/ui-rodada7-consertos';
const SIZES = [[1440, 900], [900, 650]];
const THEMES = ['light', 'dark'];
const PT_PANELS = [
  {label: 'Enunciado', prefer: ['Limites'], toggle: ''},
  {label: 'Formulário & apoio', prefer: ['Formul'], toggle: 'Formulário'},
];

await withArtifacts('readers-language', async (ctx) => {
  fs.mkdirSync(OUT, {recursive: true});
  const runtime = ctx.runtime = newRuntime('readers-language');
  const course = seedCourse(runtime, 'calc');
  fs.writeFileSync(path.join(course, 'Limites.pdf'), tinyPdf('Limites'));
  writeConfigJson(runtime, {runtimePath: runtime, vaultPath: runtime, courses: [{id: 'calc', name: 'Cálculo I', path: course}], desk: {panels: PT_PANELS}});
  const configFile = path.join(runtime, 'config.json');
  const readPanels = () => JSON.parse(fs.readFileSync(configFile, 'utf8')).desk.panels;
  /* userData temporário: o Salvar grava de verdade no config.json do teste. */
  const entry = path.join(runtime, 'entry.cjs');
  fs.writeFileSync(entry, `require('electron').app.setPath('userData',__dirname);require(${JSON.stringify(path.join(DESK, 'main.cjs'))});`);
  const launch = () => {
    const env = deskEnv(runtime, {LEARNING_DESK_LOCALE: 'en-US'});
    delete env.LEARNING_DESK_RUNTIME;
    return electron.launch({args: [entry], cwd: DESK, env});
  };
  ctx.app = await launch();
  const page = await ctx.app.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.waitForSelector('.pdf-panel canvas', {timeout: 30000});
  await freezeMotion(page);

  const openSettings = async () => {
    await page.keyboard.press('ControlOrMeta+,');
    await page.waitForSelector('#settings-dialog[open]');
  };
  const closeSettings = async () => {
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#settings-dialog').open);
  };
  const saveSettings = async () => {
    await page.locator('#settings-save').click();
    await page.waitForFunction(() => !document.querySelector('#settings-dialog').open, undefined, {timeout: 15000});
    await page.waitForSelector('.pdf-panel', {timeout: 15000});
  };
  const readerFields = () => page.evaluate(() => ({
    label1: document.querySelector('#cfg-layout-label-1')?.value ?? null,
    label2: document.querySelector('#cfg-layout-label-2')?.value ?? null,
    toggle2: document.querySelector('#cfg-layout-toggle-2')?.value ?? null,
  }));
  const barLabels = () => page.evaluate(() => [...document.querySelectorAll('#pdf-grid .pdf-panel > .pdf-title > strong')].map((el) => el.textContent.trim()));

  /* 1. A barra já traduz; o editor acompanha, nos dois temas e tamanhos. */
  assert.deepEqual(await barLabels(), ['Problems', 'Formula sheet & support'], 'a barra traduz os defaults em EN');
  for (const [width, height] of SIZES) {
    await resizeWindow(ctx.app, page, width, height);
    for (const theme of THEMES) {
      await setTheme(page, theme);
      await layoutStable(page, 'main');
      await openSettings();
      await page.locator('#settings-tab-leitores').click();
      await layoutStable(page, '#settings-dialog');
      const tag = `en ${theme} ${width}x${height}`;
      assert.equal(await page.locator('#settings-title').textContent(), 'Settings', `${tag}: diálogo em inglês`);
      await page.screenshot({path: path.join(OUT, `d1-ajustes-leitores-en-${theme}-${width}x${height}.png`)});
      assert.deepEqual(await readerFields(), {label1: 'Problems', label2: 'Formula sheet & support', toggle2: 'Formula sheet'}, `${tag}: editor mostra o mesmo nome da barra`);
      await closeSettings();
    }
  }

  /* 2. Salvar em EN sem mexer nos nomes não grava inglês no config. */
  await resizeWindow(ctx.app, page, 1440, 900);
  await openSettings();
  await page.locator('#settings-tab-mesa').click();
  await page.locator('#cfg-title').fill('My desk');
  await page.locator('#settings-tab-leitores').click();
  assert.deepEqual(await readerFields(), {label1: 'Problems', label2: 'Formula sheet & support', toggle2: 'Formula sheet'}, 'antes de salvar, o editor segue traduzido');
  await saveSettings();
  assert.deepEqual(readPanels().map((panel) => panel.prefer), [['Limites'], ['Formul']], 'termos preservados após salvar com outra mudança');
  assert.equal(readPanels()[0].label, 'Enunciado', 'o nome do autor continua em português no config.json');
  assert.equal(readPanels()[1].label, 'Formulário & apoio', 'o segundo nome continua em português');
  assert.equal(readPanels()[1].toggle, 'Formulário', 'o atalho continua em português');

  /* 3. De volta ao PT, o original aparece. */
  await openSettings();
  await page.locator('#settings-tab-avisos').click();
  await page.selectOption('#ui-language', 'pt-BR');
  await page.waitForFunction(() => document.documentElement.lang === 'pt-BR', undefined, {timeout: 10000});
  await page.locator('#settings-tab-leitores').click();
  assert.deepEqual(await readerFields(), {label1: 'Enunciado', label2: 'Formulário & apoio', toggle2: 'Formulário'}, 'em PT, os nomes originais aparecem');
  await page.screenshot({path: path.join(OUT, 'd1-ajustes-leitores-pt-light-1440x900.png')});
  await closeSettings();

  /* 4. Nome editado de verdade grava o digitado e vale nos dois idiomas. */
  await openSettings();
  await page.locator('#settings-tab-leitores').click();
  await page.locator('#cfg-layout-label-1').fill('Lista da Ana');
  await page.locator('#cfg-layout-toggle-2').fill('Apoio');
  await saveSettings();
  assert.equal(readPanels()[0].label, 'Lista da Ana', 'nome editado grava o digitado');
  assert.equal(readPanels()[1].toggle, 'Apoio', 'atalho editado grava o digitado');
  await openSettings();
  await page.locator('#settings-tab-leitores').click();
  assert.equal((await readerFields()).label1, 'Lista da Ana', 'em PT, o nome editado aparece como digitado');
  await page.locator('#settings-tab-avisos').click();
  await page.selectOption('#ui-language', 'en');
  await page.waitForFunction(() => document.documentElement.lang === 'en', undefined, {timeout: 10000});
  await page.locator('#settings-tab-leitores').click();
  assert.equal((await readerFields()).label1, 'Lista da Ana', 'em EN, o nome editado passa direto, sem traduzir');
  await pollUntil(() => JSON.parse(fs.readFileSync(path.join(runtime, 'desk.json'), 'utf8')).uiLanguage, (value) => value === 'en', {what: 'uiLanguage "en" em desk.json'});
  await closeSettings();

  assert.deepEqual(errors, [], 'sem erro de página');
  console.log('READERS LANGUAGE UI PASSED: editor traduz os defaults em EN, salvar sem editar preserva o PT, editado grava o digitado.');
});
