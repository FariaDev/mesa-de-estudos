import Base
import view.bend as V

# Views puras dos tooltips, toasts e preferências de aviso da Conversa.
# Posição, relógios, animação, WebAudio, Notification e badge ficam no host.

type NotifyItem is Data:
  NotifyItem{key: String, text: String, tone: String, closing: Bool}

def tooltipClasses(+below: Bool) -> List<&2, V.ViewClass>:
  [V.classOn("tip", True{}), V.classOn("below", below)]

def tooltipView(open: Bool, text: String, below: Bool) -> V.ViewNode:
  V.viewEl(
    "div",
    V.attrConcat(
      [V.classes(tooltipClasses(below))],
      V.attrWhen(Bool.not(open), V.attr("hidden", ""))
    ),
    [V.viewText(text)]
  )

def notifyClasses(+tone: String, +closing: Bool) -> List<&2, V.ViewClass>:
  [
    V.classOn("toast-item", True{}),
    V.classOn(tone, Bool.not(String.is_empty(tone))),
    V.classOn("out", closing)
  ]

def notifyItemView(item: NotifyItem) -> V.ViewNode:
  match item:
    case NotifyItem{key, text, tone, closing}:
      V.viewKey(
        "div",
        key,
        [V.classes(notifyClasses(tone, closing)), V.attr("role", "status"), V.attrOn("click", "dismiss")],
        [V.viewText(text)]
      )

def notifyItems(items: List<&2, NotifyItem>) -> List<&2, V.ViewNode>:
  V.viewMap(~NotifyItem, ~notifyItemView, items)

def notifyBox(items: List<&2, NotifyItem>) -> V.ViewNode:
  V.viewEl("div", [V.attrId("toast"), V.attrAria("live", "polite")], notifyItems(items))

def checkRow(id: String, label: String) -> V.ViewNode:
  V.viewEl(
    "label",
    [V.attrClass("set-check")],
    [
      V.viewEl("input", [V.attrType("checkbox"), V.attrId(id), V.attrOn("change", "setting")], Nil{}),
      V.viewEl("span", Nil{}, [V.viewText(label)])
    ]
  )

def settingsGroup() -> V.ViewNode:
  V.viewEl(
    "div",
    [V.attrId("notify-mode"), V.attrClass("set-group"), V.attr("role", "group"), V.attrAria("label", "Avisos de conclusão")],
    [
      V.viewEl("span", [V.attrClass("set-group-label")], [V.viewText("Avisos de conclusão")]),
      checkRow("notify-sound", "Som"),
      checkRow("notify-desktop", "Notificação"),
      checkRow("notify-focused", "Avisar mesmo com a janela em foco")
    ]
  )
