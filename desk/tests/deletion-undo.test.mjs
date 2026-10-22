/* Registry de tokens do Desfazer (`desk/deletion-undo.cjs`) com o núcleo real
 * (`core/undoview.bend`) — o mecanismo que os dois domínios compartilham.
 *
 * Prova o que o backend promete: token opaco curto, prazo do host (o relógio do
 * aviso não consome), escopo errado recusado SEM consumir, material bloqueado
 * recusado SEM consumir, sucesso consumido (não desfaz duas vezes), token
 * inventado recusado e reinserção clampada sem duplicar identidade. */

import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {useUndoviewCore} from './undo-core-build.mjs';
import {ptText} from './pt-text.mjs';

useUndoviewCore();
const require = createRequire(import.meta.url);
const deletionUndo = require('../deletion-undo.cjs');

const store = () => deletionUndo.createUndoStore();

test('verificar sem commit permite retry e continua conferindo escopo e prazo', () => {
  const undo = store();
  const issued = undo.issue({scopeKey: 'A', item: {id: 'n-1'}, at: 1000});
  const query = {token: issued.token, scopeKey: 'A', at: 1100};
  assert.equal(undo.check(query).ok, true);
  assert.equal(undo.check({...query, scopeKey: 'B'}).reason, 'scope');
  assert.equal(undo.check({...query, authorized: false}).reason, 'unauthorized');
  assert.equal(undo.check(query).ok, true);
  undo.commit(issued.token);
  assert.equal(undo.check(query).reason, 'unknown');
  const expired = undo.issue({scopeKey: 'A', item: {}, at: 1000});
  assert.equal(undo.check({...query, token: expired.token}).ok, true);
  assert.equal(undo.check({...query, token: expired.token, at: expired.expiresAt}).reason, 'expired');
});

test('emite token opaco curto com prazo e devolve o item ORIGINAL uma única vez', () => {
  const undo = store();
  const item = {id: 'n-1', note: 'guardada'};
  const issued = undo.issue({kind: 'note', scopeKey: 'Calculo', item, index: 2, at: 1000});
  assert.equal(typeof issued.token, 'string');
  assert.ok(issued.token.length >= 8 && issued.token.length <= 64, 'token curto e dentro do teto');
  assert.equal(issued.expiresAt, 1000 + deletionUndo.ttlMs());
  const taken = undo.take({token: issued.token, scopeKey: 'Calculo', at: 1500});
  assert.equal(taken.ok, true);
  assert.equal(taken.entry.item, item, 'devolve a MESMA referência guardada no processo');
  assert.equal(taken.entry.index, 2);
  const again = undo.take({token: issued.token, scopeKey: 'Calculo', at: 1501});
  assert.deepEqual({ok: again.ok, reason: again.reason}, {ok: false, reason: 'unknown'}, 'sucesso consome o token');
});

test('prazo do host: vence no instante exato e o restante não fica negativo', () => {
  const at = 1000;
  const before = store();
  const healthy = before.issue({scopeKey: 'A', item: {id: 'a'}, at});
  assert.equal(before.take({token: healthy.token, scopeKey: 'A', at: at + deletionUndo.ttlMs() - 1}).ok, true);

  const expired = store();
  const dead = expired.issue({scopeKey: 'A', item: {id: 'a'}, at});
  assert.deepEqual(expired.take({token: dead.token, scopeKey: 'A', at: at + deletionUndo.ttlMs()}), {ok: false, reason: 'expired'});
  assert.equal(expired.peek(dead.token), null, 'vencido sai do mapa');
});

test('escopo diferente é recusado SEM consumir: o dono legítimo ainda desfaz', () => {
  const undo = store();
  const issued = undo.issue({scopeKey: 'Calculo', item: {id: 'n-1'}, at: 1000});
  const foreign = undo.take({token: issued.token, scopeKey: 'Fisica', at: 1100});
  assert.deepEqual(foreign, {ok: false, reason: 'scope'});
  assert.notEqual(undo.peek(issued.token), null, 'recusa de escopo não consome');
  assert.equal(undo.take({token: issued.token, scopeKey: 'Calculo', at: 1200}).ok, true);
});

test('material bloqueado é recusado SEM consumir: com a biblioteca certa, desfaz', () => {
  const undo = store();
  const issued = undo.issue({scopeKey: 'Calculo', item: {id: 'n-1'}, at: 1000});
  const blocked = undo.take({token: issued.token, scopeKey: 'Calculo', authorized: () => false, at: 1100});
  assert.deepEqual(blocked, {ok: false, reason: 'unauthorized'});
  assert.notEqual(undo.peek(issued.token), null, 'recusa de material não consome');
  assert.equal(undo.take({token: issued.token, scopeKey: 'Calculo', authorized: () => true, at: 1200}).ok, true);
});

test('token inventado, vazio ou acima do teto nunca vira reinserção', () => {
  const undo = store();
  for (const token of ['', '   ', 'u-nao-existe', 'a'.repeat(65)]) {
    const result = undo.take({token, scopeKey: 'A', at: 1000});
    assert.deepEqual({ok: result.ok, reason: result.reason}, {ok: false, reason: 'unknown'});
  }
  assert.equal(undo.size(), 0);
});

test('mergeRemoved reinsere na posição original, clampa o fim e não duplica identidade', () => {
  const same = (a, b) => a.id === b.id;
  const middle = deletionUndo.mergeRemoved([{id: 'a'}, {id: 'c'}], {id: 'b'}, same, 1);
  assert.deepEqual(middle, {items: [{id: 'a'}, {id: 'b'}, {id: 'c'}], restored: true});
  const end = deletionUndo.mergeRemoved([{id: 'a'}], {id: 'z'}, same, 99);
  assert.deepEqual(end.items.map((one) => one.id), ['a', 'z'], 'posição passada do fim clampa');
  const start = deletionUndo.mergeRemoved([], {id: 'z'}, same, 9);
  assert.deepEqual(start.items.map((one) => one.id), ['z']);
  const duplicate = deletionUndo.mergeRemoved([{id: 'a', note: 'nova'}], {id: 'a', note: 'velha'}, same, 0);
  assert.equal(duplicate.restored, false);
  assert.deepEqual(duplicate.items, [{id: 'a', note: 'nova'}], 'identidade já presente mantém a edição atual');
});

test('motivos de recusa têm texto em português', () => {
  assert.equal(ptText(deletionUndo.reasonText('expired')), 'O prazo para desfazer terminou.');
  assert.equal(ptText(deletionUndo.reasonText('scope')), 'Este Desfazer pertence a outra matéria ou sessão.');
  assert.equal(ptText(deletionUndo.reasonText('unauthorized')), 'Não desfiz: o material desta anotação saiu da biblioteca autorizada.');
  assert.equal(ptText(deletionUndo.reasonText('unknown')), 'Este Desfazer já foi usado ou não existe mais.');
});
