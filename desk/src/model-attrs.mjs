// @ts-check
/* Faixa dos atributos do modelo (#seg-markup): fonte usada pelo chat
   (`markdown.mjs`). O `marked.parse`
   entrega o HTML do modelo cru — fórmula, figura, asset e código ainda são
   texto `PLACEHOLDER` nessa hora — e os nossos entram depois; então o que tem
   atributo aqui é do modelo, sem isenção por marca que ele também sabe
   escrever (`<span class="katex">` não vale). O DOMPurify final mantém vários
   desses atributos por padrão, e era por eles que o `#prompt`, o
   `#link-dialog`, o overlay `fixed` e o `url(file://…)` sobreviviam. O PDF
   (`materials/template.mjs`) tem contrato próprio: o H1 cru do conteúdo desce
   para H2 mantendo atributos (`material-template.test.mjs`) e o impresso não
   roda JS, então não usa esta faixa; o que os dois dividem de verdade (cerca
   de SVG com prefixo de `id`, guarda de SVG sem `position`) continua valendo.

   A faixa é Allowlist, não denylist (cada rodada trazia um atributo novo:
   `for` aciona o controle real da janela, URL relativa em `src`/`href` lê
   `file:///tmp/…` pela CSP `file:` da janela — a denylist perdeu os dois).
   Sai tudo, exceto:
     `href`, `src`, `alt`, `title`, `width`, `height`, `colspan`, `rowspan`,
     `align`, `start`, `open`, `lang`, `dir` — o necessário ao Markdown e ao
     HTML legítimo (tabela, lista, link, imagem, `details`), medido no corpo
     honesto;
     `class="language-*"` em `<code>` (a regex dos blocos depende dele).
   Em especial saem `for`, `form`/`formaction`, `popover*`, `tabindex`,
   `accesskey`, `slot`, `is`, `inert`, `hidden`, `aria-*` (no HTML), `data-*`,
   `background`, `poster`, `srcset`, `ping`, `target`, `rel`, `download`,
   `id`, `name`, `style` e `class` — e todo `on*` (o DOMPurify também os tira).
   No SVG do modelo fora de cerca vale a lista do SVG (`MODEL_SVG_ATTRS_ALLOW`:
   geometria, pintura e texto do honesto inline, medidos em
   `figures-fixtures.mjs`); a cerca continua sendo o caminho do `id` com
   gradiente. KaTeX, figura e asset entram depois da faixa e não são tocados.
   Entidade no NOME do atributo é inerte (o parser não decodifica nome);
   entidade no VALOR não salva (o atributo sai de todo jeito, e `href`/`src`
   são conferidos no valor decodificado, com tabulação/quebra enganosa
   removida antes do teste de esquema).

   Em `src` do modelo só passam `https:` e `data:image/*`; em `href`, `https:`,
   `http:` (legado honesto de clique morto, travado por `message-links-ui.mjs`)
   e `#fragmento` (âncora interna; clique morto pelo `message-links.mjs`).
   Relativo sai — inclui `file:`, `../`, `/`, `desk/`, `C:\`: o asset local
   honesto usa o placeholder próprio (`figure.asset[data-asset]`, resolvido por
   IPC), nunca `src` relativo, e a CSP segue barrando a carga remota como hoje.

   Por que o parser e não regex (bypass 2026-11): a retirada era expressão
   regular com scanner próprio de aspas (`MODEL_ATTR`, `tagEnd`), e o navegador
   lê certas formas de outro jeito — o atributo hostil passava com o gate
   acusando. Provado em teste: `a="b"id="prompt"` (sem espaço depois da aspa),
   `a='b'style="position:fixed"` (idem) e aspa solta em valor sem aspas
   (`x=a" id="prompt">`, que engolia o resto da mensagem no scanner e copiava
   cru. A passagem usa o mesmo parser que vai ler o HTML (um `<template>` fora
   do documento): o que ela vê é o que o navegador vê, então não há forma que
   o navegador aceite e ela não alcance — inclusive em SVG e MathML e no
   conteúdo de `<template>` aninhado, que o `*` não alcança sozinho. A
   comparação de nome ignora caixa, como o parser. */

