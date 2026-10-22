'use strict';

/* Atividades — o prelude de isolamento que roda antes do HTML do modelo.
   Saiu de activity-runtime.cjs na #43 fase 2. */

/* Prelude que roda ANTES de qualquer HTML/js do modelo (colocado no <head>,
   logo depois do CSP). A autoridade de isolamento vale para TODO realm, não só
   o topo:

   - iframe `srcdoc`/`about:blank` NÃO passa pelo `will-frame-navigate` do host
     (medido: o evento não dispara para esses filhos) e herda apenas a CSP, não
     este prelude. Por isso nenhum elemento criador de contexto de navegação
     (`iframe`, `frame`, `object`, `embed`, `portal`, `fencedframe`) pode entrar
     no documento: `createElement`/`createElementNS` recusam esses nomes e TODA
     inserção recusa subárvores que os contenham, mesmo vindas de DOMParser,
     cloneNode ou createElementNS de outro protótipo.
   - O HTML do modelo é embutido como string e inserido pelo host DEPOIS deste
     prelude; o sanitizador (e o Trusted Types default) remove os mesmos
     elementos e o atributo `srcdoc`.
   - WebRTC/WebTransport/mediaDevices não são cobertos pela CSP: continuam
     retirados por `Object.defineProperty` não configurável no topo, e agora
     nenhum filho escapa porque nenhum filho pode existir.
   - `trusted-types` + default policy tornam qualquer string de HTML um sink
     sanitizado, inclusive APIs que não estão na lista de patches (valor para
     KaTeX e DOM livre sem abrir mão do sanitizador).

   Tudo não configurável e não sobrescrevível; nenhum original fica acessível
   ao código do modelo. */
