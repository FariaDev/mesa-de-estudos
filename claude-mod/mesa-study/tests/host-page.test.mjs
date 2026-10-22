/* Testes da operação `page` com executor FALSO (nenhum Poppler real).
   Cobrem contrato, confinamento realpath/symlink, bounds, timeout, segurança
   de saída e erros específicos. O smoke real está em host-poppler.test.mjs. */

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import {pageOperation, parsePdfInfo, previewWarningFor, isPasswordDiagnostic} from '../host/page.mjs';
import {withTempDir, writeValidFakePdf, makeFakePng} from '../host/testing.mjs';
import {resolvePopplerTools, resolvePopplerTool, isExecutableFile} from '../host/tools.mjs';
import {OUTPUT_MARKER, OUTPUT_PREFIX, SVG_CHAR_LIMIT, OUTPUT_HOST_ID} from '../host/config.mjs';

const SVG_OK = '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg"><g/></svg>';
const VALID_TOKEN = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';

function makeFakeRun({numPages = 3, svg = SVG_OK, svgBytes = null, png = null, infoStdout = null, fail = null, calls = []} = {}) {
  return async (argv, options) => {
    calls.push({argv, options});
    if (fail) {
      const outcome = fail(argv, options);
      if (outcome) return outcome;
    }
    const tool = path.basename(argv[0]);
    if (tool === 'pdfinfo') {
      return {
        ok: true, code: 0, stderr: '', timedOut: false, missing: false,
        stdout: infoStdout ?? `Title: fake\nPages:           ${numPages}\nEncrypted:       no\nPage size:       595 x 842 pts\n`,
      };
    }
    if (tool === 'pdftocairo') {
      const output = argv[argv.length - 1];
      if (argv.includes('-svg')) {
        await fs.writeFile(output, svgBytes ?? svg);
      } else {
        await fs.writeFile(`${output}.png`, png ?? makeFakePng());
      }
      return {ok: true, code: 0, stdout: '', stderr: '', timedOut: false, missing: false};
    }
    return {ok: false, code: 1, stdout: '', stderr: 'ferramenta desconhecida', timedOut: false, missing: false};
  };
}

async function setup() {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'mesa-host-page-'));
  const root = path.join(base, 'root');
  const outside = path.join(base, 'outside');
  const cache = path.join(base, 'cache');
  await fs.mkdir(root);
  await fs.mkdir(outside);
  await fs.mkdir(cache);
  const pdf = await writeValidFakePdf(path.join(root, 'doc.pdf'));
  return {base, root, outside, cache, pdf};
}

async function cleanup(base) {
  await fs.rm(base, {recursive: true, force: true});
}

function baseRequest(pdf, root, cache, overrides = {}) {
  return {op: 'page', path: pdf, page: 2, roots: [root], cacheDir: cache, ...overrides};
}

async function ownDirs(cache) {
  const entries = await fs.readdir(cache);
  return entries.filter((name) => name.startsWith(OUTPUT_PREFIX));
}

