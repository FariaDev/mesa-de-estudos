import * as quadro from './activity-view.mjs';

/* Quadro de atividade — limites do estado e da altura, URL do artefato e
   leitura das mensagens do iframe (JSON-RPC do MCP Apps e o protocolo da
   Mesa). Saiu de activity.mjs na #43 fase 2. */

const ACTIVITY_SCHEME = 'mesa-activity';
/* Tetos do estado (alinhados ao store/preload): values ≤ 16 KiB, attempt ≤ 4 KiB
   e envelope completo ≤ 21 KiB. */
const MAX_STATE_BYTES = 16384;
const MAX_ATTEMPT_BYTES = 4096;
const MAX_STATE_ENVELOPE_BYTES = 21504;
/* Piso e teto do quadro vêm do núcleo (`core/activityview.bend`, #42). */
const HEIGHT_MIN = quadro.HEIGHT_MIN;
const HEIGHT_MAX = quadro.HEIGHT_MAX;
const HEIGHT_RESERVED = 120;
const READY_TIMEOUT_MS = 8000;
function buildActivityUrl(item, theme = 'system', accent = '') {
  const safe = theme === 'dark' || theme === 'light' ? theme : 'system';
  const tone = accent ? `&accent=${quadro.accentOf(accent)}` : '';
  return `${ACTIVITY_SCHEME}://artifact/${item.id}/${item.version}/index.html?theme=${safe}${tone}`;
}
/* Mensagens JSON-RPC do quadro no protocolo MCP Apps (#42). Só três métodos
   valem: o tamanho, o pedido de abrir link (https) e o log; o resto é
   descartado. A identidade é a do frame (`event.source`), conferida antes. */
function parseRpc(data) {
  if (!data || typeof data !== 'object' || data.jsonrpc !== '2.0' || typeof data.method !== 'string') return null;
  const params = data.params && typeof data.params === 'object' ? data.params : {};
  if (data.method === 'ui/notifications/size-changed') {
    const height = Number(params.height);
    return Number.isFinite(height) ? {type: 'height', payload: {height}} : null;
  }
  if (data.method === 'ui/open-link') {
    const url = typeof params.url === 'string' ? params.url : '';
    if (!/^https:\/\/[^\s]+$/i.test(url) || url.length > 2000) return null;
    return {type: 'open-link', payload: {url}, id: typeof data.id === 'string' || typeof data.id === 'number' ? data.id : null};
  }
  if (data.method === 'notifications/message') return {type: 'log', payload: params};
  if (data.method === 'mesa/notifications/pointer') return {type: 'pointer', payload: {inside: params.inside === true}};
  /* O quadro só pode pedir para SAIR da tela cheia (Esc com o foco dentro). */
  if (data.method === 'ui/request-display-mode') return params.mode === 'inline' ? {type: 'inline', payload: null, id: typeof data.id === 'string' || typeof data.id === 'number' ? data.id : null} : null;
  return null;
}
function jsonSize(value) {
  try {
    const text = JSON.stringify(value);
    if (typeof text !== 'string') return Infinity;
    if (typeof TextEncoder === 'function') return new TextEncoder().encode(text).byteLength;
    return unescape(encodeURIComponent(text)).length;
  } catch {
    return Infinity;
  }
}
function parseMessage(data, item) {
  if (!data || typeof data !== 'object' || data.v !== 1) return null;
  if (data.id !== item.id || Number(data.version) !== Number(item.version)) return null;
  /* Hash do documento: identidade exata da revisão; mensagem de outra revisão
     (ou forjada) não toca no estado. */
  if (typeof data.hash !== 'string' || data.hash === '' || data.hash !== item.hash) return null;
  const type = data.type;
  if (!['ready', 'state', 'attempt', 'height', 'error'].includes(type)) return null;
  const payload = data.payload === undefined ? null : data.payload;
  if (type === 'state') {
    if (payload !== null && (typeof payload !== 'object' || Array.isArray(payload))) return null;
    if (jsonSize(payload) > MAX_STATE_BYTES) return null;
  }
  if (type === 'attempt') {
    if (payload === undefined) return null;
    if (jsonSize(payload) > MAX_ATTEMPT_BYTES) return null;
  }
  if (type === 'height') {
    const height = Number(payload && payload.height);
    if (!Number.isFinite(height)) return null;
  }
  if (type === 'error') {
    if (payload !== null && typeof payload !== 'object') return null;
    if (jsonSize(payload) > 1200) return null;
  }
  return {type, payload};
}

export {ACTIVITY_SCHEME,MAX_STATE_BYTES,MAX_ATTEMPT_BYTES,MAX_STATE_ENVELOPE_BYTES,HEIGHT_MIN,HEIGHT_MAX,HEIGHT_RESERVED,READY_TIMEOUT_MS,buildActivityUrl,parseRpc,parseMessage,jsonSize};
