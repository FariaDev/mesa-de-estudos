/* Alvo mínimo de 24px (auditoria de UI/UX, rodada 4, F3; WCAG 2.2 2.5.8):
   varre por MEDIÇÃO NO DOM todos os controles clicáveis visíveis das telas
   principais em 900 e 1440 — barra dos leitores, menu Mais opções, composer,
   folha vazia, cada seção dos Ajustes e cada aba do Backup — e exige 24×24
   ou mais. Vale a área invisível (`::after` com `inset` negativo): o teste
   mede a área efetiva pelo estilo computado do pseudo e falha se ela invadir
   o vizinho. Links dentro de texto corrido (exceção "inline" da WCAG) ficam
   de fora; o resto (botão, campo, select, resumo) entra, menos desligado e
   escondido. O pager e o "Ajustar à largura" são nomeados na lista (os casos
   da auditoria: 18,4×24 e 56,4×22). Só medidas do navegador real e CSSOM,
   sem regex de folha. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {_electron as electron} from '@playwright/test';
import {withArtifacts,newRuntime,seedCourse,writeConfigJson,writeDeskJson,launchDesk,statusOnline,freezeMotion,resizeWindow,setTheme,tinyPdf,tinyPdfPages,DESK,deskEnv} from './helpers.mjs';
import {settle} from './layout-measure.mjs';

const SIZES = [[1440, 900], [900, 650]];
const SCOPES = [
  '#references button, #references select, #references input:not([type="hidden"]), #references textarea, #references summary, #references [role="button"], #references a[href]',
  '#composer button, #composer select, #composer input:not([type="hidden"])',
  '#chat button, #chat select, #chat input:not([type="hidden"])',
  '#settings-dialog button, #settings-dialog select, #settings-dialog input:not([type="hidden"]), #settings-dialog summary',
  '#mesa-backup-panel button, #mesa-backup-panel select, #mesa-backup-panel input:not([type="hidden"]), #mesa-backup-panel summary',
  /* Auditoria rodada 5, D2: a primeira abertura e o diálogo de estatísticas
     entram na mesma varredura (área invisível vale; exceção só para link
     dentro de frase, que aqui não há — `.setup-link` é botão). */
  '#setup-card button, #setup-card select, #setup-card input:not([type="hidden"]), #setup-card summary',
  '#study-stats-dialog button, #study-stats-dialog select, #study-stats-dialog input:not([type="hidden"]), #study-stats-dialog summary',
].join(',');

function measured(page) {
  return page.evaluate((scopes) => {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return false;
      if (el.closest('[hidden]')) return false;
      return true;
    };
    const inText = (el) => {
      if (el.tagName !== 'A') return false;
      if (getComputedStyle(el).display !== 'inline') return false;
      return !!el.closest('.message .body, .sheet-drop, p');
    };
    const controls = [...document.querySelectorAll(scopes)].filter((el) => visible(el) && !el.disabled && !inText(el));
    return controls.map((el) => {
      /* Caixa e rádio: o alvo efetivo é o `label` que alterna (WCAG 2.5.8: a
         região que responde ao clique), não a caixinha de 13–15px. */
      let target = el;
      if (el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio')) {
        const label = el.closest('label') || (el.id ? document.querySelector(`label[for="${el.id}"]`) : null);
        if (label && visible(label)) target = label;
      }
      const r = target.getBoundingClientRect();
      const after = getComputedStyle(el, '::after');
      const num = (v) => { const m = /^(-?[\d.]+)px$/.exec(String(v).trim()); return m ? Number(m[1]) : 0; };
      const hasHitArea = after.content !== 'none' && after.content !== '' && after.position === 'absolute';
      const pad = hasHitArea ? {top: -Math.min(0, num(after.top)), right: -Math.min(0, num(after.right)), bottom: -Math.min(0, num(after.bottom)), left: -Math.min(0, num(after.left))} : {top: 0, right: 0, bottom: 0, left: 0};
      const tag = el.tagName.toLowerCase();
      const name = (el.getAttribute('aria-label') || el.textContent || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 44);
      const cls = String(el.className || '').split(/\s+/).filter(Boolean).slice(0, 3).join('.');
      return {tag, cls, name, x: r.x, y: r.y, w: r.width, h: r.height, hit: hasHitArea, ew: r.width + pad.left + pad.right, eh: r.height + pad.top + pad.bottom, ex: r.x - pad.left, ey: r.y - pad.top};
    });
  }, SCOPES);
}

