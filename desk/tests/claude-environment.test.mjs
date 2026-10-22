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
import {parseMessage} from '../src/i18n.mjs';
import {ptText} from './pt-text.mjs';

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
function fakeExec({version = '2.1.301 (Claude Code)\n', auth = '{"loggedIn": true, "authMethod": "oauth", "apiProvider": "firstParty"}\n', versionError = null, authError = null} = {}) {
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

test('detecta o Claude Code na faixa, resolve symlink e devolve auth sanitizado', async () => {
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
    assert.equal(info.version, '2.1.301');
    assert.deepEqual(info.auth, {loggedIn: true, authMethod: 'oauth', apiProvider: 'firstParty'});
    assert.equal(JSON.stringify(info).includes('pessoa@example.com'), false, 'e-mail não aparece');
    assert.equal(JSON.stringify(info).includes('segredo'), false, 'organização não aparece');
    assert.deepEqual(calls.map((call) => call.args), [['--version'], ['auth', 'status', '--json']]);
  });
});

test('versão fora da faixa é CLAUDE_VERSION_UNSUPPORTED com notSent, a faixa e a frase da coluna', async () => {
  await withTemp(async (dir) => {
    writeFileSync(join(dir, 'claude'), 'binário');
    const {exec} = fakeExec({version: '2.2.0 (Claude Code)\n'});
    await assert.rejects(
      () => env.detectClaude({configuredPath: join(dir, 'claude'), home: join(dir, 'sem-home'), env: {}, execFile: exec}),
      (error) => {
        assert.equal(error.code, 'CLAUDE_VERSION_UNSUPPORTED');
        assert.equal(error.notSent, true);
        assert.equal(error.detail.version, '2.2.0');
        assert.equal(error.detail.minimum, env.CLAUDE_RANGE.minimum);
        assert.equal(error.detail.tested, env.CLAUDE_RANGE.tested);
        assert.equal(parseMessage(error.detail.notice).key, 'claude.version.series');
        assert.equal(error.message, `O Claude Code 2.2.0 é de uma série que a Mesa ainda não aceita (${env.CLAUDE_RANGE.minimum} a 2.1.x): procure uma versão nova da Mesa no Sobre.`);
        assert.doesNotMatch(error.message, /pareamento|ponte|SDK/, 'nada do vocabulário interno do #28/#32');
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
        assert.match(error.message, /\(ANTHROPIC_API_KEY\)/, 'a mensagem nomeia a variável');
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
        assert.match(error.message, /\(ANTHROPIC_BASE_URL\)/, 'a mensagem nomeia a variável, nunca o valor');
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
        assert.equal(error.message.includes('bedrock'), false, 'o valor do provedor não aparece na mensagem');
        assert.match(error.message, /provedor de API alternativo/);
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
        assert.equal(error.message.includes('apiKeyHelper'), false, 'o valor do método não aparece na mensagem');
        assert.match(error.message, /helper de credenciais\)/);
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
  const info=await env.inspectClaude({home,platform:'win32',env:{},execFile:async(_file,args)=>({stdout:args[0]==='--version'?'2.1.301':JSON.stringify({loggedIn:true,authMethod:'oauth',apiProvider:'firstParty'})})});
  assert.equal(info.found,true);assert.equal(info.launcherPath,launcher);
  assert.equal(env.findClaudeLauncher({home,platform:'darwin'}),'');
 });
});

test('normalizeVersion e parseAuthStatus são estritos e não inventam campos', () => {
  assert.equal(env.normalizeVersion('2.1.301 (Claude Code)\n'), '2.1.301');
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

/* ---- #51: faixa de versões, sempre o Claude Code do usuário ---- */

test('#51: a faixa conecta do mínimo à série da testada e recusa o resto antes do login', async () => {
  await withTemp(async dir => {
    const file=join(dir,'claude');writeFileSync(file,'binário sintético');
    const accepted={'2.1.296':false,'2.1.299':false,'2.1.301':false,'2.1.302':true,'2.1.400':true};
    const refused={'2.1.295':'claude.version.below','2.1.246':'claude.version.below','2.0.999':'claude.version.below','2.2.0':'claude.version.series','3.0.0':'claude.version.series','ilegível':'claude.version.unreadable'};
    for(const [version,ahead] of Object.entries(accepted)){
      const {exec,calls}=fakeExec({version:`${version} (Claude Code)`});
      const info=await env.detectClaude({configuredPath:file,home:join(dir,'sem-home'),env:{},execFile:exec});
      assert.equal(info.version,version);
      assert.equal(info.versionAhead,ahead,`${version}: aviso de "mais nova que a testada"`);
      assert.equal(calls.length,2,`${version}: versão e login, nada mais`);
    }
    for(const [version,key] of Object.entries(refused)){
      const {exec,calls}=fakeExec({version});
      await assert.rejects(
        ()=>env.detectClaude({configuredPath:file,home:join(dir,'sem-home'),env:{},execFile:exec}),
        e=>e.code==='CLAUDE_VERSION_UNSUPPORTED'&&e.notSent===true&&parseMessage(e.detail.notice)?.key===key,
        version,
      );
      assert.equal(calls.length,1,`${version}: fora da faixa não lê nem o status de login`);
    }
  });
});

test('#51: o 2.1.296 do defeito (app instalado, sem reserva) conecta', async () => {
  await withTemp(async dir => {
    mkdirSync(join(dir,'.local','bin'),{recursive:true});
    writeFileSync(join(dir,'.local','bin','claude'),'launcher');
    const {exec}=fakeExec({version:'2.1.296 (Claude Code)\n'});
    const info=await env.detectClaude({home:dir,env:{},execFile:exec});
    assert.equal(info.version,'2.1.296');
    assert.equal(info.launcherPath,join(dir,'.local','bin','claude'));
  });
});

test('#51: versão ilegível também é recusa, com a frase dizendo o que fazer', async () => {
  await withTemp(async dir => {
    const file=join(dir,'claude');writeFileSync(file,'binário');
    const exec=async(_file,args)=>{if(args[0]==='--version')throw execError({stdout:'',code:1});throw new Error('não devia consultar o login');};
    await assert.rejects(
      ()=>env.detectClaude({configuredPath:file,home:join(dir,'sem-home'),env:{},execFile:exec}),
      e=>{
        assert.equal(e.code,'CLAUDE_VERSION_UNSUPPORTED');
        assert.equal(e.detail.version,null);
        assert.match(e.message,/^Atualize ou reinstale o Claude Code/);
        return true;
      },
    );
  });
});

test('#51: a tabela "testada com esta Mesa" é a fonte da faixa e é coerente', () => {
  const tested=require('../src/tested-versions.json');
  assert.deepEqual(env.CLAUDE_RANGE,{minimum:tested.claudeMinimum,tested:tested.claude},'uma fonte só, sem número duplicado');
  const min=env.versionRecord(tested.claudeMinimum),top=env.versionRecord(tested.claude);
  assert.equal(min.$,'Ver');assert.equal(top.$,'Ver');
  assert.deepEqual([min.major,min.minor],[top.major,top.minor],'mínimo e testada na mesma série');
  assert.ok(min.patch<=top.patch,'mínimo não passa da testada');
  assert.equal(env.claudeFit(tested.claude).accepted,true,'a testada é aceita');
  assert.equal(env.claudeFit(tested.claudeMinimum).accepted,true,'o mínimo é aceito');
});

test('#51: claudeFit e versionRecord seguem o núcleo e a faixa injetada', () => {
  assert.deepEqual(env.versionRecord('2.1.296'),{$:'Ver',major:2,minor:1,patch:296});
  assert.deepEqual(env.versionRecord('v2.1.296'),{$:'Ver',major:2,minor:1,patch:296});
  assert.deepEqual(env.versionRecord('2.1.296-beta'),{$:'NoVer'});
  assert.deepEqual(env.versionRecord(null),{$:'NoVer'});
  const range={minimum:'3.4.10',tested:'3.4.20'};
  assert.deepEqual(env.claudeFit('3.4.10',range),{accepted:true,ahead:false,notice:'',message:''});
  assert.equal(env.claudeFit('3.4.21',range).ahead,true);
  const below=env.claudeFit('3.4.9',range);
  assert.equal(below.accepted,false);
  assert.equal(below.message,'Atualize o Claude Code: a versão 3.4.9 é anterior à faixa que a Mesa aceita (3.4.10 a 3.4.x).');
});

test('#51: mais nova que a testada vira linha de log, nunca bloqueio; a testada não gera linha', () => {
  const tested=env.CLAUDE_RANGE.tested;
  assert.equal(ptText(env.describeVersion({version:'2.1.400',versionAhead:true,range:env.CLAUDE_RANGE})),`A 2.1.400 é mais nova que a testada com esta Mesa (${tested}): o tutor pode se comportar diferente.`);
  assert.equal(env.describeVersion({version:tested,versionAhead:false,range:env.CLAUDE_RANGE}),'');
  assert.equal(env.describeVersion(null),'');
});

test('#51: mais nova que a testada ainda recusa conflito de API e login ausente', async () => {
  await withTemp(async dir => {
    const file=join(dir,'claude');writeFileSync(file,'binário');
    await assert.rejects(
      ()=>env.detectClaude({configuredPath:file,home:join(dir,'casa'),env:{},execFile:fakeExec({version:'2.1.400',auth:'{"loggedIn": false, "authMethod": "none", "apiProvider": "firstParty"}'}).exec}),
      e=>e.code==='CLAUDE_LOGIN_REQUIRED'&&e.notSent===true,
    );
    await assert.rejects(
      ()=>env.detectClaude({configuredPath:file,home:join(dir,'casa'),env:{ANTHROPIC_API_KEY:'x'},execFile:fakeExec({version:'2.1.400'}).exec}),
      e=>e.code==='CLAUDE_AUTH_CONFLICT'&&e.notSent===true,
    );
  });
});

test('#51: sem reserva — sem o Claude Code do usuário é CLAUDE_NOT_FOUND e o módulo não procura o binário do SDK', async () => {
  for(const name of ['findSdkBinary','sdkBinaryCandidates','describeSelection','SDK_PACKAGE','CLAUDE_PINNED_VERSION'])assert.equal(name in env,false,`${name} saiu com a reserva do #32`);
  await withTemp(async dir => {
    const exec=async()=>{throw new Error('não devia executar nada');};
    await assert.rejects(
      ()=>env.detectClaude({configuredPath:join(dir,'nao-existe'),home:join(dir,'casa'),env:{},execFile:exec}),
      e=>{
        assert.equal(e.code,'CLAUDE_NOT_FOUND');
        assert.equal(e.notSent,true);
        assert.doesNotMatch(e.message,/SDK|reserva/);
        assert.deepEqual(e.detail,{searched:[join(dir,'nao-existe'),join(dir,'casa','.local','bin','claude')]});
        return true;
      },
    );
  });
});
