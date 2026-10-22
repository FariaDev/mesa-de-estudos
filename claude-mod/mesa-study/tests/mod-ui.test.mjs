// tests/mod-ui.test.mjs — UI, padrões oficiais e envio explícito.
//
// Confere: hooks registrados só nos eventos certos, árvore válida nas quatro
// superfícies (fallback de terminal/mobile), nenhuma chamada ao modelo em
// navegação/calculadora, `prompt.submit` sem anexos com pedido de `Read` do
// PNG absoluto, drop tratado como recusa e "prompt aceito" sem marcar leitura
// ou interpretação como concluídas.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectText, createEngine, captureResponse, pageResponse, processResult, validateTree } from './mod-harness.test.mjs'

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

const LIMITES = { kind: 'file', size: 1, mtimeMs: 0, isLink: false, realPath: '/fake/pdfs/limites.pdf' }

async function loadPage(engine, page = 1, numPages = 3) {
  await engine.sessionStart()
  await engine.commandRun()
  await engine.render('desktop')
  await engine.submit('pdfPath', '/fake/pdfs/limites.pdf')
}

test('padrões e matchers dos hooks são os oficiais; nenhum evento inventado', async () => {
  const engine = createEngine()
  const patterns = engine.hooks.map((h) => h.pattern)
  assert.deepEqual([...patterns].sort(), ['command.run', 'session.start', 'ui.close', 'ui.open', 'ui.render'])
  for (const hook of engine.hooks) {
    if (hook.pattern === 'command.run') assert.deepEqual(hook.matcher, { command: 'mesa' })
    if (hook.pattern === 'ui.render') assert.deepEqual(hook.matcher, { component: 'Pane', requestId: 'mesa-study' })
    if (hook.pattern === 'ui.open') assert.deepEqual(hook.matcher, { id: 'mesa-study' })
    if (hook.pattern === 'ui.close') assert.deepEqual(hook.matcher, { id: 'mesa-study' })
    if (hook.pattern === 'session.start') assert.equal(hook.matcher, undefined)
  }
  // Nada de ui.press, tool.call, prompt.submit, PreToolUse: o mod não usa.
  assert.ok(!patterns.includes('ui.press'))
  assert.ok(!patterns.includes('tool.call'))
  assert.ok(!patterns.includes('prompt.submit'))
})

test('árvore válida nas quatro superfícies; terminal sem Svg, mobile sem Input/Select', async () => {
  const queue = queueProcess()
  queue.items.push(async () => processResult(pageResponse({ page: 1, numPages: 3 })))
  const engine = createEngine({
    processImpl: queue.impl,
    fsImpl: { stat: fileStat({ '/fake/pdfs/limites.pdf': LIMITES }) },
  })
  await loadPage(engine)

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile']) {
    const tree = await engine.render(surface)
    const problems = validateTree(tree, surface)
    assert.equal(problems.length, 0, `${surface}: ${problems.join('\n')}`)
    assert.ok(engine.find('page:analyze'), `${surface}: botão de análise`)
    assert.ok(engine.find('capture:run'), `${surface}: botão de captura`)
    assert.ok(engine.find('page:reload'), `${surface}: botão de recarregar`)
    assert.ok(engine.find('pdf:close'), `${surface}: botão de fechar`)
    assert.ok(engine.find('calc:eval'), `${surface}: calculadora`)
    if (surface === 'terminal') {
      assert.equal(engine.findAll('Svg').length, 0, 'terminal não desenha Svg')
      assert.match(collectText(tree), /não desenha SVG/)
      assert.ok(engine.find('pdfPath'), 'terminal tem Input')
    }
    if (surface === 'mobile') {
      assert.equal(engine.findAll('Input').length, 0, 'mobile não tem Input')
      assert.equal(engine.findAll('Select').length, 0, 'mobile não tem Select')
      assert.equal(engine.findAll('Svg').length, 1, 'mobile desenha Svg')
      assert.match(collectText(tree), /Matéria: /)
    }
    if (surface === 'desktop' || surface === 'vscode') {
      assert.equal(engine.findAll('Svg').length, 1)
      assert.ok(engine.find('pdfPath'))
      assert.ok(engine.find('notes'))
    }
  }
})

test('navegação e calculadora não chamam o modelo nem submetem prompt', async () => {
  const queue = queueProcess()
  queue.items.push(async () => processResult(pageResponse({ page: 1, numPages: 3 })))
  queue.items.push(async () => processResult(pageResponse({ page: 2, numPages: 3 })))
  const engine = createEngine({
    processImpl: queue.impl,
    fsImpl: { stat: fileStat({ '/fake/pdfs/limites.pdf': LIMITES }) },
  })
  await loadPage(engine)
  await engine.press('page:next')
  await engine.press('calc:eval')
  await engine.submit('calc:expr', '2+2')
  await engine.render('desktop')
  assert.equal(engine.calls.promptSubmit.length, 0, 'nenhuma inferência sem ação explícita')
})

