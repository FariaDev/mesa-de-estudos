/* `patchTree` (#70): o diário do tutor re-renderiza a cada token do raciocínio,
   e trocar todos os nós reiniciava a animação do "pensando" e piscava o painel.
   O patch mantém os nós que continuam do mesmo tipo. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {installFakeTreeDocument} from './fake-tree-dom.mjs';

installFakeTreeDocument();
const {build, patchTree} = await import('../src/view-host.mjs');

const Nil = {$: 'Nil'};
const list = (...xs) => xs.reduceRight((tail, head) => ({$: 'Con', head, tail}), Nil);
const el = (tag, attrs = [], kids = []) => ({$: 'ViewEl', tag, attrs: list(...attrs), kids: list(...kids)});
const txt = (text) => ({$: 'ViewText', text});
const attr = (name, value) => ({$: 'ViewAttr', name, value});

const thinkingTree = (preview, {status = 'running'} = {}) => el('article', [attr('class', 'work'), attr('data-live', 'true')], [
  el('span', [attr('class', 'work-mark')]),
  el('div', [attr('key', 'pensar-1'), attr('class', 'work-step'), attr('data-status', status)], [
    el('span', [attr('class', 'step-label')], [txt('Pensando')]),
    el('p', [attr('class', 'step-preview')], [txt(preview)]),
  ]),
]);

test('um token novo muda o texto no lugar, sem trocar nenhum nó', () => {
  const live = build(thinkingTree('Para h=0,1'));
  const step = live.childNodes[1];
  const previewText = step.childNodes[1].childNodes[0];
  patchTree(live, build(thinkingTree('Para h=0,1, Q fica acima')));
  assert.equal(live.childNodes[1], step, 'o passo é o mesmo nó');
  assert.equal(step.childNodes[1].childNodes[0], previewText, 'o texto do raciocínio é o mesmo nó');
  assert.equal(previewText.nodeValue, 'Para h=0,1, Q fica acima');
});

test('atributo que mudou é trocado, e o que sumiu sai', () => {
  const live = build(thinkingTree('a'));
  live.setAttribute('data-velho', '1');
  patchTree(live, build(thinkingTree('a', {status: 'done'})));
  assert.equal(live.childNodes[1].getAttribute('data-status'), 'done');
  assert.equal(live.hasAttribute('data-velho'), false);
});

test('outro data-key ou outra tag troca o nó; filho a mais sai, a menos entra', () => {
  const live = build(el('div', [], [el('p', [attr('key', 'a')]), el('p', [attr('key', 'b')]), txt('fim')]));
  const first = live.childNodes[0];
  patchTree(live, build(el('div', [], [el('p', [attr('key', 'z')]), el('span')])));
  assert.notEqual(live.childNodes[0], first);
  assert.equal(live.childNodes[0].dataset.key, 'z');
  assert.equal(live.childNodes[1].nodeName, 'SPAN');
  assert.equal(live.childNodes.length, 2);
  patchTree(live, build(el('div', [], [el('p', [attr('key', 'z')]), el('span'), txt('novo')])));
  assert.equal(live.textContent, 'novo');
});

test('keep mantém os filhos do slot: a ∫ do "pensando" não é recriada', () => {
  const slotIcon = (node, name) => {
    const mark = node.childNodes[0];
    mark.dataset.slotIcon = name;
    mark.append(document.createElement(name === 'mascote-integral' ? 'span' : 'svg'));
    return node;
  };
  const sameSlot = (live, fresh) => !!fresh.dataset.slotIcon && live.dataset.slotIcon === fresh.dataset.slotIcon;
  const live = slotIcon(build(thinkingTree('a')), 'mascote-integral');
  const mascot = live.childNodes[0].childNodes[0];
  patchTree(live, slotIcon(build(thinkingTree('ab')), 'mascote-integral'), sameSlot);
  assert.equal(live.childNodes[0].childNodes[0], mascot, 'mesmo ícone: o desenho fica');
  patchTree(live, slotIcon(build(thinkingTree('ab')), 'search'), sameSlot);
  assert.notEqual(live.childNodes[0].childNodes[0], mascot, 'ícone novo: o slot troca');
  assert.equal(live.childNodes[0].dataset.slotIcon, 'search');
});

/* Regressão (ui-smoke "worklog"): o cabeçalho do diário só ganha o clique
   quando o turno acaba; mantido, o nó vivo ficava sem listener e não abria. */
test('nó que ganha um evento é trocado, para o clique valer', () => {
  const toggle = () => {};
  const head = (clickable) => el('article', [], [el('button', clickable ? [attr('class', 'work-head'), attr('on:click', 'toggle')] : [attr('class', 'work-head')])]);
  const live = build(head(false), {toggle});
  const before = live.childNodes[0];
  patchTree(live, build(head(true), {toggle}));
  assert.notEqual(live.childNodes[0], before, 'o botão novo entra');
  assert.equal(live.childNodes[0].listeners.get('click'), toggle);
  const kept = live.childNodes[0];
  patchTree(live, build(head(true), {toggle}));
  assert.equal(live.childNodes[0], kept, 'com os mesmos eventos, o nó fica');
});
