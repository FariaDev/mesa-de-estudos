import {ptMatches} from './pt-text.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {seedRuntime, read, write, tempDir, cleanup, PDF_BYTES} from './study-backup-fixtures.mjs';

/* Backup local + restauração, com runtime sintético e SEM Electron. O que a
   prova cobre: política de captura (inclui/exclui), manifesto com hash,
   política de PDF explícita, status/listagem, retenção, agendador automático,
   prévia de restauração, restauração byte a byte, rollback, recuperação de
   queda e a garantia de que arquivo local arbitrário não é apagado. */

const require = createRequire(import.meta.url);
const backup = require('../src/study-data/backup.cjs');
const backupServices = require('../src/study-data/backup-services.cjs');

function manifestPaths(manifest) {
  return manifest.entries.map((entry) => entry.path);
}

test('backup: manifesto com hash cobre as áreas da Mesa e recusa as negativas', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  try {
    const result = await backup.backupNow({
      runtime: fixture.runtime,
      root: dest,
      materials: [{id: 'mat-1', name: 'Algebra Linear', path: fixture.materialsDir}],
      reason: 'manual',
    });
    assert.ok(result.entries > 0, 'snapshot com entradas');
    const manifest = backup.readManifest(result.path);
    assert.equal(manifest.format, backup.FORMAT_VERSION);
    assert.equal(manifest.reason, 'manual');
    const paths = manifestPaths(manifest);

    /* Inclui: conversas, lateral, Livre, Caderno, favoritos, retomada, fila
       retida, stats/estado, ggb, xopp, material da matéria e estudo da matéria. */
    for (const expected of [
      'conversations/claude-11111111-2222-3333-4444-555555555555.json',
      'pi-1700000000000.jsonl',
      'sidechats/index.json',
      'sidechats/sc-123.json',
      'free/aaaa/materials/gerado.md',
      'review.json',
      'bookmarks.json',
      'resume.json',
      'pending.json',
      'desk.json',
      'ggb/board.json',
      'estudo.xopp',
      'handoff/handoff-duvida-1234.json',
      'handoff/falha/falha-1.json',
      'learning/TUTOR.md',
      'learning/LEARNER.md',
      'learning/Courses/Algebra Linear/_state.md',
      'learning/Courses/Algebra Linear/TUTOR.md',
      'learning/Courses/Algebra Linear/.pi/skills/tutor.md',
      'learning/Courses/Algebra Linear/Sessions/2026-01-01-120000--abc.md',
      'courses/Algebra Linear/anotacoes.md',
      'courses/Algebra Linear/diagrama.png',
      'courses/Algebra Linear/aula.pdf',
    ]) {
      assert.ok(paths.includes(expected), `manifesto deve conter ${expected}`);
    }

    /* Não inclui: credencial, cache, log, rascunho temporário, workspace
       efêmero, estado do backup e o próprio lock de update. */
    for (const denied of ['auth.json', 'settings.local.json', 'desk.log', 'desk.log.1', '.review-draft-99.json', 'update.lock']) {
      assert.ok(!paths.includes(denied), `manifesto não pode conter ${denied}`);
    }
    assert.ok(!paths.some((item) => item.startsWith('electron/')), 'cache do Chromium fora');
    assert.ok(!paths.some((item) => item.startsWith('claude-workspaces/')), 'workspace efêmero do Claude fora');
    assert.ok(!paths.some((item) => item.startsWith('.backup/')), 'staging do backup fora');

    /* Cada entrada declarada tem hash e bytes coerentes com o disco. */
    for (const entry of manifest.entries) {
      if (entry.stored === false) continue;
      assert.match(entry.sha256, /^[0-9a-f]{64}$/, `hash de ${entry.path}`);
      const abs = path.join(result.path, 'data', ...entry.path.split('/'));
      const real = fs.readFileSync(abs);
      assert.equal(real.length, entry.bytes, `bytes de ${entry.path}`);
      assert.equal(backup.hashBuffer(real), entry.sha256, `sha256 de ${entry.path}`);
    }

    const verify = await backup.verifySnapshot(result.path, {strict: true});
    assert.equal(verify.ok, true);
    assert.equal(verify.checked, manifest.counts.entries);

    /* Status e listagem do destino. */
    const status = backup.readStatus(dest);
    assert.equal(status.lastSnapshotId, result.snapshotId);
    assert.equal(status.lastError, '');
    const versions = backup.list(dest);
    assert.equal(versions.length, 1);
    assert.equal(versions[0].valid, true);
    assert.equal(versions[0].entries, manifest.counts.entries);
  } finally {
    cleanup(fixture.runtime, dest, fixture.materialsDir, fixture.agentHome);
  }
});

