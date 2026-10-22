import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import core from '../src/generated/calcview.core.js';
import {calculate} from '../calculator.mjs';
import {ptText} from './pt-text.mjs';

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
  for (let a = node.attrs; a && a.$ === 'Con'; a = a.tail) out[a.head.name] = ptText(a.head.value);
  return out;
};
const texts = (node) => nodes(node.kids).map((kid) => ptText(kid.text ?? ''));
const textContent = (node) => (node.$ === 'ViewText' ? ptText(node.text) : nodes(node.kids).map(textContent).join(''));
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

test('casco: section#calculator com a barra de uma linha e o corpo expansível', () => {
  const open = shell();
  assert.equal(open.tag, 'section');
  assert.deepEqual(attrs(open), {id: 'calculator', class: ''});
  assert.equal(has(attrs(open), 'hidden'), false);
  const kids = nodes(open.kids);
  assert.deepEqual(kids.map((n) => n.tag), ['div', 'div']);
  assert.deepEqual(attrs(kids[0]), {'id': 'calc-bar', 'role': 'group', 'aria-label': 'Calculadora'});
  assert.deepEqual(attrs(kids[1]), {id: 'calc-body'});

  const collapsed = shell({collapsed: true});
  assert.deepEqual(attrs(collapsed), {id: 'calculator', class: 'collapsed'});
  assert.equal(attrs(nodes(collapsed.kids)[1]).hidden, '', 'o corpo some no colapso');
  assert.equal(has(attrs(nodes(open.kids)[1]), 'hidden'), false, 'expandido, o corpo aparece');

  const hidden = shell({visible: false});
  assert.equal(attrs(hidden).hidden, '', 'a flag do desk esconde a seção');
  assert.equal(attrs(hidden).class, '', 'class vazia fica para o aplicador pular');
});

test('barra: ícone, formulário, resultado, unidade e o controle de expandir, nessa ordem', () => {
  const bar = core.calcBar(true, 'rad', '2+3', '5');
  assert.equal(bar.tag, 'div');
  const kids = nodes(bar.kids);
  assert.deepEqual(kids.map((n) => attrs(n).id || attrs(n).class), ['calc-icon', 'calc-form', 'result', 'calc-unit', 'calc-toggle']);
  assert.deepEqual(attrs(kids[0]), {'class': 'calc-icon', 'aria-hidden': 'true'});
  assert.equal(attrs(nodes(kids[1].kids)[0]).value, '2+3', 'a expressão digitada vai ao campo');
  assert.deepEqual(texts(kids[2]), ['5']);
});

test('unidade: o ângulo vigente aparece como texto na linha, sem ser um controle', () => {
  assert.equal(core.unitLabel('rad'), 'RAD');
  assert.equal(ptText(core.unitLabel('deg')), 'GRAUS');
  const unit = core.calcUnit('deg');
  assert.equal(unit.tag, 'span');
  assert.deepEqual(attrs(unit), {class: 'calc-unit'});
  assert.deepEqual(texts(unit), ['GRAUS']);
});

test('controle de expandir: nome acessível, aria-expanded e clique', () => {
  const recolhida = core.calcToggle(true);
  assert.equal(recolhida.tag, 'button');
  assert.deepEqual(attrs(recolhida), {
    'id': 'calc-toggle',
    'type': 'button',
    'class': 'icon-btn',
    'aria-expanded': 'false',
    'aria-controls': 'calc-body',
    'aria-label': 'Expandir calculadora',
    'title': 'Expandir calculadora',
    'on:click': 'ToggleCalc',
  });
  assert.equal(recolhida.kids.$, 'Nil', 'o ícone é asset do host');
  const aberta = core.calcToggle(false);
  assert.equal(attrs(aberta)['aria-expanded'], 'true');
  assert.equal(attrs(aberta)['aria-label'], 'Recolher calculadora');
  assert.equal(attrs(aberta).title, 'Recolher calculadora');
});

