import {ptMatches} from './pt-text.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {createRequire} from 'node:module';
import {seedRuntime, tempDir, read, cleanup, PDF_BYTES} from './study-backup-fixtures.mjs';

/* Compartilhar matéria: pacote portátil com manifesto, importação que cria
   destino NOVO (id novo, referências remapeadas) e a validação que recusa zip
   perigoso antes de qualquer escrita. Tudo com fixtures sintéticas. */

const require = createRequire(import.meta.url);
const packages = require('../src/study-data/packages.cjs');
const zipkit = require('../src/study-data/zipkit.cjs');
const conversations = require('../src/agents/conversations.cjs');

function buildFixturePackage(overrides = {}) {
  const fixture = seedRuntime();
  const built = packages.buildPackage({
    runtime: fixture.runtime,
    course: {id: 'mat-1', name: 'Algebra Linear'},
    materialsDir: fixture.materialsDir,
    learningDir: path.join(fixture.runtime, 'learning', 'Courses', 'Algebra Linear'),
    include: {review: true, bookmarks: true, resume: true, conversations: true},
    ...overrides,
  });
  return {fixture, built};
}

test('pacote: manifesto lista tudo com hash e a origem da matéria', () => {
  const {fixture, built} = buildFixturePackage();
  try {
    assert.equal(built.manifest.kind, 'mesa-study-package');
    assert.equal(built.manifest.format, packages.PACKAGE_FORMAT);
    assert.equal(built.manifest.course.name, 'Algebra Linear');
    assert.equal(built.manifest.features.conversations, true);
    assert.ok(built.manifest.counts.files >= 6);
    assert.match(built.buffer.subarray(0, 2).toString('latin1'), /PK/);
    const entries = zipkit.readZip(built.buffer);
    const names = entries.map((entry) => entry.name);
    assert.ok(names.includes(packages.MANIFEST_NAME));
    const payloadNames = names.filter((name) => name.startsWith('payload/'));
    assert.equal(payloadNames.length, built.manifest.counts.files);
    for (const item of built.manifest.files) {
      const data = entries.find((entry) => entry.name === item.archivePath);
      assert.ok(data, `payload presente: ${item.archivePath}`);
      const hash = require('node:crypto').createHash('sha256').update(data.data).digest('hex');
      assert.equal(hash, item.sha256, `hash de ${item.archivePath}`);
      assert.equal(data.data.length, item.bytes);
    }
    /* O manifesto do pacote não carrega credencial nem caminho de runtime. */
    const text = JSON.stringify(built.manifest);
    assert.ok(!/auth\.json|token|\.pi\/agent|\.claude\/projects/.test(text), 'sem credencial/caminho sensível');
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome);
  }
});