test('backup: política de PDFs é explícita e nada some calado', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  try {
    const included = await backup.backupNow({
      runtime: fixture.runtime,
      root: dest,
      materials: [{id: 'mat-1', name: 'Algebra Linear', path: fixture.materialsDir}],
      reason: 'manual',
    });
    const manifestIn = backup.readManifest(included.path);
    const pdf = manifestIn.entries.find((entry) => entry.path.endsWith('aula.pdf'));
    assert.ok(pdf, 'PDF entra por padrão');
    assert.equal(pdf.stored, undefined);
    assert.equal(fs.readFileSync(path.join(included.path, 'data', 'courses', 'Algebra Linear', 'aula.pdf')).equals(PDF_BYTES), true);
    assert.equal(manifestIn.policy.binaries, 'include');

    const destEx = tempDir('mesa-dest');
    try {
      const excluded = await backup.backupNow({
        runtime: fixture.runtime,
        root: destEx,
        materials: [{id: 'mat-1', name: 'Algebra Linear', path: fixture.materialsDir}],
        binaries: 'exclude',
        reason: 'manual',
      });
      const manifestEx = backup.readManifest(excluded.path);
      const pdfEx = manifestEx.entries.find((entry) => entry.path.endsWith('aula.pdf'));
      assert.ok(pdfEx, 'PDF continua inventariado com política de exclusão');
      assert.equal(pdfEx.stored, false);
      assert.equal(pdfEx.reason, 'binário excluído pela política');
      assert.match(pdfEx.sha256, /^[0-9a-f]{64}$/);
      assert.equal(fs.existsSync(path.join(excluded.path, 'data', 'courses', 'Algebra Linear', 'aula.pdf')), false);
      assert.equal(manifestEx.policy.binaries, 'exclude');
      assert.ok(excluded.skippedBinary >= 1, 'contagem de binários pulados');
      const excludedJson = JSON.parse(fs.readFileSync(path.join(excluded.path, 'excluded.json'), 'utf8'));
      assert.ok(excludedJson.excluded.some((item) => item.path.endsWith('aula.pdf') && item.reason === 'binário excluído pela política'));
      /* O .md da matéria continua entrando mesmo sem PDFs. */
      assert.ok(manifestEx.entries.some((entry) => entry.path === 'courses/Algebra Linear/anotacoes.md' && entry.stored !== false));
    } finally {
      cleanup(destEx);
    }
  } finally {
    cleanup(fixture.runtime, dest, fixture.materialsDir, fixture.agentHome);
  }
});

test('backup: link simbólico e arquivo ilegível viram exclusão declarada, não cópia', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  try {
    fs.symlinkSync(path.join(fixture.materialsDir, 'aula.pdf'), path.join(fixture.runtime, 'atalho.pdf'));
    const result = await backup.backupNow({runtime: fixture.runtime, root: dest, reason: 'manual'});
    const manifest = backup.readManifest(result.path);
    assert.ok(!manifestPaths(manifest).includes('atalho.pdf'), 'link não entra no manifesto');
    const excluded = JSON.parse(fs.readFileSync(path.join(result.path, 'excluded.json'), 'utf8'));
    assert.ok(excluded.excluded.some((item) => item.path === 'atalho.pdf' && /link simbólico/.test(item.reason)));
    assert.equal(fs.existsSync(path.join(result.path, 'data', 'atalho.pdf')), false);
  } finally {
    cleanup(fixture.runtime, dest, fixture.materialsDir, fixture.agentHome);
  }
});

test('backup: área externa entra só por allowlist e marca a retomada', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  try {
    const result = await backup.backupNow({
      runtime: fixture.runtime,
      root: dest,
      external: [{path: fixture.nativeSession, ref: 'sessao-nativa.jsonl', resume: 'transcript-only'}],
      reason: 'manual',
    });
    const manifest = backup.readManifest(result.path);
    const entry = manifest.entries.find((item) => item.path.startsWith('external/'));
    assert.ok(entry, 'sessão nativa entra na allowlist');
    assert.equal(entry.path, 'external/sessao-nativa.jsonl');
    assert.equal(entry.externalRef, 'sessao-nativa.jsonl');
    assert.equal(entry.resume, 'transcript-only');
    assert.equal(entry.kind, 'external');
    /* Nada fora da allowlist: cache e auth do agente não entram. */
    const paths = manifestPaths(manifest);
    assert.ok(!paths.some((item) => /auth\.json$|cache\//.test(item)));
    assert.equal(fs.existsSync(path.join(result.path, 'data', 'external', 'sessao-nativa.jsonl')), true);
    /* Referência é portátil: o manifesto não guarda caminho absoluto. */
    assert.ok(!JSON.stringify(manifest.entries).includes(fixture.agentHome), 'sem caminho absoluto no manifesto');
  } finally {
    cleanup(fixture.runtime, dest, fixture.materialsDir, fixture.agentHome);
  }
});

test('backup: agendador automático exige inatividade e respeita o intervalo', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  try {
    const base = Date.now();
    const settings = {auto: true, idleMinutes: 30, intervalHours: 24, keep: 3, binaries: 'include'};
    /* Atividade agora = não é a hora. */
    const busy = backup.shouldAutoBackup({runtime: fixture.runtime, root: dest, settings, now: base, activityAt: base - 60 * 1000});
    assert.equal(busy.due, false);
    assert.match(busy.why, /em uso/);

    /* Parada há mais que o limite e sem backup ainda = roda. */
    const idle = backup.shouldAutoBackup({runtime: fixture.runtime, root: dest, settings, now: base, activityAt: base - 31 * 60 * 1000});
    assert.equal(idle.due, true);

    const first = await backup.runAutoBackup({runtime: fixture.runtime, root: dest, settings, now: base, activityAt: base - 31 * 60 * 1000});
    assert.equal(first.ran, true);
    assert.equal(first.ok, true);
    assert.equal(backup.readStatus(dest).auto.snapshotId, first.result.snapshotId);

    /* Logo depois: nem inativo de novo nem passou o intervalo. */
    const again = backup.shouldAutoBackup({runtime: fixture.runtime, root: dest, settings, now: base + 60 * 1000, activityAt: base - 40 * 60 * 1000});
    assert.equal(again.due, false);
    assert.match(again.why, /período/);

    /* 25h depois e parado: roda de novo. */
    const later = base + 25 * 60 * 60 * 1000;
    const second = await backup.runAutoBackup({runtime: fixture.runtime, root: dest, settings, now: later, activityAt: later - 60 * 60 * 1000});
    assert.equal(second.ran, true);
    assert.equal(second.ok, true);

    /* Automático desligado nunca roda. */
    const off = await backup.runAutoBackup({runtime: fixture.runtime, root: dest, settings: {...settings, auto: false}, now: later + 1000});
    assert.equal(off.ran, false);
    assert.match(off.why, /desligado/);
  } finally {
    cleanup(fixture.runtime, dest, fixture.materialsDir, fixture.agentHome);
  }
});

