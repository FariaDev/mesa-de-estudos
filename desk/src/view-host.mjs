import {text} from './ui-text.mjs';
import {parseMessage} from './i18n.mjs';

export const EVENTS = new Set([
  'click', 'dblclick', 'input', 'change', 'submit', 'keydown', 'keyup', 'keypress',
  'focus', 'blur', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'mouseenter',
  'mouseleave', 'scroll',
]);

/* Aplicador fino de DOM para as árvores do `core/view.bend`.
   Sem diff: monta um fragmento e troca o conteúdo do pai (`replaceChildren`);
   quem re-renderiza a cada token usa `patchTree` (#70).
   Convenções (as mesmas do núcleo):
   - ViewText{text} → nó de texto;
   - ViewEl{tag, attrs, kids};
   - primeiro attr de cada nome vence (igual ao `attrGet` do núcleo):
     duplicata é ignorada, inclusive `on:<evento>`, que pendura no máximo
     um listener por evento;
   - attr `on:<evento>` → listener `handlers[value]` (só eventos da lista);
   - attr `key` → `dataset.key` (identidade para re-render/foco);
   - `class`/`id` vazios são pulados; o resto vira setAttribute;
   - { $:'Html', html } (extensão do host) → innerHTML: markdown/KaTeX
     continuam com o host (chat.mjs), nunca com o Bend. */
export function htmlNode(html) {
  return {$: 'Html', html: String(html ?? '')};
}

/* Andaime `data-icon` do núcleo vira SVG do host (mesma convenção do main.mjs).
   Inclui o próprio root: o `swapInto` do botão de colapsar passa o botão (e não
   o painel) e `querySelectorAll` não enxerga o elemento raiz. */
export function applyIcons(root, icon) {
  const targets = root.matches?.('[data-icon]') ? [root, ...root.querySelectorAll('[data-icon]')] : [...root.querySelectorAll('[data-icon]')];
  for (const el of targets) {
    const name = el.dataset.icon, label = el.textContent, kept = [...el.childNodes];
    el.removeAttribute('data-icon');
    el.innerHTML = icon(name);
    if (!label) continue;
    /* Os nós de texto originais mudam de lugar em vez de virar cópia: é neles que
       `retranslateTree` (#41) guarda a mensagem de origem, e o item de menu com
       ícone ficaria na língua antiga depois da troca. */
    const span = document.createElement('span');
    span.append(...kept);
    el.append(' ', span);
  }
}

/* Texto e atributo que vieram de mensagem do núcleo guardam a mensagem de origem:
   na troca de idioma (#41) `retranslateTree` os refaz sem montar a tela de novo
   (leitores de PDF, notas, rodapés). Só vale enquanto o nó ainda mostra o que o
   `build` escreveu; texto que o host reescreveu depois fica como está. */
const textSources = new WeakMap();
const attrSources = new WeakMap();
/* Os eventos ligados por `build` em cada elemento ("click=toggle;…"): o
   `patchTree` só mantém o nó vivo quando são os mesmos (#70: o cabeçalho do
   diário ganha o clique quando o turno acaba e o nó antigo ficava surdo). */
const boundEvents = new WeakMap();

function translated(raw) {
  const shown = text(raw);
  return {shown, tracked: parseMessage(raw) !== null};
}

function rememberAttr(el, name, raw, shown) {
  const known = attrSources.get(el) ?? new Map();
  known.set(name, {raw, shown});
  attrSources.set(el, known);
}

/** Refaz no idioma atual o texto e os atributos de `root` que o `build` traduziu.
 * @param {ParentNode} [root] */
export function retranslateTree(root = document) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const source = textSources.get(node);
    if (!source || node.nodeValue !== source.shown) continue;
    source.shown = text(source.raw);
    node.nodeValue = source.shown;
  }
  const elements = root.nodeType === 1 ? [root, ...root.querySelectorAll('*')] : root.querySelectorAll('*');
  for (const el of elements) {
    for (const [name, source] of attrSources.get(el) ?? []) {
      if (el.getAttribute(name) !== source.shown) continue;
      source.shown = text(source.raw);
      el.setAttribute(name, source.shown);
    }
  }
}

export function childrenOf(node) {
  const out = [];
  for (let current = node; current && current.$ === 'Con'; current = current.tail) out.push(current.head);
  return out;
}

export function build(node, handlers = {}) {
  if (!node) return document.createTextNode('');
  if (node.$ === 'Html') {
    const holder = document.createElement('div');
    holder.innerHTML = node.html;
    const frag = document.createDocumentFragment();
    while (holder.firstChild) frag.append(holder.firstChild);
    return frag;
  }
  if (node.$ === 'ViewText') {
    const raw = String(node.text ?? '');
    const {shown, tracked} = translated(raw);
    const textNode = document.createTextNode(shown);
    if (tracked) textSources.set(textNode, {raw, shown});
    return textNode;
  }
  const el = document.createElement(String(node.tag || 'div'));
  const applied = new Set();
  for (let attr = node.attrs; attr && attr.$ === 'Con'; attr = attr.tail) {
    const {name, value} = attr.head;
    const key = String(name ?? '');
    const raw = String(value ?? '');
    const {shown: val, tracked} = translated(raw);
    if (applied.has(key)) continue; // primeiro attr com o nome vence
    applied.add(key);
    if (key === 'key') {
      if (val) el.dataset.key = val;
      continue;
    }
    if (key.startsWith('on:')) {
      const event = key.slice(3);
      const handler = handlers[val];
      if (handler && EVENTS.has(event)) {
        el.addEventListener(event, handler);
        boundEvents.set(el, `${boundEvents.get(el) || ''}${event}=${val};`);
      }
      continue;
    }
    if (!val && (key === 'class' || key === 'id')) continue;
    el.setAttribute(key, val);
    if (tracked) rememberAttr(el, key, raw, val);
  }
  for (const kid of childrenOf(node.kids)) el.append(build(kid, handlers));
  return el;
}

