import Base
import msg.bend as M
import view.bend as V
import pdfnav.bend as N
import pdfview.bend as P
import readersheet.bend as RS

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
# Contrato do smoke (tags/classes/attrs 1:1 com o Electron):
#   section.pdf-panel > .pdf-title (UMA linha: strong, select.pdf-select, .back,
#   .prev, .page-number, .page-total, .next, .find-toggle, .nav, .more) +
#   .pdf-stage (.pdf-viewport + .pdf-foot) + form.pdf-find + .pdf-more-pop
#   (.open, .page-shot, .more-zoom[.out, .zoom-label, .in], .fit, .invert,
#   .rotate, .collapse; o host põe .printed-toggle antes do .collapse) +
#   button.pdf-restore (a faixa do leitor recolhido)
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

# O estado do leitor: sem PDF, sem PDF numa matéria (a folha "Lista 0"),
# abrindo, falhou ou pronto. `PdfSheet` leva o nome da matéria; `PdfEmpty` é o
# vazio sem matéria (aba Livre, primeira abertura).
type PdfReader is Data:
  PdfEmpty{}
  PdfSheet{course: String}
  PdfLoading{}
  PdfFailed{}
  PdfReady{}

# A cabeça do painel como o host a conhece (fatos já resolvidos). `rotation`
# é a volta do USUÁRIO (0/90/180/270) — a rotação nativa da página (`/Rotate`
# do PDF) é somada pelo host na hora do viewport, não é fato da moldura.
type PdfShell is Data:
  PdfShell{
    label: String,
    options: +List<PdfOption>,
    path: String,
    minimized: Bool,
    findOpen: Bool,
    rotation: Nat
  }

# Um trecho de texto de um `span` do textLayer: `hit=True` vira `.pdf-hl`.
type PdfHlSeg is Data:
  PdfHlSeg{text: String, hit: Bool}

# ---------- rótulos constantes (o host não escreve UI) ----------

def emptyOptionLabel() -> String:
  M.msg("pdf.view.empty")

def findPlaceholder() -> String:
  M.msg("pdf.view.findPlaceholder")

def findButtonLabel() -> String:
  M.msg("common.search")

def openTitle() -> String:
  M.msg("pdf.view.open")

def findTitle() -> String:
  M.msg("common.search")

def shotTitle() -> String:
  M.msg("pdf.view.shot")

def prevAria() -> String:
  M.msg("pdf.view.prev")

def nextAria() -> String:
  M.msg("pdf.view.next")

def outAria() -> String:
  M.msg("pdf.view.zoomOut")

def inAria() -> String:
  M.msg("pdf.view.zoomIn")

def fitTitle() -> String:
  M.msg("pdf.view.fit")

# Página escura (#42): opcional e desligada por padrão, mesmo no tema escuro —
# figuras e fotos distorcem e o Conferir compara com o papel branco do
# Xournal++. Inverte o papel e o texto preservando o matiz; é estado de
# interface por leitor (o host guarda), fora do `config.json`.
def invertTitle() -> String:
  M.msg("pdf.view.invertTitle")

def invertAria() -> String:
  M.msg("pdf.view.invert")

def dividerAria() -> String:
  M.msg("pdf.view.divider")

def documentAria(label: String) -> String:
  M.msg1("pdf.view.docAria", "label", label)

def openAria(label: String) -> String:
  M.msg1("pdf.view.openAria", "label", label)

def findAria(label: String) -> String:
  M.msg1("pdf.view.findAria", "label", label)

def pageAria(label: String) -> String:
  M.msg1("pdf.view.pageAria", "label", label)

def moreTitle() -> String:
  M.msg("pdf.view.more")

def moreAria(label: String) -> String:
  M.msg1("pdf.view.moreAria", "label", label)

def restoreAria(label: String) -> String:
  M.msg1("pdf.view.restoreAria", "label", label)

def zoomRowLabel() -> String:
  M.msg("pdf.view.zoom")

def shotMenuLabel() -> String:
  M.msg("pdf.view.shotMenu")

def invertMenuLabel() -> String:
  M.msg("pdf.view.invert")

def printedMenuLabel() -> String:
  M.msg("pdf.view.printedMenu")

