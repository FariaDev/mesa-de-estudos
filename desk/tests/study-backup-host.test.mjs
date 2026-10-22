import {ptMatches, ptT} from './pt-text.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {seedRuntime, tempDir, write, read, cleanup} from './study-backup-fixtures.mjs';

/* Integração do HOST de backup (study-backup-host.cjs) sem Electron: os
   handlers de IPC são registrados num ipcMain de mentira e chamados como o
   preload chama. Cobre config no MESMO arquivo, backup, prévia, aplicação com
   remapeamento, recuperação de queda, pacote/adoção e a allowlist externa.
   Fixtures sintéticas; o diálogo nativo é um mock. */

const require = createRequire(import.meta.url);
const backup = require('../src/study-data/backup.cjs');
const annotations = require('../src/study-data/annotations.cjs');
const review = require('../review.cjs');
const {adoptPackage} = require('../src/study-data/adopt-package.cjs');
const {registerBackupHost} = require('../study-backup-host.cjs');

function makeHost({fixture, courses = () => [], external = null, adopt = null, afterRestore = async () => ({reloaded: true})}) {
  const handlers = new Map();
  const ipcMain = {handle: (channel, fn) => handlers.set(channel, fn)};
  const calls = {afterRestore: 0, stopped: 0, lastRestore: null};
  let nextPick = '';
  const dialog = {showOpenDialog: async () => ({canceled: !nextPick, filePaths: nextPick ? [nextPick] : []})};
  const shell = {openPath: async () => ''};
  const host = registerBackupHost({
    t: ptT,
    ipcMain,
    dialog,
    shell,
    win: () => null,
    runtime: () => fixture.runtime,
    deskDir: path.resolve(import.meta.dirname, '..'),
    courses,
    courseId: () => 'mat-1',
    persist: () => {},
    idle: async () => {},
    mutate: async (_kind, fn) => fn(),
    stop: () => { calls.stopped++; },
    afterRestore: async (result) => { calls.afterRestore++; calls.lastRestore = result; return afterRestore(result); },
    adopt: adopt || (() => ({ok: true})),
    external: external ? () => external : () => [],
    log: () => {},
  });
  const call = (channel, ...args) => {
    const handler = handlers.get(channel);
    assert.ok(handler, `handler registrado: ${channel}`);
    return handler({}, ...args);
  };
  const pick = (value) => { nextPick = value; };
  return {host, handlers, call, pick, calls};
}

async function configureDestination(call, pick, dest) {
  pick(dest);
  const picked = await call('backup-pick-folder');
  assert.equal(picked, dest);
  await call('backup-config', {destination: dest, auto: false});
}

test('host: config no mesmo arquivo, run, prévia, remap e dados recuperados visíveis', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-host-dest');
  const list = [{id: 'mat-1', name: 'Algebra Linear', path: fixture.materialsDir}];
  write(fixture.runtime, 'config.json', JSON.stringify({courses: [{id: 'mat-1', name: 'Algebra Linear', path: fixture.materialsDir}]}));
  const {host, call, pick, calls} = makeHost({fixture, courses: () => list});
  try {
    await configureDestination(call, pick, dest);
    /* `backup-config` grava no MESMO arquivo que o host lê por runtime(). */
    assert.equal(host.services.settingsPath(), path.join(fixture.runtime, 'mesa-backup.json'));
    assert.equal(backup.readConfig(fixture.runtime).destination, dest);
    assert.equal(fs.statSync(path.join(fixture.runtime, 'mesa-backup.json')).isFile(), true);

    const run = await call('backup-run', {reason: 'manual', label: 'host'});
    assert.ok(run.snapshotId.startsWith('snap-'));
    assert.equal((await call('backup-list')).length, 1);

    write(fixture.runtime, 'review.json', '{"mat-1":["mudou"]}');
    const plan = await call('backup-restore-preview', {snapshotId: run.snapshotId});
    assert.equal(plan.materials.length, 1);
    assert.equal(plan.materials[0].currentPath, fixture.materialsDir);
    assert.equal(plan.materials[0].currentExists, true);
    assert.equal(plan.materialCourses[0].path, path.join(fixture.runtime, 'courses', 'Algebra Linear'));

    const applied = await call('backup-restore-apply', {planId: plan.planId, remapMaterials: true});
    assert.equal(applied.applied, true);
    assert.equal(applied.data.reloaded, true);
    assert.equal(calls.afterRestore, 1);
    assert.equal(calls.stopped, 1, 'a ponte é parada antes de restaurar');
    assert.equal(applied.materialsRemapped.length, 1);
    /* O root recebe o resultado no afterRestore para remapear a config que mora
       FORA do runtime (a daqui mora dentro e já foi reescrita). */
    assert.equal(calls.lastRestore.materialsRemapped.length, 1);
    assert.equal(calls.lastRestore.materialCourses[0].path, path.join(fixture.runtime, 'courses', 'Algebra Linear'));

    /* Dados recuperados de verdade: leitor real do Caderno e config remapeada. */
    assert.equal(review.readItems(fixture.runtime, 'mat-1').length, 1);
    const restoredDir = path.join(fixture.runtime, 'courses', 'Algebra Linear');
    assert.equal(JSON.parse(read(fixture.runtime, 'config.json')).courses[0].path, restoredDir);
    assert.equal(fs.existsSync(path.join(restoredDir, 'aula.pdf')), true);
    /* A pasta original da usuária não foi tocada. */
    assert.equal(fs.existsSync(path.join(fixture.materialsDir, 'aula.pdf')), true);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest);
  }
});

