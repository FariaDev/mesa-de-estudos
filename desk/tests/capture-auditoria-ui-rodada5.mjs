// node tests/capture-auditoria-ui-rodada5.mjs — AUDITORIA DE UI/UX, RODADA 5,
// item 4: as telas que a nota 8,5 ainda não olhou. Tudo com dados sintéticos
// e fake (`fake-opencode`), sem material de curso. Claro/escuro × 1440×900 e
// 900×650 em /tmp/opencode/ui-auditoria/rodada-5-consertos/. Fora do
// `npm run ui`: bloco que falha registra e o resto segue, como a rodada 2.
import fs from 'node:fs';
import path from 'node:path';
import {_electron as electron} from '@playwright/test';
import {createRequire} from 'node:module';
import {DESK,deskEnv,newRuntime,seedCourse,seedNativeSession,writeConfigJson,writeDeskJson,launchDesk,statusOnline,freezeMotion,resizeWindow,setTheme,tinyPdf,tinyPdfPages,freeMenuClick,showSidechat,openSessionList} from './helpers.mjs';
import {nextFrames,layoutStable} from './waits.mjs';
import {SIZES,THEMES,RICH,courseWithPdf,bootCourse,send} from './capture-auditoria-ui-kit.mjs';

const require = createRequire(import.meta.url);
const statistics = require('../src/study-data/statistics.cjs');

const OUT = '/tmp/opencode/ui-auditoria/rodada-5-consertos';
fs.mkdirSync(OUT, {recursive: true});
const failures = [];
const ONLY = new Set((process.env.AUDIT_ONLY || '').split(',').filter(Boolean));
const block = async (tag, run) => {
  if (ONLY.size && !ONLY.has(tag)) return;
  try { await run(); console.log('ok', tag); }
  catch (error) {
    failures.push(`${tag}: ${String(error?.message || error).split('\n')[0]}`);
    console.log('FALHOU', tag, String(error?.message || error).split('\n')[0]);
    if (process.env.AUDIT_DEBUG) console.log(String(error?.stack || '').split('\n').filter((line) => line.includes('rodada5')).slice(0, 4).join('\n'));
  }
};

/* Janela inteira em cada tema×tamanho, sem dicas e sem caminho local. */
async function shots(page, app, base) {
  for (const [width, height] of SIZES) {
    await resizeWindow(app, page, width, height);
    await layoutStable(page, 'main').catch(() => {});
    for (const theme of THEMES) {
      await setTheme(page, theme);
      await nextFrames(page);
      await page.mouse.move(1, 1);
      await page.evaluate(() => { for (const tip of document.querySelectorAll('.tip')) tip.hidden = true; });
      await page.screenshot({path: path.join(OUT, `${base}-${theme}-${width}x${height}.png`)});
    }
  }
  await setTheme(page, 'light');
}
const studyItem = async (page, id, wait) => {
  await page.locator('#study-menu .nav-trigger').click();
  await page.locator(`#study-menu ${id}`).click();
  await page.waitForSelector(wait, {timeout: 15000});
};
/* Fecha diálogo de estudo pelo × se o Escape ficar no campo (a busca limpa o
   texto no primeiro Escape). */
const closeStudyDialog = async (page, sel) => {
  await page.keyboard.press('Escape');
  try {
    await page.waitForFunction((s) => !document.querySelector(s).open, sel, {timeout: 5000});
  } catch {
    await page.locator(`${sel} .dialog-close`).click();
    await page.waitForFunction((s) => !document.querySelector(s).open, sel, {timeout: 10000});
  }
};
/* Foto sem caminho local (a mesma máscara do kit da rodada 2). */
const maskedPng = async (page, file) => {
  const real = await page.evaluate(() => [...document.querySelectorAll('input')].map((el) => {
    const text = el.value;
    if (/^(?:\/|[A-Za-z]:[\\/]|\\\\)/.test(text)) el.value = `…/${text.split('/').filter(Boolean).pop()}`;
    return text;
  }));
  await page.screenshot({path: path.join(OUT, file)});
  await page.evaluate((texts) => {
    [...document.querySelectorAll('input')].forEach((el, i) => { if (texts[i] !== undefined) el.value = texts[i]; });
  }, real);
};