# ---------- rotação do leitor (ciclo de 90° por documento) ----------

# Passo do ciclo e próxima orientação: 0→90→180→270→0. A volta é do usuário,
# somada à rotação nativa da página pelo host (viewport do PDF.js).
def rotationStep() -> Nat:
  90n

def rotationNext(+rotation: Nat) -> Nat:
  Nat.mod(Nat.add(rotation, rotationStep()), 360n)

# Só as quatro orientações do ciclo são válidas. Qualquer outra coisa (dado
# antigo, corrompido ou editado à mão) não vira rotação: normaliza para 0 —
# o documento nasce em pé, como os PDFs legados.
def rotationValid(+rotation: Nat) -> Bool:
  match rotation:
    case 0n:
      True{}
    case 90n:
      True{}
    case 180n:
      True{}
    case 270n:
      True{}
    case _:
      False{}

def rotationNormalize.if(+rotation: Nat, valid: Bool) -> Nat:
  match valid:
    case True{}:
      rotation
    case False{}:
      0n

def rotationNormalize(+rotation: Nat) -> Nat:
  rotationNormalize.if(rotation, rotationValid(rotation))

def rotateTitle(+rotation: Nat) -> String:
  M.msg1("pdf.view.rotateTitle", "deg", Nat.show(rotation))

def rotateAria(label: String, +rotation: Nat) -> String:
  M.msg2("pdf.view.rotateAria", "label", label, "deg", Nat.show(rotation))

def rotateToast(+rotation: Nat) -> String:
  M.msg1("pdf.view.rotateToast", "deg", Nat.show(rotation))

# ---------- numeração impressa (rótulos do PDF e ajuste pessoal) ----------
#
# A página FÍSICA (1-based, a mesma do state, das citações e do IPC) nunca
# muda aqui: o que entra é só o que MOSTRAR e o alvo de navegação por número
# impresso. Os rótulos próprios do PDF (`getPageLabels` do PDF.js) vencem o
# ajuste pessoal; o ajuste (`impressa = física + offset`) é o recurso para
# PDFs sem rótulo. Página física que não tem número impresso (capa, front
# matter romano fora do alcance do ajuste) devolve "" e não vira alvo.

# Ausência de ajuste NÃO é zero: zero é um ajuste válido (impressa = física).
type PrintedOffset is Data:
  OffsetAuto{}
  OffsetValue{negative: Bool, magnitude: Nat}

# Já validado pelo main (inteiro, |offset| <= 1.000.000); aqui só decide.
def printedOffsetLabel.positive(n: Nat) -> String:
  match n:
    case 0n:
      ""
    case 1n+p:
      Nat.show(n)

# Nat.sub satura em 0: impressa <= 0 não é rótulo (front matter).
def printedOffsetLabel.signed(negative: Bool, magnitude: Nat, physical: Nat) -> String:
  match negative:
    case True{}:
      printedOffsetLabel.positive(Nat.sub(physical, magnitude))
    case False{}:
      Nat.show(Nat.add(physical, magnitude))

def printedOffsetLabel(offset: PrintedOffset, physical: Nat) -> String:
  match offset:
    case OffsetAuto{}:
      ""
    case OffsetValue{negative, magnitude}:
      printedOffsetLabel.signed(negative, magnitude, physical)

def printedLabel.own.if(label: String, offset: PrintedOffset, physical: Nat, empty: Bool) -> String:
  match empty:
    case True{}:
      printedOffsetLabel(offset, physical)
    case False{}:
      label

def printedLabel.own(+label: String, offset: PrintedOffset, physical: Nat) -> String:
  printedLabel.own.if(label, offset, physical, String.is_empty(label))

def printedLabel.go(+own: List<&2, String>, offset: PrintedOffset, original: Nat, +i: Nat) -> String:
  match own i:
    case Nil{} _:
      printedOffsetLabel(offset, original)
    case Con{h, t} 0n:
      printedLabel.own(h, offset, original)
    case Con{h, t} 1n+p:
      printedLabel.go(t, offset, original, p)

# Rótulo impresso de uma página física. "" = sem número impresso visível.
def printedLabel(+own: List<&2, String>, offset: PrintedOffset, +physical: Nat) -> String:
  printedLabel.go(own, offset, physical, Nat.sub(physical, 1n))

