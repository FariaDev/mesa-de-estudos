#!/usr/bin/env node
'use strict';

/* Alvo mínimo do shim `opencode2` (#revisão): o `placeBinary` copia este
   arquivo como `~/.opencode/bin/opencode`, e o shim real do instalador faz
   `exec` nele. Só anuncia a porta no contrato que `startOpenCodeServer` lê;
   SIGTERM encerra, para o teste provar o stop através do shim. */

const http = require('node:http');

const server = http.createServer((request, response) => {
  response.writeHead(200, {'content-type': 'application/json'});
  response.end('{}');
});

server.listen(0, '127.0.0.1', () => {
  process.stdout.write(`server listening on http://127.0.0.1:${server.address().port}\n`);
});

process.on('SIGTERM', () => process.exit(0));
