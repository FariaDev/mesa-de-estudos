// Testes do store da aba Livre (desk/free-workspaces.cjs): ciclo de vida do
// workspace, isolamento por sessão, importação verificada, promoção com
// staging/rollback e as recusas (corrompido, colisão, escape por symlink,
// gravação falha). Tudo sintético, em runtime temporário — nada real é tocado.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const store = require('../free-workspaces.cjs');

const runtimes = [];
after(() => {
  for (const dir of runtimes) {
    try { fs.rmSync(dir, {recursive: true, force: true}); } catch { /* já foi */ }
  }
});

function runtime(tag = 'fw') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `mesa-free-${tag}-`));
  runtimes.push(dir);
  return dir;
}

function pdfBytes(text = 'Limites') {
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
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${startxref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

function writePdf(file, text) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, pdfBytes(text));
  return file;
}

const hashOf = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const workspaceJson = (rt, id) => path.join(store.workspaceDir(rt, id), 'workspace.json');
const materialsOf = (rt, id) => path.join(store.workspaceDir(rt, id), 'materials');

const codeIs = (code) => (error) => {
  assert.equal(error?.code, code, `esperava ${code}, veio ${error?.code || error?.message}`);
  return true;
};

test('workspace nasce com título padrão, atualiza título/rascunho e lista', async () => {
  const rt = runtime('life');
  const created = store.ensureWorkspace(rt, {sessionId: 'sess-a', title: '   '});
  assert.equal(created.title, store.defaultTitle());
  assert.equal(created.materials.length, 0);
  assert.equal(created.draft, '');
  assert.ok(fs.existsSync(materialsOf(rt, 'sess-a')));

  const again = store.ensureWorkspace(rt, {sessionId: 'sess-a', title: 'Outro'});
  assert.equal(again.createdAt, created.createdAt, 'ensure é idempotente');

  const longTitle = 'x'.repeat(300);
  const longDraft = `# Título\n\n${'y'.repeat(store.maxDraftChars())}`;
  const updated = store.updateWorkspace(rt, 'sess-a', {title: `  ${longTitle}  `, draft: longDraft});
  assert.equal(updated.title.length, store.maxTitle());
  assert.equal(updated.draft.length, store.maxDraftChars());
  assert.equal(updated.draft.slice(0, 8), '# Título');

  const blank = store.renameWorkspace(rt, 'sess-a', '   ');
  assert.equal(blank.title, store.defaultTitle());

  store.ensureWorkspace(rt, {sessionId: 'sess-b', title: 'Outra'});
  await new Promise((resolve) => setTimeout(resolve, 10));
  store.updateWorkspace(rt, 'sess-a', {title: 'Primeira'});
  const list = store.listWorkspaces(rt);
  assert.deepEqual(list.map((record) => record.id), ['sess-a', 'sess-b']);

  const payload = store.workspacePayload(store.findWorkspace(rt, 'sess-a'));
  assert.deepEqual(payload, {kind: 'free', id: 'mesa-free', sessionId: 'sess-a', title: 'Primeira', materials: [], promotedCourseId: ''});
  assert.throws(() => store.createWorkspace(rt, {sessionId: 'sess-a'}), codeIs('EXISTS'));
});

test('create recusa workspace existente; IDs perigosos são recusados', () => {
  const rt = runtime('ids');
  store.createWorkspace(rt, {sessionId: 'ok-1'});
  assert.throws(() => store.createWorkspace(rt, {sessionId: 'ok-1'}), codeIs('EXISTS'));
  for (const id of ['../x', 'a/b', '', '.', '..', 'a b', 'x'.repeat(200)]) {
    assert.throws(() => store.ensureWorkspace(rt, {sessionId: id}), codeIs('BAD_ID'), `id recusado: ${JSON.stringify(id)}`);
  }
  assert.equal(store.findWorkspace(rt, '../x'), null);
});

