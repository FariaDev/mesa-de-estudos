import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {seedRuntime, tempDir, write, read, cleanup, PDF_BYTES} from './study-backup-fixtures.mjs';

/* Restauração com material de matéria: a versão guarda a cópia em
   `courses/<matéria>/…` e a prévia mostra o remapeamento. O padrão preserva as
   referências quando a pasta original existe; origem ausente remapeia
   automaticamente; `{materials:'remap'}` força e a pasta ORIGINAL nunca é
   tocada. Fixtures sintéticas. */

const require = createRequire(import.meta.url);
const backup = require('../src/study-data/backup.cjs');
const {restoreConfiguration} = require('../src/study-data/restore-config.cjs');

const COURSE = {id: 'mat-1', name: 'Algebra Linear'};

function seedWithConfig(fixture) {
  /* Config dentro do runtime (modo pasta única): entra na versão e prova o
     remapeamento do caminho da matéria. */
  write(fixture.runtime, 'config.json', JSON.stringify({
    courses: [{id: COURSE.id, name: COURSE.name, path: fixture.materialsDir}],
    runtimePath: fixture.runtime,
  }));
}

async function makeSnapshot(fixture, dest) {
  return backup.backupNow({
    runtime: fixture.runtime,
    root: dest,
    materials: [{...COURSE, path: fixture.materialsDir}],
    reason: 'manual',
    log: () => {},
  });
}

test('restauração: manifesto guarda os grupos de material e a prévia os mostra', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  try {
    seedWithConfig(fixture);
    const snapshot = await makeSnapshot(fixture, dest);
    const manifest = backup.readManifest(snapshot.path);
    assert.equal(Array.isArray(manifest.materials), true);
    const group = manifest.materials.find((item) => item.courseId === 'mat-1');
    assert.ok(group, 'grupo da matéria no manifesto');
    assert.equal(group.archiveBase, 'courses/Algebra Linear');
    assert.equal(group.sourceDir, path.resolve(fixture.materialsDir));
    assert.equal(group.sourceReal, fs.realpathSync(fixture.materialsDir));
    /* O manifesto continua sem caminho externo bruto nas entradas. */
    assert.ok(!JSON.stringify(manifest.entries).includes(fixture.materialsDir));

    const plan = await backup.prepareRestore({runtime: fixture.runtime, root: dest, snapshotId: snapshot.snapshotId});
    assert.equal(plan.materials.length, 1);
    const material = plan.materials[0];
    assert.equal(material.courseId, 'mat-1');
    assert.equal(material.from, path.resolve(fixture.materialsDir));
    assert.equal(material.real, fs.realpathSync(fixture.materialsDir));
    assert.ok(material.froms.includes(path.resolve(fixture.materialsDir)));
    assert.equal(material.to, path.join(fixture.runtime, 'courses', 'Algebra Linear'));
    assert.ok(material.files >= 4, 'conta os arquivos do material');
    assert.equal(material.stale, false, 'origem existe nesta máquina');
    assert.equal(plan.materialCourses[0].path, material.to);
    assert.ok(plan.materialsChanges.includes('config.json'), 'prévia lista a config que o remap ajustaria');
    assert.ok(plan.warnings.some((line) => /pasta original não é tocada/.test(line)));
    /* A prévia não escreveu nada. */
    assert.equal(JSON.parse(read(fixture.runtime, 'config.json')).courses[0].path, fixture.materialsDir);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest);
  }
});

test('restauração: origem viva no padrão preserva referências byte a byte', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  try {
    seedWithConfig(fixture);
    await makeSnapshot(fixture, dest);
    const originalReview = read(fixture.runtime, 'review.json');
    write(fixture.runtime, 'review.json', '{"mat-1":["novo"]}');
    write(fixture.runtime, 'config.json', JSON.stringify({courses: [{id: 'mat-1', name: COURSE.name, path: '/outro/lugar'}]}));

    const plan = await backup.prepareRestore({runtime: fixture.runtime, root: dest, snapshotId: backup.list(dest)[0].snapshotId});
    const applied = await backup.applyRestore({runtime: fixture.runtime, planId: plan.planId});
    assert.equal(applied.applied, true);
    assert.deepEqual(applied.materialsRemapped, [], 'sem remap: a pasta original existe');
    assert.equal(read(fixture.runtime, 'review.json'), originalReview);
    assert.equal(JSON.parse(read(fixture.runtime, 'config.json')).courses[0].path, fixture.materialsDir, 'config volta com o caminho original');
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest);
  }
});

