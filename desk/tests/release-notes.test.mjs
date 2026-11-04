import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import ptBR from '../src/locales/pt-BR.json' with {type: 'json'};
import en from '../src/locales/en.json' with {type: 'json'};
import {RELEASE_NOTES, parseReleaseVersion, compareReleaseVersions, pendingReleaseNotes} from '../src/release-notes.mjs';

const require = createRequire(import.meta.url);
const {releaseNotesVersion} = require('../desk-version.cjs');
const note = (version) => ({version, title: 't', lead: 'l', groups: []});
const notes = [note('1.3.0'), note('1.1.0')];

test('versão de release: só X.Y.Z, comparada por número', () => {
  assert.deepEqual(parseReleaseVersion(' 1.10.2 '), [1, 10, 2]);
  assert.equal(parseReleaseVersion('1.1.0-beta'), null);
  assert.equal(parseReleaseVersion('1.1.0 abc-dirty'), null);
  assert.equal(parseReleaseVersion(undefined), null);
  assert.ok(compareReleaseVersions([1, 9, 0], [1, 10, 0]) < 0);
  assert.equal(compareReleaseVersions([1, 1, 0], [1, 1, 0]), 0);
});

test('quem atualiza vê só o que veio depois da última versão vista', () => {
  const pending = pendingReleaseNotes({seen: '1.1.0', current: '1.3.0', notes});
  assert.deepEqual(pending.notes.map((item) => item.version), ['1.3.0']);
  assert.equal(pending.seen, '1.3.0');
});

test('quem vem de antes deste registro vê tudo até a versão atual, nada do futuro', () => {
  const pending = pendingReleaseNotes({seen: '', current: '1.2.0', notes});
  assert.deepEqual(pending.notes.map((item) => item.version), ['1.1.0']);
  assert.equal(pending.seen, '1.2.0');
});

test('instalação nova não vê novidade, mas registra a versão', () => {
  assert.deepEqual(pendingReleaseNotes({seen: '', current: '1.1.0', firstRun: true, notes}), {notes: [], seen: '1.1.0'});
});

test('primeira abertura depois de já ter visto não apaga novidade de quem atualizou', () => {
  const pending = pendingReleaseNotes({seen: '1.1.0', current: '1.3.0', firstRun: true, notes});
  assert.deepEqual(pending.notes.map((item) => item.version), ['1.3.0']);
});

test('mesma versão, versão anterior ou versão ilegível não abrem nem gravam', () => {
  for (const options of [{seen: '1.1.0', current: '1.1.0'}, {seen: '1.3.0', current: '1.1.0'}, {seen: '', current: ''}, {seen: '', current: '1.1.0-beta'}]) {
    assert.deepEqual(pendingReleaseNotes({...options, notes}), {notes: [], seen: null});
  }
});

test('versão sem nota grava em silêncio', () => {
  assert.deepEqual(pendingReleaseNotes({seen: '1.3.0', current: '1.3.1', notes}), {notes: [], seen: '1.3.1'});
});

test('toda nota tem texto nos dois idiomas e versão válida', () => {
  for (const item of RELEASE_NOTES) {
    assert.ok(parseReleaseVersion(item.version), item.version);
    const keys = [item.title, item.lead, ...item.groups.flatMap((group) => [group.title, ...group.cards.flatMap((card) => [card.title, card.body])])];
    for (const key of keys) {
      assert.ok(ptBR[key], `pt-BR sem ${key}`);
      assert.ok(en[key], `en sem ${key}`);
    }
  }
});

test('a versão da janela: rótulo do Sobre em produção, só a chave em teste', () => {
  assert.equal(releaseNotesVersion('1.1.0 ca681f7-dirty', {}), '1.1.0');
  assert.equal(releaseNotesVersion('1.1.0 ca681f7', {DESK_TEST: '1'}), '');
  assert.equal(releaseNotesVersion('1.1.0', {DESK_TEST: '1', LEARNING_DESK_RELEASE_VERSION: '1.2.0'}), '1.2.0');
});