test('page: caminho feliz devolve SVG + PNG e arquivos 0600 em pasta 0700', async () => {
  const {base, root, cache, pdf} = await setup();
  try {
    const calls = [];
    const result = await pageOperation(baseRequest(pdf, root, cache), {run: makeFakeRun({calls})});

    assert.equal(result.ok, true);
    assert.equal(result.kind, 'page');
    assert.equal(result.page, 2);
    assert.equal(result.numPages, 3);
    assert.equal(result.mimeType, 'image/png');
    assert.equal(result.document.name, 'doc.pdf');
    assert.equal(result.document.path, await fs.realpath(pdf));
    assert.match(result.svg, /<svg/);

    const realCache = await fs.realpath(cache);
    assert.ok(result.snapshotPath.startsWith(`${realCache}${path.sep}`));
    const pngStat = await fs.stat(result.snapshotPath);
    assert.equal(pngStat.mode & 0o777, 0o600);
    const pngBytes = await fs.readFile(result.snapshotPath);
    assert.equal(pngBytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');

    const dir = path.dirname(result.snapshotPath);
    assert.equal((await fs.stat(dir)).mode & 0o777, 0o700);
    assert.ok(await fs.stat(path.join(dir, OUTPUT_MARKER)));
    assert.equal((await fs.stat(path.join(dir, 'page.svg'))).mode & 0o777, 0o600);

    // Ferramentas fixas resolvidas da lista conhecida; argumentos em lista; sem shell.
    const tools = resolvePopplerTools();
    assert.equal(calls.length, 3);
    assert.deepEqual(calls[0].argv, [tools.pdfinfo, await fs.realpath(pdf)]);
    assert.equal(calls[1].argv[0], tools.pdftocairo);
    assert.equal(calls[2].argv[0], tools.pdftocairo);
    assert.ok(calls[1].argv.includes('-svg'));
    assert.deepEqual(calls[1].argv.slice(1, 6), ['-svg', '-f', '2', '-l', '2']);
    assert.ok(calls[2].argv.includes('-png'));
    assert.ok(calls[2].argv.includes('-singlefile'));
    for (const call of calls) {
      assert.ok(Array.isArray(call.argv));
      assert.ok(call.argv.every((arg) => typeof arg === 'string'));
      assert.ok(call.options.timeoutMs > 0);
      assert.ok(!('shell' in call.options));
    }
  } finally {
    await cleanup(base);
  }
});

test('page: pedido não escolhe executável/ferramenta (campos extras ignorados)', async () => {
  const {base, root, cache, pdf} = await setup();
  try {
    const calls = [];
    const result = await pageOperation(baseRequest(pdf, root, cache, {
      executable: '/bin/sh',
      tools: {pdfinfo: '/bin/echo', pdftocairo: '/bin/cat'},
      helperPath: '/bin/sh',
      run: () => { throw new Error('nunca deve ser usado'); },
    }), {run: makeFakeRun({calls})});
    assert.equal(result.ok, true);
    const tools = resolvePopplerTools();
    assert.equal(calls[0].argv[0], tools.pdfinfo);
    assert.equal(calls[1].argv[0], tools.pdftocairo);
    assert.equal(calls[2].argv[0], tools.pdftocairo);
  } finally {
    await cleanup(base);
  }
});

test('page: resolução de Poppler usa só a lista conhecida e injeta candidatos em teste', async () => {
  const {base, root, cache, pdf} = await setup();
  try {
    const calls = [];
    const onlyUsrLocal = (candidate) => candidate === '/usr/local/bin/pdfinfo' || candidate === '/usr/local/bin/pdftocairo';
    const result = await pageOperation(baseRequest(pdf, root, cache), {run: makeFakeRun({calls}), isExecutable: onlyUsrLocal});
    assert.equal(result.ok, true);
    assert.equal(calls[0].argv[0], '/usr/local/bin/pdfinfo');
    assert.equal(calls[1].argv[0], '/usr/local/bin/pdftocairo');
    assert.equal(calls[2].argv[0], '/usr/local/bin/pdftocairo');

    // Campo do pedido com o mesmo nome não participa da resolução.
    const hostileCalls = [];
    const hostile = await pageOperation(baseRequest(pdf, root, cache, {isExecutable: () => true}), {
      run: makeFakeRun({calls: hostileCalls}),
      isExecutable: (candidate) => candidate === '/usr/bin/pdfinfo' || candidate === '/usr/bin/pdftocairo',
    });
    assert.equal(hostile.ok, true);
    assert.equal(hostileCalls[0].argv[0], '/usr/bin/pdfinfo');
  } finally {
    await cleanup(base);
  }
});

test('resolvePopplerTool/isExecutableFile: ordem fixa dos dirs conhecidos, sem PATH', async () => {
  const seen = [];
  const picked = resolvePopplerTool('pdfinfo', {
    isExecutable: (candidate) => {
      seen.push(candidate);
      return candidate === '/usr/bin/pdfinfo';
    },
  });
  assert.equal(picked, '/usr/bin/pdfinfo');
  assert.deepEqual(seen, ['/opt/homebrew/bin/pdfinfo', '/usr/local/bin/pdfinfo', '/usr/bin/pdfinfo']);
  // Nenhum candidato → fallback do primeiro dir (a execução falha TOOL_MISSING).
  assert.equal(resolvePopplerTool('pdftocairo', {isExecutable: () => false}), '/opt/homebrew/bin/pdftocairo');

  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'mesa-host-tool-'));
  try {
    const file = path.join(base, 'tool');
    await fs.writeFile(file, '#!/bin/sh\nexit 0\n');
    await fs.chmod(file, 0o755);
    assert.equal(isExecutableFile(file), true);
    await fs.chmod(file, 0o644);
    assert.equal(isExecutableFile(file), false);
    const sub = path.join(base, 'sub');
    await fs.mkdir(sub, {mode: 0o755});
    assert.equal(isExecutableFile(sub), false); // diretório com +x não é ferramenta
    assert.equal(isExecutableFile(path.join(base, 'nao-existe')), false);
  } finally {
    await fs.rm(base, {recursive: true, force: true});
  }
});

