// tests/mod-mesa.test.mjs — comportamento do estado: comando, navegação,
// seleção, corridas (geração/fila), timeout, persistência, calculadora,
// prévia omitida pelo host e guarda de análise.
//
// Tudo com engine fake (ver mod-harness.test.mjs). Sem Desktop, sem helper
// real, sem modelo, sem material de curso.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  captureResponse,
  collectText,
  createEngine,
  pageResponse,
  processResult,
  validateTree,
} from './mod-harness.test.mjs'
import { capturePrompt, pagePrompt } from '../lib/mesa.mjs'

const SESSION_KEY = 'mesa-study.session.v1'
const CACHE = '/tmp/mesa-study-mod'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function queueProcess() {
  const items = []
  return {
    items,
    impl: async () => {
      const item = items.shift()
      if (!item) throw new Error('fila de processos vazia (chamada inesperada ao helper)')
      return await item()
    },
  }
}

function fileStat(map) {
  return async (path) => {
    const entry = map[path]
    if (!entry) {
      const err = new Error(`ENOENT: ${path} (fake)`)
      err.code = 'ENOENT'
      throw err
    }
    return entry
  }
}

const LIMITES = { kind: 'file', size: 1234, mtimeMs: 0, isLink: false, realPath: '/fake/pdfs/limites.pdf' }

async function openMesa(engine) {
  await engine.sessionStart()
  await engine.commandRun()
  return await engine.render('desktop')
}

test('session.start registra /mesa e não chama helper nem modelo', async () => {
  const engine = createEngine()
  await engine.sessionStart()
  assert.equal(engine.calls.commandRegister.length, 1)
  assert.equal(engine.calls.commandRegister[0].name, 'mesa')
  assert.ok(engine.calls.commandRegister[0].description.length > 0)
  assert.equal(engine.calls.process.length, 0)
  assert.equal(engine.calls.promptSubmit.length, 0)
})

test('/mesa abre o painel (com closeOnEscape), confirma na lista oficial e devolve {} silencioso', async () => {
  const engine = createEngine()
  await engine.sessionStart()
  const result = await engine.commandRun()
  assert.deepEqual(engine.calls.uiOpen[0], {
    id: 'mesa-study',
    title: 'Mesa de Estudos',
    focus: true,
    closeOnEscape: true,
    columns: 90,
  })
  assert.deepEqual(result, {}, 'abertura confirmada não escreve no transcript')
  const panes = await engine.$.ui.panes()
  assert.equal(panes.length, 1)
  assert.equal(panes[0].isPlaced, true)
  assert.equal(engine.calls.process.length, 0)
  assert.equal(engine.calls.promptSubmit.length, 0)
})

test('fechar o painel não dispara redraw nem reabre sozinho', async () => {
  const engine = createEngine()
  await openMesa(engine)
  const before = engine.calls.invalidate.length
  await engine.closePane()
  assert.equal(engine.calls.invalidate.length, before)
  assert.equal(engine.calls.uiOpen.length, 1)
  assert.equal(engine.calls.process.length, 0)
})

test('caminho explícito carrega página: argv do helper, estado, persistência e Svg', async () => {
  const queue = queueProcess()
  queue.items.push(async () => processResult(pageResponse({ page: 1, numPages: 3 })))
  const engine = createEngine({
    processImpl: queue.impl,
    fsImpl: { stat: fileStat({ '/fake/pdfs/limites.pdf': LIMITES }) },
  })
  await openMesa(engine)
  await engine.submit('pdfPath', '/fake/pdfs/limites.pdf')

  assert.equal(engine.calls.process.length, 1)
  const [argv, init] = [engine.calls.process[0].argv, engine.calls.process[0].init]
  assert.equal(argv[0], 'node')
  assert.equal(argv[1], '/fake/mesa-study/host/cli.mjs')
  const request = JSON.parse(argv[2])
  assert.deepEqual(request, {
    op: 'page',
    path: '/fake/pdfs/limites.pdf',
    page: 1,
    roots: ['/fake/pdfs'],
    cacheDir: CACHE,
  })
  assert.equal(init.timeoutMs, 60_000)

  const tree = await engine.render('desktop')
  assert.equal(validateTree(tree, 'desktop').length, 0)
  const svg = engine.findAll('Svg')
  assert.equal(svg.length, 1)
  assert.equal(svg[0].props.source, pageResponse().svg)
  assert.match(collectText(tree), /Página 1 de 3/)
  assert.equal(engine.calls.promptSubmit.length, 0)

  const stored = engine.store.get(SESSION_KEY)
  assert.equal(stored.docs.length, 1)
  assert.equal(stored.docs[0].path, '/fake/pdfs/limites.pdf')
  assert.equal(stored.docs[0].page, 1)
  assert.equal(stored.docs[0].numPages, 3)
  assert.ok(!('previews' in stored), 'store é só metadados')
  assert.ok(!('lastCapture' in stored))
  assert.equal(engine.calls.fsRead, 0, 'o mod não lê PDFs de curso com $.fs')
  assert.equal(engine.calls.fsWrite, 0, 'o mod não escreve com $.fs (cache é do helper)')
})

test('pasta explícita lista PDFs, Select carrega, primeiro PDF mantém prioridade e abas alternam', async () => {
  const queue = queueProcess()
  const echo = async () => {
    const req = JSON.parse(engine.calls.process.at(-1).argv[2])
    return processResult(pageResponse({ path: req.path, name: req.path.split('/').pop(), page: req.page, numPages: 2 }))
  }
  queue.items.push(echo)
  queue.items.push(echo)
  const engine = createEngine({
    processImpl: queue.impl,
    fsImpl: {
      stat: fileStat({
        '/fake/pdfs': { kind: 'dir', size: 0, mtimeMs: 0, isLink: false, realPath: '/fake/pdfs' },
        '/fake/pdfs/a.pdf': { kind: 'file', size: 1, mtimeMs: 0, isLink: false, realPath: '/fake/pdfs/a.pdf' },
        '/fake/pdfs/b.pdf': { kind: 'file', size: 2, mtimeMs: 0, isLink: false, realPath: '/fake/pdfs/b.pdf' },
      }),
      list: async () => [
        { name: 'b.pdf', kind: 'file', size: 2, isLink: false },
        { name: 'a.pdf', kind: 'file', size: 1, isLink: false },
        { name: 'notas.txt', kind: 'file', size: 3, isLink: false },
        { name: 'sub', kind: 'dir', size: 0, isLink: false },
      ],
    },
  })
  await openMesa(engine)
  await engine.submit('rootsDir', '/fake/pdfs')
  let tree = await engine.render('desktop')
  assert.equal(validateTree(tree, 'desktop').length, 0)
  const select = engine.find('pdf:select')
  assert.deepEqual(select.props.options, [
    { value: '/fake/pdfs/a.pdf', label: 'a.pdf' },
    { value: '/fake/pdfs/b.pdf', label: 'b.pdf' },
  ])
  assert.equal(engine.calls.fsList[0], '/fake/pdfs')

  await engine.pick('pdf:select', '/fake/pdfs/a.pdf')
  tree = await engine.render('desktop')
  assert.match(collectText(tree), /Página 1 de 2/)
  let stored = engine.store.get(SESSION_KEY)
  assert.deepEqual(stored.roots, ['/fake/pdfs'])
  assert.equal(stored.docs.length, 1)
  assert.equal(stored.docs[0].path, '/fake/pdfs/a.pdf')

  await engine.submit('pdfPath', '/fake/pdfs/b.pdf')
  tree = await engine.render('desktop')
  stored = engine.store.get(SESSION_KEY)
  assert.equal(stored.docs.length, 2)
  assert.equal(stored.docs[0].path, '/fake/pdfs/a.pdf', 'primeiro PDF mantém a prioridade')
  assert.equal(stored.docs[1].path, '/fake/pdfs/b.pdf')
  assert.equal(stored.activeDoc, 1)
  assert.ok(engine.find('doc:tab:0'))
  assert.ok(engine.find('doc:tab:1'))

  await engine.press('doc:tab:0')
  tree = await engine.render('desktop')
  assert.match(collectText(tree), /a\.pdf/)
  stored = engine.store.get(SESSION_KEY)
  assert.equal(stored.activeDoc, 0)
})

