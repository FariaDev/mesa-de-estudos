/* O guia do GeoGebra fala o idioma do tutor (#41): descrição, campos e as
   frases devolvidas ao modelo mudam juntas; o nome dos campos não muda. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {guideFor, guideLanguage} from '../src/extensions/mesa-geogebra/guide.mjs';

const PT_WORDS = /\b(quadro|aluno|construção|Comando aceito|Objetos atuais|indisponível|Informe)\b/;

test('guideLanguage cai no português para valor desconhecido', () => {
  assert.equal(guideLanguage('en'), 'en');
  assert.equal(guideLanguage('pt-BR'), 'pt-BR');
  assert.equal(guideLanguage('fr'), 'pt-BR');
  assert.equal(guideLanguage(undefined), 'pt-BR');
});

test('em inglês, nada do que vai ao modelo sai em português', () => {
  const guide = guideFor('en');
  const texts = [
    guide.description, guide.fields.command.description, guide.fields.continuar.description,
    guide.runText({ok: true, board: {cleared: true, origin: 'student'}, state: {objects: ''}}),
    guide.runText({ok: false, error: 'bad'}), guide.stateText({}), guide.shotText,
    guide.missingCommandText, guide.unavailableText('x'), guide.bridgeClosed,
  ];
  for (const text of texts) assert.doesNotMatch(text, PT_WORDS, text);
  assert.match(texts[3], /the student's construction was saved/);
  assert.match(texts[3], /\(the construction is empty\)/);
  assert.match(texts[4], /rejected the command: bad/);
});

test('em português o texto de sempre continua igual', () => {
  const guide = guideFor('pt-BR');
  assert.match(guide.description, /^Controle o applet GeoGebra/);
  assert.match(guide.runText({ok: true, board: {cleared: true, origin: 'tutor'}, state: {objects: 'f: x^2'}}), /a sua construção anterior ficou guardada.*Comando aceito pelo GeoGebra\.\n\nObjetos atuais:\nf: x\^2/s);
  assert.equal(guide.unavailableText('sem rede'), 'GeoGebra indisponível (sem rede). Diga ao aluno o que impediu e não reinvente o resultado.');
});

test('os campos têm os mesmos nomes e tipos nos dois idiomas', () => {
  const shape = (guide) => Object.fromEntries(Object.entries(guide.fields).map(([name, field]) => [name, [field.type, field.optional === true]]));
  assert.deepEqual(shape(guideFor('en')), shape(guideFor('pt-BR')));
  assert.deepEqual(Object.keys(guideFor('en').fields), ['action', 'command', 'continuar']);
});
