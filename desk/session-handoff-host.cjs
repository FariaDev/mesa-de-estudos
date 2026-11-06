// @ts-check
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const conversations = require('./src/agents/conversations.cjs');
const free = require('./free-workspaces.cjs');
const core = require('./src/generated/sessionhandoff.core.js').default;
const {message} = require('./src/i18n.mjs');

/* Passagem de contexto entre sessões (#87): monta o digest da conversa de
   origem e devolve o plano para o main criar o destino. A parte pura (o que a
   troca não pode perder) está em `core/sessionhandoff.bend`; aqui ficam a
   leitura do descritor/JSONL, o texto e o corte no teto.

   O digest não chama modelo: matéria, questão ativa, PDFs abertos e as últimas
   falas, nessa ordem. Fatos fixos primeiro; as falas mais antigas caem primeiro
   quando o texto passa de 50.000 caracteres. O arquivo de origem NUNCA é
   escrito — a sessão nova leva `origin` só como ponteiro. */

const MAX_TURNS = 4;
const MAX_TURN_CHARS = 4000;
const MAX_POINT_CHARS = 400;

const isNative = (engine) => conversations.NATIVE_ENGINES.includes(engine);

/** Texto visível de uma mensagem normalizada. @param {unknown} entry */
function textOf(entry) {
  const content = entry && typeof entry === 'object' && Array.isArray(/** @type {{content?: unknown}} */ (entry).content)
    ? /** @type {{type?: string, text?: unknown}[]} */ (/** @type {{content: unknown[]}} */ (entry).content)
    : [];
  return content.filter((part) => part && part.type === 'text' && typeof part.text === 'string')
    .map((part) => String(part.text)).join('\n').trim();
}

/** Corta pelo fim (o ponto de parada costuma estar no fim da fala).
 * @param {string} text @param {number} max */
function clipEnd(text, max) {
  return text.length > max ? `…${text.slice(-(max - 1))}` : text;
}

/** Corta pelo começo: as falas guardam o assunto e o ponto fica no `Último ponto`.
 * @param {string} text @param {number} max */
