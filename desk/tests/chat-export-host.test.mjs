// Exportação da conversa ativa (#43 fase 2: saiu do main.cjs). Só o caminho Pi
// no runtime de teste, que grava sem abrir diálogo.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fakeIpcMain} from './fake-electron-shell.mjs';

const require = createRequire(import.meta.url);
const {registerChatExportHost} = require('../chat-export-host.cjs');

const dirs = [];
after(() => { for (const dir of dirs) fs.rmSync(dir, {recursive: true, force: true}); });

test('export-chat grava o Markdown da sessão Pi em runtime/exported', async () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-export-'));
  dirs.push(runtime);
  const session = path.join(runtime, 's.jsonl');
  fs.writeFileSync(session, [
    {message: {role: 'user', content: [{type: 'text', text: 'Quanto é o limite?'}, {type: 'image'}]}},
    {message: {role: 'assistant', content: [{type: 'text', text: 'Vale 1.'}]}},
    {message: {role: 'toolResult', content: [{type: 'text', text: 'oculto'}]}},
  ].map(line => JSON.stringify(line)).join('\n') + '\nnão é json\n');
  const ipcMain = fakeIpcMain();
  const labels = {'export.you': 'Você', 'export.imageAttached': '[imagem]', 'export.exportedOn': 'em {date}'};
  const live = {config: {}, courses: [{id: 'calc', name: 'Cálculo/1'}], courseId: 'calc', session, bridge: null, win: null,
    languageHost: {t: (key, args) => (labels[key] || key).replace('{date}', args?.date || '')}};
  registerChatExportHost({ipcMain, live, runtime, envRuntime: runtime, dialog: null, shell: null, appendLog: () => {}, engine: () => 'pi', testClaudeSdkLoader: () => null});
  const result = await ipcMain.invoke('export-chat');
  assert.equal(result.saved, true);
  assert.equal(path.dirname(result.file), path.join(runtime, 'exported'));
  assert.match(path.basename(result.file), /^Mesa — Cálculo-1 — /);
  const body = fs.readFileSync(result.file, 'utf8');
  assert.match(body, /^# Mesa de Estudos — Cálculo\/1/);
  assert.match(body, /## Você\n\nQuanto é o limite\?\n\[imagem\]/);
  assert.match(body, /## Pi\n\nVale 1\./);
  assert.doesNotMatch(body, /oculto/);
});
