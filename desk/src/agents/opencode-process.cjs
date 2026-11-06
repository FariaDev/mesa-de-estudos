// @ts-check
'use strict';

/* Processo do `opencode serve` que a Mesa fala por HTTP (#57, porte da branch
   t3/opencode-provider; medido no binário 2.0.32).

   - A senha do Basic auth (usuário fixo `opencode`) é GERADA aqui, só na
     memória, e vai ao filho por `OPENCODE_PASSWORD` (medido: sem ela 401, com
     ela 200). Um `OPENCODE_SERVER_PASSWORD` herdado do shell não viaja.
   - A porta é pedida ao sistema (`--port 0`); o servidor anuncia a efetiva no
     stdout (`server listening on http://127.0.0.1:NNNNN`).
   - O filho nasce no próprio grupo (`detached`, fora do Windows): a recolha de
     órfãos (`opencode-orphans.cjs`) encerra o grupo sem encostar no do app.
   - A chave do Zen, quando existe, chega pelo ambiente que o dono monta
     (`OPENCODE_API_KEY`); este módulo não a conhece, e o stderr que vai ao log
     passa pelo `redact` com a senha e qualquer segredo do ambiente. */

const {spawn} = require('node:child_process');
const {spawnPlan} = require('../win-cmd-spawn.cjs');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {MESA_SERVE_ARGS, ESCALATE_AFTER_MS, writeEntry, clearEntryIfMatches, markEntryStopping, readProcessInfo, killGroup, isAnnotatedServe, serveBinaryFromCommandLine} = require('./opencode-orphans.cjs');
const {processStartTime} = require('./opencode-owner-time.cjs');
const {findOpenCodeInLoginShell} = require('./opencode-shell.cjs');
const {message} = require('../i18n.mjs');

const DEFAULT_TIMEOUT_MS = 30000;
/* Depois do SIGKILL, quanto esperar o evento de saída confirmar a morte. Se
   nem assim ele chegar, o ledger fica marcado para a próxima abertura. */
const EXIT_AFTER_KILL_MS = 500;
const LISTENING_RE = /listening on (https?:\/\/127\.0\.0\.1:\d+)/i;
const USERNAME = 'opencode';

/**
 * @typedef {{baseUrl: string, password: string, binary: string, pid: number, stop: () => Promise<void>, onExit: (fn: (code: number|null) => void) => void}} OpenCodeServer
 */

/** @param {unknown} candidate @param {string} home @returns {string|null} */
function expandHome(candidate, home) {
  if (typeof candidate !== 'string' || !candidate) return null;
  if (candidate === '~') return home;
  if (candidate.startsWith('~/') || candidate.startsWith('~\\')) return path.resolve(home, candidate.slice(2));
  return path.resolve(candidate);
}

/**
 * Onde procurar o CLI, em ordem: o caminho do ambiente (`LEARNING_DESK_OPENCODE`),
 * o caminho escolhido nas Configurações (`opencodePath`, #102) e os
 * instaladores usuais. Só a existência do arquivo é lida.
 * @param {{envPath?: string, configuredPath?: string, home?: string, platform?: NodeJS.Platform}} [options]
 * @returns {string[]}
 * @example candidatePaths({home: '/Users/ana'}) // ['/Users/ana/.opencode/bin/opencode', …]
 */
function candidatePaths({envPath = '', configuredPath = '', home = os.homedir(), platform = process.platform} = {}) {
  /* Mesmo resolvedor para todos (CI windows-latest): `expandHome` usa `path.resolve`; um
     `path.join` puro devolvia `\casa\...` no Windows e o mesmo caminho saía
     com e sem drive conforme a origem. */
  const out = [expandHome(envPath, home), expandHome(configuredPath, home)];
  if (platform === 'win32') out.push(path.resolve(home, 'AppData', 'Local', 'Programs', 'opencode', 'opencode.exe'), path.resolve(home, '.opencode', 'bin', 'opencode.exe'));
  out.push(path.resolve(home, '.opencode', 'bin', 'opencode'), path.resolve(home, '.local', 'bin', 'opencode'));
  if (platform !== 'win32') out.push('/opt/homebrew/bin/opencode', '/usr/local/bin/opencode');
  return [...new Set(out.filter((item) => typeof item === 'string'))];
}

