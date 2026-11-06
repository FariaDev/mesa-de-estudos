import test from 'node:test';
import assert from 'node:assert/strict';
import {HISTORY_LAZY_FORMAT_ENABLED, HISTORY_LAZY_SHORT_LIMIT, HISTORY_LAZY_TAIL_BUBBLES, HISTORY_LAZY_MARGIN, beginLazyHistory, cancelLazyHistory, deferLazyBubble, finishLazyHistory, lazyStats, shouldDeferHistory} from '../src/history-format-lazy.mjs';
import {anchorDrift} from '../src/history-scroll-anchor.mjs';

/* Regras puras da formatação preguiçosa (#118): decisão de adiar, âncora de
   rolagem e gerações. Sem DOM nem janela — o que toca no DOM está nos
   `chat-history-lazy-*-ui.mjs`. */

test('conversa curta monta direta; longa adia', () => {
  assert.equal(shouldDeferHistory(0), false);
  assert.equal(shouldDeferHistory(200), false, 'até 200 mensagens é direta');
  assert.equal(shouldDeferHistory(201), true);
  assert.equal(shouldDeferHistory(5000), true);
  for (const garbage of [null, undefined, 'muita', NaN, -3]) assert.equal(shouldDeferHistory(garbage), false, `lixo ${String(garbage)} não arma`);
});

test('constantes da #118', () => {
  assert.equal(HISTORY_LAZY_FORMAT_ENABLED, true, 'a chave sai ligada; desligar volta ao direto');
  assert.equal(HISTORY_LAZY_SHORT_LIMIT, 200);
  assert.equal(HISTORY_LAZY_TAIL_BUBBLES, 60);
  assert.match(HISTORY_LAZY_MARGIN, /1200px/, 'margem generosa do observador');
});

test('lote arma, desarma e cancela a geração', () => {
  cancelLazyHistory();
  assert.equal(deferLazyBubble(), false, 'cancelado não adia');
  const first = beginLazyHistory(5000);
  assert.equal(first.armed, true);
  assert.equal(deferLazyBubble(), true);
  const short = beginLazyHistory(50);
  assert.equal(short.armed, false, 'curta desarma');
  assert.equal(deferLazyBubble(), false);
  assert.ok(short.generation > first.generation, 'cada lote tem geração nova');
  beginLazyHistory(5000);
  cancelLazyHistory();
  assert.equal(deferLazyBubble(), false, 'trocar de conversa desarma');
  assert.equal(lazyStats().pending, 0, 'nada pendente vaza');
});

test('sem raiz o fechamento não quebra', () => {
  beginLazyHistory(5000);
  assert.deepEqual(finishLazyHistory(null), {total: 0, tail: 0});
  assert.deepEqual(finishLazyHistory(undefined), {total: 0, tail: 0});
  cancelLazyHistory();
});

test('âncora: desconta a rolagem e devolve só o que o layout moveu', () => {
  assert.equal(anchorDrift({anchorTop: 320, previousTop: 200, scrollTop: 0, previousScroll: 0}), 120, 'conteúdo acima cresceu: a âncora desceu 120');
  assert.equal(anchorDrift({anchorTop: 79, previousTop: 200, scrollTop: 121, previousScroll: 0}), 0, 'só a rolagem do aluno (121px) não é desvio');
  assert.equal(anchorDrift({anchorTop: 200, previousTop: 200, scrollTop: 0, previousScroll: 0}), 0, 'quadro parado não anda');
  assert.equal(anchorDrift({anchorTop: 100, previousTop: 200, scrollTop: 0, previousScroll: 0}), -100, 'conteúdo acima encolheu: a âncora subiu');
  assert.equal(anchorDrift({anchorTop: 140, previousTop: 200, scrollTop: 100, previousScroll: 40}), 0, 'rolagem de 60px com o conteúdo parado');
  assert.equal(anchorDrift({anchorTop: 260, previousTop: 200, scrollTop: 100, previousScroll: 40}), 120, 'rolagem de 60px mais 120px de crescimento');
});
