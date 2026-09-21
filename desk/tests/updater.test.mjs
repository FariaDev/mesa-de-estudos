import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {makeZip} from './zipkit.mjs';

/* Checagem do updater com fetch falso (NUNCA rede de verdade): semver, cache
   de 24 h, fallback em tags, "desconhecido" sem erro e a lista de caminhos
   protegidos. O aplicação em si (git/zip/rollback) fica em updateflow.test.mjs. */
const require = createRequire(import.meta.url);
const updater = require('../updater.cjs');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-updater-test-'));

test('semver: comparação e isNewer', () => {
  assert.equal(updater.semverCompare('0.4.1', '0.4.0'), 1);
  assert.equal(updater.semverCompare('0.4.0', '0.4.1'), -1);
  assert.equal(updater.semverCompare('v0.4.0', '0.4.0'), 0);
  assert.equal(updater.semverCompare('0.4.0', 'lixo'), 0);
  assert.equal(updater.isNewer('0.4.1', '0.4.0'), true);
  assert.equal(updater.isNewer('0.4.0', '0.4.0'), false);
  assert.equal(updater.isNewer('0.3.9', '0.4.0'), false);
  assert.equal(updater.isNewer('', '0.4.0'), false);
});

test('checkForUpdates: versão maior vira update com notas e link', async () => {
  const visto = [];
  const result = await updater.checkForUpdates({
    current: '0.4.0',
    cacheFile: '',
    fetchJson: async (url) => {
      visto.push(url);
      return {tag_name: 'v0.4.1', body: 'o que mudou', html_url: 'https://github.com/x/releases/tag/v0.4.1'};
    },
  });
  assert.deepEqual(visto, [updater.RELEASES_URL]);
  assert.equal(result.status, 'update');
  assert.equal(result.version, '0.4.1');
  assert.equal(result.notes, 'o que mudou');
  assert.equal(result.url, 'https://github.com/x/releases/tag/v0.4.1');
});

test('checkForUpdates: igual ou local mais novo é "current"', async () => {
  const igual = await updater.checkForUpdates({current: '0.4.0', fetchJson: async () => ({tag_name: 'v0.4.0'})});
  assert.equal(igual.status, 'current');
  const frente = await updater.checkForUpdates({current: '0.5.0', fetchJson: async () => ({tag_name: 'v0.4.1'})});
  assert.equal(frente.status, 'current');
});

test('checkForUpdates: releases/latest falha → fallback em tags', async () => {
  const visto = [];
  const result = await updater.checkForUpdates({
    current: '0.4.0',
    fetchJson: async (url) => {
      visto.push(url);
      if (url === updater.RELEASES_URL) throw Error('HTTP 404');
      return [{name: 'v0.3.9'}, {name: 'v0.4.2'}, {name: 'v0.4.10'}];
    },
  });
  assert.deepEqual(visto, [updater.RELEASES_URL, updater.TAGS_URL]);
  assert.equal(result.status, 'update');
  assert.equal(result.version, '0.4.10', 'a tags pega a maior semver da lista');
});

test('checkForUpdates: erro de rede vira "error" silencioso (sem exceção)', async () => {
  const result = await updater.checkForUpdates({
    current: '0.4.0',
    fetchJson: async () => { throw Error('sem rede'); },
  });
  assert.equal(result.status, 'error');
  assert.match(result.error, /sem rede/);
  assert.equal(result.version, '');
});

