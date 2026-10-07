// Testes do diário externo da promoção Livre → matéria
// (desk/free-promotion.cjs): restauração byte a byte, conclusão para frente,
// colisão/conteúdo estranho SEM destruição e a varredura de boot. Tudo
// sintético num runtime temporário — nada real é tocado.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const store = require('../free-workspaces.cjs');
const journal = require('../free-promotion.cjs');

const runtimes = [];
after(() => {
  for (const dir of runtimes) {
    try { fs.rmSync(dir, {recursive: true, force: true}); } catch { /* já foi */ }
  }
});

function makeRuntime(tag) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `mesa-free-promo-${tag}-`));
  runtimes.push(dir);
  return dir;
}

function pdfBytes(text = 'Sessão livre') {
  const stream = `BT /F1 16 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>',
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
    `<</Length ${stream.length}>>\nstream\n${stream}\nendstream`,
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((object, index) => {
    offsets.push(out.length);
    out += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const startxref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((off) => `${String(off).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${startxref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

function seedWorkspace(runtime, {sessionId = 'sess-1', withMaterial = true} = {}) {
  store.ensureWorkspace(runtime, {sessionId, title: 'Conversa de teste'});
  if (withMaterial) {
    const source = path.join(runtime, 'origem.pdf');
    fs.writeFileSync(source, pdfBytes());
    store.importPdf(runtime, sessionId, {sourcePath: source, name: 'Lista.pdf'});
  }
  return store.findWorkspace(runtime, sessionId);
}

function specFor(runtime, record, {token = 'tok-1'} = {}) {
  const parentDir = path.join(runtime, 'destino');
  fs.mkdirSync(parentDir, {recursive: true});
  const plan = store.preparePromotion(runtime, record.id, {parentDir, name: 'Matéria Nova'});
  return {plan, parentDir};
}

test('rollback restaura config/desk byte a byte e desfaz o staging', () => {
  const runtime = makeRuntime('rollback');
  const record = seedWorkspace(runtime);
  const {plan} = specFor(runtime, record);
  const configFile = path.join(runtime, 'config.json');
  const deskFile = path.join(runtime, 'desk.json');
  const configBefore = Buffer.from('{"vaultPath":"/x","courses":[]}\n');
  const deskBefore = Buffer.from('{"courseId":"mesa-free","free":{"activeId":"sess-1"}}');
  fs.writeFileSync(configFile, configBefore);
  fs.writeFileSync(deskFile, deskBefore);
  const txn = journal.begin(runtime, {
    token: plan.token, freeSessionId: record.id, courseId: 'curso-1', courseName: 'Matéria Nova',
    folderPath: plan.folderPath, folderName: plan.folderName, stagingPath: plan.stagingPath, parentDir: plan.parentDir,
    nativePath: record.nativePath, engine: 'pi', configFile, deskFile,
    courseEntry: {id: 'curso-1', name: 'Matéria Nova', path: plan.folderPath},
    courseState: {session: record.nativePath},
    files: [{label: 'config', file: configFile}, {label: 'desk', file: deskFile}],
  });
  txn.mark('applying');
  fs.writeFileSync(configFile, '{"courses":[{"id":"curso-1"}]}');
  fs.writeFileSync(deskFile, '{"courseId":"curso-1"}');
  const result = txn.rollback({store});
  assert.equal(result.ok, true);
  assert.deepEqual(fs.readFileSync(configFile), configBefore, 'config volta byte a byte');
  assert.deepEqual(fs.readFileSync(deskFile), deskBefore, 'desk volta byte a byte');
  assert.equal(fs.lstatSync(plan.stagingPath, {throwIfNoEntry: false}), undefined, 'staging some');
  assert.equal(fs.lstatSync(plan.folderPath, {throwIfNoEntry: false}), undefined, 'destino nunca existiu');
  assert.equal(store.findWorkspace(runtime, record.id).promotion, null, 'store sem plano pendente');
  assert.equal(fs.existsSync(journal.journalDir(runtime, plan.token)), false, 'diário some');
});

test('recover em "applying" desfaz e apaga o diário', () => {
  const runtime = makeRuntime('recover-rollback');
  const record = seedWorkspace(runtime);
  const {plan} = specFor(runtime, record);
  const configFile = path.join(runtime, 'config.json');
  const deskFile = path.join(runtime, 'desk.json');
  fs.writeFileSync(configFile, '{"courses":[]}\n');
  fs.writeFileSync(deskFile, '{"courseId":"mesa-free"}');
  const txn = journal.begin(runtime, {
    token: plan.token, freeSessionId: record.id, courseId: 'curso-2', courseName: 'Nova',
    folderPath: plan.folderPath, folderName: plan.folderName, stagingPath: plan.stagingPath, parentDir: plan.parentDir,
    nativePath: record.nativePath, engine: 'pi', configFile, deskFile,
    courseEntry: {id: 'curso-2', name: 'Nova', path: plan.folderPath},
    courseState: {session: record.nativePath},
    files: [{label: 'config', file: configFile}, {label: 'desk', file: deskFile}],
  });
  txn.mark('applying');
  fs.writeFileSync(configFile, '{"courses":[{"id":"curso-2"}]}\n');
  const actions = journal.recover(runtime, {store});
  assert.equal(actions.length, 1);
  assert.equal(actions[0].action, 'rolled-back');
  assert.equal(fs.readFileSync(configFile, 'utf8'), '{"courses":[]}\n');
  assert.equal(store.findWorkspace(runtime, record.id).promotion, null);
  assert.equal(fs.existsSync(journal.journalDir(runtime, plan.token)), false);
});

test('recover em "committing" conclui: rename, recibo, config/desk com a matéria', () => {
  const runtime = makeRuntime('recover-forward');
  const record = seedWorkspace(runtime);
  const {plan} = specFor(runtime, record);
  const configFile = path.join(runtime, 'config.json');
  const deskFile = path.join(runtime, 'desk.json');
  fs.writeFileSync(configFile, '{"vaultPath":"/x","courses":[]}\n');
  fs.writeFileSync(deskFile, '{"courseId":"mesa-free","courseStates":{}}');
  const courseState = {session: record.nativePath, pdfs: []};
  const txn = journal.begin(runtime, {
    token: plan.token, freeSessionId: record.id, courseId: 'curso-3', courseName: 'Matéria Nova',
    folderPath: plan.folderPath, folderName: plan.folderName, stagingPath: plan.stagingPath, parentDir: plan.parentDir,
    nativePath: record.nativePath, engine: 'pi', configFile, deskFile,
    activeCourseId: 'curso-3', activeSession: record.nativePath,
    courseEntry: {id: 'curso-3', name: 'Matéria Nova', path: plan.folderPath},
    courseState,
    files: [{label: 'config', file: configFile}, {label: 'desk', file: deskFile}],
  });
  txn.mark('applying');
  // Host já escreveu config/desk antes do commit; o crash foi antes do rename.
  fs.writeFileSync(configFile, JSON.stringify({vaultPath: '/x', courses: [{id: 'curso-3', name: 'Matéria Nova', path: plan.folderPath}]}, null, 2) + '\n');
  fs.writeFileSync(deskFile, JSON.stringify({courseId: 'mesa-free', session: '', courseStates: {'curso-3': courseState}}));
  txn.mark('committing');
  const actions = journal.recover(runtime, {store});
  assert.equal(actions.length, 1);
  assert.equal(actions[0].action, 'completed');
  const updated = store.findWorkspace(runtime, record.id);
  assert.equal(updated.promotion.status, 'promoted');
  assert.equal(updated.promotion.courseId, 'curso-3');
  assert.equal(fs.lstatSync(plan.folderPath, {throwIfNoEntry: false}).isDirectory(), true, 'destino existe');
  assert.equal(fs.lstatSync(plan.stagingPath, {throwIfNoEntry: false}), undefined, 'staging foi consumido');
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  assert.equal(config.courses.some((course) => course.id === 'curso-3'), true);
  const desk = JSON.parse(fs.readFileSync(deskFile, 'utf8'));
  assert.equal(desk.courseStates['curso-3'].session, record.nativePath);
  assert.equal(desk.courseId, 'curso-3', 'matéria promovida vira a ativa no snapshot concluído');
  assert.equal(desk.session, record.nativePath);
  assert.equal(fs.existsSync(journal.journalDir(runtime, plan.token)), false);
});

test('recover em "committing" com conteúdo estranho NÃO apaga nada e preserva o diário', () => {
  const runtime = makeRuntime('recover-conflict');
  const record = seedWorkspace(runtime);
  const {plan} = specFor(runtime, record);
  const configFile = path.join(runtime, 'config.json');
  const deskFile = path.join(runtime, 'desk.json');
  fs.writeFileSync(configFile, '{"courses":[]}\n');
  fs.writeFileSync(deskFile, '{}');
  const txn = journal.begin(runtime, {
    token: plan.token, freeSessionId: record.id, courseId: 'curso-4', courseName: 'Conflito',
    folderPath: plan.folderPath, folderName: plan.folderName, stagingPath: plan.stagingPath, parentDir: plan.parentDir,
    nativePath: record.nativePath, engine: 'pi', configFile, deskFile,
    courseEntry: {id: 'curso-4', name: 'Conflito', path: plan.folderPath},
    courseState: {session: record.nativePath},
    files: [{label: 'config', file: configFile}, {label: 'desk', file: deskFile}],
  });
  txn.mark('applying');
  // Um terceiro criou a pasta de destino com conteúdo que não é nosso.
  fs.mkdirSync(path.join(plan.folderPath, 'materials'), {recursive: true});
  fs.writeFileSync(path.join(plan.folderPath, 'materials', 'estranho.pdf'), 'não é nosso');
  fs.writeFileSync(path.join(plan.folderPath, 'anotacoes.txt'), 'do usuário');
  // Força o plano para `committing` (crash depois do journal, antes do rename).
  const workspaceFile = path.join(store.workspaceDir(runtime, record.id), store.FILENAME);
  const raw = JSON.parse(fs.readFileSync(workspaceFile, 'utf8'));
  raw.promotion = {...raw.promotion, status: 'committing', courseId: 'curso-4', courseName: 'Conflito'};
  fs.writeFileSync(workspaceFile, JSON.stringify(raw));
  txn.mark('committing');
  const actions = journal.recover(runtime, {store});
  assert.equal(actions.length, 1);
  assert.notEqual(actions[0].action, 'completed');
  assert.equal(fs.readFileSync(path.join(plan.folderPath, 'anotacoes.txt'), 'utf8'), 'do usuário', 'conteúdo estranho intacto');
  assert.equal(fs.readFileSync(path.join(plan.folderPath, 'materials', 'estranho.pdf'), 'utf8'), 'não é nosso');
  assert.equal(fs.existsSync(journal.journalDir(runtime, plan.token)), true, 'diário fica para resolução humana');
  const updated = store.findWorkspace(runtime, record.id);
  assert.equal(updated.promotion.status, 'committing', 'store preservado sem auto-decisão');
});

test('sessions() lista a sessão com diário e recover ignora diário inválido', () => {
  const runtime = makeRuntime('sessions');
  const record = seedWorkspace(runtime);
  const {plan} = specFor(runtime, record);
  fs.writeFileSync(path.join(runtime, 'config.json'), '{}\n');
  const txn = journal.begin(runtime, {
    token: plan.token, freeSessionId: record.id, courseId: 'curso-5', courseName: 'X',
    folderPath: plan.folderPath, folderName: plan.folderName, stagingPath: plan.stagingPath, parentDir: plan.parentDir,
    nativePath: record.nativePath, engine: 'pi',
    files: [{label: 'config', file: path.join(runtime, 'config.json')}],
  });
  assert.deepEqual([...journal.sessions(runtime)], [record.id]);
  assert.equal(journal.readJournal(runtime, plan.token).phase, 'prepared');
  const bogus = journal.journalDir(runtime, 'diario-torto');
  fs.mkdirSync(bogus, {recursive: true});
  fs.writeFileSync(path.join(bogus, 'journal.json'), '{ nem json');
  const actions = journal.recover(runtime, {store});
  assert.equal(actions.length, 1, 'o diário válido em prepared foi desfeito');
  assert.equal(actions[0].action, 'rolled-back');
  assert.equal(fs.existsSync(bogus), true, 'diário ilegível é preservado');
});
