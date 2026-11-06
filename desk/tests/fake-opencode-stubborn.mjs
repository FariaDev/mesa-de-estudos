#!/usr/bin/env node
/* Servidor que faz o papel do `opencode serve` que ignora SIGTERM (#105).
   Nomeado como fake do harness: o teste do stop prova que a Mesa escala para
   SIGKILL do grupo e só apaga o ledger depois do exit. Não imita nada além
   do anúncio da porta; não usa a defesa de órfão do fake normal, porque aqui
   a queda do dono é justamente o cenário que o stop precisa resolver. */
import http from 'node:http';

if (process.argv[2] === '--version') { process.stdout.write('2.2.4\n'); process.exit(0); }
if (process.argv[2] === 'models') { process.stdout.write('opencode/gpt-5.5\n'); process.exit(0); }
if (process.argv[2] !== 'serve') { process.stderr.write('fake-opencode-stubborn: só existe o subcomando serve\n'); process.exit(2); }

const server = http.createServer((request, response) => response.end('{}'));
server.listen(0, '127.0.0.1', () => {
  process.stdout.write(`server listening on http://127.0.0.1:${server.address().port}\n`);
});
process.on('SIGTERM', () => {});
process.on('SIGINT', () => {});
setInterval(() => {}, 1 << 30);
