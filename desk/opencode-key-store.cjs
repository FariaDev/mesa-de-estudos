'use strict';

/* Cofre da chave do OpenCode Zen (#44). A chave NUNCA vai para `config.json`,
   `desk.json`, log nem linha de comando: aqui ela só existe cifrada pelo cofre
   do sistema (Keychain do macOS, Credential Manager do Windows, chaveiro do
   Linux — `safeStorage` do Electron) e, em claro, na memória do processo ao
   lançar o Pi (`OPENCODE_API_KEY` no ambiente dele, ver `opencode-host.cjs`).
   Por que o ambiente e não o `auth.json` do Pi: gravar lá mexeria no perfil
   `~/.pi` do usuário, que a Mesa não toca (fora do escopo da #44); o Pi lê a
   variável do provedor `opencode` por conta própria.

   A cifra entra por parâmetro: `{available, encrypt, decrypt}`. Sem cofre
   disponível a chave não é guardada (nada de texto plano de reserva). */
const fs = require('node:fs');
const path = require('node:path');
const {message} = require('./src/i18n.mjs');

const KEY_FILE = 'opencode-key.bin';

/**
 * @typedef {{available: () => boolean, encrypt: (plain: string) => Buffer, decrypt: (blob: Buffer) => string}} SecretCipher
 */

/**
 * Cifra do Electron. No Linux sem chaveiro o Electron cai em `basic_text`,
 * que não protege nada: vale como indisponível.
 * @param {{isEncryptionAvailable: () => boolean, encryptString: (s: string) => Buffer, decryptString: (b: Buffer) => string, getSelectedStorageBackend?: () => string}} safeStorage
 * @returns {SecretCipher}
 */
function electronCipher(safeStorage) {
  return {
    available() {
      try {
        if (!safeStorage.isEncryptionAvailable()) return false;
        return safeStorage.getSelectedStorageBackend?.() !== 'basic_text';
      } catch { return false; }
    },
    encrypt: (plain) => safeStorage.encryptString(plain),
    decrypt: (blob) => safeStorage.decryptString(blob),
  };
}

/**
 * @param {{dir: string, cipher: SecretCipher}} deps
 * @example createKeyStore({dir: runtime, cipher: electronCipher(safeStorage)}).save('sk-…')
 */
function createKeyStore({dir, cipher}) {
  const file = path.join(dir, KEY_FILE);
  const has = () => fs.existsSync(file);

  function save(key) {
    /* Da chave só saem tipo e tamanho: o texto dela nunca entra na mensagem. */
    if (typeof key !== 'string' || !key) throw new Error(message('err.opencode.badKey', {type: typeof key, length: typeof key === 'string' ? key.length : 0}));
    if (!cipher.available()) throw new Error(message('err.opencode.vaultUnavailable'));
    const blob = cipher.encrypt(key);
    if (!Buffer.isBuffer(blob) || blob.includes(Buffer.from(key, 'utf8'))) throw new Error(message('err.opencode.notEncrypted'));
    fs.mkdirSync(dir, {recursive: true});
    const temp = `${file}.tmp-${process.pid}`;
    fs.writeFileSync(temp, blob, {mode: 0o600});
    fs.renameSync(temp, file);
  }

  /** A chave guardada, ou '' (sem arquivo, cofre indisponível ou arquivo ilegível). */
  function load() {
    if (!has() || !cipher.available()) return '';
    try { return cipher.decrypt(fs.readFileSync(file)); } catch { return ''; }
  }

  function clear() { fs.rmSync(file, {force: true}); }

  return {save, load, clear, has, available: () => cipher.available(), file};
}

module.exports = {createKeyStore, electronCipher, KEY_FILE};