test('workspace livre não pode ser link simbólico para fora (free e sessão)', () => {
  const rt = runtime('symlink');
  const outside = runtime('outside');
  fs.mkdirSync(rt, {recursive: true});
  fs.symlinkSync(outside, path.join(rt, 'free'), 'dir');
  assert.throws(() => store.ensureWorkspace(rt, {sessionId: 's'}), codeIs('BAD_PATH'));

  fs.rmSync(path.join(rt, 'free'), {force: true});
  fs.mkdirSync(path.join(rt, 'free'), {recursive: true});
  fs.symlinkSync(outside, path.join(rt, 'free', 's'), 'dir');
  assert.throws(() => store.ensureWorkspace(rt, {sessionId: 's'}), codeIs('BAD_PATH'));
  assert.equal(fs.readdirSync(outside).length, 0, 'nada foi criado fora do runtime');
});

test('metadata corrompido não é sobrescrito e não derruba a lista', () => {
  const rt = runtime('corrupt');
  store.ensureWorkspace(rt, {sessionId: 'ok'});
  store.ensureWorkspace(rt, {sessionId: 'bad'});
  const file = workspaceJson(rt, 'bad');
  fs.writeFileSync(file, '{quebrado');
  const before = fs.readFileSync(file);
  assert.equal(store.findWorkspace(rt, 'bad'), null);
  assert.throws(() => store.updateWorkspace(rt, 'bad', {title: 'x'}), codeIs('CORRUPT'));
  assert.throws(() => store.ensureWorkspace(rt, {sessionId: 'bad'}), codeIs('CORRUPT'));
  assert.throws(() => store.importPdf(rt, 'bad', {sourcePath: writePdf(path.join(rt, 'x.pdf'))}), codeIs('CORRUPT'));
  assert.ok(fs.readFileSync(file).equals(before), 'bytes do arquivo corrompido intactos');
  assert.deepEqual(store.listWorkspaces(rt).map((record) => record.id), ['ok']);
});

test('gravação falha preserva o arquivo antigo (escrita atômica)', () => {
  const rt = runtime('atomic');
  store.ensureWorkspace(rt, {sessionId: 's', title: 'Antes'});
  store.updateWorkspace(rt, 's', {draft: 'rascunho'});
  const dir = store.workspaceDir(rt, 's');
  const file = workspaceJson(rt, 's');
  const before = fs.readFileSync(file);
  fs.chmodSync(dir, 0o555);
  try {
    assert.throws(() => store.updateWorkspace(rt, 's', {title: 'Depois'}));
  } finally {
    fs.chmodSync(dir, 0o755);
  }
  assert.ok(fs.readFileSync(file).equals(before), 'antigo preservado');
  assert.equal(store.findWorkspace(rt, 's').title, 'Antes');
  assert.equal(fs.readdirSync(dir).filter((name) => name.endsWith('.tmp')).length, 0, 'temporário limpo');
});

test('importar copia bytes verificados, preserva o original e não colide', () => {
  const rt = runtime('import');
  store.ensureWorkspace(rt, {sessionId: 's'});
  const source = writePdf(path.join(rt, 'origem', 'Limites.pdf'), 'Original');
  const sourceHash = hashOf(source);
  const sourceBytes = fs.readFileSync(source);

  const first = store.importPdf(rt, 's', {sourcePath: source});
  const second = store.importPdf(rt, 's', {sourcePath: source});
  assert.equal(first.material.name, 'Limites.pdf');
  assert.equal(second.material.name, 'Limites-2.pdf');
  assert.equal(first.material.kind, 'imported');
  assert.equal(first.material.sha256, sourceHash);
  assert.equal(first.material.bytes, sourceBytes.length);
  assert.equal(path.dirname(first.material.path), materialsOf(rt, 's'));
  assert.ok(fs.readFileSync(first.material.path).equals(sourceBytes));
  assert.equal(hashOf(source), sourceHash, 'original intocado');
  assert.equal(store.findWorkspace(rt, 's').materials.length, 2);

  const payload = store.workspacePayload(store.findWorkspace(rt, 's'));
  assert.deepEqual(payload.materials.map((material) => material.name), ['Limites.pdf', 'Limites-2.pdf']);
  assert.ok(payload.materials.every((material) => material.id && material.path && material.kind === 'imported'));
});