const DANGEROUS_TAGS = ['iframe', 'frame', 'frameset', 'object', 'embed', 'portal', 'fencedframe', 'applet'];
const LOCKDOWN_SCRIPT = `(() => {
  'use strict';
  /* Capturas antirremoção: o código do modelo roda depois deste prelude e
     pode envenenar protótipos (indexOf/toString/childNodes/getters). Todos os
     acessos internos usam as referências e accessors originais capturados
     aqui, e as gravações são não configuráveis. */
  const APPLY = Reflect.apply;
  const STRING = String;
  const TO_LOWER = String.prototype.toLowerCase;
  const STARTS_WITH = String.prototype.startsWith;
  const DOM_EXCEPTION = window.DOMException;
  const NODE_LIST_ITEM = NodeList.prototype.item;
  const DANGEROUS = ['iframe', 'frame', 'frameset', 'object', 'embed', 'portal', 'fencedframe', 'applet'];
  const proto = {Element: Element.prototype, CharacterData: CharacterData.prototype, Node: Node.prototype, Document: Document.prototype, DocumentFragment: DocumentFragment.prototype, Range: Range.prototype, ShadowRoot: typeof ShadowRoot === 'function' ? ShadowRoot.prototype : null};
  const descriptor = (target, name) => (target && Object.getOwnPropertyDescriptor(target, name)) || null;
  const GET = {
    localName: descriptor(proto.Element, 'localName'),
    nodeType: descriptor(proto.Node, 'nodeType'),
    firstChild: descriptor(proto.Node, 'firstChild'),
    nextSibling: descriptor(proto.Node, 'nextSibling'),
    parentNode: descriptor(proto.Node, 'parentNode'),
    content: window.HTMLTemplateElement ? descriptor(window.HTMLTemplateElement.prototype, 'content') : null,
    shadowRoot: descriptor(proto.Element, 'shadowRoot'),
    body: descriptor(proto.Document, 'body'),
    implementation: descriptor(proto.Document, 'implementation'),
    innerHTML: descriptor(proto.Element, 'innerHTML'),
  };
  const read = (name, node) => { const d = GET[name]; return d && d.get ? APPLY(d.get, node, []) : undefined; };
  /* createHTMLDocument original (getter de DOMImplementation) para o substituto
     sanitizado de Document.parseHTMLUnsafe; capturado antes do código do modelo. */
  const CREATE_HTML_DOCUMENT = typeof window.DOMImplementation === 'function' && window.DOMImplementation.prototype
    ? (Object.getOwnPropertyDescriptor(window.DOMImplementation.prototype, 'createHTMLDocument') || {}).value || null
    : null;
  const ORIGINAL = {
    createElement: proto.Document.createElement,
    createElementNS: proto.Document.createElementNS,
    createRange: proto.Document.createRange,
    createContextualFragment: proto.Range.createContextualFragment,
    selectNodeContents: proto.Range.selectNodeContents,
    appendChild: proto.Node.appendChild,
    insertBefore: proto.Node.insertBefore,
    replaceChild: proto.Node.replaceChild,
    removeChild: proto.Node.removeChild,
    innerHTMLGet: GET.innerHTML ? GET.innerHTML.get : null,
    insertAdjacentElement: proto.Element.insertAdjacentElement,
    replaceChildren: [],
    append: [],
    prepend: [],
    before: [],
    after: [],
    replaceWith: [],
    insertNode: proto.Range.insertNode,
    surroundContents: proto.Range.surroundContents,
    removeAttribute: proto.Element.removeAttribute,
    getAttribute: proto.Element.getAttribute,
    getAttributeNames: proto.Element.getAttributeNames,
    hasAttribute: proto.Element.hasAttribute,
  };
  for (const target of [proto.Document, proto.DocumentFragment, proto.Element]) {
    ORIGINAL.replaceChildren.push(target.replaceChildren);
    ORIGINAL.append.push(target.append);
    ORIGINAL.prepend.push(target.prepend);
  }
  ORIGINAL.before.push(proto.Element.before, proto.CharacterData.before);
  ORIGINAL.after.push(proto.Element.after, proto.CharacterData.after);
  ORIGINAL.replaceWith.push(proto.Element.replaceWith, proto.CharacterData.replaceWith);
  const dangerous = (name) => {
    const text = APPLY(TO_LOWER, STRING(name === undefined || name === null ? '' : name), []);
    for (let i = 0; i < DANGEROUS.length; i += 1) {
      if (DANGEROUS[i] === text) return true;
    }
    return false;
  };
  const hasAttr = (node) => APPLY(ORIGINAL.hasAttribute, node, ['srcdoc']);
  const shadowDeclaration = (name) => APPLY(STARTS_WITH, APPLY(TO_LOWER, STRING(name), []), ['shadowroot']);
  /* Tira srcdoc e TODA declaração shadowroot* (declarative shadow DOM) do
     elemento. Sem a declaração, nenhum parsing nativo — nem um sink inseguro
     que reapareça — cria shadow root. */
  const stripAttr = (node) => {
    if (hasAttr(node)) APPLY(ORIGINAL.removeAttribute, node, ['srcdoc']);
    if (!ORIGINAL.getAttributeNames) return;
    let names = null;
    try { names = APPLY(ORIGINAL.getAttributeNames, node, []); } catch (error) { names = null; }
    if (!names || typeof names.length !== 'number') return;
    for (let i = 0; i < names.length; i += 1) {
      if (shadowDeclaration(names[i])) APPLY(ORIGINAL.removeAttribute, node, [names[i]]);
    }
  };
  const executableScript = (node) => {
    if (STRING(read('localName', node)) !== 'script') return false;
    const type = APPLY(TO_LOWER, STRING(APPLY(ORIGINAL.getAttribute, node, ['type']) || ''), []);
    return !type || type === 'text/javascript' || type === 'application/javascript' || type === 'module' || type === 'text/ecmascript' || type === 'application/ecmascript';
  };
  /* template.content e shadow roots acessíveis NÃO aparecem na lista de filhos
     de firstChild/nextSibling; usa os getters capturados (imunes a
     envenenamento de protótipo) para descer neles. */
  const descend = (node, visit) => {
    if (read('nodeType', node) !== 1) return false;
    if (STRING(read('localName', node)) === 'template') {
      const content = read('content', node);
      if (content && visit(content)) return true;
    }
    if (GET.shadowRoot) {
      const shadow = read('shadowRoot', node);
      if (shadow && visit(shadow)) return true;
    }
    return false;
  };
  const unsafeSubtree = (node) => {
    if (!node || typeof node !== 'object') return false;
    if (read('nodeType', node) === 1) {
      if (dangerous(read('localName', node))) return true;
      stripAttr(node);
    }
    for (let child = read('firstChild', node); child; child = read('nextSibling', child)) {
      if (unsafeSubtree(child)) return true;
    }
    return descend(node, unsafeSubtree);
  };
  const cleanTree = (root) => {
    let node = read('firstChild', root);
    while (node) {
      const next = read('nextSibling', node);
      const isElement = read('nodeType', node) === 1;
      if (isElement && (dangerous(read('localName', node)) || executableScript(node))) {
        const parent = read('parentNode', node);
        if (parent) APPLY(ORIGINAL.removeChild, parent, [node]);
        else cleanTree(node);
      } else {
        if (isElement) stripAttr(node);
        cleanTree(node);
        if (isElement) descend(node, (inner) => { cleanTree(inner); return false; });
      }
      node = next;
    }
  };
  let trustedPolicy = null;
  if (window.trustedTypes && typeof window.trustedTypes.createPolicy === 'function') {
    try { trustedPolicy = window.trustedTypes.createPolicy('mesa-activity-policy', {createHTML: (value) => STRING(value)}); } catch (error) { trustedPolicy = null; }
  }
  const trusted = (text) => (trustedPolicy ? APPLY(trustedPolicy.createHTML, trustedPolicy, [text]) : text);
  /* O contexto do parser é o próprio elemento (#42): \`tr.innerHTML =
     "<td>…"\` mantém as células, como num documento comum. Só muda o modo de
     parsing; a limpeza abaixo é a mesma. */
  const parseFragment = (value, context) => {
    const text = value === undefined || value === null ? '' : STRING(value);
    const range = APPLY(ORIGINAL.createRange, document, []);
    if (context && read('nodeType', context) === 1) {
      try { APPLY(ORIGINAL.selectNodeContents, range, [context]); } catch (error) { /* contexto padrão */ }
    }
    const fragment = APPLY(ORIGINAL.createContextualFragment, range, [trusted(text)]);
    cleanTree(fragment);
    return fragment;
  };
  const sanitizeHTML = (value) => {
    try {
      const template = APPLY(ORIGINAL.createElement, document, ['template']);
      const content = read('content', template);
      APPLY(ORIGINAL.appendChild, content, [parseFragment(value)]);
      return APPLY(ORIGINAL.innerHTMLGet, template, []);
    } catch (error) { return ''; }
  };
  if (window.trustedTypes && typeof window.trustedTypes.createPolicy === 'function') {
    try { window.trustedTypes.createPolicy('default', {createHTML: sanitizeHTML}); } catch (error) { /* default já existe */ }
  }
  const guard = (fn) => function () {
    for (let i = 0; i < arguments.length; i += 1) {
      if (unsafeSubtree(arguments[i])) throw new DOM_EXCEPTION('A atividade não pode criar quadros internos.', 'NotSupportedError');
    }
    return APPLY(fn, this, arguments);
  };
  const lock = (target, name, value) => {
    if (!target || !Object.getOwnPropertyDescriptor(target, name)) return;
    try { Object.defineProperty(target, name, {value, configurable: false, writable: false}); } catch (error) { /* já fixo */ }
  };
  const blocked = (label) => function () { throw new DOM_EXCEPTION(label + ' não está disponível na atividade.', 'NotSupportedError'); };
  lock(proto.Document, 'createElement', function (tag) {
    if (typeof tag !== 'string' || dangerous(tag)) throw new DOM_EXCEPTION('A atividade não pode criar quadros internos.', 'NotSupportedError');
    return APPLY(ORIGINAL.createElement, this, arguments);
  });
  lock(proto.Document, 'createElementNS', function (ns, tag) {
    if (typeof tag !== 'string' || dangerous(tag)) throw new DOM_EXCEPTION('A atividade não pode criar quadros internos.', 'NotSupportedError');
    return APPLY(ORIGINAL.createElementNS, this, arguments);
  });
  lock(proto.Node, 'appendChild', guard(ORIGINAL.appendChild));
  lock(proto.Node, 'insertBefore', guard(ORIGINAL.insertBefore));
  lock(proto.Node, 'replaceChild', guard(ORIGINAL.replaceChild));
  for (const target of [proto.Document, proto.DocumentFragment, proto.Element]) {
    lock(target, 'replaceChildren', guard(ORIGINAL.replaceChildren.shift()));
    lock(target, 'append', guard(ORIGINAL.append.shift()));
    lock(target, 'prepend', guard(ORIGINAL.prepend.shift()));
  }
  for (const target of [proto.Element, proto.CharacterData]) {
    lock(target, 'before', guard(ORIGINAL.before.shift()));
    lock(target, 'after', guard(ORIGINAL.after.shift()));
    lock(target, 'replaceWith', guard(ORIGINAL.replaceWith.shift()));
  }
  lock(proto.Element, 'insertAdjacentElement', guard(ORIGINAL.insertAdjacentElement));
  lock(proto.Range, 'insertNode', guard(ORIGINAL.insertNode));
  lock(proto.Range, 'surroundContents', guard(ORIGINAL.surroundContents));
  const replaceContents = (target, value) => {
    const fragment = parseFragment(value, target);
    let first = read('firstChild', target);
    while (first) {
      APPLY(ORIGINAL.removeChild, target, [first]);
      first = read('firstChild', target);
    }
    APPLY(ORIGINAL.appendChild, target, [fragment]);
  };
  const setInnerHTML = function (value) {
    const isTemplate = read('nodeType', this) === 1 && read('localName', this) === 'template';
    const content = isTemplate ? read('content', this) : null;
    replaceContents(content || this, value);
  };
  const setOuterHTML = function (value) {
    const parent = read('parentNode', this);
    if (!parent) throw new DOM_EXCEPTION('Elemento sem pai não aceita outerHTML.', 'NoModificationAllowedError');
    APPLY(ORIGINAL.replaceChild, parent, [parseFragment(value), this]);
  };
  const setAdjacentHTML = function (position, value) {
    const where = APPLY(TO_LOWER, STRING(position), []);
    if (where !== 'beforebegin' && where !== 'afterbegin' && where !== 'beforeend' && where !== 'afterend') throw new DOM_EXCEPTION('Posição inválida.', 'SyntaxError');
    const fragment = parseFragment(value);
    const parent = read('parentNode', this);
    if (where === 'beforebegin') { if (!parent) throw new DOM_EXCEPTION('Elemento sem pai.', 'NoModificationAllowedError'); APPLY(ORIGINAL.insertBefore, parent, [fragment, this]); }
    else if (where === 'afterbegin') APPLY(ORIGINAL.insertBefore, this, [fragment, read('firstChild', this)]);
    else if (where === 'beforeend') APPLY(ORIGINAL.appendChild, this, [fragment]);
    else { if (!parent) throw new DOM_EXCEPTION('Elemento sem pai.', 'NoModificationAllowedError'); APPLY(ORIGINAL.insertBefore, parent, [fragment, read('nextSibling', this)]); }
  };
  const defineAccessor = (target, name, set) => {
    const current = Object.getOwnPropertyDescriptor(target, name);
    if (!current || !current.set || !current.configurable) return;
    try { Object.defineProperty(target, name, {get: current.get, set, configurable: false}); } catch (error) { /* já fixo */ }
  };
  defineAccessor(proto.Element, 'innerHTML', setInnerHTML);
  defineAccessor(proto.Element, 'outerHTML', setOuterHTML);
  defineAccessor(proto.Element, 'insertAdjacentHTML', setAdjacentHTML);
  if (proto.ShadowRoot) defineAccessor(proto.ShadowRoot, 'innerHTML', setInnerHTML);
  /* Sinks de HTML nomeados (setHTML/setHTMLUnsafe) e factories estáticas
     (Document.parseHTML/parseHTMLUnsafe): o parsing nativo de setHTMLUnsafe
     é a fábrica de declarative shadow DOM que criava um shadow root (até
     CLOSED) com iframe ANTES de qualquer travessia — substituí-lo impede a
     criação na origem, sem depender de MutationObserver. Tudo vira o
     sanitizador do prelude e continua não configurável. */
  const setSanitizedHTML = function (value) {
    const isTemplate = read('nodeType', this) === 1 && read('localName', this) === 'template';
    const content = isTemplate ? read('content', this) : null;
    replaceContents(content || this, value);
    return undefined;
  };
  for (const target of [proto.Element, proto.ShadowRoot]) {
    if (!target) continue;
    if (Object.getOwnPropertyDescriptor(target, 'setHTML')) lock(target, 'setHTML', setSanitizedHTML);
    if (Object.getOwnPropertyDescriptor(target, 'setHTMLUnsafe')) lock(target, 'setHTMLUnsafe', setSanitizedHTML);
  }
  const parseSanitizedDocument = function (value) {
    let doc = null;
    try {
      const implementation = read('implementation', document);
      if (implementation && CREATE_HTML_DOCUMENT) doc = APPLY(CREATE_HTML_DOCUMENT, implementation, ['']);
    } catch (error) { doc = null; }
    if (!doc) throw new DOM_EXCEPTION('HTML não está disponível na atividade.', 'NotSupportedError');
    const body = read('body', doc);
    if (body) replaceContents(body, value);
    return doc;
  };
  if (Object.getOwnPropertyDescriptor(Document, 'parseHTML')) lock(Document, 'parseHTML', parseSanitizedDocument);
  if (Object.getOwnPropertyDescriptor(Document, 'parseHTMLUnsafe')) lock(Document, 'parseHTMLUnsafe', parseSanitizedDocument);
  lock(proto.Document, 'write', blocked('document.write'));
  lock(proto.Document, 'writeln', blocked('document.writeln'));
  lock(proto.Document, 'open', blocked('document.open'));
  lock(proto.Document, 'close', blocked('document.close'));
  lock(proto.Document, 'execCommand', function () { return false; });
  try { Object.defineProperty(window, 'open', {value: function () { return null; }, configurable: false, writable: false}); } catch (error) { /* já bloqueado */ }
  const names = ['RTCPeerConnection', 'webkitRTCPeerConnection', 'RTCDataChannel', 'WebTransport', 'WebSocketStream'];
  for (const name of names) {
    try { Object.defineProperty(window, name, {value: undefined, configurable: false, writable: false}); } catch (error) { /* já bloqueado */ }
  }
  try { Object.defineProperty(navigator, 'mediaDevices', {value: undefined, configurable: false}); } catch (error) { /* já bloqueado */ }
  try { Object.defineProperty(navigator, 'getBattery', {value: undefined, configurable: false}); } catch (error) { /* já bloqueado */ }
  try {
    new MutationObserver((records) => {
      for (const record of records) {
        const added = record.addedNodes;
        const length = added.length;
        for (let i = 0; i < length; i += 1) {
          const node = NODE_LIST_ITEM ? APPLY(NODE_LIST_ITEM, added, [i]) : added[i];
          if (node && read('nodeType', node) === 1 && unsafeSubtree(node)) {
            const parent = read('parentNode', node);
            if (parent) APPLY(ORIGINAL.removeChild, parent, [node]);
          }
        }
      }
    }).observe(document.documentElement, {childList: true, subtree: true});
  } catch (error) { /* observer é a última linha de defesa */ }
})();`;

module.exports = {DANGEROUS_TAGS, LOCKDOWN_SCRIPT};
