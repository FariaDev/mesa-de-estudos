import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import core from '../src/generated/calcview.core.js';

// Árvore do Bend (listas Con/Nil) sem DOM: o aplicador é o view-host (testado
// em view-host.test.mjs) e o adaptador é exercitado pelo ui-smoke. Aqui o
// contrato é a forma que o smoke da UI e o `index.html` exercitam: ids,
// classes, aria, textos, ordem e as decisões do núcleo (rótulo do histórico,
// `selected` do ângulo, `hidden`/`collapsed`, `open` da guia).

const Nil = {$: 'Nil'};
const con = (head, tail) => ({$: 'Con', head, tail});
const list = (...xs) => xs.reduceRight((tail, head) => con(head, tail), Nil);
const nodes = (l) => {
  const out = [];
  for (let c = l; c && c.$ === 'Con'; c = c.tail) out.push(c.head);
  return out;
};
const entry = (expr, result) => ({$: 'CalcEntry', expr, result});
const attrs = (node) => {
  const out = {};
  for (let a = node.attrs; a && a.$ === 'Con'; a = a.tail) out[a.head.name] = a.head.value;
  return out;
};
const texts = (node) => nodes(node.kids).map((kid) => kid.text ?? '');
const textContent = (node) => (node.$ === 'ViewText' ? node.text : nodes(node.kids).map(textContent).join(''));
const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const shell = (over = {}) => core.calculator(
  over.visible ?? true,
  over.collapsed ?? false,
  over.angle ?? 'rad',
  over.expression ?? '',
  over.result ?? '0',
  over.history ?? Nil,
  over.guideOpen ?? false
);

test('casco: section#calculator, visível/oculta e colapsada', () => {
  const open = shell();
  assert.equal(open.tag, 'section');
  assert.deepEqual(attrs(open), {id: 'calculator', class: ''});
  assert.equal(has(attrs(open), 'hidden'), false);
  const kids = nodes(open.kids);
  assert.deepEqual(kids.map((n) => n.tag), ['button', 'div']);
  assert.deepEqual(attrs(kids[0]), {'id': 'calc-toggle', 'aria-expanded': 'true', 'on:click': 'ToggleCalc'});
  assert.deepEqual(attrs(kids[1]), {id: 'calc-body'});

  const collapsed = shell({collapsed: true});
  assert.deepEqual(attrs(collapsed), {id: 'calculator', class: 'collapsed'});
  assert.equal(attrs(nodes(collapsed.kids)[1]).hidden, '', 'o corpo some no colapso');
  assert.equal(attrs(nodes(collapsed.kids)[0])['aria-expanded'], 'false');

  const hidden = shell({visible: false});
  assert.equal(attrs(hidden).hidden, '', 'a flag do desk esconde a seção');
  assert.equal(attrs(hidden).class, '', 'class vazia fica para o aplicador pular');
});

test('toggle: título, aria, clique e ângulo (select #angle)', () => {
  const toggle = core.calcToggle(false, 'rad');
  assert.equal(toggle.tag, 'button');
  assert.deepEqual(attrs(toggle), {id: 'calc-toggle', 'aria-expanded': 'true', 'on:click': 'ToggleCalc'});
  const spans = nodes(toggle.kids);
  assert.deepEqual(spans.map((n) => n.tag), ['span', 'span']);
  assert.deepEqual(texts(spans[0]), ['Calculadora']);
  assert.deepEqual(attrs(spans[1]), {class: 'calc-mode'});
  const select = nodes(spans[1].kids)[0];
  assert.equal(select.tag, 'select');
  assert.deepEqual(attrs(select), {id: 'angle', 'aria-label': 'Unidade angular', 'on:change': 'SetAngle'});
  const options = nodes(select.kids);
  assert.deepEqual(options.map((n) => n.tag), ['option', 'option']);
  assert.deepEqual(attrs(options[0]), {value: 'rad', selected: ''});
  assert.deepEqual(texts(options[0]), ['RAD']);
  assert.deepEqual(attrs(options[1]), {value: 'deg'});
  assert.deepEqual(texts(options[1]), ['GRAUS']);
  assert.deepEqual(attrs(core.calcToggle(true, 'rad')), {id: 'calc-toggle', 'aria-expanded': 'false', 'on:click': 'ToggleCalc'});
});

test('ângulo em graus marca a opção GRAUS', () => {
  const graus = nodes(core.angleSelect('deg').kids);
  assert.deepEqual(attrs(graus[0]), {value: 'rad'});
  assert.deepEqual(attrs(graus[1]), {value: 'deg', selected: ''});
  const rad = nodes(core.angleSelect('rad').kids);
  assert.deepEqual(attrs(rad[0]), {value: 'rad', selected: ''});
  assert.deepEqual(attrs(rad[1]), {value: 'deg'});
});

