/* Os adaptadores dão `unref` nos timers de prazo para o app não ficar preso
   ao sair. No teste, quando o único trabalho pendente é esse timer, o Node 22
   (o mínimo do `engines`) vê o laço de eventos vazio e cancela o arquivo com
   "Promise resolution is still pending but the event loop has already
   resolved" — o Node 24 segue. Um intervalo com `ref` durante o arquivo
   mantém o laço vivo como o Electron mantém no app. Importe por efeito. */
import {after} from 'node:test';

const keepAlive = setInterval(() => {}, 60_000);
after(() => clearInterval(keepAlive));
