'use strict';

/* Destino Git OPCIONAL do backup — separado do repositório do aplicativo.

   Estrutura de um destino preparado:

     <destino>/
       .mesa-git/            repositório git (bare + core.worktree = destino)
       .mesa-git/info/exclude  `.mesa-git/` fora do `git add -A`
       <arquivos>            a árvore do último snapshot válido
       ledger.json           commit atual, últimos snapshots e resultado do push
       mesas/                estados de operação em andamento (recuperação)

   Regras de ouro:
     - commit SÓ de snapshot válido (manifesto lido e hash conferido pelo
       `backup.cjs` antes de chamar);
     - push só com remoto configurado pelo usuário, sem `--force`, sem `pull`,
       sem merge automático; falha de rede mantém o commit local e grava o
       motivo no ledger (o próximo push tenta de novo);
     - nenhuma credencial no config do repositório: URL com usuário/senha é
       recusada e nunca é gravada em claro;
     - o destino não é o repositório da Mesa: `open()` recusa caminho dentro de
       `deskDir`/raiz do app.

   `runner` é injetável (testes usam repositórios git locais de verdade com o
   binário do sistema; nada de mock de git). */

const fs = require('node:fs');
const path = require('node:path');
const {message: uiMsg} = require('../i18n.mjs');
const {invalidValue} = require('../error-detail.mjs');
const {execFileSync} = require('node:child_process');

const GIT_DIR = '.mesa-git';
const LEDGER = 'ledger.json';
const BRANCH = 'main';
const GIT_ERROR = 'MESA_GIT_BACKUP_ERROR';

class GitBackupError extends Error {
  constructor(message, code = GIT_ERROR) {
    super(message);
    this.name = 'GitBackupError';
    this.code = code;
  }
}

const {isPlainObject} = require('../../plain-object.cjs');

const {readJson, atomicWrite} = require('../../json-file.cjs');


function removeQuiet(abs) {
  try {
    fs.rmSync(abs, {recursive: true, force: true});
  } catch {}
}

/* ---------- runner ---------- */

/* Prazo e teto de saída SEMPRE: um push para host sem resposta não pode travar
   o main do Electron indefinidamente, e `ls-files` de uma árvore grande não
   pode estourar o buffer padrão (1 MiB) e virar "falha" falsa. O commit local
   já está no disco quando o push falha; o ledger registra o motivo. */
const DEFAULT_TIMEOUT_MS = 120000;
const DEFAULT_MAX_BUFFER = 64 * 1024 * 1024;

function defaultRunner({gitDir, args, cwd, input = null, env = {}, timeoutMs = DEFAULT_TIMEOUT_MS, maxBuffer = DEFAULT_MAX_BUFFER}) {
  const full = gitDir ? ['--git-dir', gitDir, ...args] : [...args];
  try {
    const stdout = execFileSync('git', full, {
      cwd,
      input: input === null ? undefined : input,
      encoding: 'utf8',
      stdio: input === null ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
      env: {...process.env, GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: '', ...env},
      timeout: Number(timeoutMs) > 0 ? Math.trunc(Number(timeoutMs)) : DEFAULT_TIMEOUT_MS,
      maxBuffer: Number(maxBuffer) > 0 ? Math.trunc(Number(maxBuffer)) : DEFAULT_MAX_BUFFER,
      killSignal: 'SIGKILL',
    });
    return {code: 0, stdout: String(stdout || ''), stderr: ''};
  } catch (error) {
    const overflow = error && (error.code === 'ENOBUFS' || error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER');
    const timedOut = !overflow && (error && (error.code === 'ETIMEDOUT' || error.signal === 'SIGTERM' || error.signal === 'SIGKILL'));
    const detail = overflow
      ? `saída do git passou do limite de ${Math.trunc(Number(maxBuffer) || DEFAULT_MAX_BUFFER)} bytes`
      : timedOut
        ? `git demorou demais (limite de ${Math.trunc(Number(timeoutMs) || DEFAULT_TIMEOUT_MS)} ms)`
        : '';
    return {
      code: typeof error.status === 'number' && error.status !== 0 ? error.status : 1,
      stdout: String(error.stdout || ''),
      stderr: [detail, String(error.stderr || error.message || '')].filter(Boolean).join(' — '),
      timedOut,
      overflow,
    };
  }
}

function gitAvailable(runner = defaultRunner) {
  const probe = runner({gitDir: '', args: ['--version'], cwd: process.cwd()});
  if (probe.code !== 0) return {available: false, version: '', error: (probe.stderr || 'git indisponível').trim()};
  return {available: true, version: probe.stdout.trim(), error: ''};
}

/* ---------- segurança de URL/segredos ---------- */

/* URL com credencial embutida (`https://user:token@…`) NUNCA é gravada — e o
   usuário nem entra na URL limpa: em serviço de hospedagem o usuário costuma
   carregar o token. O `scp`-like (`git@host:path`) não carrega senha: fica.
   Autenticação é do git do usuário (chave/agent/credential helper). */
function sanitizeRemote(url) {
  const value = String(url || '').trim();
  if (!value) return {url: '', insecure: false, reason: ''};
  if (/^[a-z][a-z0-9+.-]*:\/\/[^/]*@/i.test(value)) {
    const withoutUser = value.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/]*@/i, '$1');
    try {
      const parsed = new URL(withoutUser);
      parsed.password = '';
      parsed.username = '';
      return {url: parsed.toString().replace(/\/$/, ''), insecure: true, reason: 'credencial embutida removida da URL (o git usa a autenticação do usuário)'};
    } catch {
      return {url: '', insecure: true, reason: 'URL com credencial embutida não pode ser gravada'};
    }
  }
  return {url: value, insecure: false, reason: ''};
}

