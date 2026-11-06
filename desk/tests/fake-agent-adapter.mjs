// Adaptador falso do serviço nativo para os testes de persistência (#117):
// histórico em memória com as MESMAS referências de mensagem que o serviço
// recebe, como o `_mergePrior` do adaptador Claude real.
import {EventEmitter} from 'node:events';

/**
 * Adaptador mínimo do `NativeService` com histórico em memória.
 * @param {{messages?: object[]}} [options] mensagens iniciais do histórico
 * @returns {EventEmitter & {busy: boolean, cached: object[], sent: object[], cancelled: boolean, stopped: boolean}}
 * @example const adapter = fakeAgentAdapter({messages: record.messages});
 */
export function fakeAgentAdapter({messages = []} = {}) {
  const adapter = new EventEmitter();
  adapter.busy = false;
  adapter.historyComplete = true;
  adapter.cancelled = false;
  adapter.stopped = false;
  adapter.cached = messages.slice();
  adapter.sent = [];
  adapter.snapshot = () => ({busy: adapter.busy, model: {id: 'fake'}});
  adapter.connect = async () => {};
  adapter.history = async () => adapter.cached.slice();
  adapter.cacheHistory = list => { adapter.cached = list.slice(); };
  adapter.send = async input => { adapter.sent.push(input); return {id: input.id, accepted: true}; };
  adapter.cancel = async () => { adapter.cancelled = true; return {cancelled: true}; };
  adapter.stop = () => { adapter.stopped = true; };
  return adapter;
}
