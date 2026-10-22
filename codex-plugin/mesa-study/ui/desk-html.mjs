/* Carregador Node do recurso MCP Apps do painel Mesa (host = servidor MCP).
 *
 * O painel vive em `ui/desk.html` (HTML/CSS/JS inline, sem rede). O servidor
 * registra esse HTML como recurso MCP e associa `mesa_open` ao recurso:
 *
 *   import {buildDeskHtml, DESK_URI, DESK_MIME} from '../ui/desk-html.mjs';
 *
 *   server.registerResource('mesa-desk', DESK_URI, {}, async () => ({
 *     contents: [{
 *       uri: DESK_URI,
 *       mimeType: DESK_MIME,
 *       text: buildDeskHtml(),
 *       _meta: {ui: {prefersBorder: true, csp: {connectDomains: [], resourceDomains: []}}},
 *     }],
 *   }));
 *
 *   // tool mesa_open, no config do registerTool:
 *   _meta: {
 *     ui: {resourceUri: DESK_URI},                 // padrão MCP Apps
 *     'openai/outputTemplate': DESK_URI,           // alias de compatibilidade
 *   }
 *
 * Nada aqui abre rede, lê credenciais ou toca o cache: é só leitura do HTML
 * versionado, com validações baratas para falhar cedo se o arquivo sumir ou
 * for trocado por algo que não é o painel.
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const DESK_URI = 'ui://mesa-study/desk-v1.html';
export const DESK_MIME = 'text/html;profile=mcp-app';
export const DESK_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'desk.html');

export function buildDeskHtml({readFile = fs.readFileSync} = {}) {
  const html = String(readFile(DESK_FILE, 'utf8'));
  if (!/^<!doctype html>/i.test(html.trimStart())) {
    throw new Error('ui/desk.html precisa começar com <!doctype html>.');
  }
  if (!/<script data-mesa-desk>/.test(html)) {
    throw new Error('ui/desk.html sem o script inline data-mesa-desk.');
  }
  return html;
}
