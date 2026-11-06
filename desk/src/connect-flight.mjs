/* Voo de connect do renderer com identidade própria (#r5-D): cada `connect()`
   abre um voo com geração só dele. Só o voo corrente escreve em `S.*`
   (connecting, connected, link, engine, mensagens, modelos) no sucesso, no erro
   e no `finally`; voo superado não escreve nada. Quem para a ponte
   (save-config, troca de matéria/sessão, relink de provedor) invalida o voo
   corrente, e o `connect()` seguinte abre um voo novo mesmo na mesma sessão.
   Com voo pendente na mesma sessão, um voo novo liga em fundo e quem chamou
   recebe o NOVO (o desfecho do próprio pedido). */

/** Geração do último voo aberto (só cresce). @type {number} */
let flightGeneration = 0;
/** Geração do voo que ainda pode escrever (`0` = nenhum). @type {number} */
let currentFlightId = 0;

/**
 * Abre um voo novo e o marca como corrente. O id volta para o `connect()` o
 * guardar no fechamento e comparar no assentar.
 * @returns {number} o id do voo aberto
 * @example const flight = beginConnectFlight();
 */
export function beginConnectFlight() {
  flightGeneration += 1;
  currentFlightId = flightGeneration;
  return currentFlightId;
}

/**
 * Diz se o voo ainda é o corrente (pode escrever em `S.*`).
 * @param {number} flight o id devolvido por `beginConnectFlight`
 * @returns {boolean} `true` só para o voo corrente
 * @example if (!isCurrentConnectFlight(flight)) return;
 */
export function isCurrentConnectFlight(flight) {
  return flight !== 0 && flight === currentFlightId;
}

/**
 * Invalida o voo corrente sem escrever estado: o próximo `connect()` abre um
 * voo novo mesmo na mesma sessão, e o resultado tardio do voo antigo é
 * ignorado. Quem para a ponte chama antes do IPC de saída.
 * @returns {void}
 * @example invalidateConnectFlight();
 */
export function invalidateConnectFlight() {
  flightGeneration += 1;
  currentFlightId = 0;
}

/**
 * Invalida o voo corrente e solta a referência pendente de `S`, sem escrever
 * estado (nem `connected`, nem `link`, nem `connectingSession`). O resultado
 * tardio do voo antigo é ignorado pela comparação de geração.
 * @param {{connecting: Promise<unknown>|null, connectingSession: string|null}} S o estado vivo do renderer
 * @returns {void}
 * @example detachConnectFlight(S);
 */
export function detachConnectFlight(S) {
  invalidateConnectFlight();
  if (S.connecting) {
    S.connecting.catch(() => {});
    S.connecting = null;
  }
  S.connectingSession = null;
}

/**
 * Dependências do `connect()` para o voo escrever sem importar `state.mjs` de
 * volta (o módulo de estado injeta; a lógica de voo não se repete nos
 * chamadores de `connect()`).
 * @typedef {object} ConnectFlightDeps
 * @property {{connected: boolean, connecting: Promise<unknown>|null, connectingSession: string|null, connectCancelled: boolean, currentSession: string, busy: boolean, switching: boolean, healthFails: number, modelCatalog: Array<object>, captureOk: boolean}} S o estado vivo do renderer
 * @property {(value: boolean) => void} setTabsDisabled trava as abas de matéria
 * @property {(state: string, label?: string, reason?: string) => void} connectionState pinta o ponto do tutor
 * @property {(data: unknown) => boolean} applyEngineData adota o motor do resultado
 * @property {(result: object) => void} updateSettings aplica modelos e controles
 * @property {(data: object) => void} fillSessions adota sessões e sessão corrente
 * @property {() => void} updateWindowTitle repinta o título com a sessão nova
 * @property {(messages: Array<object>, cards: Array<object>, identity: unknown) => void} showHistory desenha o histórico
 * @property {() => unknown} historyIdentityShown identidade do histórico visível
 * @property {(key: string) => string} message texto do catálogo
 * @property {(text: string) => void} toast aviso flutuante
 */

/**
 * Monta o `connect()` do renderer sobre a identidade de voo. Mesma sessão com
 * voo pendente: um voo novo liga em fundo e quem chamou recebe o NOVO (o
 * desfecho do próprio pedido) — receber o antigo faria o `send()` desistir do
 * envio com a falha do voo velho enquanto a sessão liga logo depois. Sessão
 * trocada: o antigo é descartado e o novo é devolvido.
 * @param {ConnectFlightDeps} deps as dependências do `state.mjs`
 * @returns {() => Promise<unknown>} o `connect()` com guarda de geração
 * @example export const connect = createConnectRunner({S, connectionState, setTabsDisabled, applyEngineData, updateSettings, fillSessions, updateWindowTitle, showHistory, historyIdentityShown, message, toast});
 */
