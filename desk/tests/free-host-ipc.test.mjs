/* Integração IPC REAL da aba Livre no host (main.cjs/preload.cjs), com Electron
   de verdade, fake Pi e fake Claude SDK — nenhum login, nenhum material/config
   real. Runtime sintético em /tmp; cada teste fecha o app no finally.

   Cobre: aba virtual `mesa-free` no runtime (nunca no config), workspace por
   conversa A/B + restart, PDFs próprios copiados (original readonly), APIs
   congeladas freeOpenPdf/freeSaveMaterial/freeRename/freePromote com
   initialData integral, escopo/mutex (troca bloqueada durante mutação,
   save-state adiado sem perder rascunho), promoção com cancelamento/colisão/
   transferência (Pi e Claude) e rollback por falha injetada; recuperação de
   boot dos diários `applying`/`committing`. */
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {_electron as electron} from '@playwright/test';
import {testEnv} from './electron-env.mjs';
import {tinyPdf} from './helpers.mjs';

const require = createRequire(import.meta.url);
const store = require('../free-workspaces.cjs');
const journal = require('../free-promotion.cjs');
const DESK = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FAKE_PI = path.join(DESK, 'tests', 'fake-pi.mjs');
const CLAUDE_SPY = path.join(DESK, 'tests', 'fixtures', 'claude-sdk-free-spy.mjs');
fs.chmodSync(FAKE_PI, 0o755);

const runtimes = [];
after(() => {
  for (const dir of runtimes) {
    try { fs.rmSync(dir, {recursive: true, force: true}); } catch { /* já foi */ }
  }
});

function makeRuntime(tag, {course = true} = {}) {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), `mesa-livre-host-${tag}-`));
  runtimes.push(runtime);
  let courseDir = '';
  if (course) {
    courseDir = path.join(runtime, 'learning', 'Courses', 'Synthetic');
    fs.mkdirSync(courseDir, {recursive: true});
    fs.writeFileSync(path.join(courseDir, 'Lista.pdf'), tinyPdf('Lista sintética', 2));
  }
  const piWrap = path.join(runtime, 'pi-wrap.mjs');
  const cwdLog = path.join(runtime, 'pi-cwd.log');
  fs.writeFileSync(piWrap, [
    '#!/usr/bin/env node',
    "import fs from 'node:fs';",
    `fs.appendFileSync(${JSON.stringify(cwdLog)}, process.cwd()+'\\n');`,
    `await import(${JSON.stringify(pathToFileURL(FAKE_PI).href)});`,
    '',
  ].join('\n'));
  fs.chmodSync(piWrap, 0o755);
  const claudeStub = path.join(runtime, 'claude-stub');
  fs.writeFileSync(claudeStub, 'stub');
  const configFile = path.join(runtime, 'config.json');
  const deskFile = path.join(runtime, 'desk.json');
  fs.writeFileSync(configFile, JSON.stringify({
    runtimePath: runtime,
    vaultPath: runtime,
    courses: course ? [{id: 'Synthetic', name: 'Sintética', path: courseDir}] : [],
    claudePath: claudeStub,
  }, null, 2) + '\n');
  fs.writeFileSync(deskFile, JSON.stringify({courseId: course ? 'Synthetic' : '', courseStates: {}}));
  return {runtime, courseDir, piWrap, cwdLog, claudeStub, configFile, deskFile, claudeLog: path.join(runtime, 'claude-system.log')};
}

function launch(fx) {
  return electron.launch({
    args: [path.join(DESK, 'main.cjs')],
    cwd: DESK,
    env: testEnv({
      LEARNING_DESK_RUNTIME: fx.runtime,
      LEARNING_DESK_PI: fx.piWrap,
      LEARNING_DESK_CLAUDE_SDK_FACTORY: CLAUDE_SPY,
      FAKE_CLAUDE_STORE: path.join(fx.runtime, 'claude-store'),
      FAKE_CLAUDE_SYSTEM_LOG: fx.claudeLog,
    }),
  });
}

const waitDesk = (page) => page.waitForFunction(() => window.desk && typeof window.desk.freeOpenPdf === 'function', undefined, {timeout: 30000});
const stubDialog = (app, paths) => app.evaluate(({dialog}, value) => {
  dialog.showOpenDialog = async () => (value === null ? {canceled: true, filePaths: []} : {canceled: false, filePaths: value});
}, paths);

async function close(app) {
  if (app) await app.close().catch(() => {});
}

