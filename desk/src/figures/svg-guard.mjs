// @ts-check
/* Guarda de SVG do DOMPurify (#60): UMA configuração para o chat
   (`markdown.mjs`), o PDF do tutor (`materials/template.mjs`) e a ferramenta
   "ver o que desenhei" (`figure-markup.mjs`). O DOMPurify já tira `script`,
   `foreignObject`, `use` e os `on*`; o que sobrava, medido no Electron com um
   SVG de teste, era:
     - `href`/`xlink:href` externo em `<a>` e `<image>` (a figura seria um
       rastreador e um link para fora);
     - `url(https://…)` em `style` e em atributos de pintura (`fill`, `filter`…).
   Aqui `href` de elemento SVG só aceita `#fragmento`, `url()` só aceita
   `#fragmento`, e `image`, `animate`, `set` e afins saem de vez. Atributos
   de elementos HTML ficam como estavam: o comportamento do chat não muda. */

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const NOT_A_FRAGMENT = /url\(\s*(?!['"]?\s*#)/i;
const ACTIVE_CONTENT = /@import|expression\s*\(|javascript:/i;

/* Já proibidos por padrão no DOMPurify; listados aqui para a regra não depender da versão. */
export const SVG_FORBID_TAGS = Object.freeze([
  'image', 'use', 'foreignobject', 'script', 'style', 'animate', 'animatemotion', 'animatetransform', 'set', 'handler', 'listener',
]);

const installed = new WeakSet();

/**
 * @param {{addHook: (name: string, hook: (node: Element, data: {attrName: string, attrValue: string, keepAttr: boolean}) => void) => void}} purify
 * @returns {void}
 */
export function installSvgGuard(purify) {
  if (installed.has(purify)) return;
  installed.add(purify);
  purify.addHook('uponSanitizeAttribute', (node, data) => {
    if (node.namespaceURI !== SVG_NAMESPACE) return;
    const name = String(data.attrName).toLowerCase();
    const value = String(data.attrValue);
    const isLink = name === 'href' || name === 'xlink:href';
    if (isLink && !/^\s*#/.test(value)) data.keepAttr = false;
    else if (NOT_A_FRAGMENT.test(value) || ACTIVE_CONTENT.test(value)) data.keepAttr = false;
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
