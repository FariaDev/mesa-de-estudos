// @ts-check
'use strict';
// @ts-check

/* Host da Foto do celular (#36): o servidor HTTP na rede local que o celular
   abre pelo QR code. A decisão — estado do fluxo, se a porta abre, se a foto
   entra — é do núcleo (`core/phonedrop.bend`); aqui fica o mundo: escolher a
   interface, escutar, comparar o token, ler o corpo, tirar o EXIF e entregar a
   foto ao renderer, que a põe na bandeja de anexos (nunca a envia).

   Regras de segurança, todas com teste em `tests/phone-host.test.mjs`:
   - só sobe por `phone-start` (o botão do popover), nunca ao abrir o app;
   - escuta só no endereço da rede local escolhido, numa porta livre;
   - token aleatório por sessão no caminho; sem ele, 404 igual a caminho que
     não existe; o token morre com o servidor;
   - desliga sozinho com 10 minutos sem pedido válido (`idleMs` do núcleo), ao
     fechar o popover e ao fechar a Mesa;
   - só JPEG, PNG e WebP reconhecidos pelos bytes, com teto por foto e por
     sessão; nada do disco é servido e nada é gravado: a foto vai da memória
     para a bandeja.

   Canais:
   - `phone-start`  {address?} → estado (endereço, QR, candidatos)
   - `phone-stop`   → estado
   - `phone-status` → estado
   - evento `phone-event` (main → renderer): {status} a cada mudança ou
     {photo: {bytes, mimeType, name, orientation}} a cada foto aceita. */

const http = require('node:http');
const crypto = require('node:crypto');
/** @type {import('./types/bend-core').PhoneDropCore} */
const core = require('./src/generated/phonedrop.core.js').default;
const {sniffPhoto, cleanPhoto, MIME} = require('./phone-image.cjs');
const {lanCandidates} = require('./phone-network.cjs');
const {qrMatrix} = require('./phone-qr.cjs');
const {phonePageHtml} = require('./phone-page.cjs');

/** @type {Record<string, import('./types/bend-core').PhoneImageKind>} */
const KIND_FACT = {jpeg: {$: 'KindJpeg'}, png: {$: 'KindPng'}, webp: {$: 'KindWebp'}};
/** @type {import('./types/bend-core').PhoneImageKind} */
const NOT_IMAGE = {$: 'KindNotImage'};
const STATE_NAME = {PhoneOff: 'off', PhoneWaiting: 'waiting', PhoneReceived: 'received', PhoneStopped: 'stopped', PhoneExpired: 'expired', PhoneNetError: 'error'};
const REASON = {PhotoGone: 'gone', PhotoWrongType: 'type', PhotoTooLarge: 'size', PhotoFull: 'full'};
const BASE_HEADERS = {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'};

/** Compara o segmento do caminho com o token em tempo constante. */
function tokenMatches(candidate, token) {
  if (!token || typeof candidate !== 'string') return false;
  const a = Buffer.from(candidate), b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Forma do pedido (o fato `Route` do núcleo) e se o token confere.
 * @param {{method?: string, url?: string}} req
 * @param {string|null} token
 */
/** @returns {{route: import('./types/bend-core').PhoneRoute, token: boolean}} */
function readRoute(req, token) {
  let parts;
  try { parts = new URL(req.url || '/', 'http://mesa.invalid').pathname.split('/').filter(Boolean); }
  catch { return {route: {$: 'OtherRoute'}, token: false}; }
  const tokenOk = tokenMatches(parts[0], token);
  if (req.method === 'GET' && parts.length === 1) return {route: {$: 'PageRoute'}, token: tokenOk};
  if (req.method === 'POST' && parts.length === 2 && parts[1] === 'photo') return {route: {$: 'UploadRoute'}, token: tokenOk};
  return {route: {$: 'OtherRoute'}, token: tokenOk};
}

/* Lê o corpo até `limit` bytes; passando disso, para de guardar e só escoa
   o resto, para a resposta 413 chegar ao celular (fechar no meio do envio vira
   "erro de rede" no navegador). Quem passa de 4× o limite é cortado. */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0, head = Buffer.alloc(0);
    req.on('data', (chunk) => {
      if (head.length < 16) head = Buffer.concat([head, chunk]).subarray(0, 16);
      size += chunk.length;
      if (size > 4 * limit) { req.destroy(); return; }
      if (size <= limit) chunks.push(chunk);
    });
    req.on('end', () => resolve(size > limit ? {bytes: head, overflow: true} : {bytes: Buffer.concat(chunks), overflow: false}));
    req.on('error', reject);
    req.on('close', () => { if (!req.complete) reject(new Error(`envio cortado com ${size} bytes`)); });
  });
}

function reply(res, status, body, headers = {}) {
  if (res.headersSent) return;
  const text = typeof body === 'string' ? body : JSON.stringify(body ?? {});
  res.writeHead(status, {...BASE_HEADERS, 'Content-Type': typeof body === 'string' ? 'text/html; charset=utf-8' : 'application/json', ...headers});
  res.end(text);
}

const notFound = (res) => reply(res, 404, {ok: false});

/**
 * @param {{
 *   ipcMain?: {handle: Function},
 *   t: (key: string, args?: Record<string, string|number>) => string,
 *   language: () => string,
 *   lookCss?: () => string,
 *   castCss?: () => string,
 *   interfaces: () => Record<string, any>,
 *   send: (channel: string, payload: object) => void,
 *   forcedAddress?: string,
 *   newToken?: () => string,
 *   setTimer?: typeof setTimeout, clearTimer?: typeof clearTimeout,
 *   appendLog?: (scope: string, line: string) => void,
 * }} deps
 */