test('page: symlink que escapa das roots é recusado', async () => {
  const {base, root, outside, cache} = await setup();
  try {
    const secret = await writeValidFakePdf(path.join(outside, 'secret.pdf'));
    const link = path.join(root, 'escape.pdf');
    await fs.symlink(secret, link);
    await assert.rejects(
      pageOperation(baseRequest(link, root, cache), {run: makeFakeRun()}),
      (error) => error.code === 'PATH_OUTSIDE_ROOTS',
    );
  } finally {
    await cleanup(base);
  }
});

test('page: symlink dentro da root é aceito e resolve para o caminho real', async () => {
  const {base, root, cache, pdf} = await setup();
  try {
    const link = path.join(root, 'atalho.pdf');
    await fs.symlink(pdf, link);
    const result = await pageOperation(baseRequest(link, root, cache), {run: makeFakeRun()});
    assert.equal(result.ok, true);
    assert.equal(result.document.path, await fs.realpath(pdf));
  } finally {
    await cleanup(base);
  }
});

test('page: root obsoleta é pulada sem derrubar a root válida (e sem conceder acesso)', async () => {
  const {base, root, outside, cache, pdf} = await setup();
  try {
    const stale = path.join(base, 'pendrive-removido');
    const before = await fs.readFile(pdf);

    // A ordem não importa: a root que não resolve é ignorada, a válida autoriza.
    for (const roots of [[stale, root], [root, stale]]) {
      const result = await pageOperation(baseRequest(pdf, root, cache, {roots}), {run: makeFakeRun()});
      assert.equal(result.ok, true);
      assert.equal(result.document.path, await fs.realpath(pdf));
      assert.ok(await fs.stat(result.snapshotPath));
    }
    assert.deepEqual(await fs.readFile(pdf), before, 'o PDF permanece intacto (somente leitura)');

    // NENHUMA root válida (todas ausentes) continua ROOT_NOT_FOUND.
    await assert.rejects(
      pageOperation(baseRequest(pdf, root, cache, {roots: [stale, path.join(base, 'outra-ausente')]}), {run: makeFakeRun()}),
      (error) => error.code === 'ROOT_NOT_FOUND' && Array.isArray(error.detail.roots) && error.detail.roots.length === 2,
    );

    // Root válida mas arquivo fora continua PATH_OUTSIDE_ROOTS, mesmo com obsoleta na lista.
    const outsidePdf = await writeValidFakePdf(path.join(outside, 'fora.pdf'));
    await assert.rejects(
      pageOperation(baseRequest(outsidePdf, root, cache, {roots: [stale, root]}), {run: makeFakeRun()}),
      (error) => error.code === 'PATH_OUTSIDE_ROOTS',
    );

    // Symlink que escapa continua recusado com a obsoleta na lista.
    const link = path.join(root, 'escape-com-obsoleta.pdf');
    await fs.symlink(outsidePdf, link);
    await assert.rejects(
      pageOperation(baseRequest(link, root, cache, {roots: [stale, root]}), {run: makeFakeRun()}),
      (error) => error.code === 'PATH_OUTSIDE_ROOTS',
    );
  } finally {
    await cleanup(base);
  }
});

