/* Modelos grátis do OpenCode Zen no host (#44): a chave só passa por aqui
   cifrada, a área de transferência só é lida no `peek`, o arquivo do OpenCode
   só no clique, o teste fala só com a lista de modelos e a política de dados é
   uma tabela com data e fonte. Tudo por fakes com nome (`fake-opencode.mjs`,
   `fake-secret-cipher.cjs`): nenhuma rede, Keychain ou área de transferência real. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {ptMatches} from './pt-text.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createFakeOpencode} from './fake-opencode.mjs';
import {ZEN_MODELS} from './fake-pi-opencode.mjs';
const require = createRequire(import.meta.url);
const {createOpencodeHost, preferredDefaults} = require('../opencode-host.cjs');
const {createKeyStore} = require('../opencode-key-store.cjs');
const fakeCipher = require('./fake-secret-cipher.cjs');
const policyTable = require('../free-models.json');

const KEY = 'sk-teste-chave-do-zen-1234567890';
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-opencode-host-'));

async function harness({clipboard = '', asyncClipboard = false, fake, homeDir = temp()} = {}) {
  const console_ = fake || await createFakeOpencode({validKeys: [KEY], billingKeys: ['sk-sem-cobranca-1234567890']});
  const runtime = temp();
  const handlers = new Map();
  const seen = {logs: [], patches: [], clipboardReads: 0, relinks: 0, opened: []};
  let state = {};
  const host = createOpencodeHost({
    ipcMain: {handle: (name, fn) => handlers.set(name, fn)},
    keyStore: createKeyStore({dir: runtime, cipher: fakeCipher}),
    state: () => state,
    patchState: (patch) => { seen.patches.push(patch); state = {...state, ...patch}; },
    baseUrl: console_.url,
    homeDir,
    readClipboard: () => { seen.clipboardReads += 1; return asyncClipboard ? Promise.resolve(clipboard) : clipboard; },
    openExternal: (url) => seen.opened.push(url),
    relinkTutor: async () => { seen.relinks += 1; return {relinked: true}; },
    appendLog: (area, line) => seen.logs.push(`${area}: ${line}`),
  });
  const call = (name, request) => handlers.get(name)({}, request);
  return {host, call, seen, console_, runtime, homeDir, close: () => console_.close()};
}

test('a tabela de política: data, fonte, valores conhecidos e padrão só com retenção zero', () => {
  assert.match(policyTable.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(policyTable.source, /^https:\/\//);
  for (const [id, entry] of Object.entries(policyTable.models)) {
    assert.ok(['zero', 'retained', 'improve', 'trial', 'train'].includes(entry.policy), `${id}: política desconhecida ${entry.policy}`);
    if (entry.recommended) assert.equal(entry.policy, 'zero', `${id}: recomendado precisa ser retenção zero, veio ${entry.policy}`);
  }
  assert.ok(preferredDefaults().length > 0, 'há ao menos um padrão recomendado');
  assert.ok(Object.hasOwn(policyTable.excluded, 'jev-1.13-free'), 'jev-1.13-free fica fora, com o motivo na tabela');
});

test('o cofre guarda cifrado, recusa sem cofre e nunca devolve texto em claro no arquivo', () => {
  const dir = temp();
  const store = createKeyStore({dir, cipher: fakeCipher});
  store.save(KEY);
  assert.equal(store.load(), KEY);
  assert.ok(!fs.readFileSync(store.file).includes(Buffer.from(KEY)), 'o arquivo do cofre não pode conter a chave em claro');
  process.env.FAKE_CIPHER_OFF = '1';
  try {
    assert.throws(() => store.save(KEY), ptMatches(/cofre do sistema não está disponível/));
    assert.equal(store.load(), '', 'sem cofre a chave guardada não é lida');
  } finally { delete process.env.FAKE_CIPHER_OFF; }
});

test('área de transferência: só é lida no peek; o que não é chave nunca vira candidato', async () => {
  const {call, seen, close} = await harness({clipboard: 'https://exemplo.com/uma pagina qualquer'});
  assert.equal(seen.clipboardReads, 0, 'nada lido antes do peek');
  assert.deepEqual(await call('opencode-clipboard-peek'), {found: false});
  assert.equal(seen.clipboardReads, 1);
  const refused = await call('opencode-clipboard-accept');
  assert.equal(refused.ok, false);
  assert.equal(refused.outcome, 'shape', 'sem candidato, aceitar não guarda nada');
  await close();
});

test('área de transferência com chave: o peek devolve só a máscara; esquecer apaga o candidato', async () => {
  const {call, seen, close} = await harness({clipboard: `${KEY}\n`});
  const peek = await call('opencode-clipboard-peek');
  assert.deepEqual(peek, {found: true, masked: 'sk-••••7890'});
  assert.ok(!JSON.stringify(peek).includes(KEY));
  await call('opencode-clipboard-forget');
  assert.equal((await call('opencode-clipboard-accept')).outcome, 'shape');
  assert.equal(seen.relinks, 0);
  await close();
});

/* Regressão (#43 fase 3): no Electron 44 `clipboard.readText()` devolve Promise;
   o peek lia "[object Promise]" e nunca oferecia a chave copiada. */
