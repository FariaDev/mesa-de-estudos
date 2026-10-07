/* Ambiente do Claude Code original para a ponte experimental (fase 1).
 *
 * Escopo deste módulo: resolver o binário ORIGINAL instalado pelo usuário,
 * conferir a versão pareada com o SDK e ler o estado de autenticação sem
 * iniciar inferência, sem rede própria e sem tocar em credenciais.
 *
 * O que este módulo pode fazer: `execFile <binário> --version` e
 * `execFile <binário> auth status --json` (comandos locais do próprio Claude
 * Code, sancionados para a fase 0/1). `auth status` sai com código 1 quando
 * não há login e ainda imprime o JSON no stdout: isso é estado normal, lido do
 * erro sem ecoar conteúdo. O que este módulo NÃO faz: login, instalação,
 * atualização, cópia/leitura de tokens, sessões ou settings pessoais, chamada
 * de modelo e troca de endpoint.
 *
 * Erros de ambiente carregam `code` e `notSent = true`: quando `connect()`
 * falha aqui, nada foi enviado ao Claude — é recusa comprovada, não dúvida.
 * Os valores de variáveis de ambiente nunca aparecem em `detail`; só os NOMES
 * das variáveis conflitantes, para o usuário resolver no Claude Code.
 */
'use strict';

const {execFile: nodeExecFile} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/* Versão pareada desta ponte: SDK @anthropic-ai/claude-agent-sdk 0.3.246
   instalado no desk/ acompanha o CLI 2.1.246 (ver docs/CLAUDE-TRANSPORT-EXPERIMENTAL.md).
   Trocar de versão exige revisão explícita da pesquisa de transporte. */
const CLAUDE_PINNED_VERSION = '2.1.246';

const DEFAULT_TIMEOUT_MS = 15000;
const MAX_PROBE_OUTPUT = 1024 * 1024;

/* Variáveis que configuram API/endpoint alternativo. Se qualquer uma delas
   estiver preenchida, o ensaio da assinatura está conflitante: pedir que o
   usuário resolva no Claude Code original, sem remover a configuração por
   conta própria (o plano proíbe mexer em configuração global). */
const AUTH_CONFLICT_ENV = Object.freeze([
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_API_URL',
  'ANTHROPIC_BEDROCK_BASE_URL',
  'ANTHROPIC_VERTEX_BASE_URL',
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
]);

/* Métodos de auth que indicam chave de API/helper em vez de login oficial. */
const API_AUTH_METHODS = Object.freeze(['apikey', 'api_key', 'api-key', 'helper', 'apikeyhelper', 'api_key_helper']);

/* Campos que podem voltar de `auth status --json`. Nunca incluir e-mail,
   organização, plano ou qualquer dado pessoal — o renderer não precisa disso. */
const AUTH_FIELDS = Object.freeze(['loggedIn', 'authMethod', 'apiProvider']);

class ClaudeEnvError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.name = 'ClaudeEnvError';
    this.code = code;
    this.notSent = true;
    if (detail !== undefined) this.detail = detail;
  }
}

function expandHome(candidate, home) {
  if (typeof candidate !== 'string' || !candidate) return null;
  let value = candidate;
  if (value === '~') value = home;
  else if (value.startsWith('~/') || value.startsWith('~\\')) value = path.join(home, value.slice(2));
  return path.resolve(value);
}

/* Caminhos candidatos, em ordem: o configurado pelo usuário e o launcher
   padrão do instalador oficial (`~/.local/bin/claude` → versions/<v>). */
function candidatePaths({configuredPath, home = os.homedir(), platform = process.platform} = {}) {
  const out = [];
  const configured = expandHome(configuredPath, home);
  if (configured) out.push(configured);
  if (platform === 'win32') out.push(path.join(home, '.local', 'bin', 'claude.exe'));
  out.push(path.join(home, '.local', 'bin', 'claude'));
  return [...new Set(out)];
}

function findClaudeLauncher(options = {}) {
  return candidatePaths(options).find((file) => {
    try { return fs.statSync(file).isFile(); } catch { return false; }
  }) || '';
}

function normalizeVersion(stdout) {
  const match = String(stdout || '').match(/(\d+)\.(\d+)\.(\d+)/);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : null;
}

/* Lê o JSON do `auth status` e devolve SÓ os campos da allowlist. */
function parseAuthStatus(stdout) {
  const text = String(stdout || '');
  const start = text.indexOf('{');
  if (start === -1) return null;
  let parsed;
  try {
    parsed = JSON.parse(text.slice(start));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const auth = {};
  for (const field of AUTH_FIELDS) {
    if (field === 'loggedIn') auth.loggedIn = parsed[field] === true;
    else if (typeof parsed[field] === 'string') auth[field] = parsed[field];
    else auth[field] = null;
  }
  return auth;
}

function findEnvConflicts(env) {
  const conflicts = [];
  for (const name of AUTH_CONFLICT_ENV) {
    const value = env ? env[name] : undefined;
    if (typeof value === 'string' && value.trim() !== '') conflicts.push(name);
  }
  return conflicts;
}

function defaultExecFile(file, args, options) {
  return new Promise((resolve, reject) => {
    nodeExecFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      } else {
        resolve({stdout, stderr});
      }
    });
  });
}

async function probeExecFile(execFile, file, args, options) {
  const exec = typeof execFile === 'function' ? execFile : defaultExecFile;
  return await exec(file, args, options);
}

/* Inspeção completa, sem lançar por ausência/versão/auth: serve tanto para o
   detectar() que conecta quanto para diagnóstico (doctor). Nunca expõe valores
   de ambiente; `conflicts` traz apenas nomes/indícios sanitizados. */
