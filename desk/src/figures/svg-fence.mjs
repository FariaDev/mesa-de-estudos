// @ts-check
/* Cerca `svg`/`xml`/`html` que o modelo escreveu em vez do SVG inline (#release
   OpenCode): vira a MESMA figura, pelo mesmo DOMPurify e pela mesma guarda de
   SVG. Só passa o corpo inteiro que é um único `<svg>…</svg>`; o resto continua
   código, inclusive o que passa de MAX_SVG_CHARS. Linha em branco no meio não
   fecha a figura — o corpo é lido até a cerca.
   Regra deste trabalho: nenhum scanner à mão ou regex para ler HTML/SVG/CSS.
   O navegador lê (um `<template>` fora do documento, como `model-attrs.mjs`);
   nós perguntamos a ele. `scanSvgTags` e `SINGLE_SVG` eram o erro dos outros
   buracos e saíram. */
import {MAX_SVG_CHARS} from '../extensions/mesa-figure/guide.mjs';
import {MODEL_SVG_ATTRS_ALLOW, SVG_FENCE_ELEMENTS, SVG_NS, SVG_ROLE_ALLOW, ensureSvgViewBox} from '../model-attrs.mjs';
import {svgStyleAllowed, svgPositioned} from './svg-guard.mjs';

const FENCE_LANGS = new Set(['svg', 'xml', 'html']);
const XLINK_NS = 'http://www.w3.org/1999/xlink';

let svgFigureSeq = 0;

/* Tira o preâmbulo honesto do começo (`<?xml …?>` e `<!DOCTYPE svg …>`,
   sem subconjunto interno) antes do parser: o honesto copiado de um arquivo
   chega com ele, e a serialização do `template` o manteria na frente do
   `<svg>`. Só o simples sai — com `[` (entidade interna) ou sem fechar, a
   forma continua virando código. Sem regex: o começo é âncora literal. */
function stripLeadingPreamble(source) {
  let text = String(source || '');
  for (;;) {
    const clean = text.trimStart();
    if (clean.toLowerCase().startsWith('<?xml')) {
      const end = clean.indexOf('?>');
      if (end === -1) return String(source || '');
      text = clean.slice(end + 2);
      continue;
    }
    if (clean.toLowerCase().startsWith('<!doctype')) {
      const end = clean.indexOf('>');
      if (end === -1) return String(source || '');
      /* Só o doctype simples do SVG sai; com `[` (subconjunto interno, que
         definiria entidade) ou outro nome, a forma continua virando código. */
      const head = clean.slice('<!doctype'.length, end);
      const name = head.trimStart().toLowerCase();
      if ((!name.startsWith('svg') || (name.length > 3 && name[3] !== ' ' && name[3] !== '\t' && name[3] !== '\n' && name[3] !== '\r' && name[3] !== '\f')) || head.includes('[')) {
        return String(source || '');
      }
      text = clean.slice(end + 1);
      continue;
    }
    return text;
  }
}

/* `xlink:href` usado sem o elo declarado na raiz: a única falha que a
   declaração pelo parser conserta. */
function usesBareXlink(root) {
  if (root.hasAttribute('xmlns:xlink')) return false;
  const scope = [root, ...root.querySelectorAll('*')];
  return scope.some((element) => [...element.attributes].some((attribute) => attribute.name.toLowerCase().startsWith('xlink:')));
}

/* Bem-formado em XML (`image/svg+xml`): cerca honesta é XML bem formado;
   `</svg>` duplo e texto solto somem no parser HTML (o `</svg>` extra é
   ignorado), então o XML acusa e a forma com lixo depois da raiz não passa. */
function xmlWellFormed(text) {
  try {
    const xml = new DOMParser().parseFromString(text, 'image/svg+xml');
    if (xml.getElementsByTagName('parsererror').length) return false;
    const xmlRoot = xml.documentElement;
    return !!xmlRoot && String(xmlRoot.localName || '').toLowerCase() === 'svg';
  } catch { return false; }
}

/* Declara o `xlink` na raiz pelo parser quando a recusa é só a falta dele:
   o honesto usa `xlink:href` sem o `xmlns:xlink`, e o XML acusa o prefixo
   sem elo. Só declara — o resto da checagem decide se vira figura. */
