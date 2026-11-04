/* Versão do OpenCode (#91): o turno usa a API v2 do `serve`, então a 1.x é
   recusada antes de qualquer pedido; versão ilegível segue como antes. A
   leitura é `opencode --version` por um fake nomeado, sem processo real. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
import {createI18n} from '../src/i18n.mjs';

const require = createRequire(import.meta.url);
const {oldOpenCode, readOpenCodeVersion, versionOf} = require('../src/agents/opencode-version.cjs');
const catalogs = {'pt-BR': require('../src/locales/pt-BR.json'), en: require('../src/locales/en.json')};

/** Fake nomeado do `spawn`: diz a versão (ou falha) sem executar binário. */
function fakeVersionSpawn(output, {error = false} = {}) {
  return () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stdout.setEncoding = () => {};
    child.kill = () => {};
    setImmediate(() => {
      if (error) child.emit('error', Error('binário ausente'));
      else {
        child.stdout.emit('data', output);
        child.emit('close', 0);
      }
    });
    return child;
  };
}

test('versionOf lê a versão do texto do --version e ignora lixo', () => {
  assert.deepEqual(versionOf('opencode v2.2.4\n'), {text: '2.2.4', major: 2, minor: 2, patch: 4});
  assert.deepEqual(versionOf('1.19.5'), {text: '1.19.5', major: 1, minor: 19, patch: 5});
  for (const value of ['', 'dev', null, undefined, 7]) assert.equal(versionOf(value), null);
});

test('oldOpenCode só bloqueia major menor que 2; versão ilegível não bloqueia', () => {
  assert.equal(oldOpenCode('opencode v1.19.5')?.text, '1.19.5');
  assert.equal(oldOpenCode('0.0.9')?.text, '0.0.9');
  for (const value of ['opencode v2.2.4', '2.0.0', '', 'dev', null]) assert.equal(oldOpenCode(value), null);
});

test('readOpenCodeVersion devolve o texto e cai em vazio quando o binário falha', async () => {
  assert.equal(await readOpenCodeVersion('/fake/opencode', {spawnProcess: fakeVersionSpawn('opencode v1.19.5\n')}), 'opencode v1.19.5');
  assert.equal(await readOpenCodeVersion('/fake/opencode', {spawnProcess: fakeVersionSpawn('', {error: true})}), '');
  assert.equal(await readOpenCodeVersion(''), '');
});

test('a recusa cabe em 80 caracteres nos dois idiomas e cita a versão encontrada', () => {
  for (const [language, catalog] of Object.entries(catalogs)) {
    const text = createI18n({catalogs: {...catalogs, [language]: catalog}, language}).t('err.opencode.versionUnsupported', {version: '1.19.5'});
    assert.ok(text.length <= 80, `${language}: ${text.length} caracteres em ${JSON.stringify(text)}`);
    assert.match(text, /1\.19\.5/, language);
    assert.match(text, /2/, language);
  }
});