# ---------- resolver o que o usuário digitou no campo impresso ----------

def isDigitChar(c: Char) -> Bool:
  +u = Char.to_u32(c)
  Bool.and(U32.is_ge(u, 48), U32.is_le(u, 57))

def printedDigits.go(+s: String, ok: Bool) -> Bool:
  match s:
    case SNil{}:
      ok
    case SCon{h, t}:
      printedDigits.go(t, Bool.and(ok, isDigitChar(h)))

def printedDigits(text: String) -> Bool:
  printedDigits.go(text, True{})

# Só dígitos viram número impresso (o `U32.read` do Base aceita lixo).
def printedNumber.parsed(parsed: Maybe<&2, U32>) -> Maybe<&2, Nat>:
  match parsed:
    case Some{n}:
      Some{U32.to_nat(n)}
    case None{}:
      None{}

def printedNumber.if(text: String, empty: Bool, digits: Bool) -> Maybe<&2, Nat>:
  match empty:
    case True{}:
      None{}
    case False{}:
      match digits:
        case False{}:
          None{}
        case True{}:
          printedNumber.parsed(U32.read(text))

def printedNumber(+text: String) -> Maybe<&2, Nat>:
  printedNumber.if(text, String.is_empty(text), printedDigits(text))

# Todas as páginas cujo rótulo próprio casa (na ordem das páginas).
def printedMatches.cmp(candidate: String, +text: String, fold: Bool) -> Bool:
  match fold:
    case False{}:
      String.eq(candidate, text)
    case True{}:
      String.eq(String.to_lower(candidate), String.to_lower(text))

def printedMatches.push(out: List<&2, Nat>, n: Nat, same: Bool) -> List<&2, Nat>:
  match same:
    case True{}:
      List.append(&2, Nat, out, Con{n, Nil{}})
    case False{}:
      out

def printedMatches.go(+own: List<&2, String>, +text: String, +fold: Bool, +n: Nat, +out: List<&2, Nat>) -> List<&2, Nat>:
  match own:
    case Nil{}:
      out
    case Con{h, t}:
      printedMatches.go(t, text, fold, Nat.add(n, 1n), printedMatches.push(out, n, printedMatches.cmp(h, text, fold)))

# Rótulo repetido anda em ciclo a partir da página atual: o primeiro alvo
# DEPOIS dela, senão o primeiro da lista.
def printedPick.first.if(first: Nat, candidate: Nat, zero: Bool) -> Nat:
  match zero:
    case True{}:
      candidate
    case False{}:
      first

def printedPick.first(+first: Nat, candidate: Nat) -> Nat:
  printedPick.first.if(first, candidate, Nat.is_eq(first, 0n))

def printedPick.best.min.if(candidate: Nat, best: Nat, lt: Bool) -> Nat:
  match lt:
    case True{}:
      candidate
    case False{}:
      best

def printedPick.best.min(+candidate: Nat, +best: Nat) -> Nat:
  printedPick.best.min.if(candidate, best, Nat.is_lt(candidate, best))

def printedPick.best.none(best: Nat, candidate: Nat, zero: Bool) -> Nat:
  match zero:
    case True{}:
      candidate
    case False{}:
      printedPick.best.min(candidate, best)

def printedPick.best.if(+best: Nat, candidate: Nat, current: Nat, gt: Bool) -> Nat:
  match gt:
    case False{}:
      best
    case True{}:
      printedPick.best.none(best, candidate, Nat.is_eq(best, 0n))

def printedPick.best(+best: Nat, +candidate: Nat, +current: Nat) -> Nat:
  printedPick.best.if(best, candidate, current, Nat.is_gt(candidate, current))

def printedPick.fin.if(first: Nat, best: Nat, zero: Bool) -> Nat:
  match zero:
    case True{}:
      first
    case False{}:
      best

def printedPick.fin(first: Nat, +best: Nat) -> Nat:
  printedPick.fin.if(first, best, Nat.is_eq(best, 0n))

