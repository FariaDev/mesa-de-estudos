const {message: uiMsg} = require('./src/i18n.mjs');
const {causeArg} = require('./src/error-detail.mjs');
/* Ciclo de vida do envio de um prompt: validar → conectar → escrever → confirmar.
 *
 * Este é o pedaço do app que decide o que conta como entregue, e ele mora aqui,
 * fora do Electron, para poder ser exercitado com um bridge de mentira que falha
 * onde o teste mandar. As falhas acontecem em pontos diferentes e deixam estados
 * diferentes:
 *
 * - anexo inválido e falha de conexão acontecem ANTES de qualquer escrita: nada
 *   foi entregue e o contexto da Mesa não conta como enviado;
 * - falha na escrita é AMBÍGUA, não recusa: o pedido só é recusado depois de
 *   tentar escrever no stdin (ou por tempo), então o Pi pode ter recebido;
 * - `get_state` vem depois de um prompt já aceito: se ele falhar, a entrega
 *   aconteceu e o envio NÃO é erro — volta com aviso e estado desconhecido, para
 *   a fila não repetir uma mensagem que o Pi já recebeu.
 *
 * `onAccepted` é quem atualiza o que o app lembra do turno (`lastContextKey`):
 * ele é chamado uma vez, e só depois do aceite.
 *
 * Até a #50 este ciclo também carregava o bilhete Conversa → Mesa (marca de
 * "envio iniciado", dúvida, arquivo). O app Conversa saiu; a tag local
 * `conversa-final` guarda a versão com o bilhete.
 */

/**
 * @param {object} options
 * @param {{message: string, streamingBehavior: string}} options.request pedido já montado, sem anexos
 * @param {unknown} [options.images] anexos crus, como vieram do renderer
 * @param {(images: unknown) => {length: number} | null} [options.validateImages] valida ANTES de escrever
 * @param {() => {request: Function}} options.connect monta o bridge; pode lançar
 * @param {() => void} [options.onAccepted] aceite confirmado: atualiza o contexto do turno
 * @param {(aviso: string) => void} [options.onWarning] envio feito, mas algo acessório falhou (estado não lido)
 * @returns {Promise<{streaming: boolean}>}
 * @example
 * await deliverPrompt({request: {message: 'oi', streamingBehavior: 'followUp'}, connect: () => bridge});
 */
async function deliverPrompt({
  request,
  images,
  validateImages,
  connect,
  onAccepted,
  onWarning,
} = {}) {
  const anexos = typeof validateImages === 'function' ? validateImages(images) : null;
  const pedido = {...request};
  if (anexos && anexos.length) pedido.images = anexos;
  /* `connect()` pode lançar sem nada ter sido escrito: falha definida, o
     contexto não conta como enviado. */
  const bridge = connect();
  let disposition;
  let outcome;
  let motivoDoEnvio = '';
  try {
    const accepted = await bridge.request('prompt', pedido);
    disposition = accepted?.disposition;
    outcome = 'accepted';
  } catch (error) {
    motivoDoEnvio = error?.message || String(error);
    /* O bridge marca o que PROVA não ter sido transmitido (`notSent`): partida
       impossível, pedido recusado antes da escrita, stdin que não aceitou.
       Nesse caso é recusa — nada foi escrito. Sem a marca, o pedido pode ter
       chegado: reenviar contexto que talvez já esteja na conversa é pior do que
       pedir para o usuário conferir. */
    outcome = error?.notSent === true ? 'refused' : 'ambiguous';
  }
  if (outcome === 'accepted') {
    /* Só agora o contexto conta como entregue. */
    if (typeof onAccepted === 'function') onAccepted();
  } else if (outcome === 'ambiguous') {
    /* O motivo do Pi vai junto: sem ele não se sabe se foi tempo, conexão ou
       escrita, e as três pedem coisas diferentes do usuário. */
    throw Error(uiMsg('err.send.ambiguous', {reason: motivoDoEnvio}));
  } else {
    const refused=Error(uiMsg('err.send.refused', {reason: motivoDoEnvio}));
    refused.notSent=true;
    throw refused;
  }
  /* `get_state` vem DEPOIS de um prompt já aceito: a resposta está entregue e
     essa leitura é acessória. Falhar aqui NÃO pode virar erro do envio — o
     renderer trataria como não enviado, a fila repetiria o item e a mesma
     mensagem chegaria duas vezes ao Pi. O envio conta como feito, o estado fica
     DESCONHECIDO (`streaming` ausente, nem true nem false) e o aviso diz o que
     não deu para ler. */
  let current;
  try {
    current = await bridge.request('get_state');
  } catch (error) {
    const aviso = uiMsg('err.send.stateUnread', {reason: causeArg(error)});
    if (typeof onWarning === 'function') onWarning(aviso);
    return {streaming: undefined, warning: aviso};
  }
  return {streaming: bridge.isRunning?bridge.isRunning(current):!!(current?.isStreaming||current?.isCompacting||current?.pendingMessageCount), ...(disposition ? {disposition} : {})};
}

module.exports = {deliverPrompt};
