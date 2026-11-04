// @ts-check
/* Parte pura da ferramenta "ver o que desenhei" (#60): monta o Markdown que o
   chat e o PDF leriam para uma figura e compara o que o tutor escreveu com o
   que o sanitizador deixou. A página (`figure-page.mjs`) é quem tem DOM; aqui
   só texto, importável em Node puro. */

/** @typedef {'plot' | 'svg'} FigureKind */

/**
 * A figura como o tutor a escreveria na resposta: a cerca `plot` ou o SVG solto.
 * @param {FigureKind} kind
 * @param {string} source
 * @returns {string}
 * @example figureMarkdown('plot', 'funcao: x^2') // '````plot\nfuncao: x^2\n````'
 */
export function figureMarkdown(kind, source) {
  if (kind === 'plot') return `\`\`\`\`plot\n${source}\n\`\`\`\``;
  if (kind === 'svg') return source;
  throw Error(`figura: recebido ${JSON.stringify(kind)}; esperado "plot" ou "svg"`);
}

/**
 * O marked termina um bloco HTML na linha em branco: um SVG com linha em branco
 * dentro vira texto solto no chat e no PDF.
 * @param {string} source
 * @returns {string} o aviso, ou '' se o SVG está inteiro
 * @example blankLineWarning('<svg>\n\n</svg>') // 'o SVG tem uma linha em branco (linha 2): o chat e o PDF cortam o bloco ali. Tire as linhas em branco de dentro do <svg>.'
 */
export function blankLineWarning(source) {
  const lines = source.trim().split(/\r?\n/);
  const at = lines.findIndex((line) => line.trim() === '');
  if (at < 0) return '';
  return `o SVG tem uma linha em branco (linha ${at + 1}): o chat e o PDF cortam o bloco ali. Tire as linhas em branco de dentro do <svg>.`;
}

/**
 * `<text>` com quebra de linha e sem `<tspan>`: o SVG desenha tudo numa linha,
 * ou corta no Markdown se a quebra deixou uma linha em branco.
 * @param {string} source
 * @returns {string} o aviso, ou '' se cada texto é uma linha ou usa tspan
 * @example stackedTextWarning('<svg><text>a\\nb</text></svg>') // inclui 'sem tspan'
 */
export function stackedTextWarning(source) {
  const broken = [];
  for (const match of source.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/gi)) {
    const body = match[1];
    if (!/[\r\n]/.test(body) || /<tspan\b/i.test(body)) continue;
    const label = body.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
    broken.push(label || 'texto');
  }
  if (!broken.length) return '';
  return `o rótulo "${broken[0]}" tem mais de uma linha sem tspan: o SVG não quebra a linha. Use um tspan por linha.`;
}

/**
 * O que estava na entrada e não está na saída, contando as repetições.
 * @param {string[]} before nomes (elementos como `<nome>`, atributos como `@nome`) do que o tutor escreveu
 * @param {string[]} after os do que sobrou
 * @returns {string[]} nomes sem repetição, na ordem em que aparecem, em linguagem de leitura
 * @example removedNames(['<svg>', '<script>', '@onclick'], ['<svg>']) // ['<script>', 'atributo onclick']
 */
export function removedNames(before, after) {
  const left = new Map();
  for (const name of after) left.set(name, (left.get(name) || 0) + 1);
  const gone = [];
  for (const name of before) {
    const count = left.get(name) || 0;
    if (count > 0) left.set(name, count - 1);
    else if (!gone.includes(name)) gone.push(name);
  }
  return gone.map((name) => (name.startsWith('@') ? `atributo ${name.slice(1)}` : name));
}