def printedPick.go(+matches: List<&2, Nat>, +current: Nat, first: Nat, best: Nat) -> Nat:
  match matches:
    case Nil{}:
      printedPick.fin(first, best)
    case Con{h, t}:
      printedPick.go(t, current, printedPick.first(first, h), printedPick.best(best, h, current))

# Página física dentro do documento (o alvo nunca sai de 1..total).
def resolvePrinted.inBounds.if(page: Nat, total: Nat, ok: Bool) -> Maybe<&2, Nat>:
  match ok:
    case True{}:
      Some{page}
    case False{}:
      None{}

def resolvePrinted.inBounds(+page: Nat, +total: Nat) -> Maybe<&2, Nat>:
  resolvePrinted.inBounds.if(page, total, Bool.and(Nat.is_ge(page, 1n), Nat.is_le(page, total)))

def resolvePrinted.shift(negative: Bool, magnitude: Nat, printed: Nat, total: Nat) -> Maybe<&2, Nat>:
  match negative:
    case True{}:
      resolvePrinted.inBounds(Nat.add(printed, magnitude), total)
    case False{}:
      resolvePrinted.inBounds(Nat.sub(printed, magnitude), total)

# Sem rótulos próprios: o texto é a impressa e o ajuste desfaz o deslocamento.
def resolvePrinted.byOffset.value(offset: PrintedOffset, printed: Nat, total: Nat) -> Maybe<&2, Nat>:
  match offset:
    case OffsetAuto{}:
      resolvePrinted.inBounds(printed, total)
    case OffsetValue{negative, magnitude}:
      resolvePrinted.shift(negative, magnitude, printed, total)

def resolvePrinted.byOffset.parsed(offset: PrintedOffset, total: Nat, parsed: Maybe<&2, Nat>) -> Maybe<&2, Nat>:
  match parsed:
    case None{}:
      None{}
    case Some{printed}:
      resolvePrinted.byOffset.value(offset, printed, total)

def resolvePrinted.byOffset(offset: PrintedOffset, text: String, total: Nat) -> Maybe<&2, Nat>:
  resolvePrinted.byOffset.parsed(offset, total, printedNumber(text))

def resolvePrinted.folded.matches(+text: String, total: Nat, current: Nat, matches: List<&2, Nat>) -> Maybe<&2, Nat>:
  match matches:
    case Nil{}:
      None{}
    case Con{h, t}:
      resolvePrinted.inBounds(printedPick.go(Con{h, t}, current, 0n, 0n), total)

def resolvePrinted.folded(+own: List<&2, String>, +text: String, total: Nat, current: Nat) -> Maybe<&2, Nat>:
  resolvePrinted.folded.matches(text, total, current, printedMatches.go(own, text, True{}, 1n, Nil{}))

def resolvePrinted.own.matches(+own: List<&2, String>, +text: String, total: Nat, current: Nat, matches: List<&2, Nat>) -> Maybe<&2, Nat>:
  match matches:
    case Nil{}:
      resolvePrinted.folded(own, text, total, current)
    case Con{h, t}:
      resolvePrinted.inBounds(printedPick.go(Con{h, t}, current, 0n, 0n), total)

def resolvePrinted.own(+own: List<&2, String>, +text: String, total: Nat, current: Nat) -> Maybe<&2, Nat>:
  resolvePrinted.own.matches(own, text, total, current, printedMatches.go(own, text, False{}, 1n, Nil{}))

def resolvePrinted.if(+own: List<&2, String>, offset: PrintedOffset, total: Nat, current: Nat, +text: String) -> Maybe<&2, Nat>:
  match own:
    case Nil{}:
      resolvePrinted.byOffset(offset, text, total)
    case Con{h, t}:
      resolvePrinted.own(own, text, total, current)

def resolvePrinted.empty(own: List<&2, String>, offset: PrintedOffset, total: Nat, current: Nat, text: String, empty: Bool) -> Maybe<&2, Nat>:
  match empty:
    case True{}:
      None{}
    case False{}:
      resolvePrinted.if(own, offset, total, current, text)

# Página FÍSICA para o que foi digitado no campo de numeração impressa.
def resolvePrinted(own: List<&2, String>, offset: PrintedOffset, total: Nat, current: Nat, text: String) -> Maybe<&2, Nat>:
  +trimmed = String.trim(text)
  resolvePrinted.empty(own, offset, total, current, trimmed, String.is_empty(trimmed))