/**
 * O primeiro candidato que existe, ou o que o shell de login aponta (#102).
 * Os caminhos fixos vêm primeiro, então quem já é achado ali nunca espera o
 * shell. `shellPath: ''` desliga a pergunta (Windows e testes).
 * @param {{envPath?: string, configuredPath?: string, home?: string, platform?: NodeJS.Platform,
 *   shellPath?: string, env?: NodeJS.ProcessEnv, timeoutMs?: number,
 *   spawnSyncProcess?: typeof import('node:child_process').spawnSync}} [options]
 * @returns {string}
 * @example findOpenCodeLauncher({envPath: process.env.LEARNING_DESK_OPENCODE})
 */
function findOpenCodeLauncher(options = {}) {
  const found = candidatePaths(options).find((file) => {
    try { return fs.statSync(file).isFile(); } catch { return false; }
  });
  if (found) return found;
  return findOpenCodeInLoginShell({
    shellPath: options.shellPath,
    env: options.env,
    platform: options.platform,
    timeoutMs: options.timeoutMs,
    spawnSyncProcess: options.spawnSyncProcess,
  });
}

/**
 * O ambiente do filho: o recebido, sem senha herdada, mais a senha gerada.
 * @param {NodeJS.ProcessEnv|Record<string, string|undefined>} env @param {string} password
 * @returns {Record<string, string|undefined>}
 * @example childEnv({OPENCODE_SERVER_PASSWORD: 'x'}, 'p') // {OPENCODE_PASSWORD: 'p'}
 */
function childEnv(env, password) {
  /** @type {Record<string, string|undefined>} */
  const out = {...env, OPENCODE_PASSWORD: password};
  delete out.OPENCODE_SERVER_PASSWORD;
  return out;
}

/* Abaixo de 6 caracteres o valor quase sempre é booleano, flag ou palavra
   comum (`false` de PASSWORD_STORE_ENABLE_EXTENSIONS, `1`, `seg` em
   `segundo`); mascarar substring disso estraga o log sem proteger credencial.
   Com 6 já dá para importar uma chave curta de verdade. Os escalares comuns
   que passariam do piso (`default`, `enabled`) também ficam fora. O nome do
   ambiente precisa ter o segmento inteiro (`API_KEY`, `TOKEN`, `SECRET`,
   `PASSWORD`), não `MONKEY`. */
const MIN_SECRET_LENGTH = 6;
const NON_SECRET_VALUE = /^(?:true|false|yes|no|on|off|null|nil|none|undefined|auto|default|enabled|disabled)$/i;
const SECRET_ENV_NAME = /(^|_)(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIALS?)($|_)/i;

/** @param {unknown} value @returns {boolean} */
const looksLikeSecret = (value) => typeof value === 'string' && value.length >= MIN_SECRET_LENGTH && !NON_SECRET_VALUE.test(value);

/* O `ps` pode estourar uma vez sob carga; uma segunda leitura evita gravar o
   ledger sem a hora que prova a identidade. Se falhar de novo, o registro
   fica sem hora e a recolha NÃO o descarta (ver opencode-orphans.cjs). */
const PROCESS_INFO_ATTEMPTS = 2;

/**
 * Lê a identidade do processo com uma nova tentativa antes de desistir.
 * @param {(pid: number) => {commandLine: string, startTime: string}|null} read
 * @param {number} pid
 * @returns {{commandLine: string, startTime: string}|null}
 * @example readProcessInfoWithRetry(readProcessInfo, 4242)
 */
function readProcessInfoWithRetry(read, pid) {
  for (let attempt = 0; attempt < PROCESS_INFO_ATTEMPTS; attempt += 1) {
    try {
      const info = read(pid);
      if (info) return info;
    } catch { /* tenta de novo */ }
  }
  return null;
}

/**
 * Os valores do ambiente do filho que parecem segredo, do mais longo ao mais
 * curto (um segredo que contém outro some inteiro antes).
 * @param {Record<string, string|undefined>} env
 * @returns {string[]}
 * @example secretsInEnv({OPENAI_API_KEY: 'sk-abc'}) // ['sk-abc']
 */
function secretsInEnv(env) {
  const found = new Set();
  for (const [name, value] of Object.entries(env || {})) {
    if (!SECRET_ENV_NAME.test(name)) continue;
    if (looksLikeSecret(value)) found.add(/** @type {string} */ (value));
  }
  return [...found].sort((left, right) => right.length - left.length);
}

/* Linha-alvo: piso de 8 (curta demais destruiria o log — F18) e teto de 256
   (cada alvo custa um split/join por linha; as mais longas ficam — F20). */