test('navegação prev/next/jump respeita limites e usa o documento ativo; jump é inteiro estrito', async () => {
  const queue = queueProcess()
  const push = (page, numPages = 3) => queue.items.push(async () => processResult(pageResponse({ page, numPages })))
  push(1)
  push(2)
  push(3)
  push(2)
  push(2)
  const engine = createEngine({
    processImpl: queue.impl,
    fsImpl: { stat: fileStat({ '/fake/pdfs/limites.pdf': LIMITES }) },
  })
  await openMesa(engine)
  await engine.submit('pdfPath', '/fake/pdfs/limites.pdf')

  await engine.press('page:next')
  assert.equal(JSON.parse(engine.calls.process.at(-1).argv[2]).page, 2)
  await engine.press('page:next')
  assert.equal(JSON.parse(engine.calls.process.at(-1).argv[2]).page, 3)
  const lastCalls = engine.calls.process.length
  await engine.press('page:next')
  assert.equal(engine.calls.process.length, lastCalls, 'na última página não chama o helper')
  let tree = await engine.render('desktop')
  assert.match(collectText(tree), /Já está na última página/)

  await engine.press('page:prev')
  assert.equal(JSON.parse(engine.calls.process.at(-1).argv[2]).page, 2)

  const callsBeforeJumps = engine.calls.process.length
  await engine.submit('page:jump', '99')
  tree = await engine.render('desktop')
  assert.match(collectText(tree), /não existe \(total: 3\)/)
  await engine.submit('page:jump', '2abc')
  tree = await engine.render('desktop')
  assert.match(collectText(tree), /Número de página inválido/)
  await engine.submit('page:jump', '+-2')
  tree = await engine.render('desktop')
  assert.match(collectText(tree), /Número de página inválido/)
  assert.equal(engine.calls.process.length, callsBeforeJumps, 'jump inválido não chama o helper')
  await engine.submit('page:jump', '2')
  assert.equal(JSON.parse(engine.calls.process.at(-1).argv[2]).page, 2)

  // primeira página não chama o helper
  push(1)
  await engine.press('page:prev')
  assert.equal(JSON.parse(engine.calls.process.at(-1).argv[2]).page, 1)
  const calls = engine.calls.process.length
  await engine.press('page:prev')
  assert.equal(engine.calls.process.length, calls)
  tree = await engine.render('desktop')
  assert.match(collectText(tree), /Já está na primeira página/)
})

test('clique duplo na mesma página não duplica a chamada; fila não vaza', async () => {
  const queue = queueProcess()
  queue.items.push(async () => processResult(pageResponse({ page: 1, numPages: 3 })))
  const first = deferred()
  queue.items.push(async () => await first.promise)
  const engine = createEngine({
    processImpl: queue.impl,
    fsImpl: { stat: fileStat({ '/fake/pdfs/limites.pdf': LIMITES }) },
  })
  await openMesa(engine)
  await engine.submit('pdfPath', '/fake/pdfs/limites.pdf')
  assert.equal(engine.calls.process.length, 1)

  const p1 = engine.press('page:next')
  const p2 = engine.press('page:next')
  assert.equal(engine.calls.process.length, 2, 'só uma chamada nova para a página 2')
  let tree = await engine.render('desktop')
  assert.match(collectText(tree), /já está carregando/)
  first.resolve(processResult(pageResponse({ page: 2, numPages: 3 })))
  await Promise.all([p1, p2])
  tree = await engine.render('desktop')
  assert.match(collectText(tree), /Página 2 de 3/)
  assert.equal(engine.calls.process.length, 2)
})

test('corrida com geração: salto supera a página em voo e o resultado velho é descartado', async () => {
  const queue = queueProcess()
  queue.items.push(async () => processResult(pageResponse({ page: 1, numPages: 5 })))
  const slow = deferred()
  queue.items.push(async () => await slow.promise)
  const fast = deferred()
  queue.items.push(async () => await fast.promise)
  const engine = createEngine({
    processImpl: queue.impl,
    fsImpl: { stat: fileStat({ '/fake/pdfs/limites.pdf': LIMITES }) },
  })
  await openMesa(engine)
  await engine.submit('pdfPath', '/fake/pdfs/limites.pdf')

  const p2 = engine.press('page:next') // página 2, presa
  const p5 = engine.submit('page:jump', '5') // supera: página 5
  assert.equal(engine.calls.process.length, 3)
  slow.resolve(processResult(pageResponse({ page: 2, numPages: 5 })))
  await p2
  let tree = await engine.render('desktop')
  assert.match(collectText(tree), /Página 1 de 5/, 'resposta velha não pode vencer')
  fast.resolve(processResult(pageResponse({ page: 5, numPages: 5 })))
  await p5
  tree = await engine.render('desktop')
  assert.match(collectText(tree), /Página 5 de 5/)
  assert.equal(engine.store.get(SESSION_KEY).docs[0].page, 5)
})

test('document turn A/B: troca de PDF durante a página em voo não contamina o estado', async () => {
  const queue = queueProcess()
  queue.items.push(async () => processResult(pageResponse({ path: '/fake/pdfs/a.pdf', name: 'a.pdf', page: 1, numPages: 4 })))
  const slowA = deferred()
  queue.items.push(async () => await slowA.promise)
  const slowB = deferred()
  queue.items.push(async () => await slowB.promise)
  const engine = createEngine({
    processImpl: queue.impl,
    fsImpl: {
      stat: fileStat({
        '/fake/pdfs/a.pdf': { kind: 'file', size: 1, mtimeMs: 0, isLink: false, realPath: '/fake/pdfs/a.pdf' },
        '/fake/pdfs/b.pdf': { kind: 'file', size: 2, mtimeMs: 0, isLink: false, realPath: '/fake/pdfs/b.pdf' },
      }),
    },
  })
  await openMesa(engine)
  await engine.submit('pdfPath', '/fake/pdfs/a.pdf')

  const pNext = engine.press('page:next') // página 2 de A, presa
  const pB = engine.submit('pdfPath', '/fake/pdfs/b.pdf') // vira o documento
  slowA.resolve(processResult(pageResponse({ path: '/fake/pdfs/a.pdf', name: 'a.pdf', page: 2, numPages: 4 })))
  await pNext
  slowB.resolve(processResult(pageResponse({ path: '/fake/pdfs/b.pdf', name: 'b.pdf', page: 1, numPages: 2 })))
  await pB
  assert.equal(engine.calls.process.length, 3)

  const tree = await engine.render('desktop')
  assert.match(collectText(tree), /b\.pdf/)
  assert.match(collectText(tree), /Página 1 de 2/)
  const stored = engine.store.get(SESSION_KEY)
  assert.equal(stored.docs[0].path, '/fake/pdfs/a.pdf')
  assert.equal(stored.docs[0].page, 1, 'página 2 atrasada de A não pode escrever no slot')
  assert.equal(stored.docs[1].path, '/fake/pdfs/b.pdf')
  assert.equal(stored.activeDoc, 1)
})

