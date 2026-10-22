/* Imagens e histórico do OpenCode (#57): a imagem vira arquivo `file://`
   num temporário; o histórico do servidor vira mensagens de exibição. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseMessage} from '../src/i18n.mjs';

const require = createRequire(import.meta.url);
const {materializeImages} = require('../src/agents/opencode-images.cjs');
const {messageList, normalizeHistory} = require('../src/agents/opencode-history.cjs');

const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

test('imagem PNG vira um file:// com os mesmos bytes; tipo fora da lista só avisa', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-oc-img-'));
  const warnings = [];
  const files = materializeImages([{type: 'image', mimeType: 'image/png', data: PNG_1PX}, {type: 'image', mimeType: 'image/bmp', data: PNG_1PX}],
    {tempDir: () => dir, warn: (code, text) => warnings.push({code, key: parseMessage(text)?.key, args: parseMessage(text)?.args})});
  assert.equal(files.length, 1);
  assert.ok(files[0].uri.startsWith('file://') && files[0].uri.endsWith('.png'));
  assert.equal(fs.readFileSync(fileURLToPath(files[0].uri)).toString('base64'), PNG_1PX);
  assert.deepEqual(warnings, [{code: 'OPENCODE_IMAGE_UNSUPPORTED', key: 'opencode.image.unsupported', args: {mime: 'image/bmp'}}]);
});

test('imagem vazia não vira arquivo e avisa a falha', () => {
  const warnings = [];
  const files = materializeImages([{mimeType: 'image/png', data: '===='}], {tempDir: () => os.tmpdir(), warn: (code) => warnings.push(code)});
  assert.deepEqual(files, []);
  assert.deepEqual(warnings, ['OPENCODE_IMAGE_FAILED']);
});

test('o histórico lê {data}, pega texto e raciocínio e descarta o que não é conversa', () => {
  const list = messageList({data: [
    {id: 'msg_u', type: 'user', text: 'O que é limite?'},
    {id: 'msg_a', type: 'assistant', content: [{type: 'reasoning', text: 'pensar'}, {type: 'text', text: 'É o valor de aproximação.'}]},
    {id: 'msg_k', type: 'compaction', status: 'completed'},
    {id: 'msg_v', type: 'assistant', content: []},
  ], cursor: {}});
  assert.deepEqual(normalizeHistory(list), [
    {role: 'user', content: [{type: 'text', text: 'O que é limite?'}], uuid: 'msg_u'},
    {role: 'assistant', content: [{type: 'thinking', thinking: 'pensar'}, {type: 'text', text: 'É o valor de aproximação.'}], uuid: 'msg_a'},
  ]);
  assert.deepEqual(messageList(null), []);
});

/* Regressão (quadro sumia ao reabrir): a parte `tool` do v2 vira `toolCall` e,
   quando terminou, `toolResult` com o mesmo id; em voo fica só a chamada. */
test('o histórico mantém as chamadas de ferramenta e o resultado delas', () => {
  const tool = (id, status, extra = {}) => ({type: 'tool', id, name: 'mesa_criar_atividade', state: {status, input: {title: 'g(x) = 2x + 1'}, content: [{type: 'text', text: `fim ${id}`}], structured: {}, ...extra}});
  const list = normalizeHistory([{id: 'msg_a', type: 'assistant', content: [tool('call_ok', 'completed'), tool('call_err', 'error', {error: {}}), {type: 'tool', id: 'call_wait', name: 'mesa_criar_atividade', state: {status: 'pending', input: '{"ti'}}, {type: 'text', text: 'Pronto.'}]}]);
  assert.deepEqual(list[0].content.map((part) => part.type === 'toolCall' ? `${part.id}:${JSON.stringify(part.arguments)}` : part.type), ['call_ok:{"title":"g(x) = 2x + 1"}', 'call_err:{"title":"g(x) = 2x + 1"}', 'call_wait:{}', 'text']);
  assert.deepEqual(list.slice(1), [
    {role: 'toolResult', toolCallId: 'call_ok', toolName: 'mesa_criar_atividade', content: [{type: 'text', text: 'fim call_ok'}]},
    {role: 'toolResult', toolCallId: 'call_err', toolName: 'mesa_criar_atividade', content: [{type: 'text', text: 'fim call_err'}], isError: true},
  ]);
});
