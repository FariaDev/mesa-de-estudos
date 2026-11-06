// @ts-check
/* Guarda de SVG do DOMPurify (#60, #seg-markup): UMA configuração para o chat
   (`markdown.mjs`), o PDF do tutor (`materials/template.mjs`) e a ferramenta
   "ver o que desenhei" (`figure-markup.mjs`). O DOMPurify já tira `script`,
   `foreignObject`, `use` e os `on*`; o que sobrava, medido no Electron com um
   SVG de teste, era:
     - `href`/`xlink:href` externo em `<a>` e `<image>` (a figura seria um
       rastreador e um link para fora);
     - `url(https://…)` em `style` e em atributos de pintura (`fill`, `filter`…).
   Aqui `href` de elemento SVG só aceita `#fragmento`, `url()` só aceita
   `#fragmento`, e `image`, `animate`, `set` e afins saem de vez. `class` e
   `name` do modelo saem (a `class` casava com a CSS da Mesa e virava overlay);
   `style` passa por Allowlist de pintura e texto (`svgStyleAllowed`), sem
   `position` nem função de imagem (`image-set("file://…")` lia arquivo local).
   No mesmo gancho, cor literal (hex, rgb, nome) vira token do tema
   (`svg-palette.mjs`). `role` passa só com `img`/apresentação/`graphics-*` e
   `aria-*` fica (o plot e o KaTeX precisam e são inertes); atributos de
   elementos HTML ficam como estavam. */

