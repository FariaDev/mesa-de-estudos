'use strict';

/* Portão do ClaudeAdapter depois da #91 e do #92: o tutor não tem ferramenta
   nativa de arquivo, shell ou rede, e a pergunta nativa (`AskUserQuestion`) foi
   removida — `perguntar`/`quiz` são ferramentas MCP da Mesa. Sobram:
 *
 *   - `canUseTool`: só pré-aprova `mcp__mesa__*`; qualquer nativa é negada,
 *     inclusive se uma versão futura do CLI a reintroduzir no contexto.
 *   - `callRef` da atividade: o handler MCP não recebe o id da chamada; o hook
 *     PreToolUse reserva a identidade no livro (`activity-call-gate.cjs`).
 *
 * Não há confirmação de bash/edit/write, classificador de shell, jaula de SO
 * nem política de caminhos: essas ferramentas não existem para o modelo. */

const {ACTIVITY_TOOL_NAME} = require('./activity-tools.cjs');

const MESA_TOOL_PREFIX = 'mcp__mesa__';

function isMesaTool(toolName) {
  return typeof toolName === 'string' && toolName.startsWith(MESA_TOOL_PREFIX);
}

class ClaudeAdapterGate {
  /* O SDK consulta o canUseTool para ferramentas MCP. Tudo que não é
     `mcp__mesa__*` é negado — a pergunta nativa saiu no #92. */
  _canUseTool(generation, toolName, input) {
    if (generation !== this._generation) return Promise.resolve({behavior: 'deny', message: 'conexão antiga'});
    if (isMesaTool(toolName) && !this._closed) return Promise.resolve({behavior: 'allow', updatedInput: input});
    return Promise.resolve({behavior: 'deny', message: `ferramenta não permitida nesta versão: ${toolName}`});
  }

  /* Hook PreToolUse: só a atividade precisa do `callRef`. Nenhuma ferramenta
     nativa passa por aqui. */
  async _preToolUse(generation, input) {
    if (generation !== this._generation) {
      return {continue: true, hookSpecificOutput: {hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'conexão antiga'}};
    }
    const toolName = input?.tool_name;
    if (toolName === ACTIVITY_TOOL_NAME && this._activityCallGate && !this._closed) {
      try {
        const updatedInput = this._activityCallGate.reserve(input);
        return {continue: true, hookSpecificOutput: {hookEventName: 'PreToolUse', permissionDecision: 'allow', updatedInput}};
      } catch (error) {
        return {continue: true, hookSpecificOutput: {hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: error.message || 'Não foi possível correlacionar a atividade.'}};
      }
    }
    return {continue: true};
  }

  /* Não existe mais pergunta nativa do Claude: o pedido antigo de respostas
     estruturadas é recusado sem tocar em ferramenta. */
  respond(input = {}) {
    return {ok: false, id: input && typeof input.id === 'string' ? input.id : null, code: 'CLAUDE_QUESTION_REMOVED'};
  }
}

module.exports = {ClaudeAdapterGate, isMesaTool};
