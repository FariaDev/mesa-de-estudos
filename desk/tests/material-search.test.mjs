/* `buscar_material`: a busca offline do índice da Mesa, exposta ao tutor com o
 * escopo FIXO pelo host — a matéria da sessão e só o texto dos PDFs que a
 * biblioteca dela autoriza. PDFs sintéticos (nenhum material de curso) e o
 * pdf.js de verdade, como em `study-search.test.mjs`.
 *
 * Cobre: resultado com arquivo e página, escopo entre matérias e sessões
 * Livre, consulta curta, sem resultado, índice ainda montando, a mesma
 * descrição/esquema nos três motores e o chat lateral. */
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {message, parseMessage} from '../src/i18n.mjs';
import {describeReceived} from '../src/error-detail.mjs';
import {SEARCH_DESCRIPTION, SEARCH_FIELDS, searchText} from '../src/extensions/mesa-search/guide.mjs';
import {searchArgs, courseOf, tutorSearch} from '../src/study-data/material-search.cjs';
import {mesaTools, searchTool} from '../src/extensions/mesa-mcp/tools.mjs';
import {createSearchTool, SEARCH_TOOL_NAME} from '../src/agents/search-tool.cjs';
import {createStudyToolsServer} from '../src/agents/study-tools.cjs';
import {canonical, canonicalFields} from '../src/extensions/tool-fields.mjs';
import {estimateTokens} from '../scripts/measure-prompts.mjs';

const require = createRequire(import.meta.url);
const {createActivityBridge} = require('../activity-bridge.cjs');
const {toolErrorText} = require('../src/agents/tool-error-text.cjs');
const {createStudyServices} = require('../src/study-data/services.cjs');
const free = require('../free-workspaces.cjs');

const FREE_ID = 'mesa-free';
const STILL = () => 0;
const roots = [];
after(() => {
  for (const dir of roots) {
    try { fs.rmSync(dir, {recursive: true, force: true}); } catch { /* já foi */ }
  }
});

/* PDF de uma página por item; acento em WinAnsiEncoding para a dobra funcionar.
   `title` vira o /Info do PDF, como o título que o leitor de PDF mostra. */
