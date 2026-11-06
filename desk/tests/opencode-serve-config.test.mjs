/* Config do `opencode serve` (#91): sem a chave `tools`, permissões em deny e
   `read` oferecido só pelo sentinela que não existe. Se a gravação do
   diretório falhar, o servidor sobe com o MESMO JSON inline; nunca herda
   config de outro app em `ask`. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {delimiter, join, relative, resolve} from 'node:path';
import {createRequire} from 'node:module';
import {trackTempDir} from './temp-dir.mjs';

const require = createRequire(import.meta.url);
const {CONFIG, PERMISSION, READ_SENTINEL, serveEnv, writeServeConfig} = require('../src/agents/opencode-serve-config.cjs');

test('o config não tem tools, nega as nativas e libera só o MCP mesa', () => {
  /* A chave `tools` não pode voltar: com ela o Zen devolve 429 mesmo com
     `read` ligado (bisseção de 2026-11-05). */
  assert.equal(Object.hasOwn(CONFIG, 'tools'), false);
  assert.equal(Object.hasOwn(CONFIG, 'plugin'), false);
  assert.deepEqual(Object.keys(CONFIG).sort(), ['$schema', 'permission']);
  for (const name of ['bash', 'shell', 'edit', 'write']) assert.equal(PERMISSION[name], 'deny');
  assert.equal(PERMISSION['*'], 'deny');
  assert.equal(PERMISSION['mesa_*'], 'allow');
  assert.equal(PERMISSION.ask, undefined);
  /* A ordem é a regra: `read` por último, senão o `*: deny` desfaz o allow do
     sentinela e o 2.2.4 retira a ferramenta (medido em 2026-11-05). */
  assert.deepEqual(Object.keys(PERMISSION), ['*', 'mesa_*', 'bash', 'shell', 'edit', 'write', 'read']);
});

test('read só oferece o sentinela inexistente; todo caminho real fica negado', () => {
  assert.deepEqual(PERMISSION.read, {'*': 'deny', '/mesa-nada-existe/*': 'allow'});
  assert.equal(READ_SENTINEL, '/mesa-nada-existe/*');
  /* Não é pasta da Mesa, do projeto nem da pessoa: nenhum caminho real casa
     com o allow; o `*: deny` já fecha todos os outros. */
  const workspace = trackTempDir(mkdtempSync(join(tmpdir(), 'mesa-serve-sentinel-')));
  try {
    assert.equal(relative(workspace, resolve('/mesa-nada-existe')).startsWith('..'), true);
  } finally {
    rmSync(workspace, {recursive: true, force: true});
  }
  const allowRules = Object.entries(PERMISSION.read).filter(([, effect]) => effect === 'allow');
  assert.deepEqual(allowRules, [['/mesa-nada-existe/*', 'allow']]);
  /* Sem write/edit/bash na config, o modelo não tem como criar o sentinela. */
  for (const name of ['bash', 'shell', 'edit', 'write']) assert.notEqual(PERMISSION[name], 'allow');
});

test('o sentinela do read não alcança caminho do Windows (lido do código)', () => {
  const source = readFileSync(new URL('../src/agents/opencode-serve-config.cjs', import.meta.url), 'utf8');
  assert.match(source, /const READ_SENTINEL = '\/mesa-nada-existe\/\*';/);
  assert.equal(source.includes('homedir'), false, 'o sentinela não vem da pasta da pessoa');
  /* O allow começa com `/`: `C:\mesa-nada-existe\…`, que é absoluto no
     Windows, não casa com ele; o `*: deny` do read e o external_directory
     fecham o que sobrar. */
  const windowsSentinel = 'C:\\mesa-nada-existe\\isca.txt';
  assert.equal(windowsSentinel.startsWith('/mesa-nada-existe/'), false);
  assert.equal(READ_SENTINEL.startsWith('C:'), false);
});

