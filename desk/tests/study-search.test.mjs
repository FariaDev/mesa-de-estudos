/* Busca de estudos (Mesa): o módulo de host `src/study-data/search.cjs`.
 *
 * O caminho real: o diálogo manda `{query, scope, limit}` por IPC, o main chama
 * `search(runtime, {query, scope, limit, courses})` — os caminhos das matérias
 * vêm SEMPRE da lista autorizada do host — e o resultado volta com id opaco e
 * trecho. `resolve(runtime, id, {courses})` transforma o id no destino
 * (conversa, PDF/página, item do Caderno, anotação) reconferindo a biblioteca.
 *
 * Fixtures sintéticas em runtime temporário: nenhuma sessão, config ou material
 * real é tocado. O PDF de teste é o PDF.js de verdade (extração real).
 */
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const DESK = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const search = require(path.join(DESK, 'src', 'study-data', 'search.cjs'));
const notes = require(path.join(DESK, 'src', 'study-data', 'annotations.cjs'));
const free = require(path.join(DESK, 'free-workspaces.cjs'));

const runtimes = [];
after(() => {
  for (const dir of runtimes) {
    try {
      fs.rmSync(dir, {recursive: true, force: true});
    } catch { /* já foi */ }
  }
});

/* PDF mínimo com texto extraível; WinAnsiEncoding para o acento sair certo. */
function tinyPdf(pages) {
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
  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((object, index) => {
    offsets.push(out.length);
    out += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const startxref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${startxref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

function writeJsonl(file, records) {
  fs.writeFileSync(file, records.map((record) => JSON.stringify(record)).join('\n') + '\n');
}

const UUID_A = '123e4567-e89b-42d3-a456-426614174000';
const UUID_B = '123e4567-e89b-42d3-a456-426614174001';
const UUID_C = '123e4567-e89b-42d3-a456-426614174002';

/* Runtime sintético completo: duas matérias, conversas Pi/Claude/lateral,
 * Caderno, anotação, sessão Livre e PDFs com texto real. */
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-study-search-'));
  runtimes.push(root);
  const runtime = path.join(root, 'runtime');
  fs.mkdirSync(runtime, {recursive: true});
  const courses = [
    {id: 'Calculo', name: 'Cálculo I', path: path.join(root, 'Cursos', 'Calculo')},
    {id: 'Fisica', name: 'Física I', path: path.join(root, 'Cursos', 'Fisica')},
  ];
  for (const course of courses) fs.mkdirSync(course.path, {recursive: true});

  const calcPdf = path.join(courses[0].path, 'Limites e derivadas.pdf');
  fs.writeFileSync(calcPdf, tinyPdf([['Formulário: calculo de limites no infinito'], ['A derivada da função do segundo grau', 'e o teste da segunda derivada']]));
  const fisicaPdf = path.join(courses[1].path, 'Cinemática.pdf');
  fs.writeFileSync(fisicaPdf, tinyPdf([['Cinemática vetorial e velocidade média']]));

  const piCalc = path.join(runtime, 'pi-1700000000000.jsonl');
  writeJsonl(piCalc, [
    {type: 'session', id: 'sessao-calc'},
    {type: 'message', message: {role: 'user', content: [{type: 'text', text: 'Explique cálculo de limites no infinito'}]}},
    {type: 'message', message: {role: 'assistant', content: [
      {type: 'thinking', thinking: 'SEGREDO-PENSAMENTO'},
      {type: 'text', text: 'O limite de f no infinito é o comportamento assintótico.'},
      {type: 'toolCall', name: 'read_file', arguments: {path: 'SEGREDO-TOOL'}},
      {type: 'toolResult', text: 'SEGREDO-RESULTADO'},
      {type: 'image', data: 'SEGREDO-IMAGEM', mimeType: 'image/png'},
    ]}},
    {type: 'message', message: {role: 'user', content: 'e a derivada?'}, timestamp: 1700000001000},
  ]);
  const piFisica = path.join(runtime, 'pi-1700000002000.jsonl');
  writeJsonl(piFisica, [
    {type: 'message', message: {role: 'user', content: [{type: 'text', text: 'Força e movimento na rampa'}]}},
    {type: 'message', message: {role: 'assistant', content: [{type: 'text', text: 'A força resultante acelera o bloco.'}]}},
  ]);
  fs.writeFileSync(path.join(runtime, 'desk.json'), JSON.stringify({
    courseId: 'Calculo',
    session: piCalc,
    courseStates: {
      Calculo: {session: piCalc, sessions: [{path: piCalc, started: 1700000000000, preview: 'Explique cálculo de limites'}]},
      Fisica: {session: piFisica, sessions: [{path: piFisica, started: 1700000002000, preview: 'Força e movimento'}]},
    },
  }));

  const conversationsDir = path.join(runtime, 'conversations');
  fs.mkdirSync(conversationsDir, {recursive: true});
  fs.writeFileSync(path.join(conversationsDir, `claude-${UUID_A}.json`), JSON.stringify({
    schemaVersion: 1,
    engine: 'claude',
    id: UUID_A,
    nativeSessionId: UUID_B,
    nativeEstablished: true,
    courseId: 'Calculo',
    started: 1700000003000,
    preview: 'Conversa Claude sobre integrais',
    messages: [
      {role: 'user', content: [{type: 'text', text: 'Como resolvo integrais por partes?'}]},
      {role: 'assistant', content: [{type: 'thinking', thinking: 'SEGREDO-CLAUDE'}, {type: 'text', text: 'Use a regra do produto ao contrário.'}]},
    ],
  }));

  const sidechatsDir = path.join(runtime, 'sidechats');
  fs.mkdirSync(sidechatsDir, {recursive: true});
  fs.writeFileSync(path.join(sidechatsDir, `sc-${UUID_C}.json`), JSON.stringify({
    schemaVersion: 1,
    id: `sc-${UUID_C}`,
    engine: 'pi',
    mainSession: piCalc,
    courseId: 'Calculo',
    createdAt: 1700000004000,
    updatedAt: 1700000005000,
    draft: '',
    contextDeliveredKey: '',
    session: path.join(sidechatsDir, `sc-${UUID_C}.jsonl`),
    context: {mainSession: piCalc, refs: [], study: {title: '', xopp: ''}, at: 1700000004000, digest: 'd', key: 'k'},
    messages: [
      {role: 'user', content: [{type: 'text', text: '[Contexto do chat lateral]\nDIGEST-SEGREDO\n[Fim do contexto do chat lateral]\n\nDúvida lateral sobre séries'}]},
      {role: 'assistant', content: [{type: 'text', text: 'Uma série converge quando a soma parcial tem limite.'}]},
    ],
  }));

  fs.writeFileSync(path.join(runtime, 'review.json'), JSON.stringify({
    Calculo: [
      {question: 'Limite no infinito', attempt: 'dividi por x', difficulty: 'travei na fatoração', ref: {name: 'Limites e derivadas.pdf', page: 2, path: calcPdf}},
      {question: 'Derivada da função quadrática', attempt: '', difficulty: '', ref: {name: 'Limites e derivadas.pdf', page: 2, path: calcPdf}},
    ],
  }));

  notes.saveNote(runtime, {courseId: 'Calculo'}, {
    mode: 'add',
    authorizedPaths: [calcPdf],
    item: {kind: 'duvida', quote: 'Formulário de calculo de área', note: 'dúvida sobre integral', ref: {name: 'Limites e derivadas.pdf', rel: 'Limites e derivadas.pdf', path: calcPdf, page: 3}},
  });

  free.ensureWorkspace(runtime, {sessionId: 'sess-livre', title: 'Sessão Livre de Cálculo'});
  free.importPdf(runtime, 'sess-livre', {sourcePath: calcPdf, name: 'limites-livre'});
  const freeSession = path.join(runtime, 'free', 'sess-livre', `pi-${UUID_A}.jsonl`);
  writeJsonl(freeSession, [
    {type: 'message', message: {role: 'user', content: [{type: 'text', text: 'Sessão avulsa sobre polinômios'}]}},
  ]);
  free.setNativePath(runtime, 'sess-livre', freeSession);

  return {root, runtime, courses, calcPdf, fisicaPdf, piCalc, conversationsDir, sidechatsDir};
}

/* Relógio parado: o orçamento de tempo da busca (`timeBudgetMs`) tem teste
 * próprio, abaixo. Com o relógio real, a extração do primeiro PDF (com o
 * import frio do PDF.js) passava do orçamento sob carga e os PDFs seguintes
 * ficavam para a próxima busca — o teste de cobertura reprovava às vezes. */
const STILL = () => 0;
async function find(fx, query, extra = {}) {
  return search.search(fx.runtime, {query, courses: fx.courses, nowMs: STILL, ...extra});
}

test('resultado cobre conversa, lateral, caderno, anotação, livre, matéria e PDF com página', async () => {
  const fx = fixture();
  const limites = await find(fx, 'limite');
  const bySource = (source) => limites.hits.filter((hit) => hit.source === source);

  const conversation = bySource('conversa')[0];
  assert.ok(conversation, 'conversa Pi encontrada');
  assert.match(conversation.snippet, /limites/i);
  assert.equal(search.resolve(fx.runtime, conversation.id, {courses: fx.courses}).sessionPath, fx.piCalc);

  const review = bySource('caderno')[0];
  assert.ok(review, 'item do Caderno encontrado');
  assert.equal(review.page, 2);
  const reviewDest = search.resolve(fx.runtime, review.id, {courses: fx.courses});
  assert.equal(reviewDest.kind, 'review');
  assert.equal(reviewDest.courseId, 'Calculo');
  assert.equal(reviewDest.page, 2);

  const pdf = bySource('pdf').find((hit) => hit.fileName === 'Limites e derivadas.pdf' && hit.page === 1);
  assert.ok(pdf, 'texto do PDF na página certa');
  assert.match(pdf.snippet, /limites/i);
  const pdfDest = search.resolve(fx.runtime, pdf.id, {courses: fx.courses});
  assert.equal(pdfDest.kind, 'pdf');
  assert.equal(pdfDest.path, fx.calcPdf);
  assert.equal(pdfDest.page, 1);

  const note = bySource('nota')[0];
  assert.ok(note, 'anotação de página encontrada');
  assert.equal(note.page, 3);
  const noteDest = search.resolve(fx.runtime, note.id, {courses: fx.courses});
  assert.equal(noteDest.kind, 'note');
  assert.equal(noteDest.noteKind, 'duvida');

  const freeHit = bySource('livre')[0];
  assert.ok(freeHit, 'sessão Livre encontrada');
  const freeDest = search.resolve(fx.runtime, freeHit.id, {courses: fx.courses});
  assert.equal(freeDest.kind, 'free');
  assert.equal(freeDest.sessionId, 'sess-livre');

  const material = bySource('materia')[0];
  assert.ok(material, 'nome de material encontrado');
  assert.equal(material.openable, true, 'nome de PDF é abrível');
  assert.equal(search.resolve(fx.runtime, material.id, {courses: fx.courses}).name, 'Limites e derivadas.pdf');

  const curso = (await find(fx, 'cálculo')).hits.find((hit) => hit.source === 'materia' && hit.title === 'Cálculo I');
  assert.ok(curso, 'nome da matéria também é resultado');
  assert.equal(curso.openable, false, 'nome de matéria sem arquivo não oferece Abrir');
  assert.equal(search.resolve(fx.runtime, curso.id, {courses: fx.courses}).name, 'Cálculo I');

  const claude = (await find(fx, 'integrais')).hits.find((hit) => hit.source === 'conversa' && hit.fileName.includes('claude'));
  assert.ok(claude, 'conversa Claude encontrada');
  const claudeDest = search.resolve(fx.runtime, claude.id, {courses: fx.courses});
  assert.equal(claudeDest.engine, 'claude');
  assert.match(claudeDest.sessionPath, /claude-.*\.json$/);

  const side = (await find(fx, 'séries')).hits.find((hit) => hit.source === 'lateral');
  assert.ok(side, 'chat lateral encontrado');
  assert.equal(search.resolve(fx.runtime, side.id, {courses: fx.courses}).kind, 'sidechat');

  const fisica = (await find(fx, 'cinemática')).hits.filter((hit) => hit.source === 'pdf' || hit.source === 'materia');
  assert.ok(fisica.some((hit) => hit.fileName === 'Cinemática.pdf'), 'PDF da outra matéria achado');
  const pagina = (await find(fx, 'segunda derivada')).hits.find((hit) => hit.source === 'pdf' && hit.page === 2);
  assert.ok(pagina, 'página 2 do PDF achada pelo texto da página');

  /* PDF copiado para uma sessão Livre: o destino carrega `scope:'free'` e
   * `courseId` vazio — o main precisa mapear isso para `mesa-free` ao abrir. */
  const freePdf = (await find(fx, 'limites')).hits.find((hit) => hit.source === 'pdf' && hit.courseId === 'mesa-free');
  assert.ok(freePdf, 'PDF da sessão Livre aparece na busca');
  const freePdfDest = search.resolve(fx.runtime, freePdf.id, {courses: fx.courses});
  assert.equal(freePdfDest.kind, 'pdf');
  assert.equal(freePdfDest.scope, 'free');
  assert.equal(freePdfDest.courseId, 'mesa-free', 'destino Livre tem dono explícito');
});

test('dobra de acento e caixa acha "Cálculo" com "calculo"; pontuação prioriza título', async () => {
  const fx = fixture();
  const result = await find(fx, 'calculo');
  assert.ok(result.hits.length > 0);
  assert.ok(result.hits.some((hit) => hit.title.includes('Cálculo I') || hit.title.includes('Cálculo') || hit.snippet.includes('Cálculo')), 'acento encontrado');
  assert.equal(result.hits[0].rank, 'titulo', 'casamento de título vem primeiro');
  assert.equal(search.fold('FORMULÁRIO'), 'formulario');
  assert.equal(search.fold('cafe\u0301'), 'cafe');
});

test('ranking: título > começo > palavra > qualquer', async () => {
  const fx = fixture();
  const result = await find(fx, 'derivada');
  const ranks = result.hits.map((hit) => hit.rank);
  const weight = {titulo: 3, inicio: 2, palavra: 1, qualquer: 0};
  for (let index = 1; index < ranks.length; index++) {
    assert.ok(weight[ranks[index - 1]] >= weight[ranks[index]], `ordem de pontuação em ${ranks.join(',')}`);
  }
});

test('filtro de fontes e de matérias limita a leitura sem vazar o resto', async () => {
  const fx = fixture();
  const soCaderno = await find(fx, 'limite', {scope: {sources: ['caderno']}});
  assert.ok(soCaderno.hits.length > 0);
  assert.ok(soCaderno.hits.every((hit) => hit.source === 'caderno'));

  const semPdf = await find(fx, 'limites', {scope: {sources: ['conversa', 'caderno', 'materia', 'nota', 'livre', 'lateral']}});
  assert.equal(semPdf.hits.filter((hit) => hit.source === 'pdf').length, 0, 'texto de PDF não entra sem a fonte pdf');

  const soFisica = await find(fx, 'cinemática', {scope: {courses: ['Fisica']}});
  assert.ok(soFisica.hits.some((hit) => hit.fileName === 'Cinemática.pdf'));
  assert.equal(soFisica.hits.filter((hit) => hit.fileName === 'Limites e derivadas.pdf').length, 0);

  const nenhumaMateria = await find(fx, 'cálculo', {scope: {courses: []}});
  assert.equal(nenhumaMateria.hits.filter((hit) => hit.source === 'materia' || (hit.source === 'pdf' && hit.courseId)).length, 0);
  assert.deepEqual(nenhumaMateria.hits, [], 'nenhuma matéria selecionada exclui inclusive Livre');

  /* Scope é id, nunca caminho: id fora da lista autorizada não lê nada. */
  const idInventado = await find(fx, 'limites', {scope: {courses: ['/etc', 'Calculo']}});
  assert.equal(idInventado.hits.filter((hit) => hit.courseId === '/etc').length, 0);
  const catalog = search.catalog(fx.runtime, {courses: fx.courses});
  assert.deepEqual(catalog.sources.map((source) => source.key), [...search.KNOWN_SOURCES]);
  assert.deepEqual(catalog.courses.map((course) => course.id), ['Calculo', 'Fisica']);
});

test('limites: consulta curta, teto da lista, teto por arquivo e truncado', async () => {
  const fx = fixture();
  const curta = await find(fx, 'a');
  assert.equal(curta.hits.length, 0);
  assert.equal(curta.short, true);

  const limitada = await find(fx, 'limites', {limit: 1});
  assert.equal(limitada.hits.length, 1);
  assert.equal(limitada.limit, 1);

  const acima = await find(fx, 'limites', {limit: 999});
  assert.equal(acima.limit, Number(search.maxQueryChars === undefined ? 50 : 50));
  assert.ok(acima.hits.length <= 50);

  const porArquivo = await find(fx, 'a', {limit: 50});
  for (const prefix of new Set(porArquivo.hits.map((hit) => hit.id.split(':').slice(0, 2).join(':')))) {
    const count = porArquivo.hits.filter((hit) => hit.id.startsWith(prefix)).length;
    assert.ok(count <= 3, `teto por arquivo em ${prefix}: ${count}`);
  }
});

test('índice incremental: reusa o inalterado, reindexa o alterado e invalida', async () => {
  const fx = fixture();
  const first = await find(fx, 'limites');
  assert.ok(first.index.added > 0, 'primeira busca indexa');
  const second = await find(fx, 'limites');
  assert.equal(second.index.added, 0);
  assert.ok(second.index.reused > 0);
  assert.deepEqual(second.hits.map((hit) => hit.id), first.hits.map((hit) => hit.id), 'ids estáveis');

  /* Alterar a sessão (conteúdo + mtime) reindexa só ela. */
  const later = new Date(Date.now() + 5000);
  writeJsonl(fx.piCalc, [
    {type: 'message', message: {role: 'user', content: [{type: 'text', text: 'Agora falamos de matrizes inversas'}]}},
  ]);
  fs.utimesSync(fx.piCalc, later, later);
  const changed = await find(fx, 'matrizes');
  assert.ok(changed.hits.some((hit) => hit.snippet.includes('matrizes')), 'conteúdo novo achado');
  assert.equal(changed.index.added, 1, 'só o arquivo alterado foi reextraído');
  const gone = await find(fx, 'assintótico');
  assert.equal(gone.hits.filter((hit) => hit.source === 'conversa').length, 0, 'conteúdo antigo saiu do índice');

  const removed = search.invalidate(fx.runtime, {source: 'pdf'});
  assert.ok(removed > 0);
  const again = await find(fx, 'limites');
  assert.ok(again.index.added > 0, 'invalidate derruba e a busca reindexa');
  search.clearIndex(fx.runtime);
  assert.equal(fs.existsSync(path.join(fx.runtime, 'study-search', 'index.json')), false);
  const rebuilt = await find(fx, 'limites');
  assert.ok(rebuilt.index.added > 0, 'clearIndex derruba o cache inteiro');
});

test('índice não guarda thinking, ferramenta, anexo nem digest do lateral', async () => {
  const fx = fixture();
  for (const query of ['SEGREDO', 'SEGREDO-TOOL', 'SEGREDO-RESULTADO', 'SEGREDO-IMAGEM', 'SEGREDO-CLAUDE', 'DIGEST-SEGREDO']) {
    const result = await find(fx, query);
    assert.equal(result.hits.length, 0, `"${query}" não pode entrar no índice`);
  }
  const indexText = fs.readFileSync(path.join(fx.runtime, 'study-search', 'index.json'), 'utf8');
  assert.ok(!indexText.includes('SEGREDO'), 'nada sensível no arquivo do índice');
  assert.ok(!indexText.includes('DIGEST-SEGREDO'));
  if (process.platform !== 'win32') {
    assert.equal(fs.statSync(path.join(fx.runtime, 'study-search', 'index.json')).mode & 0o777, 0o600, 'índice nasce privado');
  }
});

test('PDF real: páginas distintas e snippet sem quebrar par substituto', async () => {
  const fx = fixture();
  const result = await find(fx, 'segunda derivada');
  const pdf = result.hits.find((hit) => hit.source === 'pdf');
  assert.ok(pdf);
  assert.equal(pdf.page, 2);
  assert.match(pdf.snippet, /segunda derivada/i);

  const emoji = await find(fx, '🙂', {scope: {sources: ['conversa']}});
  assert.equal(emoji.hits.length, 0);
  const snippet = search.snippetOf('início 🙂 formulário de cálculo', 8, 10);
  assert.ok(!/[\uD800-\uDBFF]$/.test(snippet), 'não termina em par substituto solto');
  for (const character of snippet) {
    assert.ok(character.codePointAt(0) !== undefined);
  }
});

test('JSONL torto não derruba a busca e linha válida continua achando', async () => {
  const fx = fixture();
  fs.appendFileSync(fx.piCalc, '{linha torta\n');
  const result = await find(fx, 'assintótico');
  assert.ok(result.hits.some((hit) => hit.source === 'conversa'));
  assert.ok(result.skipped.errors >= 0);
});

test('chat lateral sem cache no descritor cai no JSONL do canal', async () => {
  const fx = fixture();
  const descriptor = JSON.parse(fs.readFileSync(path.join(fx.sidechatsDir, `sc-${UUID_C}.json`), 'utf8'));
  fs.writeFileSync(path.join(fx.sidechatsDir, `sc-${UUID_C}.json`), JSON.stringify({...descriptor, messages: []}));
  fs.writeFileSync(path.join(fx.sidechatsDir, `sc-${UUID_C}.jsonl`), [
    JSON.stringify({type: 'message', message: {role: 'user', content: [{type: 'text', text: 'Pergunta lateral sobre matrizes'}]}}),
    JSON.stringify({type: 'message', message: {role: 'assistant', content: [{type: 'text', text: 'Resposta lateral sobre determinantes'}]}}),
  ].join('\n') + '\n');
  const result = await find(fx, 'determinantes');
  const hit = result.hits.find((one) => one.source === 'lateral');
  assert.ok(hit, 'JSONL lateral indexado quando o descritor não tem cache');
  assert.equal(search.resolve(fx.runtime, hit.id, {courses: fx.courses}).kind, 'sidechat');
});

test('curso sem caminho é resolvido só dentro do runtime (layout padrão); sem pasta, só metadados', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-study-search-fallback-'));
  runtimes.push(root);
  const runtime = path.join(root, 'runtime');
  const courseDir = path.join(runtime, 'learning', 'Courses', 'Synthetic');
  fs.mkdirSync(courseDir, {recursive: true});
  fs.writeFileSync(path.join(courseDir, 'Limites.pdf'), tinyPdf([['Limites e derivadas no infinito']]));
  fs.writeFileSync(path.join(runtime, 'desk.json'), '{}');
  const courses = [{id: 'Synthetic', name: 'Sintética'}, {id: 'SemPasta', name: 'Sem pasta'}];
  const catalog = search.catalog(runtime, {courses});
  assert.deepEqual(catalog.courses.map((course) => course.id), ['Synthetic', 'SemPasta'], 'catálogo aceita curso sem caminho');
  const found = await search.search(runtime, {query: 'limites', courses, scope: {sources: ['pdf'], courses: ['Synthetic']}});
  assert.ok(found.hits.some((hit) => hit.source === 'pdf' && hit.fileName === 'Limites.pdf'), 'layout padrão do runtime resolve o PDF');
  const byName = await search.search(runtime, {query: 'sem pasta', courses});
  assert.ok(byName.hits.some((hit) => hit.source === 'materia' && hit.courseId === 'SemPasta'), 'curso sem pasta busca pelo nome');
});

test('orçamento de tempo estourado: a busca avisa que é parcial e a seguinte continua do cache', async () => {
  const fx = fixture();
  let now = 0;
  const slowPdf = async (file) => {
    now += 3000; /* uma extração lenta passa sozinha do orçamento */
    return [{page: 1, text: `Texto de ${path.basename(file)} sobre limites`}];
  };
  const run = () => find(fx, 'limites', {scope: {sources: ['pdf']}, nowMs: () => now, pdfText: slowPdf});
  /* Três PDFs (a cópia da sessão Livre vem antes dos da matéria): cada busca
   * termina a extração que começou e para no orçamento; só a última não
   * deixa nada para trás. */
  const files = (result) => new Set(result.hits.map((hit) => hit.fileName)).size;
  for (let round = 1; round <= 3; round++) {
    const result = await run();
    assert.equal(files(result), round, `busca ${round}: um PDF a mais que a anterior, do cache`);
    assert.equal(result.truncated, round < 3, `busca ${round}: avisa que é parcial enquanto sobra PDF`);
  }
  const last = await run();
  assert.equal(last.truncated, false, 'com tudo no cache, a busca não é mais parcial');
  assert.equal(last.index.added, 0);
  assert.ok(last.hits.some((hit) => hit.fileName === 'Limites e derivadas.pdf' && hit.page === 1), 'o PDF da matéria aparece');
  assert.equal(files(last), 3);
});

test('busca vazia/curta devolve o formato vazio sem tocar no índice', async () => {
  const fx = fixture();
  const empty = await find(fx, '   ');
  assert.deepEqual(empty.hits, []);
  assert.equal(empty.truncated, false);
  assert.equal(fs.existsSync(path.join(fx.runtime, 'study-search', 'index.json')), false);
});

test('provider de PDF injetado é respeitado (o root decide como extrair)', async () => {
  const fx = fixture();
  const seen = [];
  const result = await search.search(fx.runtime, {
    query: 'texto injetado',
    courses: fx.courses,
    scope: {sources: ['pdf'], courses: ['Calculo']},
    pdfText: async (file) => {
      seen.push(path.basename(file));
      return [{page: 7, text: 'Texto injetado para o teste'}];
    },
  });
  assert.ok(seen.includes('Limites e derivadas.pdf'));
  const hit = result.hits.find((item) => item.source === 'pdf');
  assert.ok(hit);
  assert.equal(hit.page, 7);
});

/* ---------- rótulos da biblioteca de conversas ---------- */

function labelKey(courseId, file, runtime) {
  return JSON.stringify([courseId, path.relative(runtime, file)]);
}

function writeChatLabels(fx, items) {
  fs.writeFileSync(path.join(fx.runtime, 'chat-library.json'), `${JSON.stringify({version: 1, items})}\n`);
}

test('rótulos da biblioteca entram na busca: título, assunto, favorito e id original', async () => {
  const fx = fixture();
  const key = labelKey('Calculo', fx.piCalc, fx.runtime);
  writeChatLabels(fx, {[key]: {title: 'Propriedades dos limites', topic: 'Trigonometria', favorite: true}});

  const byTitle = (await find(fx, 'propriedades', {scope: {sources: ['conversa']}})).hits.find((hit) => hit.source === 'conversa');
  assert.ok(byTitle, 'título da biblioteca encontra a conversa');
  assert.equal(byTitle.title, 'Propriedades dos limites');
  assert.equal(byTitle.topic, 'Trigonometria');
  assert.equal(byTitle.favorite, true);
  assert.match(byTitle.chatId, /^chat-[a-f0-9]{32}$/);

  const byTopic = (await find(fx, 'trigonometria', {scope: {sources: ['conversa']}})).hits.find((hit) => hit.source === 'conversa');
  assert.ok(byTopic, 'assunto da biblioteca encontra a conversa');
  assert.equal(byTopic.chatId, byTitle.chatId);

  const destination = search.resolve(fx.runtime, byTitle.id, {courses: fx.courses});
  assert.equal(destination.kind, 'conversation');
  assert.equal(destination.chatId, byTitle.chatId, 'o destino leva o id original da biblioteca');

  /* O rótulo muda sem o arquivo da sessão mudar: o cache reindexa o título. */
  const before = await find(fx, 'propriedades', {scope: {sources: ['conversa']}});
  assert.equal(before.index.added, 0, 'segunda busca reusa o índice');
  writeChatLabels(fx, {[key]: {title: 'Limites no infinito', topic: 'Trigonometria', favorite: false}});
  const relabeled = await find(fx, 'infinito', {scope: {sources: ['conversa']}});
  assert.ok(relabeled.hits.some((hit) => hit.source === 'conversa'), 'título novo entra');
  assert.ok(relabeled.index.added >= 1, 'rótulo novo reindexa só o registro afetado');
  assert.equal(relabeled.hits.find((hit) => hit.source === 'conversa').favorite, false);
  assert.equal((await find(fx, 'propriedades', {scope: {sources: ['conversa']}})).hits.filter((hit) => hit.source === 'conversa').length, 0, 'título antigo sai');
});

test('biblioteca de conversas ilegível ou symlink não derruba a busca', async () => {
  const fx = fixture();
  fs.writeFileSync(path.join(fx.runtime, 'chat-library.json'), '{quebrado');
  assert.ok((await find(fx, 'limites')).hits.length > 0, 'arquivo ilegível só não contribui rótulo');
  fs.unlinkSync(path.join(fx.runtime, 'chat-library.json'));
  const external = path.join(fx.runtime, 'external-library.json');
  fs.writeFileSync(external, JSON.stringify({version: 1, items: {}}));
  fs.symlinkSync(external, path.join(fx.runtime, 'chat-library.json'));
  assert.ok((await find(fx, 'limites')).hits.length > 0, 'symlink não é seguido nem interrompe a busca');
});

/* ---------- índice parcial ---------- */

test('mais mensagens que o teto de 400 vira busca parcial, mesmo com cache', async () => {
  const fx = fixture();
  const long = [];
  for (let index = 0; index < 405; index++) long.push({type: 'message', message: {role: 'user', content: `linha numero ${index}`}});
  writeJsonl(fx.piCalc, long);
  fs.writeFileSync(path.join(fx.runtime, 'desk.json'), JSON.stringify({courseId: 'Calculo', session: fx.piCalc, courseStates: {Calculo: {session: fx.piCalc, sessions: [{path: fx.piCalc}]}}}));

  const first = await find(fx, 'linha numero 404', {scope: {sources: ['conversa']}});
  assert.equal(first.hits.length, 0, 'a mensagem além do teto não está indexada');
  assert.equal(first.truncated, true, 'a primeira busca já avisa do índice parcial');
  assert.ok(first.partial >= 1);

  const cached = await find(fx, 'linha numero 4', {scope: {sources: ['conversa']}});
  assert.ok(cached.hits.length > 0);
  assert.equal(cached.truncated, true, 'o cache reusado continua avisando que é parcial');
  assert.equal(cached.index.added, 0);
});

test('fala acima de 4000 caracteres é parcial e o fim não fica escondido sem status', async () => {
  const fx = fixture();
  writeJsonl(fx.piCalc, [{type: 'message', message: {role: 'user', content: `${'palavra '.repeat(600)}MARCADORFIM`}}]);
  const result = await find(fx, 'marcadorfim', {scope: {sources: ['conversa']}});
  assert.equal(result.hits.length, 0, 'o trecho além do teto não casa');
  assert.equal(result.truncated, true);
  assert.ok(result.partial >= 1);
});

/* ---------- escopo estrangeiro e fontes vazias ---------- */

test('nota e Caderno de matéria fora da lista autorizada não aparecem nem resolvem', async () => {
  const fx = fixture();
  notes.saveNote(fx.runtime, {courseId: 'Orfa'}, {
    mode: 'add',
    authorizedPaths: [fx.calcPdf],
    item: {kind: 'nota', quote: 'escopo orfao unico', note: '', ref: {name: 'Limites e derivadas.pdf', rel: 'Limites e derivadas.pdf', path: fx.calcPdf, page: 1}},
  });
  const orphanNote = notes.readNotes(fx.runtime, {courseId: 'Orfa'})[0];
  const store = JSON.parse(fs.readFileSync(path.join(fx.runtime, 'review.json'), 'utf8'));
  store.Orfa = [{question: 'pergunta orfa unica', attempt: '', difficulty: '', ref: {name: 'Limites e derivadas.pdf', page: 1, path: fx.calcPdf}}];
  fs.writeFileSync(path.join(fx.runtime, 'review.json'), JSON.stringify(store));
  const orphanReview = search.reviewKey('Orfa', 'pergunta orfa unica', fx.calcPdf, 1);

  const notesFound = await find(fx, 'orfao unico');
  assert.equal(notesFound.hits.filter((hit) => hit.source === 'nota').length, 0, 'nota de curso removido fica fora');
  const reviewFound = await find(fx, 'pergunta orfa');
  assert.equal(reviewFound.hits.filter((hit) => hit.source === 'caderno').length, 0, 'item do Caderno de curso removido fica fora');

  assert.equal(search.resolve(fx.runtime, `nt:${orphanNote.id}`, {courses: fx.courses}).ok, false, 'a ID da nota órfã não resolve');
  assert.equal(search.resolve(fx.runtime, `rv:${orphanReview}`, {courses: fx.courses}).ok, false, 'a ID do Caderno órfão não resolve');

  /* A matéria autorizada continua normal. */
  assert.ok((await find(fx, 'limite')).hits.some((hit) => hit.source === 'nota'), 'nota da matéria configurada continua');
});

test('lista explícita de fontes vazia significa nenhuma fonte, não todas', async () => {
  const fx = fixture();
  const result = await find(fx, 'limites', {scope: {sources: []}});
  assert.deepEqual(result.hits, []);
  assert.deepEqual(result.sources, []);
  assert.equal(result.truncated, false);
  assert.ok((await find(fx, 'limites', {scope: {}})).hits.length > 0, 'escopo ausente continua todas as fontes');
});

test('arquivo apagado sai do índice na busca seguinte', async () => {
  const fx = fixture();
  const first = await find(fx, 'assintótico');
  assert.ok(first.hits.some((hit) => hit.source === 'conversa'));
  fs.rmSync(fx.piCalc);
  const after = await find(fx, 'assintótico');
  assert.equal(after.hits.filter((hit) => hit.source === 'conversa').length, 0);
  assert.ok(after.index.removed >= 1, 'o registro apagado foi removido do índice');
  const index = JSON.parse(fs.readFileSync(path.join(fx.runtime, 'study-search', 'index.json'), 'utf8'));
  assert.ok(!Object.values(index.files).some((record) => record?.file === fx.piCalc), 'nada de arquivo apagado no cache');
});


test('seleção exclusiva da matéria exclui Livre e conversas sem dono, inclusive com cache', async () => {
 const fx = fixture();
 const orphan = path.join(fx.runtime, 'pi-9999999999999.jsonl');
 writeJsonl(orphan, [{type:'message',message:{role:'user',content:'limites privados sem matéria'}}]);
 notes.saveNote(fx.runtime,{courseId:'mesa-free',freeSessionId:'sess-livre'},{mode:'add',authorizedPaths:[],item:{kind:'nota',quote:'limites no Livre',note:'limites avulsos',ref:{path:'',page:1}}});
 for(let i=0;i<2;i++){
  const calc = await find(fx, 'limites', {scope:{courses:['Calculo']}});
  assert.ok(calc.hits.length);
  assert.ok(calc.hits.every(hit=>hit.courseId==='Calculo'));
  const livre = await find(fx, 'limites', {scope:{courses:['mesa-free']}});
  assert.ok(livre.hits.some(hit=>hit.source==='pdf'));
  assert.ok(livre.hits.some(hit=>hit.source==='nota'));
  assert.ok(livre.hits.every(hit=>hit.courseId==='mesa-free'||hit.courseId.startsWith('free:')));
  const all = await find(fx,'limites');
  assert.ok(all.hits.some(hit=>hit.fileName===path.basename(orphan)));
 }
});
