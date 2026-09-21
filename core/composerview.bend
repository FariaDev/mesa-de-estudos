import Base
import view.bend as V

# ---------------------------------------------------------------------------
# View da fila e das faixas do composer (app Conversa).
#
# O host entrega fatos já resolvidos — `many` (n > 1), `count` em texto,
# `sending`/`enabled`/`editing` por item, `closing` da faixa, `visible` do
# banner de edição — e este núcleo devolve a árvore: `.queue-strip` com
# `.queue-label` + `.queue-item(.sending)` (ou `input.queue-edit`) e o
# `#edit-banner`. Nada aqui mede, foca, anima nem fala com o DOM; quem cria
# os elementos é o aplicador (`chat/src/view-host.mjs`). A saída animada
# (`.closing` + `transitionend` + timeout) é máquina do host.
#
# Convenções (as mesmas de `core/view.bend` e do DOM atual):
#   - faixa: `class=queue-strip[ closing]`, `aria-live=polite`,
#     `data-closing=1` só com o fato `closing`;
#   - rótulo: "Na fila" ou "Na fila · N";
#   - item: `data-id`, `.sending` + `aria-busy=true` com o fato `sending`;
#     `enabled` liga role=button / tabindex / edição e o ×;
#   - `editing` troca o span por `input.queue-edit`.
# ---------------------------------------------------------------------------

# Fatos de um item da fila. `enabled` é o inverso de `sending` (o host compara
# o id com o que está saindo); `editing` é o item cujo texto está no input.
type QueueRow is Data:
  QueueRow{id: String, text: String, sending: Bool, enabled: Bool, editing: Bool}

# ---------- rótulos ----------

def queueLabel(many: Bool, count: String) -> String:
  match many:
    case False{}:
      "Na fila"
    case True{}:
      String.append("Na fila · ", count)

def queueEditHint() -> String:
  " — clique para editar"

def queueItemTitle(text: String, sending: Bool) -> String:
  match sending:
    case True{}:
      text
    case False{}:
      String.append(text, queueEditHint())

def editBannerText() -> String:
  "Editando a última pergunta — envia como mensagem nova. O histórico anterior permanece."

# ---------- classes / data-* / aria (fatos Bool) ----------

def queueStripClass(closing: Bool) -> V.ViewAttr:
  V.classes([V.classOn("queue-strip", True{}), V.classOn("closing", closing)])

def queueItemClass(sending: Bool) -> V.ViewAttr:
  V.classes([V.classOn("queue-item", True{}), V.classOn("sending", sending)])

def queueClosingData(closing: Bool) -> List<&2, V.ViewAttr>:
  V.attrWhen(closing, V.attrData("closing", "1"))

def queueBusyAttr(sending: Bool) -> List<&2, V.ViewAttr>:
  V.attrWhen(sending, V.attrAria("busy", "true"))

def queueDisabledAttr(enabled: Bool) -> List<&2, V.ViewAttr>:
  match enabled:
    case True{}:
      Nil{}
    case False{}:
      [V.attr("disabled", "")]

def editBannerHidden(visible: Bool) -> List<&2, V.ViewAttr>:
  match visible:
    case True{}:
      Nil{}
    case False{}:
      [V.attr("hidden", "")]

def editBannerClass(closing: Bool) -> V.ViewAttr:
  V.classes([V.classOn("closing", closing)])

# ---------- nós: rótulo, texto, ×, input de edição ----------

def queueLabelView(text: String) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("queue-label")], [V.viewText(text)])

def queueTextEnabled(title: String) -> List<&2, V.ViewAttr>:
  [
    V.attrTitle(title),
    V.attr("tabindex", "0"),
    V.attr("role", "button"),
    V.attrAria("label", "Editar item da fila"),
    V.attrOn("click", "edit"),
    V.attrOn("keydown", "editKey")
  ]

def queueTextIdle(title: String) -> List<&2, V.ViewAttr>:
  [V.attrTitle(title)]