test('ângulo: grupo segmentado com rótulo e dica, dentro do painel expandido', () => {
  const row = core.angleRow('deg');
  assert.deepEqual(attrs(row), {class: 'calc-angle'});
  const [label, group, hint] = nodes(row.kids);
  assert.deepEqual(texts(label), ['Ângulo']);
  assert.equal(group.tag, 'div');
  assert.deepEqual(attrs(group), {id: 'angle', role: 'group', class: 'calc-seg', 'aria-label': 'Unidade angular'});
  const buttons = nodes(group.kids);
  assert.deepEqual(buttons.map((n) => n.tag), ['button', 'button']);
  assert.deepEqual(attrs(buttons[0]), {type: 'button', key: 'angle-rad', 'data-angle': 'rad', 'aria-pressed': 'false', 'on:click': 'SetAngle'});
  assert.deepEqual(texts(buttons[0]), ['RAD']);
  assert.deepEqual(attrs(buttons[1]), {type: 'button', key: 'angle-deg', 'data-angle': 'deg', 'aria-pressed': 'true', 'on:click': 'SetAngle'});
  assert.deepEqual(texts(buttons[1]), ['GRAUS']);
  assert.deepEqual(texts(hint), ['sin(90) dá 1']);
});

test('ângulo: só o vigente fica pressionado e a dica acompanha a unidade', () => {
  const pressed = (angle) => nodes(core.angleGroup(angle).kids).map((n) => attrs(n)['aria-pressed']);
  assert.deepEqual(pressed('deg'), ['false', 'true']);
  assert.deepEqual(pressed('rad'), ['true', 'false']);
  assert.deepEqual(pressed('grad'), ['false', 'false'], 'valor desconhecido não marca nenhum');
  assert.deepEqual(texts(core.angleHint('rad')), ['sin(pi/2) dá 1']);
  assert.deepEqual(texts(core.angleHint('deg')), ['sin(90) dá 1']);
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
  assert.deepEqual(attrs(button), {type: 'submit', class: 'icon-btn', 'aria-label': 'Calcular'});
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
  assert.deepEqual(attrs(button), {
    'type': 'button',
    'data-expr': '2+3',
    'title': '2+3',
    'aria-label': '2+3 = 5',
    'on:click': 'Reuse',
  });
  const [expr, res] = nodes(button.kids);
  assert.deepEqual(attrs(expr), {class: 'calc-hist-expr'});
  assert.deepEqual(texts(expr), ['2+3']);
  assert.deepEqual(attrs(res), {class: 'calc-hist-res'});
  assert.deepEqual(texts(res), ['= 5']);

  assert.deepEqual(nodes(core.calcHistory(Nil).kids), [], 'sem histórico o contêiner fica vazio');
  const history = nodes(core.calcHistory(list(entry('2+3', '5'), entry('1+1', '2'))).kids);
  assert.deepEqual(history.map((n) => attrs(n)['aria-label']), ['2+3 = 5', '1+1 = 2'], 'mais novo primeiro, na ordem do host');
  assert.deepEqual(history.map((n) => attrs(n)['data-expr']), ['2+3', '1+1']);
});

test('histórico: título, Limpar e a frase do vazio', () => {
  const cheio = core.historyBlock(list(entry('2+3', '5')));
  assert.deepEqual(attrs(cheio), {id: 'calc-hist'});
  const [head, lista] = nodes(cheio.kids);
  assert.deepEqual(attrs(head), {class: 'calc-hist-head'});
  const [title, clear] = nodes(head.kids);
  assert.equal(title.tag, 'h3');
  assert.deepEqual(texts(title), ['Histórico']);
  assert.deepEqual(attrs(clear), {'id': 'calc-clear', 'type': 'button', 'on:click': 'ClearHistory'});
  assert.deepEqual(texts(clear), ['Limpar']);
  assert.equal(attrs(lista).id, 'calc-history');

  const vazio = nodes(core.historyBlock(Nil).kids);
  assert.deepEqual(vazio.map((n) => attrs(n).class || attrs(n).id), ['calc-hist-head', 'calc-hist-empty', 'calc-history']);
  assert.equal(attrs(nodes(vazio[0].kids)[1]).disabled, '', 'sem contas, Limpar fica desligado');
  assert.equal(has(attrs(clear), 'disabled'), false, 'com contas, Limpar fica ligado');
});