/* ---- 1. aba Livre: estudar sem matéria, prévia e geração de PDF ---- */
await block('livre', async () => {
  const runtime = newRuntime('aud5-livre');
  const course = seedCourse(runtime, 'calc');
  writeConfigJson(runtime, {runtimePath: runtime, vaultPath: runtime, courses: [{id: 'calc', name: 'Cálculo I', path: course}]});
  writeDeskJson(runtime, {courseId: 'calc', courseStates: {}});
  const app = await launchDesk({runtime});
  const page = await app.firstWindow();
  try {
    await resizeWindow(app, page, 1440, 900);
    await statusOnline(page);
    await freezeMotion(page);
    await page.locator('#course-tabs button[data-id="mesa-free"]').click();
    await page.waitForSelector('#free-bar:not([hidden])', {timeout: 15000});
    await shots(page, app, 'livre');
    await page.evaluate(() => {
      const host = document.querySelector('#messages');
      const add = (raw) => {
        const element = document.createElement('article');
        element.className = 'message assistant';
        element._raw = raw;
        const body = document.createElement('div'); body.className = 'body'; body.textContent = raw;
        element.append(body); host.append(element);
      };
      add('# Limites\n\nA regra é $\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$.');
    });
    await freeMenuClick(page, '#free-generate-pdf');
    await page.waitForSelector('#free-pdf-dialog[open]');
    await page.locator('#free-pdf-title').fill('Resumo sintético');
    await page.waitForFunction(() => !!document.querySelector('#free-pdf-preview .katex'), undefined, {timeout: 8000});
    await shots(page, app, 'livre-gerar-pdf');
    await page.keyboard.press('Escape');
  } finally { await app.close(); }
});

/* ---- 2. chat lateral com resposta do modelo ---- */
await block('lateral-resposta', async () => {
  const ctx = {};
  const {page, app} = await bootCourse(ctx, 'aud5-side');
  try {
    await showSidechat(page);
    await page.locator('#sidechat-prompt').fill('resuma o formulário em uma linha');
    await page.locator('#sidechat-prompt').press('Enter');
    await page.waitForFunction(() => (document.querySelector('#sidechat .sidechat-body')?.textContent || '').length > 20, undefined, {timeout: 60000});
    await shots(page, app, 'chat-lateral-resposta');
  } finally { await app.close(); }
});

/* ---- 3. estatísticas com dados + uso do tutor aberto ---- */
await block('estatisticas-dados', async () => {
  const runtime = newRuntime('aud5-stats');
  const {pdf} = courseWithPdf(runtime);
  writeDeskJson(runtime, {courseId: 'calc', courseStates: {calc: {pdfs: [{path: pdf, page: 1}], study: {title: '', xopp: ''}}}});
  const now = Date.now();
  for (const back of [0, 1, 2, 4]) {
    const at = now - back * 86400000;
    statistics.control(runtime, {action: 'start', at: at - 90000, courseId: 'calc'});
    for (const beat of [at - 60000, at - 30000, at]) statistics.recordActivity(runtime, {id: `aud5-${back}-${beat}`, at: beat, now: beat, running: true, visible: true, courseId: 'calc'});
    statistics.control(runtime, {action: 'stop', at, courseId: 'calc'});
  }
  statistics.recordUsage(runtime, {id: 'aud5-u1', at: now, courseId: 'calc', engine: 'opencode', input: {available: true, count: 139400}, output: {available: true, count: 17000}});
  const app = await launchDesk({runtime});
  const page = await app.firstWindow();
  try {
    await resizeWindow(app, page, 1440, 900);
    await statusOnline(page);
    await freezeMotion(page);
    await studyItem(page, '#study-stats-open', '#study-stats-dialog[open]');
    await shots(page, app, 'estatisticas-dados');
    await page.locator('#study-stats-usage summary').click();
    await shots(page, app, 'estatisticas-uso');
    await page.keyboard.press('Escape');
  } finally { await app.close(); }
});

/* ---- 4. revisão com itens guardados ---- */
await block('revisao-itens', async () => {
  const ctx = {};
  const {page, app} = await bootCourse(ctx, 'aud5-review');
  try {
    await send(page, 'explique o limite fundamental');
    await page.waitForSelector('.message.assistant', {timeout: 60000});
    await page.locator('.message.assistant').first().hover();
    await page.locator('.message.assistant button.msg-review').first().click();
    await page.waitForSelector('#review-dialog[open]');
    await page.locator('#review-question').fill('Limite fundamental');
    await page.locator('#review-attempt').fill('tentei substituir direto');
    await page.locator('#review-save').click();
    await page.waitForFunction(() => !document.querySelector('#review-dialog').open);
    await page.locator('#review-tab').click();
    await page.waitForSelector('.review-item', {timeout: 15000});
    await shots(page, app, 'revisao-itens');
  } finally { await app.close(); }
});

