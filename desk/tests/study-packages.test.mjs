import {ptMatches} from './pt-text.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {createRequire} from 'node:module';
import {seedRuntime, tempDir, cleanup, write, PDF_BYTES} from './study-backup-fixtures.mjs';

/* Compartilhar matéria: pacote portátil com manifesto, importação que cria
   destino NOVO (id novo, referências remapeadas) e a validação que recusa zip
   perigoso antes de qualquer escrita. Tudo com fixtures sintéticas. */

const require = createRequire(import.meta.url);
const packages = require('../src/study-data/packages.cjs');
const zipkit = require('../src/study-data/zipkit.cjs');
const conversations = require('../src/agents/conversations.cjs');
const packageImport = require('../src/study-data/package-import.cjs');

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
    /* #79: o manifesto já diz que nenhuma conversa retoma o provedor do autor;
       a sessão do Pi vira transcrição e não carrega o JSONL vivo. */
    for (const item of built.manifest.conversations) {
      assert.equal(item.resume, 'exported-transcript');
      assert.equal(item.nativeResume, false);
    }
    const piConversation = built.manifest.conversations.find((item) => item.engine === 'pi');
    assert.ok(piConversation, 'a sessão do Pi entra no manifesto');
    assert.equal(piConversation.nativeResume, false, 'o JSONL do Pi não é retomável no destino');
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
    /* #79: nenhuma conversa do pacote retoma o provedor do autor. A do Pi,
       que antes era `pi-jsonl-portable`, também aparece como transcrição. */
    assert.ok(preview.conversations.every((item) => item.resume === 'exported-transcript'));
    assert.ok(preview.conversations.every((item) => item.nativeResume === false));

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
       descritor — nunca "descritor corrompido", nunca retomada nativa.
       #79: a sessão do Pi também cai nesta pasta, como transcrição Claude. As
       duas são achadas pelo conteúdo da primeira mensagem, não pela ordem do
       diretório. */
    const claudeFiles = fs.readdirSync(path.join(result.conversationsDir, 'claude'));
    assert.equal(claudeFiles.length, 2, 'a Claude e a sessão do Pi viram transcrição');
    const transcripts = claudeFiles.map((name) => {
      const file = path.join(result.conversationsDir, 'claude', name);
      return {name, file, descriptor: JSON.parse(fs.readFileSync(file, 'utf8'))};
    });
    /* O normalizador do descritor guarda `content` em blocos `[{type, text}]`. */
    const textOf = (message) => (typeof message.content === 'string' ? message.content : message.content.map((part) => part.text).join('\n'));
    const firstText = ({descriptor}) => (descriptor.messages?.[0] ? textOf(descriptor.messages[0]) : undefined);
    const claudeOrigin = transcripts.find((item) => firstText(item) === 'oi');
    const piOrigin = transcripts.find((item) => firstText(item) === 'sessão do Pi');
    assert.ok(claudeOrigin && piOrigin, 'as duas transcrições estão no destino');

    const claude = claudeOrigin.descriptor;
    assert.equal(claude.nativeEstablished, false);
    assert.match(claude.id, /^[0-9a-f-]{36}$/);
    assert.match(claude.nativeSessionId, /^[0-9a-f-]{36}$/);
    assert.equal(claude.id, claudeOrigin.name.replace(/^claude-/, '').replace(/\.json$/, ''));
    assert.equal(claude.courseId, preview.courseId);
    assert.notEqual(claude.id, 'claude-11111111-2222-3333-4444-555555555555');
    assert.equal(claude.importedFrom, '22222222-3333-4444-5555-666666666666');
    assert.equal(claude.delivery, undefined);
    assert.ok(Array.isArray(claude.messages) && claude.messages.length === 1, 'transcrição preservada');
    assert.ok(conversations.readClaudeConversation(claudeOrigin.file), 'conversations.cjs aceita o descritor importado');
    assert.equal(conversations.conversationEngine(claudeOrigin.file), 'claude');
    const importedInfo = result.record.conversations.find((item) => item.origin !== 'pi');
    assert.equal(importedInfo.resume, 'exported-transcript');
    assert.equal(importedInfo.nativeResume, false);

    /* #79: a sessão JSONL do Pi NÃO é mais um arquivo de sessão viva (o
       `--session` recarregaria o histórico do autor como contexto nativo).
       O que sobra é a transcrição, com o histórico de texto do JSONL. */
    assert.equal(fs.existsSync(path.join(result.conversationsDir, 'pi')), false, 'nenhum JSONL do Pi entra como arquivo de sessão');
    const pi = piOrigin.descriptor;
    assert.equal(pi.nativeEstablished, false, 'sem retomada nativa');
    assert.match(pi.id, /^[0-9a-f-]{36}$/);
    assert.equal(pi.courseId, preview.courseId);
    assert.equal(pi.started, 1700000000000, 'início vem do nome pi-<digits>.jsonl');
    assert.equal(pi.preview, 'sessão do Pi');
    assert.deepEqual(pi.messages.map((message) => ({role: message.role, content: textOf(message)})), [{role: 'user', content: 'sessão do Pi'}]);
    assert.ok(conversations.readClaudeConversation(piOrigin.file), 'conversations.cjs aceita a transcrição do Pi');
    const piInfo = result.record.conversations.find((item) => item.origin === 'pi');
    assert.equal(piInfo.engine, 'claude');
    assert.equal(piInfo.resume, 'exported-transcript');
    assert.equal(piInfo.nativeResume, false);

    /* Registro da importação fica no destino (sem sobrescrever nada). */
    const record = JSON.parse(fs.readFileSync(path.join(result.destination, '.mesa-import.json'), 'utf8'));
    assert.equal(record.courseId, preview.courseId);
    assert.ok(record.conversations.length >= 1);
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, root);
  }
});

