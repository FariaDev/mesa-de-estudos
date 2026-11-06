import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {boundMessages} = require('../src/agents/conversations.cjs');

const MB = 1024 * 1024;
const withImage = (text, size) => ({role: 'user', content: [{type: 'text', text}, {type: 'image', data: 'A'.repeat(size), mimeType: 'image/png'}]});
const imagesOf = (message) => message.content.filter((part) => part.type === 'image').length;

test('#117: acima do teto a mensagem antiga perde a imagem e fica com o texto', () => {
  const list = Array.from({length: 6}, (_, i) => withImage(`pergunta ${i}`, 3 * MB));
  const bounded = boundMessages(list);
  assert.deepEqual(bounded.map((message) => message.content[0].text), list.map((message) => message.content[0].text));
  assert.deepEqual(bounded.map(imagesOf), [0, 0, 0, 1, 1, 1]);
  assert.equal(imagesOf(list[0]), 1, 'a entrada não é alterada');
});

test('só texto acima do teto ainda corta as mensagens mais antigas', () => {
  const list = Array.from({length: 5}, (_, i) => ({role: 'user', content: [{type: 'text', text: `${i}`.repeat(3 * MB)}]}));
  assert.deepEqual(boundMessages(list), list.slice(-3));
});

test('dentro do teto nada muda', () => {
  const list = [withImage('a', 1024), withImage('b', 1024)];
  assert.deepEqual(boundMessages(list), list);
});
