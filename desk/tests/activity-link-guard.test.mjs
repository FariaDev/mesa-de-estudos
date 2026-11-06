import test from 'node:test';
import assert from 'node:assert/strict';
import {loadActivityLockdown} from './fake-lockdown-dom.mjs';

/* Guarda de `link` do prelude: o próprio nó não entra por nenhum sink de
   inserção — o MutationObserver só tiraria depois (tarde para a dica de DNS)
   e não vê shadow root. O nó com link dentro continua limpo antes de inserir
   (inclusive template.content e shadow descendente, como `descend` já faz). */

function freshBox(document) {
  const box = document.createElement('div');
  document.body.appendChild(box);
  return box;
}

test('link como argumento não conecta: appendChild/insertBefore/replaceChild', () => {
  const {document, mintLink} = loadActivityLockdown();
  const direct = mintLink();
  const returned = document.body.appendChild(direct);
  assert.equal(returned, direct);
  assert.equal(direct.isConnected, false, 'appendChild de link vira no-op');

  const other = mintLink();
  const ref = document.createElement('span');
  document.body.appendChild(ref);
  const beforeRet = document.body.insertBefore(other, ref);
  assert.equal(beforeRet, other);
  assert.equal(other.isConnected, false, 'insertBefore de link vira no-op');
  assert.equal(ref.isConnected, true, 'a referência continua no lugar');

  const next = mintLink();
  const old = document.createElement('span');
  document.body.appendChild(old);
  const replaced = document.body.replaceChild(next, old);
  assert.equal(replaced, old);
  assert.equal(old.isConnected, true, 'replaceChild de link não troca nada');
  assert.equal(next.isConnected, false, 'o link não entra no lugar do antigo');
});

test('link como argumento não conecta: sinks variádicos e de posição', () => {
  const {document, mintLink} = loadActivityLockdown();
  const box = freshBox(document);
  box.append(mintLink());
  box.prepend(mintLink());
  assert.equal(box.childNodes.length, 0, 'append/prepend de link não inserem nada');

  const mixed = document.createElement('i');
  box.append('texto', mintLink(), mixed);
  assert.equal(box.childNodes.length, 2, 'só o link cai da lista; texto e elemento entram');
  assert.equal(mixed.isConnected, true);

  const target = document.createElement('span');
  box.appendChild(target);
  target.before(mintLink());
  target.after(mintLink());
  assert.equal(target.isConnected, true);
  assert.deepEqual(box.childNodes.filter((node) => node.localName === 'link'), [], 'before/after de link não inserem nada');

  const victim = document.createElement('span');
  box.appendChild(victim);
  victim.replaceWith(mintLink());
  assert.equal(victim.isConnected, true, 'replaceWith de link vira no-op em vez de remover o alvo');

  const keeper = document.createElement('b');
  box.appendChild(keeper);
  box.replaceChildren(mintLink());
  assert.equal(keeper.isConnected, true, 'replaceChildren só de link não limpa a caixa');
  assert.equal(box.childNodes.includes(keeper), true);

  const anchor = document.createElement('u');
  box.appendChild(anchor);
  const adjacent = mintLink();
  anchor.insertAdjacentElement('afterend', adjacent);
  assert.equal(adjacent.isConnected, false, 'insertAdjacentElement de link vira no-op');
});

test('link como argumento não conecta: Range e nós de texto', () => {
  const {document, mintLink} = loadActivityLockdown();
  const box = freshBox(document);
  const range = document.createRange();
  range.selectNodeContents(box);
  range.insertNode(mintLink());
  range.surroundContents(mintLink());
  assert.equal(box.childNodes.length, 0, 'Range não insere link');

  const text = document.createElement('span');
  box.appendChild(text);
  text.before(mintLink());
  text.after(mintLink());
  assert.deepEqual(box.childNodes.filter((node) => node.localName === 'link'), []);
});

test('nó com link dentro continua limpo antes de inserir (fragment, template, shadow)', () => {
  const {document, mintLink, graft, FakeElement, FakeFragment} = loadActivityLockdown();
  const box = freshBox(document);
  const linksLeft = (root) => {
    const found = [];
    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child.localName === 'link') found.push(child);
        walk(child);
      }
      if (node.shadowRoot) walk(node.shadowRoot);
    };
    walk(root);
    return found;
  };

  /* Fragmento com link no meio: o link sai, o resto entra. */
  const fragment = new FakeFragment();
  const paragraph = new FakeElement('p');
  graft(paragraph, mintLink());
  graft(fragment, paragraph);
  graft(fragment, mintLink());
  box.appendChild(fragment);
  assert.deepEqual(linksLeft(box), [], 'links dentro do fragmento saem antes de inserir');
  assert.equal(paragraph.isConnected, true, 'o resto do fragmento entra');

  /* template.content com link: limpo ao inserir o template. */
  const template = document.createElement('template');
  graft(template.content, mintLink());
  box.appendChild(template);
  assert.deepEqual(linksLeft(box), [], 'link em template.content sai antes de inserir');

  /* Shadow root descendente com link: limpo ao inserir o hospedeiro. */
  const host = document.createElement('section');
  const shadow = host.attachShadow();
  graft(shadow, mintLink());
  const keeper = new FakeElement('p');
  graft(shadow, keeper);
  box.appendChild(host);
  assert.deepEqual(linksLeft(box), [], 'link em shadow descendente sai antes de inserir');
  assert.equal(keeper.isConnected, false, 'o falso não compõe shadow na conexão; o guardião é a ausência de links');
  assert.equal(shadow.childNodes.includes(keeper), true, 'o resto da shadow entra');
});
