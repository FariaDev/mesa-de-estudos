'use strict';

/* Cofre falso do sistema para os testes (#44): no lugar do `safeStorage` do
   Electron (Keychain de verdade), `opencode-key-store.cjs` recebe esta cifra
   quando `LEARNING_DESK_SECRET_CIPHER` aponta para ela (só em modo de teste).
   Mistura a chave com um padrão fixo: o arquivo gravado NÃO contém a chave em
   claro, então a varredura "a chave não está em lugar nenhum do runtime"
   prova alguma coisa. `FAKE_CIPHER_OFF=1` simula o computador sem cofre.

   A API nova é a assíncrona. `encryptLegacy` grava no formato da API síncrona
   antiga e `decryptSync` lê os dois: é o que exercita a migração do blob que
   o Electron 45 já tinha no disco. A decifragem assíncrona recusa o blob
   antigo de propósito, para o caminho de migração ser o testado. */
const PATTERN = Buffer.from('mesa-cofre-de-teste');
const ASYNC_TAG = Buffer.from('mesa-async:');
const LEGACY_TAG = Buffer.from('mesa-legacy:');
const mix = (buffer) => Buffer.from(buffer.map((byte, index) => byte ^ PATTERN[index % PATTERN.length]));
const tag = (prefix, plain) => Buffer.concat([prefix, mix(Buffer.from(plain, 'utf8'))]);
const hasTag = (blob, prefix) => Buffer.isBuffer(blob) && blob.subarray(0, prefix.length).equals(prefix);
const untag = (blob, prefix) => mix(blob.subarray(prefix.length)).toString('utf8');

module.exports = {
  available: async () => process.env.FAKE_CIPHER_OFF !== '1',
  encrypt: async (plain) => tag(ASYNC_TAG, plain),
  async decrypt(blob) {
    if (!hasTag(blob, ASYNC_TAG)) throw new Error('blob do cofre de teste gravado pela API síncrona antiga');
    return {result: untag(blob, ASYNC_TAG), shouldReEncrypt: false};
  },
  encryptLegacy: (plain) => tag(LEGACY_TAG, plain),
  decryptSync: (blob) => {
    if (hasTag(blob, ASYNC_TAG)) return untag(blob, ASYNC_TAG);
    if (!hasTag(blob, LEGACY_TAG)) throw new Error('blob desconhecido do cofre de teste');
    return untag(blob, LEGACY_TAG);
  },
};
