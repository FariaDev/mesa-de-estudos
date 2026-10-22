import test from 'node:test';
import assert from 'node:assert/strict';
import noticeCore from '../src/generated/updatenotice.core.js';
import {ptText} from './pt-text.mjs';

/* Onde a linha de aviso mora (#52): no Sobre e nas Configurações. A decisão é
   do núcleo (`core/updatenotice.bend`); aqui só se confere o que chega ao host. */
const Nil = {$: 'Nil'};
const list = (xs) => xs.reduceRight((tail, head) => ({$: 'Con', head, tail}), Nil);
const array = (cons) => (cons.$ === 'Nil' ? [] : [cons.head, ...array(cons.tail)]);
const About = {$: 'About'};
const Settings = {$: 'Settings'};
const line = (id, name, version, ahead = false) => ({$: 'NoticeLine', id, name, version, ahead});

function walk(node, visit) {
  visit(node);
  if (node.$ === 'ViewEl') for (const kid of array(node.kids)) walk(kid, visit);
}
const textOf = (node) => { let text = ''; walk(node, (n) => { if (n.$ === 'ViewText') text += ptText(n.text); }); return text; };
const buttonsOf = (node) => { const found = []; walk(node, (n) => { if (n.$ === 'ViewEl' && n.tag === 'button') found.push(n); }); return found; };

test('seesLine: ver o Sobre ou as Configurações com linha à vista apaga o ponto; sem linha, não', () => {
  assert.equal(noticeCore.seesLine(About, true), true);
  assert.equal(noticeCore.seesLine(Settings, true), true);
  assert.equal(noticeCore.seesLine(About, false), false);
  assert.equal(noticeCore.seesLine(Settings, false), false);
});

test('as Configurações mostram o mesmo texto da linha do Sobre e acrescentam "Ver no Sobre"', () => {
  const [about] = array(noticeCore.noticeLinesFor(About, list([line('pi', 'Pi', '1.3.0')])));
  const [settings] = array(noticeCore.noticeLinesFor(Settings, list([line('pi', 'Pi', '1.3.0')])));
  assert.match(textOf(about), /Pi 1\.3\.0 disponível/);
  assert.match(textOf(settings), /Pi 1\.3\.0 disponível/);
  const aboutLabels = buttonsOf(about).map(textOf);
  const settingsLabels = buttonsOf(settings).map(textOf);
  assert.ok(!aboutLabels.includes('Ver no Sobre'), `o Sobre já é o Sobre (${aboutLabels})`);
  assert.deepEqual(settingsLabels, ['Ver no Sobre', ...aboutLabels], 'as Configurações levam ao Sobre e mantêm as ações da linha');
});

test('uma linha por aviso, na ordem recebida, nas duas superfícies', () => {
  const facts = list([line('pi', 'Pi', '1.3.0'), line('claude', 'Claude Code', '2.1.301', true)]);
  for (const surface of [About, Settings]) {
    const nodes = array(noticeCore.noticeLinesFor(surface, facts));
    assert.equal(nodes.length, 2, `${surface.$}: duas linhas`);
    assert.match(textOf(nodes[1]), /Claude Code 2\.1\.301 disponível · mais nova que a testada/);
  }
  assert.deepEqual(array(noticeCore.noticeLinesFor(Settings, Nil)), [], 'sem aviso, sem linha');
});