test('r3-A: página pedida durante a abertura de outro PDF é recusada e não roda depois', async () => {
  const entries = {
    '/fake/pdfs/a.pdf': { kind: 'file', size: 1, mtimeMs: 0, isLink: false, realPath: '/fake/pdfs/a.pdf' },
    '/fake/pdfs/b.pdf': { kind: 'file', size: 2, mtimeMs: 0, isLink: false, realPath: '/fake/pdfs/b.pdf' },
  }
  for (const action of ['prev', 'next', 'jump']) {
    const queue = queueProcess()
    const gate = deferred()
    const reached = deferred()
    const engine = createEngine({
      processImpl: queue.impl,
      fsImpl: {
        stat: async (path) => {
          if (path === '/fake/pdfs/b.pdf') {
            reached.resolve()
            await gate.promise
          }
          const entry = entries[path]
          if (!entry) {
            const err = new Error(`ENOENT: ${path} (fake)`)
            err.code = 'ENOENT'
            throw err
          }
          return entry
        },
      },
    })
    const echo = async () => {
      const req = JSON.parse(engine.calls.process.at(-1).argv[2])
      return processResult(
        pageResponse({
          path: req.path,
          name: req.path.split('/').pop(),
          page: req.page,
          numPages: req.path.endsWith('b.pdf') ? 2 : 4,
        }),
      )
    }
    queue.items.push(echo) // A página 1
    if (action === 'prev') queue.items.push(echo) // A página 2 (o Anterior precisa sair da 1)
    queue.items.push(echo) // B página 1

    await openMesa(engine)
    await engine.submit('pdfPath', '/fake/pdfs/a.pdf')
    if (action === 'prev') await engine.press('page:next')

    const selecting = engine.submit('pdfPath', '/fake/pdfs/b.pdf') // fs.stat de B preso
    await reached.promise
    if (action === 'prev') await engine.press('page:prev')
    else if (action === 'next') await engine.press('page:next')
    else await engine.submit('page:jump', '2')

    let tree = await engine.render('desktop')
    let text = collectText(tree)
    assert.match(text, /Aguarde a abertura do PDF terminar/, `aviso durante o select (${action})`)
    assert.doesNotMatch(text, /na fila/, `nada enfileirado (${action})`)

    gate.resolve()
    await selecting
    tree = await engine.render('desktop')
    assert.doesNotMatch(collectText(tree), /na fila/, `fila vazia depois do select (${action})`)
    assert.equal(engine.calls.process.length, action === 'prev' ? 3 : 2, `sem chamada extra depois do select (${action})`)
    assert.equal(JSON.parse(engine.calls.process.at(-1).argv[2]).path, '/fake/pdfs/b.pdf')
    const stored = engine.store.get(SESSION_KEY)
    assert.equal(stored.activeDoc, 1)
    assert.equal(stored.pdfPath, '/fake/pdfs/b.pdf')
    assert.equal(stored.docs[0].page, action === 'prev' ? 2 : 1, `página de A intocada pelo gesto recusado (${action})`)
    assert.equal(stored.docs[1].path, '/fake/pdfs/b.pdf')
  }
})

test('r3-B: trocar de aba sincroniza o campo; "Carregar PDF" fica na aba vista e o digitado vence', async () => {
  const queue = queueProcess()
  const engine = createEngine({
    processImpl: queue.impl,
    fsImpl: {
      stat: fileStat({
        '/fake/pdfs/a.pdf': { kind: 'file', size: 1, mtimeMs: 0, isLink: false, realPath: '/fake/pdfs/a.pdf' },
        '/fake/pdfs/b.pdf': { kind: 'file', size: 2, mtimeMs: 0, isLink: false, realPath: '/fake/pdfs/b.pdf' },
      }),
    },
  })
  const echo = async () => {
    const req = JSON.parse(engine.calls.process.at(-1).argv[2])
    return processResult(pageResponse({ path: req.path, name: req.path.split('/').pop(), page: req.page, numPages: 3 }))
  }
  queue.items.push(echo) // A página 1
  queue.items.push(echo) // B página 1
  queue.items.push(echo) // A de novo, via "Carregar PDF" sem digitar
  queue.items.push(echo) // B digitado no campo

  await openMesa(engine)
  await engine.submit('pdfPath', '/fake/pdfs/a.pdf')
  await engine.submit('pdfPath', '/fake/pdfs/b.pdf')
  await engine.render('desktop')
  assert.equal(engine.find('pdfPath').props.value, '/fake/pdfs/b.pdf')

  await engine.press('doc:tab:0')
  let tree = await engine.render('desktop')
  assert.match(collectText(tree), /Documento ativo: a\.pdf/)
  assert.equal(engine.find('pdfPath').props.value, '/fake/pdfs/a.pdf', 'campo segue a aba ativa')
  assert.equal(engine.store.get(SESSION_KEY).pdfPath, '/fake/pdfs/a.pdf')

  await engine.press('pdf:load') // sem valor digitado: usa o campo (A, a aba vista)
  assert.equal(JSON.parse(engine.calls.process.at(-1).argv[2]).path, '/fake/pdfs/a.pdf')
  assert.equal(engine.calls.process.length, 3)
  assert.equal(engine.store.get(SESSION_KEY).activeDoc, 0)
  assert.equal(engine.store.get(SESSION_KEY).pdfPath, '/fake/pdfs/a.pdf')

  await engine.type('pdfPath', '/fake/pdfs/b.pdf') // rascunho digitado continua valendo
  await engine.press('pdf:load')
  assert.equal(JSON.parse(engine.calls.process.at(-1).argv[2]).path, '/fake/pdfs/b.pdf', 'caminho digitado vence')
  tree = await engine.render('desktop')
  assert.equal(engine.find('pdfPath').props.value, '/fake/pdfs/b.pdf')
  assert.equal(engine.store.get(SESSION_KEY).activeDoc, 1)
  assert.equal(engine.store.get(SESSION_KEY).pdfPath, '/fake/pdfs/b.pdf')
})

test('r3-B: página atrasada de aba inativa não sobrescreve o caminho da aba ativa', async () => {
  const queue = queueProcess()
  queue.items.push(async () => processResult(pageResponse({ path: '/fake/pdfs/a.pdf', name: 'a.pdf', page: 1, numPages: 3 })))
  queue.items.push(async () => processResult(pageResponse({ path: '/fake/pdfs/b.pdf', name: 'b.pdf', page: 1, numPages: 3 })))
  const slow = deferred()
  queue.items.push(async () => await slow.promise)
  const engine = createEngine({
    processImpl: queue.impl,
    fsImpl: {
      stat: fileStat({
        '/fake/pdfs/a.pdf': { kind: 'file', size: 1, mtimeMs: 0, isLink: false, realPath: '/fake/pdfs/a.pdf' },
        '/fake/pdfs/b.pdf': { kind: 'file', size: 2, mtimeMs: 0, isLink: false, realPath: '/fake/pdfs/b.pdf' },
      }),
    },
  })
  await openMesa(engine)
  await engine.submit('pdfPath', '/fake/pdfs/a.pdf')
  await engine.submit('pdfPath', '/fake/pdfs/b.pdf')
  await engine.render('desktop')

  await engine.press('doc:tab:0') // usuário volta para A
  const loading = engine.press('page:next') // página 2 de A, presa
  await engine.press('doc:tab:1') // e volta para B enquanto A carrega
  let tree = await engine.render('desktop')
  assert.equal(engine.find('pdfPath').props.value, '/fake/pdfs/b.pdf')

  slow.resolve(processResult(pageResponse({ path: '/fake/pdfs/a.pdf', name: 'a.pdf', page: 2, numPages: 3 })))
  await loading
  tree = await engine.render('desktop')
  const stored = engine.store.get(SESSION_KEY)
  assert.match(collectText(tree), /Documento ativo: b\.pdf/)
  assert.equal(engine.find('pdfPath').props.value, '/fake/pdfs/b.pdf', 'resultado de aba inativa não muda o campo')
  assert.equal(stored.pdfPath, '/fake/pdfs/b.pdf')
  assert.equal(stored.activeDoc, 1)
  assert.equal(stored.docs[0].page, 2, 'o slot de A ainda atualiza a página')
})

