/* Config da pessoa no OpenCode (#93): o provider, o modelo e o small_model do
   `opencode.json[c]` global entram no servidor da Mesa; permissão, ferramenta,
   MCP, plugin, agente, instrução, skill e experimental NÃO entram. Lista
   permitida, não lista de bloqueio: chave desconhecida também fica fora. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {readPersonalConfig, serveEnv} = require('../src/agents/opencode-serve-config.cjs');
const {sanitizePersonalConfig} = require('../src/agents/opencode-personal-config.cjs');

function tempHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-oc-personal-'));
  const config = path.join(home, '.config', 'opencode');
  fs.mkdirSync(config, {recursive: true});
  return {home, config};
}

test('lê o opencode.jsonc global e herda só provider, model e small_model', () => {
  const {home, config} = tempHome();
  try {
    fs.writeFileSync(path.join(config, 'opencode.jsonc'), `{
      // comentário da pessoa
      "$schema": "https://opencode.ai/config.json",
      "model": "acme/m1",
      "small_model": "acme/m2",
      "provider": {
        "acme": {
          "npm": "@ai-sdk/openai-compatible",
          "options": {"baseURL": "http://127.0.0.1:1/v1"},
          "models": {"m1": {"name": "M1"}, "m2": {"name": "M2"}},
        },
      },
      "permission": {"shell": "allow", "*": "allow"},
      "tools": {"bash": true, "shell": true},
      "mcp": {"evil": {"type": "local", "command": ["sh", "-c", "echo pwn"]}},
      "plugin": ["/tmp/evil-plugin.js"],
      "agent": {"build": {"prompt": "AGENT-SECRET", "tools": {"shell": true}}},
      "instructions": ["/tmp/evil.md"],
      "skill": {"paths": ["/tmp/evil-skills"]},
      "experimental": {"hook": {"file_edited": {}}},
      "chave_desconhecida": {"abre": "tudo"}
    }`);
    const personal = readPersonalConfig({env: {HOME: home, XDG_CONFIG_HOME: path.join(home, '.config')}, home, platform: 'linux'});
    assert.deepEqual(Object.keys(personal).sort(), ['model', 'provider', 'small_model']);
    assert.equal(personal.model, 'acme/m1');
    assert.equal(personal.small_model, 'acme/m2');
    assert.equal(personal.provider.acme.models.m1.name, 'M1');
    for (const forbidden of ['permission', 'tools', 'mcp', 'plugin', 'agent', 'instructions', 'skill', 'experimental', 'chave_desconhecida']) {
      assert.equal(Object.hasOwn(personal, forbidden), false, `${forbidden} não passa`);
    }
  } finally {
    fs.rmSync(home, {recursive: true, force: true});
  }
});

test('no macOS lê o ~/.config/opencode que o binário lê, com ou sem XDG', () => {
  const {home, config} = tempHome();
  try {
    fs.writeFileSync(path.join(config, 'opencode.json'), JSON.stringify({model: 'acme/m1', provider: {acme: {models: {m1: {name: 'M1'}}}}}));
    for (const env of [{HOME: home}, {HOME: home, XDG_CONFIG_HOME: path.join(home, '.config')}]) {
      const personal = readPersonalConfig({env, home, platform: 'darwin'});
      assert.equal(personal.model, 'acme/m1', `macOS ${env.XDG_CONFIG_HOME ? 'com' : 'sem'} XDG`);
      assert.equal(personal.provider.acme.models.m1.name, 'M1');
    }
    const other = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-oc-mac-only-'));
    try {
      fs.mkdirSync(path.join(other, 'Library', 'Application Support', 'opencode'), {recursive: true});
      fs.writeFileSync(path.join(other, 'Library', 'Application Support', 'opencode', 'opencode.json'), JSON.stringify({model: 'mac/m1'}));
      assert.deepEqual(readPersonalConfig({env: {HOME: other}, home: other, platform: 'darwin'}), {}, 'Application Support não é o caminho do binário');
    } finally {
      fs.rmSync(other, {recursive: true, force: true});
    }
  } finally {
    fs.rmSync(home, {recursive: true, force: true});
  }
});

test('json comum também vale e o arquivo explícito da pessoa entra depois do global', () => {
  const {home, config} = tempHome();
  try {
    fs.writeFileSync(path.join(config, 'opencode.json'), JSON.stringify({model: 'acme/antigo', provider: {acme: {models: {antigo: {name: 'Antigo'}}}}}));
    const explicit = path.join(home, 'meu-opencode.json');
    fs.writeFileSync(explicit, JSON.stringify({model: 'acme/novo', provider: {acme: {models: {novo: {name: 'Novo'}}}}, permission: {shell: 'allow'}}));
    const personal = readPersonalConfig({env: {HOME: home, XDG_CONFIG_HOME: path.join(home, '.config'), OPENCODE_CONFIG: explicit}, home, platform: 'linux'});
    assert.equal(personal.model, 'acme/novo');
    assert.deepEqual(Object.keys(personal.provider.acme.models), ['antigo', 'novo'], 'os providers somam');
    assert.equal(personal.permission, undefined);
  } finally {
    fs.rmSync(home, {recursive: true, force: true});
  }
});

test('projeto, plugin e auth não entram na leitura do config da pessoa', () => {
  const {home, config} = tempHome();
  const project = path.join(home, 'projeto');
  fs.mkdirSync(path.join(project, '.opencode', 'plugins'), {recursive: true});
  fs.mkdirSync(path.join(config, 'plugin'), {recursive: true});
  fs.mkdirSync(path.join(home, '.local', 'share', 'opencode'), {recursive: true});
  try {
    fs.writeFileSync(path.join(project, 'opencode.json'), JSON.stringify({model: 'projeto/m1', provider: {projeto: {models: {m1: {name: 'M1'}}}}}));
    fs.writeFileSync(path.join(project, '.opencode', 'opencode.json'), JSON.stringify({permission: {shell: 'allow'}}));
    fs.writeFileSync(path.join(project, '.opencode', 'plugins', 'evil.js'), 'export default async () => ({});');
    fs.writeFileSync(path.join(config, 'plugin', 'evil.js'), 'export default async () => ({});');
    fs.writeFileSync(path.join(home, '.local', 'share', 'opencode', 'auth.json'), JSON.stringify({acme: {type: 'api', key: 'key-de-teste'}}));
    const personal = readPersonalConfig({env: {HOME: home, XDG_CONFIG_HOME: path.join(home, '.config')}, home, platform: 'linux', cwd: project});
    assert.deepEqual(personal, {});
  } finally {
    fs.rmSync(home, {recursive: true, force: true});
  }
});

test('serveEnv mantém as travas da Mesa e leva a pessoa inline', () => {
  const personal = {model: 'acme/m1', provider: {acme: {models: {m1: {name: 'M1'}}}}};
  const env = serveEnv({OPENCODE_CONFIG_CONTENT: '{"permission":{"bash":"allow"}}', OPENCODE_CONFIG_DIR: '/velho', MESA: '1'}, '/r/opencode-config', personal);
  assert.equal(env.OPENCODE_CONFIG_DIR, '/r/opencode-config');
  assert.equal(env.OPENCODE_CONFIG, undefined);
  assert.equal(env.OPENCODE_DISABLE_PROJECT_CONFIG, '1');
  assert.equal(env.OPENCODE_DISABLE_CLAUDE_CODE, '1', 'CLAUDE.md/AGENTS.md da pessoa não entram');
  const inline = JSON.parse(env.OPENCODE_CONFIG_CONTENT);
  assert.equal(inline.model, 'acme/m1');
  assert.equal(inline.provider.acme.models.m1.name, 'M1');
  assert.equal(inline.tools.shell, false);
  assert.equal(inline.permission.shell, 'deny');
  assert.equal(inline.permission['*'], 'deny');
  assert.equal(inline.permission['mesa_*'], 'allow');
  assert.equal(inline.mcp, undefined);
  assert.equal(inline.plugin, undefined);
  assert.equal(inline.agent, undefined);
  assert.equal(inline.instructions, undefined);
});

test('sem config da pessoa o comportamento antigo continua: só o diretório da Mesa', () => {
  const env = serveEnv({MESA: '1'}, '/r/opencode-config');
  assert.equal(env.OPENCODE_CONFIG_DIR, '/r/opencode-config');
  assert.equal(env.OPENCODE_CONFIG_CONTENT, undefined);
  assert.equal(env.OPENCODE_DISABLE_CLAUDE_CODE, '1');
});

test('lista permitida corta instrução em provider.options, models.options e variants (#93)', () => {
  const logs = [];
  const personal = sanitizePersonalConfig({
    provider: {
      acme: {
        name: 'Acme', api: 'https://acme.test/v1', env: ['ACME_KEY'], id: 'acme', npm: '@ai-sdk/openai-compatible',
        whitelist: ['m1'], blacklist: ['m2'], ignorado: 'x',
        options: {
          baseURL: 'https://acme.test/v1', apiKey: 'chave-falsa', headers: {'x-acme': '1'}, timeout: 1000,
          headerTimeout: 2000, chunkTimeout: 3000, setCacheKey: true, enterpriseUrl: 'https://ghe.test',
          region: 'sa-east-1', profile: 'perfil', project: 'projeto', location: 'local',
          instructions: 'NAO-PODE', system: 'NAO-PODE', prompt: 'NAO-PODE', fetch: 'NAO-PODE',
        },
        models: {
          m1: {
            id: 'm1', name: 'M1', family: 'acme', release_date: '2026-01-01', attachment: true,
            reasoning: true, temperature: false, tool_call: true, interleaved: true,
            cost: {input: 0, output: 0}, limit: {context: 1000, output: 100},
            modalities: {input: ['text'], output: ['text']}, experimental: true, status: 'stable',
            provider: 'acme', headers: {'x-modelo': '1'},
            options: {temperature: 0.2, topP: 0.9, instructions: 'NAO-PODE', system: 'NAO-PODE', prompt: 'NAO-PODE', apiKey: 'NAO-PODE'},
            variants: {
              low: {temperature: 0.1, reasoningEffort: 'low', instructions: 'NAO-PODE'},
              quebrada: 'NAO-PODE',
            },
            instructions: 'NAO-PODE', system: 'NAO-PODE', prompt: 'NAO-PODE',
          },
        },
      },
      pacote: {npm: 'left-pad', options: {baseURL: 'https://evil.test'}, models: {}},
    },
  }, {log: (_area, line) => logs.push(line)});

  assert.deepEqual(Object.keys(personal.provider), ['acme'], 'provider fora de @ai-sdk/* sai inteiro');
  assert.equal(personal.provider.acme.options.baseURL, 'https://acme.test/v1');
  assert.equal(personal.provider.acme.options.headerTimeout, 2000);
  assert.deepEqual(personal.provider.acme.options.headers, {'x-acme': '1'});
  assert.equal(personal.provider.acme.models.m1.name, 'M1');
  assert.equal(personal.provider.acme.models.m1.limit.context, 1000);
  assert.equal(personal.provider.acme.models.m1.options.temperature, 0.2);
  assert.equal(personal.provider.acme.models.m1.options.topP, 0.9);
  assert.equal(personal.provider.acme.models.m1.variants.low.reasoningEffort, 'low');
  assert.equal(personal.provider.acme.models.m1.variants.quebrada, undefined);
  const text = JSON.stringify(personal);
  for (const forbidden of ['NAO-PODE', 'instructions', 'system', 'prompt', 'left-pad']) {
    assert.equal(text.includes(forbidden), false, `${forbidden} não passa`);
  }
  assert.ok(logs.some((line) => line.includes('provider.acme.options') && line.includes('instructions')), 'o NOME da chave sai no log');
  assert.ok(logs.some((line) => line.includes('provider.pacote')), 'o provider descartado sai no log');
  assert.ok(logs.every((line) => !line.includes('chave-falsa')), 'o valor nunca sai no log');
});

test('models.<id>.provider não contorna o limite de pacote (#93)', () => {
  const logs = [];
  const personal = sanitizePersonalConfig({
    provider: {
      acme: {
        models: {
          bom: {name: 'Bom', provider: {npm: '@ai-sdk/openai', api: 'https://acme.test/v1', shape: 'responses', ignorado: 'NAO-PODE'}},
          pacote: {name: 'Pacote', provider: {npm: 'left-pad'}},
          tipo: {name: 'Tipo', provider: 'acme'},
        },
      },
    },
  }, {log: (_area, line) => logs.push(line)});
  const models = personal.provider.acme.models;
  assert.deepEqual(models.bom.provider, {npm: '@ai-sdk/openai', api: 'https://acme.test/v1', shape: 'responses'});
  assert.equal(models.pacote, undefined, 'modelo com pacote de fora sai inteiro');
  assert.equal(models.tipo.provider, undefined, 'tipo errado sai sozinho; o modelo fica');
  assert.equal(JSON.stringify(personal).includes('left-pad'), false);
  assert.ok(logs.some((line) => line.includes('models.pacote') && line.includes('provider.npm')));
});

test('provider.api e provider.env com tipo inválido saem só eles; o provider fica (#93)', () => {
  const logs = [];
  const personal = sanitizePersonalConfig({
    provider: {acme: {npm: '@ai-sdk/openai-compatible', api: 123, env: 'ACME_KEY', whitelist: ['m1'], options: {baseURL: 'https://acme.test/v1'}, models: {m1: {name: 'M1'}}}},
  }, {log: (_area, line) => logs.push(line)});
  assert.deepEqual(personal.provider.acme, {
    npm: '@ai-sdk/openai-compatible', whitelist: ['m1'], options: {baseURL: 'https://acme.test/v1'}, models: {m1: {name: 'M1'}},
  }, 'o provider legítimo continua no catálogo');
  assert.ok(logs.some((line) => line.includes('provider.acme') && line.includes('api')), 'api inválido é registrado pelo nome');
  assert.ok(logs.some((line) => line.includes('provider.acme') && line.includes('env')), 'env inválido é registrado pelo nome');
});