test('área de transferência assíncrona (Electron 44): o peek espera a leitura e acha a chave', async () => {
  const {call, close} = await harness({clipboard: `${KEY}\n`, asyncClipboard: true});
  assert.deepEqual(await call('opencode-clipboard-peek'), {found: true, masked: 'sk-••••7890'});
  await close();
});

test('aceitar a chave testa só a lista de modelos, guarda, liga o tutor de novo e não vaza a chave', async () => {
  const {call, seen, console_, runtime, host, close} = await harness({clipboard: KEY});
  await call('opencode-clipboard-peek');
  const result = await call('opencode-clipboard-accept');
  assert.equal(result.ok, true);
  assert.equal(result.outcome, 'ok');
  assert.equal(seen.relinks, 1);
  assert.ok(console_.requests.length >= 1);
  for (const request of console_.requests) assert.deepEqual([request.method, request.path], ['GET', '/inference/v1/models'], 'só a lista de modelos, nunca inferência');
  assert.deepEqual(host.keyEnv(), {OPENCODE_API_KEY: KEY});
  const everything = JSON.stringify([result, seen.logs, seen.patches]) + fs.readdirSync(runtime).join();
  assert.ok(!everything.includes(KEY), 'a chave não aparece em resposta, log, estado nem nome de arquivo');
  await close();
});

test('o teste diz rede, chave recusada e conta sem cobrança com frases distintas; só a chave aprovada é guardada', async () => {
  const h = await harness();
  const invalid = await h.call('opencode-key-save', {key: 'sk-errada-errada-errada-12345'});
  assert.deepEqual([invalid.ok, invalid.outcome], [false, 'invalid']);
  const billing = await h.call('opencode-key-save', {key: 'sk-sem-cobranca-1234567890'});
  assert.deepEqual([billing.ok, billing.outcome], [false, 'billing']);
  const shape = await h.call('opencode-key-save', {key: 'isto não é uma chave'});
  assert.deepEqual([shape.ok, shape.outcome], [false, 'shape']);
  assert.equal(new Set([invalid.message, billing.message, shape.message]).size, 3, 'frases distintas');
  assert.equal((await h.call('opencode-status')).saved, false, 'nada foi guardado');
  await h.close();
  const network = await h.call('opencode-key-save', {key: KEY});
  assert.deepEqual([network.ok, network.outcome], [false, 'network']);
  assert.equal(h.seen.relinks, 0);
});

test('arquivo do OpenCode: o status só diz que existe e onde; a chave só é lida no clique', async () => {
  const homeDir = temp();
  const authDir = path.join(homeDir, '.local', 'share', 'opencode');
  fs.mkdirSync(authDir, {recursive: true});
  /* Conteúdo ilegível de propósito: se o status lesse o arquivo, quebraria. */
  fs.writeFileSync(path.join(authDir, 'auth.json'), '{ não é json');
  const h = await harness({homeDir});
  const status = await h.call('opencode-status');
  assert.equal(status.authFile.exists, true);
  assert.equal(status.authFile.display, '~/.local/share/opencode/auth.json');
  const unreadable = await h.call('opencode-auth-file-use');
  assert.deepEqual([unreadable.ok, unreadable.outcome], [false, 'authFile']);
  fs.writeFileSync(path.join(authDir, 'auth.json'), JSON.stringify({opencode: {type: 'api', key: KEY}}));
  const used = await h.call('opencode-auth-file-use');
  assert.equal(used.ok, true);
  assert.equal((await h.call('opencode-status')).saved, true);
  assert.ok(!JSON.stringify([used, h.seen.logs]).includes(KEY));
  await h.close();
});

