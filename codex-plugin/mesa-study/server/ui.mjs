/* Recurso MCP Apps do painel Mesa: constantes e leitura do UI arquivo.
   - a leitura acontece na chamada `resources/read` (NUNCA no startup): o
     servidor continua subindo e as ferramentas de PDF/captura seguem úteis;
     enquanto `ui/desk.html` não existir na cópia instalada, o read falha com
     erro CLARO (UI_RESOURCE_MISSING), sem derrubar a sessão;
   - nada de rede, credenciais ou cache: é só o HTML versionado do pacote,
     com as mesmas checagens baratas do carregador `ui/desk-html.mjs`
     (doctype HTML5 + script inline `data-mesa-desk`) e um teto defensivo;
   - o CSP declarado no conteúdo é vazio de propósito: o painel é 100% inline
     (data:image/png), sem conexões nem scripts/estilos externos. */

import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {HostError} from '../host/errors.mjs';

export const DESK_RESOURCE_URI = 'ui://mesa-study/desk-v1.html';
export const DESK_RESOURCE_MIME = 'text/html;profile=mcp-app';
/* Teto defensivo: o painel real tem dezenas de KB; acima disso é engano de
   empacotamento, não UI legítima. */
export const MAX_DESK_HTML_BYTES = 1024 * 1024;
export const DESK_RESOURCE_CSP = Object.freeze({
  connectDomains: Object.freeze([]),
  resourceDomains: Object.freeze([]),
});

export function defaultDeskHtmlPath(moduleUrl = import.meta.url) {
  return path.join(path.dirname(fileURLToPath(moduleUrl)), '..', 'ui', 'desk.html');
}

/* Lê e valida o HTML do painel. `uiFile` é injetável só por testes (deps do
   createMcpServer); a produção usa o caminho derivado do pacote — nunca vem
   de chamada MCP. Lança HostError com código estável. */
export async function readDeskHtml({
  uiFile = defaultDeskHtmlPath(),
  readFile = fs.readFile,
  maxBytes = MAX_DESK_HTML_BYTES,
} = {}) {
  let html;
  try {
    html = await readFile(uiFile, 'utf8');
  } catch (error) {
    throw new HostError(
      'UI_RESOURCE_MISSING',
      'O painel ui://mesa-study/desk-v1.html ainda não está disponível nesta cópia do plugin: o arquivo ui/desk.html não foi encontrado. A UI é empacotada junto do servidor; atualize/reinstale a cópia local e reinicie o servidor. Enquanto isso, as ferramentas de PDF e captura continuam funcionando.',
      {file: 'ui/desk.html', reason: error && typeof error.code === 'string' ? error.code : 'read-failed'},
    );
  }
  if (typeof html !== 'string' || html.trim() === '') {
    throw new HostError(
      'UI_RESOURCE_INVALID',
      'O arquivo ui/desk.html está vazio; o painel da Mesa não pode ser servido. Reinstale/atualize a cópia local do plugin.',
    );
  }
  if (Buffer.byteLength(html, 'utf8') > maxBytes) {
    throw new HostError(
      'UI_RESOURCE_TOO_LARGE',
      `O arquivo ui/desk.html excede o teto de ${maxBytes} bytes desta configuração; o painel não pode ser servido. Reinstale/atualize a cópia local do plugin.`,
      {limit: maxBytes},
    );
  }
  const head = html.trimStart();
  if (!/^<!doctype html>/i.test(head) || !/<script data-mesa-desk>/.test(html)) {
    throw new HostError(
      'UI_RESOURCE_INVALID',
      'O arquivo ui/desk.html não tem o formato esperado do painel (doctype HTML5 + script inline marcado como data-mesa-desk); ele não será servido como UI.',
    );
  }
  return html;
}