/* Teto de dimensão honesta (item 6): `width`/`height` do modelo acima disso
   some — `<img width=20000>` abria coluna de 21 mil px. O honesto (foto,
   tabela, KaTeX) fica bem abaixo; plot/shot/asset têm CSS próprio e não usam
   este caminho. */
export const MODEL_DIMENSION_MAX = 1200;
/* Elementos SVG que a cerca aceita (fonte única com `svg-fence.mjs`): geometria,
   pintura, texto, gradiente, recorte e âncora interna honestos. Fora daqui a
   cerca inteira vira código — em especial `script`, `style`, `foreignObject`,
   `image`, `use`, `animate`, `animateColor`, `animateMotion`,
   `animateTransform`, `set`, `handler`, `listener`, `discard`, `metadata` e
   qualquer HTML. Só a allowlist decide (`animateColor` cai aqui). */
export const SVG_FENCE_ELEMENTS = new Set([
  'svg', 'g', 'defs', 'lineargradient', 'radialgradient', 'stop',
  'clippath', 'mask', 'pattern', 'marker', 'symbol', 'title', 'desc',
  'filter', 'fegaussianblur', 'feoffset', 'feblend', 'femerge', 'femergenode',
  'feflood', 'fecomposite', 'fecolormatrix', 'fedropshadow',
  'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'path',
  'text', 'tspan', 'textpath', 'a',
]);
/* `role` que o SVG do modelo pode carregar: rótulo honesto (`role="img"` do
   triângulo e do plot) e os papéis inertes de apresentação; `button`, `alert`
   e o resto saem (#seg-markup: o `button` com `aria-label` fingia um controle
   clicável da Mesa). `aria-label` continua passando. */
export const SVG_ROLE_ALLOW = /^(?:img|presentation|none|graphics-[a-z]+)$/i;
/* Qualquer tag aberta com separador de atributo (branco, quebra ou barra):
   condição necessária para o parser criar atributo — tag sem isso (`<p>`,
   `</div>`, `<!--…-->`) não carrega nada e não paga o parser. É mais larga que
   a antiga (que citava os cinco nomes e exigia `=`, perdendo atributo sem
   valor como `<div id>`): o que ela perde o parser também não aceita como
   atributo — o primeiro atributo exige o separador, e forma colada em aspa só
   existe a partir do segundo, o que já implica branco antes do primeiro. */
const MODEL_ATTR_GATE = /<[A-Za-z][^<>]*[\s/]/;
/* Allowlist: cada nome com o motivo. `href`/`src` passam ainda pelo portão de
   URL (`modelHrefAllowed`/`modelSrcAllowed`); o resto do nome fora daqui sai,
   inclusive com outro valor ou caixa (`FOR`, `TabIndex`, `ARIA-LABEL`). */
export const MODEL_ATTRS_ALLOW = new Set([
  'href', // link Markdown honesto (`[guia](https://…)`); só https: e #fragmento
  'src', // imagem Markdown remota honesta; só https: e data:image/* (a CSP barra a carga)
  'alt', // texto alternativo da imagem Markdown
  'title', // dica do link e da imagem (`[texto](url "dica")`)
  'width', // dimensão honesta de imagem/tabela crua
  'height', // dimensão honesta de imagem/tabela crua
  'colspan', // tabela crua honesta (`<td colspan="2">`)
  'rowspan', // tabela crua honesta
  'align', // alinhamento honesto herdado (`<div align="center">`)
  'start', // lista ordenada honesta (`<ol start="3">`)
  'open', // `details` honesto aberto (`<details open>`)
  'lang', // trecho em outro idioma (`<span lang="en">`)
  'dir', // direção de trecho (`<bdo dir="rtl">`)
]);
const LANGUAGE_CLASS = /^language-[\w-]+$/;
/* SVG (e MathML passa pela regra do HTML): o honesto vai inline no chat
   (`figures-fixtures.mjs`: triângulo, cores, sobreposição — `viewBox`,
   `points`, `d`, `fill`, `stroke`, `role`/`aria-label`), então a geometria, a
   pintura e o texto ficam; a cerca continua sendo o caminho do gráfico com
   `id`/gradiente/`filter`. Fora daqui saem `id`, `name`, `style`, `class`,
   `for`, `transform` (reposiciona) e o resto da lista do HTML. `href`/`xlink:href`
   só `#fragmento` (a guarda de SVG reforça); `filter` em url externo morre na
   guarda de todo jeito, e o honesto usa `url(#local)`. `filter` e as primitivas
   sem carga externa (`feGaussianBlur` e as irmãs, nunca `feImage`) ficam, com
   os parâmetros honestos (`in`, `result`, `stdDeviation`, `dx`/`dy`, `mode`,
   `operator`, `type`, `values`, `k1`–`k4`). `aria-label`/`aria-hidden` e
   `xmlns:xlink` ficam (rótulo honesto e elo do `xlink:href` interno); `role`
   passa pela lista mas só com valor de `SVG_ROLE_ALLOW` (`img`, apresentação
   e `graphics-*`), conferido em `stripModelElement`. */