test('importar recusa não-PDF, link simbólico, pasta, vazio e acima do teto', () => {
  const rt = runtime('badpdf');
  store.ensureWorkspace(rt, {sessionId: 's'});
  const notPdf = path.join(rt, 'nota.txt');
  fs.writeFileSync(notPdf, 'não é pdf');
  assert.throws(() => store.importPdf(rt, 's', {sourcePath: notPdf}), codeIs('BAD_PDF'));

  const real = writePdf(path.join(rt, 'real.pdf'));
  const link = path.join(rt, 'link.pdf');
  fs.symlinkSync(real, link);
  assert.throws(() => store.importPdf(rt, 's', {sourcePath: link}), codeIs('BAD_SOURCE'));

  assert.throws(() => store.importPdf(rt, 's', {sourcePath: rt}), codeIs('BAD_SOURCE'));
  assert.throws(() => store.importPdf(rt, 's', {sourcePath: 'relativo.pdf'}), codeIs('BAD_SOURCE'));

  const empty = path.join(rt, 'vazio.pdf');
  fs.writeFileSync(empty, '');
  assert.throws(() => store.importPdf(rt, 's', {sourcePath: empty}), codeIs('BAD_PDF'));

  const huge = path.join(rt, 'grande.pdf');
  fs.writeFileSync(huge, pdfBytes());
  fs.truncateSync(huge, store.MAX_MATERIAL_BYTES + 1);
  assert.throws(() => store.importPdf(rt, 's', {sourcePath: huge}), codeIs('TOO_BIG'));
});

test('material fora da área gerenciada é recusado (register e symlink)', () => {
  const rt = runtime('managed');
  store.ensureWorkspace(rt, {sessionId: 's'});
  const outside = writePdf(path.join(rt, 'fora.pdf'));
  assert.throws(() => store.registerMaterial(rt, 's', outside, 'imported'), codeIs('BAD_PATH'));

  const realMaterials = materialsOf(rt, 's');
  const parked = path.join(rt, 'materiais-de-verdade');
  fs.renameSync(realMaterials, parked);
  fs.symlinkSync(parked, realMaterials, 'dir');
  const inside = writePdf(path.join(parked, 'x.pdf'));
  assert.throws(() => store.registerMaterial(rt, 's', inside, 'imported'), codeIs('BAD_PATH'));
  assert.throws(() => store.importPdf(rt, 's', {sourcePath: inside}), codeIs('BAD_PATH'));
});

test('saveMaterial desfaz o PDF criado quando o metadata falha', async () => {
  const rt = runtime('rollback');
  store.ensureWorkspace(rt, {sessionId: 's'});
  const dir = store.workspaceDir(rt, 's');
  const fake = {
    async savePdf({dir: target, stem}) {
      const file = path.join(target, `${stem}.pdf`);
      fs.writeFileSync(file, pdfBytes('fake'));
      fs.writeFileSync(path.join(dir, 'workspace.json'), '{quebrado');
      return {name: path.basename(file), path: file, bytes: fs.statSync(file).size, sha256: hashOf(file)};
    },
  };
  await assert.rejects(
    store.saveMaterial(rt, 's', {title: 'Falha', markdown: '# x', pdf: fake}),
    codeIs('CORRUPT')
  );
  assert.deepEqual(fs.readdirSync(materialsOf(rt, 's')), [], 'cópia órfã removida');
});

test('saveMaterial recusa conteúdo vazio e sessão promovida', async () => {
  const rt = runtime('empty');
  store.ensureWorkspace(rt, {sessionId: 's'});
  await assert.rejects(store.saveMaterial(rt, 's', {title: 'x', markdown: '   '}), codeIs('EMPTY'));
  await assert.rejects(store.saveMaterial(rt, 's', {title: 'x', markdown: 42}), codeIs('EMPTY'));

  const promoted = runtime('already');
  const parent = path.join(promoted, 'destino');
  fs.mkdirSync(parent);
  store.ensureWorkspace(promoted, {sessionId: 's'});
  store.preparePromotion(promoted, 's', {parentDir: parent, name: 'Nova'});
  store.commitPromotion(promoted, 's', {});
  await assert.rejects(store.saveMaterial(promoted, 's', {title: 'x', markdown: '# x'}), codeIs('ALREADY_PROMOTED'));
  assert.throws(() => store.importPdf(promoted, 's', {sourcePath: writePdf(path.join(promoted, 'y.pdf'))}), codeIs('ALREADY_PROMOTED'));
  assert.throws(() => store.preparePromotion(promoted, 's', {parentDir: parent, name: 'Outra'}), codeIs('ALREADY_PROMOTED'));
});

