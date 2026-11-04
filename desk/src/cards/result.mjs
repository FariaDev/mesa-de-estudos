/* Forma pública e texto de resultado dos cartões (#92). O estado de domínio
   (resposta, acerto, envio) vem do `core/quizcard.bend`; aqui só se monta o
   que o renderer e o tutor podem ver. Antes da resposta, o cartão público NÃO
   carrega `correctIndices` nem a explicação — a resposta certa não sai da
   Mesa antes da vez. */

import quizCore from '../generated/quizcard.core.js';

const selectedLabels = (card) => {
  if (!Array.isArray(card.answer?.selected)) return [];
  return card.answer.selected.map((index) => card.options?.[index - 1]?.label || String(index));
};

const askLines = (card) => (card.questions || []).map((question, index) => {
  const answer = card.answer?.answers?.[index] || {selected: [], text: ''};
  const shown = answer.text || (Array.isArray(answer.selected) ? answer.selected.join(', ') : '');
  return `Pergunta ${index + 1}: ${question.question}\nResposta: ${shown || '(sem resposta)'}`;
});

/**
 * O cartão como o renderer pode ver agora. A resposta certa e a explicação só
 * entram depois de `answered`.
 * @param {object} card cartão guardado no host
 * @returns {object}
 */
export function publicCard(card) {
  /* O portão é a função provada no `core/quizcard.bend`; o host não repete a
     condição `answered` (se a lei mudar, a tela muda junto). */
  const state = card.state || quizCore.newCard();
  const answered = quizCore.revealAllowed(state) === true;
  const base = {
    id: card.id,
    kind: card.kind,
    createdAt: card.createdAt,
    answered,
    correct: state.correct === true,
    dismissed: state.dismissed === true,
    sendState: quizCore.sendName(state),
    sendError: typeof card.sendError === 'string' ? card.sendError : '',
    answer: card.answer || {},
    draft: card.draft && typeof card.draft === 'object' ? card.draft : {},
  };
  if (card.kind === 'quiz') {
    return {
      ...base,
      question: card.question,
      details: card.details || '',
      note: card.note || '',
      multiSelect: card.multiSelect === true,
      options: (Array.isArray(card.options) ? card.options : []).filter((option) => option && typeof option.label === 'string').map(({label}) => ({label})),
      ...(answered ? {
        correctIndices: correctIndicesOf(card),
        explanation: card.explanation || '',
      } : {}),
    };
  }
  return {
    ...base,
    questions: (Array.isArray(card.questions) ? card.questions : []).map((question) => {
      const options = Array.isArray(question?.options) ? question.options : [];
      return {
        header: question?.header,
        question: question?.question,
        multiSelect: question?.multiSelect,
        options: options.filter((option) => option && typeof option.label === 'string').map(({label, description}) => ({label, description})),
      };
    }),
  };
}

/** @param {object} card @returns {number[]} índices 1-based das opções certas */
export function correctIndicesOf(card) {
  const wanted = new Set(card.correctValues || []);
  const out = [];
  (card.options || []).forEach((option, index) => {
    if (wanted.has(option.value)) out.push(index + 1);
  });
  return out;
}

/**
 * Texto que vai ao tutor numa mensagem nova quando o aluno clica em Concluir.
 * A primeira linha é o marcador que a conversa esconde (`text.mjs`); o resto
 * diz a que cartão o resultado pertence.
 * @param {object} card
 * @returns {string}
 * @example quizResultText(card) // '[Resultado do cartão: card-…]\nQuiz: …'
 */
export function resultText(card) {
  const header = `[Resultado do cartão: ${card.id}]`;
  if (card.kind === 'ask') return [header, ...askLines(card)].join('\n');
  const marked = card.answer?.dontKnow === true
    ? 'Não sei.'
    : (selectedLabels(card).join(', ') || '(sem marcação)');
  const verdict = card.answer?.dontKnow === true ? 'não sabia' : (card.state?.correct === true ? 'acertou' : 'errou');
  return [
    header,
    `Quiz: ${card.question}`,
    `O aluno marcou: ${marked}`,
    `Resultado: ${verdict}.`,
    ...(card.explanation ? [`Explicação: ${card.explanation}`] : []),
  ].join('\n');
}

/** Linha compacta que a conversa mostra depois do envio (sem bloco grande). */
