import {markup} from '../markdown.mjs';
import {figureMarkdown, blankLineWarning, removedNames} from './figure-markup.mjs';

/* Página da ferramenta "ver o que desenhei" (#60). Recebe a figura do main
   (`executeJavaScript`), passa pelo markup do chat e devolve o que apareceu, os
   avisos da cerca `plot` e o que o sanitizador tirou do SVG. */

const root = document.getElementById('figure');
const BODY_PADDING = 12;
const parse = (html) => new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;

/* Elementos como `<nome>` e atributos como `@nome` (só os que importam para a
   segurança: eventos e endereços), um por ocorrência. */
function namesOf(html) {
  const names = [];
  for (const node of parse(html).querySelectorAll('*')) {
    names.push(`<${node.localName}>`);
    for (const attribute of node.attributes) {
      if (/^on/i.test(attribute.name) || /href$/i.test(attribute.name)) names.push(`@${attribute.name.toLowerCase()}`);
    }
  }
  return names;
}

function warningText(node) {
  return [...node.children].map((child) => child.textContent.trim()).filter(Boolean).join(' · ');
}

window.mesaFigure = {
  render({kind, source, theme, width}) {
    document.documentElement.dataset.theme = theme === 'escuro' ? 'dark' : 'light';
    document.body.style.width = `${width}px`;
    root.innerHTML = markup(figureMarkdown(kind, source), false);
    const plots = root.querySelectorAll('.plot-figure svg').length;
    const warnings = [...root.querySelectorAll('.plot-warning')].map(warningText);
    const blank = kind === 'svg' ? blankLineWarning(source) : '';
    if (blank) warnings.push(blank);
    const removed = kind === 'svg' ? removedNames(namesOf(source), namesOf(root.innerHTML)) : [];
    return {
      plots,
      svgs: root.querySelectorAll('svg').length - plots,
      warnings,
      removed,
      /* A altura do conteúdo, não a da janela: `body.scrollHeight` nunca fica abaixo da janela. */
      contentHeight: Math.ceil(root.getBoundingClientRect().height) + 2 * BODY_PADDING,
    };
  },
};
