// tests/mod-lib.test.mjs — unidades das bibliotecas do mod.
//
// - `lib/calculator.mjs` é cópia byte a byte de `desk/calculator.mjs`
//   (o original não foi tocado) e continua sem `eval`;
// - schema/limites da sessão e inspeção de store (versão incompatível x
//   corrompido x vazio);
// - opções do manifest (nodePath/cacheDir/roots) com padrões seguros;
// - validação estrita das respostas do helper (page/capture/erro), sem
//   processo real: correspondência path/page, limites, snapshotPath dentro do
//   cache (realpath/symlink) e aviso de prévia preservado;
// - ausência de `$.process.run` vira erro claro, sem tocar no modelo.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { calculate } from '../lib/calculator.mjs'
import { createHelper, isInsideDir } from '../lib/helper.mjs'
import { DEFAULT_CACHE_DIR, normalizeOptions } from '../lib/mesa.mjs'
import { defaultSession, inspectSession, sanitizeSession, toStored } from '../lib/session.mjs'
import { basename, dirname, isAbsolutePath, joinPath } from '../lib/paths.mjs'

test('calculator.mjs é cópia byte a byte de desk/calculator.mjs e não usa eval', async () => {
  const copy = await readFile(new URL('../lib/calculator.mjs', import.meta.url))
  const origin = await readFile(new URL('../../../desk/calculator.mjs', import.meta.url))
  assert.deepEqual(copy, origin, 'cópia precisa ser idêntica ao original')
  const source = copy.toString('utf8')
  assert.ok(!source.includes('eval('), 'parser sem eval')
  assert.equal(calculate('2+2'), '4')
  assert.equal(calculate('sqrt(9)'), '3')
  assert.equal(calculate('sin(pi/2)'), '1')
  assert.throws(() => calculate('window.alert(1)'))
})

test('sanitizeSession respeita schema e limites e nunca lança', () => {
  assert.deepEqual(sanitizeSession(null), defaultSession())
  assert.deepEqual(sanitizeSession('nope'), defaultSession())
  const out = sanitizeSession({
    subject: 's'.repeat(500),
    question: 'q'.repeat(500),
    notes: 'n'.repeat(5_000),
    pdfPath: '/x'.repeat(5_000),
    rootsDir: '/r',
    roots: ['/a', '/a', '/b', '/c', '/d', '/e'],
    docs: [
      { path: '/a.pdf', page: 0, numPages: -1 },
      { path: '/b.pdf', page: 2, numPages: 9 },
      { path: '/c.pdf' },
    ],
    activeDoc: 99,
    updatedAt: -5,
  })
  assert.equal(out.subject.length, 120)
  assert.equal(out.question.length, 240)
  assert.equal(out.notes.length, 2_000)
  assert.equal(out.pdfPath.length, 4_096)
  assert.deepEqual(out.roots, ['/a', '/b', '/c', '/d'])
  assert.equal(out.docs.length, 2)
  assert.equal(out.docs[0].page, 1)
  assert.equal(out.docs[0].numPages, 0)
  assert.equal(out.docs[1].path, '/b.pdf')
  assert.equal(out.activeDoc, 1)
  assert.equal(out.updatedAt, 0)
  assert.ok(!('previews' in toStored(out)), 'store não guarda prévias/captura')
  assert.ok(!('lastCapture' in toStored(out)), 'store não guarda captura')
})

test('inspectSession distingue vazio, ok, incompatível e corrompido sem perder o v1 válido', () => {
  assert.equal(inspectSession(undefined).status, 'empty')
  assert.equal(inspectSession(null).status, 'empty')

  const ok = inspectSession({ version: 1, subject: 'Cálculo', docs: [{ path: '/a.pdf', page: 2 }] })
  assert.equal(ok.status, 'ok')
  assert.equal(ok.session.subject, 'Cálculo')
  assert.equal(ok.session.docs[0].page, 2)

  const older = inspectSession({ version: 0, subject: 'antigo' })
  assert.equal(older.status, 'incompatible')
  assert.equal(older.version, 0)
  assert.deepEqual(older.session, defaultSession(), 'não mistura dados de versão desconhecida')

  const newer = inspectSession({ version: 99 })
  assert.equal(newer.status, 'incompatible')
  assert.equal(newer.version, 99)

  for (const raw of ['nope', 42, [], { version: 1, subject: 7 }, { version: 1, docs: 'nope' }, { version: 1, activeDoc: '2' }]) {
    const seen = inspectSession(raw)
    assert.ok(seen.status === 'incompatible' || seen.status === 'corrupted', `status de ${JSON.stringify(raw)}`)
    assert.deepEqual(seen.session, defaultSession(), 'store fora do contrato não vira estado misturado')
  }
})

