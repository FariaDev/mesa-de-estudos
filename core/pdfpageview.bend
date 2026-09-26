import Base
import view.bend as V
import pdfnav.bend as N
import pdfview.bend as P

# ---------------------------------------------------------------------------
# Leitor de PDF da Mesa: a moldura do painel, as páginas e os destaques da
# busca. O chrome (rótulos de página/zoom/rodapé, classes do grid, contador)
# mora em `pdfview.bend` — aqui ele é composto em árvore, sem duplicar decisão.
#
# Puro: entra fato (Bool/Nat/String já resolvidos pelo host), sai `ViewNode`.
# O host fica com o mundo: PDF.js (viewport/medição de texto), biblioteca,
# zoom, página atual, scroll/`offsetTop`, `ResizeObserver`, virtualização,
# canvas/textLayer, `goto`, divisores e IPC.
#
# Contrato do smoke preservado (tags/classes/attrs 1:1 com o Electron):
#   section.pdf-panel > .pdf-title (strong, select.pdf-select, .open,
#   .find-toggle, .page-shot, .collapse) + .pdf-tools (prev, .page-number,
#   .page-total, next, out, .zoom-label, in, fit, invert) + .pdf-stage
#   (.pdf-viewport + .pdf-foot) + form.pdf-find
#   .pdf-viewport > .pdf-document > .pdf-page[data-page][style]
#   .textLayer span > i.pdf-hl (destaque da busca)
#
# `.pdf-page` é a âncora da página (data-page e caixa medidas pelo PDF.js) e o
# placeholder do que ainda não pintou: o shimmer é CSS via
# `:not([data-rendered])`, e `data-rendered` é marca de render do host (o
# canvas/textLayer entram depois, como slots). Carregando/erro são estados do
# rodapé (`pdfview`) e não mexem no miolo — 1:1 com o Electron.
# ---------------------------------------------------------------------------

# Uma opção do `.pdf-select` (a biblioteca de PDFs do host).
type PdfOption is Data:
  PdfOption{name: String, path: String}

# Uma página já medida pelo host: número (1-based) e caixa em px CSS.
type PdfPageBox is Data:
  PdfPageBox{n: Nat, width: String, height: String}

# O estado do leitor: sem PDF, abrindo, falhou ou pronto.
type PdfReader is Data:
  PdfEmpty{}
  PdfLoading{}
  PdfFailed{}
  PdfReady{}

# A cabeça do painel como o host a conhece (fatos já resolvidos).
type PdfShell is Data:
  PdfShell{
    label: String,
    options: +List<PdfOption>,
    path: String,
    minimized: Bool,
    findOpen: Bool
  }

# Um trecho de texto de um `span` do textLayer: `hit=True` vira `.pdf-hl`.
type PdfHlSeg is Data:
  PdfHlSeg{text: String, hit: Bool}

# ---------- rótulos constantes (o host não escreve UI) ----------

def emptyOptionLabel() -> String:
  "Escolha um PDF…"

def findPlaceholder() -> String:
  "Buscar neste PDF…"

def findButtonLabel() -> String:
  "Buscar"

def openTitle() -> String:
  "Abrir outro PDF"

def findTitle() -> String:
  "Buscar"

def shotTitle() -> String:
  "Mandar esta página como imagem no chat"

def prevAria() -> String:
  "Página anterior"

def nextAria() -> String:
  "Próxima página"

def outAria() -> String:
  "Diminuir zoom"

def inAria() -> String:
  "Aumentar zoom"

def fitTitle() -> String:
  "Ajustar à largura"

def invertTitle() -> String:
  "Inverter cores da página (tema escuro)"

def invertAria() -> String:
  "Inverter cores da página"

def dividerAria() -> String:
  "Redimensionar leitores de PDF"

def documentAria(label: String) -> String:
  "Documento de " ++ label

def openAria(label: String) -> String:
  "Abrir PDF em " ++ label

def findAria(label: String) -> String:
  "Buscar em " ++ label

def pageAria(label: String) -> String:
  "Página de " ++ label

# ---------- select da biblioteca ----------

def optionKids(name: String) -> List<&2, V.ViewNode>:
  Con{V.viewText(name), Nil{}}

def optionNode(option: PdfOption, +path: String) -> V.ViewNode:
  match option:
    case PdfOption{name, +optionPath}:
      V.viewEl("option", V.attrJoin([
        [V.ViewAttr{"value", optionPath}],
        V.attrWhen(String.eq(optionPath, path), V.ViewAttr{"selected", ""})
      ]), optionKids(name))