test('timeout do helper: erro claro, sem reenvio automático e retry manual funciona', async () => {
  const queue = queueProcess()
  queue.items.push(async () => processResult(pageResponse({ page: 1, numPages: 3 })))
  queue.items.push(async () => {
    throw new Error('helper timed out after 60000 ms')
  })
  queue.items.push(async () => processResult(pageResponse({ page: 2, numPages: 3 })))
  const engine = createEngine({
    processImpl: queue.impl,
    fsImpl: { stat: fileStat({ '/fake/pdfs/limites.pdf': LIMITES }) },
  })
  await openMesa(engine)
  await engine.submit('pdfPath', '/fake/pdfs/limites.pdf')

  await engine.press('page:next')
  let tree = await engine.render('desktop')
  const text = collectText(tree)
  assert.match(text, /não respondeu em 60 s/)
  assert.match(text, /Nada foi reenviado automaticamente/)
  assert.doesNotMatch(text, /foi encerrado/, 'o mod não declara o processo morto')
  assert.doesNotMatch(text, /Carregando página/)
  assert.equal(engine.calls.process.length, 2, 'timeout não reenvia sozinho')

  await engine.press('page:next')
  tree = await engine.render('desktop')
  assert.match(collectText(tree), /Página 2 de 3/)
  assert.equal(engine.calls.process.length, 3, 'retry manual acontece uma vez')
})

test('sem $.process: painel e calculadora seguem locais; operação de PDF falha com erro claro', async () => {
  const engine = createEngine({
    fsImpl: { stat: fileStat({ '/fake/pdfs/limites.pdf': LIMITES }) },
  })
  await openMesa(engine)
  delete engine.$.process
  await engine.submit('calc:expr', '2+2')
  let tree = await engine.render('desktop')
  assert.match(collectText(tree), /= 4/)
  assert.equal(engine.calls.process.length, 0)
  assert.equal(engine.calls.promptSubmit.length, 0)

  await engine.submit('pdfPath', '/fake/pdfs/limites.pdf')
  tree = await engine.render('desktop')
  const text = collectText(tree)
  assert.match(text, /A execução local de processos \(\$\.process\.run\) não está disponível/)
  assert.doesNotMatch(text, /Carregando página/)
  assert.equal(engine.calls.promptSubmit.length, 0, 'falha local não inicia o modelo')
})

test('sessão restaura do store sem chamar o helper; store corrompido não quebra nem é sobrescrito', async () => {
  const queue = queueProcess()
  queue.items.push(async () => processResult(pageResponse({ page: 1, numPages: 3 })))
  queue.items.push(async () => processResult(pageResponse({ page: 2, numPages: 3 })))
  const engine1 = createEngine({
    processImpl: queue.impl,
    fsImpl: { stat: fileStat({ '/fake/pdfs/limites.pdf': LIMITES }) },
  })
  await openMesa(engine1)
  await engine1.submit('pdfPath', '/fake/pdfs/limites.pdf')
  await engine1.press('page:next')
  await engine1.submit('subject', 'Cálculo')
  await engine1.submit('question', 'lista 3')
  await engine1.submit('notes', 'revisar limites')

  const engine2 = createEngine({ store: engine1.store })
  await engine2.sessionStart()
  const tree = await engine2.render('desktop')
  assert.equal(validateTree(tree, 'desktop').length, 0)
  assert.match(collectText(tree), /Página 2 de 3/)
  assert.equal(engine2.find('subject').props.value, 'Cálculo')
  assert.equal(engine2.find('question').props.value, 'lista 3')
  assert.equal(engine2.find('notes').props.value, 'revisar limites')
  assert.equal(engine2.calls.process.length, 0, 'restaurar não chama o helper')

  engine2.store.set(SESSION_KEY, { version: 1, subject: 42, docs: 'nope' })
  const engine3 = createEngine({ store: engine2.store })
  await engine3.sessionStart()
  const tree3 = await engine3.render('desktop')
  assert.equal(validateTree(tree3, 'desktop').length, 0)
  assert.equal(engine3.find('subject').props.value, '')
  assert.match(collectText(tree3), /Nenhum PDF carregado/)
  assert.match(collectText(tree3), /estado salvo está corrompido \(campo subject\)/)
  assert.ok(engine3.find('store:replace'))
})

test('store incompatível é preservado até ação explícita de substituição', async () => {
  const store = new Map([[SESSION_KEY, { version: 99, subject: 'intocável' }]])
  const engine = createEngine({ store })
  await openMesa(engine)
  let tree = await engine.render('desktop')
  assert.match(collectText(tree), /versão\/formato incompatível/)
  assert.ok(engine.find('store:replace'))
  assert.equal(engine.find('subject').props.value, '')

  await engine.submit('subject', 'novo')
  assert.deepEqual(engine.store.get(SESSION_KEY), { version: 99, subject: 'intocável' }, 'nada sobrescreve sem ação explícita')

  await engine.press('store:replace')
  tree = await engine.render('desktop')
  assert.equal(engine.find('store:replace'), null)
  assert.doesNotMatch(collectText(tree), /incompatível/)
  const stored = engine.store.get(SESSION_KEY)
  assert.equal(stored.version, 1)
  assert.equal(stored.subject, 'novo')
})

test('gravações concorrentes são serializadas: callback antigo não sobrescreve estado novo', async () => {
  const engine = createEngine()
  const originalSet = engine.$.store.set
  let active = 0
  let maxActive = 0
  const gates = []
  engine.$.store.set = async (key, value) => {
    active += 1
    maxActive = Math.max(maxActive, active)
    await new Promise((resolve) => gates.push(resolve))
    await originalSet(key, value)
    active -= 1
  }
  await openMesa(engine)

  const first = engine.submit('subject', 'Cálculo')
  const second = engine.submit('question', 'lista 3') // digitado enquanto a 1ª escrita está presa
  assert.equal(gates.length, 1, 'só uma escrita começa antes da primeira resolver')
  gates.shift()()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(gates.length, 1, 'a segunda escrita só começa depois da primeira')
  gates.shift()()
  await Promise.all([first, second])

  assert.equal(maxActive, 1, 'nunca há duas escritas concorrentes')
  const stored = engine.store.get(SESSION_KEY)
  assert.equal(stored.subject, 'Cálculo')
  assert.equal(stored.question, 'lista 3', 'o snapshot final contém as duas alterações')
})

