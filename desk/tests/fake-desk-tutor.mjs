// `window.desk` do tutor para as corridas do voo de connect (#r5-D): os IPCs
// que o voo usa, com a resolução na mão do teste — o teste decide quando o
// connect responde/rejeita e quando o getConfig do catch devolve.

/**
 * Instala o fake no `window` do dom-shim e devolve as mãos para dirigir cada
 * chamada pendente.
 * @param {EventTarget & {desk: Record<string, Function>}} window o window do dom-shim
 * @returns {{flights: Array<{identity: unknown, resolve: (value: object) => void, reject: (error: Error) => void}>, configs: Array<{resolve: (value: object) => void, reject: (error: Error) => void}>}} chamadas na ordem em que partiram
 * @example const desk = fakeTutorDesk(window); desk.flights[0].resolve({engine:'opencode',models:[]});
 */
export function fakeTutorDesk(window) {
  const flights = [];
  const configs = [];
  window.desk.connect = (identity) => new Promise((resolve, reject) => {
    flights.push({identity, resolve, reject});
  });
  window.desk.getConfig = () => new Promise((resolve, reject) => {
    configs.push({resolve, reject});
  });
  window.desk.connectCancel = async () => true;
  return {flights, configs};
}