# ---------- textos do controle de numeração impressa ----------

def printedTitle() -> String:
  M.msg("pdf.printed.title")

def printedInputPlaceholder() -> String:
  M.msg("pdf.printed.placeholder")

def printedInputAria(label: String) -> String:
  M.msg1("pdf.printed.inputAria", "label", label)

def printedGoLabel() -> String:
  M.msg("pdf.printed.go")

def printedToggleTitle() -> String:
  M.msg("pdf.printed.toggleTitle")

def printedToggleAria(label: String) -> String:
  M.msg1("pdf.printed.toggleAria", "label", label)

def printedOffsetFieldLabel() -> String:
  M.msg("pdf.printed.offset")

def printedOffsetTitle() -> String:
  M.msg("pdf.printed.offsetTitle")

def printedOffsetInputAria(label: String) -> String:
  M.msg1("pdf.printed.offsetAria", "label", label)

def printedOffsetSaveLabel() -> String:
  M.msg("pdf.printed.save")

def printedOffsetAutoLabel() -> String:
  M.msg("pdf.printed.auto")

def printedOwnLabel() -> String:
  M.msg("pdf.printed.own")

def printedAutoLabel() -> String:
  M.msg("pdf.printed.noAdjust")

def printedOwnHint() -> String:
  M.msg("pdf.printed.ownHint")

def printedNoApiHint() -> String:
  M.msg("pdf.printed.noApi")

def printedStatusText.signed(negative: Bool, magnitude: Nat) -> String:
  match negative:
    case True{}:
      M.msg1("pdf.printed.minus", "n", Nat.show(magnitude))
    case False{}:
      M.msg1("pdf.printed.plus", "n", Nat.show(magnitude))

def printedStatusText(own: Bool, offset: PrintedOffset) -> String:
  match own:
    case True{}:
      printedOwnLabel()
    case False{}:
      match offset:
        case OffsetAuto{}:
          printedAutoLabel()
        case OffsetValue{negative, magnitude}:
          printedStatusText.signed(negative, magnitude)

def printedCurrentText.if(label: String, empty: Bool) -> String:
  match empty:
    case True{}:
      M.msg("pdf.printed.noLabel")
    case False{}:
      M.msg1("pdf.printed.current", "label", label)

def printedCurrentText(+label: String) -> String:
  printedCurrentText.if(label, String.is_empty(label))

def printedFoundText(text: String, page: Nat) -> String:
  M.msg2("pdf.printed.found", "text", text, "page", Nat.show(page))

def printedNotFoundText() -> String:
  M.msg("pdf.printed.notFound")

def printedInvalidText() -> String:
  M.msg("pdf.printed.invalid")

def printedBadOffsetText() -> String:
  M.msg("pdf.printed.badOffset")

def dropHintText(label: String) -> String:
  M.msg1("pdf.drop.hint", "label", label)

def dropOpeningText() -> String:
  M.msg("pdf.drop.opening")

def dropOpenedText(name: String, label: String) -> String:
  M.msg2("pdf.drop.opened", "name", name, "label", label)

def dropUnavailableText() -> String:
  M.msg("pdf.drop.unavailable")

def dropInvalidText() -> String:
  M.msg("pdf.drop.invalid")

# O estado completo do controle (modo do ajuste · rótulo da página atual) é
# `printedStatusText` e `printedCurrentText` juntos: o host os traduz e junta,
# porque um núcleo não concatena mensagens (#41).
def printedSavedAutoText() -> String:
  M.msg("pdf.printed.savedAuto")

def printedSavedOffsetText.signed(negative: Bool, magnitude: Nat) -> String:
  match negative:
    case True{}:
      M.msg1("pdf.printed.savedMinus", "n", Nat.show(magnitude))
    case False{}:
      M.msg1("pdf.printed.savedPlus", "n", Nat.show(magnitude))

def printedSavedOffsetText(offset: PrintedOffset) -> String:
  match offset:
    case OffsetAuto{}:
      printedSavedAutoText()
    case OffsetValue{negative, magnitude}:
      printedSavedOffsetText.signed(negative, magnitude)

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

