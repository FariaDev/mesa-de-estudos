// @ts-check
/* Protocolo MCP mínimo por stdio (#57): JSON-RPC 2.0, uma mensagem por linha.
   O OpenCode sobe este servidor como MCP `local`; a Mesa só precisa de
   `initialize`, `tools/list` e `tools/call` (e responder `ping`). Escrito aqui
   para não puxar o SDK do MCP como dependência nova: o que chega é dado, e
   método desconhecido recebe o erro -32601 do JSON-RPC. */

export const PROTOCOL_VERSION = '2025-06-18';

/**
 * @typedef {{type: 'text', text: string} | {type: 'image', data: string, mimeType: string}} ToolContent
 * @typedef {{content: ToolContent[], isError?: boolean}} ToolResult
 * @typedef {{name: string, description: string, inputSchema: object, call: (args: Record<string, unknown>) => Promise<ToolResult>}} McpTool
 * @typedef {{jsonrpc?: string, id?: string|number|null, method?: string, params?: {protocolVersion?: string, name?: unknown, arguments?: unknown}}} RpcMessage
 */

/**
 * O tratador de mensagens: recebe uma linha e devolve a resposta (ou null para notificação).
 * @param {{tools: McpTool[], name: string, version: string, log?: (line: string) => void}} options
 * @returns {(line: string) => Promise<object|null>}
 * @example const reply = createMcpServer({tools, name: 'mesa', version: '0.5.0'}); await reply('{"jsonrpc":"2.0","id":1,"method":"ping"}') // {jsonrpc: '2.0', id: 1, result: {}}
 */
export function createMcpServer({tools, name, version, log = () => {}}) {
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  /** @param {string|number|null} id @param {unknown} result */
  const ok = (id, result) => ({jsonrpc: '2.0', id, result});
  /** @param {string|number|null} id @param {number} code @param {string} message */
  const fail = (id, code, message) => ({jsonrpc: '2.0', id, error: {code, message}});

  /** @param {RpcMessage} rpc */
  async function answer(rpc) {
    const id = rpc.id ?? null;
    if (rpc.method === 'initialize') return ok(id, {protocolVersion: rpc.params?.protocolVersion || PROTOCOL_VERSION, capabilities: {tools: {}}, serverInfo: {name, version}});
    if (rpc.method === 'ping') return ok(id, {});
    if (rpc.method === 'tools/list') return ok(id, {tools: tools.map(({name: toolName, description, inputSchema}) => ({name: toolName, description, inputSchema}))});
    if (rpc.method !== 'tools/call') return fail(id, -32601, `método ${JSON.stringify(rpc.method)} não existe; esperado initialize, ping, tools/list ou tools/call`);
    const tool = byName.get(String(rpc.params?.name || ''));
    if (!tool) return fail(id, -32602, `ferramenta ${JSON.stringify(rpc.params?.name)} não existe; esperado ${[...byName.keys()].join(', ')}`);
    try {
      const args = rpc.params?.arguments;
      return ok(id, await tool.call(args && typeof args === 'object' && !Array.isArray(args) ? /** @type {Record<string, unknown>} */ (args) : {}));
    } catch (error) {
      log(JSON.stringify({level: 'warn', area: 'mesa-mcp', msg: 'ferramenta falhou', tool: tool.name, error: String(error?.message || error)}));
      return ok(id, {content: [{type: 'text', text: String(error?.message || error)}], isError: true});
    }
  }

  return async (line) => {
    let rpc;
    try { rpc = JSON.parse(line); } catch { return fail(null, -32700, `linha não é JSON: ${JSON.stringify(String(line).slice(0, 80))}`); }
    if (!rpc || typeof rpc !== 'object' || Array.isArray(rpc)) return fail(null, -32600, 'esperado um objeto JSON-RPC');
    /* Notificação (sem id): nada volta. */
    if (rpc.id === undefined) return null;
    return answer(rpc);
  };
}

/**
 * Liga o tratador a um par de streams (stdin/stdout no processo real).
 * @param {(line: string) => Promise<object|null>} reply
 * @param {{input: NodeJS.ReadableStream, output: NodeJS.WritableStream}} streams
 * @returns {void}
 */
export function serveLines(reply, {input, output}) {
  let buffer = '';
  input.setEncoding('utf8');
  input.on('data', (chunk) => {
    buffer += chunk;
    let index = buffer.indexOf('\n');
    while (index !== -1) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (line) void reply(line).then((answer) => { if (answer) output.write(`${JSON.stringify(answer)}\n`); });
      index = buffer.indexOf('\n');
    }
  });
}