const MIN_SECRET_LINE_LENGTH = 8;
const MAX_SECRET_LINE_TARGETS = 256;

/** Linhas-alvo: piso, não espaço, mais longas primeiro. @param {string} secret @returns {string[]} */
function secretLineTargets(secret) {
  return secret.split(/\r?\n/)
    .filter((line) => line.length >= MIN_SECRET_LINE_LENGTH && /\S/.test(line))
    .sort((left, right) => right.length - left.length)
    .slice(0, MAX_SECRET_LINE_TARGETS);
}

/**
 * Pedaços de um segredo que somem do texto: o valor inteiro e, se multilinha
 * (PEM), cada linha segura (F11); linhas abaixo do piso ficam fora (F18).
 * @param {unknown} secret @returns {string[]}
 */
function redactionTargets(secret) {
  if (typeof secret !== 'string' || !looksLikeSecret(secret)) return [];
  if (!/[\r\n]/.test(secret)) return [secret];
  return [secret, ...secretLineTargets(secret)];
}

/** Alvos do logger (uma linha por vez): as linhas do multilinha, com rabo do
 * tamanho da maior (F17/F20). @param {unknown} secret @returns {string[]} */
function loggerRedactionTargets(secret) {
  if (typeof secret !== 'string' || !looksLikeSecret(secret)) return [];
  return /[\r\n]/.test(secret) ? secretLineTargets(secret) : [secret];
}

/** @param {string[]} values @returns {string[]} */
function uniqueTargets(values) {
  return [...new Set(values)].sort((left, right) => right.length - left.length);
}

/** Aplica alvos prontos; `includes` evita alocar no caso comum sem segredo.
 * @param {string} text @param {string[]} targets @returns {string} */
function redactTargets(text, targets) {
  let out = String(text || '');
  for (const target of targets) {
    if (out.includes(target)) out = out.split(target).join('***');
  }
  return out;
}

/**
 * Tira a senha e os segredos do texto antes do log. O mais longo primeiro: um
 * segredo que contém outro (ou a linha de um PEM) some inteiro antes.
 * @param {string} text @param {string[]} secrets
 * @returns {string}
 * @example redact('senha=abc', ['abc']) // 'senha=***'
 */
function redact(text, secrets) {
  const list = Array.isArray(secrets) ? secrets : [];
  return redactTargets(text, uniqueTargets(list.flatMap((secret) => redactionTargets(secret))));
}

/* Teto de uma linha de stderr antes de descarregar o buffer: uma linha
   anormal (sem `\n`) não pode crescer sem limite na memória. */
const STDERR_LINE_LIMIT = 64 * 1024;

/* Tabela de bordas (KMP) até `length`. Sem ela, o rabo era procurado
   descendo de L-1 e fatiando o segredo a cada passo: O(n·L), e um segredo de
   200 KB no ambiente travava o flush do `exit` por ~9,5 s no main. */
function borderTable(secret, length) {
  const table = new Uint32Array(length);
  let border = 0;
  for (let index = 1; index < length; index += 1) {
    while (border > 0 && secret[index] !== secret[border]) border = table[border - 1];
    if (secret[index] === secret[border]) border += 1;
    table[index] = border;
  }
  return table;
}

/**
 * O maior final de `text` que ainda pode virar alvo (prefixo próprio, até
 * L-1). O flush do `exit` retém esse rabo porque o Node pode entregar dados
 * depois do `exit`; sem ele a linha seguinte completaria o segredo em claro.
 * Os alvos incluem as linhas do segredo multilinha (F17), cujo prefixo não é
 * prefixo do valor inteiro. Só o tamanho do maior alvo é olhado (KMP linear).
 * @param {string} text @param {string[]} targets
 * @returns {string}
 */
function trailingSecretPrefix(text, targets) {
  const maxLength = targets.reduce((max, target) => typeof target === 'string' ? Math.max(max, target.length) : max, 0);
  const limit = maxLength - 1;
  if (limit < 1 || !text) return '';
  const tail = text.length > limit ? text.slice(-limit) : text;
  let longest = '';
  for (const target of targets) {
    if (typeof target !== 'string' || target.length < 2) continue;
    const table = borderTable(target, Math.min(target.length, tail.length));
    let matched = 0;
    for (let index = 0; index < tail.length; index += 1) {
      const char = tail[index];
      while (matched > 0 && char !== target[matched]) matched = table[matched - 1];
      if (char === target[matched]) matched += 1;
      if (matched === target.length) matched = table[matched - 1];
    }
    if (matched > longest.length) longest = target.slice(0, matched);
  }
  return longest;
}

