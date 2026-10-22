// lib/view.mjs — desenha a árvore do painel (função pura do estado).
//
// Só usa os construtores que `$.ui.resolve(e)` devolve para a superfície:
// Box, Text, Button, Input, Select e Svg. `Svg` não existe no terminal;
// `Input`/`Select` não existem no mobile — a tela se adapta e o teste cobre
// os fallbacks. Nenhum DOM, nenhum Node, nenhum import fora do plugin.

const SHORT = 40

function shortName(name) {
  const s = String(name || '')
  return s.length > SHORT ? `${s.slice(0, SHORT - 1)}…` : s
}

function busyLabel(busy) {
  if (busy === 'page') return 'Carregando página…'
  if (busy === 'capture') return 'Capturando a janela do Xournal++…'
  if (busy === 'list') return 'Lendo a pasta…'
  if (busy === 'select') return 'Abrindo o PDF…'
  return 'Trabalhando…'
}

/**
 * @param {object} args
 * @param {object} args.state estado do mod (sessão + UI)
 * @param {string} args.surface superfície do evento `ui.render`
 * @param {object} args.elements tabela de `$.ui.resolve(e)`
 * @param {object} args.actions callbacks do mod (fecham sobre `$`)
 * @returns árvore de RenderElement
 */
export function buildTree({ state, surface, elements, actions }) {
  const { Box, Text, Button, Input, Select, Svg } = elements
  const hasInput = typeof Input === 'function'
  const hasSelect = typeof Select === 'function'
  const hasSvg = typeof Svg === 'function' && surface !== 'terminal'
  const session = state.session

  const text = (content, props) => Text({ ...(props || {}), children: content })
  const row = (children, props) => Box({ flexDirection: 'row', gap: 1, ...(props || {}), children })
  const col = (children, props) => Box({ flexDirection: 'column', gap: 1, ...(props || {}), children })
  const button = (key, label, onPress, props) => Button({ key, label, onPress, ...(props || {}) })
  const input = (key, label, value, onSubmit, props) => Input({ key, label, value, onSubmit, ...(props || {}) })

  const children = []

  children.push(text('Mesa de Estudos — protótipo local', { bold: true }))
  children.push(
    text('Prévia de uma página por vez; não é um leitor completo. Navegação e calculadora são locais — nada vai ao modelo sem você pedir.', {
      dimColor: true,
    }),
  )

  // Matéria e questão.
  if (hasInput) {
    children.push(
      row([
        input('subject', 'Matéria', session.subject, (v) => actions.setSubject(v), {
          placeholder: 'ex.: Cálculo',
          onInput: (v) => actions.typeSubject(v),
        }),
        input('question', 'Questão', session.question, (v) => actions.setQuestion(v), {
          placeholder: 'ex.: lista 3, item 7',
          onInput: (v) => actions.typeQuestion(v),
        }),
      ]),
    )
  } else {
    children.push(text(`Matéria: ${session.subject || '—'} | Questão: ${session.question || '—'}`))
  }

  // PDF explícito (caminho digitado pelo usuário) e pasta opcional.
  if (hasInput) {
    children.push(
      row([
        input('pdfPath', 'Caminho do PDF (autorizado por você)', session.pdfPath, (v) => actions.loadFromPath(v), {
          placeholder: '/caminho/absoluto/arquivo.pdf',
          onInput: (v) => actions.typePdfPath(v),
        }),
        button('pdf:load', 'Carregar PDF', () => actions.loadFromPath(), { dimColor: state.busy === 'select' }),
      ]),
    )
    children.push(
      row([
        input('rootsDir', 'Pasta de PDFs (opcional)', session.rootsDir, (v) => actions.addRoot(v), {
          placeholder: '/caminho/da/pasta',
          onInput: (v) => actions.typeRootsDir(v),
        }),
        button('roots:add', 'Usar pasta', () => actions.addRoot(), { dimColor: state.busy === 'list' }),
      ]),
    )
  } else {
    children.push(text(`PDF: ${session.pdfPath || '—'}`))
  }

  // Seleção a partir da pasta (quando houver opções).
  if (hasSelect && state.pdfOptions.length > 0) {
    const activePath = session.docs[session.activeDoc] ? session.docs[session.activeDoc].path : ''
    const inOptions = state.pdfOptions.some((o) => o.value === activePath)
    children.push(
      Select({
        key: 'pdf:select',
        label: 'PDFs encontrados',
        options: state.pdfOptions,
        value: inOptions ? activePath : state.pdfOptions[0].value,
        onSelect: (v) => actions.selectPdf(v),
      }),
    )
  }

  // Abas dos dois documentos (quando existem dois).
  if (session.docs.length > 1) {
    children.push(
      row(
        session.docs.map((doc, i) =>
          button(`doc:tab:${i}`, `${i + 1}: ${shortName(doc.name)}`, () => actions.selectTab(i), {
            plain: true,
            dimColor: session.activeDoc !== i,
          }),
        ),
      ),
    )
  }

  // Navegação de página (sem chamar o modelo). A identidade da prévia inclui o
  // caminho do documento: o slot sozinho não basta depois de fechar/reabrir.
  const activeDoc = session.docs[session.activeDoc] || null
  const preview = state.previews[session.activeDoc] || null
  const previewMatches = Boolean(preview && activeDoc && preview.path === activeDoc.path)
  const pageLabel = activeDoc ? `Página ${activeDoc.page} de ${activeDoc.numPages > 0 ? activeDoc.numPages : '—'}` : 'Nenhum PDF carregado'
  children.push(
    row(
      [
        button('page:prev', '◀ Anterior', () => actions.prev(), { dimColor: !activeDoc || state.busy === 'page' }),
        text(pageLabel),
        button('page:next', 'Próxima ▶', () => actions.next(), { dimColor: !activeDoc || state.busy === 'page' }),
        button('page:reload', 'Recarregar página', () => actions.reloadPage(), {
          dimColor: !activeDoc || Boolean(state.busy) || state.sending,
        }),
        hasInput
          ? input('page:jump', 'Ir para', '', (v) => actions.jump(v), { placeholder: 'nº', submitLabel: 'Ir' })
          : null,
      ].filter(Boolean),
    ),
  )

  // Prévia: Svg onde existe; texto claro no terminal, sem SVG e sem prévia.
  if (previewMatches && preview.svg && hasSvg) {
    children.push(
      Svg({
        source: preview.svg,
        alt: `Prévia da página ${preview.page} de ${activeDoc ? activeDoc.name : 'documento'}`,
        width: 720,
      }),
    )
  } else if (previewMatches && preview.svg) {
    children.push(
      text(`Prévia da página ${preview.page} carregada, mas esta superfície (${surface}) não desenha SVG.`, { dimColor: true }),
    )
  } else if (previewMatches) {
    children.push(
      text(
        preview.warning ||
          `Prévia indisponível para a página ${preview.page} (SVG grande demais para o painel); o PNG continua salvo para "Pedir análise da página".`,
        { dimColor: true },
      ),
    )
  } else if (activeDoc) {
    children.push(
      text(
        `Sem prévia da página ${activeDoc.page} de "${activeDoc.name}" na memória. O estado salvo guarda só metadados; use "Recarregar página" para carregar de novo — nada vai ao modelo sem você pedir.`,
        { dimColor: true },
      ),
    )
  } else {
    children.push(
      text('Sem prévia ainda. Informe o caminho de um PDF e use "Carregar PDF" — ou abra uma pasta e escolha um arquivo na lista.', {
        dimColor: true,
      }),
    )
  }

  if (activeDoc) children.push(text(`Documento ativo: ${activeDoc.name} (${activeDoc.path})`, { dimColor: true }))

  // Ações explícitas de análise e captura. O callback é o guard; o visual só
  // reflete a operação em andamento (`dimColor` é cosmético nos tipos nativos).
  children.push(
    row(
      [
        button('page:analyze', 'Pedir análise da página', () => actions.analyzePage(), {
          dimColor: !previewMatches || Boolean(state.busy) || state.sending,
        }),
        button('capture:run', 'Capturar Xournal++', () => actions.capture(), {
          dimColor: Boolean(state.busy) || state.sending,
        }),
        state.lastCapture
          ? button('capture:analyze', 'Pedir análise da captura', () => actions.analyzeCapture(), {
              dimColor: Boolean(state.busy) || state.sending,
            })
          : null,
        button('pdf:close', 'Fechar PDF', () => actions.closePdf(), {
          dimColor: !activeDoc || Boolean(state.busy) || state.sending,
        }),
      ].filter(Boolean),
    ),
  )

  // Estado (busy / fila / envio / erro / aviso / captura).
  if (state.busy) children.push(text(busyLabel(state.busy), { dimColor: true }))
  if (state.pendingPage) children.push(text('Página na fila…', { dimColor: true }))
  if (state.pendingSelect) children.push(text('Troca de PDF na fila…', { dimColor: true }))
  if (state.sending) children.push(text('Enviando prompt…', { dimColor: true }))
  if (state.storageError) children.push(text(`Armazenamento: ${state.storageError}`, { bold: true }))
  if (state.storageBlocked) children.push(button('store:replace', 'Substituir estado salvo', () => actions.replaceStore()))
  if (state.error) children.push(text(`Erro: ${state.error}`, { bold: true }))
  else if (state.notice) children.push(text(state.notice, { dimColor: true }))
  if (state.lastCapture) {
    children.push(text(`Captura disponível: ${state.lastCapture.snapshotPath}`, { dimColor: true }))
  }

  // Notas opcionais.
  if (hasInput) {
    children.push(
      input('notes', 'Notas (opcional)', session.notes, (v) => actions.setNotes(v), {
        placeholder: 'observações da sessão',
        onInput: (v) => actions.typeNotes(v),
      }),
    )
  }

  // Calculadora local (sem eval, sem modelo).
  children.push(
    row(
      [
        hasInput
          ? input('calc:expr', 'Calculadora', state.calcExpr, (v) => actions.calc(v), {
              placeholder: 'ex.: sin(pi/2)+2^3',
              submitLabel: 'Calcular',
              onInput: (v) => actions.typeCalc(v),
            })
          : null,
        button('calc:eval', 'Calcular', () => actions.calc()),
        button('calc:degrees', state.degrees ? 'Ângulo: graus' : 'Ângulo: radianos', () => actions.toggleDegrees(), {
          plain: true,
        }),
      ].filter(Boolean),
    ),
  )
  if (state.calcError) children.push(text(`Calculadora: ${state.calcError}`, { bold: true }))
  else if (state.calcResult !== null) children.push(text(`= ${state.calcResult}`))

  return col(children)
}
