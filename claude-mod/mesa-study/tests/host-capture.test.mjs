/* Testes da operação `capture` com executor FALSO (nenhuma captura real,
   nenhum helper/screencapture executado). Cobrem seleção exclusiva, recusas,
   revalidação antes/depois, PNG privado e prévia SVG limitada. */

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {captureOperation, selectXournalWindow, svgPreviewForPng, pngSize, isValidWindowId, sameWindowIdentity, defaultHelperPath} from '../host/capture.mjs';
import {makeFakePng} from '../host/testing.mjs';
import {OUTPUT_MARKER, OUTPUT_PREFIX, SVG_CHAR_LIMIT, CAPTURE_WINDOW_ID_MAX, CAPTURE_HELPER_RELATIVE} from '../host/config.mjs';

const HOST_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'host');
const HELPER = path.join(HOST_DIR, 'capture.mjs'); // caminho existente qualquer; o run é falso
const SCREENSHOT = '/usr/sbin/screencapture';

const xournal = (id, title = 'Resolução') => ({id, app: 'Xournal++', title, bounds: {Width: 1200, Height: 900}});
const ghostty = {id: 1, app: 'Ghostty', bounds: {Width: 800, Height: 600}};

function makeCaptureRun({windowsSeq, png = makeFakePng(), listOutcome = null, captureOutcome = null, calls = []}) {
  let listIndex = 0;
  return async (argv, options) => {
    calls.push({argv, options});
    if (argv[0] === HELPER) {
      if (listOutcome) return listOutcome(listIndex++);
      const windows = windowsSeq[Math.min(listIndex, windowsSeq.length - 1)];
      listIndex += 1;
      return {
        ok: true, code: 0, stderr: '', timedOut: false, missing: false,
        stdout: JSON.stringify({permission: true, windows}),
      };
    }
    if (argv[0] === SCREENSHOT) {
      if (captureOutcome) return captureOutcome();
      await fs.writeFile(argv[argv.length - 1], png);
      return {ok: true, code: 0, stdout: '', stderr: '', timedOut: false, missing: false};
    }
    return {ok: false, code: 1, stdout: '', stderr: 'ferramenta desconhecida', timedOut: false, missing: false};
  };
}

async function ownDirs(cache) {
  const entries = await fs.readdir(cache);
  return entries.filter((name) => name.startsWith(OUTPUT_PREFIX));
}

async function setup() {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'mesa-host-capture-'));
  const cache = path.join(base, 'cache');
  await fs.mkdir(cache);
  return {base, cache};
}

