/* Modelos grátis do OpenCode Zen no host (#44): a chave só passa por aqui
   cifrada, a área de transferência só é lida no `peek`, o arquivo do OpenCode
   só no clique, o teste fala só com a lista de modelos e a política de dados é
   uma tabela com data e fonte. Tudo por fakes com nome (`fake-opencode.mjs`,
   `fake-secret-cipher.cjs`): nenhuma rede, Keychain ou área de transferência real. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {ptMatches, ptText} from './pt-text.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createFakeOpencode} from './fake-opencode.mjs';
import {ZEN_MODELS} from './fake-pi-opencode.mjs';
import {tempDir} from './temp-dir.mjs';
const require = createRequire(import.meta.url);
const {createOpencodeHost, preferredDefaults} = require('../opencode-host.cjs');
const {createKeyStore, BLOB_MAGIC} = require('../opencode-key-store.cjs');
const fakeCipher = require('./fake-secret-cipher.cjs');
const policyTable = require('../free-models.json');

const KEY = 'sk-teste-chave-do-zen-1234567890';
const temp = () => tempDir('mesa-opencode-host');

async function harness({clipboard = '', asyncClipboard = false, fake, homeDir = temp(), runtime = temp(), cipher = fakeCipher} = {}) {
  const console_ = fake || await createFakeOpencode({validKeys: [KEY], billingKeys: ['sk-sem-cobranca-1234567890']});
  const handlers = new Map();
  const seen = {logs: [], patches: [], clipboardReads: 0, relinks: 0, opened: []};
  let state = {};
  const keyStore = createKeyStore({dir: runtime, cipher});
  const host = createOpencodeHost({
    ipcMain: {handle: (name, fn) => handlers.set(name, fn)},
    keyStore,
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
  return {host, call, seen, console_, runtime, homeDir, keyStore, close: () => console_.close()};
}

/* Conta as chamadas à cifra nomeada do cofre (`fake-secret-cipher.cjs`), sem
   trocar o comportamento dela: é o medidor do "abrir Configurações não
   decifra, usar a chave decifra" (#104). */
