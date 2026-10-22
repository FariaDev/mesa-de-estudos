import {isEscaped,normalizeLineEndings,protectedScan} from './template-protect.mjs';

/* Material — tokenizador de matemática: separa texto e fórmulas fora das
   faixas de código protegidas.
   Saiu de template.mjs na #43 fase 2. */

/* Separa uma fonte já normalizada em segmentos de texto e matemática, dadas
   as faixas de código protegidas. Compartilhado por `tokenizeMaterial` e
   `checkMaterialMath` (que também observa se a proteção caiu no fallback). */
function segmentMaterial(text, ranges) {
  const segments = [];
  let rangeAt = 0;
  let textStart = 0;
  let index = 0;
  const nextRangeStart = (from) => {
    while (rangeAt < ranges.length && ranges[rangeAt][1] <= from) rangeAt += 1;
    return rangeAt < ranges.length && ranges[rangeAt][0] > from ? ranges[rangeAt][0] : text.length;
  };
  const pushMath = (start, end, tex, display) => {
    if (start > textStart) segments.push({type: 'text', value: text.slice(textStart, start), start: textStart});
    segments.push({type: 'math', tex, display, start, end});
    textStart = end;
  };
  const findCloser = (needle, from, limit) => {
    for (let at = from; at < limit; at += 1) {
      if (text.startsWith(needle, at) && !isEscaped(text, at)) return at;
    }
    return -1;
  };
  while (index < text.length) {
    if (rangeAt < ranges.length && index >= ranges[rangeAt][1]) rangeAt += 1;
    if (rangeAt < ranges.length && index >= ranges[rangeAt][0]) {
      index = Math.min(ranges[rangeAt][1], text.length);
      continue;
    }
    const char = text[index];
    if (char === '`') {
      const run = /^`+/.exec(text.slice(index))[0];
      const limit = nextRangeStart(index);
      const search = new RegExp('(?<!`)`{' + run.length + '}(?!`)', 'g');
      search.lastIndex = index + run.length;
      const found = search.exec(text.slice(0, limit));
      index = found ? found.index + run.length : Math.min(index + run.length, limit);
      continue;
    }
    if (char === '\\') {
      const next = text[index + 1];
      if (next === '[' || next === '(') {
        const closer = next === '[' ? '\\]' : '\\)';
        const limit = nextRangeStart(index);
        const end = findCloser(closer, index + 2, limit);
        if (end !== -1) {
          const tex = text.slice(index + 2, end);
          if (tex.trim()) {
            pushMath(index, end + 2, tex, next === '[');
            index = end + 2;
            continue;
          }
        }
      }
      index += 2;
      continue;
    }
    if (char === '$' && !isEscaped(text, index)) {
      if (text[index + 1] === '$') {
        const limit = nextRangeStart(index);
        const end = findCloser('$$', index + 2, limit);
        if (end !== -1) {
          const tex = text.slice(index + 2, end);
          if (tex.trim()) {
            pushMath(index, end + 2, tex, true);
            index = end + 2;
            continue;
          }
          index = end + 2;
          continue;
        }
        index += 2;
        continue;
      }
      const next = text[index + 1];
      if (next === undefined || /\s/.test(next)) {
        index += 1;
        continue;
      }
      let end = -1;
      for (let at = index + 1; at < text.length && text[at] !== '\n'; at += 1) {
        if (ranges.some(([start, stop]) => at >= start && at < stop)) break;
        if (text[at] === '\\') {
          at += 1;
          continue;
        }
        if (text[at] === '$') {
          if (!isEscaped(text, at) && at > index + 1 && !/\s/.test(text[at - 1])) end = at;
          /* Um `$` fechado por espaço não fecha a fórmula (é o caso do dinheiro
             `$5 ... $10`): encerra a busca em vez de capturar até outro `$`. */
          break;
        }
      }
      if (end === -1) {
        index += 1;
        continue;
      }
      pushMath(index, end + 1, text.slice(index + 1, end), false);
      index = end + 1;
      continue;
    }
    index += 1;
  }
  if (textStart < text.length || segments.length === 0) {
    segments.push({type: 'text', value: text.slice(textStart), start: textStart});
  }
  return segments;
}
/* Separa o Markdown em segmentos de texto e matemática. O texto entre
   segmentos é enviado intacto ao marked; cada segmento de matemática carrega
   `tex`, `display`, `start`/`end` (offsets no markdown) para diagnóstico.
   Nunca extrai matemática de código (cercado, indentado ou inline), de `\$`
   escapado ou de delimitador incompleto. `$5 ... $10` fica texto porque o `$`
   de fechamento precedido de espaço não fecha. */
function tokenizeMaterial(markdown) {
  const text = normalizeLineEndings(markdown);
  return segmentMaterial(text, protectedScan(text).ranges);
}

export {segmentMaterial,tokenizeMaterial};