test('pacote: importar cria destino novo, id novo e remapeia referências', () => {
  const {fixture, built} = buildFixturePackage();
  const root = tempDir('mesa-import');
  try {
    const destination = packages.planDestination({root, name: 'Algebra Linear'});
    assert.equal(destination.renamed, false);
    const preview = packages.previewImport({buffer: built.buffer, destination});
    assert.equal(preview.counts.materials, 4);
    assert.ok(preview.counts.conversations >= 2);
    assert.ok(preview.storeFeatures.includes('review'));
    assert.ok(preview.storeFeatures.includes('annotations'), 'notas de página entram no pacote');
    assert.notEqual(preview.courseId, 'mat-1');
    assert.ok(preview.conversations.every((item) => item.resume === 'pi-jsonl-portable' || item.resume === 'exported-transcript'));
    assert.ok(preview.conversations.filter((item) => item.engine === 'claude').every((item) => item.nativeResume === false));

    const result = packages.importPackage({buffer: built.buffer, destination, courseId: preview.courseId});
    assert.equal(result.imported, true);
    assert.ok(result.destination.startsWith(root));
    assert.equal(fs.existsSync(path.join(result.materialsDir, 'aula.pdf')), true);
    assert.equal(fs.readFileSync(path.join(result.materialsDir, 'aula.pdf')).equals(PDF_BYTES), true);
    assert.equal(fs.readFileSync(path.join(result.materialsDir, 'anotacoes.md'), 'utf8'), '# anotações\n');
    assert.equal(fs.existsSync(path.join(result.learningDir, '_state.md')), true);
    /* A partição que o backup também usa: `Sessions/` e `Sources/` não viram
       material. */
    assert.equal(fs.existsSync(path.join(result.materialsDir, 'Sessions')), false);
    assert.equal(fs.existsSync(path.join(result.materialsDir, 'Sources')), false);

    /* Referências remapeadas para o destino novo (nada aponta para a origem). */
    const review = JSON.parse(fs.readFileSync(path.join(result.storeDir, 'review.json'), 'utf8'));
    assert.equal(review[0].ref.path, path.join(result.materialsDir, 'aula.pdf'));
    const bookmarks = JSON.parse(fs.readFileSync(path.join(result.storeDir, 'bookmarks.json'), 'utf8'));
    assert.equal(bookmarks[0].path, path.join(result.materialsDir, 'aula.pdf'));
    const resume = JSON.parse(fs.readFileSync(path.join(result.storeDir, 'resume.json'), 'utf8'));
    assert.equal(resume.next, 'continuar a lista 3');
    assert.ok(!JSON.stringify(review).includes(fixture.materialsDir), 'sem caminho da origem');
    /* Notas de página também são remapeadas para o material novo. */
    const notes = JSON.parse(fs.readFileSync(path.join(result.storeDir, 'pdf-notes.json'), 'utf8'));
    assert.equal(notes[0].ref.path, path.join(result.materialsDir, 'aula.pdf'));
    assert.ok(!JSON.stringify(notes).includes(fixture.materialsDir));

    /* Conversa Claude entra como transcrição VÁLIDA: id/arquivo/nativeSessionId
       novos (uuid), `nativeEstablished` false e o módulo real aceita o
       descritor — nunca "descritor corrompido", nunca retomada nativa. */
    const claudeFiles = fs.readdirSync(path.join(result.conversationsDir, 'claude'));
    assert.equal(claudeFiles.length, 1);
    const claudeFile = path.join(result.conversationsDir, 'claude', claudeFiles[0]);
    const claude = JSON.parse(fs.readFileSync(claudeFile, 'utf8'));
    assert.equal(claude.nativeEstablished, false);
    assert.match(claude.id, /^[0-9a-f-]{36}$/);
    assert.match(claude.nativeSessionId, /^[0-9a-f-]{36}$/);
    assert.equal(claude.id, claudeFiles[0].replace(/^claude-/, '').replace(/\.json$/, ''));
    assert.equal(claude.courseId, preview.courseId);
    assert.notEqual(claude.id, 'claude-11111111-2222-3333-4444-555555555555');
    assert.equal(claude.importedFrom, '22222222-3333-4444-5555-666666666666');
    assert.equal(claude.delivery, undefined);
    assert.ok(Array.isArray(claude.messages) && claude.messages.length === 1, 'transcrição preservada');
    const accepted = conversations.readClaudeConversation(claudeFile);
    assert.ok(accepted, 'conversations.cjs aceita o descritor importado');
    assert.equal(conversations.conversationEngine(claudeFile), 'claude');
    const importedInfo = result.record.conversations.find((item) => item.engine === 'claude');
    assert.equal(importedInfo.resume, 'exported-transcript');
    assert.equal(importedInfo.nativeResume, false);
    /* JSONL do Pi preserva o arquivo (retomada possível quando o mesmo
       provedor existe do outro lado). */
    const piFiles = fs.readdirSync(path.join(result.conversationsDir, 'pi'));
    assert.equal(piFiles.length, 1);
    assert.ok(read(path.join(result.conversationsDir, 'pi'), piFiles[0]).includes('sessão do Pi'));

    /* Registro da importação fica no destino (sem sobrescrever nada). */
    const record = JSON.parse(fs.readFileSync(path.join(result.destination, '.mesa-import.json'), 'utf8'));
    assert.equal(record.courseId, preview.courseId);
    assert.ok(record.conversations.length >= 1);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, root);
  }
});