test('page: validação de caminhos, roots e página', async () => {
  const {base, root, cache, pdf} = await setup();
  try {
    await assert.rejects(
      pageOperation(baseRequest('doc.pdf', root, cache), {run: makeFakeRun()}),
      (error) => error.code === 'PATH_NOT_ABSOLUTE',
    );
    await assert.rejects(
      pageOperation(baseRequest(pdf, root, cache, {roots: []}), {run: makeFakeRun()}),
      (error) => error.code === 'ROOTS_INVALID',
    );
    await assert.rejects(
      pageOperation(baseRequest(pdf, path.join(base, 'nao-existe'), cache), {run: makeFakeRun()}),
      (error) => error.code === 'ROOT_NOT_FOUND',
    );
    await assert.rejects(
      pageOperation(baseRequest(path.join(root, 'nao-existe.pdf'), root, cache), {run: makeFakeRun()}),
      (error) => error.code === 'PATH_NOT_FOUND',
    );
    await assert.rejects(
      pageOperation(baseRequest(pdf, root, cache, {cacheDir: 'relativo'}), {run: makeFakeRun()}),
      (error) => error.code === 'CACHE_DIR_NOT_ABSOLUTE',
    );
    for (const badPage of [0, -1, 1.5, '2', null, undefined, 1000001]) {
      await assert.rejects(
        pageOperation(baseRequest(pdf, root, cache, {page: badPage}), {run: makeFakeRun()}),
        (error) => error.code === 'PAGE_INVALID',
      );
    }
  } finally {
    await cleanup(base);
  }
});

test('page: extensão, tamanho e cabeçalho do PDF', async () => {
  const {base, root, cache} = await setup();
  try {
    const txt = path.join(root, 'doc.txt');
    await fs.writeFile(txt, '%PDF-1.4\nconteudo');
    await assert.rejects(
      pageOperation(baseRequest(txt, root, cache), {run: makeFakeRun()}),
      (error) => error.code === 'NOT_PDF_EXTENSION',
    );

    const tiny = path.join(root, 'tiny.pdf');
    await fs.writeFile(tiny, '%PDF-');
    await assert.rejects(
      pageOperation(baseRequest(tiny, root, cache), {run: makeFakeRun()}),
      (error) => error.code === 'PDF_TOO_SMALL',
    );

    const bogus = path.join(root, 'bogus.pdf');
    await fs.writeFile(bogus, Buffer.alloc(64, 0x41));
    await assert.rejects(
      pageOperation(baseRequest(bogus, root, cache), {run: makeFakeRun()}),
      (error) => error.code === 'PDF_HEADER_INVALID',
    );

    const big = path.join(root, 'big.pdf');
    await writeValidFakePdf(big, {padding: 4096});
    await assert.rejects(
      pageOperation(baseRequest(big, root, cache), {run: makeFakeRun(), limits: {maxPdfBytes: 1024}}),
      (error) => error.code === 'PDF_TOO_LARGE',
    );
  } finally {
    await cleanup(base);
  }
});

test('page: bounds usa o número real de páginas do pdfinfo', async () => {
  const {base, root, cache, pdf} = await setup();
  try {
    await assert.rejects(
      pageOperation(baseRequest(pdf, root, cache, {page: 4}), {run: makeFakeRun({numPages: 3})}),
      (error) => error.code === 'PAGE_OUT_OF_RANGE' && error.detail.page === 4 && error.detail.numPages === 3,
    );
    const result = await pageOperation(baseRequest(pdf, root, cache, {page: 3}), {run: makeFakeRun({numPages: 3})});
    assert.equal(result.page, 3);
    assert.equal(result.numPages, 3);
  } finally {
    await cleanup(base);
  }
});

