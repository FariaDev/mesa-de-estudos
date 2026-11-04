/* A vista do release "só OpenCode": a produção nunca mostra Pi/Claude, e a
   chave de teste reabre os fakes sem vazar para o app instalado. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ALL_ENGINES, ENGINE_NAMES, normalizeList, visibleEngines, engineVisible, defaultVisibleEngine, filterDetected} from '../visible-engines.cjs';

test('produção: só OpenCode, mesmo com a chave no ambiente', () => {
  assert.deepEqual(visibleEngines(), ['opencode']);
  assert.deepEqual(visibleEngines({testMode: false, env: {LEARNING_DESK_VISIBLE_ENGINES: 'pi,claude,opencode'}}), ['opencode']);
  assert.equal(engineVisible('pi'), false);
  assert.equal(engineVisible('opencode'), true);
  assert.equal(defaultVisibleEngine({pi: '/pi', claude: '/claude', opencode: '/oc'}), 'opencode');
});

test('teste: a chave reabre os motores pedidos, na ordem canônica', () => {
  const env = {LEARNING_DESK_VISIBLE_ENGINES: 'opencode, claude, pi, desconhecido'};
  assert.deepEqual(visibleEngines({testMode: true, env}), ['pi', 'claude', 'opencode']);
  assert.deepEqual(visibleEngines({testMode: true, env: {}}), ['opencode'], 'sem chave, a regra de produção');
  assert.deepEqual(normalizeList(''), []);
  assert.deepEqual(ALL_ENGINES, ['pi', 'claude', 'opencode']);
  assert.equal(ENGINE_NAMES.opencode, 'OpenCode');
});

test('defaultVisibleEngine: o primeiro visível instalado; sem nenhum, OpenCode', () => {
  const env = {LEARNING_DESK_VISIBLE_ENGINES: 'pi,claude,opencode'};
  assert.equal(defaultVisibleEngine({pi: '/pi', claude: '/c', opencode: '/o'}, {testMode: true, env}), 'pi');
  assert.equal(defaultVisibleEngine({claude: '/c', opencode: '/o'}, {testMode: true, env}), 'claude');
  assert.equal(defaultVisibleEngine({opencode: '/o'}, {testMode: true, env}), 'opencode');
  assert.equal(defaultVisibleEngine({}, {testMode: true, env}), 'opencode');
});

test('filterDetected: zera o que não está na vista e preserva o resto', () => {
  const detected = {pi: '/pi', claude: '/c', opencode: '/o', opencodeOld: '1.2.3'};
  assert.deepEqual(filterDetected(detected), {pi: '', claude: '', opencode: '/o', opencodeOld: '1.2.3'});
  assert.deepEqual(filterDetected(detected, {testMode: true, env: {LEARNING_DESK_VISIBLE_ENGINES: 'pi,claude,opencode'}}), detected);
});

/* A 1.1.0 esconde o Pi, mas o `npm run setup` ainda o anunciava como padrão. */
test('setup: com o Pi instalado, a vista anuncia só o OpenCode', async () => {
  const {engineNames, defaultEngineFrom} = await import('../tutor-default-engine.cjs');
  const engines = filterDetected({pi: '/p', claude: '/c', opencode: '/o'});
  assert.deepEqual(engineNames(engines), ['OpenCode']);
  assert.equal(defaultEngineFrom(engines), 'opencode');
  const source = fs.readFileSync(new URL('../scripts/setup.mjs', import.meta.url), 'utf8');
  assert.match(source, /engines=filterDetected\(detectTutorEngines/);
});
