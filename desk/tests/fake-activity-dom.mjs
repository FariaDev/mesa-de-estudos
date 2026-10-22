// DOM mínimo para montar o host do quadro de atividade no node (#43 fase 2):
// só o que createActivityHost toca ao ligar e desligar.

/** Elemento falso: aceita atributos, classes e filhos sem renderizar nada. */
export function fakeElement(tag = 'div') {
  return {tagName: tag.toUpperCase(), dataset: {}, style: {}, textContent: '', children: [],
    classList: {add() {}, remove() {}, contains() { return false; }, toggle() {}},
    append(...nodes) { this.children.push(...nodes); }, appendChild(node) { this.children.push(node); return node; },
    setAttribute() {}, removeAttribute() {}, addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; }};
}

/** Documento falso que registra os eventos ligados e desligados. */
export function fakeActivityDocument({theme = 'dark'} = {}) {
  const added = [];
  const removed = [];
  return {added, removed, documentElement: {dataset: {theme}}, body: fakeElement('body'),
    querySelector: () => null, querySelectorAll: () => [], createElement: fakeElement,
    addEventListener: (type) => added.push(type), removeEventListener: (type) => removed.push(type)};
}

/** window falso com matchMedia e eventos que só contam. */
export function fakeActivityWindow() {
  const added = [];
  return {added, addEventListener: (type) => added.push(type), removeEventListener() {}, matchMedia: () => ({matches: false})};
}