function createPhoneHost(deps) {
  const {
    ipcMain, t, language, interfaces, send, forcedAddress = '', lookCss = () => '', castCss = () => '',
    newToken = () => crypto.randomBytes(18).toString('base64url'),
    setTimer = setTimeout, clearTimer = clearTimeout, appendLog = () => {},
  } = deps;
  /** @type {import('./types/bend-core').PhoneFlow} */
  let flow = {$: 'PhoneOff'};
  let server = null, token = null, idle = null;
  let session = {address: '', port: 0, photos: 0, total: 0, seen: false, candidates: []};

  const up = () => core.running(flow);
  const url = () => (token && session.port ? `http://${session.address}:${session.port}/${token}` : '');

  function snapshot() {
    const link = url();
    return {
      state: STATE_NAME[flow.$], count: core.received(flow), seen: session.seen,
      url: link, address: session.address, candidates: session.candidates,
      qr: link ? qrMatrix(link) : null,
    };
  }
  const emitStatus = () => send('phone-event', {status: snapshot()});

  /** @param {import('./types/bend-core').PhoneFlowEvent['$']} event */
  function step(event) {
    flow = core.step(flow, {$: event});
    emitStatus();
  }

  function touch() {
    if (idle) clearTimer(idle);
    idle = setTimer(() => stop('idle'), core.idleMs());
  }

  function close() {
    if (idle) clearTimer(idle);
    idle = null;
    token = null;
    const old = server;
    server = null;
    if (!old) return;
    old.close();
    old.closeAllConnections?.();
  }

  async function onPhoto(req, res) {
    const {bytes, overflow} = await readBody(req, core.maxFileBytes());
    /* Passou do teto: o tipo vem do começo do corpo (o resto foi escoado). */
    const kind = sniffPhoto(bytes);
    let cleaned = overflow && kind ? {bytes, orientation: 1} : null;
    if (kind && !overflow) { try { cleaned = cleanPhoto(bytes, kind); } catch (error) { appendLog('phone', `foto recusada: ${error.message}`); } }
    const fact = cleaned ? KIND_FACT[kind] : NOT_IMAGE;
    const size = overflow ? core.maxFileBytes() + 1 : bytes.length;
    const verdict = core.photo(up(), fact, size, session.photos, session.total);
    const status = core.verdictStatus(verdict);
    if (verdict.$ !== 'PhotoAccept') { reply(res, status, {ok: false, reason: REASON[verdict.$]}); return; }
    session.photos += 1;
    session.total += bytes.length;
    send('phone-event', {photo: {bytes: cleaned.bytes, mimeType: MIME[kind], orientation: cleaned.orientation, name: t('phone.photoName', {n: session.photos})}});
    step('EvPhoto');
    reply(res, status, {ok: true, count: core.received(flow)});
  }

  function onRequest(req, res) {
    const {route, token: tokenOk} = readRoute(req, token);
    const door = core.door(up(), tokenOk, route);
    if (door.$ === 'DoorClosed') { req.resume(); notFound(res); return; }
    touch();
    if (door.$ === 'DoorPage') {
      if (!session.seen) { session.seen = true; emitStatus(); }
      const nonce = crypto.randomBytes(12).toString('base64');
      reply(res, 200, phonePageHtml({t, lang: language(), nonce, maxMb: Math.round(core.maxFileBytes() / 1024 / 1024), lookCss: lookCss(), castCss: castCss()}), {
        'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self' blob:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
      });
      return;
    }
    onPhoto(req, res).catch((error) => { appendLog('phone', `envio falhou: ${error.message}`); notFound(res); });
  }

  function candidates() {
    if (forcedAddress) return [{name: 'test', address: forcedAddress}];
    return lanCandidates(interfaces());
  }

  /** Sobe o servidor (derrubando o anterior). Resolve com o estado. */
  function start(request = {}) {
    close();
    const list = candidates();
    const wanted = list.find((item) => item.address === request?.address) || list[0];
    session = {address: wanted?.address || '', port: 0, photos: 0, total: 0, seen: false, candidates: list};
    if (!wanted) { step('EvFail'); return Promise.resolve(snapshot()); }
    token = newToken();
    const fresh = http.createServer(onRequest);
    fresh.headersTimeout = 15000;
    fresh.requestTimeout = 120000;
    fresh.keepAliveTimeout = 5000;
    server = fresh;
    return new Promise((resolve) => {
      fresh.once('error', (error) => {
        appendLog('phone', `servidor não subiu em ${wanted.address}: ${error.message}`);
        if (server === fresh) close();
        step('EvFail');
        resolve(snapshot());
      });
      fresh.listen(0, wanted.address, () => {
        if (server !== fresh) { resolve(snapshot()); return; }
        session.port = /** @type {import('node:net').AddressInfo} */ (fresh.address()).port;
        touch();
        step('EvStart');
        resolve(snapshot());
      });
    });
  }

  /** Para: Parar, fechar o popover ou a Mesa (`stop`) e o tempo sem uso (`idle`). */
  function stop(reason = 'stop') {
    const wasUp = up();
    close();
    if (wasUp) step(reason === 'idle' ? 'EvIdle' : 'EvStop');
    return snapshot();
  }

  function register() {
    ipcMain?.handle('phone-start', (_event, request) => start(request));
    ipcMain?.handle('phone-stop', () => stop('stop'));
    ipcMain?.handle('phone-status', () => snapshot());
  }

  return {start, stop, snapshot, register, url, running: up};
}

module.exports = {createPhoneHost, readRoute, tokenMatches};