test('formulário: #calc-form[on:submit=Eval], #expression e o botão "="', () => {
  const form = core.calcForm('2+3');
  assert.deepEqual(attrs(form), {id: 'calc-form', 'on:submit': 'Eval'});
  const [input, button] = nodes(form.kids);
  assert.equal(input.tag, 'input');
  assert.deepEqual(attrs(input), {
    id: 'expression',
    autocomplete: 'off',
    placeholder: 'sqrt(16) + sin(pi/2)',
    'aria-label': 'Expressão matemática',
    value: '2+3',
  });
  assert.equal(input.kids.$, 'Nil');
  assert.equal(button.tag, 'button');
  assert.deepEqual(attrs(button), {type: 'submit', 'aria-label': 'Calcular'});
  assert.deepEqual(texts(button), ['=']);
  const empty = core.calcForm('');
  assert.equal(has(attrs(nodes(empty.kids)[0]), 'value'), false, 'expressão vazia não vira atributo');
});

test('resultado e histórico: rótulo pronto, data-expr e ordem', () => {
  const result = core.calcResult('5');
  assert.equal(result.tag, 'output');
  assert.deepEqual(attrs(result), {id: 'result'});
  assert.deepEqual(texts(result), ['5']);
  assert.deepEqual(texts(core.calcResult('—')), ['—']);

  assert.equal(core.histLabel('sqrt(16)+sin(pi/2)', '5'), 'sqrt(16)+sin(pi/2) = 5');
  const button = core.histButton(entry('2+3', '5'));
  assert.equal(button.tag, 'button');
  assert.deepEqual(attrs(button), {'data-expr': '2+3', 'on:click': 'Reuse'});
  assert.deepEqual(texts(button), ['2+3 = 5']);

  assert.deepEqual(nodes(core.calcHistory(Nil).kids), [], 'sem histórico o contêiner fica vazio');
  const history = nodes(core.calcHistory(list(entry('2+3', '5'), entry('1+1', '2'))).kids);
  assert.deepEqual(history.map((n) => texts(n)[0]), ['2+3 = 5', '1+1 = 2'], 'mais novo primeiro, na ordem do host');
  assert.deepEqual(history.map((n) => attrs(n)['data-expr']), ['2+3', '1+1']);
});

test('corpo: cinco partes e o hidden do colapso', () => {
  const body = core.calcBody(false, '', '0', Nil, false);
  assert.deepEqual(attrs(body), {id: 'calc-body'});
  assert.deepEqual(nodes(body.kids).map((n) => n.tag), ['form', 'output', 'div', 'div', 'details']);
  assert.equal(attrs(core.calcBody(true, '', '0', Nil, false)).hidden, '');
});

test('ajuda e guia: textos idênticos ao index.html', () => {
  const html = fs.readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
  const help = core.calcHelp();
  assert.deepEqual(attrs(help), {class: 'calc-help'});
  assert.ok(html.includes(`<div class="calc-help">${texts(help)[0]}</div>`), 'a linha de ajuda bate com o index.html');

  const guide = core.calcGuide(false);
  assert.deepEqual(attrs(guide), {id: 'calc-guide'});
  const guideKids = nodes(guide.kids);
  assert.deepEqual(guideKids.map((n) => n.tag), ['summary', 'p', 'p', 'p']);
  assert.deepEqual(texts(guideKids[0]), ['Como usar']);
  assert.ok(html.includes('<summary>Como usar</summary>'));

  const sourceParagraphs = [...html.matchAll(/<p>([^]*?)<\/p>/g)].map((match) => match[1].replace(/<[^>]+>/g, ''));
  for (const paragraph of guideKids.slice(1)) {
    const plain = textContent(paragraph);
    assert.ok(sourceParagraphs.includes(plain), `parágrafo do Bend bate com o index.html: ${plain.slice(0, 48)}…`);
  }
  assert.deepEqual(attrs(core.calcGuide(true)), {id: 'calc-guide', open: ''}, 'guia aberta mantém o open');
});

test('guia: cada <code> tem o texto do index.html', () => {
  const codes = [];
  const walk = (node) => {
    if (node.$ === 'ViewText') return;
    if (node.tag === 'code') codes.push(textContent(node));
    for (const kid of nodes(node.kids)) walk(kid);
  };
  walk(core.calcGuide(false));
  assert.deepEqual(codes, ['(2+3)*4', '2*pi', '2^3', 'sqrt(16)', 'sin(pi/2)', 'sin(90)', 'ln', 'log']);
});
