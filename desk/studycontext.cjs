'use strict';

/* Contexto de estudo que acompanha a mensagem da Mesa: fronteira com o núcleo
   Bend (core/studycontext.bend → src/generated/studycontext.core.js).
   O host resolve os fatos — presença de cada campo, se o contexto mudou desde o
   turno anterior, a qual exercício a captura pertence — e o núcleo compõe o
   bloco e decide se ele vai. Puro: sem DOM, IPC ou relógio; o `previousKey`
   entra como argumento e o main guarda. */
const core = require('./src/generated/studycontext.core.js').default;
const {createI18n, MESSAGE_MARK, isLanguage, FALLBACK_LANGUAGE} = require('./src/i18n.mjs');
const ptBR = require('./src/locales/pt-BR.json');
const en = require('./src/locales/en.json');

const NO_CAPTURE = {$: 'NoCapture'};

/* Lista na representação do artefato (`Con`/`Nil`), como o resto do host monta
   as listas que cruzam para o Bend. */
function bendList(items) {
  let out = {$: 'Nil'};
  for (let i = items.length - 1; i >= 0; i--) out = {$: 'Con', head: items[i], tail: out};
  return out;
}

/**
 * Uma referência = o que o usuário abriu na mesa, no formato que o `read` do
 * motor entende. `#page=N` é a forma que o Pi lê (`read path#page=N`), então o
 * alvo do "confere minha resposta" é literal. O `read` do OpenCode não tem
 * página e procurava um arquivo chamado `….pdf#page=53` (#70): para ele o
 * caminho vai limpo e a página à parte.
 * @param {string} file caminho do PDF já validado
 * @param {unknown} page página pedida (1 em diante; o resto vira 1)
 * @param {string} [engine] 'pi' | 'claude' | 'opencode'
 * @returns {string}
 * @example formatRef('/c/Limites.pdf', 3, 'opencode') // '/c/Limites.pdf (p. 3)'
 */
function formatRef(file, page, engine = 'pi') {
  const at = Math.max(1, Math.trunc(Number(page)) || 1);
  return engine === 'opencode' ? `${file} (p. ${at})` : `${file}#page=${at}`;
}

function formatRefs(refs) {
  const out = [];
  for (const ref of (Array.isArray(refs) ? refs : []).slice(0, 2)) {
    if (!ref || typeof ref.path !== 'string') continue;
    out.push(formatRef(ref.path, ref.page));
  }
  return out;
}

/* O main já valida e formata (é lá que a referência inválida vira erro de
   interface); aceitar as duas formas deixa o adaptador testável sozinho sem
   duplicar a validação. */
function normalizeRefs(refs) {
  const out = [];
  for (const ref of (Array.isArray(refs) ? refs : [])) {
    if (out.length >= 2) break;
    if (typeof ref === 'string' && ref) out.push(ref);
    else if (ref && typeof ref.path === 'string') out.push(formatRefs([ref])[0]);
  }
  return out.filter(Boolean);
}

function formatTime(capturedAt, language) {
  try {
    return new Date(capturedAt).toLocaleTimeString(language, {hour: '2-digit', minute: '2-digit'});
  } catch {
    return '';
  }
}

/* Cada linha do bloco é uma mensagem do catálogo, separada das outras por
   "\n": um valor livre com quebra de linha ou com os caracteres de controle da
   mensagem quebraria a divisão. */
function oneLine(value) {
  return typeof value === 'string' ? value.replace(/[\r\n\u2028\u2029\uE000\uE001]+/g, ' ') : '';
}

const translators = new Map();
function translatorFor(language) {
  if (!translators.has(language)) translators.set(language, createI18n({catalogs: {'pt-BR': ptBR, en}, language}));
  return translators.get(language);
}

/** O bloco do núcleo é uma sequência de mensagens (cada uma começa por MARK);
 * traduz cada uma no idioma pedido e deixa o resto de cada linha como veio.
 * @param {string} block @param {string} language */
function localizeBlock(block, language) {
  const i18n = translatorFor(language);
  return block.split(new RegExp(`(?=${MESSAGE_MARK})`)).map((part) => {
    if (!part.startsWith(MESSAGE_MARK)) return part;
    const lineEnd = part.indexOf('\n');
    const head = lineEnd === -1 ? part : part.slice(0, lineEnd);
    return i18n.text(head) + (lineEnd === -1 ? '' : part.slice(lineEnd));
  }).join('');
}

/* A captura pertence ao exercício que estava ativo quando ela foi feita. Se o
   usuário trocar de exercício antes de enviar, o bloco diz isso em vez de deixar
   a captura passar por tentativa do exercício atual. */
function captureFact(capture, exerciseNow, language) {
  if (!capture || typeof capture.capturedAt !== 'number') return NO_CAPTURE;
  const exercise = oneLine(capture.exercise);
  const time = formatTime(capture.capturedAt, language);
  if (!time) return NO_CAPTURE;
  const matches = exercise === (exerciseNow || '');
  /* Programa da captura (Conferir com outros programas, #35). Sem nome — anexo
     de antes — o núcleo mantém "janela do Xournal++". */
  const app = oneLine(capture.app).trim().slice(0, 120);
  return {$: 'Capture', time, exercise, matches, app};
}

/* Chave do contexto ESTÁVEL: matéria, exercício, rascunho e referências. A
   captura fica de fora de propósito. Ela sempre vai junto do bloco (o núcleo
   decide isso por `capturePresent`), então entrar na chave não mandava nada a
   mais: só fazia o turno SEGUINTE, com o mesmo contexto, ser reenviado porque a
   chave tinha mudado por causa de uma captura que não estava mais lá. */
function contextKey({course, exercise, xopp, refs}) {
  return JSON.stringify([course || '', exercise || '', xopp || '', refs]);
}

/**
 * @param {object} options
 * @param {string} options.course       nome da matéria ativa
 * @param {object} options.study        {title, xopp} já saneado por study.cjs
 * @param {Array<string | {path: string, page?: number}>} [options.refs] referências abertas
 *   (texto já formatado, ou `{path, page}`, que o `formatRefs` formata)
 * @param {object|null} [options.capture] {capturedAt, exercise, app} do anexo
 * @param {string} [options.previousKey] chave do último envio nesta sessão
 * @param {string} [options.language]  idioma do texto que vai ao modelo ("pt-BR" ou "en")
 * @returns {{text: string, key: string, changed: boolean}} `changed` diz que o
 *   bloco foi montado neste turno (uma captura o monta mesmo com o contexto
 *   igual); quem decide o reenvio é a chave estável.
 */
function buildStudyContext({course, study, refs, capture, previousKey, language} = {}) {
  const lang = isLanguage(language) ? language : FALLBACK_LANGUAGE;
  const exercise = oneLine(study?.title);
  const xopp = oneLine(study?.xopp);
  const list = normalizeRefs(refs);
  const fact = captureFact(capture, exercise, lang);
  const key = contextKey({course, exercise, xopp, refs: list});
  const repeat = key === (previousKey || '');
  const text = localizeBlock(core.render(
    {$: 'StudyContext', course: oneLine(course), exercise, draft: xopp, hasRefs: list.length > 0, capture: fact},
    bendList(list),
    repeat,
  ), lang);
  return {text, key, changed: text !== ''};
}

module.exports = {buildStudyContext, formatRef, formatRefs, normalizeRefs, contextKey};
