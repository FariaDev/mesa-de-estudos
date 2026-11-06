'use strict';

/* Cofre da chave do OpenCode Zen (#44). A chave NUNCA vai para `config.json`,
   `desk.json`, log nem linha de comando: aqui ela só existe cifrada pelo cofre
   do sistema (Keychain do macOS, Credential Manager do Windows, chaveiro do
   Linux — `safeStorage` do Electron) e, em claro, na memória do processo ao
   lançar o OpenCode (`OPENCODE_API_KEY` no ambiente dele, ver `opencode-host.cjs`).
   Por que o ambiente e não o `auth.json` do OpenCode: gravar lá mexeria no perfil
   `~/.opencode` do usuário, que a Mesa não toca (fora do escopo da #44); o OpenCode lê a
   variável do provedor `opencode` por conta própria.

   A cifra entra por parâmetro: `{available, encrypt, decrypt, decryptSync?}`.
   Sem cofre disponível a chave não é guardada (nada de texto plano de reserva).
   A API é assíncrona desde o Electron 45 (`encryptStringAsync`); `decryptSync`
   é só a ponte de leitura para o blob gravado pela API antiga, que é regravado
   no formato novo assim que lido.

   Desde a #104 o arquivo leva a marca `BLOB_MAGIC` antes do ciphertext. Com
   ela, uma falha do cofre (acesso recusado, chaveiro indisponível) NUNCA cai
   na API síncrona: `decryptString` bloqueia o processo principal enquanto o
   macOS mostra o pedido do Chaves, e era isso que impedia fechar o app. Só o
   blob sem a marca (formato anterior, inclusive o da 1.0.2) usa a ponte
   síncrona; assim que é lido, é regravado com a marca. */
const fs = require('node:fs');
const path = require('node:path');
const {message} = require('./src/i18n.mjs');

const KEY_FILE = 'opencode-key.bin';
const BLOB_MAGIC = Buffer.from('mesa-safe1\n');

/**
 * @typedef {{result: string, shouldReEncrypt: boolean}} CipherPlaintext
 * @typedef {{available: () => boolean | Promise<boolean>, encrypt: (plain: string) => Buffer | Promise<Buffer>,
 *   decrypt: (blob: Buffer) => CipherPlaintext | Promise<CipherPlaintext>,
 *   decryptSync?: (blob: Buffer) => string}} SecretCipher
 */

/**
 * Cifra do Electron. No Linux sem chaveiro o Electron cai em `basic_text`,
 * que não protege nada: vale como indisponível.
 * @param {{isAsyncEncryptionAvailable: () => Promise<boolean>, encryptStringAsync: (s: string) => Promise<Buffer>,
 *   decryptStringAsync: (b: Buffer) => Promise<{result: string, shouldReEncrypt: boolean}>,
 *   decryptString?: (b: Buffer) => string, getSelectedStorageBackend?: () => string}} safeStorage
 * @returns {SecretCipher}
 */
function electronCipher(safeStorage) {
  const cipher = {
    async available() {
      try {
        if (!(await safeStorage.isAsyncEncryptionAvailable())) return false;
        return safeStorage.getSelectedStorageBackend?.() !== 'basic_text';
      } catch { return false; }
    },
    encrypt: (plain) => safeStorage.encryptStringAsync(plain),
    async decrypt(blob) {
      const plain = await safeStorage.decryptStringAsync(blob);
      return {
        result: typeof plain?.result === 'string' ? plain.result : '',
        shouldReEncrypt: plain?.shouldReEncrypt === true,
      };
    },
  };
  /* O Electron 46 remove a API síncrona; no 45 ela ainda decifra o blob que
     gravou antes desta migração. O `typeof` protege o dia em que sumir. */
  if (typeof safeStorage?.decryptString === 'function') cipher.decryptSync = (blob) => safeStorage.decryptString(blob);
  return cipher;
}

/** @param {unknown} value */
function plaintextOf(value) {
  if (typeof value === 'string') return {result: value, shouldReEncrypt: false};
  const plain = /** @type {CipherPlaintext|undefined} */ (value);
  return {
    result: typeof plain?.result === 'string' ? plain.result : '',
    shouldReEncrypt: plain?.shouldReEncrypt === true,
  };
}

/**
 * @param {{dir: string, cipher: SecretCipher}} deps
 * @example createKeyStore({dir: runtime, cipher: electronCipher(safeStorage)}).save('sk-…')
 */