test('corpo: ângulo, histórico e guia, e o hidden do colapso', () => {
  const body = core.calcBody(false, 'rad', Nil, false);
  assert.deepEqual(attrs(body), {id: 'calc-body'});
  assert.deepEqual(nodes(body.kids).map((n) => n.tag), ['div', 'div', 'details']);
  assert.deepEqual(nodes(body.kids).map((n) => attrs(n).id || attrs(n).class), ['calc-angle', 'calc-hist', 'calc-guide']);
  assert.equal(attrs(core.calcBody(true, 'rad', Nil, false)).hidden, '');
});

// O casco do `index.html` não carrega mais o guia: o texto vem só do núcleo
// (catálogo `calc.*`), então não há cópia em português para sair do passo (#41).
const html = () => fs.readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');

test('guia: resumo, frase, grupos e dicas', () => {
  const guide = core.calcGuide(false);
  assert.deepEqual(attrs(guide), {id: 'calc-guide'});
  const kids = nodes(guide.kids);
  assert.deepEqual(kids.map((n) => n.tag), ['summary', 'p', 'dl', 'ul']);
  assert.deepEqual(texts(kids[0]), ['Como usar']);
  assert.deepEqual(attrs(kids[1]), {class: 'calc-guide-lead'});
  assert.deepEqual(attrs(kids[2]), {class: 'calc-groups'});
  assert.deepEqual(attrs(kids[3]), {class: 'calc-tips'});

  const groups = nodes(kids[2].kids);
  assert.deepEqual(groups.map((n) => n.tag), ['dt', 'dd', 'dt', 'dd', 'dt', 'dd', 'dt', 'dd']);
  assert.deepEqual(groups.filter((n) => n.tag === 'dt').map(textContent), ['Operações', 'Funções', 'Trigonometria', 'Constantes']);
  assert.ok(nodes(kids[3].kids).every((n) => n.tag === 'li') && nodes(kids[3].kids).length === 5, 'cinco dicas em lista');

  assert.ok(!html().includes('id="calc-guide"'), 'o index.html não guarda uma cópia do guia');
  assert.deepEqual(attrs(core.calcGuide(true)), {id: 'calc-guide', open: ''}, 'guia aberta mantém o open');
});

test('guia: os <code> do guia são os nomes que o avaliador aceita', () => {
  const codes = [];
  const walk = (node) => {
    if (node.$ === 'ViewText') return;
    if (node.tag === 'code') codes.push(textContent(node));
    for (const kid of nodes(node.kids)) walk(kid);
  };
  walk(core.calcGuide(false));
  assert.ok(codes.length > 10, `esperava dezenas de <code> no guia, achei ${codes.length}`);
  assert.ok(codes.includes('sqrt(16)+sin(pi/2)') || codes.some((code) => code.includes('sqrt')), 'o exemplo da raiz está no guia');
});

test('guia: todo nome anunciado existe no avaliador', () => {
  const names = (l) => nodes(l);
  for (const name of [...names(core.fnNames()), ...names(core.trigNames())]) {
    assert.doesNotThrow(() => calculate(`${name}(1)`), `${name} existe no avaliador`);
  }
  for (const name of names(core.constNames())) assert.doesNotThrow(() => calculate(name), `${name} existe no avaliador`);
  for (const op of names(core.opNames()).filter((o) => o !== '( )')) {
    assert.doesNotThrow(() => calculate(`2${op}3`), `${op} existe no avaliador`);
  }
  assert.equal(calculate('(2+3)*4'), '20');
  assert.equal(calculate('2,5*2'), '5', 'vírgula decimal, como a dica diz');
  assert.throws(() => calculate('2pi'), 'a dica avisa: 2pi não vale');
  assert.equal(calculate('asin(0.5)', true), '30');
  assert.equal(calculate('cos(90)', true), '0');
  assert.throws(() => calculate('tan(90)', true));
});
