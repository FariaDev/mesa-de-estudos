/* Histórico Claude → forma do renderer/exportação (desk/src/agents/history.cjs).
 *
 * O teste fixa o contrato consumido pelo diário (`historyTurns`/`contentParts`):
 * imagem `{data,mimeType}` (base64 puro), texto, toolCall, toolResult separado
 * com `toolCallId`/`isError`; `source`/referências como string; tetos; e a
 * exportação com os títulos exatos `## Você`, `## Pi`, `## Claude`.
 *
 * Sem Electron, sem rede e sem replay: normalizar/exportar não reconstrói
 * entrada de agente.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const history = require('../src/agents/history.cjs');
const {normalizeClaudeMessages, exportConversationMarkdown} = history;

test('normalize desembrulha o SDK e separa texto de toolCall', () => {
  const out = normalizeClaudeMessages([
    {type: 'assistant', message: {role: 'assistant', content: [
      {type: 'text', text: 'resposta'},
      {type: 'thinking', thinking: 'rascunho'},
      {type: 'tool_use', id: 't1', name: 'Read', input: {file_path: '/x'}}
    ]}, timestamp: 123}
  ]);
  assert.deepEqual(out, [{
    role: 'assistant',
    content: [
      {type: 'text', text: 'resposta'},
      {type: 'thinking', thinking: 'rascunho'},
      {type: 'toolCall', id: 't1', name: 'Read', arguments: {file_path: '/x'}}
    ],
    timestamp: 123
  }]);
});

test('imagem: source do SDK vira data/mimeType strings; data URL é desmembrado', () => {
  const sdk = {type: 'user', message: {role: 'user', content: [
    {type: 'image', source: {type: 'base64', media_type: 'image/jpeg', data: 'QUJD'}}
  ]}};
  assert.deepEqual(normalizeClaudeMessages(sdk), [
    {role: 'user', content: [{type: 'image', data: 'QUJD', mimeType: 'image/jpeg'}]}
  ]);

  const flat = {role: 'user', content: [{type: 'image', data: 'QUJD', mimeType: 'image/png'}]};
  assert.deepEqual(normalizeClaudeMessages(flat), [
    {role: 'user', content: [{type: 'image', data: 'QUJD', mimeType: 'image/png'}]}
  ]);

  const url = {role: 'user', content: [{type: 'image', data: 'data:image/webp;base64,QUJD'}]};
  assert.deepEqual(normalizeClaudeMessages(url), [
    {role: 'user', content: [{type: 'image', data: 'QUJD', mimeType: 'image/webp'}]}
  ]);

  const ref = {role: 'user', content: [{type: 'image', data: 'QUJD', mimeType: 'image/png', source: 'captura.png'}]};
  assert.deepEqual(normalizeClaudeMessages(ref), [
    {role: 'user', content: [{type: 'image', data: 'QUJD', mimeType: 'image/png', source: 'captura.png'}]}
  ], 'referência de origem já string fica string');
});

test('tool_result dentro de mensagem user vira mensagem toolResult pareada', () => {
  const out = normalizeClaudeMessages([
    {type: 'user', message: {role: 'user', content: [
      {type: 'text', text: 'segue a saída'},
      {type: 'tool_result', tool_use_id: 't1', content: 'saída', is_error: true}
    ]}}
  ]);
  assert.deepEqual(out, [
    {role: 'user', content: [{type: 'text', text: 'segue a saída'}]},
    {role: 'toolResult', content: [{type: 'text', text: 'saída'}], toolCallId: 't1', isError: true}
  ]);
});

test('mensagem toolResult direta aceita content string e lista de blocos', () => {
  assert.deepEqual(normalizeClaudeMessages({role: 'toolResult', toolCallId: 't7', content: ['a', {type: 'text', text: 'b'}]}), [
    {role: 'toolResult', content: [{type: 'text', text: 'a\nb'}], toolCallId: 't7'}
  ]);
  const error = normalizeClaudeMessages({role: 'toolResult', toolCallId: 't8', content: '', isError: true});
  assert.deepEqual(error, [{role: 'toolResult', content: [{type: 'text', text: ''}], toolCallId: 't8', isError: true}]);
});

test('rolo de entradas: array, objeto único, descritor {messages} e JSONL em string', () => {
  const message = {role: 'user', content: [{type: 'text', text: 'oi'}]};
  assert.deepEqual(normalizeClaudeMessages(message), [message]);
  assert.deepEqual(normalizeClaudeMessages({messages: [message]}), [message]);
  assert.deepEqual(normalizeClaudeMessages(JSON.stringify([message])), [message]);
  assert.deepEqual(normalizeClaudeMessages(`${JSON.stringify(message)}\n${JSON.stringify({role: 'assistant', content: 'ok'})}`), [
    message,
    {role: 'assistant', content: [{type: 'text', text: 'ok'}]}
  ]);
});

test('lixo não entra e conteúdo sem parte não vira mensagem', () => {
  assert.deepEqual(normalizeClaudeMessages(null), []);
  assert.deepEqual(normalizeClaudeMessages(42), []);
  assert.deepEqual(normalizeClaudeMessages('nenhum json'), []);
  assert.deepEqual(normalizeClaudeMessages([null, 1, 'x', {role: 'system', content: 'ignora'}, {role: 'assistant', content: [{type: 'audio'}]}]), []);
  assert.deepEqual(normalizeClaudeMessages({role: 'user', content: 7}), []);
});

test('normalizar é idempotente (o descritor guarda a forma canônica)', () => {
  const raw = [
    {type: 'user', message: {role: 'user', content: [{type: 'image', source: {media_type: 'image/png', data: 'QUJD'}}, 'texto']}},
    {type: 'assistant', message: {role: 'assistant', content: [{type: 'tool_use', id: 't1', name: 'Grep', input: {pattern: 'x', big: 'y'.repeat(300000)}}]}, timestamp: 9},
    {type: 'user', message: {role: 'user', content: [{type: 'tool_result', tool_use_id: 't1', content: 'ok'}]}}
  ];
  const once = normalizeClaudeMessages(raw);
  assert.deepEqual(normalizeClaudeMessages(once), once);
  assert.equal(once[1].content[0].argumentsTruncated, true);
  assert.deepEqual(normalizeClaudeMessages(once)[1].content[0], once[1].content[0], 'o marcador de argumento cortado é idempotente');
});

test('tetos: texto corta, argumento grande vira {}, imagem fora do teto do envio some', () => {
  const long = normalizeClaudeMessages({role: 'assistant', content: [{type: 'text', text: 'x'.repeat(history.MAX_TEXT_CHARS + 10)}]});
  assert.equal(long[0].content[0].text.length, history.MAX_TEXT_CHARS);

  const huge = normalizeClaudeMessages({role: 'assistant', content: [{type: 'toolCall', id: 't', name: 'Read', arguments: {blob: 'y'.repeat(history.MAX_ARGS_CHARS)}}]});
  assert.deepEqual(huge[0].content[0].arguments, {});
  assert.equal(huge[0].content[0].argumentsTruncated, true);

  const big = 'A'.repeat(history.MAX_IMAGE_DATA_CHARS + 1);
  assert.deepEqual(normalizeClaudeMessages({role: 'user', content: [{type: 'image', data: big, mimeType: 'image/png'}]}), [], 'imagem acima do envio validado não entra no cache');
});

test('timestamp: positivo entra; zero e inválido ficam fora', () => {
  assert.equal(normalizeClaudeMessages({role: 'user', content: 'a', timestamp: 5})[0].timestamp, 5);
  assert.equal('timestamp' in normalizeClaudeMessages({role: 'user', content: 'a', timestamp: 0})[0], false);
  assert.equal('timestamp' in normalizeClaudeMessages({role: 'user', content: 'a', timestamp: 'hoje'})[0], false);
});

test('exportação preserva cabeçalho e títulos exatos por motor', () => {
  const messages = [
    {role: 'user', content: [{type: 'text', text: 'Oi'}, {type: 'image', data: 'QUJD', mimeType: 'image/png'}]},
    {role: 'assistant', content: [{type: 'text', text: 'Tudo bem?'}]}
  ];
  const pi = exportConversationMarkdown({courseName: 'Cálculo I', engine: 'pi', messages, now: 0});
  assert.equal(pi, '# Mesa de Estudos — Cálculo I\n\nExportado em 1970-01-01T00:00:00.000Z\n\n## Você\n\nOi\n[imagem anexada]\n\n## Pi\n\nTudo bem?\n');
  const claude = exportConversationMarkdown({courseName: 'Cálculo I', engine: 'claude', messages, now: 0});
  assert.ok(claude.includes('\n\n## Claude\n\nTudo bem?\n'));
  assert.equal(claude.includes('## Pi'), false);
});

test('exportação aceita registros crus do Pi e ignora ferramenta/resultado', () => {
  const raw = [
    {message: {role: 'user', content: [{type: 'text', text: 'pergunta'}]}},
    {message: {role: 'assistant', content: [{type: 'toolCall', id: 't1', name: 'Read', arguments: {}}]}},
    {message: {role: 'assistant', content: [{type: 'text', text: 'feito'}]}},
    {message: {role: 'toolResult', toolCallId: 't1', content: [ {type: 'text', text: 'resultado'} ]}}
  ];
  const body = exportConversationMarkdown({courseName: 'X', engine: undefined, messages: raw, now: 0});
  assert.equal(body, '# Mesa de Estudos — X\n\nExportado em 1970-01-01T00:00:00.000Z\n\n## Você\n\npergunta\n\n## Pi\n\nfeito\n',
    'assistente sem texto não gera seção; resultado não vira fala');
});

test('exportação sem conteúdo termina no cabeçalho (mesma forma do export antigo)', () => {
  const body = exportConversationMarkdown({courseName: 'Vazia', engine: 'pi', messages: [], now: 0});
  assert.equal(body, '# Mesa de Estudos — Vazia\n\nExportado em 1970-01-01T00:00:00.000Z\n\n');
});