test('backup: falha do automático fica no status e não derruba o app', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  try {
    const settings = {auto: true, idleMinutes: 5, intervalHours: 1};
    const now = Date.now();
    /* Destino inválido (arquivo no lugar da pasta) força erro do snapshot. */
    const blocked = path.join(dest, 'snapshots');
    fs.writeFileSync(blocked, 'não é pasta');
    const result = await backup.runAutoBackup({runtime: fixture.runtime, root: dest, settings, now, activityAt: now - 10 * 60 * 1000});
    assert.equal(result.ran, true);
    assert.equal(result.ok, false);
    assert.ok(result.error, 'erro registrado');
    assert.equal(backup.readStatus(dest).auto.error, result.error);
  } finally {
    cleanup(fixture.runtime, dest, fixture.materialsDir, fixture.agentHome);
  }
});

test('restauração: prévia antes, bytes idênticos depois e rollback devolve o estado', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  try {
    const snapshot = await backup.backupNow({runtime: fixture.runtime, root: dest, reason: 'manual'});
    const original = read(fixture.runtime, 'review.json');
    const originalPending = read(fixture.runtime, 'pending.json');

    /* Muda o runtime depois do backup. */
    write(fixture.runtime, 'review.json', '{"mat-1":[]}');
    write(fixture.runtime, 'pending.json', '{"items":[]}');
    write(fixture.runtime, 'learning/Courses/Algebra Linear/_state.md', '# mudou\n');

    const plan = await backup.prepareRestore({runtime: fixture.runtime, root: dest, snapshotId: snapshot.snapshotId});
    assert.ok(plan.planId);
    assert.ok(plan.replaced.includes('review.json'));
    assert.ok(plan.created.includes('sidechats/sc-123.json') === false || plan.created.length >= 0);
    assert.equal(plan.bytes > 0, true);
    /* A prévia não escreveu nada: o runtime segue com o conteúdo novo. */
    assert.equal(read(fixture.runtime, 'review.json'), '{"mat-1":[]}');

    const applied = await backup.applyRestore({runtime: fixture.runtime, planId: plan.planId});
    assert.equal(applied.applied, true);
    assert.equal(applied.written, plan.entries);
    /* Byte a byte: hash dos arquivos restaurados bate com o manifesto. */
    const manifest = backup.readManifest(snapshot.path);
    for (const entry of manifest.entries) {
      if (entry.stored === false) continue;
      const inRuntime = path.join(fixture.runtime, ...entry.path.split('/'));
      if (!fs.existsSync(inRuntime)) continue;
      assert.equal(backup.hashBuffer(fs.readFileSync(inRuntime)), entry.sha256, `restaurado ${entry.path}`);
    }
    assert.equal(read(fixture.runtime, 'review.json'), original);
    assert.equal(read(fixture.runtime, 'pending.json'), originalPending);

    /* Rollback: devolve o que foi substituído e remove o que era novo. */
    const rollback = backup.rollbackRestore({runtime: fixture.runtime, planId: plan.planId});
    assert.equal(rollback.ok, true);
    assert.equal(read(fixture.runtime, 'review.json'), '{"mat-1":[]}');
    assert.equal(read(fixture.runtime, 'pending.json'), '{"items":[]}');
  } finally {
    cleanup(fixture.runtime, dest, fixture.materialsDir, fixture.agentHome);
  }
});

test('restauração: arquivo local que não está na versão é preservado, não apagado', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  try {
    const snapshot = await backup.backupNow({runtime: fixture.runtime, root: dest, reason: 'manual'});
    /* Arquivo criado depois do backup e que NÃO faz parte da versão. */
    write(fixture.runtime, 'anotacao-local-do-usuario.txt', 'não me apague');
    write(fixture.runtime, 'free/aaaa/materials/novo-material.md', 'material novo');
    const plan = await backup.prepareRestore({runtime: fixture.runtime, root: dest, snapshotId: snapshot.snapshotId});
    await backup.applyRestore({runtime: fixture.runtime, planId: plan.planId});
    assert.equal(read(fixture.runtime, 'anotacao-local-do-usuario.txt'), 'não me apague');
    assert.equal(read(fixture.runtime, 'free/aaaa/materials/novo-material.md'), 'material novo');
    assert.ok(!plan.created.includes('anotacao-local-do-usuario.txt'));
  } finally {
    cleanup(fixture.runtime, dest, fixture.materialsDir, fixture.agentHome);
  }
});