test('page: falhas de processo viram códigos específicos (timeout, missing, parse, encrypt)', async () => {
  const {base, root, cache, pdf} = await setup();
  try {
    const timeoutPdfinfo = makeFakeRun({fail: (argv) => path.basename(argv[0]) === 'pdfinfo' ? {ok: false, timedOut: true, code: null, stdout: '', stderr: ''} : null});
    await assert.rejects(
      pageOperation(baseRequest(pdf, root, cache), {run: timeoutPdfinfo}),
      (error) => error.code === 'PDFINFO_TIMEOUT',
    );

    const timeoutConvert = makeFakeRun({fail: (argv) => path.basename(argv[0]) === 'pdftocairo' ? {ok: false, timedOut: true, code: null, stdout: '', stderr: ''} : null});
    await assert.rejects(
      pageOperation(baseRequest(pdf, root, cache), {run: timeoutConvert}),
      (error) => error.code === 'CONVERT_TIMEOUT',
    );

    const missing = makeFakeRun({fail: () => ({ok: false, missing: true, code: 'ENOENT', stdout: '', stderr: ''})});
    await assert.rejects(
      pageOperation(baseRequest(pdf, root, cache), {run: missing}),
      (error) => error.code === 'TOOL_MISSING',
    );

    await assert.rejects(
      pageOperation(baseRequest(pdf, root, cache), {run: makeFakeRun({infoStdout: 'saida estranha'})}),
      (error) => error.code === 'PDFINFO_PARSE',
    );

    await assert.rejects(
      pageOperation(baseRequest(pdf, root, cache), {run: makeFakeRun({infoStdout: 'Encrypted:       yes\n'})}),
      (error) => error.code === 'PDF_ENCRYPTED',
    );

    const failed = makeFakeRun({fail: (argv) => path.basename(argv[0]) === 'pdfinfo' ? {ok: false, code: 1, stdout: '', stderr: 'quebrou'} : null});
    await assert.rejects(
      pageOperation(baseRequest(pdf, root, cache), {run: failed}),
      (error) => error.code === 'PDFINFO_FAILED' && /quebrou/.test(error.message),
    );

    const throws = async () => { throw new Error('spawn quebrado'); };
    await assert.rejects(
      pageOperation(baseRequest(pdf, root, cache), {run: throws}),
      (error) => error.code === 'PDFINFO_FAILED' && /spawn quebrado/.test(error.message),
    );
  } finally {
    await cleanup(base);
  }
});

test('page: senha do pdfinfo (exit 1) vira PDF_ENCRYPTED; "password" em outra falha não', async () => {
  const {base, root, cache, pdf} = await setup();
  try {
    const failingPdfinfo = (stderr) => makeFakeRun({
      fail: (argv) => (
        path.basename(argv[0]) === 'pdfinfo'
          ? {ok: false, code: 1, stdout: '', stderr, timedOut: false, missing: false}
          : null
      ),
    });

    // Diagnósticos REAIS do Poppler com senha (exit 1 + linha própria no stderr):
    // a mensagem pública é em português, sem o diagnóstico cru em inglês.
    for (const stderr of ['Command Line Error: Incorrect password\n', 'Command Line Error: Password required\n']) {
      await assert.rejects(
        pageOperation(baseRequest(pdf, root, cache), {run: failingPdfinfo(stderr)}),
        (error) => error.code === 'PDF_ENCRYPTED' && /senha/.test(error.message) && !/password/i.test(error.message),
      );
    }

    // "password" num caminho/nome de arquivo, ou um erro parecido mas não
    // exato, NÃO pode virar PDF_ENCRYPTED.
    for (const stderr of [
      "I/O Error: Couldn't open file '/tmp/password-nao-existe.pdf': No such file or directory.\n",
      'Syntax Error: Invalid password field in trailer\n',
      'Command Line Error: Incorrect password for the file\n',
      '',
    ]) {
      await assert.rejects(
        pageOperation(baseRequest(pdf, root, cache), {run: failingPdfinfo(stderr)}),
        (error) => error.code === 'PDFINFO_FAILED',
        `stderr ${JSON.stringify(stderr)} não é diagnóstico de senha`,
      );
    }
  } finally {
    await cleanup(base);
  }
});