function createKeyStore({dir, cipher}) {
  const file = path.join(dir, KEY_FILE);
  const has = () => fs.existsSync(file);
  /* Cada `acquire` do OpenCode decifra a chave no cofre do sistema. Ela já
     vive em claro na memória (vai no ambiente do servidor). A segunda leitura
     desta execução não volta ao cofre. Some se o cofre desligar ou o arquivo sair. */
  /** @type {string|null} */
  let memory = null;
  /** @type {Promise<string>|null} */
  let pending = null;
  /* Save e clear invalidam uma decifragem em voo: ela não pode regravar na
     memória a chave antiga depois de a pessoa salvar ou remover. */
  let revision = 0;

  async function writeBlob(blob) {
    await fs.promises.mkdir(dir, {recursive: true});
    const temp = `${file}.tmp-${process.pid}`;
    await fs.promises.writeFile(temp, Buffer.concat([BLOB_MAGIC, Buffer.from(blob)]), {mode: 0o600});
    await fs.promises.rename(temp, file);
  }

  async function save(key) {
    /* Da chave só saem tipo e tamanho: o texto dela nunca entra na mensagem. */
    if (typeof key !== 'string' || !key) throw new Error(message('err.opencode.badKey', {type: typeof key, length: typeof key === 'string' ? key.length : 0}));
    if (!(await cipher.available())) throw new Error(message('err.opencode.vaultUnavailable'));
    const blob = await cipher.encrypt(key);
    if (!Buffer.isBuffer(blob) || blob.includes(Buffer.from(key, 'utf8'))) throw new Error(message('err.opencode.notEncrypted'));
    await writeBlob(blob);
    revision += 1;
    memory = key;
  }

  /* Blob da API antiga: decifra uma vez e regrava no formato novo. Se a
     regravação falhar, a chave lida ainda vale para esta execução. */
  async function decryptLegacy(blob, at) {
    if (typeof cipher.decryptSync !== 'function') return '';
    let parsed;
    try { parsed = cipher.decryptSync(blob); } catch { return ''; }
    if (typeof parsed !== 'string' || !parsed) return '';
    /* Save ou clear durante a leitura: regravar ressuscitaria a chave apagada. */
    if (revision !== at) return memory ?? '';
    try { await save(parsed); } catch { memory = parsed; }
    return memory ?? parsed;
  }

  async function decryptStored(at) {
    let raw;
    try { raw = await fs.promises.readFile(file); } catch { return ''; }
    if (revision !== at) return memory ?? '';
    const tagged = raw.subarray(0, BLOB_MAGIC.length).equals(BLOB_MAGIC);
    const blob = tagged ? raw.subarray(BLOB_MAGIC.length) : raw;
    let parsed;
    try { parsed = plaintextOf(await cipher.decrypt(blob)); } catch { parsed = null; }
    /* Só o formato antigo (sem marca) pode precisar da API síncrona. */
    if ((!parsed || !parsed.result) && !tagged) return decryptLegacy(blob, at);
    if (!parsed || !parsed.result) return '';
    if (revision !== at) return memory ?? '';
    /* Blob antigo lido pela API assíncrona: regrava com a marca para a próxima
       falha não cair na ponte síncrona (que trava o fechamento, #104). */
    if (!tagged || parsed.shouldReEncrypt) {
      try { await save(parsed.result); } catch { /* a chave lida continua valendo */ }
    }
    if (revision !== at) return memory ?? '';
    memory = parsed.result;
    return memory;
  }

  /**
   * O que a Mesa sabe da chave guardada. `saved` é só o arquivo existir;
   * `readable` diz se a decifragem desta execução deu certo. Abrir
   * Configurações usa `has`/`peek` e nunca chega ao cofre.
   * @returns {Promise<{key: string, saved: boolean, vaultAvailable: boolean, readable: boolean}>}
   * @example const {key, saved, readable} = await store.read();
   */
  async function read() {
    /* Arquivo ausente: a memória sai junto e o cofre nem é consultado. */
    if (!has()) {
      memory = null;
      return {key: '', saved: false, vaultAvailable: true, readable: false};
    }
    if (!(await cipher.available())) {
      memory = null;
      return {key: '', saved: true, vaultAvailable: false, readable: false};
    }
    if (memory !== null) return {key: memory, saved: true, vaultAvailable: true, readable: true};
    if (!pending) {
      const at = revision;
      let task;
      task = decryptStored(at).catch(() => '').finally(() => { if (pending === task) pending = null; });
      pending = task;
    }
    const key = await pending;
    /* Removeram o arquivo enquanto a leitura corria: não há chave guardada. */
    const stillSaved = has();
    return {key: stillSaved ? key : '', saved: stillSaved, vaultAvailable: true, readable: stillSaved && key !== ''};
  }

  /** A chave guardada, ou '' (sem arquivo, cofre indisponível ou arquivo ilegível). */
  async function load() {
    return (await read()).key;
  }

  /** A chave já decifrada nesta execução, sem tocar no cofre (para a máscara). @returns {string|null} */
  function peek() { return memory; }

  function clear() {
    revision += 1;
    memory = null;
    pending = null;
    fs.rmSync(file, {force: true});
  }

  return {save, load, read, peek, clear, has, available: async () => cipher.available(), file};
}

module.exports = {createKeyStore, electronCipher, KEY_FILE, BLOB_MAGIC};
