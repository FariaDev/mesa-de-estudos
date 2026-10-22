/* Fatos do motor na janela (#57): motor conhecido, motor da sessão, nativo,
   binário achado, esforço e capacidade padrão, e a ordem do catálogo. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {knownEngine, sessionEngine, isNativeEngine, engineReady, defaultEffort, defaultCapability} from '../src/engine-facts.mjs';

test('knownEngine: só os três motores conhecidos passam', () => {
  for (const engine of ['pi', 'claude', 'opencode']) assert.equal(knownEngine(engine), engine);
  for (const engine of ['x', '', undefined, 7, 'toString']) assert.equal(knownEngine(engine), null);
});

test('sessionEngine: nativo fica, Pi e desconhecido viram pi', () => {
  assert.equal(sessionEngine('claude'), 'claude');
  assert.equal(sessionEngine('opencode'), 'opencode');
  for (const engine of ['pi', undefined, 'x']) assert.equal(sessionEngine(engine), 'pi');
});

test('isNativeEngine: true só para Claude e OpenCode', () => {
  assert.equal(isNativeEngine('claude'), true);
  assert.equal(isNativeEngine('opencode'), true);
  for (const engine of ['pi', 'x', undefined]) assert.equal(isNativeEngine(engine), false);
});

test('engineReady: cada motor olha o próprio binário', () => {
  assert.equal(engineReady({engine: 'pi', detectedPi: '/bin/pi'}), true);
  assert.equal(engineReady({engine: 'claude', detectedClaude: '/bin/claude'}), true);
  assert.equal(engineReady({engine: 'opencode', detectedOpenCode: '/bin/opencode'}), true);
});

test('engineReady: binário de outro motor achado não conta', () => {
  assert.equal(engineReady({engine: 'pi', detectedClaude: '/bin/claude', detectedOpenCode: '/bin/opencode'}), false);
  assert.equal(engineReady({engine: 'claude', detectedPi: '/bin/pi', detectedOpenCode: '/bin/opencode'}), false);
  assert.equal(engineReady({engine: 'opencode', detectedPi: '/bin/pi', detectedClaude: '/bin/claude'}), false);
});

test('engineReady: sem dados é false', () => {
  assert.equal(engineReady(null), false);
});

test('defaultEffort: Padrão nos nativos, off no Pi', () => {
  assert.equal(defaultEffort('claude'), 'default');
  assert.equal(defaultEffort('opencode'), 'default');
  assert.equal(defaultEffort('pi'), 'off');
  assert.equal(defaultEffort(undefined), 'off');
});

test('defaultCapability: Pi nasce com tudo, nativo nasce fechado', () => {
  assert.equal(defaultCapability('pi'), true);
  assert.equal(defaultCapability(undefined), true);
  assert.equal(defaultCapability('claude'), false);
  assert.equal(defaultCapability('opencode'), false);
});
