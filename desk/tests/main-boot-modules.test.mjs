// Módulos que saíram do main.cjs na #43 fase 2: config da partida, log,
// cache do GeoGebra, versão, sanitização do desk.json e a varredura de boot da
// promoção Livre. Tudo num runtime temporário.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {applyEnvOverrides, loadBootConfig} = require('../desk-boot-config.cjs');
const {createDeskLog} = require('../desk-log.cjs');
const {createGgbCache} = require('../ggb-cache.cjs');
const {createDeskVersionLabel} = require('../desk-version.cjs');
const sanitize = require('../desk-state-sanitize.cjs');
const {recoverFreePromotions} = require('../free-boot-recovery.cjs');

const dirs = [];
after(() => { for (const dir of dirs) fs.rmSync(dir, {recursive: true, force: true}); });
function tempDir(tag) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `mesa-boot-${tag}-`));
  dirs.push(dir);
  return dir;
}

test('applyEnvOverrides fixa cofre, Pi e Claude do ambiente e deixa o resto', () => {
  const config = applyEnvOverrides({vaultPath: '/a', piPath: '/pi', claudePath: '', xournalPath: '/x'},
    {LEARNING_VAULT: '/cofre', LEARNING_DESK_CLAUDE: '/claude'});
  assert.deepEqual(config, {vaultPath: '/cofre', piPath: '/pi', claudePath: '/claude', xournalPath: '/x'});
});

test('loadBootConfig sem arquivo e com cofre no ambiente não grava nada', () => {
  const dir = tempDir('cfg');
  const configFile = path.join(dir, 'config.json');
  const config = loadBootConfig({configFile, env: {LEARNING_VAULT: dir, LEARNING_DESK_PI: '/pi'}, persist: true});
  assert.equal(config.vaultPath, dir);
  assert.equal(config.piPath, '/pi');
  assert.equal(fs.existsSync(configFile), false);
});

test('createDeskLog grava JSON por linha, traduz quando pode e nunca lança', () => {
  const logFile = path.join(tempDir('log'), 'desk.log');
  const appendLog = createDeskLog({logFile, logText: (raw) => { if (raw === 'boom') throw Error('sem idioma'); return raw.toUpperCase(); }});
  appendLog('main', 'oi  ');
  appendLog('main', 'boom');
  appendLog('main', '   ');
  const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  assert.deepEqual(lines.map(({area, msg, level}) => [area, msg, level]), [['main', 'OI', 'info'], ['main', 'boom', 'info']]);
  assert.doesNotThrow(() => createDeskLog({logFile: path.join(logFile, 'nao', 'existe'), logText: (raw) => raw})('main', 'x'));
});

test('createGgbCache grava, relê, não regrava o mesmo valor e apaga o vazio', () => {
  const dir = path.join(tempDir('ggb'), 'ggb');
  const logs = [];
  const cache = createGgbCache({dir, log: (area, line) => logs.push([area, line])});
  cache.persist('calc', 'QUJD');
  assert.equal(cache.read('calc'), 'QUJD');
  fs.writeFileSync(path.join(dir, 'calc.b64'), 'mudado à mão');
  cache.persist('calc', 'QUJD');
  assert.equal(fs.readFileSync(path.join(dir, 'calc.b64'), 'utf8'), 'mudado à mão', 'mesmo valor não regrava');
  assert.equal(cache.read('calc'), '', 'conteúdo que não é base64 é recusado');
  cache.persist('calc', '');
  assert.equal(fs.existsSync(path.join(dir, 'calc.b64')), false);
  assert.equal(cache.read(''), '');
  assert.deepEqual(logs, []);
});

test('createDeskVersionLabel memoriza e cai no package.json sem versão do app', () => {
  let calls = 0;
  const label = createDeskVersionLabel({app: {getVersion: () => { calls++; return ''; }}, deskDir: tempDir('ver')});
  const pkg = require('../package.json');
  assert.equal(label(), pkg.version);
  assert.equal(label(), pkg.version);
  assert.equal(calls, 1);
});

test('sanitizeState sana tipos, rotações e limites sem perder campo desconhecido', () => {
  const state = sanitize.sanitizeState({pdfs: 'x', extra: 7, pdfRotations: {'/a.pdf': 90, '/b.pdf': 45, __proto__: 1},
    courseStates: {c: {sessions: [{path: '/s'}, {path: ''}, 3]}}, bounds: {x: 0, y: 0, width: 0, height: 10}});
  assert.deepEqual(state.pdfs, []);
  assert.equal(state.extra, 7);
  assert.deepEqual(state.pdfRotations, {'/a.pdf': 90});
  assert.deepEqual(state.courseStates.c.sessions, [{path: '/s'}]);
  assert.equal('bounds' in state, false);
  assert.deepEqual(state.free, {activeId: '', sessions: {}});
  assert.equal(sanitize.sanitizeRotation(271), 0);
});

test('sanitizePdfPageOffsets aceita só caminho absoluto com deslocamento inteiro e limitado', () => {
  assert.deepEqual(sanitize.sanitizePdfPageOffsets({'/a.pdf': 3, 'rel.pdf': 2, '/b.pdf': 1.5, '/c.pdf': 2000000}), {'/a.pdf': 3});
  assert.deepEqual(sanitize.sanitizePdfPageOffsets(null), {});
});

test('recoverFreePromotions num runtime vazio não lança nem loga falha', () => {
  const logs = [];
  recoverFreePromotions({runtime: tempDir('free'), config: {courses: []}, log: (line) => logs.push(line)});
  assert.deepEqual(logs.filter((line) => /falhou/.test(line)), []);
});

test('sanitizeState guarda os recentes do seletor de modelo por motor e descarta o que não é par de texto (#59)', () => {
  const state = sanitize.sanitizeState({modelRecents: {pi: [['xai', 'grok-4'], ['ruim'], [1, 2]], opencode: 'x'}});
  assert.deepEqual(state.modelRecents, {pi: [['xai', 'grok-4']]});
  assert.deepEqual(sanitize.sanitizeState({}).modelRecents, {});
  assert.deepEqual(sanitize.sanitizeModelRecents({claude: [['anthropic', '']]}), {claude: [['anthropic', '']]});
});

test('sanitizeState guarda os favoritos do seletor por motor, fora do config.json, e descarta lixo', () => {
  const state = sanitize.sanitizeState({modelFavorites: {pi: [['xai', 'grok-4'], ['ruim'], [1, 2]], opencode: 'x'}});
  assert.deepEqual(state.modelFavorites, {pi: [['xai', 'grok-4']]});
  assert.deepEqual(sanitize.sanitizeState({}).modelFavorites, {});
  assert.deepEqual(sanitize.sanitizeModelFavorites([['xai', 'grok-4']]), {}, 'lista solta não é mapa por motor');
});
