import Base
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
# os elementos é o aplicador (`chat/src/view-host.mjs`, `desk/src/view-host.mjs`).
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
      "Na fila"
    case True{}:
      String.append("Na fila · ", count)

def queueRecoveredLabel(many: Bool, count: String) -> String:
  match many:
    case False{}:
      "Recuperadas"
    case True{}:
      String.append("Recuperadas · ", count)

# A faixa diz de onde a fila veio: recuperada do disco depois de fechar o app
# (nada sai sozinho) ou a fila viva desta sessão.
def queueLabel(recovered: Bool, many: Bool, count: String) -> String:
  match recovered:
    case False{}:
      queueQueuedLabel(many, count)
    case True{}:
      queueRecoveredLabel(many, count)

def queueSendNowLabel() -> String:
  "Enviar agora"

def queueSendNowTitle() -> String:
  "Enviar a fila agora, sem esperar o fim do turno"

def queueClearLabel() -> String:
  "Limpar"

def queueClearTitle() -> String:
  "Limpar a fila (as mensagens pendentes são descartadas)"

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
        [V.viewText("Cancelar")]
      )
    ]
  )

# ---------------------------------------------------------------------------
# Painel de ajustes do chat (Mesa): Modelo, Esforço e compactação automática
# atrás de um toggle, para a coluna do chat sobrar para o estudo. O host monta
# este andaime no boot e MOVE para dentro do corpo os nós que já existem
# (`.pi-settings` e `#auto-compact`) — aqui ficam o rótulo, o `aria-expanded`,
# o `aria-controls` e o `hidden` do corpo; o host guarda o estado aberto
# (localStorage `mesa.piPanel`) e mantém os dois atributos sincronizados.
# ---------------------------------------------------------------------------

def settingsPanelLabel() -> String:
  "Ajustes"

def settingsPanelTitle() -> String:
  "Modelo, esforço e compactação automática"

def settingsPanelBodyId() -> String:
  "pi-settings-body"

def settingsToggleClass(open: Bool) -> V.ViewAttr:
  V.classes([V.classOn("settings-toggle", True{}), V.classOn("open", open)])

def settingsPanelHidden(open: Bool) -> List<&2, V.ViewAttr>:
  match open:
    case True{}:
      Nil{}
    case False{}:
      [V.attr("hidden", "")]

def settingsToggleAttrs(+open: Bool) -> List<&2, V.ViewAttr>:
  V.attrJoin([
    [V.attrType("button"), V.attrId("settings-toggle")],
    [
      settingsToggleClass(open),
      V.attrAria("expanded", V.boolStr(open)),
      V.attrAria("controls", settingsPanelBodyId())
    ],
    [V.attrOn("click", "ToggleSettings"), V.attrTitle(settingsPanelTitle()), V.attrData("icon", "unfold")]
  ])

def settingsToggleBtn(open: Bool) -> V.ViewNode:
  V.viewEl("button", settingsToggleAttrs(open), [V.viewText(settingsPanelLabel())])

def settingsPanelBody(open: Bool) -> V.ViewNode:
  V.viewEl(
    "div",
    V.attrJoin([
      [V.attrId(settingsPanelBodyId()), V.attrClass("settings-body")],
      settingsPanelHidden(open)
    ]),
    Nil{}
  )

def settingsPanel(+open: Bool) -> V.ViewNode:
  V.viewEl(
    "div",
    [V.attrId("pi-settings-panel"), V.attrClass("settings-panel")],
    [settingsToggleBtn(open), settingsPanelBody(open)]
  )
