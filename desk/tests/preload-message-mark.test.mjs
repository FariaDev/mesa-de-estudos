/* O preload roda em sandbox e não importa `i18n.mjs`: monta a mensagem marcada
   à mão. Este teste garante que o marcador é o mesmo e que as chaves existem. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MESSAGE_MARK, createI18n} from '../src/i18n.mjs';
import ptBR from '../src/locales/pt-BR.json' with {type: 'json'};
import en from '../src/locales/en.json' with {type: 'json'};

const source = fs.readFileSync(new URL('../preload.cjs', import.meta.url), 'utf8');

test('preload: o marcador à mão é o MESSAGE_MARK e as frases existem nos dois idiomas', () => {
  assert.ok(source.includes(`'\\u${MESSAGE_MARK.charCodeAt(0).toString(16).toUpperCase()}'+key`), 'marcador igual ao de i18n.mjs');
  const keys = [...source.matchAll(/uiMsg\('([a-zA-Z0-9.]+)'\)/g)].map((match) => match[1]);
  assert.ok(keys.length >= 3, 'o preload usa mensagens marcadas');
  for (const language of ['pt-BR', 'en']) {
    const i18n = createI18n({catalogs: {'pt-BR': ptBR, en}, language});
    for (const key of keys) assert.notEqual(i18n.text(MESSAGE_MARK + key), key, `${language} sem a chave ${key}`);
  }
});