def queueTextAttrs(enabled: Bool, title: String) -> List<&2, V.ViewAttr>:
  match enabled:
    case True{}:
      queueTextEnabled(title)
    case False{}:
      queueTextIdle(title)

def queueTextSpan(+text: String, sending: Bool, enabled: Bool) -> V.ViewNode:
  V.viewEl("span", queueTextAttrs(enabled, queueItemTitle(text, sending)), [V.viewText(text)])

def queueRemoveAttrs(enabled: Bool) -> List<&2, V.ViewAttr>:
  V.attrConcat(
    [
      V.attrType("button"),
      V.attrTitle("Remover da fila"),
      V.attrAria("label", "Remover da fila"),
      V.attrOn("click", "remove")
    ],
    queueDisabledAttr(enabled)
  )

def queueRemoveBtn(enabled: Bool) -> V.ViewNode:
  V.viewEl("button", queueRemoveAttrs(enabled), [V.viewText("×")])

def queueEditInput(text: String) -> V.ViewNode:
  V.viewEl(
    "input",
    [
      V.attrType("text"),
      V.attrClass("queue-edit"),
      V.attr("value", text),
      V.attrAria("label", "Editar item da fila"),
      V.attrKey("queue-edit"),
      V.attrOn("keydown", "editInput"),
      V.attrOn("blur", "editBlur")
    ],
    Nil{}
  )

# ---------- item ----------

def queueItemAttrs(id: String, +sending: Bool) -> List<&2, V.ViewAttr>:
  V.attrConcat(
    [queueItemClass(sending), V.attrData("id", id)],
    queueBusyAttr(sending)
  )

def queueItemKids(text: String, sending: Bool, +enabled: Bool, editing: Bool) -> List<&2, V.ViewNode>:
  match editing:
    case True{}:
      [queueEditInput(text), queueRemoveBtn(enabled)]
    case False{}:
      [queueTextSpan(text, sending, enabled), queueRemoveBtn(enabled)]

def queueItem.body(id: String, text: String, +sending: Bool, enabled: Bool, editing: Bool) -> V.ViewNode:
  V.viewEl("div", queueItemAttrs(id, sending), queueItemKids(text, sending, enabled, editing))

def queueItemView(row: QueueRow) -> V.ViewNode:
  match row:
    case QueueRow{id, text, sending, enabled, editing}:
      queueItem.body(id, text, sending, enabled, editing)

def queueItemViews(items: List<&2, QueueRow>) -> List<&2, V.ViewNode>:
  V.viewMap(~QueueRow, ~queueItemView, items)

# ---------- faixa ----------

def queueStripAttrs(+closing: Bool) -> List<&2, V.ViewAttr>:
  V.attrConcat(
    [queueStripClass(closing), V.attrAria("live", "polite")],
    queueClosingData(closing)
  )

def queueStripView(closing: Bool, label: String, items: List<&2, QueueRow>) -> V.ViewNode:
  V.viewEl(
    "div",
    queueStripAttrs(closing),
    V.viewConcat([queueLabelView(label)], queueItemViews(items))
  )

# ---------- banner de edição (a entrada é CSS; a saída `.closing` é do host) ----------

def editBannerAttrs(visible: Bool, closing: Bool) -> List<&2, V.ViewAttr>:
  V.attrConcat(
    [V.attrId("edit-banner"), editBannerClass(closing)],
    editBannerHidden(visible)
  )

def editBannerView(visible: Bool, closing: Bool) -> V.ViewNode:
  V.viewEl(
    "div",
    editBannerAttrs(visible, closing),
    [
      V.viewEl("span", Nil{}, [V.viewText(editBannerText())]),
      V.viewEl(
        "button",
        [V.attrType("button"), V.attrId("edit-cancel"), V.attrOn("click", "editCancel")],
        [V.viewText("Cancelar")]
      )
    ]
  )