function countingCipher(base = fakeCipher) {
  const counts = {available: 0, encrypt: 0, decrypt: 0, decryptSync: 0};
  return {
    counts,
    cipher: {
      available: () => { counts.available += 1; return base.available(); },
      encrypt: (plain) => { counts.encrypt += 1; return base.encrypt(plain); },
      decrypt: (blob) => { counts.decrypt += 1; return base.decrypt(blob); },
      decryptSync: (blob) => { counts.decryptSync += 1; return base.decryptSync(blob); },
    },
  };
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

test('o cofre guarda cifrado, recusa sem cofre e nunca devolve texto em claro no arquivo', async () => {
  const dir = temp();
  const store = createKeyStore({dir, cipher: fakeCipher});
  await store.save(KEY);
  assert.equal(await store.load(), KEY);
  assert.ok(!fs.readFileSync(store.file).includes(Buffer.from(KEY)), 'o arquivo do cofre não pode conter a chave em claro');
  process.env.FAKE_CIPHER_OFF = '1';
  try {
    await assert.rejects(() => store.save(KEY), ptMatches(/cofre do sistema não está disponível/));
    assert.equal(await store.load(), '', 'sem cofre a chave guardada não é lida');
  } finally { delete process.env.FAKE_CIPHER_OFF; }
});

/* O Electron 45 ainda grava o blob pela API síncrona antiga: ao ler, a chave
   não pode se perder e o arquivo passa a valer para a API assíncrona. */
test('blob da API síncrona antiga é decifrado e regravado no formato assíncrono', async () => {
  const dir = temp();
  const store = createKeyStore({dir, cipher: fakeCipher});
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(store.file, fakeCipher.encryptLegacy(KEY), {mode: 0o600});
  assert.equal(await store.load(), KEY);
  const rewritten = fs.readFileSync(store.file);
  assert.ok(rewritten.subarray(0, BLOB_MAGIC.length).equals(BLOB_MAGIC), 'o arquivo migrado leva a marca do formato assíncrono');
  const plain = await fakeCipher.decrypt(rewritten.subarray(BLOB_MAGIC.length));
  assert.equal(plain.result, KEY, 'o arquivo migrado é lido pela API assíncrona');
  assert.equal(await createKeyStore({dir, cipher: fakeCipher}).load(), KEY, 'depois da migração não depende mais da API antiga');
});

test('shouldReEncrypt regrava a chave com a API assíncrona', async () => {
  const xor = (buffer) => Buffer.from(buffer.map((byte) => byte ^ 0x5a));
  const opened = Buffer.from('novo:');
  let decrypts = 0;
  let encrypts = 0;
  const cipher = {
    available: async () => true,
    encrypt: async (plain) => { encrypts += 1; return Buffer.concat([opened, xor(Buffer.from(plain, 'utf8'))]); },
    decrypt: async (blob) => {
      decrypts += 1;
      const raw = blob.subarray(0, opened.length).equals(opened) ? blob.subarray(opened.length) : blob;
      return {result: xor(raw).toString('utf8'), shouldReEncrypt: decrypts === 1};
    },
  };
  const dir = temp();
  const store = createKeyStore({dir, cipher});
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(store.file, xor(Buffer.from(KEY, 'utf8')), {mode: 0o600});
  assert.equal(await store.load(), KEY);
  assert.equal(encrypts, 1, 'veio shouldReEncrypt: a chave foi regravada uma vez');
  const rewritten = fs.readFileSync(store.file);
  assert.ok(rewritten.subarray(0, BLOB_MAGIC.length).equals(BLOB_MAGIC), 'o arquivo novo leva a marca do formato assíncrono');
  assert.ok(rewritten.subarray(BLOB_MAGIC.length, BLOB_MAGIC.length + opened.length).equals(opened), 'o arquivo novo sai da API assíncrona');
  const reopened = createKeyStore({dir, cipher});
  assert.equal(await reopened.load(), KEY);
  assert.equal(encrypts, 1, 'sem shouldReEncrypt na segunda vez, não regrava de novo');
});

/* Regressão #104: abrir Configurações só olha o arquivo cifrado; a decifragem
   acontece no uso explícito da chave (testar, salvar ou subir o tutor). */
test('abrir Configurações não decifra a chave; testar a guardada decifra uma vez (#104)', async () => {
  const {cipher, counts} = countingCipher();
  const first = await harness({cipher});
  const saved = await first.call('opencode-key-save', {key: KEY});
  assert.equal(saved.ok, true);
  const runtime = first.runtime;
  await first.close();
  for (const name of Object.keys(counts)) counts[name] = 0;
  /* Outra instância do host = app reaberto: a memória do processo anterior não existe. */
  const second = await harness({cipher, runtime});
  const status = await second.call('opencode-status');
  assert.equal(status.saved, true, 'o arquivo cifrado basta para dizer "guardada"');
  assert.equal(status.masked, '••••', 'sem decifrar, a máscara é genérica');
  assert.deepEqual([counts.available, counts.encrypt, counts.decrypt, counts.decryptSync], [0, 0, 0, 0], 'abrir Configurações não toca o cofre');
  const tested = await second.call('opencode-key-test');
  assert.deepEqual([tested.ok, tested.outcome], [true, 'ok']);
  assert.equal(counts.decrypt, 1, 'usar a chave guardada decifra uma vez');
  assert.equal(counts.decryptSync, 0, 'blob com a marca não usa a API síncrona');
  const after = await second.call('opencode-status');
  assert.equal(after.masked, 'sk-••••7890', 'depois de usar, a máscara vem da memória sem decifrar de novo');
  assert.equal(counts.decrypt, 1);
  await second.close();
});

test('abrir Configurações e subir o tutor sem chave da Mesa não tocam no cofre (#104)', async () => {
  const {cipher, counts} = countingCipher();
  const h = await harness({cipher});
  const status = await h.call('opencode-status');
  assert.deepEqual([status.saved, status.masked], [false, '']);
  assert.deepEqual(await h.host.keyEnv(), {});
  assert.deepEqual(counts, {available: 0, encrypt: 0, decrypt: 0, decryptSync: 0}, 'sem arquivo, nem a disponibilidade do cofre é consultada');
  await h.close();
});

test('chave guardada ilegível: status não decifra e o uso diz o que aconteceu (#104)', async () => {
  const runtime = temp();
  fs.mkdirSync(runtime, {recursive: true});
  fs.writeFileSync(path.join(runtime, 'opencode-key.bin'), Buffer.from('lixo que não é blob do cofre'));
  const {cipher, counts} = countingCipher();
  const h = await harness({runtime, cipher});
  const status = await h.call('opencode-status');
  assert.equal(status.saved, true);
  assert.equal(status.masked, '••••');
  assert.equal(counts.decrypt, 0, 'abrir Configurações não tenta decifrar');
  const tested = await h.call('opencode-key-test');
  assert.deepEqual([tested.ok, tested.outcome], [false, 'unreadable']);
  assert.match(ptText(tested.message), /não pôde ser lida/);
  assert.equal(counts.decrypt, 1, 'testar a chave guardada tenta decifrar uma vez');
  assert.equal(counts.decryptSync, 1, 'blob antigo sem a marca ainda usa a ponte síncrona');
  await assert.rejects(() => h.host.keyEnv(), ptMatches(/não pôde ser lida/));
  await h.close();
});

test('blob com a marca não cai na decifra síncrona quando o cofre recusa (#104)', async () => {
  const dir = temp();
  const xor = (buffer) => Buffer.from(buffer.map((byte) => byte ^ 0x5a));
  let decryptSync = 0;
  const cipher = {
    available: async () => true,
    encrypt: async (plain) => xor(Buffer.from(plain, 'utf8')),
    decrypt: async () => { throw new Error('cofre recusou'); },
    decryptSync: () => { decryptSync += 1; return KEY; },
  };
  await createKeyStore({dir, cipher}).save(KEY);
  const store = createKeyStore({dir, cipher});
  assert.equal(await store.load(), '');
  assert.equal(decryptSync, 0, 'blob marcado nunca chama a API síncrona, que trava o fechamento');
});

test('a segunda leitura do cofre não decifra de novo; sem cofre não devolve a memória', async () => {
  const xor = (buffer) => Buffer.from(buffer.map((byte) => byte ^ 0x5a));
  let decrypts = 0;
  const cipher = {
    available: async () => process.env.FAKE_CIPHER_OFF !== '1',
    encrypt: async (plain) => xor(Buffer.from(plain, 'utf8')),
    decrypt: async (blob) => {
      decrypts += 1;
      return {result: xor(blob).toString('utf8'), shouldReEncrypt: false};
    },
  };
  const dir = temp();
  const store = createKeyStore({dir, cipher});
  await store.save(KEY);
  assert.equal(await store.load(), KEY);
  assert.equal(decrypts, 0, 'salvar já deixa a chave na memória do processo');
  const reopened = createKeyStore({dir, cipher});
  assert.equal(await reopened.load(), KEY);
  assert.equal(await reopened.load(), KEY);
  assert.equal(decrypts, 1);
  process.env.FAKE_CIPHER_OFF = '1';
  try { assert.equal(await reopened.load(), '', 'cofre desligado não entrega a chave que já estava em memória'); }
  finally { delete process.env.FAKE_CIPHER_OFF; }
  assert.equal(await reopened.load(), KEY);
  assert.equal(decrypts, 2, 'ligar o cofre de novo relê o arquivo, não a memória antiga');
  reopened.clear();
  assert.equal(await reopened.load(), '');
  assert.equal(await store.load(), '', 'o outro cofre também vê que o arquivo saiu');
  const next = 'sk-nova-chave-do-zen-1234567890';
  await reopened.save(next);
  assert.equal(await store.load(), next, 'chave nova no arquivo vence a memória do outro cofre');
});

/* A promessa compartilhada (`pending`) impede duas decifragens do mesmo blob
   quando status e conexão pedem a chave ao mesmo tempo. */
test('duas leituras concorrentes do cofre decifram uma vez só', async () => {
  const xor = (buffer) => Buffer.from(buffer.map((byte) => byte ^ 0x5a));
  let decrypts = 0;
  const cipher = {
    available: async () => true,
    encrypt: async (plain) => xor(Buffer.from(plain, 'utf8')),
    decrypt: async (blob) => {
      decrypts += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {result: xor(blob).toString('utf8'), shouldReEncrypt: false};
    },
  };
  const dir = temp();
  await createKeyStore({dir, cipher}).save(KEY);
  const reopened = createKeyStore({dir, cipher});
  assert.deepEqual(await Promise.all([reopened.load(), reopened.load()]), [KEY, KEY]);
  assert.equal(decrypts, 1);
});

/* Apagar a chave enquanto o cofre decifra (ou regrava) o blob não pode
   ressuscitá-la: a regravação da migração e do shouldReEncrypt respeita o clear. */
test('clear durante a leitura não regrava a chave apagada', async () => {
  const xor = (buffer) => Buffer.from(buffer.map((byte) => byte ^ 0x5a));
  for (const mode of ['legacy', 'reencrypt']) {
    let release, started;
    const gate = new Promise((resolve) => { release = resolve; });
    const decrypting = new Promise((resolve) => { started = resolve; });
    const cipher = {
      available: async () => true,
      encrypt: async (plain) => xor(Buffer.from(plain, 'utf8')),
      decrypt: async (blob) => {
        started();
        await gate;
        if (mode === 'legacy') throw new Error('blob da API antiga');
        return {result: xor(blob).toString('utf8'), shouldReEncrypt: true};
      },
      decryptSync: (blob) => xor(blob).toString('utf8'),
    };
    const dir = temp();
    await createKeyStore({dir, cipher}).save(KEY);
    const reopened = createKeyStore({dir, cipher});
    const reading = reopened.load();
    await decrypting;
    reopened.clear();
    release();
    assert.equal(await reading, '', `${mode}: a leitura em voo não devolve a chave apagada`);
    assert.equal(reopened.has(), false, `${mode}: o arquivo continua apagado`);
    assert.equal(await reopened.load(), '', `${mode}: e a próxima leitura também não acha nada`);
  }
});

/* Electron 45: a API assíncrona é a nova; no Linux sem chaveiro o backend
   `basic_text` não protege nada e continua valendo como indisponível. */
test('o cofre do Electron: API assíncrona e basic_text vale como indisponível', async () => {
  const {electronCipher} = require('../opencode-key-store.cjs');
  const safeStorage = (backend) => ({
    isAsyncEncryptionAvailable: async () => true,
    getSelectedStorageBackend: () => backend,
    encryptStringAsync: async (plain) => Buffer.from(`cifrado:${plain}`, 'utf8'),
    decryptStringAsync: async (blob) => ({result: String(blob).replace(/^cifrado:/, ''), shouldReEncrypt: false}),
    decryptString: (blob) => String(blob).replace(/^legado:/, ''),
  });
  const secure = electronCipher(safeStorage('gnome_libsecret'));
  assert.equal(await secure.available(), true);
  assert.deepEqual(await secure.decrypt(Buffer.from('cifrado:sk-1')), {result: 'sk-1', shouldReEncrypt: false});
  assert.equal(secure.decryptSync(Buffer.from('legado:sk-1')), 'sk-1');
  assert.equal(await electronCipher(safeStorage('basic_text')).available(), false, 'basic_text não protege nada');
  assert.equal(await electronCipher({...safeStorage('gnome_libsecret'), isAsyncEncryptionAvailable: async () => false}).available(), false);
  const future = electronCipher({...safeStorage('gnome_libsecret'), decryptString: undefined});
  assert.equal(future.decryptSync, undefined, 'sem API síncrona (Electron 46), não inventa a ponte');
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
  assert.deepEqual(await host.keyEnv(), {OPENCODE_API_KEY: KEY});
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
  assert.equal(status.authFile.display, path.join('~', '.local', 'share', 'opencode', 'auth.json'));
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

test('os grátis somem do seletor: o OpenCode só libera o plano grátis no próprio cliente (#57, 403 FreeTierError)', async () => {
  const h = await harness();
  const pi = h.host.annotate(ZEN_MODELS);
  assert.ok(!pi.some((m) => m.free?.is === true), 'nenhum grátis na lista do Pi');
  assert.ok(pi.some((m) => m.id === 'gpt-5.5'), 'o pago do Zen continua');
  assert.ok(!pi.some((m) => m.id === 'deepseek-v4.1-flash-free'));
  await h.close();
});

test('o modelo escolhido é lembrado; trocar de provedor desfaz; remover apaga a chave', async () => {
  const h = await harness();
  await h.call('opencode-key-save', {key: KEY});
  h.host.rememberModel({provider: 'opencode', id: 'glm-5.3-flash-free'});
  h.host.rememberModel({provider: 'opencode', id: 'gpt-5.5'});
  h.host.rememberModel({provider: 'test', id: 'offline'});
  await h.call('opencode-paid-ack');
  assert.equal((await h.call('opencode-status')).paidConfirmed, true);
  await h.call('opencode-key-remove');
  assert.deepEqual(await h.host.keyEnv(), {});
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
    assert.equal(free.free.tail.length, 1, `${free.id}: política, sem selo e sem aviso de saída`);
    assert.ok(free.free.tail[0].includes('freeModels.policy.unknown'), `${free.id}: "sem informação de privacidade" (${free.free.tail})`);
  }
  assert.equal(auto.free, undefined, 'o roteador automático nunca é grátis');
  assert.deepEqual(rest, [paid, noPrice], 'pago e preço ausente passam intactos');
  await h.close();
});
