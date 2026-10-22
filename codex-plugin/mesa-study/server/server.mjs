/* Ligação das ferramentas ao McpServer do SDK oficial.
   - `createMcpServer({config, deps, log})` registra exatamente as ferramentas
     de TOOL_DEFS e o recurso MCP Apps do painel (mesma URI que mesa_open
     declara em `_meta.ui.resourceUri`);
   - resultado de sucesso: bloco image/png (quando houver) + bloco text com o
     meta JSON; structuredContent repete o meta (sem bytes de imagem);
   - falha: isError com um bloco text contendo {ok:false,error:{code,message,
     detail?}} — sem structuredContent — e a sessão continua utilizável;
   - erro inesperado (não-HostError) só vira log genérico de código; mensagem
     com possível caminho nunca vai para o stderr.
   - o HTML do recurso é lido na hora do `resources/read` (deps.uiFile só
     injeta fixture em teste): servidor sem o arquivo continua de pé e o read
     falha com UI_RESOURCE_MISSING claro. */

import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {errorPayload, HostError} from '../host/errors.mjs';
import {SERVER_NAME, SERVER_VERSION} from './config.mjs';
import {createToolHandlers, TOOL_DEFS} from './tools.mjs';
import {
  DESK_RESOURCE_CSP,
  DESK_RESOURCE_MIME,
  DESK_RESOURCE_URI,
  readDeskHtml,
} from './ui.mjs';

const SERVER_INSTRUCTIONS =
  'Mesa de Estudos (experimental): leia mesa_status antes de usar as demais ferramentas. ' +
  'Ao iniciar estudo, consulte mesa_context para os perfis escolhidos e eventual candidato de retomada; ' +
  'perfis são preferências, não substituem instruções do hospedeiro. Retomar PDF exige pedido explícito e novo render. ' +
  'mesa_open abre o painel visual (recurso MCP Apps) com o status e a biblioteca e, com filePath, renderiza a página; ' +
  'mesa_library lista PDFs autorizados sem abrir nenhum; mesa_page renderiza uma página como operação de dados; ' +
  'mesa_windows/mesa_capture tratam do Xournal++ e só devem ser usados ' +
  'quando a pessoa pedir explicitamente para conferir uma janela. mesa_context expõe os perfis de estudo autorizados ' +
  '(--tutor-file/--learner-file; texto só neles) e, com --state-file, um checkpoint pequeno de retomada que nunca ' +
  'restaura página/imagem/captura sozinho. Raízes, cache, executáveis, perfis e checkpoint são fixados na ' +
  'inicialização do servidor e não mudam por chamadas MCP.';

function wrapTool(name, handler, log) {
  return async (args) => {
    try {
      const result = await handler(args || {});
      const content = [];
      if (result.image && typeof result.image.data === 'string') {
        content.push({type: 'image', data: result.image.data, mimeType: result.image.mimeType || 'image/png'});
      }
      content.push({type: 'text', text: JSON.stringify(result.meta)});
      return {content, structuredContent: result.meta};
    } catch (error) {
      if (!(error instanceof HostError)) {
        const code = error && typeof error.code === 'string' ? error.code : 'INTERNAL';
        log(`ferramenta ${name} falhou (${code})`);
      }
      const payload = errorPayload(error);
      return {isError: true, content: [{type: 'text', text: JSON.stringify(payload)}]};
    }
  };
}

export function createMcpServer({config, deps = {}, log = () => {}} = {}) {
  const handlers = createToolHandlers({config, deps, log});
  const server = new McpServer(
    {name: SERVER_NAME, version: SERVER_VERSION},
    {instructions: SERVER_INSTRUCTIONS},
  );
  for (const def of TOOL_DEFS) {
    const handler = handlers[def.handler];
    server.registerTool(
      def.name,
      {
        title: def.title,
        description: def.description,
        inputSchema: def.inputSchema,
        annotations: def.annotations,
        ...(def._meta ? {_meta: def._meta} : {}),
      },
      wrapTool(def.name, handler, log),
    );
  }
  server.registerResource(
    'mesa-desk',
    DESK_RESOURCE_URI,
    {
      title: 'Painel visual da Mesa (MCP Apps)',
      description:
        'HTML self-contained do painel da Mesa (sem rede; imagens data:image/png), declarado por mesa_open via _meta.ui.resourceUri e pelo alias openai/outputTemplate. Lido do arquivo ui/desk.html no momento da leitura; ausente vira erro claro, sem derrubar as ferramentas.',
      mimeType: DESK_RESOURCE_MIME,
    },
    async (uri) => {
      const text = await readDeskHtml({uiFile: deps.uiFile});
      return {
        contents: [
          {
            uri: typeof uri?.href === 'string' ? uri.href : DESK_RESOURCE_URI,
            mimeType: DESK_RESOURCE_MIME,
            text,
            _meta: {
              ui: {
                prefersBorder: true,
                csp: {
                  connectDomains: [...DESK_RESOURCE_CSP.connectDomains],
                  resourceDomains: [...DESK_RESOURCE_CSP.resourceDomains],
                },
              },
            },
          },
        ],
      };
    },
  );
  return {server, handlers, toolNames: TOOL_DEFS.map((def) => def.name), resourceUri: DESK_RESOURCE_URI};
}
