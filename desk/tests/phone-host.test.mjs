import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {createRequire} from 'node:module';
import {createI18n} from '../src/i18n.mjs';
import ptBR from '../locales/pt-BR.json' with {type: 'json'};
import en from '../locales/en.json' with {type: 'json'};
import {syntheticJpeg, withExif, syntheticPng, syntheticWebp, GPS_MARK, COMMENT_MARK} from './phone-photo-fixtures.mjs';

/* Foto do celular (#36), no host: o servidor HTTP de verdade, escutando em
   127.0.0.1 (o endereço forçado do modo de teste), e um cliente HTTP do teste
   no papel do celular. Cada teste diz qual regra de segurança prova. */
const require = createRequire(import.meta.url);
const {createPhoneHost, readRoute} = require('../phone-host.cjs');
const {cleanPhoto, sniffPhoto} = require('../phone-image.cjs');
const core = require('../src/generated/phonedrop.core.js').default;
const {phoneCastCss} = require('../phone-cast.cjs');

/* Relógio falso: o desligamento por tempo é disparado pelo teste. */
function fakeTimers() {
  const pending = new Map();
  let next = 1;
  return {
    setTimer: (fn, ms) => { const id = next++; pending.set(id, {fn, ms}); return id; },
    clearTimer: (id) => pending.delete(id),
    fireAll: () => { for (const [id, {fn}] of [...pending]) { pending.delete(id); fn(); } },
    delays: () => [...pending.values()].map((entry) => entry.ms),
  };
}

function harness({language = 'pt-BR', castCss} = {}) {
  const i18n = createI18n({catalogs: {'pt-BR': ptBR, en}, language});
  const events = [];
  const timers = fakeTimers();
  const host = createPhoneHost({
    t: i18n.t, language: () => language, interfaces: () => ({}), forcedAddress: '127.0.0.1',
    send: (channel, payload) => events.push({channel, ...payload}),
    setTimer: timers.setTimer, clearTimer: timers.clearTimer, castCss,
  });
  const photos = () => events.filter((event) => event.photo).map((event) => event.photo);
  return {host, events, photos, timers};
}

/* Pedido cru (o `fetch` normaliza caminhos como `/../`; o celular falso não). */
function request(url, {method = 'GET', path, body, headers = {}} = {}) {
  const target = new URL(url);
  return new Promise((resolve, reject) => {
    const req = http.request({host: target.hostname, port: target.port, method, path: path ?? target.pathname, headers, agent: false}, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8')}));
    });
    req.on('error', reject);
    req.end(body);
  });
}
const upload = (url, body, type = 'image/jpeg') => request(url, {method: 'POST', path: `${new URL(url).pathname}/photo`, body, headers: {'Content-Type': type}});

test('só sobe a pedido: criar o host não abre porta nenhuma', () => {
  const {host} = harness();
  assert.equal(host.running(), false);
  assert.equal(host.url(), '');
  assert.equal(host.snapshot().state, 'off');
});

test('com o token a página abre, no idioma da Mesa, sem nada de fora', async () => {
  const {host, events} = harness({language: 'en'});
  const status = await host.start();
  try {
    assert.equal(status.state, 'waiting');
    assert.match(status.url, /^http:\/\/127\.0\.0\.1:\d+\/[A-Za-z0-9_-]{24}$/);
    assert.ok(status.qr.size >= 21, 'o estado traz o QR code do endereço');
    const page = await request(status.url);
    assert.equal(page.status, 200);
    assert.match(page.body, /<html lang="en">/);
    assert.match(page.body, /Take photo/);
    assert.match(page.body, /capture="environment"/);
    assert.match(page.headers['content-security-policy'], /default-src 'none'/);
    assert.equal(page.headers['cache-control'], 'no-store');
    assert.doesNotMatch(page.body, /https?:\/\//, 'a página não carrega nada de outro endereço');
    assert.equal(events.at(-1).status.seen, true, 'abrir a página avisa o popover que o celular chegou');
  } finally { host.stop(); }
});

/* #66: o trio entra na página sem abrir a CSP. Todo estilo vai no <style> com
   o nonce; o desenho não leva atributo style (o navegador o recusaria). */
test('com o trio, a CSP continua sem unsafe-inline e todo estilo e script levam o nonce', async () => {
  const deskFile = (name) => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
  const castCss = phoneCastCss({styleCss: deskFile('style.css'), motionCss: deskFile('src/motion.css'), trioCss: deskFile('src/trio.css'), pageCss: deskFile('src/phone-page.css')});
  const {host} = harness({castCss: () => castCss});
  const {url} = await host.start();
  try {
    const page = await request(url);
    const csp = page.headers['content-security-policy'];
    assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|unsafe-hashes/);
    const nonce = csp.match(/script-src 'nonce-([^']+)'/)[1];
    assert.match(csp, new RegExp(`style-src 'nonce-${nonce.replace(/[+/=]/g, '\\$&')}'`));
    assert.match(page.body, /class="mascote mascote-integral" data-humor="normal"/);
    assert.ok(page.body.includes('.mascote-nabla'), 'o trio.css vai junto');
    assert.doesNotMatch(page.body, / style="/, 'nenhum atributo style no HTML');
    for (const tag of page.body.match(/<style[^>]*>/g)) assert.equal(tag, `<style nonce="${nonce}">`);
    for (const tag of page.body.match(/<script[^>]*>/g)) assert.ok(tag === `<script nonce="${nonce}">` || tag === '<script id="texts" type="application/json">', tag);
  } finally { host.stop(); }
});

