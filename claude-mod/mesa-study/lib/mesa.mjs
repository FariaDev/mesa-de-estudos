// lib/mesa.mjs — estado, operações assíncronas e ações da Mesa de Estudos.
//
// Regras de segurança/comportamento:
// - `register`/`session.start`/`/mesa`/navegação/calculadora NÃO chamam o
//   modelo nem o helper: só ações explícitas do usuário (carregar PDF, trocar
//   página, usar pasta, conferir captura, pedir análise) disparam trabalho.
// - Operações assíncronas têm geração: uma ação nova supera a antiga e o
//   resultado atrasado é descartado ("último estado"). Cliques repetidos na
//   mesma página/captura não disparam duas chamadas; a fila guarda no máximo
//   uma intenção pendente (captura/leitura de pasta), nunca uma página pedida
//   durante a abertura de outro PDF.
// - O campo "Caminho do PDF" acompanha a aba ativa: trocar de aba atualiza o
//   campo e página de aba inativa não sobrescreve o caminho visível.
// - Análise só envia a prévia que corresponde ao documento/página ativos e
//   nunca durante operação em andamento; duplicatas são bloqueadas no callback.
// - `$.prompt.submit` só registra "aceito/na fila"; leitura/interpretação do
//   modelo nunca é marcada como concluída. Sem anexos: o pedido é texto
//   explícito pedindo `Read` do PNG absoluto local (caminho JSON completo,
//   nunca cortado; os textos livres é que são limitados).
// - Persistência é serializada e só metadados (sem SVG/captura); store
//   incompatível/corrompido é preservado e a escrita pausa até ação explícita.
// - O painel fechado não recebe redraw (sem spam); o estado continua válido
//   para quando reabrir.

import { createHelper } from './helper.mjs'
import { LIMITS, SESSION_KEY, buildStored, defaultSession, loadSession } from './session.mjs'
import { calculate } from './calculator.mjs'
import { basename, dirname, isAbsolutePath, joinPath } from './paths.mjs'
import { buildTree } from './view.mjs'

export const PANE_ID = 'mesa-study'
export const PANE_TITLE = 'Mesa de Estudos'
export const DEFAULT_CACHE_DIR = '/tmp/mesa-study-mod'
export const DEFAULT_NODE = 'node'

/** Lê `options` do manifest (nodePath/cacheDir/roots) com padrões seguros. */
export function normalizeOptions(options) {
  const o = options && typeof options === 'object' ? options : {}
  const nodePath = typeof o.nodePath === 'string' && o.nodePath.trim() ? o.nodePath.trim() : DEFAULT_NODE
  let cacheDir = typeof o.cacheDir === 'string' && o.cacheDir.trim() ? o.cacheDir.trim() : DEFAULT_CACHE_DIR
  if (!isAbsolutePath(cacheDir)) cacheDir = DEFAULT_CACHE_DIR
  const roots = []
  const push = (value) => {
    if (roots.length >= LIMITS.roots) return
    if (typeof value !== 'string') return
    const cut = value.trim()
    if (!cut || !isAbsolutePath(cut) || roots.includes(cut)) return
    roots.push(cut.slice(0, LIMITS.path))
  }
  if (Array.isArray(o.roots)) {
    for (const value of o.roots) push(value)
  } else if (typeof o.roots === 'string') {
    for (const value of o.roots.split(/[,;\n]/)) push(value)
  }
  return { nodePath, cacheDir, roots }
}

function messageOf(err) {
  const m = err && typeof err.message === 'string' ? err.message : String(err)
  return m.slice(0, 300)
}

