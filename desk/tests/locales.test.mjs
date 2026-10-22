/* Os catálogos de idioma da interface (#41): `desk/src/locales/pt-BR.json` e `en.json`
   têm as mesmas chaves e os mesmos argumentos, e toda chave que o código usa
   existe neles. O catálogo é a única fonte das frases, então uma chave que falta
   num idioma só aparece em campo, na troca de idioma. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {placeholderNames} from '../src/i18n.mjs';
import ptBR from '../src/locales/pt-BR.json' with {type: 'json'};
import en from '../src/locales/en.json' with {type: 'json'};

const deskDir = path.resolve(import.meta.dirname, '..');
const coreDir = path.resolve(deskDir, '..', 'core');
const read = (file) => fs.readFileSync(file, 'utf8');
const filesIn = (dir, extension) => fs.readdirSync(dir).filter((name) => name.endsWith(extension)).map((name) => path.join(dir, name));
/** Os scripts de `src/` e das pastas dentro dela (`src/agents`, `src/study-data`…), `.mjs` e `.cjs`. */
const sourceScripts = (dir) => fs.readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  if (entry.isDirectory()) return entry.name === 'generated' ? [] : sourceScripts(full);
  return /\.(mjs|cjs)$/.test(entry.name) ? [full] : [];
});

/** `a.b.one` e `a.b.other` são as formas de plural de `a.b`. */
const baseKey = (key) => key.replace(/\.(one|other)$/, '');
const uniqueNames = (phrase) => [...new Set(placeholderNames(phrase))].sort();

test('os dois catálogos têm as mesmas chaves, sem frase vazia', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ptBR).sort(), 'chaves de en.json e pt-BR.json devem ser as mesmas');
  for (const [language, catalog] of [['pt-BR', ptBR], ['en', en]]) {
    for (const [key, phrase] of Object.entries(catalog)) {
      assert.equal(typeof phrase, 'string', `${language}: "${key}" deveria ser texto, veio ${JSON.stringify(phrase)}`);
      assert.ok(phrase.trim().length > 0, `${language}: "${key}" está vazia`);
    }
  }
});

test('cada chave leva os mesmos argumentos nos dois idiomas', () => {
  for (const key of Object.keys(ptBR)) {
    assert.deepEqual(uniqueNames(en[key] ?? ''), uniqueNames(ptBR[key]), `"${key}": argumentos de en.json e pt-BR.json devem ser os mesmos`);
  }
});

test('o plural tem as duas formas em cada idioma', () => {
  for (const catalog of [ptBR, en]) {
    for (const key of Object.keys(catalog)) {
      const base = baseKey(key);
      if (base === key) continue;
      assert.ok(`${base}.one` in catalog && `${base}.other` in catalog, `"${base}" precisa de .one e .other`);
    }
  }
});

test('o catálogo não mistura os idiomas no mesmo texto de produto', () => {
  const portugueseWordInEnglish = /\b(Configurações|Matérias|Salvar|Cancelar|Escolher|Aparência|Pasta)\b/;
  for (const [key, phrase] of Object.entries(en)) {
    assert.ok(!portugueseWordInEnglish.test(phrase), `en: "${key}" tem palavra em português: ${JSON.stringify(phrase)}`);
  }
});

/* ---- toda chave usada no código existe ---- */

/** Chaves e nomes de argumento dos `M.msg*("chave", "nome", valor, …)` dos núcleos. */
function bendMessages() {
  const found = [];
  for (const file of filesIn(coreDir, '.bend')) {
    const source = read(file);
    for (const match of source.matchAll(/\bM\.msg([1234]?)\("([^"]+)"((?:,\s*"[^"]+",\s*[^,()]+(?:\((?:[^()]|\([^()]*\))*\))?)*)/g)) {
      const names = [...match[3].matchAll(/,\s*"([^"]+)"\s*,/g)].map((m) => m[1]);
      found.push({file: path.basename(file), key: match[2], names, arity: Number(match[1] || 0)});
    }
  }
  return found;
}

/* O HTML estático: o index.html e a marcação que saiu dele para caber no teto (#64). */
const staticMarkup = () => [path.join(deskDir, 'index.html'), path.join(deskDir, 'src', 'setup-markup.mjs')].map(read).join('\n');

