'use strict';

/* Anotações de página (Mesa): `runtime/pdf-notes.json`.
 *
 * O aluno guarda um trecho do PDF, uma observação ou uma dúvida, a página e a
 * referência do material. O PDF original NUNCA é escrito nem copiado — só lido
 * (a extração fica no host da busca). Aqui ficam o arquivo, a validação de
 * forma, a gravação atômica, a identidade estável e a referência portátil.
 *
 * A FORMA e as REGRAS (página nunca abaixo de 1, tetos, o que vale guardar,
 * editar/remover pela ID) saem do núcleo Bend (`core/studyannotations.bend` →
 * `src/generated/studyannotations.core.js`).
 *
 * Escopo:
 *   - matéria  → chave = id da matéria (como `bookmarks.json`/`review.json`);
 *   - Livre    → chave = `free:<idDaSessão>` (`scopeOf`), para a sessão avulsa
 *     não herdar anotações da matéria em que for promovida depois.
 *
 * O RENDERER NUNCA MANDA CAMINHO QUE AUTORIZA LEITURA: `saveNote` recebe o
 * item do diálogo e só grava o caminho depois que o host confere a lista
 * autorizada (`authorizedPaths`) — caminho fora dela é recusado sem tocar no
 * arquivo. O mesmo vale para `resolveAbs`, que só considera as raízes passadas.
 *
 * Integridade:
 *   - leitura tolerante: JSON ilegível devolve lista vazia (nada lança);
 *   - antes de gravar sobre um arquivo ilegível, ele é PRESERVADO em
 *     `pdf-notes.corrupt-<stamp>.json` — nada é apagado em silêncio;
 *   - toda gravação é tmp + rename atômico;
 *   - id desconhecido em edit/remove não regrava o arquivo (a tela pode ter
 *     envelhecido entre o clique e o Salvar). */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const core = require('../generated/studyannotations.core.js').default;
const deletionUndo = require('../../deletion-undo.cjs');
const {message} = require('../i18n.mjs');

const FILENAME = 'pdf-notes.json';
/* Teto de leitura/gravação: algumas centenas de anotações por escopo. */
const MAX_STORE_BYTES = 4 * 1024 * 1024;
const MAX_SCOPES = 500;
const MAX_ID = 80;
const NIL = {$: 'Nil'};
const NOTE_TAG = {$: 'NoteNote'};
const DOUBT_TAG = {$: 'NoteDoubt'};
/* O mesmo id de sessão do `free-workspaces.cjs`: opaco e restrito, nunca vira
 * caminho. Fora disso o escopo cai no id da matéria. */
const FREE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

const {isPlainObject} = require('../../plain-object.cjs');
const {wholeNat} = require('../bend-nat.mjs');
const coreList = (items) => items.reduceRight((tail, head) => ({$: 'Con', head, tail}), NIL);
const coreArray = (node) => {
  const out = [];
  for (let current = node; current && current.$ === 'Con'; current = current.tail) out.push(current.head);
  return out;
};
const coreLimit = () => Number(core.maxItems());
const nowMs = (value) => (Number.isFinite(value) ? Math.trunc(value) : 0);

const fileOf = (runtime) => path.join(runtime, FILENAME);

/* ---------- escopo ---------- */

/* `{courseId, freeSessionId}` → chave estável. Sessão Livre válida tem
 * precedência; id fora do formato nunca vira chave. */
function scopeOf(scope = {}) {
  const freeId = typeof scope.freeSessionId === 'string' && FREE_ID_RE.test(scope.freeSessionId) ? scope.freeSessionId : '';
  const courseId = String(scope.courseId || '').slice(0, 400);
  if (freeId) return core.scopeOf(true, courseId, freeId);
  return core.scopeOf(false, courseId, '');
}

/* ---------- forma do item ---------- */

function kindTag(kind) {
  return kind === 'duvida' ? DOUBT_TAG : NOTE_TAG;
}