# ---------- barra única do leitor (botões de ícone com andaime `data-icon`) ----------
# Uma linha de 40px por leitor: rótulo, material, voltar (escondido), página
# anterior / número / total / próxima, busca, favoritos+sumário e "Mais opções".
# O que não cabe na linha mora no menu `.pdf-more-pop` (zoom, ajustar, inverter,
# girar, capturar, abrir outro PDF, numeração impressa, recolher) — mesmos
# nomes de classe e mesmos handlers de antes, só mudaram de lugar.

def iconBtnAttrs(cls: String, iconName: String, aria: String) -> List<&2, V.ViewAttr>:
  [V.attrClass(String.append(cls, " icon-btn")), V.attrAria("label", aria), V.attrData("icon", iconName)]

# Item do menu "Mais opções": ícone + texto (o `applyIcons` do host põe o ícone
# antes do texto).
def itemAttrs(cls: String, iconName: String, aria: String) -> List<&2, V.ViewAttr>:
  [V.attrClass(String.append(cls, " more-item")), V.attrAria("label", aria), V.attrData("icon", iconName)]

def iconBtn(cls: String, iconName: String, aria: String, handler: String) -> V.ViewNode:
  V.viewEl("button", V.attrConcat(iconBtnAttrs(cls, iconName, aria), [V.attrOn("click", handler)]), Nil{})

def openBtn(label: String) -> V.ViewNode:
  V.viewEl("button", V.attrJoin([
    itemAttrs("open", "plus", openAria(label)),
    [V.attrTitle(openTitle()), V.attrOn("click", "OpenFile")]
  ]), [V.viewText(openTitle())])

def findToggleBtn(label: String, open: Bool) -> V.ViewNode:
  V.viewEl("button", V.attrJoin([
    iconBtnAttrs("find-toggle", "search", findAria(label)),
    [V.attrTitle(findTitle()), V.attrBool("aria-pressed", open), V.attrOn("click", "ToggleFind")]
  ]), Nil{})

def shotBtn(label: String) -> V.ViewNode:
  V.viewEl("button", V.attrJoin([
    itemAttrs("page-shot", "camera", shotTitle()),
    [V.attrTitle(shotTitle()), V.attrOn("click", "PageShot")]
  ]), [V.viewText(shotMenuLabel())])

def collapseIcon(minimized: Bool) -> String:
  match minimized:
    case True{}:
      "chevronUp"
    case False{}:
      "chevronDown"

def collapseBtn(+minimized: Bool) -> V.ViewNode:
  +title = P.collapseTitle(minimized)
  V.viewEl("button", V.attrJoin([
    itemAttrs("collapse", collapseIcon(minimized), title),
    [V.attrTitle(title), V.attrBool("aria-pressed", minimized), V.attrOn("click", "ToggleCollapse")]
  ]), [V.viewText(title)])

# ---------- voltar à página anterior (citação seguida) ----------

def navBackTitle() -> String:
  N.navBackTitle()

def navBackAria(label: String) -> String:
  N.navBackAria(label)

