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
const {readPersonalConfig, serveEnv, writeServeConfig} = require('./src/agents/opencode-serve-config.cjs');
const {createOpenCodeActivityCalls} = require('./src/agents/opencode-activity-calls.cjs');
const {readOpenCodeVersion} = require('./src/agents/opencode-version.cjs');
const {nativePersistence} = require('./src/agents/native-persistence.cjs');
const {createOpenCodeDraftBridge} = require('./src/agents/opencode-review-draft.cjs');
const conversations = require('./src/agents/conversations.cjs');
const {message} = require('./src/i18n.mjs');

const MCP_SERVER = path.join(__dirname, 'src', 'extensions', 'mesa-mcp', 'server.mjs');
/**
 * @typedef {{toolCallId?: string, callRef?: string, paramsHash?: string, engine?: string}} ActivityCaller
 */

/**
 * O ambiente do MCP `mesa`: as pontes da conversa e o idioma; nada de chave.
 * O Node é o do Electron (`ELECTRON_RUN_AS_NODE`), que o app já carrega.
 * @param {{execPath: string, ggbBridge: string, activityGrant: object|null, materialGrant?: object|null, cardGrant?: object|null, tutorLanguage: string, pdfOnly?: boolean}} options
 * @returns {{type: 'local', command: string[], environment: Record<string, string>, enabled: true, codemode: false}}
 * @example mesaMcpConfig({execPath: process.execPath, ggbBridge: '/r/ggb.json', activityGrant: grant, tutorLanguage: 'pt-BR'})
 */
