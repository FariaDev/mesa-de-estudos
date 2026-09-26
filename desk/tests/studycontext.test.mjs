import test from 'node:test';
import assert from 'node:assert/strict';
import {buildStudyContext, formatRefs, contextKey} from '../studycontext.cjs';

/* Contexto de estudo da Mesa: o núcleo Bend decide o que entra e se o bloco vai
   (core/studycontext.bend, com as leis em core/laws/studycontext.bend). Aqui se
   exercita o adaptador real — o mesmo que o main usa no pi-prompt. */

const study = (title = '', xopp = '') => ({title, xopp});

test('primeira mensagem manda o contexto completo', () => {
  const out = buildStudyContext({
    course: 'Cálculo I',
    study: study('Lista 3'),
    refs: formatRefs([{path: '/x/limites.pdf', page: 3}]),
  });
  assert.equal(out.changed, true);
  assert.match(out.text, /^\[Contexto da Mesa\]\n/);
  assert.match(out.text, /- matéria: Cálculo I/);
  assert.match(out.text, /- exercício ativo: Lista 3/);
  assert.match(out.text, /- referências abertas na mesa \(abertas, não lidas por você\):/);
  assert.match(out.text, /  · \/x\/limites\.pdf#page=3/);
});

test('contexto inalterado não é reenviado no turno seguinte', () => {
  const refs = formatRefs([{path: '/x/limites.pdf', page: 3}]);
  const first = buildStudyContext({course: 'Cálculo I', study: study('Lista 3'), refs});
  const again = buildStudyContext({course: 'Cálculo I', study: study('Lista 3'), refs, previousKey: first.key});
  assert.equal(again.changed, false);
  assert.equal(again.text, '', 'o histórico já carrega a versão anterior');
});

test('mudar de exercício volta a mandar o bloco', () => {
  const refs = formatRefs([{path: '/x/limites.pdf', page: 3}]);
  const first = buildStudyContext({course: 'Cálculo I', study: study('Lista 3'), refs});
  const next = buildStudyContext({course: 'Cálculo I', study: study('Lista 4'), refs, previousKey: first.key});
  assert.equal(next.changed, true);
  assert.match(next.text, /Lista 4/);
});

test('a referência nunca aparece como conteúdo já lido', () => {
  const out = buildStudyContext({course: '', study: study(), refs: formatRefs([{path: '/x/a.pdf', page: 1}])});
  assert.match(out.text, /abertas, não lidas por você/);
});

test('sem matéria, sem exercício e sem referência, nenhum bloco vai', () => {
  const out = buildStudyContext({});
  assert.equal(out.text, '');
});

test('captura do exercício ativo vai, mesmo com o contexto já mandado', () => {
  const refs = formatRefs([{path: '/x/limites.pdf', page: 3}]);
  const first = buildStudyContext({course: 'Cálculo I', study: study('Lista 3'), refs});
  const withShot = buildStudyContext({
    course: 'Cálculo I', study: study('Lista 3'), refs, previousKey: first.key,
    capture: {capturedAt: Date.now(), exercise: 'Lista 3'},
  });
  assert.equal(withShot.changed, true);
  assert.match(withShot.text, /captura desta mensagem/);
  assert.doesNotMatch(withShot.text, /atenção/, 'a captura é do exercício ativo');
});

test('captura de outro exercício é marcada como tal', () => {
  const out = buildStudyContext({
    course: 'Cálculo I', study: study('Lista 4'),
    capture: {capturedAt: Date.now(), exercise: 'Lista 3'},
  });
  assert.match(out.text, /é de outro exercício, não do ativo/);
  assert.match(out.text, /do exercício Lista 3/);
});

test('captura sem horário não é tratada como captura', () => {
  const out = buildStudyContext({course: 'Cálculo I', study: study('Lista 3'), capture: {exercise: 'Lista 3'}});
  assert.doesNotMatch(out.text, /captura desta mensagem/);
});

test('referências são limitadas a duas e normalizadas em #page', () => {
  const refs = formatRefs([
    {path: '/x/a.pdf', page: 0},
    {path: '/x/b.pdf', page: 7},
    {path: '/x/c.pdf', page: 9},
    {path: 'sem-page'},
  ]);
  assert.deepEqual(refs, ['/x/a.pdf#page=1', '/x/b.pdf#page=7']);
});

test('a chave muda quando qualquer parte do contexto muda', () => {
  const base = contextKey({course: 'a', exercise: 'b', xopp: '', refs: []});
  assert.notEqual(base, contextKey({course: 'a', exercise: 'c', xopp: '', refs: []}));
  assert.notEqual(base, contextKey({course: 'a', exercise: 'b', xopp: '', refs: ['x']}));
  assert.notEqual(base, contextKey({course: 'a', exercise: 'b', xopp: '/tmp/a.xopp', refs: []}));
  assert.equal(base, contextKey({course: 'a', exercise: 'b', xopp: '', refs: []}));
});

test('a captura entra na chave estável? não: o turno seguinte não é reenviado', () => {
  /* A captura sempre vai junto do bloco (lei do núcleo), então ela não precisa
     mexer na chave. Se mexesse, o turno SEGUINTE reenviaria o mesmo contexto só
     porque a captura anterior tinha saído — custo puro sem informação nova. */
  const refs = formatRefs([{path: '/x/limites.pdf', page: 3}]);
  const first = buildStudyContext({course: 'Cálculo I', study: study('Lista 3'), refs});
  const withShot = buildStudyContext({
    course: 'Cálculo I', study: study('Lista 3'), refs, previousKey: first.key,
    capture: {capturedAt: Date.now(), exercise: 'Lista 3'},
  });
  assert.match(withShot.text, /captura desta mensagem/, 'a captura continua indo');
  assert.equal(withShot.changed, true, 'o bloco foi montado');
  const depois = buildStudyContext({course: 'Cálculo I', study: study('Lista 3'), refs, previousKey: withShot.key, capture: null});
  assert.equal(depois.text, '', 'sem captura e sem mudança, o contexto estável não é reenviado');
  assert.equal(depois.changed, false);
});

test('captura de outro exercício continua avisando depois da mudança de chave', () => {
  const out = buildStudyContext({
    course: 'Cálculo I', study: study('Lista 4'), capture: {capturedAt: Date.now(), exercise: 'Lista 3'},
  });
  assert.equal(out.changed, true);
  assert.match(out.text, /é de outro exercício, não do ativo/);
});
