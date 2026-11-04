/* Host da URL de atividade (#89): a versão entra no host para que cada
   revisão da mesma atividade ganhe site e processo próprios no Chromium. O
   formato é `act-<id>--v<versão>` (publicado) e `pv-<id>--v<versão>` (prévia).
   A versão é o ÚLTIMO `--v<dígitos>` do host: como o id também pode conter `-`,
   ler da direita para a esquerda não é ambíguo, e o id restante ainda precisa
   passar pelo formato do store. Nada de versão no caminho: o formato da #88
   (`act-<id>/<versão>/index.html`) e o antigo (`artifact/`) são recusados. */

const ACTIVITY_SCHEME = 'mesa-activity';
/* Mesmo formato de `isSafeId` do store (`activity-store.cjs`), aceitando
   também o prefixo `pv-` da prévia. */
const ACTIVITY_ID = /^(?:act|pv)-[a-z0-9][a-z0-9-]{2,63}$/;
const MAX_ACTIVITY_VERSION = 1000000;
/* Teto por construção: id de 68 (store) + `--v` (3) + 7 dígitos de versão.
   O Chromium aceita host maior que o limite DNS de 63 neste esquema; a
   justificativa está no hunt `hunt-activity-watchdog` (#89). */
const MAX_ACTIVITY_HOST = 78;

/**
 * Host da URL de uma revisão de atividade.
 * @param {string} id id `act-…`/`pv-…`
 * @param {number|string} version revisão (1..1000000)
 * @returns {string}
 * @example activityHost('act-abc12345', 2) // 'act-abc12345--v2'
 */
function activityHost(id, version) {
  return `${String(id)}--v${String(version)}`;
}

/**
 * Lê id e versão do host de uma atividade, ou null fora do formato.
 * @param {string} value host da URL
 * @returns {{id: string, version: number} | null}
 * @example parseActivityHost('act-abc12345--v2') // {id:'act-abc12345', version:2}
 * @example parseActivityHost('act-abc12345') // null (formato da #88)
 */
function parseActivityHost(value) {
  const host = String(value ?? '');
  if (!host || host.length > MAX_ACTIVITY_HOST) return null;
  const suffix = /--v(\d{1,7})$/.exec(host);
  if (!suffix) return null;
  const id = host.slice(0, suffix.index);
  if (!ACTIVITY_ID.test(id)) return null;
  /* Zero à esquerda não é versão canônica (#89). */
  if (suffix[1].length > 1 && suffix[1][0] === '0') return null;
  const version = Number(suffix[1]);
  if (!Number.isInteger(version) || version < 1 || version > MAX_ACTIVITY_VERSION) return null;
  return {id, version};
}

export {ACTIVITY_SCHEME, MAX_ACTIVITY_HOST, MAX_ACTIVITY_VERSION, activityHost, parseActivityHost};
