// Modelos de PDF do tutor — a ponte JS do núcleo (`core/materialmodel.bend`):
// resolução pedido → último → Livre, opções limpas, rascunho e memória por
// matéria. A regra em si tem leis e provas no núcleo; aqui entra o que o host
// monta em cima.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as model from '../src/materials/model.mjs';
import {structureMaterialTokens, numberEquations, parseQuestionHeading} from '../src/materials/structure.mjs';
import {marked} from 'marked';

const require = createRequire(import.meta.url);

test('os seis modelos, na ordem do seletor, com nome e frase', () => {
  assert.deepEqual(model.MODEL_IDS, ['lista', 'apostila', 'resumo', 'simulado', 'formulario', 'livre']);
  const list = model.modelList();
  assert.equal(list.length, 6);
  for (const entry of list) {
    assert.ok(entry.label && entry.blurb, entry.id);
  }
  assert.equal(model.DEFAULT_MODEL, 'livre');
});

test('resolução: pedido do tutor, depois o último da matéria, depois Livre', () => {
  assert.deepEqual(model.resolveModel({requested: 'lista', last: 'resumo'}), {id: 'lista', source: 'agent'});
  assert.deepEqual(model.resolveModel({last: 'resumo'}), {id: 'resumo', source: 'last'});
  assert.deepEqual(model.resolveModel({}), {id: 'livre', source: 'default'});
  assert.deepEqual(model.resolveModel({requested: 'cartaz', last: 'simulado'}), {id: 'simulado', source: 'last'});
  assert.deepEqual(model.resolveModel({requested: 7, last: null}), {id: 'livre', source: 'default'});
  assert.deepEqual(model.resolveModel({requested: ' Apostila '}), {id: 'apostila', source: 'agent'});
});

test('opções: só as do modelo, cada uma válida ou no padrão', () => {
  assert.deepEqual(model.normalizeOptions('lista', {colunas: 3, gabarito: 'sim', rodape: '  Turma 2  ', equacoes: true}),
    {colunas: '3', gabarito: true, rodape: 'Turma 2'});
  assert.deepEqual(model.normalizeOptions('lista', {colunas: 9}), {colunas: 'auto', gabarito: true, rodape: ''});
  assert.deepEqual(model.normalizeOptions('formulario', {colunas: 1, umafolha: true}), {colunas: 'auto', umafolha: true});
  assert.deepEqual(model.normalizeOptions('simulado', {espaco: 'enorme', valor: false}), {valor: false, espaco: 'medio', gabarito: true});
  assert.deepEqual(model.normalizeOptions('livre', {colunas: 2}), {});
  assert.equal(model.normalizeOptions('apostila', {capitulo: 'x'.repeat(200)}).capitulo.length, model.MAX_OPTION_TEXT);
});

test('colunas Auto: 3 para itens curtos, 1 para longos; rótulo "Auto · N"', () => {
  assert.equal(model.autoColumns('lista', {widestPx: 90, availablePx: 680, gapPx: 24}), 3);
  assert.equal(model.autoColumns('lista', {widestPx: 700, availablePx: 680, gapPx: 24}), 1);
  assert.equal(model.autoColumns('formulario', {widestPx: 500, availablePx: 680, gapPx: 24}), 2);
  assert.equal(model.columnsLabel('auto', 3), 'Auto · 3');
  assert.equal(model.columnsLabel('2', 2), '2');
});

test('espaço de resposta: Grande cabe duas questões por página; longa sobe um degrau', () => {
  assert.ok(model.answerHeightMm('pequeno', false) < model.answerHeightMm('medio', false));
  assert.ok(model.answerHeightMm('medio', false) < model.answerHeightMm('grande', false));
  assert.equal(model.answerHeightMm('pequeno', true), model.answerHeightMm('medio', false));
  assert.ok(2 * (model.answerHeightMm('grande', false) + 20) < 253);
});

test('rascunho antigo vira Livre; origem desconhecida volta ao padrão', () => {
  assert.deepEqual(model.draftModel({id: 'a', title: 't', markdown: 'm'}), {model: 'livre', options: {}, modelSource: 'default'});
  const draft = model.draftModel({model: 'simulado', options: {espaco: 'grande', lixo: 1}, modelSource: 'agent'});
  assert.equal(draft.model, 'simulado');
  assert.equal(draft.options.espaco, 'grande');
  assert.equal('lixo' in draft.options, false);
  assert.equal(model.draftModel({model: 'lista', modelSource: 'changed'}).modelSource, 'default');
});

test('memória por matéria: só modelos conhecidos, teto com os mais recentes', () => {
  const memory = model.sanitizeMemory({
    'course:a': {model: 'lista', options: {colunas: '2'}},
    'course:b': {model: 'cartaz'},
    'free:x': {model: 'resumo'},
    __proto__: {model: 'lista'},
  });
  assert.deepEqual(Object.keys(memory), ['course:a', 'free:x']);
  assert.equal(memory['course:a'].options.colunas, '2');
  assert.deepEqual(model.sanitizeMemory('x'), {});
  const big = {};
  for (let index = 0; index < 205; index += 1) big[`course:${index}`] = {model: 'lista'};
  const kept = model.sanitizeMemory(big);
  assert.equal(Object.keys(kept).length, 200);
  assert.ok(kept['course:204'] && !kept['course:0']);
});

