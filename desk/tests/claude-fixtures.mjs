/* Fixtures da ponte Claude: SÓ simulação.
 *
 * Nenhum processo Claude Code real, nenhuma credencial, nenhuma sessão, nenhum
 * material de curso. O "SDK" fake implementa apenas a superfície que o
 * adaptador usa (`query({prompt, options})` com interrupt/close e
 * `getSessionMessages`); os testes empurram as mensagens que o CLI real
 * emitiria e provam o comportamento do adaptador contra elas.
 */
import {randomUUID} from 'node:crypto';

export const UUID = {
  a: '11111111-1111-4111-8111-111111111111',
  b: '22222222-2222-4222-8222-222222222222',
  c: '33333333-3333-4333-8333-333333333333',
  wrong: '99999999-9999-4999-8999-999999999999',
  session: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  otherSession: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
};

export function newUuid() {
  return randomUUID();
}

/* Fila assíncrona usada nos dois sentidos: o adaptador empurra mensagens do
   usuário e o teste/fake empurra mensagens do "CLI". */
export function pushQueue() {
  const items = [];
  const waiters = [];
  let ended = false;
  let error = null;
  const wake = () => {
    for (const waiter of waiters.splice(0)) waiter();
  };
  return {
    push(item) {
      if (ended) throw new Error('fila encerrada');
      items.push(item);
      wake();
    },
    end() {
      ended = true;
      wake();
    },
    fail(err) {
      error = err;
      ended = true;
      wake();
    },
    get size() {
      return items.length;
    },
    [Symbol.asyncIterator]() {
      return {
        next: async () => {
          for (;;) {
            if (items.length) return {value: items.shift(), done: false};
            if (error) {
              const current = error;
              error = null;
              throw current;
            }
            if (ended) return {value: undefined, done: true};
            await new Promise((resolve) => waiters.push(resolve));
          }
        },
        return: async () => {
          ended = true;
          wake();
          return {value: undefined, done: true};
        },
      };
    },
  };
}

/* SDK fake: cada query() registra as opções e expõe um outbox para o teste
   empurrar mensagens do CLI. `close()` não encerra o outbox por padrão, para o
   teste conseguir provar que eventos de consulta velha são descartados.
   `getSessionMessages` fatia `state.history` por offset/limit e respeita
   `state.pageSize` (para provar a paginação). */
export function fakeSdk() {
  const state = {
    queries: [],
    history: [],
    historyCalls: [],
    pageSize: null,
  };
  const sdk = {
    state,
    query({prompt, options}) {
      const out = pushQueue();
      const query = {
        prompt,
        options,
        out,
        interruptCalls: 0,
        closeCalls: 0,
        async interrupt() {
          query.interruptCalls += 1;
        },
        close() {
          query.closeCalls += 1;
        },
        emit(message) {
          out.push(message);
        },
        fail(error) {
          out.fail(error);
        },
        end() {
          out.end();
        },
        [Symbol.asyncIterator]() {
          return out[Symbol.asyncIterator]();
        },
      };
      state.queries.push(query);
      return query;
    },
    async getSessionMessages(sessionId, options = {}) {
      state.historyCalls.push({sessionId, options});
      const all = Array.isArray(state.history) ? state.history : [];
      const offset = Number.isFinite(options.offset) && options.offset > 0 ? Math.floor(options.offset) : 0;
      const limit = Number.isFinite(options.limit) && options.limit >= 0 ? Math.floor(options.limit) : all.length;
      const cap = Number.isFinite(state.pageSize) && state.pageSize > 0 ? Math.min(limit, state.pageSize) : limit;
      return all.slice(offset, offset + cap);
    },
  };
  return sdk;
}

export function fakeDetect(info = {}) {
  return async () => ({
    path: '/fake/claude/versions/2.1.246',
    launcherPath: '/fake/claude',
    version: '2.1.246',
    auth: {loggedIn: true, authMethod: 'oauth', apiProvider: 'firstParty'},
    warnings: [],
    ...info,
  });
}

/* Registra os estados de entrega persistidos; `failStatuses` pode forçar falha
   em status específicos e `asyncDelay` prova que o callback é aguardado mesmo
   sendo assíncrono. Sem delay, o callback é síncrono. */
export function persistRecorder({failStatuses = [], failMessage = 'falha simulada de persistência', asyncDelay = 0} = {}) {
  const calls = [];
  const failures = new Set(failStatuses);
  const persist = (state) => {
    calls.push({...state});
    if (failures.has(state.status)) {
      return Promise.reject(new Error(`${failMessage}: ${state.status}`));
    }
    if (asyncDelay > 0) {
      return new Promise((resolve) => setTimeout(resolve, asyncDelay));
    }
    return undefined;
  };
  return {calls, persist, failures};
}

export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {promise, resolve, reject};
}

export function tick() {
  return new Promise((resolve) => setImmediate(resolve));
}

export async function waitFor(predicate, timeoutMs = 2000, what = 'condição') {
  const start = Date.now();
  for (;;) {
    if (predicate()) return true;
    if (Date.now() - start > timeoutMs) throw new Error(`waitFor: tempo esgotado esperando ${what}`);
    await tick();
  }
}

