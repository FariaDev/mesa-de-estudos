// @ts-check
'use strict';

/* Ledger do `opencode serve` que a MESA subiu (#57, porte da branch
   t3/opencode-provider; endurecido na #105).

   Se o app morre com `kill -9`, o filho pode ficar vivo. Na partida seguinte a
   Mesa recolhe só o que ela mesma gravou. O ledger guarda pid, pgid, binário,
   linha de comando, hora de início e o dono (a Mesa que o gravou). A recolha
   exige que a hora de início e os argumentos do processo ainda batam com a
   anotação — PID sozinho não prova identidade, porque o número é reutilizado.
   Processo fora do ledger não é tocado, e um `opencode` que o usuário abriu
   (outro subcomando, outra porta, outro host) também não. Nada de `pkill`.

   O executável pode ser um script com shebang (`node …/opencode serve …`) ou
   um shim que faz `exec` noutro binário: por isso a identidade olha os
   ARGUMENTOS e a hora de início, não o nome do arquivo em argv[0] (foi o que
   deixou o órfão do macOS passar na #105).

   O ledger fica no runtime da Mesa e guarda só caminhos, números e datas —
   NENHUMA senha. Leitura de processo, existência, kill e temporizador entram
   por parâmetro: o teste usa fakes nomeados e não mata nada.

   A recolha manda SIGTERM e volta na hora; o SIGKILL, só se o processo ainda
   estiver lá depois da carência, roda num timer `unref` (a abertura do app não
   espera).

   `stopping` marca o registro que a Mesa começou a encerrar sem confirmar a
   saída (#105). O stop não apaga o ledger antes do exit real: se o app sair
   primeiro, a próxima abertura encontra o registro "encerrando" com dono morto
   e recolhe o serve pela mesma prova de identidade. */

const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

const LEDGER_FILE = 'opencode-servers.json';
/* Os argumentos que só a Mesa usa juntos: porta efêmera pedida ao sistema. */
const MESA_SERVE_ARGS = Object.freeze(['serve', '--hostname', '127.0.0.1', '--port', '0']);
/* Carência do SIGTERM antes do SIGKILL: o serve real sai em milissegundos. */
const ESCALATE_AFTER_MS = 2000;
/* `ps`/PowerShell respondem em milissegundos; presos, não podem segurar o main
   nem o teto de 3 s do `before-quit`. Estouro vira "sem prova" (null). */
const PROCESS_INFO_TIMEOUT_MS = 2000;

/**
 * @typedef {{pid: number, pgid: number, binary: string, commandLine: string,
 *   startTime: string, ownerPid: number, ownerStartTime: string, stopping: boolean}} LedgerEntry
 * @typedef {{pid: number, pgid: number, signal: string}} KillTarget
 * @typedef {{commandLine: string, startTime: string}} ProcessInfo
 * @typedef {{killed: Array<{pid: number, pgid: number}>, skipped: Array<{pid: number, reason: string}>,
 *   entry: LedgerEntry|null, done?: Promise<void>}} SweepResult
 */

const {isPlainObject} = require('../../plain-object.cjs');
const {startTimesMatch} = require('./opencode-owner-time.cjs');
const positive = (value) => Number.isInteger(value) && value > 0;
/* PID/grupo 1 é o init, e `kill(-1)` atinge TODOS os processos do usuário:
   nenhum caminho de sinal aceita alvo de valor absoluto <= 1. */
const killable = (value) => Number.isInteger(value) && value > 1;
const textOf = (value) => typeof value === 'string' ? value : '';

/** @param {string} dir @returns {string} */
function ledgerPath(dir) {
  return path.join(dir, LEDGER_FILE);
}

/**
 * O registro gravado, ou null sem ledger ou com registro inválido.
 * @param {string} dir
 * @returns {LedgerEntry|null}
 * @example readEntry(runtime) // {pid: 4242, pgid: 4242, binary: '/…/opencode', …}
 */
function readEntry(dir) {
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(ledgerPath(dir), 'utf8')); } catch { return null; }
  if (!isPlainObject(parsed)) return null;
  const pid = Number(parsed.pid);
  if (!killable(pid)) return null;
  const pgid = Number(parsed.pgid);
  const ownerPid = Number(parsed.ownerPid);
  return {
    pid,
    pgid: killable(pgid) ? pgid : pid,
    binary: textOf(parsed.binary),
    commandLine: textOf(parsed.commandLine),
    startTime: textOf(parsed.startTime),
    ownerPid: positive(ownerPid) ? ownerPid : 0,
    ownerStartTime: textOf(parsed.ownerStartTime),
    stopping: parsed.stopping === true,
  };
}

