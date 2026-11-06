/* Cartões `quiz` e `perguntar` na conversa (#92). Mesmo DOM e mesmas classes do
   quiz que já existia (`.message.quiz .quiz-card`), agora sem esperar o motor:
   a Mesa corrige o quiz e guarda o rascunho; "Concluir" manda o resultado numa
   mensagem nova. A resposta certa só é pintada quando o host a manda (depois
   da resposta); o cartão público nem a carrega antes. */

import {markup,markupInline} from './markdown.mjs';
import {normalizeAskAnswer} from './cards/input.mjs';
import {t,text} from './ui-text.mjs';

const MAX_DRAFT_DELAY = 250;

const node = (tag, className = '', text = '') => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
};
const html = (element, value) => {
  element.innerHTML = markup(String(value || ''));
  return element;
};
const inline = (element, value) => {
  element.innerHTML = markupInline(String(value || ''));
  return element;
};

function quizSelected(card) {
  const fromAnswer = Array.isArray(card.answer?.selected) ? card.answer.selected : [];
  const fromDraft = Array.isArray(card.draft?.selected) ? card.draft.selected : [];
  return new Set((card.answered ? fromAnswer : fromDraft).filter((value) => Number.isInteger(value)));
}

function askSelected(card) {
  const source = card.answered ? card.answer?.answers : card.draft?.answers;
  const list = Array.isArray(source) ? source : [];
  return (card.questions || []).map((_question, index) => new Set(Array.isArray(list[index]?.selected) ? list[index].selected : []));
}

function askTexts(card) {
  const source = card.answered ? card.answer?.answers : card.draft?.answers;
  const list = Array.isArray(source) ? source : [];
  return (card.questions || []).map((_question, index) => (typeof list[index]?.text === 'string' ? list[index].text : ''));
}

/**
 * A ação de "Concluir" só existe para cartão respondido, não dispensado e sem
 * envio confirmado; reserva em andamento aparece como envio pendente.
 * @param {object} card @returns {'conclude'|'sending'|'sent'|'dismissed'|''}
 */
function sendAction(card) {
  if (card.dismissed) return 'dismissed';
  if (card.sendState === 'sent') return 'sent';
  if (card.sendState === 'sending') return 'sending';
  return card.answered ? 'conclude' : '';
}

function optionMark(card, index) {
  if (!card.answered) return {good: false, bad: false, dim: false, mark: ''};
  const correct = new Set(card.correctIndices || []);
  const selected = new Set(card.answer?.selected || []);
  if (card.answer?.dontKnow === true) return correct.has(index) ? {good: true, bad: false, dim: false, mark: '✓'} : {good: false, bad: false, dim: true, mark: ''};
  if (selected.has(index) && correct.has(index)) return {good: true, bad: false, dim: false, mark: '✓'};
  if (selected.has(index)) return {good: false, bad: true, dim: false, mark: '✗'};
  if (correct.has(index)) return {good: true, bad: false, dim: false, mark: '✓'};
  return {good: false, bad: false, dim: true, mark: ''};
}

const verdictOf = (card) => {
  if (!card.answered) return '';
  if (card.kind === 'ask') return t('quiz.responseSaved');
  return t(card.answer?.dontKnow ? 'quiz.dontKnow' : card.correct ? 'quiz.correct' : 'quiz.incorrect');
};

function cardHeader(card) {
  const article = document.createElement('article');
  article.className = `message assistant quiz${card.kind === 'ask' ? ' ask' : ''}`;
  article.dataset.role = 'assistant';
  article.dataset.tool = card.id;
  article.setAttribute('aria-label', t(card.kind === 'ask' ? 'talk.askAria' : (card.multiSelect ? 'talk.quizMultiAria' : 'talk.quizAria')));
  return article;
}

function cardButton(label, className, action, {disabled = false, key = ''} = {}) {
  const element = node('button', className);
  element.type = 'button';
  element.append(inline(document.createElement('span'), label));
  if (disabled) element.disabled = true;
  if (key) element.dataset.cardKey = key;
  element.addEventListener('click', action);
  return element;
}

function actionsElement(state, handlers, extra = []) {
  const row = node('div', 'quiz-actions');
  const cardState = state.card;
  if (!cardState.answered && !cardState.dismissed) {
    row.append(...extra);
    if (cardState.kind === 'quiz') row.append(cardButton(t('quiz.dontKnowButton'), 'quiz-dontknow', handlers.dontKnow, {disabled: state.busy, key: 'dontknow'}));
    row.append(cardButton(t('quiz.dismiss'), 'quiz-skip', handlers.dismiss, {disabled: state.busy, key: 'dismiss'}));
    return row;
  }
  const how = sendAction(cardState);
  if (how === 'conclude') {
    row.append(cardButton(state.error ? t('quiz.resend') : t('quiz.conclude'), 'quiz-conclude primary', handlers.conclude, {disabled: state.busy, key: 'conclude'}));
    row.append(cardButton(t('quiz.dismiss'), 'quiz-skip', handlers.dismiss, {disabled: state.busy, key: 'dismiss'}));
  } else if (how === 'sending') {
    row.append(node('span', 'quiz-pending', t('quiz.sending')));
    /* Reserva incerta não reenvia sozinha, mas precisa de saída visível:
       dispensar não apaga a reserva (o resultado pode ter chegado). */
    row.append(cardButton(t('quiz.dismiss'), 'quiz-skip', handlers.dismiss, {disabled: state.busy, key: 'dismiss'}));
  } else if (how === 'sent') {
    row.append(node('span', 'quiz-sent', t(cardState.kind === 'quiz' ? 'quiz.sentQuiz' : 'quiz.sentAsk')));
  } else if (how === 'dismissed') {
    row.append(node('span', 'quiz-dismissed', t('quiz.dismissed')));
  }
  return row;
}