test('isPasswordDiagnostic: só o diagnóstico exato de senha do Poppler conta', () => {
  assert.equal(isPasswordDiagnostic('Command Line Error: Incorrect password\n'), true);
  assert.equal(isPasswordDiagnostic('lixo antes\nCommand Line Error: Password required\n'), true);
  assert.equal(isPasswordDiagnostic("I/O Error: Couldn't open file '/tmp/password.pdf'"), false);
  assert.equal(isPasswordDiagnostic('Command Line Error: Incorrect password for the file'), false);
  assert.equal(isPasswordDiagnostic('Error: unknown option --password'), false);
  assert.equal(isPasswordDiagnostic(''), false);
  assert.equal(isPasswordDiagnostic(undefined), false);
});

test('page: prévia SVG acima do limite degrada para PNG com aviso (sem truncar)', async () => {
  // Mudança de contrato (R2): antes o SVG grande abortava com SVG_TOO_LARGE.
  // Agora a degradação é segura: o PNG fiel é gerado e a prévia vetorial some
  // (svg:null + previewWarning bounded); SVG inválido/conversão que falha
  // continuam erro e nada é truncado.
  const {base, root, cache, pdf} = await setup();
  try {
    await fs.writeFile(path.join(cache, 'keep.txt'), 'não é do host');

    // Limite de caracteres: SVG válido, porém grande → svg:null + aviso.
    const longSvg = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg">${'x'.repeat(200)}</svg>`;
    const calls = [];
    const byChars = await pageOperation(baseRequest(pdf, root, cache), {
      run: makeFakeRun({svg: longSvg, calls}),
      limits: {svgCharLimit: 64},
    });
    assert.equal(byChars.ok, true);
    assert.equal(byChars.kind, 'page');
    assert.equal(byChars.svg, null);
    assert.equal(typeof byChars.previewWarning, 'string');
    assert.ok(byChars.previewWarning.length > 0 && byChars.previewWarning.length <= 300);
    assert.match(byChars.previewWarning, /64/);
    assert.equal(typeof byChars.snapshotPath, 'string');
    assert.ok(await fs.stat(byChars.snapshotPath));
    assert.equal((await fs.stat(byChars.snapshotPath)).mode & 0o777, 0o600);
    // A PNG é gerada mesmo com a prévia omitida...
    assert.ok(calls.some((call) => call.argv.includes('-png')));
    // ...e o SVG excedente não sobra na pasta própria.
    assert.equal(await fs.stat(path.join(path.dirname(byChars.snapshotPath), 'page.svg')).then(() => true, () => false), false);
    assert.ok(await fs.stat(path.join(cache, 'keep.txt')));

    // Limite de bytes de leitura: válido no prefixo, grande demais.
    const bigValidSvg = Buffer.from(`<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg">${'x'.repeat(400)}</svg>`);
    const byBytes = await pageOperation(baseRequest(pdf, root, cache), {
      run: makeFakeRun({svgBytes: bigValidSvg}),
      limits: {maxSvgReadBytes: 32},
    });
    assert.equal(byBytes.ok, true);
    assert.equal(byBytes.svg, null);
    assert.equal(typeof byBytes.previewWarning, 'string');
    assert.ok(await fs.stat(byBytes.snapshotPath));

    // SVG inválido continua erro e não deixa pasta própria para trás.
    const before = (await ownDirs(cache)).length;
    await assert.rejects(
      pageOperation(baseRequest(pdf, root, cache), {run: makeFakeRun({svg: 'nao e svg'})}),
      (error) => error.code === 'SVG_INVALID',
    );
    assert.equal((await ownDirs(cache)).length, before);
    await assert.rejects(
      pageOperation(baseRequest(pdf, root, cache), {run: makeFakeRun({svgBytes: Buffer.alloc(256, 0x78)}), limits: {maxSvgReadBytes: 32}}),
      (error) => error.code === 'SVG_INVALID',
    );
    assert.equal((await ownDirs(cache)).length, before);
  } finally {
    await cleanup(base);
  }
});