# O botão que abre o popover de favoritos/sumário: o corpo do popover é do host
# (`core/pdfnav.bend` desenha o esqueleto e as linhas).
def navBtn(label: String) -> V.ViewNode:
  V.viewEl("button", V.attrJoin([
    iconBtnAttrs("nav", "bookmark", N.navAria(label)),
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

# O último ícone da barra: abre/fecha o menu (o host alterna `hidden`). O menu é
# um grupo de botões (padrão disclosure: `aria-expanded`, sem `aria-haspopup`).
def moreBtn(label: String) -> V.ViewNode:
  V.viewEl("button", V.attrJoin([
    iconBtnAttrs("more", "more", moreAria(label)),
    [ V.attrTitle(moreTitle())
    , V.attrBool("aria-expanded", False{})
    , V.attrOn("click", "ToggleMore")
    ]
  ]), Nil{})

# Girar 90°: um botão que cicla 0→90→180→270→0 por leitor. `title`/`aria-label`
# dizem a orientação corrente (o host troca só este botão a cada giro, como o
# colapsar, para não perder o foco do teclado).
def rotateBtn(label: String, +rotation: Nat) -> V.ViewNode:
  V.viewEl("button", V.attrJoin([
    itemAttrs("rotate", "rotateCw", rotateAria(label, rotation)),
    [V.attrTitle(rotateTitle(rotation)), V.attrOn("click", "Rotate")]
  ]), [V.viewText(M.msg("pdf.view.rotate"))])

def pageInput(label: String) -> V.ViewNode:
  V.viewEl("input", [
    V.attrClass("page-number"),
    V.ViewAttr{"type", "number"},
    V.ViewAttr{"min", "1"},
    V.ViewAttr{"value", "1"},
    V.attrAria("label", pageAria(label)),
    V.attrOn("change", "GotoPage")
  ], Nil{})

def titleBar(shell: PdfShell) -> V.ViewNode:
  match shell:
    case PdfShell{+label, +options, +path, _, findOpen, _}:
      V.viewEl("div", [V.attrClass("pdf-title")], [
        V.viewEl("strong", Nil{}, [V.viewText(label)]),
        selectNode(label, options, path),
        backBtn(label),
        iconBtn("prev", "chevronLeft", prevAria(), "Prev"),
        pageInput(label),
        V.viewEl("span", [V.attrClass("page-total")], Nil{}),
        iconBtn("next", "chevronRight", nextAria(), "Next"),
        findToggleBtn(label, findOpen),
        navBtn(label),
        moreBtn(label)
      ])

# ---------- menu "Mais opções" (o host preenche page-total/zoom-label) ----------

def fitBtn() -> V.ViewNode:
  V.viewEl("button", V.attrJoin([
    itemAttrs("fit", "unfold", fitTitle()),
    [V.attrTitle(fitTitle()), V.attrOn("click", "Fit")]
  ]), [V.viewText(fitTitle())])

def invertBtn() -> V.ViewNode:
  V.viewEl("button", V.attrJoin([
    itemAttrs("invert", "contrast", invertAria()),
    [V.attrTitle(invertTitle()), V.attrOn("click", "ToggleInvert")]
  ]), [V.viewText(invertMenuLabel())])

# Zoom − 100% +: a linha fica no menu; os dois botões não fecham o menu (o host
# deixa aberto para ajustar de novo).
def zoomRow() -> V.ViewNode:
  V.viewEl("div", [V.attrClass("more-zoom")], [
    V.viewEl("span", [V.attrClass("more-zoom-title")], [V.viewText(zoomRowLabel())]),
    V.viewEl("span", [V.attrClass("more-zoom-ctl")], [
      iconBtn("out", "minus", outAria(), "ZoomOut"),
      V.viewEl("span", [V.attrClass("zoom-label")], Nil{}),
      iconBtn("in", "plus", inAria(), "ZoomIn")
    ])
  ])

def moreMenu(+label: String, +rotation: Nat, +minimized: Bool) -> V.ViewNode:
  V.viewEl("div", [
    V.attrClass("pdf-more-pop"),
    V.attr("role", "group"),
    V.attrAria("label", moreAria(label)),
    V.attr("hidden", "")
  ], [
    openBtn(label),
    shotBtn(label),
    zoomRow(),
    fitBtn(),
    invertBtn(),
    rotateBtn(label, rotation),
    collapseBtn(minimized)
  ])

# A faixa estreita do leitor recolhido: ícone em cima e o rótulo na vertical; o
# CSS só a mostra com `.minimized`. Clicar reabre (o mesmo handler do colapsar).
def restoreBtn(+label: String) -> V.ViewNode:
  V.viewEl("button", [
    V.attrClass("pdf-restore"),
    V.attrAria("label", restoreAria(label)),
    V.attrTitle(restoreAria(label)),
    V.attrOn("click", "ToggleCollapse")
  ], [
    V.viewEl("span", [V.attrClass("pdf-restore-icon"), V.attrData("icon", "chevronLeft")], Nil{}),
    V.viewEl("span", [V.attrClass("pdf-restore-label")], [V.viewText(label)])
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
    case PdfShell{+label, +options, +path, +minimized, findOpen, +rotation}:
      V.viewEl("section", [
        P.panelClass(minimized, False{}),
        V.attrAria("label", label),
        V.ViewAttr{"tabindex", "0"}
      ], [
        titleBar(PdfShell{label, options, path, minimized, findOpen, rotation}),
        stage(),
        findForm(label),
        moreMenu(label, rotation, minimized),
        restoreBtn(label)
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
    case PdfSheet{course}:
      Some{RS.sheet(course)}
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

# ---------- nós do controle de numeração impressa ----------
# O host insere a linha entre a barra do leitor (`.pdf-title`) e `.pdf-stage`
# (o `panelShell` continua com as regiões do contrato) e liga os handlers abaixo.

def printedInput(label: String) -> V.ViewNode:
  V.viewEl("input", [
    V.attrClass("printed-input"),
    V.attrType("text"),
    V.ViewAttr{"placeholder", printedInputPlaceholder()},
    V.ViewAttr{"autocomplete", "off"},
    V.attrAria("label", printedInputAria(label))
  ], Nil{})

def printedGoBtn() -> V.ViewNode:
  V.viewEl("button", [V.attrClass("printed-go"), V.attrType("submit")], Con{V.viewText(printedGoLabel()), Nil{}})

def printedStatusNode() -> V.ViewNode:
  V.viewEl("span", [V.attrClass("printed-status"), V.attrAria("live", "polite")], Con{V.viewText(printedAutoLabel()), Nil{}})

def printedOffsetInput(label: String) -> V.ViewNode:
  V.viewEl("input", [
    V.attrClass("printed-offset"),
    V.attrType("number"),
    V.ViewAttr{"step", "1"},
    V.ViewAttr{"min", "-1000000"},
    V.ViewAttr{"max", "1000000"},
    V.ViewAttr{"inputmode", "numeric"},
    V.attrAria("label", printedOffsetInputAria(label))
  ], Nil{})

def printedOffsetSaveBtn() -> V.ViewNode:
  V.viewEl("button", V.attrJoin([
    [V.attrClass("printed-offset-save"), V.attrType("button"), V.attrOn("click", "PrintedOffsetSave")]
  ]), Con{V.viewText(printedOffsetSaveLabel()), Nil{}})

def printedOffsetAutoBtn() -> V.ViewNode:
  V.viewEl("button", V.attrJoin([
    [V.attrClass("printed-offset-auto"), V.attrType("button"), V.attrOn("click", "PrintedOffsetAuto")]
  ]), Con{V.viewText(printedOffsetAutoLabel()), Nil{}})

def printedOffsetEditor(label: String) -> V.ViewNode:
  V.viewEl("span", [V.attrClass("printed-offset-editor"), V.attrTitle(printedOffsetTitle())], [
    V.viewEl("label", [V.attrClass("printed-offset-label")], [
      V.viewText(printedOffsetFieldLabel()),
      printedOffsetInput(label)
    ]),
    printedOffsetSaveBtn(),
    printedOffsetAutoBtn()
  ])

# Linha do controle: entra escondida e o host alterna com o `toggle`.
def printedRow(+label: String, open: Bool) -> V.ViewNode:
  V.viewEl("form", V.attrJoin([
    [V.attrClass("pdf-printed"), V.attrOn("submit", "GoPrinted"), V.attrAria("label", printedToggleAria(label))],
    V.attrWhen(Bool.not(open), V.attr("hidden", ""))
  ]), [
    printedInput(label),
    printedGoBtn(),
    printedStatusNode(),
    printedOffsetEditor(label)
  ])

def printedToggleBtn(label: String, open: Bool) -> V.ViewNode:
  V.viewEl("button", V.attrJoin([
    itemAttrs("printed-toggle", "scan", printedToggleAria(label)),
    [V.attrTitle(printedToggleTitle()), V.attrBool("aria-expanded", open), V.attrOn("click", "TogglePrinted")]
  ]), [V.viewText(printedMenuLabel())])

# Área alvo do PDF solto: o host mostra por cima do palco durante o arrasto.
def dropHint(label: String) -> V.ViewNode:
  V.viewEl("div", V.attrJoin([
    [V.attrClass("pdf-drop-hint"), V.attr("hidden", "")]
  ]), Con{V.viewText(dropHintText(label)), Nil{}})
