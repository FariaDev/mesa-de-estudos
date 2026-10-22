import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {runTool, plainOutput, OUTPUT_TAIL_BYTES} = require('../tool-run.cjs');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tool-run-'));

function script(dir, body) {
  const file = path.join(dir, 'cmd.js');
  fs.writeFileSync(file, `#!${process.execPath}\n${body}\n`);
  fs.chmodSync(file, 0o755);
  return file;
}

test('runTool: sucesso devolve a saída e entrega pedaços a quem escuta', async () => {
  const file = script(tmp(), "console.log('linha 1');console.error('aviso');console.log('linha 2');");
  const pedacos = [];
  const r = await runTool({file, args: [], onOutput: (t) => pedacos.push(t)});
  assert.equal(r.ok, true);
  assert.equal(r.code, 0);
  assert.match(r.output, /linha 1/);
  assert.match(r.output, /aviso/, 'stderr entra na mesma saída');
  assert.ok(pedacos.length >= 1);
});

test('runTool: saída ≠ 0 não rejeita, vira ok:false com o código', async () => {
  const file = script(tmp(), "console.error('quebrou');process.exit(3);");
  const r = await runTool({file, args: []});
  assert.equal(r.ok, false);
  assert.equal(r.code, 3);
  assert.match(r.output, /quebrou/);
  assert.match(r.error, /código 3/);
});

test('runTool: comando inexistente e prazo viram falha com o motivo', async () => {
  const ausente = await runTool({file: path.join(tmp(), 'nao-existe'), args: []});
  assert.equal(ausente.ok, false);
  assert.match(ausente.error, /não foi possível iniciar/);
  const lento = script(tmp(), 'setTimeout(()=>{},60000);');
  const preso = await runTool({file: lento, args: [], timeoutMs: 150});
  assert.equal(preso.ok, false);
  assert.match(preso.error, /prazo/);
});

test('runTool: stdin fechado (nada fica esperando resposta do teclado)', async () => {
  const file = script(tmp(), "let n=0;process.stdin.on('data',()=>{n++;});process.stdin.on('end',()=>{console.log('stdin fechou');});");
  const r = await runTool({file, args: [], timeoutMs: 5000});
  assert.equal(r.ok, true);
  assert.match(r.output, /stdin fechou/);
});

test('plainOutput: tira cores e converte \\r de barra de progresso em linhas', () => {
  assert.equal(plainOutput('\u001b[32mok\u001b[0m'), 'ok');
  assert.equal(plainOutput('10%\r50%\rfim'), '10%\n50%\nfim');
});

test('runTool: a saída guarda só o rabo (as últimas ~64 KB)', async () => {
  const file = script(tmp(), "process.stdout.write('a'.repeat(200000)+'FIM');");
  const r = await runTool({file, args: []});
  assert.ok(r.output.length <= OUTPUT_TAIL_BYTES + 4);
  assert.ok(r.output.endsWith('FIM'));
  assert.ok(r.output.startsWith('…'));
});
