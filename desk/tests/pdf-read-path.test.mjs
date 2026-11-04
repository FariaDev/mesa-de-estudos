/* Caminho do `ler_pdf`: NFC/NFD, pasta da matéria, symlink que escapa e a
   recusa que diz o valor recebido. Sem biblioteca inteira no erro. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {tinyPdf} from './helpers.mjs';

const require = createRequire(import.meta.url);
const {resolveTutorPdf, isPdfPath, pdfReadDenied} = require('../pdf-read-path.cjs');

function withDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-pdf-path-'));
  return Promise.resolve(fn(dir)).finally(() => fs.rmSync(dir, {recursive: true, force: true}));
}

test('NFC pedido casa com o arquivo NFD da biblioteca, e o enfeite (p. N) sai', () => withDir((dir) => {
  const nfdName = 'Aula 6 - Lo\u0301gica Formal (Parte 5).pdf';
  const nfcName = nfdName.normalize('NFC');
  assert.notEqual(nfcName, nfdName);
  const stored = path.join(dir, nfdName);
  fs.writeFileSync(stored, tinyPdf('Lógica'));
  const allowed = new Set([stored]);
  const got = resolveTutorPdf(`${path.join(dir, nfcName)} (p. 3)`, allowed);
  assert.equal(fs.realpathSync.native(got), fs.realpathSync.native(stored));
  const url = pathToFileURL(stored).href;
  assert.equal(fs.realpathSync.native(resolveTutorPdf(`${url}#page=2`, allowed)), fs.realpathSync.native(stored));
}));

test('PDF na mesma pasta de um autorizado entra; symlink para fora e caminho arbitrário não', () => withDir((dir) => {
  const library = path.join(dir, 'Aula 5.pdf');
  const sibling = path.join(dir, 'Aula 6 - Lógica Formal (Parte 5).pdf');
  fs.writeFileSync(library, tinyPdf('parte 4'));
  fs.writeFileSync(sibling, tinyPdf('parte 5'));
  const allowed = new Set([library]);
  assert.equal(fs.realpathSync.native(resolveTutorPdf(sibling, allowed)), fs.realpathSync.native(sibling));

  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-pdf-out-'));
  try {
    const secret = path.join(outsideDir, 'segredo.pdf');
    fs.writeFileSync(secret, tinyPdf('segredo'));
    const link = path.join(dir, 'atalho.pdf');
    fs.symlinkSync(secret, link);
    assert.throws(() => resolveTutorPdf(link, allowed), (error) => {
      assert.match(error.message, /PDF recusado: recebi/);
      assert.match(error.message, /atalho\.pdf/);
      assert.equal(error.message.includes('Aula 5.pdf'), false, 'a recusa não lista a biblioteca');
      assert.equal(error.message.includes(secret), false);
      return true;
    });
  } finally {
    fs.rmSync(outsideDir, {recursive: true, force: true});
  }

  assert.throws(() => resolveTutorPdf('/etc/hosts', allowed), /PDF recusado: recebi "\/etc\/hosts"/);
  assert.throws(() => resolveTutorPdf('', allowed), /PDF recusado: recebi ""/);
  assert.throws(() => resolveTutorPdf(null, allowed), /PDF recusado: recebi null/);
}));

test('no Windows a pasta compara sem caixa, e arquivo grande ou sem %PDF é recusado com o motivo', () => {
  const header = Buffer.from('%PDF-1.4');
  const files = new Map([
    ['C:\\Curso\\Aula 5.pdf', header],
    ['C:\\Curso\\Extra.PDF', header],
    ['C:\\Curso\\vazio.pdf', Buffer.alloc(0)],
    ['C:\\Curso\\nota.txt', Buffer.from('oi')],
  ]);
  const deps = {
    platform: 'win32',
    realpath(file) {
      const key = [...files.keys()].find((real) => real.toLowerCase() === String(file).toLowerCase());
      return key || '';
    },
    stat(file) {
      const bytes = files.get(file);
      if (!bytes) {
        const error = Error('ENOENT');
        error.code = 'ENOENT';
        throw error;
      }
      return {isFile: () => true, size: bytes.length};
    },
    readMagic(file) {
      return files.get(file).subarray(0, 5).toString('latin1');
    },
  };
  const allowed = ['C:\\Curso\\Aula 5.pdf'];
  assert.equal(resolveTutorPdf('c:\\curso\\extra.pdf', allowed, deps), 'C:\\Curso\\Extra.PDF');
  assert.throws(() => resolveTutorPdf('c:\\curso\\vazio.pdf', allowed, deps), /0 bytes/);
  assert.throws(() => resolveTutorPdf('c:\\curso\\nota.txt', allowed, deps), /PDF recusado: recebi "c:\\\\curso\\\\nota.txt"/);
  const huge = Buffer.alloc(5);
  files.set('C:\\Curso\\grande.pdf', huge);
  deps.stat = (file) => ({isFile: () => true, size: file.endsWith('grande.pdf') ? 80 * 1024 * 1024 + 1 : files.get(file).length});
  assert.throws(() => resolveTutorPdf('C:\\Curso\\grande.pdf', allowed, deps), /80 MB/);
});

test('nome com # ou ? é arquivo de verdade; só (p. N) e #page=N saem do caminho', () => withDir((dir) => {
  const hashName = path.join(dir, 'Aula #3.pdf');
  fs.writeFileSync(hashName, tinyPdf('hash'));
  const allowed = new Set([hashName]);
  assert.equal(isPdfPath(hashName), true, 'o # do nome não é fragmento');
  assert.equal(isPdfPath('Prova ?.pdf'), true, 'o ? do nome não é query');
  assert.equal(isPdfPath('/x/Aula.pdf?x=1'), false, 'query só sai em URL file:');
  assert.equal(fs.realpathSync.native(resolveTutorPdf(`${hashName}#page=3`, allowed)), fs.realpathSync.native(hashName));
  /* `?` é proibido em nome de arquivo no Windows; o caso de arquivo real fica
     no POSIX. A regra de não tratar `?` como query é a mesma e está acima. */
  if (process.platform !== 'win32') {
    const questionName = path.join(dir, 'Prova ?.pdf');
    fs.writeFileSync(questionName, tinyPdf('questao'));
    assert.equal(fs.realpathSync.native(resolveTutorPdf(questionName, allowed)), fs.realpathSync.native(questionName));
  }
  const url = `${pathToFileURL(hashName).href}#page=3`;
  assert.equal(isPdfPath(url), true);
  assert.equal(fs.realpathSync.native(resolveTutorPdf(url, allowed)), fs.realpathSync.native(hashName));
}));

test('o PDF é reconhecido pelo caminho e a recusa traz a ferramenta da Mesa', () => {
  assert.equal(isPdfPath('/Users/ana/Documents/Curso/Aula.pdf'), true);
  assert.equal(isPdfPath('/tmp/notas.txt'), false);
  assert.match(pdfReadDenied('mcp__mesa__ler_pdf'), /mcp__mesa__ler_pdf/);
});

test('PDF solto no chat (exact) libera só ele, não a pasta dele', () => withDir((dir) => {
  const dropped = path.join(dir, 'Lista solta.pdf');
  const neighbor = path.join(dir, 'Extrato.pdf');
  fs.writeFileSync(dropped, tinyPdf('lista'));
  fs.writeFileSync(neighbor, tinyPdf('extrato'));
  const got = resolveTutorPdf(dropped, [], {exact: [dropped]});
  assert.equal(fs.realpathSync.native(got), fs.realpathSync.native(dropped));
  assert.throws(() => resolveTutorPdf(neighbor, [], {exact: [dropped]}), /PDF recusado/);
  assert.equal(fs.realpathSync.native(resolveTutorPdf(neighbor, [dropped])), fs.realpathSync.native(neighbor), 'na biblioteca, a pasta irmã continua valendo');
}));
