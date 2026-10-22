'use strict';

/* Caderno de revisão (Mesa): `runtime/review.json`.

   Um item é `{question, attempt, difficulty, ref:{name, page, path}}` — o que o
   usuário guardou de uma resposta do Pi para revisar depois. A FORMA e a ORDEM
   saem do núcleo Bend (`core/review.bend` → `src/generated/review.core.js`):
   texto aparado e cortado no teto, página nunca abaixo de 1, guardar de novo o
   mesmo item (mesma questão no mesmo material) NÃO duplica — o item novo entra
   na frente e a lista para no `maxItems()`. Aqui ficam o arquivo, a leitura
   tolerante e a gravação atômica.

   A chave é o id da matéria, como no `bookmarks.json`: trocar de matéria troca o
   caderno. Matéria removida deixa os itens parados no arquivo; se ela voltar com
   o mesmo id, eles voltam junto.

   As três operações do host (as mesmas da IPC):
     - `add`    — guarda um item novo (ou atualiza o mesmo, se já estava lá);
     - `edit`   — troca o item que casa com a `key` (o registro clicado) pelo
                  `item` do diálogo, mantendo a posição do original;
     - `remove` — tira o item que casa com a `key` (ou com o próprio `item`).

   Editar e remover vão pela IDENTIDADE, nunca pela posição: quem desenha a
   lista a FILTRA (item que aponta para PDF fora da biblioteca fica de fora), e
   aí o índice da linha não é o índice do arquivo. Chave que não está mais na
   lista — a tela envelheceu entre o clique e o Salvar — não mexe em nada. */

const fs = require('node:fs');
const path = require('node:path');
const reviewCore = require('./src/generated/review.core.js').default;
const {wholeNat} = require('./src/bend-nat.mjs');
const {message} = require('./src/i18n.mjs');
const deletionUndo = require('./deletion-undo.cjs');

const FILENAME = 'review.json';
/* Teto de leitura/gravação: um caderno por matéria, algumas dezenas de KB. */
const MAX_STORED_BYTES = 1024 * 1024;
const MAX_KEY = 120;
const NIL = {$: 'Nil'};

const fileOf = (runtime) => path.join(runtime, FILENAME);
const {isPlainObject} = require('./plain-object.cjs');
const coreList = (items) => items.reduceRight((tail, head) => ({$: 'Con', head, tail}), NIL);
const coreArray = (node) => {
  const out = [];
  for (let current = node; current && current.$ === 'Con'; current = current.tail) out.push(current.head);
  return out;
};
const coreLimit = () => Number(reviewCore.maxItems());
/* Item do host (JSON puro, página em Number) → registro do núcleo. O núcleo
   compara a página como `Nat`: sem esta conversão (BigInt até o bend 2.0.27,
   `wholeNat` desde a #49) a página do arquivo não casaria e guardar o mesmo
   item de novo duplicaria. */
const coreItemOf = (one) => ({
  question: one.question,
  attempt: one.attempt,
  difficulty: one.difficulty,
  ref: {name: one.ref.name, page: wholeNat(one.ref.page), path: one.ref.path},
});
const coreItemsOf = (items) => coreList(items.map(coreItemOf));
/* Duas listas do host iguais? A operação que não achou a chave (a tela
   envelheceu) devolve o que está guardado sem regravar o arquivo. */
const sameList = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* Um item do JSON → forma do núcleo → item do host (JSON puro). `null` quando
   não vale guardar (sem questão). */
function normalizeOne(raw) {
  const source = isPlainObject(raw) ? raw : {};
  const ref = isPlainObject(source.ref) ? source.ref : {};
  const item = reviewCore.newItem(
    typeof source.question === 'string' ? source.question : '',
    typeof source.attempt === 'string' ? source.attempt : '',
    typeof source.difficulty === 'string' ? source.difficulty : '',
    typeof ref.name === 'string' ? ref.name : '',
    wholeNat(ref.page),
    typeof ref.path === 'string' ? ref.path : ''
  );
  if (!reviewCore.keepItem(item)) return null;
  return {
    question: item.question,
    attempt: item.attempt,
    difficulty: item.difficulty,
    ref: {name: item.ref.name, page: Number(item.ref.page), path: item.ref.path},
  };
}

