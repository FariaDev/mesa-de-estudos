/* Faz o papel do Electron do Playwright: grupo de processo próprio e surdo ao
   SIGTERM (como o app preso no fechamento). Só sai por SIGKILL. */
process.on('SIGTERM',()=>{});
process.stdout.write('pronto\n');
setInterval(()=>{},1e6);