def optionEmpty() -> V.ViewNode:
  V.viewEl("option", [V.ViewAttr{"value", ""}], optionKids(emptyOptionLabel()))

def optionNodes.go(+options: List<&2, PdfOption>, +path: String) -> List<&2, V.ViewNode>:
  match options:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{optionNode(h, path), optionNodes.go(t, path)}

def optionNodes(+options: List<&2, PdfOption>, +path: String) -> List<&2, V.ViewNode>:
  Con{optionEmpty(), optionNodes.go(options, path)}

def selectNode(label: String, options: +List<PdfOption>, +path: String) -> V.ViewNode:
  V.viewEl("select", [V.attrClass("pdf-select"), V.attrAria("label", documentAria(label)), V.attrOn("change", "OpenDoc")], optionNodes(options, path))

# ---------- cabeça do painel (botões de ícone com andaime `data-icon`) ----------

def iconBtnAttrs(cls: String, iconName: String, aria: String) -> List<&2, V.ViewAttr>:
  [V.attrClass(String.append(cls, " icon-btn")), V.attrAria("label", aria), V.attrData("icon", iconName)]

def openBtn(label: String) -> V.ViewNode:
  V.viewEl("button", V.attrJoin([
    iconBtnAttrs("open", "plus", openAria(label)),
    [V.attrTitle(openTitle()), V.attrOn("click", "OpenFile")]
  ]), Nil{})

def findToggleBtn(label: String, open: Bool) -> V.ViewNode:
  V.viewEl("button", V.attrJoin([
    iconBtnAttrs("find-toggle", "search", findAria(label)),
    [V.attrTitle(findTitle()), V.attrBool("aria-pressed", open), V.attrOn("click", "ToggleFind")]
  ]), Nil{})

def shotBtn(label: String) -> V.ViewNode:
  V.viewEl("button", V.attrJoin([
    iconBtnAttrs("page-shot", "camera", shotTitle()),
    [V.attrTitle(shotTitle()), V.attrOn("click", "PageShot")]
  ]), Nil{})

def collapseIcon(minimized: Bool) -> String:
  match minimized:
    case True{}:
      "chevronUp"
    case False{}:
      "chevronDown"

def collapseBtn(+minimized: Bool) -> V.ViewNode:
  +title = P.collapseTitle(minimized)
  V.viewEl("button", V.attrJoin([
    iconBtnAttrs("collapse", collapseIcon(minimized), title),
    [V.attrTitle(title), V.attrBool("aria-pressed", minimized), V.attrOn("click", "ToggleCollapse")]
  ]), Nil{})

# ---------- voltar à página anterior (citação seguida) ----------

def navBackTitle() -> String:
  N.navBackTitle()

def navBackAria(label: String) -> String:
  N.navBackAria(label)

# O botão que abre o popover de favoritos/sumário: o corpo do popover é do host
# (`core/pdfnav.bend` desenha o esqueleto e as linhas).
def navBtn(label: String) -> V.ViewNode:
  V.viewEl("button", V.attrJoin([
    iconBtnAttrs("nav", "book", N.navAria(label)),
    [ V.attrTitle(N.navButtonTitle())
    , V.attrBool("aria-expanded", False{})
    , V.attrOn("click", "ToggleNav")
    ]
  ]), Nil{})

# Nasce escondido: o host mostra quando há o que voltar naquele leitor.
def backBtn(label: String) -> V.ViewNode:
  V.viewEl("button", V.attrJoin([
    iconBtnAttrs("back", "chevronLeft", navBackAria(label)),
    [V.attrTitle(navBackTitle()), V.attrOn("click", "NavBack"), V.attr("hidden", "")]
  ]), Nil{})

def titleBar(shell: PdfShell) -> V.ViewNode:
  match shell:
    case PdfShell{+label, +options, +path, +minimized, findOpen}:
      V.viewEl("div", [V.attrClass("pdf-title")], [
        V.viewEl("strong", Nil{}, [V.viewText(label)]),
        selectNode(label, options, path),
        openBtn(label),
        findToggleBtn(label, findOpen),
        shotBtn(label),
        backBtn(label),
        navBtn(label),
        collapseBtn(minimized)
      ])

