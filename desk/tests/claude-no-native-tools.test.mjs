/* Tutor só com ferramentas da Mesa (#91/#92): o ClaudeAdapter não oferece
   Read, Glob, Grep, Bash, Edit, Write, rede nem a antiga pergunta nativa;
   sobra o MCP `mesa`, com `quiz`/`perguntar` no cartão da Mesa. O SDK é o
   falso de sempre. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fx from './claude-fixtures.mjs';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {ClaudeAdapter} = require('../src/agents/claude-adapter.cjs');
const {SDK_TOOLS, DISALLOWED_TOOLS} = require('../src/agents/claude-adapter-contract.cjs');

const NATIVE_FILES = ['Read', 'Glob', 'Grep', 'Bash', 'Edit', 'MultiEdit', 'Write', 'NotebookEdit', 'Agent', 'Task', 'WebFetch', 'WebSearch', 'KillShell', 'BashOutput', 'Skill'];

function adapterWith(options = {}) {
  const sdk = fx.fakeSdk();
  const adapter = new ClaudeAdapter({conversationId: 'no-native', cwd: process.cwd(), sdkLoader: async () => sdk, timeoutMs: 2000, ...options});
  return {adapter, sdk};
}

test('o tutor anuncia só o MCP mesa; nenhuma ferramenta nativa ou de arquivo', async () => {
  const {adapter, sdk} = adapterWith({readPdf: async () => ({}), createActivity: async () => ({published: true})});
  try {
    await adapter._ensureQuery();
    const options = sdk.state.queries[0].options;
    assert.deepEqual(options.tools, []);
    assert.deepEqual(options.allowedTools, ['mcp__mesa__*']);
    assert.equal(options.allowedTools.includes('AskUserQuestion'), false);
    assert.deepEqual([...SDK_TOOLS], []);
    for (const name of NATIVE_FILES) assert.ok(DISALLOWED_TOOLS.includes(name), `${name} em disallowedTools`);
    assert.ok(DISALLOWED_TOOLS.includes('Read'));
    assert.ok(DISALLOWED_TOOLS.includes('AskUserQuestion'), 'a pergunta nativa saiu (#92)');
    assert.deepEqual(Object.keys(options.mcpServers), ['mesa']);
    assert.equal(options.sandbox, undefined, 'sem sandbox de SO');
    assert.equal(options.settings, undefined, 'sem permissões herdadas');
  } finally {
    adapter.close();
  }
});

test('canUseTool libera o MCP e nega qualquer nativa, inclusive a antiga pergunta', async () => {
  const {adapter, sdk} = adapterWith({readPdf: async () => ({})});
  try {
    await adapter._ensureQuery();
    const options = sdk.state.queries[0].options;
    for (const name of ['Read', 'Bash', 'Edit', 'Write', 'WebFetch']) {
      const denied = await options.canUseTool(name, {file_path: '/etc/passwd', command: 'ls'}, {});
      assert.equal(denied.behavior, 'deny', `${name} negada`);
      assert.match(denied.message, /não permitida/);
    }
    assert.equal((await options.canUseTool('mcp__mesa__ler_pdf', {caminho: 'A.pdf'}, {})).behavior, 'allow');
    const question = await options.canUseTool('AskUserQuestion', {questions: [{question: 'Seguir?'}]}, {requestId: 'q-1'});
    assert.equal(question.behavior, 'deny');
    assert.deepEqual(adapter.respond({id: 'q-1', answers: {'Seguir?': 'Sim'}}), {ok: false, id: 'q-1', code: 'CLAUDE_QUESTION_REMOVED'});
  } finally {
    adapter.close();
  }
});

test('o rascunho sem ferramentas não monta MCP nem oferece a pergunta', async () => {
  const {adapter, sdk} = adapterWith({noTools: true, readPdf: async () => ({})});
  try {
    await adapter._ensureQuery();
    const options = sdk.state.queries[0].options;
    assert.deepEqual(options.tools, []);
    assert.deepEqual(options.mcpServers, {});
    assert.ok(options.disallowedTools.includes('AskUserQuestion'));
    assert.ok(options.disallowedTools.includes('Read'));
  } finally {
    adapter.close();
  }
});
