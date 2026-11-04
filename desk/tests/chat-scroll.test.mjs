/* Regressão: ao enviar, a coluna vai até a mensagem; durante a resposta só
   segue o fim se o aluno já estava lá. Subir para ler desliga; voltar liga. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {CHAT_SCROLL_THRESHOLD, chatFollowDecision} from '../src/chat-scroll.mjs';

test('enviar rola até a mensagem enviada e passa a seguir o fim', () => {
  assert.deepEqual(
    chatFollowDecision({intent: 'send', distanceFromEnd: 900, following: false}),
    {following: true, alignSent: true, followEnd: false},
  );
});

test('a resposta segue o fim só enquanto o aluno não subiu', () => {
  assert.equal(chatFollowDecision({intent: 'stream', following: true, distanceFromEnd: 400}).followEnd, true);
  const away = chatFollowDecision({intent: 'scroll', distanceFromEnd: CHAT_SCROLL_THRESHOLD + 1, following: true});
  assert.equal(away.following, false);
  assert.equal(chatFollowDecision({intent: 'stream', following: away.following}).followEnd, false);
  const back = chatFollowDecision({intent: 'scroll', distanceFromEnd: CHAT_SCROLL_THRESHOLD, following: false});
  assert.equal(back.following, true);
  assert.equal(chatFollowDecision({intent: 'stream', following: back.following}).followEnd, true);
});

test('remontar o histórico não puxa quem estava lendo acima', () => {
  assert.equal(chatFollowDecision({intent: 'history', distanceFromEnd: 200}).followEnd, false);
  assert.equal(chatFollowDecision({intent: 'history', distanceFromEnd: 0}).followEnd, true);
});
