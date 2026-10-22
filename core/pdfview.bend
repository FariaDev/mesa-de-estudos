import Base
import msg.bend as M
import view.bend as V

# ---------------------------------------------------------------------------
# Chrome do leitor de PDF (rótulos, classes, disabled) — sem medição/scroll.
#
# O host mede (página atual, zoom arredondado, nome do arquivo, fatos Bool
# de minimizar/primeiro/último) e já resolve o contador em `find.bend`
# (`Hidden` / `All` / `Shown`) — daqui entram os Bools `hidden`/`shown` e
# os Nats. Daqui saem as strings, as classes do `#pdf-grid` / painel e os
# nós que o aplicador (`view-host`) cola no DOM. Viewport, PDF.js,
# `cachedPdf` e o layout das páginas ficam no app.
#
# Sem referência para frente: helpers antes de quem chama.
# ---------------------------------------------------------------------------

# Classes do #pdf-grid a partir dos dois leitores.
type GridFlags is Data:
  GridFlags{otherMin: Bool, hasMin: Bool, hasOtherMin: Bool}

# Classes do .pdf-panel (minimized / pinned).
type PanelFlags is Data:
  PanelFlags{minimized: Bool, pinned: Bool}

# Contador .find-count: some ou mostra o texto já formatado.
type CountChrome is Data:
  CountChrome{hidden: Bool, text: String}

# Botões prev/next: disabled a partir dos fatos (tem doc? na primeira? na última?).
type NavChrome is Data:
  NavChrome{prevDisabled: Bool, nextDisabled: Bool}

# ---------- rótulos constantes ----------

def placeholderText() -> String:
  M.msg("pdf.placeholder")

def footLoadingText() -> String:
  M.msg("pdf.loading")

def footErrorText() -> String:
  M.msg("pdf.openFailed")

def pageTotalDash() -> String:
  "/ —"

# ---------- grid / painel / nav (match nos Bool) ----------

# other-min = o outro minimizado e este aberto;
# has-min = algum minimizado;
# has-other-min = este minimizado e o outro aberto.
def gridFlags(selfMin: Bool, otherMin: Bool) -> GridFlags:
  match selfMin otherMin:
    case False{} False{}:
      GridFlags{False{}, False{}, False{}}
    case False{} True{}:
      GridFlags{True{}, True{}, False{}}
    case True{} False{}:
      GridFlags{False{}, True{}, True{}}
    case True{} True{}:
      GridFlags{False{}, True{}, False{}}

def panelFlags(minimized: Bool, pinned: Bool) -> PanelFlags:
  PanelFlags{minimized, pinned}

def navChrome(hasDoc: Bool, atFirst: Bool, atLast: Bool) -> NavChrome:
  match hasDoc:
    case False{}:
      NavChrome{True{}, True{}}
    case True{}:
      NavChrome{atFirst, atLast}

def collapseTitle(minimized: Bool) -> String:
  match minimized:
    case True{}:
      M.msg("pdf.restore")
    case False{}:
      M.msg("pdf.minimize")

def disabledAttr(on: Bool) -> List<&2, V.ViewAttr>:
  V.attrWhen(on, V.attr("disabled", "disabled"))

# ---------- números já medidos pelo host (Nat) ----------

def pageNumberValue(page: Nat) -> String:
  Nat.show(page)

def pageNumberMax(total: Nat) -> String:
  Nat.show(total)

def pageTotalText(n: Nat) -> String:
  "/ " ++ Nat.show(n)

def zoomLabelText(pct: Nat) -> String:
  Nat.show(pct) ++ "%"

# O modo de leitura (hoje só a rolagem contínua) mora na frase do catálogo: um
# núcleo não monta texto com outra mensagem dentro (#41).
def footReadyText(page: Nat, total: Nat, file: String) -> String:
  M.msg3("pdf.foot.ready", "page", Nat.show(page), "total", Nat.show(total), "file", file)