test('restauração: versão corrompida é recusada na prévia', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  try {
    const snapshot = await backup.backupNow({runtime: fixture.runtime, root: dest, reason: 'manual'});
    fs.writeFileSync(path.join(snapshot.path, 'data', 'review.json'), '{"mat-1":["torto"]}');
    await assert.rejects(
      () => backup.prepareRestore({runtime: fixture.runtime, root: dest, snapshotId: snapshot.snapshotId}),
      /versão inválida|hash diferente/,
    );
    const verify = await backup.verifySnapshot(snapshot.path);
    assert.equal(verify.ok, false);
    assert.ok(verify.mismatched.some((item) => item.path === 'review.json'));
  } finally {
    cleanup(fixture.runtime, dest, fixture.materialsDir, fixture.agentHome);
  }
});

test('restauração: queda no meio é revertida na recuperação', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  try {
    const snapshot = await backup.backupNow({runtime: fixture.runtime, root: dest, reason: 'manual'});
    write(fixture.runtime, 'review.json', '{"mat-1":["depois"]}');
    const plan = await backup.prepareRestore({runtime: fixture.runtime, root: dest, snapshotId: snapshot.snapshotId});
    /* Simula a queda: diário gravado como "em andamento" (sem `finished`) e o
       arquivo já trocado, sem passar pelo apply completo. */
    const journalFile = path.join(fixture.runtime, '.backup', 'journal', `${plan.planId}.json`);
    const preDir = path.join(fixture.runtime, '.backup', 'pre-restore', plan.planId);
    fs.mkdirSync(path.dirname(journalFile), {recursive: true});
    fs.mkdirSync(preDir, {recursive: true});
    fs.writeFileSync(path.join(preDir, 'review.json'), '{"mat-1":["depois"]}');
    fs.writeFileSync(journalFile, JSON.stringify({planId: plan.planId, replaced: [{path: 'review.json'}], created: [], finished: false}));
    fs.writeFileSync(path.join(fixture.runtime, 'review.json'), '{"restaurado":true}');

    const recovered = backup.recoverRestore({runtime: fixture.runtime});
    assert.equal(recovered.length, 1);
    assert.equal(recovered[0].ok, true);
    assert.equal(read(fixture.runtime, 'review.json'), '{"mat-1":["depois"]}');
    assert.equal(fs.existsSync(journalFile), false);
  } finally {
    cleanup(fixture.runtime, dest, fixture.materialsDir, fixture.agentHome);
  }
});

test('backup: retenção mantém as versões novas e remove as antigas', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  try {
    const ids = [];
    for (let i = 0; i < 4; i++) {
      write(fixture.runtime, 'desk.json', JSON.stringify({n: i}));
      const result = await backup.backupNow({runtime: fixture.runtime, root: dest, reason: 'manual', keep: 2});
      ids.push(result.snapshotId);
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    const versions = backup.list(dest);
    assert.equal(versions.length, 2);
    assert.deepEqual(versions.map((item) => item.snapshotId), [ids[3], ids[2]]);
    assert.ok(!fs.existsSync(path.join(dest, 'snapshots', ids[0])));
  } finally {
    cleanup(fixture.runtime, dest, fixture.materialsDir, fixture.agentHome);
  }
});

test('backup: configuração do destino é lida e gravada fora do runtime', () => {
  const root = tempDir('mesa-conf');
  try {
    const saved = backup.writeConfig(root, {destination: '/tmp/alvo', auto: true, idleMinutes: 15, keep: 4, git: true, gitRemote: 'git@host:x.git'});
    assert.equal(saved.destination, '/tmp/alvo');
    const settings = backup.resolveSettings(root, {env: {}, destination: '/tmp/outro'});
    assert.equal(settings.destination, '/tmp/outro', 'argumento explícito vence a config');
    const fromFile = backup.resolveSettings(root, {env: {}});
    assert.equal(fromFile.destination, '/tmp/alvo');
    assert.equal(fromFile.auto, true);
    assert.equal(fromFile.idleMinutes, 15);
    assert.equal(fromFile.keep, 4);
    assert.equal(fromFile.git, true);
  } finally {
    cleanup(root);
  }
});

test('backup: trava de atividade barra snapshot/restauração com a Mesa em uso', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  try {
    /* Runtime recém-escrito: recentMs barra e o motivo explica. */
    await assert.rejects(() => backup.backupNow({runtime: fixture.runtime, root: dest, recentMs: 5000}), ptMatches(/em uso/));
    /* O host que já garantiu a parada passa allowActive. */
    const forced = await backup.backupNow({runtime: fixture.runtime, root: dest, recentMs: 5000, allowActive: true});
    assert.ok(forced.snapshotId);
    /* Restauração também respeita: prévia com atividade recente é recusada. */
    await assert.rejects(() => backup.prepareRestore({runtime: fixture.runtime, root: dest, snapshotId: forced.snapshotId, recentMs: 5000}), ptMatches(/em uso/));
    await assert.rejects(() => backup.applyRestore({runtime: fixture.runtime, planId: 'plan-1-000000', recentMs: 5000}), ptMatches(/em uso/));
  } finally {
    cleanup(fixture.runtime, dest, fixture.materialsDir, fixture.agentHome);
  }
});