async function inspectClaude(options = {}) {
  const {
    configuredPath = null,
    env = process.env,
    execFile = defaultExecFile,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    home = os.homedir(),
    platform = process.platform,
  } = options;

  const searched = candidatePaths({configuredPath, home, platform});
  let found = null;
  for (const candidate of searched) {
    try {
      const real = await fs.promises.realpath(candidate);
      const stat = await fs.promises.stat(real);
      if (stat.isFile()) {
        found = {launcherPath: candidate, path: real};
        break;
      }
    } catch {
      /* candidato ausente: segue para o próximo */
    }
  }

  const conflicts = findEnvConflicts(env);
  const warnings = [];
  const info = {
    found: Boolean(found),
    searched,
    launcherPath: found ? found.launcherPath : null,
    path: found ? found.path : null,
    version: null,
    versionSupported: false,
    auth: null,
    conflicts,
    warnings,
  };
  if (!found) return info;

  const execOptions = {env, timeout: timeoutMs, maxBuffer: MAX_PROBE_OUTPUT, windowsHide: true};

  try {
    const {stdout} = await probeExecFile(execFile, found.path, ['--version'], execOptions);
    info.version = normalizeVersion(stdout);
  } catch {
    warnings.push({code: 'CLAUDE_VERSION_PROBE_FAILED', message: 'não foi possível ler a versão do Claude Code'});
  }
  info.versionSupported = info.version === CLAUDE_PINNED_VERSION;
  if (!info.versionSupported) return info;

  try {
    const {stdout} = await probeExecFile(execFile, found.path, ['auth', 'status', '--json'], execOptions);
    info.auth = parseAuthStatus(stdout);
    if (!info.auth) warnings.push({code: 'CLAUDE_AUTH_STATUS_UNREADABLE', message: 'o estado de autenticação do Claude Code não pôde ser lido'});
  } catch (error) {
    /* `auth status --json` sai com exit 1 quando não há login — e ainda pode
       imprimir o JSON no stdout. Ler o stdout do erro é o caminho normal; só
       um stdout sem JSON vira "ilegível". Nunca ecoar stdout/stderr. */
    const parsed = parseAuthStatus(error?.stdout);
    if (parsed) info.auth = parsed;
    else warnings.push({code: 'CLAUDE_AUTH_PROBE_FAILED', message: 'não foi possível consultar o login do Claude Code'});
  }

  if (info.auth) {
    if (info.auth.apiProvider && info.auth.apiProvider !== 'firstParty') {
      conflicts.push(`apiProvider:${info.auth.apiProvider}`);
    }
    if (info.auth.authMethod) {
      const method = info.auth.authMethod.toLowerCase();
      if (API_AUTH_METHODS.includes(method)) conflicts.push(`authMethod:${info.auth.authMethod}`);
    }
  }

  return info;
}

/* Porta de conexão da ponte: exige binário pareado + login oficial, sem
   nenhuma chamada de modelo. Lança ClaudeEnvError com notSent = true. */
async function detectClaude(options = {}) {
  const info = await inspectClaude(options);

  if (!info.found) {
    throw new ClaudeEnvError(
      'CLAUDE_NOT_FOUND',
      `Claude Code não encontrado (procurado em ${info.searched.join(', ')}). Instale pelo fluxo oficial, sem atualização automática da Mesa.`,
      {searched: info.searched},
    );
  }

  if (!info.versionSupported) {
    throw new ClaudeEnvError(
      'CLAUDE_VERSION_UNSUPPORTED',
      `Versão do Claude Code fora do pareamento desta ponte: esperada ${CLAUDE_PINNED_VERSION}, encontrada ${info.version || 'desconhecida'}.`,
      {expected: CLAUDE_PINNED_VERSION, version: info.version},
    );
  }

  if (info.conflicts.length) {
    throw new ClaudeEnvError(
      'CLAUDE_AUTH_CONFLICT',
      'O Claude Code está configurado com API, endpoint alternativo ou helper de credenciais que conflita com o login oficial da assinatura. Resolva a escolha no próprio Claude Code antes do ensaio; a Mesa não altera configuração global.',
      {conflicts: [...info.conflicts]},
    );
  }

  const authUnreadable = info.warnings.some((warning) => (
    warning.code === 'CLAUDE_AUTH_STATUS_UNREADABLE' || warning.code === 'CLAUDE_AUTH_PROBE_FAILED'
  ));
  if (authUnreadable && !info.auth) {
    throw new ClaudeEnvError(
      'CLAUDE_AUTH_STATUS_UNREADABLE',
      'Não foi possível ler o estado de autenticação do Claude Code; confira o login no binário original antes do ensaio.',
      {warnings: info.warnings.map((warning) => warning.code)},
    );
  }

  if (!info.auth || info.auth.loggedIn !== true) {
    throw new ClaudeEnvError(
      'CLAUDE_LOGIN_REQUIRED',
      'Claude Code sem login ativo. Faça login no Claude Code original e tente de novo; a Mesa não guarda credenciais.',
      {loggedIn: false},
    );
  }

  return {
    path: info.path,
    launcherPath: info.launcherPath,
    version: info.version,
    auth: info.auth,
    warnings: info.warnings,
  };
}

module.exports = {
  CLAUDE_PINNED_VERSION,
  AUTH_CONFLICT_ENV,
  AUTH_FIELDS,
  DEFAULT_TIMEOUT_MS,
  ClaudeEnvError,
  candidatePaths,
  findClaudeLauncher,
  normalizeVersion,
  parseAuthStatus,
  findEnvConflicts,
  inspectClaude,
  detectClaude,
};
