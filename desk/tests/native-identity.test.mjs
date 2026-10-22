/* Identidade nativa do descritor: o `ses_` do OpenCode nasce vazio e é
 * gravado uma vez com o id que o servidor cunhou (o Zen recusa o grátis com
 * id de fora; medido em 2026-10-20). O UUID do Claude não muda. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {validNativeId, nextNativeId} = require('../src/agents/native-identity.cjs');

const SERVER_ID = 'ses_ea5e2cf67ffeh4QXVLFnu10D1S';
const fail = (text) => Error(text);

test('OpenCode aceita null antes da sessão existir; Claude não', () => {
  assert.equal(validNativeId('opencode', null), true);
  assert.equal(validNativeId('opencode', SERVER_ID), true);
  assert.equal(validNativeId('opencode', 'b7d1d2c3-0000-4000-8000-000000000000'), false);
  assert.equal(validNativeId('claude', null), false);
  assert.equal(validNativeId('claude', 'b7d1d2c3-0000-4000-8000-000000000000'), true);
});

test('o primeiro ses_ do servidor é gravado e depois só o mesmo passa', () => {
  assert.equal(nextNativeId('opencode', null, SERVER_ID, fail), SERVER_ID);
  assert.equal(nextNativeId('opencode', SERVER_ID, SERVER_ID, fail), SERVER_ID);
  assert.throws(() => nextNativeId('opencode', SERVER_ID, 'ses_outro', fail), /imutável/);
});

test('apagar a identidade ou mandar formato errado é recusado com o valor recebido', () => {
  assert.throws(() => nextNativeId('opencode', SERVER_ID, null, fail), /nativeSessionId/);
  assert.throws(() => nextNativeId('opencode', null, 'sessão', fail), /sessão/);
  assert.throws(() => nextNativeId('claude', null, SERVER_ID, fail), /uuid/);
});