test('backup: destino com nome de credencial não é capturado nem dentro de matéria', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  try {
    /* Uma matéria chamada "tokens" não derruba o backup: só o arquivo com nome
       de credencial é recusado. */
    write(fixture.runtime, 'learning/Courses/tokens/aula.md', '# aula\n');
    write(fixture.runtime, 'learning/Courses/tokens/auth.json', '{"não":"entra"}');
    const result = await backup.backupNow({runtime: fixture.runtime, root: dest, reason: 'manual'});
    const manifest = backup.readManifest(result.path);
    const paths = manifestPaths(manifest);
    assert.ok(paths.includes('learning/Courses/tokens/aula.md'), 'matéria "tokens" entra normalmente');
    assert.ok(!paths.includes('learning/Courses/tokens/auth.json'), 'auth.json de dentro da matéria fica fora');
  } finally {
    cleanup(fixture.runtime, dest, fixture.materialsDir, fixture.agentHome);
  }
});

/* ---------- adapter de serviços (o que o main integra) ---------- */

test('serviços: adapter resolve runtime/matérias, roda backup e guarda caminhos', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  const deskDir = path.resolve(import.meta.dirname, '..');
  const appRoot = path.resolve(deskDir, '..');
  const settingsFile = path.join(tempDir('mesa-conf'), 'mesa-backup.json');
  const courses = [{id: 'mat-1', name: 'Algebra Linear', path: fixture.materialsDir}];
  const services = backupServices.createBackupServices({
    runtime: () => fixture.runtime,
    deskDir,
    repoRoot: appRoot,
    settingsFile,
    backupRoot: () => dest,
    gitRoot: () => '',
    courses: () => courses,
    log: () => {},
  });
  try {
    /* Sem destino configurado, o run recusa em vez de escrever em qualquer lugar. */
    const empty = backupServices.createBackupServices({runtime: () => fixture.runtime, settingsFile: path.join(tempDir('mesa-conf2'), 'mesa-backup.json'), backupRoot: () => ''});
    await assert.rejects(() => empty.run(), ptMatches(/Escolha a pasta de backup/));

    /* Destino dentro do app é recusado (a proteção do módulo, via adapter). */
    assert.throws(() => services.guardDestination(path.join(appRoot, 'backup-x')), ptMatches(/fora do repositório do aplicativo/));
    assert.throws(() => services.guardDestination(path.join(fixture.runtime, 'x')), ptMatches(/próprio runtime/));

    services.configure({destination: dest, auto: false, keep: 3, git: false});
    const statusBefore = await services.status();
    assert.equal(statusBefore.destination, dest);
    assert.equal(statusBefore.settings.keep, 3);

    const result = await services.run({reason: 'manual'});
    assert.ok(result.snapshotId);
    assert.equal(result.git, null, 'sem git configurado não tenta commit');

    const status = await services.status();
    assert.equal(status.available, true);
    assert.equal(status.last.id, result.snapshotId);
    assert.equal(status.versions.length, 1);
    assert.equal(services.listVersions().length, 1);

    /* Verificação e ciclo de restauração pelo adapter. */
    const verified = await services.verify(result.snapshotId);
    assert.equal(verified.ok, true);
    write(fixture.runtime, 'review.json', '{"mat-1":["novo"]}');
    const plan = await services.previewRestore(result.snapshotId);
    const applied = await services.applyRestore(plan.planId);
    assert.equal(applied.applied, true);
    assert.equal(read(fixture.runtime, 'review.json').includes('Derive x²'), true);
    const rolled = services.rollbackRestore(plan.planId);
    assert.equal(rolled.ok, true);
    assert.equal(read(fixture.runtime, 'review.json'), '{"mat-1":["novo"]}');
    services.cancelRestore('plan-0-000000');
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest, path.dirname(settingsFile));
  }
});

test('serviços: exportar/importar matéria pelo adapter cria destino novo', () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  const importRoot = tempDir('mesa-import');
  const settingsFile = path.join(tempDir('mesa-conf'), 'mesa-backup.json');
  const courses = [{id: 'mat-1', name: 'Algebra Linear', path: fixture.materialsDir}];
  const services = backupServices.createBackupServices({
    runtime: () => fixture.runtime,
    deskDir: path.resolve(import.meta.dirname, '..'),
    settingsFile,
    backupRoot: () => dest,
    courses: () => courses,
    log: () => {},
  });
  try {
    const out = services.exportCourse({directory: dest, conversations: true});
    assert.equal(fs.existsSync(out.file), true);
    assert.equal(out.features.conversations, true);
    assert.ok(out.counts.files >= 6);

    const preview = services.previewImport({file: out.file, directory: importRoot});
    assert.ok(preview.courseId.startsWith('materia-'));
    const imported = services.importCourse({file: out.file, directory: importRoot});
    assert.equal(imported.course.path, imported.materialsDir);
    assert.equal(fs.existsSync(path.join(imported.materialsDir, 'aula.pdf')), true);
    /* A matéria registrada aponta para a pasta de materiais do destino novo. */
    assert.ok(imported.course.path.startsWith(importRoot));
    /* Importar de novo não sobrescreve: nome novo com sufixo. */
    const again = services.importCourse({file: out.file, directory: importRoot});
    assert.notEqual(again.destination, imported.destination);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest, importRoot, path.dirname(settingsFile));
  }
});