export const SVG_NS = 'http://www.w3.org/2000/svg';
export const MODEL_SVG_ATTRS_ALLOW = new Set([
  ...MODEL_ATTRS_ALLOW,
  'role', // `role="img"` do triângulo honesto e do plot
  'aria-label', 'aria-hidden', // rótulo honesto da figura (`role="img"`)
  'xmlns:xlink', // elo do `xlink:href="#fragmento"` interno
  'filter', // desfoque/mescla honesto (`filter="url(#f)"`, só `#local` na guarda)
  'in', 'in2', 'result', // entradas e nome da primitiva (`SourceGraphic`, `#local`)
  'stddeviation', 'dx', 'dy', // parâmetros honestos do desfoque/deslocamento
  'mode', 'operator', 'type', 'values', 'k1', 'k2', 'k3', 'k4', // mescla e matriz honestas
  'viewbox', 'preserveaspectratio', // escala honesta (`viewBox`, comparado em minúsculo como o parser)
  'x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry', // geometria honesta
  'x1', 'y1', 'x2', 'y2', 'd', 'points', 'clip-path', 'offset', // reta, caminho, polígono, recorte interno, parada do gradiente honesto
  'mask', 'marker-start', 'marker-mid', 'marker-end', // máscara e marcador honestos (`url(#local)`)
  'markerwidth', 'markerheight', 'refx', 'refy', 'orient', 'markerunits', // caixa do marcador honesto
  'maskunits', 'maskcontentunits', 'clippathunits', // unidades honestas de recorte/máscara
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', // pintura honesta (a paleta troca na guarda)
  'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-miterlimit',
  'stop-color', 'stop-opacity', 'flood-color', 'flood-opacity', 'lighting-color',
  'opacity', 'color', 'paint-order', 'clip-rule',
  'font-family', 'font-size', 'font-style', 'font-weight', 'font-variant', 'font-stretch', // texto honesto
  'text-anchor', 'text-decoration', 'letter-spacing', 'word-spacing',
  'direction', 'unicode-bidi', 'dominant-baseline', 'alignment-baseline', 'baseline-shift',
  'xlink:href', // como `href`: só `#fragmento`
]);

/* Número puro de unidade de usuário SVG (`20000`, `10.5`, `1e4`): com unidade
   (`100%`, `2em`, `10px`) não dá para derivar `viewBox`, e a forma sai como
   veio (a CSS limita todo SVG do modelo com teto próprio, tenha ou não
   `viewBox`; sem ele o tamanho é o declarado, contido pela coluna). */
const SVG_PLAIN_NUMBER = /^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

function svgAttr(element, name) {
  for (const attribute of [...element.attributes]) {
    if (attribute.name.toLowerCase() === name) return attribute.value;
  }
  return null;
}

