import test from 'node:test';
import assert from 'node:assert/strict';
import core from '../src/generated/attachview.core.js';

/* Uso da Mesa: só imagens anexadas, com o `alt`/rótulo próprios e o handler
   `RemoveAttachment`; o núcleo é o mesmo da Conversa. */

const Nil = {$: 'Nil'};
const list = (...xs) => xs.reduceRight((tail, head) => ({$: 'Con', head, tail}), Nil);
const kids = (node) => {
  const out = [];
  for (let x = node?.kids; x?.$ === 'Con'; x = x.tail) out.push(x.head);
  return out;
};
const nodes = (xs) => {
  const out = [];
  for (let x = xs; x?.$ === 'Con'; x = x.tail) out.push(x.head);
  return out;
};
const attrOf = (node, name) => {
  for (let x = node?.attrs; x?.$ === 'Con'; x = x.tail) if (x.head.name === name) return x.head.value;
  return undefined;
};
const innerText = (node) => kids(node)[0]?.text ?? '';

const attachment = (over = {}) => ({
  $: 'AttachImage', key: 'img-0', dataUrl: 'data:image/png;base64,AA', alt: 'Anexo: plot.png',
  removeLabel: 'Remover plot.png', removeTitle: '', handler: 'RemoveAttachment', lazy: true, ...over,
});

test('anexo da Mesa: img lazy, alt "Anexo:" e × com aria-label', () => {
  const node = core.imageItem(attachment());
  assert.equal(node.tag, 'div');
  assert.equal(attrOf(node, 'class'), 'attachment');
  assert.equal(attrOf(node, 'key'), 'img-0');
  const [img, remove] = kids(node);
  assert.equal(img.tag, 'img');
  assert.equal(attrOf(img, 'src'), 'data:image/png;base64,AA');
  assert.equal(attrOf(img, 'alt'), 'Anexo: plot.png');
  assert.equal(attrOf(img, 'loading'), 'lazy');
  assert.equal(attrOf(img, 'decoding'), 'async');
  assert.equal(attrOf(remove, 'type'), 'button');
  assert.equal(attrOf(remove, 'class'), 'attachment-remove');
  assert.equal(attrOf(remove, 'aria-label'), 'Remover plot.png');
  assert.equal(attrOf(remove, 'on:click'), 'RemoveAttachment');
  assert.equal(innerText(remove), '×');
});

test('sem nome: alt "Imagem anexada" e rótulo "Remover imagem"', () => {
  const [img, remove] = kids(core.imageItem(attachment({alt: 'Imagem anexada', removeLabel: 'Remover imagem'})));
  assert.equal(attrOf(img, 'alt'), 'Imagem anexada');
  assert.equal(attrOf(remove, 'aria-label'), 'Remover imagem');
});

test('lista de anexos preserva ordem e keys', () => {
  const node = core.imageItemViews(list(attachment(), attachment({key: 'img-1'})));
  assert.deepEqual(nodes(node).map((el) => attrOf(el, 'key')), ['img-0', 'img-1']);
  assert.equal(nodes(core.imageItemViews(Nil)).length, 0);
});
