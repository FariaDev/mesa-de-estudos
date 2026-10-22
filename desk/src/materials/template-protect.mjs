import {marked} from '../../node_modules/marked/lib/marked.esm.js';

/* Material — proteção do código (fenced, indentado e aninhado) antes de
   procurar matemática: faixas protegidas e localização no texto cru.
   Saiu de template.mjs na #43 fase 2. */

/* O `marked` lê a fonte já normalizada (CRLF/CR → LF); normalizar aqui mantém
   a reconstrução de tokens, a reescrita de títulos e os offsets de diagnóstico
   coerentes com a fonte usada. */
const normalizeLineEndings = (text) => String(text ?? '').replace(/\r\n?/g, '\n');
const normalizeCompare = (text) => String(text ?? '')
  .replace(/[*_`]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();
/* Heurística de linha (fallback): cerca ```/~~~ e código indentado por 4
   espaços depois de linha em branco. Ela não entende contêineres (lista,
   citação), por isso só entra quando a árvore de tokens não reconstrói a
   fonte; o caminho normal deriva as faixas dos tokens `code` do marked. */
function heuristicProtectedRanges(text) {
  const ranges = [];
  const lines = [];
  let offset = 0;
  while (offset <= text.length) {
    const newline = text.indexOf('\n', offset);
    const end = newline === -1 ? text.length : newline;
    lines.push({start: offset, end, content: text.slice(offset, end)});
    if (newline === -1) break;
    offset = newline + 1;
  }
  let fence = null;
  let fenceStart = -1;
  let indentedStart = -1;
  let indentedEnd = -1;
  let previousBlank = true;
  for (const line of lines) {
    const blank = line.content.trim() === '';
    if (fence) {
      const closes = new RegExp(`^ {0,3}${fence.char}{${fence.length},}\\s*$`).test(line.content);
      if (closes) {
        ranges.push([fenceStart, line.end]);
        fence = null;
        fenceStart = -1;
      }
      continue;
    }
    const open = /^( {0,3})(`{3,}|~{3,})/.exec(line.content);
    if (open) {
      fence = {char: open[2][0], length: open[2].length};
      fenceStart = line.start;
      continue;
    }
    if (indentedStart >= 0) {
      if (blank || /^(?: {4}|\t)/.test(line.content)) {
        indentedEnd = line.end;
        continue;
      }
      ranges.push([indentedStart, indentedEnd]);
      indentedStart = -1;
      indentedEnd = -1;
    }
    if (previousBlank && /^(?: {4}|\t)/.test(line.content)) {
      indentedStart = line.start;
      indentedEnd = line.end;
    }
    previousBlank = blank;
  }
  if (fence && fenceStart >= 0) ranges.push([fenceStart, text.length]);
  if (indentedStart >= 0) ranges.push([indentedStart, indentedEnd]);
  return ranges.sort((left, right) => left[0] - right[0]);
}
const BLOCK_CONTAINERS = new Set(['blockquote', 'list', 'list_item']);
/* O `marked` expande tabs de recuo para espaços no `raw` dos filhos de
   contêiner (ex.: a fonte `\t$x$` vira o raw `  $x$`), então o casamento exato
   não encontra a fonte. Compara uma linha do raw com a fonte aceitando que uma
   sequência de espaços/tabs do raw corresponda a outra sequência de
   espaços/tabs na fonte, sem alterar a fonte: devolve a posição final na fonte
   ou -1. Nada além de espaço/tab é tolerado. */
function matchSourceLine(haystack, at, stop, line) {
  let rawAt = 0;
  let sourceAt = at;
  while (rawAt < line.length) {
    if (sourceAt >= stop) return -1;
    const expected = line[rawAt];
    const actual = haystack[sourceAt];
    if (expected === actual) { rawAt += 1; sourceAt += 1; continue; }
    const expectedSpace = expected === ' ' || expected === '\t';
    const actualSpace = actual === ' ' || actual === '\t';
    if (!expectedSpace || !actualSpace) return -1;
    while (rawAt < line.length && (line[rawAt] === ' ' || line[rawAt] === '\t')) rawAt += 1;
    while (sourceAt < stop && (haystack[sourceAt] === ' ' || haystack[sourceAt] === '\t')) sourceAt += 1;
  }
  return sourceAt;
}
/* Localiza `raw` dentro de `haystack` tolerando os prefixos que o marked remove
   ao descer em contêineres (`>` da citação e recuos de item de lista) e a
   expansão de tab do recuo. O casamento exato (por linha, pulando só
   `>`/espaço/tab antes do conteúdo) é tentado primeiro para preservar os
   offsets históricos; a tolerância espaço×tab só entra quando o exato falha.
   Devolve [início, fim) em coordenadas do haystack (null quando não fecha). */
function locateRaw(haystack, raw, from = 0, limit = haystack.length) {
  if (from < 0) from = 0;
  if (limit > haystack.length) limit = haystack.length;
  if (raw === '') return from <= limit ? [from, from] : null;
  if (from + raw.length <= limit && haystack.startsWith(raw, from)) return [from, from + raw.length];
  const lines = raw.split('\n');
  for (let start = from; start <= limit; start += 1) {
    let at = start;
    let first = -1;
    let matched = true;
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      if (lineIndex > 0) {
        const newline = haystack.indexOf('\n', at);
        if (newline === -1 || newline + 1 > limit) { matched = false; break; }
        at = newline + 1;
      }
      const newline = haystack.indexOf('\n', at);
      const stop = newline === -1 ? limit : Math.min(newline, limit);
      let found = -1;
      let end = -1;
      for (let skip = 0; at + skip <= stop; skip += 1) {
        if (at + skip + line.length <= stop && haystack.startsWith(line, at + skip)) {
          found = at + skip;
          end = found + line.length;
          break;
        }
        const char = haystack[at + skip];
        if (char !== '>' && char !== ' ' && char !== '\t') break;
      }
      if (found === -1) {
        for (let skip = 0; at + skip <= stop; skip += 1) {
          const candidateEnd = matchSourceLine(haystack, at + skip, stop, line);
          if (candidateEnd !== -1) { found = at + skip; end = candidateEnd; break; }
          const char = haystack[at + skip];
          if (char !== '>' && char !== ' ' && char !== '\t') break;
        }
      }
      if (found === -1) { matched = false; break; }
      if (lineIndex === 0) first = found;
      at = end;
    }
    if (matched) return [first, at];
  }
  return null;
}
/* Filhos de bloco que podem conter headings/código: citação, lista e item. */
function blockChildren(token) {
  if (token.type === 'list' && Array.isArray(token.items)) return token.items;
  if (BLOCK_CONTAINERS.has(token.type) && Array.isArray(token.tokens)) return token.tokens;
  return [];
}
/* Intervalo entre filhos de um contêiner: só newline e prefixo (`>`, recuo). */
const fillerGap = /^[\s>]*$/;
function mergeRanges(ranges) {
  const sorted = ranges.filter(([start, end]) => end > start).sort((left, right) => left[0] - right[0] || left[1] - right[1]);
  const merged = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push(range);
  }
  return merged;
}
/* Faixas protegidas derivadas da árvore do marked: desce em citação/lista e
   protege todo token `code` (cercado ou indentado), onde estiver. Se a árvore
   não reconstruir a fonte (ou um filho não puder ser localizado), volta para a
   heurística de linha inteira — nunca extrai matemática de dentro de código —
   e devolve `fallback:true` para o diagnóstico avisar que a proteção ficou mais
   grossa (fórmulas em continuação de contêiner podem sair como literais). */
function protectedScan(text) {
  let tokens;
  try { tokens = marked.lexer(text); } catch { tokens = null; }
  if (!tokens || tokens.map((token) => token.raw).join('') !== text) {
    return {ranges: heuristicProtectedRanges(text), fallback: true};
  }
  const ranges = [];
  let failed = false;
  const visit = (token, start, end) => {
    if (failed) return;
    if (token.type === 'code') {
      if (end > start) ranges.push([start, end]);
      return;
    }
    const children = blockChildren(token);
    if (children.length === 0) return;
    let cursor = start;
    for (let index = 0; index < children.length; index += 1) {
      const child = children[index];
      const found = locateRaw(text, child.raw, cursor, end);
      if (!found || (index > 0 && !fillerGap.test(text.slice(cursor, found[0])))) { failed = true; return; }
      visit(child, found[0], found[1]);
      if (failed) return;
      cursor = found[1];
    }
    if (!fillerGap.test(text.slice(cursor, end))) failed = true;
  };
  let cursor = 0;
  for (const token of tokens) {
    visit(token, cursor, cursor + token.raw.length);
    cursor += token.raw.length;
    if (failed) break;
  }
  if (failed) return {ranges: heuristicProtectedRanges(text), fallback: true};
  return {ranges: mergeRanges(ranges), fallback: false};
}
const isEscaped = (text, index) => {
  let count = 0;
  for (let at = index - 1; at >= 0 && text[at] === '\\'; at -= 1) count += 1;
  return count % 2 === 1;
};
function lineOf(text, index) {
  let line = 1;
  for (let at = 0; at < index && at < text.length; at += 1) if (text[at] === '\n') line += 1;
  return line;
}

export {normalizeLineEndings,normalizeCompare,locateRaw,blockChildren,fillerGap,protectedScan,isEscaped,lineOf};