function looksLikeAppRepo(destDir, {deskDir = '', repoRoot = ''} = {}) {
  /* Realpath: um symlink para dentro do app (ou o app symlinkado dentro do
     destino) conta como clash; `path.resolve` sozinho não vê isso. */
  const dest = realPathOf(destDir);
  for (const candidate of [deskDir, repoRoot]) {
    if (!candidate) continue;
    const abs = realPathOf(candidate);
    for (const probe of [abs, path.join(abs, 'desk')]) {
      const real = realPathOf(probe);
      if (dest === real || dest.startsWith(real + path.sep) || real.startsWith(dest + path.sep)) {
        return real;
      }
    }
  }
  return '';
}

/* Realpath tolerante a caminho inexistente (ancestral existente + cauda). */
function realPathOf(target) {
  let current = path.resolve(target);
  const tail = [];
  for (;;) {
    try {
      return tail.length ? path.join(fs.realpathSync(current), ...tail) : fs.realpathSync(current);
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(target);
      tail.unshift(path.basename(current));
      current = parent;
    }
  }
}

function looksLikeGitInTree(dest) {
  for (const name of ['.git', GIT_DIR]) {
    try {
      fs.lstatSync(path.join(dest, name));
      return path.join(dest, name);
    } catch {}
  }
  return '';
}

/* ---------- repositório ---------- */

