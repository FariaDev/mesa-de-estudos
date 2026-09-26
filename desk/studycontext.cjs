'use strict';

/* Contexto de estudo que acompanha a mensagem da Mesa: fronteira com o núcleo
   Bend (core/studycontext.bend → src/generated/studycontext.core.js).
   O host resolve os fatos — presença de cada campo, se o contexto mudou desde o
   turno anterior, a qual exercício a captura pertence — e o núcleo compõe o
   bloco e decide se ele vai. Puro: sem DOM, IPC ou relógio; o `previousKey`
   entra como argumento e o main guarda. */
const core = require('./src/generated/studycontext.core.js').default;

const NO_CAPTURE = {$: 'NoCapture'};

/* Lista na representação do artefato (`Con`/`Nil`), como o resto do host monta
   as listas que cruzam para o Bend. */
function bendList(items) {
  let out = {$: 'Nil'};
  for (let i = items.length - 1; i >= 0; i--) out = {$: 'Con', head: items[i], tail: out};
  return out;
}

/* Uma referência = o que o usuário abriu na mesa. `#page=N` é a mesma forma que
   o Pi lê (`read path#page=N`), então o alvo do "confere minha resposta" é
   literal. */
function formatRefs(refs) {
  const out = [];
  for (const ref of (Array.isArray(refs) ? refs : []).slice(0, 2)) {
    if (!ref || typeof ref.path !== 'string') continue;
    const page = Math.max(1, Math.trunc(Number(ref.page)) || 1);
    out.push(`${ref.path}#page=${page}`);
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

function formatTime(capturedAt) {
  try {
    return new Date(capturedAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'});
  } catch {
    return '';
  }
}

/* A captura pertence ao exercício que estava ativo quando ela foi feita. Se o
   usuário trocar de exercício antes de enviar, o bloco diz isso em vez de deixar
   a captura passar por tentativa do exercício atual. */
function captureFact(capture, exerciseNow) {
  if (!capture || typeof capture.capturedAt !== 'number') return NO_CAPTURE;
  const exercise = typeof capture.exercise === 'string' ? capture.exercise : '';
  const time = formatTime(capture.capturedAt);
  if (!time) return NO_CAPTURE;
  const matches = exercise === (exerciseNow || '');
  return {$: 'Capture', time, exercise, matches};
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
 * @param {string[]} [options.refs]     referências abertas (já formatadas)
 * @param {object|null} [options.capture] {capturedAt, exercise} do anexo
 * @param {string} [options.previousKey] chave do último envio nesta sessão
 * @returns {{text: string, key: string, changed: boolean}} `changed` diz que o
 *   bloco foi montado neste turno (uma captura o monta mesmo com o contexto
 *   igual); quem decide o reenvio é a chave estável.
 */
function buildStudyContext({course, study, refs, capture, previousKey} = {}) {
  const exercise = study?.title || '';
  const xopp = study?.xopp || '';
  const list = normalizeRefs(refs);
  const fact = captureFact(capture, exercise);
  const key = contextKey({course, exercise, xopp, refs: list});
  const repeat = key === (previousKey || '');
  const text = core.render(
    {$: 'StudyContext', course: course || '', exercise, draft: xopp, hasRefs: list.length > 0, capture: fact},
    bendList(list),
    repeat,
  );
  return {text, key, changed: text !== ''};
}

module.exports = {buildStudyContext, formatRefs, normalizeRefs, contextKey};