/* Troca todo o conteúdo do pai pela árvore. */
export function renderInto(parent, node, handlers = {}) {
  const frag = document.createDocumentFragment();
  frag.append(build(node, handlers));
  parent.replaceChildren(frag);
  return parent;
}

/* Troca o conteúdo do pai por uma lista de nós (Bend Con/Nil ou array JS). */
export function renderChildren(parent, nodes, handlers = {}) {
  const list = Array.isArray(nodes) ? nodes : childrenOf(nodes);
  const frag = document.createDocumentFragment();
  for (const node of list) frag.append(build(node, handlers));
  parent.replaceChildren(frag);
  return parent;
}

/**
 * Leva `fresh` (recém-montado por `build`) para dentro de `live` sem trocar os
 * nós que continuam do mesmo tipo: atributos e texto mudam no lugar, e só o que
 * mudou de tag ou de `data-key` é substituído. Assim o "pensando" do tutor não
 * reinicia a animação nem pisca o raciocínio a cada token (#70). Os listeners
 * do nó que fica são os do primeiro `build`; nó com outros eventos é trocado,
 * e serve para quem monta sempre com os mesmos handlers. `keep(live, fresh)` true mantém os filhos de `live`.
 * @param {Element} live @param {Element} fresh
 * @param {(live: Element, fresh: Element) => boolean} [keep]
 * @example patchTree(article, build(core.workLog(row), handlers))
 */
export function patchTree(live, fresh, keep = () => false) {
  const kept = keep(live, fresh);
  syncAttributes(live, fresh);
  if (kept) return;
  const next = [...fresh.childNodes];
  next.forEach((node, index) => patchChild(live, live.childNodes[index], node, keep));
  while (live.childNodes.length > next.length) live.lastChild.remove();
}

function patchChild(parent, current, node, keep) {
  if (!current) return parent.append(node);
  if (!sameShape(current, node)) return current.replaceWith(node);
  if (node.nodeType === 1) return patchTree(current, node, keep);
  if (current.nodeValue !== node.nodeValue) current.nodeValue = node.nodeValue;
  adoptSource(textSources, current, node);
}

function sameShape(current, node) {
  if (current.nodeType !== node.nodeType || current.nodeName !== node.nodeName) return false;
  if (node.nodeType !== 1 && node.nodeType !== 3) return false;
  if (node.nodeType === 3) return true;
  return (current.dataset.key || '') === (node.dataset.key || '') && (boundEvents.get(current) || '') === (boundEvents.get(node) || '');
}

function syncAttributes(live, fresh) {
  for (const name of live.getAttributeNames()) {
    if (!fresh.hasAttribute(name)) live.removeAttribute(name);
  }
  for (const name of fresh.getAttributeNames()) {
    const value = fresh.getAttribute(name);
    if (live.getAttribute(name) !== value) live.setAttribute(name, value);
  }
  adoptSource(attrSources, live, fresh);
}

/* O nó que fica herda a mensagem de origem do recém-montado, para a troca de
   idioma (`retranslateTree`) continuar valendo depois do patch. */
function adoptSource(sources, live, fresh) {
  if (sources.has(fresh)) sources.set(live, sources.get(fresh));
  else sources.delete(live);
}

/* Preserva foco (por key/id) e seleção do campo focado em volta de um render. */
export function preserveFocus(parent, fn) {
  const active = typeof document !== 'undefined' ? document.activeElement : null;
  const inside = active && parent.contains(active);
  const id = inside ? active.dataset?.key || active.id : '';
  const start = inside && typeof active.selectionStart === 'number' ? active.selectionStart : null;
  const end = inside && typeof active.selectionEnd === 'number' ? active.selectionEnd : null;
  fn();
  if (!id) return;
  const next = parent.querySelector(`[data-key="${CSS.escape(id)}"]`) || parent.querySelector(`#${CSS.escape(id)}`);
  if (!next || typeof next.focus !== 'function') return;
  next.focus();
  if (start != null) {
    try { next.setSelectionRange(start, end); } catch {}
  }
}

/* Preserva a rolagem de um contêiner em volta de um render. */
export function preserveScroll(scroller, fn) {
  const top = scroller?.scrollTop;
  const left = scroller?.scrollLeft;
  fn();
  if (!scroller) return;
  if (top != null) scroller.scrollTop = top;
  if (left != null) scroller.scrollLeft = left;
}