test('promoção: staging verificado, pasta nova, recibo e rollback', () => {
  const rt = runtime('promote');
  const parent = path.join(rt, 'destino');
  fs.mkdirSync(parent);
  store.ensureWorkspace(rt, {sessionId: 's', title: 'Cálculo'});
  const source = writePdf(path.join(rt, 'origem', 'Limites.pdf'));
  const imported = store.importPdf(rt, 's', {sourcePath: source}).material;

  const plan = store.preparePromotion(rt, 's', {parentDir: parent, name: 'Cálculo'});
  assert.equal(plan.folderName, store.folderSlug('Cálculo'));
  assert.equal(plan.folderPath, path.join(fs.realpathSync(parent), plan.folderName));
  assert.ok(fs.existsSync(plan.stagingPath));
  assert.equal(fs.existsSync(plan.folderPath), false);
  assert.ok(fs.readFileSync(path.join(plan.stagingPath, 'materials', 'Limites.pdf')).equals(fs.readFileSync(imported.path)));
  assert.equal(store.promotionPlan(rt, 's').status, 'prepared');

  const commit = store.commitPromotion(rt, 's', {courseId: 'uuid-livre', courseName: 'Cálculo'});
  assert.equal(commit.folderName, plan.folderName);
  assert.equal(commit.materials.length, 1);
  assert.ok(fs.existsSync(path.join(commit.folderPath, 'materials', 'Limites.pdf')));
  const receipt = store.promotionPlan(rt, 's');
  assert.equal(receipt.status, 'promoted');
  assert.equal(receipt.courseId, 'uuid-livre');
  assert.equal(receipt.materials[0].sha256, imported.sha256);
  assert.ok(fs.existsSync(imported.path), 'origem continua no workspace');

  const rolled = store.rollbackPromotion(rt, 's');
  assert.equal(rolled.rolledBack, true);
  assert.equal(fs.existsSync(commit.folderPath), false, 'pasta nova desfeita');
  assert.equal(store.promotionPlan(rt, 's'), null);
  assert.ok(fs.existsSync(imported.path), 'material de origem intacto');
  assert.equal(hashOf(source), imported.sha256);
});

test('promoção nunca sobrescreve pasta existente (escolhe a próxima)', () => {
  const rt = runtime('collision-name');
  const parent = path.join(rt, 'destino');
  fs.mkdirSync(path.join(parent, 'Limites'), {recursive: true});
  fs.writeFileSync(path.join(parent, 'Limites', 'sentinel.txt'), 'não me toque');
  store.ensureWorkspace(rt, {sessionId: 's'});
  store.importPdf(rt, 's', {sourcePath: writePdf(path.join(rt, 'a.pdf'))});

  const plan = store.preparePromotion(rt, 's', {parentDir: parent, name: 'Limites'});
  assert.equal(plan.folderName, 'Limites-2');
  store.commitPromotion(rt, 's', {});
  assert.equal(fs.readFileSync(path.join(parent, 'Limites', 'sentinel.txt'), 'utf8'), 'não me toque');
  assert.ok(fs.existsSync(path.join(parent, 'Limites-2', 'materials', 'a.pdf')));
  store.rollbackPromotion(rt, 's');
  assert.ok(fs.existsSync(path.join(parent, 'Limites', 'sentinel.txt')));
  assert.equal(fs.existsSync(path.join(parent, 'Limites-2')), false);
});