function check(controls, failures, tag) {
  for (const c of controls.filter((c) => c.ew < 24 || c.eh < 24)) {
    failures.push(`${tag}: ${c.tag}.${c.cls} "${c.name}" mede ${c.w.toFixed(1)}×${c.h.toFixed(1)} (efetivo ${c.ew.toFixed(1)}×${c.eh.toFixed(1)}${c.hit ? ' com ::after' : ''})`);
  }
  const box = (c) => ({l: c.ex, t: c.ey, r: c.ex + c.ew, b: c.ey + c.eh});
  const label = (c) => `${c.tag}.${c.cls} "${c.name}"`;
  /* A área invisível não pode invadir NENHUM controle — antes cada `::after`
     era comparado só com os outros `::after`, e uma invasão sobre um controle
     sem área ampliada passava calada. */
  for (const enlarged of controls.filter((c) => c.hit)) {
    const a = box(enlarged);
    for (const other of controls) {
      if (other === enlarged) continue;
      const b = box(other);
      const sameSpot = Math.abs(a.l - b.l) < 1 && Math.abs(a.t - b.t) < 1 && Math.abs(a.r - b.r) < 1 && Math.abs(a.b - b.b) < 1;
      if (!sameSpot && a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1) {
        failures.push(`${tag}: área invisível de ${label(enlarged)} invade ${label(other)}`);
      }
    }
  }
}

await withArtifacts('target-size', async (ctx) => {
  const runtime = ctx.runtime = newRuntime('target-size');
  const course = seedCourse(runtime, 'calc');
  const pdf = path.join(course, 'Limites.pdf');
  const {writeFileSync} = await import('node:fs');
  writeFileSync(pdf, tinyPdfPages(2));
  writeConfigJson(runtime, {runtimePath: runtime, vaultPath: runtime, courses: [{id: 'calc', name: 'Cálculo I', path: course}]});
  writeDeskJson(runtime, {courseId: 'calc', courseStates: {calc: {pdfs: [{path: pdf, page: 1}], study: {title: '', xopp: ''}}}});
  ctx.app = await launchDesk({runtime});
  const page = await ctx.app.firstWindow();
  await statusOnline(page);
  await freezeMotion(page);
  await page.waitForSelector('.pdf-panel canvas', {timeout: 30000});
  const failures = [];
  for (const [width, height] of SIZES) {
    await resizeWindow(ctx.app, page, width, height);
    await settle(page);
    const tag = `${width}x${height}`;
    /* Leitor com material + composer + folha vazia do segundo leitor. */
    let controls = await measured(page);
    assert.ok(controls.length > 10, `${tag}: esperava os controles da base, mediu ${controls.length}`);
    const pager = controls.find((c) => c.cls.includes('pager'));
    assert.ok(pager, `${tag}: o pager está na lista medida`);
    assert.ok(pager.ew >= 24 && pager.eh >= 24, `${tag}: pager mede ${pager.w.toFixed(1)}×${pager.h.toFixed(1)}`);
    check(controls, failures, `${tag} base`);
    /* Menu Mais opções aberto (com o Ajustar à largura). */
    await page.locator('.pdf-panel .more').first().click();
    await page.waitForSelector('.pdf-more-pop:not([hidden])', {timeout: 10000});
    await settle(page);
    controls = await measured(page);
    const fit = controls.find((c) => c.cls.includes('more-zoom-fit') || c.name.includes('Ajustar'));
    assert.ok(fit, `${tag}: o Ajustar à largura está na lista medida`);
    assert.ok(fit.ew >= 24 && fit.eh >= 24, `${tag}: Ajustar mede ${fit.w.toFixed(1)}×${fit.h.toFixed(1)}`);
    check(controls, failures, `${tag} mais-opcoes`);
    await page.keyboard.press('Escape');
    /* Cada seção dos Ajustes. */
    await page.keyboard.press('ControlOrMeta+,');
    await page.waitForSelector('#settings-dialog[open]', {timeout: 10000});
    const tabs = await page.locator('.settings-tab').count();
    assert.ok(tabs >= 4, `${tag}: esperava as seções dos Ajustes, mediu ${tabs} abas`);
    for (let i = 0; i < tabs; i++) {
      await page.locator('.settings-tab').nth(i).click();
      await settle(page);
      check(await measured(page), failures, `${tag} ajustes-${i}`);
    }
    await page.keyboard.press('Escape');
    /* Cada aba do Backup. */
    await page.locator('#study-menu .nav-trigger').click();
    await page.locator('#study-menu #study-backup-open').click();
    await page.waitForSelector('#mesa-backup-panel[open]', {timeout: 15000});
    for (const nav of ['backup', 'restaurar', 'compartilhar']) {
      await page.locator(`#mesa-backup-panel [data-bkp-nav="${nav}"]`).click();
      await settle(page);
      check(await measured(page), failures, `${tag} backup-${nav}`);
    }
    await page.keyboard.press('Escape');
    /* Estatísticas com o resumo "Uso do tutor" aberto (D2: o `<summary>` de
       14px vale pela área invisível). */
    await page.locator('#study-menu .nav-trigger').click();
    await page.locator('#study-menu #study-stats-open').click();
    await page.waitForSelector('#study-stats-dialog[open]', {timeout: 15000});
    await settle(page);
    check(await measured(page), failures, `${tag} estatisticas`);
    await page.keyboard.press('Escape');
  }
  await setTheme(page, 'light');
  assert.deepEqual(failures, [], `alvos abaixo de 24×24:\n${failures.join('\n')}`);
  console.log('TARGET SIZE UI PASSED: controles das telas principais com 24×24 ou mais, 900 e 1440.');
});