/**
 * Mascara o stderr por LINHA, não por evento `data`: um segredo pode chegar
 * partido em dois chunks, e a máscara só vale com a linha inteira. Guarda o
 * que falta da linha até o `\n` (ou o teto) e descarrega o resto no `flush`.
 * No estouro do teto, o rabo do segredo (comprimento máximo - 1) fica no
 * buffer para o próximo pedaço completar antes de mascarar. O `flush` sem
 * `final` (exit) retém o rabo que ainda pode virar segredo; o `flush(true)`
 * (close, fim dos streams) descarrega o resto mascarando esse rabo.
 *
 * Se o `close` nunca vier (um neto herdou o pipe do stderr e o segurou aberto),
 * esse rabo de no máximo L-1 caracteres não chega ao log. Não há como separar
 * "fim do stream" de "pedaço que ainda vai chegar"; soltar o rabo por tempo
 * deixaria a próxima parte completar o segredo em claro. Perder o rabo é o
 * lado seguro (F5 da revisão) e o teto é o do maior alvo conhecido.
 *
 * Os alvos são calculados uma vez (lista fixa por processo): antes cada linha
 * de log reconstruía a lista e um segredo grande custava O(linhas × texto) (F20).
 * @param {{log: (area: string, line: string) => void, secrets: string[], maxLineLength?: number}} options
 * @returns {{push: (chunk: unknown) => void, flush: (final?: boolean) => void}}
 * @example const logger = createStderrLogger({log, secrets}); logger.push('chave sk-12'); logger.push('345\n')
 */
function createStderrLogger({log, secrets, maxLineLength = STDERR_LINE_LIMIT}) {
  const targets = uniqueTargets((Array.isArray(secrets) ? secrets : []).flatMap((secret) => loggerRedactionTargets(secret)));
  const maxSecretLength = targets.reduce((max, target) => Math.max(max, target.length), 0);
  let pending = '';
  const emit = (text) => {
    const line = redactTargets(text, targets).replace(/\r$/, '').trim();
    if (line) log('opencode', line.slice(0, 2000));
  };
  const flushOverflow = () => {
    if (pending.length <= maxLineLength) return;
    const masked = redactTargets(pending, targets);
    const cut = Math.max(0, masked.length - Math.max(0, maxSecretLength - 1));
    emit(masked.slice(0, cut));
    pending = masked.slice(cut);
  };
  return {
    push(chunk) {
      pending += String(chunk || '');
      let index = pending.indexOf('\n');
      while (index !== -1) {
        emit(pending.slice(0, index));
        pending = pending.slice(index + 1);
        index = pending.indexOf('\n');
      }
      flushOverflow();
    },
    flush(final = false) {
      /* Mascarar ANTES de escolher o rabo que fica: um segredo inteiro com
         borda (primeiro caractere == último, ex.: `xSECRETx`) terminava em
         prefixo próprio, o corte tirava só a borda e o `emit` levava o resto
         da chave em claro. O `redact` não toca em segredo incompleto, então o
         rabo que ainda pode virar chave continua retido. */
      pending = redactTargets(pending, targets);
      const tail = trailingSecretPrefix(pending, targets);
      emit(tail ? pending.slice(0, -tail.length) : pending);
      if (!final) {
        pending = tail;
        return;
      }
      if (tail) emit('***');
      pending = '';
    },
  };
}

/**
 * Sobe o servidor e devolve `{baseUrl, password, stop}` quando ele anuncia a porta.
 * @param {{binary?: string, cwd?: string, env?: Record<string, string|undefined>, timeoutMs?: number,
 *   log?: (area: string, line: string) => void, spawnProcess?: typeof spawn, ledgerDir?: string,
 *   readProcessInfo?: (pid: number) => {commandLine: string, startTime: string}|null,
 *   kill?: (target: {pid: number, pgid: number, signal: string}) => void, signal?: AbortSignal,
 *   graceMs?: number, afterKillMs?: number}} [options]
 * @returns {Promise<OpenCodeServer>}
 * @example const server = await startOpenCodeServer({binary, cwd: workspaces, env, ledgerDir: runtime});
 */
