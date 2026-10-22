import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const updater = require('../updater.cjs');
const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-claude-latest-')), 'update.json');

test('claudeLatest: lê o registry @anthropic-ai/claude-code e guarda no cache de 24 h', async () => {
  const cacheFile = tmp();
  const urls = [];
  const fetchJson = async (url) => { urls.push(url); return {version: '2.1.302'}; };
  const r = await updater.claudeLatest({cacheFile, fetchJson, now: 1000});
  assert.deepEqual(r, {version: '2.1.302', known: true});
  assert.deepEqual(urls, [updater.CLAUDE_REGISTRY_URL]);
  assert.match(updater.CLAUDE_REGISTRY_URL, /@anthropic-ai\/claude-code\/latest$/);
  assert.equal(updater.readCache(cacheFile).claude.version, '2.1.302');
  /* dentro das 24 h, a segunda pergunta nem sai da máquina */
  const again = await updater.claudeLatest({cacheFile, fetchJson: async () => { throw Error('não devia pedir'); }, now: 2000});
  assert.equal(again.version, '2.1.302');
});

test('claudeLatest: sem rede ou resposta sem versão = desconhecido, sem erro', async () => {
  const off = await updater.claudeLatest({cacheFile: tmp(), fetchJson: async () => { throw Error('offline'); }});
  assert.deepEqual(off, {version: '', known: false});
  const ruim = await updater.claudeLatest({cacheFile: tmp(), fetchJson: async () => ({version: '2.1.0-rc.1'})});
  assert.deepEqual(ruim, {version: '', known: false}, 'prerelease não vira "versão disponível"');
});

test('cacheOnly: ao abrir a Mesa o ponto lê o que já se sabe e não dispara rede', async () => {
  const cacheFile = tmp();
  updater.writeCache(cacheFile, {claude: {at: 1, version: '2.1.300'}});
  const r = await updater.claudeLatest({
    cacheFile, now: 1 + updater.CHECK_TTL * 5, cacheOnly: true,
    fetchJson: async () => { throw Error('cacheOnly não pede rede'); },
  });
  assert.deepEqual(r, {version: '2.1.300', known: true}, 'cache velho vale: a checagem diária refaz');
  const vazio = await updater.piLatest({cacheFile: tmp(), cacheOnly: true, fetchJson: async () => { throw Error('rede'); }});
  assert.deepEqual(vazio, {version: '', known: false});
});
