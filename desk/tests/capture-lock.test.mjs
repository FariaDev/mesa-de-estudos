import test from 'node:test';
import assert from 'node:assert/strict';
import {beginCaptureLock, captureLockValid, endCaptureLock} from '../src/capture-lock.mjs';

/* D7/B6 — a trava do Conferir Xournal++: clique duplo não duplica a captura e
   a matéria/sessão de destino fica fixada (a captura que termina depois de a
   matéria mudar é descartada). O módulo é puro de propósito: o contrato do
   clique duplo é testável sem DOM nem permissão de tela. */

const fakeState = (courseId = '', session = '') => ({currentCourseId: courseId, currentSession: session});

test('D7: clique duplo — o segundo clique NÃO abre uma segunda captura', () => {
  const S = fakeState();
  const primeira = beginCaptureLock(S);
  assert.ok(primeira, 'a primeira captura ganha trava');
  const segunda = beginCaptureLock(S);
  assert.equal(segunda, null, 'o clique em voo é engolido (uma captura por vez)');
  /* A primeira termina e solta: o próximo clique volta a capturar. */
  assert.equal(captureLockValid(S, primeira), true);
  endCaptureLock(S, primeira);
  assert.equal(S.captureLock, null);
  const proxima = beginCaptureLock(S);
  assert.ok(proxima, 'depois de terminar, a próxima captura passa');
});

test('D7: a matéria mudou durante a captura → a captura perde a validade', () => {
  const S = fakeState('calculo-1', 'sessao-1');
  const lock = beginCaptureLock(S);
  /* A captura termina depois de a matéria ter mudado (troca no meio): */
  S.currentCourseId = 'geometria';
  assert.equal(captureLockValid(S, lock), false, 'captura de outra matéria é descartada');
  endCaptureLock(S, lock); // o finally do conferir solta (mesmo descartando)
  assert.equal(S.captureLock, null);
});

test('D7: sessão nova na mesma matéria também invalida a captura', () => {
  const S = fakeState('calculo-1', 'sessao-a');
  const lock = beginCaptureLock(S);
  S.currentSession = 'sessao-b';
  assert.equal(captureLockValid(S, lock), false);
});

test('D7: endCaptureLock de terceiros não derruba a trava do dono', () => {
  const S = fakeState('a', 's');
  const dono = beginCaptureLock(S);
  endCaptureLock(S, {courseId: 'a', session: 's'}); // trava estranha
  assert.equal(S.captureLock, dono, 'a trava do dono sobrevive');
  assert.equal(captureLockValid(S, dono), true);
  endCaptureLock(S, dono);
  assert.equal(S.captureLock, null);
});
