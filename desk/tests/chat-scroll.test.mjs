/* Regressão: ao enviar, a coluna vai até a mensagem; durante a resposta só
   segue o fim se o aluno já estava lá. Subir para ler desliga; voltar liga. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {CHAT_SCROLL_THRESHOLD, chatFollowDecision, createGestureWindow} from '../src/chat-scroll.mjs';

test('enviar rola até a mensagem enviada e passa a seguir o fim', () => {
  assert.deepEqual(
    chatFollowDecision({intent: 'send', distanceFromEnd: 900, following: false}),
    {following: true, alignSent: true, followEnd: false},
  );
});

test('a resposta segue o fim só enquanto o aluno não subiu', () => {
  assert.equal(chatFollowDecision({intent: 'stream', following: true, distanceFromEnd: 400}).followEnd, true);
  const away = chatFollowDecision({intent: 'scroll', distanceFromEnd: CHAT_SCROLL_THRESHOLD + 1, following: true, userScroll: true});
  assert.equal(away.following, false);
  assert.equal(chatFollowDecision({intent: 'stream', following: away.following}).followEnd, false);
  const back = chatFollowDecision({intent: 'scroll', distanceFromEnd: CHAT_SCROLL_THRESHOLD, following: false, userScroll: true});
  assert.equal(back.following, true);
  assert.equal(chatFollowDecision({intent: 'stream', following: back.following}).followEnd, true);
});

test('rolagem de layout sem gesto não desliga o seguir', () => {
  const kept = chatFollowDecision({intent: 'scroll', distanceFromEnd: CHAT_SCROLL_THRESHOLD + 500, following: true, userScroll: false});
  assert.equal(kept.following, true);
  const back = chatFollowDecision({intent: 'scroll', distanceFromEnd: 0, following: false, userScroll: false});
  assert.equal(back.following, true);
});

test('remontar o histórico não puxa quem estava lendo acima', () => {
  assert.equal(chatFollowDecision({intent: 'history', distanceFromEnd: 200}).followEnd, false);
  assert.equal(chatFollowDecision({intent: 'history', distanceFromEnd: 0}).followEnd, true);
});

/* Relógio e quadros de mentira: o gesto vale até o quadro atrasado entregar o `scroll`. */
function fakeGestureClock() {
  const clock = {time: 0, pending: []};
  clock.window = createGestureWindow({now: () => clock.time, requestFrame: (run) => clock.pending.push(run)});
  clock.runFrame = () => clock.pending.shift()?.();
  return clock;
}

test('sem gesto a janela está fechada', () => {
  assert.equal(fakeGestureClock().window.isOpen(), false);
});

test('com quadros em dia a janela fecha pelo relógio', () => {
  const clock = fakeGestureClock();
  clock.window.mark();
  for (let i = 0; i < 3; i += 1) clock.runFrame();
  clock.time = 1000;
  assert.equal(clock.window.isOpen(), true);
  clock.time = 1001;
  assert.equal(clock.window.isOpen(), false);
});

test('quadro atrasado 2,9 s mantém o gesto aberto até os quadros rodarem', () => {
  const clock = fakeGestureClock();
  clock.window.mark();
  clock.time = 2900;
  assert.equal(clock.window.isOpen(), true, 'o scroll atrasado ainda conta como gesto');
  for (let i = 0; i < 3; i += 1) clock.runFrame();
  assert.equal(clock.window.isOpen(), false, 'depois dos quadros, rolagem de layout não conta');
});

test('gesto novo durante a contagem recomeça sem abrir outra cadeia de quadros', () => {
  const clock = fakeGestureClock();
  clock.window.mark();
  clock.runFrame();
  clock.window.mark();
  assert.equal(clock.pending.length, 1);
  clock.time = 5000;
  clock.runFrame();
  clock.runFrame();
  assert.equal(clock.window.isOpen(), true, 'a contagem recomeçou no segundo gesto');
  clock.runFrame();
  assert.equal(clock.window.isOpen(), false);
});
