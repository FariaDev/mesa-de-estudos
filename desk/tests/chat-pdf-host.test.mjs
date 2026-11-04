/* PDF solto no chat: o arquivo real passa por `validateDroppedPdf`, a contagem
   e o tamanho são fakes nomeados, e a leitura só existe quando o grant desta
   conversa entra na lista do `resolveTutorPdf`. A biblioteca não muda. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {tinyPdf} from './helpers.mjs';

const require = createRequire(import.meta.url);
const {createChatPdfHost} = require('../chat-pdf-host.cjs');
const {createChatPdfGrants} = require('../chat-pdf-grants.cjs');
const {resolveTutorPdf, MAX_BYTES} = require('../pdf-read-path.cjs');
const {message} = require('../src/i18n.mjs');

function createFakeDisk() {
  const files = new Map();
  let writes = 0;
  function fakeRead(file) {
    if (!files.has(file)) {
      const error = Error(`ENOENT: ${file}`);
      error.code = 'ENOENT';
      throw error;
    }
    return files.get(file);
  }
  function fakeWrite(file, data) {
    writes += 1;
    files.set(file, String(data));
  }
  function fakeRename(from, to) {
    files.set(to, files.get(from));
    files.delete(from);
  }
  function fakeMkdir() {}
  return {files, writes: () => writes, fakeRead, fakeWrite, fakeRename, fakeMkdir};
}

function withPdf(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'mesa-chat-pdf-'));
  const file = join(dir, 'Aula.pdf');
  writeFileSync(file, tinyPdf('Limites', 1));
  const disk = createFakeDisk();
  const library = new Set(['/curso/Livro.pdf']);
  let session = join(dir, 'a.jsonl');
  const grants = createChatPdfGrants({
    runtime: dir,
    session: () => session,
    readFile: disk.fakeRead,
    writeFile: disk.fakeWrite,
    rename: disk.fakeRename,
    mkdir: disk.fakeMkdir,
  });
  const sources = () => [...library, ...grants.list()];
  return Promise.resolve()
    .then(() => fn({dir, file, library, grants, disk, sources, sessionOf(next) { session = next; }}))
    .finally(() => rmSync(dir, {recursive: true, force: true}));
}

test('anexar autoriza o PDF nesta conversa e não mexe na biblioteca', () => withPdf(async ({file, library, grants, sources}) => {
  const counted = [];
  function fakePageCount(pdf) {
    counted.push(pdf);
    return Promise.resolve(7);
  }
  const host = createChatPdfHost({pageCount: fakePageCount, grant: (pdf) => grants.grant(pdf), sources});
  const attached = await host.attach(file);
  const opened = realpathSync.native(file);
  assert.deepEqual(counted, [file]);
  assert.equal(attached.pages, 7);
  assert.equal(attached.name, 'Aula.pdf');
  assert.equal(attached.path, opened);
  assert.doesNotMatch(JSON.stringify(attached), /%PDF/);
  assert.deepEqual([...library], ['/curso/Livro.pdf']);
  assert.throws(() => resolveTutorPdf(opened, library), /PDF recusado/);
  assert.equal(resolveTutorPdf(opened, library, {exact: grants.list()}), opened);
  const again = host.authorize([{name: 'Aula.pdf', path: opened, pages: 9}]);
  assert.equal(counted.length, 1, 'reautorizar usa as páginas guardadas');
  assert.equal(again[0].pages, 9);
  assert.equal(again[0].path, opened);
}));

test('outra conversa não lê o PDF, e um irmão na mesma pasta passa pelo mesmo crivo', () => withPdf(async ({dir, file, grants, sources, sessionOf}) => {
  function fakePageCount() { return Promise.resolve(1); }
  const host = createChatPdfHost({pageCount: fakePageCount, grant: (pdf) => grants.grant(pdf), sources});
  const attached = await host.attach(file);
  const sibling = join(dir, 'Extra.pdf');
  writeFileSync(sibling, tinyPdf('Extra', 1));
  const openedSibling = realpathSync.native(sibling);
  assert.equal(resolveTutorPdf(openedSibling, sources()), openedSibling);
  sessionOf(join(dir, 'b.jsonl'));
  assert.deepEqual(grants.list(), []);
  assert.throws(() => resolveTutorPdf(attached.path, sources()), /PDF recusado/);
  assert.throws(() => resolveTutorPdf(openedSibling, sources()), /PDF recusado/);
}));

test('cabeçalho inválido, arquivo que não é PDF, tamanho e leitura falha não autorizam', () => withPdf(async ({dir, file, grants, sources}) => {
  const granted = [];
  function fakeGrant(pdf) { granted.push(pdf); return pdf; }
  function fakePageCount() { return Promise.resolve(3); }
  const host = createChatPdfHost({pageCount: fakePageCount, grant: fakeGrant, sources: () => [...sources(), ...granted]});
  const bad = join(dir, 'nota.pdf');
  writeFileSync(bad, 'isto nao e pdf');
  await assert.rejects(() => host.attach(bad), (error) => {
    assert.equal(error.message, message('err.drop.badHeader'));
    return true;
  });
  await assert.rejects(() => host.attach(join(dir, 'notas.txt')), (error) => {
    assert.equal(error.message, message('err.chatpdf.notFile'));
    return true;
  });
  function fakeStat() { return {size: MAX_BYTES + 1, isFile() { return true; }}; }
  const huge = createChatPdfHost({pageCount: fakePageCount, grant: fakeGrant, sources: () => granted, stat: fakeStat});
  await assert.rejects(() => huge.attach(file), (error) => {
    assert.equal(error.message, message('err.chatpdf.tooBig', {bytes: MAX_BYTES + 1}));
    return true;
  });
  function fakePageCountFails() { return Promise.reject(Error('xref quebrado')); }
  const broken = createChatPdfHost({pageCount: fakePageCountFails, grant: fakeGrant, sources: () => granted});
  await assert.rejects(() => broken.attach(file), (error) => {
    assert.equal(error.message, message('err.chatpdf.unreadable', {name: 'Aula.pdf', error: 'xref quebrado'}));
    return true;
  });
  function fakeStatMissing(pdf) { throw Error(`ENOENT: ${pdf}`); }
  const gone = createChatPdfHost({pageCount: fakePageCount, grant: fakeGrant, sources: () => granted, stat: fakeStatMissing});
  await assert.rejects(() => gone.attach(file), (error) => {
    assert.equal(error.message, message('err.chatpdf.unreadable', {name: 'Aula.pdf', error: `ENOENT: ${file}`}));
    return true;
  });
  assert.deepEqual(granted, []);
  assert.deepEqual(grants.list(), []);
}));

test('authorize não concede: caminho nunca anexado recusa o envio e não grava nada', () => withPdf(async ({dir, grants, disk, sources}) => {
  const outside = join(dir, 'Segredo.pdf');
  writeFileSync(outside, tinyPdf('Segredo', 1));
  const granted = [];
  const host = createChatPdfHost({
    pageCount: () => Promise.resolve(1),
    grant: (pdf) => {
      granted.push(pdf);
      return grants.grant(pdf);
    },
    sources,
  });
  const writesBefore = disk.writes();
  assert.throws(() => host.authorize([{name: 'Segredo.pdf', path: outside, pages: 1}]), (error) => {
    assert.equal(error.message, message('err.chatpdf.notGranted', {name: 'Segredo.pdf'}));
    assert.ok(!error.message.includes(dir), 'a recusa não leva a pasta');
    return true;
  });
  assert.deepEqual(granted, []);
  assert.deepEqual(grants.list(), []);
  assert.equal(disk.writes(), writesBefore, 'nada foi gravado em chat-pdf-grants.json');
  assert.equal(disk.files.size, 0);
}));

test('authorize pula o PDF que sumiu, com só o nome, e os outros do envio seguem', () => withPdf(async ({dir, file, grants, sources}) => {
  const gone = join(dir, 'Sumido.pdf');
  writeFileSync(gone, tinyPdf('Sumido', 1));
  const skipped = [];
  const host = createChatPdfHost({
    pageCount: () => Promise.resolve(2),
    grant: (pdf) => grants.grant(pdf),
    sources,
    onSkip: (text) => skipped.push(text),
  });
  const kept = await host.attach(file);
  const lost = await host.attach(gone);
  rmSync(gone);
  const again = host.authorize([
    {name: 'Sumido.pdf', path: lost.path, pages: 2},
    {name: 'Aula.pdf', path: kept.path, pages: 2},
  ]);
  assert.deepEqual(again, [{name: 'Aula.pdf', path: kept.path, pages: 2}]);
  assert.deepEqual(skipped, [message('err.chatpdf.unreadable', {name: 'Sumido.pdf', error: 'ENOENT'})]);
  assert.ok(!skipped[0].includes(dir), 'o caminho inteiro não entra na mensagem');
}));

test('authorize aceita o PDF concedido com o nome em NFC quando o disco guarda NFD', () => withPdf(async ({dir, grants, sources}) => {
  const onDisk = join(dir, 'Lógica.pdf'.normalize('NFD'));
  writeFileSync(onDisk, tinyPdf('Logica', 1));
  const host = createChatPdfHost({pageCount: () => Promise.resolve(1), grant: (pdf) => grants.grant(pdf), sources});
  const attached = await host.attach(onDisk);
  const typed = attached.path.normalize('NFC');
  assert.notEqual(typed, attached.path);
  assert.deepEqual(host.authorize([{name: 'Lógica.pdf', path: typed, pages: 1}]), [{name: attached.name, path: attached.path, pages: 1}]);
}));