test('serviços: exportar exige pasta e matéria', () => {
  const fixture = seedRuntime();
  try {
    const services = backupServices.createBackupServices({runtime: () => fixture.runtime, courses: () => [], backupRoot: () => tempDir('mesa-dest')});
    assert.throws(() => services.exportCourse({}), ptMatches(/Escolha onde salvar/));
    assert.throws(() => services.exportCourse({directory: tempDir('mesa-x')}), /Nenhuma matéria/);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome);
  }
});

test('serviços: falha do git não derruba o backup local', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  const gitRoot = tempDir('mesa-git-root');
  const settingsFile = path.join(tempDir('mesa-conf'), 'mesa-backup.json');
  const services = backupServices.createBackupServices({
    runtime: () => fixture.runtime,
    settingsFile,
    backupRoot: () => dest,
    gitRoot: () => gitRoot,
    courses: () => [],
    gitRunner: () => {
      throw Error('sem rede');
    },
    log: () => {},
  });
  try {
    services.configure({destination: dest, git: true, gitRoot});
    const result = await services.run({reason: 'manual'});
    assert.ok(result.snapshotId, 'backup local gravado');
    assert.ok(result.git.error, 'erro do git visível');
    assert.equal(backup.readStatus(dest).gitError, 'sem rede');
    assert.equal(backup.list(dest).length, 1);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest, gitRoot, path.dirname(settingsFile));
  }
});

/* ---------- relocação, escopo de caminho e nomes comuns do usuário ---------- */

test('restauração: versão de outro caminho reescreve só caminhos do runtime', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  const runtimeB = tempDir('mesa-rt-b');
  try {
    const snapshot = await backup.backupNow({runtime: fixture.runtime, root: dest, reason: 'manual'});
    const plan = await backup.prepareRestore({runtime: runtimeB, root: dest, snapshotId: snapshot.snapshotId});
    assert.ok(plan.relocation.files.includes('desk.json'), 'desk.json ajustado');
    assert.ok(plan.relocation.files.includes('free/aaaa/workspace.json'), 'workspace Livre ajustado');
    assert.ok(plan.relocation.files.includes('config.json') === false, 'config.json só se existir');
    assert.ok(plan.warnings.some((line) => /runtime antigo/.test(line)));
    await backup.applyRestore({runtime: runtimeB, planId: plan.planId});

    const desk = JSON.parse(read(runtimeB, 'desk.json'));
    const session = desk.state.courseStates['mat-1'].sessions[0].path;
    assert.equal(session, path.join(runtimeB, 'pi-1700000000000.jsonl'));
    assert.ok(desk.state.courseStates['mat-1'].sessionLayouts[session], 'sessionLayouts continua ligado à sessão');
    assert.equal(desk.state.courseStates['mat-1'].sessionStudies[session].xopp, path.join(runtimeB, 'estudo.xopp'));
    assert.equal(desk.state.courseId, 'mat-1', 'id da matéria não é reescrito');
    assert.ok(!JSON.stringify(desk).includes(fixture.runtime), 'sem referência ao runtime antigo');

    const workspace = JSON.parse(read(runtimeB, 'free/aaaa/workspace.json'));
    assert.equal(workspace.nativePath, path.join(runtimeB, 'free', 'aaaa', 'pi-livre.jsonl'));
    assert.equal(workspace.materials[0].path, path.join(runtimeB, 'free', 'aaaa', 'materials', 'gerado.md'));

    /* chat-library/pdf-drafts: identidade = matéria + caminho RELATIVO; a
       chave antiga continua casando depois da relocação. */
    const chat = JSON.parse(read(runtimeB, 'chat-library.json'));
    assert.equal(chat.items[JSON.stringify(['mat-1', path.relative(runtimeB, session)])].title, 'Conversa da matéria');
    const drafts = JSON.parse(read(runtimeB, 'pdf-drafts.json'));
    assert.equal(drafts[JSON.stringify(['mat-1', path.relative(runtimeB, session)])].markdown, '# rascunho do usuário');

    /* A origem fica intacta. */
    const original = JSON.parse(read(fixture.runtime, 'desk.json'));
    assert.equal(original.state.courseStates['mat-1'].sessions[0].path, path.join(fixture.runtime, 'pi-1700000000000.jsonl'));
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest, runtimeB);
  }
});

test('restauração: plano forjado não remove nada fora da pasta do backup', () => {
  const fixture = seedRuntime();
  try {
    write(fixture.runtime, 'vitima/arquivo.txt', 'não apague');
    assert.throws(() => backup.cancelRestore({runtime: fixture.runtime, planId: '../../vitima'}), /prévia inválida/);
    assert.throws(() => backup.readPlan(fixture.runtime, '../../vitima'), /prévia inválida/);
    assert.equal(backup.rollbackRestore({runtime: fixture.runtime, planId: '../../vitima'}).ok, false);
    assert.equal(read(fixture.runtime, 'vitima/arquivo.txt'), 'não apague');
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome);
  }
});

