import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

/* A captura do Windows (PowerShell + .NET do sistema) sem Windows: o script é
   puro (conferido por texto/escapamento) e o runner aceita `exec`/`tmp`
   falsos. O contrato testado: achar o xournalpp, capturar a janela, devolver
   {title, dataUrl}, virar erro amigável quando o Windows não coopera e nunca
   deixar lixo no temporário. */
const require = createRequire(import.meta.url);
const {buildScript, captureXournalWindow, EXIT_MESSAGES} = require('../capture-win.cjs');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-capture-win-test-'));
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 7)]);

test('buildScript: acha o xournalpp, captura a janela e escapa o caminho', () => {
  const script = buildScript("C:\\Users\\Ana O'Brien\\cap.png");
  assert.match(script, /Get-Process -Name 'xournalpp'/);
  assert.match(script, /CopyFromScreen/);
  assert.match(script, /PrintWindow/);
  assert.match(script, /Ana O''Brien/, 'aspas simples do caminho são duplicadas (literal PowerShell)');
  assert.match(script, /SetProcessDPIAware/, 'o retângulo tem de bater com os pixels físicos');
});

test('captureXournalWindow: devolve o título e o PNG como data URL', async () => {
  const dir = tmp();
  const outFile = path.join(dir, 'attempt.png');
  let chamada = null;
  const exec = async (cmd, args) => { chamada = {cmd, args}; fs.writeFileSync(outFile, PNG); return {stdout: 'Minha resolução'}; };
  const r = await captureXournalWindow({exec, tmp: () => dir});
  assert.equal(chamada.cmd, 'powershell.exe');
  assert.deepEqual(chamada.args.slice(0, 4), ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass']);
  assert.equal(r.title, 'Minha resolução');
  assert.match(r.dataUrl, /^data:image\/png;base64,/);
});

test('captureXournalWindow: erros do script viram mensagens que o usuário resolve', async () => {
  /* `tmp` como fábrica: cada captura tem o seu diretório (o finally limpa). */
  const semProcesso = async () => { const e = Error('exit 3'); e.code = 3; throw e; };
  await assert.rejects(() => captureXournalWindow({exec: semProcesso, tmp}), /Abra o Xournal\+\+ primeiro/);
  assert.equal(EXIT_MESSAGES[3].includes('Abra o Xournal++'), true);
  const minimizada = async () => { const e = Error('exit 4'); e.code = 4; throw e; };
  await assert.rejects(() => captureXournalWindow({exec: minimizada, tmp}), /minimizada/);
  const outro = async () => { const e = Error('powershell sumiu'); throw e; };
  await assert.rejects(() => captureXournalWindow({exec: outro, tmp}), /A captura do Xournal\+\+ falhou/);
});

test('captureXournalWindow: PNG ruim é erro, não anexo — e o temporário sai', async () => {
  const dir = tmp();
  const outFile = path.join(dir, 'attempt.png');
  const exec = async () => { fs.writeFileSync(outFile, 'não é png'); return {stdout: ''}; };
  await assert.rejects(() => captureXournalWindow({exec, tmp: () => dir}), /não produziu uma imagem PNG válida/);
  const dir2 = tmp();
  const semArquivo = async () => ({stdout: ''});
  await assert.rejects(() => captureXournalWindow({exec: semArquivo, tmp: () => dir2}), /não produziu uma imagem PNG válida/);
  assert.equal(fs.existsSync(dir), false, 'o temporário é limpo em qualquer saída');
  assert.equal(fs.existsSync(dir2), false, 'o temporário é limpo em qualquer saída');
});