async function waitFor(predicate, label, {timeout = 20000, step = 150} = {}) {
  const start = Date.now();
  for (;;) {
    const value = await predicate();
    if (value) return value;
    if (Date.now() - start > timeout) throw new Error(`tempo esgotado esperando ${label}`);
    await new Promise((resolve) => setTimeout(resolve, step));
  }
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

test('aba Livre no host: workspace por conversa, APIs, mutex, promoção e restart', {timeout: 900000}, async (t) => {
  const fx = makeRuntime('main');
  const source = path.join(fx.runtime, 'avulso.pdf');
  const sourceBytes = tinyPdf('PDF avulso da sessão', 3);
  fs.writeFileSync(source, sourceBytes);
  let app = await launch(fx);
  t.after(() => close(app));
  let page = await app.firstWindow();
  await waitDesk(page);
  await page.waitForSelector('.pdf-panel', {timeout: 30000});
  /* Deixa o renderer terminar o boot (PDF + save debounced) antes de dirigir o
     IPC direto: um save do renderer atrasado reescreveria o estado do curso. */
  await page.waitForTimeout(1600);

  /* ---- 1. boot: aba virtual só no runtime; matéria normal intocada ---- */
  const init = await page.evaluate(() => window.desk.init());
  assert.deepEqual(init.courses[0], {id: 'mesa-free', name: 'Livre', kind: 'free'}, 'Livre vem primeiro nas abas');
  assert.equal(init.courses.filter((c) => c.kind === 'free').length, 1);
  assert.equal(init.workspace.kind, 'course', 'matéria normal hidrata workspace de curso');
  assert.equal(init.courseId, 'Synthetic');
  const configOnBoot = JSON.parse(fs.readFileSync(fx.configFile, 'utf8'));
  assert.equal(configOnBoot.courses.some((c) => c.id === 'mesa-free'), false, 'config/defaults nunca recebem mesa-free');

  /* ---- 2. trocar para Livre: sessão nova, vazia, sem configurar matéria ---- */
  const freeA = await page.evaluate(() => window.desk.switchCourse('mesa-free'));
  assert.equal(freeA.courseId, 'mesa-free');
  assert.equal(freeA.workspace.kind, 'free');
  assert.equal(freeA.workspace.promotedCourseId, '');
  assert.equal(freeA.library.length, 0, 'Livre sem PDFs não carrega pasta nenhuma');
  assert.equal(freeA.state.theme, 'auto');
  assert.equal(typeof freeA.state.draft, 'string');
  assert.ok(Array.isArray(freeA.pending.items));
  assert.ok(freeA.session.startsWith(path.join(fx.runtime, 'free') + path.sep), 'sessão Pi nasce dentro do workspace');
  assert.equal(fs.existsSync(freeA.session), false, 'JSONL do Pi só nasce no primeiro envio');
  assert.equal(freeA.sessions.filter((s) => s.path === freeA.session).length, 1, 'sessão vazia aparece no índice');
  assert.equal(JSON.stringify(freeA.courses.find((c) => c.id === 'mesa-free')), JSON.stringify({id: 'mesa-free', name: 'Livre', kind: 'free'}));
  const sessionA = freeA.session;

  /* ---- 3. abrir PDF: cópia gerenciada; original readonly; path arbitrário recusado ---- */
  await stubDialog(app, [source]);
  const opened = await page.evaluate(() => window.desk.freeOpenPdf());
  assert.equal(opened.workspace.materials.length, 1);
  const materialA = opened.workspace.materials[0];
  assert.ok(materialA.path.startsWith(path.join(fx.runtime, 'free') + path.sep) && fs.existsSync(materialA.path));
  assert.deepEqual(fs.readFileSync(materialA.path), sourceBytes, 'cópia byte a byte');
  assert.deepEqual(fs.readFileSync(source), sourceBytes, 'original intocado');
  assert.equal(opened.library.length, 1, 'manifesto da sessão é a biblioteca');
  assert.equal(opened.state.pdfs?.[0]?.path, materialA.path, 'PDF aberto entra no primeiro leitor antes do initialData');
  const readOk = await page.evaluate((p) => window.desk.readPDF(p).then((bytes) => bytes.byteLength, (e) => e.message), materialA.path);
  assert.ok(Number(readOk) > 100, 'material da sessão é legível');
  const readArbitrary = await page.evaluate((p) => window.desk.readPDF(p).then(() => 'ok', (e) => e.message), source);
  assert.match(String(readArbitrary), /biblioteca|seletor/i, 'caminho arbitrário não é autorizado');
  const openNormal = await page.evaluate(() => window.desk.openPDF().then(() => 'ok', (e) => e.message));
  assert.match(String(openNormal), /Livre/, 'o seletor da matéria normal não opera dentro do Livre');
  await stubDialog(app, null);
  const openCancelled = await page.evaluate(() => window.desk.freeOpenPdf());
  assert.deepEqual(openCancelled, {cancelled: true}, 'cancelar o diálogo não importa nada');
  assert.equal((await page.evaluate(() => window.desk.init())).workspace.materials.length, 1, 'cancelou e o manifesto ficou igual');

  /* Segundo leitor ocupado: a geração do PDF substitui SÓ o primeiro. */
  await page.evaluate((p) => window.desk.save({
    draft: '',
    pdfs: [{path: p, page: 1, zoom: 1, rotation: 0, scrollX: 0, scrollY: 0, invert: false, minimized: false},
           {path: p, page: 2, zoom: 1, rotation: 0, scrollX: 0, scrollY: 0, invert: false, minimized: false}],
    pdfRotations: {}, study: {title: '', xopp: ''}, referenceVisible: true, chatWidth: 390, calcHeight: 220, pdfSplit: 0.5, theme: 'auto',
  }), materialA.path);

  /* ---- 4. gerar PDF: serviço real, initialData integral com estado atual ---- */
  const saved = await page.evaluate(() => window.desk.freeSaveMaterial({title: 'Resumo da sessão', markdown: '# Resumo\n\nA derivada de $x^2$ é $2x$.\n'}));
  assert.equal(saved.saved, true);
  assert.ok(saved.material.path.endsWith('.pdf') && fs.existsSync(saved.material.path));
  assert.equal(fs.readFileSync(saved.material.path).subarray(0, 5).toString(), '%PDF-');
  assert.equal(saved.data.workspace.materials.length, 2);
  assert.equal(saved.data.pending.items.length, 0);
  assert.equal(saved.data.state.theme, 'auto');
  assert.equal(saved.data.state.pdfs?.[0]?.path, saved.material.path, 'PDF gerado entra no primeiro leitor');
  assert.equal(saved.data.state.pdfs?.[1]?.path, materialA.path, 'o segundo leitor fica como estava');
  const materialPdf = saved.material;

  /* ---- 5. sessão B isolada; PDF fora do manifesto não aparece; A/B/A volta ---- */
  const freeB = await page.evaluate(() => window.desk.newSession('pi'));
  assert.equal(freeB.workspace.kind, 'free');
  assert.equal(freeB.workspace.materials.length, 0, 'PDFs de A não entram em B');
  assert.equal(freeB.library.length, 0);
  assert.notEqual(freeB.session, sessionA);
  assert.equal(freeB.sessions.length >= 2, true);
  const sessionB = freeB.session;
  fs.writeFileSync(path.join(path.dirname(sessionA), 'nao-registrado.pdf'), tinyPdf('não registrado'));
  const backA = await page.evaluate((p) => window.desk.openSession(p), sessionA);
  assert.equal(backA.session, sessionA);
  assert.equal(backA.library.length, 2, 'PDF fora do manifesto não entra na sessão');
  assert.equal(backA.workspace.materials.length, 2);
  const backB = await page.evaluate((p) => window.desk.openSession(p), sessionB);
  assert.equal(backB.workspace.materials.length, 0, 'B continua vazia');
  await page.evaluate((p) => window.desk.openSession(p), sessionA);

  /* ---- 6. rascunho e fila isolados por conversa, persistidos no store ---- */
  await page.evaluate(() => window.desk.save({draft: 'rascunho da sessão A', pdfs: [], pdfRotations: {}, study: {title: '', xopp: ''}, referenceVisible: true, chatWidth: 390, calcHeight: 220, pdfSplit: 0.5, theme: 'dark'}));
  await page.evaluate(() => window.desk.pendingSave({items: [{id: 'q1', text: 'item da fila A'}], held: false}));
  await page.waitForTimeout(200);
  const storeA = JSON.parse(fs.readFileSync(path.join(store.workspaceDir(fx.runtime, path.basename(path.dirname(sessionA))), store.FILENAME), 'utf8'));
  assert.equal(storeA.draft, 'rascunho da sessão A', 'rascunho foi para o store');
  const stateA = await page.evaluate((p) => window.desk.openSession(p), sessionA);
  assert.equal(stateA.state.draft, 'rascunho da sessão A');
  assert.equal(stateA.pending.items[0].text, 'item da fila A');
  const stateB = await page.evaluate((p) => window.desk.openSession(p), sessionB);
  assert.equal(stateB.state.draft, '', 'rascunho de A não vaza para B');
  assert.deepEqual(stateB.pending.items, [], 'fila de A não vaza para B');
  const stateABack = await page.evaluate((p) => window.desk.openSession(p), sessionA);
  assert.equal(stateABack.state.draft, 'rascunho da sessão A', 'reabrir A depois de B restaura o rascunho');
  assert.equal(stateABack.pending.items[0].text, 'item da fila A', 'reabrir A restaura a fila');

  /* ---- 7. renomear: store + listagem + restart depois ---- */
  await page.evaluate((p) => window.desk.openSession(p), sessionA);
  const renamed = await page.evaluate(() => window.desk.freeRename({title: 'Sessão A'}));
  assert.equal(renamed.workspace.title, 'Sessão A');
  const storeAgain = JSON.parse(fs.readFileSync(path.join(store.workspaceDir(fx.runtime, path.basename(path.dirname(sessionA))), store.FILENAME), 'utf8'));
  assert.equal(storeAgain.title, 'Sessão A');

  /* ---- 8. layout com PDF + rotação gravado para o teste de transferência ---- */
  await page.evaluate((p) => window.desk.save({
    draft: 'rascunho da sessão A',
    pdfs: [{path: p, page: 2, zoom: 1.25, rotation: 0, scrollX: 0, scrollY: 12, invert: false, minimized: false}],
    pdfRotations: {[p]: 90},
    study: {title: '', xopp: ''},
    referenceVisible: true,
    chatWidth: 390,
    calcHeight: 220,
    pdfSplit: 0.5,
    theme: 'dark',
  }), materialA.path);
  await page.waitForTimeout(200);

  /* ---- 9. mutex: durante a mutação, trocar/abrir/criar/config são bloqueados
          e o save-state é adiado sem invalidar o escopo nem perder o rascunho ---- */
  const mutex = await page.evaluate(async (materialPath) => {
    const longMarkdown = Array.from({length: 60}, (_, i) => `## Bloco ${i}\n\nParágrafo com $x_${i}^2$ e texto suficiente para atrasar a impressão.\n`).join('\n');
    const savePromise = window.desk.freeSaveMaterial({title: 'PDF durante mutex', markdown: longMarkdown});
    await new Promise((resolve) => setTimeout(resolve, 80));
    const results = await Promise.all([
      window.desk.switchCourse('Synthetic').then(() => 'ok', (e) => e.message),
      window.desk.newSession('pi').then(() => 'ok', (e) => e.message),
      window.desk.openSession('qualquer-coisa.jsonl').then(() => 'ok', (e) => e.message),
      window.desk.saveConfig({}).then(() => 'ok', (e) => e.message),
      window.desk.save({draft: 'digitado durante o PDF', pdfs: [{path: materialPath, page: 2, zoom: 1.25, rotation: 0, scrollX: 0, scrollY: 12, invert: false, minimized: false}], pdfRotations: {[materialPath]: 90}, study: {title: '', xopp: ''}, referenceVisible: true, chatWidth: 390, calcHeight: 220, pdfSplit: 0.5, theme: 'dark'}).then(() => 'ok', (e) => e.message),
    ]);
    const save = await savePromise;
    return {results, saved: save.saved, materials: save.data.workspace.materials.length, draft: save.data.state.draft};
  }, materialA.path);
  for (const result of mutex.results.slice(0, 4)) assert.match(String(result), /Aguarde/, 'navegação bloqueada durante a mutação');
  assert.equal(mutex.results[4], 'ok', 'save-state não é bloqueado (é adiado)');
  assert.equal(mutex.saved, true, 'a mutação não foi invalidada pelo save-state');
  assert.equal(mutex.materials, 3);
  assert.equal(mutex.draft, 'digitado durante o PDF', 'rascunho digitado durante o await não se perde');
  const afterMutex = await page.evaluate(() => window.desk.init());
  assert.equal(afterMutex.state.draft, 'digitado durante o PDF');
  /* O save durante a mutação trocou o 1º leitor; volta ao layout que a
     promoção deve transferir (avulso girado em 90°, rascunho digitado). */
  await page.evaluate((p) => window.desk.save({
    draft: 'digitado durante o PDF',
    pdfs: [{path: p, page: 2, zoom: 1.25, rotation: 0, scrollX: 0, scrollY: 12, invert: false, minimized: false}],
    pdfRotations: {[p]: 90},
    study: {title: '', xopp: ''},
    referenceVisible: true, chatWidth: 390, calcHeight: 220, pdfSplit: 0.5, theme: 'dark',
  }), materialA.path);

  /* ---- 10. cancelar a criação de matéria não cria nada ---- */
  await stubDialog(app, null);
  const cancelled = await page.evaluate(() => window.desk.freePromote({name: 'Matéria Cancelada'}));
  assert.deepEqual(cancelled, {cancelled: true});
  assert.equal(fs.existsSync(path.join(fx.runtime, 'Matéria-Cancelada')), false);
  assert.equal(store.findWorkspace(fx.runtime, path.basename(path.dirname(sessionA))).promotion, null);

  /* ---- 11. falha injetada no desk.json desfaz SÓ o destino (rollback) ---- */
  const parent = path.join(fx.runtime, 'materias');
  fs.mkdirSync(parent, {recursive: true});
  const configBefore = fs.readFileSync(fx.configFile);
  await stubDialog(app, [parent]);
  await app.evaluate(() => {
    const nodeFs = process.getBuiltinModule('fs');
    globalThis.__origWFS = nodeFs.writeFileSync;
    globalThis.__failDesk = true;
    nodeFs.writeFileSync = function (file, ...rest) {
      if (globalThis.__failDesk && String(file).endsWith('desk.json')) {
        globalThis.__failDesk = false;
        throw new Error('ENOSPC injetado');
      }
      return globalThis.__origWFS.call(nodeFs, file, ...rest);
    };
  });
  const rolled = await page.evaluate(() => window.desk.freePromote({name: 'Matéria Falha'}).then(() => 'ok', (e) => e.message));
  await app.evaluate(() => {
    const nodeFs = process.getBuiltinModule('fs');
    if (globalThis.__origWFS) {
      nodeFs.writeFileSync = globalThis.__origWFS;
      delete globalThis.__origWFS;
    }
  });
  assert.match(String(rolled), /ENOSPC/, 'a falha injetada chega como erro');
  assert.deepEqual(fs.readFileSync(fx.configFile), configBefore, 'config volta byte a byte');
  assert.equal(fs.existsSync(path.join(parent, 'Matéria-Falha')), false, 'destino não aparece');
  assert.equal(fs.existsSync(path.join(parent, '.mesa-free-staging-' + 'inexistente')), false);
  assert.equal(fs.readdirSync(parent).filter((name) => name.startsWith('.mesa-free-staging-')).length, 0, 'staging removido');
  assert.equal(store.findWorkspace(fx.runtime, path.basename(path.dirname(sessionA))).promotion, null, 'store sem plano pendente');
  const stillA = await page.evaluate((p) => window.desk.openSession(p), sessionA);
  assert.equal(stillA.workspace.materials.length, 3, 'origem intacta');

  /* ---- 12. colisão de pasta preserva o que existe e cria a pasta nova ---- */
  fs.mkdirSync(path.join(parent, 'Matéria-A'), {recursive: true});
  fs.writeFileSync(path.join(parent, 'Matéria-A', 'keep.txt'), 'do usuário');
  await stubDialog(app, [parent]);
  /* Motor vivo na sessão Livre (cwd próprio) antes de promover. */
  await page.evaluate(() => window.desk.connect());
  const beforePromote = await page.evaluate(() => window.desk.prompt({text: 'prompt antes de promover', refs: [], images: []}));
  assert.notEqual(beforePromote.sent, false, 'prompt Livre antes da promoção aceito');
  await waitFor(() => fs.readFileSync(sessionA, 'utf8').includes('prompt antes de promover'), 'prompt no JSONL antes da promoção');
  const promoted = await page.evaluate(() => window.desk.freePromote({name: 'Matéria A'}));
  assert.equal(promoted.created, true);
  assert.equal(path.basename(promoted.course.path), 'Matéria-A-2', 'colisão gera pasta nova');
  assert.equal(fs.readFileSync(path.join(parent, 'Matéria-A', 'keep.txt'), 'utf8'), 'do usuário', 'pasta existente intocada');
  assert.deepEqual(fs.readdirSync(path.join(parent, 'Matéria-A')), ['keep.txt']);
  const destMaterials = fs.readdirSync(path.join(promoted.course.path, 'materials')).sort();
  assert.deepEqual(destMaterials, ['PDF durante mutex.pdf', 'Resumo da sessão.pdf', 'avulso.pdf.pdf'].sort(), 'materiais copiados');
  for (const name of destMaterials) {
    const origin = [materialA, materialPdf].find((m) => path.basename(m.path) === name);
    if (origin) assert.deepEqual(fs.readFileSync(path.join(promoted.course.path, 'materials', name)), fs.readFileSync(origin.path), `cópia fiel de ${name}`);
  }
  /* Transferência: MESMO caminho nativo/fila/rascunho e layout remapeado. */
  assert.equal(promoted.data.courseId, promoted.course.id, 'curso ativo é a matéria nova');
  assert.equal(promoted.data.course, 'Matéria A');
  assert.equal(promoted.data.session, sessionA, 'mesma conversa nativa transferida');
  assert.equal(promoted.data.workspace.kind, 'course');
  assert.equal(promoted.data.state.draft, 'digitado durante o PDF');
  const mapped = promoted.data.state.pdfs[0];
  assert.equal(mapped.path, path.join(promoted.course.path, 'materials', 'avulso.pdf.pdf'), 'ref do layout mapeada para a cópia');
  assert.equal(promoted.data.state.pdfRotations[mapped.path], 90, 'rotação mapeada para o caminho novo');
  const configAfter = JSON.parse(fs.readFileSync(fx.configFile, 'utf8'));
  assert.equal(configAfter.courses.some((c) => c.id === promoted.course.id && c.path === promoted.course.path), true, 'matéria entra no config');
  const deskAfter = JSON.parse(fs.readFileSync(fx.deskFile, 'utf8'));
  assert.equal(deskAfter.courseStates[promoted.course.id].session, sessionA);
  assert.equal(deskAfter.courseStates[promoted.course.id].pdfRotations[mapped.path], 90);
  const freeAfterPromote = await page.evaluate(() => window.desk.switchCourse('mesa-free'));
  const promotedEntry = freeAfterPromote.sessions.find((s) => s.path === sessionA);
  assert.equal(promotedEntry.promoted, true);
  assert.equal(promotedEntry.promotedCourseId, promoted.course.id);
  const conversationEntries = await page.evaluate(() => window.desk.conversations());
  assert.ok(conversationEntries.some((entry) => entry.title.includes('Sessão A')), 'lista de conversas do Livre mostra o título da sessão');
  const redirected = await page.evaluate((p) => window.desk.openSession(p), sessionA);
  assert.equal(redirected.courseId, promoted.course.id, 'abrir conversa promovida redireciona para a matéria');
  assert.equal(redirected.session, sessionA);
  /* A ponte da sessão Livre foi encerrada: reconectar usa o cwd da matéria
     nova (nunca o workspace Livre) e a MESMA sessão nativa. */
  await page.evaluate(() => window.desk.connect());
  const afterPromote = await page.evaluate(() => window.desk.prompt({text: 'prompt depois de promover', refs: [], images: []}));
  assert.notEqual(afterPromote.sent, false, 'prompt na matéria promovida aceito');
  await waitFor(() => fs.readFileSync(sessionA, 'utf8').includes('prompt depois de promover'), 'prompt no JSONL da matéria');
  const realCourseNew = fs.realpathSync(path.join(fx.runtime, 'learning', 'Courses', promoted.course.id));
  const cwdAfter = fs.readFileSync(fx.cwdLog, 'utf8').trim().split('\n').at(-1);
  assert.equal(fs.realpathSync(cwdAfter), realCourseNew, 'reconexão usa o cwd da matéria promovida');
  assert.equal(fs.readFileSync(sessionA, 'utf8').includes('prompt antes de promover'), true, 'histórico do Livre segue no mesmo JSONL');

  /* ---- 13. Claude Livre: descriptor próprio, prompt genérico, transferência preservada ---- */
  await page.evaluate(() => window.desk.switchCourse('mesa-free'));
  /* Pi Livre: o cwd é o workspace da sessão e o prompt não leva a matéria. */
  await page.evaluate((p) => window.desk.openSession(p), sessionB);
  await page.evaluate(() => window.desk.connect());
  const piSent = await page.evaluate(() => window.desk.prompt({text: 'pergunta livre pi', refs: [], images: []}));
  assert.notEqual(piSent.sent, false, 'prompt Pi Livre aceito');
  await waitFor(() => fs.existsSync(sessionB), 'JSONL do Pi Livre');
  const freePromptText = (() => {
    try {
      return fs.readFileSync(sessionB, 'utf8').split('\n').filter(Boolean).flatMap((line) => {
        try { return (JSON.parse(line).message?.content || []).filter((part) => part?.type === 'text').map((part) => part.text || ''); } catch { return []; }
      }).join('\n');
    } catch { return ''; }
  })();
  assert.ok(freePromptText.includes('pergunta livre pi'), 'o prompt chegou ao JSONL da sessão Livre');
  assert.equal(freePromptText.includes('Synthetic'), false, 'prompt Livre não carrega a matéria anterior');
  assert.equal(freePromptText.includes(fx.courseDir), false, 'prompt Livre não carrega fonte de curso');
  assert.equal(freePromptText.includes('TUTOR'), false, 'prompt Livre não injeta TUTOR');
  const freeC = await page.evaluate(() => window.desk.newSession('claude'));
  assert.equal(freeC.engine, 'claude');
  assert.ok(freeC.session.includes(path.join('conversations', 'claude-')));
  const claudeSession = freeC.session;
  await page.evaluate(() => window.desk.connect());
  const claudeSent = await page.evaluate(() => window.desk.prompt({text: 'olá, conversa livre claude', refs: [], images: []}));
  assert.notEqual(claudeSent.sent, false, 'prompt Claude aceito');
  const descriptorBefore = await waitFor(() => {
    try {
      const record = readJson(claudeSession);
      return (record.messages || []).length >= 2 && record.delivery?.status === 'settled' ? record : null;
    } catch { return null; }
  }, 'descritor Claude settled');
  const spy = fs.readFileSync(fx.claudeLog, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  assert.ok(spy.length >= 1, 'o SDK espião registrou o prompt');
  assert.equal(spy.at(-1).systemPrompt.includes('TUTOR'), false, 'prompt Livre não leva TUTOR/LEARNER');
  assert.equal(spy.at(-1).systemPrompt.includes('LEARNER'), false, 'prompt Livre não leva TUTOR/LEARNER');
  assert.equal(spy.at(-1).cwd.startsWith(path.join(fx.runtime, 'claude-workspaces') + path.sep), true, 'cwd Claude isolado por conversa');
  const realCourses = fs.realpathSync(path.join(fx.runtime, 'learning', 'Courses'));
  const realFree = fs.realpathSync(path.join(fx.runtime, 'free'));
  const piCwds = fs.readFileSync(fx.cwdLog, 'utf8').trim().split('\n');
  assert.ok(piCwds.every((dir) => dir.startsWith(realCourses + path.sep) || dir.startsWith(realFree + path.sep)), 'nenhum cwd de Pi fora de matéria/Livre');
  const freePiCwds = piCwds.filter((dir) => dir.startsWith(realFree + path.sep));
  assert.ok(freePiCwds.length >= 1, 'Pi da sessão Livre roda com cwd próprio do workspace');
  assert.ok(new Set(freePiCwds).size >= 2, 'mais de uma sessão Livre rodou com cwd próprio');
  for (const dir of new Set(freePiCwds)) {
   assert.ok(fs.existsSync(path.join(dir, 'workspace.json')), 'cwd do Pi Livre é o workspace da sessão');
   assert.equal(fs.existsSync(path.join(dir, 'materials')), true, 'workspace Livre tem a pasta de materiais da sessão');
   const sid = path.basename(dir);
   const record = store.findWorkspace(fx.runtime, sid);
   const own = new Set((record?.materials || []).map((material) => path.basename(material.path)));
   const pdfs = fs.readdirSync(path.join(dir, 'materials')).filter((name) => name.endsWith('.pdf'));
   assert.ok(pdfs.every((name) => own.has(name)), `cwd Livre ${sid} não carrega PDF de outra sessão`);
  }
  await stubDialog(app, [parent]);
  const claudePromoted = await page.evaluate(() => window.desk.freePromote({name: 'Matéria Claude'}));
  assert.equal(claudePromoted.created, true);
  const descriptorAfter = JSON.parse(fs.readFileSync(claudeSession, 'utf8'));
  assert.equal(descriptorAfter.id, descriptorBefore.id, 'id do descritor preservado');
  assert.equal(descriptorAfter.nativeSessionId, descriptorBefore.nativeSessionId, 'sessão nativa preservada');
  assert.equal(descriptorAfter.messages.length, descriptorBefore.messages.length, 'histórico preservado');
  assert.equal(descriptorAfter.delivery.status, descriptorBefore.delivery.status);
  assert.equal(descriptorAfter.courseId, claudePromoted.course.id, 'courseId trocado atomicamente');
  /* Motor Claude preservado: reconectar cria a ponte do curso novo e o
     descritor (mesma conversa nativa) segue recebendo mensagens. */
  await page.evaluate(() => window.desk.connect());
  const claudeAfterPromote = await page.evaluate(() => window.desk.prompt({text: 'depois de promover claude', refs: [], images: []}));
  assert.notEqual(claudeAfterPromote.sent, false, 'prompt Claude pós-promoção aceito');
  await waitFor(() => (readJson(claudeSession).messages || []).length > descriptorBefore.messages.length, 'descritor Claude cresce após a promoção');

  /* ---- 14. restart: sessões vazias continuam listadas; cursos preservados ---- */
  await close(app);
  app = await launch(fx);
  page = await app.firstWindow();
  await waitDesk(page);
  await page.waitForTimeout(1600);
  const restarted = await page.evaluate(() => window.desk.init());
  assert.equal(restarted.courseId, claudePromoted.course.id, 'boot retoma a matéria ativa');
  assert.ok(restarted.courses.some((c) => c.id === 'mesa-free' && c.kind === 'free'));
  assert.ok(restarted.courses.some((c) => c.id === promoted.course.id));
  assert.ok(restarted.courses.some((c) => c.id === claudePromoted.course.id));
  const freeRestart = await page.evaluate(() => window.desk.switchCourse('mesa-free'));
  const paths = freeRestart.sessions.map((s) => s.path);
  assert.ok(paths.includes(sessionB), 'sessão B (JSONL ainda vazio) sobreviveu ao restart');
  assert.ok(paths.includes(sessionA) && paths.includes(claudeSession));
  const bRestart = await page.evaluate((p) => window.desk.openSession(p), sessionB);
  assert.equal(bRestart.state.draft, '', 'B continua sem rascunho de A');
  assert.equal(bRestart.workspace.materials.length, 0);
  const courseRestart = await page.evaluate((id) => window.desk.switchCourse(id), promoted.course.id);
  assert.equal(courseRestart.session, sessionA, 'conversa promovida retomada na matéria');
  assert.equal(courseRestart.state.pdfRotations[path.join(promoted.course.path, 'materials', 'avulso.pdf.pdf')], 90);
  const claudeCourse = await page.evaluate((id) => window.desk.switchCourse(id), claudePromoted.course.id);
  assert.equal(claudeCourse.session, claudeSession);
  assert.equal(claudeCourse.engine, 'claude');
  await close(app);
  app = null;
});

test('boot recupera diário applying: restaura config byte a byte e remove staging', {timeout: 300000}, async (t) => {
  const fx = makeRuntime('recover-apply');
  const configBefore = fs.readFileSync(fx.configFile);
  const record = (() => {
    store.ensureWorkspace(fx.runtime, {sessionId: 'rec-apply', title: 'Rec Aplicar'});
    const source = path.join(fx.runtime, 'origem.pdf');
    fs.writeFileSync(source, tinyPdf('material da recuperação'));
    store.importPdf(fx.runtime, 'rec-apply', {sourcePath: source, name: 'Rec.pdf'});
    return store.findWorkspace(fx.runtime, 'rec-apply');
  })();
  const parentDir = path.join(fx.runtime, 'destino');
  fs.mkdirSync(parentDir, {recursive: true});
  const plan = store.preparePromotion(fx.runtime, 'rec-apply', {parentDir, name: 'Recuperada'});
  const txn = journal.begin(fx.runtime, {
    token: plan.token, freeSessionId: 'rec-apply', courseId: 'curso-recuperado', courseName: 'Recuperada',
    folderPath: plan.folderPath, folderName: plan.folderName, stagingPath: plan.stagingPath, parentDir: plan.parentDir,
    nativePath: record.nativePath, engine: 'pi', configFile: fx.configFile, deskFile: fx.deskFile,
    courseEntry: {id: 'curso-recuperado', name: 'Recuperada', path: plan.folderPath},
    courseState: {session: record.nativePath},
    files: [{label: 'config', file: fx.configFile}, {label: 'desk', file: fx.deskFile}],
  });
  txn.mark('applying');
  // Simula as gravações do host antes do crash.
  fs.writeFileSync(fx.configFile, JSON.stringify({runtimePath: fx.runtime, vaultPath: fx.runtime, courses: [{id: 'Synthetic'}, {id: 'curso-recuperado', path: plan.folderPath}]}));
  fs.writeFileSync(fx.deskFile, JSON.stringify({courseId: 'Synthetic', courseStates: {'curso-recuperado': {session: record.nativePath}}}));

  const app = await launch(fx);
  try {
    const page = await app.firstWindow();
    await waitDesk(page);
    await page.waitForTimeout(500);
    assert.deepEqual(fs.readFileSync(fx.configFile), configBefore, 'config restaurada byte a byte no boot');
    assert.equal(fs.existsSync(journal.journalDir(fx.runtime, plan.token)), false, 'diário resolvido');
    assert.equal(fs.existsSync(plan.stagingPath), false, 'staging removido');
    assert.equal(fs.existsSync(plan.folderPath), false, 'destino nunca apareceu');
    assert.equal(store.findWorkspace(fx.runtime, 'rec-apply').promotion, null, 'store sem plano pendente');
    const init = await page.evaluate(() => window.desk.init());
    assert.equal(init.courses.some((c) => c.id === 'curso-recuperado'), false, 'matéria fantasma não entra nas abas');
  } finally {
    await close(app);
  }
});

test('boot conclui diário committing: publica pasta, recibo e matéria no config/desk', {timeout: 300000}, async (t) => {
  const fx = makeRuntime('recover-commit');
  const record = (() => {
    store.ensureWorkspace(fx.runtime, {sessionId: 'rec-commit', title: 'Rec Concluir'});
    const nativePath = path.join(store.workspaceDir(fx.runtime, 'rec-commit'), 'pi-recuperado.jsonl');
    fs.writeFileSync(nativePath, JSON.stringify({type: 'message', message: {role: 'user', content: [{type: 'text', text: 'histórico preservado'}]}}) + '\n');
    store.setNativePath(fx.runtime, 'rec-commit', nativePath);
    const source = path.join(fx.runtime, 'origem.pdf');
    fs.writeFileSync(source, tinyPdf('material da recuperação final'));
    store.importPdf(fx.runtime, 'rec-commit', {sourcePath: source, name: 'Rec.pdf'});
    return store.findWorkspace(fx.runtime, 'rec-commit');
  })();
  const parentDir = path.join(fx.runtime, 'destino');
  fs.mkdirSync(parentDir, {recursive: true});
  const plan = store.preparePromotion(fx.runtime, 'rec-commit', {parentDir, name: 'Concluída'});
  const txn = journal.begin(fx.runtime, {
    token: plan.token, freeSessionId: 'rec-commit', courseId: 'curso-concluido', courseName: 'Concluída',
    folderPath: plan.folderPath, folderName: plan.folderName, stagingPath: plan.stagingPath, parentDir: plan.parentDir,
    nativePath: record.nativePath, engine: 'pi', configFile: fx.configFile, deskFile: fx.deskFile,
    activeCourseId: 'curso-concluido', activeSession: record.nativePath,
    courseEntry: {id: 'curso-concluido', name: 'Concluída', path: plan.folderPath},
    courseState: {session: record.nativePath, pdfs: []},
    files: [{label: 'config', file: fx.configFile}, {label: 'desk', file: fx.deskFile}],
  });
  txn.mark('applying');
  const configWithCourse = JSON.parse(fs.readFileSync(fx.configFile, 'utf8'));
  configWithCourse.courses = [...configWithCourse.courses, {id: 'curso-concluido', name: 'Concluída', path: plan.folderPath}];
  fs.writeFileSync(fx.configFile, JSON.stringify(configWithCourse, null, 2) + '\n');
  const deskWithState = JSON.parse(fs.readFileSync(fx.deskFile, 'utf8'));
  deskWithState.courseStates = {...deskWithState.courseStates, 'curso-concluido': {session: record.nativePath, pdfs: []}};
  fs.writeFileSync(fx.deskFile, JSON.stringify(deskWithState));
  txn.mark('committing');

  const app = await launch(fx);
  try {
    const page = await app.firstWindow();
    await waitDesk(page);
    await page.waitForTimeout(500);
    assert.equal(fs.existsSync(journal.journalDir(fx.runtime, plan.token)), false, 'diário concluído');
    assert.equal(fs.existsSync(plan.folderPath), true, 'pasta publicada');
    assert.deepEqual(fs.readdirSync(plan.folderPath), ['materials']);
    assert.equal(fs.existsSync(plan.stagingPath), false);
    const updated = store.findWorkspace(fx.runtime, 'rec-commit');
    assert.equal(updated.promotion.status, 'promoted');
    assert.equal(updated.promotion.courseId, 'curso-concluido');
    const config = JSON.parse(fs.readFileSync(fx.configFile, 'utf8'));
    assert.equal(config.courses.some((c) => c.id === 'curso-concluido'), true);
    const deskRecovered = JSON.parse(fs.readFileSync(fx.deskFile, 'utf8'));
    assert.equal(deskRecovered.courseId, 'curso-concluido', 'matéria promovida é a ativa no desk recuperado');
    assert.equal(deskRecovered.session, record.nativePath);
    const init = await page.evaluate(() => window.desk.init());
    assert.equal(init.courses.some((c) => c.id === 'curso-concluido'), true, 'matéria recuperada aparece nas abas');
    const course = await page.evaluate((id) => window.desk.switchCourse(id), 'curso-concluido');
    assert.equal(course.session, record.nativePath, 'conversa nativa preservada');
  } finally {
    await close(app);
  }
});

test('falha pós-commit não desfaz a promoção e o boot acorda no curso novo', {timeout: 300000}, async (t) => {
  const fx = makeRuntime('post-commit');
  const source = path.join(fx.runtime, 'pos.pdf');
  fs.writeFileSync(source, tinyPdf('pós-commit', 2));
  let app = await launch(fx);
  let closed = false;
  try {
    let page = await app.firstWindow();
    await waitDesk(page);
    await page.waitForTimeout(1600);
    await page.evaluate(() => window.desk.switchCourse('mesa-free'));
    await stubDialog(app, [source]);
    const opened = await page.evaluate(() => window.desk.freeOpenPdf());
    const material = opened.workspace.materials[0];
    await page.evaluate((p) => window.desk.save({
      draft: 'rascunho pós-commit',
      pdfs: [{path: p, page: 1, zoom: 1, rotation: 0, scrollX: 0, scrollY: 0, invert: false, minimized: false}],
      pdfRotations: {[p]: 180},
      study: {title: '', xopp: ''}, referenceVisible: true, chatWidth: 390, calcHeight: 220, pdfSplit: 0.5, theme: 'auto',
    }), material.path);
    const parent = path.join(fx.runtime, 'materias');
    fs.mkdirSync(parent, {recursive: true});
    await stubDialog(app, [parent]);
    /* O 1º write de desk.json é o snapshot pré-commit; a partir do 2º a
       promoção já está durável e o erro não pode desfazê-la. */
    await app.evaluate(() => {
      const nodeFs = process.getBuiltinModule('fs');
      globalThis.__origWFS = nodeFs.writeFileSync;
      globalThis.__deskWrites = 0;
      nodeFs.writeFileSync = function (file, ...rest) {
        if (String(file).endsWith('desk.json')) {
          globalThis.__deskWrites += 1;
          if (globalThis.__deskWrites === 2) throw new Error('ENOSPC pós-commit');
        }
        return globalThis.__origWFS.call(nodeFs, file, ...rest);
      };
    });
    const promoted = await page.evaluate(() => window.desk.freePromote({name: 'Pós Commit'}));
    assert.equal(promoted.created, true, 'erro pós-commit não derruba a promoção');
    await app.evaluate(() => {
      const nodeFs = process.getBuiltinModule('fs');
      if (globalThis.__origWFS) {
        nodeFs.writeFileSync = globalThis.__origWFS;
        delete globalThis.__origWFS;
      }
    });
    const destMaterial = path.join(promoted.course.path, 'materials', material.name);
    assert.equal(fs.existsSync(destMaterial), true, 'cópia publicada');
    assert.equal(store.findWorkspace(fx.runtime, path.basename(path.dirname(opened.session))).promotion.status, 'promoted', 'recibo durável');
    const config = JSON.parse(fs.readFileSync(fx.configFile, 'utf8'));
    assert.equal(config.courses.some((c) => c.id === promoted.course.id), true, 'config durável');
    /* Relança: o desk.json em disco é o snapshot pré-commit — já com o curso
       novo ativo e os caminhos mapeados. */
    await app.close();
    closed = true;
    app = await launch(fx);
    closed = false;
    page = await app.firstWindow();
    await waitDesk(page);
    await page.waitForTimeout(1600);
    const restarted = await page.evaluate(() => window.desk.init());
    assert.equal(restarted.courseId, promoted.course.id, 'boot acorda no curso promovido');
    assert.equal(restarted.session, opened.session, 'mesma conversa nativa');
    assert.equal(restarted.state.pdfs?.[0]?.path, destMaterial, 'leitor com o caminho mapeado do destino');
    assert.equal(restarted.state.pdfRotations?.[destMaterial], 180, 'rotação mapeada sobreviveu');
    assert.equal(restarted.state.draft, 'rascunho pós-commit');
  } finally {
    if (!closed) await close(app);
  }
});

test('fechar o app durante a geração do PDF cancela sem material órfão', {timeout: 300000}, async (t) => {
  const fx = makeRuntime('abort');
  const app = await launch(fx);
  let closed = false;
  try {
    const page = await app.firstWindow();
    await waitDesk(page);
    await page.waitForTimeout(1600);
    await page.evaluate(() => window.desk.switchCourse('mesa-free'));
    const markdown = Array.from({length: 220}, (_, i) => `## Bloco ${i}\n\nTexto com $x_{${i}}^2$ para atrasar a impressão e permitir o fechamento no meio.\n`).join('\n');
    const pending = page.evaluate((md) => window.desk.freeSaveMaterial({title: 'PDF abortado', markdown: md}).then(() => 'resolved', (error) => String(error.message || error)), markdown).catch((error) => String(error.message || error));
    await page.waitForTimeout(150);
    await app.close();
    closed = true;
    const outcome = await pending;
    assert.equal(typeof outcome, 'string');
    const records = store.listWorkspaces(fx.runtime);
    assert.equal(records.reduce((total, record) => total + record.materials.length, 0), 0, 'material abortado não foi registrado');
    for (const record of records) {
      const dir = path.join(store.workspaceDir(fx.runtime, record.id), 'materials');
      if (fs.existsSync(dir)) assert.deepEqual(fs.readdirSync(dir), [], `sem PDF solto em ${record.id}`);
    }
  } finally {
    if (!closed) await close(app);
  }
});

test('zero matérias configuradas: Livre já é utilizável no boot', {timeout: 300000}, async (t) => {
  const fx = makeRuntime('zero', {course: false});
  fs.writeFileSync(fx.configFile, JSON.stringify({runtimePath: fx.runtime, vaultPath: '', courses: [], claudePath: fx.claudeStub}, null, 2) + '\n');
  const app = await launch(fx);
  t.after(() => close(app));
  const page = await app.firstWindow();
  await waitDesk(page);
  const init = await page.evaluate(() => window.desk.init());
  assert.equal(init.courseId, 'mesa-free', 'sem matérias o boot abre no Livre');
  assert.deepEqual(init.courses, [{id: 'mesa-free', name: 'Livre', kind: 'free'}]);
  assert.equal(init.workspace.kind, 'free');
  assert.equal(init.needsSetup, true, 'sem vault/matéria a boas-vindas de setup continua sinalizada');
  const opened = await page.evaluate(() => window.desk.freeSaveMaterial({title: 'PDF sem matéria', markdown: 'Conteúdo avulso.'}));
  assert.equal(opened.saved, true);
  assert.equal(opened.data.workspace.materials.length, 1);
  const sw = await page.evaluate(() => window.desk.switchCourse('mesa-free'));
  assert.equal(sw.courseId, 'mesa-free');
});