/**
 * Grava o registro do filho (tmp + rename; um arquivo pela metade nunca vira
 * ledger, e um ledger corrompido é lido como ausente).
 * @param {string} dir
 * @param {{pid: number, pgid?: number, binary?: string, commandLine?: string,
 *   startTime?: string, ownerPid?: number, ownerStartTime?: string, stopping?: boolean}} entry
 * @returns {void}
 * @example writeEntry(runtime, {pid: child.pid, pgid: child.pid, binary, commandLine, startTime, ownerPid, ownerStartTime})
 */
function writeEntry(dir, entry) {
  const pid = Number(entry?.pid);
  if (!killable(pid)) throw Error(`registro de servidor do OpenCode inválido: pid ${JSON.stringify(entry?.pid)}, esperado inteiro maior que 1`);
  const pgid = Number(entry.pgid);
  const ownerPid = Number(entry.ownerPid);
  const record = {
    pid,
    pgid: killable(pgid) ? pgid : pid,
    binary: textOf(entry.binary),
    commandLine: textOf(entry.commandLine),
    startTime: textOf(entry.startTime),
    ownerPid: positive(ownerPid) ? ownerPid : 0,
    ownerStartTime: textOf(entry.ownerStartTime),
    stopping: entry.stopping === true,
  };
  fs.mkdirSync(dir, {recursive: true});
  const file = ledgerPath(dir);
  /* O tmp leva o pid de quem grava: duas Mesas no mesmo runtime não brigam
     pelo mesmo arquivo temporário. */
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(record));
  fs.renameSync(tmp, file);
}

/** @param {string} dir @returns {void} */
function clearEntry(dir) {
  try { fs.rmSync(ledgerPath(dir), {force: true}); } catch { /* sem ledger, nada a apagar */ }
}

/**
 * Marca "encerrando" só quando o ledger ainda é o registro deste servidor
 * (mesmo pid e mesma hora de início). O stop de uma Mesa não pode apagar o
 * registro de outra que compartilha o runtime (#105).
 *
 * A leitura e a gravação não são uma transação entre processos: se outra Mesa
 * gravar entre as duas, a última escrita vence. A janela é de microssegundos,
 * e a gravação é atômica (tmp + rename), como o resto do ledger; uma trava
 * entre processos só para a marca informativa custaria mais do que protege.
 * @param {string} dir @param {Pick<LedgerEntry, 'pid'|'startTime'>} entry
 * @returns {boolean} se marcou
 * @example markEntryStopping(runtime, {pid: 4242, startTime: 'Wed Nov  4 15:00:00 2026'})
 */
function markEntryStopping(dir, entry) {
  const current = readEntry(dir);
  if (!current || current.pid !== entry.pid || current.startTime !== entry.startTime) return false;
  writeEntry(dir, {...current, stopping: true});
  return true;
}

/**
 * Apaga o ledger só se ele ainda for o registro dado. A recolha assíncrona
 * usa isto para não apagar o ledger de um servidor novo gravado no meio.
 * @param {string} dir @param {Pick<LedgerEntry, 'pid'|'startTime'>} entry
 * @returns {boolean} se apagou
 * @example clearEntryIfMatches(runtime, {pid: 4242, startTime: 'Wed Nov  4 15:00:00 2026'})
 */
function clearEntryIfMatches(dir, entry) {
  const current = readEntry(dir);
  if (!current || current.pid !== entry.pid) return false;
  if (entry.startTime && current.startTime !== entry.startTime) return false;
  clearEntry(dir);
  return true;
}

/** @param {unknown} commandLine @returns {boolean} */
function hasMesaArgs(commandLine) {
  if (typeof commandLine !== 'string' || !commandLine.trim()) return false;
  const parts = commandLine.trim().split(/\s+/);
  if (parts.length <= MESA_SERVE_ARGS.length) return false;
  const args = parts.slice(-MESA_SERVE_ARGS.length);
  return args.every((arg, index) => arg === MESA_SERVE_ARGS[index]);
}