test('normalizeOptions: padrões seguros, cacheDir absoluto e roots limitadas', () => {
  assert.deepEqual(normalizeOptions(undefined), { nodePath: 'node', cacheDir: DEFAULT_CACHE_DIR, roots: [] })
  assert.deepEqual(normalizeOptions({ nodePath: '  ', cacheDir: 'relativo/cache' }), {
    nodePath: 'node',
    cacheDir: DEFAULT_CACHE_DIR,
    roots: [],
  })
  const out = normalizeOptions({
    nodePath: '/usr/local/bin/node',
    cacheDir: '/tmp/cache-mesa',
    roots: ['/a', '/a', '/b', '/c', '/d', '/e', 'relativa'],
  })
  assert.equal(out.nodePath, '/usr/local/bin/node')
  assert.equal(out.cacheDir, '/tmp/cache-mesa')
  assert.deepEqual(out.roots, ['/a', '/b', '/c', '/d'])
  assert.deepEqual(normalizeOptions({ roots: '/a, /b' }).roots, ['/a', '/b'])
})

test('paths: helpers de string para POSIX e Windows', () => {
  assert.equal(isAbsolutePath('/a/b.pdf'), true)
  assert.equal(isAbsolutePath('C:\\a\\b.pdf'), true)
  assert.equal(isAbsolutePath('relativo/b.pdf'), false)
  assert.equal(dirname('/a/b.pdf'), '/a')
  assert.equal(dirname('C:\\a\\b.pdf'), 'C:\\a')
  assert.equal(dirname('C:\\b.pdf'), 'C:\\')
  assert.equal(basename('/a/b.pdf'), 'b.pdf')
  assert.equal(joinPath('/a', 'b.pdf'), '/a/b.pdf')
  assert.equal(joinPath('/a/', 'b.pdf'), '/a/b.pdf')
})

test('isInsideDir: contenção estrita por prefixo, POSIX e Windows', () => {
  assert.equal(isInsideDir('/tmp/cache/x/p.png', '/tmp/cache'), true)
  assert.equal(isInsideDir('/tmp/cache/x/p.png', '/tmp/cache/'), true)
  assert.equal(isInsideDir('/tmp/cache2/p.png', '/tmp/cache'), false)
  assert.equal(isInsideDir('/tmp/cache', '/tmp/cache'), false, 'o diretório em si não é arquivo do cache')
  assert.equal(isInsideDir('C:\\cache\\x\\p.png', 'C:\\cache'), true)
  assert.equal(isInsideDir('/tmp/cache/p.png', '/'), true)
})

test('isInsideDir (r3-C): recusa `..`/`.`/vazio/relativo e preserva limites e caixa', () => {
  // Sem realpath o prefixo lexical não pode decidir; `.`/`..` escapariam.
  assert.equal(isInsideDir('/cache/../etc/passwd', '/cache'), false, '`..` não escapa do prefixo')
  assert.equal(isInsideDir('/cache/./x/p.png', '/cache'), false, '`.` é segmento não confiável')
  assert.equal(isInsideDir('/cache/x/..', '/cache'), false)
  assert.equal(isInsideDir('/cache/x/p.png', '/cache/..'), false, 'dir com `..` também é recusado')
  assert.equal(isInsideDir('..\\cache\\x', 'C:\\cache'), false, '`..` no estilo Windows')

  // Os dois lados precisam ser absolutos e não vazios.
  assert.equal(isInsideDir('/etc/passwd', ''), false, 'dir vazio não confina nada')
  assert.equal(isInsideDir('/tmp/cache/x', ''), false)
  assert.equal(isInsideDir('', '/tmp/cache'), false)
  assert.equal(isInsideDir('relativo/x', '/tmp/cache'), false)
  assert.equal(isInsideDir('/tmp/cache/x', 'relativo'), false)

  // Limites exatos e raiz POSIX continuam valendo.
  assert.equal(isInsideDir('/', '/'), false, 'a raiz em si não é arquivo do cache')
  assert.equal(isInsideDir('/x.png', '/'), true)
  assert.equal(isInsideDir('/tmp/cache/', '/tmp/cache'), false)
  assert.equal(isInsideDir('/tmp/cache2/p.png', '/tmp/cache'), false)
  assert.equal(isInsideDir('C:\\Cache\\x\\p.png', 'C:\\cache'), false, 'sem expandir caixa do sistema')
})

