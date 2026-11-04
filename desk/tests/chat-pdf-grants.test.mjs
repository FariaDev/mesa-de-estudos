/* Autorização de PDF do chat, por conversa. O disco aqui é nomeado: nada
   grava fora do mapa do teste. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const {createChatPdfGrants, FILE, MAX_GRANTS} = require('../chat-pdf-grants.cjs');

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
    if (!files.has(from)) throw Error(`ENOENT: ${from}`);
    files.set(to, files.get(from));
    files.delete(from);
  }
  function fakeMkdir() {}
  return {files, writes: () => writes, fakeRead, fakeWrite, fakeRename, fakeMkdir};
}

function grantsFor(disk, session) {
  return createChatPdfGrants({
    runtime: '/tmp/mesa-grants',
    session,
    readFile: disk.fakeRead,
    writeFile: disk.fakeWrite,
    rename: disk.fakeRename,
    mkdir: disk.fakeMkdir,
  });
}

const storePath = path.join('/tmp', 'mesa-grants', FILE);

test('grant grava na conversa, ignora repetido e não vaza para outra sessão', () => {
  const disk = createFakeDisk();
  let current = '/s/a.jsonl';
  const grants = grantsFor(disk, () => current);
  assert.equal(grants.grant('/c/Aula.pdf'), '/c/Aula.pdf');
  const afterFirst = disk.writes();
  assert.equal(grants.grant('/c/Aula.pdf'), '/c/Aula.pdf');
  assert.equal(disk.writes(), afterFirst, 'repetir o mesmo caminho não regrava');
  assert.equal(disk.files.has(`${storePath}.tmp`), false, 'o temporário sai no rename');
  assert.deepEqual(grants.list(), ['/c/Aula.pdf']);
  current = '/s/b.jsonl';
  assert.deepEqual(grants.list(), []);
  current = '/s/a.jsonl';
  assert.deepEqual(grants.list(), ['/c/Aula.pdf']);
});

test('caminho inválido, sessão vazia e __proto__ não entram na lista', () => {
  const disk = createFakeDisk();
  disk.files.set(storePath, '{"__proto__":["/evil.pdf"],"/s/a.jsonl":["/c/Ok.pdf"]}');
  const grants = grantsFor(disk, () => '/s/a.jsonl');
  assert.deepEqual(grants.list(), ['/c/Ok.pdf']);
  assert.throws(() => grants.grant(''), /caminho inválido/);
  assert.throws(() => grants.grant('x'.repeat(4097)), /caminho inválido/);
  assert.deepEqual(grants.list(), ['/c/Ok.pdf']);
  const empty = grantsFor(disk, () => '');
  assert.throws(() => empty.grant('/c/Aula.pdf'), /sessão vazia/);
});

test('a conversa guarda no máximo 64 caminhos, os mais novos', () => {
  const disk = createFakeDisk();
  const grants = grantsFor(disk, () => '/s/a.jsonl');
  for (let i = 0; i < MAX_GRANTS + 1; i += 1) grants.grant(`/c/${i}.pdf`);
  const list = grants.list();
  assert.equal(list.length, MAX_GRANTS);
  assert.equal(list[0], '/c/1.pdf');
  assert.equal(list.at(-1), `/c/${MAX_GRANTS}.pdf`);
});
