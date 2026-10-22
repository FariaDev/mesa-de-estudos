/* Modelos de PDF do tutor (Lista, Apostila, Resumo, Simulado, Formulário e o
   Livre de sempre): a ponte entre o núcleo (`core/materialmodel.bend`, com leis
   e provas) e o resto da Mesa. Nada aqui decide regra — ordem, padrão, opções
   válidas, colunas e frases moram no núcleo; este módulo só converte os fatos
   do host (string, boolean, ausente) no formato do artefato gerado e devolve
   valores simples (JSON). Importável em Node puro e no renderer. */

import core from '../generated/materialmodel.core.js';
import {toNat, wholeNat} from '../bend-nat.mjs';

const NONE = {$: 'None'};
const some = (value) => ({$: 'Some', value});
const stringFact = (value) => (typeof value === 'string' ? some(value) : NONE);
const boolFact = (value) => (typeof value === 'boolean' ? some(value) : NONE);

export const DEFAULT_MODEL = core.modelId(core.modelDefault());
const MODEL_COUNT = Number(core.modelCount());
export const MODEL_IDS = Object.freeze(Array.from({length: MODEL_COUNT}, (_unused, index) => core.modelIdAt(toNat(index))));
export const MAX_OPTION_TEXT = Number(core.maxOptionText());
export const FIT_START = Number(core.fitStart());
export const FIT_FLOOR = Number(core.fitFloor());

const idText = (raw) => (typeof raw === 'string' ? raw.trim().toLowerCase() : '\u0000');
const modelFact = (raw) => (typeof raw === 'string' ? some(raw.trim().toLowerCase()) : NONE);

const parse = (raw) => core.parseModel(idText(raw), core.modelDefault());

export function isKnownModel(raw) {
  return typeof raw === 'string' && core.isKnownModel(idText(raw)) === true;
}

/* Id válido do modelo (`livre` quando ausente ou desconhecido). */
export function modelId(raw) {
  return core.modelId(parse(raw));
}

export function modelLabel(raw) {
  return core.labelOf(modelId(raw));
}

export function modelBlurb(raw) {
  return core.blurbOf(modelId(raw));
}

/* Os seis modelos, na ordem do seletor do diálogo. */
export function modelList() {
  return MODEL_IDS.map((id) => ({id, label: core.labelOf(id), blurb: core.blurbOf(id)}));
}

/* Qual modelo vale e por quê: pedido do tutor → último da matéria → livre. */
export function resolveModel({requested, last} = {}) {
  const asked = modelFact(requested);
  const kept = modelFact(last);
  return {
    id: core.resolveModelId(asked, kept),
    source: core.resolveSource(asked, kept),
  };
}

/* Opções do modelo, com tipo, rótulo e padrão — o que o diálogo desenha. */
export function optionSpecs(raw) {
  const model = parse(raw);
  const id = core.modelId(model);
  const count = Number(core.optionCount(model));
  const specs = [];
  for (let index = 0; index < count; index += 1) {
    const key = core.optionKeyAt(model, toNat(index));
    const kind = core.optionKind(key);
    const spec = {key, kind, label: core.optionLabel(model, key)};
    if (kind === 'flag') spec.default = core.flagDefault(model, key) === true;
    else if (kind === 'columns') spec.default = core.columnsDefault();
    else if (kind === 'space') spec.default = core.spaceDefault();
    else spec.default = '';
    specs.push(spec);
  }
  return {model: id, specs};
}

const cutText = (value) => {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  return text.length <= MAX_OPTION_TEXT ? text : text.slice(0, MAX_OPTION_TEXT).trimEnd();
};

/* Colunas chegam como número (2), string ("2", "auto") — vira a string do núcleo. */
const columnsFact = (value) => {
  if (typeof value === 'number' && Number.isInteger(value)) return some(String(value));
  return stringFact(typeof value === 'string' ? value.trim().toLowerCase() : value);
};

/* Opções limpas: só as chaves do modelo, cada uma com valor válido ou padrão.
   Chave desconhecida some; valor inválido volta ao padrão. */
export function normalizeOptions(raw, input) {
  const {model, specs} = optionSpecs(raw);
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const parsed = parse(model);
  const options = {};
  for (const spec of specs) {
    const value = Object.prototype.hasOwnProperty.call(source, spec.key) ? source[spec.key] : undefined;
    if (spec.kind === 'flag') options[spec.key] = core.flagOr(boolFact(value), spec.default);
    else if (spec.kind === 'columns') options[spec.key] = core.columnsChoice(parsed, columnsFact(value));
    else if (spec.kind === 'space') options[spec.key] = core.spaceChoice(stringFact(typeof value === 'string' ? value.trim().toLowerCase() : value));
    else options[spec.key] = cutText(value);
  }
  return options;
}

/* Colunas do Auto: largura (px) do item mais largo, largura útil e vão. */
export function autoColumns(raw, {widestPx, availablePx, gapPx}) {
  const px = (value) => wholeNat(Math.ceil(Number(value)));
  return Number(core.autoColumns(parse(raw), px(widestPx), px(availablePx), px(gapPx)));
}

/* Valores de colunas que o modelo aceita, na ordem do seletor (o núcleo decide). */
export function columnChoices(raw) {
  const parsed = parse(raw);
  return ['auto', '1', '2', '3'].filter((value) => core.columnsAllowed(parsed, value) === true);
}

export const SPACE_CHOICES = Object.freeze(['pequeno', 'medio', 'grande']);

export const columnsLabel = (choice, auto) => core.columnsLabel(String(choice), wholeNat(auto, 1));

export const spaceLabel = (choice) => core.spaceLabel(String(choice));

export function answerHeightMm(size, long) {
  return Number(core.answerHeightMm(String(size), long === true));
}

export const statusPhrase = (source, model) => core.statusPhrase(String(source), modelId(model));

export const pageOf = (page, total) => core.pageOf(wholeNat(page, 1), wholeNat(total, 1));

export const fitNext = (percent) => Number(core.fitNext(wholeNat(percent)));
export const fitDone = (percent) => core.fitDone(wholeNat(percent)) === true;

const DRAFT_SOURCES = ['agent', 'last', 'default'];

/* Modelo e opções que um rascunho de PDF carrega. Rascunho antigo (sem os
   campos) é Livre, como sempre foi. A origem `changed` é só da tela. */
export function draftModel(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const model = modelId(source.model);
  return {
    model,
    options: normalizeOptions(model, source.options),
    modelSource: DRAFT_SOURCES.includes(source.modelSource) ? source.modelSource : 'default',
  };
}

/* Memória do último modelo por matéria/sessão Livre (estado de interface, fora
   do `config.json`): só ids conhecidos e opções válidas; o resto some. */
export function sanitizeMemory(raw, limit = 200) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const kept = [];
  for (const [key, value] of Object.entries(raw)) {
    if (key === '__proto__' || key.length === 0 || key.length > 200) continue;
    if (!value || typeof value !== 'object' || !isKnownModel(value.model)) continue;
    const model = modelId(value.model);
    kept.push([key, {model, options: normalizeOptions(model, value.options)}]);
  }
  /* Passou do teto: ficam os mais recentes (a ordem é a de gravação). */
  return Object.fromEntries(kept.slice(-limit));
}

/* Assinatura estável (modelo + opções) para a revisão da prévia e do PDF. */
export function modelSignature(raw, optionsInput) {
  const id = modelId(raw);
  const options = normalizeOptions(id, optionsInput);
  return `${id}|${Object.keys(options).sort().map((key) => `${key}=${JSON.stringify(options[key])}`).join(',')}`;
}
