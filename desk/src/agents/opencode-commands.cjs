// @ts-check
'use strict';

/* Comandos slash do OpenCode (#57, porte da branch t3/opencode-provider;
   medido no binário 2.0.32):

     GET  /api/command?location[directory]=…   {location, data: [{name, description?}]}
     POST /api/session/:id/command             body {name, text, files?}; 204 = aceite

   A execução segue as MESMAS regras de entrega do prompt e mora no adaptador
   (`admitTurn`); aqui fica o catálogo e a leitura do texto `/nome resto`.
   Formato genérico `{name, description}`: a #58 reaproveita no Claude. */

const {message} = require('../i18n.mjs');

/**
 * @typedef {{name: string, description: string}} SlashCommand
 */

/**
 * Normaliza o catálogo do servidor; item sem nome sai.
 * @param {unknown} payload
 * @returns {SlashCommand[]}
 * @example commandList({data: [{name: '/review', description: 'Revisa'}]}) // [{name: 'review', description: 'Revisa'}]
 */
function commandList(payload) {
  const list = /** @type {{data?: unknown}} */ (payload)?.data ?? payload;
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => ({name: String(item?.name || '').replace(/^\/+/, '').trim(), description: String(item?.description || '')}))
    .filter((item) => item.name);
}

/**
 * Lê o catálogo de comandos da pasta da conversa.
 * @param {{request: import('./opencode-http.cjs').OpenCodeClient['request'], location: () => Record<string, string>}} port
 * @returns {Promise<SlashCommand[]>}
 * @example await listCommands({request: client.request, location: () => ({'location[directory]': dir})})
 */
async function listCommands(port) {
  const response = await port.request('GET', '/api/command', {query: port.location()});
  if (!response.ok) throw Error(message('err.opencode.commandsFailed', {status: response.status}));
  return commandList(response.payload);
}

/**
 * Separa `/nome resto` em comando conhecido e argumento; null se não for comando do catálogo.
 * @param {unknown} text @param {SlashCommand[]} known
 * @returns {{name: string, text: string}|null}
 * @example parseSlashCommand('/review a prova', [{name: 'review', description: ''}]) // {name: 'review', text: 'a prova'}
 */
function parseSlashCommand(text, known) {
  const match = /^\/([^\s/]+)(?:\s+([\s\S]*))?$/.exec(String(text || '').trim());
  if (!match || !known.some((item) => item.name === match[1])) return null;
  return {name: match[1], text: String(match[2] || '').trim()};
}

module.exports = {commandList, listCommands, parseSlashCommand};
