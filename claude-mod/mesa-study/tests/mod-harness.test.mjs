// tests/mod-harness.test.mjs — engine fake realista para os testes do mod.
//
// Cobre o contrato que os hooks usam: store (JSON), process.run (argv/init),
// prompt.submit, command.register, fs.stat/list, ui.open/close/invalidate e
// ui.resolve/render com as tabelas por superfície (terminal sem Svg, mobile
// sem Input/Select). O "driver" acha elementos por `key`, pressiona Buttons e
// digita/submete Inputs e escolhe Selects, como o host faria.
//
// Este arquivo não fala com o Desktop, com o helper real, com o modelo nem
// com materiais de curso: tudo é simulado.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { register } from '../hooks/register.mjs'

const PLUGIN = 'mesa-study'

// ---------- utilidades ----------

export function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

function strip(props, remove) {
  const out = {}
  for (const [key, value] of Object.entries(props || {})) {
    if (key === 'children' || remove.includes(key) || value === undefined) continue
    out[key] = value
  }
  return out
}

function normalizeChildren(children) {
  const out = []
  const walk = (child) => {
    if (child === null || child === undefined || typeof child === 'boolean') return
    if (Array.isArray(child)) {
      for (const item of child) walk(item)
      return
    }
    out.push(child)
  }
  walk(children)
  return out
}

function element(type, props, children, remove) {
  return { type, props: strip(props, remove || []), children: normalizeChildren(children) }
}

/** Tabela de elementos por superfície, como `$.ui.resolve(e)` devolveria. */
export function makeElementTable(surface, handlers) {
  const Box = (props) => element('Box', props, props && props.children)
  const Text = (props) => element('Text', props, props && props.children)
  const Button = (props) => {
    const handle = handlers.push(props.onPress) - 1
    const el = element('Button', props, undefined, ['onPress'])
    el.press = { plugin: PLUGIN, handle }
    return el
  }
  const Input = (props) => {
    const handle = handlers.push({ onInput: props.onInput, onSubmit: props.onSubmit }) - 1
    const el = element('Input', props, undefined, ['onInput', 'onSubmit'])
    el.press = { plugin: PLUGIN, handle }
    return el
  }
  const Select = (props) => {
    const handle = handlers.push({ onSelect: props.onSelect }) - 1
    const el = element('Select', props, undefined, ['onSelect'])
    el.press = { plugin: PLUGIN, handle }
    return el
  }
  const Svg = (props) => element('Svg', props, undefined, [])
  const noop = (props) => element('Box', props, props && props.children)
  const table = { Box, Text, Button, Input, Select, Svg, Link: noop, Code: noop, Markdown: noop }
  if (surface === 'terminal') delete table.Svg
  if (surface === 'mobile') {
    delete table.Input
    delete table.Select
  }
  return Object.freeze(table)
}

// ---------- engine fake ----------

