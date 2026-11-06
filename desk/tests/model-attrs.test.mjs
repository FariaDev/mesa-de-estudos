// Faixa dos atributos do modelo (#seg-markup) sem Electron: só a checagem
// barata (`modelAttrsPresent`) é testável em Node — ela é string pura. O
// `stripModelAttrs` usa o parser do navegador (`<template>`) e falha alto fora
// do DOM; o caminho real (strip + serialização) roda no Electron e está
// coberto por `markup-attrs.test.mjs` + `markup-attrs-scenarios.cjs`.
import test from 'node:test';
import assert from 'node:assert/strict';
import {modelAttrsPresent, stripModelAttrs, modelHrefAllowed, modelSrcAllowed} from '../src/model-attrs.mjs';

test('a checagem larga dispara em toda forma que vira elemento com atributo', () => {
  for (const html of [
    '<div id="prompt">', '<div/id=prompt>', '<TEXTAREA ID="P">', '<div\nclass=x>',
    '<a name="y">', '<b style="color:red">', '<i data-tex="t">',
    // bypass 2026-11: aspas coladas, aspa solta, separador exótico, sem valor
    '<textarea a="b"id="prompt">', "<div a='b'style=\"position:fixed\">",
    '<b a="c"data-tex="FALSO">', '<textarea x=a" id="prompt">',
    '<div\tid="prompt">', '<div\fid="prompt">', '<div\rid="prompt">',
    '<TEXTAREA ID="PROMPT" STYLE="position:fixed">', '<div title="a>b" id="y">',
    '<textarea id="prompt">sem fechar', '<div id="prompt"',
    '<table><tr><td><div id="prompt">', '<ul><li><div id="prompt">',
    '<details><summary>S</summary><div id="prompt" style="color:red">',
    '<svg viewBox="0 0 10 10"><rect id="prompt"', '<math><mi id="prompt">',
    '<template><div id="prompt" class="x">', '<div id="a" id="prompt">',
    '<div id>', '<div style>', '<div &#105;d="prompt">',
    '<![if x]><div id="prompt">', '<noscript><div id="prompt">',
    '<![CDATA[<div id="prompt">',
    /* Falso positivo barato: comentário com tag dentro — o parser o mantém
       como comentário e a saída sai igual. */
    '<!-- <div id="x"> -->',
  ]) assert.equal(modelAttrsPresent(html), true, html);
});

test('texto sem HTML e tag sem atributo não pagam o parser', () => {
  for (const html of [
    '<p>texto puro</p>', '<table><tr><td>1</td></tr></table>', '<pre><code>x.id</code></pre>',
    'Olá, tudo bem? Sem HTML aqui.', '<p>5 > 3 e 2 < 4</p>', '</div>',
  ]) assert.equal(modelAttrsPresent(html), false, html);
});

test('aspa colada no nome da tag não é atributo: o parser engole no nome', () => {
  /* `<div"id"="prompt">` vira elemento de nome `div"id"` sem atributo (prova
     em Electron); o gate perder aqui é seguro — não há o que tirar. */
  assert.equal(modelAttrsPresent('<div"id"="prompt">'), false);
});

test('a passagem fora do DOM falha alto em vez de fingir', () => {
  assert.throws(() => stripModelAttrs('<div id="x">y</div>'), /document/);
});

test('href do modelo: só https: e #fragmento', () => {
  for (const href of ['https://exemplo.com/guia', '#secao', 'HTTPS://EXEMPLO.COM/X', 'http://exemplo.com/legado']) {
    assert.equal(modelHrefAllowed(href), true, href);
  }
  for (const href of [
    '', '   ', '../../../tmp/mesa-review/marker.png', '/tmp/x.png', './foto.png',
    'file:///tmp/x.png', 'data:text/html,<p>x</p>',
    'mailto:tutor@exemplo.com', 'java\tscript:alert(1)', 'jav\nascript:alert(1)',
    '  javascript:alert(1)', 'HTTPS ://x', 'desk/foto.png', 'C:\\tmp\\x.png',
  ]) assert.equal(modelHrefAllowed(href), false, JSON.stringify(href));
});

test('src do modelo: só https: e data:image/*', () => {
  for (const src of ['https://exemplo.com/foto.png', 'data:image/png;base64,iVBORw0=', 'DATA:IMAGE/SVG+XML;utf8,<svg/>']) {
    assert.equal(modelSrcAllowed(src), true, src);
  }
  for (const src of [
    '', '../../../tmp/mesa-review/marker.png', 'file:///tmp/x.png', '/x.png',
    'http://exemplo.com/foto.png', 'data:text/html,<p>x</p>', '#frag', 'blob:https://x',
  ]) assert.equal(modelSrcAllowed(src), false, JSON.stringify(src));
});
