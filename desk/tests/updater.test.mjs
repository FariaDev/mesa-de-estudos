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

/* C5: SemVer mais duro — prerelease/build nunca vira "versão estável mais nova". */
test('semver: prerelease e build não são versão estável', () => {
  assert.equal(updater.semverParse('0.4.1-rc.1'), null);
  assert.equal(updater.semverParse('0.4.1+build.7'), null);
  assert.equal(updater.semverParse('v0.4.1-beta'), null);
  assert.equal(updater.isNewer('0.4.1-rc.1', '0.4.0'), false, 'prerelease não sugere atualização');
  assert.deepEqual(updater.semverParse('v0.4.1'), [0, 4, 1]);
  assert.deepEqual(updater.semverParse(' 0.4.2 '), [0, 4, 2]);
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

test('markToasted: um toast por versão (gravação serializada no cache)', async () => {
  const cacheFile = path.join(tmp(), 'update.json');
  assert.equal(await updater.markToasted(cacheFile, '0.4.1'), true);
  assert.equal(await updater.markToasted(cacheFile, '0.4.1'), false);
  assert.equal(await updater.markToasted(cacheFile, '0.4.2'), true);
});

/* D6/B4: respostas concorrentes em ordem inversa não perdem entrada do cache
   (inclusive a marca de toast) — a leitura/mutação/gravação acontece dentro da
   fila (cacheWrite), não "lê antes, escreve depois do await". */
test('cache: duas respostas em ordem inversa não se sobrescrevem', async () => {
  const cacheFile = path.join(tmp(), 'update.json');
  const fetchJson = (url) => {
    if (url === updater.RELEASES_URL) {
      return new Promise((resolve) => setTimeout(() => resolve({tag_name: 'v0.4.1', body: 'lenta', html_url: 'https://github.com/x'}), 60));
    }
    if (url === updater.TAGS_URL) return Promise.resolve([{name: 'v0.4.9'}]);
    throw Error('URL inesperada: ' + url);
  };
  /* A checagem lenta (release) e a rápida (tags) saem juntas; a rápida termina
     primeiro e escreve v0.4.9; a lenta chega DEPOIS e não pode apagar o que a
     rápida (nem a marca de toast, feita no meio) deixou. */
  const [lenta, rapida] = await Promise.all([
    updater.checkForUpdates({current: '0.4.0', cacheFile, fetchJson}),
    updater.checkForUpdates({current: '0.4.0', cacheFile, fetchJson}),
  ]);
  assert.equal(await updater.markToasted(cacheFile, '0.4.1'), true);
  const final = updater.readCache(cacheFile);
  assert.equal(final.toasted, '0.4.1', 'a marca de toast sobrevive às escritas concorrentes');
  assert.ok(final.release && /^\d+\.\d+\.\d+$/.test(final.release.version), 'a release fica no cache (lenta ou rápida, sem buraco)');
  assert.ok(['0.4.1', '0.4.9'].includes(final.release.version), `versão coerente com uma das respostas: ${final.release && final.release.version}`);
  assert.ok(lenta.status === 'update' && rapida.status === 'update');
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
    'desk/.update-manifest.json', '.update-manifest.json',
    'desk/.runtime/desk.json', 'desk/.runtime/pi-1.jsonl', 'desk/node_modules/electron/index.js',
    'sessao.jsonl', 'livro.pdf', 'rascunho.xopp', 'desk/atual.log',
    'Mesa de Estudos.app/Contents/Info.plist', '', 'a/../b.txt', 'C:/x.txt',
  ];
  for (const rel of protegidos) {
    assert.equal(updater.isProtected(rel), true, `protegido: ${rel}`);
    assert.equal(updater.isReplaceable(rel), false, `não substituível: ${rel}`);
  }
});

test('lista explícita do modo zip: o código entra (tests incluído), o resto fica de fora', () => {
  const sim = [
    'desk/main.cjs', 'desk/updater.mjs', 'desk/index.html', 'desk/style.css', 'desk/README.md',
    'desk/package.json', 'desk/package-lock.json', 'desk/config.example.json',
    'desk/src/main.mjs', 'desk/src/generated/dialogsview.core.js', 'desk/assets/mesa.svg',
    'desk/templates/TUTOR.md', 'desk/scripts/install-app.mjs',
    'desk/tests/updateflow.test.mjs', 'desk/tests/zipkit.mjs',
    'core/dialogsview.bend', 'core/laws/dialogsview.bend', 'geogebra/x.html',
    'visual-check/windows.swift', '.githooks/pre-push', 'README.md', 'AGENTS.md', 'LICENSE', '.gitignore',
  ];
  const nao = [
    'desk/design-desktop.png', 'desk/debug2-layout.png', 'desk/atual.log',
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
  assert.deepEqual(result.written, ['desk/package.json', 'desk/main.cjs'], 'o que foi escrito vira o manifesto da instalação');

  const ruim = makeZip({'x/desk/package.json': '{"version":"0.4.0"}'});
  assert.throws(() => updater.applyZip(ruim, {rootDir, announcedVersion: '0.4.1'}), /não bate/);

  const tiro = makeZip({'x/desk/package.json': '{"version":"0.4.1"}', 'x/../evil.txt': 'fuga'});
  assert.throws(() => updater.applyZip(tiro, {rootDir, announcedVersion: '0.4.1'}), /suspeito/);
});

/* ---------- A4: worker com handshake, node resolvido e lock ---------- */

test('A4/needsShell: shell só onde é inevitável (npm/npx no Windows)', () => {
  const fake = {platform: 'win32'};
  const real = process.platform;
  Object.defineProperty(process, 'platform', {value: fake.platform, configurable: true});
  try {
    assert.equal(updater.needsShell('npm'), true);
    assert.equal(updater.needsShell('npx.cmd'), true);
    assert.equal(updater.needsShell('git'), false);
    assert.equal(updater.needsShell('/tmp/com espaço/node'), false);
    assert.equal(updater.needsShell('xournalpp.exe'), false);
    Object.defineProperty(process, 'platform', {value: real, configurable: true});
    assert.equal(updater.needsShell('npm'), false, 'fora do Windows nada precisa de shell');
  } finally {
    Object.defineProperty(process, 'platform', {value: real, configurable: true});
  }
});

test('A4/resolveNode: acha o executável do node do sistema (e vazio sem candidato)', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'node'), '#!/bin/sh\n');
  fs.chmodSync(path.join(dir, 'node'), 0o755);
  assert.equal(updater.resolveNode(process.env, dir, {dirs: [dir]}), path.join(dir, 'node'), 'o node de um PATH injetado é achado');
  assert.equal(updater.resolveNode(process.env, dir, {dirs: [path.join(dir, 'vazio')]}), '', 'diretório sem node = vazio');
});