function syntheticPdf(pages, title = '') {
  const contents = pages.map((lines) => (Array.isArray(lines) ? lines : [lines]).map((line, index) => `BT /F1 16 Tf 72 ${720 - index * 24} Td (${line}) Tj ET`).join('\n'));
  const kids = pages.map((_, index) => `${4 + index * 2} 0 R`).join(' ');
  const objects = [
    '<</Type/Catalog/Pages 2 0 R>>',
    `<</Type/Pages/Kids[${kids}]/Count ${pages.length}>>`,
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>',
  ];
  contents.forEach((content, index) => {
    objects.push(`<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 3 0 R>>>>/Contents ${5 + index * 2} 0 R>>`);
    objects.push(`<</Length ${content.length}>>\nstream\n${content}\nendstream`);
  });
  const info = title ? 4 + pages.length * 2 : 0;
  if (title) objects.push(`<</Title (${title})>>`);
  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((object, index) => {
    offsets.push(out.length);
    out += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const startxref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<</Size ${objects.length + 1}/Root 1 0 R${info ? `/Info ${info} 0 R` : ''}>>\nstartxref\n${startxref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-material-search-'));
  roots.push(root);
  const runtime = path.join(root, 'runtime');
  fs.mkdirSync(runtime, {recursive: true});
  const courses = [
    {id: 'Calculo', name: 'Cálculo I', path: path.join(root, 'Cursos', 'Calculo')},
    {id: 'Fisica', name: 'Física I', path: path.join(root, 'Cursos', 'Fisica')},
  ];
  for (const course of courses) fs.mkdirSync(course.path, {recursive: true});
  const calcPdf = path.join(courses[0].path, 'Apostila de Cálculo.pdf');
  fs.writeFileSync(calcPdf, syntheticPdf([
    ['Formulário: derivada e limite no infinito'],
    ['Exercício 7b: calcule o limite fundamental com o seno.'],
    ['Resumo da aula sobre integrais por partes'],
  ]));
  const fisicaPdf = path.join(courses[1].path, 'Cinemática.pdf');
  fs.writeFileSync(fisicaPdf, syntheticPdf([['Exercício 7b de cinemática: velocidade média.']]));
  /* Nome do arquivo diferente do título de dentro do PDF, como numa aula
     importada: a busca tem de achar pelos dois. */
  const aulaPdf = path.join(courses[0].path, 'Aula 06.pdf');
  fs.writeFileSync(aulaPdf, syntheticPdf([['Conteúdo da aula sem o título repetido.']], 'Lógica Formal Parte 6'));

  const livreA = free.ensureWorkspace(runtime, {sessionId: 'livre-a', title: 'Sessão A'});
  const copiaA = free.importPdf(runtime, livreA.id, {sourcePath: calcPdf, name: 'Cópia A.pdf'});
  const livreB = free.ensureWorkspace(runtime, {sessionId: 'livre-b', title: 'Sessão B'});
  const copiaB = free.importPdf(runtime, livreB.id, {sourcePath: fisicaPdf, name: 'Cópia B.pdf'});
  return {root, runtime, courses, calcPdf, fisicaPdf, aulaPdf, livreA, livreB, copiaA: copiaA.material.path, copiaB: copiaB.material.path};
}

function find(fx, extra = {}) {
  return tutorSearch(fx.runtime, {courses: fx.courses, courseId: 'Calculo', raw: {consulta: 'exercicio 7b', limite: 5}, nowMs: STILL, ...extra});
}

test('resultado traz o caminho e a página que o ler_pdf usa, no formato compacto', async () => {
  const fx = fixture();
  const result = await find(fx);
  const hit = result.hits.find((one) => one.path === fx.calcPdf);
  assert.ok(hit, `esperava ${fx.calcPdf} nos resultados: ${JSON.stringify(result.hits)}`);
  assert.equal(hit.page, 2);
  assert.match(hit.snippet, /7b/);
  assert.equal(result.indexing, false);
  assert.equal(searchText(result).includes(`${fx.calcPdf}, p. 2:`), true);
  assert.equal(searchText(result).split('\n').every((line) => !line.includes('outra matéria')), true);
});

test('acha a aula pelo título do PDF e pelo nome do arquivo, além do conteúdo', async () => {
  const fx = fixture();
  const byTitle = await tutorSearch(fx.runtime, {courses: fx.courses, courseId: 'Calculo', raw: {consulta: 'Lógica Formal Parte 6'}, nowMs: STILL});
  const titleHit = byTitle.hits.find((hit) => hit.path === fx.aulaPdf);
  assert.ok(titleHit, `esperava ${fx.aulaPdf} pelo título: ${JSON.stringify(byTitle.hits)}`);
  assert.match(titleHit.snippet, /Lógica Formal Parte 6/);
  const byFile = await tutorSearch(fx.runtime, {courses: fx.courses, courseId: 'Calculo', raw: {consulta: 'Aula 06'}, nowMs: STILL});
  assert.ok(byFile.hits.some((hit) => hit.path === fx.aulaPdf), `esperava ${fx.aulaPdf} pelo nome: ${JSON.stringify(byFile.hits)}`);
});

test('escopo não vaza para outra matéria nem para outra sessão Livre', async () => {
  const fx = fixture();
  const fisica = await tutorSearch(fx.runtime, {courses: fx.courses, courseId: 'Fisica', raw: {consulta: 'exercicio 7b'}, nowMs: STILL});
  assert.equal(fisica.hits.some((hit) => hit.path === fx.calcPdf), false, 'a apostila de Cálculo não entra em Física');
  assert.equal(fisica.hits.some((hit) => hit.path === fx.fisicaPdf), true);

  const livres = [{id: FREE_ID, name: 'Livre'}, ...fx.courses];
  const livreA = await tutorSearch(fx.runtime, {courses: livres, courseId: FREE_ID, freeSessionId: 'livre-a', raw: {consulta: 'exercicio 7b'}, nowMs: STILL});
  assert.equal(livreA.hits.some((hit) => hit.path === fx.copiaA), true, 'a cópia da sessão atual entra');
  assert.equal(livreA.hits.some((hit) => hit.path === fx.copiaB), false, 'a cópia da outra sessão Livre não entra');
  assert.equal(livreA.hits.some((hit) => hit.path === fx.calcPdf), false, 'o PDF da matéria não entra na Livre');
});

test('consulta curta ou campo de outro tipo é erro com o recebido e o esperado', async () => {
  const fx = fixture();
  await assert.rejects(find(fx, {raw: {consulta: 'a'}}), (error) => {
    const parsed = parseMessage(error.message);
    assert.equal(parsed?.key, 'err.searchTool.queryShort');
    assert.equal(parsed.args.min, '2');
    assert.equal(parsed.args.length, '1');
    return true;
  });
  await assert.rejects(find(fx, {raw: {consulta: 7}}), (error) => {
    assert.equal(parseMessage(error.message)?.key, 'err.searchTool.queryType');
    return true;
  });
  for (const limite of [0, 51, '5', 2.5]) {
    await assert.rejects(find(fx, {raw: {consulta: 'limite', limite}}), (error) => {
      const parsed = parseMessage(error.message);
      assert.equal(parsed?.key, 'err.searchTool.limit');
      assert.equal(parsed.args.received, describeReceived(limite));
      return true;
    });
  }
  assert.deepEqual(searchArgs({consulta: ' exercício 7b '}), {query: 'exercício 7b', limit: 5});
  assert.equal(courseOf(fx.courses, 'Calculo').name, 'Cálculo I');
  await assert.rejects(find(fx, {courseId: 'Outra'}), (error) => {
    assert.equal(parseMessage(error.message)?.key, 'err.searchTool.course');
    return true;
  });
});

test('o grant com sessão Livre numa matéria não confunde o escopo', async () => {
  const fx = fixture();
  let persisted = 0;
  const services = createStudyServices({
    runtime: () => fx.runtime,
    courses: () => fx.courses,
    scope: () => ({courseId: 'Calculo', conversation: 'sessao-1', freeSessionId: ''}),
    allowed: () => new Set([fx.calcPdf]),
    persist: () => { persisted += 1; },
    log: () => {},
  });
  const result = await services.materialSearch({courseId: 'Calculo', freeSessionId: 'livre-a'}, {consulta: 'exercicio 7b'});
  assert.ok(result.hits.some((hit) => hit.path === fx.calcPdf));
  assert.ok(persisted > 0);
  await assert.rejects(services.materialSearch({courseId: 'Fisica', freeSessionId: ''}, {consulta: 'exercicio 7b'}), (error) => {
    assert.equal(parseMessage(error.message)?.key, 'err.searchTool.sessionChanged');
    return true;
  });
});

test('sem resultado: diz isso e sugere sinônimos ou o número do exercício', async () => {
  const fx = fixture();
  const result = await find(fx, {raw: {consulta: 'zebracornio'}});
  assert.deepEqual(result.hits, []);
  assert.match(searchText(result), /Nenhum resultado/);
  assert.match(searchText(result), /sinônimos/);
  assert.match(searchText(result), /número do exercício/);
});

test('índice ainda montando: avisa e manda usar ler_pdf em vez de concluir que não há', async () => {
  const fx = fixture();
  let calls = 0;
  const nowMs = () => (calls++ === 0 ? 0 : 3000);
  const result = await find(fx, {nowMs});
  assert.deepEqual(result.hits, []);
  assert.equal(result.indexing, true);
  assert.match(searchText(result), /índice/);
  assert.match(searchText(result), /ler_pdf/);
});

test('paridade: os três motores mostram a mesma descrição e o mesmo esquema', async () => {
  const opencode = searchTool({grant: {url: 'http://127.0.0.1:9/activity', token: 't'}, search: async () => ({hits: []})});
  assert.equal(opencode.name, 'buscar_material');
  assert.equal(opencode.description, SEARCH_DESCRIPTION);
  assert.deepEqual(canonical(opencode.inputSchema), canonicalFields(SEARCH_FIELDS));

  const claude = await createSearchTool(async () => ({hits: []}));
  assert.equal(SEARCH_TOOL_NAME, 'mcp__mesa__buscar_material');
  assert.equal(claude.description, SEARCH_DESCRIPTION);
  const {z} = await import('zod');
  const claudeSchema = z.toJSONSchema(z.object(claude.inputSchema), {io: 'input', unrepresentable: 'any'});
  assert.deepEqual(canonical(claudeSchema), canonicalFields(SEARCH_FIELDS));

  /* A extensão do Pi só lê do guia; a prova de ponta a ponta é
     `tests/native-tool-parity.mjs`. */
  const pi = fs.readFileSync(new URL('../src/extensions/mesa-search/index.ts', import.meta.url), 'utf8');
  assert.match(pi, /name: 'mesa_buscar_material'/);
  assert.match(pi, /description: SEARCH_DESCRIPTION/);
  assert.match(pi, /parameters: typeboxObject\(Type, SEARCH_FIELDS\)/);
  assert.ok(estimateTokens(SEARCH_DESCRIPTION) < 200, `descrição com ${estimateTokens(SEARCH_DESCRIPTION)} tokens`);
});

test('chat lateral: ler_pdf e buscar_material juntos nos três motores', async () => {
  const server = await createStudyToolsServer({readPdf: async () => ({}), searchMaterial: async () => ({hits: []})});
  const {Client} = await import('@modelcontextprotocol/sdk/client/index.js');
  const {InMemoryTransport} = await import('@modelcontextprotocol/sdk/inMemory.js');
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({name: 'mesa-search-side', version: '1.0.0'});
  await server.instance.connect(b);
  await client.connect(a);
  try {
    const names = (await client.listTools()).tools.map((tool) => tool.name).sort();
    assert.deepEqual(names, ['buscar_material', 'calcular', 'ler_pdf']);
  } finally {
    await client.close();
    await server.instance.close();
  }
  const grant = JSON.stringify({url: 'http://127.0.0.1:9/activity', token: 't'});
  assert.deepEqual(mesaTools({LEARNING_DESK_ACTIVITY_BRIDGE: grant, LEARNING_DESK_PDF_ONLY: '1'}).map((tool) => tool.name), ['calcular', 'ler_pdf', 'buscar_material', 'listar_materiais']);
  assert.ok(mesaTools({LEARNING_DESK_ACTIVITY_BRIDGE: grant}).some((tool) => tool.name === 'buscar_material'));
});

test('a ponte /search recorta o escopo do grant e traduz o erro pelo tutorText', async () => {
  const seen = [];
  let translated = '';
  const bridge = createActivityBridge({
    publish: async () => { throw Error('não publica'); },
    searchMaterial: async (scope, raw) => {
      seen.push({scope, raw});
      if (raw.consulta === 'erro') throw Error(message('err.searchTool.queryShort', {length: 1, min: 2}));
      return {query: raw.consulta, limit: 5, short: false, truncated: false, indexing: false, hits: [{path: '/c/Apostila.pdf', name: 'Apostila.pdf', page: 7, snippet: 'Exercício 7b'}]};
    },
    tutorText: (raw) => { translated = raw; return 'mensagem traduzida'; },
  });
  await bridge.start();
  try {
    const grant = bridge.grant({conversationId: 'conversa-1', generation: 1, courseId: 'Calculo', freeSessionId: ''}, {engine: 'opencode'});
    const tool = searchTool({grant});
    const ok = await tool.call({consulta: '7b', limite: 3});
    assert.equal(ok.isError, undefined);
    assert.match(ok.content[0].text, /\/c\/Apostila\.pdf, p\. 7: Exercício 7b/);
    assert.deepEqual(seen[0].scope, {conversationId: 'conversa-1', generation: 1, courseId: 'Calculo', freeSessionId: ''});
    assert.deepEqual(seen[0].raw, {consulta: '7b', limite: 3});
    const failed = await tool.call({consulta: 'erro'});
    assert.equal(failed.isError, true);
    assert.equal(failed.content[0].text, 'mensagem traduzida');
    assert.equal(parseMessage(translated)?.key, 'err.searchTool.queryShort');
  } finally {
    await bridge.close();
  }
});

test('erro marcado vira frase no idioma do tutor, sem a marca', () => {
  const error = Error(message('err.searchTool.queryShort', {length: 1, min: 2}));
  const english = toolErrorText(error, 'en');
  assert.match(english, /at least 2/);
  assert.equal(english.includes('\uE000'), false);
});
