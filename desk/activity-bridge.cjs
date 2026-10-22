'use strict';

/* Ponte da ferramenta de atividade: credencial efêmera por conversa, escopo
   capturado pelo host e nenhum caminho vindo do modelo. Mesmo padrão do
   `tutor-materials.cjs`, com duas peças a mais:
 *
 *   - `createCallRegistry`: correlação de chamada para o caminho Claude, cujo
 *     handler MCP não recebe `toolCallId`. O hook PreToolUse do adaptador
 *     registra `{callRef, toolCallId, conversationId, generation, paramsHash}`
 *     e injeta o `callRef` em `updatedInput`; o handler resolve a referência e
 *     ignora qualquer valor fornecido pelo modelo.
 *   - validação/cap do payload (64 KiB) antes de chamar o publicador.
 *
 * A publicação recebe SEMPRE `(scope, payload, caller)`:
 *   scope  = escopo capturado no grant (conversa, geração, matéria/Livre);
 *   caller = {toolCallId, callRef, paramsHash, engine};
 * O callback do host decide o que gravar; a ponte não lê disco nem inferência. */

const http = require('node:http');
const crypto = require('node:crypto');
const {normalizeSpec, canonicalSpec, isSafeId, ActivityStoreError} = require('./activity-store.cjs');
const {message} = require('./src/i18n.mjs');
const {describeReceived, invalidValue} = require('./src/error-detail.mjs');

const ACTIVITY_CALL_REF_FIELD = 'callRef';
const MAX_BODY_BYTES = 300000;
const MAX_BODY_TIME = 15000;

function createCallRegistry({ttlMs = 10 * 60 * 1000, max = 256, now = Date.now} = {}) {
  const calls = new Map();
  const prune = () => {
    const at = now();
    for (const [ref, entry] of calls) {
      if (at - entry.at > ttlMs) calls.delete(ref);
    }
    while (calls.size > max) {
      const oldest = calls.keys().next().value;
      calls.delete(oldest);
    }
  };
  return {
    registerCall({callRef, toolCallId, conversationId, generation = 0, paramsHash = '', scopeRef = ''} = {}) {
      if (typeof callRef !== 'string' || callRef.length < 8 || callRef.length > 80) throw new Error(invalidValue('callRef', callRef, 'string de 8 a 80 caracteres'));
      if (typeof toolCallId !== 'string' || toolCallId.trim() === '' || toolCallId.length > 160) throw new Error(invalidValue('toolCallId', toolCallId, 'string não vazia de até 160 caracteres'));
      if (typeof conversationId !== 'string' || conversationId.trim() === '' || conversationId.length > 512) throw new Error(invalidValue('conversationId', conversationId, 'string não vazia de até 512 caracteres'));
      prune();
      calls.set(callRef, {
        callRef,
        toolCallId,
        conversationId,
        generation: Number.isFinite(Number(generation)) ? Number(generation) : 0,
        paramsHash: typeof paramsHash === 'string' ? paramsHash : '',
        scopeRef: typeof scopeRef === 'string' ? scopeRef.slice(0, 128) : '',
        at: now(),
      });
      prune();
      return {callRef: callRef.slice(0, 12)};
    },
    resolve(callRef, {conversationId, generation, paramsHash} = {}) {
      if (typeof callRef !== 'string' || callRef === '') return null;
      const entry = calls.get(callRef);
      if (!entry) return null;
      if (now() - entry.at > ttlMs) {
        calls.delete(callRef);
        return null;
      }
      if (conversationId !== undefined && entry.conversationId !== conversationId) return null;
      if (generation !== undefined && Number(entry.generation) !== Number(generation)) return null;
      if (paramsHash !== undefined && paramsHash !== '' && entry.paramsHash !== paramsHash) return null;
      return {toolCallId: entry.toolCallId, conversationId: entry.conversationId, generation: entry.generation, scopeRef: entry.scopeRef};
    },
    size() { return calls.size; },
    clear() { calls.clear(); },
    /* Usado pelo hook PreToolUse: devolve uma cópia de `input` com o campo
       reservado. O modelo pode mandar esse campo; o valor do modelo é
       substituído pelo do host antes de o handler rodar. */
    injectRef(input, callRef) {
      const next = {...(input && typeof input === 'object' ? input : {})};
      next[ACTIVITY_CALL_REF_FIELD] = callRef;
      return next;
    },
  };
}

function httpStatus(error) {
  const code = error && error.code;
  if (code === 'LIMIT') return 429;
  if (code === 'CORRUPT') return 500;
  if (code === 'MISSING' || code === 'STALE') return 409;
  return 400;
}

