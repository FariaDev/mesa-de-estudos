'use strict';

/* Motores do chat lateral: um canal por chat, com o MESMO transporte do motor
 * principal e ZERO fallback escondido.
 *
 * - Pi: `PiBridge` próprio (processo e sessão JSONL separados do principal).
 * - Claude: `ClaudeAdapter` + `ClaudeService` próprios, com o descritor nativo
 *   do próprio chat; a preparação (cwd/workspace e system prompt) é injetada
 *   pelo main para reaproveitar exatamente a política do principal (auth
 *   original, `deliveryUncertain`, catálogo/controles e permissões).
 *
 * O canal só nasce quando o manager pede (envio/aborto); abrir/ler não inicia
 * processo. Fechar não apaga nada: sessão/descritor continuam recuperáveis. */

const fs = require('node:fs');
const {message} = require('./src/i18n.mjs');
const {invalidValue} = require('./src/error-detail.mjs');
const {PiBridge} = require('./rpc.cjs');
const {displayUserText} = require('./sidechat.cjs');
const conversations = require('./src/agents/conversations.cjs');
const {ClaudeAdapter} = require('./src/agents/claude-adapter.cjs');
const {ClaudeService} = require('./src/agents/service.cjs');

/**
 * O Pi lateral nasce com o modelo padrão do Pi, não com o escolhido na conversa
 * principal (o seletor só fala com a ponte principal). Antes do primeiro envio
 * ele recebe o mesmo modelo e nível (v1.0.2: o lateral ficava mudo com o Grok).
 * Uma falha aqui só vai ao log: o envio segue no modelo padrão e um erro do
 * turno aparece no próprio chat.
 * @param {PiBridge} bridge
 * @param {() => Promise<{provider: string, id: string, level?: string|null}|null>} mainModel
 * @param {(line: string) => void} note
 * @example await syncSideModel(bridge, async () => ({provider: 'xai', id: 'grok-4.6', level: 'high'}), console.log)
 */
async function syncSideModel(bridge, mainModel, note) {
  let model = null;
  try {
    model = await mainModel();
    if (!model?.provider || !model?.id) return;
    await bridge.request('set_model', {provider: model.provider, modelId: model.id});
    if (model.level) await bridge.request('set_thinking_level', {level: model.level});
  } catch (error) {
    note(`modelo da conversa principal não aplicado (${model ? `${model.provider}/${model.id}` : 'sem modelo'}): ${error?.message || error}`);
  }
}

/**
 * Canal Pi de um chat lateral: uma ponte RPC com a sessão JSONL dele.
 * @param {{id: string, sessionPath: string, cwd: string, pi: string, env: NodeJS.ProcessEnv,
 *   extraArgs?: string[], promptFile?: string, onEvent: (event: object) => void,
 *   log: (scope: string, line: string) => void,
 *   mainModel?: () => Promise<{provider: string, id: string, level?: string|null}|null>}} options
 */
function createPiSideEngine({id, sessionPath, cwd, pi, env, extraArgs = [], promptFile = '', onEvent, log, mainModel = async () => null} = {}) {
  const bridge = new PiBridge({cwd, session: sessionPath, pi, env, promptFile, extraArgs});
  let closed = false;
  let modelSynced = false;
  bridge.on('event', (event) => {
    if (!closed) onEvent?.(event);
  });
  bridge.on('stderr', (text) => {
    if (!closed) log?.('sidechat', `${id}: ${text}`);
  });
  return {
    engine: 'pi',
    async prompt({text, running}) {
      if (!modelSynced) {
        modelSynced = true;
        await syncSideModel(bridge, mainModel, (line) => log?.('sidechat', `${id}: ${line}`));
      }
      const result = await bridge.request('prompt', {message: text, ...(running ? {streamingBehavior: 'followUp'} : {})});
      return {accepted: true, result};
    },
    async abort() {
      if (!bridge.child) return {aborted: false};
      try {
        await bridge.request('clear_queue', {}, 5000);
      } catch {}
      return bridge.request('abort', {}, 5000);
    },
    respond(data) {
      return bridge.respond(data);
    },
    close() {
      closed = true;
      bridge.removeAllListeners();
      bridge.stop();
    },
    isBusy() {
      return bridge.isRunning();
    },
    isUncertain() {
      return false;
    },
    messages() {
      return [];
    },
  };
}

function previewFromMessages(messages, fallback = '') {
  const first = (Array.isArray(messages) ? messages : []).find((message) => message?.role === 'user');
  const text = first?.content?.find?.((part) => part?.type === 'text')?.text;
  /* O cache do Claude guarda o texto que foi ao motor (com o envelope de
     contexto); a prévia mostra a fala, nunca o bloco interno. */
  const visible = typeof text === 'string' ? displayUserText(text) : '';
  return visible ? visible.slice(0, 160) : fallback;
}

/**
 * Canal Claude de um chat lateral. `deps` troca o adaptador e o serviço nos testes.
 * @param {{id: string, descriptor: string, runtime: string, prepare: (record: object) => unknown,
 *   sdkLoader?: unknown, claudePath?: string, detectClaude?: unknown, onEvent: (event: object) => void,
 *   log: (scope: string, line: string) => void, deps?: {Adapter?: typeof ClaudeAdapter, Service?: typeof ClaudeService}}} options
 */
