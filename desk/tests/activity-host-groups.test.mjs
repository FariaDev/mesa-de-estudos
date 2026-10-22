// O host do quadro (activity.mjs) monta os grupos que saíram dele na #43 fase 2
// (activity-card-dom, activity-frame) sobre o mesmo ctx: ligar e desligar
// passam pelos três módulos sem ReferenceError.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fakeActivityDocument, fakeActivityWindow} from './fake-activity-dom.mjs';

test('attach e detach do host do quadro atravessam os grupos do ctx', async () => {
  const previousWindow = globalThis.window;
  globalThis.window = fakeActivityWindow();
  try {
    const {createActivityHost} = await import('../src/activity.mjs');
    const doc = fakeActivityDocument({theme: 'dark'});
    const host = createActivityHost({doc, api: {}});
    host.attach();
    assert.ok(doc.added.includes('keydown'), 'o Esc da tela cheia (activity-card-dom) é ligado');
    assert.ok(globalThis.window.added.includes('message'), 'as mensagens do quadro (activity-frame) são ouvidas');
    assert.equal(host.currentTheme(), 'dark');
    assert.equal(typeof host.mount, 'function');
    host.detach();
    assert.ok(doc.removed.includes('keydown'));
  } finally {
    globalThis.window = previousWindow;
  }
});
