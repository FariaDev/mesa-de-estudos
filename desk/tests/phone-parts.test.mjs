import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {orientationSize, orientationMatrix} from '../src/phone-orientation.mjs';

/* Foto do celular (#36): as peças puras do host — o QR code sem dependência,
   a escolha da interface de rede e o artefato do núcleo — e a conta de
   rotação do renderer. O servidor de verdade está em `phone-host.test.mjs`. */
const require = createRequire(import.meta.url);
const {qrMatrix, pickVersion, rsRemainder, rsDivisor} = require('../phone-qr.cjs');
const {lanCandidates} = require('../phone-network.cjs');
const core = require('../src/generated/phonedrop.core.js').default;

test('Reed-Solomon bate com o exemplo da norma (HELLO WORLD, versão 1-M)', () => {
  const data = [0x20, 0x5b, 0x0b, 0x78, 0xd1, 0x72, 0xdc, 0x4d, 0x43, 0x40, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11];
  assert.deepEqual(rsRemainder(data, rsDivisor(10)), [196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
});

test('a versão cresce com o texto e recusa o que não cabe', () => {
  assert.equal(pickVersion(14), 1);
  assert.equal(pickVersion(15), 2);
  assert.equal(pickVersion(50), 4);
  assert.equal(pickVersion(213), 10);
  assert.throws(() => pickVersion(214), /214 bytes não cabe/);
});

test('o QR do endereço tem os três localizadores, o relógio e o tamanho da versão', () => {
  const {size, version, rows} = qrMatrix('http://192.168.0.10:51234/AbCdEfGhIjKlMnOpQrStUvWx');
  assert.equal(version, 4);
  assert.equal(size, 33);
  assert.equal(rows.length, size);
  const finder = ['1111111', '1000001', '1011101', '1011101', '1011101', '1000001', '1111111'];
  for (let i = 0; i < 7; i++) {
    assert.equal(rows[i].slice(0, 7), finder[i]);
    assert.equal(rows[i].slice(size - 7), finder[i]);
    assert.equal(rows[size - 7 + i].slice(0, 7), finder[i]);
  }
  assert.equal(rows[6].slice(8, size - 8), '10'.repeat((size - 16) / 2) + '1');
  assert.equal(rows[size - 8][8], '1', 'o módulo escuro fixo');
});

test('o mesmo endereço sempre dá o mesmo QR', () => {
  const text = 'http://10.0.0.7:4000/zzzzzzzzzzzzzzzzzzzzzzzz';
  assert.deepEqual(qrMatrix(text), qrMatrix(text));
  assert.throws(() => qrMatrix(''), /Texto do QR code inválido/);
});

test('a rede local vem antes; VPN, ponte, contêiner e link-local ficam fora', () => {
  const v4 = (address, internal = false) => ({family: 'IPv4', address, internal});
  const found = lanCandidates({
    lo0: [v4('127.0.0.1', true)],
    utun4: [v4('10.8.0.2')],
    bridge100: [v4('192.168.64.1')],
    vboxnet0: [v4('192.168.56.1')],
    docker0: [v4('172.17.0.1')],
    'vEthernet (WSL)': [v4('172.28.0.1')],
    tailscale0: [v4('100.101.1.2')],
    en7: [v4('169.254.10.2')],
    en1: [v4('10.0.0.12')],
    en0: [{family: 'IPv6', address: 'fe80::1', internal: false}, v4('192.168.0.23')],
    'Wi-Fi': [v4('172.20.10.3')],
  });
  assert.deepEqual(found, [
    {name: 'en0', address: '192.168.0.23'},
    {name: 'en1', address: '10.0.0.12'},
    {name: 'Wi-Fi', address: '172.20.10.3'},
  ]);
  assert.deepEqual(lanCandidates({}), []);
});

test('o artefato do núcleo responde como as leis', () => {
  assert.deepEqual(core.step({$: 'PhoneReceived', count: 2}, {$: 'EvStop'}), {$: 'PhoneStopped', count: 2});
  assert.equal(core.door(true, false, {$: 'PageRoute'}).$, 'DoorClosed');
  assert.equal(core.photo(true, {$: 'KindJpeg'}, core.maxFileBytes() + 1, 0, 0).$, 'PhotoTooLarge');
  assert.equal(core.verdictStatus({$: 'PhotoGone'}), 404);
});

test('a rotação do EXIF troca largura e altura de 5 a 8', () => {
  assert.deepEqual(orientationSize(1, 64, 32), {width: 64, height: 32});
  assert.deepEqual(orientationSize(3, 64, 32), {width: 64, height: 32});
  assert.deepEqual(orientationSize(6, 64, 32), {width: 32, height: 64});
  assert.deepEqual(orientationSize(8, 64, 32), {width: 32, height: 64});
});

test('a matriz leva cada canto da foto ao lugar certo', () => {
  const apply = ([a, b, c, d, e, f], x, y) => [a * x + c * y + e, b * x + d * y + f];
  /* Orientação 6 (celular em pé): o canto de cima à esquerda da foto crua vai para cima à direita. */
  assert.deepEqual(apply(orientationMatrix(6, 64, 32), 0, 0), [32, 0]);
  assert.deepEqual(apply(orientationMatrix(6, 64, 32), 64, 0), [32, 64]);
  /* Orientação 3 (de cabeça para baixo). */
  assert.deepEqual(apply(orientationMatrix(3, 64, 32), 0, 0), [64, 32]);
  /* Orientação 8: o canto de cima à esquerda vai para baixo à esquerda. */
  assert.deepEqual(apply(orientationMatrix(8, 64, 32), 0, 0), [0, 64]);
  assert.deepEqual(orientationMatrix(1, 64, 32), [1, 0, 0, 1, 0, 0]);
  assert.deepEqual(orientationMatrix(99, 64, 32), [1, 0, 0, 1, 0, 0], 'valor fora de 1 a 8 vale como 1');
});