test('restauração: remap explícito aponta a matéria para a cópia e preserva a original', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  try {
    seedWithConfig(fixture);
    const snapshot = await makeSnapshot(fixture, dest);
    write(fixture.runtime, 'review.json', '{"mat-1":["mudou"]}');
    const plan = await backup.prepareRestore({runtime: fixture.runtime, root: dest, snapshotId: snapshot.snapshotId});
    assert.ok(plan.materialsChanges.includes('review.json'));
    assert.ok(plan.materialsChanges.includes('pdf-notes.json'));

    const applied = await backup.applyRestore({runtime: fixture.runtime, planId: plan.planId, materials: 'remap'});
    assert.equal(applied.materialsRemapped.length, 1);
    const restoredDir = path.join(fixture.runtime, 'courses', 'Algebra Linear');
    assert.equal(applied.materialsRemapped[0].to, restoredDir);
    assert.equal(applied.materialCourses[0].path, restoredDir);

    /* Config, Caderno, favoritos e notas apontam para a cópia restaurada. */
    const config = JSON.parse(read(fixture.runtime, 'config.json'));
    assert.equal(config.courses[0].path, restoredDir);
    const review = JSON.parse(read(fixture.runtime, 'review.json'));
    assert.equal(review['mat-1'][0].ref.path, path.join(restoredDir, 'aula.pdf'));
    const bookmarks = JSON.parse(read(fixture.runtime, 'bookmarks.json'));
    assert.equal(bookmarks['mat-1'][0].path, path.join(restoredDir, 'aula.pdf'));
    const notes = JSON.parse(read(fixture.runtime, 'pdf-notes.json'));
    assert.equal(notes['mat-1'][0].ref.path, path.join(restoredDir, 'aula.pdf'));

    /* A pasta ORIGINAL da usuária continua intacta. */
    assert.equal(fs.readFileSync(path.join(fixture.materialsDir, 'aula.pdf')).equals(PDF_BYTES), true);
    assert.equal(read(fixture.materialsDir, 'anotacoes.md'), '# anotações\n');
    /* E o restaurado é uma cópia de verdade dentro do runtime. */
    assert.equal(fs.existsSync(path.join(restoredDir, 'aula.pdf')), true);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest);
  }
});

test('restauração: origem ausente remapeia automaticamente (outra máquina)', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  const parked = tempDir('mesa-park');
  try {
    seedWithConfig(fixture);
    const snapshot = await makeSnapshot(fixture, dest);
    /* "Outra máquina": a pasta de material não existe mais neste caminho. */
    fs.renameSync(fixture.materialsDir, path.join(parked, 'materiais'));
    const plan = await backup.prepareRestore({runtime: fixture.runtime, root: dest, snapshotId: snapshot.snapshotId});
    assert.equal(plan.materials[0].stale, true);
    assert.ok(plan.warnings.some((line) => /não existe nesta máquina/.test(line)));
    const applied = await backup.applyRestore({runtime: fixture.runtime, planId: plan.planId});
    assert.equal(applied.materialsRemapped.length, 1, 'auto remapeia a origem ausente');
    const restoredDir = path.join(fixture.runtime, 'courses', 'Algebra Linear');
    assert.equal(JSON.parse(read(fixture.runtime, 'config.json')).courses[0].path, restoredDir);
    assert.equal(JSON.parse(read(fixture.runtime, 'review.json'))['mat-1'][0].ref.path, path.join(restoredDir, 'aula.pdf'));
    assert.equal(fs.existsSync(path.join(restoredDir, 'aula.pdf')), true);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest, parked);
  }
});

test('restauração: remap não volta com rollback (diário devolve o estado anterior)', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  try {
    seedWithConfig(fixture);
    const snapshot = await makeSnapshot(fixture, dest);
    write(fixture.runtime, 'review.json', '{"mat-1":["antes-do-restore"]}');
    const plan = await backup.prepareRestore({runtime: fixture.runtime, root: dest, snapshotId: snapshot.snapshotId});
    await backup.applyRestore({runtime: fixture.runtime, planId: plan.planId, materials: 'remap'});
    assert.equal(JSON.parse(read(fixture.runtime, 'config.json')).courses[0].path, path.join(fixture.runtime, 'courses', 'Algebra Linear'));

    const rolled = backup.rollbackRestore({runtime: fixture.runtime, planId: plan.planId});
    assert.equal(rolled.ok, true);
    assert.equal(JSON.parse(read(fixture.runtime, 'config.json')).courses[0].path, fixture.materialsDir, 'config volta ao caminho original');
    assert.equal(read(fixture.runtime, 'review.json'), '{"mat-1":["antes-do-restore"]}');
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest);
  }
});