# Contador: fatos já resolvidos pelo find.bend (Hidden / Shown / All).
# hidden=True some; senão shown=True → índice/total; senão só o total.
def findCountChrome.shown(shown: Bool, index: Nat, total: Nat) -> CountChrome:
  match shown:
    case True{}:
      CountChrome{False{}, Nat.show(index) ++ "/" ++ Nat.show(total)}
    case False{}:
      CountChrome{False{}, M.msg1("pdf.find.count", "count", Nat.show(total))}

def findCountChrome(hidden: Bool, shown: Bool, index: Nat, total: Nat) -> CountChrome:
  match hidden:
    case True{}:
      CountChrome{True{}, ""}
    case False{}:
      findCountChrome.shown(shown, index, total)

# ---------- classes como attr (o host não troca o className inteiro) ----------

def gridClass(selfMin: Bool, otherMin: Bool) -> V.ViewAttr:
  match selfMin otherMin:
    case False{} False{}:
      V.classes([V.classOn("other-min", False{}), V.classOn("has-min", False{}), V.classOn("has-other-min", False{})])
    case False{} True{}:
      V.classes([V.classOn("other-min", True{}), V.classOn("has-min", True{}), V.classOn("has-other-min", False{})])
    case True{} False{}:
      V.classes([V.classOn("other-min", False{}), V.classOn("has-min", True{}), V.classOn("has-other-min", True{})])
    case True{} True{}:
      V.classes([V.classOn("other-min", False{}), V.classOn("has-min", True{}), V.classOn("has-other-min", False{})])

def panelClass(minimized: Bool, pinned: Bool) -> V.ViewAttr:
  V.classes([
    V.classOn("pdf-panel", True{}),
    V.classOn("minimized", minimized),
    V.classOn("pinned", pinned)
  ])

# ---------- nós: o host aplica com renderInto / build ----------

def label(s: String) -> V.ViewNode:
  V.viewText(s)

def placeholder() -> V.ViewNode:
  V.viewEl("div", [V.attrClass("pdf-placeholder")], [V.viewText(placeholderText())])

def pageTotalEmpty() -> V.ViewNode:
  V.viewText(pageTotalDash())

def pageTotal(n: Nat) -> V.ViewNode:
  V.viewText(pageTotalText(n))

def zoomLabel(pct: Nat) -> V.ViewNode:
  V.viewText(zoomLabelText(pct))

def footLoading() -> V.ViewNode:
  V.viewText(footLoadingText())

def footError() -> V.ViewNode:
  V.viewText(footErrorText())

def footReady(page: Nat, total: Nat, file: String) -> V.ViewNode:
  V.viewText(footReadyText(page, total, file))

# Rodapé com o número impresso ao lado da página física. Sem rótulo (PDF sem
# numeração e sem ajuste, ou página de front matter) o texto é o de sempre —
# e nada muda para quem já lia o rodapé. O nó é um span com title: o nome do
# arquivo pode encurtar por ellipsis, mas o texto completo fica no tooltip.
def footReadyTextLabeled.if(page: Nat, total: Nat, file: String, label: String, empty: Bool) -> String:
  match empty:
    case True{}:
      footReadyText(page, total, file)
    case False{}:
      M.msg4("pdf.foot.readyLabeled", "page", Nat.show(page), "total", Nat.show(total), "label", label, "file", file)

def footReadyTextLabeled(page: Nat, total: Nat, file: String, +label: String) -> String:
  footReadyTextLabeled.if(page, total, file, label, String.is_empty(label))

def footReadyLabeled(page: Nat, total: Nat, file: String, label: String) -> V.ViewNode:
  +text = footReadyTextLabeled(page, total, file, label)
  V.viewEl("span", [V.attrTitle(text)], Con{V.viewText(text), Nil{}})

def findCountLabel(c: CountChrome) -> V.ViewNode:
  match c:
    case CountChrome{hidden, text}:
      V.viewText(text)
