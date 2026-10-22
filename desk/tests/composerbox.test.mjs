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
const along = (over = {}) => {
  const f = {study: true, course: '', title: '', xopp: '', refsOn: true, refs: [], ...over};
  return conList(core.goesTree(f.study, f.course, f.title, f.xopp, f.refsOn, list(f.refs))).map(viewTextOf).join('');
};

test('linha vazia diz que só a mensagem vai', () => {
  assert.equal(along(), 'Vai junto: só a mensagem');
});

test('matéria, questão, rascunho e referências, nessa ordem', () => {
  assert.equal(
    along({course: 'Cálculo I', title: 'Lista 3 q.2', xopp: 'rascunho.xopp', refs: ['Limites.pdf p. 4', 'Formulário.pdf p. 1']}),
    'Vai junto: Cálculo I · Lista 3 q.2 · rascunho.xopp · Limites.pdf p. 4, Formulário.pdf p. 1'
  );
});

test('contexto de estudo desligado tira matéria, questão e rascunho', () => {
  assert.equal(
    along({study: false, course: 'Cálculo I', title: 'Lista 3', xopp: 'a.xopp', refs: ['Limites.pdf p. 4']}),
    'Vai junto: Limites.pdf p. 4'
  );
});

test('nota do popover: desligadas, nenhum aberto e listadas (com e sem Conferir)', () => {
  const note = (refsOn, refs, capture) => ptText(core.refsNote(refsOn, list(refs), capture));
  assert.match(note(false, ['Limites.pdf p.4'], true), /^Referências desligadas: nenhum material/);
  assert.doesNotMatch(note(false, ['Limites.pdf p.4'], true), /Limites/);
  assert.equal(note(true, [], true), 'Referências ligadas, mas nenhum material está aberto.');
  const listed = note(true, ['Limites.pdf p.4', 'Formulário.pdf p.1'], true);
  assert.match(listed, /^Referências: Limites\.pdf p\.4, Formulário\.pdf p\.1\. Vai o caminho e a página/);
  assert.match(listed, /A captura do Conferir segue como imagem, à parte\.$/);
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