/* Extrai só os campos do contrato: nada de caminho, URL ou campo extra entra.
   `activityId` (opcional) pede uma revisão imutável da atividade existente na
   MESMA conversa; ele participa do paramsHash para que o hook e o handler
   recusem qualquer troca entre a reserva e a execução. */
function pickPayload(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ActivityStoreError('BAD_INPUT', message('err.bridge.badPayload', {what: 'activity', received: describeReceived(raw)}));
  const spec = normalizeSpec({
    title: raw.title,
    objective: raw.objective,
    alternativeMarkdown: raw.alternativeMarkdown,
    html: raw.html,
    css: raw.css,
    js: raw.js,
    katex: raw.katex === true,
    kind: raw.kind === 'visualizacao' ? 'visualizacao' : undefined,
    charts: raw.charts === true,
  });
  let activityId = '';
  if (raw.activityId !== undefined && raw.activityId !== null && raw.activityId !== '') {
    if (typeof raw.activityId !== 'string' || !isSafeId(raw.activityId)) throw new ActivityStoreError('BAD_INPUT', message('err.bridge.badRevision', {received: describeReceived(raw.activityId)}));
    activityId = raw.activityId;
  }
  const toolCallId = typeof raw.toolCallId === 'string' ? raw.toolCallId.slice(0, 160) : '';
  const callRef = typeof raw[ACTIVITY_CALL_REF_FIELD] === 'string' ? raw[ACTIVITY_CALL_REF_FIELD].slice(0, 80) : '';
  const paramsHash = 'sha256:' + crypto.createHash('sha256').update(canonicalSpec(spec) + '\n' + activityId, 'utf8').digest('hex');
  return {spec, toolCallId, callRef, paramsHash, activityId};
}

/**
 * @param {{publish?: (scope: object, spec: object, caller: {toolCallId: string, callRef?: string}) => Promise<unknown>,
 *   preview?: ((raw: unknown, options: object) => Promise<unknown>) | null,
 *   figure?: ((raw: unknown) => Promise<unknown>) | null, pdfPage?: ((raw: {path?: unknown, first?: unknown, last?: unknown}) => Promise<object>) | null,
 *   engine?: string, maxBodyBytes?: number,
 *   tutorText?: (raw: string) => string}} [options]
 *   `tutorText` põe a mensagem marcada no idioma do tutor: a resposta vai ao
 *   modelo, que não lê a marca U+E000 (#43 fase 3).
 */
