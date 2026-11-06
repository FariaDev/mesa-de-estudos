/* Guarda de SVG (#60) sem DOM: `fakePurify` guarda os ganchos e o teste os
   dispara com nós e `data` na forma que o DOMPurify entrega. O DOMPurify real
   no Electron segue coberto por `figures-sanitize.test.mjs`. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {installSvgGuard} from '../src/figures/svg-guard.mjs';

const SVG = 'http://www.w3.org/2000/svg';
const HTML = 'http://www.w3.org/1999/xhtml';
const EVIL = 'https://evil.example/p.png';

function fakePurify() {
  const hooks = new Map();
  return {
    addHook(name, hook) { hooks.set(name, hook); },
    fire(name, node, data) { hooks.get(name)(node, data); },
  };
}

function guardedPurify() {
  const purify = fakePurify();
  installSvgGuard(purify);
  return purify;
}

function fakeNode(localName, {namespace = SVG, classes = '', parent = null} = {}) {
  return {localName, namespaceURI: namespace, parentElement: parent, getAttribute: (name) => (name === 'class' ? classes : null)};
}

function setAttribute(purify, node, attrName, attrValue) {
  const data = {attrName, attrValue, keepAttr: true};
  purify.fire('uponSanitizeAttribute', node, data);
  return data;
}

/* `<span class="katex"><svg><a/><path/></svg></span>`, como o KaTeX emite. */
function katexFigure() {
  const wrapper = fakeNode('span', {namespace: HTML, classes: 'katex'});
  const svg = fakeNode('svg', {parent: wrapper});
  return {link: fakeNode('a', {parent: svg}), path: fakeNode('path', {parent: svg})};
}

test('KaTeX: href externo e url() externo continuam saindo; a exceção é só da paleta', () => {
  const purify = guardedPurify();
  const {link, path} = katexFigure();
  assert.equal(setAttribute(purify, link, 'href', EVIL).keepAttr, false);
  assert.equal(setAttribute(purify, link, 'xlink:href', EVIL).keepAttr, false);
  assert.equal(setAttribute(purify, path, 'fill', `url(${EVIL})`).keepAttr, false);
  assert.equal(setAttribute(purify, path, 'style', `fill:url(${EVIL})`).keepAttr, false);
  assert.equal(setAttribute(purify, link, 'href', '#frag').keepAttr, true);
});

test('KaTeX: a cor da fórmula fica como o KaTeX a pôs, sem token do tema', () => {
  const purify = guardedPurify();
  const {path} = katexFigure();
  assert.equal(setAttribute(purify, path, 'fill', '#2563eb').attrValue, '#2563eb');
});

test('figura do tutor fora do KaTeX: a cor literal vira token do tema', () => {
  const purify = guardedPurify();
  assert.equal(setAttribute(purify, fakeNode('path'), 'fill', '#2563eb').attrValue, 'var(--plot-1)');
});

test('escape CSS não contorna o url(): u\\72l( em fill e em style sai, também dentro do KaTeX', () => {
  const purify = guardedPurify();
  const rect = fakeNode('rect');
  assert.equal(setAttribute(purify, rect, 'fill', 'u\\72l(https://evil.example/p.png)').keepAttr, false);
  assert.equal(setAttribute(purify, rect, 'style', 'fill:u\\72l(https://evil.example/p.png)').keepAttr, false);
  const {path} = katexFigure();
  assert.equal(setAttribute(purify, path, 'fill', 'u\\72l(https://evil.example/p.png)').keepAttr, false);
});

test('url(#fragmento) continua passando', () => {
  const purify = guardedPurify();
  const rect = fakeNode('rect');
  assert.equal(setAttribute(purify, rect, 'fill', 'url(#grad)').keepAttr, true);
  assert.equal(setAttribute(purify, rect, 'style', 'fill: url("#grad")').keepAttr, true);
});

test('style que posiciona sai do SVG; static e cor passam', () => {
  const purify = guardedPurify();
  const rect = fakeNode('rect');
  assert.equal(setAttribute(purify, rect, 'style', 'position:fixed;inset:0').keepAttr, false);
  assert.equal(setAttribute(purify, rect, 'style', 'fill:red;position:absolute').keepAttr, false);
  /* O hook recebe o valor já decodificado: `&#112;osition` chega `position`. */
  assert.equal(setAttribute(purify, rect, 'style', 'position:fixed').keepAttr, false);
  assert.equal(setAttribute(purify, rect, 'style', 'position:static').keepAttr, true);
  assert.equal(setAttribute(purify, rect, 'style', 'fill:red').keepAttr, true);
});