function htmlKeys() {
  const html = staticMarkup();
  const keys = [...html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)].map((m) => m[1]);
  for (const attr of html.matchAll(/data-i18n-attr="([^"]+)"/g)) {
    for (const pair of attr[1].split(';')) keys.push(pair.split('=')[1].trim());
  }
  return keys;
}

function scriptKeys() {
  const keys = [];
  const hostFiles = [...filesIn(deskDir, '.cjs'), ...filesIn(deskDir, '.mjs')];
  const files = [...sourceScripts(path.join(deskDir, 'src')).filter((f) => !f.endsWith('i18n.mjs')), ...hostFiles];
  /* t('chave'), message('chave') e os apelidos que os módulos usam para fugir de variável local. */
  const call = /(?:\bt|\bmessage|languageHost\.t|\buiT|\buiMessage|\btranslate)\('([a-zA-Z0-9_]+\.[a-zA-Z0-9_.]+)'/g;
  for (const file of files) {
    for (const match of read(file).matchAll(call)) keys.push(match[1]);
  }
  return keys;
}

const exists = (key) => key in ptBR || `${key}.other` in ptBR;

test('toda chave dos núcleos Bend existe no catálogo, com os argumentos certos', () => {
  const messages = bendMessages();
  assert.ok(messages.length > 40, `esperava dezenas de mensagens nos núcleos, achei ${messages.length}`);
  for (const {file, key, names} of messages) {
    assert.ok(exists(key), `${file}: chave "${key}" não está em pt-BR.json`);
    const phrase = ptBR[key] ?? ptBR[`${key}.other`];
    assert.deepEqual([...new Set(names)].sort(), uniqueNames(phrase), `${file}: "${key}" passa os argumentos [${names}] e a frase pede [${uniqueNames(phrase)}]`);
  }
});

test('toda chave do index.html e dos scripts existe no catálogo', () => {
  for (const key of htmlKeys()) assert.ok(exists(key), `index.html: chave "${key}" não está em pt-BR.json`);
  const keys = scriptKeys();
  assert.ok(keys.length > 20, `esperava dezenas de chaves nos scripts, achei ${keys.length}`);
  for (const key of keys) assert.ok(exists(key), `scripts: chave "${key}" não está em pt-BR.json`);
});

test('toda chave do catálogo é usada em algum lugar', () => {
  const sources = [
    ...filesIn(coreDir, '.bend'),
    ...sourceScripts(path.join(deskDir, 'src')),
    path.join(deskDir, 'index.html'),
    ...filesIn(deskDir, '.cjs'),
    ...filesIn(deskDir, '.mjs'),
  ].map(read).join('\n');
  /* Famílias montadas em tempo de execução: t(`effort.${nivel}`) usa effort.low, effort.high… */
  const families = [...sources.matchAll(/`([a-zA-Z0-9_.]+\.)\$\{/g)].map((m) => m[1]);
  const quoted = (key) => [`"${key}"`, `'${key}'`, `=${key}"`, `=${key};`].some((form) => sources.includes(form))
    || families.some((family) => key.startsWith(family));
  const unused = [...new Set(Object.keys(ptBR).map(baseKey))].filter((key) => !quoted(key));
  assert.deepEqual(unused, [], 'chaves do catálogo sem uso: apague-as ou ligue-as a uma tela');
});

test('data-i18n-html só leva marcação inline conhecida, igual nos dois idiomas', () => {
  const html = staticMarkup();
  const keys = [...html.matchAll(/data-i18n-html="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length > 20, `esperava dezenas de chaves com marcação, achei ${keys.length}`);
  const tags = (phrase) => [...phrase.matchAll(/<\/?([a-z0-9]+)[^>]*>/gi)].map((m) => m[0]);
  for (const key of keys) {
    for (const catalog of [ptBR, en]) {
      const unknown = tags(catalog[key]).filter((tag) => !/^<\/?(strong|kbd|code|em)>$/.test(tag));
      assert.deepEqual(unknown, [], `"${key}" usa marcação fora de strong/kbd/code/em`);
    }
    assert.deepEqual(tags(en[key]).sort(), tags(ptBR[key]).sort(), `"${key}" tem marcação diferente em inglês e português`);
  }
});