test('previewWarningFor: mensagem bounded, sem promessa de fidelidade', () => {
  const message = previewWarningFor({svgCharLimit: SVG_CHAR_LIMIT}, {length: 315581});
  assert.ok(message.length > 0 && message.length <= 300);
  assert.match(message, /315581/);
  assert.match(message, new RegExp(String(SVG_CHAR_LIMIT)));
  assert.doesNotMatch(message, /fiel|fielmente|idêntic/i);
  const bytesMessage = previewWarningFor({svgCharLimit: SVG_CHAR_LIMIT}, {bytes: 999999});
  assert.ok(bytesMessage.length > 0 && bytesMessage.length <= 300);
  assert.match(bytesMessage, /999999 bytes/);
});

test('page: PNG inválido falha e a pasta própria é removida', async () => {
  const {base, root, cache, pdf} = await setup();
  try {
    await assert.rejects(
      pageOperation(baseRequest(pdf, root, cache), {run: makeFakeRun({png: Buffer.alloc(512, 0x41)})}),
      (error) => error.code === 'PNG_INVALID',
    );
    assert.equal((await ownDirs(cache)).length, 0);
  } finally {
    await cleanup(base);
  }
});

test('page: sucesso não apaga nada alheio e poda só pastas antigas com marcador do host', async () => {
  const {base, root, cache, pdf} = await setup();
  try {
    await fs.writeFile(path.join(cache, 'keep.txt'), 'arquivo do usuário');
    const oldDir = path.join(cache, `${OUTPUT_PREFIX}old`);
    const newDir = path.join(cache, `${OUTPUT_PREFIX}new`);
    const noMarker = path.join(cache, `${OUTPUT_PREFIX}nomarker`);
    const foreignMarker = path.join(cache, `${OUTPUT_PREFIX}foreign`);
    const weakToken = path.join(cache, `${OUTPUT_PREFIX}weak`);
    await fs.mkdir(oldDir);
    await fs.mkdir(newDir);
    await fs.mkdir(noMarker);
    await fs.mkdir(foreignMarker);
    await fs.mkdir(weakToken);
    const old = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
    await fs.writeFile(path.join(oldDir, OUTPUT_MARKER), JSON.stringify({host: OUTPUT_HOST_ID, kind: 'page', token: VALID_TOKEN, createdAt: old}));
    await fs.writeFile(path.join(newDir, OUTPUT_MARKER), JSON.stringify({host: OUTPUT_HOST_ID, kind: 'capture', token: 'b'.repeat(32), createdAt: new Date().toISOString()}));
    await fs.writeFile(path.join(foreignMarker, OUTPUT_MARKER), JSON.stringify({host: 'outro-host', kind: 'page', token: 'c'.repeat(32), createdAt: old}));
    // Mesmo host, mas token fraco: NÃO é marcador válido, preserva.
    await fs.writeFile(path.join(weakToken, OUTPUT_MARKER), JSON.stringify({host: OUTPUT_HOST_ID, kind: 'page', token: 'a', createdAt: old}));

    const result = await pageOperation(baseRequest(pdf, root, cache), {run: makeFakeRun()});
    assert.equal(result.ok, true);

    await assert.rejects(fs.stat(oldDir), {code: 'ENOENT'});
    assert.ok(await fs.stat(newDir));
    assert.ok(await fs.stat(noMarker));
    assert.ok(await fs.stat(foreignMarker));
    assert.ok(await fs.stat(weakToken));
    assert.ok(await fs.stat(path.join(cache, 'keep.txt')));
  } finally {
    await cleanup(base);
  }
});

test('parsePdfInfo lê Pages e Encrypted', () => {
  assert.deepEqual(parsePdfInfo('Pages:  12\nEncrypted:       no\n'), {numPages: 12, encrypted: false});
  assert.deepEqual(parsePdfInfo('Encrypted: yes\n'), {numPages: null, encrypted: true});
  assert.deepEqual(parsePdfInfo(''), {numPages: null, encrypted: false});
});