function quizOptionsElement(cardState, state, handlers) {
  const options = node('div', 'quiz-options');
  options.setAttribute('role', cardState.multiSelect ? 'group' : 'radiogroup');
  options.setAttribute('aria-label', t('talk.quizOptionsAria'));
  (cardState.options || []).forEach((option, offset) => {
    const index = offset + 1;
    const mark = optionMark(cardState, index);
    const checked = cardState.answered
      ? (cardState.answer?.selected || []).includes(index) || (mark.good && cardState.answer?.dontKnow !== true && !(cardState.answer?.selected || []).length)
      : state.selected.has(index);
    const element = node('button', 'quiz-option');
    element.type = 'button';
    element.setAttribute('role', cardState.multiSelect ? 'checkbox' : 'radio');
    element.setAttribute('aria-checked', String(checked));
    element.dataset.cardKey = `option-${index}`;
    element.innerHTML = `${index}. ${markupInline(option.label)}`;
    if (mark.good) element.classList.add('correct');
    if (mark.bad) element.classList.add('wrong');
    if (mark.dim) element.classList.add('dim');
    if (mark.mark) element.append(node('span', 'quiz-mark', mark.mark));
    if (cardState.answered || cardState.dismissed || state.busy) element.disabled = true;
    else element.addEventListener('click', () => {
      if (cardState.multiSelect) {
        if (state.selected.has(index)) state.selected.delete(index); else state.selected.add(index);
        handlers.scheduleDraft();
        handlers.paint();
      } else {
        handlers.answerQuiz([index]);
      }
    });
    options.append(element);
  });
  return options;
}

function askQuestionBlock(cardState, question, index, state, handlers) {
  const block = node('section', 'quiz-question-block');
  block.dataset.cardKey = `question-${index + 1}`;
  if (question.header) block.append(inline(node('h3', 'cq-header'), question.header));
  block.append(html(node('p', 'quiz-question'), question.question));
  const options = node('div', 'quiz-options');
  options.setAttribute('role', question.multiSelect ? 'group' : 'radiogroup');
  options.setAttribute('aria-label', question.question);
  (question.options || []).forEach((option, offset) => {
    const label = option.label;
    const selected = state.selected[index]?.has(label) || false;
    const optionEl = node('button', 'quiz-option');
    optionEl.type = 'button';
    optionEl.setAttribute('role', question.multiSelect ? 'checkbox' : 'radio');
    optionEl.setAttribute('aria-checked', String(selected));
    optionEl.dataset.cardKey = `question-${index + 1}-option-${offset + 1}`;
    optionEl.append(inline(node('span', 'cq-option-label'), label));
    if (option.description) optionEl.append(node('span', 'cq-option-desc', option.description));
    if (cardState.answered || cardState.dismissed || state.busy) optionEl.disabled = true;
    else optionEl.addEventListener('click', () => {
      const set = state.selected[index];
      if (question.multiSelect) {
        if (set.has(label)) set.delete(label); else set.add(label);
      } else {
        set.clear();
        set.add(label);
        state.texts[index] = '';
      }
      handlers.scheduleDraft();
      handlers.paint();
    });
    options.append(optionEl);
  });
  if (question.options?.length) block.append(options);
  const free = node('input', 'quiz-free');
  free.type = 'text';
  free.maxLength = 4000;
  free.autocomplete = 'off';
  free.placeholder = t('dialog.otherAnswer');
  free.value = state.texts[index] || '';
  free.dataset.cardKey = `question-${index + 1}-free`;
  free.disabled = cardState.answered || cardState.dismissed || state.busy;
  free.addEventListener('input', () => {
    state.texts[index] = free.value;
    if (free.value) {
      const set = state.selected[index];
      set.clear();
      for (const other of options.querySelectorAll('.quiz-option')) other.setAttribute('aria-checked', 'false');
    }
    handlers.scheduleDraft();
  });
  block.append(free);
  return block;
}

/**
 * Cria o elemento de um cartão e liga as ações aos callbacks do host.
 * @param {object} card cartão público
 * @param {{answer: Function, draft: Function, dismiss: Function, conclude: Function}} api
 * @returns {HTMLElement}
 * @example const el = cardElement(publicCard, {answer, draft, dismiss, conclude});
 */