test('host: queda no meio da restauração devolve o estado anterior visível', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-host-dest');
  const {host, call, pick} = makeHost({fixture});
  try {
    await configureDestination(call, pick, dest);
    const run = await call('backup-run', {reason: 'manual'});
    const before = {'mat-1': [{question: 'pergunta recuperada', attempt: '2x', difficulty: 'media', ref: {name: 'aula.pdf', page: 3, path: path.join(fixture.materialsDir, 'aula.pdf')}}]};
    write(fixture.runtime, 'review.json', JSON.stringify(before));
    const plan = await host.services.previewRestore(run.snapshotId);
    /* Simula a queda: diário gravado sem `finished`, o arquivo já trocado e o
       pré-restore com o estado anterior. */
    const journalFile = path.join(fixture.runtime, '.backup', 'journal', `${plan.planId}.json`);
    const preDir = path.join(fixture.runtime, '.backup', 'pre-restore', plan.planId);
    fs.mkdirSync(path.dirname(journalFile), {recursive: true});
    fs.mkdirSync(preDir, {recursive: true});
    fs.writeFileSync(path.join(preDir, 'review.json'), JSON.stringify(before));
    fs.writeFileSync(journalFile, JSON.stringify({planId: plan.planId, replaced: [{path: 'review.json'}], created: [], finished: false}));
    fs.writeFileSync(path.join(fixture.runtime, 'review.json'), '{"corrompido":true}');

    const recovered = host.services.recover();
    assert.equal(recovered.length, 1);
    assert.equal(recovered[0].ok, true);
    /* Visível pelo módulo real do Caderno, não só bytes no disco. */
    const items = review.readItems(fixture.runtime, 'mat-1');
    assert.equal(items.length, 1);
    assert.equal(items[0].question, 'pergunta recuperada');
    assert.equal(read(fixture.runtime, 'review.json'), JSON.stringify(before));
    assert.equal(fs.existsSync(journalFile), false);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest);
  }
});

test('host: exportar, importar e adotar deixa as anotações visíveis no runtime', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-host-dest');
  const importRoot = tempDir('mesa-host-import');
  const hostConfig = {courses: [{id: 'mat-1', name: 'Algebra Linear', path: fixture.materialsDir}]};
  const list = () => hostConfig.courses;
  const adopt = (result) => {
    const next = {...hostConfig, courses: [...hostConfig.courses, result.course]};
    const adopted = adoptPackage({
      runtime: fixture.runtime,
      result,
      writeConfiguration: () => {
        fs.writeFileSync(path.join(fixture.runtime, 'config.json'), JSON.stringify(next));
        hostConfig.courses = next.courses;
      },
    });
    return {sessions: adopted.sessions, course: result.course};
  };
  const {call, pick} = makeHost({fixture, courses: list, adopt});
  try {
    await configureDestination(call, pick, dest);
    const exported = await call('share-export-course', {directory: dest, conversations: true});
    assert.equal(fs.existsSync(exported.file), true);
    assert.equal(exported.features.annotations, true);

    pick(exported.file);
    assert.equal(await call('share-pick-file'), exported.file);
    pick(importRoot);
    await call('backup-pick-folder');
    const preview = await call('share-import-preview', {file: exported.file, directory: importRoot, name: 'Nova'});
    assert.ok(preview.courseId.startsWith('materia-'));
    assert.equal(preview.annotations.items, 1);

    const imported = await call('share-import-course', {file: exported.file, directory: importRoot, name: 'Nova'});
    assert.equal(imported.data.course.id, imported.courseId);
    assert.ok(imported.data.sessions.length > 0, 'conversa importada vira sessão');
    assert.ok(imported.files > 0);
    assert.ok(imported.course.path.startsWith(importRoot));

    /* A adoção instala no runtime: Caderno e anotações visíveis de verdade. */
    assert.equal(review.readItems(fixture.runtime, imported.courseId).length, 1);
    const notes = annotations.readNotes(fixture.runtime, {courseId: imported.courseId});
    assert.equal(notes.length, 1);
    assert.ok(notes[0].ref.path.startsWith(imported.materialsDir), 'nota aponta para o material importado');
    assert.ok(!JSON.stringify(notes).includes(fixture.materialsDir), 'sem caminho do autor');
    /* Conversas Pi e Claude importadas existem no runtime. */
    assert.ok(fs.readdirSync(path.join(fixture.runtime, 'conversations')).some((name) => /^claude-.*\.json$/.test(name)));
    assert.ok(fs.readdirSync(fixture.runtime).some((name) => /^pi-.*\.jsonl$/.test(name)));
    /* A config registrada aponta para a matéria nova. */
    const registered = JSON.parse(read(fixture.runtime, 'config.json')).courses.find((course) => course.id === imported.courseId);
    assert.equal(registered.path, imported.course.path);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest, importRoot);
  }
});

