/* Leitura LIMITADA do PNG privado produzido pelo host.
   - o arquivo precisa resolver DENTRO do cacheDir configurado (defesa em
     profundidade: mesmo que a resposta do host viesse torta, nada fora do
     cache vira bloco de imagem);
   - o teto de bytes NÃO é conferido só no stat: o tamanho lido é reconferido
     DEPOIS do readFile, então um arquivo que cresce entre a checagem e a
     leitura falha com IMAGE_TOO_LARGE em vez de devolver bytes acima do teto;
   - acima do teto, a ferramenta falha com IMAGE_TOO_LARGE e NADA é truncado:
     o arquivo completo permanece no cache privado (retenção herdada do host);
   - dentro do teto, devolve bytes + sha256 + dimensões + base64 do MESMO
     arquivo, sem recodificar.
   - TOCTOU residual (herdado do host, documentado): a checagem de identidade
     (realpath dentro do cache) e a leitura são duas operações distintas; o
     limite de tamanho é revalidado no conteúdo lido, mas um arquivo trocado
     por outro já dentro do cache entre a checagem e a leitura pode ser lido.
   - ganchos `realpath`/`statFile`/`readFile` existem só para testes de
     corrida, com o mesmo formato de `node:fs/promises`. */

import path from 'node:path';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {HostError} from '../host/errors.mjs';
import {PNG_MAGIC} from '../host/config.mjs';
import {isInsideRoot} from '../host/paths.mjs';
import {pngSize} from '../host/capture.mjs';

export async function readBoundedPng(
  filePath,
  {maxBytes, cacheDir, realpath = fs.realpath, statFile = fs.stat, readFile = fs.readFile} = {},
) {
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) {
    throw new HostError('IMAGE_INVALID', 'O host não devolveu um caminho absoluto para o PNG.');
  }
  if (!Number.isInteger(maxBytes) || maxBytes < 1) {
    throw new HostError('IMAGE_INVALID', 'Teto de imagem inválido na configuração.');
  }
  let realCache;
  try {
    realCache = await realpath(cacheDir);
  } catch {
    throw new HostError('IMAGE_INVALID', 'cacheDir não pôde ser resolvido para conferir o PNG.');
  }
  let realFile;
  try {
    realFile = await realpath(filePath);
  } catch {
    throw new HostError('IMAGE_INVALID', 'O host não produziu o arquivo PNG esperado.');
  }
  if (!isInsideRoot(realFile, realCache)) {
    throw new HostError('IMAGE_INVALID', 'O PNG precisa estar dentro do cacheDir privado configurado.');
  }
  let stat;
  try {
    stat = await statFile(realFile);
  } catch {
    throw new HostError('IMAGE_INVALID', 'O host não produziu o arquivo PNG esperado.');
  }
  if (!stat.isFile() || stat.size < 100) {
    throw new HostError('IMAGE_INVALID', 'O PNG produzido é inválido (arquivo ausente ou pequeno demais).');
  }
  if (stat.size > maxBytes) {
    throw new HostError(
      'IMAGE_TOO_LARGE',
      `O PNG tem ${stat.size} bytes e excede o teto de ${maxBytes} bytes desta configuração; nada foi truncado e o arquivo completo permanece no cache privado.`,
      {path: realFile, bytes: stat.size, limit: maxBytes},
    );
  }
  const bytes = await readFile(realFile);
  if (bytes.length > maxBytes) {
    // O arquivo mudou entre o stat e a leitura: o limite vale para os bytes
    // que seriam devolvidos, então nada acima do teto é entregue.
    throw new HostError(
      'IMAGE_TOO_LARGE',
      `O PNG tem ${bytes.length} bytes na leitura e excede o teto de ${maxBytes} bytes desta configuração (o arquivo mudou entre a checagem e a leitura); nada foi truncado e o arquivo completo permanece no cache privado.`,
      {path: realFile, bytes: bytes.length, limit: maxBytes},
    );
  }
  if (bytes.length < PNG_MAGIC.length || !bytes.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
    throw new HostError('IMAGE_INVALID', 'O arquivo produzido não é um PNG válido.');
  }
  const size = pngSize(bytes);
  return {
    path: realFile,
    bytes: bytes.length,
    width: size ? size.width : null,
    height: size ? size.height : null,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    base64: bytes.toString('base64'),
  };
}