function declareXlink(root) {
  if (root.hasAttribute('xmlns:xlink')) return false;
  const scope = [root, ...root.querySelectorAll('*')];
  const usesXlink = scope.some((element) => [...element.attributes].some((attribute) => attribute.name.toLowerCase().startsWith('xlink:')));
  if (!usesXlink) return false;
  root.setAttribute('xmlns:xlink', XLINK_NS);
  return true;
}
/* Prefixa os `id`s do SVG lendo do DOM (o navegador já resolveu entidades,
   caixa e forma colada): cada figura ganha prefixo próprio (`msvg3-…`);
   `url(#…)` e `href="#…"` internos acompanham. Sem DOM (Node puro, sem
   render), devolve o texto intacto — a cadeia real roda no Electron. */
function prefixFenceIds(svg) {
  const ids = [];
  for (const element of svg.querySelectorAll('[id]')) {
    const value = element.getAttribute('id') ?? '';
    if (value !== '' && !ids.includes(value)) ids.push(value);
  }
  if (!ids.length) return {renamed: false, prefix: ''};
  svgFigureSeq = (svgFigureSeq + 1) % 100000;
  const prefix = `msvg${svgFigureSeq}-`;
  for (const element of svg.querySelectorAll('[id]')) {
    const value = element.getAttribute('id') ?? '';
    if (value !== '') element.setAttribute('id', `${prefix}${value}`);
  }
  const targets = [...ids].sort((left, right) => right.length - left.length);
  const pattern = new RegExp(`#(${targets.map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\w-])`, 'g');
  for (const element of svg.querySelectorAll('*')) {
    for (const attribute of [...element.attributes]) {
      if (!attribute.value.includes('#')) continue;
      const next = attribute.value.replace(pattern, (_match, id) => `#${prefix}${id}`);
      if (next !== attribute.value) element.setAttribute(attribute.name, next);
    }
  }
  return {renamed: true, prefix};
}

/* Aplica a allowlist de elementos e atributos lendo do DOM. `style` é lido
   pelo CSSOM (`svgStyleAllowed` reconstrói só a allowlist) e `position`
   não-estático derruba o atributo todo. `class`/`name` saem (a `class` casava
   com a CSS da Mesa e virava overlay). `href`/`xlink:href` só `#fragmento`.
   `role` só carrega `img`, apresentação ou `graphics-*` (o `button`/`alert`
   do modelo fingia controle da Mesa). Devolve `false` quando algo fora da
   allowlist aparece (a cerca inteira vira código). */
function applyFenceAllowlist(svg) {
  for (const element of svg.querySelectorAll('*')) {
    const tag = element.localName.toLowerCase();
    if (!SVG_FENCE_ELEMENTS.has(tag)) return false;
    if (element.namespaceURI !== SVG_NS) return false;
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      if (name === 'id') continue;
      if (name === 'class' || name === 'name') { element.removeAttribute(attribute.name); continue; }
      if (name === 'role' && !SVG_ROLE_ALLOW.test(attribute.value.trim())) {
        element.removeAttribute(attribute.name);
        continue;
      }
      if (name === 'style') {
        if (svgPositioned(attribute.value)) { element.removeAttribute(attribute.name); continue; }
        const filtered = svgStyleAllowed(attribute.value);
        if (!filtered) element.removeAttribute(attribute.name);
        else element.setAttribute(attribute.name, filtered);
        continue;
      }
      if (!MODEL_SVG_ATTRS_ALLOW.has(name)) { element.removeAttribute(attribute.name); continue; }
      if ((name === 'href' || name === 'xlink:href') && !attribute.value.trim().startsWith('#')) {
        element.removeAttribute(attribute.name);
      }
    }
  }
  return true;
}

/**
 * SVG da cerca com os `id`s do modelo sob prefixo único e as referências
 * internas (`url(#…)`/`href="#…"`) reescritas junto. Sem `id`, devolve o
 * mesmo texto. Precisa de DOM (o caminho real no Electron); sem DOM devolve o
 * texto intacto sem renomear — a cadeia real não roda em Node puro.
 * @param {string} svg corpo da cerca, um único `<svg>…</svg>`
 * @returns {{svg: string, renamed: boolean}} o SVG reescrito e se houve `id`
 * @example prefixSvgIds('<svg><rect/></svg>').svg // '<svg><rect/></svg>'
 */
export function prefixSvgIds(svg) {
  const text = String(svg);
  if (typeof document === 'undefined') return {svg: text, renamed: false};
  const holder = document.createElement('template');
  holder.innerHTML = text;
  const root = holder.content.querySelector('svg');
  if (!root) return {svg: text, renamed: false};
  const {renamed} = prefixFenceIds(holder.content);
  return {svg: holder.innerHTML, renamed};
}