test('falha ao salvar fica visível e o próximo gesto grava o estado novo', async () => {
  const engine = createEngine()
  const originalSet = engine.$.store.set
  let failures = 1
  engine.$.store.set = async (key, value) => {
    if (failures > 0) {
      failures -= 1
      throw new Error('disco cheio (fake)')
    }
    return await originalSet(key, value)
  }
  await openMesa(engine)
  await engine.submit('subject', 'Cálculo')
  let tree = await engine.render('desktop')
  const text = collectText(tree)
  assert.match(text, /Armazenamento: Não foi possível salvar o estado/)
  assert.match(text, /disco cheio/)
  assert.equal(engine.store.has(SESSION_KEY), false, 'a falha não grava nada pela metade')

  await engine.submit('notes', 'tentar de novo')
  tree = await engine.render('desktop')
  assert.doesNotMatch(collectText(tree), /Não foi possível salvar/)
  const stored = engine.store.get(SESSION_KEY)
  assert.equal(stored.subject, 'Cálculo')
  assert.equal(stored.notes, 'tentar de novo')
})

test('digitar sem Enter não perde a alteração: onInput grava o campo', async () => {
  const engine = createEngine()
  await openMesa(engine)
  await engine.type('subject', 'Cálculo')
  await engine.type('notes', 'sem enter')
  const stored = engine.store.get(SESSION_KEY)
  assert.equal(stored.subject, 'Cálculo')
  assert.equal(stored.notes, 'sem enter')
  const tree = await engine.render('desktop')
  assert.equal(engine.find('subject').props.value, 'Cálculo')
})

test('calculadora local: sem eval, sem helper, sem modelo; graus/erros', async () => {
  const engine = createEngine()
  await openMesa(engine)
  await engine.submit('calc:expr', 'sin(pi/2)+2^3')
  let tree = await engine.render('desktop')
  assert.match(collectText(tree), /= 9/)
  assert.equal(engine.calls.process.length, 0)
  assert.equal(engine.calls.promptSubmit.length, 0)

  await engine.submit('calc:expr', 'foo(')
  tree = await engine.render('desktop')
  assert.match(collectText(tree), /Calculadora:/)
  assert.equal(engine.calls.process.length, 0)

  await engine.press('calc:degrees')
  await engine.submit('calc:expr', 'sin(90)')
  tree = await engine.render('desktop')
  assert.match(collectText(tree), /= 1/)
  assert.equal(engine.find('calc:degrees').props.label, 'Ângulo: graus')
})

test('captura explícita e análise da captura só depois de existir captura', async () => {
  const queue = queueProcess()
  queue.items.push(async () => processResult(captureResponse()))
  const engine = createEngine({
    processImpl: queue.impl,
    promptImpl: async () => ({ text: 'pedido registrado', origin: { kind: 'plugin', name: 'mesa-study' } }),
  })
  await openMesa(engine)

  await engine.press('capture:run')
  assert.equal(engine.calls.process.length, 1)
  const request = JSON.parse(engine.calls.process[0].argv[2])
  assert.deepEqual(request, { op: 'capture', cacheDir: CACHE })
  let tree = await engine.render('desktop')
  assert.match(collectText(tree), /Captura disponível: \/tmp\/mesa-study-mod\/captura\.png/)
  assert.ok(engine.find('capture:analyze'))

  await engine.press('capture:analyze')
  assert.equal(engine.calls.promptSubmit.length, 1)
  const args = engine.calls.promptSubmit[0]
  assert.ok(!('attachments' in args), 'prompt.submit não carrega anexos')
  assert.match(args.text, /\/tmp\/mesa-study-mod\/captura\.png/)
  assert.match(args.text, /ferramenta Read/)
  tree = await engine.render('desktop')
  assert.match(collectText(tree), /Prompt aceito para a captura/)
  assert.match(collectText(tree), /não estão concluídas/)
  assert.equal(engine.calls.fsRead, 0)
  assert.equal(engine.calls.fsWrite, 0)
})

test('página pedida durante a captura entra na fila e roda quando a captura termina', async () => {
  const queue = queueProcess()
  queue.items.push(async () => processResult(pageResponse({ page: 1, numPages: 3 })))
  let releaseCapture
  queue.items.push(async () => await new Promise((resolve) => (releaseCapture = resolve)))
  queue.items.push(async () => processResult(pageResponse({ page: 2, numPages: 3 })))
  const engine = createEngine({
    processImpl: queue.impl,
    fsImpl: { stat: fileStat({ '/fake/pdfs/limites.pdf': LIMITES }) },
  })
  await openMesa(engine)
  await engine.submit('pdfPath', '/fake/pdfs/limites.pdf')

  const capture = engine.press('capture:run')
  const next = engine.press('page:next')
  let tree = await engine.render('desktop')
  assert.match(collectText(tree), /Página 2 na fila/)
  assert.equal(engine.calls.process.length, 2, 'a página só é pedida depois da captura')
  releaseCapture(processResult(captureResponse()))
  await capture
  await next
  assert.equal(engine.calls.process.length, 3)
  tree = await engine.render('desktop')
  assert.match(collectText(tree), /Página 2 de 3/)
  assert.match(collectText(tree), /Captura disponível/)
})

test('troca de aba durante o carregamento não puxa a aba de volta', async () => {
  const queue = queueProcess()
  queue.items.push(async () => processResult(pageResponse({ path: '/fake/pdfs/a.pdf', name: 'a.pdf', page: 1, numPages: 3 })))
  queue.items.push(async () => processResult(pageResponse({ path: '/fake/pdfs/b.pdf', name: 'b.pdf', page: 1, numPages: 3 })))
  let release
  queue.items.push(async () => await new Promise((resolve) => (release = resolve)))
  const engine = createEngine({
    processImpl: queue.impl,
    fsImpl: {
      stat: fileStat({
        '/fake/pdfs/a.pdf': { kind: 'file', size: 1, mtimeMs: 0, isLink: false, realPath: '/fake/pdfs/a.pdf' },
        '/fake/pdfs/b.pdf': { kind: 'file', size: 2, mtimeMs: 0, isLink: false, realPath: '/fake/pdfs/b.pdf' },
      }),
    },
  })
  await openMesa(engine)
  await engine.submit('pdfPath', '/fake/pdfs/a.pdf')
  await engine.submit('pdfPath', '/fake/pdfs/b.pdf')
  await engine.render('desktop')

  const loading = engine.press('page:next') // página 2 de B (ativa)
  await engine.press('doc:tab:0') // usuário volta para A
  release(processResult(pageResponse({ path: '/fake/pdfs/b.pdf', name: 'b.pdf', page: 2, numPages: 3 })))
  await loading
  const tree = await engine.render('desktop')
  assert.match(collectText(tree), /Documento ativo: a\.pdf/)
  assert.equal(engine.store.get(SESSION_KEY).activeDoc, 0)
})

test('página antiga não é enviada enquanto a nova carrega; depois da carga a prévia certa vai no prompt', async () => {
  const queue = queueProcess()
  queue.items.push(async () => processResult(pageResponse({ page: 1, numPages: 3 })))
  let release
  queue.items.push(async () => await new Promise((resolve) => (release = resolve)))
  const engine = createEngine({
    processImpl: queue.impl,
    fsImpl: { stat: fileStat({ '/fake/pdfs/limites.pdf': LIMITES }) },
    promptImpl: async () => ({ text: 'ok', origin: { kind: 'plugin', name: 'mesa-study' } }),
  })
  await openMesa(engine)
  await engine.submit('pdfPath', '/fake/pdfs/limites.pdf')

  const loading = engine.press('page:next') // página 2 em voo; prévia ainda é a 1
  await engine.press('page:analyze')
  assert.equal(engine.calls.promptSubmit.length, 0, 'não envia a prévia velha durante a carga')
  let tree = await engine.render('desktop')
  assert.match(collectText(tree), /Aguarde a operação atual terminar/)
  release(processResult(pageResponse({ page: 2, numPages: 3 })))
  await loading

  await engine.press('page:analyze')
  assert.equal(engine.calls.promptSubmit.length, 1)
  assert.match(engine.calls.promptSubmit[0].text, /\/tmp\/mesa-study-mod\/pagina-2\.png/)
  assert.match(engine.calls.promptSubmit[0].text, /página 2 de "limites\.pdf"/)
})

