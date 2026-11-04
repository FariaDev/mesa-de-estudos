/* Claude: `ler_pdf` entra no MCP da Mesa e o Read nativo de `.pdf` é recusado
   sem diálogo. O rascunho de revisão (`noTools`) continua sem ferramentas. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import * as fx from './claude-fixtures.mjs';

const require = createRequire(import.meta.url);
const {ClaudeAdapter} = require('../src/agents/claude-adapter.cjs');
const {PDF_READ_TOOL_NAME} = require('../src/agents/pdf-read-tool.cjs');

function adapterWith(overrides) {
  const sdk = fx.fakeSdk();
  const adapter = new ClaudeAdapter({
    conversationId: 'pdf-tutor',
    cwd: process.cwd(),
    sdkLoader: async () => sdk,
    timeoutMs: 2000,
    ...overrides,
  });
  return {adapter, sdk};
}

test('readPdf sozinho anuncia ler_pdf e o Read de .pdf não abre diálogo', async () => {
  const calls = [];
  const {adapter, sdk} = adapterWith({
    readPdf: async (args) => {
      calls.push(args);
      return {file: 'A.pdf', total: 1, pages: [{page: 1, text: 'oi', kind: 'text'}]};
    },
  });
  const events = fx.collectEvents(adapter);
  try {
    await adapter._ensureQuery();
    const options = sdk.state.queries[0].options;
    assert.deepEqual(Object.keys(options.mcpServers), ['mesa']);
    assert.ok(options.allowedTools.includes('mcp__mesa__*'));
    assert.equal((await options.canUseTool(PDF_READ_TOOL_NAME, {caminho: 'A.pdf', pagina: 1}, {})).behavior, 'allow');

    /* #91: não há Read nativo; nem texto, nem PDF. A leitura é `ler_pdf`. */
    const file = join(process.cwd(), 'package.json');
    assert.equal((await options.canUseTool('Read', {file_path: file}, {requestId: 'txt'})).behavior, 'deny');
    assert.equal((await options.canUseTool('Read', {file_path: join(process.cwd(), 'aula.pdf')}, {requestId: 'pdf'})).behavior, 'deny');
    assert.equal((await options.canUseTool('Bash', {command: 'ls'}, {})).behavior, 'deny');
    assert.equal((await options.canUseTool('Write', {file_path: file, content: 'x'}, {})).behavior, 'deny');
    assert.equal(events.of('permission_request').length, 0);
    assert.equal(calls.length, 0, 'anunciar a ferramenta não lê o arquivo');
  } finally {
    adapter.close();
  }
});

test('noTools não ganha o MCP mesmo com readPdf', async () => {
  const {adapter, sdk} = adapterWith({noTools: true, readPdf: async () => ({file: 'A.pdf', total: 0, pages: []})});
  try {
    await adapter._ensureQuery();
    const options = sdk.state.queries[0].options;
    assert.deepEqual(options.mcpServers, {});
    assert.deepEqual(options.tools, []);
    assert.ok(options.disallowedTools.includes('Read'));
  } finally {
    adapter.close();
  }
});
