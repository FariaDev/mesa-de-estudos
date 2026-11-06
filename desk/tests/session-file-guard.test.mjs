import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileSubresourceBlocked, isPathUnderRoot, staticAppEntries, fileGuardOptions} from '../file-guard.cjs';
import {fileSubresourceBlocked as runtimeReexport} from '../activity-runtime.cjs';

const APP = '/app/desk';
const opt = (over = {}) => ({appRoot: APP, ...over});

test('file: estático passa; fora do app cancela', () => {
  assert.equal(fileSubresourceBlocked(opt({url: 'file:///app/desk/src/x.mjs', resourceType: 'image'})).cancel, false);
  assert.equal(fileSubresourceBlocked(opt({url: 'file:///app/desk/renderer.mjs', resourceType: 'script'})).cancel, false);
  assert.equal(fileSubresourceBlocked(opt({url: 'file:///app/desk/index.html', resourceType: 'image'})).cancel, false);
  assert.equal(fileSubresourceBlocked(opt({url: 'file:///tmp/x.png', resourceType: 'image'})).cancel, true);
  assert.equal(fileSubresourceBlocked(opt({url: 'https://exemplo.com/x.png', resourceType: 'image'})).cancel, false);
});

test('raiz do app sem estático cancela: negar por padrão', () => {
  const denied = fileSubresourceBlocked(opt({url: 'file:///app/desk/qualquer.cjs', resourceType: 'script'}));
  assert.equal(denied.cancel, true);
  assert.equal(denied.reason, 'fora-dos-estaticos');
  const outside = fileSubresourceBlocked(opt({url: 'file:///outro/x.png', resourceType: 'image'}));
  assert.equal(outside.cancel, true);
  assert.equal(outside.reason, 'fora-do-app');
});

test('runtime da instância nega mesmo sob a raiz do app', () => {
  const under = fileSubresourceBlocked(opt({url: 'file:///app/desk/.runtime/shot.png', resourceType: 'image', runtimeRoot: '/app/desk/.runtime'}));
  assert.equal(under.cancel, true);
  assert.equal(under.reason, 'runtime');
  const custom = fileSubresourceBlocked(opt({url: 'file:///dados/mesa/desk.json', resourceType: 'fetch', runtimeRoot: '/dados/mesa'}));
  assert.equal(custom.cancel, true);
  assert.equal(custom.reason, 'runtime');
});

test('dado do aluno fora do runtime também nega', () => {
  const pdf = fileSubresourceBlocked(opt({url: 'file:///cursos/calculo/aula.pdf', resourceType: 'object', dataRoots: ['/cursos/calculo']}));
  assert.equal(pdf.cancel, true);
  assert.equal(pdf.reason, 'dados');
});

test('esquema sem caixa cancela igual na função pura', () => {
  for (const scheme of ['FILE:', 'File:', 'fIlE:']) {
    const blocked = fileSubresourceBlocked(opt({url: `${scheme}///etc/passwd`, resourceType: 'image'}));
    assert.equal(blocked.cancel, true, `${scheme} passou`);
  }
});

test('symlink resolvido quando existe: elo dentro, alvo fora, nega', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-fileguard-'));
  const link = path.join(dir, 'liga');
  fs.symlinkSync('/etc', link);
  try {
    const blocked = fileSubresourceBlocked({url: `file://${link}/passwd`, resourceType: 'image', appRoot: dir});
    assert.equal(blocked.cancel, true, 'symlink para fora passou');
  } finally {
    fs.unlinkSync(link);
    fs.rmdirSync(dir);
  }
});

test('sem prefixo solto: /app-evil não é /app', () => {
  assert.equal(isPathUnderRoot('/app-evil/x.png', '/app'), false);
  assert.equal(isPathUnderRoot('/app/x.png', '/app'), true);
  assert.equal(isPathUnderRoot('/app', '/app'), true);
});

test('asar do empacotado: estático passa, o resto cancela', () => {
  const appRoot = '/a/app.asar/desk';
  assert.equal(fileSubresourceBlocked({url: 'file:///a/app.asar/desk/src/x.mjs', resourceType: 'script', appRoot}).cancel, false);
  assert.equal(fileSubresourceBlocked({url: 'file:///a/app.asar/desk/renderer.mjs', resourceType: 'script', appRoot}).cancel, false);
  assert.equal(fileSubresourceBlocked({url: 'file:///a/app.asar/desk/evil/x.png', resourceType: 'image', appRoot}).cancel, true);
  assert.equal(fileSubresourceBlocked({url: 'file:///a/outro/x.png', resourceType: 'image', appRoot}).cancel, true);
  assert.equal(fileSubresourceBlocked({url: 'file:///a/app.asar.unpacked/modulo/index.js', resourceType: 'script', appRoot}).cancel, true);
});

test('macOS: arquivo fora da raiz cancela', () => {
  const appRoot = '/Applications/Mesa.app/Contents/Resources/app.asar/desk';
  assert.equal(fileSubresourceBlocked({url: 'file:///Users/aluno/segredo.png', resourceType: 'image', appRoot}).cancel, true);
  assert.equal(fileSubresourceBlocked({url: 'file:///Applications/Mesa.app/Contents/Resources/app.asar/desk/src/x.mjs', resourceType: 'script', appRoot}).cancel, false);
});

test('Windows: compara sem caixa e com barra invertida', () => {
  assert.equal(isPathUnderRoot('C:\\App\\desk\\x.png', 'c:\\app\\desk'), true);
  assert.equal(isPathUnderRoot('C:\\App-evil\\x.png', 'C:\\App'), false);
  assert.equal(fileSubresourceBlocked({url: 'file:///C:/tmp/x.png', resourceType: 'image', appRoot: 'C:\\App\\desk'}).cancel, true);
  assert.equal(fileSubresourceBlocked({url: 'file:///C:/App/desk/src/x.mjs', resourceType: 'script', appRoot: 'C:\\App\\desk'}).cancel, false);
});

test('documento principal segue; sem raiz falha fechada', () => {
  assert.equal(fileSubresourceBlocked({url: 'file:///tmp/x.png', resourceType: 'mainFrame', appRoot: '/app'}).cancel, false);
  assert.equal(fileSubresourceBlocked({url: 'file:///tmp/x.png', resourceType: 'image', appRoot: null}).cancel, true);
});

test('estáticos do app: pastas e soltos da raiz', () => {
  const entries = staticAppEntries('/app/desk');
  assert.deepEqual(entries.dirs, ['/app/desk/src', '/app/desk/assets', '/app/desk/node_modules']);
  assert.ok(entries.files.includes('/app/desk/index.html'));
  assert.ok(entries.files.includes('/app/desk/preload.cjs'));
});

test('runtime reexporta a guarda; a fábrica lê o vivo', () => {
  assert.equal(runtimeReexport, fileSubresourceBlocked);
  const options = fileGuardOptions({appRoot: '/app/desk', runtimeRoot: '/tmp/rt', live: {config: {vaultPath: '/cofre'}, courses: [{path: '/cursos/a'}, {path: ''}]}});
  assert.equal(options.appRoot, '/app/desk');
  assert.equal(options.runtimeRoot, '/tmp/rt');
  assert.deepEqual(options.dataRoots(), ['/cofre', '/cursos/a']);
  const decided = fileSubresourceBlocked({url: 'file:///cursos/a/aula.pdf', resourceType: 'object', ...options});
  assert.equal(decided.cancel, true);
  assert.equal(decided.reason, 'dados');
});
