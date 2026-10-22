/* t() e text() da interface bilíngue (#41): troca de idioma, fallback para o
   português, plural, número formatado por Intl e a leitura das mensagens que os
   núcleos Bend devolvem (core/msg.bend). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createI18n, localizeDecimal, message, parseMessage, placeholderNames, MESSAGE_MARK as M, MESSAGE_SEP as S} from '../src/i18n.mjs';
import bendMsg from '../src/generated/msg.core.js';

const catalogs = {
  'pt-BR': {'a.title': 'Configurações', 'a.hello': 'Olá, {name}', 'a.size': '{n:number} páginas', 'a.only': 'só em português',
    'a.items.one': '{count} item', 'a.items.other': '{count} itens'},
  en: {'a.title': 'Settings', 'a.hello': 'Hello, {name}', 'a.size': '{n:number} pages',
    'a.items.one': '{count} item', 'a.items.other': '{count} items'},
};

test('t() segue o idioma atual e a troca vale na hora', () => {
  const i18n = createI18n({catalogs, language: 'en'});
  assert.equal(i18n.t('a.title'), 'Settings');
  i18n.setLanguage('pt-BR');
  assert.equal(i18n.t('a.title'), 'Configurações');
});

test('chave que falta em inglês cai no português; falta nos dois, devolve a chave e avisa', () => {
  const missing = [];
  const i18n = createI18n({catalogs, language: 'en', onMissing: (key, language) => missing.push([key, language])});
  assert.equal(i18n.t('a.only'), 'só em português');
  assert.equal(i18n.t('a.nope'), 'a.nope');
  assert.deepEqual(missing, [['a.nope', 'en']]);
});

test('zero usa a forma plural nos dois idiomas (regressão: pt-BR mostrava "1 item" para 0 itens)', () => {
  const i18n = createI18n({catalogs, language: 'pt-BR'});
  assert.equal(i18n.t('a.items', {count: 0}), '0 itens');
  assert.equal(i18n.t('a.items', {count: 1}), '1 item');
  i18n.setLanguage('en');
  assert.equal(i18n.t('a.items', {count: 0}), '0 items');
});

test('count sem formas .one/.other usa a chave pura (regressão: "Guardadas · {count}" mostrava a chave)', () => {
  const plain = createI18n({catalogs: {'pt-BR': {'p.kept': 'Guardadas · {count}.'}, en: {'p.kept': 'Kept · {count}.'}}});
  assert.equal(plain.t('p.kept', {count: 3}), 'Guardadas · 3.');
  assert.equal(plain.t('p.kept', {count: 1}), 'Guardadas · 1.');
});

test('argumentos, número por Intl e plural', () => {
  const i18n = createI18n({catalogs, language: 'en'});
  assert.equal(i18n.t('a.hello', {name: 'Ana'}), 'Hello, Ana');
  assert.equal(i18n.t('a.size', {n: 1234.5}), '1,234.5 pages');
  assert.equal(i18n.t('a.items', {count: 1}), '1 item');
  assert.equal(i18n.t('a.items', {count: 3}), '3 items');
  i18n.setLanguage('pt-BR');
  assert.equal(i18n.t('a.size', {n: 1234.5}), '1.234,5 páginas');
});

test('erros dizem o valor recebido e o formato esperado', () => {
  const i18n = createI18n({catalogs});
  assert.throws(() => i18n.t('a.hello'), /pede o argumento "name", recebeu \[\]/);
  assert.throws(() => i18n.t('a.size', {n: 'abc'}), /deveria ser número, veio "abc"/);
  assert.throws(() => i18n.setLanguage('fr'), /idioma "fr" desconhecido; esperado "pt-BR" ou "en"/);
});

test('text() traduz a mensagem dos núcleos e deixa texto comum passar', () => {
  const i18n = createI18n({catalogs, language: 'en'});
  assert.equal(i18n.text(`${M}a.hello${S}name${S}Ana`), 'Hello, Ana');
  assert.equal(i18n.text('Texto do aluno'), 'Texto do aluno');
  assert.equal(i18n.text(''), '');
});

test('message() monta o mesmo formato que o núcleo e o host lê de volta', () => {
  assert.equal(message('a.title'), bendMsg.msg('a.title'));
  assert.equal(message('k', {x: 1, y: 'b'}), bendMsg.msg2('k', 'x', '1', 'y', 'b'));
  assert.deepEqual(parseMessage(message('k', {x: 1})), {key: 'k', args: {x: '1'}});
  const i18n = createI18n({catalogs, language: 'en'});
  assert.equal(i18n.text(message('a.hello', {name: 'Ana'})), 'Hello, Ana');
});

test('message() recusa chave vazia e argumento com o separador', () => {
  assert.throws(() => message(''), /chave de mensagem deveria ser texto não vazio sem marcas, veio ""/);
  assert.throws(() => message('k', {x: `a${S}b`}), /não pode conter o separador/);
});

test('o formato do núcleo Bend é o que o host lê', () => {
  assert.deepEqual(parseMessage(bendMsg.msg('a.title')), {key: 'a.title', args: {}});
  assert.deepEqual(parseMessage(bendMsg.msg2('k', 'x', '1', 'y', '2')), {key: 'k', args: {x: '1', y: '2'}});
  assert.equal(parseMessage('Configurações'), null);
});

test('placeholderNames lista os nomes, com ou sem :number', () => {
  assert.deepEqual(placeholderNames('{n:number} de {total} em {n}'), ['n', 'total', 'n']);
});

test('localizeDecimal põe o separador do idioma e deixa o resto como veio', () => {
  assert.equal(localizeDecimal('0.5', 'pt-BR'), '0,5');
  assert.equal(localizeDecimal('0.5', 'en'), '0.5');
  assert.equal(localizeDecimal('-12.25', 'pt-BR'), '-12,25');
  assert.equal(localizeDecimal('1.5e-7', 'pt-BR'), '1,5e-7');
  for (const raw of ['—', '', '3', 'abc', '1.2.3']) assert.equal(localizeDecimal(raw, 'pt-BR'), raw, `texto que não é decimal fica como veio: ${JSON.stringify(raw)}`);
});
