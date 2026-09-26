/* Ciclo de vida do envio de um prompt: validar → conectar → marcar → escrever → confirmar.
 *
 * Este é o pedaço do app que decide o que conta como entregue, e ele mora aqui,
 * fora do Electron, para poder ser exercitado com um bridge de mentira que falha
 * onde o teste mandar. As falhas acontecem em pontos diferentes e deixam estados
 * diferentes:
 *
 * - anexo inválido e falha de conexão acontecem ANTES de qualquer escrita: nada
 *   foi entregue, o bilhete continua reivindicado e o contexto da Mesa não conta
 *   como enviado;
 * - a fase "envio iniciado" é persistida logo antes da escrita e, se ela não
 *   puder ser persistida, nada é enviado: sem a marca, uma queda entre o
 *   recebimento no Pi e a confirmação devolveria o bilhete à fila e o mesmo
 *   contexto chegaria duas vezes;
 * - falha na escrita é AMBÍGUA, não recusa: o pedido só é recusado depois de
 *   tentar escrever no stdin (ou por tempo), então o Pi pode ter recebido;
 * - `get_state` vem depois de um prompt já aceito: se ele falhar, a entrega
 *   aconteceu e o envio NÃO é erro — volta com aviso e estado desconhecido, para
 *   a fila não repetir uma mensagem que o Pi já recebeu.
 *
 * `onAccepted` é quem atualiza o que o app lembra do turno (`lastContextKey`) e
 * solta o bilhete: ele é chamado uma vez, e só depois do aceite.
 */
const {settleDelivery, beginDelivery} = require('./handoff.cjs');

/** Um pedido aceito que não pôde ser marcado/arquivado: fica na fase de envio. */
const avisoSemMarca = (reason) => `bilhete entregue, mas ${reason} — não será reenviado; no reinício ele fica em dúvida`;
/** Um pedido aceito cujo arquivamento falhou: o arquivo fica, marcado como entregue. */
const avisoPreservado = (reason) => `bilhete entregue, mas ${reason} (arquivo preservado)`;
/** Não dá para saber se o Pi recebeu: o bilhete sai da fila para não repetir contexto. */
const avisoDuvida = 'entrega incerta: bilhete guardado em dúvida (pode já ter chegado)';

/**
 * @param {object} options
 * @param {{message: string, streamingBehavior: string}} options.request pedido já montado, sem anexos
 * @param {unknown} [options.images] anexos crus, como vieram do renderer
 * @param {(images: unknown) => {length: number} | null} [options.validateImages] valida ANTES de escrever
 * @param {{path: string} | null} [options.claim] bilhete reivindicado (ou nulo); o `path` é atualizado a cada transição de fase
 * @param {string} [options.runtime] runtime da Mesa (para o destino do bilhete)
 * @param {() => {request: Function}} options.connect monta o bridge; pode lançar
 * @param {() => void} [options.onAccepted] aceite confirmado: atualiza contexto e solta o bilhete
 * @param {(aviso: string) => void} [options.onDelivered] entrega feita com problema de marcação/arquivamento
 * @param {(aviso: string) => void} [options.onAmbiguous] escrita incerta: avisa e solta o bilhete
 * @param {(aviso: string) => void} [options.onRefused] recusa comprovada: avisa e MANTÉM o bilhete
 * @param {(aviso: string) => void} [options.onWarning] envio feito, mas algo acessório falhou (estado não lido)
 * @param {Function} [options.begin] marca persistida de "envio iniciado" — `(path, {runtime})` (trocável nos testes)
 * @param {Function} [options.settle] destino do bilhete (trocável nos testes)
 * @returns {Promise<{streaming: boolean}>}
 */
