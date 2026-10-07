'use strict';

/* Diário externo da promoção Livre → matéria.
 *
 * `free-workspaces.cjs` já tem a transação PRÓPRIA dele (staging → rename →
 * recibo, com recuperação por sessão). O que ele não cobre são as OUTRAS
 * gravações que uma promoção precisa fazer no host: o `config.json` ganha a
 * matéria nova, o descritor Claude troca de `courseId` e o `desk.json` ganha o
 * `courseState` da matéria nova. Sem um diário, um crash entre essas escritas
 * deixaria os arquivos em fases diferentes — matéria na config apontando para
 * pasta que não existe, descritor promovido sem recibo, etc.
 *
 * Este módulo é o diário externo: antes de tocar em qualquer arquivo ele
 * guarda uma CÓPIA byte a byte do original; a fase (`prepared` → `applying` →
 * `committing` → `committed`) diz ao boot o que fazer:
 *
 *   - `prepared`/`applying`  → desfaz: restaura os arquivos byte a byte e
 *                               manda o store desfazer o staging;
 *   - `committing`/`committed` → conclui: confirma a transação do store
 *                               (rename + recibo), garante config/descritor/
 *                               desk com a matéria e apaga o diário.
 *
 * A pasta de destino só é apagada pelo store (`rollbackPromotion`), que
 * verifica conteúdo e sha256 antes de remover qualquer coisa: nada estranho é
 * destruído. O boot chama `recover` ANTES de ler `desk.json`/`config.json` e
 * só varre o store "sozinho" nas sessões SEM diário (`sessions`), para não
 * concluir/desfazer uma transação de host ainda pela metade.
 *
 * Puro Node (fs/path/crypto): sem Electron, sem IPC. Testável isolado. */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DIR = 'free-promotions';
const VERSION = 1;
const TOKEN_RE = /^[A-Za-z0-9._-]{1,128}$/;
const PHASES = new Set(['prepared', 'applying', 'committing', 'committed']);

class FreePromotionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'FreePromotionError';
    this.code = code;
  }
}

const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const nowIso = () => new Date().toISOString();

function journalRoot(runtime) {
  return path.join(runtime, DIR);
}

function journalDir(runtime, token) {
  return path.join(journalRoot(runtime), token);
}

