/* O Pi lateral recebe o modelo e o nível da conversa principal antes do
   primeiro envio (v1.0.2: com o Grok escolhido na principal, o lateral nascia
   no modelo padrão do Pi e ficava mudo). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {syncSideModel} = require('../sidechat-engine.cjs');

/** Ponte do Pi que só guarda os pedidos; `failOn` recusa um tipo de pedido. */
class RecordingPiBridge {
  constructor({failOn = ''} = {}) {
    this.requests = [];
    this.failOn = failOn;
  }
  async request(type, args) {
    this.requests.push([type, args]);
    if (type === this.failOn) throw Error(`recusa de teste em ${type}`);
    return {};
  }
}

test('aplica o modelo e o nível da principal, nessa ordem', async () => {
  const bridge = new RecordingPiBridge();
  await syncSideModel(bridge, async () => ({provider: 'xai', id: 'grok-4.6', level: 'high'}), assert.fail);
  assert.deepEqual(bridge.requests, [
    ['set_model', {provider: 'xai', modelId: 'grok-4.6'}],
    ['set_thinking_level', {level: 'high'}],
  ]);
});

test('sem modelo na principal, não pede nada', async () => {
  const bridge = new RecordingPiBridge();
  await syncSideModel(bridge, async () => null, assert.fail);
  assert.deepEqual(bridge.requests, []);
});

test('falha ao aplicar vai à nota com o modelo recebido, sem lançar', async () => {
  const bridge = new RecordingPiBridge({failOn: 'set_model'});
  const notes = [];
  await syncSideModel(bridge, async () => ({provider: 'xai', id: 'grok-4.6', level: null}), (line) => notes.push(line));
  assert.equal(notes.length, 1);
  assert.match(notes[0], /xai\/grok-4\.6.*recusa de teste em set_model/);
});
