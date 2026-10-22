import test from 'node:test';
import assert from 'node:assert/strict';

/* Contrato do artefato `conferir.core.js` (gerado de core/conferir.bend,
   ticket #35): o que o app recebe do núcleo — decisão, rótulos e a árvore do
   seletor — com a lista no formato que o host monta. As leis ficam em
   core/laws/conferir.bend. */
const core = (await import('../src/generated/conferir.core.js')).default;
const {ptText, enText} = await import('./pt-text.mjs');

const list = items => items.reduceRight((tail, head) => ({$: 'Con', head, tail}), {$: 'Nil'});
const w = (id, app, title = '', over = {}) => ({$: 'ConfWin', id, app, key: app.toLowerCase(), title, usable: true, self: false, ...over});
const some = (app, key = app.toLowerCase()) => ({$: 'Some', value: {app, key}});
const none = {$: 'None'};

test('sem escolha: o Xournal++, em qualquer grafia', () => {
  const d = core.decide(list([w('1', 'Safari'), w('2', 'xournalpp', 'Prova')]), none);
  assert.equal(d.$, 'ConfCapture');
  assert.equal(d.id, '2');
  assert.equal(d.app, 'Xournal++');
});

test('com escolha ausente: ConfAbsent, nunca outra janela', () => {
  const d = core.decide(list([w('1', 'Safari'), w('2', 'Xournal++')]), some('OneNote'));
  assert.deepEqual({kind: d.$, app: d.app, saved: d.saved}, {kind: 'ConfAbsent', app: 'OneNote', saved: true});
});

test('a janela da frente vence; a Mesa, o sistema e a janela minúscula nunca entram', () => {
  const xs = list([
    w('1', 'OneNote', 'própria', {self: true}),
    w('2', 'OneNote', 'minúscula', {usable: false}),
    w('3', 'Dock'),
    w('4', 'OneNote', 'frente'),
    w('5', 'OneNote', 'atrás'),
  ]);
  const d = core.decide(xs, some('OneNote'));
  assert.equal(d.id, '4');
});

test('rótulos: o botão nomeia o app; o padrão mantém a redação de sempre', () => {
  assert.equal(ptText(core.buttonLabel('OneNote')), 'Conferir OneNote');
  assert.equal(ptText(core.buttonLabel('Xournal++')), 'Conferir Xournal++');
  assert.equal(ptText(core.attachedText('Xournal++')), 'Captura do Xournal++ anexada — escreva e envie.');
  assert.equal(ptText(core.attachedText('OneNote')), 'Captura de OneNote anexada — escreva e envie.');
  assert.match(ptText(core.buttonHint('OneNote', '⌘⇧C')), /janela de OneNote \(⌘⇧C\)/);
  assert.match(ptText(core.buttonHint('Xournal++', '⌘⇧C')), /captura do Xournal\+\+ à mensagem/);
});

function walk(node, visit) {
  visit(node);
  for (let c = node.kids; c && c.$ === 'Con'; c = c.tail) walk(c.head, visit);
}
const attr = (node, name) => { for (let a = node.attrs; a && a.$ === 'Con'; a = a.tail) if ('' + a.head.name === name) return a.head; return null; };

test('o seletor: uma linha por janela elegível, com o id na chave e a ação Pick', () => {
  const tree = core.listView('Escolha.', list([w('9', 'OneNote', 'Notas'), w('8', 'Dock'), w('7', 'Safari', '  ')]));
  const rows = [];
  walk(tree, n => { if (n.tag === 'button' && attr(n, 'class')?.value === 'check-row') rows.push(n); });
  assert.equal(rows.length, 2, 'o Dock ficou de fora');
  assert.equal(JSON.stringify(rows[0]).includes('"9"'), true, 'o id da janela viaja na chave');
  const labelOf = (row, translate) => { const out = []; walk(row, n => { if (n.$ === 'ViewText') out.push(translate(n.text)); }); return out.join(' '); };
  assert.equal(labelOf(rows[1], ptText).includes('Janela sem título'), true, 'título em branco ganha rótulo');
  assert.equal(labelOf(rows[1], enText).includes('Untitled window'), true, 'e o rótulo segue o idioma');
});

test('a lista sem janelas diz o que fazer', () => {
  const text = tree => { const out = []; walk(tree, n => { if (n.$ === 'ViewText') out.push(ptText(n.text)); }); return out.join(' | '); };
  assert.match(text(core.listView('Lead.', list([]))), /Nenhuma outra janela aberta/);
});

test('o campo das Configurações: programa de agora, Escolher… e "Voltar ao Xournal++" só com escolha salva (#38)', () => {
  const text = tree => { const out = []; walk(tree, n => { if (n.$ === 'ViewText') out.push(ptText(n.text)); }); return out.join(' | '); };
  const none = core.fieldView('Xournal++', false, true);
  assert.match(text(none), /Programa de escrita \| Xournal\+\+ \| Escolher… \| Voltar ao Xournal\+\+ \| Abra o programa e clique em Escolher…/);
  let back = null;
  walk(none, n => { if (attr(n, 'class')?.value === 'cfg-conferir-back') back = attr(n, 'hidden'); });
  assert.ok(back, 'sem escolha, o Voltar nasce escondido');
  let shown = 'x';
  walk(core.fieldView('OneNote', true, true), n => { if (attr(n, 'class')?.value === 'cfg-conferir-back') shown = attr(n, 'hidden'); });
  assert.equal(shown, null, 'com escolha, o Voltar aparece');
  assert.match(text(core.fieldView('Xournal++', false, false)), /A captura de janela não está disponível/);
});

test('app ausente: a frase e a ação "Escolher outro programa…" (#38)', () => {
  const text = tree => { const out = []; walk(tree, n => { if (n.$ === 'ViewText') out.push(ptText(n.text)); }); return out.join(' | '); };
  assert.equal(text(core.absentView('OneNote', true)), 'OneNote não está aberto (ou está minimizado) neste desktop. | Escolher outro programa…');
  assert.match(text(core.absentView('Xournal++', false)), /^Abra a resolução no Xournal\+\+/);
  assert.equal(ptText(core.absentLead('OneNote', true)), 'OneNote não está aberto (ou está minimizado) neste desktop.');
});
