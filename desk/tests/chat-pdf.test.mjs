/* Referência de PDF na mensagem: bloco do prompt, chip do histórico e o texto
   que a bolha mostra. O arquivo não entra no texto. */
import test from 'node:test';
import assert from 'node:assert/strict';
import ptBR from '../src/locales/pt-BR.json' with {type: 'json'};
import en from '../src/locales/en.json' with {type: 'json'};
import {createI18n} from '../src/i18n.mjs';
import {pdfAttachmentsBlock, attachedPdfs, normalizePdfFacts, PDF_HEADERS} from '../src/chat-pdf.mjs';
import {displayUserText} from '../text.mjs';
import {historyTurns} from '../src/worklog.mjs';

const translate = (language) => createI18n({catalogs: {'pt-BR': ptBR, en}, language}).t;

const sample = [
  {name: 'Aula.pdf', path: '/c/Aula.pdf', pages: 12},
  {name: 'Notas.pdf', path: '/c/Notas.pdf', pages: 1},
];

test('o bloco nomeia caminho e páginas e o histórico devolve o chip, nos dois idiomas', () => {
  for (const [language, header, many, one] of [
    ['pt-BR', PDF_HEADERS[0], 'Aula.pdf (12 páginas) — /c/Aula.pdf', 'Notas.pdf (1 página) — /c/Notas.pdf'],
    ['en', PDF_HEADERS[1], 'Aula.pdf (12 pages) — /c/Aula.pdf', 'Notas.pdf (1 page) — /c/Notas.pdf'],
  ]) {
    const block = pdfAttachmentsBlock(sample, translate(language), language === 'en' ? 'mcp__mesa__ler_pdf' : 'mesa_ler_pdf');
    assert.match(block, new RegExp(`^\\[${header}\\]`));
    assert.match(block, new RegExp(`  · ${many.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    assert.match(block, new RegExp(`  · ${one.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    assert.doesNotMatch(block, /%PDF/, 'o bloco é referência, sem bytes do arquivo');
    const text = `explica\n\n${block}`;
    assert.deepEqual(attachedPdfs(text), [
      {name: 'Aula.pdf', pages: 12, path: '/c/Aula.pdf'},
      {name: 'Notas.pdf', pages: 1, path: '/c/Notas.pdf'},
    ]);
    assert.equal(displayUserText(text), 'explica');
  }
});

test('mensagem só com PDF continua um turno, e o contexto da mesa não esconde o chip', () => {
  const block = pdfAttachmentsBlock(sample.slice(0, 1), translate('pt-BR'), 'mesa_ler_pdf');
  const only = historyTurns([{role: 'user', content: [{type: 'text', text: `\n\n${block}`}], timestamp: 1}]);
  assert.equal(only.length, 1);
  assert.equal(only[0].userText, '');
  assert.equal(only[0].userPdfs[0].path, '/c/Aula.pdf');
  const withContext = `oi\n\n[Contexto da Mesa]\ncurso\n\n${block}`;
  assert.equal(displayUserText(withContext), 'oi');
  assert.equal(attachedPdfs(withContext)[0].pages, 12);
  const [turn] = historyTurns([{role: 'user', content: [{type: 'text', text: withContext}], timestamp: 2}]);
  assert.equal(turn.userText, 'oi');
  assert.equal(turn.userPdfs.length, 1);
});

test('normalizePdfFacts fica nos caminhos absolutos, sem repetir, até 4', () => {
  const raw = [
    {path: 'relativo.pdf', pages: 3},
    {path: '/c/Aula.pdf', name: 'Aula.pdf', pages: 0},
    {path: '/c/Aula.pdf', pages: 9},
    {path: 'C:\\Curso\\Notas.pdf', pages: 2},
    {path: '/c/B.pdf', pages: 1},
    {path: '/c/C.pdf', pages: 1},
    {path: '/c/D.pdf', pages: 1},
    {path: '/c/E.pdf', pages: 1},
  ];
  assert.deepEqual(normalizePdfFacts(raw), [
    {path: '/c/Aula.pdf', name: 'Aula.pdf', pages: 1},
    {path: 'C:\\Curso\\Notas.pdf', name: 'Notas.pdf', pages: 2},
    {path: '/c/B.pdf', name: 'B.pdf', pages: 1},
    {path: '/c/C.pdf', name: 'C.pdf', pages: 1},
  ]);
  assert.equal(pdfAttachmentsBlock([], translate('pt-BR')), '');
});

test('normalizePdfFacts aceita UNC e caminho longo do Windows', () => {
  const raw = [
    {path: '\\\\servidor\\Compartilhado\\Aula.pdf', pages: 3},
    {path: '\\\\?\\C:\\Curso\\Aula longa.pdf', pages: 4},
    {path: '\\\\?\\UNC\\servidor\\Compartilhado\\B.pdf', pages: 5},
  ];
  assert.deepEqual(normalizePdfFacts(raw), [
    {path: '\\\\servidor\\Compartilhado\\Aula.pdf', name: 'Aula.pdf', pages: 3},
    {path: '\\\\?\\C:\\Curso\\Aula longa.pdf', name: 'Aula longa.pdf', pages: 4},
    {path: '\\\\?\\UNC\\servidor\\Compartilhado\\B.pdf', name: 'B.pdf', pages: 5},
  ]);
});