function api({root, runner = defaultRunner, deskDir = '', repoRoot = '', runtime = '', backupRoot = ''} = {}) {
  if (!root) throw new GitBackupError(invalidValue('raiz do destino git', root, 'caminho absoluto'));
  const dest = realPathOf(root);
  const gitDir = path.join(dest, GIT_DIR);
  const ledgerFile = path.join(dest, LEDGER);
  const opsDir = path.join(dest, 'mesas');
  const backupDir = backupRoot ? realPathOf(backupRoot) : '';
  const runtimeRoot = runtime ? realPathOf(runtime) : '';
  /* Caminhos relativos que o git NUNCA deve versionar: o repositório do
     próprio backup, o ledger, os estados de operação e — quando o destino das
     versões mora dentro desta árvore — as versões em si. */
  const ignoredRels = [];
  if (backupDir && (backupDir === dest || backupDir.startsWith(dest + path.sep))) {
    const rel = path.relative(dest, backupDir).split(path.sep).join('/');
    if (rel) ignoredRels.push(`${rel}/`);
  }
  const ignoreLines = ['.mesa-git/', 'mesas/', 'ledger.json', ...ignoredRels];

  const run = (args, options = {}) => runner({gitDir, cwd: dest, args, ...options});
  const runPlain = (args, options = {}) => runner({gitDir: '', cwd: dest, args, ...options});

  const identity = ['-c', 'user.name=Mesa de Estudos', '-c', 'user.email=mesa@localhost'];
  const cleanConfig = [
    '-c', 'commit.gpgsign=false',
    '-c', 'core.hooksPath=/dev/null',
    '-c', 'merge.autoEditMixedEOLs=false',
  ];

  function ensureRoot() {
    const clash = looksLikeAppRepo(dest, {deskDir, repoRoot});
    if (clash) {
      throw new GitBackupError(uiMsg('err.git.inApp', {clash}));
    }
    if (runtimeRoot && (dest === runtimeRoot || dest.startsWith(runtimeRoot + path.sep) || runtimeRoot.startsWith(dest + path.sep))) {
      throw new GitBackupError(uiMsg('err.git.inRuntime'));
    }
    /* O commit reescreve a árvore do destino: pasta de versões dentro dele só
       sobrevive como FILHA DIRETA; em qualquer outro arranjo o commit a
       apagaria. */
    if (backupDir) {
      if (backupDir === dest) throw new GitBackupError(uiMsg('err.git.sameAsVersions'));
      if (backupDir.startsWith(dest + path.sep) && path.dirname(backupDir) !== dest) {
        throw new GitBackupError(uiMsg('err.git.versionsNotChild'));
      }
    }
    fs.mkdirSync(dest, {recursive: true});
    /* `ledger.json` sozinho não é repositório: um destino que já teve backup
       local e agora ganha git precisa ser preparado. Só `gitDir` conta. */
    if (fs.existsSync(gitDir)) return false;
    /* Repositório alheio no destino é recusado ANTES da checagem de pasta
       vazia, para a mensagem dizer o motivo real. */
    const clashGit = looksLikeGitInTree(dest);
    if (clashGit) throw new GitBackupError(uiMsg('err.git.hasRepo', {path: clashGit}));
    /* Inicialização nunca em pasta com arquivos desconhecidos: o primeiro
       commit apaga o que não veio do snapshot, então o que não é do backup tem
       de ser recusado ANTES de o repositório nascer. */
    const allowedInit = new Set(['.gitignore', LEDGER, 'auto.json', 'mesa-backup.json', '.DS_Store']);
    if (backupDir && path.dirname(backupDir) === dest) allowedInit.add(path.basename(backupDir));
    const unknown = fs.readdirSync(dest).filter((name) => !allowedInit.has(name));
    if (unknown.length) {
      throw new GitBackupError(uiMsg('err.git.notEmpty', {names: `${unknown.slice(0, 3).join(', ')}${unknown.length > 3 ? ', …' : ''}`}));
    }
    const probe = gitAvailable(runner);
    if (!probe.available) throw new GitBackupError(uiMsg('err.git.notFound', {detail: String(probe.error)}));
    const init = runPlain(['init', '-q', '--bare', GIT_DIR]);
    if (init.code !== 0) throw new GitBackupError(uiMsg('err.git.initFailed', {detail: (init.stderr || '').trim()}));
    const bare = run(['config', 'core.bare', 'false']);
    const worktree = run(['config', 'core.worktree', dest]);
    if (bare.code !== 0 || worktree.code !== 0) {
      throw new GitBackupError(uiMsg('err.git.prepareFailed'));
    }
    const excludeFile = path.join(gitDir, 'info', 'exclude');
    fs.mkdirSync(path.dirname(excludeFile), {recursive: true});
    if (!fs.existsSync(excludeFile)) fs.writeFileSync(excludeFile, `${GIT_DIR}/\n`);
    ensureGitignore();
    return true;
  }

  /* `.gitignore` versionado: a árvore do git mostra exatamente o que entra e
     o que fica de fora (nada de pasta de backup virando commit por engano). */
  function ensureGitignore() {
    const file = path.join(dest, '.gitignore');
    const wanted = `${ignoreLines.join('\n')}\n`;
    let current = '';
    try {
      current = fs.readFileSync(file, 'utf8');
    } catch {}
    if (current === wanted) return;
    atomicWrite(file, wanted);
  }

  function readLedger() {
    const ledger = readJson(ledgerFile);
    return isPlainObject(ledger) ? ledger : {version: 1, commits: [], last: null, push: null};
  }

  function writeLedger(patch) {
    const next = {...readLedger(), ...patch, version: 1, updatedAt: new Date().toISOString()};
    atomicWrite(ledgerFile, `${JSON.stringify(next, null, 2)}\n`);
    return next;
  }

  function git(input, options = {}) {
    const result = run(input, options);
    if (result.code !== 0) {
      throw new GitBackupError(`git ${input.join(' ')} falhou: ${(result.stderr || result.stdout || '').trim()}`);
    }
    return result;
  }

  function head() {
    const result = run(['rev-parse', 'HEAD']);
    return result.code === 0 ? result.stdout.trim() : '';
  }

  /* Copia a árvore de um snapshot (`data/`) para o destino, de forma atômica:
     primeiro um estado em `mesas/<id>/`, e a troca em si é `remove + copy`.
     Falha no meio deixa `mesas/<id>/` para a recuperação (`recover`). */
  function applyTree(snapshotDir, treeId) {
    const source = path.join(snapshotDir, 'data');
    if (!fs.existsSync(source)) throw new GitBackupError(`snapshot ${path.basename(snapshotDir)} sem dados: esperada a pasta data/`);
    const stateDir = path.join(opsDir, treeId);
    removeQuiet(stateDir);
    fs.mkdirSync(stateDir, {recursive: true});
    const journal = {treeId, snapshot: path.basename(snapshotDir), started: new Date().toISOString(), copied: 0};
    atomicWrite(path.join(stateDir, 'journal.json'), `${JSON.stringify(journal, null, 2)}\n`);
    copyTree(source, stateDir, journal);
    atomicWrite(path.join(stateDir, 'journal.json'), `${JSON.stringify(journal, null, 2)}\n`);
    /* Remove as árvores antigas do destino (o conteúdo do snapshot é a árvore
       inteira), preservando o repositório, o ledger, o próprio estado e o
       `.gitignore` que o `commitSnapshot` reescreve. */
    for (const name of fs.readdirSync(dest)) {
      if (name === GIT_DIR || name === LEDGER || name === 'mesas' || name === '.gitignore') continue;
      if (backupDir && realPathOf(path.join(dest, name)) === backupDir) continue;
      removeQuiet(path.join(dest, name));
    }
    for (const name of fs.readdirSync(stateDir)) {
      if (name === 'journal.json') continue;
      const from = path.join(stateDir, name);
      const to = path.join(dest, name);
      fs.renameSync(from, to);
    }
    if (fs.existsSync(path.join(stateDir, 'journal.json'))) {
      const done = {...journal, finished: true, finishedAt: new Date().toISOString()};
      atomicWrite(path.join(stateDir, 'journal.json'), `${JSON.stringify(done, null, 2)}\n`);
    }
    return journal.copied;
  }

  function copyTree(fromDir, toDir, journal) {
    for (const entry of fs.readdirSync(fromDir, {withFileTypes: true})) {
      const from = path.join(fromDir, entry.name);
      const to = path.join(toDir, entry.name);
      if (entry.isDirectory()) {
        fs.mkdirSync(to, {recursive: true});
        copyTree(from, to, journal);
        continue;
      }
      if (!entry.isFile()) continue;
      fs.copyFileSync(from, to);
      journal.copied++;
    }
  }

  /* Commit de um snapshot. `manifest` já vem validado pelo `backup.cjs`. */
  function commitSnapshot({snapshotDir, manifest, remote = '', log = () => {}}) {
    if (!manifest || !manifest.id) throw new GitBackupError(invalidValue('manifesto do snapshot', manifest, '{id, format: 1}'));
    if (Number(manifest.format || 0) !== 1) throw new GitBackupError(`manifesto de formato desconhecido (${manifest.format})`);
    ensureRoot();
    const before = head();
    applyTree(path.resolve(snapshotDir), manifest.id);
    ensureGitignore();
    git([...cleanConfig, 'add', '-A', '--', '.']);
    const staged = run(['diff', '--cached', '--name-only']).stdout.trim();
    let committed = false;
    if (staged) {
      const message = commitMessage(manifest);
      git([...identity, ...cleanConfig, 'commit', '-q', '-m', message]);
      committed = true;
    }
    const after = head();
    const entry = {
      id: manifest.id,
      commit: after,
      at: new Date().toISOString(),
      reason: manifest.reason || '',
      files: Number(manifest.counts && manifest.counts.entries) || 0,
      bytes: Number(manifest.counts && manifest.counts.bytes) || 0,
      message: committed ? commitMessage(manifest) : 'sem mudanças',
    };
    const ledger = readLedger();
    writeLedger({
      last: entry,
      commits: [entry, ...(Array.isArray(ledger.commits) ? ledger.commits : [])].slice(0, 50),
      initial: ledger.initial || before || after,
    });
    log(`git: ${committed ? `commit ${after.slice(0, 8)}` : 'sem mudanças'} (${manifest.id})`);
    return {committed, commit: after, previous: before, snapshotId: manifest.id, pushed: false, reason: remote ? 'envio manual' : 'sem remoto'};
  }

  function commitMessage(manifest) {
    const reason = String(manifest.reason || 'manual').replace(/\s+/g, ' ').slice(0, 60);
    const label = String(manifest.label || '').replace(/\s+/g, ' ').slice(0, 80);
    return `backup ${manifest.id}: ${reason}${label ? ` — ${label}` : ''}`;
  }

  /* Push do commit atual para um remoto JÁ CONFIGURADO pelo usuário. Sem
     `--force`, sem `pull`, sem merge: rejeição (non-fast-forward) fica no
     ledger e o commit local continua valendo. */
  function push({remote, branch = BRANCH, log = () => {}}) {
    const clean = sanitizeRemote(remote);
    if (!clean.url) {
      writeLedger({push: {at: new Date().toISOString(), ok: false, error: clean.reason || 'remoto vazio'}});
      return {pushed: false, error: clean.reason || 'remoto vazio'};
    }
    if (clean.insecure) log(`git: ${clean.reason}`);
    const result = run(['push', clean.url, `HEAD:refs/heads/${branch}`], {input: ''});
    const ok = result.code === 0;
    writeLedger({
      push: {
        at: new Date().toISOString(),
        ok,
        remote: clean.url,
        branch,
        error: ok ? '' : (result.stderr || result.stdout || '').trim().slice(0, 2000),
      },
    });
    if (ok) log(`git: push ok (${branch})`);
    else log(`git: push falhou — backup local mantido (${(result.stderr || '').trim().split('\n')[0] || 'erro'})`);
    return {pushed: ok, remote: clean.url, branch, error: ok ? '' : (result.stderr || result.stdout || '').trim()};
  }

  function setRemote(url) {
    ensureRoot();
    const clean = sanitizeRemote(url);
    if (clean.insecure && !clean.url) throw new GitBackupError(clean.reason);
    writeLedger({remote: clean.url, remoteAt: new Date().toISOString()});
    return clean;
  }

  function bundle({out = '', log = () => {}}) {
    ensureRoot();
    const target = out ? path.resolve(out) : path.join(dest, `snapshot-${Date.now()}.bundle`);
    const result = run(['bundle', 'create', target, '--all']);
    if (result.code !== 0) throw new GitBackupError(uiMsg('err.git.bundleFailed', {detail: (result.stderr || '').trim()}));
    log(`git: bundle ${target}`);
    return target;
  }

  function status() {
    const exists = fs.existsSync(gitDir);
    const ledger = readLedger();
    let files = 0;
    let bytes = 0;
    let tracked = 0;
    if (exists) {
      const listing = run(['ls-files']);
      if (listing.code === 0) {
        tracked = listing.stdout.split('\n').filter(Boolean).length;
      }
      const walk = (dir, rel) => {
        let entries;
        try {
          entries = fs.readdirSync(dir, {withFileTypes: true});
        } catch {
          return;
        }
        for (const entry of entries) {
          if (entry.name === GIT_DIR) continue;
          const abs = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(abs, rel ? `${rel}/${entry.name}` : entry.name);
          else if (entry.isFile()) {
            try {
              bytes += fs.statSync(abs).size;
              files++;
            } catch {}
          }
        }
      };
      walk(dest, '');
    }
    return {
      available: exists,
      dest,
      gitDir,
      head: exists ? head() : '',
      tracked,
      files,
      bytes,
      commits: Array.isArray(ledger.commits) ? ledger.commits.length : 0,
      last: ledger.last || null,
      push: ledger.push || null,
      remote: ledger.remote || '',
      branch: BRANCH,
    };
  }

  /* Recuperação: operação morta no meio (`mesas/<id>/journal.json` sem
     `finished`) ou árvore suja (queda entre copiar e commitar). Devolve a
     árvore ao último commit sem force push nenhum — o remoto não é tocado. */
  function recover({log = () => {}} = {}) {
    const report = {reset: false, cleaned: [], head: ''};
    if (!fs.existsSync(gitDir)) return report;
    let names;
    try {
      names = fs.readdirSync(opsDir);
    } catch {
      names = [];
    }
    for (const name of names) {
      const stateDir = path.join(opsDir, name);
      const journal = readJson(path.join(stateDir, 'journal.json'));
      if (journal && journal.finished) {
        removeQuiet(stateDir);
        continue;
      }
      removeQuiet(stateDir);
      report.cleaned.push(name);
      log(`git: operação interrompida removida (${name})`);
    }
    const dirty = run(['status', '--porcelain']).stdout.trim();
    if (dirty) {
      const initial = head();
      /* Sem commit ainda não há o que restaurar: só limpa o que não é do
         repositório (reset --hard HEAD falharia e derrubaria a recuperação). */
      if (initial) {
        const reset = run([...cleanConfig, 'reset', '--hard', 'HEAD']);
        report.reset = reset.code === 0;
        if (reset.code !== 0) {
          throw new GitBackupError(`não foi possível recuperar a árvore do backup: ${(reset.stderr || '').trim()}`);
        }
      }
      /* `reset --hard` não apaga untracked; a árvore é reconstruída do HEAD. */
      const clean = run([...cleanConfig, 'clean', '-fd', '--', '.']);
      if (clean.code !== 0) {
        throw new GitBackupError(`não foi possível recuperar a árvore do backup: ${(clean.stderr || '').trim()}`);
      }
      log('git: árvore devolvida ao último commit');
    }
    report.head = head();
    return report;
  }

  function integrate({snapshotDir, manifest, remote = '', branch = BRANCH, log = () => {}}) {
    const created = ensureRoot();
    const result = commitSnapshot({snapshotDir, manifest, remote, branch, log});
    writeLedger({
      git: {
        snapshotId: manifest.id,
        commit: result.commit,
        committed: result.committed,
        pushed: !!result.pushed,
        pushError: result.error || '',
        at: new Date().toISOString(),
      },
    });
    return {...result, created};
  }

  return {
    dest,
    gitDir,
    ensureRoot,
    commitSnapshot,
    push,
    setRemote,
    bundle,
    status,
    recover,
    integrate,
    readLedger,
    writeLedger,
  };
}

