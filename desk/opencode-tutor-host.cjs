// @ts-check
'use strict';

/* O tutor OpenCode da conversa ativa (#57): o dono do `opencode serve` da
   Mesa, o MCP `mesa` montado com as pontes da conversa e a ligação do
   adaptador ao serviço nativo. O `tutor-bridge-host.cjs` chama `connect()`
   quando o motor da sessão é `opencode`; o `main.cjs` chama `sweepAtBoot()`
   na partida, `stop()` ao sair e `identifyCaller()` na ponte de atividades.

   A chave do Zen vem de `opencodeHost.keyEnv()` (cofre cifrado) só no
   ambiente do servidor: nunca entra no MCP, no descritor nem no log. */

const path = require('node:path');
const {OpenCodeAdapter} = require('./src/agents/opencode-adapter.cjs');
const {NativeService} = require('./src/agents/service.cjs');
const {createServeOwner} = require('./src/agents/opencode-serve-owner.cjs');
const {createOpenCodeActivityCalls} = require('./src/agents/opencode-activity-calls.cjs');
const {nativePersistence} = require('./src/agents/native-persistence.cjs');
const conversations = require('./src/agents/conversations.cjs');

const MCP_SERVER = path.join(__dirname, 'src', 'extensions', 'mesa-mcp', 'server.mjs');

/**
 * @typedef {{toolCallId?: string, callRef?: string, paramsHash?: string, engine?: string}} ActivityCaller
 */

/**
 * O ambiente do MCP `mesa`: as pontes da conversa e o idioma; nada de chave.
 * O Node é o do Electron (`ELECTRON_RUN_AS_NODE`), que o app já carrega.
 * @param {{execPath: string, ggbBridge: string, activityGrant: object|null, tutorLanguage: string}} options
 * @returns {{type: 'local', command: string[], environment: Record<string, string>, enabled: true, codemode: false}}
 * @example mesaMcpConfig({execPath: process.execPath, ggbBridge: '/r/ggb.json', activityGrant: grant, tutorLanguage: 'pt-BR'})
 */
function mesaMcpConfig({execPath, ggbBridge, activityGrant, tutorLanguage}) {
  return {
    type: 'local',
    command: [execPath, MCP_SERVER],
    environment: {
      ELECTRON_RUN_AS_NODE: '1',
      LEARNING_DESK_GGB_BRIDGE: ggbBridge,
      LEARNING_DESK_ACTIVITY_BRIDGE: activityGrant ? JSON.stringify(activityGrant) : '',
      LEARNING_DESK_TUTOR_LANGUAGE: tutorLanguage,
    },
    enabled: true,
    /* O OpenCode 2.0.32 põe as ferramentas MCP no Code Mode por padrão: o modelo
       só as alcança por dentro da `execute`, o SSE mostra `execute` e o quadro
       ficava sem slot no chat (#70). Desligado, o nome é `mesa_criar_atividade`,
       igual ao do Pi. */
    codemode: false,
  };
}

/**
 * Cria o host do tutor OpenCode sobre o estado vivo do main.
 * @param {{live: import('./main.cjs').DeskLive, runtime: string, ggbBridge: () => string,
 *   appendLog: import('./types/host-deps').AppendLog,
 *   captureActivityScope: () => import('./activity-host.cjs').ActivityScope,
 *   prepareOpenCode: import('./types/main-hosts').TutorEngineHost['prepareOpenCode'],
 *   openCodeBinary: () => string, execPath?: string,
 *   createOwner?: typeof createServeOwner}} options
 * @example const openCodeTutor = createOpenCodeTutorHost({live, runtime, ggbBridge: () => ggb.bridgeFile, appendLog, captureActivityScope, prepareOpenCode, openCodeBinary});
 */
function createOpenCodeTutorHost({live, runtime, ggbBridge, appendLog, captureActivityScope, prepareOpenCode, openCodeBinary, execPath = process.execPath, createOwner = createServeOwner}) {
  /** @param {string} area @param {string} line */
  const log = (area, line) => { try { appendLog(area, line); } catch { /* o log não pode derrubar o tutor */ } };
  const owner = createOwner({findBinary: openCodeBinary, keyEnv: () => live.opencodeHost.keyEnv(), cwd: path.join(runtime, 'opencode-workspaces'), ledgerDir: runtime, log});
  /** @type {ReturnType<typeof createOpenCodeActivityCalls>|null} */
  let activityCalls = null;

  /** A concessão da ponte de atividades desta conversa, marcada como OpenCode. */
  function grantActivity() {
    live.activityGrant = live.activityBridge.grant(captureActivityScope(), {engine: 'opencode'});
    return live.activityGrant;
  }

  /** @returns {InstanceType<typeof NativeService>} */
  function connect() {
    conversations.recoverClaudeConversation(live.session, {runtime});
    const {cwd, systemPrompt, record} = prepareOpenCode();
    const persistence = nativePersistence({descriptor: live.session, runtime, preview: record.preview});
    const activityGrant = grantActivity();
    const calls = createOpenCodeActivityCalls({log: (line) => log('opencode', line)});
    activityCalls = calls;
    const adapter = new OpenCodeAdapter({
      conversationId: live.session, sessionId: record.nativeSessionId, resume: record.nativeEstablished, directory: cwd,
      systemPrompt, selection: {model: record.model || null, effort: record.effort || null},
      acquire: () => owner.acquire(), persistDelivery: persistence.persistDelivery, log,
      /* O servidor cunha o `ses_` na primeira ligação; o descritor o guarda uma vez. */
      onSessionId: (id) => conversations.updateClaudeConversation(live.session, {nativeSessionId: id}, {runtime}),
      mcpConfig: () => mesaMcpConfig({execPath, ggbBridge: ggbBridge(), activityGrant, tutorLanguage: live.languageHost.tutorLanguage()}),
    });
    adapter.on('event', calls.observe);
    return new NativeService({adapter, engine: 'opencode', uncertain: record.delivery?.status === 'uncertain', messages: record.messages || [],
      importedPrefixLength: record.importedPrefixLength || 0, onMessages: persistence.onMessages, onSelection: persistence.onSelection});
  }

  /**
   * Dá à atividade publicada pelo MCP o id da chamada visto no SSE. Chamadas
   * de outro motor passam como vieram.
   * @param {ActivityCaller} caller
   * @returns {Promise<ActivityCaller>}
   */
  async function identifyCaller(caller) {
    if (caller?.engine !== 'opencode' || caller.toolCallId || !activityCalls) return caller;
    return {...caller, toolCallId: await activityCalls.claim(String(caller.paramsHash || ''))};
  }

  /** A troca de conversa esquece o livro de chamadas da anterior. */
  function release() { activityCalls = null; }

  return {connect, identifyCaller, release, sweepAtBoot: () => owner.sweepAtBoot(), stop: () => owner.stop()};
}

module.exports = {createOpenCodeTutorHost, mesaMcpConfig, MCP_SERVER};