test('pacote: nome ocupado ganha sufixo e NÃO sobrescreve matéria existente', () => {
  const {fixture, built} = buildFixturePackage();
  const root = tempDir('mesa-import');
  try {
    const first = packages.planDestination({root, name: 'Algebra Linear'});
    packages.importPackage({buffer: built.buffer, destination: first});
    const second = packages.planDestination({root, name: 'Algebra Linear'});
    assert.equal(second.name, 'Algebra Linear (2)');
    assert.equal(second.renamed, true);
    assert.notEqual(second.dir, first.dir);
    const result = packages.importPackage({buffer: built.buffer, destination: second});
    assert.equal(result.imported, true);
    /* A primeira importação continua intacta (bytes iguais aos da origem). */
    assert.equal(fs.readFileSync(path.join(first.dir, 'materiais', 'aula.pdf')).equals(PDF_BYTES), true);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, root);
  }
});

test('pacote: importar para destino existente é recusado sem tocar o que estava lá', () => {
  const {fixture, built} = buildFixturePackage();
  const root = tempDir('mesa-import');
  try {
    const destination = packages.planDestination({root, name: 'Algebra Linear'});
    packages.importPackage({buffer: built.buffer, destination});
    const before = fs.readFileSync(path.join(destination.dir, 'materiais', 'aula.pdf'));
    assert.throws(() => packages.importPackage({buffer: built.buffer, destination}), ptMatches(/destino já existe/));
    assert.equal(fs.readFileSync(path.join(destination.dir, 'materiais', 'aula.pdf')).equals(before), true);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, root);
  }
});

test('pacote: exportar sem conversas é opt-out de verdade', () => {
  const {fixture, built} = buildFixturePackage({include: {conversations: false, review: true, bookmarks: true, resume: true}});
  try {
    assert.equal(built.manifest.features.conversations, false);
    assert.equal(built.manifest.conversations.length, 0);
    const names = zipkit.readZip(built.buffer).map((entry) => entry.name);
    assert.ok(!names.some((name) => name.startsWith('payload/conversations/')));
    const destination = packages.planDestination({root: tempDir('mesa-import'), name: 'Sem conversas'});
    const preview = packages.previewImport({buffer: built.buffer, destination});
    assert.equal(preview.counts.conversations, 0);
    assert.ok(preview.warnings.some((warning) => /sem conversas/.test(warning)));
    packages.importPackage({buffer: built.buffer, destination});
    assert.equal(fs.existsSync(path.join(destination.dir, 'conversas')), false);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome);
  }
});

test('pacote: gravação exclusiva nunca sobrescreve arquivo existente', () => {
  const root = tempDir('mesa-import');
  try {
    const first = packages.writePackageFile({root, name: 'Algebra Linear', buffer: Buffer.from('primeiro')});
    const second = packages.writePackageFile({root, name: 'Algebra Linear', buffer: Buffer.from('segundo')});
    assert.notEqual(second.file, first.file);
    assert.equal(second.renamed, true);
    assert.equal(fs.readFileSync(first.file, 'utf8'), 'primeiro', 'arquivo existente intacto');
    assert.equal(fs.readFileSync(second.file, 'utf8'), 'segundo');
  } finally {
    cleanup(root);
  }
});

test('pacote: zip com nome repetido é recusado', () => {
  const dup = zipkit.writeZip([{name: 'a.txt', data: Buffer.from('1')}, {name: 'a.txt', data: Buffer.from('2')}]);
  assert.throws(() => zipkit.readZip(dup), ptMatches(/repetida/));
});

test('pacote: manifesto com rota de kind diferente do caminho é recusado', () => {
  const {buffer, fixture} = repack((entries) => {
    const manifest = JSON.parse(entries.find((entry) => entry.name === packages.MANIFEST_NAME).data.toString('utf8'));
    const target = manifest.files.find((item) => item.kind === 'materials');
    target.kind = 'learning';
    entries.find((entry) => entry.name === packages.MANIFEST_NAME).data = Buffer.from(JSON.stringify(manifest));
  });
  try {
    assert.throws(() => packages.openPackage(buffer), ptMatches(/rota inconsistente|tipo de arquivo/));
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome);
  }
});

/* ---------- validação do arquivo ---------- */

