// @ts-check
/* Ponto de entrada do MCP `mesa` (#57). O OpenCode o sobe por stdio com o
   Node do Electron (`ELECTRON_RUN_AS_NODE=1`) e o ambiente que a Mesa monta:
   as pontes do GeoGebra e de atividades e o idioma do tutor. Log de
   depuração vai ao stderr em JSON por linha; stdout é só do protocolo. */

import {createMcpServer, serveLines} from './protocol.mjs';
import {mesaTools} from './tools.mjs';

const reply = createMcpServer({tools: mesaTools(process.env), name: 'mesa', version: '1', log: (line) => process.stderr.write(`${line}\n`)});
serveLines(reply, {input: process.stdin, output: process.stdout});