function journalFile(runtime, token) {
  return path.join(journalDir(runtime, token), 'journal.json');
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/* Publicação atômica do diário: um crash no meio da escrita nunca deixa um
   JSON pela metade no caminho final (o tmp é renomeado). */
function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const tmp = `${file}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 1) + '\n');
  try {
    fs.renameSync(tmp, file);
  } catch (error) {
    try { fs.rmSync(tmp, {force: true}); } catch { /* já foi */ }
    throw error;
  }
}

function validJournal(raw, token) {
  if (!isPlainObject(raw)) return false;
  if (raw.version !== VERSION) return false;
  if (raw.token !== token) return false;
  if (!TOKEN_RE.test(raw.token)) return false;
  if (!PHASES.has(raw.phase)) return false;
  if (typeof raw.freeSessionId !== 'string' || !raw.freeSessionId) return false;
  if (typeof raw.courseId !== 'string' || !raw.courseId) return false;
  if (typeof raw.folderPath !== 'string' || !path.isAbsolute(raw.folderPath)) return false;
  if (!isPlainObject(raw.files)) return false;
  return true;
}

function listTokens(runtime) {
  let entries = [];
  try {
    entries = fs.readdirSync(journalRoot(runtime), {withFileTypes: true});
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isDirectory() && TOKEN_RE.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function readJournal(runtime, token) {
  const raw = readJson(journalFile(runtime, token));
  if (!validJournal(raw, token)) return null;
  return raw;
}

/* Sessões com um diário em andamento — o boot não deve mexer no store delas
   por conta própria enquanto o diário não estiver resolvido. */
function sessions(runtime) {
  const out = new Set();
  for (const token of listTokens(runtime)) {
    const journal = readJournal(runtime, token);
    if (journal && journal.freeSessionId) out.add(journal.freeSessionId);
  }
  return out;
}

/* Abre o diário e tira as cópias dos arquivos que a transação vai escrever.
   `files` é uma lista de `{label, file}`; o backup fica em
   `<journalDir>/backups/<label>` e o original ausente é registrado como tal
   (o rollback apaga o que a operação criou). */
function begin(runtime, spec = {}) {
  const token = typeof spec.token === 'string' ? spec.token : '';
  if (!TOKEN_RE.test(token)) throw new FreePromotionError('BAD_TOKEN', 'token de promoção inválido');
  if (typeof spec.freeSessionId !== 'string' || !spec.freeSessionId) {
    throw new FreePromotionError('BAD_SESSION', 'sessão da promoção ausente');
  }
  const dir = journalDir(runtime, token);
  if (fs.lstatSync(journalFile(runtime, token), {throwIfNoEntry: false})) {
    throw new FreePromotionError('EXISTS', 'já existe um diário para esta promoção');
  }
  fs.mkdirSync(path.join(dir, 'backups'), {recursive: true, mode: 0o700});
  const files = {};
  try {
    for (const item of Array.isArray(spec.files) ? spec.files : []) {
      const label = typeof item?.label === 'string' && /^[A-Za-z0-9._-]{1,32}$/.test(item.label) ? item.label : '';
      const file = typeof item?.file === 'string' && path.isAbsolute(item.file) ? path.resolve(item.file) : '';
      if (!label || !file) continue;
      const stats = fs.lstatSync(file, {throwIfNoEntry: false});
      if (stats && stats.isFile()) {
        const backup = path.join(dir, 'backups', label);
        fs.copyFileSync(file, backup);
        files[label] = {file, backup, existed: true, sha256: sha256File(backup)};
      } else {
        files[label] = {file, backup: null, existed: false, sha256: ''};
      }
    }
    const journal = {
      version: VERSION,
      token,
      freeSessionId: spec.freeSessionId,
      courseId: typeof spec.courseId === 'string' ? spec.courseId : '',
      courseName: typeof spec.courseName === 'string' ? spec.courseName : '',
      folderPath: typeof spec.folderPath === 'string' ? spec.folderPath : '',
      folderName: typeof spec.folderName === 'string' ? spec.folderName : '',
      stagingPath: typeof spec.stagingPath === 'string' ? spec.stagingPath : '',
      parentDir: typeof spec.parentDir === 'string' ? spec.parentDir : '',
      nativePath: typeof spec.nativePath === 'string' ? spec.nativePath : '',
      activeCourseId: typeof spec.activeCourseId === 'string' ? spec.activeCourseId : '',
      activeSession: typeof spec.activeSession === 'string' ? spec.activeSession : '',
      engine: spec.engine === 'claude' ? 'claude' : 'pi',
      descriptorFile: typeof spec.descriptorFile === 'string' ? spec.descriptorFile : '',
      configFile: typeof spec.configFile === 'string' ? spec.configFile : '',
      deskFile: typeof spec.deskFile === 'string' ? spec.deskFile : '',
      courseEntry: isPlainObject(spec.courseEntry) ? spec.courseEntry : null,
      courseState: isPlainObject(spec.courseState) ? spec.courseState : null,
      files,
      phase: 'prepared',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    writeJsonAtomic(journalFile(runtime, token), journal);
    return {
      token,
      dir,
      journal,
      mark(phase) {
        if (!PHASES.has(phase)) throw new FreePromotionError('BAD_PHASE', 'fase de promoção inválida');
        journal.phase = phase;
        journal.updatedAt = nowIso();
        writeJsonAtomic(journalFile(runtime, token), journal);
        return journal;
      },
      rollback(deps) {
        journal.updatedAt = nowIso();
        writeJsonAtomic(journalFile(runtime, token), journal);
        return rollbackJournal(runtime, journal, deps);
      },
      finish() {
        fs.rmSync(dir, {recursive: true, force: true});
      },
    };
  } catch (error) {
    try { fs.rmSync(dir, {recursive: true, force: true}); } catch { /* já foi */ }
    throw error;
  }
}

/* Restaura cada arquivo ao byte anterior (ou apaga o que não existia). A
   restauração é idempotente: repetir depois de um crash no meio do rollback
   converge para o mesmo estado. */
function restoreFile(entry) {
  if (!entry || typeof entry.file !== 'string') return;
  if (entry.existed) {
    const backup = entry.backup && fs.lstatSync(entry.backup, {throwIfNoEntry: false});
    if (!backup || !backup.isFile()) throw new FreePromotionError('NO_BACKUP', `backup ausente: ${entry.file}`);
    fs.mkdirSync(path.dirname(entry.file), {recursive: true});
    fs.copyFileSync(entry.backup, entry.file);
  } else if (fs.lstatSync(entry.file, {throwIfNoEntry: false})) {
    fs.rmSync(entry.file, {force: true});
  }
}

function rollbackJournal(runtime, journal, {store, log = () => {}} = {}) {
  let storeError = null;
  for (const entry of Object.values(journal.files || {})) restoreFile(entry);
  if (store && typeof store.rollbackPromotion === 'function') {
    try {
      store.rollbackPromotion(runtime, journal.freeSessionId);
    } catch (error) {
      storeError = error;
    }
  }
  if (storeError) {
    /* A pasta de destino tem conteúdo que não é nosso: NADA é apagado e o
       diário fica para uma tentativa humana. Os arquivos do host já voltaram. */
    log(`rollback do diário ${journal.token} incompleto (store): ${storeError.message}`);
    return {ok: false, error: storeError.message};
  }
  fs.rmSync(journalDir(runtime, journal.token), {recursive: true, force: true});
  log(`promoção ${journal.token} desfeita (${journal.freeSessionId})`);
  return {ok: true};
}

/* Conclusão para frente: garante config/descritor/desk com a matéria nova,
   sem nunca sobrescrever o que já lá está. Idempotente. */
function ensureConfigCourse(journal) {
  if (!journal.configFile || !journal.courseEntry) return false;
  const raw = readJson(journal.configFile);
  if (!isPlainObject(raw)) return false;
  const list = Array.isArray(raw.courses) ? raw.courses : [];
  if (list.some((course) => isPlainObject(course) && course.id === journal.courseId)) return false;
  const next = {...raw, courses: [...list, journal.courseEntry]};
  fs.writeFileSync(journal.configFile, JSON.stringify(next, null, 2) + '\n');
  return true;
}

function ensureDescriptor(journal, {patchDescriptor} = {}) {
  if (!journal.descriptorFile || typeof patchDescriptor !== 'function') return false;
  const stats = fs.lstatSync(journal.descriptorFile, {throwIfNoEntry: false});
  if (!stats || !stats.isFile()) return false;
  const current = readJson(journal.descriptorFile);
  if (!isPlainObject(current) || current.courseId === journal.courseId) return false;
  patchDescriptor(journal.descriptorFile, {courseId: journal.courseId});
  return true;
}

function ensureDeskState(journal) {
  if (!journal.deskFile || !journal.courseState) return false;
  const raw = readJson(journal.deskFile);
  if (!isPlainObject(raw)) return false;
  const states = isPlainObject(raw.courseStates) ? raw.courseStates : {};
  let changed = false;
  if (!isPlainObject(states[journal.courseId])) {
    raw.courseStates = {...states, [journal.courseId]: journal.courseState};
    changed = true;
  }
  /* A matéria promovida é a ativa no snapshot: se um diário antigo/incompleto
     não a tiver como ativa, o boot do curso promovido sai daqui. */
  if (journal.activeCourseId && raw.courseId !== journal.activeCourseId) {
    raw.courseId = journal.activeCourseId;
    changed = true;
  }
  if (journal.activeSession && raw.session !== journal.activeSession) {
    raw.session = journal.activeSession;
    changed = true;
  }
  if (changed) fs.writeFileSync(journal.deskFile, JSON.stringify(raw));
  return changed;
}

/* Varredura de boot. Devolve uma lista de ações para o log do host; nunca
   lança por diário individual (um diário ilegível fica onde está). */
function recover(runtime, {store, patchDescriptor, log = () => {}} = {}) {
  const out = [];
  for (const token of listTokens(runtime)) {
    let journal;
    try {
      journal = readJournal(runtime, token);
    } catch (error) {
      log(`diário ${token} ilegível: ${error.message}`);
      continue;
    }
    if (!journal) {
      log(`diário ${token} inválido; preservado`);
      continue;
    }
    try {
      if (journal.phase === 'prepared' || journal.phase === 'applying') {
        const result = rollbackJournal(runtime, journal, {store, log});
        out.push({token, sessionId: journal.freeSessionId, action: result.ok ? 'rolled-back' : 'rollback-failed'});
        continue;
      }
      const plan = store && typeof store.promotionPlan === 'function' ? store.promotionPlan(runtime, journal.freeSessionId) : null;
      let committed = false;
      const folderExists = journal.folderPath && fs.lstatSync(journal.folderPath, {throwIfNoEntry: false});
      if (plan && plan.status === 'promoted' && folderExists) {
        committed = true;
      } else if (plan && (plan.status === 'prepared' || plan.status === 'committing')) {
        try {
          store.commitPromotion(runtime, journal.freeSessionId, {
            token: journal.token,
            courseId: journal.courseId,
            courseName: journal.courseName,
          });
          committed = true;
        } catch (error) {
          log(`conclusão do diário ${token} recusada pelo store: ${error.message}`);
        }
      }
      if (!committed) {
        const result = rollbackJournal(runtime, journal, {store, log});
        out.push({token, sessionId: journal.freeSessionId, action: result.ok ? 'rolled-back' : 'rollback-failed'});
        continue;
      }
      ensureConfigCourse(journal);
      ensureDescriptor(journal, {patchDescriptor});
      ensureDeskState(journal);
      fs.rmSync(journalDir(runtime, journal.token), {recursive: true, force: true});
      out.push({token, sessionId: journal.freeSessionId, action: 'completed', courseId: journal.courseId});
    } catch (error) {
      log(`recuperação do diário ${token} falhou: ${error.message}`);
      out.push({token, sessionId: journal.freeSessionId, action: 'failed', error: error.message});
    }
  }
  return out;
}

module.exports = {
  DIR,
  VERSION,
  FreePromotionError,
  journalRoot,
  journalDir,
  journalFile,
  begin,
  readJournal,
  listTokens,
  sessions,
  recover,
  restoreFile,
};