/**
 * `viewBox` derivado de `width`/`height` numéricos quando a raiz (ou o
 * aninhado) da cerca — ou o SVG solto do chat — não traz um: `<svg
 * width="20000" height="20000">` virava rolagem de 24 mil px porque nenhuma
 * regra de coluna casava (`svg[viewBox]`); com `viewBox="0 0 20000 20000"` a
 * CSS escala a figura à coluna com a proporção, sem cortar nada honesto.
 * Com unidade ou sem dimensão numérica, não há o que derivar e nada muda.
 * @param {Element} element elemento `svg` já lido pelo parser
 * @returns {boolean} `true` quando o `viewBox` foi gerado
 * @example ensureSvgViewBox(parse('<svg width="20" height="10">')) // true
 */
export function ensureSvgViewBox(element) {
  if (!element || element.namespaceURI !== SVG_NS) return false;
  if (String(element.localName || '').toLowerCase() !== 'svg') return false;
  if (svgAttr(element, 'viewbox') !== null) return false;
  const width = svgAttr(element, 'width');
  const height = svgAttr(element, 'height');
  if (width === null || height === null) return false;
  const cleanWidth = String(width).trim();
  const cleanHeight = String(height).trim();
  if (!SVG_PLAIN_NUMBER.test(cleanWidth) || !SVG_PLAIN_NUMBER.test(cleanHeight)) return false;
  if (Number(cleanWidth) <= 0 || Number(cleanHeight) <= 0) return false;
  element.setAttribute('viewBox', `0 0 ${cleanWidth} ${cleanHeight}`);
  return true;
}
/* Tira C0, branco e DEL do começo, como o parser de URL do navegador (sem
regex de controle: o lint os veta e o propósito aqui é justamente tirá-los). */
function stripLeadingC0(value) {
  let i = 0;
  while (i < value.length) {
    const code = value.charCodeAt(i);
    if (code > 32 && code !== 127) break;
    i += 1;
  }
  return value.slice(i);
}
/* Esquema da URL depois de tirar o que o parser de URL do navegador ignora
   (C0 e branco no começo; tabulação e quebra em qualquer lugar — `java\tscript:`
   é `javascript:` para ele). Minúsculo, como o parser. */
function urlScheme(value) {
  const text = stripLeadingC0(String(value)).replace(/[\t\n\r]/g, '');
  const match = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(text);
  return match ? match[1].toLowerCase() : '';
}

/**
 * `href` que o modelo pode pôr: `https:` (o clique segue pedindo confirmação
 * no `message-links.mjs`), `http:` (o teste `message-links-ui.mjs` trava o
 * legado como link visível de clique morto) ou `#fragmento` (âncora interna,
 * clique morto). Só o clique os toca — e só o `https:` abre diálogo — então
 * não há leitura de arquivo nem navegação. Relativo, `file:`, `data:`,
 * `mailto:` e vazio saem.
 * @param {string} value valor decodificado do atributo
 * @returns {boolean}
 * @example modelHrefAllowed('https://exemplo.com/guia') // true
 * @example modelHrefAllowed('../../../tmp/x.png') // false
 */
export function modelHrefAllowed(value) {
  const text = String(value).trim();
  if (!text) return false;
  if (text.startsWith('#')) return true;
  const scheme = urlScheme(text);
  return scheme === 'https' || scheme === 'http';
}

/**
 * `src` que o modelo pode pôr: `https:` (a CSP barra a carga, como hoje) ou
 * `data:image/*`. Relativo e `file:` saem — o asset honesto usa o placeholder
 * próprio, nunca `src`.
 * @param {string} value valor decodificado do atributo
 * @returns {boolean}
 * @example modelSrcAllowed('data:image/png;base64,iVBORw0=') // true
 * @example modelSrcAllowed('file:///tmp/x.png') // false
 */
export function modelSrcAllowed(value) {
  const text = String(value).trim();
  if (!text || text.startsWith('#')) return false;
  const scheme = urlScheme(text);
  if (scheme === 'https') return true;
  if (scheme === 'data') return /^data:image\//i.test(stripLeadingC0(text));
  return false;
}

