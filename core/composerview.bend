import Base
import msg.bend as M
import view.bend as V

# ---------------------------------------------------------------------------
# View da fila e das faixas do composer (app Conversa e Mesa de Estudos —
# o mesmo núcleo gera o artefato dos dois: o adaptador de cada app resolve os
# fatos e o DOM).
#
# O host entrega fatos já resolvidos — `many` (n > 1), `count` em texto,
# `sending`/`enabled`/`editing` por item, `closing` da faixa, `visible` do
# banner de edição, `recovered` da fila, `canSendNow`/`canClear` das ações — e
# este núcleo devolve a árvore: `.queue-strip` com `.queue-label` +
# `.queue-item(.sending)` (ou `input.queue-edit`), as ações `.queue-send-now` e
# `.queue-clear` (cada uma `hidden` quando o fato é falso) e o `#edit-banner`.
# Nada aqui mede, foca, anima nem fala com o DOM; quem cria
# os elementos é o aplicador (`desk/src/view-host.mjs`).
# A saída animada (`.closing` + `transitionend` + timeout) é máquina do host.
#
# Convenções (as mesmas de `core/view.bend` e do DOM atual):
#   - faixa: `class=queue-strip[ closing]`, `aria-live=polite`,
#     `data-closing=1` só com o fato `closing`;
#   - rótulo: "Na fila" / "Na fila · N" ou "Recuperadas" / "Recuperadas · N";
#   - item: `data-id`, `.sending` + `aria-busy=true` com o fato `sending`;
#     `enabled` liga role=button / tabindex / edição e o ×;
#   - `editing` troca o span por `input.queue-edit`;
#   - ações: `Enviar agora` (`sendNow`) e `Limpar` (`clear`), `hidden` quando o
#     fato correspondente é falso.
# ---------------------------------------------------------------------------

# Fatos de um item da fila. `enabled` é o inverso de `sending` (o host compara
# o id com o que está saindo); `editing` é o item cujo texto está no input.
type QueueRow is Data:
  QueueRow{id: String, text: String, sending: Bool, enabled: Bool, editing: Bool}

# ---------- rótulos ----------

def queueQueuedLabel(many: Bool, count: String) -> String:
  match many:
    case False{}:
      M.msg("queue.queued")
    case True{}:
      M.msg1("queue.queuedCount", "count", count)

def queueRecoveredLabel(many: Bool, count: String) -> String:
  match many:
    case False{}:
      M.msg("queue.recovered")
    case True{}:
      M.msg1("queue.recoveredCount", "count", count)

# A faixa diz de onde a fila veio: recuperada do disco depois de fechar o app
# (nada sai sozinho) ou a fila viva desta sessão.
def queueLabel(recovered: Bool, many: Bool, count: String) -> String:
  match recovered:
    case False{}:
      queueQueuedLabel(many, count)
    case True{}:
      queueRecoveredLabel(many, count)

def queueSendNowLabel() -> String:
  M.msg("queue.sendNow")

def queueSendNowTitle() -> String:
  M.msg("queue.sendNowTitle")

def queueClearLabel() -> String:
  M.msg("queue.clear")

def queueClearTitle() -> String:
  M.msg("queue.clearTitle")

def queueItemTitle(text: String, sending: Bool) -> String:
  match sending:
    case True{}:
      text
    case False{}:
      M.msg1("queue.editTitle", "text", text)

def editBannerText() -> String:
  M.msg("queue.editBanner")

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
    V.attrAria("label", M.msg("queue.editItem")),
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
      V.attrTitle(M.msg("queue.remove")),
      V.attrAria("label", M.msg("queue.remove")),
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
      V.attrAria("label", M.msg("queue.editItem")),
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

# ---------- ações da faixa (Enviar agora / Limpar) ----------

# `hidden` quando o fato é falso: a ação que não cabe no estado não aparece —
# quem decide é o núcleo, como no banner de edição. "Enviar agora" existe para
# a fila segurada (recuperada do disco ou parada no meio do turno); "Limpar" é a
# única ação que descarta, separada do Parar.
def queueActionHidden(visible: Bool) -> List<&2, V.ViewAttr>:
  match visible:
    case True{}:
      Nil{}
    case False{}:
      [V.attr("hidden", "")]

def queueSendNowAttrs(canSendNow: Bool) -> List<&2, V.ViewAttr>:
  V.attrConcat(
    [
      V.attrType("button"),
      V.attrClass("queue-send-now"),
      V.attrTitle(queueSendNowTitle()),
      V.attrOn("click", "sendNow")
    ],
    queueActionHidden(canSendNow)
  )

def queueSendNowBtn(canSendNow: Bool) -> V.ViewNode:
  V.viewEl("button", queueSendNowAttrs(canSendNow), [V.viewText(queueSendNowLabel())])

def queueClearAttrs(canClear: Bool) -> List<&2, V.ViewAttr>:
  V.attrConcat(
    [
      V.attrType("button"),
      V.attrClass("queue-clear"),
      V.attrTitle(queueClearTitle()),
      V.attrOn("click", "clear")
    ],
    queueActionHidden(canClear)
  )

def queueClearBtn(canClear: Bool) -> V.ViewNode:
  V.viewEl("button", queueClearAttrs(canClear), [V.viewText(queueClearLabel())])

def queueActionViews(canSendNow: Bool, canClear: Bool) -> List<&2, V.ViewNode>:
  V.viewConcat([queueSendNowBtn(canSendNow)], [queueClearBtn(canClear)])

# As ações ficam numa linha própria no fim da faixa (a coluna da faixa empilharia
# os botões um por linha).
def queueActionsView(canSendNow: Bool, canClear: Bool) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("queue-actions")], queueActionViews(canSendNow, canClear))

def queueStripKids(label: String, items: List<&2, QueueRow>, canSendNow: Bool, canClear: Bool) -> List<&2, V.ViewNode>:
  V.viewConcat([queueLabelView(label)], V.viewConcat(queueItemViews(items), [queueActionsView(canSendNow, canClear)]))

def queueStripView(closing: Bool, label: String, items: List<&2, QueueRow>, canSendNow: Bool, canClear: Bool) -> V.ViewNode:
  V.viewEl(
    "div",
    queueStripAttrs(closing),
    queueStripKids(label, items, canSendNow, canClear)
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
        [V.viewText(M.msg("common.cancel"))]
      )
    ]
  )