test('botão de navegação fica dim durante o carregamento, mas o guard é o callback', async () => {
  const queue = queueProcess()
  queue.items.push(async () => processResult(pageResponse({ page: 1, numPages: 3 })))
  let release
  queue.items.push(async () => await new Promise((resolve) => (release = resolve)))
  const engine = createEngine({
    processImpl: queue.impl,
    fsImpl: { stat: fileStat({ '/fake/pdfs/limites.pdf': LIMITES }) },
  })
  await loadPage(engine)
  const pending = engine.press('page:next')
  const tree = await engine.render('desktop')
  assert.equal(engine.find('page:next').props.dimColor, true, 'visual de busy')
  assert.match(collectText(tree), /Carregando página/)
  const calls = engine.calls.process.length
  await engine.press('page:next') // callback guard: não duplica
  assert.equal(engine.calls.process.length, calls)
  release(processResult(pageResponse({ page: 2, numPages: 3 })))
  await pending
})

test('análise da página: sem prévia é erro; com prévia o texto pede Read do PNG absoluto, sem anexos', async () => {
  const queue = queueProcess()
  queue.items.push(async () => processResult(pageResponse({ page: 1, numPages: 3 })))
  const engine = createEngine({
    processImpl: queue.impl,
    fsImpl: { stat: fileStat({ '/fake/pdfs/limites.pdf': LIMITES }) },
    promptImpl: async () => ({ text: 'pedido registrado', origin: { kind: 'plugin', name: 'mesa-study' } }),
  })
  await engine.sessionStart()
  await engine.commandRun()
  await engine.render('desktop')
  await engine.press('page:analyze')
  let tree = await engine.render('desktop')
  assert.match(collectText(tree), /Carregue uma página antes de pedir a análise/)
  assert.equal(engine.calls.promptSubmit.length, 0)

  await engine.submit('subject', 'Cálculo')
  await engine.submit('question', 'lista 3')
  await engine.submit('pdfPath', '/fake/pdfs/limites.pdf')
  await engine.press('page:analyze')
  assert.equal(engine.calls.promptSubmit.length, 1)
  const args = engine.calls.promptSubmit[0]
  assert.deepEqual(Object.keys(args).sort(), ['text'])
  assert.match(args.text, /ferramenta Read/)
  assert.match(args.text, /\/tmp\/mesa-study-mod\/pagina-1\.png/)
  assert.match(args.text, /página 1 de "limites\.pdf"/)
  assert.match(args.text, /Cálculo/)
  assert.match(args.text, /lista 3/)
  tree = await engine.render('desktop')
  const text = collectText(tree)
  assert.match(text, /Prompt aceito para a página 1/)
  assert.match(text, /não estão concluídas/)
  assert.doesNotMatch(text, /leitura concluída|interpretação concluída|análise concluída/)
})

test('drop do prompt.submit: erro claro, sem "aceito" e sem marcar leitura', async () => {
  const queue = queueProcess()
  queue.items.push(async () => processResult(pageResponse({ page: 1, numPages: 3 })))
  let mode = 'drop'
  const engine = createEngine({
    processImpl: queue.impl,
    fsImpl: { stat: fileStat({ '/fake/pdfs/limites.pdf': LIMITES }) },
    promptImpl: async () =>
      mode === 'drop'
        ? { drop: 'recusado pelo usuário' }
        : { text: 'ok', origin: { kind: 'plugin', name: 'mesa-study' } },
  })
  await loadPage(engine)
  await engine.press('page:analyze')
  let tree = await engine.render('desktop')
  const text = collectText(tree)
  assert.match(text, /Envio recusado: recusado pelo usuário/)
  assert.doesNotMatch(text, /Prompt aceito/)
  assert.doesNotMatch(text, /concluída/)

  // Retry manual permitido, sem auto-reenvio entre as tentativas.
  assert.equal(engine.calls.promptSubmit.length, 1)
  mode = 'ok'
  await engine.press('page:analyze')
  tree = await engine.render('desktop')
  assert.match(collectText(tree), /Prompt aceito para a página 1/)
  assert.equal(engine.calls.promptSubmit.length, 2)
})

test('dois cliques em "Pedir análise" não enviam dois prompts', async () => {
  const queue = queueProcess()
  queue.items.push(async () => processResult(pageResponse({ page: 1, numPages: 3 })))
  let release
  const engine = createEngine({
    processImpl: queue.impl,
    fsImpl: { stat: fileStat({ '/fake/pdfs/limites.pdf': LIMITES }) },
    promptImpl: async () => await new Promise((resolve) => (release = resolve)),
  })
  await loadPage(engine)
  const p1 = engine.press('page:analyze')
  const p2 = engine.press('page:analyze')
  assert.equal(engine.calls.promptSubmit.length, 1)
  release({ text: 'ok', origin: { kind: 'plugin', name: 'mesa-study' } })
  await Promise.all([p1, p2])
  assert.equal(engine.calls.promptSubmit.length, 1)
})

test('sem captura o botão de análise não aparece e nada é chamado', async () => {
  const engine = createEngine()
  await engine.sessionStart()
  await engine.commandRun()
  const tree = await engine.render('desktop')
  assert.equal(engine.find('capture:analyze'), null)
  assert.ok(engine.find('capture:run'))
  assert.doesNotMatch(collectText(tree), /Captura disponível/)
  assert.equal(engine.calls.process.length, 0)
  assert.equal(engine.calls.promptSubmit.length, 0)
})