function runWith(result, fsImpl) {
  return {
    plugin: { root: '/p' },
    process: { run: async () => result },
    ...(fsImpl ? { fs: fsImpl } : {}),
  }
}

function pageBody(overrides = {}) {
  return {
    ok: true,
    kind: 'page',
    document: { path: '/x/a.pdf', name: 'a.pdf' },
    page: 1,
    numPages: 1,
    svg: '<svg></svg>',
    snapshotPath: '/tmp/cache/p.png',
    mimeType: 'image/png',
    ...overrides,
  }
}

function captureBody(overrides = {}) {
  return {
    ok: true,
    kind: 'capture',
    snapshotPath: '/tmp/cache/c.png',
    mimeType: 'image/png',
    capturedAt: '2026-10-05T21:00:00.000Z',
    window: { id: '4242', app: 'Xournal++', title: 'rascunho.xopp' },
    ...overrides,
  }
}

test('helper: page válida devolve argv sem shell e resposta normalizada', async () => {
  const helper = createHelper({ nodePath: 'node', cacheDir: '/tmp/cache' })
  const seen = []
  const $ = {
    plugin: { root: '/p/mesa-study' },
    process: {
      run: async (argv, init) => {
        seen.push({ argv, init })
        return {
          exitCode: 0,
          stdout: JSON.stringify(pageBody({ page: 2, numPages: 5, svg: '<svg></svg>', snapshotPath: '/tmp/cache/p2.png' })),
          stderr: '',
        }
      },
    },
  }
  const res = await helper.page($, { path: '/x/a.pdf', page: 2, roots: ['/x'] })
  assert.equal(res.ok, true)
  assert.equal(res.page, 2)
  assert.equal(res.previewWarning, null)
  assert.deepEqual(seen[0].argv, ['node', '/p/mesa-study/host/cli.mjs', JSON.stringify({ op: 'page', path: '/x/a.pdf', page: 2, roots: ['/x'], cacheDir: '/tmp/cache' })])
  assert.equal(seen[0].init.timeoutMs, 60_000)
})

test('helper: erro de processo vira { ok:false, error } com código claro', async () => {
  const helper = createHelper({ nodePath: 'node', cacheDir: '/tmp/cache' })
  let res = await helper.page(runWith({ exitCode: 1, stdout: JSON.stringify({ ok: false, error: { code: 'pdf', message: 'PDF não encontrado' } }), stderr: '' }), { path: '/x/a.pdf', page: 1, roots: [] })
  assert.equal(res.ok, false)
  assert.equal(res.error.code, 'pdf')
  assert.equal(res.error.message, 'PDF não encontrado')

  res = await helper.page(runWith({ exitCode: 0, stdout: 'sem json', stderr: '' }), { path: '/x/a.pdf', page: 1, roots: [] })
  assert.equal(res.error.code, 'helper-json')

  res = await helper.page(runWith({ exitCode: 1, stdout: '', stderr: 'stack' }), { path: '/x/a.pdf', page: 1, roots: [] })
  assert.equal(res.error.code, 'helper-saida')

  res = await helper.page(
    { plugin: { root: '/p' }, process: { run: async () => { throw new Error('helper timed out after 60000 ms') } } },
    { path: '/x/a.pdf', page: 1, roots: [] },
  )
  assert.equal(res.error.code, 'helper-timeout')
  assert.match(res.error.message, /não respondeu em 60 s/)
  assert.match(res.error.message, /Nada foi reenviado automaticamente/)
  assert.doesNotMatch(res.error.message, /foi encerrado/, 'não declara o processo morto além do que a API garante')
})

test('helper: sem $.process.run o erro é claro e nenhum modelo/helper é tocado', async () => {
  const helper = createHelper({ nodePath: 'node', cacheDir: '/tmp/cache' })
  let calls = 0
  const res = await helper.page(
    { plugin: { root: '/p' }, process: undefined, prompt: { submit: async () => (calls += 1) } },
    { path: '/x/a.pdf', page: 1, roots: [] },
  )
  assert.equal(res.ok, false)
  assert.equal(res.error.code, 'helper-indisponivel')
  assert.match(res.error.message, /\$\.process\.run/)
  assert.equal(calls, 0)
})

