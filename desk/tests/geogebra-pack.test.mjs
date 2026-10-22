/* Pacote offline do GeoGebra (#55): download com hash conferido, troca atômica e
   extração segura. O download é um fake com nome (`fakeDownload`); a extração
   real usa o `tar` do sistema contra um zip montado aqui. */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const pack = require('../geogebra-pack.cjs');
const {makeZip} = require('./fixtures/zip-writer.cjs');

const sha = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const tmp = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ggb-pack-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  return dir;
};
const GOOD_ENTRIES = {'README.txt': 'leia-me', 'GeoGebra/deployggb.js': '// deploy', 'GeoGebra/HTML5/5.0/web3d/web3d.nocache.js': '// web3d'};
const expectedFor = (zip) => ({version: '9.9.9', url: 'https://exemplo.test/pacote.zip', sha256: sha(zip), bytes: zip.length});
const fakeDownload = (zip, calls = []) => async (url) => { calls.push(url); return zip; };
const tarAvailable = !spawnSync('tar', ['--version']).error;

test('instala: confere o hash, extrai e grava o pack.json com a versão', {skip: !tarAvailable && 'sem tar'}, async (t) => {
  const zip = makeZip(GOOD_ENTRIES), expected = expectedFor(zip), calls = [];
  const dir = path.join(tmp(t), 'geogebra');
  const result = await pack.installPack({dir, fetchZip: fakeDownload(zip, calls), expected});
  assert.deepEqual(calls, [expected.url]);
  assert.equal(result.version, '9.9.9');
  assert.equal(fs.readFileSync(path.join(dir, 'GeoGebra/deployggb.js'), 'utf8'), '// deploy');
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'pack.json'), 'utf8')).sha256, expected.sha256);
  assert.deepEqual(fs.readdirSync(path.dirname(dir)), ['geogebra'], 'não sobra pasta temporária');
});

test('hash diferente: recusa com o valor recebido e o esperado, e não cria a pasta', async (t) => {
  const zip = makeZip(GOOD_ENTRIES), expected = {...expectedFor(zip), sha256: 'a'.repeat(64)};
  const dir = path.join(tmp(t), 'geogebra');
  await assert.rejects(
    pack.installPack({dir, fetchZip: fakeDownload(zip), extractZip() { assert.fail('não pode extrair um pacote que não confere'); }, expected}),
    (error) => error.message.includes(`recebido ${zip.length} bytes, sha256 ${sha(zip)}`) && error.message.includes('a'.repeat(64)),
  );
  assert.equal(fs.existsSync(dir), false);
  assert.deepEqual(fs.readdirSync(path.dirname(dir)), [], 'sem restos do download');
});

test('tamanho diferente com o mesmo hash esperado também é recusado', async (t) => {
  const zip = makeZip(GOOD_ENTRIES), expected = {...expectedFor(zip), bytes: zip.length + 1};
  await assert.rejects(pack.installPack({dir: path.join(tmp(t), 'g'), fetchZip: fakeDownload(zip), expected}), /não confere/);
});

test('pacote sem deployggb.js: recusa e mantém a instalação anterior', {skip: !tarAvailable && 'sem tar'}, async (t) => {
  const root = tmp(t), dir = path.join(root, 'geogebra');
  const good = makeZip(GOOD_ENTRIES);
  await pack.installPack({dir, fetchZip: fakeDownload(good), expected: expectedFor(good)});
  const empty = makeZip({'README.txt': 'só isso'});
  await assert.rejects(pack.installPack({dir, fetchZip: fakeDownload(empty), expected: expectedFor(empty)}), /não tem GeoGebra\/deployggb\.js/);
  assert.equal(fs.readFileSync(path.join(dir, 'GeoGebra/deployggb.js'), 'utf8'), '// deploy', 'a instalação anterior continua');
});

test('zip com ../ não escreve fora da pasta do pacote (regressão de zip-slip)', {skip: !tarAvailable && 'sem tar'}, async (t) => {
  const root = tmp(t), dir = path.join(root, 'sub', 'geogebra');
  const zip = makeZip({...GOOD_ENTRIES, '../../fugiu.txt': 'x', '../fugiu-perto.txt': 'x'});
  await assert.rejects(pack.installPack({dir, fetchZip: fakeDownload(zip), expected: expectedFor(zip)}), /Não foi possível extrair/);
  assert.equal(fs.existsSync(dir), false, 'pacote suspeito não vira instalação');
  const found = fs.readdirSync(root, {recursive: true}).filter((name) => String(name).includes('fugiu'));
  assert.deepEqual(found, [], `nada escapou de ${dir}`);
});

test('readInstalledPack: só vale a versão e o hash fixados, com o arquivo de entrada', async (t) => {
  const dir = path.join(tmp(t), 'geogebra');
  assert.equal(pack.readInstalledPack(dir), null, 'sem pasta');
  fs.mkdirSync(path.join(dir, 'GeoGebra'), {recursive: true});
  fs.writeFileSync(path.join(dir, 'GeoGebra/deployggb.js'), '//');
  fs.writeFileSync(path.join(dir, 'pack.json'), JSON.stringify({version: '0.0.1', sha256: pack.PACK.sha256}));
  assert.equal(pack.readInstalledPack(dir), null, 'outra versão');
  fs.writeFileSync(path.join(dir, 'pack.json'), JSON.stringify({version: pack.PACK.version, sha256: 'outro'}));
  assert.equal(pack.readInstalledPack(dir), null, 'outro hash');
  fs.writeFileSync(path.join(dir, 'pack.json'), '{estragado');
  assert.equal(pack.readInstalledPack(dir), null, 'pack.json ilegível');
  fs.writeFileSync(path.join(dir, 'pack.json'), JSON.stringify({version: pack.PACK.version, sha256: pack.PACK.sha256}));
  assert.deepEqual(pack.readInstalledPack(dir), {version: pack.PACK.version, sha256: pack.PACK.sha256});
  fs.rmSync(path.join(dir, 'GeoGebra/deployggb.js'));
  assert.equal(pack.readInstalledPack(dir), null, 'falta o arquivo de entrada');
  assert.equal(pack.readInstalledPack(''), null);
});

test('a versão fixada tem URL, tamanho e hash coerentes entre si', () => {
  assert.match(pack.PACK.url, /^https:\/\/download\.geogebra\.org\/installers\/.+\.zip$/);
  assert.ok(pack.PACK.url.includes(pack.PACK.version.replaceAll('.', '-')), 'a URL carrega a versão');
  assert.match(pack.PACK.sha256, /^[0-9a-f]{64}$/);
  assert.ok(pack.PACK.bytes > 1_000_000);
});

test('packDirFor e removePack', (t) => {
  const root = tmp(t), dir = pack.packDirFor(root);
  assert.equal(dir, path.join(root, 'desk', '.runtime', 'geogebra'));
  fs.mkdirSync(dir, {recursive: true});
  pack.removePack(dir);
  assert.equal(fs.existsSync(dir), false);
});