test('promoção aborta se a pasta aparecer entre preparar e confirmar', () => {
  const rt = runtime('collision-commit');
  const parent = path.join(rt, 'destino');
  fs.mkdirSync(parent);
  store.ensureWorkspace(rt, {sessionId: 's'});
  store.importPdf(rt, 's', {sourcePath: writePdf(path.join(rt, 'a.pdf'))});
  const plan = store.preparePromotion(rt, 's', {parentDir: parent, name: 'Nova'});
  fs.mkdirSync(plan.folderPath);
  fs.writeFileSync(path.join(plan.folderPath, 'sentinel.txt'), 'apareceu depois');
  assert.throws(() => store.commitPromotion(rt, 's', {}), codeIs('COLLISION'));
  assert.equal(fs.readFileSync(path.join(plan.folderPath, 'sentinel.txt'), 'utf8'), 'apareceu depois');
  assert.equal(store.promotionPlan(rt, 's'), null, 'promoção cancelada, nada pendente');
});

test('rollback recusa apagar pasta com conteúdo inesperado', () => {
  const rt = runtime('conflict');
  const parent = path.join(rt, 'destino');
  fs.mkdirSync(parent);
  store.ensureWorkspace(rt, {sessionId: 's'});
  store.importPdf(rt, 's', {sourcePath: writePdf(path.join(rt, 'a.pdf'))});
  store.preparePromotion(rt, 's', {parentDir: parent, name: 'Nova'});
  const commit = store.commitPromotion(rt, 's', {});
  fs.writeFileSync(path.join(commit.folderPath, 'materials', 'extra.txt'), 'alheio');
  assert.throws(() => store.rollbackPromotion(rt, 's'), codeIs('CONFLICT'));
  assert.ok(fs.existsSync(commit.folderPath), 'nada apagado');
  assert.equal(store.promotionPlan(rt, 's').status, 'promoted');
});

test('promoção verifica o sha256 do original e não deixa staging para trás', () => {
  const rt = runtime('tamper');
  const parent = path.join(rt, 'destino');
  fs.mkdirSync(parent);
  store.ensureWorkspace(rt, {sessionId: 's'});
  const imported = store.importPdf(rt, 's', {sourcePath: writePdf(path.join(rt, 'a.pdf'), 'Antes')}).material;
  fs.writeFileSync(imported.path, pdfBytes('Depois'));
  assert.throws(() => store.preparePromotion(rt, 's', {parentDir: parent, name: 'Nova'}), codeIs('VERIFY'));
  assert.equal(store.promotionPlan(rt, 's'), null);
  assert.deepEqual(fs.readdirSync(parent), [], 'staging removido');
});

test('promoção recusa caminho de material fora do workspace (metadata adulterado)', () => {
  const rt = runtime('escape');
  const parent = path.join(rt, 'destino');
  fs.mkdirSync(parent);
  store.ensureWorkspace(rt, {sessionId: 's'});
  const imported = store.importPdf(rt, 's', {sourcePath: writePdf(path.join(rt, 'a.pdf'))}).material;
  const outside = writePdf(path.join(rt, 'fora.pdf'));
  const file = workspaceJson(rt, 's');
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  record.materials[0].path = outside;
  record.materials[0].sha256 = hashOf(outside);
  record.materials[0].bytes = fs.statSync(outside).size;
  fs.writeFileSync(file, JSON.stringify(record));
  assert.throws(() => store.preparePromotion(rt, 's', {parentDir: parent, name: 'Nova'}), codeIs('BAD_PATH'));
  assert.deepEqual(fs.readdirSync(parent), [], 'staging removido');
  assert.ok(fs.existsSync(imported.path));
});

test('promoção recusa confirmar sem preparar e repetir prepare', () => {
  const rt = runtime('state');
  const parent = path.join(rt, 'destino');
  fs.mkdirSync(parent);
  store.ensureWorkspace(rt, {sessionId: 's'});
  assert.throws(() => store.commitPromotion(rt, 's', {}), codeIs('NOT_PREPARED'));
  store.preparePromotion(rt, 's', {parentDir: parent, name: 'Nova'});
  assert.throws(() => store.preparePromotion(rt, 's', {parentDir: parent, name: 'Nova'}), codeIs('PENDING'));
  assert.equal(store.rollbackPromotion(rt, 's').rolledBack, true);
  assert.equal(store.rollbackPromotion(rt, 's').rolledBack, false);
});