function clipStart(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** @param {{role?: string, content?: unknown[]}} entry */
function roleOf(entry) {
  return entry.role === 'user' ? 'aluno' : entry.role === 'assistant' ? 'tutor' : '';
}

/** @param {unknown} value */
function stringOf(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** @param {{content?: unknown}} entry */
const carriesMedia = (entry) => Array.isArray(entry?.content)
  && entry.content.some((part) => /image|file/i.test(String(part?.type || '')));

/**
 * Cria o host da passagem sobre o estado vivo do main.
  * @param {{runtime: string, live: import('./main.cjs').DeskLive, engine: (file?: string) => string,
  *   engineFacts: () => {claude?: string, opencode?: string},
  *   visibleEngines: () => string[], legacyHistory: (file: string, stats?: {skippedLines?: number}, options?: {tail?: boolean}) => object[],
 *   sourceInCourse: (file: string) => boolean, FREE_ID: string,
 *   tutorT?: (key: string, args?: Record<string, string|number>) => string}} options
 * @example const {planHandoff}=createSessionHandoffHost({runtime,live,engine,engineFacts,visibleEngines,legacyHistory,sourceInCourse,FREE_ID,tutorT});
 */
function createSessionHandoffHost({runtime, live, engine, engineFacts, visibleEngines, legacyHistory, sourceInCourse, FREE_ID, tutorT}) {
  /* O aviso do digest parcial vai no idioma do tutor, que é quem lê o contexto;
     sem tradutor injetado vale o português do resto do digest. */
  const partialText = (count) => typeof tutorT === 'function'
    ? tutorT('handoff.partial', {count})
    : `Trechos da conversa antiga que não vieram: ${count}.`;
  /** @param {string} file @param {{skipped?: number, skippedLines?: number}} [stats] */
  function sourceRecord(file, stats) {
    const kind = engine(file);
    /* A passagem lê o FIM do JSONL Pi (as falas mais recentes e o "Último
       ponto" novo); o corte entra no aviso. A prévia mantém o começo. */
    if (!isNative(kind)) return {kind, record: null, messages: legacyHistory(file, stats, {tail: true})};
    const record = conversations.readClaudeConversation(file, {runtime});
    if (!record) throw Error(message('err.handoff.sourceMissing', {file: path.basename(file)}));
    return {kind, record, messages: Array.isArray(record.messages) ? record.messages : []};
  }

  /** @param {string} file */
  function courseNameOf(file) {
    if (live.courseId === FREE_ID) return free.freeCourseName();
    return stringOf(live.courses.find((course) => course.id === live.courseId)?.name) || stringOf(live.courseId) || path.basename(file);
  }

  /** @param {object[]} messages @param {{skipped?: number}} [stats] */
  function turnsOf(messages, stats) {
    const out = [];
    for (const entry of messages) {
      const role = roleOf(/** @type {{role?: string}} */ (entry));
      const text = textOf(entry);
      /* Fala sem papel ou sem texto não entra no digest. O aviso (#87) só conta
         o que o aluno perderia, como imagem: linha de ferramenta e raciocínio
         existem em toda conversa e fariam o aviso aparecer sempre. */
      if (!role || !text) {
        if (stats && typeof stats === 'object' && carriesMedia(entry)) stats.skipped = (stats.skipped || 0) + 1;
        continue;
      }
      out.push({role, text: clipStart(text, MAX_TURN_CHARS)});
    }
    return out.slice(-MAX_TURNS);
  }

  /** @param {object[]} messages */
  function pointOf(messages) {
    for (let index = messages.length - 1; index >= 0; index--) {
      const entry = /** @type {{role?: string}} */ (messages[index]);
      const text = textOf(entry);
      if (entry.role === 'assistant' && text) return clipEnd(text, MAX_POINT_CHARS);
    }
    return '';
  }

  function materialsOf() {
    const pdfs = Array.isArray(live.state?.pdfs) ? live.state.pdfs : [];
    return pdfs.filter((pdf) => pdf && typeof pdf.path === 'string' && pdf.path)
      .map((pdf) => `${path.basename(pdf.path)}, p.${Math.max(1, Number(pdf.page) || 1)}`)
      .join(' · ');
  }

  /** @param {string} course @param {string} exercise @param {string} materials @param {{role: string, text: string}[]} turns @param {string} point @param {number} skipped */
  function compose(course, exercise, materials, turns, point, skipped) {
    const sections = new Set();
    for (let node = core.handoffSections(!!course, !!exercise, !!materials, turns.length > 0); node && node.$ === 'Con'; node = node.tail) sections.add(node.head.$);
    const facts = [];
    if (sections.has('HandoffSection.Course')) facts.push(`Matéria: ${course}`);
    if (sections.has('HandoffSection.Exercise')) facts.push(`Questão: ${exercise}`);
    if (sections.has('HandoffSection.Materials')) facts.push(`PDFs abertos: ${materials}`);
    if (sections.has('HandoffSection.Turns') && point) facts.push(`Último ponto: "${point}"`);
    /* O que ficou de fora não some calado: o aviso entra nos fatos fixos, que
       o corte do teto nunca remove (#87). */
    if (skipped > 0) facts.push(partialText(skipped));
    const lines = turns.map((turn) => `${turn.role}: ${turn.text}`);
    return {facts, lines};
  }

  /**
   * O digest da sessão de origem, já cortado no teto.
   * @param {string} file
   * @returns {{text: string, bytes: number, turns: number, skipped: number, origin: {session: string, engine: string}}}
   */
  function digestFor(file) {
    const stats = {skipped: 0, skippedLines: 0};
    const {kind, messages: sourceMessages} = sourceRecord(file, stats);
    const turns = turnsOf(sourceMessages, stats);
    const skipped = (stats.skipped || 0) + (stats.skippedLines || 0);
    const {facts, lines} = compose(courseNameOf(file), stringOf(live.state?.study?.title), materialsOf(), turns, pointOf(sourceMessages), skipped);
    const header = 'Contexto trazido pela Mesa da conversa anterior (sem resumo por modelo).';
    const factText = [header, '', ...facts].join('\n');
    /* Fatos fixos primeiro; as falas mais antigas caem primeiro. */
    let kept = lines.slice();
    let text = factText;
    while (kept.length) {
      text = `${factText}\n\nÚltimas falas:\n${kept.join('\n')}`;
      if (core.withinCap(text.length)) break;
      kept = kept.slice(1);
    }
    if (!kept.length) text = factText;
    if (!core.withinCap(text.length)) throw Error(message('err.handoff.cap', {size: text.length, cap: core.handoffCap()}));
    return {text, bytes: Buffer.byteLength(text, 'utf8'), turns: kept.length, skipped, origin: {session: file, engine: kind}};
  }

  /**
   * Valida a troca e devolve o que o destino precisa receber.
   * @param {unknown} from caminho da sessão de origem
   * @param {unknown} target motor de destino (`claude` ou `opencode`)
   * @param {{mode?: 'digest'|'none'}} [options]
   * @returns {{source: string, sourceEngine: string, target: string, mode: 'digest'|'none',
   *   digest: {text: string, bytes: number, turns: number, skipped: number, origin: {session: string, engine: string}}}}   */
  function planHandoff(from, target, {mode = 'digest'} = {}) {
    if (typeof from !== 'string' || !from) throw Error(message('err.handoff.sourceMissing', {file: String(from)}));
    if (mode !== 'digest' && mode !== 'none') throw Error(message('err.handoff.mode', {mode: String(mode)}));
    try {
      if (!fs.statSync(from).isFile()) throw Error('not a file');
    } catch {
      throw Error(message('err.handoff.sourceMissing', {file: path.basename(from)}));
    }
    const targetEngine = typeof target === 'string' ? target : '';
    const targetReady = isNative(targetEngine) && visibleEngines().includes(targetEngine) && !!engineFacts()[targetEngine];
    const {kind: sourceEngine, record} = sourceRecord(from);
    const status = record?.delivery?.status || '';
    const sourceUncertain = status === 'uncertain' || (from === live.session && !!live.bridge?.uncertain);
    const sourceSettled = !['transmitting', 'accepted', 'uncertain'].includes(status);
    const sameCourse = record ? record.courseId === live.courseId : sourceInCourse(from);
    if (!core.canSwitch(sourceSettled, sourceUncertain, targetReady, sameCourse)) {
      if (sourceUncertain) throw Error(message('err.handoff.uncertain'));
      if (!sourceSettled) throw Error(message('err.handoff.busy'));
      if (!sameCourse) throw Error(message('err.handoff.course'));
      throw Error(message('err.handoff.target', {engine: targetEngine || '(vazio)'}));
    }
    const digest = mode === 'none'
      ? {text: '', bytes: 0, turns: 0, skipped: 0, origin: {session: from, engine: sourceEngine}}
      : digestFor(from);
    return {source: from, sourceEngine, target: targetEngine, mode, digest};
  }

  /**
   * O que o descritor novo recebe para continuar a origem. `null`/vazio é
   * sessão nova sem passagem (D1=C); o modo `none` também não grava digest.
   * @param {unknown} from
   * @param {unknown} target
   * @param {unknown} [mode]
   * @returns {{importedTranscript?: string, origin?: {session: string, engine: string}, handoff?: {kind: string, bytes: number, createdAt: number}}}
   */
  function carryFor(from, target, mode = 'digest') {
    if (!from) return {};
    const plan = planHandoff(from, target, {mode: /** @type {'digest'|'none'} */ (mode)});
    if (plan.mode !== 'digest') return {};
    return {importedTranscript: plan.digest.text, origin: plan.digest.origin, handoff: {kind: 'digest', bytes: plan.digest.bytes, createdAt: Date.now()}};
  }

  return {digestFor, planHandoff, carryFor};
}

module.exports = {createSessionHandoffHost, MAX_TURNS, MAX_TURN_CHARS, MAX_POINT_CHARS};
