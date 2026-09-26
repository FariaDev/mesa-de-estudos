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

const FILENAME = 'review.json';
/* Teto de leitura/gravação: um caderno por matéria, algumas dezenas de KB. */
const MAX_STORED_BYTES = 1024 * 1024;
const MAX_KEY = 120;
const NIL = {$: 'Nil'};

const fileOf = (runtime) => path.join(runtime, FILENAME);
const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const coreList = (items) => items.reduceRight((tail, head) => ({$: 'Con', head, tail}), NIL);
const coreArray = (node) => {
  const out = [];
  for (let current = node; current && current.$ === 'Con'; current = current.tail) out.push(current.head);
  return out;
};
const coreLimit = () => Number(reviewCore.maxItems());
/* Item do host (JSON puro, página em Number) → registro do núcleo. O núcleo
   compara a página como `Nat`: sem esta conversão o BigInt nunca casa com o
   número do arquivo e guardar o mesmo item de novo duplicaria. */
const coreItemOf = (one) => ({
  question: one.question,
  attempt: one.attempt,
  difficulty: one.difficulty,
  ref: {name: one.ref.name, page: BigInt(Math.max(0, whole(one.ref.page))), path: one.ref.path},
});
const coreItemsOf = (items) => coreList(items.map(coreItemOf));
/* Duas listas do host iguais? A operação que não achou a chave (a tela
   envelheceu) devolve o que está guardado sem regravar o arquivo. */
const sameList = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const whole = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
};

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
    BigInt(Math.max(0, whole(ref.page))),
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
  if (mode !== 'remove' && !source) throw new Error('Escreva a questão do item para guardar.');
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

module.exports = {FILENAME, readItems, writeItems, reviewSave, normalizeOne};