export function withTimeout(promise, ms, what = 'operação') {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${what}: tempo esgotado (${ms}ms)`)), ms);
      timer.unref?.();
    }),
  ]).finally(() => clearTimeout(timer));
}

/* Puxa a próxima mensagem que o adaptador entregou ao iterador de entrada —
   é o que o transporte do SDK faria. Marca a mensagem como "entregue" para a
   classificação recusa × incerteza. */
export async function takeInput(query, timeoutMs = 2000) {
  const result = await withTimeout(query.prompt[Symbol.asyncIterator]().next(), timeoutMs, 'entrada do SDK');
  if (result.done) throw new Error('entrada do SDK terminou sem item');
  return result.value;
}

export function collectEvents(adapter) {
  const events = [];
  const listener = (event) => events.push(event);
  adapter.on('event', listener);
  return {
    events,
    of(type) {
      return events.filter((event) => event.type === type);
    },
    types() {
      return events.map((event) => event.type);
    },
    last(type) {
      return events.filter((event) => event.type === type).at(-1) || null;
    },
    off() {
      adapter.off('event', listener);
    },
  };
}

export function assistantMessage({uuid, text, toolUse, messageId = 'msg_1', model = 'claude-test', userMessageUuid, parent_tool_use_id = null, error} = {}) {
  const content = [];
  if (typeof text === 'string') content.push({type: 'text', text});
  if (toolUse) content.push({type: 'tool_use', id: toolUse.id, name: toolUse.name, input: toolUse.args ?? {}});
  return {
    type: 'assistant',
    message: {id: messageId, role: 'assistant', model, content},
    parent_tool_use_id,
    ...(error ? {error} : {}),
    uuid: uuid || newUuid(),
    session_id: UUID.session,
    ...(userMessageUuid ? {user_message_uuid: userMessageUuid} : {}),
  };
}

export function replayMessage(item, sessionId = UUID.session) {
  return {
    type: 'user',
    message: item.message,
    parent_tool_use_id: null,
    uuid: item.uuid,
    session_id: sessionId,
    isReplay: true,
  };
}

export function resultMessage({subtype = 'success', isError = false, userMessageUuid, userMessageUuids, result = 'ok', terminalReason} = {}) {
  return {
    type: 'result',
    subtype,
    is_error: isError,
    duration_ms: 1,
    duration_api_ms: 1,
    num_turns: 1,
    result,
    stop_reason: 'end_turn',
    total_cost_usd: 0,
    usage: {},
    modelUsage: {},
    permission_denials: [],
    errors: [],
    session_id: UUID.session,
    uuid: newUuid(),
    ...(userMessageUuid ? {user_message_uuid: userMessageUuid} : {}),
    ...(userMessageUuids ? {user_message_uuids: userMessageUuids} : {}),
    ...(terminalReason ? {terminal_reason: terminalReason} : {}),
  };
}

/* Evento nativo de limite do SDK pinado (`rate_limit_event` de primeiro
   nível). Todos os campos opcionais vêm dos tipos 0.3.246. */
export function rateLimitMessage({
  status = 'rejected',
  rateLimitType,
  resetsAt,
  utilization,
  overageStatus,
  overageResetsAt,
  isUsingOverage,
  overageInUse,
  overageDisabledReason,
  surpassedThreshold,
  sessionId = UUID.session,
} = {}) {
  return {
    type: 'rate_limit_event',
    rate_limit_info: {
      status,
      ...(rateLimitType === undefined ? {} : {rateLimitType}),
      ...(resetsAt === undefined ? {} : {resetsAt}),
      ...(utilization === undefined ? {} : {utilization}),
      ...(overageStatus === undefined ? {} : {overageStatus}),
      ...(overageResetsAt === undefined ? {} : {overageResetsAt}),
      ...(isUsingOverage === undefined ? {} : {isUsingOverage}),
      ...(overageInUse === undefined ? {} : {overageInUse}),
      ...(overageDisabledReason === undefined ? {} : {overageDisabledReason}),
      ...(surpassedThreshold === undefined ? {} : {surpassedThreshold}),
    },
    uuid: newUuid(),
    session_id: sessionId,
  };
}

export function initMessage({sessionId = UUID.session, version = '2.1.246', model = 'claude-test'} = {}) {
  return {
    type: 'system',
    subtype: 'init',
    claude_code_version: version,
    model,
    session_id: sessionId,
    cwd: '/tmp',
    tools: [],
    mcp_servers: [],
    permissionMode: 'default',
    slash_commands: [],
    output_style: 'default',
    skills: [],
    plugins: [],
    apiKeySource: 'none',
    uuid: newUuid(),
  };
}

export function historyEntry({role = 'assistant', text = 'mensagem', uuid = newUuid(), sessionId = UUID.session, parent_tool_use_id = null, parent_agent_id = null, content = null} = {}) {
  return {
    type: role,
    uuid,
    session_id: sessionId,
    parent_tool_use_id,
    parent_agent_id,
    message: {role, content: content || [{type: 'text', text}]},
  };
}
