/* Guarda dos desfechos tardios do adaptador OpenCode (#57): geração da
   ligação e ecos de interrupt, sem servidor nem SSE. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {createTurnGuard} = require('../src/agents/opencode-turn-guard.cjs');

const cancelled = () => Object.assign(Error('Chamada ao tutor cancelada.'), {notSent: true});

test('invalidate derruba a geração capturada antes; capturar de novo vale', () => {
  const guard = createTurnGuard({cancelled});
  const before = guard.capture();
  guard.throwIfStale(before);
  guard.invalidate();
  assert.throws(() => guard.throwIfStale(before), /cancelada/);
  guard.throwIfStale(guard.capture());
});

test('um eco por interrupt: o primeiro com turno novo é consumido, o resto fecha', () => {
  const guard = createTurnGuard({cancelled});
  assert.equal(guard.consumeInterruptEcho('interrupted'), false, 'sem cancel, nada para consumir');
  guard.noteInterrupt();
  assert.equal(guard.consumeInterruptEcho('succeeded'), false, 'só o interrupted é eco');
  assert.equal(guard.consumeInterruptEcho('interrupted'), true, 'o eco atrasado não fecha o turno novo');
  assert.equal(guard.consumeInterruptEcho('interrupted'), false, 'sem eco pendente, o interrupt vale');
});

test('settleExecution consome o eco e liquida o resto', () => {
  const guard = createTurnGuard({cancelled});
  const settled = [];
  guard.noteInterrupt();
  guard.settleExecution((end) => settled.push(end), 'interrupted');
  assert.deepEqual(settled, [], 'o eco não fecha nada');
  guard.settleExecution((end) => settled.push(end), 'interrupted');
  assert.deepEqual(settled, [{isError: false, cancelled: true}]);
  guard.settleExecution((end) => settled.push(end), 'failed');
  assert.deepEqual(settled.at(-1), {isError: true, cancelled: false});
});
