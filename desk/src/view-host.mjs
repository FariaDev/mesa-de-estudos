export const EVENTS = new Set([
  'click', 'dblclick', 'input', 'change', 'submit', 'keydown', 'keyup', 'keypress',
  'focus', 'blur', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'mouseenter',
  'mouseleave', 'scroll',
]);

/* Aplicador fino de DOM para as árvores do `core/view.bend`.
   Sem diff: monta um fragmento e troca o conteúdo do pai (`replaceChildren`).
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
    const name = el.dataset.icon, label = el.textContent;
    el.removeAttribute('data-icon');
    el.innerHTML = icon(name) + (label ? ` <span>${label}</span>` : '');
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
  if (node.$ === 'ViewText') return document.createTextNode(String(node.text ?? ''));
  const el = document.createElement(String(node.tag || 'div'));
  const applied = new Set();
  for (let attr = node.attrs; attr && attr.$ === 'Con'; attr = attr.tail) {
    const {name, value} = attr.head;
    const key = String(name ?? '');
    const val = String(value ?? '');
    if (applied.has(key)) continue; // primeiro attr com o nome vence
    applied.add(key);
    if (key === 'key') {
      if (val) el.dataset.key = val;
      continue;
    }
    if (key.startsWith('on:')) {
      const event = key.slice(3);
      const handler = handlers[val];
      if (handler && EVENTS.has(event)) el.addEventListener(event, handler);
      continue;
    }
    if (!val && (key === 'class' || key === 'id')) continue;
    el.setAttribute(key, val);
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