export function createEngine({ options = {}, store, processImpl, promptImpl, fsImpl } = {}) {
  const storeMap = store || new Map()
  const calls = {
    process: [],
    promptSubmit: [],
    commandRegister: [],
    commandRun: [],
    uiOpen: [],
    uiClose: [],
    invalidate: [],
    logs: [],
    fsStat: [],
    fsList: [],
    fsRead: 0,
    fsWrite: 0,
  }
  const hooks = []
  const runtime = {
    surface: 'desktop',
    handlers: [],
    lastTree: null,
    pressCounts: {},
    panes: [],
  }

  const runProcess =
    processImpl ||
    (async () => {
      throw new Error('process.run não configurado neste teste')
    })
  const runPrompt =
    promptImpl ||
    (async () => {
      throw new Error('prompt.submit não configurado neste teste')
    })
  const fs = {
    stat: fsImpl && fsImpl.stat ? fsImpl.stat : async () => {
      const err = new Error('ENOENT: arquivo não encontrado (fake)')
      err.code = 'ENOENT'
      throw err
    },
    list: fsImpl && fsImpl.list ? fsImpl.list : async () => {
      throw new Error('fs.list não configurado neste teste')
    },
  }

  function on(pattern, matcherOrHook, maybeHook) {
    const matcher = typeof matcherOrHook === 'function' ? undefined : matcherOrHook
    const hook = typeof matcherOrHook === 'function' ? matcherOrHook : maybeHook
    hooks.push({ pattern, matcher, hook })
    return {
      catch() {
        throw new Error('catch não é usado pelos hooks do mod')
      },
    }
  }

  const $ = {
    plugin: { name: PLUGIN, root: '/fake/mesa-study' },
    store: {
      get: async (key) => clone(storeMap.get(key)),
      set: async (key, value) => {
        storeMap.set(key, clone(value))
      },
      delete: async (key) => {
        storeMap.delete(key)
      },
      keys: async () => [...storeMap.keys()],
    },
    process: {
      run: async (argv, init) => {
        calls.process.push({ argv: [...argv], init: init ? { ...init } : undefined })
        return await runProcess(argv, init)
      },
    },
    prompt: {
      submit: async (args) => {
        calls.promptSubmit.push(clone(args))
        return await runPrompt(args)
      },
    },
    command: {
      register: async (spec) => {
        calls.commandRegister.push(clone(spec))
        return { command: spec.name }
      },
      list: async () => [],
      run: async (args) => {
        calls.commandRun.push(clone(args))
        return {}
      },
    },
    fs: {
      stat: async (path, opts) => {
        calls.fsStat.push(path)
        return await fs.stat(path, opts)
      },
      list: async (path) => {
        calls.fsList.push(path)
        return await fs.list(path)
      },
      read: async () => {
        calls.fsRead += 1
        throw new Error('$.fs.read não é permitido no mod (só helper/cache)')
      },
      write: async () => {
        calls.fsWrite += 1
        throw new Error('$.fs.write não é permitido no mod (só helper/cache)')
      },
      exists: async () => false,
    },
    ui: {
      resolve: (e) => makeElementTable(e.surface, runtime.handlers),
      open: async (args) => {
        calls.uiOpen.push(clone(args))
        // Semântica de operação do contrato: `next(e)` resolve `{ value }` ou
        // `{ deny }`; uma recusa faz `$.ui.open` rejeitar e nada é colocado.
        const result = await dispatch(
          'ui.open',
          { id: args.id, title: args.title, focus: args.focus, closeOnEscape: args.closeOnEscape, columns: args.columns },
          (e) => {
            for (const pane of runtime.panes) pane.isShown = false
            runtime.panes.push({
              id: e.id,
              title: typeof e.title === 'string' && e.title ? e.title : e.id,
              isShown: true,
              isFocused: e.focus === true,
              isPlaced: true,
            })
            return { value: undefined }
          },
        )
        if (result && typeof result.deny === 'string') throw new Error(result.deny)
        return result
      },
      close: async (args) => {
        calls.uiClose.push(clone(args))
        const result = await dispatch('ui.close', { id: args.id, origin: { kind: 'plugin' } }, (e) => {
          runtime.panes = runtime.panes.filter((pane) => pane.id !== e.id)
          return { value: undefined }
        })
        if (result && typeof result.deny === 'string') throw new Error(result.deny)
        return result
      },
      panes: async () => runtime.panes.map((pane) => ({ ...pane })),
      invalidate: (event) => {
        calls.invalidate.push(event)
      },
      toast: (text) => {
        calls.logs.push({ text, kind: 'toast' })
      },
      status: () => {},
      log: (text, opts) => {
        calls.logs.push({ text, kind: 'log', to: opts && opts.to })
      },
      ask: async () => {
        throw new Error('$.ui.ask não é usado pelo mod')
      },
    },
  }

  function matches(matcher, event) {
    if (!matcher) return true
    return Object.entries(matcher).every(([key, value]) => event[key] === value)
  }

  async function dispatch(pattern, event, core) {
    const chain = hooks.filter((h) => h.pattern === pattern && matches(h.matcher, event))
    let index = 0
    const next = async (current) => {
      if (index >= chain.length) return core ? core(current) : {}
      const hook = chain[index]
      index += 1
      return await hook.hook($, current, next)
    }
    return await next(event)
  }

  function find(node, key) {
    if (!node || typeof node !== 'object') return null
    if (Array.isArray(node)) {
      for (const child of node) {
        const hit = find(child, key)
        if (hit) return hit
      }
      return null
    }
    if (node.props && node.props.key === key) return node
    for (const child of node.children || []) {
      const hit = find(child, key)
      if (hit) return hit
    }
    return null
  }

  function findAll(node, type) {
    const out = []
    const walk = (n) => {
      if (!n || typeof n !== 'object') return
      if (Array.isArray(n)) {
        for (const child of n) walk(child)
        return
      }
      if (n.type === type) out.push(n)
      for (const child of n.children || []) walk(child)
    }
    walk(node)
    return out
  }

  async function sessionStart() {
    return await dispatch('session.start', { hook_event_name: 'session.start', cwd: '/fake/projeto' }, () => ({}))
  }

  async function commandRun() {
    return await dispatch(
      'command.run',
      { command: 'mesa', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } },
      () => ({}),
    )
  }

  async function closePane() {
    return await dispatch('ui.close', { id: 'mesa-study', origin: { kind: 'person' } }, (e) => {
      runtime.panes = runtime.panes.filter((pane) => pane.id !== e.id)
      return { value: undefined }
    })
  }

  async function render(surface = runtime.surface) {
    runtime.surface = surface
    runtime.handlers = []
    runtime.lastTree = await dispatch(
      'ui.render',
      {
        surface,
        component: 'Pane',
        requestId: 'mesa-study',
        props: {
          title: 'Mesa de Estudos',
          isFocused: true,
          bodyColumns: 90,
          placement: 'inline',
          scroll: {},
          view: {},
        },
      },
      () => null,
    )
    return runtime.lastTree
  }

  async function press(key) {
    const node = find(runtime.lastTree, key)
    if (!node || node.type !== 'Button') throw new Error(`Button ${key} não encontrado na última renderização`)
    runtime.pressCounts[key] = (runtime.pressCounts[key] || 0) + 1
    return await runtime.handlers[node.press.handle]()
  }

  async function type(key, value) {
    const node = find(runtime.lastTree, key)
    if (!node || node.type !== 'Input') throw new Error(`Input ${key} não encontrado na última renderização`)
    const handler = runtime.handlers[node.press.handle]
    if (typeof handler.onInput !== 'function') return undefined
    return await handler.onInput(value, { kind: 'change', element: key, value, surface: runtime.surface })
  }

  async function submit(key, value) {
    const node = find(runtime.lastTree, key)
    if (!node || node.type !== 'Input') throw new Error(`Input ${key} não encontrado na última renderização`)
    const handler = runtime.handlers[node.press.handle]
    return await handler.onSubmit(value, { kind: 'submit', element: key, value, surface: runtime.surface })
  }

  async function pick(key, value) {
    const node = find(runtime.lastTree, key)
    if (!node || node.type !== 'Select') throw new Error(`Select ${key} não encontrado na última renderização`)
    const handler = runtime.handlers[node.press.handle]
    return await handler.onSelect(value, { element: key, value, surface: runtime.surface })
  }

  const engine = {
    $,
    calls,
    store: storeMap,
    hooks,
    runtime,
    dispatch,
    sessionStart,
    commandRun,
    closePane,
    render,
    press,
    type,
    submit,
    pick,
    find: (key) => find(runtime.lastTree, key),
    findAll: (type) => findAll(runtime.lastTree, type),
    pressCount: (key) => runtime.pressCounts[key] || 0,
  }
  register(on, options)
  return engine
}

