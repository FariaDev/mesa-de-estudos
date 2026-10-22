'use strict';

/* Serviços de backup/compartilhamento para o host (mesmo padrão de
   `services.cjs` do domínio estudo): o host fornece runtime, matérias e a
   configuração atual; o adapter resolve os caminhos, chama os módulos de
   domínio e NUNCA aceita caminho vindo do renderer. O `main.cjs` só registra
   IPC e traduz erro.

   Onde as coisas moram:
     runtime        — `<runtime>/…` (as áreas capturadas/restauradas);
     deskDir        — para ler a versão do app no manifesto;
     settingsFile   — ARQUIVO de config do destino (o host passa
                      `<runtime>/mesa-backup.json`; `readConfig(runtime())` do
                      host lê o mesmo arquivo);
     backupRoot()   — pasta de destino das versões (escolhida pelo usuário);
     gitRoot()      — pasta do repositório git de backup (opcional, separada);
     external()     — allowlist de sessões nativas do HOST (sem varredura de home).

   Nenhuma chamada autoriza caminho: `destination`/`gitRoot` vêm do diálogo
   nativo no main; o adapter confere por realpath (symlink incluso) que o git
   não cai no app/runtime, que o destino não é o runtime em nenhuma direção e
   que as versões não são apagadas pelo commit do git. */

const fs = require('node:fs');
const path = require('node:path');
const backup = require('./backup.cjs');
const {invalidValue} = require('../error-detail.mjs');
const packages = require('./packages.cjs');
const gitBackup = require('./git-backup.cjs');
const {message: uiMsg}=require('../i18n.mjs');

const BACKUP_ERROR = 'MESA_BACKUP_SERVICE_ERROR';

function serviceError(message) {
  const error = new Error(message);
  error.code = BACKUP_ERROR;
  return error;
}

/* Realpath tolerante a caminho que ainda não existe (o diálogo pode devolver
   uma pasta a criar): resolve o ancestral existente mais próximo e recompõe a
   cauda. É o que faz symlink valer nas DUAS direções da comparação. */
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

/* Relação entre dois caminhos reais: mesma pasta, um dentro do outro. */
function pathRelation(a, b) {
  const left = realPathOf(a);
  const right = realPathOf(b);
  return {
    left,
    right,
    same: left === right,
    leftInRight: left !== right && left.startsWith(right + path.sep),
    rightInLeft: left !== right && right.startsWith(left + path.sep),
    overlap: left === right || left.startsWith(right + path.sep) || right.startsWith(left + path.sep),
  };
}

/* Reúne as pastas de material das matérias. `courses` é a lista do host
   (`{id, name, path}`); só entram pastas que existem de verdade, são
   diretórios e não resolvem para dentro do runtime (o runtime já é capturado
   inteiro; uma pasta de matéria que é link para ele não pode duplicar). */