# ---------- ferramentas (o host preenche page-total/zoom-label) ----------

def iconBtn(cls: String, iconName: String, aria: String, handler: String) -> V.ViewNode:
  V.viewEl("button", V.attrConcat(iconBtnAttrs(cls, iconName, aria), [V.attrOn("click", handler)]), Nil{})

def titleIconBtn(cls: String, iconName: String, title: String, aria: String, handler: String) -> V.ViewNode:
  V.viewEl("button", V.attrJoin([iconBtnAttrs(cls, iconName, aria), [V.attrTitle(title), V.attrOn("click", handler)]]), Nil{})

def pageInput(label: String) -> V.ViewNode:
  V.viewEl("input", [
    V.attrClass("page-number"),
    V.ViewAttr{"type", "number"},
    V.ViewAttr{"min", "1"},
    V.ViewAttr{"value", "1"},
    V.attrAria("label", pageAria(label)),
    V.attrOn("change", "GotoPage")
  ], Nil{})

def toolsBar(label: String) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("pdf-tools")], [
    iconBtn("prev", "chevronLeft", prevAria(), "Prev"),
    pageInput(label),
    V.viewEl("span", [V.attrClass("page-total")], Nil{}),
    iconBtn("next", "chevronRight", nextAria(), "Next"),
    iconBtn("out", "minus", outAria(), "ZoomOut"),
    V.viewEl("span", [V.attrClass("zoom-label")], Nil{}),
    iconBtn("in", "plus", inAria(), "ZoomIn"),
    titleIconBtn("fit", "unfold", fitTitle(), fitTitle(), "Fit"),
    titleIconBtn("invert", "contrast", invertTitle(), invertAria(), "ToggleInvert")
  ])

# ---------- palco, busca e divisores ----------

def stage() -> V.ViewNode:
  V.viewEl("div", [V.attrClass("pdf-stage")], [
    V.viewEl("div", [V.attrClass("pdf-viewport")], Nil{}),
    V.viewEl("div", [V.attrClass("pdf-foot")], Nil{})
  ])

def findForm(label: String) -> V.ViewNode:
  V.viewEl("form", [
    V.attrClass("pdf-find"),
    V.attrOn("submit", "Find"),
    V.ViewAttr{"hidden", ""}
  ], [
    V.viewEl("input", [V.ViewAttr{"placeholder", findPlaceholder()}, V.attrAria("label", findAria(label))], Nil{}),
    V.viewEl("span", [V.attrClass("find-count"), V.ViewAttr{"hidden", ""}], Nil{}),
    V.viewEl("button", Nil{}, [V.viewText(findButtonLabel())])
  ])

# O painel inteiro (a `section`), como o host o monta uma vez por matéria.
# `pinned` é do host (o `state.mjs` marca o primeiro painel depois de criar).
def panelShell(shell: PdfShell) -> V.ViewNode:
  match shell:
    case PdfShell{+label, +options, +path, +minimized, findOpen}:
      V.viewEl("section", [
        P.panelClass(minimized, False{}),
        V.attrAria("label", label),
        V.ViewAttr{"tabindex", "0"}
      ], [
        titleBar(PdfShell{label, options, path, minimized, findOpen}),
        toolsBar(label),
        stage(),
        findForm(label)
      ])

def divider() -> V.ViewNode:
  V.viewEl("div", [V.attrClass("pdf-divider"), V.ViewAttr{"tabindex", "0"}, V.ViewAttr{"role", "separator"}, V.attrAria("label", dividerAria())], Nil{})

# ---------- páginas (âncoras medidas pelo host) ----------

def pageStyle(width: String, height: String) -> String:
  "width:" ++ width ++ ";height:" ++ height

def pageNode(box: PdfPageBox) -> V.ViewNode:
  match box:
    case PdfPageBox{n, width, height}:
      V.viewEl("div", [
        V.attrClass("pdf-page"),
        V.attrData("page", Nat.show(n)),
        V.ViewAttr{"style", pageStyle(width, height)}
      ], Nil{})

def pageNodes(+boxes: List<&2, PdfPageBox>) -> List<&2, V.ViewNode>:
  match boxes:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{pageNode(h), pageNodes(t)}

def docFrame(+boxes: List<&2, PdfPageBox>) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("pdf-document")], pageNodes(boxes))