test('backup: pasta do usuário com nome comum entra; credencial e cache não', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  try {
    const result = await backup.backupNow({runtime: fixture.runtime, root: dest, materials: [{id: 'mat-1', name: 'Algebra Linear', path: fixture.materialsDir}], reason: 'manual'});
    const paths = manifestPaths(backup.readManifest(result.path));
    for (const expected of ['backups/meu-backup.md', 'downloads/apostila.md', 'history.jsonl', 'tmp-relatorio.md', '.backup-do-usuario/anotacao.md', 'courses/Algebra Linear/downloads/lista-extra.pdf', 'pdf-drafts.json', 'chat-library.json', 'pdf-notes.json']) {
      assert.ok(paths.includes(expected), `deve entrar: ${expected}`);
    }
    for (const denied of ['auth.json', 'settings.local.json', 'desk.log', 'update.lock', 'electron/Cache/data_0']) {
      assert.ok(!paths.includes(denied), `não pode entrar: ${denied}`);
    }
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest);
  }
});

test('serviços: external vem do callback do host, sem varredura de home', async () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  const settingsFile = path.join(fixture.runtime, 'mesa-backup.json');
  const courses = [{id: 'mat-1', name: 'Algebra Linear', path: fixture.materialsDir}];
  const services = backupServices.createBackupServices({
    runtime: () => fixture.runtime,
    deskDir: path.resolve(import.meta.dirname, '..'),
    settingsFile,
    backupRoot: () => dest,
    courses: () => courses,
    external: () => [
      {path: fixture.nativeSession, ref: 'sessao-nativa.jsonl', resume: 'transcript-only'},
      {path: fixture.nativeSession, ref: 'repetida.jsonl'},
      {path: fixture.nativeCache, ref: 'cache-externo.json'},
    ],
    log: () => {},
  });
  try {
    services.configure({destination: dest});
    /* Config é ARQUIVO de verdade no caminho do host (não pasta homônima). */
    assert.equal(fs.statSync(services.settingsPath()).isFile(), true);
    assert.equal(backup.readConfig(fixture.runtime).destination, dest, 'host lê a mesma config');
    const result = await services.run({reason: 'manual'});
    const manifest = backup.readManifest(result.path);
    const externalPaths = manifest.entries.filter((entry) => entry.kind === 'external').map((entry) => entry.path);
    assert.deepEqual(externalPaths.sort(), ['external/cache-externo.json', 'external/sessao-nativa.jsonl'], 'só a allowlist explícita; repetida não duplica');
    assert.equal(manifest.entries.find((entry) => entry.path === 'external/sessao-nativa.jsonl').resume, 'transcript-only');
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest);
  }
});

test('serviços: guardas recusam symlink e os dois sentidos da contenção', () => {
  const fixture = seedRuntime();
  const gitParent = tempDir('mesa-git-parent');
  const dest = path.join(gitParent, 'versoes');
  const links = tempDir('mesa-links');
  const appRoot = path.resolve(import.meta.dirname, '..', '..');
  const deskDir = path.resolve(import.meta.dirname, '..');
  const courses = [{id: 'mat-1', name: 'Algebra Linear', path: fixture.materialsDir}];
  const services = backupServices.createBackupServices({
    runtime: () => fixture.runtime,
    deskDir,
    repoRoot: appRoot,
    settingsFile: path.join(tempDir('mesa-conf'), 'mesa-backup.json'),
    backupRoot: () => dest,
    courses: () => courses,
    log: () => {},
  });
  try {
    const runtimeLink = path.join(links, 'runtime');
    fs.symlinkSync(fixture.runtime, runtimeLink);
    assert.throws(() => services.guardDestination(runtimeLink), ptMatches(/próprio runtime/));
    assert.throws(() => services.guardDestination(path.dirname(fixture.runtime)), ptMatches(/próprio runtime/));
    const appLink = path.join(links, 'app');
    fs.symlinkSync(appRoot, appLink);
    assert.throws(() => services.guardGitRoot(appLink), ptMatches(/aplicativo/));
    assert.throws(() => services.guardGitRoot(fixture.runtime), ptMatches(/runtime/));
    services.configure({destination: dest});
    /* Versões dentro do Git valem como FILHA DIRETA (o git a ignora). */
    assert.equal(services.guardGitRoot(gitParent), gitParent);
    assert.throws(() => services.guardGitRoot(dest), ptMatches(/mesma pasta das versões/));
    assert.throws(() => services.guardGitRoot(path.join(dest, 'mesagit')), ptMatches(/dentro da pasta das versões/));

    /* Mais fundo que filha direta o commit apagaria as versões. */
    const nested = backupServices.createBackupServices({runtime: () => fixture.runtime, backupRoot: () => path.join(gitParent, 'a', 'versoes')});
    assert.throws(() => nested.guardGitRoot(gitParent), ptMatches(/filha direta/));

    const gitRoot = tempDir('mesa-git-root');
    const allowed = backupServices.createBackupServices({runtime: () => fixture.runtime, backupRoot: () => path.join(gitRoot, 'snapshots')});
    assert.equal(allowed.guardGitRoot(gitRoot), gitRoot);
    cleanup(gitRoot);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, gitParent, links);
  }
});