test('promoção exige pasta-mãe existente e nome de pasta seguro', () => {
  const rt = runtime('parent');
  store.ensureWorkspace(rt, {sessionId: 's'});
  assert.throws(() => store.preparePromotion(rt, 's', {parentDir: path.join(rt, 'nao-existe'), name: 'x'}), codeIs('BAD_PATH'));
  assert.throws(() => store.preparePromotion(rt, 's', {parentDir: 'relativo', name: 'x'}), codeIs('BAD_PATH'));
  assert.equal(store.folderSlug('CON'), '_CON');
  assert.ok(store.folderSlug('a'.repeat(200)).length <= store.maxSlug());
  assert.equal(store.folderSlug('  ').length > 0, true);
});

test('título e rascunho sobrevivem a abrir/fechar (reload do arquivo)', () => {
  const rt = runtime('reload');
  store.ensureWorkspace(rt, {sessionId: 's'});
  store.updateWorkspace(rt, 's', {title: 'Sessão livre', draft: '$$x^2$$'});
  const reloaded = store.findWorkspace(rt, 's');
  assert.equal(reloaded.title, 'Sessão livre');
  assert.equal(reloaded.draft, '$$x^2$$');
  assert.equal(store.listWorkspaces(rt)[0].draft, '$$x^2$$');
});

/* ---------- contrato host pedido pelo root: índice, escopo, dono e crash ---------- */

test('índice de sessões inclui sessão sem arquivo nativo e persiste o caminho', () => {
  const rt = runtime('native');
  store.ensureWorkspace(rt, {sessionId: 's1', title: 'Primeira'});
  store.ensureWorkspace(rt, {sessionId: 's2', title: 'Segunda'});
  let list = store.listSessions(rt);
  assert.deepEqual(list.map((item) => item.sessionId).sort(), ['s1', 's2']);
  assert.ok(list.every((item) => item.nativePath === ''), 'sessão nova ainda não tem JSONL');
  assert.ok(list.every((item) => item.promotedCourseId === '' && item.rev >= 1));

  const native = path.join(rt, 'pi', 'uuid-livre-123.jsonl');
  store.setNativePath(rt, 's1', native);
  assert.equal(store.findWorkspace(rt, 's1').nativePath, native);
  assert.equal(JSON.parse(fs.readFileSync(workspaceJson(rt, 's1'), 'utf8')).nativePath, native);
  assert.equal(fs.existsSync(native), false, 'setNativePath não cria o arquivo nativo');
  assert.equal(store.listSessions(rt).find((item) => item.sessionId === 's1').nativePath, native);

  assert.throws(() => store.setNativePath(rt, 's2', 'relativo.jsonl'), codeIs('BAD_PATH'));
  assert.throws(() => store.setNativePath(rt, 's2', path.join(rt, 'a\u0000b')), codeIs('BAD_PATH'));
  assert.equal(store.findWorkspace(rt, 's2').nativePath, '');
});

test('captura de escopo detecta sessão mudada/promovida e expectRev protege o update', () => {
  const rt = runtime('scope');
  store.ensureWorkspace(rt, {sessionId: 's', title: 'A'});
  const scope = store.captureScope(rt, 's');
  assert.equal(scope.kind, 'free');
  assert.equal(scope.sessionId, 's');
  assert.equal(scope.courseId, store.freeCourseId());
  assert.equal(store.scopeIsCurrent(rt, scope), true);

  store.updateWorkspace(rt, 's', {draft: 'mudou'});
  assert.equal(store.scopeIsCurrent(rt, scope), false, 'rev mudou desde a captura');
  assert.throws(() => store.assertScope(rt, scope), codeIs('STALE'));

  const fresh = store.captureScope(rt, 's');
  assert.throws(() => store.updateWorkspace(rt, 's', {title: 'B'}, {expectRev: scope.rev}), codeIs('STALE'));
  assert.equal(store.findWorkspace(rt, 's').title, 'A', 'nada foi gravado com escopo velho');
  store.updateWorkspace(rt, 's', {title: 'B'}, {expectRev: fresh.rev});
  assert.equal(store.findWorkspace(rt, 's').title, 'B');

  assert.equal(store.scopeIsCurrent(rt, {sessionId: 'nao-existe'}), false);
  assert.equal(store.scopeIsCurrent(rt, {sessionId: 's'}), true, 'sem rev compara só existência');

  const promoted = runtime('scope-promoted');
  const parent = path.join(promoted, 'destino');
  fs.mkdirSync(parent);
  store.ensureWorkspace(promoted, {sessionId: 'p'});
  const before = store.captureScope(promoted, 'p');
  store.preparePromotion(promoted, 'p', {parentDir: parent, name: 'Nova'});
  store.commitPromotion(promoted, 'p', {courseId: 'uuid-p'});
  assert.equal(store.scopeIsCurrent(promoted, before), false, 'promovida não aceita mutação');
});