/* ---- 5. backup/restaurar com lista + exportar/importar ---- */
await block('backup-lista', async () => {
  const ctx = {};
  const {page, app} = await bootCourse(ctx, 'aud5-backup');
  try {
    /* O destino não pode morar dentro do runtime (o guard recusa). */
    const {mkdtempSync} = await import('node:fs');
    const {tmpdir} = await import('node:os');
    const dest = mkdtempSync(path.join(tmpdir(), 'aud5-destino-'));
    await studyItem(page, '#study-backup-open', '#mesa-backup-panel[open]');
    await app.evaluate(({dialog}, folder) => { dialog.showOpenDialog = async () => ({canceled: false, filePaths: [folder]}); }, dest);
    await page.locator('#mesa-backup-panel [data-bkp-act="pasta"]').click();
    /* A escolha só habilita o "rodar" depois de salva (o painel relê). */
    await page.locator('#mesa-backup-panel [data-bkp-save]').click();
    await page.waitForFunction(() => !document.querySelector('#mesa-backup-panel [data-bkp-act="rodar"]').disabled, undefined, {timeout: 15000});
    await page.locator('#mesa-backup-panel [data-bkp-act="rodar"]').click();
    await page.waitForFunction(() => [...document.querySelectorAll('[data-bkp-versions] li')].length > 0, undefined, {timeout: 60000});
    await page.locator('#mesa-backup-panel [data-bkp-nav="restaurar"]').click();
    await page.locator('#mesa-backup-panel [data-bkp-act="listar"]').click();
    await page.waitForFunction(() => [...document.querySelectorAll('[data-bkp-versions] li')].length > 0, undefined, {timeout: 30000});
    await shots(page, app, 'backup-restaurar-lista');
    await page.locator('#mesa-backup-panel [data-bkp-nav="compartilhar"]').click();
    await shots(page, app, 'compartilhar-exportar-importar');
    await page.keyboard.press('Escape');
  } finally { await app.close(); }
});

/* ---- 6. leitor com PDF grande: zoom, busca, página escura, anotação ---- */
await block('leitor-grande', async () => {
  const runtime = newRuntime('aud5-leitor');
  const course = seedCourse(runtime, 'calc');
  const pdf = path.join(course, 'Tratado.pdf');
  fs.writeFileSync(pdf, tinyPdfPages(30, 'Teorema'));
  writeConfigJson(runtime, {runtimePath: runtime, vaultPath: runtime, courses: [{id: 'calc', name: 'Cálculo I', path: course}]});
  fs.writeFileSync(path.join(runtime, 'pdf-notes.json'), JSON.stringify({notes: [{id: 'n1', pdf: 'Tratado.pdf', page: 3, text: 'Rever a demonstração do teorema principal'}]}));
  writeDeskJson(runtime, {courseId: 'calc', courseStates: {calc: {pdfs: [{path: pdf, page: 3}], study: {title: '', xopp: ''}}}});
  const app = await launchDesk({runtime});
  const page = await app.firstWindow();
  try {
    await resizeWindow(app, page, 1440, 900);
    await statusOnline(page);
    await freezeMotion(page);
    await page.waitForSelector('.pdf-panel canvas', {timeout: 30000});
    await page.locator('.pdf-panel').first().click();
    await page.keyboard.press('ControlOrMeta+Equal');
    await page.waitForFunction(() => (document.querySelector('.zoom-label')?.textContent || '').includes('12'), undefined, {timeout: 10000});
    await shots(page, app, 'leitor-zoom');
    /* `shots` termina em 900×650: volta a 1440 antes de abrir o menu. */
    await resizeWindow(app, page, 1440, 900);
    await studyItem(page, '#study-search-open', '#study-search-dialog[open]');
    await page.locator('#study-search-input').fill('Teorema');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => [...document.querySelectorAll('#study-search-results li')].length > 0, undefined, {timeout: 30000});
    await shots(page, app, 'leitor-busca');
    await closeStudyDialog(page, '#study-search-dialog');
    await setTheme(page, 'dark');
    await nextFrames(page);
    await page.screenshot({path: path.join(OUT, 'leitor-pagina-escura-dark-1440x900.png')});
    await setTheme(page, 'light');
    await resizeWindow(app, page, 1440, 900);
    await studyItem(page, '#study-notes-open', '#study-notes-dialog[open]');
    await shots(page, app, 'leitor-anotacao');
    await page.keyboard.press('Escape');
  } finally { await app.close(); }
});