test('helper: svg grande é recusado (nunca truncado), svg null é página válida e aviso é preservado', async () => {
  const helper = createHelper({ nodePath: 'node', cacheDir: '/tmp/cache' })
  let res = await helper.page(
    runWith({ exitCode: 0, stdout: JSON.stringify(pageBody({ svg: `<svg>${'x'.repeat(140_000)}</svg>` })), stderr: '' }),
    { path: '/x/a.pdf', page: 1, roots: [] },
  )
  assert.equal(res.error.code, 'page-invalida')

  res = await helper.page(
    runWith({ exitCode: 0, stdout: JSON.stringify(pageBody({ svg: null, previewWarning: 'A prévia vetorial da página tem 315581 caracteres e excede o limite; o PNG da página foi gerado.' })), stderr: '' }),
    { path: '/x/a.pdf', page: 1, roots: [] },
  )
  assert.equal(res.ok, true)
  assert.equal(res.svg, null)
  assert.match(res.previewWarning, /315581 caracteres/)
  assert.equal(res.snapshotPath, '/tmp/cache/p.png')

  res = await helper.page(runWith({ exitCode: 0, stdout: JSON.stringify(pageBody({ svg: '' })), stderr: '' }), { path: '/x/a.pdf', page: 1, roots: [] })
  assert.equal(res.ok, true)
  assert.equal(res.svg, null)

  // Aviso inválido não vira UI silenciosa.
  res = await helper.page(runWith({ exitCode: 0, stdout: JSON.stringify(pageBody({ svg: null, previewWarning: 42 })), stderr: '' }), { path: '/x/a.pdf', page: 1, roots: [] })
  assert.equal(res.error.code, 'page-invalida')
})

test('helper: página precisa corresponder ao path/page pedidos e a limites sãos', async () => {
  const helper = createHelper({ nodePath: 'node', cacheDir: '/tmp/cache' })
  const page = (overrides, request = { path: '/x/a.pdf', page: 1, roots: [] }) =>
    helper.page(runWith({ exitCode: 0, stdout: JSON.stringify(pageBody(overrides)), stderr: '' }), request)

  assert.equal((await page({ page: 3 })).error.code, 'page-invalida')
  assert.equal((await page({ document: { path: '/y/b.pdf', name: 'b.pdf' } })).error.code, 'page-invalida')
  assert.equal((await page({ document: { path: 'relativo/a.pdf', name: 'a.pdf' } })).error.code, 'page-invalida')
  assert.equal((await page({ document: { path: '/x/a.pdf', name: '' } })).error.code, 'page-invalida')
  assert.equal((await page({ numPages: 0 })).error.code, 'page-invalida')
  assert.equal((await page({ numPages: 1_000_001 })).error.code, 'page-invalida')
  assert.equal((await page({ page: 1_000_001, numPages: 1_000_001 })).error.code, 'page-invalida')
  // Mesmo documento, página certa: passa.
  assert.equal((await page({ page: 1, numPages: 3 })).ok, true)
})

test('helper: snapshotPath fora do cache é recusado; realpath do cache (symlink) é aceito e link que escapa é barrado', async () => {
  const helper = createHelper({ nodePath: 'node', cacheDir: '/tmp/cache-link' })
  const body = JSON.stringify(pageBody({ snapshotPath: '/fora/p.png' }))
  let res = await helper.page(runWith({ exitCode: 0, stdout: body, stderr: '' }), { path: '/x/a.pdf', page: 1, roots: [] })
  assert.equal(res.error.code, 'page-invalida')

  // cacheDir é um symlink: o host devolve caminhos sob o realpath.
  const fsImpl = {
    stat: async (p) => {
      if (p === '/tmp/cache-link') return { kind: 'dir', realPath: '/real/cache' }
      if (p === '/real/cache/sub/p.png') return { kind: 'file', realPath: '/real/cache/sub/p.png' }
      if (p === '/tmp/cache-link/escape.png') return { kind: 'file', realPath: '/outside/escape.png' }
      const err = new Error(`ENOENT: ${p} (fake)`)
      err.code = 'ENOENT'
      throw err
    },
  }
  res = await helper.page(
    runWith({ exitCode: 0, stdout: JSON.stringify(pageBody({ snapshotPath: '/real/cache/sub/p.png' })), stderr: '' }, fsImpl),
    { path: '/x/a.pdf', page: 1, roots: [] },
  )
  assert.equal(res.ok, true)
  assert.equal(res.snapshotPath, '/real/cache/sub/p.png')

  // Um caminho que o prefixo literal do symlink aceitaria não vale se o
  // realpath do arquivo aponta para fora do cache.
  res = await helper.page(
    runWith({ exitCode: 0, stdout: JSON.stringify(pageBody({ snapshotPath: '/tmp/cache-link/escape.png' })), stderr: '' }, fsImpl),
    { path: '/x/a.pdf', page: 1, roots: [] },
  )
  assert.equal(res.error.code, 'page-invalida')
})