test('captura falha: erro claro, sem botão de análise e sem prompt', async () => {
  const queue = queueProcess()
  queue.items.push(async () =>
    processResult({ ok: false, error: { code: 'sem-janela', message: 'Xournal++ não encontrado' } }, 1, ''),
  )
  const engine = createEngine({ processImpl: queue.impl })
  await openMesa(engine)
  await engine.press('capture:run')
  const tree = await engine.render('desktop')
  assert.match(collectText(tree), /Não foi possível capturar: Xournal\+\+ não encontrado/)
  assert.equal(engine.find('capture:analyze'), null)
  assert.equal(engine.calls.promptSubmit.length, 0)
})

test('resposta inválida do helper (SVG grande demais) vira erro e não desenha Svg', async () => {
  const queue = queueProcess()
  queue.items.push(async () => processResult(pageResponse({ svg: `<svg>${'x'.repeat(140_000)}</svg>` })))
  const engine = createEngine({
    processImpl: queue.impl,
    fsImpl: { stat: fileStat({ '/fake/pdfs/limites.pdf': LIMITES }) },
  })
  await openMesa(engine)
  await engine.submit('pdfPath', '/fake/pdfs/limites.pdf')
  const tree = await engine.render('desktop')
  assert.match(collectText(tree), /prévia SVG veio inválida ou passou de 131072/)
  assert.equal(engine.findAll('Svg').length, 0)
  assert.match(collectText(tree), /Sem prévia da página 1 de "limites\.pdf"/)
})

test('prévia omitida pelo host: aviso chega à UI, PNG continua analisável e nada disso vai ao store', async () => {
  const queue = queueProcess()
  const warning =
    'A prévia vetorial da página tem 315581 caracteres e excede o limite de 131072 caracteres; a prévia SVG foi omitida. O PNG da página foi gerado.'
  queue.items.push(async () =>
    processResult(pageResponse({ page: 1, numPages: 4, svg: null, previewWarning: warning })),
  )
  const engine = createEngine({
    processImpl: queue.impl,
    fsImpl: { stat: fileStat({ '/fake/pdfs/limites.pdf': LIMITES }) },
    promptImpl: async () => ({ text: 'ok', origin: { kind: 'plugin', name: 'mesa-study' } }),
  })
  await openMesa(engine)
  await engine.submit('pdfPath', '/fake/pdfs/limites.pdf')
  let tree = await engine.render('desktop')
  assert.equal(engine.findAll('Svg').length, 0, 'SVG omitido não é truncado nem inventado')
  assert.match(collectText(tree), /315581 caracteres/)
  assert.match(collectText(tree), /Página 1 de 4/)

  await engine.press('page:analyze')
  assert.equal(engine.calls.promptSubmit.length, 1)
  assert.match(engine.calls.promptSubmit[0].text, /\/tmp\/mesa-study-mod\/pagina-1\.png/)

  const stored = JSON.stringify(engine.store.get(SESSION_KEY))
  assert.ok(!stored.includes('315581'), 'aviso/estado de UI não vão ao store')
  assert.ok(!stored.includes('svg'))
  assert.ok(!stored.includes('captura'))
})

test('prompt usa o caminho JSON completo (até 4096) e limita só os textos livres', () => {
  const longPath = `/tmp/cache/${'x'.repeat(4_000)}.png`
  const session = { subject: 's'.repeat(500), question: 'q'.repeat(500), notes: 'n'.repeat(5_000) }
  const page = pagePrompt(session, { name: 'a'.repeat(1_000) }, { page: 7, snapshotPath: longPath })
  assert.ok(page.includes(JSON.stringify(longPath)), 'caminho inteiro, sem corte')
  assert.ok(page.includes('s'.repeat(120)) && !page.includes('s'.repeat(121)), 'matéria limitada')
  assert.ok(page.includes('q'.repeat(240)) && !page.includes('q'.repeat(241)), 'questão limitada')
  assert.ok(page.includes('n'.repeat(2_000)) && !page.includes('n'.repeat(2_001)), 'notas limitadas')
  assert.ok(page.length < 12_000)

  const capture = capturePrompt(session, { snapshotPath: longPath, window: { app: 'X'.repeat(500), title: 't'.repeat(500) } })
  assert.ok(capture.includes(JSON.stringify(longPath)))
  assert.ok(capture.length < 12_000)
})

test('JSON inválido do helper com saída 0 também é erro claro', async () => {
  const queue = queueProcess()
  queue.items.push(async () => processResult('não é json', 0))
  const engine = createEngine({
    processImpl: queue.impl,
    fsImpl: { stat: fileStat({ '/fake/pdfs/limites.pdf': LIMITES }) },
  })
  await openMesa(engine)
  await engine.submit('pdfPath', '/fake/pdfs/limites.pdf')
  const tree = await engine.render('desktop')
  assert.match(collectText(tree), /não devolveu JSON válido/)
})