test('sem token, com token errado ou em caminho que não existe: 404, igual', async () => {
  const {host, photos} = harness();
  const {url} = await host.start();
  try {
    const base = new URL(url).origin;
    const token = new URL(url).pathname.slice(1);
    const wrong = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
    const answers = await Promise.all([
      request(`${base}/`),
      request(`${base}/${wrong}`),
      request(`${base}/${token.slice(0, 10)}`),
      request(base, {method: 'POST', path: `/${wrong}/photo`, body: syntheticJpeg()}),
      request(base, {method: 'POST', path: '/photo', body: syntheticJpeg()}),
      request(base, {method: 'PUT', path: `/${token}`}),
      request(base, {method: 'GET', path: `/${token}/photo`}),
    ]);
    assert.deepEqual(answers.map((answer) => answer.status), [404, 404, 404, 404, 404, 404, 404]);
    assert.equal(new Set(answers.map((answer) => answer.body)).size, 1, 'o 404 é o mesmo: não diz se o token quase acertou');
    assert.equal(photos().length, 0);
  } finally { host.stop(); }
});

test('nenhum caminho do disco é servido, nem com o token na frente', async () => {
  const {host} = harness();
  const {url} = await host.start();
  try {
    const {origin, pathname} = new URL(url);
    const tries = ['/package.json', '/main.cjs', '/../package.json', '/%2e%2e/%2e%2e/etc/passwd', `${pathname}/../package.json`,
      `${pathname}/package.json`, `${pathname}/index.html`, `${pathname}/%2e%2e%2fmain.cjs`, '/etc/passwd', '/favicon.ico'];
    for (const path of tries) {
      const answer = await request(origin, {path});
      assert.equal(answer.status, 404, `${path} deveria dar 404, deu ${answer.status}`);
      assert.doesNotMatch(answer.body, /"name"|require\(|root:/, `${path} vazou conteúdo do disco`);
    }
  } finally { host.stop(); }
});

test('com o token a foto entra, uma por pedido, e o estado conta', async () => {
  const {host, photos, events} = harness();
  const {url} = await host.start();
  try {
    const first = await upload(url, syntheticJpeg());
    const second = await upload(url, syntheticPng({text: false}), 'image/png');
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.deepEqual(JSON.parse(second.body), {ok: true, count: 2});
    assert.deepEqual(photos().map((photo) => photo.mimeType), ['image/jpeg', 'image/png']);
    assert.deepEqual(photos().map((photo) => photo.name), ['foto do celular 1', 'foto do celular 2']);
    assert.equal(events.at(-1).status.state, 'received');
    assert.equal(events.at(-1).status.count, 2);
  } finally { host.stop(); }
});

test('o tipo vale pelos bytes: texto com Content-Type de imagem é recusado', async () => {
  const {host, photos} = harness();
  const {url} = await host.start();
  try {
    const text = await upload(url, Buffer.from('<html>não sou foto</html>'.repeat(4)), 'image/jpeg');
    const empty = await upload(url, Buffer.alloc(0));
    const gif = await upload(url, Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;', 'latin1'), 'image/gif');
    const broken = await upload(url, syntheticJpeg().subarray(0, 40));
    assert.deepEqual([text.status, empty.status, gif.status, broken.status], [415, 415, 415, 415]);
    assert.equal(photos().length, 0);
  } finally { host.stop(); }
});

test('acima do limite por foto é recusado sem guardar o corpo', async () => {
  const {host, photos} = harness();
  const {url} = await host.start();
  try {
    const big = Buffer.concat([syntheticJpeg(), Buffer.alloc(core.maxFileBytes())]);
    const answer = await upload(url, big);
    assert.equal(answer.status, 413);
    assert.equal(JSON.parse(answer.body).reason, 'size');
    assert.equal(photos().length, 0);
  } finally { host.stop(); }
});

test('acima do limite por sessão (fotos) é recusado', async () => {
  const {host, photos} = harness();
  const {url} = await host.start();
  try {
    for (let i = 0; i < core.maxSessionPhotos(); i++) assert.equal((await upload(url, syntheticJpeg())).status, 201);
    const extra = await upload(url, syntheticJpeg());
    assert.equal(extra.status, 413);
    assert.equal(JSON.parse(extra.body).reason, 'full');
    assert.equal(photos().length, core.maxSessionPhotos());
  } finally { host.stop(); }
});

test('depois de Parar, nada entra: a porta fecha e o token morre', async () => {
  const {host, photos} = harness();
  const {url} = await host.start();
  const stopped = host.stop();
  assert.equal(stopped.state, 'stopped');
  assert.equal(stopped.url, '');
  await assert.rejects(upload(url, syntheticJpeg()), /ECONNREFUSED/);
  const again = await host.start();
  assert.notEqual(again.url, url, 'Ligar de novo cria outro endereço');
  try {
    const old = await request(new URL(again.url).origin, {method: 'POST', path: `${new URL(url).pathname}/photo`, body: syntheticJpeg()});
    assert.equal(old.status, 404, 'o token da sessão anterior não vale na nova');
    assert.equal(photos().length, 0);
  } finally { host.stop(); }
});

test('depois de 10 minutos sem uso o servidor desliga e recusa', async () => {
  const {host, timers, events} = harness();
  const {url} = await host.start();
  assert.deepEqual(timers.delays(), [600000], 'um só prazo, de 10 minutos');
  await request(url);
  assert.deepEqual(timers.delays(), [600000], 'pedido válido recomeça o prazo');
  timers.fireAll();
  assert.equal(host.running(), false);
  assert.equal(events.at(-1).status.state, 'expired');
  await assert.rejects(request(url), /ECONNREFUSED/);
});

test('pedido sem token não segura o servidor ligado', async () => {
  const {host, timers} = harness();
  const {url} = await host.start();
  try {
    let renewed = 0;
    const original = timers.setTimer;
    timers.setTimer = (...args) => { renewed++; return original(...args); };
    await request(new URL(url).origin + '/qualquer');
    assert.equal(renewed, 0);
  } finally { host.stop(); }
});

test('sem rede local, o estado é erro de rede e nada escuta', async () => {
  const events = [];
  const host = createPhoneHost({t: (key) => key, language: () => 'pt-BR', interfaces: () => ({utun3: [{family: 'IPv4', address: '10.8.0.2', internal: false}]}), send: (channel, payload) => events.push(payload)});
  const status = await host.start();
  assert.equal(status.state, 'error');
  assert.equal(status.url, '');
  assert.equal(host.running(), false);
});

test('o EXIF sai (GPS, descrição, comentário) e a rotação chega ao renderer', async () => {
  const {host, photos} = harness();
  const {url} = await host.start();
  try {
    const sent = withExif(syntheticJpeg(), {orientation: 6});
    assert.ok(sent.includes(GPS_MARK) && sent.includes(COMMENT_MARK), 'a foto do teste leva GPS e comentário');
    assert.equal((await upload(url, sent)).status, 201);
    const [photo] = photos();
    const bytes = Buffer.from(photo.bytes);
    assert.equal(photo.orientation, 6);
    assert.ok(!bytes.includes(GPS_MARK) && !bytes.includes(COMMENT_MARK), 'nada do EXIF nem do comentário chega ao renderer');
    assert.ok(!bytes.includes('Exif'), 'sem bloco EXIF');
    assert.deepEqual(bytes.subarray(2), syntheticJpeg().subarray(2), 'a imagem em si fica intacta');
  } finally { host.stop(); }
});

test('PNG e WebP também saem sem metadados', () => {
  const png = cleanPhoto(syntheticPng({orientation: 8}), 'png');
  assert.equal(png.orientation, 8);
  assert.ok(!png.bytes.includes(GPS_MARK) && !png.bytes.includes('eXIf') && !png.bytes.includes('tEXt'));
  assert.equal(sniffPhoto(png.bytes), 'png');
  const webp = cleanPhoto(syntheticWebp(), 'webp');
  assert.equal(webp.orientation, 3);
  assert.ok(!webp.bytes.includes(GPS_MARK) && !webp.bytes.includes('EXIF') && !webp.bytes.includes('XMP '));
  assert.equal(webp.bytes.readUInt32LE(4), webp.bytes.length - 8, 'o tamanho do RIFF é refeito');
  assert.equal(webp.bytes[20] & 0x0c, 0, 'as marcas de EXIF e XMP do VP8X são desligadas');
});

test('readRoute: só GET /<token> e POST /<token>/photo têm forma', () => {
  const token = 'abc';
  assert.deepEqual(readRoute({method: 'GET', url: '/abc'}, token), {route: {$: 'PageRoute'}, token: true});
  assert.deepEqual(readRoute({method: 'POST', url: '/abc/photo'}, token), {route: {$: 'UploadRoute'}, token: true});
  assert.deepEqual(readRoute({method: 'GET', url: '/abd'}, token), {route: {$: 'PageRoute'}, token: false});
  assert.deepEqual(readRoute({method: 'GET', url: '/abc/x/y'}, token), {route: {$: 'OtherRoute'}, token: true});
  assert.deepEqual(readRoute({method: 'GET', url: '/abc'}, null), {route: {$: 'PageRoute'}, token: false});
});