/**
 * HTML do `marked.parse` com só a Allowlist do modelo. `options.idPrefix`
 * (prévia do Livre) prefixa `id` e `class` em vez de remover, e reescreve as
 * referências internas (`href="#…"`, `url(#…)`) junto; fora da prévia os dois
 * saem. No `<code>` sobrevive só a classe de linguagem exata
 * (`class="language-js"`), que a regex dos blocos procura. O resto sai
 * serializado pelo parser — tabela, lista, `details`, link, imagem e código
 * passam intactos (texto e entidades continuam com o mesmo valor). Precisa de
 * DOM: o caminho real roda no Electron (`markdown.mjs`); fora dele falha alto
 * em vez de fingir.
 * @param {string} html saída do `marked.parse`, ainda com PLACEHOLDERs
 * @param {{idPrefix?: string, keepMark?: string}} [options] prefixo da prévia (`pv1-…`) e marca dos envoltórios da casa (`keepMark`)
 * @returns {string} o mesmo HTML com só a Allowlist do modelo
 * @example stripModelAttrs('<div for="send">oi</div>') // '<div>oi</div>'
 * @example stripModelAttrs('<pre><code class="language-js">x</code></pre>')
 * // '<pre><code class="language-js">x</code></pre>'
 */
export function stripModelAttrs(html, options = {}) {
  const {idPrefix = '', keepMark = ''} = options;
  const holder = document.createElement('template');
  holder.innerHTML = html;
  const renamed = stripModelContent(holder.content, idPrefix, keepMark);
  if (idPrefix) rewriteModelRefs(holder.content, renamed, idPrefix);
  /* A marca é da casa, não do modelo: some do resultado depois de poupar os
     atributos dos envoltórios (`structure.mjs`). */
  if (keepMark) for (const element of holder.content.querySelectorAll(`[${keepMark}]`)) element.removeAttribute(keepMark);
  return holder.innerHTML;
}

/* Tira o que está fora da Allowlist de cada elemento da raiz, descendo no
   `<template>` aninhado. Devolve os `id`s prefixados (prévia), para reescrever
   as referências depois. */
function stripModelContent(root, idPrefix, keepMark = '') {
  const renamed = [];
  for (const element of root.querySelectorAll('*')) {
    /* `is` tem valor interno no parser: `removeAttribute` tira o atributo mas
       a serialização o ressuscita (`<div is="x">` volta com o `is`). Troca o
       elemento por um limpo com os atributos que sobraram — o novo nasce sem
       valor `is` e não atualiza para custom element nenhum. */
    if (element.hasAttribute('is')) {
      const clean = element.namespaceURI === 'http://www.w3.org/2000/svg' || element.namespaceURI === 'http://www.w3.org/1998/Math/MathML'
        ? document.createElementNS(element.namespaceURI, element.localName)
        : document.createElement(element.localName);
      stripModelElement(element, idPrefix, renamed, keepMark);
      for (const attribute of [...element.attributes]) clean.setAttribute(attribute.name, attribute.value);
      while (element.firstChild) clean.appendChild(element.firstChild);
      element.replaceWith(clean);
      if (clean instanceof HTMLTemplateElement) renamed.push(...stripModelContent(clean.content, idPrefix, keepMark));
      continue;
    }
    stripModelElement(element, idPrefix, renamed, keepMark);
    if (element instanceof HTMLTemplateElement) renamed.push(...stripModelContent(element.content, idPrefix, keepMark));
  }
  return renamed;
}

/* Tira o que está fora da Allowlist de um elemento só. No SVG vale a lista do
   SVG (geometria, pintura e texto do honesto); `aria-*` fica no SVG como no
   `role="img"` honesto — no HTML sai, como manda o item 1. */
