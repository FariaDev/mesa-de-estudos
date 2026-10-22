/* Nomes que a aba Livre grava em português e mostra no idioma da interface (#41). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {setUiLanguage} from '../src/ui-text.mjs';
import {displayFreeTitle, displayCourseName, localizeFreeCourse, STORED_DEFAULT_FREE_TITLE, FREE_COURSE_ID} from '../src/free-names.mjs';

globalThis.document = {documentElement: {}, querySelectorAll: () => []};
globalThis.window = Object.assign(new EventTarget(), {desk: undefined});

test('o título padrão gravado em português se mostra no idioma da interface', () => {
  try {
    setUiLanguage('en');
    assert.equal(displayFreeTitle(STORED_DEFAULT_FREE_TITLE), 'Free session');
    assert.equal(displayFreeTitle('Minha dúvida de limites'), 'Minha dúvida de limites', 'título do usuário fica como veio');
    setUiLanguage('pt-BR');
    assert.equal(displayFreeTitle(STORED_DEFAULT_FREE_TITLE), 'Sessão livre');
  } finally {
    setUiLanguage('pt-BR');
  }
});

test('a aba Livre ganha o nome do idioma; as matérias do usuário não mudam', () => {
  try {
    setUiLanguage('en');
    assert.equal(displayCourseName({id: FREE_COURSE_ID, name: 'Livre'}), 'Free');
    assert.equal(displayCourseName({id: 'calc', name: 'Cálculo I'}), 'Cálculo I');
    assert.equal(displayCourseName(null), '');
    const courses = localizeFreeCourse([{id: FREE_COURSE_ID, kind: 'free', name: 'Livre'}, {id: 'calc', name: 'Calc'}]);
    assert.deepEqual(courses.map((course) => course.name), ['Free', 'Calc']);
  } finally {
    setUiLanguage('pt-BR');
  }
});
