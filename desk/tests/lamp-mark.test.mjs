import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {lampMarkMarkup} from '../src/lamp-mark.mjs';

/* #101: a marca do "pensando" é a luminária da arte do autor, com o braço vindo
   do canto de cima da linha e a luz pulsando. O pulso fica no CSS. */

test('a luminária sai como na arte: braço do canto, presilha, cúpula e luz', () => {
  const html = lampMarkMarkup();
  assert.match(html, /^<span class="lamp-mark" aria-hidden="true"><svg viewBox="0 0 90 33"/);
  assert.match(html, /class="lamp-mark-arm" d="M-3 -3L15 9"/, 'o braço entra pelo canto de cima');
  assert.match(html, /class="lamp-mark-clip"/);
  assert.match(html, /class="lamp-mark-dome"/);
  assert.match(html, /class="lamp-mark-glow"/);
  assert.doesNotMatch(html, /mascote|personagem/, 'sem personagem');
});

test('a marca fica presa ao canto da cabeça e o pulso para com movimento reduzido', () => {
  const css = fs.readFileSync(new URL('../src/tutor-chat.css', import.meta.url), 'utf8');
  assert.match(css, /\.work\[data-live=true\] \.work-head\{position:relative;overflow:hidden;min-height:28px\}/);
  assert.match(css, /\.work-mark\[data-lamp="dome"\]\{position:absolute;left:0;top:0;/);
  assert.match(css, /\.work-mark \.lamp-mark-glow\{animation:lamp-think calc\(var\(--t-loop\) \* 2\) var\(--ease-move\) infinite\}/);
  assert.match(css, /@keyframes lamp-think\{0%,100%\{opacity:\.22\}50%\{opacity:1\}\}/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.work-mark \.lamp-mark-glow\{animation:none\}\}/);
});