/* Lista crua → lista do host, na ordem do arquivo e no teto do núcleo. */
function normalizeList(raw) {
  const out = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    if (out.length >= coreLimit()) break;
    const one = normalizeOne(item);
    if (one) out.push(one);
  }
  return out;
}

function readStore(runtime) {
  try {
    const stats = fs.statSync(fileOf(runtime));
    if (!stats.isFile() || stats.size > MAX_STORED_BYTES) return {};
    const parsed = JSON.parse(fs.readFileSync(fileOf(runtime), 'utf8'));
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function keyOf(courseId) {
  const key = typeof courseId === 'string' ? courseId : '';
  return key.slice(0, MAX_KEY);
}

function readItems(runtime, courseId) {
  const store = readStore(runtime);
  return normalizeList(store[keyOf(courseId)]);
}

function writeItems(runtime, courseId, items) {
  const store = readStore(runtime);
  const key = keyOf(courseId);
  const list = normalizeList(items);
  if (list.length) store[key] = list;
  else delete store[key];
  const file = fileOf(runtime);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(store, null, 1)}\n`, 'utf8');
  fs.renameSync(temporary, file);
  return list;
}

/* Operação vinda da IPC: devolve a lista como o renderer deve mostrá-la. A
   chave do `edit`/`remove` é o registro que o usuário clicou — sem ela, a mira é
   o próprio `item` — e o núcleo acha o item por identidade (mesma questão no
   mesmo material), onde ele estiver. */
function reviewSave(runtime, {courseId, mode, item, key} = {}) {
  const current = readItems(runtime, courseId);
  const source = normalizeOne(item);
  const target = normalizeOne(key) || source;
  if (mode !== 'remove' && !source) throw new Error(message('review.error.questionRequired'));
  let next = current;
  if (mode === 'remove') {
    if (target) next = coreArray(reviewCore.removeSame(coreItemsOf(current), coreItemOf(target)));
  } else if (mode === 'edit') {
    next = coreArray(reviewCore.replaceSame(coreItemsOf(current), coreItemOf(target), coreItemOf(source)));
  } else if (source) {
    next = coreArray(reviewCore.addItem(coreItemsOf(current), coreItemOf(source)));
  }
  const shaped = normalizeList(next);
  if (sameList(shaped, current)) return current;
  return writeItems(runtime, courseId, shaped);
}

/* Itens do caderno SEM esconder: o item que aponta para PDF fora da biblioteca
   (ou cujo arquivo sumiu) continua na lista, marcado com `refState`. O
   `main.cjs` deve usar isto no lugar do filtro por `allowed` — filtrar aqui é o
   que fazia o item sumir sem explicação. `review-schedule.cjs` tem a mesma
   leitura de estado (`refStateOf`), com a nota em português. */
function annotateVisibility(items, allowed, exists = fs.existsSync) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const file = String(item?.ref?.path || '');
    const outside = !!file && !!allowed && !allowed.has(file);
    const missing = !!file && !exists(file);
    return {...item, refState: missing ? 'missing' : outside ? 'outside' : 'ok'};
  });
}

/* ---------- desfazer remoção (Desfazer) ---------- */

const undoStore = deletionUndo.createUndoStore();

/* Mesma identidade do núcleo (mesma questão no mesmo material): é por ela que
   o item removido volta ao caderno e nunca duplica. */
function sameIdentity(a, b) {
  return reviewCore.sameItem(coreItemOf(a), coreItemOf(b));
}

function scheduleModule() {
  return require('./src/study-data/review-schedule.cjs');
}

/* Instantâneo da agenda do item no momento da remoção. Fica junto do token e
   volta pelo ID no undo — o histórico de avaliação não depende de um `sync`
   posterior para sobreviver. Sem o módulo/artefato da agenda, o caderno ainda
   desfaz; só o instantâneo fica nulo. */
function scheduleSnapshot(runtime, courseId, item) {
  try {
    const schedule = scheduleModule();
    const bucket = schedule.readStore(runtime).courses[keyOf(courseId)];
    const found = bucket?.items.find((one) => one.id === schedule.stableId(item));
    return found ? JSON.parse(JSON.stringify(found)) : null;
  } catch {
    return null;
  }
}

/* Restaura SÓ o item do instantâneo, pelo ID. Se a agenda ainda tem o registro
   (o caso normal), só o marca `active` de novo: datas, histórico e intervalo de
   quem já está lá nunca são sobrescritos. Se a agenda foi apagada por fora, o
   instantâneo volta inteiro (era exatamente o registro daquele item). */
function restoreSchedule(runtime, courseId, snapshot, item) {
  if (!snapshot) return false;
  const schedule = scheduleModule();
  const store = schedule.readStore(runtime);
  const key = keyOf(courseId);
  const bucket = store.courses[key] || {items: []};
  const id = snapshot.id || schedule.stableId(item);
  const found = bucket.items.find((one) => one.id === id);
  if (found) found.active = true;
  else bucket.items.push({...snapshot, id, active: true});
  store.courses[key] = bucket;
  schedule.writeStore(runtime, store);
  return true;
}

/* Remoção COM token de Desfazer: o caderno fica igual ao `reviewSave` (array
   antigo intacto) e o token é emitido AQUI, com o item ORIGINAL e a posição
   dele no arquivo. Alvo que não está mais no caderno não muda nada e não emite
   token (a tela envelheceu). */
/**
 * @param {string} runtime
 * @param {{courseId?: string, conversation?: string, mode?: string, item?: unknown, key?: unknown, at?: number}} [request]
 */
function reviewRemoveWithUndo(runtime, {courseId, conversation='', mode, item, key, at} = {}) {
  const current = readItems(runtime, courseId);
  if (mode && mode !== 'remove') return {items: current, undoToken: '', undoExpiresAt: 0};
  const source = normalizeOne(item);
  const target = normalizeOne(key) || source;
  const index = target ? current.findIndex((one) => sameIdentity(one, target)) : -1;
  if (index < 0) return {items: current, undoToken: '', undoExpiresAt: 0};
  const stored = current[index];
  const items = reviewSave(runtime, {courseId, mode: 'remove', key: stored});
  const issued = undoStore.issue({
    kind: 'review',
    scopeKey: JSON.stringify([runtime, keyOf(courseId), conversation]),
    item: stored,
    index,
    schedule: scheduleSnapshot(runtime, courseId, stored),
    at,
  });
  return {items, undoToken: issued.token, undoExpiresAt: issued.expiresAt};
}

/* O Desfazer confere o escopo atual (mesmo caderno), relê a lista AGORA e
   insere só a entrada removida — edições feitas no meio do caminho ficam como
   estão. Identidade já presente não duplica; token de outro caderno é recusado
   sem ser consumido. */
/**
 * @param {string} runtime
 * @param {{courseId?: string, conversation?: string, token?: string, authorized?: (path: string) => boolean, at?: number}} [request]
 */
function reviewUndo(runtime, {courseId, conversation='', token, authorized=()=>true, at} = {}) {
  const current = readItems(runtime, courseId);
  const taken = undoStore.check({token, scopeKey: JSON.stringify([runtime, keyOf(courseId), conversation]), authorized:entry=>authorized(entry.item), at});
  if (!taken.ok) return {ok: false, reason: taken.reason, items: current};
  const merged = deletionUndo.mergeRemoved(current, taken.entry.item, sameIdentity, taken.entry.index);
  const items = merged.restored ? writeItems(runtime, courseId, merged.items) : current;
  restoreSchedule(runtime, courseId, taken.entry.schedule, taken.entry.item);
  undoStore.commit(token);
  return {ok: true, restored: merged.restored, items};
}

module.exports = {FILENAME, readItems, writeItems, reviewSave, normalizeOne, annotateVisibility, reviewRemoveWithUndo, reviewUndo};