function repack(mutate) {
  const {built, fixture} = buildFixturePackage();
  const entries = zipkit.readZip(built.buffer).map((entry) => ({name: entry.name, data: entry.data}));
  mutate(entries);
  return {buffer: zipkit.writeZip(entries, {deflate: true}), fixture};
}

test('pacote: zip com caminho de escape é recusado', () => {
  /* O escritor do domínio nunca gera caminho perigoso — o zip malicioso é
     montado com os MESMOS campos do formato, byte a byte. */
  const escapeZip = rawZip([{name: 'payload/materials/../../escape.txt', data: Buffer.from('ataque')}]);
  assert.throws(() => zipkit.readZip(escapeZip), ptMatches(/caminho suspeito|caminho inválido/));
  assert.throws(() => packages.openPackage(escapeZip), ptMatches(/caminho suspeito|caminho inválido|inválido/));
  const absoluteZip = rawZip([{name: '/etc/passwd', data: Buffer.from('x')}]);
  assert.throws(() => zipkit.readZip(absoluteZip), ptMatches(/caminho suspeito/));
  const driveZip = rawZip([{name: 'C:/Windows/system32', data: Buffer.from('x')}]);
  assert.throws(() => zipkit.readZip(driveZip), ptMatches(/caminho suspeito/));
});

test('pacote: manifesto com caminho fora do payload é recusado', () => {
  const {buffer, fixture} = repack((entries) => {
    const manifest = JSON.parse(entries.find((entry) => entry.name === packages.MANIFEST_NAME).data.toString('utf8'));
    manifest.files.push({archivePath: 'fora/do/payload.txt', kind: 'materials', rel: 'x', sha256: 'a'.repeat(64), bytes: 1});
    entries.find((entry) => entry.name === packages.MANIFEST_NAME).data = Buffer.from(JSON.stringify(manifest));
  });
  try {
    assert.throws(() => packages.openPackage(buffer), ptMatches(/caminho suspeito/));
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome);
  }
});

test('pacote: hash diferente do manifesto é recusado', () => {
  const {buffer, fixture} = repack((entries) => {
    const target = entries.find((entry) => entry.name === 'payload/materials/anotacoes.md');
    target.data = Buffer.from('# anotações adulteradas\n');
  });
  try {
    assert.throws(() => packages.openPackage(buffer), ptMatches(/inconsistente/));
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome);
  }
});

test('pacote: entrada não declarada no manifesto é recusada', () => {
  const {buffer, fixture} = repack((entries) => {
    entries.push({name: 'payload/materials/extra.txt', data: Buffer.from('surpresa')});
  });
  try {
    assert.throws(() => packages.openPackage(buffer), ptMatches(/não declarados/));
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome);
  }
});

test('pacote: entrada symlink é recusada', () => {
  const linkZip = rawZip([{name: 'payload/materials/link.txt', data: Buffer.from('/etc/passwd')}]);
  const eocd = linkZip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const cdOffset = linkZip.readUInt32LE(eocd + 16);
  linkZip.writeUInt32LE((0xa1ff * 0x10000) >>> 0, cdOffset + 38);
  assert.throws(() => zipkit.readZip(linkZip), ptMatches(/link simbólico/i));
  assert.throws(() => packages.openPackage(linkZip), ptMatches(/link simbólico/i));
});

test('pacote: zip bomb e limites são barrados', () => {
  const {buffer, fixture} = repack((entries) => {
    entries.push({name: 'payload/materials/grande.txt', data: Buffer.alloc(2 * 1024 * 1024, 0x61)});
  });
  try {
    assert.throws(() => packages.openPackage(buffer, {limits: {maxEntryBytes: 1024}}), ptMatches(/grande demais/));
    assert.throws(() => packages.openPackage(buffer, {limits: {maxEntries: 2}}), ptMatches(/entradas demais/));
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome);
  }
});

test('pacote: arquivo sem manifesto ou com formato desconhecido é recusado', () => {
  const {buffer, fixture} = repack((entries) => {
    const index = entries.findIndex((entry) => entry.name === packages.MANIFEST_NAME);
    entries[index].data = Buffer.from(JSON.stringify({kind: 'outra-coisa', format: 9}));
  });
  try {
    assert.throws(() => packages.openPackage(buffer), ptMatches(/não é um pacote de matéria/));
    const noManifest = repack((entries) => {
      const index = entries.findIndex((entry) => entry.name === packages.MANIFEST_NAME);
      entries.splice(index, 1);
    }).buffer;
    assert.throws(() => packages.openPackage(noManifest), ptMatches(/sem manifesto/));
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome);
  }
});