test('restauração: versão v1 (manifesto sem metadados) remapeia pela matéria da config', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  const parked = tempDir('mesa-park');
  try {
    seedWithConfig(fixture);
    const snapshot = await makeSnapshot(fixture, dest);
    /* Simula um snapshot v1: remove os metadados de material do manifesto. */
    const manifestFile = backup.manifestPath(snapshot.path);
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    delete manifest.materials;
    fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
    fs.renameSync(fixture.materialsDir, path.join(parked, 'materiais'));

    const plan = await backup.prepareRestore({runtime: fixture.runtime, root: dest, snapshotId: snapshot.snapshotId});
    assert.equal(plan.materials.length, 1);
    assert.equal(plan.materials[0].from, '', 'v1 não conhece a origem');
    assert.equal(plan.materials[0].unknown, true);
    assert.equal(plan.materials[0].stale, false);
    await backup.applyRestore({runtime: fixture.runtime, planId: plan.planId});
    assert.equal(
      JSON.parse(read(fixture.runtime, 'config.json')).courses[0].path,
      path.join(fixture.runtime, 'courses', 'Algebra Linear'),
      'a matéria da config passa a apontar para a cópia restaurada',
    );
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest, parked);
  }
});

test('restauração: alvo que é link simbólico é preservado com aviso', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  const outside = tempDir('mesa-alvo');
  try {
    const snapshot = await makeSnapshot(fixture, dest);
    const reviewPath = path.join(fixture.runtime, 'review.json');
    fs.rmSync(reviewPath);
    const outsideFile = write(outside, 'review.json', '{"fora":true}');
    fs.symlinkSync(outsideFile, reviewPath);

    const plan = await backup.prepareRestore({runtime: fixture.runtime, root: dest, snapshotId: snapshot.snapshotId});
    assert.ok(plan.preserved.some((item) => item.path === 'review.json'), 'link listado como preservado');
    assert.ok(plan.warnings.some((line) => /simbólic/.test(line)));
    assert.ok(!plan.replaced.includes('review.json'), 'link não entra como substituível');

    const applied = await backup.applyRestore({runtime: fixture.runtime, planId: plan.planId});
    assert.equal(applied.applied, true);
    assert.equal(fs.lstatSync(reviewPath).isSymbolicLink(), true, 'link continua link');
    assert.equal(read(outside, 'review.json'), '{"fora":true}', 'alvo do link intacto');
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest, outside);
  }
});

test('restauração: versão antiga com a pasta viva não troca a config no automático', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  try {
    seedWithConfig(fixture);
    const snapshot = await makeSnapshot(fixture, dest);
    const manifestFile = backup.manifestPath(snapshot.path);
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    delete manifest.materials;
    fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);

    const plan = await backup.prepareRestore({runtime: fixture.runtime, root: dest, snapshotId: snapshot.snapshotId});
    assert.equal(plan.materials[0].unknown, true);
    const applied = await backup.applyRestore({runtime: fixture.runtime, planId: plan.planId});
    assert.deepEqual(applied.materialsRemapped, [], 'sem remap: a pasta atual existe');
    assert.equal(JSON.parse(read(fixture.runtime, 'config.json')).courses[0].path, fixture.materialsDir);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest);
  }
});

/* Runtime mínimo sem store nenhum citando a pasta de material: é o cenário em
   que `materialsRemapped` precisa carregar a DECISÃO de remap, não o diff de
   um arquivo do staging, para a config EXTERNA ser apontada para a cópia. */
function seedBareRuntimeConfig({runtimeName = 'mesa-rt-conf'} = {}) {
  const runtime = tempDir(runtimeName);
  const materialsDir = tempDir('mesa-mat-conf');
  const configDir = tempDir('mesa-cfg-conf');
  const configFile = path.join(configDir, 'config.json');
  write(runtime, 'desk.json', JSON.stringify({state: {courseId: COURSE.id}, theme: 'dark'}));
  write(materialsDir, 'aula.txt', 'conteúdo da matéria');
  fs.writeFileSync(configFile, JSON.stringify({courses: [{id: COURSE.id, name: COURSE.name, path: materialsDir}], runtimePath: runtime}));
  return {runtime, materialsDir, configFile, configDir};
}