# O que o miolo do leitor mostra para cada estado. Carregando/erro devolvem
# None: o rodapé (`pdfview`) já diz o estado e o miolo não é mexido — o mesmo
# comportamento do Electron (o documento anterior fica até o novo render).
def viewport(state: PdfReader, boxes: +List<&2, PdfPageBox>) -> Maybe<&2, V.ViewNode>:
  match state:
    case PdfEmpty{}:
      Some{P.placeholder()}
    case PdfReady{}:
      Some{docFrame(boxes)}
    case PdfLoading{}:
      None{}
    case PdfFailed{}:
      None{}

# ---------- destaques da busca (`.pdf-hl`) ----------
# O host dobra (`foldSearch`, mesma largura) e garante `text`/`folded` do mesmo
# tamanho; a varredura anda os dois lado a lado, um char por vez, e o hit é o
# pedaço do texto **original** (índice da dobra = índice do original). Mesma
# semântica do `indexOf` do Electron: casamento à esquerda, sem sobreposição —
# `rem` é o resto do termo que ainda está sendo consumido (`SNil` = fora de
# hit) e o hit já entra em `out` com o texto inteiro, medido por `n`.

def hlPush(seg: PdfHlSeg, out: List<&2, PdfHlSeg>) -> List<&2, PdfHlSeg>:
  Con{seg, out}

# `pend` é o texto fora de hits, ao contrário; desvira ao fechar o trecho.
def hlFlush.if(+pend: String, out: List<&2, PdfHlSeg>, empty: Bool) -> List<&2, PdfHlSeg>:
  match empty:
    case True{}:
      out
    case False{}:
      hlPush(PdfHlSeg{String.reverse(pend), False{}}, out)

def hlFlush(+pend: String, out: List<&2, PdfHlSeg>) -> List<&2, PdfHlSeg>:
  hlFlush.if(pend, out, String.is_empty(pend))

def hlScan(+text: String, +folded: String, +term: String, +n: Nat, rem: String, fact: Bool, +pend: String, out: List<&2, PdfHlSeg>) -> List<&2, PdfHlSeg>:
  match text rem fact:
    case SNil{} _ _:
      hlFlush(pend, out)
    case SCon{_, t} SNil{} True{}:
      hlScan(t, String.drop(folded, 1n), term, n, String.drop(term, 1n), String.starts_with(String.drop(folded, 1n), term), "", hlPush(PdfHlSeg{String.take(text, n), True{}}, hlFlush(pend, out)))
    case SCon{_, t} SNil{} False{}:
      hlScan(t, String.drop(folded, 1n), term, n, "", String.starts_with(String.drop(folded, 1n), term), String.append(String.take(text, 1n), pend), out)
    case SCon{_, t} SCon{_, rs} _:
      hlScan(t, String.drop(folded, 1n), term, n, rs, String.starts_with(String.drop(folded, 1n), term), pend, out)

# Segmentos → nós: hit vira `<i class="pdf-hl">`, o resto vira texto.
def hlNode.go(text: String, hit: Bool) -> V.ViewNode:
  match hit:
    case True{}:
      V.viewEl("i", [V.attrClass("pdf-hl")], Con{V.viewText(text), Nil{}})
    case False{}:
      V.viewText(text)

def hlNode(seg: PdfHlSeg) -> V.ViewNode:
  match seg:
    case PdfHlSeg{text, hit}:
      hlNode.go(text, hit)

# `hlScan` fecha os segmentos ao contrário; prependendo um a um, `acc` já sai
# na ordem do texto (nada de reverter no fim).
def hlNodes(+segs: List<&2, PdfHlSeg>, acc: List<&2, V.ViewNode>) -> List<&2, V.ViewNode>:
  match segs:
    case Nil{}:
      acc
    case Con{h, t}:
      hlNodes(t, Con{hlNode(h), acc})

def hlSegments.if(+text: String, +folded: String, +term: String, empty: Bool) -> List<&2, V.ViewNode>:
  match empty:
    case True{}:
      Con{V.viewText(text), Nil{}}
    case False{}:
      hlNodes(hlScan(text, folded, term, String.length(term), "", String.starts_with(folded, term), "", Nil{}), Nil{})

# Filhos de um `span` do textLayer. Sem termo (ou sem casamento) o span
# continua um nó de texto único, como no Electron.
def hlSegments(+text: String, +folded: String, +term: String) -> List<&2, V.ViewNode>:
  hlSegments.if(text, folded, term, String.is_empty(term))
