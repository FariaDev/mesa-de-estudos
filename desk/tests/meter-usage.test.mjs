/* Amostra do medidor a partir da leitura de saúde (#58). Sem `contextUsage`,
   o resultado é null: quem pinta chama `updateMeter(null)` e o número antigo
   sai da tela, que é o que a compactação manual do Claude pede. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {meterUsage} from '../src/meter-usage.mjs';

const sample = {tokens: 1200, contextWindow: 200000, percent: 1};

test('meterUsage: leitura com número devolve a amostra', () => {
  assert.deepEqual(meterUsage({ok: true, contextUsage: sample}), sample);
});

test('meterUsage: leitura sem número apaga o medidor', () => {
  assert.equal(meterUsage({ok: true}), null);
  assert.equal(meterUsage({contextUsage: null}), null);
  assert.equal(meterUsage({contextUsage: 42}), null, 'número solto não é amostra');
  assert.equal(meterUsage(null), null);
  assert.equal(meterUsage(undefined), null);
});
