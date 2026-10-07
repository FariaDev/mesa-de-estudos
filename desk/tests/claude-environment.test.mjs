/* Ambiente do Claude Code (desk/src/agents/claude-environment.cjs).
 *
 * Tudo simulado com `execFile` injetado: nenhum binário real é executado,
 * nenhuma credencial é lida e nenhuma chamada de rede acontece. O que se prova
 * aqui é a leitura segura de `--version` e `auth status --json`, incluindo o
 * caso NORMAL de exit 1 com JSON `loggedIn:false` (lido do stdout do erro), os
 * códigos de recusa (versão, login, conflito de API/endpoint) e o fato de
 * segredos/dados pessoais não vazarem em mensagens/detalhes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const require = createRequire(import.meta.url);
const env = require('../src/agents/claude-environment.cjs');

async function withTemp(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'mesa-claude-env-'));
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
}

/* Simula o erro do execFile do Node: stdout/stderr ficam no erro quando o
   processo sai com código ≠ 0. */
function execError({stdout = '', stderr = '', code = 1} = {}) {
  const error = new Error(`Command failed: exit ${code}`);
  error.code = code;
  error.stdout = stdout;
  error.stderr = stderr;
  return error;
}

/* execFile fake: roteia por argumentos e registra as chamadas. */
function fakeExec({version = '2.1.246 (Claude Code)\n', auth = '{"loggedIn": true, "authMethod": "oauth", "apiProvider": "firstParty"}\n', versionError = null, authError = null} = {}) {
  const calls = [];
  const exec = async (file, args, options) => {
    calls.push({file, args, options});
    if (args[0] === '--version') {
      if (versionError) throw versionError;
      return {stdout: version, stderr: ''};
    }
    if (args[0] === 'auth') {
      if (authError) throw authError;
      return {stdout: auth, stderr: ''};
    }
    throw new Error(`argumentos inesperados: ${args.join(' ')}`);
  };
  return {calls, exec};
}

test('detecta o binário pareado, resolve symlink e devolve auth sanitizado', async () => {
  await withTemp(async (dir) => {
    mkdirSync(join(dir, 'bin'));
    writeFileSync(join(dir, 'bin', 'claude'), '#!/bin/sh\nexit 0\n');
    symlinkSync(join(dir, 'bin', 'claude'), join(dir, 'claude-launcher'));
    const {calls, exec} = fakeExec({
      auth: '{"loggedIn": true, "authMethod": "oauth", "apiProvider": "firstParty", "email": "pessoa@example.com", "organization": "segredo"}\n',
    });

    const info = await env.detectClaude({
      configuredPath: join(dir, 'claude-launcher'),
      home: join(dir, 'sem-home'),
      env: {},
      execFile: exec,
    });

    assert.equal(info.path, realpathSync(join(dir, 'bin', 'claude')), 'o caminho devolvido é o binário real, não o launcher');
    assert.equal(info.version, '2.1.246');
    assert.deepEqual(info.auth, {loggedIn: true, authMethod: 'oauth', apiProvider: 'firstParty'});
    assert.equal(JSON.stringify(info).includes('pessoa@example.com'), false, 'e-mail não aparece');
    assert.equal(JSON.stringify(info).includes('segredo'), false, 'organização não aparece');
    assert.deepEqual(calls.map((call) => call.args), [['--version'], ['auth', 'status', '--json']]);
  });
});

test('versão fora do pareamento é CLAUDE_VERSION_UNSUPPORTED com notSent', async () => {
  await withTemp(async (dir) => {
    writeFileSync(join(dir, 'claude'), 'binário');
    const {exec} = fakeExec({version: '2.1.999 (Claude Code)\n'});
    await assert.rejects(
      () => env.detectClaude({configuredPath: join(dir, 'claude'), home: join(dir, 'sem-home'), env: {}, execFile: exec}),
      (error) => {
        assert.equal(error.code, 'CLAUDE_VERSION_UNSUPPORTED');
        assert.equal(error.notSent, true);
        assert.equal(error.detail.version, '2.1.999');
        assert.equal(error.detail.expected, env.CLAUDE_PINNED_VERSION);
        return true;
      },
    );
  });
});

test('login ausente (exit 0) é CLAUDE_LOGIN_REQUIRED e não tenta nada além do status', async () => {
  await withTemp(async (dir) => {
    writeFileSync(join(dir, 'claude'), 'binário');
    const {calls, exec} = fakeExec({auth: '{"loggedIn": false, "authMethod": "none", "apiProvider": "firstParty"}\n'});
    await assert.rejects(
      () => env.detectClaude({configuredPath: join(dir, 'claude'), home: join(dir, 'sem-home'), env: {}, execFile: exec}),
      (error) => {
        assert.equal(error.code, 'CLAUDE_LOGIN_REQUIRED');
        assert.equal(error.notSent, true);
        return true;
      },
    );
    assert.deepEqual(calls.map((call) => call.args[0]), ['--version', 'auth'], 'sem inferência: só versão e status');
  });
});

