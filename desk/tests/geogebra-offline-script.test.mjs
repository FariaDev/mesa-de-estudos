/* Passo opcional do setup que baixa o GeoGebra offline (#55): só baixa com o
   consentimento, nunca derruba o setup e deixa a pessoa pular. A instalação é um
   fake com nome (`fakeInstall`); o download de verdade fica fora dos testes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {PassThrough} from 'node:stream';
import {createRequire} from 'node:module';
import {offerGeogebraOffline, consentText, askYesNo} from '../scripts/geogebra-offline.mjs';
const require = createRequire(import.meta.url);
const {PACK} = require('../geogebra-pack.cjs');

function harness(t, {answer = false, installError = null} = {}) {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ggb-offer-')), 'geogebra');
  t.after(() => fs.rmSync(path.dirname(dir), {recursive: true, force: true}));
  const lines = [], asked = [], installs = [];
  return {
    dir, lines, asked, installs,
    log: (line) => lines.push(line),
    ask: async (question) => { asked.push(question); return answer; },
    install: async (options) => { installs.push(options.dir); if (installError) throw installError; },
  };
}
const offer = (h, choice) => offerGeogebraOffline({choice, log: h.log, ask: h.ask, install: h.install, dir: h.dir});

test('o consentimento diz de onde baixa, o tamanho, a licença e que a Mesa não distribui', () => {
  const text = consentText();
  assert.ok(text.includes(PACK.url));
  assert.match(text, /geogebra\.org\/license/);
  assert.match(text, /não comercial/);
  assert.match(text, /A Mesa não distribui o pacote/);
  assert.match(text, /32 MB de download, 116 MB no disco/);
});

test('--no-geogebra pula sem perguntar nem baixar', async (t) => {
  const h = harness(t);
  assert.equal(await offer(h, 'no'), 'skipped');
  assert.deepEqual([h.asked, h.installs], [[], []]);
});

test('sem resposta afirmativa (ou sem terminal), não baixa', async (t) => {
  const h = harness(t, {answer: false});
  assert.equal(await offer(h, 'ask'), 'skipped');
  assert.equal(h.asked.length, 1);
  assert.deepEqual(h.installs, []);
  assert.match(h.lines.join('\n'), /npm run geogebra:offline/, 'diz como baixar depois');
});

test('a pessoa aceita: mostra a licença, baixa uma vez e avisa para reabrir', async (t) => {
  const h = harness(t, {answer: true});
  assert.equal(await offer(h, 'ask'), 'installed');
  assert.deepEqual(h.installs, [h.dir]);
  const out = h.lines.join('\n');
  assert.ok(out.indexOf('licença') < out.indexOf('pronto em'), 'a licença aparece antes do download');
  assert.match(out, /Reabra a Mesa/);
});

test('--geogebra já é o consentimento: não pergunta', async (t) => {
  const h = harness(t);
  assert.equal(await offer(h, 'yes'), 'installed');
  assert.equal(h.asked.length, 0);
});

test('falha no download não derruba o setup e diz que o applet da web segue valendo', async (t) => {
  const h = harness(t, {installError: new Error('sem rede')});
  assert.equal(await offer(h, 'yes'), 'failed');
  const out = h.lines.join('\n');
  assert.match(out, /sem rede/);
  assert.match(out, /applet da web/);
});

test('pacote já instalado: não pergunta nem baixa de novo', async (t) => {
  const h = harness(t);
  fs.mkdirSync(path.join(h.dir, 'GeoGebra'), {recursive: true});
  fs.writeFileSync(path.join(h.dir, 'GeoGebra/deployggb.js'), '//');
  fs.writeFileSync(path.join(h.dir, 'pack.json'), JSON.stringify({version: PACK.version, sha256: PACK.sha256}));
  assert.equal(await offer(h, 'ask'), 'already');
  assert.deepEqual([h.asked, h.installs], [[], []]);
});

test('askYesNo: sem terminal é não; com terminal só s/sim/y/yes é sim', async () => {
  assert.equal(await askYesNo('?', {interactive: false}), false);
  for (const [typed, expected] of [['s', true], ['SIM', true], ['y', true], ['yes', true], ['', false], ['n', false], ['talvez', false]]) {
    const input = new PassThrough(), output = new PassThrough();
    const pending = askYesNo('? ', {input, output, interactive: true});
    input.write(typed + '\n');
    assert.equal(await pending, expected, JSON.stringify(typed));
  }
});
