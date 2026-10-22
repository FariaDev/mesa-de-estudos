/* Menções `@` das ferramentas (#53), lado do host e do texto: ids válidos, o
   bloco de instrução no idioma do aluno e o corte do bloco na bolha e na prévia
   da lista de sessões. A regra de quem aparece e dos chips é do núcleo
   (`core/toolmentions.bend`, provas em `core/proofs/`). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {displayUserText} from '../text.mjs';
import {icon} from '../icons.mjs';
import toolMentionsCore from '../src/generated/toolmentions.core.js';
const require = createRequire(import.meta.url);
const {validMentions, mentionBlock, offeredIds} = require('../mentions-host.cjs');
const pending = require('../pending.cjs');

test('a lista oferecida segue o motor: sem GeoGebra, ele não aparece', () => {
  assert.deepEqual(offeredIds(true), ['geogebra', 'visualizar', 'atividade', 'pdf']);
  assert.deepEqual(offeredIds(false), ['visualizar', 'atividade', 'pdf']);
});

test('#70: todo ícone da lista existe no host, e o de @visualizar é o quadro', () => {
  const tools = [];
  for (let node = toolMentionsCore.offered(true); node.$ === 'Con'; node = node.tail) tools.push(node.head);
  for (const tool of tools) assert.match(icon(tool.icon), /^<svg /, `ícone ${tool.icon} de @${tool.id} no icons.mjs`);
  assert.equal(tools.find((tool) => tool.id === 'visualizar').icon, 'board');
});

test('validMentions aceita só ids oferecidos, sem repetir e até o teto de chips', () => {
  assert.deepEqual(validMentions(undefined, true), []);
  assert.deepEqual(validMentions(['geogebra', 'geogebra', 'pdf'], true), ['geogebra', 'pdf']);
  assert.deepEqual(validMentions(['geogebra', 'visualizar', 'atividade', 'pdf'], true), ['geogebra', 'visualizar', 'atividade']);
  assert.throws(() => validMentions(['geogebra'], false), /Ferramenta "geogebra" desconhecida; esperado um de visualizar, atividade, pdf/);
  assert.throws(() => validMentions('geogebra', true), /esperado uma lista de ids/);
  assert.throws(() => validMentions([7], true), /Ferramenta 7 desconhecida/);
});

test('o bloco leva o cabeçalho com os ids e a instrução no idioma do aluno', () => {
  const pt = mentionBlock(['geogebra', 'pdf'], 'pt-BR');
  assert.match(pt, /^\n\n\[Ferramenta pedida na Mesa: geogebra, pdf\]\nO aluno pediu a ferramenta geogebra:.* O aluno pediu um PDF/);
  const en = mentionBlock(['visualizar'], 'en');
  assert.match(en, /^\n\n\[Ferramenta pedida na Mesa: visualizar\]\nThe student asked for a visualization: use the criar_atividade tool with kind "visualizacao"/);
  assert.equal(mentionBlock([], 'en'), '');
  assert.equal(en.trim().split('\n').length, 2, 'cabeçalho e uma linha de instruções');
});

test('a bolha do aluno não mostra o bloco, nem com o contexto da Mesa depois dele', () => {
  const block = mentionBlock(['geogebra'], 'pt-BR');
  assert.equal(displayUserText('Desenhe a parábola' + block), 'Desenhe a parábola');
  assert.equal(displayUserText('Desenhe a parábola' + block + '\n\n[Contexto da Mesa]\ncurso: Cálculo'), 'Desenhe a parábola');
  assert.equal(displayUserText('Desenhe a parábola'), 'Desenhe a parábola');
});

test('a fila em disco guarda as menções válidas e ignora o resto', () => {
  const runtime = mkdtempSync(join(tmpdir(), 'mesa-mentions-'));
  try {
    const session = join(runtime, 'pi-1700000000000.jsonl');
    pending.saveQueue(runtime, session, [
      {id: 'a', text: 'com menções', refs: [], images: [], mentions: ['geogebra', 'geogebra', 'ESTRANHO!', 7, 'pdf', 'atividade', 'visualizar']},
      {id: 'b', text: 'sem menções', refs: [], images: []},
    ], false);
    const items = pending.readPending(runtime, session).items;
    assert.deepEqual(items[0].mentions, ['geogebra', 'pdf', 'atividade']);
    assert.equal('mentions' in items[1], false);
  } finally {
    rmSync(runtime, {recursive: true, force: true});
  }
});
