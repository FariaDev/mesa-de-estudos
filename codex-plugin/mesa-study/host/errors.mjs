/* Erro do host com código estável. O CLI serializa sempre
   {ok:false,error:{code,message}} (+ detail opcional). */

export class HostError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.name = 'HostError';
    this.code = code;
    if (detail !== undefined) this.detail = detail;
  }
}

export function hostError(code, message, detail) {
  return new HostError(code, message, detail);
}

function boundedReason(error) {
  const raw = error && typeof error.message === 'string' ? error.message : '';
  return raw.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
}

/* Converte qualquer falha no payload público. Erros inesperados viram
   INTERNAL com motivo limitado, sem stack. */
export function errorPayload(error) {
  if (error instanceof HostError) {
    const payload = {code: error.code, message: error.message};
    if (error.detail !== undefined) payload.detail = error.detail;
    return {ok: false, error: payload};
  }
  const reason = boundedReason(error);
  const payload = {code: 'INTERNAL', message: 'Falha interna do host.'};
  if (reason) payload.detail = {reason};
  return {ok: false, error: payload};
}