test('host: allowlist externa explícita e devolução segura da config pessoal', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-host-dest');
  const configDir = tempDir('mesa-config-pessoal');
  const configFile = write(configDir, 'config.json', JSON.stringify({personal: true}));
  write(configDir, 'auth.json', '{"token":"NAO-BACKUP"}');
  const external = [{path: configFile, ref: 'mesa-config.json', resume: 'transcript-only'}];
  const {host, call, pick} = makeHost({fixture, external});
  try {
    await configureDestination(call, pick, dest);
    const run = await call('backup-run', {reason: 'manual'});
    const manifest = backup.readManifest(run.path);
    const paths = manifest.entries.map((entry) => entry.path);
    assert.ok(paths.includes('external/mesa-config.json'), 'config explícita entra');
    assert.ok(!paths.some((item) => item.includes('auth.json')), 'irmão não autorizado não entra');
    /* A referência externa é portátil (sem caminho absoluto no manifesto). */
    assert.ok(!JSON.stringify(manifest.entries).includes(configDir));

    /* A config pessoal muda e a versão é restaurada. */
    write(configDir, 'config.json', JSON.stringify({personal: false}));
    const plan = await call('backup-restore-preview', {snapshotId: run.snapshotId});
    const applied = await call('backup-restore-apply', {planId: plan.planId});
    const stored = path.join(fixture.runtime, 'external', 'mesa-config.json');
    assert.equal(fs.existsSync(stored), true, 'restauração guarda a cópia DENTRO do runtime');
    assert.equal(JSON.parse(read(configDir, 'config.json')).personal, false, 'a pasta de origem não foi tocada sozinha');

    /* A devolução só acontece por pedido explícito e por caminho autorizado. */
    assert.equal(host.services.externalPlan(applied).length, 1);
    const preview = host.services.restoreExternal(applied, {ref: 'mesa-config.json'});
    assert.deepEqual(preview.targets, [configFile]);
    assert.equal(preview.action, 'replace');
    const restored = host.services.restoreExternal(applied, {ref: 'mesa-config.json', apply: true});
    assert.equal(restored.action, 'restored');
    assert.equal(JSON.parse(read(configDir, 'config.json')).personal, true);
    assert.ok(restored.backupOf && fs.existsSync(restored.backupOf), 'pré-restore da config');
    assert.throws(() => host.services.restoreExternal(applied, {ref: 'nao-autorizado.json'}), ptMatches(/não está nesta versão|autorizada/));
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest, configDir);
  }
});

test('host: config com link simbólico é substituída, sem escrever pelo link', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-host-dest');
  const outside = write(tempDir('mesa-fora'), 'alvo.json', JSON.stringify({antigo: true}));
  const configPath = path.join(fixture.runtime, 'mesa-backup.json');
  fs.symlinkSync(outside, configPath);
  const {host, call, pick} = makeHost({fixture});
  try {
    await configureDestination(call, pick, dest);
    assert.equal(fs.lstatSync(configPath).isSymbolicLink(), false, 'a config virou arquivo real (o link não foi seguido)');
    assert.equal(JSON.parse(read(path.dirname(outside), 'alvo.json')).antigo, true, 'alvo fora do runtime intacto');
    assert.equal(backup.readConfig(fixture.runtime).destination, dest);
    assert.equal((await host.services.status()).destination, dest);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest, path.dirname(outside));
  }
});