test('o seletor: Grátis pelo custo zero ou pelo nome, a política da tabela, jev fora e "pode ter saído" só com a lista ao vivo', async () => {
  const h = await harness();
  const before = h.host.annotate(ZEN_MODELS, {keepFree: true});
  assert.ok(!before.some((m) => m.id === 'jev-1.13-free'), 'o que o Pi não chama sai da lista');
  const catJam = before.find((m) => m.id === 'cat-jam-free');
  assert.ok(!catJam.free.tail.some((item) => item.includes('maybeLeft')), 'sem conferir a lista ao vivo, nenhum aviso');
  await h.host.refreshLive();
  const after = h.host.annotate(ZEN_MODELS, {keepFree: true});
  const by = (id) => after.find((m) => m.id === id);
  assert.equal(by('deepseek-v4.1-flash-free').free.is, true);
  assert.equal(by('deepseek-v4.1-flash-free').free.policy, 'zero');
  assert.equal(by('gpt-5.5').free.is, false);
  assert.deepEqual(by('gpt-5.5').free.tail, [], 'pago não leva marca nem política');
  assert.ok(by('cat-jam-free').free.tail.some((item) => item.includes('freeModels.maybeLeft')), 'ausente da lista ao vivo conferida');
  assert.ok(!by('glm-5.3-flash-free').free.tail.some((item) => item.includes('freeModels.maybeLeft')));
  const other = h.host.annotate([{provider: 'test', id: 'offline'}]);
  assert.deepEqual(other, [{provider: 'test', id: 'offline'}], 'outros provedores passam intactos');
  await h.close();
});

test('pelo Pi os grátis somem do seletor: o OpenCode só libera o plano grátis no próprio cliente (#57, 403 FreeTierError)', async () => {
  const h = await harness();
  const pi = h.host.annotate(ZEN_MODELS);
  assert.ok(!pi.some((m) => m.free?.is === true), 'nenhum grátis na lista do Pi');
  assert.ok(pi.some((m) => m.id === 'gpt-5.5'), 'o pago do Zen continua');
  assert.ok(!pi.some((m) => m.id === 'deepseek-v4.1-flash-free'));
  await h.close();
});

test('o modelo escolhido é lembrado e o Pi nasce com ele; grátis lembrado não volta; trocar de provedor desfaz; remover apaga a chave', async () => {
  const h = await harness();
  await h.call('opencode-key-save', {key: KEY});
  h.host.rememberModel({provider: 'opencode', id: 'glm-5.3-flash-free'});
  assert.deepEqual(h.host.launchArgs(), [], 'um grátis lembrado de antes da #57 daria 403 pelo Pi');
  h.host.rememberModel({provider: 'opencode', id: 'gpt-5.5'});
  assert.deepEqual(h.host.launchArgs(), ['--provider', 'opencode', '--model', 'gpt-5.5']);
  h.host.rememberModel({provider: 'test', id: 'offline'});
  assert.deepEqual(h.host.launchArgs(), []);
  await h.call('opencode-paid-ack');
  assert.equal((await h.call('opencode-status')).paidConfirmed, true);
  await h.call('opencode-key-remove');
  assert.deepEqual(h.host.keyEnv(), {});
  assert.equal((await h.call('opencode-status')).saved, false);
  await h.close();
});

/* Grátis do OpenRouter (ajustes do seletor): sufixo `:free` ou custo zero
   comprovado ganham a marca e "sem informação de privacidade"; pelo Pi eles
   continuam (o OpenRouter grátis funciona fora do cliente dele). */
test('o grátis do OpenRouter ganha a marca e a política desconhecida; pago e preço ausente passam intactos', async () => {
  const h = await harness();
  const paid = {provider: 'openrouter', id: 'deepseek/deepseek-v4.1-flash', cost: {input: 0.27, output: 1.1}};
  const noPrice = {provider: 'openrouter', id: 'qwen/qwen3.5-32b'};
  const models = [
    {provider: 'openrouter', id: 'deepseek/deepseek-v4.1-flash:free', cost: {input: 0.27, output: 1.1}},
    {provider: 'openrouter', id: 'meta-llama/llama-5-scout', cost: {input: 0, output: 0}},
    {provider: 'openrouter', id: 'openrouter/auto', cost: {input: 0, output: 0}},
    paid, noPrice,
  ];
  const [suffix, zero, auto, ...rest] = h.host.annotate(models);
  for (const free of [suffix, zero]) {
    assert.equal(free.free.is, true, free.id);
    assert.equal(free.free.tail.length, 2, `${free.id}: marca e política, sem aviso de saída`);
    assert.ok(free.free.tail[0].includes('freeModels.badge') && free.free.tail[1].includes('freeModels.policy.unknown'), `${free.id}: marca e "sem informação de privacidade" (${free.free.tail})`);
  }
  assert.equal(auto.free, undefined, 'o roteador automático nunca é grátis');
  assert.deepEqual(rest, [paid, noPrice], 'pago e preço ausente passam intactos');
  await h.close();
});