/* #79: a sessão JSONL do Pi vira transcrição. O histórico de exibição sai só
   das mensagens de texto; a chamada de ferramenta dentro da resposta do
   assistente (aqui um `rm -rf`) e o resultado dela ficam de fora. */
test('#79: sessão do Pi vira mensagens de texto, sem chamada de ferramenta nem linha torta', () => {
  const text = [
    '{"type":"session","id":"abc"}',
    '{"type":"model_change","model":"x"}',
    '{"type":"message","message":{"role":"user","content":[{"type":"text","text":"Explica a integral"}]}}',
    '{"type":"message","message":{"role":"assistant","content":[{"type":"thinking","thinking":"pensando"},{"type":"toolCall","name":"bash","arguments":{"command":"rm -rf x"}},{"type":"text","text":"Claro."}]}}',
    '{"type":"message","message":{"role":"toolResult","content":[{"type":"text","text":"saída"}]}}',
    'linha torta',
    '{"type":"message","message":{"role":"user","content":"   "}}',
  ].join('\n');
  assert.deepEqual(packageImport.piSessionMessages(text), [
    {role: 'user', content: 'Explica a integral'},
    {role: 'assistant', content: 'Claro.'},
  ]);
});

/* #75: o pacote juntava só `claude-*.json`; a conversa do OpenCode (e o chat
   lateral dele) ficava de fora do pacote e do backup. Os dois usam o mesmo
   `opencode-<id>.json`, então o teste leva um de cada. */
