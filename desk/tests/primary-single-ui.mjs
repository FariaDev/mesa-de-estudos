/* Um único primário por contexto (auditoria de UI/UX, rodada 4, F5; revisão
   rodada 5): em cada contexto visual (diálogo do Backup, Ajustes com
   provedores, fileira do composer, estados do tutor) o teste cobra a contagem
   EXATA — 1 onde há ação principal, 0 onde não há — e diz porquê. A versão
   antiga (`<= 1`) passava com ZERO primários, ou seja, deixava passar a falta
   da ação principal; a exata pega. O teste resolve as cores de acento
   (`--primary`, `--accent-fill`) no navegador e conta, por contexto, os
   botões visíveis e habilitados cujo fundo computado é uma delas — sem ler
   folha como texto. Cobre 900 e 1440, claro e escuro. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {_electron as electron} from '@playwright/test';
import {withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,freezeMotion,resizeWindow,setTheme,tinyPdf,DESK,deskEnv} from './helpers.mjs';
import {settle} from './layout-measure.mjs';

function countPrimaries(page, root) {
  return page.evaluate((sel) => {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden';
    document.body.append(probe);
    const accents = new Set(['--primary', '--accent-fill'].map((v) => {
      probe.style.color = `var(${v})`;
      return getComputedStyle(probe).color;
    }));
    probe.remove();
    const scope = sel ? document.querySelector(sel) : document;
    if (!scope) return {primaries: [], total: 0};
    const buttons = [...scope.querySelectorAll('button')].filter((el) => {
      /* Desligado conta: o preenchimento continua à vista (o Backup mostra o
         "Fazer backup agora" azul mesmo sem destino). */
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      if (el.closest('[hidden]')) return false;
      return true;
    });
    const primaries = buttons.filter((el) => accents.has(getComputedStyle(el).backgroundColor))
      .map((el) => (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40));
    return {primaries, total: buttons.length};
  }, root);
}