function createActivityBridge({publish, preview = null, figure = null, pdfPage = null, engine = 'pi', maxBodyBytes = MAX_BODY_BYTES, tutorText = (raw) => raw} = {}) {
  if (typeof publish !== 'function') throw new Error(invalidValue('publish', publish, 'function'));
  const grants = new Map();
  let port = 0;
  let startPromise = null;
  let closed = false;

  const reply = (res, status, data) => {
    if (res.destroyed) return;
    res.writeHead(status, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'});
    res.end(JSON.stringify(data));
  };
  const refuse = (res, status, key, args) => reply(res, status, {error: tutorText(message(key, args))});

  const server = http.createServer(async (req, res) => {
    const token = String(req.headers['x-mesa-token'] || '');
    const grant = grants.get(token);
    /* `/preview` (#42): a prévia do tutor — mesmo token, nada gravado. */
    const route = req.url === '/activity' ? 'activity'
      : req.url === '/preview' && typeof preview === 'function' ? 'preview'
        /* `/figure` (#60): o print da figura (SVG ou `plot`) — mesmo token, nada gravado. */
        : req.url === '/figure' && typeof figure === 'function' ? 'figure'
          /* `/pdf-page` (#70): o texto de páginas da biblioteca para o OpenCode — mesmo token, nada gravado. */
          : req.url === '/pdf-page' && typeof pdfPage === 'function' ? 'pdf-page' : '';
    if (req.method !== 'POST' || !route) {
      refuse(res, 404, 'err.bridge.unavailable', {method: describeReceived(req.method), route: describeReceived(req.url)});
      return;
    }
    if (!grant) {
      refuse(res, 403, 'err.bridge.notAuthorized');
      return;
    }
    if (!/^application\/json(?:;|$)/i.test(String(req.headers['content-type'] || ''))) {
      refuse(res, 415, 'err.bridge.badContentType', {received: describeReceived(req.headers['content-type'])});
      return;
    }
    const declared = Number(req.headers['content-length']) || 0;
    if (declared > maxBodyBytes) {
      refuse(res, 413, 'err.bridge.tooBig', {bytes: declared, max: maxBodyBytes});
      return;
    }
    let bytes = 0;
    const chunks = [];
    const timer = setTimeout(() => req.destroy(Error(`Corpo demorou mais de ${MAX_BODY_TIME} ms.`)), MAX_BODY_TIME);
    timer.unref?.();
    try {
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > maxBodyBytes) {
          refuse(res, 413, 'err.bridge.tooBig', {bytes, max: maxBodyBytes});
          req.destroy();
          return;
        }
        chunks.push(chunk);
      }
      let raw;
      try {
        raw = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        refuse(res, 400, 'err.bridge.badJson', {bytes});
        return;
      }
      if (grants.get(token) !== grant) {
        refuse(res, 409, 'err.bridge.sessionChanged');
        return;
      }
      if (route === 'pdf-page') {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ActivityStoreError('BAD_INPUT', message('err.bridge.badPayload', {what: 'pdf-page', received: describeReceived(raw)}));
        reply(res, 200, {read: true, ...(await pdfPage(raw))});
        return;
      }
      if (route === 'figure') {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ActivityStoreError('BAD_INPUT', message('err.bridge.badPayload', {what: 'figure', received: describeReceived(raw)}));
        reply(res, 200, {viewed: true, ...(await figure(raw))});
        return;
      }
      if (route === 'preview') {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ActivityStoreError('BAD_INPUT', message('err.bridge.badPayload', {what: 'preview', received: describeReceived(raw)}));
        const result = await preview(raw, {theme: raw.theme, width: raw.width});
        reply(res, 200, {previewed: true, ...result});
        return;
      }
      const {spec, toolCallId, callRef, paramsHash, activityId} = pickPayload(raw);
      const caller = {toolCallId, callRef, paramsHash, engine: grant.engine || engine};
      const result = await publish({...grant.scope}, activityId ? {...spec, activityId} : spec, caller);
      if (grants.get(token) !== grant) {
        refuse(res, 409, 'err.activity.sessionChangedPublishing');
        return;
      }
      reply(res, 200, {
        published: true,
        id: result.id,
        version: result.version,
        hash: result.hash,
        kind: 'activity',
        title: result.title,
        reused: result.reused === true,
        reviewRequired: false,
      });
    } catch (error) {
      reply(res, httpStatus(error), {error: tutorText(error.message || message('err.bridge.failed'))});
    } finally {
      clearTimeout(timer);
    }
  });
  server.requestTimeout = 65000;
  server.headersTimeout = 10000;

  return {
    start() {
      if (closed) return Promise.reject(Error('Ponte de atividades encerrada.'));
      if (!startPromise) {
        startPromise = new Promise((resolve, reject) => {
          server.once('error', reject);
          server.listen(0, '127.0.0.1', () => {
            server.removeListener('error', reject);
            port = server.address().port;
            resolve();
          });
        });
      }
      return startPromise;
    },
    grant(scope, {engine: engineName}={}) {
      if (!port || closed) throw Error(`Ponte de atividades ainda indisponível (porta ${port}, ${closed ? 'encerrada' : 'sem start()'}).`);
      if (!scope || typeof scope.conversationId !== 'string' || scope.conversationId.trim() === '') throw Error(invalidValue('scope.conversationId', scope?.conversationId, 'string não vazia'));
      const token = crypto.randomBytes(32).toString('hex');
      grants.set(token, {scope: {...scope}, engine: engineName || engine});
      return {url: `http://127.0.0.1:${port}/activity`, token};
    },
    revoke(token) {
      grants.delete(token);
    },
    get grantCount() { return grants.size; },
    async close() {
      closed = true;
      grants.clear();
      await startPromise?.catch(() => {});
      if (server.listening) {
        await new Promise((resolve) => {
          server.close(resolve);
          server.closeAllConnections();
        });
      }
      port = 0;
    },
  };
}

/* Hash do input do hook PreToolUse, idêntico ao que o handler calcula.
   O hook registra a chamada com ESTE hash e o handler revalida com ele: se o
   input mudar entre o hook e a execução, a referência não resolve. */
function paramsHashOfToolInput(input) {
  try {
    return pickPayload(input).paramsHash;
  } catch {
    return '';
  }
}

/* Serviço que liga ponte/ferramenta ao store e ao runtime. O pai passa o que
   muda de host para host: store, runtime, registry (Claude), isScopeActive
   (revalida a conversa capturada no momento da publicação) e emit (evento ao
   renderer). Nenhum caminho/URL do modelo atravessa esta função. */
