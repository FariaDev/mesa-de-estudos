// @ts-check
'use strict';

/* Rascunho de revisão no Claude Code (#58; a especificação do commit
   `e4a65a9` abria uma consulta à parte com outro leitor de stream).

   Aqui o rascunho reaproveita o caminho que já existe: um `ClaudeAdapter`
   TEMPORÁRIO (pasta própria, sem ferramenta nenhuma, `persistSession:false`)
   atrás de um `NativeService`, que emite os mesmos eventos do Pi. Quem lê a
   resposta e valida o JSON é o `generateReviewDraft` de `review-draft.cjs`,
   o mesmo do Pi. A conversa de estudo não recebe prompt nem muda de estado,
   e o rascunho envia uma vez só (sem confirmação, nada é reenviado). */

const crypto = require('node:crypto');
const {ClaudeAdapter} = require('./claude-adapter.cjs');
const {NativeService} = require('./service.cjs');

/**
 * Monta a ponte descartável do rascunho.
 * @param {{cwd: string, systemPrompt: string, claudePath?: string|null, detectClaude?: Function|null,
 *   sdkLoader?: Function|null, selection?: {model: string|null, effort: string|null}}} options
 * @returns {InstanceType<typeof NativeService>}
 * @example const bridge = createClaudeDraftBridge({cwd: folder, systemPrompt: draftPrompt('pt-BR'), selection: {model: null, effort: null}});
 */
function createClaudeDraftBridge({cwd, systemPrompt, claudePath = null, detectClaude = null, sdkLoader = null, selection = null}) {
  const adapter = new ClaudeAdapter({
    conversationId: `review-draft:${crypto.randomUUID()}`,
    cwd,
    systemPrompt,
    claudePath,
    detectClaude,
    sdkLoader,
    selection,
    noTools: true,
    persistSession: false,
  });
  return new NativeService({adapter, engine: 'claude'});
}

module.exports = {createClaudeDraftBridge};