test('writeServeConfig grava o JSON no runtime e devolve o diretório', () => {
  const runtime = trackTempDir(mkdtempSync(join(tmpdir(), 'mesa-serve-config-')));
  try {
    const dir = writeServeConfig({runtime});
    assert.equal(dir, join(runtime, 'opencode-config'));
    assert.deepEqual(JSON.parse(readFileSync(join(dir, 'opencode.json'), 'utf8')), CONFIG);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});

test('serveEnv aponta o diretório gravado, limpa o config herdado e desliga o config da pasta', () => {
  const env = serveEnv({OPENCODE_CONFIG: '/outro/opencode.json', OPENCODE_CONFIG_CONTENT: '{"permission":{"bash":"allow"}}', OPENCODE_CONFIG_DIR: '/velho', OPENCODE_PERMISSION: '{"bash":"ask"}', OPENCODE_CLI_CONFIG_CONTENT: '{}', MESA: '1'}, '/r/opencode-config');
  assert.equal(env.MESA, '1');
  assert.equal(env.OPENCODE_CONFIG_DIR, '/r/opencode-config');
  assert.equal(env.OPENCODE_CONFIG, undefined);
  assert.equal(env.OPENCODE_CONFIG_CONTENT, undefined);
  assert.equal(env.OPENCODE_PERMISSION, undefined);
  assert.equal(env.OPENCODE_CLI_CONFIG_CONTENT, undefined);
  /* Sem isto, um `opencode.json` na pasta da sessão reabre shell/edit/read
     (medido no 1.19.5 e no 2.2.4). */
  assert.equal(env.OPENCODE_DISABLE_PROJECT_CONFIG, '1');
  assert.equal(env.OPENCODE_DISABLE_CLAUDE_CODE, '1');
});

test('serveEnv põe os binários do usuário no PATH do serve (claude do Finder)', () => {
  const home = trackTempDir(mkdtempSync(join(tmpdir(), 'mesa-serve-path-')));
  try {
    mkdirSync(join(home, '.local', 'bin'), {recursive: true});
    const env = serveEnv({HOME: home, PATH: ['/usr/bin', '/bin'].join(delimiter)}, null);
    assert.equal(env.PATH.split(delimiter)[0], join(home, '.local', 'bin'), '~/.local/bin entra antes do PATH mínimo');
    assert.ok(env.PATH.split(delimiter).includes('/usr/bin'));
  } finally {
    rmSync(home, {recursive: true, force: true});
  }
});

test('sem diretório o MESMO JSON vai inline, nunca ask', () => {
  const env = serveEnv({OPENCODE_CONFIG: '/outro', OPENCODE_CONFIG_CONTENT: '{"permission":{"bash":"allow"}}', OPENCODE_CONFIG_DIR: '/velho', OPENCODE_PERMISSION: '{"bash":"ask"}'}, null);
  assert.equal(env.OPENCODE_CONFIG, undefined);
  assert.equal(env.OPENCODE_CONFIG_DIR, undefined);
  assert.equal(env.OPENCODE_PERMISSION, undefined);
  assert.equal(env.OPENCODE_DISABLE_PROJECT_CONFIG, '1');
  assert.deepEqual(JSON.parse(env.OPENCODE_CONFIG_CONTENT), CONFIG);
  const inline = JSON.parse(env.OPENCODE_CONFIG_CONTENT);
  assert.equal(inline.tools, undefined);
  assert.equal(inline.permission.bash, 'deny');
  assert.equal(inline.permission['*'], 'deny');
  assert.equal(inline.permission['mesa_*'], 'allow');
  assert.deepEqual(inline.permission.read, {'*': 'deny', '/mesa-nada-existe/*': 'allow'});
  assert.equal(env.OPENCODE_DISABLE_CLAUDE_CODE, '1');
});

test('config da pessoa e OPENCODE_CONFIG_CONTENT não reabrem permission nem tools', () => {
  const personal = {model: 'acme/m1', permission: {bash: 'allow', '*': 'allow', read: 'allow'}, tools: {bash: true, read: true}};
  const env = serveEnv({OPENCODE_CONFIG_CONTENT: '{"permission":{"bash":"allow"}}'}, null, personal);
  const inline = JSON.parse(env.OPENCODE_CONFIG_CONTENT);
  assert.equal(inline.model, 'acme/m1');
  assert.equal(inline.tools, undefined);
  assert.deepEqual(inline.permission, PERMISSION);
});
