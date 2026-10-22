// Imagens do tutor que saíram do main.cjs (#43 fase 2). O nativeImage é um
// fake com nome: devolve imagem vazia, então nada é encolhido.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {PLOT_PNG} from './helpers.mjs';

const require = createRequire(import.meta.url);
const {createPromptImages} = require('../prompt-images.cjs');

const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-images-'));
after(() => fs.rmSync(runtime, {recursive: true, force: true}));
const learningRoot = path.join(runtime, 'learning');
fs.mkdirSync(learningRoot, {recursive: true});
const emptyNativeImage = {createFromBuffer: () => ({isEmpty: () => true})};
const images = createPromptImages({live: {}, runtime, deskDir: path.resolve(import.meta.dirname, '..'), learningRoot, nativeImage: emptyNativeImage});

test('promptImages manda PNG válido como bloco base64 e recusa tipo que não é imagem', () => {
  const [block] = images.promptImages([`data:image/png;base64,${PLOT_PNG}`]);
  assert.deepEqual(block, {type: 'image', data: PLOT_PNG, mimeType: 'image/png'});
  assert.throws(() => images.promptImages(['data:text/plain;base64,aGk=']));
  assert.deepEqual(images.promptImages([]), []);
});

test('readableImage só lê dentro de learning/ e com extensão de imagem', () => {
  const inside = path.join(learningRoot, 'fig.png');
  fs.writeFileSync(inside, Buffer.from(PLOT_PNG, 'base64'));
  fs.writeFileSync(path.join(runtime, 'fora.png'), 'x');
  assert.equal(images.readableImage(inside)?.mime, 'image/png');
  assert.equal(images.readableImage(path.join(runtime, 'fora.png')), null);
});

test('trimMessageImages mantém as últimas N mensagens com imagem e tira as antigas', () => {
  const withImage = () => ({content: [{type: 'text', text: 'a'}, {type: 'image'}]});
  const list = [withImage(), withImage(), withImage()];
  images.trimMessageImages(list, 2);
  assert.deepEqual(list.map((m) => m.content.length), [1, 2, 2]);
});