function bounded(value, max) {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

function clampPage(page, numPages) {
  let n = typeof page === 'number' && Number.isFinite(page) ? Math.trunc(page) : 1
  if (n < 1) n = 1
  if (numPages > 0 && n > numPages) n = numPages
  if (n > LIMITS.page) n = LIMITS.page
  return n
}

/**
 * Pedido de análise da página: texto explícito pedindo `Read` do PNG local.
 * O caminho vai inteiro e JSON-quoted; os textos livres (nome, matéria,
 * questão, notas) são limitados separadamente — nunca se corta o caminho.
 */
export function pagePrompt(session, doc, preview) {
  const path = JSON.stringify(typeof preview.snapshotPath === 'string' ? preview.snapshotPath : '')
  const name = JSON.stringify(bounded(doc && doc.name, 200))
  const subject = bounded(session && session.subject, LIMITS.subject)
  const question = bounded(session && session.question, LIMITS.question)
  const notes = bounded(session && session.notes, LIMITS.notes)
  const parts = [
    'Pedido de estudo da Mesa de Estudos.',
    `Leia primeiro, com a ferramenta Read, o arquivo PNG local (caminho absoluto JSON): ${path}`,
    `A imagem é a página ${preview.page} de ${name} (matéria: ${subject || 'não informada'}; questão: ${question || 'não informada'}).`,
    'Use apenas o conteúdo da imagem lida; não altere arquivos.',
    'Responda em português: explique a resolução passo a passo, destaque o que a página pede e aponte dúvidas.',
  ]
  if (notes) parts.push(`Notas do estudante: ${notes}`)
  return parts.join('\n')
}

/** Pedido de análise da captura do Xournal++ (mesma regra: texto + Read). */
export function capturePrompt(session, capture) {
  const win = capture && capture.window ? capture.window : {}
  const path = JSON.stringify(typeof capture.snapshotPath === 'string' ? capture.snapshotPath : '')
  const app = bounded(win.app, 200) || 'Xournal++'
  const title = bounded(win.title, 200) || 'sem título'
  const subject = bounded(session && session.subject, LIMITS.subject)
  const question = bounded(session && session.question, LIMITS.question)
  const notes = bounded(session && session.notes, LIMITS.notes)
  const parts = [
    'Pedido de estudo da Mesa de Estudos (conferência do Xournal++).',
    `Leia primeiro, com a ferramenta Read, o arquivo PNG local (caminho absoluto JSON): ${path}`,
    `A imagem é uma captura da janela do Xournal++ (${app}: ${title}).`,
    `Matéria: ${subject || 'não informada'}; questão: ${question || 'não informada'}.`,
    'Use apenas o conteúdo da imagem lida; não altere arquivos.',
    'Responda em português: confira a resolução e aponte erros ou dúvidas.',
  ]
  if (notes) parts.push(`Notas do estudante: ${notes}`)
  return parts.join('\n')
}

function storageMessage(loaded) {
  if (!loaded || loaded.status === 'ok' || loaded.status === 'empty') return null
  if (loaded.status === 'incompatible') {
    return `O estado salvo tem versão/formato incompatível (${loaded.version ?? loaded.problem}). Ele foi preservado; nada será salvo por cima até você usar "Substituir estado salvo".`
  }
  if (loaded.status === 'corrupted') {
    return `O estado salvo está corrompido (campo ${loaded.problem}). Ele foi preservado; nada será salvo por cima até você usar "Substituir estado salvo".`
  }
  return `Não foi possível ler o estado salvo (${loaded.problem}). Para não sobrescrever dados, a gravação está pausada até "Substituir estado salvo".`
}

export function createMesa(options) {
  const cfg = normalizeOptions(options)
  const helper = createHelper(cfg)

  const state = {
    session: defaultSession(),
    loaded: false,
    storageStatus: 'empty',
    storageBlocked: false,
    storageError: null,
    busy: null,
    inflight: null,
    pendingPage: null,
    pendingSelect: null,
    generation: 0,
    paneOpen: false,
    sending: false,
    error: null,
    notice: null,
    previews: [null, null],
    pdfOptions: [],
    lastCapture: null,
    calcExpr: '',
    calcResult: null,
    calcError: null,
    degrees: false,
  }

  let loadPromise = null
  let writeChain = null
  let writeDirty = false

  function invalidate($) {
    if (!state.paneOpen) return
    try {
      $.ui.invalidate('ui.render')
    } catch {
      // O painel pode ter fechado entre a mutação e o redraw; sem spam.
    }
  }

  function debug($, line) {
    try {
      $.ui.log(`mesa-study: ${line}`, { to: 'debug' })
    } catch {
      // Log é melhor esforço.
    }
  }

  /**
   * Aviso transitório visível (barra de notificações do host). API nativa
   * `$.ui.toast`; melhor esforço — se a versão não a tiver, o `notice` do
   * painel continua sendo o registro visível.
   */
  function toast($, text) {
    try {
      if ($.ui && typeof $.ui.toast === 'function') $.ui.toast(text)
    } catch {
      // Aviso é melhor esforço.
    }
  }

  function ensureLoaded($) {
    if (!loadPromise) {
      loadPromise = (async () => {
        let loaded
        try {
          loaded = await loadSession($)
        } catch (err) {
          loaded = { session: defaultSession(), status: 'error', version: null, problem: messageOf(err) }
        }
        state.session = loaded.session
        state.storageStatus = loaded.status
        state.storageBlocked = loaded.status !== 'ok' && loaded.status !== 'empty'
        state.storageError = storageMessage(loaded)
        for (const root of cfg.roots) {
          if (!state.session.roots.includes(root)) state.session.roots.push(root)
        }
        state.session.roots = state.session.roots.slice(-LIMITS.roots)
        state.loaded = true
      })()
    }
    return loadPromise
  }

  /**
   * Gravação serializada e coalescida: uma escrita por vez, cada uma lendo o
   * estado ATUAL no momento de gravar — um callback antigo nunca sobrescreve o
   * estado novo. Falha vira aviso visível (`storageError`) e para o dreno; a
   * próxima alteração tenta de novo. Store incompatível/corrompido nem chega
   * aqui (fica bloqueado até ação explícita).
   */
  function persist($) {
    if (state.storageBlocked) {
      invalidate($)
      return Promise.resolve(false)
    }
    writeDirty = true
    if (!writeChain) {
      writeChain = (async () => {
        try {
          while (writeDirty) {
            writeDirty = false
            const payload = buildStored(state.session)
            try {
              await $.store.set(SESSION_KEY, payload)
              state.storageError = null
            } catch (err) {
              state.storageError = `Não foi possível salvar o estado: ${messageOf(err)}. As alterações continuam nesta sessão; tente de novo.`
              debug($, `falha ao salvar a sessão: ${messageOf(err)}`)
              return false
            }
          }
          return true
        } finally {
          writeChain = null
          invalidate($)
        }
      })()
    }
    return writeChain
  }

  async function replaceStore($) {
    if (!state.storageBlocked) return
    try {
      await $.store.delete(SESSION_KEY)
    } catch (err) {
      state.storageError = `Não foi possível substituir o estado salvo: ${messageOf(err)}`
      invalidate($)
      return
    }
    state.storageBlocked = false
    state.storageStatus = 'empty'
    state.storageError = null
    state.notice = 'Estado salvo substituído pelos dados desta sessão.'
    await persist($)
    invalidate($)
  }

  function beginOp(op) {
    state.generation += 1
    state.busy = op
    state.error = null
    return state.generation
  }

  function current(gen) {
    return gen === state.generation
  }

  function finishOp(gen) {
    if (!current(gen)) return false
    state.busy = null
    state.inflight = null
    return true
  }

  /**
   * Recusa gestos que reescreveriam o PNG que um prompt em voo vai mandar ler.
   * `dimColor` é cosmético nos tipos nativos: a guarda de verdade é aqui.
   */
  function guardSending($, what) {
    if (!state.sending) return false
    state.notice = `Aguarde o envio do prompt terminar para ${what}.`
    invalidate($)
    return true
  }

  async function drain($) {
    if (state.busy) return
    if (state.pendingSelect) {
      const path = state.pendingSelect
      state.pendingSelect = null
      await selectDoc($, path)
      return
    }
    if (state.pendingPage) {
      const { slot, page } = state.pendingPage
      state.pendingPage = null
      await loadPage($, slot, page)
    }
  }

  function requestRoots(doc) {
    const roots = []
    const push = (value) => {
      if (typeof value !== 'string' || !value || !isAbsolutePath(value) || roots.includes(value)) return
      roots.push(value)
    }
    push(dirname(doc.path))
    for (const root of state.session.roots) push(root)
    return roots.slice(0, LIMITS.roots + 1)
  }

  function activeDoc() {
    return state.session.docs[state.session.activeDoc] || null
  }

  // ---------- operações ----------

  async function loadPage($, slot, page, successExtra) {
    const doc = state.session.docs[slot]
    if (!doc) {
      state.error = 'Nenhum PDF aberto. Informe o caminho do PDF e use "Carregar PDF".'
      invalidate($)
      return
    }
    const wanted = clampPage(page, doc.numPages)
    if (
      state.busy === 'page' &&
      state.inflight &&
      state.inflight.slot === slot &&
      state.inflight.page === wanted &&
      state.inflight.path === doc.path
    ) {
      state.notice = `A página ${wanted} já está carregando.`
      invalidate($)
      return
    }
    if (state.busy === 'select') {
      // r3-A: durante um `select`, a aba ativa ainda é a antiga; enfileirar a
      // página rodaria depois, para o PDF antigo, e escreveria estado fora da
      // aba nova. Recusa com aviso em vez de guardar intenção obsoleta.
      state.notice = 'Aguarde a abertura do PDF terminar para trocar de página.'
      invalidate($)
      return
    }
    if (state.busy === 'capture' || state.busy === 'list') {
      // Não interrompe captura/leitura em andamento: guarda a última intenção
      // de página e retoma quando a operação atual terminar. (Não há troca de
      // documento nesses casos, então a intenção não fica obsoleta.)
      state.pendingPage = { slot, page: wanted }
      state.notice = `Página ${wanted} na fila…`
      invalidate($)
      return
    }
    const gen = beginOp('page')
    state.inflight = { slot, page: wanted, path: doc.path }
    state.notice = null
    let res
    try {
      res = await helper.page($, { path: doc.path, page: wanted, roots: requestRoots(doc) })
    } catch (err) {
      if (current(gen)) {
        state.error = `Falha no helper: ${messageOf(err)}`
        finishOp(gen)
        invalidate($)
      }
      return
    }
    if (!current(gen)) return // superada por uma ação mais nova: descarta
    if (state.session.docs[slot] && state.session.docs[slot].path !== doc.path) {
      // O documento daquele slot virou outro no meio do caminho: descarta.
      finishOp(gen)
      invalidate($)
      return
    }
    if (res.ok) {
      state.session.docs[slot] = {
        path: res.document.path,
        name: res.document.name || doc.name,
        page: res.page,
        numPages: res.numPages,
      }
      // O PNG vem sempre; o SVG pode faltar (prévia omitida pelo host) e o
      // aviso do host é preservado para a UI explicar sem perder o PNG.
      state.previews[slot] = {
        path: res.document.path,
        svg: res.svg,
        snapshotPath: res.snapshotPath,
        page: res.page,
        warning: res.previewWarning || null,
      }
      // Se o usuário trocou de aba enquanto a página carregava, a escolha dele
      // vale; só assume a aba quando ela ainda é a ativa (ou está vazia).
      if (state.session.activeDoc === slot || !state.session.docs[state.session.activeDoc]) {
        state.session.activeDoc = slot
      }
      // r3-B: o campo "Caminho do PDF" acompanha a aba ATIVA — resultado de
      // página de aba inativa não sobrescreve o caminho que o usuário vê.
      if (state.session.activeDoc === slot) state.session.pdfPath = res.document.path
      state.notice = `Página ${res.page} de ${res.numPages} carregada.${successExtra ? ` ${successExtra}` : ''}`
      state.error = null
      await persist($)
      if (!current(gen)) return
    } else {
      state.error = res.error.message
      state.notice = null
    }
    finishOp(gen)
    invalidate($)
    await drain($)
  }

  async function selectDoc($, rawPath) {
    if (guardSending($, 'abrir outro PDF')) return
    const path = typeof rawPath === 'string' ? rawPath.trim() : ''
    if (!path) {
      state.error = 'Informe o caminho absoluto do PDF.'
      invalidate($)
      return
    }
    if (!isAbsolutePath(path)) {
      state.error = 'O caminho do PDF precisa ser absoluto.'
      invalidate($)
      return
    }
    if (state.busy === 'capture' || state.busy === 'list') {
      state.pendingSelect = path
      state.notice = 'Troca de PDF na fila…'
      invalidate($)
      return
    }
    const gen = beginOp('select') // supera uma página em voo (último estado)
    state.inflight = null
    state.pendingPage = null // intenção de página de outro documento fica obsoleta
    state.notice = null
    let failed = false
    let replacement = ''
    try {
      const stat = await $.fs.stat(path, { resolve: true })
      if (!current(gen)) return
      if (!stat || stat.kind !== 'file') {
        state.error = `Não é um arquivo: ${path}`
        failed = true
      } else {
        const real = typeof stat.realPath === 'string' && stat.realPath ? stat.realPath : path
        const existing = state.session.docs.findIndex((doc) => doc.path === real)
        if (existing >= 0) {
          state.session.activeDoc = existing
        } else {
          // O primeiro PDF carregado fica na prioridade (slot 0); o segundo
          // ocupa o slot 1. Com os dois cheios, o novo substitui o secundário —
          // com aviso visível (toast + notice) de qual arquivo saiu.
          const slot = state.session.docs.length < LIMITS.docs ? state.session.docs.length : 1
          const previous = slot === 1 && state.session.docs[1] ? state.session.docs[1] : null
          if (previous) {
            replacement = `O segundo leitor foi substituído: "${basename(previous.path)}" saiu, "${basename(real)}" entrou.`
            toast($, replacement)
          }
          const docs = [...state.session.docs]
          docs[slot] = { path: real, name: basename(real), page: 1, numPages: 0 }
          state.session.docs = docs
          state.previews = slot === 0 ? [null, state.previews[1] || null] : [state.previews[0] || null, null]
          state.session.activeDoc = slot
        }
        state.session.pdfPath = real
        state.notice = existing >= 0 ? `PDF já aberto: ${basename(real)}` : `PDF selecionado: ${basename(real)}`
        state.error = null
        await persist($)
        if (!current(gen)) return
      }
    } catch (err) {
      if (current(gen)) {
        state.error = `PDF não encontrado ou inacessível: ${messageOf(err)}`
        failed = true
      }
    }
    if (!current(gen)) return
    finishOp(gen)
    invalidate($)
    if (failed) {
      await drain($)
      return
    }
    const slot = state.session.activeDoc
    const doc = state.session.docs[slot]
    if (doc) await loadPage($, slot, doc.page || 1, replacement)
    else await drain($)
  }

  async function addRoot($, rawDir) {
    if (typeof rawDir === 'string' && rawDir.trim()) await commitField($, 'rootsDir', rawDir.trim())
    const dir = state.session.rootsDir
    if (!dir) {
      state.error = 'Informe a pasta de PDFs.'
      invalidate($)
      return
    }
    if (!isAbsolutePath(dir)) {
      state.error = 'A pasta precisa ser um caminho absoluto.'
      invalidate($)
      return
    }
    if (state.busy) {
      state.notice = 'Aguarde a operação atual terminar para ler a pasta.'
      invalidate($)
      return
    }
    const gen = beginOp('list')
    state.notice = null
    try {
      const stat = await $.fs.stat(dir, { resolve: true })
      if (!current(gen)) return
      const real = stat && typeof stat.realPath === 'string' && stat.realPath ? stat.realPath : dir
      if (!stat || stat.kind !== 'dir') {
        state.error = `Não é uma pasta: ${real}`
      } else {
        const entries = await $.fs.list(real)
        if (!current(gen)) return
        const pdfs = (Array.isArray(entries) ? entries : [])
          .filter((entry) => entry && entry.kind === 'file' && typeof entry.name === 'string' && /\.pdf$/i.test(entry.name))
          .sort((a, b) => a.name.localeCompare(b.name))
        state.pdfOptions = pdfs.slice(0, LIMITS.pdfOptions).map((entry) => ({
          value: joinPath(real, entry.name),
          label: entry.name,
        }))
        const roots = state.session.roots.filter((root) => root !== real)
        roots.push(real)
        state.session.roots = roots.slice(-LIMITS.roots)
        state.notice = pdfs.length
          ? `${Math.min(pdfs.length, LIMITS.pdfOptions)} PDF(s) encontrados em ${real}.`
          : `Nenhum PDF encontrado em ${real}.`
        state.error = null
        await persist($)
        if (!current(gen)) return
      }
    } catch (err) {
      if (current(gen)) state.error = `Não foi possível ler a pasta: ${messageOf(err)}`
    }
    finishOp(gen)
    invalidate($)
    await drain($)
  }

  async function capture($) {
    if (guardSending($, 'capturar de novo')) return
    if (state.busy === 'capture') {
      state.notice = 'A captura já está em andamento.'
      invalidate($)
      return
    }
    if (state.busy) {
      state.notice = 'Aguarde a operação atual terminar para conferir a captura.'
      invalidate($)
      return
    }
    const gen = beginOp('capture')
    state.notice = null
    let res
    try {
      res = await helper.capture($)
    } catch (err) {
      if (current(gen)) {
        state.error = `Falha no helper: ${messageOf(err)}`
        finishOp(gen)
        invalidate($)
      }
      return
    }
    if (!current(gen)) return
    if (res.ok) {
      state.lastCapture = {
        snapshotPath: res.snapshotPath,
        mimeType: res.mimeType,
        capturedAt: res.capturedAt,
        window: res.window,
      }
      state.notice = `Captura disponível: ${res.snapshotPath} (${res.window.app}). Use "Pedir análise da captura" quando quiser.`
      state.error = null
    } else {
      state.error = `Não foi possível capturar: ${res.error.message}`
      state.notice = null
    }
    finishOp(gen)
    invalidate($)
    await drain($)
  }

  async function sendPrompt($, text, acceptedNotice) {
    if (state.sending) {
      state.notice = 'Já há um envio em andamento.'
      invalidate($)
      return
    }
    state.sending = true
    state.error = null
    try {
      const res = await $.prompt.submit({ text })
      if (res && typeof res.drop === 'string') {
        state.error = `Envio recusado: ${res.drop}`
        state.notice = null
      } else if (res && typeof res.text === 'string') {
        state.notice = acceptedNotice
        state.error = null
      } else {
        state.error = 'O envio não retornou confirmação de aceite.'
        state.notice = null
      }
    } catch (err) {
      state.error = `Falha ao enviar o prompt: ${messageOf(err)}`
      state.notice = null
    } finally {
      state.sending = false
      invalidate($)
    }
  }

  async function analyzePage($) {
    if (state.busy) {
      state.notice = 'Aguarde a operação atual terminar para pedir a análise.'
      invalidate($)
      return
    }
    const slot = state.session.activeDoc
    const doc = state.session.docs[slot]
    const preview = state.previews[slot]
    if (!doc || !preview || !preview.snapshotPath) {
      state.error = 'Carregue uma página antes de pedir a análise.'
      invalidate($)
      return
    }
    if (preview.path !== doc.path) {
      state.error = 'A prévia na memória é de outro PDF; carregue a página deste documento antes de pedir a análise.'
      invalidate($)
      return
    }
    if (preview.page !== doc.page) {
      state.error = `A prévia disponível é da página ${preview.page}, mas a página atual é ${doc.page}. Carregue a página de novo antes de pedir a análise.`
      invalidate($)
      return
    }
    await sendPrompt(
      $,
      pagePrompt(state.session, doc, preview),
      `Prompt aceito para a página ${preview.page} (ou na fila). A análise depende do modelo; leitura e interpretação não estão concluídas.`,
    )
  }

  async function analyzeCapture($) {
    if (state.busy) {
      state.notice = 'Aguarde a operação atual terminar para pedir a análise.'
      invalidate($)
      return
    }
    if (!state.lastCapture) {
      state.error = 'Não há captura ainda. Use "Capturar Xournal++" primeiro.'
      invalidate($)
      return
    }
    await sendPrompt(
      $,
      capturePrompt(state.session, state.lastCapture),
      'Prompt aceito para a captura (ou na fila). A análise depende do modelo; leitura e interpretação não estão concluídas.',
    )
  }

  function prev($) {
    if (guardSending($, 'trocar de página')) return Promise.resolve()
    const doc = activeDoc()
    if (!doc) {
      state.error = 'Nenhum PDF aberto. Informe o caminho do PDF e use "Carregar PDF".'
      invalidate($)
      return Promise.resolve()
    }
    if (doc.page <= 1) {
      state.notice =
        doc.numPages > 0
          ? `Já está na primeira página de "${doc.name}" (1 de ${doc.numPages}). Use Próxima ▶ para avançar.`
          : `Já está na primeira página de "${doc.name}".`
      invalidate($)
      return Promise.resolve()
    }
    return loadPage($, state.session.activeDoc, doc.page - 1)
  }

  function next($) {
    if (guardSending($, 'trocar de página')) return Promise.resolve()
    const doc = activeDoc()
    if (!doc) {
      state.error = 'Nenhum PDF aberto. Informe o caminho do PDF e use "Carregar PDF".'
      invalidate($)
      return Promise.resolve()
    }
    if (doc.numPages > 0 && doc.page >= doc.numPages) {
      state.notice = `Já está na última página de "${doc.name}" (${doc.numPages} de ${doc.numPages}). Use ◀ Anterior para voltar.`
      invalidate($)
      return Promise.resolve()
    }
    return loadPage($, state.session.activeDoc, doc.page + 1)
  }

  function jump($, raw) {
    if (guardSending($, 'trocar de página')) return Promise.resolve()
    const doc = activeDoc()
    if (!doc) {
      state.error = 'Nenhum PDF aberto. Informe o caminho do PDF e use "Carregar PDF".'
      invalidate($)
      return Promise.resolve()
    }
    const text = String(raw ?? '').trim()
    if (!/^\d{1,7}$/.test(text)) {
      state.error = 'Número de página inválido. Digite um número inteiro (ex.: 3).'
      invalidate($)
      return Promise.resolve()
    }
    const n = Number(text)
    if (n < 1 || n > LIMITS.page) {
      state.error = 'Número de página inválido. Digite um número inteiro (ex.: 3).'
      invalidate($)
      return Promise.resolve()
    }
    if (doc.numPages > 0 && n > doc.numPages) {
      state.error = `A página ${n} não existe (total: ${doc.numPages}).`
      invalidate($)
      return Promise.resolve()
    }
    return loadPage($, state.session.activeDoc, n)
  }

  async function loadFromPath($, value) {
    if (typeof value === 'string' && value.trim()) await commitField($, 'pdfPath', value.trim())
    const path = state.session.pdfPath
    if (!path) {
      state.error = 'Informe o caminho absoluto do PDF.'
      invalidate($)
      return
    }
    await selectDoc($, path)
  }

  async function selectTab($, rawIndex) {
    const index =
      typeof rawIndex === 'number' && Number.isInteger(rawIndex)
        ? rawIndex
        : /^\d{1,7}$/.test(String(rawIndex ?? '').trim())
          ? Number(String(rawIndex).trim())
          : Number.NaN
    const doc = Number.isInteger(index) ? state.session.docs[index] : null
    if (!doc) {
      state.error = 'Documento não encontrado.'
      invalidate($)
      return
    }
    state.session.activeDoc = index
    // r3-B: trocar de aba sincroniza o campo com o PDF daquela aba; "Carregar
    // PDF" sem valor digitado recarrega o documento que está sendo visto.
    state.session.pdfPath = doc.path
    state.notice = `Documento ativo: ${doc.name}`
    state.error = null
    await persist($)
    invalidate($)
  }

  /**
   * Recarrega a página ATUAL por ação explícita. Depois de uma restauração só
   * de metadados é este gesto — nunca abrir o painel ou trocar de aba — que lê
   * o PDF de novo. Recusado com aviso durante operação ou envio em andamento.
   */
  async function reloadPage($) {
    if (guardSending($, 'recarregar a página')) return
    const slot = state.session.activeDoc
    const doc = state.session.docs[slot]
    if (!doc) {
      state.error = 'Nenhum PDF aberto para recarregar. Informe o caminho e use "Carregar PDF".'
      invalidate($)
      return
    }
    if (state.busy) {
      state.notice = 'Aguarde a operação atual terminar para recarregar a página.'
      invalidate($)
      return
    }
    await loadPage($, slot, doc.page || 1)
  }

  /**
   * Fecha o PDF ativo (ação explícita; mexe só em metadados): remove o
   * documento do slot e remapeia `activeDoc`/`pdfPath`/prévias na mesma ordem,
   * gravando o resultado. Em operação ou envio em andamento, recusa com aviso
   * em vez de fechar no meio; intenções enfileiradas do documento fechado são
   * descartadas (o drain nunca roda com busy/sending ativos).
   */
  async function closeActiveDoc($) {
    if (guardSending($, 'fechar o PDF')) return
    const slot = state.session.activeDoc
    const doc = state.session.docs[slot]
    if (!doc) {
      state.error = 'Nenhum PDF aberto para fechar.'
      invalidate($)
      return
    }
    if (state.busy) {
      state.notice = 'Aguarde a operação atual terminar para fechar o PDF.'
      invalidate($)
      return
    }
    const docs = state.session.docs.filter((_, i) => i !== slot)
    const previews = state.previews.filter((_, i) => i !== slot)
    state.session.docs = docs
    state.previews = [previews[0] ?? null, previews[1] ?? null]
    const next = docs.length === 0 ? 0 : Math.min(slot, docs.length - 1)
    state.session.activeDoc = next
    state.session.pdfPath = docs[next] ? docs[next].path : ''
    state.pendingPage = null
    state.pendingSelect = null
    state.error = null
    state.notice = docs[next]
      ? `PDF fechado: ${basename(doc.path)}. Documento ativo: ${basename(docs[next].path)} (página ${docs[next].page}).`
      : `PDF fechado: ${basename(doc.path)}. Nenhum PDF aberto agora.`
    await persist($)
    invalidate($)
  }

  function setField($, key, value) {
    const max = key === 'subject' ? LIMITS.subject : key === 'question' ? LIMITS.question : key === 'notes' ? LIMITS.notes : LIMITS.path
    state.session[key] = typeof value === 'string' ? value.slice(0, max) : ''
    invalidate($)
  }

  async function commitField($, key, value) {
    setField($, key, value)
    await persist($)
  }

  function calc($, value) {
    if (typeof value === 'string') state.calcExpr = value.slice(0, 500)
    const expr = state.calcExpr.trim()
    if (!expr) {
      state.calcError = 'Digite uma expressão.'
      state.calcResult = null
      invalidate($)
      return
    }
    try {
      state.calcResult = calculate(expr, state.degrees)
      state.calcError = null
    } catch (err) {
      state.calcResult = null
      state.calcError = messageOf(err)
    }
    invalidate($)
  }

  // ---------- API do módulo de hooks ----------

  async function start($) {
    await ensureLoaded($)
  }

  async function openPane($) {
    try {
      await $.ui.open({ id: PANE_ID, title: PANE_TITLE, focus: true, closeOnEscape: true, columns: 90 })
    } catch (err) {
      state.paneOpen = false
      return { text: `Não foi possível abrir a Mesa de Estudos: ${messageOf(err)}` }
    }
    // `$.ui.open` é pedido, não garantia (e a versão dos tipos pode devolver
    // void): confirme na lista oficial de panes antes de afirmar que abriu.
    let pane = null
    try {
      if ($.ui && typeof $.ui.panes === 'function') {
        const panes = await $.ui.panes()
        pane = (Array.isArray(panes) ? panes : []).find((item) => item && item.id === PANE_ID) || null
      }
    } catch (err) {
      debug($, `falha ao confirmar o painel: ${messageOf(err)}`)
    }
    if (!pane) {
      return { text: 'A Mesa de Estudos foi solicitada, mas o host não confirmou o painel. Se ele não aparecer, rode /mesa de novo.' }
    }
    state.paneOpen = Boolean(pane.isPlaced)
    if (!pane.isPlaced) {
      return { text: 'A Mesa de Estudos foi aberta, mas esta tela ainda não tem largura para colocá-la; aumente a janela e rode /mesa de novo.' }
    }
    return {}
  }

  function onPaneOpened(e, result) {
    if (result && typeof result.deny === 'string') {
      state.paneOpen = false
      return
    }
    state.paneOpen = true
  }

  function onPaneClosed(e, result) {
    if (result && typeof result.deny === 'string') return // fechamento recusado: segue aberta
    state.paneOpen = false
    state.pendingPage = null
    state.pendingSelect = null
  }

  async function render($, e) {
    // O engine só pede `ui.render` de um Pane que está aberto; num hot reload
    // o módulo nasce de novo com o painel ainda na tela — daí `paneOpen`.
    state.paneOpen = true
    await ensureLoaded($)
    const elements = $.ui.resolve(e)
    return buildTree({ state, surface: e.surface, elements, actions: actionsFor($) })
  }

  function actionsFor($) {
    return {
      setSubject: (v) => commitField($, 'subject', v),
      typeSubject: (v) => commitField($, 'subject', v),
      setQuestion: (v) => commitField($, 'question', v),
      typeQuestion: (v) => commitField($, 'question', v),
      setNotes: (v) => commitField($, 'notes', v),
      typeNotes: (v) => commitField($, 'notes', v),
      typePdfPath: (v) => commitField($, 'pdfPath', v),
      typeRootsDir: (v) => commitField($, 'rootsDir', v),
      loadFromPath: (v) => loadFromPath($, v),
      addRoot: (v) => addRoot($, v),
      selectPdf: (v) => selectDoc($, v),
      selectTab: (i) => selectTab($, i),
      prev: () => prev($),
      next: () => next($),
      jump: (v) => jump($, v),
      reloadPage: () => reloadPage($),
      closePdf: () => closeActiveDoc($),
      analyzePage: () => analyzePage($),
      analyzeCapture: () => analyzeCapture($),
      capture: () => capture($),
      replaceStore: () => replaceStore($),
      calc: (v) => calc($, v),
      typeCalc: (v) => {
        state.calcExpr = typeof v === 'string' ? v.slice(0, 500) : ''
        invalidate($)
      },
      toggleDegrees: () => {
        state.degrees = !state.degrees
        invalidate($)
      },
    }
  }

  return {
    state,
    start,
    openPane,
    onPaneOpened,
    onPaneClosed,
    render,
  }
}
