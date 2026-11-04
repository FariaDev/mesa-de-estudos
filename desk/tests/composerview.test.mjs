import test from 'node:test';
import assert from 'node:assert/strict';
import {ptText} from './pt-text.mjs';

/* Contrato do artefato `composerview.core.js` (core/composerview.bend) para o
   "Enviar agora" de um item JÁ na fila: a decisão `canSteerQueued` e o botão
   que só existe quando ela é verdadeira. A árvore é lida no formato Con/Nil,
   sem DOM (o aplicador é o `view-host.mjs`). Leis em `core/laws/composerview`. */

const core = (await import('../src/generated/composerview.core.js')).default;
const nodes = (cell) => {
  const out = [];
  for (let current = cell; current && current.$ === 'Con'; current = current.tail) out.push(current.head);
  return out;
};
const attrsOf = (node) => {
  const out = new Map();
  for (const attr of nodes(node.attrs)) out.set(attr.name, attr.value);
  return out;
};
const textOf = (node) => (node.$ === 'ViewText' ? ptText(node.text) : nodes(node.kids).map(textOf).join(''));
const row = (over = {}) => ({$: 'QueueRow', id: 'fila-1', text: 'oi', sending: false, enabled: true, editing: false, steerable: true, ...over});
const list = (items) => items.reduceRight((tail, head) => ({$: 'Con', head, tail}), {$: 'Nil'});

test('item da fila só vira steer ocupado, com motor que oferece, fora do envio e da edição', () => {
  assert.equal(core.canSteerQueued(true, true, false, false), true);
  assert.equal(core.canSteerQueued(false, true, false, false), false, 'tutor livre: o flush normal cuida');
  assert.equal(core.canSteerQueued(true, false, false, false), false, 'motor sem steer');
  assert.equal(core.canSteerQueued(true, true, true, false), false, 'item saindo');
  assert.equal(core.canSteerQueued(true, true, false, true), false, 'item em edição');
});

test('a linha traz um botão real "Enviar agora" com dica e aria-label', () => {
  const kids = nodes(core.queueItemView(row()).kids);
  assert.equal(kids.length, 3, 'texto + Enviar agora + ×');
  const steer = kids[1];
  const attrs = attrsOf(steer);
  assert.equal(steer.tag, 'button');
  assert.equal(attrs.get('type'), 'button');
  assert.equal(attrs.get('class'), 'queue-steer-now');
  assert.equal(attrs.get('on:click'), 'steerNow');
  assert.equal(ptText(attrs.get('title')), 'Interromper a resposta e enviar agora (⌘⏎)');
  assert.equal(attrs.get('aria-label'), attrs.get('title'));
  assert.equal(textOf(steer), 'Enviar agora');
  assert.equal(ptText(attrsOf(kids[2]).get('title')), 'Remover da fila', 'o × continua por último');
});

test('sem o fato, o botão não existe (tutor livre, motor sem steer ou item em edição)', () => {
  const plain = nodes(core.queueItemView(row({steerable: false})).kids);
  assert.equal(plain.length, 2, 'só texto + ×');
  assert.equal(ptText(attrsOf(plain[1]).get('title')), 'Remover da fila');
  const editing = nodes(core.queueItemView(row({editing: true})).kids);
  assert.equal(editing.length, 2, 'em edição, input + ×');
  assert.equal(editing[0].tag, 'input');
  assert.equal(editing.some((node) => attrsOf(node).get('class') === 'queue-steer-now'), false);
});

test('a faixa tem cabeçalho com o rótulo e as ações, e as mensagens vêm abaixo', () => {
  const strip = core.queueStripView(false, 'Na fila · 2', list([row(), row({id: 'fila-2', text: 'dois'})]), true, true);
  const [head, ...items] = nodes(strip.kids);
  assert.equal(head.tag, 'div');
  assert.equal(attrsOf(head).get('class'), 'queue-head', 'o cabeçalho agrupa rótulo e ações');
  const headKids = nodes(head.kids);
  assert.equal(attrsOf(headKids[0]).get('class'), 'queue-label');
  assert.equal(textOf(headKids[0]), 'Na fila · 2');
  assert.equal(attrsOf(headKids[1]).get('class'), 'queue-actions', 'as ações da fila ficam no cabeçalho');
  assert.equal(items.length, 2, 'uma linha por mensagem');
  assert.equal(attrsOf(items[0]).get('class'), 'queue-item');
  assert.equal(attrsOf(items[0]).get('data-id'), 'fila-1');
});