import {themeAttribute} from './svg-palette.mjs';
import {SVG_ROLE_ALLOW} from '../model-attrs.mjs';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const NOT_A_FRAGMENT = /url\(\s*(?!['"]?\s*#)/i;
const ACTIVE_CONTENT = /@import|expression\s*\(|javascript:/i;
/* Barra invertida é escape de CSS: `u\72l(https://…)` é `url(` para o navegador,
   e o regex de `url(` acima não o vê. Nenhum atributo de figura precisa dela. */
const CSS_ESCAPE = /\\/;
const CSS_COMMENT = /\/\*|\*\//;
/* Função que lê arquivo ou rede dentro de `style` ou pintura: `image-set` (e o
   prefixado), `image()`, `element()` e `cross-fade()` — provado em janela com
   `background-image:image-set("file:///...")`. O `url()` comum segue na regra
   de fragmento (`NOT_A_FRAGMENT`). */
const REMOTE_IMAGE_FUNC = /image-set\s*\(|image\s*\(|element\s*\(|cross-fade\s*\(|-webkit-image-set\s*\(/i;
/* Allowlist de `style` no SVG do modelo: pintura e texto, sem posição nem
   imagem — medido no honesto (cerca sem `style`; KaTeX com `width`; plot com
   `stroke`/`fill` em `var(--plot-N,…)`). `width`/`height` ficam pela régua do
   KaTeX (`style="width:0.47em"` no `<svg>` do parêntese esticado). */
export const SVG_STYLE_ALLOW = new Set([
  'fill', 'fill-opacity', 'fill-rule',
  'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin',
  'stroke-dasharray', 'stroke-dashoffset', 'stroke-miterlimit',
  'stop-color', 'stop-opacity', 'flood-color', 'flood-opacity', 'lighting-color',
  'opacity', 'color', 'paint-order',
  'font-family', 'font-size', 'font-style', 'font-weight', 'font-variant', 'font-stretch',
  'text-anchor', 'text-decoration', 'letter-spacing', 'word-spacing', 'line-height',
  'direction', 'unicode-bidi', 'dominant-baseline', 'alignment-baseline', 'baseline-shift',
  'clip-rule', 'shape-rendering', 'text-rendering',
  'width', 'height',
]);
/* Função dentro de valor de `style`: só as de cor/fragmento e as da casa.
   `var()` é do plot (`stroke:var(--plot-1,#2563eb)`); `color-mix()` é da
   paleta. `attr()`, `image-set()` e o resto saem. */
const SVG_FUNC_ALLOW = new Set([
  'url', 'rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch',
  'color', 'color-mix', 'var',
]);
/* Declarações de `style` respeitando aspas e parênteses (`url("a;b")` não
   quebra no `;` de dentro). */
function splitSvgDeclarations(style) {
  const parts = [];
  let depth = 0, quote = '', current = '';
  for (const char of String(style)) {
    if (quote) {
      current += char;
      if (char === quote) quote = '';
    } else if (char === '"' || char === "'") {
      quote = char;
      current += char;
    } else if (char === '(') {
      depth += 1;
      current += char;
    } else if (char === ')') {
      depth = Math.max(0, depth - 1);
      current += char;
    } else if (char === ';' && depth === 0) {
      parts.push(current);
      current = '';
    } else current += char;
  }
  parts.push(current);
  return parts;
}
/* Toda função usada no valor precisa estar na Allowlist. */
function svgFunctionsAllowed(value) {
  const names = [...String(value).matchAll(/([a-zA-Z-]+)\s*\(/g)].map((match) => match[1].toLowerCase());
  return names.every((name) => SVG_FUNC_ALLOW.has(name));
}
/* Lê as declarações pelo CSSOM — o navegador já resolveu a fuga (`\70 osition`
   vira `position`, `position` com comentário CSS vira `position`), então a procura por nome
   literal não perde. Regra deste trabalho: nenhum scanner à mão ou regex para
   ler HTML/SVG/CSS; o navegador lê, nós perguntamos a ele (`el.style.length`,
   `el.style.item(i)`, `getPropertyValue`). Sem DOM (Node puro dos testes sem
   Electron) devolve `null` e o chamador usa a trilha de texto. */
export function cssomDeclarations(raw) {
  if (typeof document === 'undefined' || !document || typeof document.createElement !== 'function') return null;
  try {
    const probe = document.createElement('div');
    probe.style.cssText = String(raw ?? '');
    const out = [];
    for (let index = 0; index < probe.style.length; index += 1) {
      const property = probe.style.item(index).toLowerCase();
      const val = probe.style.getPropertyValue(property);
      const important = probe.style.getPropertyPriority(property) === 'important';
      out.push({property, value: val, important});
    }
    return out;
  } catch { return null; }
}
/* Decodifica fugas CSS só para a trilha sem DOM (o CSSOM já fez isso quando há
   tela): `\70 osition` → `position`, `\/` → `/`. Suficiente para o teste puro
   acusar o mesmo que a janela acusaria. */
function decodeCssEscapes(text) {
  return String(text).replace(/\\([0-9a-fA-F]{1,6})\s?|\\(.)/g, (_match, hex, char) => {
    if (char !== undefined) return char;
    try { return String.fromCodePoint(parseInt(hex, 16)); } catch { return _match; }
  });
}
/* `position` não-estático pelo CSSOM (ou pela trilha decodificada sem DOM):
   derruba o atributo todo no gancho. */
export function svgPositioned(raw) {
  const parsed = cssomDeclarations(raw);
  if (parsed) return parsed.some(({property, value}) => property === 'position' && String(value).trim().toLowerCase() !== 'static');
  const decoded = decodeCssEscapes(String(raw ?? '')).replace(/\/\*[\s\S]*?\*\//g, '');
  return /position\s*:/i.test(decoded) && !/position\s*:\s*static\b/i.test(decoded);
}
/**
 * `style` do SVG do modelo com só pintura e texto: propriedade fora da
 * Allowlist sai, valor com função fora da lista sai, `url()` não-`#` sai.
 * `position:static` é inerte e passa (contrato da guarda); outro `position`
 * derruba o atributo todo no gancho, antes daqui. Devolve o filtrado (vazio
 * quando nada presta).
 * @param {string} value valor decodificado do atributo
 * @returns {string}
 * @example svgStyleAllowed('fill:red;position:fixed') // 'fill:red'
 * @example svgStyleAllowed('background-image:image-set("file:///x" 1x)') // ''
 */
export function svgStyleAllowed(value) {
  /* Com DOM: reconstrói só pela allowlist lendo do `element.style` (a fuga já
     resolvida). Valor com função só `url(#local)` e cores. */
  const parsed = cssomDeclarations(value);
  if (parsed) {
    const out = [];
    for (const {property, value: val, important} of parsed) {
      if (property === 'position') {
        if (String(val).trim().toLowerCase() === 'static') out.push(`position:${String(val).trim()}${important ? ' !important' : ''}`);
        continue;
      }
      if (!SVG_STYLE_ALLOW.has(property)) continue;
      const text = String(val).trim();
      if (!text) continue;
      if (ACTIVE_CONTENT.test(text) || REMOTE_IMAGE_FUNC.test(text) || NOT_A_FRAGMENT.test(text)) continue;
      if (!svgFunctionsAllowed(text)) continue;
      out.push(`${property}:${text}${important ? ' !important' : ''}`);
    }
    return out.join(';');
  }
  const out = [];
  for (const declaration of splitSvgDeclarations(decodeCssEscapes(value).replace(/\/\*[\s\S]*?\*\//g, ''))) {
    const colon = declaration.indexOf(':');
    if (colon === -1) continue;
    const property = declaration.slice(0, colon).trim().toLowerCase();
    let val = declaration.slice(colon + 1).trim();
    if (property === 'position') {
      if (/^static$/i.test(val.replace(/!important\s*$/i, '').trim())) out.push(`position:${val}`);
      continue;
    }
    if (!SVG_STYLE_ALLOW.has(property) || !val) continue;
    const important = /!important\s*$/i.test(val);
    if (important) val = val.replace(/!important\s*$/i, '').trim();
    if (!val || CSS_ESCAPE.test(val) || CSS_COMMENT.test(val)) continue;
    if (ACTIVE_CONTENT.test(val) || REMOTE_IMAGE_FUNC.test(val) || NOT_A_FRAGMENT.test(val)) continue;
    if (!svgFunctionsAllowed(val)) continue;
    out.push(`${property}:${val}${important ? ' !important' : ''}`);
  }
  return out.join(';');
}

/* O KaTeX também emite SVG (parênteses esticados). A paleta é da figura do tutor. */
function insideKatex(node) {
  for (let current = node; current; current = current.parentElement) {
    const cls = typeof current.getAttribute === 'function' ? current.getAttribute('class') || '' : '';
    if (/(?:^|\s)katex(?:\s|$)/.test(cls)) return true;
  }
  return false;
}

/* Já proibidos por padrão no DOMPurify; listados aqui para a regra não depender da versão. */
export const SVG_FORBID_TAGS = Object.freeze([
  'image', 'use', 'foreignobject', 'script', 'style', 'animate', 'animatecolor', 'animatemotion', 'animatetransform', 'set', 'handler', 'listener',
]);

const installed = new WeakSet();

/**
 * @param {{addHook: (name: string, hook: (node: Element, data: {attrName: string, attrValue: string, keepAttr: boolean}) => void) => void}} purify
 * @returns {void}
 */
export function installSvgGuard(purify) {
  if (installed.has(purify)) return;
  installed.add(purify);
  /* Uma série por `<svg>`: o azul do segundo desenho volta a ser `--plot-1`. */
  const slots = new Map();
  purify.addHook('uponSanitizeElement', (node) => {
    if (node.namespaceURI === SVG_NAMESPACE && node.localName === 'svg' && !insideKatex(node)) slots.clear();
  });
  purify.addHook('uponSanitizeAttribute', (node, data) => {
    if (node.namespaceURI !== SVG_NAMESPACE) return;
    const name = String(data.attrName).toLowerCase();
    const value = String(data.attrValue);
    /* `class` do modelo casa com a CSS da Mesa (`.palette-backdrop` virou
       overlay `fixed` em janela) e `name` planta âncora colidível: os dois
       saem do SVG do modelo. O honesto passa pela cerca sem `class`/`name` e o
       plot/KaTeX não usam — medido no corpo honesto. `role` hostil (`button`,
       `alert`) fingia controle da Mesa: só `img`, apresentação e `graphics-*`
       passam (`SVG_ROLE_ALLOW`, a mesma fonte de `model-attrs.mjs`); o honesto
       (`role="img"` do triângulo e do plot) continua. */
    if (name === 'class' || name === 'name') { data.keepAttr = false; return; }
    if (name === 'role' && !SVG_ROLE_ALLOW.test(String(value).trim())) { data.keepAttr = false; return; }
    /* `style` em Allowlist de pintura e texto (`fill`, `stroke`, `font-*`,
       `width` do KaTeX…): `position` não-estático derruba o atributo todo
       (contrato antigo da guarda), o resto passa pelo filtro — `background-*`
       e função de imagem saem, que são o overlay da cerca e o
       `image-set("file://…")` (#seg-markup). O valor já vem com as entidades
       decodificadas, então `&#112;osition` também cai. Vazio depois do filtro
       remove o atributo. */
    if (name === 'style') {
      if (svgPositioned(value)) { data.keepAttr = false; return; }
      const filtered = svgStyleAllowed(value);
      if (!filtered) data.keepAttr = false;
      else data.attrValue = filtered;
      return;
    }
    const isLink = name === 'href' || name === 'xlink:href';
    if (isLink && !/^\s*#/.test(value)) data.keepAttr = false;
    else if (NOT_A_FRAGMENT.test(value) || ACTIVE_CONTENT.test(value) || CSS_ESCAPE.test(value)
      || CSS_COMMENT.test(value) || REMOTE_IMAGE_FUNC.test(value)) data.keepAttr = false;
    if (data.keepAttr === false) return;
    /* Dentro do KaTeX a guarda vale igual (link e url() externos saem); só a
       paleta fica de fora, porque a cor da fórmula é a do próprio KaTeX. */
    if (insideKatex(node)) return;
    const next = themeAttribute(name, value, slots);
    if (next !== value) data.attrValue = next;
  });
}

/**
 * A configuração do DOMPurify com a guarda instalada e as tags de SVG proibidas somadas às do chamador.
 * @template {{FORBID_TAGS?: string[]}} Config
 * @param {Parameters<typeof installSvgGuard>[0]} purify
 * @param {Config} config
 * @returns {Config & {FORBID_TAGS: string[]}}
 * @example svgSafeConfig(DOMPurify, {FORBID_TAGS: ['form']}).FORBID_TAGS.includes('image') // true
 */
export function svgSafeConfig(purify, config) {
  installSvgGuard(purify);
  return {...config, FORBID_TAGS: [...new Set([...(config.FORBID_TAGS ?? []), ...SVG_FORBID_TAGS])]};
}