// ---------- validadores ----------

export const ALLOWED_PROPS = {
  Box: [
    'key', 'hover', 'position', 'top', 'left', 'right', 'bottom', 'flexDirection', 'flexGrow', 'flexShrink',
    'flexWrap', 'alignItems', 'alignSelf', 'justifyContent', 'gap', 'columnGap', 'rowGap', 'width', 'height',
    'minWidth', 'minHeight', 'margin', 'marginX', 'marginY', 'marginTop', 'marginBottom', 'marginLeft',
    'marginRight', 'padding', 'paddingX', 'paddingY', 'paddingTop', 'paddingBottom', 'paddingLeft',
    'paddingRight', 'borderStyle', 'borderColor', 'borderDimColor', 'backgroundColor', 'overflow', 'display',
  ],
  Text: ['hover', 'color', 'backgroundColor', 'dimColor', 'bold', 'italic', 'underline', 'strikethrough', 'inverse', 'wrap'],
  Button: ['key', 'label', 'hotkey', 'action', 'plain', 'dimColor', 'autoFocus', 'hover'],
  Input: ['key', 'label', 'placeholder', 'value', 'submitLabel', 'autoFocus'],
  Select: ['key', 'label', 'options', 'value', 'autoFocus'],
  Svg: ['source', 'alt', 'width', 'height', 'isInteractive'],
}

/**
 * Confere a árvore contra os tipos oficiais: tipos conhecidos, superfície
 * correta (terminal sem Svg, mobile sem Input/Select), props dentro do
 * allowlist e folhas com o essencial. Devolve a lista de problemas (vazia é
 * bom).
 */
