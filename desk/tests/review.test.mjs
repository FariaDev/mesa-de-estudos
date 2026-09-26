/* Caderno de revisão (Mesa).
 *
 * O caminho real: o "Guardar para revisar" de uma resposta do Pi abre o
 * `#review-dialog`, o Salvar manda o item por IPC, `review.cjs` grava
 * `runtime/review.json` (por matéria) e a lista volta inteira para a aba
 * remontar. Aqui o teste fala direto com o módulo (sem Electron e sem Pi), em
 * runtime temporário.
 *
 * O que NÃO é testado aqui: a aba, o diálogo e os prompts (isso é do
 * `hunt-review.mjs`) e a IPC (`core.test.mjs`). A FORMA e a ORDEM dos itens são
 * do núcleo e estão nas leis (`core/laws/review.bend`).
 *
 * Editar e remover são por IDENTIDADE (a chave do item que veio da tela), não por
 * posição: a lista da tela é filtrada pela biblioteca da matéria, então um índice
 * do renderer não corresponde ao arquivo gravado. Editar sem chave não inventa
 * destino nem apaga nada: a lista volta intacta.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const review = require('../review.cjs');

function withRuntime(fn) {
  const runtime = mkdtempSync(join(tmpdir(), 'mesa-review-'));
  try {
    return fn(runtime);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
}

const fileOf = (runtime) => join(runtime, review.FILENAME);
const stored = (runtime) => JSON.parse(readFileSync(fileOf(runtime), 'utf8'));
const item = (question, extra = {}) => ({
  question,
  attempt: extra.attempt ?? '',
  difficulty: extra.difficulty ?? '',
  ref: extra.ref ?? {name: 'Limites.pdf', page: 3, path: '/p/Limites.pdf'},
});

test('sem arquivo não há itens e nada é criado na leitura', () => {
  withRuntime((runtime) => {
    assert.deepEqual(review.readItems(runtime, 'A'), []);
    assert.equal(existsSync(fileOf(runtime)), false);
  });
});

test('guardar apara os textos e levanta a página para 1', () => {
  withRuntime((runtime) => {
    const saved = review.reviewSave(runtime, {
      courseId: 'A',
      mode: 'add',
      item: {
        question: '  Limites no infinito  ',
        attempt: ' dividi por x² ',
        difficulty: ' não vi a fatoração ',
        ref: {name: ' Limites.pdf ', page: 0, path: ' /p/Limites.pdf '},
      },
    });
    assert.deepEqual(saved, [
      {
        question: 'Limites no infinito',
        attempt: 'dividi por x²',
        difficulty: 'não vi a fatoração',
        ref: {name: 'Limites.pdf', page: 1, path: '/p/Limites.pdf'},
      },
    ]);
    assert.deepEqual(stored(runtime).A, saved);
  });
});

test('sem questão o item é recusado e nada é gravado', () => {
  withRuntime((runtime) => {
    assert.throws(
      () => review.reviewSave(runtime, {courseId: 'A', mode: 'add', item: item('   ')}),
      /Escreva a questão/
    );
    assert.equal(existsSync(fileOf(runtime)), false);
  });
});

test('guardar o mesmo item de novo não duplica e o novo vai para a frente', () => {
  withRuntime((runtime) => {
    review.reviewSave(runtime, {courseId: 'A', mode: 'add', item: item('Limites', {ref: {name: 'Limites.pdf', page: 3, path: '/p/Limites.pdf'}})});
    review.reviewSave(runtime, {courseId: 'A', mode: 'add', item: item('Derivadas', {ref: {name: 'Derivadas.pdf', page: 2, path: '/p/Derivadas.pdf'}})});
    review.reviewSave(runtime, {courseId: 'A', mode: 'add', item: item('Limites', {attempt: 'de novo', ref: {name: 'Limites.pdf', page: 3, path: '/p/Limites.pdf'}})});
    const list = review.readItems(runtime, 'A');
    assert.equal(list.length, 2);
    assert.equal(list[0].question, 'Limites');
    assert.equal(list[0].attempt, 'de novo');
    assert.equal(list[1].question, 'Derivadas');
  });
});

test('cada matéria tem o seu caderno', () => {
  withRuntime((runtime) => {
    review.reviewSave(runtime, {courseId: 'A', mode: 'add', item: item('Limites')});
    review.reviewSave(runtime, {courseId: 'B', mode: 'add', item: item('Integrais')});
    assert.deepEqual(review.readItems(runtime, 'A').map((one) => one.question), ['Limites']);
    assert.deepEqual(review.readItems(runtime, 'B').map((one) => one.question), ['Integrais']);
  });
});

test('editar troca o item pela origem dele (identidade) e mantém a posição', () => {
  withRuntime((runtime) => {
    review.reviewSave(runtime, {courseId: 'A', mode: 'add', item: item('Primeiro')});
    review.reviewSave(runtime, {courseId: 'A', mode: 'add', item: item('Segundo', {ref: {name: 'Outro.pdf', page: 1, path: '/p/Outro.pdf'}})});
    /* A lista guardada é [Segundo, Primeiro] e a origem é o 'Segundo'. */
    const saved = review.reviewSave(runtime, {
      courseId: 'A',
      mode: 'edit',
      key: item('Segundo', {ref: {name: 'Outro.pdf', page: 1, path: '/p/Outro.pdf'}}),
      item: item('Segundo (editado)', {ref: {name: 'Outro.pdf', page: 1, path: '/p/Outro.pdf'}}),
    });
    assert.deepEqual(saved.map((one) => one.question), ['Segundo (editado)', 'Primeiro']);
    /* Agora a origem é a POSIÇÃO 1: a posição não manda, a identidade manda. */
    const back = review.reviewSave(runtime, {courseId: 'A', mode: 'edit', key: item('Primeiro'), item: item('Primeiro (editado)')});
    assert.deepEqual(back.map((one) => one.question), ['Segundo (editado)', 'Primeiro (editado)']);
  });
});

