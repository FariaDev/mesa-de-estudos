import Base
import view.bend as V

# ---------------------------------------------------------------------------
# Controles auxiliares da Mesa (seção "Aparência e avisos" da Configurações):
# densidade, balão de dica e preferências dos avisos de conclusão.
#
# O host entrega fatos já resolvidos (String/Bool) e este núcleo devolve as
# árvores que o `desk/src/view-host.mjs` aplica:
#   - densidade: as opções do `#density-mode` com `selected` no modo corrente,
#     o controle inteiro (`label > "Densidade" + select`) para quando o markup
#     não existe e a decisão de `body.dense` (`densityDense`);
#   - dica: o balão `.tip[.below][hidden]` com o texto — medir/posicionar, o
#     `title` → `data-tip` e os tempos continuam em `desk/src/tooltip.mjs`;
#   - avisos: o grupo `#notify-mode[role=group]` e as linhas
#     `label.set-check > input[type=checkbox][checked] + span` — WebAudio,
#     Notification, badge e localStorage continuam em `desk/src/notify.mjs`.
#
# Nada aqui lê DOM, mede elemento, guarda timer, toca som ou fala IPC.
# ---------------------------------------------------------------------------

# ---------- densidade ----------

# O valor cru do localStorage canonizado: só "compacta" aperta o espaçamento.
def densityValue.if(compact: Bool) -> String:
  match compact:
    case True{}:
      "compacta"
    case False{}:
      "padrao"

def densityValue(raw: String) -> String:
  densityValue.if(String.eq(raw, "compacta"))

def densityDense(mode: String) -> Bool:
  String.eq(mode, "compacta")

def densityOption(value: String, label: String, selected: Bool) -> V.ViewNode:
  V.viewEl("option", V.attrConcat([V.ViewAttr{"value", value}], V.attrWhen(selected, V.ViewAttr{"selected", ""})), [V.viewText(label)])

def densitySelect(+mode: String) -> V.ViewNode:
  V.viewEl("select", [V.attrId("density-mode"), V.attrOn("change", "SetDensity")], [
    densityOption("padrao", "Padrão", String.eq(mode, "padrao")),
    densityOption("compacta", "Compacta", String.eq(mode, "compacta"))
  ])

# O conteúdo do label existente (texto + select) e o controle inteiro para o
# caminho sem markup.
def densityFields(+mode: String) -> List<&2, V.ViewNode>:
  [V.viewText("Densidade"), densitySelect(mode)]

def densityControl(mode: String) -> V.ViewNode:
  V.viewEl("label", Nil{}, densityFields(mode))

# ---------- balão de dica ----------

def tooltipClasses(+below: Bool) -> List<&2, V.ViewClass>:
  [V.classOn("tip", True{}), V.classOn("below", below)]

def tooltipView(open: Bool, text: String, below: Bool) -> V.ViewNode:
  V.viewEl("div", V.attrConcat(
    [V.classes(tooltipClasses(below))],
    V.attrWhen(Bool.not(open), V.attr("hidden", ""))
  ), [V.viewText(text)])

# ---------- avisos de conclusão ----------

# As três preferências como o host lê do localStorage.
type NotifyPrefs is Data:
  NotifyPrefs{sound: Bool, desktop: Bool, focused: Bool}

def checkRow(id: String, label: String, checked: Bool) -> V.ViewNode:
  V.viewEl("label", [V.attrClass("set-check")], [
    V.viewEl("input", V.attrConcat(
      [V.attrType("checkbox"), V.attrId(id), V.attrOn("change", "SetNotify")],
      V.attrWhen(checked, V.attr("checked", ""))
    ), Nil{}),
    V.viewEl("span", Nil{}, [V.viewText(label)])
  ])

def notifyLegend() -> V.ViewNode:
  V.viewEl("span", [V.attrClass("set-group-label")], [V.viewText("Avisos de conclusão")])

def notifyRows(prefs: NotifyPrefs) -> List<&2, V.ViewNode>:
  match prefs:
    case NotifyPrefs{sound, desktop, focused}:
      [
        checkRow("notify-sound", "Som", sound),
        checkRow("notify-desktop", "Notificação", desktop),
        checkRow("notify-focused", "Avisar mesmo com a janela em foco", focused)
      ]

def notifyControls(prefs: NotifyPrefs) -> List<&2, V.ViewNode>:
  List.append(&2, V.ViewNode, [notifyLegend()], notifyRows(prefs))

def notifyGroup(prefs: NotifyPrefs) -> V.ViewNode:
  V.viewEl("div", [
    V.attrId("notify-mode"), V.attrClass("set-group"),
    V.attr("role", "group"), V.attrAria("label", "Avisos de conclusão")
  ], notifyControls(prefs))
