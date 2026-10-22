/* Roteamento das operações do host. Só `page` e `capture` existem.
   Campos extras do pedido são ignorados de propósito: executável, ferramenta
   e caminho do helper nunca vêm do JSON. */

import {HostError} from './errors.mjs';
import {isPlainObject, requireString} from './validate.mjs';
import {pageOperation} from './page.mjs';
import {captureOperation} from './capture.mjs';

export const OPS = Object.freeze(['page', 'capture']);

export async function dispatch(request, deps = {}) {
  if (!isPlainObject(request)) {
    throw new HostError('BAD_REQUEST', 'Pedido precisa ser um objeto JSON.');
  }
  const op = requireString(request.op, 'op', {max: 32, code: 'BAD_REQUEST'});
  if (op === 'page') return pageOperation(request, deps);
  if (op === 'capture') return captureOperation(request, deps);
  throw new HostError('UNKNOWN_OP', `Operação desconhecida: ${op}.`, {op});
}
