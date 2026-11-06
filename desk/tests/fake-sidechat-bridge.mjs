// Bridge falso do chat lateral para testes unitários do renderer
// (`src/sidechat.mjs`, via `setSidechatBridge`): nenhum Electron, nenhum motor.
// O teste dirige cada aceite na mão — `prompt()` só resolve quando o teste
// chamar `resolvePrompt`, como o ACK do host real.
/**
 * @returns {{bridge: object, prompts: Array, opens: Array, saves: Array, emitted: Array, listeners: Array, resolvePrompt: Function, emit: Function, payload: Function}} mãos do teste + o bridge para `setSidechatBridge`
 * @example const fake = fakeSidechatBridge(); setSidechatBridge(fake.bridge);
 */
export function fakeSidechatBridge() {
  const prompts = [];
  const opens = [];
  const saves = [];
  const emitted = [];
  const listeners = [];
  let pending = null;
  let idCount = 0;
  let currentId = '';
  let openOverrides = {};
  const fake = {
    prompts,
    opens,
    saves,
    emitted,
    listeners,
    /** O próximo `sidechatOpen` devolve o payload misturado com `overrides`
     * (ex. `{uncertain: true}`, como o host entrega após reinício). Vale até
     * o próximo `setOpen`.
     * @param {object} [overrides] campos do payload da abertura
     * @example fake.setOpen({uncertain: true}); */
    setOpen(overrides) {
      openOverrides = {...(overrides || {})};
    },
    payload(overrides = {}) {
      return {
        id: currentId,
        engine: 'pi',
        messages: [],
        cards: [],
        draft: '',
        busy: false,
        uncertain: false,
        context: null,
        ...overrides,
      };
    },
    resolvePrompt(result) {
      const wait = pending;
      pending = null;
      wait.resolve(result);
    },
    emit(event, id) {
      for (const callback of listeners) callback({id: id || currentId, engine: 'pi', event});
    },
  };
  const bridge = {
    sidechatOpen: async (input) => {
      opens.push(JSON.parse(JSON.stringify(input || {})));
      if (input?.fresh || !currentId) currentId = `sc-${++idCount}`;
      return fake.payload(openOverrides);
    },
    sidechatPrompt: (input) => {
      prompts.push({id: input.id, text: input.text});
      return new Promise((resolve, reject) => {
        pending = {resolve, reject};
      });
    },
    sidechatAbort: async () => ({aborted: true}),
    sidechatSave: async (input) => {
      saves.push({id: input.id, draft: input.draft});
      return {ok: true, draft: input.draft};
    },
    sidechatContext: async () => fake.payload(),
    sidechatRespond: async () => ({ok: true}),
    onSidechatEvent: (callback) => {
      listeners.push(callback);
    },
    conversations: async () => [],
  };
  return {bridge, ...fake};
}