function createClaudeSideEngine({
  id,
  descriptor,
  runtime,
  prepare,
  sdkLoader,
  claudePath,
  detectClaude,
  onEvent,
  log,
  deps = {},
} = {}) {
  const Adapter = deps.Adapter || ClaudeAdapter;
  const Service = deps.Service || ClaudeService;
  if (typeof prepare !== 'function') throw Error(invalidValue('prepare', prepare, 'function (preparação do Claude no chat lateral)'));
  conversations.recoverClaudeConversation(descriptor, {runtime});
  const record = conversations.readClaudeConversation(descriptor, {runtime});
  if (!record) throw Error(message('err.sidechat.recordMissing'));
  const {cwd, systemPrompt} = prepare(record);
  const toolPolicy = {readPaths: [], readRoots: [cwd]};
  const deliveryUncertain = record.delivery?.status === 'uncertain';
  const adapter = new Adapter({
    conversationId: descriptor,
    sessionId: record.nativeSessionId,
    resume: record.nativeEstablished,
    cwd,
    // Follow the user's current launcher on reconnect; the descriptor only
    // remembers the last observed binary. Session identity is the native ID.
    claudePath: claudePath || record.pinnedExecutable || null,
    detectClaude,
    systemPrompt,
    sdkLoader,
    deliveryUncertain,
    selection: {model: record.model || null, effort: record.effort || null},
    priorMessages:record.messages||[],
    toolPolicy,
    persistDelivery(delivery) {
      conversations.updateClaudeConversation(descriptor, {
        delivery,
        ...(delivery.status === 'accepted' ? {nativeEstablished: true} : {}),
      }, {runtime});
    },
  });
  const service = new Service({
    adapter,
    uncertain: deliveryUncertain,
    messages: record.messages || [],
    onMessages(messages) {
      conversations.updateClaudeConversation(descriptor, {
        messages,
        preview: previewFromMessages(messages, record.preview),
      }, {runtime});
    },
    onSelection(patch) {
      conversations.updateClaudeConversation(descriptor, patch, {runtime});
    },
    onInit(event) {
      const patch = {};
      if (event?.executable && fs.existsSync(event.executable)) patch.pinnedExecutable = fs.realpathSync(event.executable);
      if (Object.keys(patch).length) conversations.updateClaudeConversation(descriptor, patch, {runtime});
      if (event?.executableNote) log?.('sidechat', event.executableNote);
    },
  });
  service.toolPolicy = toolPolicy;
  return nativeSideChannel({engine: 'claude', id, service, toolPolicy, onEvent, log});
}

/**
 * O canal lateral sobre um serviço nativo (Claude ou OpenCode): a mesma forma
 * do canal Pi para o manager. Só o Claude lê os PDFs do contexto pela política
 * de ferramentas; o OpenCode recebe o texto.
 * @param {{engine: 'claude'|'opencode', id: string, service: import('./src/agents/service.cjs').NativeService,
 *   toolPolicy?: {readPaths: string[], readRoots: string[]}|null, onEvent: (event: object) => void,
 *   log: (scope: string, line: string) => void}} options
 * @example nativeSideChannel({engine: 'opencode', id: 'sc-1', service, onEvent, log})
 */
function nativeSideChannel({engine, id, service, toolPolicy = null, onEvent, log}) {
  let closed = false;
  service.on('event', (event) => {
    if (!closed) onEvent?.(event);
  });
  return {
    engine,
    async prompt({text, readPaths}) {
      const policy = toolPolicy ? {
        toolPolicy: {readPaths: (Array.isArray(readPaths) ? readPaths : []).slice(0, 2), readRoots: toolPolicy.readRoots},
      } : {};
      const result = await service.request('prompt', {message: text, ...policy});
      return {accepted: true, result};
    },
    async abort() {
      return service.request('abort');
    },
    respond(data) {
      return service.respond(data);
    },
    close() {
      closed = true;
      try {
        service.stop();
      } catch (error) {
        log?.('sidechat', `${id}: falha ao encerrar o ${engine} (${error?.message || error})`);
      }
    },
    isBusy() {
      return service.isRunning();
    },
    isUncertain() {
      return service.uncertain === true;
    },
    messages() {
      return Array.isArray(service.messages) ? service.messages : [];
    },
  };
}

/**
 * Canal OpenCode de um chat lateral (#74): descritor nativo próprio no mesmo
 * `opencode serve` da principal. `connect` vem do host do tutor OpenCode, que
 * é o dono do servidor, e devolve o serviço já ligado ao adaptador.
 * @param {{id: string, descriptor: string, runtime: string,
 *   connect: (request: {descriptor: string, record: object}) => import('./src/agents/service.cjs').NativeService,
 *   onEvent: (event: object) => void, log: (scope: string, line: string) => void}} options
 * @example createOpenCodeSideEngine({id, descriptor: descriptor.claude, runtime, connect: openCodeTutor.connectSide, onEvent, log})
 */
function createOpenCodeSideEngine({id, descriptor, runtime, connect, onEvent, log} = {}) {
  if (typeof connect !== 'function') throw Error(invalidValue('connect', connect, 'function (serviço OpenCode do chat lateral)'));
  conversations.recoverClaudeConversation(descriptor, {runtime});
  const record = conversations.readClaudeConversation(descriptor, {runtime});
  if (!record) throw Error(message('err.sidechat.recordMissing'));
  return nativeSideChannel({engine: 'opencode', id, service: connect({descriptor, record}), onEvent, log});
}

module.exports = {createPiSideEngine, createClaudeSideEngine, createOpenCodeSideEngine, syncSideModel};
