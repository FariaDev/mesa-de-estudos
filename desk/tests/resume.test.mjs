/* Registro do "Encerrar por hoje" (Mesa).
 *
 * O caminho real: o submit do diálogo manda o registro por IPC, `resume.cjs`
 * grava `runtime/resume.json` (por matéria) ANTES de falar com o Pi e o cartão
 * de retomada volta no payload do boot. Aqui o teste fala direto com o módulo
 * (sem Electron e sem Pi), em runtime temporário.
 *
 * O que NÃO é testado aqui: o diálogo, o cartão e o `#prompt` (isso é do
 * `hunt-shell.mjs`) e a IPC (`core.test.mjs`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const resume = require('../resume.cjs');

function withRuntime(fn) {
  const runtime = mkdtempSync(join(tmpdir(), 'mesa-resume-'));
  try {
    return fn(runtime);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
}

const fileOf = (runtime) => join(runtime, resume.FILENAME);
const readStore = (runtime) => JSON.parse(readFileSync(fileOf(runtime), 'utf8'));

test('o registro guarda a forma do núcleo: textos aparados, página ≥ 1, no máximo dois PDFs', () => {
  withRuntime((runtime) => {
    const out = resume.saveResume(runtime, 'A', {
      stopped: '  travei na 3  ',
      next: '  fazer a 4  ',
      exercise: '  Lista 2 · 7b  ',
      xopp: '  /tmp/rascunho.xopp  ',
      pages: [{path: '/tmp/a.pdf', page: 0}, {path: '/tmp/b.pdf', page: 7}, {path: '/tmp/c.pdf', page: 9}],
    });
    assert.deepEqual(out, {
      stopped: 'travei na 3',
      next: 'fazer a 4',
      exercise: 'Lista 2 · 7b',
      xopp: '/tmp/rascunho.xopp',
      pages: [{path: '/tmp/a.pdf', page: 1}, {path: '/tmp/b.pdf', page: 7}],
    });
    assert.deepEqual(readStore(runtime).A, out, 'o que foi devolvido é o que está no arquivo');
    assert.equal(existsSync(`${fileOf(runtime)}.tmp`), false, 'gravação atômica não deixa o tmp para trás');
    assert.deepEqual(resume.readResume(runtime, 'A'), out);
    assert.equal(resume.readResume(runtime, 'B'), null, 'cada matéria tem o seu');
  });
});

test('texto grande é cortado no teto do núcleo (240) e página vem de qualquer número', () => {
  withRuntime((runtime) => {
    const out = resume.saveResume(runtime, 'A', {
      stopped: 'x'.repeat(300),
      next: 'y'.repeat(300),
      exercise: 'z'.repeat(300),
      xopp: '/tmp/r.xopp',
      pages: [{path: '/tmp/a.pdf', page: -4.7}, {path: '/tmp/b.pdf', page: 'nope'}, {path: 42, page: 3}, {path: '', page: 3}],
    });
    assert.equal(out.stopped.length, 240);
    assert.equal(out.next.length, 240);
    assert.equal(out.exercise.length, 240);
    assert.deepEqual(out.pages, [{path: '/tmp/a.pdf', page: 1}, {path: '/tmp/b.pdf', page: 1}], 'página estranha vira 1 e caminho que não é texto cai');
  });
});

test('sem onde parei e próximo passo não há registro (e nada é gravado)', () => {
  withRuntime((runtime) => {
    for (const raw of [{next: 'fazer a 4'}, {stopped: 'travei na 3'}, {stopped: '   ', next: '\t'}, {}]) {
      assert.throws(() => resume.saveResume(runtime, 'A', raw), /Preencha onde parei/, JSON.stringify(raw));
    }
    assert.equal(existsSync(fileOf(runtime)), false, 'registro recusado não cria arquivo');
    assert.equal(resume.readResume(runtime, 'A'), null);
  });
});

test('erro de escrita sobe (o Encerrar mantém o texto na tela)', () => {
  withRuntime((runtime) => {
    /* `runtime` apontando para um arquivo: mkdir/write não têm onde acontecer. */
    const blocked = join(runtime, 'bloqueado');
    writeFileSync(blocked, 'não é pasta');
    assert.throws(() => resume.saveResume(blocked, 'A', {stopped: 'x', next: 'y'}));
  });
});

test('leitura tolerante: sem arquivo, JSON torto, gigante e registro sem o miolo', () => {
  withRuntime((runtime) => {
    assert.equal(resume.readResume(runtime, 'A'), null, 'sem arquivo não há registro');

    mkdirSync(runtime, {recursive: true});
    writeFileSync(fileOf(runtime), '{torto');
    assert.equal(resume.readResume(runtime, 'A'), null);

    writeFileSync(fileOf(runtime), JSON.stringify(['nada']));
    assert.equal(resume.readResume(runtime, 'A'), null);

    /* Registro sem "próximo passo" (editado à mão, versão antiga): não há o que
       retomar — a leitura descarta em vez de mostrar cartão pela metade. */
    writeFileSync(fileOf(runtime), JSON.stringify({A: {stopped: 'travei', next: '  '}, B: {stopped: 'ok', next: 'seguir'}}));
    assert.equal(resume.readResume(runtime, 'A'), null);
    assert.deepEqual(resume.readResume(runtime, 'B'), {stopped: 'ok', next: 'seguir', exercise: '', xopp: '', pages: []});

    writeFileSync(fileOf(runtime), ' '.repeat(256 * 1024 + 1));
    assert.equal(resume.readResume(runtime, 'B'), null, 'arquivo acima do teto é recusado na leitura');
  });
});

test('limpar apaga só a matéria pedida', () => {
  withRuntime((runtime) => {
    resume.saveResume(runtime, 'A', {stopped: 'a', next: 'b'});
    resume.saveResume(runtime, 'B', {stopped: 'c', next: 'd'});
    assert.equal(resume.clearResume(runtime, 'A'), true);
    assert.equal(resume.readResume(runtime, 'A'), null);
    assert.equal(resume.readResume(runtime, 'B').stopped, 'c');
    assert.deepEqual(Object.keys(readStore(runtime)), ['B']);
    assert.equal(resume.clearResume(runtime, 'A'), false, 'limpar o que não existe é falso, não erro');
  });
});

test('o registro vive no runtime e sobrevive à troca de matéria', () => {
  withRuntime((runtime) => {
    resume.saveResume(runtime, 'Calculus I', {stopped: 'a', next: 'b'});
    assert.ok(statSync(fileOf(runtime)).size > 0);
    resume.saveResume(runtime, 'Física', {stopped: 'c', next: 'd'});
    assert.equal(resume.readResume(runtime, 'Calculus I').stopped, 'a', 'gravar em outra matéria não mexe na primeira');
    assert.equal(resume.readResume(runtime, 'Física').stopped, 'c');
  });
});