test('restauração só de metadados: abrir o painel e trocar de aba não leem; "Recarregar página" lê a página atual', async () => {
  const echoOf = (engine) => async () => {
    const req = JSON.parse(engine.calls.process.at(-1).argv[2])
    const name = req.path.split('/').pop()
    return processResult(
      pageResponse({
        path: req.path,
        name,
        page: req.page,
        numPages: 4,
        snapshotPath: `/tmp/mesa-study-mod/${name}-p${req.page}.png`,
      }),
    )
  }

  const queue1 = queueProcess()
  const engine1 = createEngine({
    processImpl: queue1.impl,
    fsImpl: {
      stat: fileStat({
        '/fake/pdfs/a.pdf': { kind: 'file', size: 1, mtimeMs: 0, isLink: false, realPath: '/fake/pdfs/a.pdf' },
        '/fake/pdfs/b.pdf': { kind: 'file', size: 2, mtimeMs: 0, isLink: false, realPath: '/fake/pdfs/b.pdf' },
      }),
    },
  })
  queue1.items.push(echoOf(engine1)) // A página 1
  queue1.items.push(echoOf(engine1)) // A página 2
  queue1.items.push(echoOf(engine1)) // B página 1
  await openMesa(engine1)
  await engine1.submit('pdfPath', '/fake/pdfs/a.pdf')
  await engine1.press('page:next')
  await engine1.submit('pdfPath', '/fake/pdfs/b.pdf')

  const queue2 = queueProcess()
  const engine2 = createEngine({
    store: engine1.store,
    processImpl: queue2.impl,
    promptImpl: async () => ({ text: 'aceito', origin: { kind: 'plugin', name: 'mesa-study' } }),
  })
  await engine2.sessionStart()
  await engine2.commandRun()
  let tree = await engine2.render('desktop')
  assert.equal(engine2.calls.process.length, 0, 'restaurar não lê o PDF')
  assert.equal(engine2.calls.promptSubmit.length, 0)
  assert.match(collectText(tree), /Página 1 de 4/)
  assert.match(collectText(tree), /Sem prévia da página 1 de "b\.pdf"/)
  assert.ok(engine2.find('page:reload'))

  // Análise sem prévia restaurada: recusa clara; nada vai ao modelo.
  await engine2.press('page:analyze')
  tree = await engine2.render('desktop')
  assert.equal(engine2.calls.promptSubmit.length, 0)
  assert.match(collectText(tree), /Carregue uma página antes de pedir a análise/)

  // Trocar de aba é só metadados: não lê o PDF nem reusa prévia inexistente.
  await engine2.press('doc:tab:0')
  tree = await engine2.render('desktop')
  assert.equal(engine2.calls.process.length, 0, 'trocar de aba não lê o PDF')
  assert.equal(engine2.find('pdfPath').props.value, '/fake/pdfs/a.pdf')
  assert.match(collectText(tree), /Página 2 de 4/)
  assert.match(collectText(tree), /Sem prévia da página 2 de "a\.pdf"/)
  await engine2.press('page:analyze')
  assert.equal(engine2.calls.promptSubmit.length, 0, 'prévia de outra aba/documento não é enviada')

  // Reload explícito lê a página atual (A, página 2) uma única vez.
  queue2.items.push(echoOf(engine2))
  await engine2.press('page:reload')
  assert.equal(engine2.calls.process.length, 1, 'reload explícito lê uma vez')
  const request = JSON.parse(engine2.calls.process[0].argv[2])
  assert.deepEqual(
    { op: request.op, path: request.path, page: request.page },
    { op: 'page', path: '/fake/pdfs/a.pdf', page: 2 },
  )
  tree = await engine2.render('desktop')
  assert.doesNotMatch(collectText(tree), /Sem prévia da página/)
  assert.equal(engine2.findAll('Svg').length, 1)
  const stored = engine2.store.get(SESSION_KEY)
  assert.equal(stored.docs[0].path, '/fake/pdfs/a.pdf')
  assert.equal(stored.docs[0].page, 2)
  assert.equal(stored.activeDoc, 0)
  assert.equal(stored.pdfPath, '/fake/pdfs/a.pdf')

  await engine2.press('page:analyze')
  assert.equal(engine2.calls.promptSubmit.length, 1)
  assert.match(engine2.calls.promptSubmit[0].text, /a\.pdf-p2\.png/)
  assert.match(collectText(await engine2.render('desktop')), /não estão concluídas/)
})

test('fechar o PDF ativo: remove só o documento certo, remapeia caminho/prévias e não reusa imagem antiga', async () => {
  const queue = queueProcess()
  const engine = createEngine({
    processImpl: queue.impl,
    fsImpl: {
      stat: fileStat({
        '/fake/pdfs/a.pdf': { kind: 'file', size: 1, mtimeMs: 0, isLink: false, realPath: '/fake/pdfs/a.pdf' },
        '/fake/pdfs/b.pdf': { kind: 'file', size: 2, mtimeMs: 0, isLink: false, realPath: '/fake/pdfs/b.pdf' },
      }),
    },
    promptImpl: async () => ({ text: 'aceito', origin: { kind: 'plugin', name: 'mesa-study' } }),
  })
  queue.items.push(async () =>
    processResult(
      pageResponse({
        path: '/fake/pdfs/a.pdf',
        name: 'a.pdf',
        page: 1,
        numPages: 2,
        svg: '<svg data-doc="a"></svg>',
        snapshotPath: '/tmp/mesa-study-mod/a-p1.png',
      }),
    ),
  )
  queue.items.push(async () =>
    processResult(
      pageResponse({
        path: '/fake/pdfs/b.pdf',
        name: 'b.pdf',
        page: 1,
        numPages: 2,
        svg: '<svg data-doc="b"></svg>',
        snapshotPath: '/tmp/mesa-study-mod/b-p1.png',
      }),
    ),
  )
  await openMesa(engine)
  await engine.submit('pdfPath', '/fake/pdfs/a.pdf')
  await engine.submit('pdfPath', '/fake/pdfs/b.pdf')
  await engine.render('desktop')

  // A prévia enviável é a do documento ativo (B).
  await engine.press('page:analyze')
  assert.equal(engine.calls.promptSubmit.length, 1)
  assert.match(engine.calls.promptSubmit[0].text, /b-p1\.png/)

  await engine.press('pdf:close')
  let tree = await engine.render('desktop')
  assert.match(collectText(tree), /PDF fechado: b\.pdf/)
  assert.match(collectText(tree), /Documento ativo: a\.pdf/)
  assert.equal(engine.find('pdfPath').props.value, '/fake/pdfs/a.pdf')
  assert.equal(engine.findAll('Svg')[0].props.source, '<svg data-doc="a"></svg>')
  let stored = engine.store.get(SESSION_KEY)
  assert.deepEqual(stored.docs.map((doc) => doc.path), ['/fake/pdfs/a.pdf'])
  assert.equal(stored.activeDoc, 0)
  assert.equal(stored.pdfPath, '/fake/pdfs/a.pdf')
  assert.equal(engine.find('doc:tab:0'), null, 'com um só documento não há abas')

  // A imagem do documento fechado nunca entra no próximo prompt.
  await engine.press('page:analyze')
  assert.equal(engine.calls.promptSubmit.length, 2)
  assert.match(engine.calls.promptSubmit[1].text, /a-p1\.png/)
  assert.doesNotMatch(engine.calls.promptSubmit[1].text, /b-p1\.png/)

  // Fechar o último documento zera o estado (prévias incluídas).
  await engine.press('pdf:close')
  tree = await engine.render('desktop')
  assert.match(collectText(tree), /Nenhum PDF aberto agora/)
  assert.match(collectText(tree), /Nenhum PDF carregado/)
  stored = engine.store.get(SESSION_KEY)
  assert.deepEqual(stored.docs, [])
  assert.equal(stored.activeDoc, 0)
  assert.equal(stored.pdfPath, '')
  assert.equal(engine.find('pdf:close').props.dimColor, true)
  await engine.press('page:analyze')
  tree = await engine.render('desktop')
  assert.equal(engine.calls.promptSubmit.length, 2, 'sem documento, nada é enviado')
  assert.match(collectText(tree), /Carregue uma página antes de pedir a análise/)
})

test('fechar o primeiro PDF mantém a prévia e a análise do segundo sem recarregar', async () => {
  const queue = queueProcess()
  const stats = {}
  for (const name of ['a', 'b']) {
    const path = `/fake/pdfs/${name}.pdf`
    stats[path] = { kind: 'file', realPath: path }
    queue.items.push(async () => processResult(pageResponse({
      path, name: `${name}.pdf`, page: 1, numPages: 2,
      svg: `<svg data-doc="${name}"></svg>`,
      snapshotPath: `/tmp/mesa-study-mod/${name}-p1.png`,
    })))
  }
  const engine = createEngine({
    processImpl: queue.impl,
    fsImpl: { stat: fileStat(stats) },
    promptImpl: async () => ({ text: 'aceito' }),
  })
  await openMesa(engine)
  await engine.submit('pdfPath', '/fake/pdfs/a.pdf')
  await engine.submit('pdfPath', '/fake/pdfs/b.pdf')
  await engine.render('desktop')
  await engine.press('doc:tab:0')
  await engine.render('desktop')
  await engine.press('pdf:close')
  const tree = await engine.render('desktop')
  assert.match(collectText(tree), /Documento ativo: b\.pdf/)
  assert.equal(engine.find('pdfPath').props.value, '/fake/pdfs/b.pdf')
  assert.equal(engine.findAll('Svg')[0].props.source, '<svg data-doc="b"></svg>')
  const stored = engine.store.get(SESSION_KEY)
  assert.deepEqual(stored.docs.map(doc => doc.path), ['/fake/pdfs/b.pdf'])
  assert.equal(stored.activeDoc, 0)
  assert.equal(stored.pdfPath, '/fake/pdfs/b.pdf')
  assert.equal(engine.calls.process.length, 2, 'fechar não recarrega o PDF restante')
  assert.equal(engine.calls.promptSubmit.length, 0, 'fechar não chama o modelo')
  await engine.press('page:analyze')
  assert.equal(engine.calls.promptSubmit.length, 1)
  assert.match(engine.calls.promptSubmit[0].text, /b-p1\.png/)
  assert.doesNotMatch(engine.calls.promptSubmit[0].text, /a-p1\.png/)
})

