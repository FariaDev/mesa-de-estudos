/* Instruções da ferramenta "ver o que desenhei" (#60) — UM texto para os três
   motores (Pi `mesa_ver_figura`, Claude e OpenCode `ver_figura`): mudam juntas,
   e `tests/native-tool-parity.mjs` e `figure-tool.test.mjs` conferem. O mesmo
   módulo traz a ESCOLHA da figura (`FIGURE_CHOICE`), que os guias do chat e do
   PDF repetem em vez de escrever de novo. Importável em Node puro.

   Descrição e campos são SEMPRE em inglês; o que volta ao tutor (`figureText`)
   continua em português, como antes. O texto de sistema da conversa segue em
   português (`FIGURE_RULES`), porque ele não é descrição de ferramenta. */

import {LIMITS} from '../../figures/plot-spec.mjs';
import {FUNCTION_NAMES} from '../../figures/plot-expr.mjs';

export const FIGURE_KINDS = ['plot', 'svg'];
export const THEMES = ['claro', 'escuro'];
export const MAX_SVG_CHARS = 8000;
export const MAX_PLOT_CHARS = LIMITS.source;
export const PLOT_SERIES = 6;

/* Margem, rótulo e cor. Uma frase só, repetida na base do sistema (todo motor
   e toda sessão) e na descrição da ferramenta: o modelo que ignora a ferramenta
   escrevia hex e punha rótulo em cima do traço. O PDF usa o mesmo texto. */
export const FIGURE_RULES = [
  'Gráfico de função, pontos ou retas vai na cerca `plot` (a Mesa desenha eixos e legenda); esse gráfico em SVG à mão sai com rótulo em cima da curva.',
  'No SVG de esquema, o viewBox tem folga de umas 24 unidades além do desenho, cada rótulo fica longe dos traços, com text-anchor start, middle ou end, e a fonte tem pelo menos 12px.',
  'Texto de duas linhas usa um tspan por linha; sem tspan o SVG não quebra a linha.',
  'A legenda fica fora da área da curva, dos eixos ou do esquema.',
  `Traço e texto usam currentColor; cada série usa var(--plot-1) até var(--plot-${PLOT_SERIES}). A Mesa troca hex, rgb e nome de cor por esses tokens ao desenhar, para a figura continuar legível no tema claro e no escuro.`,
].join(' ');

/* A mesma regra em inglês, só para a descrição da ferramenta (o sistema segue
   em português). Uma fonte por destino: o texto da ferramenta não depende do
   idioma do tutor. */
export const FIGURE_RULES_EN = [
  `Function graphs, points or lines go in the \`plot\` fence (the desk draws axes and legend); that graph hand-written in SVG comes out with the label on top of the curve.`,
  'In a schematic SVG, the viewBox has about 24 units of padding beyond the drawing, each label stays away from the strokes, with text-anchor start, middle or end, and the font is at least 12px.',
  'Two-line text uses one tspan per line; without tspan the SVG does not wrap.',
  'The legend stays outside the curve area, axes or schematic.',
  `Stroke and text use currentColor; each series uses var(--plot-1) through var(--plot-${PLOT_SERIES}). The desk replaces hex, rgb and color names with these tokens, so the figure stays readable in light and dark themes.`,
].join(' ');

/* Quando usar cada coisa, e os limites. É o texto que os guias do chat e do PDF
   (#39) acrescentam; fica aqui para não divergir da ferramenta. */
export const FIGURE_CHOICE = [
  `Figures: (1) function graph, points and lines → \`plot\` fence (the desk draws it; you do not compute coordinates; up to ${MAX_PLOT_CHARS} characters, ${LIMITS.functions} functions); (2) schematic, triangle, diagram or fixed geometry → simple inline SVG (up to ${MAX_SVG_CHARS} characters, viewBox, no blank line inside, no script, foreignObject, image or external link); (3) dynamic geometry the student manipulates → GeoGebra, chat only.`,
  FIGURE_RULES_EN,
  'Useful width: up to 720 px in the chat and 420 px in the PDF.',
].join(' ');

/* O QUANDO do chat: uma linha da lista "o que oferecer" (`desk-prompts.cjs`).
   O como, com tamanho e cores, está na descrição da ferramenta (`FIGURE_CHOICE`). */
export const CHAT_FIGURE_OFFER = '- uma figura: cerca `plot` (gráfico de função), SVG simples (esquema fixo) ou GeoGebra (o que o aluno mexe); ver_figura mostra o desenho;';

/* O guia do PDF (#39): o que o PDF aceita. As regras de margem, rótulo e cor
   (`FIGURE_RULES`) já vão na base do sistema em toda sessão que tem `criar_pdf`,
   então aqui fica só a referência a elas e à descrição de `ver_figura` (M1): a
   repetição custava ~300 tokens por turno em todos os motores. No PDF não há
   GeoGebra nem quadro, e as cores do tema viram tons escuros fixos. */