function startOpenCodeServer({binary = '', cwd = '', env = process.env, timeoutMs = DEFAULT_TIMEOUT_MS, log = () => {}, spawnProcess = spawn, ledgerDir = '', readProcessInfo: readInfo = readProcessInfo, kill: signalGroup = killGroup, signal = null, graceMs = ESCALATE_AFTER_MS, afterKillMs = EXIT_AFTER_KILL_MS} = {}) {
  if (!binary) {
    /* A tela diz só que falta instalar; o caminho procurado fica no log. */
    log('opencode', 'binário não encontrado; procurei LEARNING_DESK_OPENCODE, ~/.opencode/bin/opencode e o PATH');
    return Promise.reject(Error(message('err.opencode.notFound')));
  }
  if (signal?.aborted) return Promise.reject(Error(message('tutor.error.cancelled')));
  const password = crypto.randomBytes(32).toString('base64url');
  const childEnvironment = childEnv(env, password);
  const secrets = secretsInEnv(childEnvironment);
  /* `opencode.cmd` do npm no Windows passa pelo cmd.exe (`win-cmd-spawn.cjs`). */
  const plan = spawnPlan(binary, [...MESA_SERVE_ARGS], {env});
  const child = spawnProcess(plan.file, plan.args, {
    cwd: cwd || undefined, env: childEnvironment, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    detached: process.platform !== 'win32', ...plan.options,
  });
  const pid = child.pid || 0;
  /** @type {import('./opencode-orphans.cjs').LedgerEntry|null} */
  let ledgerEntry = null;
  if (ledgerDir && pid) {
    try {
      /* A hora de início do filho e a do dono provam a identidade na recolha
         (#105): PID sozinho é reutilizável. A leitura do filho pode falhar e
         o registro fica sem prova (a recolha não mata ninguém), mas a hora do
         DONO nunca fica vazia: sem `ps`, `processStartTime` a tira da âncora
         de parede medida no boot (não de `Date.now() - uptime` na hora da
         gravação, que erra o tempo de suspensão do sistema — F14), para um pid
         reaproveitado não passar por Mesa viva para sempre. O fallback tem a
         resolução de 1 s e é comparado com folga. */
      const childInfo = readProcessInfoWithRetry(readInfo, pid);
      const ownerInfo = readProcessInfoWithRetry(readInfo, process.pid);
      const commandLine = childInfo?.commandLine || '';
      /* O binário guardado é o que o processo realmente roda, não o atalho
         (`opencode2` faz exec no alvo). A linha exata também fica no ledger e
         é a prova principal na recolha. */
      ledgerEntry = {pid, pgid: pid, binary: serveBinaryFromCommandLine(commandLine, binary), commandLine, startTime: childInfo?.startTime || '',
        ownerPid: process.pid, ownerStartTime: ownerInfo?.startTime || processStartTime(), stopping: false};
      writeEntry(ledgerDir, ledgerEntry);
    } catch (error) { log('opencode', `ledger não gravado: ${error.message}`); }
  }
  const exitListeners = [];
  let exited = false;
  /** @type {Promise<void>|null} */
  let stopping = null;
  /* Só apaga o registro que este servidor gravou: se outra Mesa reescreveu o
     ledger no meio, o registro vivo dela fica. */
  const clearLedger = () => {
    if (!ledgerDir) return;
    try { clearEntryIfMatches(ledgerDir, ledgerEntry || {pid, startTime: ''}); } catch { /* sem ledger, nada a apagar */ }
  };
  /* O pid do ledger só vale enquanto a hora de início ainda bate (#105); sem
     anotação, o handle do spawn é a prova de que o processo é este filho.
     `unproven` é o `ps` que não respondeu: não é "não é nosso", e por isso o
     handle vivo ainda pode receber o sinal; a ausência de prova nunca apaga o
     ledger nem deixa de encerrar o filho que esta Mesa criou. */
  /** @returns {'ours'|'not-ours'|'unproven'} */
  const childIdentity = () => {
    if (exited || child.exitCode !== null || child.signalCode !== null) return 'not-ours';
    if (!ledgerEntry?.startTime) return 'ours';
    /** @type {{commandLine: string, startTime: string}|null} */
    let info;
    try { info = readInfo(pid); } catch { info = null; }
    if (!info) return 'unproven';
    return isAnnotatedServe(ledgerEntry, info) ? 'ours' : 'not-ours';
  };
  /* "Encerrando" fica no ledger até o exit real. Se o app sair antes, a próxima
     abertura encontra o registro com dono morto e recolhe (#105). */
  const markStopping = () => {
    if (!ledgerDir || !ledgerEntry) return;
    try { markEntryStopping(ledgerDir, ledgerEntry); } catch { /* o registro anterior segue válido */ }
  };
  const signalServer = (/** @type {string} */ name) => {
    if (!pid) return;
    try { signalGroup({pid, pgid: pid, signal: name}); } catch { /* o grupo já saiu */ }
  };
  /* Sem prova de identidade, o handle do ChildProcess ainda é o filho que esta
     Mesa criou: o sinal vai direto nele, sem alcançar o grupo de um pid que não
     deu para conferir. */
  const signalChild = (/** @type {NodeJS.Signals} */ name) => {
    try { child.kill?.(name); } catch { /* o filho já saiu */ }
  };
  const requestStop = (/** @type {NodeJS.Signals} */ name, /** @type {'ours'|'not-ours'|'unproven'} */ proof) => {
    if (proof === 'ours') signalServer(name);
    else if (proof === 'unproven') signalChild(name);
  };
  /* SIGTERM, espera curta e SIGKILL do grupo. O prazo é teto: se nem o SIGKILL
     confirmar a saída, o ledger "encerrando" fica para a próxima abertura. */
  const stop = () => {
    if (stopping) return stopping;
    stopping = new Promise((resolve) => {
      /** @type {NodeJS.Timeout|null} */ let graceTimer = null;
      /** @type {NodeJS.Timeout|null} */ let killTimer = null;
      let done = false;
      const finishStop = () => {
        if (done) return;
        done = true;
        if (graceTimer) clearTimeout(graceTimer);
        if (killTimer) clearTimeout(killTimer);
        child.removeListener('exit', onStopExit);
        resolve();
      };
      const onStopExit = () => { clearLedger(); finishStop(); };
      if (exited || child.exitCode !== null || child.signalCode !== null) { clearLedger(); finishStop(); return; }
      markStopping();
      child.once('exit', onStopExit);
      requestStop('SIGTERM', childIdentity());
      if (done) return;
      graceTimer = setTimeout(() => {
        graceTimer = null;
        const proof = childIdentity();
        if (proof === 'not-ours') { clearLedger(); finishStop(); return; }
        requestStop('SIGKILL', proof);
        killTimer = setTimeout(() => {
          killTimer = null;
          if (childIdentity() === 'not-ours') clearLedger();
          finishStop();
        }, afterKillMs);
        killTimer.unref?.();
      }, graceMs);
      graceTimer.unref?.();
    });
    return stopping;
  };
  return new Promise((resolve, reject) => {
    let settled = false;
    let output = '';
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      if (error) { stop(); reject(error); } else resolve(value);
    };
    const onAbort = () => finish(Error(message('tutor.error.cancelled')));
    const timer = setTimeout(() => finish(Error(message('err.opencode.startTimeout', {seconds: Math.round(timeoutMs / 1000)}))), timeoutMs);
    signal?.addEventListener('abort', onAbort, {once: true});
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk) => {
      output = (output + chunk).slice(-4000);
      const match = LISTENING_RE.exec(output);
      if (!match) return;
      finish(null, {baseUrl: match[1], password, binary, pid, stop, onExit: (fn) => exitListeners.push(fn)});
    });
    const stderrLogger = createStderrLogger({log, secrets});
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk) => stderrLogger.push(chunk));
    child.on('error', (/** @type {NodeJS.ErrnoException} */ error) => finish(Error(message('err.opencode.spawnFailed', {cause: error.code || error.message}))));
    child.on('exit', (code) => {
      exited = true;
      stderrLogger.flush();
      clearLedger();
      finish(Error(message('err.opencode.startExit', {code: String(code)})));
      for (const fn of exitListeners) { try { fn(code); } catch { /* quem escuta não derruba o processo */ } }
    });
    /* O stdio fecha depois do `exit`: o que chegou nesse meio-tempo também
       passa pela máscara. No close não vem mais dado, então o rabo retido pode
       ser mascarado e descarregado. */
    child.on('close', () => stderrLogger.flush(true));
  });
}

module.exports = {DEFAULT_TIMEOUT_MS, STDERR_LINE_LIMIT, USERNAME, candidatePaths, findOpenCodeLauncher, childEnv, secretsInEnv, redact, createStderrLogger, startOpenCodeServer};