test('capture: caminho feliz captura só a janela escolhida e devolve PNG 0600', async () => {
  const {base, cache} = await setup();
  try {
    const calls = [];
    const run = makeCaptureRun({windowsSeq: [[xournal(9)], [xournal(9)], [xournal(9)]], calls});
    const result = await captureOperation({op: 'capture', cacheDir: cache}, {run, helperPath: HELPER});

    assert.equal(result.ok, true);
    assert.equal(result.kind, 'capture');
    assert.equal(result.mimeType, 'image/png');
    assert.deepEqual(result.window, {id: '9', app: 'Xournal++', title: 'Resolução'});
    assert.equal(typeof result.window.id, 'string');
    assert.ok(!Number.isNaN(Date.parse(result.capturedAt)));
    assert.equal((await fs.stat(result.snapshotPath)).mode & 0o777, 0o600);
    assert.equal((await fs.stat(path.dirname(result.snapshotPath))).mode & 0o777, 0o700);
    assert.ok(await fs.stat(path.join(path.dirname(result.snapshotPath), OUTPUT_MARKER)));
    assert.ok(typeof result.svg === 'string' && result.svg.length <= SVG_CHAR_LIMIT);

    const helperCalls = calls.filter((call) => call.argv[0] === HELPER);
    const shots = calls.filter((call) => call.argv[0] === SCREENSHOT);
    assert.equal(helperCalls.length, 3); // seleção + antes + depois
    assert.equal(shots.length, 1);
    for (const call of helperCalls) assert.equal(call.argv.length, 1); // helper sem argumentos
    assert.deepEqual(shots[0].argv, [SCREENSHOT, '-x', '-o', '-l9', result.snapshotPath]);
    for (const call of calls) {
      assert.ok(Array.isArray(call.argv));
      assert.ok(call.argv.every((arg) => typeof arg === 'string'));
      assert.ok(call.options.timeoutMs > 0);
      assert.ok(!('shell' in call.options));
    }
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('capture: ID explícito escolhe a janela certa entre várias', async () => {
  const {base, cache} = await setup();
  try {
    const calls = [];
    const run = makeCaptureRun({windowsSeq: [[xournal(5), xournal(7)], [xournal(5), xournal(7)], [xournal(5), xournal(7)]], calls});
    const result = await captureOperation({op: 'capture', cacheDir: cache, windowId: 7}, {run, helperPath: HELPER});
    assert.equal(result.window.id, '7');
    const shot = calls.find((call) => call.argv[0] === SCREENSHOT);
    assert.ok(shot.argv.includes('-l7'));
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('capture: janela sem título vira "Xournal++" e id sai como string', async () => {
  const {base, cache} = await setup();
  try {
    const blank = {id: 12, app: 'Xournal++', title: '', bounds: {Width: 900, Height: 700}};
    const run = makeCaptureRun({windowsSeq: [[blank], [blank], [blank]]});
    const result = await captureOperation({op: 'capture', cacheDir: cache}, {run, helperPath: HELPER});
    assert.deepEqual(result.window, {id: '12', app: 'Xournal++', title: 'Xournal++'});
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('capture: ausente, ambígua e ID inválido recusam sem capturar', async () => {
  const {base, cache} = await setup();
  try {
    const absent = [];
    await assert.rejects(
      captureOperation({op: 'capture', cacheDir: cache}, {run: makeCaptureRun({windowsSeq: [[ghostty]], calls: absent}), helperPath: HELPER}),
      (error) => error.code === 'CAPTURE_WINDOW_ABSENT',
    );
    assert.equal(absent.some((call) => call.argv[0] === SCREENSHOT), false);

    const ambiguous = [];
    await assert.rejects(
      captureOperation({op: 'capture', cacheDir: cache}, {run: makeCaptureRun({windowsSeq: [[xournal(1), xournal(2)]], calls: ambiguous}), helperPath: HELPER}),
      (error) => error.code === 'CAPTURE_WINDOW_AMBIGUOUS',
    );
    assert.equal(ambiguous.some((call) => call.argv[0] === SCREENSHOT), false);

    for (const badId of [999, 0, -3, 1.5, '9', NaN, Infinity, -Infinity, 4294967296, true, {}]) {
      await assert.rejects(
        captureOperation({op: 'capture', cacheDir: cache, windowId: badId}, {run: makeCaptureRun({windowsSeq: [[xournal(9)]]}), helperPath: HELPER}),
        (error) => error.code === 'CAPTURE_WINDOW_INVALID',
      );
    }
    assert.equal((await ownDirs(cache)).length, 0);
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('capture: ID ruim na listagem vira CAPTURE_WINDOW_INVALID e nunca captura', async () => {
  const {base, cache} = await setup();
  try {
    const badIds = [0, -1, NaN, '9', null, Infinity, 4294967296, 1.5];
    for (const id of badIds) {
      const calls = [];
      const bad = {id, app: 'Xournal++', title: 'Resolução', bounds: {Width: 1200, Height: 900}};
      await assert.rejects(
        captureOperation({op: 'capture', cacheDir: cache}, {run: makeCaptureRun({windowsSeq: [[bad]], calls}), helperPath: HELPER}),
        (error) => error.code === 'CAPTURE_WINDOW_INVALID',
        `ID ${String(id)} precisa ser recusado`,
      );
      assert.equal(calls.some((call) => call.argv[0] === SCREENSHOT), false);
    }

    // Mesmo com um ID explícito válido, uma janela ruim na mesma listagem recusa tudo.
    const mixed = [];
    const badSibling = {id: 0, app: 'Xournal++', title: 'outra', bounds: {Width: 900, Height: 700}};
    await assert.rejects(
      captureOperation({op: 'capture', cacheDir: cache, windowId: 9}, {run: makeCaptureRun({windowsSeq: [[xournal(9), badSibling]], calls: mixed}), helperPath: HELPER}),
      (error) => error.code === 'CAPTURE_WINDOW_INVALID',
    );
    assert.equal(mixed.some((call) => call.argv[0] === SCREENSHOT), false);
    assert.equal((await ownDirs(cache)).length, 0);
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('capture: ID ruim na revalidação (antes/depois) também recusa', async () => {
  const {base, cache} = await setup();
  try {
    const badIds = [0, -1, NaN, '9', null, Infinity, 4294967296, 1.5];
    let screenshots = 0;
    for (const id of badIds) {
      const bad = {id, app: 'Xournal++', title: 'Resolução', bounds: {Width: 1200, Height: 900}};

      const beforeCalls = [];
      await assert.rejects(
        captureOperation({op: 'capture', cacheDir: cache}, {run: makeCaptureRun({windowsSeq: [[xournal(9)], [bad]], calls: beforeCalls}), helperPath: HELPER}),
        (error) => error.code === 'CAPTURE_WINDOW_INVALID',
        `ID ${String(id)} precisa ser recusado na revalidação antes`,
      );
      assert.equal(beforeCalls.some((call) => call.argv[0] === SCREENSHOT), false);

      const afterCalls = [];
      await assert.rejects(
        captureOperation({op: 'capture', cacheDir: cache}, {run: makeCaptureRun({windowsSeq: [[xournal(9)], [xournal(9)], [bad]], calls: afterCalls}), helperPath: HELPER}),
        (error) => error.code === 'CAPTURE_WINDOW_INVALID',
        `ID ${String(id)} precisa ser recusado na revalidação depois`,
      );
      screenshots += afterCalls.filter((call) => call.argv[0] === SCREENSHOT).length;
    }
    assert.equal(screenshots, badIds.length); // 1 captura descartada por ID ruim no pós
    assert.equal((await ownDirs(cache)).length, 0); // PNG descartado com a pasta própria
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('capture: identidade com ownerPID (quando exposto) detecta reuso de ID', async () => {
  const {base, cache} = await setup();
  try {
    const withPid = (id, ownerPID) => ({id, app: 'Xournal++', title: 'Resolução', bounds: {Width: 1200, Height: 900}, ownerPID});

    // Mesmo id + mesmo ownerPID nas três listagens: captura normalmente.
    const okCalls = [];
    const ok = await captureOperation({op: 'capture', cacheDir: cache}, {
      run: makeCaptureRun({windowsSeq: [[withPid(9, 100)], [withPid(9, 100)], [withPid(9, 100)]], calls: okCalls}),
      helperPath: HELPER,
    });
    assert.equal(ok.ok, true);
    assert.equal(okCalls.filter((call) => call.argv[0] === SCREENSHOT).length, 1);

    // Mesmo id, pid trocado antes da captura: recusa sem capturar.
    const beforeCalls = [];
    await assert.rejects(
      captureOperation({op: 'capture', cacheDir: cache}, {
        run: makeCaptureRun({windowsSeq: [[withPid(9, 100)], [withPid(9, 200)]], calls: beforeCalls}),
        helperPath: HELPER,
      }),
      (error) => error.code === 'CAPTURE_WINDOW_CHANGED',
    );
    assert.equal(beforeCalls.some((call) => call.argv[0] === SCREENSHOT), false);

    // Mesmo id, pid trocado depois: captura descartada (o ID foi reusado).
    const dirsBefore = (await ownDirs(cache)).length; // pasta do sucesso anterior
    const afterCalls = [];
    await assert.rejects(
      captureOperation({op: 'capture', cacheDir: cache}, {
        run: makeCaptureRun({windowsSeq: [[withPid(9, 100)], [withPid(9, 100)], [withPid(9, 300)]], calls: afterCalls}),
        helperPath: HELPER,
      }),
      (error) => error.code === 'CAPTURE_WINDOW_CHANGED',
    );
    assert.equal(afterCalls.filter((call) => call.argv[0] === SCREENSHOT).length, 1);
    assert.equal((await ownDirs(cache)).length, dirsBefore);
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('isValidWindowId/sameWindowIdentity: faixa UInt32 e identidade sem campo obrigatório', () => {
  for (const good of [1, 2, 9, CAPTURE_WINDOW_ID_MAX]) assert.equal(isValidWindowId(good), true);
  for (const bad of [0, -1, -Infinity, 1.5, NaN, Infinity, CAPTURE_WINDOW_ID_MAX + 1, '9', null, undefined, {}, []]) {
    assert.equal(isValidWindowId(bad), false, `${String(bad)} precisa ser inválido`);
  }

  assert.equal(sameWindowIdentity(xournal(9), xournal(9)), true);
  assert.equal(sameWindowIdentity(xournal(9), {...xournal(9), app: 'XOURNAL++'}), true);
  assert.equal(sameWindowIdentity(xournal(9), xournal(10)), false);
  // ownerPID é opcional: em um lado só, compara o que o helper expõe.
  assert.equal(sameWindowIdentity({...xournal(9), ownerPID: 100}, xournal(9)), true);
  assert.equal(sameWindowIdentity({...xournal(9), ownerPID: 100}, {...xournal(9), ownerPID: 100}), true);
  assert.equal(sameWindowIdentity({...xournal(9), ownerPID: 100}, {...xournal(9), ownerPID: 200}), false);
  assert.equal(sameWindowIdentity(null, xournal(9)), false);
});

test('capture: revalidação antes recusa janela trocada e não captura', async () => {
  const {base, cache} = await setup();
  try {
    const calls = [];
    const run = makeCaptureRun({windowsSeq: [[xournal(9)], [xournal(22)]], calls});
    await assert.rejects(
      captureOperation({op: 'capture', cacheDir: cache}, {run, helperPath: HELPER}),
      (error) => error.code === 'CAPTURE_WINDOW_CHANGED',
    );
    assert.equal(calls.some((call) => call.argv[0] === SCREENSHOT), false);
    assert.equal((await ownDirs(cache)).length, 0);
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('capture: revalidação depois descarta a captura se a janela sumiu', async () => {
  const {base, cache} = await setup();
  try {
    const calls = [];
    const run = makeCaptureRun({windowsSeq: [[xournal(9)], [xournal(9)], []], calls});
    await assert.rejects(
      captureOperation({op: 'capture', cacheDir: cache}, {run, helperPath: HELPER}),
      (error) => error.code === 'CAPTURE_WINDOW_CHANGED',
    );
    assert.equal(calls.filter((call) => call.argv[0] === SCREENSHOT).length, 1);
    assert.equal((await ownDirs(cache)).length, 0); // PNG descartado com a pasta própria
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('capture: helper ausente tem erro acionável (build explícito) e não captura', async () => {
  const {base, cache} = await setup();
  try {
    const calls = [];
    const run = makeCaptureRun({windowsSeq: [[]], listOutcome: () => ({ok: false, missing: true, code: 'ENOENT', stdout: '', stderr: ''}), calls});
    await assert.rejects(
      captureOperation({op: 'capture', cacheDir: cache}, {run, helperPath: HELPER}),
      (error) => {
        assert.equal(error.code, 'CAPTURE_HELPER_MISSING');
        assert.match(error.message, /build-helper/);
        assert.match(error.message, /node scripts\/build-helper\.mjs/);
        assert.equal(error.detail.helperPath, HELPER);
        assert.equal(error.detail.buildCommand, 'node scripts/build-helper.mjs');
        return true;
      },
    );
    assert.equal(calls.some((call) => call.argv[0] === SCREENSHOT), false);
    assert.equal((await ownDirs(cache)).length, 0);
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('capture: permissão, helper e screencapture falham com códigos específicos', async () => {
  const {base, cache} = await setup();
  try {
    const denied = makeCaptureRun({
      windowsSeq: [[]],
      listOutcome: () => ({ok: true, code: 0, stdout: JSON.stringify({permission: false, windows: []}), stderr: '', timedOut: false, missing: false}),
    });
    await assert.rejects(
      captureOperation({op: 'capture', cacheDir: cache}, {run: denied, helperPath: HELPER}),
      (error) => error.code === 'CAPTURE_PERMISSION',
    );

    await assert.rejects(
      captureOperation({op: 'capture', cacheDir: cache}, {run: makeCaptureRun({windowsSeq: [[]], listOutcome: () => ({ok: false, timedOut: true, code: null, stdout: '', stderr: ''})}), helperPath: HELPER}),
      (error) => error.code === 'CAPTURE_HELPER_TIMEOUT',
    );
    await assert.rejects(
      captureOperation({op: 'capture', cacheDir: cache}, {run: makeCaptureRun({windowsSeq: [[]], listOutcome: () => ({ok: false, missing: true, code: 'ENOENT', stdout: '', stderr: ''})}), helperPath: HELPER}),
      (error) => error.code === 'CAPTURE_HELPER_MISSING' && /build-helper/.test(error.message),
    );
    await assert.rejects(
      captureOperation({op: 'capture', cacheDir: cache}, {run: makeCaptureRun({windowsSeq: [[]], listOutcome: () => ({ok: true, code: 0, stdout: 'não é json', stderr: '', timedOut: false, missing: false})}), helperPath: HELPER}),
      (error) => {
        assert.equal(error.code, 'CAPTURE_HELPER_FAILED');
        assert.equal(error.detail.helperPath, HELPER);
        assert.equal(error.detail.buildCommand, 'node scripts/build-helper.mjs');
        assert.match(error.message, /build-helper/);
        return true;
      },
    );

    // Helper existente mas não executável ou de arquitetura errada: código estável + dica.
    await assert.rejects(
      captureOperation({op: 'capture', cacheDir: cache}, {run: makeCaptureRun({windowsSeq: [[]], listOutcome: () => ({ok: false, code: 'EACCES', missing: false, timedOut: false, stdout: '', stderr: 'Permission denied'})}), helperPath: HELPER}),
      (error) => {
        assert.equal(error.code, 'CAPTURE_HELPER_FAILED');
        assert.equal(error.detail.helperPath, HELPER);
        assert.equal(error.detail.buildCommand, 'node scripts/build-helper.mjs');
        assert.equal(error.detail.exitCode, 'EACCES');
        assert.match(error.message, /arquitetura|permiss/);
        assert.match(error.message, /build-helper/);
        return true;
      },
    );

    // Runner que lança ao chamar o helper (spawn quebrado) também ganha a dica.
    await assert.rejects(
      captureOperation({op: 'capture', cacheDir: cache}, {run: async () => { throw new Error('spawn quebrado'); }, helperPath: HELPER}),
      (error) => {
        assert.equal(error.code, 'CAPTURE_HELPER_FAILED');
        assert.equal(error.detail.helperPath, HELPER);
        assert.equal(error.detail.buildCommand, 'node scripts/build-helper.mjs');
        assert.match(error.message, /build-helper/);
        return true;
      },
    );

    await assert.rejects(
      captureOperation({op: 'capture', cacheDir: cache}, {run: makeCaptureRun({windowsSeq: [[xournal(9)]], captureOutcome: () => ({ok: false, timedOut: true, code: null, stdout: '', stderr: ''})}), helperPath: HELPER}),
      (error) => error.code === 'CAPTURE_TIMEOUT',
    );
    await assert.rejects(
      captureOperation({op: 'capture', cacheDir: cache}, {run: makeCaptureRun({windowsSeq: [[xournal(9)]], png: Buffer.alloc(512, 0x41)}), helperPath: HELPER}),
      (error) => error.code === 'CAPTURE_INVALID',
    );

    const throwShot = async (argv) => {
      if (argv[0] === HELPER) {
        return {ok: true, code: 0, stdout: JSON.stringify({permission: true, windows: [xournal(9)]}), stderr: '', timedOut: false, missing: false};
      }
      throw new Error('spawn quebrado');
    };
    await assert.rejects(
      captureOperation({op: 'capture', cacheDir: cache}, {run: throwShot, helperPath: HELPER}),
      (error) => error.code === 'CAPTURE_FAILED',
    );
    assert.equal((await ownDirs(cache)).length, 0);
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('capture: PNG grande demais fica sem prévia svg, mas o snapshot permanece', async () => {
  const {base, cache} = await setup();
  try {
    const run = makeCaptureRun({windowsSeq: [[xournal(9)]], png: makeFakePng({bytes: 200000})});
    const result = await captureOperation({op: 'capture', cacheDir: cache}, {run, helperPath: HELPER});
    assert.equal(result.ok, true);
    assert.equal(result.svg, undefined);
    assert.ok(await fs.stat(result.snapshotPath));
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('capture: pedido não escolhe helper nem executável de captura', async () => {
  const {base, cache} = await setup();
  try {
    const calls = [];
    const run = makeCaptureRun({windowsSeq: [[xournal(9)]], calls});
    const result = await captureOperation({
      op: 'capture', cacheDir: cache,
      helperPath: '/bin/sh', executable: '/bin/sh', screencapturePath: '/bin/echo', run: '/bin/sh',
    }, {run, helperPath: HELPER});
    assert.equal(result.ok, true);
    assert.equal(calls[0].argv[0], HELPER);
    const shot = calls.find((call) => call.argv[0] === SCREENSHOT);
    assert.ok(shot, 'usa o screencapture fixo, nunca um caminho do pedido');
    assert.ok(shot.argv.every((arg) => !arg.includes('/bin/echo')));
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('capture: nunca tela inteira — screencapture sempre com -lID', async () => {
  const {base, cache} = await setup();
  try {
    const calls = [];
    const run = makeCaptureRun({windowsSeq: [[xournal(31)]], calls});
    await captureOperation({op: 'capture', cacheDir: cache}, {run, helperPath: HELPER});
    const shots = calls.filter((call) => call.argv[0] === SCREENSHOT);
    assert.equal(shots.length, 1);
    const argv = shots[0].argv;
    assert.deepEqual(argv.slice(0, 3), [SCREENSHOT, '-x', '-o']);
    assert.equal(argv.length, 5);
    assert.match(argv[3], /^-l31$/);
    for (const flag of ['-R', '-W', '-w', '-c', '-C']) assert.ok(!argv.includes(flag));
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('selectXournalWindow: exige Xournal++ visível, bounds e ID UInt32 válidos', () => {
  assert.equal(selectXournalWindow([xournal(4)]).id, 4);
  assert.equal(selectXournalWindow([{id: 4, app: 'xournalpp', title: '', bounds: {width: 300, height: 300}}]).id, 4);
  assert.throws(() => selectXournalWindow([{id: 4, app: 'Xournal++', title: '', bounds: {Width: 50, Height: 50}}]), (error) => error.code === 'CAPTURE_WINDOW_ABSENT');
  assert.throws(() => selectXournalWindow([ghostty]), (error) => error.code === 'CAPTURE_WINDOW_ABSENT');
  assert.throws(() => selectXournalWindow([xournal(1), xournal(2)]), (error) => error.code === 'CAPTURE_WINDOW_AMBIGUOUS');
  for (const bad of [xournal(0), xournal(-1), xournal('4'), xournal(4294967296), xournal(Infinity), xournal(null)]) {
    assert.throws(() => selectXournalWindow([bad]), (error) => error.code === 'CAPTURE_WINDOW_INVALID');
  }
  assert.throws(() => selectXournalWindow([xournal(4)], 0), (error) => error.code === 'CAPTURE_WINDOW_INVALID');
  assert.throws(() => selectXournalWindow([xournal(4)], 4294967296), (error) => error.code === 'CAPTURE_WINDOW_INVALID');
});

test('defaultHelperPath: aponta para o helper nativo do próprio plugin', async () => {
  const resolved = defaultHelperPath();
  // Mesmo caminho relativo fixo do build-helper (raiz do plugin), nunca vindo do pedido.
  assert.deepEqual([...CAPTURE_HELPER_RELATIVE], ['..', 'native', 'windows']);
  assert.equal(resolved, path.resolve(HOST_DIR, ...CAPTURE_HELPER_RELATIVE));
  assert.equal(resolved, path.resolve(HOST_DIR, '..', 'native', 'windows'));
  assert.equal(path.isAbsolute(resolved), true);
  assert.equal(path.basename(resolved), 'windows');
  assert.equal(path.basename(path.dirname(resolved)), 'native');
  assert.equal(path.dirname(path.dirname(resolved)), path.resolve(HOST_DIR, '..')); // raiz do plugin
  assert.equal(resolved.includes('visual-check'), false); // não depende mais do checkout externo

  // O helper NUNCA é executado aqui; se o binário existir, só se confere que
  // não é um diretório (quem o roda é a captura real, com permissão própria).
  const stat = await fs.stat(resolved).then((value) => value, () => null);
  if (stat) assert.equal(stat.isDirectory(), false);
});

test('svgPreviewForPng: limita a prévia e lê o IHDR', () => {
  const small = makeFakePng({width: 40, height: 30, bytes: 256});
  assert.deepEqual(pngSize(small), {width: 40, height: 30});
  const svg = svgPreviewForPng(small);
  assert.ok(svg && svg.length <= SVG_CHAR_LIMIT);
  assert.match(svg, /data:image\/png;base64,/);
  assert.match(svg, /viewBox="0 0 40 30"/);
  assert.equal(svgPreviewForPng(makeFakePng({bytes: 200000})), null);
});