function coreItemOf(one, {id} = {}) {
  const source = isPlainObject(one) ? one : {};
  const ref = isPlainObject(source.ref) ? source.ref : source;
  return {
    $: 'NoteItem',
    id: String(id || source.id || ''),
    kind: kindTag(source.kind),
    quote: typeof source.quote === 'string' ? source.quote : '',
    note: typeof source.note === 'string' ? source.note : '',
    ref: {
      $: 'NoteRef',
      name: typeof ref.name === 'string' ? ref.name : '',
      rel: typeof ref.rel === 'string' ? ref.rel : '',
      path: typeof ref.path === 'string' ? ref.path : '',
      page: wholeNat(ref.page),
    },
  };
}

/* Um registro do arquivo → forma do núcleo → item do host (JSON puro). O
 * `newItem` do núcleo apara/corta e levanta a página para 1. Id vazio é aceito
 * aqui (o item novo do diálogo ainda não tem id); quem decide é o `saveNote`. */
function normalizeItem(raw, {keep = true} = {}) {
  const source = isPlainObject(raw) ? raw : {};
  const id = String(source.id || '');
  if (id.length > MAX_ID) return null;
  const item = core.newItem(
    id,
    source.kind === 'duvida',
    typeof source.quote === 'string' ? source.quote : '',
    typeof source.note === 'string' ? source.note : '',
    typeof source.ref?.name === 'string' ? source.ref.name : '',
    typeof source.ref?.rel === 'string' ? source.ref.rel : '',
    typeof source.ref?.path === 'string' ? source.ref.path : '',
    wholeNat(source.ref?.page)
  );
  if (keep && !core.keep(item)) return null;
  const createdAt = nowMs(source.createdAt) || nowMs(source.updatedAt) || Date.now();
  const updatedAt = nowMs(source.updatedAt) || createdAt;
  return toHost(item, {createdAt, updatedAt});
}

function normalizeOne(raw) {
  return normalizeItem(raw, {keep: true});
}

/* Item lido do arquivo: precisa de id (o contrário do rascunho do diálogo). */
function normalizeStored(raw) {
  const one = normalizeItem(raw, {keep: true});
  return one && one.id ? one : null;
}

/* Chave de edição/remoção: só a identidade importa, então um item magro
 * (`{id}`) vira alvo válido mesmo sem trecho/observação. */
function normalizeKey(raw) {
  const source = isPlainObject(raw) ? raw : {};
  const id = String(source.id || '');
  if (!id || id.length > MAX_ID) return null;
  return normalizeItem({...source, id}, {keep: false});
}

/* Forma do núcleo → item do host (JSON puro; página em Number). */
function toHost(item, times = {}) {
  return {
    id: item.id,
    kind: item.kind && item.kind.$ === 'NoteDoubt' ? 'duvida' : 'nota',
    quote: item.quote,
    note: item.note,
    ref: {
      name: item.ref.name,
      rel: item.ref.rel,
      path: item.ref.path,
      page: Number(item.ref.page),
    },
    createdAt: nowMs(times.createdAt) || nowMs(times.updatedAt),
    updatedAt: nowMs(times.updatedAt) || nowMs(times.createdAt),
  };
}

/* ---------- arquivo ---------- */

function readStore(runtime) {
  const file = fileOf(runtime);
  try {
    /* `lstat`: symlink é tratado como ilegível — a leitura não segue o link e
     * a gravação preserva o link antes de escrever o arquivo de verdade. */
    const stats = fs.lstatSync(file);
    /* Grande demais / não é arquivo: ilegível para o app, mas PRESERVADO antes
     * de qualquer gravação (nada é apagado em silêncio). */
    if (!stats.isFile() || stats.isSymbolicLink() || stats.size > MAX_STORE_BYTES) return {store: {}, corrupt: true};
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!isPlainObject(parsed)) return {store: {}, corrupt: false};
    return {store: parsed, corrupt: false};
  } catch (error) {
    if (error && error.code === 'ENOENT') return {store: {}, corrupt: false};
    return {store: {}, corrupt: true};
  }
}

