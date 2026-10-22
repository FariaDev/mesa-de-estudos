/* Instruções da ferramenta "ver o que desenhei" (#60) — UM texto para os três
   motores (Pi `mesa_ver_figura`, Claude e OpenCode `ver_figura`): mudam juntas,
   e `tests/native-tool-parity.mjs` e `figure-tool.test.mjs` conferem. O mesmo
   módulo traz a ESCOLHA da figura (`FIGURE_CHOICE`), que os guias do chat e do
   PDF repetem em vez de escrever de novo. Importável em Node puro. */

import {LIMITS} from '../../figures/plot-spec.mjs';
import {FUNCTION_NAMES} from '../../figures/plot-expr.mjs';

export const FIGURE_KINDS = ['plot', 'svg'];
export const THEMES = ['claro', 'escuro'];
export const MAX_SVG_CHARS = 8000;
export const MAX_PLOT_CHARS = LIMITS.source;
export const PLOT_SERIES = 6;

/* Quando usar cada coisa, e os limites. É o texto que os guias do chat e do PDF
   (#39) acrescentam; fica aqui para não divergir da ferramenta. */
export const FIGURE_CHOICE = [
  `Figuras: (1) gráfico de função, pontos e retas → cerca \`plot\` (a Mesa desenha; você não calcula coordenadas; até ${MAX_PLOT_CHARS} caracteres, ${LIMITS.functions} funções); (2) esquema, triângulo, diagrama ou geometria fixa → SVG simples em linha (até ${MAX_SVG_CHARS} caracteres, com viewBox, sem linha em branco dentro dele e sem script, foreignObject, imagem nem link externo); (3) construção que o aluno mexe (geometria dinâmica) → GeoGebra, só no chat.`,
  `Cores no SVG e no plot: currentColor para traço e texto; var(--plot-1) … var(--plot-${PLOT_SERIES}) para as séries (a Mesa troca por tons que funcionam no tema claro e no escuro e no PDF); nunca hex fixo para texto ou fundo. Largura útil: até 720 px no chat e 420 px no PDF.`,
].join(' ');

/* O QUANDO do chat: uma linha da lista "o que oferecer" (`desk-prompts.cjs`).
   O como, com tamanho e cores, está na descrição da ferramenta (`FIGURE_CHOICE`). */
export const CHAT_FIGURE_OFFER = '- uma figura: cerca `plot` (gráfico de função), SVG simples (esquema fixo) ou GeoGebra (o que o aluno mexe); ver_figura mostra o desenho;';

/* O guia do PDF (#39): o que o PDF aceita, com os mesmos limites. No PDF não
   há GeoGebra nem quadro, e as cores do tema viram tons escuros fixos. */
export const PDF_FIGURE_GUIDE = `Figuras no PDF: gráfico de função, pontos ou retas vai numa cerca \`plot\`, que a Mesa desenha em SVG, sem rede nem JavaScript; esquema ou geometria fixa vai em SVG simples dentro do Markdown (até ${MAX_SVG_CHARS} caracteres, com viewBox, sem linha em branco dentro e até 420 px de largura). Use currentColor e var(--plot-1) … var(--plot-${PLOT_SERIES}): no PDF viram tons escuros fixos. GeoGebra e quadros não saem no PDF. Uma cerca \`plot\` malformada vira um aviso legível no lugar da figura e no relatório do PDF; se houver a ferramenta ver_figura, confira antes: o formato da cerca está na descrição dela.`;

/* O formato da cerca `plot` (`plot-spec.mjs` é quem lê): o único lugar em que o
   tutor aprende as chaves; o guia do PDF aponta para cá. `tests/figure-tool.test.mjs`
   confere que o exemplo abaixo é lido pelo `parsePlot` e que toda chave está listada. */
export const PLOT_EXAMPLE = 'titulo: Custo de produção\nx: -1..5\ny: -2..10\neixo-x: unidades\neixo-y: custo\nfuncao: x^2 - 4x + 3 | rotulo=C(x)\nfuncao: 2x - 1 | tracejado\nponto: 1, 0 | rotulo=raiz\nlinha: x=2';
export const PLOT_FORMAT = `Cerca \`plot\` (texto entre \`\`\`plot e \`\`\`): uma linha \`chave: valor\` por vez — titulo; x e y como \`mín..máx\` (sem y, a Mesa escolhe); eixo-x e eixo-y (rótulos); funcao: expressão em x com + - * / ^, parênteses, multiplicação implícita (2x) e ${FUNCTION_NAMES.join(', ')}, pi, e (até ${LIMITS.functions}); ponto: x, y (até ${LIMITS.points}); linha: x=2 ou y=1 (até ${LIMITS.lines}); grade e legenda: sim ou nao; largura e altura em px. Depois de \`|\` vão opções: rotulo=texto, cor=1..${LIMITS.colors}, tracejado. Exemplo:\n\`\`\`plot\n${PLOT_EXAMPLE}\n\`\`\``;

const WHAT = 'Mostra a você, como imagem, a figura que você escreveu — o SVG em linha ou o corpo de uma cerca `plot` —, do jeito que o aluno a verá na conversa e no PDF: a Mesa desenha com o mesmo renderizador e o mesmo sanitizador, offline, numa janela invisível. Nada é gravado nem aparece na conversa. Devolve um print PNG e um resumo: avisos da cerca `plot` (o que veio e o que se esperava) e o que o sanitizador removeu do SVG. Use antes de mandar a figura, e corrija o que o print e o resumo mostrarem.';

export const FIGURE_DESCRIPTION = `${WHAT} ${FIGURE_CHOICE}\n\n${PLOT_FORMAT}`;

export const KIND_PARAM = '"plot": o corpo da cerca (linhas `chave: valor`, sem as cercas). "svg": o elemento <svg> completo.';
export const THEME_PARAM = 'Tema da prévia: "claro" (padrão) ou "escuro". No PDF as cores são sempre as do claro.';
export const WIDTH_PARAM = 'Largura da prévia em px, de 240 a 1600. Padrão: 560.';

/* Campos (`tool-fields.mjs` monta o zod do Claude, o TypeBox do Pi e o JSON Schema do OpenCode). */
export const FIGURE_FIELDS = {
  kind: {type: 'enum', values: FIGURE_KINDS, description: KIND_PARAM},
  source: {type: 'string', min: 1, max: MAX_SVG_CHARS},
  theme: {type: 'enum', values: THEMES, optional: true, description: THEME_PARAM},
  width: {type: 'integer', min: 240, max: 1600, optional: true, description: WIDTH_PARAM},
};

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
