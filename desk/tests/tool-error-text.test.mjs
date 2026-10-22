// Texto de erro das ferramentas Claude para o modelo (src/agents/tool-error-text.cjs, #43 fase 3).
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {message} from '../src/i18n.mjs';
const require = createRequire(import.meta.url);
const {toolErrorText} = require('../src/agents/tool-error-text.cjs');

test('toolErrorText traduz a mensagem marcada para a língua do tutor', () => {
  const marked = new Error(message('err.pdf.sessionChanged'));
  assert.equal(toolErrorText(marked, 'pt-BR'), 'A sessão mudou; prepare o PDF na sessão atual.');
  assert.doesNotMatch(toolErrorText(marked, 'en'), /|err\.pdf/);
});

test('toolErrorText deixa texto comum como veio e usa a chave quando não há mensagem', () => {
  assert.equal(toolErrorText(new Error('referência desconhecida'), 'en'), 'referência desconhecida');
  assert.equal(toolErrorText(new Error(''), 'en', 'err.pdfbridge.failed'), 'Could not create the PDF.');
  assert.equal(toolErrorText(undefined, 'xx'), 'Falha na operação.');
});
