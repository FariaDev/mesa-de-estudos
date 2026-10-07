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
const {PiBridge} = require('./rpc.cjs');
const {displayUserText} = require('./sidechat.cjs');
const conversations = require('./src/agents/conversations.cjs');
const {ClaudeAdapter} = require('./src/agents/claude-adapter.cjs');
const {ClaudeService} = require('./src/agents/service.cjs');

function createPiSideEngine({id, sessionPath, cwd, pi, env, extraArgs = [], promptFile = '', onEvent, log} = {}) {
  const bridge = new PiBridge({cwd, session: sessionPath, pi, env, promptFile, extraArgs});
  let closed = false;
  bridge.on('event', (event) => {
    if (!closed) onEvent?.(event);
  });
  bridge.on('stderr', (text) => {
    if (!closed) log?.('sidechat', `${id}: ${text}`);
  });
  return {
    engine: 'pi',
    async prompt({text, running}) {
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

function createClaudeSideEngine({
  id,
  descriptor,
  runtime,
  prepare,
  sdkLoader,
  claudePath,
  onEvent,
  log,
  deps = {},
} = {}) {
  const Adapter = deps.Adapter || ClaudeAdapter;
  const Service = deps.Service || ClaudeService;
  if (typeof prepare !== 'function') throw Error('preparação do Claude ausente para o chat lateral.');
  conversations.recoverClaudeConversation(descriptor, {runtime});
  const record = conversations.readClaudeConversation(descriptor, {runtime});
  if (!record) throw Error('O registro desta conversa Claude está indisponível. O arquivo foi preservado; abra um novo chat lateral.');
  const {cwd, systemPrompt} = prepare(record);
  const toolPolicy = {readPaths: [], readRoots: [cwd]};
  const deliveryUncertain = record.delivery?.status === 'uncertain';
  const adapter = new Adapter({
    conversationId: descriptor,
    sessionId: record.nativeSessionId,
    resume: record.nativeEstablished,
    cwd,
    claudePath: record.pinnedExecutable || claudePath || null,
    systemPrompt,
    sdkLoader,
    deliveryUncertain,
    selection: {model: record.model || null, effort: record.effort || null},
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
    },
  });
  service.toolPolicy = toolPolicy;
  let closed = false;
  service.on('event', (event) => {
    if (!closed) onEvent?.(event);
  });
  return {
    engine: 'claude',
    async prompt({text, readPaths}) {
      const policy = {
        readPaths: (Array.isArray(readPaths) ? readPaths : []).slice(0, 2),
        readRoots: toolPolicy.readRoots,
      };
      const result = await service.request('prompt', {message: text, toolPolicy: policy});
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
        log?.('sidechat', `${id}: falha ao encerrar o Claude (${error?.message || error})`);
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

module.exports = {createPiSideEngine, createClaudeSideEngine};
