// @ts-check
'use strict';

/* Pai falso do teste de órfãos (#105): sobe o `fake-opencode.mjs` pelo mesmo
   `startOpenCodeServer` da Mesa, anuncia o pid no stdout e fica parado até o
   teste matá-lo com SIGKILL. É o único jeito de reproduzir de verdade o filho
   que sobrevive à queda do app sem matar o processo de teste. */

const {startOpenCodeServer} = require('../src/agents/opencode-process.cjs');

const [ledgerDir = '', binary = ''] = process.argv.slice(2);

startOpenCodeServer({binary, cwd: process.cwd(), ledgerDir})
  .then((server) => {
    process.stdout.write(`${JSON.stringify({pid: server.pid})}\n`);
    setInterval(() => {}, 1 << 30);
  })
  .catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