function materialsOf(courses, runtime) {
  const runtimeAbs = path.resolve(runtime);
  const runtimeReal = fs.existsSync(runtimeAbs) ? fs.realpathSync(runtimeAbs) : runtimeAbs;
  const out = [];
  for (const course of courses || []) {
    if (!course || typeof course.path !== 'string' || !course.path) continue;
    let real;
    try {
      real = fs.realpathSync(path.resolve(course.path));
    } catch {
      continue;
    }
    let stat;
    try {
      stat = fs.statSync(real);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;
    if (real === runtimeReal || real.startsWith(runtimeReal + path.sep)) continue;
    out.push({id: String(course.id || ''), name: String(course.name || ''), path: real});
  }
  return out;
}

/* O estudo da matéria mora em `<runtime>/learning/Courses/<id>` (é o layout
   que `main.cjs#prepareCourse` e `search.cjs#coursePathFor` usam); o NOME é
   rótulo, nunca pasta. Id fora de um único componente (`../x`, `.`) não vira
   caminho. */
function studyDirOf(runtime, course) {
  const id = String(course && course.id ? course.id : '');
  if (!id || id === '.' || id === '..' || path.basename(id) !== id) return '';
  const dir = path.join(path.resolve(runtime), 'learning', 'Courses', id);
  try {
    return fs.statSync(dir).isDirectory() ? dir : '';
  } catch {
    return '';
  }
}

function createBackupServices({
  runtime,
  deskDir = '',
  repoRoot = '',
  settingsFile = '',
  backupRoot = () => '',
  gitRoot = () => '',
  courses = () => [],
  allowed = () => new Set(),
  external = () => [],
  gitRunner = undefined,
  log = () => {},
}) {
  if (typeof runtime !== 'function') throw serviceError(invalidValue('runtime de createBackupServices', runtime, 'function'));
  const runtimeDir = () => path.resolve(runtime());
  const appRoots = () => [repoRoot, deskDir].filter((item) => typeof item === 'string' && item).map((item) => path.resolve(item));
  const file = () => {
    const target = settingsFile || path.join(path.dirname(runtimeDir()), 'mesa-backup.json');
    return path.resolve(target);
  };

  /* Config mora no ARQUIVO `settingsFile` (o host passa `<runtime>/mesa-backup.json`).
     `readConfig(runtime())` do host continua lendo o mesmo arquivo. */
  function settings() {
    const root = backupRoot();
    return backup.resolveSettings(file(), {destination: root || '', env: process.env, configFile: file()});
  }

  function gitApi() {
    const root = settings().gitRoot || gitRoot();
    if (!root) return null;
    return gitBackup.asyncApi({root, deskDir, repoRoot, runtime: runtimeDir(), backupRoot: backupRoot(), runner: gitRunner});
  }

  async function status() {
    const settingsNow = settings();
    const root = settingsNow.destination;
    const base = root ? backup.readStatus(root) : {available: false, lastBackupAt: '', lastSnapshotId: '', lastError: '', last: null, auto: {attemptedAt: '', snapshotId: '', error: ''}, gitError: '', gitAt: ''};
    const versions = root ? backup.list(root) : [];
    const lastVersion = versions[0] || null;
    const git = gitApi();
    return {
      available: !!root,
      destination: root,
      settings: {
        auto: settingsNow.auto,
        intervalHours: settingsNow.intervalHours,
        idleMinutes: settingsNow.idleMinutes,
        keep: settingsNow.keep,
        binaries: settingsNow.binaries,
        git: settingsNow.git,
        gitRoot: settingsNow.gitRoot || gitRoot(),
        gitRemote: settingsNow.gitRemote,
      },
      last: base.lastVersion || (lastVersion ? {id: lastVersion.snapshotId, created: lastVersion.created, bytes: lastVersion.bytes, entries: lastVersion.entries, reason: lastVersion.reason} : null),
      lastError: base.lastError || '',
      gitError: base.gitError || '',
      gitAt: base.gitAt || '',
      auto: base.auto || {attemptedAt: '', snapshotId: '', error: ''},
      versions,
      git: git && fs.existsSync(git.gitDir) ? await git.status() : {available: false},
    };
  }

  /* Configuração: grava SÓ em `mesa-backup.json` — nunca no config.json do
     usuário (a integração do pai decide se copia o destino para lá). */
  function configure(patch = {}) {
    const clean = {};
    if (typeof patch.destination === 'string' && patch.destination) clean.destination = path.resolve(patch.destination);
    if (typeof patch.auto === 'boolean') clean.auto = patch.auto;
    if (Number(patch.intervalHours) > 0) clean.intervalHours = Number(patch.intervalHours);
    if (Number(patch.idleMinutes) > 0) clean.idleMinutes = Number(patch.idleMinutes);
    if (Number(patch.keep) > 0) clean.keep = Number(patch.keep);
    if (patch.binaries === 'exclude' || patch.binaries === 'include') clean.binaries = patch.binaries;
    if (typeof patch.git === 'boolean') clean.git = patch.git;
    if (typeof patch.gitRoot === 'string' && patch.gitRoot) clean.gitRoot = path.resolve(patch.gitRoot);
    if (typeof patch.gitRemote === 'string') clean.gitRemote = gitBackup.sanitizeRemote(patch.gitRemote).url;
    const saved = backup.writeConfigFile(file(), clean);
    log('backup', `config atualizada (destino ${saved.destination || '—'})`);
    return settings();
  }

  function guardDestination(target) {
    const value = String(target || '').trim();
    if (!value) throw serviceError(uiMsg('err.backup.pickBackupFolder'));
    const abs = path.resolve(value);
    /* Symlinks contam: recusa em AMBAS as direções (destino dentro do runtime
       ou contendo o runtime; o snapshot se copiaria ou a restauração
       sobrescreveria arquivos fora do alvo). */
    const runtimeRelation = pathRelation(abs, runtimeDir());
    if (runtimeRelation.overlap) {
      throw serviceError(uiMsg('err.backup.destInRuntime'));
    }
    for (const probe of appRoots()) {
      if (pathRelation(abs, probe).overlap) {
        throw serviceError(uiMsg('err.backup.destInApp'));
      }
    }
    return abs;
  }

  function guardGitRoot(target) {
    const value = String(target || '').trim();
    if (!value) throw serviceError(uiMsg('err.backup.pickRepoFolder'));
    const abs = path.resolve(value);
    const clash = gitBackup.looksLikeAppRepo(abs, {deskDir, repoRoot});
    if (clash) throw serviceError(uiMsg('err.backup.gitInApp', {clash}));
    const runtimeRelation = pathRelation(abs, runtimeDir());
    if (runtimeRelation.overlap) {
      throw serviceError(uiMsg('err.backup.gitInRuntime'));
    }
    /* O git reescreve a árvore inteira no commit: pasta de versões dentro do
       destino Git só sobrevive como FILHA DIRETA (o git a ignora); mais fundo,
       o commit apagaria as versões. Git dentro da pasta das versões também é
       recusado (o repositório ficaria no meio dos snapshots). */
    const dest = backupRoot();
    if (dest) {
      const relation = pathRelation(abs, path.resolve(dest));
      if (relation.same) throw serviceError(uiMsg('err.backup.gitSameAsVersions'));
      if (relation.leftInRight) throw serviceError(uiMsg('err.backup.gitInVersions'));
      if (relation.rightInLeft && path.dirname(relation.right) !== relation.left) {
        throw serviceError(uiMsg('err.backup.versionsNotChild'));
      }
    }
    return abs;
  }

  /* Allowlist externa vem do HOST (callback), nunca de varredura de home: o
     que não estiver listado não entra. O adapter só normaliza o que o
     `backup.cjs` entende e remove repetidos por caminho. */
  function externalSources() {
    const raw = typeof external === 'function' ? external() : external;
    const out = [];
    const seen = new Set();
    for (const item of Array.isArray(raw) ? raw : []) {
      if (!item || typeof item.path !== 'string' || !item.path) continue;
      const abs = path.resolve(item.path);
      if (seen.has(abs)) continue;
      seen.add(abs);
      out.push({
        path: abs,
        ref: typeof item.ref === 'string' && item.ref ? item.ref : path.basename(abs),
        resume: typeof item.resume === 'string' ? item.resume : '',
        include: item.include !== false,
      });
    }
    return out;
  }

  async function run({reason = 'manual', label = ''} = {}) {
    const settingsNow = settings();
    const root = guardDestination(settingsNow.destination);
    const result = await backup.backupNow({
      runtime: runtimeDir(),
      root,
      deskDir,
      materials: materialsOf(courses(), runtimeDir()),
      external: externalSources(),
      binaries: settingsNow.binaries === 'exclude' ? 'exclude' : 'include',
      reason,
      label,
      keep: settingsNow.keep,
      log: (line) => log('backup', line),
    });
    return versionInGit(result, settingsNow, root);
  }

  async function versionInGit(result, settingsNow, root) {
    let git = null;
    if (settingsNow.git) {
      try {
        const gitApiInstance = gitApi();
        if (!gitApiInstance) throw serviceError(uiMsg('err.backup.configGit'));
        git = await gitApiInstance.integrate({
          snapshotDir: result.path,
          manifest: backup.readManifest(result.path),
          remote: settingsNow.gitRemote || '',
          log: (line) => log('backup-git', line),
        });
        backup.writeStatus(root, {gitError: '', gitAt: new Date().toISOString()});
      } catch (error) {
        /* Falha do git NUNCA derruba o backup local: fica no status. */
        backup.writeStatus(root, {gitError: error.message, gitAt: new Date().toISOString()});
        log('backup-git', `commit falhou: ${error.message}`);
        git = {error: error.message};
      }
    }
    return {...result, git};
  }

  function listVersions() {
    const root = settings().destination;
    return root ? backup.list(root) : [];
  }

  async function verify(snapshotId) {
    const root = guardDestination(settings().destination);
    const dir = backup.snapshotDirFor(root, snapshotId);
    const report = await backup.verifySnapshot(dir, {strict: true, log: (line) => log('backup', line)});
    return {...report, snapshotId};
  }

  async function previewRestore(snapshotId) {
    const root = guardDestination(settings().destination);
    const plan = await backup.prepareRestore({runtime: runtimeDir(), root, snapshotId, log: (line) => log('backup', line)});
    return decoratePlan(plan);
  }

  /* A prévia devolve os grupos de material já com o caminho que o host conhece
     hoje e se ele existe: a UI mostra a proposta de remapeamento e o root usa
     `materialCourses` depois de aplicar (config fora do runtime é do root). */
  function decoratePlan(plan) {
    const list = (typeof courses === 'function' ? courses() : courses) || [];
    const materials = (Array.isArray(plan.materials) ? plan.materials : []).map((item) => {
      const course = list.find((one) => one && String(one.id || '') === String(item.courseId || ''));
      const currentPath = course && typeof course.path === 'string' ? course.path : '';
      let currentExists = false;
      try {
        currentExists = !!currentPath && fs.statSync(currentPath).isDirectory();
      } catch { /* pasta de outra máquina */ }
      return {...item, currentPath, currentExists};
    });
    return {...plan, materials};
  }

  async function applyRestore(planId, {materials = 'auto'} = {}) {
    /* A remapeação é explícita: 'remap' força, 'auto' só quando a pasta de
       origem não existe nesta máquina, 'keep' preserva as referências. */
    const plan = decoratePlan(backup.readPlan(runtimeDir(), planId));
    const result = await backup.applyRestore({runtime: runtimeDir(), planId, materials, log: (line) => log('backup', line)});
    return {...result, materials: plan.materials};
  }

  function cancelRestore(planId) {
    return backup.cancelRestore({runtime: runtimeDir(), planId});
  }

  function rollbackRestore(planId) {
    return backup.rollbackRestore({runtime: runtimeDir(), planId, log: (line) => log('backup', line)});
  }

  function recover() {
    return backup.recoverRestore({runtime: runtimeDir(), log: (line) => log('backup', line)});
  }

  /* Allowlist externa (config pessoal/sessão nativa): a restauração guarda o
     arquivo em `<runtime>/external/<ref>` e NUNCA escreve sozinha na pasta de
     origem. A devolução é opcional e só vale para um caminho que o HOST ainda
     autoriza pelo `ref`, nunca link simbólico, com pré-restore antes. */
  function externalPlan(planIdOrPlan) {
    const plan = typeof planIdOrPlan === 'string' ? backup.readPlan(runtimeDir(), planIdOrPlan) : planIdOrPlan || {};
    const list = externalSources();
    return (Array.isArray(plan.external) ? plan.external : []).map((rel) => {
      const ref = String(rel).replace(/^external\//, '');
      const stored = path.join(runtimeDir(), 'external', ref);
      const targets = list.filter((item) => item.include !== false && item.ref === ref).map((item) => item.path);
      return {ref, stored, exists: fs.existsSync(stored), targets, authorized: targets.length > 0};
    });
  }

  /* Aceita o id do plano OU um objeto `{external:[…]}` (o resultado de
     `applyRestore`), porque a aplicação descarta o plano depois de gravar. */
  function restoreExternal(planIdOrPlan, {ref, apply = false} = {}) {
    const entry = externalPlan(planIdOrPlan).find((item) => item.ref === String(ref || ''));
    if (!entry) throw serviceError(uiMsg('err.backup.externalMissing', {ref}));
    if (!entry.authorized) throw serviceError(uiMsg('err.backup.externalUnauthorized'));
    if (!entry.exists) throw serviceError(uiMsg('err.backup.restoredMissing', {ref: entry.ref}));
    const target = path.resolve(entry.targets[0]);
    let stat = null;
    try {
      stat = fs.lstatSync(target);
    } catch { /* será criado */ }
    if (stat && stat.isSymbolicLink()) throw serviceError(uiMsg('err.backup.targetSymlink'));
    if (stat && !stat.isFile()) throw serviceError(uiMsg('err.backup.targetNotFile'));
    const same = !!stat && fs.readFileSync(target).equals(fs.readFileSync(entry.stored));
    if (!apply) return {ok: true, ref: entry.ref, stored: entry.stored, target, targets: entry.targets, action: same ? 'same' : stat ? 'replace' : 'create'};
    let backupOf = '';
    if (stat && !same) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      backupOf = path.join(runtimeDir(), '.backup', 'external-pre-restore', stamp, path.basename(target));
      fs.mkdirSync(path.dirname(backupOf), {recursive: true});
      fs.copyFileSync(target, backupOf);
    }
    if (!same) {
      fs.mkdirSync(path.dirname(target), {recursive: true});
      const tmp = `${target}.mesa-external-${process.pid}`;
      fs.copyFileSync(entry.stored, tmp);
      fs.renameSync(tmp, target);
    }
    log('backup', `origem externa devolvida: ${entry.ref}`);
    return {ok: true, ref: entry.ref, stored: entry.stored, target, targets: entry.targets, action: same ? 'same' : 'restored', backupOf};
  }

  /* Agendador: o root chama em intervalo curto; o módulo decide se é a hora
     (inatividade + período). O resultado fica no ledger do destino. */
  async function auto() {
    const settingsNow = settings();
    if (!settingsNow.auto || !settingsNow.destination) return {ran: false, why: 'automático desligado'};
    const root = guardDestination(settingsNow.destination);
    const result = await backup.runAutoBackup({
      runtime: runtimeDir(),
      root,
      deskDir,
      materials: materialsOf(courses(), runtimeDir()),
      external: externalSources(),
      settings: settingsNow,
      log: (line) => log('backup', line),
    });
    if (result.ran && result.ok) result.result = await versionInGit(result.result, settingsNow, root);
    return result;
  }

  function autoDue() {
    const current = settings();
    return backup.shouldAutoBackup({runtime: runtimeDir(), root: current.destination, settings: current});
  }

  /* Compartilhar matéria: `courseId` vazio = matéria ativa do host. Com id
     explícito, id desconhecido é ERRO (nunca exporta a primeira matéria
     calada). O arquivo é gravado com criação exclusiva: corrida/arquivo
     existente ganha sufixo e o arquivo do usuário nunca é sobrescrito. */
  /** @param {{directory?: string, courseId?: string, conversations?: boolean}} [options] */
  function exportCourse({directory, courseId = '', conversations = false} = {}) {
    const target = String(directory || '').trim();
    if (!target) throw serviceError(uiMsg('err.backup.pickSaveCourse'));
    const dir = path.resolve(target);
    let stat;
    try {
      stat = fs.statSync(dir);
    } catch {
      throw serviceError(uiMsg('err.backup.folderMissing', {dir}));
    }
    if (!stat.isDirectory()) throw serviceError(uiMsg('err.backup.folderMissing', {dir}));
    const list = courses() || [];
    const course = courseId ? list.find((item) => item && item.id === courseId) : list[0];
    if (!course) throw serviceError(courseId ? `Matéria não encontrada: ${courseId}` : 'Nenhuma matéria aberta para exportar.');
    const built = packages.buildPackage({
      runtime: runtimeDir(),
      course: {id: course.id, name: course.name},
      materialsDir: course.path || '',
      learningDir: studyDirOf(runtimeDir(), course),
      include: {review: true, bookmarks: true, resume: true, conversations: conversations === true},
    });
    const written = packages.writePackageFile({root: dir, name: String(course.name || course.id || 'materia'), buffer: built.buffer});
    log('backup', `pacote exportado: ${written.file} (${built.manifest.counts.files} arquivo(s))`);
    return {file: written.file, bytes: built.buffer.length, renamed: written.renamed, features: built.manifest.features, counts: built.manifest.counts};
  }

  function previewImport({file, directory, name = ''} = {}) {
    const source = String(file || '').trim();
    if (!source) throw serviceError(uiMsg('err.backup.pickCourseFile'));
    let stat;
    try {
      stat = fs.statSync(source);
    } catch {
      throw serviceError(uiMsg('err.backup.fileMissing', {source}));
    }
    if (!stat.isFile()) throw serviceError(uiMsg('err.backup.fileMissing', {source}));
    const dir = String(directory || '').trim();
    if (!dir) throw serviceError(uiMsg('err.backup.pickNewCourseFolder'));
    const buffer = fs.readFileSync(source);
    const destination = packages.planDestination({root: path.resolve(dir), name: name || 'Matéria importada'});
    const preview = packages.previewImport({buffer, destination});
    return {...preview, file: source};
  }

  function importCourse({file, directory, name = ''} = {}) {
    const preview = previewImport({file, directory, name});
    const result = packages.importPackage({buffer: fs.readFileSync(preview.file), destination: {dir: preview.destination.dir, name: preview.destination.name}, courseId: preview.courseId});
    log('backup', `matéria importada em ${result.destination} (${result.files} arquivo(s))`);
    /* O host registra a matéria nova apontando para `materialsDir`. */
    return {...result, course: {id: result.courseId, name: preview.destination.name, path: result.materialsDir}, preview: {counts: preview.counts, conversations: preview.conversations}};
  }

  async function gitStatus() {
    const instance = gitApi();
    if (!instance || !fs.existsSync(instance.gitDir)) return {available: false};
    return instance.status();
  }

  async function gitPush() {
    const settingsNow = settings();
    const instance = gitApi();
    if (!instance) throw serviceError(uiMsg('err.backup.configBeforePush'));
    if (settingsNow.gitRemote) await instance.setRemote(settingsNow.gitRemote);
    return instance.push({remote: settingsNow.gitRemote, log: (line) => log('backup-git', line)});
  }

  async function gitRecover() {
    const instance = gitApi();
    if (!instance) return {available: false};
    return instance.recover({log: (line) => log('backup-git', line)});
  }

  return {
    status,
    configure,
    run,
    auto,
    autoDue,
    listVersions,
    verify,
    previewRestore,
    applyRestore,
    cancelRestore,
    rollbackRestore,
    recover,
    decoratePlan,
    externalPlan,
    restoreExternal,
    exportCourse,
    previewImport,
    importCourse,
    gitStatus,
    gitPush,
    gitRecover,
    /* Utilidades para o main conferir o que o usuário escolheu no diálogo. */
    guardDestination,
    guardGitRoot,
    materials: () => materialsOf(courses(), runtimeDir()),
    externalSources,
    settingsPath: file,
    courseFor: (courseId) => (courses() || []).find((item) => item && item.id === courseId) || null,
    allowedPaths: () => allowed(),
  };
}

module.exports = {createBackupServices, serviceError, materialsOf, studyDirOf, BACKUP_ERROR};