export function validateTree(tree, surface) {
  const problems = []
  const walk = (node, path) => {
    if (node === null || node === undefined) return
    if (typeof node === 'string' || typeof node === 'number') return
    if (Array.isArray(node)) {
      node.forEach((child, i) => walk(child, `${path}[${i}]`))
      return
    }
    if (typeof node !== 'object' || typeof node.type !== 'string') {
      problems.push(`${path}: nó inválido`)
      return
    }
    const type = node.type
    if (!ALLOWED_PROPS[type]) {
      problems.push(`${path}: tipo "${type}" não é desenhável`)
      return
    }
    if (surface === 'terminal' && type === 'Svg') problems.push(`${path}: Svg não existe no terminal`)
    if (surface === 'mobile' && (type === 'Input' || type === 'Select')) problems.push(`${path}: ${type} não existe no mobile`)
    for (const key of Object.keys(node.props || {})) {
      if (!ALLOWED_PROPS[type].includes(key)) problems.push(`${path}: prop ${type}.${key} não consta nos tipos oficiais`)
    }
    if (type === 'Button') {
      if (typeof node.props.key !== 'string' || !node.props.key) problems.push(`${path}: Button sem key`)
      if (typeof node.props.label !== 'string' || !node.props.label) problems.push(`${path}: Button sem label`)
      if (typeof node.press?.handle !== 'number') problems.push(`${path}: Button sem handler`)
    }
    if (type === 'Input') {
      if (typeof node.props.key !== 'string' || !node.props.key) problems.push(`${path}: Input sem key`)
      if (typeof node.press?.handle !== 'number') problems.push(`${path}: Input sem handlers`)
    }
    if (type === 'Select') {
      if (typeof node.props.key !== 'string' || !node.props.key) problems.push(`${path}: Select sem key`)
      if (!Array.isArray(node.props.options) || node.props.options.length === 0) problems.push(`${path}: Select sem options`)
      else {
        const values = node.props.options.map((o) => o.value)
        if (new Set(values).size !== values.length) problems.push(`${path}: Select com valores repetidos`)
        for (const option of node.props.options) {
          if (!option || typeof option.value !== 'string' || typeof option.label !== 'string') {
            problems.push(`${path}: Select com option inválida`)
          }
        }
      }
      if (typeof node.press?.handle !== 'number') problems.push(`${path}: Select sem handler`)
    }
    if (type === 'Svg') {
      if (typeof node.props.source !== 'string' || node.props.source.length === 0 || node.props.source.length > 131_072) {
        problems.push(`${path}: Svg.source fora do contrato`)
      }
      if (typeof node.props.alt !== 'string' || node.props.alt.length === 0) problems.push(`${path}: Svg sem alt`)
    }
    for (const child of node.children || []) walk(child, `${path}>${type}`)
  }
  walk(tree, '$')
  return problems
}

/** Junta todo o texto da árvore (para asserções de mensagens). */
export function collectText(tree) {
  const out = []
  const walk = (node) => {
    if (node === null || node === undefined) return
    if (typeof node === 'string' || typeof node === 'number') {
      out.push(String(node))
      return
    }
    if (Array.isArray(node)) {
      for (const child of node) walk(child)
      return
    }
    for (const child of node.children || []) walk(child)
  }
  walk(tree)
  return out.join(' ')
}

/** Resposta de página válida, como `host/cli.mjs` devolveria. */
export function pageResponse({
  path = '/fake/pdfs/limites.pdf',
  name = 'limites.pdf',
  page = 1,
  numPages = 3,
  svg = '<svg viewBox="0 0 10 10"></svg>',
  snapshotPath = `/tmp/mesa-study-mod/pagina-${page}.png`,
  previewWarning,
} = {}) {
  const out = {
    ok: true,
    kind: 'page',
    document: { path, name },
    page,
    numPages,
    svg,
    snapshotPath,
    mimeType: 'image/png',
  }
  if (previewWarning !== undefined) out.previewWarning = previewWarning
  return out
}

/** Resposta de captura válida (id numérico de janela e ISO estrito). */
export function captureResponse({ snapshotPath = '/tmp/mesa-study-mod/captura.png', capturedAt = '2026-10-05T21:00:00.000Z' } = {}) {
  return {
    ok: true,
    kind: 'capture',
    snapshotPath,
    mimeType: 'image/png',
    capturedAt,
    window: { id: '4242', app: 'Xournal++', title: 'rascunho.xopp' },
  }
}

export function processResult(body, exitCode = 0, stderr = '') {
  return { exitCode, stdout: typeof body === 'string' ? body : JSON.stringify(body), stderr }
}

// ---------- autoteste do harness (só quando o arquivo roda sozinho) ----------

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  test('harness: /mesa abre o painel e renderiza sem tocar em helper ou modelo', async () => {
    const engine = createEngine()
    await engine.sessionStart()
    const result = await engine.commandRun()
    assert.equal(engine.calls.uiOpen.length, 1)
    assert.deepEqual(engine.calls.uiOpen[0], {
      id: 'mesa-study',
      title: 'Mesa de Estudos',
      focus: true,
      closeOnEscape: true,
      columns: 90,
    })
    assert.deepEqual(result, {}, 'abertura confirmada é silenciosa (sem turno do modelo)')
    assert.equal((await engine.$.ui.panes())[0].isPlaced, true)
    const tree = await engine.render('desktop')
    assert.equal(validateTree(tree, 'desktop').length, 0, validateTree(tree, 'desktop').join('\n'))
    assert.ok(engine.find('pdf:load'))
    assert.equal(engine.calls.process.length, 0)
    assert.equal(engine.calls.promptSubmit.length, 0)
  })
}
