import test from 'node:test';
import assert from 'node:assert/strict';
import {decideEscape, stopsTutor, collectEscapeFacts} from '../src/escape-policy.mjs';

/* Política do Esc: o núcleo Bend decide a PRIMEIRA camada aberta, na ordem
   modal → paleta → menu → popover → citação → busca → tutor. As leis do
   `core/laws/mesaqolescape.bend` fixam a ordem; aqui a tabela é conferida
   exaustivamente (2^7) contra a MESMA ordem escrita à mão — se alguém trocar a
   precedência no Bend sem combinar, este teste cai. */

const LAYERS = ['dialog', 'palette', 'menu', 'popover', 'citation', 'search'];
const EXPECTED = ['modal', 'palette', 'menu', 'popover', 'citation', 'search'];

function expectedFor(facts) {
  for (let i = 0; i < LAYERS.length; i++) {
    if (facts[LAYERS[i]]) return EXPECTED[i];
  }
  return facts.tutor ? 'tutor' : 'none';
}

test('exaustivo: 2^7 combinações seguem a precedência do núcleo', () => {
  for (let mask = 0; mask < 128; mask++) {
    const facts = {};
    for (let i = 0; i < LAYERS.length; i++) {
      facts[LAYERS[i]] = (mask >> i) & 1 ? true : false;
    }
    facts.tutor = (mask >> 6) & 1 ? true : false;
    const got = decideEscape(facts);
    assert.equal(got, expectedFor(facts), `mask=${mask} fatos=${JSON.stringify(facts)}`);
  }
});

test('fechar camada vence o cancelamento do tutor', () => {
  assert.equal(decideEscape({menu: true, tutor: true}), 'menu');
  assert.equal(decideEscape({search: true, tutor: true}), 'search');
  assert.equal(decideEscape({popover: true, tutor: true}), 'popover');
  assert.equal(decideEscape({citation: true, tutor: true}), 'citation');
  assert.equal(decideEscape({palette: true, tutor: true}), 'palette');
});

test('modal nativo fecha sem tocar no turno', () => {
  assert.equal(decideEscape({dialog: true, menu: true, tutor: true}), 'modal');
});

test('tutor só para com nada dismissível aberto', () => {
  assert.equal(decideEscape({tutor: true}), 'tutor');
  assert.equal(decideEscape({}), 'none');
  assert.equal(decideEscape(), 'none');
});

test('só a ação tutor cancela o turno', () => {
  for (const action of ['modal', 'palette', 'menu', 'popover', 'citation', 'search', 'none']) {
    assert.equal(stopsTutor(action), false, action);
  }
  assert.equal(stopsTutor('tutor'), true);
});

/* ---------- leitura dos fatos no DOM/estado ---------- */

const SELECTORS = {
  'dialog[open]': 'dialog',
  '#command-palette:not([hidden])': 'palette',
  '#course-menu.open, #study-menu.open, #settings-menu.open': 'menu',
  '#context-pop:not([hidden])': 'contextpop',
  '#phone-pop:not([hidden])': 'phonepop',
  '#check-note:not([hidden])': 'checknote',
  '#free-more-pop:not([hidden])': 'freemore',
  '#conversations-pop:not([hidden])': 'conversations',
  '#new-session-pop:not([hidden])': 'newsession',
  '#chat-more-pop:not([hidden])': 'chatmore',
  '#model-pop:not([hidden])': 'modelpop',
  '#sidechat-more-pop:not([hidden])': 'sidechatmore',
  '#sidechat-context-pop:not([hidden])': 'sidechat',
  '.pdf-nav-pop:not([hidden])': 'navpop',
  '.pdf-more-pop:not([hidden])': 'morepop',
  '#quote-btn:not([hidden])': 'quote',
  '.pdf-find:not([hidden])': 'find',
};

function fakeDoc(present = []) {
  const found = new Set(present);
  return {
    calls: [],
    querySelector(selector) {
      this.calls.push(selector);
      const key = SELECTORS[selector];
      if (key === undefined) throw Error(`seletor inesperado: ${selector}`);
      return found.has(key) ? {} : null;
    },
  };
}

test('collector mapeia cada camada ao seu seletor exato', () => {
  const doc = fakeDoc(['dialog', 'palette', 'menu', 'contextpop', 'sidechat', 'quote', 'find']);
  const facts = collectEscapeFacts(doc, {busy: true, panels: []});
  assert.deepEqual(facts, {
    dialog: true,
    palette: true,
    menu: true,
    popover: true,
    citation: true,
    search: true,
    tutor: true,
  });
});

test('o menu Mais opções do leitor aberto conta como popover (Esc fecha e não cancela o turno)', () => {
  const facts = collectEscapeFacts(fakeDoc(['morepop']), {busy: true, panels: []});
  assert.equal(facts.popover, true);
  assert.equal(decideEscape(facts), 'popover');
  assert.equal(stopsTutor(decideEscape(facts)), false);
});

test('o seletor de janela do Conferir aberto conta como popover (Esc fecha e não cancela o turno)', () => {
  const facts = collectEscapeFacts(fakeDoc(['checknote']), {busy: true, panels: []});
  assert.equal(facts.popover, true);
  assert.equal(decideEscape(facts), 'popover');
});

test('o menu Mais opções da aba Livre aberto conta como popover (Esc fecha e não cancela o turno)', () => {
  const facts = collectEscapeFacts(fakeDoc(['freemore']), {busy: true, panels: []});
  assert.equal(facts.popover, true);
  assert.equal(decideEscape(facts), 'popover');
  assert.equal(stopsTutor(decideEscape(facts)), false);
});

test('os menus do cabeçalho do tutor abertos contam como popover (Esc fecha e não cancela o turno)', () => {
  for (const key of ['newsession', 'chatmore', 'conversations', 'modelpop']) {
    const facts = collectEscapeFacts(fakeDoc([key]), {busy: true, panels: []});
    assert.equal(facts.popover, true, key);
    assert.equal(stopsTutor(decideEscape(facts)), false, key);
  }
});

/* Regressão da #36: o popover da Foto do celular fecha no Esc sem cancelar o turno. */
test('o popover da Foto do celular aberto conta como popover (Esc fecha e não cancela o turno)', () => {
  const facts = collectEscapeFacts(fakeDoc(['phonepop']), {busy: true, panels: []});
  assert.equal(facts.popover, true);
  assert.equal(decideEscape(facts), 'popover');
  assert.equal(stopsTutor(decideEscape(facts)), false);
});

test('o menu Mais opções do chat lateral aberto conta como popover (Esc fecha e não cancela o turno)', () => {
  const facts = collectEscapeFacts(fakeDoc(['sidechatmore']), {busy: true, panels: []});
  assert.equal(facts.popover, true);
  assert.equal(stopsTutor(decideEscape(facts)), false);
});

test('collector falso quando nada está aberto e o turno está livre', () => {
  const facts = collectEscapeFacts(fakeDoc(), {busy: false, panels: []});
  assert.deepEqual(facts, {
    dialog: false,
    palette: false,
    menu: false,
    popover: false,
    citation: false,
    search: false,
    tutor: false,
  });
});

test('termo ativo em qualquer leitor conta como busca aberta', () => {
  const facts = collectEscapeFacts(fakeDoc(), {busy: false, panels: [{findTerm: ''}, {findTerm: 'integral'}]});
  assert.equal(facts.search, true);
});

test('a decisão sobre os fatos lidos é a mesma do núcleo', () => {
  const doc = fakeDoc(['menu']);
  const facts = collectEscapeFacts(doc, {busy: true, panels: []});
  assert.equal(decideEscape(facts), 'menu');
});