test('restauração: remap explícito atualiza a config externa mesmo sem strings nos stores', async () => {
  const seed = seedBareRuntimeConfig();
  const dest = tempDir('mesa-dest');
  try {
    const snapshot = await backup.backupNow({
      runtime: seed.runtime,
      root: dest,
      materials: [{...COURSE, path: seed.materialsDir}],
      reason: 'manual',
    });
    /* Nenhum arquivo do plano (desk.json) cita a pasta: o remap explícito
       ainda assim tem de aparecer no resultado. */
    const plan = await backup.prepareRestore({runtime: seed.runtime, root: dest, snapshotId: snapshot.snapshotId});
    const applied = await backup.applyRestore({runtime: seed.runtime, planId: plan.planId, materials: 'remap'});
    assert.equal(applied.materialsRemapped.length, 1, 'decisão de remap expressa mesmo sem strings nos stores');
    const restoredDir = path.join(seed.runtime, 'courses', COURSE.name);
    assert.equal(applied.materialsRemapped[0].to, restoredDir);

    restoreConfiguration({configFile: seed.configFile, runtime: seed.runtime, result: applied, services: {}});
    const saved = JSON.parse(fs.readFileSync(seed.configFile, 'utf8'));
    assert.equal(saved.courses.find((course) => course.id === COURSE.id).path, restoredDir, 'config externa aponta para a cópia restaurada');
    assert.equal(fs.existsSync(path.join(restoredDir, 'aula.txt')), true);
    /* A pasta original continua intacta. */
    assert.equal(read(seed.materialsDir, 'aula.txt'), 'conteúdo da matéria');
  } finally {
    cleanup(seed.runtime, seed.materialsDir, seed.configDir, dest);
  }
});

test('restauração: origem ausente remapeia a config externa pelo default do painel', async () => {
  const seed = seedBareRuntimeConfig();
  const dest = tempDir('mesa-dest');
  const parked = tempDir('mesa-park-conf');
  try {
    const snapshot = await backup.backupNow({
      runtime: seed.runtime,
      root: dest,
      materials: [{...COURSE, path: seed.materialsDir}],
      reason: 'manual',
    });
    /* "Outra máquina": a pasta de material não existe mais neste caminho. */
    fs.renameSync(seed.materialsDir, path.join(parked, 'materiais'));
    const plan = await backup.prepareRestore({runtime: seed.runtime, root: dest, snapshotId: snapshot.snapshotId});
    assert.equal(plan.materials[0].stale, true);
    const applied = await backup.applyRestore({runtime: seed.runtime, planId: plan.planId});
    assert.equal(applied.materialsRemapped.length, 1, 'auto remapeia a origem ausente');

    restoreConfiguration({configFile: seed.configFile, runtime: seed.runtime, result: applied, services: {}});
    const restoredDir = path.join(seed.runtime, 'courses', COURSE.name);
    const saved = JSON.parse(fs.readFileSync(seed.configFile, 'utf8'));
    assert.equal(saved.courses.find((course) => course.id === COURSE.id).path, restoredDir);
    assert.equal(fs.existsSync(path.join(restoredDir, 'aula.txt')), true);
  } finally {
    cleanup(seed.runtime, seed.materialsDir, seed.configDir, dest, parked);
  }
});

test('backup: duas matérias com o mesmo nome ganham partições distintas (nada é sobrescrito)', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  const matA = tempDir('mesa-mat-a');
  const matB = tempDir('mesa-mat-b');
  try {
    write(matA, 'aula.txt', 'A');
    write(matB, 'aula.txt', 'B');
    const snapshot = await backup.backupNow({
      runtime: fixture.runtime,
      root: dest,
      materials: [
        {id: 'c1', name: 'Fisica', path: matA},
        {id: 'c2', name: 'Fisica', path: matB},
      ],
      reason: 'manual',
    });
    const manifest = backup.readManifest(snapshot.path);
    const materialPaths = manifest.entries.filter((entry) => entry.kind === 'material').map((entry) => entry.path);
    assert.equal(new Set(materialPaths).size, materialPaths.length, 'nenhum caminho de material duplicado');
    const groups = manifest.materials.filter((group) => group.name === 'Fisica');
    assert.equal(groups.length, 2, 'as duas matérias ficam registradas');
    assert.equal(groups[0].archiveBase, 'courses/Fisica', 'a primeira mantém o caminho antigo');
    assert.ok(groups[1].archiveBase.startsWith('courses/Fisica-'), 'a segunda ganha sufixo único');
    assert.notEqual(groups[0].archiveBase, groups[1].archiveBase);
    assert.deepEqual(groups.map((group) => group.courseId).sort(), ['c1', 'c2']);
    assert.equal(read(snapshot.path, path.join('data', groups[0].archiveBase, 'aula.txt')), 'A');
    assert.equal(read(snapshot.path, path.join('data', groups[1].archiveBase, 'aula.txt')), 'B');

    /* Restauração: as duas pastas aparecem, cada uma com os bytes da sua matéria. */
    const plan = await backup.prepareRestore({runtime: fixture.runtime, root: dest, snapshotId: snapshot.snapshotId});
    assert.equal(plan.materials.length, 2);
    const applied = await backup.applyRestore({runtime: fixture.runtime, planId: plan.planId, materials: 'keep'});
    assert.deepEqual(applied.materialsRemapped, []);
    assert.equal(read(fixture.runtime, path.join(groups[0].archiveBase, 'aula.txt')), 'A');
    assert.equal(read(fixture.runtime, path.join(groups[1].archiveBase, 'aula.txt')), 'B');
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest, matA, matB);
  }
});