test('assinatura muda com modelo e opções (revisão da prévia)', () => {
  const base = model.modelSignature('lista', {});
  assert.notEqual(base, model.modelSignature('apostila', {}));
  assert.notEqual(base, model.modelSignature('lista', {colunas: 2}));
  assert.equal(base, model.modelSignature('lista', {colunas: 'auto'}));
});

test('adaptador CJS e o módulo ESM são o mesmo', () => {
  const adapter = require('../material-model.cjs');
  assert.equal(adapter.modelId('lista'), model.modelId('lista'));
  assert.deepEqual(adapter.MODEL_IDS, model.MODEL_IDS);
});

/* ---------- estrutura por tokens ---------- */

const html = (markdown, id, options = {}) => {
  const defaults = {...marked.defaults, breaks: true};
  return marked.parser(structureMaterialTokens(marked.lexer(markdown, defaults), id, options), defaults);
};

test('simulado: questão com valor, caixa de resposta e múltipla escolha sem caixa', () => {
  const out = html([
    '## Questão 1 (2,0 pontos)', '', 'Calcule.', '',
    '## Questão 2 (1 ponto)', '', 'Qual?', '', '- ( ) a', '- ( ) b', '',
    '## Questão 3 (3 pontos) {longa}', '', 'Explique.', '',
    '## Gabarito', '', '1. 4',
  ].join('\n'), 'simulado', {valor: true, espaco: 'medio', gabarito: true});
  assert.match(out, /Questão 1<\/strong><span class="pdf-q-v">2,0 pontos/);
  assert.equal((out.match(/class="pdf-resposta"/g) || []).length, 2);
  assert.match(out, /data-choices="1"/);
  /* #42: a alternativa sai com espaço para marcar, "(   )", não "( )" apertado. */
  assert.match(out, /<li>\(\u2007\u2007\u2007\) a<\/li>/);
  assert.equal(out.includes('<li>( ) a'), false, 'nenhuma alternativa fica com "( )" apertado');
  assert.match(out, /data-long="1"[^>]*style="--ans:80mm"/);
  assert.match(out, /<section class="pdf-gabarito" data-break="1">/);
  assert.equal(html('## Questão 1 (2)\n\nx', 'simulado', {valor: false}).includes('pdf-q-v'), false);
});

test('parseQuestionHeading lê número, valor e a marca {longa}', () => {
  assert.deepEqual(parseQuestionHeading('Questão 4 (2,5 pontos) {longa}'), {number: '4', value: '2,5 pontos', long: true});
  assert.deepEqual(parseQuestionHeading('Questão 2a — 1 ponto'), {number: '2a', value: '1 ponto', long: false});
  assert.equal(parseQuestionHeading('Gabarito'), null);
});

test('formulário: numeração contínua entre seções e primeira linha fora das colunas', () => {
  const out = html('Em toda a folha, u=1.\n\n## A\n\n1. x\n2. y\n\n## B\n\n1. z\n', 'formulario');
  assert.ok(out.indexOf('<div class="pdf-cols">') > out.indexOf('Em toda a folha'));
  assert.match(out, /<ol start="3">/);
});

test('resumo: regra em quadro e os dois blocos lado a lado; opção desligada flui normal', () => {
  const md = '**Regra.** $a=b$\n\n## Erros comuns\n\n- x\n\n## Para revisar\n\n- y\n';
  const on = html(md, 'resumo', {regra: true, revisao: true});
  assert.match(on, /<div class="pdf-regra">/);
  assert.match(on, /<div class="pdf-duo">/);
  const off = html(md, 'resumo', {regra: false, revisao: false});
  assert.equal(off.includes('pdf-regra'), false);
  assert.equal(off.includes('pdf-duo'), false);
});

test('apostila: definição, exemplo e numeração (c.n) pelo número escrito no capítulo', () => {
  const out = html('## 2. Seq\n\n**Definição 2.1.** *x*\n\n**Exemplo 03:** y\n', 'apostila');
  assert.match(out, /<div class="pdf-def">/);
  assert.match(out, /<div class="pdf-exemplo">/);
  const numbered = numberEquations('<h3>2. Seq</h3><div class="math-display">a</div><div class="math-display math-error">b</div><div class="math-display">c</div><h3>3. Ap</h3><div class="math-display">d</div>');
  assert.match(numbered, /data-eq="2\.1"/);
  assert.match(numbered, /data-eq="2\.2"/);
  assert.match(numbered, /data-eq="3\.1"/);
});

test('lista: gabarito em seção própria, com página separada só se a opção estiver ligada', () => {
  const md = '1. Q\n\n## Gabarito\n\n1. R\n';
  assert.match(html(md, 'lista', {gabarito: true}), /<section class="pdf-gabarito" data-break="1">/);
  assert.match(html(md, 'lista', {gabarito: false}), /<section class="pdf-gabarito">/);
  assert.equal(html('1. Q', 'lista', {}).includes('pdf-gabarito'), false);
});

test('Livre não muda a estrutura', () => {
  const tokens = marked.lexer('# a\n\n1. b\n');
  assert.equal(structureMaterialTokens(tokens, 'livre', {}), tokens);
});