export function createConnectRunner(deps) {
  /**
   * Liga o tutor na sessão corrente. Só o voo corrente escreve em `S.*`.
   * @returns {Promise<unknown>|undefined} o voo novo (o atual no fechamento) ou nada com o tutor ligado
   */
  async function connect() {
    const { S } = deps;
    if (S.connected) return undefined;
    if (S.connecting) {
      if (S.connectingSession === S.currentSession) {
        /* Segundo pedido com o voo cancelado ainda pendente: o novo liga em
           fundo e quem chamou recebe o NOVO (o desfecho do próprio pedido),
           não o antigo destacado — o `send()` trata o connect resolvido como
           "pode promptar", e receber a falha do voo velho desistiria do envio
           com a sessão ligando logo depois. */
        launchFlight();
        S.connecting.catch(() => {});
        return S.connecting;
      }
      detachConnectFlight(S);
    }
    launchFlight();
    return S.connecting;
  }

  /**
   * Abre o voo novo e o pendura em `S.connecting`.
   * @returns {void}
   */
  function launchFlight() {
    const { S } = deps;
    const flight = beginConnectFlight();
    S.connectCancelled = false;
    S.connectingSession = S.currentSession;
    deps.setTabsDisabled(true);
    deps.connectionState('connecting', deps.message('tutor.link.connecting'));
    let hung = 0;
    S.connecting = (async () => {
      const timer = setTimeout(() => { hung = 1; }, 90000);
      try {
        const result = await window.desk.connect(deps.historyIdentityShown());
        /* Voo superado resolve em silêncio: nada do motor antigo (engine,
           histórico) entra na sessão nova. */
        if (!isCurrentConnectFlight(flight)) return undefined;
        /* Metadados do motor ANTES de qualquer gating/estado: o host roteia o
           connect pelo motor da conversa (nunca inicia outro motor numa conversa Claude). */
        deps.applyEngineData(result);
        S.connected = true;
        S.healthFails = 0;
        S.modelCatalog = result.models || [];
        if (result.captureAvailable != null) S.captureOk = !!result.captureAvailable;
        deps.updateSettings(result);
        deps.fillSessions(result);
        deps.updateWindowTitle();
        deps.connectionState('online');
        if (result.conversationStatus?.uncertain) deps.toast(deps.message('tutor.uncertainDelivery'));
        if (result.messages?.length || result.cards?.length) deps.showHistory(result.messages || [], result.cards || [], result.historyIdentity);
        return undefined;
      } catch (error) {
        /* Voo superado rejeita sem escrever: a sessão nova segue ligada. */
        if (!isCurrentConnectFlight(flight)) {
          if (error && typeof error === 'object') error.connectFailure = true;
          throw error;
        }
        if (S.connectCancelled) {
          /* Cancelar é decisão da pessoa: volta a desligado, sem erro nem aviso. */
          S.connected = false;
          deps.connectionState('');
          const stop = Error(deps.message('tutor.error.cancelled'));
          stop.cancelled = true;
          stop.connectFailure = true;
          throw stop;
        }
        /* Sem aviso flutuante: a coluna já escreve o motivo (e a instrução do motor) com Chamar de novo ao lado (#23). */
        /* O getConfig cede a vez: um save-config/relink ou um voo novo pode
           ter tomado o lugar enquanto ele respondia, e escrever por cima
           derrubaria a sessão já ligada (revisão connect-parar, achado 1). */
        let engineData = null;
        try {
          engineData = await window.desk.getConfig();
        } catch {
          /* a falha já é a que a coluna mostra */
        }
        /* Re-depois-de TODO await, antes de escrever em S.*: só o corrente escreve. */
        if (!isCurrentConnectFlight(flight)) {
          if (error && typeof error === 'object') error.connectFailure = true;
          throw error;
        }
        if (engineData) deps.applyEngineData(engineData);
        S.connected = false;
        deps.connectionState('error', deps.message('tutor.link.error'), hung ? deps.message('tutor.error.timeout') : error.message);
        if (error && typeof error === 'object') error.connectFailure = true;
        throw error;
      } finally {
        clearTimeout(timer);
        if (isCurrentConnectFlight(flight)) {
          S.connecting = null;
          S.connectingSession = null;
          deps.setTabsDisabled(S.busy || S.switching);
        }
      }
    })();
  }

  return connect;
}
