/* Teto de `salvar_nota` por turno do aluno (auditoria de segurança): 3 passam, a
   quarta recusa sem criar arquivo, turno novo libera — em duas conversas
   diferentes e depois de cancelamento. O funil é um só para os dois motores
   (`studyServices.noteSave`): o Claude chama direto e o OpenCode chega pela
   ponte de material; o host avisa o turno novo a cada mensagem aceita do aluno. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {enText, ptMatches, ptText} from './pt-text.mjs';

const require = createRequire(import.meta.url);
const {createStudyServices} = require('../src/study-data/services.cjs');
const {createTutorMaterialBridge} = require('../tutor-materials.cjs');

const newRuntime = () => mkdtempSync(join(tmpdir(), 'mesa-note-turn-'));

/* Matéria com pasta real e escopo mutável (troca de conversa no mesmo host). */
function studyStack() {
  const runtime = newRuntime();
  const course = join(runtime, 'curso');
  mkdirSync(course, {recursive: true});
  /* Um PDF autorizado qualquer, para a matéria existir na lista. */
  writeFileSync(join(course, 'Aula.pdf'), '%PDF-1.4 sintético\n');
  const state = {conversation: 'sessao-a'};
  const services = createStudyServices({
    runtime: () => runtime,
    courses: () => [{id: 'curso', name: 'Curso', path: course}],
    scope: () => ({courseId: 'curso', conversation: state.conversation, freeSessionId: ''}),
    allowed: () => new Set(),
    persist() {},
  });
  const notes = () => readdirSync(join(course, 'Notas'));
  return {runtime, course, state, services, notes, done: () => rmSync(runtime, {recursive: true, force: true})};
}

test('3 notas passam, a quarta recusa sem criar arquivo', () => {
  const stack = studyStack();
  try {
    for (let turn = 1; turn <= 3; turn += 1) stack.services.noteSave(null, {titulo: `Nota ${turn}`, conteudo: '# a'});
    assert.equal(stack.notes().length, 3);
    assert.throws(() => stack.services.noteSave(null, {titulo: 'Nota 4', conteudo: '# d'}), ptMatches(/Limite de 3 notas por turno/));
    assert.equal(stack.notes().length, 3, 'a recusada não cria arquivo');
  } finally {
    stack.done();
  }
});

test('turno novo libera o teto; cancelado sem mensagem nova mantém a conta', () => {
  const stack = studyStack();
  try {
    stack.services.noteSave(null, {titulo: 'A', conteudo: '# a'});
    stack.services.noteSave(null, {titulo: 'B', conteudo: '# b'});
    /* Cancelamento não avisa turno novo: a conta do turno segue valendo. */
    stack.services.noteSave(null, {titulo: 'C', conteudo: '# c'});
    assert.throws(() => stack.services.noteSave(null, {titulo: 'D', conteudo: '# d'}), ptMatches(/Limite de 3 notas por turno/));
    stack.services.newStudentTurn();
    stack.services.newStudentTurn();
    for (let turn = 1; turn <= 3; turn += 1) stack.services.noteSave(null, {titulo: `Nova ${turn}`, conteudo: '# x'});
    assert.equal(stack.notes().length, 6);
    assert.throws(() => stack.services.noteSave(null, {titulo: 'Nova 4', conteudo: '# x'}), ptMatches(/Limite de 3 notas/));
  } finally {
    stack.done();
  }
});

test('duas conversas diferentes têm tetos separados no mesmo turno', () => {
  const stack = studyStack();
  try {
    for (let turn = 1; turn <= 3; turn += 1) stack.services.noteSave(null, {titulo: `A${turn}`, conteudo: '# a'});
    assert.throws(() => stack.services.noteSave(null, {titulo: 'A4', conteudo: '# a'}), ptMatches(/Limite de 3 notas/));
    stack.state.conversation = 'sessao-b';
    for (let turn = 1; turn <= 3; turn += 1) stack.services.noteSave(null, {titulo: `B${turn}`, conteudo: '# b'});
    assert.throws(() => stack.services.noteSave(null, {titulo: 'B4', conteudo: '# b'}), ptMatches(/Limite de 3 notas/));
    assert.equal(stack.notes().length, 6);
  } finally {
    stack.done();
  }
});

test('nota inválida não consome o teto; sessão trocada continua valendo', () => {
  const stack = studyStack();
  try {
    assert.throws(() => stack.services.noteSave(null, {titulo: '../../fora', conteudo: 'x'}), ptMatches(/Título de nota inválido/));
    for (let turn = 1; turn <= 3; turn += 1) stack.services.noteSave(null, {titulo: `Vale ${turn}`, conteudo: '# v'});
    assert.throws(() => stack.services.noteSave({courseId: 'outra'}, {titulo: 'X', conteudo: 'x'}), ptMatches(/sessão mudou/i));
  } finally {
    stack.done();
  }
});

test('a recusa manda o tutor contar ao aluno o que não foi salvo, em pt-BR e en', () => {
  const stack = studyStack();
  try {
    for (let turn = 1; turn <= 3; turn += 1) stack.services.noteSave(null, {titulo: `N${turn}`, conteudo: '# n'});
    let raw = '';
    try {
      stack.services.noteSave(null, {titulo: 'N4', conteudo: '# n'});
    } catch (error) {
      raw = String(error.message);
    }
    assert.match(ptText(raw), /esta nota não foi salva.*Diga ao aluno o que ficou sem salvar/s);
    assert.match(enText(raw), /this note was not saved.*Tell the student what was left unsaved/s);
  } finally {
    stack.done();
  }
});

test('a ponte de material (caminho do OpenCode) aplica o mesmo teto', async () => {
  const stack = studyStack();
  const bridge = createTutorMaterialBridge({createMaterial: async () => ({}), createNote: (scope, payload) => stack.services.noteSave(scope, payload)});
  await bridge.start();
  try {
    const grant = bridge.grant({courseId: 'curso', session: 'sessao-a', freeSessionId: ''});
    const post = (titulo) => fetch(grant.url.replace(/\/pdf$/, '/notes'), {
      method: 'POST',
      headers: {'content-type': 'application/json', 'x-mesa-token': grant.token},
      body: JSON.stringify({titulo, conteudo: '# via ponte'}),
    });
    for (let turn = 1; turn <= 3; turn += 1) assert.equal((await post(`Ponte ${turn}`)).status, 200);
    const refused = await post('Ponte 4');
    assert.equal(refused.status, 400);
    assert.match(ptText((await refused.json()).error), /Limite de 3 notas por turno/);
    assert.equal(stack.notes().length, 3, 'a recusada não cria arquivo');
  } finally {
    await bridge.close();
    stack.done();
  }
});