/* ---- 7. notas da versão, sobre + créditos ---- */
await block('sobre-creditos', async () => {
  const runtime = newRuntime('aud5-news');
  courseWithPdf(runtime);
  writeDeskJson(runtime, {courseId: 'calc', releaseNotesSeen: '1.0.2'});
  const app = await launchDesk({runtime, env: {LEARNING_DESK_RELEASE_VERSION: '1.1.0'}});
  const page = await app.firstWindow();
  try {
    await resizeWindow(app, page, 1440, 900);
    await freezeMotion(page);
    await page.waitForSelector('#release-notes-dialog[open]', {timeout: 30000});
    await shots(page, app, 'sobre-novidades');
    await page.keyboard.press('Escape');
    await page.locator('#settings-menu .nav-trigger').click();
    await page.locator('#settings-menu #about').click();
    await page.waitForSelector('#about-dialog[open]');
    await page.locator('#about-credits-toggle').click();
    await shots(page, app, 'sobre-creditos');
    await page.keyboard.press('Escape');
  } finally { await app.close(); }
});

/* ---- 8. interface em English: telas principais + primeira abertura ---- */
await block('ingles', async () => {
  /* Boot fresco em inglês (os rótulos dos leitores nascem no idioma da
     interface; trocar com a Mesa aberta mantém os rótulos criados, como o
     nome da matéria). */
  const runtime = newRuntime('aud5-en');
  const {pdf} = courseWithPdf(runtime);
  writeDeskJson(runtime, {courseId: 'calc', courseStates: {calc: {pdfs: [{path: pdf, page: 1}], study: {title: '', xopp: ''}}}});
  const app = await launchDesk({runtime, env: {LEARNING_DESK_LOCALE: 'en-US'}});
  const page = await app.firstWindow();
  try {
    await resizeWindow(app, page, 1440, 900);
    await statusOnline(page);
    await freezeMotion(page);
    await page.waitForSelector('.pdf-panel canvas', {timeout: 30000});
    await page.waitForFunction(() => document.documentElement.lang === 'en', undefined, {timeout: 15000});
    await send(page, 'explain limits');
    await page.waitForSelector('.message.assistant', {timeout: 60000});
    const pt = await page.evaluate(() => {
      /* Só o visível (a auditoria é de telas): diálogo oculto relê o idioma
         ao abrir. Rótulos dos leitores incluídos (rodada 5: "Enunciado" e
         "Formulário & apoio" ficavam em português com a interface em inglês).
         "Limites" é nome de arquivo, não interface. */
      const ban = ['Exemplos', 'Continuar', 'Pular', 'Criar a matéria', 'Estatísticas', 'Revisão', ' Notas', 'Buscar', 'Restaurar', 'Compartilhar', 'Fechar', 'Salvar', 'Enunciado', 'Formulário', 'apoio'];
      const shown = (el) => {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return false;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        return !el.closest('[hidden]');
      };
      const found = [];
      for (const el of document.querySelectorAll('button, h1, h2, .pdf-title, [role="dialog"]')) {
        if (!shown(el)) continue;
        const text = (el.textContent || '').trim();
        for (const word of ban) if (text.includes(word)) { found.push(`${el.tagName}: ${text.slice(0, 40)}`); break; }
      }
      return found.slice(0, 10);
    });
    if (pt.length) failures.push(`ingles: português na tela em inglês: ${pt.join(' | ')}`);
    await shots(page, app, 'ingles-mesa');
  } finally { await app.close(); }
  const runtime2 = newRuntime('aud5-en-first');
  const home = path.join(runtime2, 'home');
  fs.mkdirSync(home, {recursive: true});
  const entry = path.join(runtime2, 'entry.cjs');
  fs.writeFileSync(entry, `require('electron').app.setPath('userData',__dirname);require(${JSON.stringify(path.join(DESK, 'main.cjs'))});`);
  fs.writeFileSync(path.join(runtime2, 'config.json'), JSON.stringify({runtimePath: runtime2, courses: []}));
  const env = deskEnv(runtime2, {HOME: home, USERPROFILE: home});
  delete env.LEARNING_DESK_RUNTIME;
  const app2 = await electron.launch({args: [entry], cwd: DESK, env});
  const page2 = await app2.firstWindow();
  try {
    await resizeWindow(app2, page2, 1440, 900);
    await page2.waitForSelector('body[data-first-run="true"]', {timeout: 30000});
    await freezeMotion(page2);
    await page2.locator('#first-run-language [data-language="en"]').click();
    await page2.waitForFunction(() => document.documentElement.lang === 'en', undefined, {timeout: 15000});
    const cut = await page2.evaluate(() => {
      const bad = [];
      for (const el of document.querySelectorAll('#setup-card button, #setup-card h1')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && el.scrollWidth > el.clientWidth + 1) bad.push(`${(el.textContent || '').trim().slice(0, 30)} corta`);
      }
      return bad.slice(0, 10);
    });
    if (cut.length) failures.push(`ingles: corte na primeira abertura em inglês: ${cut.join(' | ')}`);
    await shots(page2, app2, 'ingles-first-run');
  } finally { await app2.close(); }
});