test('terceiro PDF substitui o segundo: aviso visível, toast e prévia coerente', async () => {
  const queue = queueProcess()
  const engine = createEngine({
    processImpl: queue.impl,
    fsImpl: {
      stat: fileStat({
        '/fake/pdfs/a.pdf': { kind: 'file', size: 1, mtimeMs: 0, isLink: false, realPath: '/fake/pdfs/a.pdf' },
        '/fake/pdfs/b.pdf': { kind: 'file', size: 2, mtimeMs: 0, isLink: false, realPath: '/fake/pdfs/b.pdf' },
        '/fake/pdfs/c.pdf': { kind: 'file', size: 3, mtimeMs: 0, isLink: false, realPath: '/fake/pdfs/c.pdf' },
      }),
    },
    promptImpl: async () => ({ text: 'aceito', origin: { kind: 'plugin', name: 'mesa-study' } }),
  })
  const load = (name, page = 1) => async () =>
    processResult(
      pageResponse({
        path: `/fake/pdfs/${name}.pdf`,
        name: `${name}.pdf`,
        page,
        numPages: 2,
        svg: `<svg data-doc="${name}"></svg>`,
        snapshotPath: `/tmp/mesa-study-mod/${name}-p${page}.png`,
      }),
    )
  queue.items.push(load('a'))
  queue.items.push(load('b'))
  queue.items.push(load('c'))
  await openMesa(engine)
  await engine.submit('pdfPath', '/fake/pdfs/a.pdf')
  await engine.submit('pdfPath', '/fake/pdfs/b.pdf')
  await engine.submit('pdfPath', '/fake/pdfs/c.pdf')
  const tree = await engine.render('desktop')
  assert.match(collectText(tree), /O segundo leitor foi substituído: "b\.pdf" saiu, "c\.pdf" entrou/)
  assert.ok(
    engine.calls.logs.some((line) => line.kind === 'toast' && /b\.pdf/.test(line.text) && /c\.pdf/.test(line.text)),
    'toast visível com o aviso de substituição',
  )
  const stored = engine.store.get(SESSION_KEY)
  assert.deepEqual(stored.docs.map((doc) => doc.path), ['/fake/pdfs/a.pdf', '/fake/pdfs/c.pdf'])
  assert.equal(stored.activeDoc, 1)
  assert.equal(stored.pdfPath, '/fake/pdfs/c.pdf')
  assert.equal(engine.findAll('Svg')[0].props.source, '<svg data-doc="c"></svg>')

  await engine.press('page:analyze')
  assert.equal(engine.calls.promptSubmit.length, 1)
  assert.match(engine.calls.promptSubmit[0].text, /c-p1\.png/)
  assert.doesNotMatch(engine.calls.promptSubmit[0].text, /b-p1\.png/)
})

test('corridas: fechar/recarregar/capturar/trocar página são recusados durante operação e envio; depois funcionam', async () => {
  const queue = queueProcess()
  const loading = deferred()
  let releasePrompt
  const engine = createEngine({
    processImpl: queue.impl,
    fsImpl: {
      stat: fileStat({
        '/fake/pdfs/a.pdf': { kind: 'file', size: 1, mtimeMs: 0, isLink: false, realPath: '/fake/pdfs/a.pdf' },
      }),
    },
    promptImpl: async () => await new Promise((resolve) => (releasePrompt = resolve)),
  })
  queue.items.push(async () =>
    processResult(
      pageResponse({
        path: '/fake/pdfs/a.pdf',
        name: 'a.pdf',
        page: 1,
        numPages: 3,
        snapshotPath: '/tmp/mesa-study-mod/a-p1.png',
      }),
    ),
  )
  await openMesa(engine)
  await engine.submit('pdfPath', '/fake/pdfs/a.pdf')

  // Operação de página presa: fechar e recarregar são recusados com aviso.
  queue.items.push(async () => await loading.promise)
  const pending = engine.press('page:next')
  await engine.press('pdf:close')
  let tree = await engine.render('desktop')
  assert.match(collectText(tree), /Aguarde a operação atual terminar para fechar o PDF/)
  assert.equal(engine.store.get(SESSION_KEY).docs.length, 1, 'o documento não foi removido')
  await engine.press('page:reload')
  tree = await engine.render('desktop')
  assert.match(collectText(tree), /Aguarde a operação atual terminar para recarregar a página/)
  assert.equal(engine.calls.process.length, 2, 'nenhuma chamada nova durante a operação')
  loading.resolve(
    processResult(
      pageResponse({
        path: '/fake/pdfs/a.pdf',
        name: 'a.pdf',
        page: 2,
        numPages: 3,
        snapshotPath: '/tmp/mesa-study-mod/a-p2.png',
      }),
    ),
  )
  await pending
  tree = await engine.render('desktop')
  assert.match(collectText(tree), /Página 2 de 3/)

  // Envio em andamento: fechar, recarregar, capturar e trocar de página são recusados.
  const sending = engine.press('page:analyze')
  await engine.press('pdf:close')
  tree = await engine.render('desktop')
  assert.match(collectText(tree), /Aguarde o envio do prompt terminar para fechar o PDF/)
  await engine.press('page:reload')
  tree = await engine.render('desktop')
  assert.match(collectText(tree), /Aguarde o envio do prompt terminar para recarregar a página/)
  await engine.press('capture:run')
  tree = await engine.render('desktop')
  assert.match(collectText(tree), /Aguarde o envio do prompt terminar para capturar de novo/)
  const callsBefore = engine.calls.process.length
  await engine.press('page:next')
  tree = await engine.render('desktop')
  assert.match(collectText(tree), /Aguarde o envio do prompt terminar para trocar de página/)
  assert.equal(engine.calls.process.length, callsBefore)
  const frozen = engine.store.get(SESSION_KEY)
  assert.equal(frozen.docs.length, 1, 'fechar durante o envio não remove nada')
  assert.equal(frozen.docs[0].page, 2, 'trocar página durante o envio não avança')

  releasePrompt({ text: 'aceito', origin: { kind: 'plugin', name: 'mesa-study' } })
  await sending
  tree = await engine.render('desktop')
  assert.match(collectText(tree), /Prompt aceito para a página 2/)
  assert.match(collectText(tree), /não estão concluídas/, 'aceite nunca vira leitura/modelo concluído')

  // Terminado o envio, fechar funciona de verdade.
  await engine.press('pdf:close')
  tree = await engine.render('desktop')
  assert.match(collectText(tree), /PDF fechado: a\.pdf/)
  assert.deepEqual(engine.store.get(SESSION_KEY).docs, [])
})
