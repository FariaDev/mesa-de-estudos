import test from 'node:test';
import assert from 'node:assert/strict';
import {CAST, restLook, memberLook, tailX} from '../src/setup-cast.mjs';

/* #64: o palco do setup. Em repouso, no trio, os de fora olham para o do meio;
   quem não lidera não acena, não lê nem escreve, mas comemora e cochila junto. */

test('o trio entra na ordem ∫ Σ ∇', () => {
  assert.deepEqual([...CAST], ['integral', 'sigma', 'nabla']);
});

test('em repouso, no trio, a ∫ e o ∇ olham para o Σ; sozinho, olha para a frente', () => {
  assert.deepEqual(restLook('integral', true), [20, 0]);
  assert.deepEqual(restLook('sigma', true), [0, 0]);
  assert.deepEqual(restLook('nabla', true), [-20, 0]);
  for (const id of CAST) assert.deepEqual(restLook(id, false), [0, 0], id);
});

test('quem não lidera pega o humor e o sono do passo, sem os gestos de quem fala', () => {
  const look = {mood: 'feliz', wave: true, sleepy: true, writing: true, reading: true, alert: true};
  assert.equal(memberLook(look, true), look);
  assert.deepEqual(memberLook(look, false), {mood: 'feliz', wave: false, sleepy: true, writing: false, reading: false, alert: false});
});

/* #70 (teste manual A1): a ponta do balão segue quem fala, sem sair da borda reta. */
test('a ponta do balão fica em cima de quem fala', () => {
  const speech = {left: 100, width: 270};
  assert.equal(tailX(speech, {left: 110, width: 96}), 58, 'a ∫, à esquerda no trio');
  assert.equal(tailX(speech, {left: 187, width: 96}), 135, 'o Σ, no meio');
  assert.equal(tailX(speech, {left: 40, width: 40}), 18, 'longe à esquerda: fica na borda reta');
  assert.equal(tailX(speech, {left: 500, width: 96}), 252, 'longe à direita: idem');
});