module.exports = {
  GitBackupError,
  GIT_ERROR,
  GIT_DIR,
  LEDGER,
  BRANCH,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_BUFFER,
  api,
  asyncApi,
  gitAvailable,
  sanitizeRemote,
  looksLikeAppRepo,
  looksLikeGitInTree,
  realPathOf,
  defaultRunner,
};

/* O domínio síncrono também serve à CLI. No Electron, todas as operações
   Git executam em worker para manter menus, IPC e timers responsivos. */
function asyncApi(options) {
  const {Worker} = require('node:worker_threads');
  const local = api(options);
  const result = {dest: local.dest, gitDir: local.gitDir};
  for (const method of ['status', 'integrate', 'push', 'setRemote', 'recover']) {
    result[method] = (payload) => {
      // Runners injetados são exclusivos de testes, não serializáveis.
      if (options.runner && options.runner !== defaultRunner) return Promise.resolve().then(() => local[method](payload));
      const {runner, ...workerOptions} = options;
      const log = payload?.log;
      const data = typeof payload === 'object' && payload ? {...payload, log: undefined} : payload;
      return new Promise((resolve, reject) => {
        const worker = new Worker(path.join(__dirname, 'git-backup-worker.cjs'), {
          workerData: {options: workerOptions, method, payload: data}, execArgv: [],
        });
        let settled = false;
        worker.on('message', message => {
          if (message.kind === 'log') { try { log?.(message.line); } catch {} return; }
          settled = true;
          if (message.kind === 'error') reject(new GitBackupError(message.message, message.code));
          else resolve(message.result);
        });
        worker.on('error', reject);
        worker.on('exit', code => { if (!settled) reject(new GitBackupError(`worker Git encerrou sem resultado (${code})`)); });
      });
    };
  }
  return result;
}