test('checkForUpdates: cache de 24 h vale para a automática; o manual força', async () => {
  const cacheFile = path.join(tmp(), 'update.json');
  const agora = Date.now();
  let chamadas = 0;
  const fetchJson = async () => { chamadas++; return {tag_name: 'v0.4.1', body: 'notas', html_url: 'https://github.com/x'}; };

  const primeiro = await updater.checkForUpdates({current: '0.4.0', cacheFile, fetchJson, now: agora});
  assert.equal(chamadas, 1);
  assert.equal(primeiro.status, 'update');
  assert.equal(primeiro.cached, false);

  const dentro = await updater.checkForUpdates({current: '0.4.0', cacheFile, fetchJson, now: agora + 23 * 60 * 60 * 1000});
  assert.equal(chamadas, 1, 'cache de 24 h: a automática não vai à rede');
  assert.equal(dentro.status, 'update');
  assert.equal(dentro.cached, true);

  const manual = await updater.checkForUpdates({current: '0.4.0', manual: true, cacheFile, fetchJson, now: agora + 60 * 1000});
  assert.equal(chamadas, 2, 'o botão manual força a rede');
  assert.equal(manual.cached, false);

  const depois = await updater.checkForUpdates({current: '0.4.0', cacheFile, fetchJson, now: agora + 25 * 60 * 60 * 1000});
  assert.equal(chamadas, 3, 'depois de 24 h a automática checa de novo');
  assert.equal(depois.status, 'update');
});

test('checkForUpdates: sem cache válido e offline o erro é silencioso e não mente a versão', async () => {
  const cacheFile = path.join(tmp(), 'update.json');
  const agora = Date.now();
  updater.writeCache(cacheFile, {release: {at: agora - 30 * 60 * 60 * 1000, version: '0.4.1', notes: 'velho', url: 'https://github.com/x'}});
  const result = await updater.checkForUpdates({current: '0.4.0', cacheFile, fetchJson: async () => { throw Error('sem rede'); }});
  assert.equal(result.status, 'error', 'sem cache válido o erro é silencioso e não mente a versão');
});

test('markToasted: um toast por versão', () => {
  const cacheFile = path.join(tmp(), 'update.json');
  assert.equal(updater.markToasted(cacheFile, '0.4.1'), true);
  assert.equal(updater.markToasted(cacheFile, '0.4.1'), false);
  assert.equal(updater.markToasted(cacheFile, '0.4.2'), true);
});

test('piLatest: SÓ o registry @earendil-works; sem resposta = desconhecido', async () => {
  const visto = [];
  const ok = await updater.piLatest({
    manual: true,
    fetchJson: async (url) => { visto.push(url); return {version: '0.90.0'}; },
  });
  assert.deepEqual(visto, [updater.PI_REGISTRY_URL]);
  assert.match(updater.PI_REGISTRY_URL, /@earendil-works\/pi-coding-agent/);
  assert.ok(!updater.PI_REGISTRY_URL.includes('mariozechner'), 'sem fallback deprecado');
  assert.equal(ok.known, true);
  assert.equal(ok.version, '0.90.0');

  const sem = await updater.piLatest({manual: true, fetchJson: async () => { throw Error('HTTP 500'); }});
  assert.deepEqual(sem, {version: '', known: false}, 'sem resposta = desconhecido, sem erro');
});

test('xournalLatest: só informativo (tag v1.2.7 → 1.2.7)', async () => {
  const ok = await updater.xournalLatest({manual: true, fetchJson: async () => ({tag_name: 'v1.2.7'})});
  assert.deepEqual(ok, {version: '1.2.7', known: true});
  const sem = await updater.xournalLatest({manual: true, fetchJson: async () => { throw Error('sem rede'); }});
  assert.deepEqual(sem, {version: '', known: false});
});

test('readZip: store e deflate voltam com o mesmo conteúdo', () => {
  for (const deflate of [false, true]) {
    const zip = makeZip({'a.txt': 'um', 'dir/b.js': 'dois'}, {deflate});
    const entries = updater.readZip(zip);
    assert.deepEqual(entries.map((e) => e.name), ['a.txt', 'dir/b.js']);
    assert.equal(entries[0].data.toString(), 'um');
    assert.equal(entries[1].data.toString(), 'dois');
  }
});

