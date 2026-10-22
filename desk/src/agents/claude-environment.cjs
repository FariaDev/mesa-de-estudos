/* Ambiente do Claude Code para a ponte experimental (fase 1).
 *
 * Escopo deste módulo: achar o Claude Code que a pessoa instalou, conferir se a
 * versão dele cabe na faixa que a Mesa aceita e ler o estado de autenticação
 * sem iniciar inferência, sem rede própria e sem tocar em credenciais.
 *
 * A Mesa usa SEMPRE o Claude Code do usuário (caminho configurado ou
 * `~/.local/bin/claude`, o do instalador oficial). Não há binário de reserva:
 * o do pacote do SDK saiu no #51, porque o `Mesa de Estudos.app` nunca o
 * levou (`externalClaude` em `bundle-runtime.cjs`) e a versão exata do #28
 * derrubava o tutor a cada atualização do Claude Code. Uma função só —
 * `inspectClaude`/`detectClaude` —, usada pelo tutor principal e pelo chat
 * lateral:
 *   1. acha o launcher; sem ele, CLAUDE_NOT_FOUND;
 *   2. lê `--version` e pergunta ao núcleo `core/claudeversion.bend` se cabe
 *      na faixa (`tested-versions.json`: do `claudeMinimum` até a série do
 *      `claude` testado). Fora da faixa ou ilegível, CLAUDE_VERSION_UNSUPPORTED
 *      com a frase da coluna do tutor em `detail.notice`; mais nova que a
 *      testada conecta e só avisa (log e Sobre);
 *   3. só então `auth status --json`. Uma versão fora da faixa nunca é
 *      executada além de `--version`.
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

const TESTED_VERSIONS = require('../tested-versions.json');
const versionCore = require('../generated/claudeversion.core.js').default;
const noticeCore = require('../generated/updatenotice.core.js').default;
const {createI18n} = require('../i18n.mjs');
const ptCatalog = require('../../locales/pt-BR.json');

/* A faixa aceita (#51): uma fonte só, a tabela "testada com esta Mesa" (#45).
   A testada é a referência da série; o mínimo é a mais antiga que os testes
   de contrato cobrem (docs/reviews/issue-51-resultado.md). */
const CLAUDE_RANGE = Object.freeze({minimum: String(TESTED_VERSIONS.claudeMinimum || ''), tested: String(TESTED_VERSIONS.claude || '')});

/* O log, o doctor e os testes leem a recusa em português; a coluna do tutor
   traduz a mesma mensagem no idioma da interface. */
const ptText = createI18n({catalogs: {'pt-BR': ptCatalog, en: ptCatalog}}).text;

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

/* O que a mensagem de conflito mostra: o NOME da variável (ANTHROPIC_BASE_URL),
   nunca o valor — que pode ser uma chave ou um endereço privado. Os indícios que
   vêm do estado de login (`apiProvider:…`, `authMethod:…`) viram frases sem o
   valor que acompanha o prefixo. */
function conflictNames(conflicts) {
  const names = [];
  for (const entry of conflicts) {
    const text = String(entry);
    let label;
    if (AUTH_CONFLICT_ENV.includes(text)) label = text;
    else if (text.startsWith('apiProvider:')) label = 'provedor de API alternativo';
    else if (text.startsWith('authMethod:')) label = 'login por chave ou helper de credenciais';
    else label = 'configuração de API';
    if (!names.includes(label)) names.push(label);
  }
  return names.join(', ');
}

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

/**
 * Texto `X.Y.Z` (com `v` opcional) → registro `Ver` dos núcleos; qualquer outra
 * coisa vira `NoVer`. Estrita: prerelease e texto solto não contam.
 * @param {unknown} text
 * @returns {{$: 'Ver', major: number, minor: number, patch: number} | {$: 'NoVer'}}
 * @example versionRecord('2.1.296') // {$: 'Ver', major: 2, minor: 1, patch: 296}
 */
function versionRecord(text) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(text ?? '').trim());
  if (!match) return {$: 'NoVer'};
  return {$: 'Ver', major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3])};
}

/**
 * Onde a versão encontrada cai na faixa aceita. A decisão é do núcleo
 * `core/claudeversion.bend`; aqui só se leem as versões e se monta a frase.
 * @param {string | null} version a versão lida (`null` = ilegível)
 * @param {{minimum: string, tested: string}} [range]
 * @returns {{accepted: boolean, ahead: boolean, notice: string, message: string}}
 *   `notice` é a mensagem do catálogo para a coluna do tutor (vazia se aceita);
 *   `message`, a mesma frase em português, para o log.
 * @example claudeFit('2.1.296').accepted // true
 */
