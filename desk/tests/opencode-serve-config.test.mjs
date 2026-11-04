/* Config do `opencode serve` (#91): ferramentas nativas desligadas, permissões
   em deny e nenhum plugin. Se a gravação do diretório falhar, o servidor sobe
   com o MESMO JSON inline; nunca herda config de outro app em `ask`. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {delimiter, join} from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {CONFIG, NATIVE_TOOLS, PERMISSION, TOOLS, serveEnv, writeServeConfig} = require('../src/agents/opencode-serve-config.cjs');

test('o config desliga todas as nativas e mantém permission em deny', () => {
  for (const name of ['bash', 'shell', 'edit', 'write', 'read', 'glob', 'grep', 'list', 'task', 'webfetch', 'websearch', 'question']) {
    assert.equal(TOOLS[name], false, `${name} desligada`);
  }
  for (const name of ['bash', 'shell', 'edit', 'write', 'read']) assert.equal(PERMISSION[name], 'deny');
  /* O `tools` sozinho não fecha `execute`/`skill`/`opencode_*` no 2.2.4: a
     regra `*` nega tudo e `mesa_*` abre só o MCP da Mesa. */
  assert.equal(PERMISSION['*'], 'deny');
  assert.equal(PERMISSION['mesa_*'], 'allow');
  assert.equal(PERMISSION.ask, undefined);
  assert.equal(CONFIG.plugin, undefined);
  assert.equal(NATIVE_TOOLS.length, Object.keys(TOOLS).length);
});

test('writeServeConfig grava o JSON no runtime e devolve o diretório', () => {
  const runtime = mkdtempSync(join(tmpdir(), 'mesa-serve-config-'));
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
  const home = mkdtempSync(join(tmpdir(), 'mesa-serve-path-'));
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
  assert.equal(JSON.parse(env.OPENCODE_CONFIG_CONTENT).permission.bash, 'deny');
  assert.equal(JSON.parse(env.OPENCODE_CONFIG_CONTENT).permission['*'], 'deny');
  assert.equal(JSON.parse(env.OPENCODE_CONFIG_CONTENT).permission['mesa_*'], 'allow');
  assert.equal(env.OPENCODE_DISABLE_CLAUDE_CODE, '1');
});