/* B5: caminhos com espaço/quase-comando na mão — o execFile NÃO passa por
   shell, então `&` e espaços chegam inteiros ao processo. */
test('B5: execução sem shell sobrevive a caminhos com espaço e &', async () => {
  const dir = path.join(tmp(), 'pasta com espaço & cliques');
  fs.mkdirSync(dir, {recursive: true});
  const script = path.join(dir, 'echozinho.cjs');
  fs.writeFileSync(script, 'process.stdout.write(JSON.stringify(process.argv.slice(1)));\n');
  const r = await updater.defaultRun(process.execPath, [script, 'a&b', 'c d']);
  const visto = JSON.parse(r.stdout);
  assert.deepEqual(visto, [script, 'a&b', 'c d'], 'caminho com espaço, & e espaços chegam crus (sem shell no meio)');
});

test('A4/spawnWorker: sem node do sistema o worker NEM COMEÇA (mensagem, app de pé)', () => {
  const vazio = tmp();
  const worker = updater.spawnWorker({runtime: ''}, {env: {}, home: vazio, dirs: [path.join(vazio, 'nada')]});
  assert.equal(worker.ok, false);
  assert.match(worker.error, /Node do sistema/);
});

test('A4/handshake: status confirma o arranque; ausência no prazo falha', async () => {
  const dir = tmp();
  const file = path.join(dir, 'status.json');
  assert.equal(await updater.waitForHandshake(file, 250, {pollMs: 40}), false, 'sem arquivo = sem handshake');
  updater.writeHandshake(file, {pid: process.pid, phase: 'started', at: Date.now()});
  assert.equal(await updater.waitForHandshake(file, 2000, {pollMs: 40}), true, 'arquivo escrito = handshake');
});

test('A4/lock: segunda aquisição recusa; lock velho (preso) é quebrado', () => {
  const runtime = tmp();
  const agora = Date.now();
  const primeira = updater.acquireLock(runtime, {now: agora});
  assert.equal(primeira.ok, true);
  const segunda = updater.acquireLock(runtime, {now: agora + 1000});
  assert.equal(segunda.ok, false, 'duas atualizações ao mesmo tempo não passam');
  assert.match(segunda.reason, /em andamento/);
  const presa = updater.acquireLock(runtime, {now: agora + updater.LOCK_STALE_MS + 1000});
  assert.equal(presa.ok, true, 'lock sem dono há mais de 30 min é quebrado');
  assert.equal(fs.existsSync(path.join(runtime, 'update.lock')), true);
  presa.release();
  assert.equal(fs.existsSync(path.join(runtime, 'update.lock')), false, 'o dono solta o lock');
});

/* Notas da release: o Sobre despeja texto puro (o Markdown bonito é do
   navegador, pelo botão) e o corte de 2000 é na fronteira de palavra. */
test('releaseFromGithub: notas viram texto puro e cortam na palavra', () => {
  const r = updater.releaseFromGithub({tag_name: 'v0.4.4', html_url: 'https://github.com/x', body: '## O que mudou\n**Forte** e `código` com [link](https://x)\n- item um\n* item dois\n\n\n\nfim'});
  assert.equal(r.notes, 'O que mudou\nForte e código com link\n• item um\n• item dois\n\nfim');
  const longo = updater.releaseFromGithub({tag_name: 'v0.4.4', html_url: '', body: 'palavra '.repeat(400)});
  assert.ok(longo.notes.length <= 2001, 'dentro do teto do Sobre');
  assert.ok(longo.notes.endsWith('…'), 'reticências dizem que tem mais');
  assert.equal(/[^\s…]$/.test(longo.notes.slice(0, -1)), true, 'o corte não parte palavra no meio');
});
