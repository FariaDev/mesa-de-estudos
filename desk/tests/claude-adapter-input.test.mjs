/* Recusas da entrada do adaptador Claude (#43 fase 3): o que o aluno pode
   provocar sai como mensagem marcada, e a tela mostra no idioma dela; o que só
   código erraria leva o valor recebido e o formato esperado. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {enText, ptText} from './pt-text.mjs';

const require = createRequire(import.meta.url);
const {prepareMessage} = require('../src/agents/claude-adapter-input.cjs');
const {MAX_IMAGES, MAX_TEXT_BYTES} = require('../src/agents/claude-adapter-contract.cjs');

const refusal = (input) => {
  try { prepareMessage(input); } catch (error) { return error; }
  assert.fail('prepareMessage deveria recusar');
};
const PIXEL = {type: 'image', mimeType: 'image/png', data: 'iVBORw0KGgo='};

test('mensagem vazia e texto grande demais saem no idioma da tela, com tamanho e teto', () => {
  const empty = refusal({text: '   '});
  assert.equal(empty.code, 'CLAUDE_BAD_MESSAGE');
  assert.equal(empty.notSent, true);
  assert.equal(enText(empty.message), 'Empty message: send text or an image.');
  const big = refusal({text: 'x'.repeat(MAX_TEXT_BYTES + 1)});
  assert.match(ptText(big.message), new RegExp(`Texto grande demais \\(${MAX_TEXT_BYTES + 1} bytes; o teto é ${MAX_TEXT_BYTES}\\)`));
});

test('imagens demais dizem quantas vieram e o teto', () => {
  const many = refusal({text: 'a', images: Array.from({length: MAX_IMAGES + 1}, () => PIXEL)});
  assert.equal(enText(many.message), `Too many images (${MAX_IMAGES + 1}; the limit is ${MAX_IMAGES}).`);
});

test('imagem fora do contrato leva o recebido e o esperado', () => {
  const gif = refusal({text: 'a', images: [{...PIXEL, mimeType: 'image/tiff'}]});
  assert.match(gif.message, /imagem 1: mimeType inválido: recebido "image\/tiff"; esperado image\//);
  const shape = refusal({text: 'a', images: ['x']});
  assert.match(shape.message, /imagem 1: formato inválido: recebido "x"; esperado \{type, data, mimeType\}/);
});