function stripModelElement(element, idPrefix, renamed, keepMark = '') {
  /* Envoltório da casa: `class`/`style` daqui são legítimos (a marca tem nome
     sorteado, ver `materials/house-marks.mjs`). Os filhos seguem pela faixa
     normal. */
  if (keepMark && element.hasAttribute(keepMark)) return;
  const isCode = element.localName.toLowerCase() === 'code';
  const isSvg = element.namespaceURI === SVG_NS;
  if (isSvg && String(element.localName || '').toLowerCase() === 'svg') {
    /* SVG solto sem `viewBox` escapa do teto de coluna como a cerca
       (`svg-fence.mjs` faz o mesmo na raiz e no aninhado): deriva das
       dimensões numéricas para a CSS escalar sem cortar. */
    ensureSvgViewBox(element);
  }
  const allowed = isSvg ? MODEL_SVG_ATTRS_ALLOW : MODEL_ATTRS_ALLOW;
  for (const attribute of [...element.attributes]) {
    const name = attribute.name.toLowerCase();
    const value = attribute.value;
    if (isCode && name === 'class' && LANGUAGE_CLASS.test(value)) continue;
    if (isSvg && name === 'role') {
      if (!SVG_ROLE_ALLOW.test(value.trim())) element.removeAttribute(attribute.name);
      continue;
    }
    if (isSvg && name.startsWith('aria-')) continue;
    if (idPrefix && (name === 'id' || name === 'class') && value.trim() !== '') {
      if (name === 'id') {
        renamed.push(value);
        element.setAttribute(attribute.name, `${idPrefix}${value}`);
      } else {
        element.setAttribute(attribute.name, value.split(/[\t\n\f\r ]+/).filter(Boolean).map((token) => `${idPrefix}${token}`).join(' '));
      }
      continue;
    }
    if (!allowed.has(name)) {
      element.removeAttribute(attribute.name);
      continue;
    }
    /* No SVG o `href` (e o `xlink:href`) só aponta para dentro (`#fragmento`):
       o externo sai aqui e a guarda de SVG o barraria de novo. */
    if ((name === 'href' || name === 'xlink:href') && isSvg) {
      if (!value.trim().startsWith('#')) element.removeAttribute(attribute.name);
    } else if (name === 'href' && !modelHrefAllowed(value)) element.removeAttribute(attribute.name);
    else if (name === 'src' && !modelSrcAllowed(value)) element.removeAttribute(attribute.name);
    /* Teto de dimensão honesta: número acima do máximo sai (coluna de 21 mil
       px do `<img width=20000>`). Valor não numérico passa (ex. `100%`); o CSS
       `.message img` limita de todo jeito sem tocar plot/shot/asset. */
    else if ((name === 'width' || name === 'height') && !isSvg) {
      const numeric = Number(String(value).trim().replace(/px$/i, ''));
      if (Number.isFinite(numeric) && numeric > MODEL_DIMENSION_MAX) element.removeAttribute(attribute.name);
    }
  }
}

/* Reescreve as referências internas para os `id`s prefixados da prévia:
   `href="#antigo"` e `url(#antigo)` (em qualquer atributo de pintura do SVG
   solto) viram `#prefixo-antigo`. Ordem longa primeiro, com fronteira, para
   `#g2` não morder `#g`. */
function rewriteModelRefs(root, renamed, idPrefix) {
  const targets = [...new Set(renamed)].sort((left, right) => right.length - left.length);
  if (!targets.length) return;
  const pattern = new RegExp(`#(${targets.map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\w-])`, 'g');
  for (const element of root.querySelectorAll('*')) {
    for (const attribute of [...element.attributes]) {
      if (!attribute.value.includes('#')) continue;
      const next = attribute.value.replace(pattern, (_match, id) => `#${idPrefix}${id}`);
      if (next !== attribute.value) element.setAttribute(attribute.name, next);
    }
    if (element instanceof HTMLTemplateElement) rewriteModelRefs(element.content, renamed, idPrefix);
  }
}

/**
 * A checagem barata da faixa: diz se o HTML pode ter atributo em tag aberta.
 * Não cita nome nem exige `=` — entidade, maiúscula, sem aspas, sem valor e
 * quebra de linha disparam; o que está dentro de código também (falso
 * positivo: só custa a passagem). Texto sem HTML e tag sem atributo
 * (`<p>`, `<table>`) não pagam o parser.
 * @param {string} html saída do `marked.parse`, ainda com PLACEHOLDERs
 * @returns {boolean} `true` quando a passagem `stripModelAttrs` vale a pena
 * @example modelAttrsPresent('<b for="x">y</b>') // true
 * @example modelAttrsPresent('<p>texto puro</p>') // false
 */
export function modelAttrsPresent(html) {
  return MODEL_ATTR_GATE.test(html);
}