test('restauração: duas matérias homônimas remapeiam para partições próprias na config externa', async () => {
  const runtime = tempDir('mesa-rt-homonimas');
  const matA = tempDir('mesa-mat-homonima-a');
  const matB = tempDir('mesa-mat-homonima-b');
  const configDir = tempDir('mesa-cfg-homonimas');
  const configFile = path.join(configDir, 'config.json');
  const dest = tempDir('mesa-dest');
  try {
    write(runtime, 'desk.json', JSON.stringify({state: {courseId: 'c1'}}));
    write(matA, 'aula.txt', 'A');
    write(matB, 'aula.txt', 'B');
    fs.writeFileSync(configFile, JSON.stringify({courses: [
      {id: 'c1', name: 'Fisica', path: matA},
      {id: 'c2', name: 'Fisica', path: matB},
    ]}));
    const snapshot = await backup.backupNow({
      runtime,
      root: dest,
      materials: [{id: 'c1', name: 'Fisica', path: matA}, {id: 'c2', name: 'Fisica', path: matB}],
      reason: 'manual',
    });
    const plan = await backup.prepareRestore({runtime, root: dest, snapshotId: snapshot.snapshotId});
    assert.equal(plan.materials.length, 2);
    const applied = await backup.applyRestore({runtime, planId: plan.planId, materials: 'remap'});
    assert.equal(applied.materialsRemapped.length, 2, 'as duas matérias decidem remap');
    const byCourse = Object.fromEntries(applied.materialsRemapped.map((group) => [group.courseId, group.to]));
    assert.notEqual(byCourse.c1, byCourse.c2);
    assert.equal(fs.readFileSync(path.join(byCourse.c1, 'aula.txt'), 'utf8'), 'A');
    assert.equal(fs.readFileSync(path.join(byCourse.c2, 'aula.txt'), 'utf8'), 'B');

    restoreConfiguration({configFile, runtime, result: applied, services: {}});
    const saved = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    assert.equal(saved.courses.find((course) => course.id === 'c1').path, byCourse.c1);
    assert.equal(saved.courses.find((course) => course.id === 'c2').path, byCourse.c2);
  } finally {
    cleanup(runtime, matA, matB, configDir, dest);
  }
});

test('backup: matéria com nome de courses/ já existente no runtime não sobrescreve', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  const mat = tempDir('mesa-mat-colisao');
  try {
    write(fixture.runtime, 'courses/Compartilhada/runtime.txt', 'do runtime');
    write(mat, 'aula.txt', 'da matéria');
    const snapshot = await backup.backupNow({
      runtime: fixture.runtime,
      root: dest,
      materials: [{id: 'c9', name: 'Compartilhada', path: mat}],
      reason: 'manual',
    });
    const manifest = backup.readManifest(snapshot.path);
    assert.equal(read(snapshot.path, 'data/courses/Compartilhada/runtime.txt'), 'do runtime');
    const group = manifest.materials.find((item) => item.courseId === 'c9');
    assert.ok(group, 'matéria registrada no manifesto');
    assert.notEqual(group.archiveBase, 'courses/Compartilhada', 'a matéria desvia do caminho já usado pelo runtime');
    assert.ok(group.archiveBase.startsWith('courses/Compartilhada-'));
    assert.equal(read(snapshot.path, path.join('data', group.archiveBase, 'aula.txt')), 'da matéria');
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest, mat);
  }
});