function backupCorrupt(runtime) {
  try {
    const file = fileOf(runtime);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace(/Z$/, '');
    fs.renameSync(file, path.join(runtime, `pdf-notes.corrupt-${stamp}.json`));
  } catch { /* já foi ou não dá para preservar: a gravação atômica decide */ }
}

function normalizeList(raw) {
  const out = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    if (out.length >= coreLimit()) break;
    const one = normalizeStored(item);
    if (one) out.push(one);
  }
  return out;
}

function writeStore(runtime, store) {
  const file = fileOf(runtime);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(store, null, 1)}\n`, {encoding: 'utf8', mode: 0o600});
  fs.renameSync(temporary, file);
}

/* Lista de itens de um escopo (tolerante; nunca lança por arquivo ilegível). */
function readNotes(runtime, scope, {page} = {}) {
  const {store} = readStore(runtime);
  const list = normalizeList(store[scopeOf(scope)]);
  const wanted = Number.isFinite(Number(page)) && Number(page) > 0 ? Math.trunc(Number(page)) : 0;
  if (!wanted) return list;
  return list.filter((one) => one.ref.page === wanted);
}

/* ---------- identidade ---------- */

const newId = () => `n-${crypto.randomUUID()}`;

/* Mesmo material, mesma página, mesmo texto e mesma espécie: guardar de novo
 * pelo botão não duplica (o duplo clique no Salvar não cria dois registros). */
function sameContent(a, b) {
  return (
    a.ref.path === b.ref.path &&
    a.ref.page === b.ref.page &&
    a.quote === b.quote &&
    a.note === b.note &&
    a.kind === b.kind
  );
}

/* ---------- operações (as mesmas da IPC) ---------- */

/* Confere o caminho NOVO contra a lista autorizada do host. Sem a lista, só o
 * que for vazio passa — caminho vindo do renderer nunca autoriza leitura.
 * Remover nunca exige autorização: tirar anotação de material que saiu da
 * biblioteca não pode ficar preso. */
function isAuthorizedRef(item, authorizedPaths) {
  const allowed = new Set((Array.isArray(authorizedPaths) ? authorizedPaths : []).filter((p) => typeof p === 'string' && p).map((p) => path.resolve(p)));
  const target = typeof item?.ref?.path === 'string' ? item.ref.path : '';
  if (!target) return true; /* anotação sem material ainda é válida */
  return allowed.has(path.resolve(target));
}

function assertAuthorized(item, authorizedPaths) {
  if (isAuthorizedRef(item, authorizedPaths)) return true;
  const error = new Error(message('annot.error.unauthorized'));
  error.code = 'UNAUTHORIZED';
  throw error;
}

/* Caminho de gravação único (saveNote e o Desfazer): preserva arquivo
 * ilegível antes de sobrescrever, limpa a chave vazia e mantém o teto de
 * escopos sem descartar o escopo que está sendo salvo. */
function persistScope(runtime, raw, corrupt, key, shaped) {
  const store = {...raw};
  if (corrupt) backupCorrupt(runtime);
  if (shaped.length) store[key] = shaped;
  else delete store[key];
  const keys = Object.keys(store);
  if (keys.length > MAX_SCOPES) {
    let excess = keys.length - MAX_SCOPES;
    for (const stale of keys) {
      if (excess <= 0) break;
      if (stale === key) continue;
      delete store[stale];
      excess--;
    }
  }
  writeStore(runtime, store);
  return shaped;
}

/* Passa a operação pelo núcleo e devolve a lista na forma do host, preservando
 * os tempos de quem ficou: o núcleo decide ordem, identidade e teto. */
function shapedList(result, current, fresh) {
  const times = new Map(current.map((one) => [one.id, one]));
  return result.map((node) => {
    const item = toHost(node, {
      createdAt: times.get(node.id)?.createdAt || fresh?.createdAt,
      updatedAt: times.get(node.id)?.updatedAt || fresh?.updatedAt,
    });
    if (item.id === fresh?.id) {
      item.createdAt = fresh.createdAt;
      item.updatedAt = fresh.updatedAt;
    }
    return item;
  });
}

/* `add` | `edit` | `remove`. Devolve a lista inteira do escopo como o renderer
 * deve mostrá-la. */
function saveNote(runtime, scope, payload = {}) {
  const {authorizedPaths} = payload;
  const mode = payload.mode === 'edit' ? 'edit' : payload.mode === 'remove' ? 'remove' : 'add';
  const key = scopeOf(scope);
  const {store: raw, corrupt} = readStore(runtime);
  const current = normalizeList(raw[key]);
  const source = normalizeOne(payload.item);
  const keyRaw = payload.key ?? (payload.id ? {id: String(payload.id)} : null);
  const target = keyRaw ? normalizeKey(keyRaw) : source;

  if (mode !== 'remove' && !source) throw new Error(message('annot.error.empty'));
  /* Autorização do caminho: só um caminho NOVO precisa estar na biblioteca. Editar
   * o texto/página de uma anotação cujo PDF saiu da biblioteca continua valendo
   * (remover também nunca exige autorização); trocar para um caminho fora da
   * lista é recusado sem tocar no arquivo. */
  if (mode !== 'remove' && source) {
    const previous = mode === 'edit' && target ? current.find((one) => one.id === target.id) : null;
    const changed = !previous || path.resolve(previous.ref.path || '') !== path.resolve(source.ref.path || '');
    if (changed) assertAuthorized(source, authorizedPaths);
  }

  const list = coreList(current.map((one) => coreItemOf(one)));
  let shaped;
  if (mode === 'remove') {
    if (!target) return current;
    shaped = shapedList(coreArray(core.removeSame(list, coreItemOf(target))), current, null);
  } else if (mode === 'edit') {
    if (!target || !source) return current;
    const fresh = {...source, id: target.id, createdAt: target.createdAt, updatedAt: Date.now()};
    shaped = shapedList(coreArray(core.replaceSame(list, coreItemOf(target), coreItemOf(fresh))), current, fresh);
  } else {
    /* add: item idêntico já guardado não duplica nem regrava (duplo clique no
     * Salvar não cria dois registros); id novo é opaco e gerado aqui. */
    if (current.some((one) => sameContent(one, source))) return current;
    const fresh = {...source, id: newId(), createdAt: Date.now(), updatedAt: Date.now()};
    shaped = shapedList(coreArray(core.addItem(list, coreItemOf(fresh))), current, fresh);
  }

  const same = JSON.stringify(shaped) === JSON.stringify(current);
  if (same) return current;
  return persistScope(runtime, raw, corrupt, key, shaped);
}

/* ---------- desfazer remoção (Desfazer) ---------- */

const undoStore = deletionUndo.createUndoStore();

/* Remoção COM token: a lista volta como o `saveNote` (array antigo intacto) e o
 * token fica no backend com o item ORIGINAL (id, datas, referência) e a posição
 * dele no arquivo. Alvo que não está mais no escopo não muda nada e não emite
 * token. */
function notesRemoveWithUndo(runtime, scope, payload = {}) {
  const key = scopeOf(scope);
  const {store: raw} = readStore(runtime);
  const current = normalizeList(raw[key]);
  const keyRaw = payload.key ?? (payload.id ? {id: String(payload.id)} : payload.item?.id ? {id: String(payload.item.id)} : null);
  const target = keyRaw ? normalizeKey(keyRaw) : null;
  const index = target ? current.findIndex((one) => one.id === target.id) : -1;
  if (index < 0) return {scope: key, items: current, undoToken: '', undoExpiresAt: 0};
  const stored = current[index];
  const items = saveNote(runtime, scope, {mode: 'remove', key: {id: stored.id}, authorizedPaths: payload.authorizedPaths});
  const issued = undoStore.issue({kind: 'note', scopeKey: JSON.stringify([runtime,key,scope?.conversation||'']), item: stored, index, at: payload.at});
  return {scope: key, items, undoToken: issued.token, undoExpiresAt: issued.expiresAt};
}

/* O Desfazer confere o escopo atual (mesma matéria/conversa) e o caminho do
 * registro original pelo token do host; recusa de escopo NÃO
 * consome o token. Desfazer não concede acesso à referência órfã. A lista é relida no undo e só a entrada removida volta —
 * edições de outras anotações ficam como estão, e id já presente não duplica. */
function notesUndo(runtime, scope, payload = {}) {
  const key = scopeOf(scope);
  const {store: raw, corrupt} = readStore(runtime);
  const current = normalizeList(raw[key]);
  const taken = undoStore.check({
    token: payload.token,
    scopeKey: JSON.stringify([runtime,key,scope?.conversation||'']),
    /* O token contém o registro original do host. Restaurar seu texto não
       autoriza abrir um PDF que saiu da biblioteca. */
    at: payload.at,
  });
  if (!taken.ok) return {ok: false, reason: taken.reason, scope: key, items: current};
  const merged = deletionUndo.mergeRemoved(current, taken.entry.item, (a, b) => a.id === b.id, taken.entry.index);
  if (!merged.restored) { undoStore.commit(payload.token);return {ok: true, restored: false, scope: key, items: current}; }
  const items = persistScope(runtime, raw, corrupt, key, merged.items);
  undoStore.commit(payload.token);
  return {ok: true, restored: true, scope: key, items};
}

/* ---------- referência portátil (pacote/backup) ---------- */

/* Exporta sem caminho absoluto: `name` + `rel` + `page` reancoram em outra
 * raiz. Serve para pacote de matéria e para o backup local. */
function exportPortable(runtime, scope) {
  const items = readNotes(runtime, scope);
  return {
    version: 1,
    scope: scopeOf(scope),
    items: items.map((one) => ({
      kind: one.kind,
      name: one.ref.name,
      rel: one.ref.rel,
      page: one.ref.page,
      quote: one.quote,
      note: one.note,
      updatedAt: one.updatedAt,
    })),
  };
}

/* Reancora itens portáteis sob uma raiz autorizada: procura `rel` (ou o nome)
 * em cada raiz e recusa item sem arquivo existente — nunca inventa caminho. */
function resolveAbs(item, roots) {
  const candidates = [];
  const rel = typeof item?.rel === 'string' ? item.rel.replace(/\\/g, '/') : '';
  const name = typeof item?.name === 'string' ? item.name : '';
  for (const root of Array.isArray(roots) ? roots : []) {
    if (typeof root !== 'string' || !root) continue;
    if (rel && !rel.split('/').includes('..') && !path.isAbsolute(rel)) candidates.push(path.resolve(root, rel));
    if (name && !name.includes('/') && !name.includes('\\') && name !== '..') candidates.push(path.resolve(root, name));
  }
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    } catch { /* segue para o próximo */ }
  }
  return '';
}

/* Importa itens portáteis no escopo informado; ids são novos e o caminho só
 * entra se existir numa das raízes autorizadas. */
function importPortable(runtime, scope, payload, roots) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  let saved = readNotes(runtime, scope);
  for (const one of items.slice(0, coreLimit())) {
    const source = isPlainObject(one) ? one : {};
    const absolute = resolveAbs({rel: source.rel, name: source.name}, roots);
    if (!absolute) continue;
    saved = saveNote(runtime, scope, {
      mode: 'add',
      authorizedPaths: [absolute],
      item: {
        kind: source.kind === 'duvida' ? 'duvida' : 'nota',
        quote: source.quote,
        note: source.note,
        ref: {name: source.name, rel: source.rel, path: absolute, page: source.page},
      },
    });
  }
  return saved;
}

module.exports = {
  FILENAME,
  MAX_STORE_BYTES,
  fileOf,
  scopeOf,
  readStore,
  readNotes,
  saveNote,
  notesRemoveWithUndo,
  notesUndo,
  exportPortable,
  importPortable,
  resolveAbs,
  normalizeOne,
  normalizeStored,
  toHost,
  assertAuthorized,
  isAuthorizedRef,
  newId,
  normalizeKey,
};