test('curso promovido pertence a uma sessão; domínio repetido é recusado', () => {
  const rt = runtime('owned');
  const parent = path.join(rt, 'destino');
  fs.mkdirSync(parent);
  store.ensureWorkspace(rt, {sessionId: 'a'});
  store.ensureWorkspace(rt, {sessionId: 'b'});
  store.importPdf(rt, 'a', {sourcePath: writePdf(path.join(rt, 'a.pdf'))});
  store.importPdf(rt, 'b', {sourcePath: writePdf(path.join(rt, 'b.pdf'))});
  store.preparePromotion(rt, 'a', {parentDir: parent, name: 'Calculo'});
  store.commitPromotion(rt, 'a', {courseId: 'uuid-calculo', courseName: 'Cálculo'});
  assert.deepEqual(store.findByCourseId(rt, 'uuid-calculo'), {sessionId: 'a', promotion: store.promotionPlan(rt, 'a')});
  assert.equal(store.findByCourseId(rt, 'nao-existe'), null);

  store.preparePromotion(rt, 'b', {parentDir: parent, name: 'Outra'});
  assert.throws(() => store.commitPromotion(rt, 'b', {courseId: 'uuid-calculo'}), codeIs('OWNED'));
  assert.equal(store.promotionPlan(rt, 'b').status, 'prepared', 'journal não foi tocado');
  assert.throws(() => store.commitPromotion(rt, 'b', {courseId: 'mesa-free'}), codeIs('BAD_ID'));
  assert.throws(() => store.commitPromotion(rt, 'b', {courseId: 42}), codeIs('BAD_ID'));
  assert.equal(store.promotionPlan(rt, 'b').status, 'prepared', 'id inválido não avança o journal');
  const committed = store.commitPromotion(rt, 'b', {courseId: 'uuid-outra'});
  assert.equal(committed.promotion.courseId, 'uuid-outra');
  assert.equal(store.findByCourseId(rt, 'uuid-calculo').sessionId, 'a');
  assert.equal(store.findByCourseId(rt, 'uuid-outra').sessionId, 'b');
});

test('crash depois do journal e antes do rename é concluído pela recuperação', () => {
  const rt = runtime('crash-intent');
  const parent = path.join(rt, 'destino');
  fs.mkdirSync(parent);
  store.ensureWorkspace(rt, {sessionId: 's'});
  store.importPdf(rt, 's', {sourcePath: writePdf(path.join(rt, 'a.pdf'))});
  const plan = store.preparePromotion(rt, 's', {parentDir: parent, name: 'Nova'});
  const file = workspaceJson(rt, 's');
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  record.promotion = {...record.promotion, status: 'committing', courseId: 'uuid-x', courseName: 'X'};
  fs.writeFileSync(file, JSON.stringify(record));
  assert.equal(fs.existsSync(plan.folderPath), false);
  assert.ok(fs.existsSync(plan.stagingPath));

  const recovered = store.recoverPromotion(rt, 's');
  assert.equal(recovered.state, 'committed');
  assert.ok(fs.existsSync(path.join(plan.folderPath, 'materials', 'a.pdf')));
  assert.equal(store.promotionPlan(rt, 's').status, 'promoted');
  assert.equal(store.promotionPlan(rt, 's').courseId, 'uuid-x');
  assert.equal(fs.existsSync(plan.stagingPath), false);
});