test('auth status exit 1 com JSON loggedIn:false é estado NORMAL, não "ilegível"', async () => {
  await withTemp(async (dir) => {
    writeFileSync(join(dir, 'claude'), 'binário');
    const {calls, exec} = fakeExec({
      authError: execError({
        stdout: '{"loggedIn": false, "authMethod": "none", "apiProvider": "firstParty", "email": "pessoa@example.com"}\n',
        stderr: 'not logged in\n',
        code: 1,
      }),
    });
    await assert.rejects(
      () => env.detectClaude({configuredPath: join(dir, 'claude'), home: join(dir, 'sem-home'), env: {}, execFile: exec}),
      (error) => {
        assert.equal(error.code, 'CLAUDE_LOGIN_REQUIRED', 'exit 1 + JSON false é o caminho normal de "sem login"');
        assert.equal(error.notSent, true);
        assert.equal(JSON.stringify(error).includes('pessoa@example.com'), false, 'nem no caso de erro o e-mail vaza');
        return true;
      },
    );
    assert.deepEqual(calls.map((call) => call.args[0]), ['--version', 'auth']);
  });
});

test('auth status exit 1 com stdout quebrado é CLAUDE_AUTH_STATUS_UNREADABLE', async () => {
  await withTemp(async (dir) => {
    writeFileSync(join(dir, 'claude'), 'binário');
    const {exec} = fakeExec({
      authError: execError({stdout: 'não é json\n', stderr: '', code: 1}),
    });
    await assert.rejects(
      () => env.detectClaude({configuredPath: join(dir, 'claude'), home: join(dir, 'sem-home'), env: {}, execFile: exec}),
      (error) => {
        assert.equal(error.code, 'CLAUDE_AUTH_STATUS_UNREADABLE');
        assert.equal(error.notSent, true);
        return true;
      },
    );
  });
});

test('auth status exit 1 com JSON loggedIn:true continua sanitizado e detectável', async () => {
  await withTemp(async (dir) => {
    writeFileSync(join(dir, 'claude'), 'binário');
    const secret = 'sk-ant-super-secreto-456';
    const {exec} = fakeExec({
      authError: execError({
        stdout: `{"loggedIn": true, "authMethod": "oauth", "apiProvider": "firstParty", "email": "pessoa@example.com", "token": "${secret}"}\n`,
        code: 1,
      }),
    });
    const info = await env.detectClaude({configuredPath: join(dir, 'claude'), home: join(dir, 'sem-home'), env: {}, execFile: exec});
    assert.deepEqual(info.auth, {loggedIn: true, authMethod: 'oauth', apiProvider: 'firstParty'});
    assert.equal(JSON.stringify(info).includes(secret), false, 'token nunca aparece');
    assert.equal(JSON.stringify(info).includes('pessoa@example.com'), false, 'e-mail nunca aparece');
  });
});

test('chave de API no ambiente é CLAUDE_AUTH_CONFLICT e o segredo não vaza', async () => {
  await withTemp(async (dir) => {
    writeFileSync(join(dir, 'claude'), 'binário');
    const {exec} = fakeExec();
    const secret = 'sk-ant-super-secreto-123';
    await assert.rejects(
      () => env.detectClaude({
        configuredPath: join(dir, 'claude'),
        home: join(dir, 'sem-home'),
        env: {ANTHROPIC_API_KEY: secret, OUTRA: 'ok'},
        execFile: exec,
      }),
      (error) => {
        assert.equal(error.code, 'CLAUDE_AUTH_CONFLICT');
        assert.equal(error.notSent, true);
        assert.ok(error.detail.conflicts.includes('ANTHROPIC_API_KEY'));
        assert.equal(JSON.stringify(error).includes(secret), false, 'nem mensagem nem detail carregam o valor');
        assert.equal(String(error.message).includes(secret), false);
        return true;
      },
    );
  });
});

