/* Servidor de prova dos testes "nada vaza para a rede" (hunt-activity-network,
   ggb-offline-ui). Anota só o que veio do Electron (User-Agent com "Electron")
   e o `/sanidade` que o próprio teste pede: o T3 Code e outros vizinhos sondam
   portas locais com `GET /` a cada 15 s, e isso reprovava o teste sem a Mesa
   ter vazado nada (relatório do Mac, 2026-10-31, e Debian). */
import http from 'node:http';

/** True quando o pedido conta como vazamento ou é a sanidade do teste. */
export function countsAsHit(req) {
  return /Electron\//.test(String(req.headers['user-agent'] || '')) || req.url === '/sanidade';
}

/**
 * Sobe o servidor em 127.0.0.1 numa porta livre.
 * @returns {Promise<{url:string, hits:string[], close:()=>Promise<void>}>}
 * @example const probe = await startLeakProbe(); // probe.url === 'http://127.0.0.1:PORTA/'
 */
export async function startLeakProbe() {
  const hits = [];
  const server = http.createServer((req, res) => {
    if (countsAsHit(req)) hits.push(`${req.method} ${req.url}`);
    res.writeHead(200, {'content-type': 'text/plain', 'access-control-allow-origin': '*'});
    res.end('vazou');
  });
  server.on('upgrade', (req, socket) => {
    if (countsAsHit(req)) hits.push(`UPGRADE ${req.url}`);
    socket.destroy();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const close = async () => {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  };
  return {url: `http://127.0.0.1:${server.address().port}/`, hits, close};
}
