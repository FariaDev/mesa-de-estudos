/* O guia do GeoGebra separa as duas coisas: descrição e campos são SEMPRE em
   inglês (#41), e só as frases devolvidas ao modelo seguem o idioma do tutor.
   O nome dos campos não muda. */
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

test('descrição e campos em inglês nos dois idiomas do tutor', () => {
  for (const language of ['pt-BR', 'en', undefined, 'fr']) {
    const guide = guideFor(language);
    assert.match(guide.description, /^Control the GeoGebra applet/);
    assert.match(guide.description, /"run" already returns the state with the objects created/);
    assert.match(guide.fields.command.description, /^Command in GeoGebra syntax; required for "run"\.$/);
    assert.match(guide.fields.continuar.description, /^On "run": keeps the construction already on the board/);
    assert.doesNotMatch(guide.description, PT_WORDS);
  }
  assert.equal(guideFor('pt-BR').description, guideFor('en').description);
});

test('em inglês, nada do que volta ao modelo sai em português', () => {
  const guide = guideFor('en');
  const texts = [
    guide.runText({ok: true, board: {cleared: true, origin: 'student'}, state: {objects: ''}}),
    guide.runText({ok: false, error: 'bad'}), guide.stateText({}), guide.shotText,
    guide.missingCommandText, guide.unavailableText('x'), guide.bridgeClosed,
  ];
  for (const text of texts) assert.doesNotMatch(text, PT_WORDS, text);
  assert.match(texts[0], /the student's construction was saved/);
  assert.match(texts[0], /\(the construction is empty\)/);
  assert.match(texts[1], /rejected the command: bad/);
});

test('em português o resultado de sempre continua igual', () => {
  const guide = guideFor('pt-BR');
  assert.match(guide.runText({ok: true, board: {cleared: true, origin: 'tutor'}, state: {objects: 'f: x^2'}}), /a sua construção anterior ficou guardada.*Comando aceito pelo GeoGebra\.\n\nObjetos atuais:\nf: x\^2/s);
  assert.equal(guide.unavailableText('sem rede'), 'GeoGebra indisponível (sem rede). Diga ao aluno o que impediu e não reinvente o resultado.');
});

test('M2: "run" já devolve o estado; "state" serve só para reler sem mudar', () => {
  for (const guide of [guideFor('pt-BR'), guideFor('en')]) {
    assert.match(guide.description, /"run" already returns the state with the objects created: use "state" only to reread without changing/);
    assert.doesNotMatch(guide.description, /Prefira "run" \+ "state" para construir|Prefer "run" \+ "state" to build/);
  }
});

test('M4: acima de 80 objetos o texto avisa que o resumo foi cortado, nos dois idiomas', () => {
  const state = {objects: 'a: 1\nb: 2', count: 83};
  assert.match(guideFor('pt-BR').runText({ok: true, state}), /Objetos atuais:\na: 1\nb: 2\n\(mostrando 80 de 83 objetos\)/);
  assert.match(guideFor('en').stateText({state}), /Current objects in GeoGebra:\na: 1\nb: 2\n\(showing 80 of 83 objects\)/);
  assert.doesNotMatch(guideFor('pt-BR').stateText({state: {objects: 'a: 1', count: 80}}), /mostrando/);
  assert.doesNotMatch(guideFor('pt-BR').stateText({state: {objects: ''}}), /mostrando/);
});

test('os campos têm os mesmos nomes, tipos e descrições nos dois idiomas', () => {
  const shape = (guide) => Object.fromEntries(Object.entries(guide.fields).map(([name, field]) => [name, [field.type, field.optional === true]]));
  assert.deepEqual(shape(guideFor('en')), shape(guideFor('pt-BR')));
  assert.deepEqual(Object.keys(guideFor('en').fields), ['action', 'command', 'continuar']);
  assert.equal(guideFor('en').fields.command.description, guideFor('pt-BR').fields.command.description);
  assert.equal(guideFor('en').fields.continuar.description, guideFor('pt-BR').fields.continuar.description);
});
