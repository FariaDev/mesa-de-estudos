// @ts-check
'use strict';

/* Rascunho de revisão no OpenCode (#93). Mesmo desenho do Claude (#58): um
   `OpenCodeAdapter` TEMPORÁRIO atrás de um `NativeService`, uma consulta só,
   sem sessão salva. O servidor da Mesa já nasce com todas as ferramentas
   nativas em `deny` (`opencode-serve-config.cjs`) e aqui NÃO se registra o MCP
   `mesa` (`mcpConfig` devolve null): o rascunho não alcança ferramenta
   nenhuma, nem da Mesa. Quem lê o JSON e valida é `generateReviewDraft`, o
   mesmo do Pi e do Claude. */

const crypto = require('node:crypto');
const {OpenCodeAdapter} = require('./opencode-adapter.cjs');
const {NativeService} = require('./service.cjs');

/**
 * Monta a ponte descartável do rascunho.
 * @param {{cwd: string, systemPrompt: string, acquire: () => Promise<import('./opencode-serve-owner.cjs').ServeLease>,
 *   selection?: {model: string|null, effort: string|null}|null,
 *   readVersion?: (binary: string) => Promise<string>, log?: (area: string, line: string) => void}} options
 * @returns {InstanceType<typeof NativeService>}
 * @example const bridge = createOpenCodeDraftBridge({cwd: folder, systemPrompt: draftPrompt('pt-BR'), acquire});
 */
function createOpenCodeDraftBridge({cwd, systemPrompt, acquire, selection = null, readVersion, log = () => {}}) {
  const adapter = new OpenCodeAdapter({
    conversationId: `review-draft:${crypto.randomUUID()}`,
    sessionId: '',
    resume: false,
    directory: cwd,
    systemPrompt,
    selection: selection || {model: null, effort: null},
    acquire,
    readVersion,
    log,
    /* A sessão do rascunho é descartável: o `stop()` a apaga no servidor. */
    deleteSessionOnStop: true,
    /* Sem MCP da Mesa e sem ferramenta nativa: o rascunho é só texto. */
    mcpConfig: () => null,
  });
  const service = new NativeService({adapter, engine: 'opencode'});
  /* Parar o rascunho também interrompe o turno no servidor e apaga a sessão
     temporária; a pasta é do host. */
  const stop = service.stop.bind(service);
  /* `generateReviewDraft` já para a ponte ao terminar e o host repete no
     `finally`: uma vez só, para o DELETE da sessão não sair duas vezes. */
  let stopping = null;
  service.stop = () => (stopping ??= Promise.allSettled([adapter.cancel(), stop()]));
  return service;
}

module.exports = {createOpenCodeDraftBridge};