function createActivityService({store, runtime, registry, emit, isScopeActive, engine = 'pi'} = {}) {
  if (!store || typeof store.publish !== 'function') throw new Error(invalidValue('store', store, '{publish, ...}'));
  if (!runtime || typeof runtime.remember !== 'function') throw new Error(invalidValue('runtime', runtime, '{remember, ...}'));
  const fail = (code, message) => {
    const error = new Error(message);
    error.code = code;
    throw error;
  };
  const identify = (caller, scope) => {
    if (!caller) return null;
    if (typeof caller.toolCallId === 'string' && caller.toolCallId.trim()) {
      return {toolCallId: caller.toolCallId.slice(0, 160), callRef: String(caller.callRef || ''), engine: caller.engine || engine};
    }
    if (typeof caller.callRef === 'string' && caller.callRef && registry && typeof registry.resolve === 'function') {
      const resolved = registry.resolve(caller.callRef, {
        conversationId: scope ? scope.conversationId : undefined,
        generation: scope ? scope.generation : undefined,
        paramsHash: caller.paramsHash,
      });
      if (resolved) return {toolCallId: resolved.toolCallId, callRef: caller.callRef, engine: caller.engine || engine};
    }
    return null;
  };
  const publish = async (scope, spec, caller = {}) => {
    if (!scope || typeof scope.conversationId !== 'string' || scope.conversationId.trim() === '') fail('BAD_INPUT', 'escopo de sessão ausente; atividade não publicada.');
    if (typeof isScopeActive === 'function' && isScopeActive(scope) !== true) fail('STALE', 'a sessão mudou; publique a atividade na sessão atual.');
    const identity = identify(caller, scope);
    if (!identity) fail('BAD_INPUT', 'atividade sem identidade de chamada; não publicada.');
    const item = await store.publish({
      conversationId: scope.conversationId,
      generation: scope.generation,
      toolCallId: identity.toolCallId,
      callRef: identity.callRef,
      activityId: typeof spec.activityId === 'string' ? spec.activityId : '',
      spec,
    });
    runtime.remember(item, spec);
    /* `scopeRef` não é persistido: vive só na resposta/evento para o renderer
       devolver nas chamadas seguintes e o host validar o escopo capturado. */
    const result = scope.scopeRef ? {...item, scopeRef: scope.scopeRef} : item;
    try {
      if (typeof emit === 'function') {
        emit({
          status: 'published',
          activity: {
            id: item.id, version: item.version, hash: item.hash, kind: 'activity', title: item.title,
            objective: item.objective, toolCallId: item.toolCallId, conversationId: item.conversationId,
            generation: item.generation, createdAt: item.createdAt,
            ...(scope.scopeRef ? {scopeRef: scope.scopeRef} : {}),
          },
          scope: {
            conversationId: scope.conversationId, generation: item.generation,
            courseId: scope.courseId === undefined ? null : scope.courseId,
            freeSessionId: scope.freeSessionId === undefined ? null : scope.freeSessionId,
            ...(scope.scopeRef ? {scopeRef: scope.scopeRef} : {}),
          },
        });
      }
    } catch { /* evento é observabilidade; a publicação já está no disco */ }
    return result;
  };
  /* Caminho Claude: o handler só tem o campo reservado; a identidade real vem
     do registry (hook PreToolUse). `callRef` do modelo sem registro não passa. */
  const publishFromTool = async (args) => {
    const {spec, paramsHash, activityId} = pickPayload(args);
    const callRef = args && typeof args[ACTIVITY_CALL_REF_FIELD] === 'string' ? args[ACTIVITY_CALL_REF_FIELD] : '';
    if (!registry || typeof registry.resolve !== 'function') fail('BAD_INPUT', 'correlação de chamada indisponível; atividade não publicada.');
    const resolved = registry.resolve(callRef, {paramsHash});
    if (!resolved) fail('BAD_INPUT', 'referência de chamada desconhecida; atividade não publicada.');
    const scope = {conversationId: resolved.conversationId, generation: resolved.generation};
    if (resolved.scopeRef) scope.scopeRef = resolved.scopeRef;
    return publish(scope, activityId ? {...spec, activityId} : spec, {
      toolCallId: resolved.toolCallId,
      callRef,
      paramsHash,
      engine: 'claude',
    });
  };
  /* Leitura pelo renderer: o item sai do store e garante que o runtime possa
     servir o documento (o protocolo só entrega o que foi registrado). */
  const rememberRead = (item, spec) => runtime.remember(item, spec);
  return {publish, publishFromTool, rememberRead};
}

module.exports = {
  ACTIVITY_CALL_REF_FIELD,
  MAX_BODY_BYTES,
  createCallRegistry,
  createActivityBridge,
  createActivityService,
  pickPayload,
  paramsHashOfToolInput,
  httpStatus,
};
