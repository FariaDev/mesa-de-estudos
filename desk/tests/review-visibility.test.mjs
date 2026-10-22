/* Visibilidade do caderno: item com referência fora da biblioteca (ou com
   arquivo que sumiu) continua na lista, marcado — nunca é filtrado sem
   explicação.

   O `main.cjs` filtrava `reviewPayload` por `allowed` e o item desaparecia da
   aba; `review.cjs#annotateVisibility` é o contrato para trocar o filtro por
   anotação. A agenda (`review-schedule.cjs`) usa a mesma leitura de estado e a
   mesma nota em português. */

import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const review = require('../review.cjs');

const item = (path, extra = {}) => ({
  question: extra.question ?? 'Limites',
  attempt: '',
  difficulty: '',
  ref: {name: 'Limites.pdf', page: 3, path},
});

test('a lista inteira continua: fora da biblioteca e ausente viram estado', () => {
  const allowed = new Set(['/p/Limites.pdf']);
  const exists = (file) => file !== '/p/Velho.pdf';
  const out = review.annotateVisibility([
    item('/p/Limites.pdf'),
    item('/p/Velho.pdf'),
    item('/outro/Outro.pdf'),
    item(''),
  ], allowed, exists);
  assert.equal(out.length, 4, 'nada é escondido');
  assert.deepEqual(out.map((one) => one.refState), ['ok', 'missing', 'outside', 'ok']);
  assert.deepEqual(out.map((one) => one.question), ['Limites', 'Limites', 'Limites', 'Limites']);
});

test('biblioteca vazia marca referência existente como fora', () => {
  const out = review.annotateVisibility([item('/p/Limites.pdf')], new Set(), () => true);
  assert.equal(out[0].refState, 'outside');
});

test('sem `allowed` não há acusação de fora; sem caminho não há acusação', () => {
  assert.equal(review.annotateVisibility([item('/p/Limites.pdf')], null, () => true)[0].refState, 'ok');
  assert.equal(review.annotateVisibility([item('')], new Set(['/p/Limites.pdf']), () => false)[0].refState, 'ok');
  assert.equal(review.annotateVisibility([item('/p/Limites.pdf')], new Set(['/p/Limites.pdf']), () => false)[0].refState, 'missing', 'o arquivo ausente vence a biblioteca');
});

test('a anotação não muda o item guardado (nomes, página, pergunta)', () => {
  const original = item('/outro/Outro.pdf', {question: 'Continuidade'});
  const [one] = review.annotateVisibility([original], new Set(['/p/Limites.pdf']), () => true);
  assert.deepEqual({...one, refState: undefined}, {...original, refState: undefined});
  assert.equal(one.refState, 'outside');
});

test('a leitura/gravação antiga do caderno continua intacta', () => {
  const runtime = mkdtempSync(join(tmpdir(), 'mesa-review-visibility-'));
  try {
    const saved = review.reviewSave(runtime, {
      courseId: 'A',
      mode: 'add',
      item: item('/p/Limites.pdf'),
    });
    assert.equal(saved.length, 1);
    assert.equal(saved[0].question, 'Limites');
    const reloaded = review.readItems(runtime, 'A');
    assert.equal(reloaded.length, 1);
    assert.equal(existsSync(join(runtime, 'review.json')), true);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});