test('helper: snapshot lexical sem stat aceita caminho limpo e recusa `..` (r3-C)', async () => {
  const helper = createHelper({ nodePath: 'node', cacheDir: '/cache' })
  const body = (snapshotPath) =>
    runWith({ exitCode: 0, stdout: JSON.stringify(pageBody({ snapshotPath })), stderr: '' })

  // Degradação contratual: sem `$.fs.stat`, o prefixo lexical decide — caminho
  // limpo continua valendo (o PNG do host é confiável e o arquivo real é
  // conferido quando o modelo pede o Read).
  let res = await helper.page(body('/cache/p.png'), { path: '/x/a.pdf', page: 1, roots: [] })
  assert.equal(res.ok, true)
  assert.equal(res.snapshotPath, '/cache/p.png')

  // `..` não pode escapar do cache nem no fallback lexical.
  res = await helper.page(body('/cache/../etc/passwd'), { path: '/x/a.pdf', page: 1, roots: [] })
  assert.equal(res.ok, false)
  assert.equal(res.error.code, 'page-invalida')

  // Com `$.fs.stat` presente mas falhando (arquivo ainda não visível), vale o mesmo.
  const statFails = {
    stat: async () => {
      const err = new Error('ENOENT (fake)')
      err.code = 'ENOENT'
      throw err
    },
  }
  res = await helper.page(runWith({ exitCode: 0, stdout: JSON.stringify(pageBody({ snapshotPath: '/cache/p.png' })), stderr: '' }, statFails), {
    path: '/x/a.pdf',
    page: 1,
    roots: [],
  })
  assert.equal(res.ok, true)
  res = await helper.page(runWith({ exitCode: 0, stdout: JSON.stringify(pageBody({ snapshotPath: '/cache/../etc/passwd' })), stderr: '' }, statFails), {
    path: '/x/a.pdf',
    page: 1,
    roots: [],
  })
  assert.equal(res.error.code, 'page-invalida')
})

test('helper: captura exige id de janela e capturedAt estritos e snapshot no cache', async () => {
  const helper = createHelper({ nodePath: 'node', cacheDir: '/tmp/cache' })
  const capture = (overrides) =>
    helper.capture(runWith({ exitCode: 0, stdout: JSON.stringify(captureBody(overrides)), stderr: '' }))

  let res = await capture({})
  assert.equal(res.ok, true)
  assert.equal(res.window.id, '4242')

  assert.equal((await capture({ capturedAt: 'x' })).error.code, 'captura-invalida')
  assert.equal((await capture({ capturedAt: 123 })).error.code, 'captura-invalida')
  assert.equal((await capture({ window: { id: 'win-1', app: 'Xournal++', title: 'x' } })).error.code, 'captura-invalida')
  assert.equal((await capture({ window: { id: '0', app: 'Xournal++', title: 'x' } })).error.code, 'captura-invalida')
  assert.equal((await capture({ window: { id: '99999999999', app: 'Xournal++', title: 'x' } })).error.code, 'captura-invalida')
  assert.equal((await capture({ window: { id: '7' } })).error.code, 'captura-invalida')
  assert.equal((await capture({ snapshotPath: '/fora/c.png' })).error.code, 'captura-invalida')
  assert.equal((await capture({ mimeType: 'image/jpeg' })).error.code, 'captura-invalida')
  assert.equal((await capture({ svg: `<svg>${'x'.repeat(140_000)}</svg>` })).error.code, 'captura-invalida')
})
