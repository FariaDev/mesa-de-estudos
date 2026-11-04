import test from 'node:test';
import assert from 'node:assert/strict';
import {ptText} from './pt-text.mjs';

/* Contrato do artefato `composerbox.core.js` (gerado de core/composerbox.bend,
   ticket #15): a linha "Vai junto: …" e o encaixe Enviar/Parar da caixa de
   mensagem única. As leis do módulo ficam em core/laws/composerbox.bend; aqui
   se confere o que o app recebe — inclusive com texto de verdade (acento,
   caminho com ponto) e a lista no formato que o host monta. */

const core = (await import('../src/generated/composerbox.core.js')).default;

const list = items => items.reduceRight((tail, head) => ({$: 'Con', head, tail}), {$: 'Nil'});
function attrsOf(node) {
  const out = new Map();
  for (let a = node.attrs; a && a.$ === 'Con'; a = a.tail) out.set('' + a.head.name, a.head.value);
  return out;
}
const conList = items => { const out = []; for (let c = items; c && c.$ === 'Con'; c = c.tail) out.push(c.head); return out; };
const viewTextOf = node => (node.$ === 'ViewText' ? ptText(node.text) : conList(node.kids).map(viewTextOf).join(''));
const asRef = text => {
  const cut = text.lastIndexOf(' ');
  return {$: 'GoesRef', name: text.slice(0, cut), page: text.slice(cut + 1)};
};
const goesNodes = (over = {}) => {
  const f = {study: true, course: '', title: '', xopp: '', refsOn: true, refs: [], ...over};
  return conList(core.goesTree(f.study, f.course, f.title, f.xopp, f.refsOn, list(f.refs.map(asRef))));
};
const along = (over = {}) => goesNodes(over).map(viewTextOf).join('');
const classOf = node => attrsOf(node).get('class');
const labelOf = node => attrsOf(node).get('aria-label');

test('linha vazia diz que só a mensagem vai', () => {
  assert.equal(along(), 'Contexto: só a mensagem');
});

test('matéria, questão, rascunho e referências, em pílulas nessa ordem', () => {
  const nodes = goesNodes({course: 'Cálculo I', title: 'Lista 3 q.2', xopp: 'rascunho.xopp', refs: ['Limites.pdf p.4', 'Formulário.pdf p.1']});
  assert.deepEqual(nodes.map(classOf), [
    'goes-lead',
    'goes-pill goes-course',
    'goes-pill goes-rest',
    'goes-pill goes-rest',
    'goes-pill goes-rest',
    'goes-pill goes-rest',
  ]);
  assert.deepEqual(nodes.slice(2).map(labelOf), ['Lista 3 q.2', 'rascunho.xopp', 'Limites.pdf p.4', 'Formulário.pdf p.1']);
  assert.equal(labelOf(nodes[1]), 'Cálculo I', 'a matéria vira pílula com o nome inteiro no nome acessível');
  assert.equal(attrsOf(nodes[1]).get('title'), 'Cálculo I', 'e na dica');
});

test('contexto de estudo desligado tira matéria, questão e rascunho', () => {
  const nodes = goesNodes({study: false, course: 'Cálculo I', title: 'Lista 3', xopp: 'a.xopp', refs: ['Limites.pdf p.4']});
  assert.deepEqual(nodes.map(classOf), ['goes-lead', 'goes-pill goes-rest']);
  assert.equal(labelOf(nodes[1]), 'Limites.pdf p.4');
});

test('a pílula de PDF separa nome e página: só o nome corta, a página fica', () => {
  const nodes = goesNodes({course: 'Cálculo I', refs: ['Limites.pdf p.4']});
  const ref = nodes.at(-1);
  const kids = conList(ref.kids);
  assert.deepEqual(kids.map(classOf), ['goes-pill-name', 'goes-pill-page']);
  assert.equal(viewTextOf(kids[0]), 'Limites.pdf');
  assert.equal(viewTextOf(kids[1]), ' p.4');
  assert.equal(labelOf(ref), 'Limites.pdf p.4');
  assert.equal(attrsOf(ref).get('title'), 'Limites.pdf p.4');
});

test('nota do popover: desligadas, nenhum aberto e listadas (com e sem Conferir)', () => {
  const note = (refsOn, refs, capture) => ptText(core.refsNote(refsOn, list(refs.map(asRef)), capture));
  assert.match(note(false, ['Limites.pdf p.4'], true), /^Referências desligadas: nada dos PDFs/);
  assert.doesNotMatch(note(false, ['Limites.pdf p.4'], true), /Limites/);
  assert.equal(note(true, [], true), 'Nenhum material aberto para incluir.');
  const listed = note(true, ['Limites.pdf p.4', 'Formulário.pdf p.1'], true);
  assert.match(listed, /^Caminho e página; o PDF não vai\./);
  assert.match(listed, /A captura do Xournal\+\+ vai como imagem\.$/);
  assert.doesNotMatch(listed, /Limites/);
  assert.doesNotMatch(note(true, ['Limites.pdf p.4'], false), /captura/);
});

test('Enviar e Parar nunca aparecem juntos', () => {
  for (const busy of [false, true]) {
    const send = attrsOf(core.sendButton(busy)), stop = attrsOf(core.stopButton(busy));
    assert.equal(send.get('id'), 'send');
    assert.equal(stop.get('id'), 'stop');
    assert.notEqual(send.has('hidden'), stop.has('hidden'), `busy=${busy}: exatamente um visível`);
    assert.equal(send.has('hidden'), busy);
  }
});