function claudeFit(version, range = CLAUDE_RANGE) {
  const minimum = versionRecord(range.minimum);
  const tested = versionRecord(range.tested);
  const fit = versionCore.fitOf(versionRecord(version), minimum, tested);
  const notice = versionCore.refusal(fit, version || '?', minimum, tested);
  return {accepted: versionCore.accepted(fit), ahead: versionCore.ahead(fit), notice, message: notice ? ptText(notice) : ''};
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
   de ambiente; `conflicts` traz apenas nomes/indícios sanitizados.

   `path`/`version` descrevem o Claude Code do usuário. `versionSupported` diz
   se a versão cabe na faixa; `versionAhead`, se passa da testada (conecta e
   avisa); `versionNotice`, a frase da recusa para a coluna do tutor. */
async function inspectClaude(options = {}) {
  const {
    configuredPath = null,
    env = process.env,
    execFile = defaultExecFile,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    home = os.homedir(),
    platform = process.platform,
    range = CLAUDE_RANGE,
  } = options;

  const searched = candidatePaths({configuredPath, home, platform});
  let user = null;
  for (const candidate of searched) {
    try {
      const real = await fs.promises.realpath(candidate);
      const stat = await fs.promises.stat(real);
      if (stat.isFile()) {
        user = {launcherPath: candidate, path: real};
        break;
      }
    } catch {
      /* candidato ausente: segue para o próximo */
    }
  }

  const conflicts = findEnvConflicts(env);
  const warnings = [];
  const info = {
    found: Boolean(user),
    searched,
    launcherPath: user ? user.launcherPath : null,
    path: user ? user.path : null,
    version: null,
    versionSupported: false,
    versionAhead: false,
    versionNotice: '',
    versionMessage: '',
    range: {...range},
    auth: null,
    conflicts,
    warnings,
  };
  if (!user) return info;

  const execOptions = {env, timeout: timeoutMs, maxBuffer: MAX_PROBE_OUTPUT, windowsHide: true};
  try {
    const {stdout} = await probeExecFile(execFile, user.path, ['--version'], execOptions);
    info.version = normalizeVersion(stdout);
  } catch {
    warnings.push({code: 'CLAUDE_VERSION_PROBE_FAILED', message: 'não foi possível ler a versão do Claude Code'});
  }
  const fit = claudeFit(info.version, range);
  info.versionSupported = fit.accepted;
  info.versionAhead = fit.ahead;
  info.versionNotice = fit.notice;
  info.versionMessage = fit.message;
  if (!fit.accepted) return info;

  try {
    const {stdout} = await probeExecFile(execFile, user.path, ['auth', 'status', '--json'], execOptions);
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

/* Linha do log quando o Claude Code do usuário passa da versão testada: o
   tutor conecta (nunca bloqueia) e o Sobre mostra o mesmo aviso. Vazia quando
   a versão é a testada ou anterior. Devolve a mensagem marcada, sem prefixo: o
   `appendLog` do main a traduz inteira para o português do log. */
function describeVersion(info) {
  if (!info || info.versionAhead !== true || !info.version) return '';
  const tested = info.range?.tested || CLAUDE_RANGE.tested;
  return noticeCore.aheadWarning(info.version, tested);
}

/* Porta de conexão da ponte: exige versão na faixa + login oficial, sem
   nenhuma chamada de modelo. Lança ClaudeEnvError com notSent = true. */
async function detectClaude(options = {}) {
  const info = await inspectClaude(options);

  if (!info.found) {
    throw new ClaudeEnvError(
      'CLAUDE_NOT_FOUND',
      `Claude Code não encontrado (procurado em ${info.searched.join(', ')}). Instale o Claude Code pelo fluxo oficial ou indique o caminho dele nas Configurações; a Mesa não instala nem atualiza o Claude Code sozinha.`,
      {searched: info.searched},
    );
  }

  if (!info.versionSupported) {
    throw new ClaudeEnvError(
      'CLAUDE_VERSION_UNSUPPORTED',
      info.versionMessage,
      {
        version: info.version,
        minimum: info.range.minimum,
        tested: info.range.tested,
        notice: info.versionNotice,
        searched: info.searched,
      },
    );
  }

  if (info.conflicts.length) {
    throw new ClaudeEnvError(
      'CLAUDE_AUTH_CONFLICT',
      `O Claude Code está configurado com API, endpoint alternativo ou helper de credenciais que conflita com o login oficial da assinatura (${conflictNames(info.conflicts)}). Resolva a escolha no próprio Claude Code antes do ensaio; a Mesa não altera configuração global.`,
      {conflicts: [...info.conflicts]},
    );
  }

  const authUnreadable = info.warnings.some((warning) => (
    warning.code === 'CLAUDE_AUTH_STATUS_UNREADABLE' || warning.code === 'CLAUDE_AUTH_PROBE_FAILED'
  ));
  if (authUnreadable && !info.auth) {
    throw new ClaudeEnvError(
      'CLAUDE_AUTH_STATUS_UNREADABLE',
      'Não foi possível ler o estado de autenticação do Claude Code; confira o login no Claude Code antes do ensaio.',
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
    versionAhead: info.versionAhead,
    range: info.range,
    auth: info.auth,
    warnings: info.warnings,
  };
}

module.exports = {
  CLAUDE_RANGE,
  AUTH_CONFLICT_ENV,
  AUTH_FIELDS,
  DEFAULT_TIMEOUT_MS,
  ClaudeEnvError,
  candidatePaths,
  findClaudeLauncher,
  describeVersion,
  normalizeVersion,
  versionRecord,
  claudeFit,
  parseAuthStatus,
  findEnvConflicts,
  inspectClaude,
  detectClaude,
};
