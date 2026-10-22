'use strict';

/* Cofre falso do sistema para os testes (#44): no lugar do `safeStorage` do
   Electron (Keychain de verdade), `opencode-key-store.cjs` recebe esta cifra
   quando `LEARNING_DESK_SECRET_CIPHER` aponta para ela (só em modo de teste).
   Mistura a chave com um padrão fixo: o arquivo gravado NÃO contém a chave em
   claro, então a varredura "a chave não está em lugar nenhum do runtime"
   prova alguma coisa. `FAKE_CIPHER_OFF=1` simula o computador sem cofre. */
const PATTERN = Buffer.from('mesa-cofre-de-teste');
const mix = (buffer) => Buffer.from(buffer.map((byte, index) => byte ^ PATTERN[index % PATTERN.length]));

module.exports = {
  available: () => process.env.FAKE_CIPHER_OFF !== '1',
  encrypt: (plain) => mix(Buffer.from(plain, 'utf8')),
  decrypt: (blob) => mix(blob).toString('utf8'),
};
