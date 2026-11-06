/* Menu "Nova sessão" do cabeçalho (#87): rótulo, ordem e "(atual)". Puro, sem janela. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionChoices} from '../src/new-session-menu.mjs';

function setup({engine = 'opencode', detected = {claude: '/bin/claude', opencode: '/bin/opencode'}, visible = ['claude', 'opencode'], ready = () => true} = {}) {
  return {state: {engine, detected}, visibleEngines: () => visible, engineReady: ready};
}

test('dois motores prontos entram no menu, com o atual primeiro', () => {
  const choices = sessionChoices(setup({engine: 'claude'}));
  assert.deepEqual(choices.map((choice) => choice.engine), ['claude', 'opencode']);
  assert.equal(choices[0].current, true);
  assert.equal(choices[1].current, false);
  assert.match(choices[0].label, /Claude/);
});

test('motor fora da vista ou não pronto fica de fora', () => {
  assert.deepEqual(sessionChoices(setup({visible: ['opencode']})).map((choice) => choice.engine), ['opencode']);
  assert.deepEqual(
    sessionChoices(setup({ready: ({engine}) => engine === 'opencode'})).map((choice) => choice.engine),
    ['opencode'],
  );
  assert.deepEqual(sessionChoices(setup({visible: ['pi', 'opencode']})).map((choice) => choice.engine), ['opencode']);
});

test('com um motor só a lista tem um item e quem chama esconde o menu', () => {
  const choices = sessionChoices(setup({visible: ['opencode'], engine: 'opencode'}));
  assert.equal(choices.length, 1);
  assert.equal(choices[0].current, true);
});
