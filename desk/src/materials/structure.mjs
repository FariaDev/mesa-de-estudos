/* Estrutura de cada modelo de PDF, lida pelos TOKENS do Markdown (nunca por
   regex sobre o código-fonte): recebe a lista do `marked.lexer` e devolve a
   lista com os envoltórios HTML que o CSS de cada modelo precisa — grupos de
   questão, quadros de regra, seções de gabarito, colunas. Os tokens do
   conteúdo passam intactos pelo `marked.parser` e pelo DOMPurify depois daqui,
   então nada que o usuário escreve ganha poder novo.

   Importável em Node puro (testes). A numeração de equações da Apostila é um
   passo sobre o HTML final, porque depende da ordem em que o KaTeX entra. */

import {answerHeightMm} from './model.mjs';

const htmlToken = (text) => ({type: 'html', raw: text, text, block: true, pre: false});

const escape = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const plain = (text) => String(text ?? '')
  .replace(/[*_`]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const isHeading = (token) => token && token.type === 'heading';
const headingStarts = (token, word) => isHeading(token) && plain(token.text).startsWith(word);
const isGabarito = (token) => headingStarts(token, 'gabarito');

/* Primeiro token `strong` de um parágrafo: "**Definição 2.1.** …". */
function leadStrong(token) {
  if (!token || token.type !== 'paragraph' || !Array.isArray(token.tokens)) return '';
  const first = token.tokens[0];
  return first && first.type === 'strong' ? plain(first.text) : '';
}

/* Fim da seção que começa em `from`: o próximo título de profundidade menor
   ou igual (ou `until`, se casar antes). */
function sectionEnd(tokens, from, depth, until = () => false) {
  for (let index = from + 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (isHeading(token) && (token.depth <= depth || until(token))) return index;
  }
  return tokens.length;
}

/* O gabarito começa num título "Gabarito…" e vai até o fim. Com a opção
   marcada ele ganha página própria; sem ela flui no texto. */
function wrapGabarito(tokens, onSeparatePage) {
  const at = tokens.findIndex(isGabarito);
  if (at < 0) return tokens;
  return [
    ...tokens.slice(0, at),
    htmlToken(`<section class="pdf-gabarito"${onSeparatePage ? ' data-break="1"' : ''}>`),
    ...tokens.slice(at),
    htmlToken('</section>'),
  ];
}

/* ---------- Lista ---------- */

function structureLista(tokens, options) {
  return wrapGabarito(tokens, options.gabarito !== false);
}

/* ---------- Apostila ---------- */

const THEOREM = /^(defini[cç][aã]o|teorema|proposi[cç][aã]o|lema|corol[aá]rio|propriedade|axioma)\b/;
const EXAMPLE = /^(exemplo|exerc[ií]cio resolvido)\b/;

function structureApostila(tokens) {
  const out = [];
  for (const token of tokens) {
    const lead = leadStrong(token);
    if (lead && THEOREM.test(lead)) {
      out.push(htmlToken('<div class="pdf-def">'), token, htmlToken('</div>'));
    } else if (lead && EXAMPLE.test(lead)) {
      out.push(htmlToken('<div class="pdf-exemplo">'), token, htmlToken('</div>'));
    } else {
      out.push(token);
    }
  }
  return out;
}

/* "(2.1)" à direita das equações de display, por capítulo: o capítulo é o
   título mais alto do CONTEÚDO (o `<h1>` é o do documento e os títulos do
   tutor chegam rebaixados um nível). Sem nenhum título antes, só o contador
   corrido. Equação com erro não conta. */
export function numberEquations(html) {
  const source = String(html);
  let top = 0;
  for (const found of source.matchAll(/<h([2-6])[\s>]/g)) {
    const level = Number(found[1]);
    if (top === 0 || level < top) top = level;
  }
  const chapterTag = top > 0 ? `<h${top}` : '';
  let chapter = 0;
  let count = 0;
  return source.replace(/<h[2-6](?:\s[^>]*)?>\s*(?:(\d{1,3})(?=[.)\s]))?|<div(?= class="math-display(?![^>]*math-error)[ "])/g, (match, written) => {
    if (match.startsWith('<h')) {
      if (chapterTag && match.startsWith(chapterTag)) {
        chapter = written ? Number(written) : chapter + 1;
        count = 0;
      }
      return match;
    }
    count += 1;
    return `<div data-eq="${chapter > 0 ? `${chapter}.${count}` : count}"`;
  });
}

/* ---------- Resumo ---------- */

function structureResumo(tokens, options) {
  let out = tokens;
  if (options.regra !== false) {
    out = out.flatMap((token) => (leadStrong(token).startsWith('regra')
      ? [htmlToken('<div class="pdf-regra">'), token, htmlToken('</div>')]
      : [token]));
  }
  if (options.revisao !== false) out = pairReview(out);
  return out;
}

/* "Erros comuns" e "Para revisar" lado a lado quando vêm em seguida. */
function pairReview(tokens) {
  const wanted = (token) => headingStarts(token, 'erros comuns') || headingStarts(token, 'para revisar');
  const out = [];
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    if (!wanted(token)) {
      out.push(token);
      index += 1;
      continue;
    }
    const groups = [];
    let cursor = index;
    while (cursor < tokens.length && wanted(tokens[cursor])) {
      const end = sectionEnd(tokens, cursor, tokens[cursor].depth);
      groups.push(tokens.slice(cursor, end));
      cursor = end;
      while (cursor < tokens.length && tokens[cursor].type === 'space') cursor += 1;
    }
    out.push(htmlToken('<div class="pdf-duo">'));
    for (const group of groups) out.push(htmlToken('<div class="pdf-duo-col">'), ...group, htmlToken('</div>'));
    out.push(htmlToken('</div>'));
    index = cursor;
  }
  return out;
}

/* ---------- Simulado ---------- */

const QUESTION_HEADING = /^quest[ãa]o\s+([0-9]+[a-z]?)\b\s*(.*)$/i;
const LONG_MARK = /\{\s*longa\s*\}/i;

/* "Questão 3 (2,0 pontos) {longa}" → {number, value, long}. */
export function parseQuestionHeading(text) {
  const match = QUESTION_HEADING.exec(String(text ?? '').trim());
  if (!match) return null;
  const long = LONG_MARK.test(match[2]);
  let rest = match[2].replace(/\{\s*longa\s*\}/gi, '').trim();
  rest = rest.replace(/^[-–—:·]\s*/, '').trim();
  const wrapped = /^[(\[]\s*([\s\S]*?)\s*[)\]]$/.exec(rest);
  if (wrapped) rest = wrapped[1].trim();
  return {number: match[1], value: rest, long};
}

const isChoiceList = (token) => token.type === 'list' && !token.ordered && token.items.length > 0
  && token.items.every((item) => /^\(\s*\)\s/.test(String(item.text ?? '')));

/* "( )" digitado no Markdown sai apertado no PDF (#42): sem lugar para marcar.
   A marca vira "(   )" com espaços de figura — não quebram nem colapsam e têm
   largura de dígito —, no primeiro texto de cada alternativa (o item e a
   cadeia de tokens de texto do começo dele). */
const MARK = /^\(\s*\)/;
const WIDE_MARK = '(\u2007\u2007\u2007)';
function widenLeadingMark(token) {
  if (!token || typeof token !== 'object') return;
  for (const key of ['raw', 'text']) {
    if (typeof token[key] === 'string') token[key] = token[key].replace(MARK, WIDE_MARK);
  }
  if (Array.isArray(token.tokens) && token.tokens.length) widenLeadingMark(token.tokens[0]);
}
function widenChoiceMarks(list) {
  for (const item of list.items) widenLeadingMark(item);
  return list;
}

function structureSimulado(tokens, options) {
  const sheet = [htmlToken('<div class="pdf-ficha"><span>Nome</span><span>Data</span><span>Nota</span></div>')];
  const isQuestion = (token) => isHeading(token) && QUESTION_HEADING.test(String(token.text).trim());
  const out = [...sheet];
  const showValue = options.valor !== false;
  const size = options.espaco || 'medio';
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    if (!isQuestion(token)) {
      out.push(token);
      index += 1;
      continue;
    }
    const info = parseQuestionHeading(token.text);
    const end = sectionEnd(tokens, index, token.depth, (next) => isQuestion(next) || isGabarito(next));
    const body = tokens.slice(index + 1, end);
    const choices = body.some(isChoiceList);
    const heightMm = answerHeightMm(size, info.long);
    out.push(htmlToken(
      `<div class="pdf-q"${info.long ? ' data-long="1"' : ''}${choices ? ' data-choices="1"' : ''} style="--ans:${heightMm}mm">`
      + `<div class="pdf-q-head"><strong class="pdf-q-n">Questão ${escape(info.number)}</strong>`
      + (showValue && info.value ? `<span class="pdf-q-v">${escape(info.value)}</span>` : '')
      + '</div>',
    ));
    for (const piece of body) {
      if (isChoiceList(piece)) out.push(htmlToken('<div class="pdf-alts">'), widenChoiceMarks(piece), htmlToken('</div>'));
      else out.push(piece);
    }
    if (!choices) out.push(htmlToken('<div class="pdf-resposta" aria-hidden="true"></div>'));
    out.push(htmlToken('</div>'));
    index = end;
  }
  return wrapGabarito(out, options.gabarito !== false);
}

/* ---------- Formulário ---------- */

/* Numeração CONTÍNUA entre as seções: cada lista numerada continua de onde a
   anterior parou, para o tutor poder citar "a 13" sem ambiguidade. */
function structureFormulario(tokens) {
  let running = 0;
  const numbered = tokens.map((token) => {
    if (token.type !== 'list' || !token.ordered) return token;
    const first = running + 1;
    running += token.items.length;
    return {...token, start: first};
  });
  const firstHeading = numbered.findIndex(isHeading);
  let from = firstHeading;
  if (from < 0) from = numbered[0] && numbered[0].type === 'paragraph' ? 1 : 0;
  return [
    ...numbered.slice(0, from),
    htmlToken('<div class="pdf-cols">'),
    ...numbered.slice(from),
    htmlToken('</div>'),
  ];
}

const STRUCTURES = {
  lista: structureLista,
  apostila: structureApostila,
  resumo: structureResumo,
  simulado: structureSimulado,
  formulario: structureFormulario,
};

export function structureMaterialTokens(tokens, model, options = {}) {
  const apply = STRUCTURES[model];
  if (!apply) return tokens;
  const out = apply(tokens, options || {});
  out.links = tokens.links;
  return out;
}