test('pacote: config exportada NÃO é aplicada na importação', () => {
  const {buffer, fixture} = repack((entries) => {
    const manifest = JSON.parse(entries.find((entry) => entry.name === packages.MANIFEST_NAME).data.toString('utf8'));
    const data = Buffer.from(JSON.stringify({desk: {title: 'Título do outro'}, courses: [{id: 'x', name: 'Outra', path: '/tmp/qualquer'}]}));
    const archivePath = 'payload/store/config.json';
    entries.push({name: archivePath, data});
    const sha256 = require('node:crypto').createHash('sha256').update(data).digest('hex');
    manifest.files.push({archivePath, kind: 'store', rel: 'config.json', store: 'config', sha256, bytes: data.length});
    entries.find((entry) => entry.name === packages.MANIFEST_NAME).data = Buffer.from(JSON.stringify(manifest));
  });
  const root = tempDir('mesa-import');
  try {
    const destination = packages.planDestination({root, name: 'Com config'});
    const result = packages.importPackage({buffer, destination});
    /* O arquivo entra como dado do destino, mas nada é aplicado à configuração
       da Mesa: o import só escreve dentro do destino novo. */
    assert.equal(fs.existsSync(path.join(result.storeDir, 'config.json')), true);
    assert.equal(fs.existsSync(path.join(root, 'config.json')), false);
    assert.equal(fs.existsSync(path.join(fixture.runtime, 'config.json')), false);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, root);
  }
});

test('pacote: remapValue troca caminho e id em estrutura aninhada', () => {
  const out = packages.remapValue(
    {mat: {path: '/antigo/aula.pdf', nested: [{path: '/antigo/sub/b.pdf', id: 'mat-1'}], id: 'mat-1'}},
    {oldBase: '/antigo', newBase: '/novo', oldId: 'mat-1', newId: 'materia-2'},
  );
  assert.deepEqual(out, {mat: {path: '/novo/aula.pdf', nested: [{path: '/novo/sub/b.pdf', id: 'materia-2'}], id: 'materia-2'}});
});

/* Zip cru montado à mão (nome livre, inclusive perigoso): o leitor tem de
   recusar ANTES de qualquer escrita, e o escritor do domínio nem o produz. */
function rawZip(entries, {crcOverride = null} = {}) {
  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();
  const crcOf = (buffer) => {
    let c = 0xffffffff;
    for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data));
    const body = zlib.deflateRawSync(data);
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const crc = crcOf(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, body);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + body.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  const out = Buffer.concat([...locals, centralBuf, eocd]);
  if (crcOverride !== null) out.writeUInt32LE(crcOverride, 14);
  return out;
}

test('zipkit: leitura própria concorda com um zip feito por fora', () => {
  /* O `zipkit.mjs` dos testes do updater fabrica zips com deflate de verdade;
     o leitor do domínio precisa aceitar. */
  const buf = zipkit.writeZip({a: Buffer.from('hello world'), b: Buffer.alloc(2048, 0x62)}, {deflate: true});
  const back = zipkit.readZip(buf);
  assert.deepEqual(back.map((entry) => entry.name), ['a', 'b']);
  assert.equal(back[0].data.toString('utf8'), 'hello world');
  assert.equal(back[1].data.length, 2048);
  /* CRC corrompido é recusado: o leitor confere, não confia. */
  const corrupted = Buffer.from(buf);
  const eocd = corrupted.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const cdOffset = corrupted.readUInt32LE(eocd + 16);
  const firstLocal = corrupted.readUInt32LE(cdOffset + 42);
  corrupted.writeUInt32LE(0xdeadbeef, firstLocal + 14);
  const centralCrc = cdOffset + 16;
  corrupted.writeUInt32LE(0xdeadbeef, centralCrc);
  assert.throws(() => zipkit.readZip(corrupted), ptMatches(/CRC/));
});
