'use strict';

/* Campos de linhagem do descritor (#87): `origin` aponta para a sessão de onde
   o contexto veio; `handoff` registra o que o destino recebeu. São write-once:
   a passagem nunca reescreve a origem nem o resumo já gravado. A validação fica
   aqui para o módulo de conversas continuar abaixo do teto de linhas. */

/* `origin.session` é só ponteiro para a sessão de onde o contexto veio: nunca
   vira caminho de leitura no disco (nada resolve `origin.session` com `fs`;
   só `origin.engine` aparece na lista, no "continua de…"). Por isso a validação
   aceita qualquer caminho não vazio dentro do teto — o que importa é o motor
   ser conhecido e o campo existir para a linhagem. */

const {isPlainObject} = require('../../plain-object.cjs');

const MAX_PATH = 4096;
const MAX_HANDOFF_BYTES = 10 * 1024 * 1024;
const HANDOFF_KINDS = Object.freeze(['digest', 'none']);
const ORIGIN_ENGINES = Object.freeze(['pi', 'claude', 'opencode']);

const boundedString = (value, max) => typeof value === 'string' && value.length <= max;
/* Igualdade insensível à ordem das chaves: o descritor grava em ordem fixa,
   mas um patch com as chaves em outra ordem não é "mudança". */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isPlainObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
const sameValue = (a, b) => canonical(a) === canonical(b);

function validateOrigin(origin) {
  return isPlainObject(origin)
    && boundedString(origin.session, MAX_PATH)
    && origin.session.length > 0
    && ORIGIN_ENGINES.includes(origin.engine);
}

function validateHandoff(handoff) {
  return isPlainObject(handoff)
    && HANDOFF_KINDS.includes(handoff.kind)
    && Number.isInteger(handoff.bytes)
    && handoff.bytes >= 0
    && handoff.bytes <= MAX_HANDOFF_BYTES
    && Number.isFinite(handoff.createdAt)
    && handoff.createdAt >= 0;
}

/** @param {{importedTranscript?: unknown, origin?: unknown, handoff?: unknown}} options */
function validateHandoffOptions({importedTranscript, origin, handoff}) {
  if (importedTranscript !== undefined && !boundedString(importedTranscript, 50000)) return 'importedTranscript';
  if (origin !== undefined && !validateOrigin(origin)) return 'origin';
  if (handoff !== undefined && !validateHandoff(handoff)) return 'handoff';
  return '';
}

module.exports = {MAX_PATH, MAX_HANDOFF_BYTES, HANDOFF_KINDS, ORIGIN_ENGINES, validateOrigin, validateHandoff, validateHandoffOptions, sameValue};