async function deliverPrompt({
  request,
  images,
  validateImages,
  claim,
  runtime,
  connect,
  onAccepted,
  onDelivered,
  onAmbiguous,
  onRefused,
  onWarning,
  begin = beginDelivery,
  settle = settleDelivery,
} = {}) {
  const anexos = typeof validateImages === 'function' ? validateImages(images) : null;
  const pedido = {...request};
  if (anexos && anexos.length) pedido.images = anexos;
  /* `connect()` pode lançar sem nada ter sido escrito: falha definida, o
     contexto não conta como enviado e o bilhete fica para a próxima tentativa. */
  const bridge = connect();
  /* Daqui para baixo o bilhete pode ter sido entregue. `connect` só monta a
     ponte — a primeira escrita no Pi é o `request` —, então marcar aqui ainda é
     marcar antes de qualquer envio; e é a última hora em que dá para desistir
     sem o bilhete ficar em dúvida. Marcação impossível significa: não envie.
     O `path` do bilhete é atualizado a CADA transição (marca e desfecho): quem
     segura o bilhete entre tentativas (a mão do main) precisa do caminho da fase
     em que o arquivo está agora — uma recusa devolve o bilhete à fase
     reivindicada com NOME NOVO, e sem isso a tentativa seguinte não conseguiria
     nem marcar o envio. */
  const alvo = claim;
  if (claim?.path) {
    const started = begin(claim.path, {runtime});
    if (!started.started) {
      throw Error(`Não deu para marcar o envio do bilhete (${started.reason}); nada foi enviado ao Pi.`);
    }
    claim.path = started.path;
  }
  let outcome = 'refused';
  let motivoDoEnvio = '';
  try {
    await bridge.request('prompt', pedido);
    outcome = 'accepted';
  } catch (error) {
    motivoDoEnvio = error?.message || String(error);
    /* O bridge marca o que PROVA não ter sido transmitido (`notSent`): partida
       impossível, pedido recusado antes da escrita, stdin que não aceitou.
       Nesse caso é recusa — nada foi escrito, o bilhete continua reivindicado e
       volta na próxima abertura. Sem a marca, o pedido pode ter chegado: o
       bilhete vai para `dúvida/` em vez de voltar para a fila, porque reenviar
       contexto que talvez já esteja na conversa é pior do que pedir para o
       usuário conferir. */
    outcome = error?.notSent === true ? 'refused' : 'ambiguous';
  }
  const settled = settle(alvo, {runtime, outcome});
  if (alvo && settled.path) alvo.path = settled.path;
  if (outcome === 'accepted') {
    /* Só agora o contexto e o bilhete contam como entregues. */
    if (typeof onAccepted === 'function') onAccepted();
    if (settled.action === 'entregue-sem-marca') {
      if (typeof onDelivered === 'function') onDelivered(avisoSemMarca(settled.reason));
    } else if (settled.action === 'entregue-preservado') {
      if (typeof onDelivered === 'function') onDelivered(avisoPreservado(settled.reason));
    }
  } else if (outcome === 'ambiguous') {
    if (typeof onAmbiguous === 'function') {
      onAmbiguous(settled.action === 'guardado-em-duvida' ? avisoDuvida : `entrega incerta e ${settled.reason}`);
    }
    /* O motivo do Pi vai junto: sem ele não se sabe se foi tempo, conexão ou
       escrita, e as três pedem coisas diferentes do usuário. */
    throw Error(`O Pi não confirmou a mensagem (${motivoDoEnvio}). Ela pode ter sido recebida; o bilhete da Conversa ficou guardado em dúvida.`);
  } else {
    /* Recusa comprovada: nada foi escrito no Pi, então não há repetição de
       contexto nem bilhete em dúvida — ele fica reivindicado, e a próxima
       abertura devolve para a fila. */
    if (typeof onRefused === 'function') {
      onRefused(`nada foi enviado ao Pi (${motivoDoEnvio}) — o bilhete da Conversa continua na fila`);
    }
    throw Error(`Nada foi enviado ao Pi: ${motivoDoEnvio}`);
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
    const aviso = `A mensagem foi entregue ao Pi, mas o estado da sessão não pôde ser lido (${error?.message || error}). Se a resposta não aparecer, reconecte.`;
    if (typeof onWarning === 'function') onWarning(aviso);
    return {streaming: undefined, warning: aviso};
  }
  return {streaming: !!current?.isStreaming};
}

module.exports = {deliverPrompt, avisoSemMarca, avisoPreservado, avisoDuvida};
