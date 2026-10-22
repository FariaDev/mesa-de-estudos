import test from 'node:test';
import assert from 'node:assert/strict';
import {overlayWatch} from '../src/overlay-watch.mjs';

/* Fake do documento: quantas sobreposições estão abertas e quantas vezes foi contado. */
function fakeOverlays() {
  const state = {active: false, open: 0, counts: 0, sends: 0};
  const watch = overlayWatch({
    active: () => state.active,
    count: () => { state.counts++; return state.open; },
    onChange: () => { state.sends++; },
  });
  return {state, watch};
}

test('com o GeoGebra desligado, mudança no documento não conta as sobreposições (#67)', () => {
  const {state, watch} = fakeOverlays();
  for (let i = 0; i < 50; i++) watch();
  assert.equal(state.counts, 0);
  assert.equal(state.sends, 0);
});

test('ligado, só reenvia quando a contagem muda', () => {
  const {state, watch} = fakeOverlays();
  state.active = true;
  watch();
  watch();
  state.open = 1;
  watch();
  assert.equal(state.sends, 2, 'a primeira contagem e a abertura do diálogo');
});

test('diálogo aberto com a view desligada e fechado depois de religar ainda descobre a view', () => {
  const {state, watch} = fakeOverlays();
  state.active = true;
  watch();
  state.active = false;
  state.open = 1;
  watch();
  state.active = true;
  state.open = 0;
  watch();
  assert.equal(state.sends, 2, 'a contagem velha (0) não pode engolir o fechamento');
});