test('pacote: conversa e chat lateral do OpenCode entram no pacote e voltam como transcrição', () => {
  const fixture = seedRuntime();
  write(fixture.runtime, 'conversations/opencode-33333333-4444-5555-6666-777777777777.json', JSON.stringify({
    schemaVersion: 1, engine: 'opencode', id: '33333333-4444-5555-6666-777777777777',
    nativeSessionId: 'ses_abc123', nativeEstablished: true, courseId: 'mat-1',
    preview: 'conversa opencode da matéria', messages: [{role: 'user', content: 'oi do opencode'}],
  }));
  write(fixture.runtime, 'conversations/opencode-44444444-5555-6666-7777-888888888888.json', JSON.stringify({
    schemaVersion: 1, engine: 'opencode', id: '44444444-5555-6666-7777-888888888888',
    nativeSessionId: 'ses_side456', nativeEstablished: true, courseId: 'mat-1',
    mainSession: 'opencode-33333333-4444-5555-6666-777777777777.json',
    preview: 'chat lateral do opencode', messages: [{role: 'user', content: 'e no chat lateral?'}],
  }));
  const built = packages.buildPackage({
    runtime: fixture.runtime,
    course: {id: 'mat-1', name: 'Algebra Linear'},
    materialsDir: fixture.materialsDir,
    learningDir: path.join(fixture.runtime, 'learning', 'Courses', 'Algebra Linear'),
    include: {review: true, bookmarks: true, resume: true, conversations: true},
  });
  const root = tempDir('mesa-import-opencode');
  try {
    const destination = packages.planDestination({root, name: 'Algebra Linear'});
    const preview = packages.previewImport({buffer: built.buffer, destination});
    const listed = preview.conversations.filter((item) => item.engine === 'opencode');
    assert.equal(listed.length, 2, 'a conversa principal e o chat lateral estão no manifesto');
    for (const item of listed) {
      assert.match(item.archivePath, /opencode\/opencode-/);
      assert.equal(item.resume, 'exported-transcript');
      assert.equal(item.nativeResume, false, 'o ses_ do autor não abre do outro lado');
    }

    const result = packages.importPackage({buffer: built.buffer, destination, courseId: preview.courseId});
    const files = fs.readdirSync(path.join(result.conversationsDir, 'opencode'));
    assert.equal(files.length, 2);
    assert.ok(files.every((name) => /^opencode-[0-9a-f-]{36}\.json$/.test(name)));
    const descriptors = files.map((name) => {
      const file = path.join(result.conversationsDir, 'opencode', name);
      assert.equal(conversations.conversationEngine(file), 'opencode');
      assert.ok(conversations.readClaudeConversation(file), 'conversations.cjs aceita o descritor importado');
      return {file, record: JSON.parse(fs.readFileSync(file, 'utf8'))};
    });
    for (const {record} of descriptors) {
      assert.equal(record.engine, 'opencode');
      assert.equal(record.courseId, preview.courseId);
      assert.equal(record.nativeEstablished, false, 'a transcrição não retoma o provedor do autor');
      assert.ok(Array.isArray(record.messages) && record.messages.length === 1, 'transcrição preservada');
    }
    assert.ok(descriptors.some(({record}) => record.preview === 'conversa opencode da matéria'));
    assert.ok(descriptors.some(({record}) => record.preview === 'chat lateral do opencode'));
    assert.ok(descriptors.some(({record}) => record.importedFrom === 'ses_abc123'));
    assert.ok(descriptors.some(({record}) => record.importedFrom === 'ses_side456'));
    const info = result.record.conversations.filter((item) => item.engine === 'opencode');
    assert.equal(info.length, 2);
    for (const item of info) assert.ok(files.includes(path.basename(item.file)));
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

test('pacote: zip bomb com tamanho declarado pequeno para no teto, sem expandir', (t) => {
  /* 16 MiB de zeros deflados viram uns 16 KB, e a entrada declara 1 KiB: a razão
     fica abaixo de 1000:1 e o zip chega ao inflate. Antes, o inflate alocava os
     16 MiB inteiros e só então recusava pelo tamanho; agora o teto é size+1. */
  const bomb = bombZip('payload/materials/bomba.txt', 16 * 1024 * 1024, 1024);
  const original = zlib.inflateRawSync;
  const limits = [];
  t.mock.method(zlib, 'inflateRawSync', (raw, options) => {
    limits.push(options);
    return original(raw, options);
  });
  assert.throws(() => zipkit.readZip(bomb), ptMatches(/tamanho de payload\/materials\/bomba\.txt/));
  assert.deepEqual(limits, [{maxOutputLength: 1025}]);
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
  /* O remap compara caminhos absolutos do sistema: no Windows `/antigo` vira
     `D:\antigo`, então o fixture usa `path.resolve` como o dado real usa. */
  const oldBase = path.resolve('/antigo');
  const newBase = path.resolve('/novo');
  const out = packages.remapValue(
    {mat: {path: path.join(oldBase, 'aula.pdf'), nested: [{path: path.join(oldBase, 'sub', 'b.pdf'), id: 'mat-1'}], id: 'mat-1'}},
    {oldBase, newBase, oldId: 'mat-1', newId: 'materia-2'},
  );
  assert.deepEqual(out, {mat: {path: path.join(newBase, 'aula.pdf'), nested: [{path: path.join(newBase, 'sub', 'b.pdf'), id: 'materia-2'}], id: 'materia-2'}});
});

/* Zip de uma entrada cujo tamanho descomprimido declarado (cabeçalho local e
   diretório central) não é o real: o zip bomb da revisão de segurança. */
function bombZip(name, realBytes, declaredBytes) {
  const zip = rawZip([{name, data: Buffer.alloc(realBytes)}]);
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const cdOffset = zip.readUInt32LE(eocd + 16);
  zip.writeUInt32LE(declaredBytes, 22);
  zip.writeUInt32LE(declaredBytes, cdOffset + 24);
  return zip;
}

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

test('zipkit: razão de compressão e total descompactado têm teto (#82)', () => {
  const buf = zipkit.writeZip({a: Buffer.alloc(4096, 0x61), b: Buffer.alloc(4096, 0x62)}, {deflate: true});
  assert.equal(zipkit.readZip(buf).length, 2);
  assert.throws(() => zipkit.readZip(buf, {limits: {maxRatio: 2}}), ptMatches(/razão de compressão suspeita em a/));
  assert.throws(() => zipkit.readZip(buf, {limits: {maxTotalBytes: 5000}}), ptMatches(/grande demais depois de descompactar/));
});

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

/* #87: a linhagem é do runtime do autor; o pacote leva a conversa, mas não o
   ponteiro `origin` (que apontaria para um arquivo ausente no destino). */
test('pacote: importar conversa com origin descarta a linhagem, sem perder a transcrição', () => {
  const fixture = seedRuntime();
  const root = tempDir('mesa-import-origin');
  try {
    const source = path.join(fixture.runtime, 'conversations', 'claude-11111111-2222-3333-4444-555555555555.json');
    const raw = JSON.parse(fs.readFileSync(source, 'utf8'));
    raw.origin = {session: path.join(fixture.runtime, 'pi-1700000000000.jsonl'), engine: 'pi'};
    raw.handoff = {kind: 'digest', bytes: 12, createdAt: 1700000000000};
    /* Sessão "continua de…": nasce com `messages` vazio e o contexto mora no
       `importedTranscript` (#87). */
    raw.messages = [];
    raw.importedTranscript = 'Matéria: Algebra Linear. Último ponto: isole o termo.';
    fs.writeFileSync(source, JSON.stringify(raw));
    const built = packages.buildPackage({
      runtime: fixture.runtime,
      course: {id: 'mat-1', name: 'Algebra Linear'},
      materialsDir: fixture.materialsDir,
      learningDir: path.join(fixture.runtime, 'learning', 'Courses', 'Algebra Linear'),
      include: {review: true, bookmarks: true, resume: true, conversations: true},
    });
    const destination = packages.planDestination({root, name: 'Algebra Linear'});
    const preview = packages.previewImport({buffer: built.buffer, destination});
    const result = packages.importPackage({buffer: built.buffer, destination, courseId: preview.courseId});
    const imported = fs.readdirSync(path.join(result.conversationsDir, 'claude'))
      .map((name) => JSON.parse(fs.readFileSync(path.join(result.conversationsDir, 'claude', name), 'utf8')))
      .find((descriptor) => descriptor.importedFrom === raw.nativeSessionId);
    assert.ok(imported, 'a conversa foi importada');
    assert.equal(imported.origin, undefined, 'o ponteiro da linhagem não atravessa o pacote');
    assert.equal(imported.handoff, undefined, 'o metadado do digest também não');
    assert.deepEqual(imported.messages ?? [], [], 'a sessão continua nascendo sem mensagens');
    assert.equal(imported.importedTranscript, raw.importedTranscript, 'o contexto da passagem atravessa o pacote');
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome, root);
  }
});
