/* Corpus da equivalência do stream incremental: cada texto é cortado em TODOS
   os prefixos e o HTML incremental tem de ser idêntico ao desenho completo.
   Tudo inventado, sem material de curso. */
import {PLOT_PARABOLA, SVG_FENCE} from './figures-fixtures.mjs';

export const STREAM_BLOCKS_FIXTURES = [
  {
    name: 'headings e parágrafos',
    text: '# Título\n\nParágrafo com **negrito** e $x^2$.\n\n## Sub\n\nOutro parágrafo.\n',
  },
  {
    name: 'lista ordenada aninhada',
    text: '1. primeiro\n2. segundo\n   - aninhado a\n   - aninhado b\n3. terceiro\n\nDepois da lista.\n',
  },
  {
    name: 'lista que recomeça após linha em branco',
    text: 'Intro.\n\n- a\n\n- b\n\nFim.\n',
  },
  {
    name: 'citação',
    text: 'Antes.\n\n> citação\n> continua\n\nDepois.\n',
  },
  {
    name: 'cerca de código aberta e fechada',
    text: 'Antes.\n\n```js\nconst x = 1;\n\nconst y = 2;\n```\n\nDepois.\n',
  },
  {
    name: 'tabela',
    text: 'Antes.\n\n| x | f(x) |\n| --- | --- |\n| 0 | 0 |\n| 1 | 1 |\n\nDepois.\n',
  },
  {
    name: '$$ atravessando parágrafos',
    text: 'Antes.\n\n$$\na+b\n\nc+d\n$$\n\nDepois.\n',
  },
  {
    name: '\\[ \\] atravessando parágrafos',
    text: 'Antes.\n\n\\[\na+b\n\nc+d\n\\]\n\nDepois.\n',
  },
  {
    name: '$ solto',
    text: 'Custa $5 e $10; a fórmula $x+y$ fica.\n\nDepois.\n',
  },
  {
    name: 'cerca plot',
    text: `Antes.\n\n\`\`\`plot\n${PLOT_PARABOLA}\n\`\`\`\n\nDepois.\n`,
  },
  {
    name: 'cerca svg',
    text: `Antes.\n\n${SVG_FENCE}\n\nDepois.\n`,
  },
  {
    name: 'imagem de asset',
    text: 'Antes.\n\n![Figura de teste](desk/assets/teste.png)\n\nDepois.\n',
  },
  {
    name: 'referência definida depois do uso',
    text: 'Veja [a referência][ref].\n\n[ref]: https://example.com\n\nDepois.\n',
  },
  {
    name: 'HTML cru',
    text: 'Antes.\n\n<div class="x">cru</div>\n\nDepois.\n',
  },
  {
    name: 'HTML cru com script (sanitização)',
    text: 'Antes.\n\n<div onclick="alert(1)">cru<script>alert(2)</script></div>\n\nDepois.\n',
  },
  {
    name: '<details>',
    text: 'Antes.\n\n<details>\n<summary>Mais</summary>\n\nTexto dentro.\n\n</details>\n\nDepois.\n',
  },
  {
    name: 'texto com CRLF',
    text: '# Título\r\n\r\nParágrafo $x$.\r\n\r\n- item\r\n- item\r\n\r\nFim.\r\n',
  },
  {
    name: 'título setext e régua',
    text: 'Título\n======\n\nTexto.\n\n---\n\nFim.\n',
  },
];