export const PDF_FIGURE_GUIDE = `Figures in the PDF: a function graph, points or lines go in a \`plot\` fence; a schematic or fixed geometry goes in simple SVG (viewBox, up to ${MAX_SVG_CHARS} characters, no blank line) and at most 420 px wide. The conversation figure rules apply (margin, label and color: see the ver_figura description) and, in the PDF, the tokens become fixed dark tones. GeoGebra and boards do not appear in the PDF. A malformed \`plot\` fence becomes a readable warning instead of the figure; if the ver_figura tool exists, check it first.`;

/* O formato da cerca `plot` (`plot-spec.mjs` é quem lê): o único lugar em que o
   tutor aprende as chaves; o guia do PDF aponta para cá. `tests/figure-tool.test.mjs`
   confere que o exemplo abaixo é lido pelo `parsePlot` e que toda chave está listada. */
export const PLOT_EXAMPLE = 'titulo: Custo de produção\nx: -1..5\ny: -2..10\neixo-x: unidades\neixo-y: custo\nfuncao: x^2 - 4x + 3 | rotulo=C(x)\nfuncao: 2x - 1 | tracejado\nponto: 1, 0 | rotulo=raiz\nlinha: x=2';
export const PLOT_FORMAT = `\`plot\` fence (text between \`\`\`plot and \`\`\`): one \`key: value\` line at a time — titulo; x and y as \`min..max\` (without y, the desk chooses); eixo-x and eixo-y (labels); funcao: expression in x with + - * / ^, parentheses, implicit multiplication (2x) and ${FUNCTION_NAMES.join(', ')}, pi, e (up to ${LIMITS.functions}); ponto: x, y (up to ${LIMITS.points}); linha: x=2 or y=1 (up to ${LIMITS.lines}); grade and legenda: sim or nao; largura and altura in px. After \`|\` come options: rotulo=text, cor=1..${LIMITS.colors}, tracejado. Example:\n\`\`\`plot\n${PLOT_EXAMPLE}\n\`\`\``;

const WHAT = 'Shows you, as an image, the figure you wrote — the inline SVG or the body of a `plot` fence — as the student will see it in the conversation and the PDF: the desk draws it with the same renderer and sanitizer, offline, in an invisible window. Nothing is saved or shown in the conversation. Returns a PNG print and a summary: `plot` fence warnings (what came and what was expected), labels touching text or strokes, and what the sanitizer removed from the SVG. Use it before sending the figure and fix what the print and summary show.';

export const FIGURE_DESCRIPTION = `${WHAT} ${FIGURE_CHOICE}\n\n${PLOT_FORMAT}`;

export const KIND_PARAM = '"plot": the body of the fence (`key: value` lines, without the fences). "svg": the complete <svg> element.';
export const THEME_PARAM = 'Preview theme: "claro" (default) or "escuro". In the PDF the colors are always the light ones.';
export const WIDTH_PARAM = 'Preview width in px, from 240 to 1600. Default: 560.';

/* Campos (`tool-fields.mjs` monta o zod do Claude, o TypeBox do Pi e o JSON Schema do OpenCode). */
export const FIGURE_FIELDS = {
  kind: {type: 'enum', values: FIGURE_KINDS, description: KIND_PARAM},
  source: {type: 'string', min: 1, max: MAX_SVG_CHARS},
  theme: {type: 'enum', values: THEMES, optional: true, description: THEME_PARAM},
  width: {type: 'integer', min: 240, max: 1600, optional: true, description: WIDTH_PARAM},
};

/* M8: o esquema tem um campo `source` para os dois tipos, mas a cerca `plot`
   só aceita 4000 caracteres. Validar aqui, antes da ponte, evita a chamada
   perdida e usa a mesma frase do parser (`plot-spec.mjs`). */
export function figureLimitError(kind, source) {
  const length = typeof source === 'string' ? source.length : 0;
  if (kind === 'plot' && length > MAX_PLOT_CHARS) {
    return `plot too-long: recebeu ${JSON.stringify(`${length} caracteres`)}, esperava até ${MAX_PLOT_CHARS} caracteres`;
  }
  return '';
}

/**
 * O que o tutor recebe junto do print: tamanho, avisos e o que o sanitizador removeu.
 * @param {{width: number, theme: string, contentHeight: number, plots: number, svgs: number, warnings: string[], removed: string[]}} result
 * @returns {string}
 * @example figureText({width: 560, theme: 'claro', contentHeight: 300, plots: 1, svgs: 0, warnings: [], removed: []}).split('\n')[0] // 'Figura em 560px (claro): o conteúdo pede 300px de altura.'
 */
export function figureText(result) {
  const lines = [`Figura em ${result.width}px (${result.theme}): o conteúdo pede ${result.contentHeight}px de altura.`];
  const drawn = result.plots + result.svgs;
  lines.push(drawn ? `Desenhado: ${result.plots} gráfico(s) plot e ${result.svgs} SVG.` : 'Nada foi desenhado.');
  for (const warning of result.warnings) lines.push(`Aviso: ${warning}`);
  if (result.removed.length) lines.push(`O sanitizador removeu: ${result.removed.join(', ')}. Tire isso do SVG: o aluno não vê.`);
  lines.push(result.warnings.length || !drawn ? 'Corrija antes de mandar.' : 'Sem avisos.');
  return lines.join('\n');
}