test('endpoint alternativo e provider não-firstParty também são conflito', async () => {
  await withTemp(async (dir) => {
    writeFileSync(join(dir, 'claude'), 'binário');

    await assert.rejects(
      () => env.detectClaude({
        configuredPath: join(dir, 'claude'), home: join(dir, 'sem-home'),
        env: {ANTHROPIC_BASE_URL: 'https://proxy.invalido'}, execFile: fakeExec().exec,
      }),
      (error) => {
        assert.equal(error.code, 'CLAUDE_AUTH_CONFLICT');
        assert.deepEqual(error.detail.conflicts, ['ANTHROPIC_BASE_URL']);
        assert.equal(JSON.stringify(error).includes('proxy.invalido'), false);
        return true;
      },
    );

    await assert.rejects(
      () => env.detectClaude({
        configuredPath: join(dir, 'claude'), home: join(dir, 'sem-home'), env: {},
        execFile: fakeExec({auth: '{"loggedIn": true, "authMethod": "oauth", "apiProvider": "bedrock"}\n'}).exec,
      }),
      (error) => {
        assert.equal(error.code, 'CLAUDE_AUTH_CONFLICT');
        assert.deepEqual(error.detail.conflicts, ['apiProvider:bedrock']);
        return true;
      },
    );

    await assert.rejects(
      () => env.detectClaude({
        configuredPath: join(dir, 'claude'), home: join(dir, 'sem-home'), env: {},
        execFile: fakeExec({auth: '{"loggedIn": true, "authMethod": "apiKeyHelper", "apiProvider": "firstParty"}\n'}).exec,
      }),
      (error) => {
        assert.equal(error.code, 'CLAUDE_AUTH_CONFLICT');
        assert.deepEqual(error.detail.conflicts, ['authMethod:apiKeyHelper']);
        return true;
      },
    );
  });
});

test('status de auth ilegível (exit 0) não vira "logado" nem "sem login" silencioso', async () => {
  await withTemp(async (dir) => {
    writeFileSync(join(dir, 'claude'), 'binário');
    await assert.rejects(
      () => env.detectClaude({
        configuredPath: join(dir, 'claude'), home: join(dir, 'sem-home'), env: {},
        execFile: fakeExec({auth: 'saída que não é json'}).exec,
      }),
      (error) => {
        assert.equal(error.code, 'CLAUDE_AUTH_STATUS_UNREADABLE');
        assert.equal(error.notSent, true);
        return true;
      },
    );
  });
});

test('binário ausente é CLAUDE_NOT_FOUND; inspect não lança e lista os candidatos', async () => {
  await withTemp(async (dir) => {
    const exec = async () => {
      throw new Error('não devia executar nada');
    };
    const missing = await env.inspectClaude({
      configuredPath: join(dir, 'nao-existe'),
      home: join(dir, 'casa'),
      env: {},
      execFile: exec,
    });
    assert.equal(missing.found, false);
    assert.deepEqual(missing.searched, [join(dir, 'nao-existe'), join(dir, 'casa', '.local', 'bin', 'claude')]);

    await assert.rejects(
      () => env.detectClaude({configuredPath: join(dir, 'nao-existe'), home: join(dir, 'casa'), env: {}, execFile: exec}),
      (error) => {
        assert.equal(error.code, 'CLAUDE_NOT_FOUND');
        assert.equal(error.notSent, true);
        return true;
      },
    );
  });
});

test('candidatos: configurado primeiro, launcher padrão depois; ~ expande', () => {
  const candidates = env.candidatePaths({configuredPath: '~/meu/claude', home: '/casa'});
  assert.deepEqual(candidates, ['/casa/meu/claude', '/casa/.local/bin/claude']);
  assert.deepEqual(env.candidatePaths({home: '/casa'}), ['/casa/.local/bin/claude']);
});

test('launcher Windows .exe é descoberto pelo mesmo resolvedor do main e da inspeção',async()=>{
 await withTemp(async home=>{
  const launcher=join(home,'.local','bin','claude.exe');
  mkdirSync(join(home,'.local','bin'),{recursive:true});writeFileSync(launcher,'fixture');
  assert.equal(env.findClaudeLauncher({home,platform:'win32'}),launcher);
  const info=await env.inspectClaude({home,platform:'win32',env:{},execFile:async(_file,args)=>({stdout:args[0]==='--version'?'2.1.246':JSON.stringify({loggedIn:true,authMethod:'oauth',apiProvider:'firstParty'})})});
  assert.equal(info.found,true);assert.equal(info.launcherPath,launcher);
  assert.equal(env.findClaudeLauncher({home,platform:'darwin'}),'');
 });
});

test('normalizeVersion e parseAuthStatus são estritos e não inventam campos', () => {
  assert.equal(env.normalizeVersion('2.1.246 (Claude Code)\n'), '2.1.246');
  assert.equal(env.normalizeVersion('sem versão'), null);
  assert.deepEqual(
    env.parseAuthStatus('{"loggedIn": true, "authMethod": "oauth", "apiProvider": "firstParty", "extra": "x"}'),
    {loggedIn: true, authMethod: 'oauth', apiProvider: 'firstParty'},
  );
  assert.equal(env.parseAuthStatus('não é json'), null);
  assert.equal(env.parseAuthStatus('{"loggedIn": false, "authMethod": "none"}').loggedIn, false);
});

test('findEnvConflicts ignora vazio e variáveis alheias, mas acha as conhecidas', () => {
  assert.deepEqual(env.findEnvConflicts({ANTHROPIC_API_KEY: '', PATH: '/bin'}), []);
  assert.deepEqual(
    env.findEnvConflicts({ANTHROPIC_API_KEY: 'x', ANTHROPIC_BASE_URL: 'y', PATH: '/bin'}),
    ['ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL'],
  );
});
