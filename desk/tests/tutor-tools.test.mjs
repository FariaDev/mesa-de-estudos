/* Ferramentas novas do tutor (#91): calcular, listar_materiais e salvar_nota.
   O avaliador é o da calculadora da janela; a lista e a nota são recortadas
   pelo host. As pontes entram por fakes nomeados; o disco é um runtime
   temporário de verdade. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {calculateValue} from '../src/extensions/mesa-calc/client.mjs';
import {calcText} from '../src/extensions/mesa-calc/guide.mjs';
import {materialsText} from '../src/extensions/mesa-materials/guide.mjs';
import {noteText} from '../src/extensions/mesa-notes/guide.mjs';
import {createActivityBridge} from '../activity-bridge.cjs';
import {createTutorMaterialBridge, noteRequestProblem} from '../tutor-materials.cjs';
import {saveNote, noteStem} from '../src/study-data/course-notes.cjs';
import {materialPdfTool, mesaTools} from '../src/extensions/mesa-mcp/tools.mjs';
import {createStudyServices} from '../src/study-data/services.cjs';

const require = createRequire(import.meta.url);
const free = require('../free-workspaces.cjs');
const core = require('../src/generated/tutornotes.core.js').default;

const newRuntime = () => mkdtempSync(join(tmpdir(), 'mesa-tutor-tools-'));
const scopeOf = (over = {}) => ({courseId: 'curso', conversation: 'sessao', freeSessionId: '', ...over});

test('calcular usa o avaliador local, com RAD por padrão e graus explícito', async () => {
  assert.equal(await calculateValue({expressao: 'sin(pi/2)'}), '1');
  assert.equal(await calculateValue({expressao: 'sin(90)', graus: true}), '1');
  await assert.rejects(calculateValue({expressao: 'x + 1'}), /calc\.err\./);
  assert.equal(calcText('0.5'), 'Resultado: 0.5');
});

test('listar_materiais devolve nome e caminho canônico só de PDFs da sessão', () => {
  const runtime = newRuntime();
  const course = join(runtime, 'curso');
  mkdirSync(course);
  const a = join(course, 'A.pdf');
  const b = join(course, 'B.pdf');
  const md = join(course, 'C.md');
  for (const file of [a, b, md]) writeFileSync(file, 'x');
  try {
    const services = createStudyServices({
      runtime: () => runtime,
      courses: () => [{id: 'curso', name: 'Curso', path: course}, {id: 'mesa-free', name: 'Livre'}],
      scope: () => scopeOf(),
      allowed: () => new Set([a, b, md]),
      persist() {},
    });
    const listed = services.materialList(null);
    assert.deepEqual(listed.materials.map((item) => item.name), ['A.pdf', 'B.pdf']);
    assert.ok(listed.materials.every((item) => item.path === require('node:fs').realpathSync(item.path)));
    assert.equal(listed.truncated, false);
    assert.throws(() => services.materialList({courseId: 'outra'}), /err\.materials\.sessionChanged/);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});

test('listar_materiais na Livre usa o manifesto do workspace da sessão', () => {
  const runtime = newRuntime();
  try {
    free.createWorkspace(runtime, {sessionId: 'sess-1', title: 'Livre'});
    const dir = free.workspaceDir(runtime, 'sess-1');
    mkdirSync(dir, {recursive: true});
    const pdf = join(dir, 'Livre.pdf');
    writeFileSync(pdf, 'x');
    const services = createStudyServices({
      runtime: () => runtime,
      courses: () => [{id: 'mesa-free', name: 'Livre'}],
      scope: () => scopeOf({courseId: 'mesa-free', freeSessionId: 'sess-1'}),
      allowed: () => new Set([pdf]),
      persist() {},
    });
    const listed = services.materialList({courseId: 'mesa-free', freeSessionId: 'sess-1'});
    assert.deepEqual(listed.materials, [{name: 'Livre.pdf', path: require('node:fs').realpathSync(pdf)}]);
    assert.throws(() => services.materialList({courseId: 'mesa-free', freeSessionId: 'outra'}), /err\.materials\.sessionChanged/);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});

test('salvar_nota grava em Notas/ sem sobrescrever e recusa título que sai da pasta', () => {
  const runtime = newRuntime();
  try {
    const first = saveNote({root: runtime, title: 'Derivadas', content: '# primeira'});
    assert.equal(first.rel, 'Notas/Derivadas.md');
    assert.equal(readFileSync(first.path, 'utf8'), '# primeira');
    const second = saveNote({root: runtime, title: 'Derivadas', content: '# segunda'});
    assert.equal(second.rel, 'Notas/Derivadas-2.md');
    assert.equal(readFileSync(first.path, 'utf8'), '# primeira');
    assert.equal(readFileSync(second.path, 'utf8'), '# segunda');
    assert.throws(() => saveNote({root: runtime, title: '../../fora', content: 'x'}), /err\.note\.badTitle/);
    assert.throws(() => saveNote({root: runtime, title: '/etc/passwd', content: 'x'}), /err\.note\.badTitle/);
    assert.throws(() => saveNote({root: runtime, title: '   ', content: 'x'}), /err\.note\.badTitle/);
    assert.throws(() => saveNote({root: runtime, title: 'x', content: ''}), /err\.note\.badContent/);
    assert.equal(existsSync(join(runtime, 'fora.md')), false);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});

test('salvar_nota recusa Notas/ que virou link e não escreve fora da raiz', () => {
  const runtime = newRuntime();
  const outside = newRuntime();
  try {
    symlinkSync(outside, join(runtime, 'Notas'));
    assert.throws(() => saveNote({root: runtime, title: 'Limites', content: 'x'}), /err\.note\.badRoot/);
    assert.equal(existsSync(join(outside, 'Limites.md')), false);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
    rmSync(outside, {recursive: true, force: true});
  }
});

test('o título vira nome de arquivo legível e o conteúdo corta no teto do núcleo', () => {
  assert.equal(noteStem('  Derivadas: regra  '), 'Derivadas- regra');
  assert.equal(Number(core.maxTitle()), 120);
  assert.equal(Number(core.maxContent()), 100000);
  const runtime = newRuntime();
  try {
    assert.throws(() => saveNote({root: runtime, title: 'x', content: 'a'.repeat(Number(core.maxContent()) + 1)}), /err\.note\.badContent/);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});

test('ponte de atividades: /materials entrega a lista recortada da concessão', async () => {
  const granted = [];
  const bridge = createActivityBridge({
    publish: async () => ({id: 'a', version: 1, title: 't'}),
    materialList: async (scope) => {
      granted.push(scope);
      return {materials: [{name: 'A.pdf', path: '/c/A.pdf'}], truncated: false};
    },
  });
  await bridge.start();
  try {
    const grant = bridge.grant({courseId: 'curso', conversationId: 'sessao', generation: 1});
    const response = await fetch(grant.url.replace(/\/activity$/, '/materials'), {
      method: 'POST',
      headers: {'content-type': 'application/json', 'x-mesa-token': grant.token},
      body: '{}',
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {listed: true, materials: [{name: 'A.pdf', path: '/c/A.pdf'}], truncated: false});
    assert.equal(granted[0].courseId, 'curso');
  } finally {
    await bridge.close();
  }
});

test('ponte de material: /notes grava com o escopo do grant e valida os campos', async () => {
  const created = [];
  const bridge = createTutorMaterialBridge({
    createMaterial: async () => ({}),
    createNote: async (scope, payload) => {
      created.push({scope, payload});
      return {saved: true, title: 'Limites', rel: 'Notas/Limites.md', path: '/c/Notas/Limites.md'};
    },
  });
  await bridge.start();
  try {
    const grant = bridge.grant({courseId: 'curso', session: 'sessao', freeSessionId: ''});
    const url = grant.url.replace(/\/pdf$/, '/notes');
    const response = await fetch(url, {
      method: 'POST',
      headers: {'content-type': 'application/json', 'x-mesa-token': grant.token},
      body: JSON.stringify({titulo: 'Limites', conteudo: '# a'}),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).saved, true);
    assert.deepEqual(created[0].payload, {titulo: 'Limites', conteudo: '# a'});
    assert.equal(created[0].scope.courseId, 'curso');
    assert.match(noteRequestProblem({titulo: '', conteudo: 'x'}), /err\.note\.invalid/);
  } finally {
    await bridge.close();
  }
});

test('MCP mesa: calcular, listar_materiais e salvar_nota chamam a fonte certa', async () => {
  const grant = {url: 'http://127.0.0.1:9/activity', token: 't'};
  const materialGrant = {url: 'http://127.0.0.1:9/pdf', token: 'm'};
  const tools = mesaTools({
    LEARNING_DESK_ACTIVITY_BRIDGE: JSON.stringify(grant),
    LEARNING_DESK_MATERIAL_BRIDGE: JSON.stringify(materialGrant),
  });
  const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
  assert.equal((await byName.calcular.call({expressao: '2+2'})).content[0].text, 'Resultado: 4');
  assert.deepEqual(Object.keys(byName), ['calcular', 'previsualizar_atividade', 'criar_atividade', 'ver_figura', 'propor_revisao', 'ler_pdf', 'buscar_material', 'listar_materiais', 'criar_pdf', 'salvar_nota']);
  const saved = await byName.salvar_nota.call({titulo: 'Limites', conteudo: 'x'});
  assert.equal(saved.isError, true, 'sem ponte de verdade a chamada é erro, não sucesso inventado');
  const side = mesaTools({LEARNING_DESK_ACTIVITY_BRIDGE: JSON.stringify(grant), LEARNING_DESK_PDF_ONLY: '1'});
  for (const name of ['criar_pdf', 'salvar_nota']) assert.equal(side.some((tool) => tool.name === name), false, `${name} não vai ao chat lateral`);
});

test('criar_pdf no MCP do OpenCode usa o guia do Pi/Claude e a ponte de material', async () => {
  const grant = {url: 'http://127.0.0.1:9/pdf', token: 'm'};
  const calls = [];
  const tool = materialPdfTool({grant, create: async (received, args) => {
    calls.push({received, args});
    return {prepared: true, title: 'Limites', model: 'lista', diagnostics: []};
  }});
  const result = await tool.call({title: 'Limites', markdown: '1. $x+1$', modelo: 'lista', opcoes: {gabarito: true}});
  assert.equal(result.isError, undefined);
  assert.match(result.content[0].text, /Material “Limites” preparado no modelo lista/);
  assert.match(result.content[0].text, /ainda não foi salvo/);
  assert.deepEqual(calls, [{received: grant, args: {title: 'Limites', markdown: '1. $x+1$', modelo: 'lista', opcoes: {gabarito: true}}}]);
});

test('os textos ao tutor listam material e confirmam a nota', () => {
  assert.match(materialsText({materials: [{name: 'A.pdf', path: '/c/A.pdf'}]}), /A\.pdf — \/c\/A\.pdf/);
  assert.match(materialsText({materials: []}), /Nenhum PDF/);
  assert.match(noteText({title: 'Limites', rel: 'Notas/Limites.md'}), /Notas\/Limites\.md/);
});