test('crash depois do rename e antes do recibo é concluído pela recuperação', () => {
  const rt = runtime('crash-rename');
  const parent = path.join(rt, 'destino');
  fs.mkdirSync(parent);
  store.ensureWorkspace(rt, {sessionId: 's'});
  store.importPdf(rt, 's', {sourcePath: writePdf(path.join(rt, 'a.pdf'))});
  const plan = store.preparePromotion(rt, 's', {parentDir: parent, name: 'Nova'});
  const file = workspaceJson(rt, 's');
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  record.promotion = {...record.promotion, status: 'committing', courseId: 'uuid-y', courseName: 'Y'};
  fs.writeFileSync(file, JSON.stringify(record));
  fs.renameSync(plan.stagingPath, plan.folderPath);

  const recovered = store.recoverPromotion(rt, 's');
  assert.equal(recovered.state, 'committed');
  assert.equal(store.promotionPlan(rt, 's').status, 'promoted');
  assert.equal(store.promotionPlan(rt, 's').courseId, 'uuid-y');
  assert.ok(fs.existsSync(path.join(plan.folderPath, 'materials', 'a.pdf')));
});

test('recuperação cancela preparação sem staging e não mexe em destino alheio', () => {
  const rt = runtime('crash-other');
  const parent = path.join(rt, 'destino');
  fs.mkdirSync(parent);
  store.ensureWorkspace(rt, {sessionId: 'vazio'});
  store.preparePromotion(rt, 'vazio', {parentDir: parent, name: 'Sumida'});
  const planVazio = store.promotionPlan(rt, 'vazio');
  fs.rmSync(planVazio.stagingPath, {recursive: true});
  assert.equal(store.recoverPromotion(rt, 'vazio').state, 'cancelled');
  assert.equal(store.promotionPlan(rt, 'vazio'), null, 'nada pendente');

  store.ensureWorkspace(rt, {sessionId: 'alheio'});
  store.preparePromotion(rt, 'alheio', {parentDir: parent, name: 'Alheia'});
  const planAlheio = store.promotionPlan(rt, 'alheio');
  fs.mkdirSync(planAlheio.folderPath);
  fs.writeFileSync(path.join(planAlheio.folderPath, 'sentinel.txt'), 'não é nossa');
  assert.equal(store.recoverPromotion(rt, 'alheio').state, 'conflict');
  assert.equal(fs.readFileSync(path.join(planAlheio.folderPath, 'sentinel.txt'), 'utf8'), 'não é nossa');
  assert.equal(store.promotionPlan(rt, 'alheio').status, 'prepared');
});

test('recuperação em lote só devolve o que precisou de ação', () => {
  const rt = runtime('crash-all');
  const parent = path.join(rt, 'destino');
  fs.mkdirSync(parent);
  store.ensureWorkspace(rt, {sessionId: 'ok'});
  store.ensureWorkspace(rt, {sessionId: 'committing'});
  store.preparePromotion(rt, 'committing', {parentDir: parent, name: 'Nova'});
  const file = workspaceJson(rt, 'committing');
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  record.promotion = {...record.promotion, status: 'committing'};
  fs.writeFileSync(file, JSON.stringify(record));
  const healed = store.recoverAllPromotions(rt);
  assert.deepEqual(healed.map((item) => item.sessionId), ['committing']);
  assert.equal(healed[0].state, 'committed');
});

test('rollback de transação em andamento remove staging ou pasta da operação', () => {
  const rt = runtime('rollback-committing');
  const parent = path.join(rt, 'destino');
  fs.mkdirSync(parent);
  store.ensureWorkspace(rt, {sessionId: 's'});
  store.importPdf(rt, 's', {sourcePath: writePdf(path.join(rt, 'a.pdf'))});
  const plan = store.preparePromotion(rt, 's', {parentDir: parent, name: 'Nova'});
  const file = workspaceJson(rt, 's');
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  record.promotion = {...record.promotion, status: 'committing'};
  fs.writeFileSync(file, JSON.stringify(record));
  assert.equal(store.rollbackPromotion(rt, 's').rolledBack, true);
  assert.equal(store.promotionPlan(rt, 's'), null);
  assert.equal(fs.existsSync(plan.stagingPath), false);
  assert.equal(fs.existsSync(plan.folderPath), false);
});