/* ---- 9. só teclado: foco visível em diálogo, composer e menu ---- */
await block('teclado', async () => {
  const ctx = {};
  const {page, app} = await bootCourse(ctx, 'aud5-kbd');
  try {
    await page.keyboard.press('ControlOrMeta+,');
    await page.waitForSelector('#settings-dialog[open]');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const ring = await page.evaluate(() => {
      const el = document.activeElement;
      const cs = getComputedStyle(el);
      return {tag: el.tagName, id: el.id || el.className, outline: cs.outlineWidth, shadow: cs.boxShadow.slice(0, 40)};
    });
    if (ring.outline === '0px' && ring.shadow === 'none') failures.push(`teclado: sem anel de foco visível no diálogo (${ring.tag}#${ring.id})`);
    await maskedPng(page, 'teclado-dialogo-light-1440x900.png');
    await page.keyboard.press('Escape');
    await page.locator('#prompt').focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await maskedPng(page, 'teclado-composer-light-1440x900.png');
    await page.locator('#study-menu .nav-trigger').focus();
    await page.keyboard.press('Enter');
    await page.waitForSelector('#study-menu [data-open="true"], #study-menu :popover-open', {timeout: 5000}).catch(() => {});
    await maskedPng(page, 'teclado-menu-light-1440x900.png');
  } finally { await app.close(); }
});

/* ---- 10. conversa longa: muitas sessões e matérias ---- */
await block('conversa-longa', async () => {
  const runtime = newRuntime('aud5-longa');
  const ids = ['calc', 'fis', 'alg'];
  const names = {calc: 'Cálculo I', fis: 'Física II', alg: 'Álgebra Linear'};
  const courses = ids.map((id) => {
    const dir = seedCourse(runtime, id);
    const pdf = path.join(dir, 'Base.pdf');
    fs.writeFileSync(pdf, tinyPdf(`Base de ${names[id]}`, 2));
    return {id, name: names[id], path: dir};
  });
  writeConfigJson(runtime, {runtimePath: runtime, vaultPath: runtime, courses});
  const states = {};
  let current = '';
  for (const id of ids) {
    const list = [];
    for (let i = 0; i < 8; i++) {
      const session = seedNativeSession(runtime, [
        {role: 'user', content: [{type: 'text', text: `Dúvida ${i + 1} de ${names[id]}?`}]},
        {role: 'assistant', content: [{type: 'text', text: RICH}]},
      ], {courseId: id, started: Date.now() - ((ids.indexOf(id) * 8 + i) * 3600000), preview: `Dúvida ${i + 1}`});
      if (id === 'calc' && i === 0) current = session;
      list.push({path: session, started: Date.now() - i * 3600000, preview: `Dúvida ${i + 1}`});
    }
    states[id] = {session: list[0].path, sessions: list, pdfs: [], study: {title: '', xopp: ''}};
  }
  writeDeskJson(runtime, {courseId: 'calc', session: current, courseStates: states});
  const app = await launchDesk({runtime});
  const page = await app.firstWindow();
  try {
    await resizeWindow(app, page, 1440, 900);
    await statusOnline(page);
    await freezeMotion(page);
    await page.waitForSelector('.message.assistant', {timeout: 30000});
    await openSessionList(page);
    await shots(page, app, 'conversa-longa-sessoes');
    /* `shots` termina em 900×650, onde a biblioteca pode estar compactada. */
    await resizeWindow(app, page, 1440, 900);
    /* A biblioteca mora dentro da lista aberta: sem fechar no meio. */
    await page.locator('#conv-library').click();
    await page.waitForSelector('#chat-library-dialog[open]');
    await shots(page, app, 'conversa-longa-biblioteca');
  } finally { await app.close(); }
});

fs.writeFileSync(path.join(OUT, 'failures-rodada5.json'), JSON.stringify({failures}, null, 2));
console.log('capturas da rodada 5 em', OUT);
console.log('falhas:', JSON.stringify(failures, null, 2));