await withArtifacts('primary-single', async (ctx) => {
  const runtime = ctx.runtime = newRuntime('primary-single');
  const course = seedCourse(runtime, 'calc');
  const pdf = path.join(course, 'Limites.pdf');
  const {writeFileSync} = await import('node:fs');
  writeFileSync(pdf, tinyPdf('Limites e derivadas'));
  writeConfigJson(runtime, {runtimePath: runtime, vaultPath: runtime, courses: [{id: 'calc', name: 'Cálculo I', path: course}]});
  writeDeskJson(runtime, {courseId: 'calc', courseStates: {calc: {pdfs: [{path: pdf, page: 1}], study: {title: '', xopp: ''}}}});
  ctx.app = await launchDesk({runtime, env: {FAKE_OPENCODE_KEY: 'reject'}});
  const page = await ctx.app.firstWindow();
  await statusOnline(page);
  await freezeMotion(page);
  await page.waitForSelector('.pdf-panel canvas', {timeout: 30000});
  for (const [width, height] of [[1440, 900], [900, 650]]) {
    await resizeWindow(ctx.app, page, width, height);
    const tag = `${width}x${height}`;
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      await settle(page);
      /* Backup, nas três abas. A ação principal é o Salvar do rodapé (aplica e
         fecha o diálogo); as ações de cada aba (Fazer backup agora, listar,
         exportar…) são secundárias. Na aba compartilhar não há o que salvar
         (exportar e importar são ações avulsas), então o Salvar se esconde de
         propósito e o esperado é 0. */
      await page.locator('#study-menu .nav-trigger').click();
      await page.locator('#study-menu #study-backup-open').click();
      await page.waitForSelector('#mesa-backup-panel[open]', {timeout: 15000});
      const backupExpected = {backup: 1, restaurar: 1, compartilhar: 0};
      const backupWhy = {
        backup: 'o Salvar do rodapé aplica e fecha',
        restaurar: 'o Salvar do rodapé aplica e fecha',
        compartilhar: 'sem o que salvar (exportar/importar são avulsas), o Salvar se esconde',
      };
      for (const nav of ['backup', 'restaurar', 'compartilhar']) {
        await page.locator(`#mesa-backup-panel [data-bkp-nav="${nav}"]`).click();
        await settle(page);
        const found = await countPrimaries(page, '#mesa-backup-panel');
        assert.equal(found.primaries.length, backupExpected[nav], `${tag} ${theme} backup/${nav}: ${backupWhy[nav]}, veio ${found.primaries.length} (${found.primaries.join(' · ') || 'nenhum'})`);
      }
      await page.keyboard.press('Escape');
      /* Ajustes nos provedores, com o bloco de chave aberto (o retry). O retry
         e o Entrar são secundários de propósito; a ação principal do diálogo é
         o Salvar do rodapé. Exatamente 1. */
      await page.keyboard.press('ControlOrMeta+,');
      await page.waitForSelector('#settings-dialog[open]', {timeout: 10000});
      await page.locator('#settings-tabs [data-sec="pastas"]').click();
      await page.waitForSelector('#cfg-opencode-providers .op-provider', {timeout: 30000});
      await page.locator('#cfg-opencode-providers .op-provider[data-provider="openai"] [data-action="key"]').click();
      await page.locator('#cfg-opencode-providers [data-role="key-input"]').fill('sk-auditoria-recusada-000');
      await page.locator('#cfg-opencode-providers [data-role="key-input"]').press('Enter');
      await page.waitForSelector('#cfg-opencode-providers .op-login[data-phase="failed"]', {timeout: 30000});
      await settle(page);
      const providers = await countPrimaries(page, '#settings-dialog');
      assert.equal(providers.primaries.length, 1, `${tag} ${theme} provedores: esperava só o Salvar do rodapé (o retry é secundário), veio ${providers.primaries.length} (${providers.primaries.join(' · ') || 'nenhum'})`);
      await page.keyboard.press('Escape');
      /* Coluna do tutor ligada sem retomada: o bloco se esconde (nada à vista,
         nada para confirmar). Exatamente 0 — e é a cobertura do #tutor-state
         que o cabeçalho promete. */
      const tutorHidden = await countPrimaries(page, '#tutor-state');
      assert.equal(tutorHidden.primaries.length, 0, `${tag} ${theme} tutor-state ligado: bloco escondido, sem ação, veio ${tutorHidden.primaries.length} (${tutorHidden.primaries.join(' · ') || 'nenhum'})`);
      /* Coluna do tutor no erro (chave recusada, pela mesma porta que a falha
         real usa em chat.mjs): a saída é o Chamar de novo (primário); Ver o
         log é secundário. Exatamente 1. A saúde repinta a cada 15 s, então a
         medida repete a falha até ver o erro (no máximo 3 vezes). */
      let tutor = null;
      for (let attempt = 0; attempt < 3 && !tutor; attempt++) {
        await page.evaluate(() => import('./src/state.mjs').then((state) => state.connectionState('error', '', 'Invalid API key')));
        await page.waitForSelector('#tutor-state[data-state="error"]:not([hidden])', {timeout: 10000});
        const state = await page.evaluate(() => document.querySelector('#tutor-state')?.dataset.state);
        if (state === 'error') tutor = await countPrimaries(page, '#tutor-state');
      }
      assert.ok(tutor, `${tag} ${theme} tutor-state: o bloco de erro não ficou à vista`);
      assert.equal(tutor.primaries.length, 1, `${tag} ${theme} tutor-state no erro: esperava só o Chamar de novo, veio ${tutor.primaries.length} (${tutor.primaries.join(' · ') || 'nenhum'})`);
      await page.evaluate(() => import('./src/state.mjs').then((state) => state.connectionState('online')));
      /* Fileira do composer vazia: sem rascunho não há o que enviar, então o
         Enviar segue apagado e não há ação principal. Exatamente 0. */
      const empty = await countPrimaries(page, '#composer');
      assert.equal(empty.primaries.length, 0, `${tag} ${theme} composer vazio: sem rascunho não há ação principal, veio ${empty.primaries.length} (${empty.primaries.join(' · ') || 'nenhum'})`);
      /* Fileira do composer com rascunho: o Enviar acende e é a ação.
         Exatamente 1. */
      await page.locator('#prompt').fill('dúvida sobre limites');
      await settle(page);
      const draft = await countPrimaries(page, '#composer');
      assert.equal(draft.primaries.length, 1, `${tag} ${theme} composer com rascunho: esperava só o Enviar, veio ${draft.primaries.length} (${draft.primaries.join(' · ') || 'nenhum'})`);
      await page.locator('#prompt').fill('');
      await settle(page);
    }
  }
  await setTheme(page, 'light');
  console.log('PRIMARY SINGLE UI PASSED: um primário por contexto, 900 e 1440, claro e escuro.');
});

/* Primeira abertura (auditoria rodada 5, D1): em cada passo da `#setup-card`
   há um único botão preenchido, medido pelo fundo resolvido dos botões
   visíveis e habilitados — sem ler folha como texto. No passo do tutor com
   motor, "Chamar o tutor" é o único preenchido e "Pular por agora" fica
   quieto (sem `.primary`). Cobre 900 e 1440, claro e escuro. */
