import test from 'node:test';
import {ptText} from './pt-text.mjs';
import assert from 'node:assert/strict';

/* Contrato do artefato `statusview.core.js` (gerado de core/statusview.bend).
   A árvore é conferida aqui sem DOM: o mesmo formato `Con/Nil` que o
   view-host aplica. As leis do módulo ficam em core/proofs/statusview.bend;
   este teste cobre o que o app recebe pronto do artefato. */

const sv = (await import('../src/generated/statusview.core.js')).default;

function kidsOf(node) {
  const out = [];
  for (let n = node.kids; n && n.$ === 'Con'; n = n.tail) out.push(n.head);
  return out;
}

function attrsOf(node) {
  const out = new Map();
  for (let a = node.attrs; a && a.$ === 'Con'; a = a.tail) out.set('' + a.head.name, ptText(a.head.value));
  return out;
}

function classOf(node) {
  return attrsOf(node).get('class') || '';
}

test('rodapé monta modelo · esforço · contexto com separadores', () => {
  const node = sv.footStatus('Pi de teste · test', 'Desligado', '42%', 'Contexto do modelo: 42%', '');
  const attrs = attrsOf(node);
  assert.equal(attrs.has('hidden'), false);
  assert.equal(attrs.get('data-tip'), 'Pi de teste · test · Desligado · Contexto do modelo: 42%');
  assert.equal(attrs.has('title'), false);
  assert.equal(attrs.get('aria-label'), 'Pi de teste · test · Desligado · Contexto do modelo: 42%');
  assert.equal(attrs.get('on:click'), 'toggleMeterTip');
  const kids = kidsOf(node);
  assert.deepEqual(kids.map((k) => k.tag), ['span', 'span', 'span', 'span', 'span']);
  assert.deepEqual(kids.map((k) => classOf(k)), ['fs-item fs-model', 'fs-sep', 'fs-item fs-eff', 'fs-sep', 'fs-item fs-ctx']);
  assert.deepEqual(kids.map((k) => (kidsOf(k)[0] || {}).text), ['Pi de teste · test', '·', 'Desligado', '·', '42%']);
  const sep = attrsOf(kids[1]);
  assert.equal(sep.get('aria-hidden'), 'true');
});

test('rodapé sem detalhe usa o próprio % no tooltip', () => {
  assert.equal(attrsOf(sv.footStatus('', '', '7%', '', '')).get('data-tip'), '7%');
  assert.equal(attrsOf(sv.footStatus('', '', '', 'detalhe', '')).has('data-tip'), false, 'sem contexto o tooltip não vaza');
});

test('ponto de conexão: classe, tooltip e aria', () => {
  const online = attrsOf(sv.statusDot({$: 'ConnOnline'}, 'Pi conectado'));
  assert.equal(online.get('class'), 'online');
  assert.equal(online.get('role'), 'img');
  assert.equal(online.get('data-tip'), 'Pi conectado');
  assert.equal(attrsOf(sv.statusDot({$: 'ConnConnecting'}, 'Conectando')).get('class'), 'connecting');
  assert.equal(attrsOf(sv.statusDot({$: 'ConnError'}, 'Falha')).get('class'), 'error');
  assert.equal(attrsOf(sv.statusDot({$: 'ConnOff'}, '')).get('aria-label'), 'Pi desconectado');
});

test('compactação automática: hidden sem conexão e aria-pressed', () => {
  const hidden = attrsOf(sv.autoCompact(false, true, 'Compactação automática'));
  assert.equal(hidden.has('hidden'), true);
  const on = attrsOf(sv.autoCompact(true, true, 'Compactação automática'));
  assert.equal(on.has('hidden'), false);
  assert.equal(on.get('aria-pressed'), 'true');
  assert.equal(on.get('class'), 'on');
  assert.equal(on.get('data-tip'), 'Compactação automática');
  const off = attrsOf(sv.autoCompact(true, false, 'Compactação automática'));
  assert.equal(off.get('aria-pressed'), 'false');
  assert.equal(off.get('class'), '');
});
