/* Executáveis das Configurações (#83): o `save-config` não aceita caminho de
   Claude Code, Xournal++ ou OpenCode (#102) vindo do renderer; só o que o
   diálogo do main entregou. A janela real (o `save-config` de verdade) está em
   `settings-executables-ui.mjs`; aqui, a regra com o diálogo falso. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {registerExecutableHost} from '../executable-host.cjs';
import {fakeDialog, fakeIpcMain} from './fake-electron-shell.mjs';

const saved = {claudePath: '/opt/claude', xournalPath: '/Applications/Xournal++.app', opencodePath: '/opt/bun/bin/opencode'};

/** Host com o diálogo falso e o `message` do i18n, como o main monta. */
async function hostWith(answer) {
  const ipcMain = fakeIpcMain();
  const dialog = fakeDialog();
  dialog.answer = answer;
  const log = [];
  const executables = registerExecutableHost({
    ipcMain, dialog, win: () => null,
    message: (key, args = {}) => `${key}${Object.values(args).join('')}`,
    t: (key) => `t:${key}`,
    log: (area, line) => log.push([area, line]),
  });
  return {ipcMain, dialog, executables, log};
}

test('regressão: save-config com caminho arbitrário não altera nenhum dos executáveis (#83, #102)', async () => {
  const {executables, log} = await hostWith({canceled: true, filePaths: []});
  const kept = executables.keepSaved({
    ...saved,
    claudePath: '/tmp/claude-arbitrario',
    xournalPath: '/tmp/evil.sh',
    opencodePath: '/tmp/opencode-arbitrario',
  }, saved);
  assert.equal(kept.claudePath, saved.claudePath, 'o Claude Code continua o salvo');
  assert.equal(kept.xournalPath, saved.xournalPath, 'o Xournal++ continua o salvo');
  assert.equal(kept.opencodePath, saved.opencodePath, 'o OpenCode continua o salvo');
  assert.equal(log.length, 3, 'cada recusa fica no log');
  assert.ok(log.every(([area]) => area === 'config'));
  assert.ok(log.every(([, line]) => !line.includes('/tmp/')), 'o log não repete o caminho');
});

test('o diálogo do main entrega o caminho escolhido e o salvar aceita esse', async () => {
  const {ipcMain, dialog, executables} = await hostWith({canceled: false, filePaths: ['/opt/xournal/xournalpp']});
  assert.equal(await ipcMain.invoke('pick-executable', 'xournal'), '/opt/xournal/xournalpp');
  assert.equal(dialog.calls[0].options.title, 't:settings.pickExecutable.xournal', 'título traduzido do diálogo');
  assert.deepEqual(dialog.calls[0].options.properties, ['openFile']);
  assert.equal(executables.keepSaved({...saved, xournalPath: '/opt/xournal/xournalpp'}, saved).xournalPath, '/opt/xournal/xournalpp');
});

test('o diálogo do OpenCode usa o título próprio e o salvar aceita esse caminho (#102)', async () => {
  const {ipcMain, dialog, executables} = await hostWith({canceled: false, filePaths: ['/opt/bun/bin/opencode']});
  assert.equal(await ipcMain.invoke('pick-executable', 'opencode'), '/opt/bun/bin/opencode');
  assert.equal(dialog.calls[0].options.title, 't:settings.pickExecutable.opencode', 'título traduzido do diálogo');
  assert.equal(executables.keepSaved({...saved, opencodePath: '/opt/bun/bin/opencode'}, saved).opencodePath, '/opt/bun/bin/opencode');
});

test('cancelar o diálogo devolve null e não muda nada', async () => {
  const {ipcMain, executables} = await hostWith({canceled: true, filePaths: []});
  assert.equal(await ipcMain.invoke('pick-executable', 'claude'), null);
  assert.equal(executables.keepSaved({...saved, claudePath: '/tmp/outro'}, saved).claudePath, saved.claudePath);
});

test('um caminho entregue para um campo não vale para outro', async () => {
  const {ipcMain, executables} = await hostWith({canceled: false, filePaths: ['/opt/claude-novo']});
  await ipcMain.invoke('pick-executable', 'claude');
  const kept = executables.keepSaved({...saved, xournalPath: '/opt/claude-novo'}, saved);
  assert.equal(kept.xournalPath, saved.xournalPath, 'o Claude escolhido não entra no campo do Xournal++');
  assert.equal(executables.keepSaved({...saved, claudePath: '/opt/claude-novo'}, saved).claudePath, '/opt/claude-novo');
});

test('vazio volta ao automático, e o renderer pode mandá-lo sem diálogo', async () => {
  const {executables} = await hostWith({canceled: true, filePaths: []});
  assert.equal(executables.keepSaved({...saved, xournalPath: ''}, saved).xournalPath, '');
});

test('tipo de executável desconhecido recusa e diz o que recebeu', async () => {
  const {ipcMain} = await hostWith({canceled: true, filePaths: []});
  await assert.rejects(ipcMain.invoke('pick-executable', 'constructor'), /err\.executable\.kind.*constructor/);
  await assert.rejects(ipcMain.invoke('pick-executable', '__proto__'), /__proto__/);
});

test('campos que o renderer não mandou seguem como vieram (só os três de executável são trocados)', async () => {
  const {executables} = await hostWith({canceled: true, filePaths: []});
  const kept = executables.keepSaved({vaultPath: '/cofre', courses: [], claudePath: '/tmp/x'}, saved);
  assert.equal(kept.vaultPath, '/cofre');
  assert.deepEqual(kept.courses, []);
  assert.equal(kept.claudePath, saved.claudePath);
});