test('serviços: pasta de estudo é por id real e material não duplica o runtime', () => {
  const fixture = seedRuntime();
  const links = tempDir('mesa-links');
  try {
    assert.equal(backupServices.studyDirOf(fixture.runtime, {id: 'mat-1', name: 'Algebra Linear'}), path.join(fixture.runtime, 'learning', 'Courses', 'mat-1'));
    assert.equal(backupServices.studyDirOf(fixture.runtime, {id: '../x', name: 'fuga'}), '');
    assert.equal(backupServices.studyDirOf(fixture.runtime, {id: 'nao-existe'}), '');
    const runtimeLink = path.join(links, 'runtime');
    fs.symlinkSync(fixture.runtime, runtimeLink);
    assert.deepEqual(backupServices.materialsOf([{id: 'x', name: 'X', path: runtimeLink}], fixture.runtime), []);
    assert.deepEqual(backupServices.materialsOf([{id: 'x', name: 'X', path: path.join(fixture.materialsDir, 'aula.pdf')}], fixture.runtime), []);
    const mats = backupServices.materialsOf([{id: 'mat-1', name: 'Algebra Linear', path: fixture.materialsDir}], fixture.runtime);
    assert.deepEqual(mats, [{id: 'mat-1', name: 'Algebra Linear', path: fs.realpathSync(fixture.materialsDir)}]);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, links);
  }
});

test('serviços: exportar com id desconhecido é erro e arquivo existente não é sobrescrito', () => {
  const fixture = seedRuntime();
  const dest = tempDir('mesa-dest');
  const courses = [{id: 'mat-1', name: 'Algebra Linear', path: fixture.materialsDir}];
  const services = backupServices.createBackupServices({runtime: () => fixture.runtime, courses: () => courses, backupRoot: () => dest, log: () => {}});
  try {
    const first = services.exportCourse({directory: dest});
    assert.equal(fs.existsSync(first.file), true);
    const second = services.exportCourse({directory: dest, courseId: 'mat-1'});
    assert.notEqual(second.file, first.file, 'gravação exclusiva ganha sufixo');
    assert.equal(second.renamed, true);
    assert.equal(fs.readFileSync(first.file).length > 0, true);
    assert.throws(() => services.exportCourse({directory: dest, courseId: 'nao-existe'}), /Matéria não encontrada/);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, dest);
  }
});

test('backup: destino dentro/ao redor do runtime é recusado antes de criar pasta', async () => {
  const fixture = seedRuntime();
  const links = tempDir('mesa-links-guard');
  try {
    /* Dentro do runtime (caminho novo): recusa e não cria a pasta. */
    const nested = path.join(fixture.runtime, 'backup');
    await assert.rejects(() => backup.backupNow({runtime: fixture.runtime, root: nested, reason: 'manual'}), ptMatches(/destino do backup/));
    assert.equal(fs.existsSync(nested), false, 'pasta recusada não é criada');
    await assert.rejects(() => backup.snapshot({runtime: fixture.runtime, root: path.join(fixture.runtime, 'backup-2')}), ptMatches(/destino do backup/));
    assert.equal(fs.existsSync(path.join(fixture.runtime, 'backup-2')), false);

    /* Destino que CONTÉM o runtime também é recusado. */
    await assert.rejects(() => backup.backupNow({runtime: fixture.runtime, root: path.dirname(fixture.runtime), reason: 'manual'}), ptMatches(/destino do backup/));

    // Até a raiz do volume contém o runtime. Trava de escrita impede que uma
    // regressão no guard faça este teste criar arquivos fora da fixture.
    const mkdir = fs.mkdirSync;
    try {
      fs.mkdirSync = () => { throw new Error('tentativa de gravar antes da guarda'); };
      await assert.rejects(() => backup.backupNow({runtime: fixture.runtime, root: path.parse(fixture.runtime).root}), ptMatches(/destino do backup/));
    } finally { fs.mkdirSync = mkdir; }

    /* Symlink: destino novo atrás de link para o runtime. */
    const link = path.join(links, 'runtime');
    fs.symlinkSync(fixture.runtime, link);
    await assert.rejects(() => backup.backupNow({runtime: fixture.runtime, root: path.join(link, 'guardado'), reason: 'manual'}), ptMatches(/destino do backup/));
    assert.equal(fs.existsSync(path.join(fixture.runtime, 'guardado')), false);

    /* Runtime passado por link e destino real dentro dele. */
    await assert.rejects(() => backup.backupNow({runtime: link, root: path.join(fixture.runtime, 'guardado-2'), reason: 'manual'}), ptMatches(/destino do backup/));
    assert.equal(fs.existsSync(path.join(fixture.runtime, 'guardado-2')), false);

    /* Destino legítimo continua funcionando. */
    const ok = tempDir('mesa-dest-ok');
    try {
      const result = await backup.backupNow({runtime: fixture.runtime, root: ok, reason: 'manual'});
      assert.ok(result.snapshotId);
    } finally {
      cleanup(ok);
    }
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, links);
  }
});
