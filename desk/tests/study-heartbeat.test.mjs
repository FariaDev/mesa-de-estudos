import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {heartbeatActive, createStudyHeartbeat} = require('../study-heartbeat.cjs');

test('só conta com a janela visível e não minimizada', () => {
  assert.equal(heartbeatActive({visible: true, minimized: false}), true);
  assert.equal(heartbeatActive({visible: false, minimized: false}), false);
  assert.equal(heartbeatActive({visible: true, minimized: true}), false);
  assert.equal(heartbeatActive({visible: false, minimized: true}), false);
});

test('o timer não bate com a janela escondida nem durante a guarda', () => {
  let scheduled = null;
  let cleared = null;
  let active = false;
  let guarded = false;
  let beats = 0;
  const timer = createStudyHeartbeat({
    active: () => active,
    beat: () => beats++,
    guard: () => guarded,
    setTimer: (fn, ms) => {
      scheduled = {fn, ms};
      return {unref() {}};
    },
    clearTimer: (value) => {
      cleared = value;
    },
  });
  assert.equal(scheduled.ms, 15000);
  scheduled.fn();
  assert.equal(beats, 0, 'janela escondida não bate');
  active = true;
  scheduled.fn();
  assert.equal(beats, 1);
  guarded = true;
  scheduled.fn();
  assert.equal(beats, 1, 'guarda (troca de matéria/saída) segura o batimento');
  timer.stop();
  assert.ok(cleared);
});
