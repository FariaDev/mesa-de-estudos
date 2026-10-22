#!/usr/bin/env node
/* Entrada do servidor MCP stdio da Mesa (Codex).
   - stdout é EXCLUSIVAMENTE o protocolo MCP (o transporte do SDK cuida dele);
     logs e ajuda vão para stderr, sempre genéricos e sem conteúdo de PDF;
   - configuração de inicialização em server/config.mjs; nenhum pedido de
     ferramenta escolhe raízes, cache ou executáveis;
   - erro de inicialização encerra com código 2 e uma linha JSON + uso no
     stderr, sem abrir o protocolo. */

import fs from 'node:fs';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {errorPayload} from '../host/errors.mjs';
import {parseStartupConfig, usageText} from './config.mjs';
import {createMcpServer} from './server.mjs';

/* Main detectado por caminhos REAIS (symlink de arquivo ou de diretório-pai),
   como no CLI do host: comparar a string crua faria o servidor sair 0 sem
   falar MCP quando o plugin root é symlink. */
export function isMainEntry(entry, moduleUrl = import.meta.url) {
  if (typeof entry !== 'string' || entry === '') return false;
  try {
    return fs.realpathSync(entry) === fs.realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}

export async function startStdio({config, deps = {}, stderr = process.stderr} = {}) {
  /* Logs sempre genéricos, prefixados e sem conteúdo de PDF: mensagem
     limitada, controles trocados por espaço. stdout fica SÓ com MCP. */
  const log = (message) => {
    const clean = String(message ?? '')
      .replace(/[\u0000-\u001f\u007f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 300);
    if (clean) stderr.write(`[mesa-study] ${clean}\n`);
  };
  const {server} = createMcpServer({config, deps, log});
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log(`servidor stdio iniciado (roots=${config.roots.length} cache=${config.cacheDir ? 'sim' : 'nao'} helper=${config.xournalHelper ? 'sim' : 'nao'})`);
  return {server, transport};
}

export async function main(argv = process.argv.slice(2), {env = process.env, stderr = process.stderr} = {}) {
  let parsed;
  try {
    parsed = parseStartupConfig({argv, env});
  } catch (error) {
    stderr.write(`${JSON.stringify(errorPayload(error))}\n`);
    stderr.write(`${usageText()}\n`);
    return 2;
  }
  if (parsed.help) {
    stderr.write(`${usageText()}\n`);
    return 0;
  }
  try {
    await startStdio({config: parsed.config, stderr});
    return 0;
  } catch (error) {
    stderr.write(`${JSON.stringify(errorPayload(error))}\n`);
    return 1;
  }
}

if (isMainEntry(process.argv[1])) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      process.stderr.write(`${JSON.stringify(errorPayload(error))}\n`);
      process.exitCode = 1;
    },
  );
}
