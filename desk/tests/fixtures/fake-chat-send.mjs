/* Fake nomeado do `chat.send` para os testes da entrada da fila. Recebe os
   desfechos do host (o formato de `tutor-prompt-host.cjs`) e devolve o booleano
   que o `chat.send` real devolve: `true` só quando o host aceitou. O caso
   incerto é o `{sent:false,retryable:false,uncertain:true}` que o `chat.mjs`
   transforma em `knownNotSent=false` e em `false` para quem chamou. */
export const UNCERTAIN = Object.freeze({sent: false, retryable: false, uncertain: true});
export const REFUSED = Object.freeze({sent: false, retryable: true, error: 'recusado'});
export const ACCEPTED = Object.freeze({streaming: false});

export function fakeChatSend(hostOutcomes = [ACCEPTED]) {
  const outcomes = Array.isArray(hostOutcomes) ? [...hostOutcomes] : [hostOutcomes];
  const calls = [];
  async function send(text, images, options) {
    const outcome = outcomes.length > 1 ? outcomes.shift() : outcomes[0];
    calls.push({text, images, options, outcome});
    return outcome?.sent !== false;
  }
  return {send, calls};
}
