import test from 'node:test';
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
  for (let a = node.attrs; a && a.$ === 'Con'; a = a.tail) out.set('' + a.head.name, a.head.value);
  return out;
}

function textsOf(node) {
  return kidsOf(node).map((k) => (k.$ === 'ViewText' ? k.text : null));
}

const list = (...xs) => xs.reduceRight((tail, head) => ({$: 'Con', head, tail}), {$: 'Nil'});

function classOf(node) {
  return attrsOf(node).get('class') || '';
}

test('rodapé vazio fica hidden, sem tooltip', () => {
  const node = sv.footStatus('', '', '', '', '');
  assert.equal(node.tag, 'button');
  const attrs = attrsOf(node);
  assert.equal(attrs.get('id'), 'foot-status');
  assert.equal(attrs.get('type'), 'button');
  assert.equal(attrs.has('hidden'), true, 'sem itens o botão some');
  assert.equal(attrs.has('data-tip'), false);
  assert.equal(attrs.has('title'), false, 'tooltip não pode ser title');
  assert.equal(attrs.get('aria-label'), 'Status do modelo');
  assert.equal(kidsOf(node).length, 0);
});

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

test('medidor: hidden, classes warn/hot e barra em %', () => {
  const off = attrsOf(sv.ctxMeter(false, 42n));
  assert.equal(off.has('hidden'), true);
  assert.equal(off.get('data-no-tip'), '', 'o balão do medidor é o #ctx-tip do host');
  assert.equal(off.has('data-tip'), false);

  const on = sv.ctxMeter(true, 42n);
  const attrs = attrsOf(on);
  assert.equal(attrs.has('hidden'), false);
  assert.equal(attrs.get('class'), '');
  const [bar, em] = kidsOf(on);
  assert.equal(classOf(bar), 'bar');
  assert.equal(attrsOf(kidsOf(bar)[0]).get('style'), 'width:42%');
  assert.equal(kidsOf(em)[0].text, '42%');

  assert.equal(attrsOf(sv.ctxMeter(true, 70n)).get('class'), 'warn');
  assert.equal(attrsOf(sv.ctxMeter(true, 85n)).get('class'), 'hot');
  assert.equal(attrsOf(sv.ctxMeter(true, 30n)).get('class'), '');
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

test('modelo, sessão e balão', () => {
  assert.deepEqual(textsOf(sv.piLabel('Pi')), ['Pi']);
  assert.deepEqual(textsOf(sv.ctxTip('detalhe', true)), ['detalhe']);
  assert.equal(attrsOf(sv.ctxTip('detalhe', true)).has('hidden'), true);
  assert.equal(attrsOf(sv.ctxTip('detalhe', false)).has('hidden'), false);

  const select = sv.sessionSelect('b', true, list(
    {$: 'SessionChoice', label: 'A', path: 'a'},
    {$: 'SessionChoice', label: 'B', path: 'b'},
  ));
  assert.equal(select.tag, 'select');
  assert.equal(attrsOf(select).get('id'), 'session-select');
  assert.equal(attrsOf(select).has('disabled'), true);
  const options = kidsOf(select);
  assert.deepEqual(options.map((o) => textsOf(o)[0]), ['A', 'B']);
  assert.deepEqual(options.map((o) => attrsOf(o).get('value')), ['a', 'b']);
  assert.equal(attrsOf(options[0]).has('selected'), false);
  assert.equal(attrsOf(options[1]).get('selected'), '');
});