function mesaMcpConfig({execPath, ggbBridge, activityGrant, materialGrant = null, cardGrant = null, tutorLanguage, pdfOnly = false}) {
  return {
    type: 'local',
    command: [execPath, MCP_SERVER],
    environment: {
      ELECTRON_RUN_AS_NODE: '1',
      LEARNING_DESK_GGB_BRIDGE: pdfOnly ? '' : ggbBridge,
      LEARNING_DESK_ACTIVITY_BRIDGE: activityGrant ? JSON.stringify(activityGrant) : '',
      LEARNING_DESK_MATERIAL_BRIDGE: !pdfOnly && materialGrant ? JSON.stringify(materialGrant) : '',
      LEARNING_DESK_CARD_BRIDGE: cardGrant ? JSON.stringify(cardGrant) : '',
      LEARNING_DESK_TUTOR_LANGUAGE: tutorLanguage,
      ...(pdfOnly ? {LEARNING_DESK_PDF_ONLY: '1'} : {}),
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
 * O ambiente do `opencode serve` com o config das ferramentas (#91). Se a
 * gravação do diretório falhar, o servidor sobe com o MESMO JSON em
 * `OPENCODE_CONFIG_CONTENT`; o ambiente herdado nunca entra.
 * @param {{runtime: string, log: (area: string, line: string) => void,
 *   write?: typeof writeServeConfig, env?: Record<string, string|undefined>,
 *   readPersonal?: typeof readPersonalConfig}} options
 * @returns {() => Record<string, string|undefined>}
 * @example const env = serveBaseEnv({runtime, log});
 */
function serveBaseEnv({runtime, log, write = writeServeConfig, env = process.env, readPersonal = readPersonalConfig}) {
  const personal = () => {
    try { return readPersonal({env, log}); } catch (error) {
      log('opencode', `config da pessoa não lido; a Mesa segue sem ele: ${error?.message || error}`);
      return {};
    }
  };
  try {
    const directory = write({runtime});
    return () => serveEnv(env, directory, personal());
  } catch (error) {
    log('opencode', `config de ferramentas não gravado; servidor sobe com o JSON inline: ${error?.message || error}`);
    return () => serveEnv(env, null, personal());
  }
}

/**
 * Cria o host do tutor OpenCode sobre o estado vivo do main.
 * @param {{live: import('./main.cjs').DeskLive, runtime: string, ggbBridge: () => string,
 *   appendLog: import('./types/host-deps').AppendLog,
 *   captureActivityScope: () => import('./activity-host.cjs').ActivityScope,
 *   prepareOpenCode: import('./types/main-hosts').TutorEngineHost['prepareOpenCode'],
 *   prepareOpenCodeSide: import('./types/main-hosts').TutorEngineHost['prepareOpenCodeSide'],
 *   openCodeBinary: () => string, execPath?: string, readVersion?: typeof readOpenCodeVersion,
 *   createOwner?: typeof createServeOwner, readPersonal?: typeof readPersonalConfig}} options
 * @example const openCodeTutor = createOpenCodeTutorHost({live, runtime, ggbBridge: () => ggb.bridgeFile, appendLog, captureActivityScope, prepareOpenCode, openCodeBinary});
 */
function createOpenCodeTutorHost({live, runtime, ggbBridge, appendLog, captureActivityScope, prepareOpenCode, prepareOpenCodeSide, openCodeBinary, execPath = process.execPath, readVersion = readOpenCodeVersion, createOwner = createServeOwner, readPersonal = readPersonalConfig}) {
  /** @param {string} area @param {string} line */
  const log = (area, line) => { try { appendLog(area, line); } catch { /* o log não pode derrubar o tutor */ } };
  /* Config do servidor da Mesa (#91): ferramentas nativas desligadas e
     permissões em deny. O config é do app, não da sessão. */
  const baseEnv = serveBaseEnv({runtime, log, readPersonal});
  /** O título da sessão é frase da interface, não o marcador cru do catálogo. */
  const sessionTitle = () => typeof live.languageHost?.t === 'function' ? live.languageHost.t('opencode.session.title') : message('opencode.session.title');
  const owner = createOwner({findBinary: openCodeBinary, keyEnv: () => live.opencodeHost.keyEnv(), cwd: path.join(runtime, 'opencode-workspaces'), ledgerDir: runtime, log, baseEnv});
  /** @type {ReturnType<typeof createOpenCodeActivityCalls>|null} */
  let activityCalls = null;
  /** Tokens do chat lateral (`ler_pdf` só). A troca de sessão os revoga. */
  const sideTokens = new Set();

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
    /* A nota do tutor usa a ponte de material da sessão principal; o lateral
       não recebe esta concessão (nem `salvar_nota`). */
    live.tutorMaterialGrant = live.tutorMaterialBridge ? live.tutorMaterialBridge.grant({courseId: live.courseId, session: live.session, freeSessionId: live.freeSessionId}) : null;
    const calls = createOpenCodeActivityCalls({log: (line) => log('opencode', line)});
    activityCalls = calls;
    const adapter = new OpenCodeAdapter({
      conversationId: live.session, sessionId: record.nativeSessionId, resume: record.nativeEstablished, directory: cwd,
      systemPrompt, selection: {model: record.model || null, effort: record.effort || null}, sessionTitle: sessionTitle(),
      acquire: () => owner.acquire(), persistDelivery: persistence.persistDelivery, log, readVersion,
      /* O servidor cunha o `ses_` na primeira ligação; o descritor o guarda uma vez. */
      onSessionId: (id) => conversations.updateClaudeConversation(live.session, {nativeSessionId: id}, {runtime}),
      mcpConfig: () => mesaMcpConfig({execPath, ggbBridge: ggbBridge(), activityGrant, materialGrant: live.tutorMaterialGrant, cardGrant: activityGrant, tutorLanguage: live.languageHost.tutorLanguage()}),
    });
    adapter.on('event', calls.observe);
    return new NativeService({adapter, engine: 'opencode', uncertain: record.delivery?.status === 'uncertain', messages: record.messages || [],
      importedPrefixLength: record.importedPrefixLength || 0, onMessages: persistence.onMessages, onSelection: persistence.onSelection});
  }

  /**
   * Serviço do chat lateral OpenCode (#74): mesmo servidor da principal,
   * descritor e pasta próprios. O MCP traz só `ler_pdf`: o lateral não publica
   * atividade nem figura. O token é próprio e não substitui o da principal.
   * @param {{descriptor: string, record: NonNullable<ReturnType<typeof conversations.readClaudeConversation>>}} side
   * @returns {InstanceType<typeof NativeService>}
   */
  function connectSide({descriptor, record}) {
    const {cwd, systemPrompt} = prepareOpenCodeSide(record);
    const persistence = nativePersistence({descriptor, runtime, preview: record.preview});
    /* O laudo lateral herda o escopo da sessão principal (matéria/Livre) para
       `listar_materiais`; só a conversa é a do lateral. Sem `courseId`, a
       rota `/materials` recusaria a lista como sessão trocada. */
    const activityGrant = live.activityBridge.grant({...captureActivityScope(), conversationId: descriptor}, {engine: 'opencode'});
    sideTokens.add(activityGrant.token);
    const adapter = new OpenCodeAdapter({
      conversationId: descriptor, sessionId: record.nativeSessionId || '', resume: record.nativeEstablished, directory: cwd,
      systemPrompt, selection: {model: record.model || null, effort: record.effort || null}, sessionTitle: sessionTitle(),
      acquire: () => owner.acquire(), persistDelivery: persistence.persistDelivery, log, readVersion,
      onSessionId: (id) => conversations.updateClaudeConversation(descriptor, {nativeSessionId: id}, {runtime}),
      mcpConfig: () => mesaMcpConfig({execPath, ggbBridge: '', activityGrant, cardGrant: activityGrant, tutorLanguage: live.languageHost.tutorLanguage(), pdfOnly: true}),
    });
    return new NativeService({adapter, engine: 'opencode', uncertain: record.delivery?.status === 'uncertain', messages: record.messages || [],
      onMessages: persistence.onMessages, onSelection: persistence.onSelection});
  }

  /**
   * Ponte descartável do rascunho de revisão (#93): mesmo servidor da Mesa,
   * pasta temporária, sem MCP e sem sessão salva. O host de registros apaga a
   * pasta quando o rascunho termina.
   * @param {{cwd: string, systemPrompt: string, selection?: {model: string|null, effort: string|null}|null}} options
   * @returns {InstanceType<typeof NativeService>}
   * @example const bridge = openCodeTutor.draft({cwd, systemPrompt});
   */
  function draft({cwd, systemPrompt, selection = null}) {
    return createOpenCodeDraftBridge({cwd, systemPrompt, selection, acquire: () => owner.acquire(), readVersion, log});
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
  function release() {
    activityCalls = null;
    for (const token of sideTokens) live.activityBridge.revoke(token);
    sideTokens.clear();
  }

  return {connect, connectSide, draft, identifyCaller, release, sweepAtBoot: () => owner.sweepAtBoot(), stop: () => owner.stop()};
}

module.exports = {createOpenCodeTutorHost, mesaMcpConfig, serveBaseEnv, MCP_SERVER};
