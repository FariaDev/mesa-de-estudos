/* A saída do limite do grátis (429 `FreeUsageLimitError`): a frase e o botão
   dependem de ter conta. Puro (sem DOM): a janela pinta a partir daqui. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import ptBR from '../src/locales/pt-BR.json' with {type: 'json'};
import en from '../src/locales/en.json' with {type: 'json'};
import {parseMessage, message} from '../src/i18n.mjs';
import {freeLimitKey, freeLimitMessageKey} from '../src/free-limit-notice.mjs';
import {FREE_LIMIT_429} from './fake-opencode.mjs';

const require = createRequire(import.meta.url);
const {providerFailureMessage} = require('../src/agents/opencode-events.cjs');

test('a frase mapeada do limite é reconhecida como free-limit', () => {
  assert.equal(freeLimitKey(providerFailureMessage(FREE_LIMIT_429)), true);
  assert.equal(freeLimitKey(message('opencode.event.providerFailed', {reason: 'x'})), false);
  assert.equal(freeLimitKey('texto sem marca'), false);
});

test('sem conta guardada, a frase pede entrar ou usar chave', () => {
  assert.equal(freeLimitMessageKey({saved: false}), 'opencode.event.freeLimit');
  assert.equal(freeLimitMessageKey({}), 'opencode.event.freeLimit');
  const parsed = parseMessage(message(freeLimitMessageKey({})));
  assert.equal(parsed?.key, 'opencode.event.freeLimit');
});

test('com conta guardada, a frase sugere outro modelo e não pede login', () => {
  assert.equal(freeLimitMessageKey({saved: true}), 'opencode.event.freeLimitModels');
  for (const phrase of [ptBR['opencode.event.freeLimitModels'], en['opencode.event.freeLimitModels']]) {
    assert.ok(phrase.length <= 80, `linha curta no teto da #90: ${phrase}`);
    assert.match(phrase, /outro modelo|another model/);
    assert.doesNotMatch(phrase, /entre numa conta|sign in/i, 'quem já entrou não ouve "entre"');
  }
  assert.doesNotMatch(`${ptBR['opencode.event.freeLimitModels']} ${en['opencode.event.freeLimitModels']}`, /cota|quota|espere|wait/i, 'sem papo de cota nem de espera');
});