test('caminhos protegidos nunca são substituíveis', () => {
  const protegidos = [
    'config.json', 'desk/config.json', 'desk/desk.json', 'desk/install-source.json',
    'desk/.runtime/desk.json', 'desk/.runtime/pi-1.jsonl', 'desk/node_modules/electron/index.js',
    'sessao.jsonl', 'livro.pdf', 'rascunho.xopp', 'desk/atual.log',
    'Mesa de Estudos.app/Contents/Info.plist', '', 'a/../b.txt', 'C:/x.txt',
  ];
  for (const rel of protegidos) {
    assert.equal(updater.isProtected(rel), true, `protegido: ${rel}`);
    assert.equal(updater.isReplaceable(rel), false, `não substituível: ${rel}`);
  }
});

test('lista explícita do modo zip: o código entra, o resto fica de fora', () => {
  const sim = [
    'desk/main.cjs', 'desk/updater.mjs', 'desk/index.html', 'desk/style.css', 'desk/README.md',
    'desk/package.json', 'desk/package-lock.json', 'desk/config.example.json',
    'desk/src/main.mjs', 'desk/src/generated/dialogsview.core.js', 'desk/assets/mesa.svg',
    'desk/templates/TUTOR.md', 'desk/scripts/install-app.mjs',
    'core/dialogsview.bend', 'core/laws/dialogsview.bend', 'geogebra/x.html',
    'visual-check/windows.swift', '.githooks/pre-push', 'README.md', 'AGENTS.md', 'LICENSE', '.gitignore',
  ];
  const nao = [
    'desk/design-desktop.png', 'desk/tests/ui-smoke.mjs', 'desk/debug2-layout.png',
    'qualquer-coisa.txt', 'playground/x.mjs', 'docs/HISTORIA.md', 'chat/main.cjs',
  ];
  for (const rel of sim) assert.equal(updater.isReplaceable(rel), true, `substituível: ${rel}`);
  for (const rel of nao) assert.equal(updater.isReplaceable(rel), false, `fora da lista: ${rel}`);
});

test('applyZip: confere a versão extraída e copia só a lista explícita', () => {
  const rootDir = tmp();
  fs.mkdirSync(path.join(rootDir, 'desk', '.runtime'), {recursive: true});
  fs.writeFileSync(path.join(rootDir, 'desk', 'main.cjs'), 'antigo');
  fs.writeFileSync(path.join(rootDir, 'desk', '.runtime', 'desk.json'), '{"keep":true}');
  const zip = makeZip({
    'mesa-de-estudos-0.4.1/desk/package.json': '{"version":"0.4.1"}',
    'mesa-de-estudos-0.4.1/desk/main.cjs': 'novo',
    'mesa-de-estudos-0.4.1/desk/.runtime/desk.json': 'ATAQUE',
  });
  const logs = [];
  const result = updater.applyZip(zip, {rootDir, announcedVersion: '0.4.1', log: (line) => logs.push(line)});
  assert.equal(result.version, '0.4.1');
  assert.equal(fs.readFileSync(path.join(rootDir, 'desk', 'main.cjs'), 'utf8'), 'novo');
  assert.equal(fs.readFileSync(path.join(rootDir, 'desk', '.runtime', 'desk.json'), 'utf8'), '{"keep":true}', 'caminho protegido intocado');
  assert.ok(result.skipped >= 1);
  assert.ok(logs.some((line) => /protegido/.test(line)), 'o pulado protegido é registrado');

  const ruim = makeZip({'x/desk/package.json': '{"version":"0.4.0"}'});
  assert.throws(() => updater.applyZip(ruim, {rootDir, announcedVersion: '0.4.1'}), /não bate/);

  const tiro = makeZip({'x/desk/package.json': '{"version":"0.4.1"}', 'x/../evil.txt': 'fuga'});
  assert.throws(() => updater.applyZip(tiro, {rootDir, announcedVersion: '0.4.1'}), /suspeito/);
});