/* Primeira abertura na mesma régua (auditoria rodada 5, D2): cada passo com
   24×24 ou mais — "Como funciona"/"Tirar esta pasta" (`.setup-link`, 18,8px)
   valem pela área invisível, sem deslocar o texto. Falha se aparecer outro. */
await withArtifacts('target-size-first-run', async (ctx) => {
  const runtime = ctx.runtime = newRuntime('target-size-first-run');
  const home = path.join(runtime, 'home');
  fs.mkdirSync(home, {recursive: true});
  const entry = path.join(runtime, 'entry.cjs');
  fs.writeFileSync(entry, `require('electron').app.setPath('userData',__dirname);require(${JSON.stringify(path.join(DESK, 'main.cjs'))});`);
  fs.writeFileSync(path.join(runtime, 'config.json'), JSON.stringify({runtimePath: runtime, courses: []}));
  const pdfs = path.join(runtime, 'pdfs', 'Calculo');
  fs.mkdirSync(pdfs, {recursive: true});
  fs.writeFileSync(path.join(pdfs, 'Limites.pdf'), tinyPdf('Limites', 2));
  const failures = [];
  for (const [width, height] of SIZES) {
    const tag = `${width}x${height} setup`;
    const env = deskEnv(runtime, {HOME: home, USERPROFILE: home});
    delete env.LEARNING_DESK_RUNTIME;
    ctx.app = await electron.launch({args: [entry], cwd: DESK, env});
    const page = await ctx.app.firstWindow();
    await resizeWindow(ctx.app, page, width, height);
    await page.waitForSelector('body[data-first-run="true"]', {timeout: 30000});
    await freezeMotion(page);
    const stepOf = () => page.locator('#setup-card').getAttribute('data-step');
    const walkTo = async (step) => {
      for (let i = 0; i < 14; i++) {
        if (await stepOf() === step) return;
        await page.locator('#setup-next').click();
      }
      throw new Error(`${tag}: sem passo ${step}`);
    };
    const sweep = async (step) => {
      await settle(page);
      const controls = await measured(page);
      assert.ok(controls.length > 2, `${tag} ${step}: esperava os controles do passo, mediu ${controls.length}`);
      const link = controls.find((c) => c.cls.includes('setup-link'));
      if (link) assert.ok(link.eh >= 24, `${tag} ${step}: setup-link mede ${link.w.toFixed(1)}×${link.h.toFixed(1)} (efetivo ${link.ew.toFixed(1)}×${link.eh.toFixed(1)})`);
      check(controls, failures, `${tag} ${step}`);
    };
    await sweep('boas-vindas');
    await walkTo('tour');
    await sweep('passeio');
    await walkTo('name');
    await page.locator('#first-run-name').fill('Cálculo I');
    await sweep('nome');
    await walkTo('folder');
    await ctx.app.evaluate(({dialog}, folder) => { dialog.showOpenDialog = async () => ({canceled: false, filePaths: [folder]}); }, pdfs);
    await page.locator('#first-run-pick').click();
    await page.waitForFunction(() => !document.querySelector('#setup-next').disabled, undefined, {timeout: 15000});
    await sweep('pasta');
    await walkTo('tutor');
    await page.waitForSelector('#setup-pi[data-pi]', {timeout: 30000});
    await sweep('tutor');
    await walkTo('ready');
    await sweep('pronto');
    await ctx.app.close();
  }
  assert.deepEqual(failures, [], `alvos abaixo de 24×24 na primeira abertura:\n${failures.join('\n')}`);
  console.log('TARGET SIZE FIRST-RUN PASSED: primeira abertura com 24×24 ou mais, 900 e 1440.');
});
