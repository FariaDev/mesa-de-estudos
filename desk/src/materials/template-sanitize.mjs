// @ts-check
/* Sanitização do HTML do impresso de material (aba Livre e matéria): DOMPurify
   com a guarda de SVG mais o filtro de `style` (`position`/`inset`/`color`
   saem do `style` do modelo fora do SVG — a guarda cuida do SVG). Sem
   `position`, o `inset` é inerte; sem os três, o `position:fixed` com `inset:0`
   que cobria todas as páginas e o texto transparente que sumia só no papel
   viram bloco inline comum (#seg-markup). O honesto não usa `style` no
   conteúdo — a medição e as figuras entram depois. */
import DOMPurify from '../../node_modules/dompurify/dist/purify.es.mjs';
import {svgSafeConfig, cssomDeclarations} from '../figures/svg-guard.mjs';

/* Allowlist do impresso: só texto e tabela honestos. `display`, `opacity`,
   `visibility`, `position`, `transform`, `float`, `margin`, `font-size`,
   `clip-path`, `color`, `background-color` e `overflow` somem com o conteúdo
   (a prévia tira `style` e o impresso mantém a allowlist — os dois mostram o
   mesmo texto visível). `color`/`background-color` saíram na quarta contraprova
   (#seg-markup): `rgba(0,0,0,0)`, `hsl(0 0% 0% / 0)` e o par
   `background:#fff`+`color:#fefefe` escondiam texto só no papel, e adivinhar
   contraste (que cor é "invisível" em que fundo) é denúncia sem fim — o
   invariante é prévia e papel mostrarem o mesmo TEXTO. A cor honesta da casa
   (`data-hl`, classes dos modelos) não usa `style`, então nada honesto muda.
   `background` abreviado já saía (carrega `url()`), e `font-size:0` nunca
   entrou. */
export const PRINT_STYLE_ALLOW = new Set([
  'text-align', 'font-weight', 'font-style',
  'text-decoration', 'vertical-align',
]);
/* Funções honestas no impresso: cores. `url()` só `#local` (inerte aqui);
   `image-set`, `element()`, `attr()` e o resto saem. */
const PRINT_FUNC_ALLOW = new Set([
  'rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch',
  'color', 'color-mix', 'url',
]);

function printFunctionsAllowed(value) {
  const names = [...String(value).matchAll(/([a-zA-Z-]+)\s*\(/g)].map((match) => match[1].toLowerCase());
  return names.every((name) => PRINT_FUNC_ALLOW.has(name));
}

/* Teto da altura do quadro de resposta do simulado (`--ans`, em mm): o
   núcleo gera de 22 mm a 110 mm (`core/laws/materialmodel.bend`); acima de
   200 mm é ataque (`<div style="--ans:9999mm">` aberto inflava o
   `.pdf-resposta` para 41 páginas). Só número em mm passa. */
export const ANS_MAX_MM = 200;
const ANS_VALUE = /^(\d+(?:\.\d+)?)mm$/i;

function ansValueAllowed(value) {
  const match = ANS_VALUE.exec(String(value ?? '').trim());
  if (!match) return false;
  const number = Number(match[1]);
  return Number.isFinite(number) && number >= 0 && number <= ANS_MAX_MM;
}

function printPropertyAllowed(property) {
  if (PRINT_STYLE_ALLOW.has(property)) return true;
  /* Só a variável própria do template (`--ans` da resposta do simulado,
     `structure.mjs`): altura do quadro, com valor validado em
     `dropPrintPosition` (número em mm até o teto). Qualquer outra `--*`
     (`--accent-paper`, `--ink-soft`, `--muted`, `--panel`…) some: ela
     redefinia a cor do link, do título, da citação, do `th` e do `pre` só no
     PDF, escondendo o texto que a prévia (sem `style`) mostrava. */
  return property === '--ans';
}

/* Declarações de `style` do impresso lidas pelo CSSOM: o navegador já resolveu
   a fuga (`\70 osition`, `position` com comentário CSS), então a allowlist
   acima decide. Reconstrói o `style` só com o honesto. */
export function dropPrintPosition(style) {
  const parsed = typeof cssomDeclarations === 'function' ? cssomDeclarations(style) : null;
  if (parsed) {
    const out = [];
    for (const {property, value, important} of parsed) {
      if (!printPropertyAllowed(property)) continue;
      const text = String(value).trim();
      if (!text) continue;
      /* `--ans` fora do formato (número em mm até o teto) some: o valor do
         template (`structure.mjs`) é sempre como `36mm`. */
      if (property === '--ans' && !ansValueAllowed(text)) continue;
      if (/url\s*\(/i.test(text) && !/url\(\s*['"]?\s*#/.test(text)) continue;
      if (!printFunctionsAllowed(text)) continue;
      out.push(`${property}:${text}${important ? ' !important' : ''}`);
    }
    return out.join(';');
  }
  return '';
}

/* Sanitiza o HTML do material com o filtro de `style` num gancho temporário:
   sai depois da chamada, sem tocar os ganchos permanentes da guarda de SVG.
   @param {string} dirty HTML já com cercas resolvidas, antes do KaTeX
   @returns {string} o HTML sanitizado, sem `position`/`inset`/`color` do modelo
   @example sanitizePrintHtml('<div style="position:fixed;font-weight:700">x</div>')
   // '<div style="font-weight:700">x</div>'
 */
export function sanitizePrintHtml(dirty) {
  const positionFilter = (node, data) => {
    if (String(data.attrName).toLowerCase() !== 'style') return;
    if (node.namespaceURI === 'http://www.w3.org/2000/svg') return;
    const kept = dropPrintPosition(String(data.attrValue));
    if (!kept) data.keepAttr = false;
    else if (kept !== String(data.attrValue)) data.attrValue = kept;
  };
  DOMPurify.addHook('uponSanitizeAttribute', positionFilter);
  try {
    return DOMPurify.sanitize(dirty, svgSafeConfig(DOMPurify, {
      FORBID_TAGS: ['style', 'iframe', 'form', 'input', 'button', 'img', 'picture', 'figure', 'video', 'audio', 'source', 'object', 'embed'],
      FORBID_ATTR: ['srcset', 'ping'],
    }));
  } finally {
    DOMPurify.removeHook('uponSanitizeAttribute', positionFilter);
  }
}