await withArtifacts('primary-single-first-run', async (ctx) => {
  const runtime = ctx.runtime = newRuntime('primary-single-first-run');
  const home = path.join(runtime, 'home');
  fs.mkdirSync(home, {recursive: true});
  const entry = path.join(runtime, 'entry.cjs');
  fs.writeFileSync(entry, `require('electron').app.setPath('userData',__dirname);require(${JSON.stringify(path.join(DESK, 'main.cjs'))});`);
  fs.writeFileSync(path.join(runtime, 'config.json'), JSON.stringify({runtimePath: runtime, courses: []}));
  const pdfs = path.join(runtime, 'pdfs', 'Calculo');
  fs.mkdirSync(pdfs, {recursive: true});
  fs.writeFileSync(path.join(pdfs, 'Limites.pdf'), tinyPdf('Limites', 2));
  for (const [width, height] of [[1440, 900], [900, 650]]) {
    for (const theme of ['light', 'dark']) {
      const tag = `${width}x${height} ${theme} setup`;
      const env = deskEnv(runtime, {HOME: home, USERPROFILE: home});
      delete env.LEARNING_DESK_RUNTIME;
      ctx.app = await electron.launch({args: [entry], cwd: DESK, env});
      const page = await ctx.app.firstWindow();
      await resizeWindow(ctx.app, page, width, height);
      await page.waitForSelector('body[data-first-run="true"]', {timeout: 30000});
      await freezeMotion(page);
      await setTheme(page, theme);
      await settle(page);
      const stepOf = () => page.locator('#setup-card').getAttribute('data-step');
      const walkTo = async (step) => {
        for (let i = 0; i < 14; i++) {
          if (await stepOf() === step) return;
          await page.locator('#setup-next').click();
        }
        throw new Error(`${tag}: sem passo ${step}`);
      };
      const only = async (step) => {
        /* O mouse fica sobre o botão clicado (`:hover` troca o fundo pelo
           `--primary-hover`): afasta antes de resolver as cores. */
        await page.mouse.move(2, 2);
        await settle(page);
        const found = await countPrimaries(page, '#setup-card');
        assert.equal(found.primaries.length, 1, `${tag} ${step}: ${found.primaries.length} primários (${found.primaries.join(' · ')})`);
        return found.primaries[0];
      };
      assert.equal(await only('welcome'), 'Começar');
      await page.locator('#setup-next').click();
      for (const frame of [0, 1, 2, 3]) {
        assert.equal(await stepOf(), 'tour');
        await only(`passeio-${frame}`);
        await page.locator('#setup-next').click();
      }
      await walkTo('name');
      await page.locator('#first-run-name').fill('Cálculo I');
      await settle(page);
      assert.equal(await only('nome'), 'Continuar');
      await walkTo('folder');
      await ctx.app.evaluate(({dialog}, folder) => { dialog.showOpenDialog = async () => ({canceled: false, filePaths: [folder]}); }, pdfs);
      await page.locator('#first-run-pick').click();
      await page.waitForFunction(() => !document.querySelector('#setup-next').disabled, undefined, {timeout: 15000});
      await settle(page);
      assert.equal(await only('pasta'), 'Continuar');
      await walkTo('tutor');
      await page.waitForSelector('#setup-pi[data-pi="found"]', {timeout: 30000});
      await page.mouse.move(2, 2);
      await settle(page);
      const tutor = await countPrimaries(page, '#setup-card');
      assert.deepEqual(tutor.primaries, ['Chamar o tutor'], `${tag} tutor: ${tutor.primaries.length} primários (${tutor.primaries.join(' · ')})`);
      assert.equal(await page.locator('#setup-next').evaluate((el) => el.classList.contains('primary')), false, `${tag} tutor: "Pular por agora" ficou preenchido`);
      assert.match(await page.locator('#setup-next').textContent(), /Pular por agora/);
      await page.locator('#setup-tutor-actions #connect').click();
      await page.waitForFunction(() => document.querySelector('#setup-next').textContent.trim() === 'Continuar', undefined, {timeout: 30000});
      await settle(page);
      assert.equal(await only('tutor-ligado'), 'Continuar');
      await walkTo('ready');
      await settle(page);
      assert.equal(await only('pronto'), 'Criar a matéria');
      await ctx.app.close();
    }
  }
  console.log('PRIMARY SINGLE FIRST-RUN PASSED: um primário por passo da primeira abertura, 900 e 1440, claro e escuro.');
});