/** @param {unknown} value @returns {string} */
const baseName = (value) => path.basename(String(value || '')).replace(/\.(?:exe|cmd|bat)$/i, '').toLowerCase();

/**
 * O programa que a linha de comando executa de fato: o último token antes dos
 * argumentos da Mesa. Num script com shebang é o caminho do script; num shim
 * que fez `exec` é o alvo, não o atalho.
 * @param {unknown} commandLine @param {unknown} [fallback]
 * @returns {string}
 * @example serveBinaryFromCommandLine('node /x/opencode serve --hostname 127.0.0.1 --port 0') // '/x/opencode'
 */
function serveBinaryFromCommandLine(commandLine, fallback = '') {
  const configured = typeof fallback === 'string' ? fallback : '';
  if (!hasMesaArgs(commandLine)) return configured;
  const head = String(commandLine).trim().split(/\s+/).slice(0, -MESA_SERVE_ARGS.length);
  /* O `ps` junta argv com espaço, e o caminho pode ter espaço (`/Users/Joao
     Silva/…`): o último token deixa de ser o caminho inteiro. Recompõe pelo
     sufixo que casa com o binário configurado antes de cair no último token. */
  return headSuffix(head, configured) || head[head.length - 1] || configured;
}

/**
 * A linha de comando parece o serve lançado a partir deste binário? Aceita o
 * binário direto e o script com shebang (`node /…/opencode serve …`).
 * @param {unknown} commandLine @param {unknown} binary
 * @returns {boolean}
 * @example isMesaServe('node /x/opencode serve --hostname 127.0.0.1 --port 0', '/x/opencode') // true
 */
function isMesaServe(commandLine, binary) {
  if (!hasMesaArgs(commandLine)) return false;
  const expected = typeof binary === 'string' && binary ? baseName(binary) : 'opencode';
  const head = String(commandLine).trim().split(/\s+/).slice(0, -MESA_SERVE_ARGS.length);
  return head.some((part) => baseName(part) === expected);
}

/* O shim que a Mesa instala se chama `opencode2` e faz `exec` no `opencode`
   irmão (opencode-install.cjs). O `ps` do spawn pode ler a linha antes ou
   depois do exec do MESMO processo (mesmo pid e mesma hora de início): sem
   aceitar a transição, o stop não sinalizava e a recolha descartava um serve
   vivo com a chave do provedor em memória. O alvo aceito é exatamente o que o
   shim executa — o `opencode` da mesma pasta — com `serve` como subcomando e
   os argumentos da Mesa na posição final. Basename igual noutra pasta,
   subcomando a mais ou token no meio da linha de outro programa não passam. */
const SHIM_BASENAME = 'opencode2';

/** O alvo que o `placeBinary` põe ao lado do shim; vazio se não for shim.
 * @param {unknown} binary @returns {string} */
function shimTargetPath(binary) {
  if (typeof binary !== 'string' || !binary) return '';
  const unified = binary.replace(/\\/g, '/');
  const name = unified.slice(unified.lastIndexOf('/') + 1);
  if (baseName(name) !== SHIM_BASENAME) return '';
  const directory = unified.slice(0, unified.lastIndexOf('/') + 1);
  const target = /\.(?:cmd|bat)$/i.test(name) ? 'opencode.exe' : 'opencode';
  return `${directory}${target}`;
}