test('origem que não está mais no caderno deixa tudo como está', () => {
  withRuntime((runtime) => {
    review.reviewSave(runtime, {courseId: 'A', mode: 'add', item: item('Limites')});
    const before = readFileSync(fileOf(runtime), 'utf8');
    assert.equal(review.reviewSave(runtime, {courseId: 'A', mode: 'edit', key: item('Fantasma'), item: item('Outro')}).length, 1);
    assert.equal(review.readItems(runtime, 'A')[0].question, 'Limites');
    assert.equal(review.reviewSave(runtime, {courseId: 'A', mode: 'remove', key: item('Fantasma')}).length, 1);
    assert.equal(review.readItems(runtime, 'A')[0].question, 'Limites');
    assert.equal(readFileSync(fileOf(runtime), 'utf8'), before, 'operação que não achou a origem não regrava o arquivo');
    /* Sem `key` a mira é o próprio item: 'Outro' não está no caderno, então nada muda. */
    assert.deepEqual(review.reviewSave(runtime, {courseId: 'A', mode: 'edit', item: item('Outro')}).map((one) => one.question), ['Limites']);
    assert.equal(readFileSync(fileOf(runtime), 'utf8'), before);
  });
});

test('remover tira pela identidade e a última saída limpa a chave', () => {
  withRuntime((runtime) => {
    review.reviewSave(runtime, {courseId: 'A', mode: 'add', item: item('Primeiro')});
    review.reviewSave(runtime, {courseId: 'A', mode: 'add', item: item('Segundo', {ref: {name: 'Outro.pdf', page: 1, path: '/p/Outro.pdf'}})});
    /* A lista guardada é [Segundo, Primeiro]: o 'Primeiro' é a posição 1. */
    assert.deepEqual(review.reviewSave(runtime, {courseId: 'A', mode: 'remove', item: item('Primeiro')}).map((one) => one.question), ['Segundo']);
    assert.deepEqual(
      review.reviewSave(runtime, {courseId: 'A', mode: 'remove', item: item('Segundo', {ref: {name: 'Outro.pdf', page: 1, path: '/p/Outro.pdf'}})}),
      []
    );
    assert.equal(stored(runtime).A, undefined);
  });
});

test('o item sem referência continua válido', () => {
  withRuntime((runtime) => {
    const saved = review.reviewSave(runtime, {
      courseId: 'A',
      mode: 'add',
      item: {question: 'Sem PDF', attempt: '', difficulty: '', ref: {name: '', page: 0, path: ''}},
    });
    assert.deepEqual(saved[0].ref, {name: '', page: 1, path: ''});
  });
});

test('arquivo corrompido vira caderno vazio (leitura tolerante)', () => {
  withRuntime((runtime) => {
    writeFileSync(fileOf(runtime), '{isso não é json');
    assert.deepEqual(review.readItems(runtime, 'A'), []);
    const saved = review.reviewSave(runtime, {courseId: 'A', mode: 'add', item: item('Limites')});
    assert.deepEqual(saved.map((one) => one.question), ['Limites']);
  });
});

test('item sem forma no arquivo é ignorado na leitura', () => {
  withRuntime((runtime) => {
    writeFileSync(
      fileOf(runtime),
      JSON.stringify({A: [{question: '  '}, {question: 'Limites', ref: {page: 3, path: '/p/Limites.pdf'}}, 'lixo']})
    );
    const list = review.readItems(runtime, 'A');
    assert.equal(list.length, 1);
    assert.equal(list[0].question, 'Limites');
    assert.equal(list[0].ref.page, 3);
  });
});