test('ui.open recusado por outro hook: nada de "aberta", painel não é listado e o texto explica', async () => {
  const engine = createEngine()
  engine.hooks.push({
    pattern: 'ui.open',
    matcher: { id: 'mesa-study' },
    hook: async () => ({ deny: 'painel recusado pelo host' }),
  })
  await engine.sessionStart()
  const result = await engine.commandRun()
  assert.equal(typeof result.text, 'string')
  assert.match(result.text, /Não foi possível abrir a Mesa de Estudos/)
  assert.match(result.text, /painel recusado pelo host/)
  assert.equal((await engine.$.ui.panes()).length, 0)
  // Um redraw posterior (hot reload) ainda funciona, mas nada foi afirmado antes.
  const tree = await engine.render('desktop')
  assert.equal(validateTree(tree, 'desktop').length, 0)
})

test('ui.close recusado mantém o painel e o estado: só limpa quando o resultado não é recusa', async () => {
  const engine = createEngine()
  await engine.sessionStart()
  await engine.commandRun()
  await engine.render('desktop')
  const deny = { pattern: 'ui.close', matcher: { id: 'mesa-study' }, hook: async () => ({ deny: 'fica aberto' }) }
  engine.hooks.push(deny)

  const result = await engine.closePane()
  assert.equal(result.deny, 'fica aberto')
  assert.equal((await engine.$.ui.panes()).length, 1, 'painel segue aberto')
  const before = engine.calls.invalidate.length
  await engine.submit('calc:expr', '1+1')
  assert.ok(engine.calls.invalidate.length > before, 'estado segue vivo enquanto o painel está aberto')

  engine.hooks.splice(engine.hooks.indexOf(deny), 1)
  await engine.closePane()
  assert.equal((await engine.$.ui.panes()).length, 0, 'sem recusa, o close limpa o estado')
})

test('durante a captura o pedido de análise da captura anterior não é enviado', async () => {
  const queue = queueProcess()
  queue.items.push(async () => processResult(pageResponse({ page: 1, numPages: 2 })))
  queue.items.push(async () => processResult(captureResponse()))
  let release
  queue.items.push(async () => await new Promise((resolve) => (release = resolve)))
  const engine = createEngine({
    processImpl: queue.impl,
    fsImpl: { stat: fileStat({ '/fake/pdfs/limites.pdf': LIMITES }) },
    promptImpl: async () => ({ text: 'ok', origin: { kind: 'plugin', name: 'mesa-study' } }),
  })
  await loadPage(engine)
  await engine.press('capture:run') // primeira captura, libera
  await engine.render('desktop')
  const recapture = engine.press('capture:run') // segunda captura presa
  await engine.press('capture:analyze') // não pode enviar a captura antiga
  assert.equal(engine.calls.promptSubmit.length, 0)
  const tree = await engine.render('desktop')
  assert.match(collectText(tree), /Aguarde a operação atual terminar/)
  release(processResult(captureResponse({ snapshotPath: '/tmp/mesa-study-mod/captura-2.png' })))
  await recapture
})

test('rótulos explícitos e chaves estáveis: capturar, recarregar e fechar', async () => {
  const queue = queueProcess()
  queue.items.push(async () => processResult(pageResponse({ page: 1, numPages: 3 })))
  const engine = createEngine({
    processImpl: queue.impl,
    fsImpl: { stat: fileStat({ '/fake/pdfs/limites.pdf': LIMITES }) },
  })
  await loadPage(engine)
  await engine.render('desktop')
  assert.equal(engine.find('capture:run').props.label, 'Capturar Xournal++')
  assert.equal(engine.find('page:reload').props.label, 'Recarregar página')
  assert.equal(engine.find('pdf:close').props.label, 'Fechar PDF')
  assert.equal(engine.find('page:analyze').props.label, 'Pedir análise da página')
  assert.equal(engine.find('capture:analyze'), null, 'análise da captura só existe depois de capturar')
})

test('dimColor é cosmético: botão apagado continua recusando no callback, sem helper nem modelo', async () => {
  const engine = createEngine()
  await engine.sessionStart()
  await engine.commandRun()
  await engine.render('desktop')
  assert.equal(engine.find('pdf:close').props.dimColor, true, 'sem PDF o botão fica apagado')
  assert.equal(engine.find('page:reload').props.dimColor, true)
  await engine.press('pdf:close')
  let tree = await engine.render('desktop')
  assert.match(collectText(tree), /Nenhum PDF aberto para fechar/)
  await engine.press('page:reload')
  tree = await engine.render('desktop')
  assert.match(collectText(tree), /Nenhum PDF aberto para recarregar/)
  await engine.press('page:analyze')
  tree = await engine.render('desktop')
  assert.match(collectText(tree), /Carregue uma página antes de pedir a análise/)
  assert.equal(engine.calls.process.length, 0)
  assert.equal(engine.calls.promptSubmit.length, 0)
})