/** @param {unknown} observed @param {unknown} expected @returns {boolean} */
function sameProgramPath(observed, expected) {
  if (typeof observed !== 'string' || typeof expected !== 'string' || !observed || !expected) return false;
  const normalize = (value) => value.replace(/^["']|["']$/g, '').replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
  return normalize(observed) === normalize(expected);
}

/**
 * O sufixo de `head` que é `target`, ou ''. O `ps` não preserva a fronteira
 * dos argv: junta tudo com espaço, e um caminho com espaço vira vários tokens.
 * Rejuntar os tokens do sufixo devolve o caminho inteiro sem aceitar prefixo
 * nem token a mais (`/opt/malicioso/opencode` continua diferente do alvo).
 * O valor devolvido é o `target`, não o candidato cru: no Windows o CIM
 * preserva as aspas do caminho com espaço, e gravá-las no ledger quebrava o
 * basename do shim na leitura seguinte (F21).
 * @param {string[]} head @param {unknown} target @returns {string}
 * @example headSuffix(['node', '/Users/Joao', 'Silva/opencode'], '/Users/Joao Silva/opencode') // '/Users/Joao Silva/opencode'
 */
function headSuffix(head, target) {
  if (typeof target !== 'string' || !target) return '';
  for (let index = 0; index < head.length; index += 1) {
    const candidate = head.slice(index).join(' ');
    if (sameProgramPath(candidate, target)) return target;
  }
  return '';
}

/** @param {unknown} commandLine @param {unknown} binary @returns {boolean} */
function isShimTargetServe(commandLine, binary) {
  if (!hasMesaArgs(commandLine)) return false;
  const target = shimTargetPath(binary);
  if (!target) return false;
  const head = String(commandLine).trim().split(/\s+/).slice(0, -MESA_SERVE_ARGS.length);
  return Boolean(headSuffix(head, target));
}

/**
 * A prova de identidade da recolha: mesma hora de início E os argumentos do
 * serve da Mesa. A linha de comando observada no spawn é a prova mais forte:
 * um shim pode trocar o próprio nome pelo alvo (`exec`), então a linha exata
 * vale mesmo que `binary` seja o atalho. Sem ela, o basename do `binary` no
 * registro precisa aparecer na linha (direto, com shebang ou alvo do shim).
 * Registro antigo sem `binary` mantém a regra anterior.
 * @param {Partial<Pick<LedgerEntry, 'startTime'|'binary'|'commandLine'>>|null} entry
 * @param {ProcessInfo|null} info
 * @returns {boolean}
 * @example isAnnotatedServe({startTime: 'Wed Nov  4 15:00:00 2026', binary: '/x/opencode2', commandLine: '/bin/sh /x/opencode2 serve …'}, info) // true
 */
function isAnnotatedServe(entry, info) {
  if (!entry || !info || !entry.startTime) return false;
  if (info.startTime !== entry.startTime) return false;
  if (entry.commandLine && info.commandLine === entry.commandLine) return true;
  if (!entry.binary) return hasMesaArgs(info.commandLine);
  return isMesaServe(info.commandLine, entry.binary) || isShimTargetServe(info.commandLine, entry.binary);
}

/** @param {number} pid @param {{execFile?: typeof execFileSync, timeoutMs?: number}} [options] @returns {ProcessInfo|null} */
function readWindowsProcessInfo(pid, {execFile = execFileSync, timeoutMs = PROCESS_INFO_TIMEOUT_MS} = {}) {
  try {
    const script = `$p=Get-CimInstance Win32_Process -Filter "ProcessId=${Number(pid)}"; if($p){[pscustomobject]@{commandLine=$p.CommandLine;startTime=[string]$p.CreationDate.ToFileTimeUtc()}|ConvertTo-Json -Compress}`;
    const out = String(execFile('powershell', ['-NoProfile', '-Command', script], {encoding: 'utf8', timeout: timeoutMs}) || '').trim();
    if (!out) return null;
    const parsed = JSON.parse(out);
    if (!parsed || typeof parsed.commandLine !== 'string' || !parsed.startTime) return null;
    return {commandLine: String(parsed.commandLine).trim(), startTime: String(parsed.startTime)};
  } catch {
    return null;
  }
}

/**
 * Linha de comando e hora de início do processo, ou null se ele não existe
 * (ou não deu para ler). POSIX: `ps` com `LC_ALL=C` para a data não depender
 * do idioma da máquina; Windows: CIM (não testado nesta máquina).
 * @param {number} pid
 * @param {{execFile?: typeof execFileSync, platform?: NodeJS.Platform, timeoutMs?: number}} [options]
 * @returns {ProcessInfo|null}
 * @example readProcessInfo(4242) // {commandLine: '…', startTime: 'Wed Nov  4 15:00:00 2026'}
 */
function readProcessInfo(pid, {execFile = execFileSync, platform = process.platform, timeoutMs = PROCESS_INFO_TIMEOUT_MS} = {}) {
  const target = Number(pid);
  if (!positive(target)) return null;
  if (platform === 'win32') return readWindowsProcessInfo(target, {execFile, timeoutMs});
  try {
    const out = execFile('ps', ['-p', String(target), '-o', 'lstart=', '-o', 'command='],
      {encoding: 'utf8', env: {...process.env, LC_ALL: 'C'}, timeout: timeoutMs});
    const line = String(out || '').replace(/\r?\n$/, '');
    /* `lstart` no locale C: `Wed Nov  4 15:00:00 2026`; o resto é a linha de
       comando. O regex não depende da largura que cada `ps` dá à coluna. */
    const match = /^([A-Z][a-z]{2} [A-Z][a-z]{2} [ 0-9]\d \d\d:\d\d:\d\d \d{4})\s+([\s\S]+)$/.exec(line);
    if (!match) return null;
    const commandLine = match[2].trim();
    if (!commandLine) return null;
    return {commandLine, startTime: match[1]};
  } catch {
    return null;
  }
}

/** Linha de comando real do processo (POSIX: `ps`; Windows: CIM). @param {number} pid @returns {string|null} */
function readCommandLine(pid) {
  return readProcessInfo(pid)?.commandLine || null;
}

/** O processo existe? (sinal 0 não acorda ninguém) @param {number} pid @returns {boolean} */
function processExists(pid) {
  const target = Number(pid);
  if (!killable(target)) return false;
  try {
    process.kill(target, 0);
    return true;
  } catch (error) {
    return /** @type {{code?: string}} */ (error)?.code === 'EPERM';
  }
}

/**
 * Encerra o GRUPO do servidor (POSIX: sinal no grupo; Windows: `taskkill /T`).
 * @param {Partial<KillTarget>} [target]
 * @returns {void}
 */
function killGroup(target = {}) {
  const pid = Number(target.pid || 0);
  const rawPgid = Number(target.pgid || pid);
  /* Spawn que falhou não tem pid, e `kill(-0)` é `kill(0)`: o sinal iria para
     o grupo da própria Mesa. PID 1 e grupo 1 são o init; `kill(-1)` atinge
     todos os processos do usuário. Um pgid estragado cai no grupo do pid. */
  if (!killable(pid)) return;
  const pgid = killable(rawPgid) ? rawPgid : pid;
  if (process.platform === 'win32') {
    /* SIGTERM educado: `taskkill /T` sem `/F`; a escalada manda `/F`. */
    const force = target.signal === 'SIGKILL' ? ['/F'] : [];
    execFileSync('taskkill', ['/PID', String(pid), '/T', ...force], {stdio: 'ignore'});
    return;
  }
  try {
    process.kill(-pgid, typeof target.signal === 'string' ? target.signal : 'SIGTERM');
  } catch (error) {
    if (/** @type {{code?: string}} */ (error)?.code !== 'ESRCH') throw error;
  }
}

/**
 * A Mesa que gravou o ledger ainda está viva? Compara a hora de início do
 * dono: um PID reutilizado por outro programa não conta como a Mesa irmã. A
 * hora pode vir do fallback sem `ps` e da leitura do `ps`/CIM; a comparação
 * aceita o erro real entre as duas fontes (`startTimesMatch`, F8).
 * Sem prova de hora (registro antigo, de quando o `ps` podia falhar), a
 * resposta é "sim" enquanto o pid existir: o pid vivo não prova que a Mesa
 * morreu, e recolher ali mataria o serve de uma dona viva. Se o PID do dono
 * existe mas não deu para ler, também é "sim": na dúvida, não mate.
 * @param {LedgerEntry} entry
 * @param {(pid: number) => ProcessInfo|null} read
 * @param {(pid: number) => boolean} exists
 * @returns {boolean}
 */
function ownerStillRuns(entry, read, exists) {
  if (!entry.ownerPid) return false;
  if (!entry.ownerStartTime) {
    try { return exists(entry.ownerPid) === true; } catch { return true; }
  }
  let info;
  try { info = read(entry.ownerPid); } catch { info = null; }
  if (info) return startTimesMatch(info.startTime, entry.ownerStartTime);
  try { return exists(entry.ownerPid) === true; } catch { return true; }
}

/**
 * Depois da carência, confere a identidade outra vez e só então escala para
 * SIGKILL. O timer não segura o processo aberto (`unref`). Sem leitura do
 * `ps`, só apaga o registro se `exists` provar que o processo sumiu; sem
 * prova nenhuma, o registro fica para a próxima abertura.
 * @param {{dir: string, entry: LedgerEntry, read: (pid: number) => ProcessInfo|null,
 *   kill: (target: KillTarget) => void, exists?: (pid: number) => boolean,
 *   setTimer: (fn: () => void, ms: number) => {unref?: () => void}, graceMs: number}} options
 * @returns {Promise<void>}
 */
function scheduleEscalation({dir, entry, read, kill, exists = processExists, setTimer, graceMs}) {
  return new Promise((resolve) => {
    const timer = setTimer(() => {
      let info;
      try { info = read(entry.pid); } catch { info = null; }
      if (!info) {
        let alive;
        try { alive = exists(entry.pid) === true; } catch { alive = true; }
        if (alive === false) clearEntryIfMatches(dir, entry);
        resolve();
        return;
      }
      if (!isAnnotatedServe(entry, info)) {
        clearEntryIfMatches(dir, entry);
        resolve();
        return;
      }
      try { kill({pid: entry.pid, pgid: entry.pid, signal: 'SIGKILL'}); } catch { /* o grupo já saiu */ }
      clearEntryIfMatches(dir, entry);
      resolve();
    }, graceMs);
    timer?.unref?.();
  });
}

/**
 * Recolhe o servidor que a Mesa deixou para trás numa queda.
 * @param {{dir?: string, read?: (pid: number) => ProcessInfo|null, kill?: (target: KillTarget) => void,
 *   exists?: (pid: number) => boolean, setTimer?: (fn: () => void, ms: number) => {unref?: () => void},
 *   graceMs?: number}} [deps]
 * @returns {SweepResult}
 * @example sweepOrphans({dir: runtime}) // {killed: [{pid, pgid}], skipped: [], entry, done}
 */
function sweepOrphans(deps = {}) {
  const {dir = '', read = readProcessInfo, kill = killGroup, exists = processExists,
    setTimer = setTimeout, graceMs = ESCALATE_AFTER_MS} = deps;
  const entry = readEntry(dir);
  if (!entry) return {killed: [], skipped: [], entry: null};
  const discard = (/** @type {string} */ reason) => {
    clearEntryIfMatches(dir, entry);
    return {killed: [], skipped: [{pid: entry.pid, reason}], entry};
  };
  if (ownerStillRuns(entry, read, exists)) {
    /* O ledger é de uma Mesa viva (a instalada e a de teste no mesmo runtime):
       o servidor não é órfão, e apagar o registro deixaria a dona sem ele. */
    return {killed: [], skipped: [{pid: entry.pid, reason: 'a Mesa dona do servidor ainda está viva'}], entry};
  }
  let info;
  try { info = read(entry.pid); } catch { info = null; }
  if (!info) {
    /* `ps` estourado não prova que o processo sumiu. Só descarta quando
       `exists` confirma a ausência; sem prova, o registro fica para a próxima
       abertura (apagar aqui deixaria um serve vivo sem anotação). */
    let alive;
    try { alive = exists(entry.pid) === true; } catch { alive = true; }
    if (alive === false) return discard('processo não existe mais');
    return {killed: [], skipped: [{pid: entry.pid, reason: 'sem prova de identidade (não foi possível ler o processo); o registro fica para a próxima abertura'}], entry};
  }
  if (!entry.startTime) {
    return {killed: [], skipped: [{pid: entry.pid, reason: 'registro sem hora de início; sem prova, o registro fica para a próxima abertura'}], entry};
  }
  if (!isAnnotatedServe(entry, info)) return discard('a linha de comando ou a hora de início não é o serve da Mesa');
  try {
    kill({pid: entry.pid, pgid: entry.pid, signal: 'SIGTERM'});
  } catch {
    return discard('o SIGTERM não pôde ser enviado');
  }
  const done = scheduleEscalation({dir, entry, read, kill, exists, setTimer, graceMs});
  return {killed: [{pid: entry.pid, pgid: entry.pid}], skipped: [], entry, done};
}

module.exports = {LEDGER_FILE, MESA_SERVE_ARGS, ESCALATE_AFTER_MS, ledgerPath, readEntry, writeEntry, clearEntry, clearEntryIfMatches, markEntryStopping,
  hasMesaArgs, isMesaServe, isAnnotatedServe, serveBinaryFromCommandLine, readProcessInfo, readCommandLine, processExists, killGroup, ownerStillRuns, sweepOrphans};