export function cardElement(card, api) {
  const article = cardHeader(card);
  const box = node('div', 'quiz-card');
  article.append(box);
  const state = {
    card,
    selected: card.kind === 'quiz' ? quizSelected(card) : askSelected(card),
    texts: card.kind === 'ask' ? askTexts(card) : [],
    busy: false,
    error: typeof card.sendError === 'string' ? card.sendError : '',
    timer: 0,
    draftDirty: false,
  };

  const saveDraft = () => {
    if (state.card.answered || state.card.dismissed) return;
    const draft = state.card.kind === 'quiz'
      ? {selected: [...state.selected]}
      : {answers: state.selected.map((set, index) => ({selected: [...set], text: state.texts[index] || ''}))};
    Promise.resolve(api.draft?.(state.card.id, draft)).catch(() => {});
  };
  const scheduleDraft = () => {
    state.draftDirty = true;
    clearTimeout(state.timer);
    state.timer = setTimeout(() => { state.timer = 0; if (state.draftDirty) { state.draftDirty = false; saveDraft(); } }, MAX_DRAFT_DELAY);
  };

  const apply = (next) => {
    if (!next || typeof next !== 'object') return;
    state.card = next;
    state.selected = next.kind === 'quiz' ? quizSelected(next) : askSelected(next);
    state.texts = next.kind === 'ask' ? askTexts(next) : [];
    state.error = typeof next.sendError === 'string' ? next.sendError : '';
    paint();
  };

  async function run(action) {
    if (state.busy) return;
    state.busy = true;
    state.error = '';
    paint();
    try {
      const result = await action();
      const next = result?.card && typeof result.card === 'object' ? result.card : result;
      state.busy = false;
      if (next) apply(next);
      else { state.busy = false; paint(); }
    } catch (error) {
      state.busy = false;
      state.error = String(error?.message || error);
      paint();
    }
  }

  const answerQuiz = (selected) => run(() => api.answer(state.card.id, {selected}));
  const answerDontKnow = () => run(() => api.answer(state.card.id, {dontKnow: true}));
  const answerAsk = () => {
    let answers;
    try {
      answers = normalizeAskAnswer(state.card, {answers: state.selected.map((set, index) => ({selected: [...set], text: state.texts[index] || ''}))});
    } catch (error) {
      state.error = String(error?.message || error);
      paint();
      return;
    }
    run(() => api.answer(state.card.id, {answers}));
  };
  const dismiss = () => run(() => api.dismiss(state.card.id));
  const conclude = () => run(() => api.conclude(state.card.id));

  function paint() {
    const active = document.activeElement?.dataset?.cardKey || '';
    box.replaceChildren(...(state.card.kind === 'ask' ? askBody() : quizBody()));
    if (state.error) box.append(node('p', 'quiz-error', text(state.error)));
    if (active) {
      const next = box.querySelector(`[data-card-key="${CSS.escape(active)}"]`);
      if (next && typeof next.focus === 'function') {
        next.focus();
        if (next instanceof HTMLInputElement) { const at = next.value.length; try { next.setSelectionRange(at, at); } catch {} }
      }
    }
  }

  const handlers = {answerQuiz, dontKnow: answerDontKnow, dismiss, conclude, scheduleDraft, paint: () => paint()};

  function quizBody() {
    const cardState = state.card;
    const parts = [html(node('div', 'quiz-question'), cardState.question)];
    if (cardState.details) parts.push(html(node('div', 'quiz-details'), cardState.details));
    parts.push(quizOptionsElement(cardState, state, handlers));
    const verdict = verdictOf(cardState);
    if (verdict) parts.push(node('p', 'quiz-verdict', verdict));
    if (cardState.note) parts.push(html(node('div', 'quiz-note'), cardState.note));
    if (cardState.answered && cardState.explanation) parts.push(html(node('div', 'quiz-explain'), cardState.explanation));
    const extra = [];
    if (!cardState.answered && cardState.multiSelect) extra.push(cardButton(t('talk.quizSend'), 'quiz-send', () => answerQuiz([...state.selected]), {disabled: state.busy || state.selected.size === 0, key: 'send'}));
    parts.push(actionsElement(state, handlers, extra));
    return parts;
  }

  function askBody() {
    const cardState = state.card;
    const parts = (cardState.questions || []).map((question, index) => askQuestionBlock(cardState, question, index, state, handlers));
    const verdict = verdictOf(cardState);
    if (verdict) parts.push(node('p', 'quiz-verdict', verdict));
    const extra = [];
    if (!cardState.answered && !cardState.dismissed) extra.push(cardButton(t('quiz.respond'), 'quiz-send', answerAsk, {disabled: state.busy, key: 'answer'}));
    parts.push(actionsElement(state, handlers, extra));
    return parts;
  }

  article._update = (next) => apply(next);
  article._card = () => state.card;
  paint();
  return article;
}

/**
 * Atualiza um cartão já montado; devolve o elemento (ou cria, se não houver).
 * @param {HTMLElement|null} element @param {object} card
 * @param {{answer: Function, draft: Function, dismiss: Function, conclude: Function}} api
 * @returns {HTMLElement}
 */
export function updateCard(element, card, api) {
  if (!element) return cardElement(card, api);
  if (typeof element._update === 'function') element._update(card);
  else element.replaceWith(cardElement(card, api));
  return element;
}
