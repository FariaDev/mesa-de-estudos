import test from 'node:test';
import assert from 'node:assert/strict';
import {appIconSvg,mixOklab,ICON_ACCENTS,BUNDLE_ACCENT} from '../scripts/app-icon-art.mjs';

/* #61: a logo (G1 desde 2026-10-22; a #65 trouxe a G2) é gerada por acento; as misturas do protótipo (color-mix em
   oklab) viram hex. Os valores de referência saíram do Chromium do Electron
   (getComputedStyle de color-mix), com tolerância de 1 por canal. */
const channels=(hex)=>[1,3,5].map((i)=>parseInt(hex.slice(i,i+2),16));
const near=(got,want)=>channels(got).every((v,i)=>Math.abs(v-channels(want)[i])<=1);

test('mixOklab nas pontas devolve as próprias cores', () => {
  assert.equal(mixOklab('#2548c7',100,'#ffffff'),'#2548c7');
  assert.equal(mixOklab('#2548c7',0,'#ffffff'),'#ffffff');
});

test('mixOklab bate com o color-mix do Chromium', () => {
  for (const [a,pct,b,want] of REFERENCE) assert.ok(near(mixOklab(a,pct,b),want),`${a} ${pct}% ${b}: ${mixOklab(a,pct,b)} ≠ ${want}`);
});

test('appIconSvg desenha a G1 no acento, com e sem a grade do macOS', () => {
  const full=appIconSvg('blue');
  assert.match(full,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="1024" height="1024"/);
  assert.match(full,/rotate\(-4 512 512\)/);
  assert.match(full,/<g filter="url\(#brush\)"><path d="M606 336Q590 272[^"]*" fill="none" stroke="#[0-9a-f]{6}" stroke-width="58"/,'a ∫ de pincel');
  assert.match(full,/<feTurbulence[^>]*><feDisplacementMap/,'o pincel');
  assert.doesNotMatch(full,/#e8862a/,'sem o visto âmbar da G2');
  assert.doesNotMatch(full,/#c9c1ad/,'sem a lista da F1');
  assert.doesNotMatch(full,/color-mix|translate\(112 112\)/);
  assert.match(appIconSvg('blue',{grid:true}),/translate\(112 112\) scale\(\.78125\)/);
});

test('a ∫ usa o tom escuro do acento', () => {
  assert.match(appIconSvg('violet'),new RegExp(`stroke="${mixOklab('#6d28d9',70,'#1a1033')}" stroke-width="58"`));
});

test('a variante small (#67) tem folha reta, ∫ de traço 104 e nenhum filtro', () => {
  const small=appIconSvg('violet',{small:true});
  assert.match(small,/<path d="M262 132H762V832[^"]*" fill="#fffbf0"\/>/,'folha reta, sem sombra');
  assert.match(small,new RegExp(`<path d="M676 300Q650 196[^"]*" fill="none" stroke="${mixOklab('#6d28d9',70,'#1a1033')}" stroke-width="104"`));
  assert.doesNotMatch(small,/filter|rotate\(/,'sem pincel, sombra nem inclinação');
  assert.match(appIconSvg('violet',{small:true,grid:true}),/translate\(112 112\) scale\(\.78125\)/);
});

test('appIconSvg recusa acento desconhecido dizendo os válidos', () => {
  assert.throws(()=>appIconSvg('teal'),/Acento de ícone desconhecido: "teal"; esperado um de blue, violet/);
  assert.equal(BUNDLE_ACCENT in ICON_ACCENTS,true);
});

/* Preenchido a partir do Chromium; ver o comentário do topo. */
const REFERENCE=[
  ['#2548c7',78,'#ffffff','#4f74d7'],
  ['#2548c7',88,'#000000','#1d3ba8'],
  ['#2548c7',55,'#fffbf0','#809ddf'],
  ['#6d28d9',78,'#ffffff','#8864e5'],
  ['#6d28d9',88,'#000000','#5b20b7'],
  ['#6d28d9',55,'#fffbf0','#a793ea'],
  ['#0f7b55',78,'#ffffff','#549778'],
  ['#0f7b55',88,'#000000','#0b6746'],
  ['#0f7b55',55,'#fffbf0','#88b498'],
  ['#c2410c',78,'#ffffff','#d46f4f'],
  ['#c2410c',88,'#000000','#a33508'],
  ['#c2410c',55,'#fffbf0','#e4987c'],
  ['#c02667',78,'#ffffff','#d46086'],
  ['#c02667',88,'#000000','#a21e56'],
  ['#c02667',55,'#fffbf0','#e48ea2'],
  ['#27272a',78,'#ffffff','#505053'],
  ['#27272a',88,'#000000','#1f1f22'],
  ['#27272a',55,'#fffbf0','#807e7c'],
];
