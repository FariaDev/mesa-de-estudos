import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {findMotionViolations,formatMotionViolations,nearestDurationToken} from './motion-lint.mjs';

/* #63: duração e curva só pelos tokens (docs/design/movimento.md). */
const desk=new URL('../',import.meta.url);
const sheets=[
 'style.css',
 ...fs.readdirSync(new URL('src/',desk)).filter(name=>name.endsWith('.css')).map(name=>`src/${name}`),
];

test('as folhas da Mesa só usam os tokens de movimento', () => {
 const violations=sheets.flatMap(sheet=>findMotionViolations(fs.readFileSync(new URL(sheet,desk),'utf8'),sheet));
 assert.equal(violations.length,0,`movimento fora dos tokens:\n${formatMotionViolations(violations)}`);
});

/* Morde: estas linhas são do CSS de antes da #63 (tutor-chat, model-picker,
   icon-motion, activity), cada uma com o erro que o portão tem de pegar. */
test('o portão pega o que a Mesa tinha antes da #63', () => {
 const before=[
  ['.work-chevron .icon{transition:transform var(--t-base) ease}','ease'],
  ['#ctx-meter .bar i{transition:width var(--t-slower) var(--ease-out)}','transition de width'],
  ['.step-spin{animation:spin .8s linear infinite}','.8s'],
  ['.ts-dots span:nth-child(2){animation-delay:.15s}','.15s'],
  ['.motion-saved .motion-level{animation:motion-fill .5s cubic-bezier(.3,.7,.4,1) both}','cubic-bezier(…)'],
  ['.pulse{animation:pulse 1.2s ease-in-out infinite}','ease-in-out'],
  ['.activity-tools{transition: opacity var(--t-fast, 120ms) var(--ease-out);}','120ms'],
  ['.model-row{transition:background var(--t-fast),color var(--t-fast);}','background var(--t-fast) (sem curva: o navegador usa ease)'],
  ['.tr-lid{opacity:0;animation:tr-blink 3.6s infinite}','tr-blink 3.6s infinite (sem curva: o navegador usa ease)'],
 ];
 for(const [css,expected] of before){
  const found=findMotionViolations(css,'antes.css').map(v=>v.found);
  assert.ok(found.includes(expected),`${css} devia acusar ${expected}; acusou ${JSON.stringify(found)}`);
 }
});

test('o portão aceita tokens, calc sobre tokens e linear em giro infinito', () => {
 const ok=[
  'a{transition:opacity var(--t-fast) var(--ease-out),display var(--t-base) allow-discrete}',
  'a{animation:spin calc(var(--t-loop) * 2 / 3) linear infinite}',
  'a{animation-delay:calc(var(--t-loop) / 8)}',
  'a{background:linear-gradient(red,blue);width:120px}',
  '/* transition:width 1s ease */a{transition:none}',
 ];
 for(const css of ok)assert.deepEqual(findMotionViolations(css,'ok.css'),[],css);
});

test('linear fora de laço e transição de layout são recusados', () => {
 assert.deepEqual(findMotionViolations('a{transition:opacity var(--t-fast) linear}','x.css').map(v=>v.found),['linear']);
 assert.deepEqual(findMotionViolations('a{transition:all var(--t-fast) var(--ease-out)}','x.css').map(v=>v.found),['transition de all']);
 assert.deepEqual(findMotionViolations('a{transition-property:margin-left}','x.css').map(v=>v.found),['transition de margin-left']);
});

test('a mensagem diz arquivo, linha, achado e o token a usar', () => {
 const violations=findMotionViolations('a{}\nb{transition:opacity 160ms var(--ease-out)}','src/x.css');
 assert.equal(formatMotionViolations(violations),'src/x.css:2 transition: 160ms → use var(--t-base)');
});

test('nearestDurationToken aponta o token mais perto', () => {
 assert.equal(nearestDurationToken(100),'var(--t-fast)');
 assert.equal(nearestDurationToken(200),'var(--t-base)');
 assert.equal(nearestDurationToken(500),'var(--t-slow)');
 assert.equal(nearestDurationToken(1100),'var(--t-loop)');
});
