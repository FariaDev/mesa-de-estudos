import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {PHONE_CAST, phoneCastMarkup, phoneCastCss, liftInlineStyles} = require('../phone-cast.cjs');
const {phonePageHtml} = require('../phone-page.cjs');

/* #66: um do trio por estado na página do celular, do mesmo desenho da Mesa. */
const desk = new URL('../', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, desk), 'utf8');
const sheets = () => ({styleCss: read('style.css'), motionCss: read('src/motion.css'), trioCss: read('src/trio.css'), pageCss: read('src/phone-page.css')});
const castOf = (markup) => markup.match(/class="mascote mascote-(\w+)" data-humor="(\w+)"/)?.slice(1);

test('cada estado tem o seu personagem e humor', () => {
  assert.deepEqual(castOf(phoneCastMarkup('start')), ['integral', 'normal']);
  assert.deepEqual(castOf(phoneCastMarkup('sending')), ['sigma', 'pensando']);
  assert.deepEqual(castOf(phoneCastMarkup('offline')), ['nabla', 'aflita']);
  assert.deepEqual(Object.values(PHONE_CAST).map((c) => c.tamanho), [92, 92, 140]);
});

test('o desenho sai sem atributo style, que a CSP recusaria', () => {
  for (const state of Object.keys(PHONE_CAST)) {
    const markup = phoneCastMarkup(state);
    assert.doesNotMatch(markup, / style="/, state);
    assert.match(markup, /data-style="--fo-size:\d+px"/, `${state}: o tamanho segue para o script aplicar`);
  }
  assert.equal(liftInlineStyles('<g style="a:b" class="x">'), '<g data-style="a:b" class="x">');
});

test('estado desconhecido diz o que veio e o que vale', () => {
  assert.throws(() => phoneCastMarkup('folhinha'), /"folhinha".*"start", "sending", "offline"/);
});

test('o CSS leva os tokens de movimento, o congelamento e o trio', () => {
  const css = phoneCastCss(sheets());
  assert.match(css, /^:root\{--t-fast:120ms;[^}]*--t-loop:1\.2s;[^}]*--ease-move:[^;]+;--amber:#e8862a\}/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\s*:root\{[^}]*--t-loop:0s/);
  assert.ok(css.indexOf('prefers-reduced-motion') < css.indexOf('.mascote'), 'o congelamento vem antes do trio, depois dos tokens');
  assert.match(css, /\.mascote\[data-humor="aflita"\] \.mascote-jump\{animation:tr-shake/);
  assert.match(css, /main\[data-state=offline\]/);
});

test('sem tokens ou sem o bloco de movimento reduzido, o erro diz o que falta', () => {
  assert.throws(() => phoneCastCss({...sheets(), styleCss: ':root{--bg:#fff}'}), /esperado --t-fast/);
  assert.throws(() => phoneCastCss({...sheets(), motionCss: ''}), /prefers-reduced-motion/);
});

test('a página começa no início, com os três personagens e sem style inline', () => {
  const t = (key) => key;
  const html = phonePageHtml({t, lang: 'pt-BR', nonce: 'n', maxMb: 15, castCss: phoneCastCss(sheets())});
  assert.match(html, /<main data-state="start">/);
  assert.deepEqual([...html.matchAll(/class="mascote mascote-(\w+)"/g)].map((m) => m[1]), ['integral', 'sigma', 'nabla']);
  assert.doesNotMatch(html, / style="/);
  assert.match(html, /id="retry"/);
  assert.match(html, /phone\.page\.tipFrame/);
});