/**
 * SVG da cerca sem `style` que posiciona. O resto dos estilos passa intacto
 * para a guarda de SVG. Precisa de DOM; sem DOM devolve o texto.
 * @param {string} svg corpo da cerca, um único `<svg>…</svg>`
 * @returns {string} o SVG sem os estilos que posicionam
 * @example dropPositionStyle('<svg><rect style="position:fixed"/>') // '<svg><rect/>'
 */
export function dropPositionStyle(svg) {
  const text = String(svg);
  if (typeof document === 'undefined') return text;
  const holder = document.createElement('template');
  holder.innerHTML = text;
  for (const element of holder.content.querySelectorAll('*')) {
    if (!element.hasAttribute('style')) continue;
    if (svgPositioned(element.getAttribute('style') ?? '')) element.removeAttribute('style');
  }
  return holder.innerHTML;
}

/**
 * O HTML da figura para uma cerca, ou `null` para deixar o bloco como código.
 * Exige exatamente um elemento raiz `svg` no namespace SVG e nenhum texto ou
 * nó solto fora dele; qualquer descendente fora do namespace SVG (HTML por
 * `foreignObject` ou ponto de integração) recusa a cerca inteira. Forma
 * recusada aparece como bloco de código, sem nada executável.
 * @param {string} source corpo já sem escape de HTML
 * @param {string} lang linguagem da cerca (`svg`, `xml` ou `html`)
 * @returns {{html: string} | null}
 * @example svgFence('<svg viewBox="0 0 10 10"><rect/></svg>', 'svg')?.html.startsWith('<div class="figure"') // true
 * @example svgFence('<svg>…</svg>\n<script>…</script>', 'svg') // null
 */
export function svgFence(source, lang) {
  const language = String(lang || '').toLowerCase();
  if (!FENCE_LANGS.has(language)) return null;
  const text = stripLeadingPreamble(source);
  if (!text || text.trim().length > MAX_SVG_CHARS) return null;
  /* Preâmbulo que sobrou (`<?xml` sem `?>`, `<!doctype` com subconjunto ou
     com outro nome): a forma continua código. Comentário honesto antes da raiz
     (`<!-- … -->`) passa — é inerte, e a serialização abaixo leva só a raiz. */
  const head = text.trimStart().toLowerCase();
  if (head.startsWith('<?xml') || head.startsWith('<!doctype')) return null;
  if (typeof document === 'undefined') return null;
  const holder = document.createElement('template');
  holder.innerHTML = text.trim();
  const nodes = [...holder.content.childNodes].filter((node) => {
    if (node.nodeType === 3) return node.textContent.trim() !== '';
    if (node.nodeType === 8) return false;
    return true;
  });
  if (nodes.length !== 1) return null;
  const root = /** @type {Element} */ (nodes[0]);
  if (root.nodeType !== 1 || root.namespaceURI !== SVG_NS || String(root.localName || '').toLowerCase() !== 'svg') return null;
  /* `xlink:href` sem o `xmlns:xlink` é a única falha de XML que o parser
     conserta sozinho (declara o elo no elemento raiz): o resto — atributo
     sem aspas, entidade HTML (`&nbsp;`), `</svg>` duplo, texto solto — acusa
     no texto original e vira código. Valida o original porque a serialização
     do `template` normalizaria aspas e entidades, escondendo a forma hostil. */
  if (!xmlWellFormed(text.trim())) {
    if (!usesBareXlink(root)) return null;
    declareXlink(root);
    if (!xmlWellFormed(holder.innerHTML.trim())) return null;
  } else if (usesBareXlink(root)) declareXlink(root);
  /* Raiz e aninhados sem `viewBox` escapam do teto de coluna
     (`width="20000"` virava 24 mil px de rolagem): deriva das dimensões
     numéricas para a CSS escalar à coluna sem cortar o honesto. */
  ensureSvgViewBox(root);
  for (const nested of root.querySelectorAll('*')) ensureSvgViewBox(nested);
  for (const element of holder.content.querySelectorAll('*')) {
    if (element.namespaceURI !== SVG_NS) return null;
  }
  if (!applyFenceAllowlist(holder.content)) return null;
  prefixFenceIds(holder.content);
  /* Só a raiz: comentário honesto antes dela (`<?xml?>\n<!-- … -->\n<svg/>`)
    não derruba a figura, e nada fora da raiz vaza para a página. */
  const serialized = root.outerHTML.trim();
  if (!serialized.toLowerCase().startsWith('<svg')) return null;
  return {html: `<div class="figure" data-figure="svg">${serialized}</div>`};
}
