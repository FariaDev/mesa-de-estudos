import Base
import view.bend as V

# ---------------------------------------------------------------------------
# Medidor de contexto da Conversa (`#context-gauge` + `#ctx-pop`) — R6/R11.
#
# O núcleo decide a árvore inteira: o botão (ARIA, dica e classes de aviso) e o
# balão (cabeçalho, porcentual, linhas de estatística, barra e total). O host
# entrega fatos já resolvidos — aberto/fechado, percentual inteiro (Nat, para os
# cortes de aviso) e textos prontos (locale e compactação de número são
# fronteira de host, como no `contextFoot` do rodapé) — e aplica com
# `view-host.mjs`.
#
# O anel SVG não mora no núcleo: o botão traz um slot `.icon-slot` marcado
# `ctx-donut` e o host troca o slot por `htmlNode(<svg class="ctx-donut">…)`
# com o `stroke-dashoffset` calculado da fração exata (fronteira de host). O
# "x" do fechar segue o mesmo caminho (slot `x` → SVG do host).
#
# Aviso: o medidor só tem `over` (>90) — o gancho que o CSS da Conversa pinta
# (`.ctx-btn.over`, `.ctx-pop.over`). `warn`/`hot` são do medidor do
# `statusview`, outro componente; o app nunca teve essas classes aqui.
# ---------------------------------------------------------------------------

# ---------- fatos ----------

# Uso de contexto já resolvido: `pct` é o percentual inteiro (0..100) que
# decide os cortes; os textos vêm formatados do host e vazio = ausente (a linha
# correspondente some). `fillText` é a largura da barra (ex.: "12.3%").
type GaugeFacts is Data:
  GaugeFacts{
    open: Bool,
    pct: Nat,
    pctText: String,
    usedText: String,
    windowText: String,
    remainText: String,
    totalText: String,
    fillText: String
  }

# ---------- textos (PT-BR do DOM atual) ----------

def gaugeTitle() -> String:
  "Janela de contexto"

def gaugeCloseText() -> String:
  "Fechar"

def gaugeUsedLabel() -> String:
  "Usado"

def gaugeWindowLabel() -> String:
  "Janela"

def gaugeRemainLabel() -> String:
  "Restante"

def gaugeTotalLabel() -> String:
  "Total processado"

def contextLabel(pctText: String) -> String:
  String.append("Contexto: ", String.append(pctText, " usado"))

# ---------- classes de aviso ----------

# ---------- corte de aviso ----------

def gaugeOver(pct: Nat) -> Bool:
  Nat.is_gt(pct, 90n)

def gaugeClasses(pct: Nat) -> List<&2, V.ViewClass>:
  [V.classOn("over", gaugeOver(pct))]

def gaugeButtonClass(pct: Nat) -> V.ViewAttr:
  +cs = gaugeClasses(pct)
  V.classes(Con{V.classOn("ctx-btn", True{}), cs})

def gaugePopClass(pct: Nat) -> V.ViewAttr:
  +cs = gaugeClasses(pct)
  V.classes(Con{V.classOn("ctx-pop", True{}), cs})

# ---------- slots de SVG (o host preenche) ----------

def donutSlot() -> V.ViewNode:
  V.viewEl("span", [V.attrClass("icon-slot")], [V.viewText("ctx-donut")])

def closeSlot() -> V.ViewNode:
  V.viewEl("span", [V.attrClass("icon-slot")], [V.viewText("x")])

# ---------- botão do medidor ----------

def gaugeButton.given(open: Bool, +label: String, pct: Nat) -> V.ViewNode:
  V.viewEl(
    "button",
    [
      V.attrType("button"),
      gaugeButtonClass(pct),
      V.attr("aria-haspopup", "dialog"),
      V.attrBool("aria-expanded", open),
      V.attrAria("controls", "ctx-pop"),
      V.attrAria("label", label),
      V.attrTitle(label),
      V.attrOn("click", "toggle"),
      V.attrOn("keydown", "key")
    ],
    [donutSlot()]
  )

def gaugeButton(f: GaugeFacts) -> V.ViewNode:
  match f:
    case GaugeFacts{open, pct, pctText, usedText, windowText, remainText, totalText, fillText}:
      gaugeButton.given(open, contextLabel(pctText), pct)

# ---------- peças do balão ----------

def closeButton() -> V.ViewNode:
  V.viewEl(
    "button",
    [
      V.attrType("button"),
      V.attrClass("ctx-close"),
      V.attrTitle(gaugeCloseText()),
      V.attrAria("label", gaugeCloseText()),
      V.attrOn("click", "close")
    ],
    [closeSlot()]
  )

def gaugeHead() -> V.ViewNode:
  V.viewEl(
    "div",
    [V.attrClass("ctx-head")],
    [
      V.viewEl("span", [V.attrClass("ctx-label")], [V.viewText(gaugeTitle())]),
      closeButton()
    ]
  )

def pctRow(pctText: String) -> V.ViewNode:
  V.viewEl(
    "div",
    [V.attrClass("ctx-row")],
    [V.viewEl("span", [V.attrClass("ctx-pct")], [V.viewText(pctText)])]
  )

# Linha de estatística: `hidden` some com o valor ausente (texto vazio), a
# mesma regra do `footPush`. Os estilos inline repetem o CSS de `.ctx-stat` e
# `.ctx-num` porque é assim que o DOM atual os traz; o CSS segue no comando.
def statRow(label: String, value: String, hidden: Bool) -> V.ViewNode:
  V.viewEl(
    "div",
    V.attrJoin([
      [
        V.attrClass("ctx-row ctx-stat"),
        V.ViewAttr{"style", "justify-content: space-between; margin-top: 4px"}
      ],
      V.attrWhen(hidden, V.ViewAttr{"hidden", ""})
    ]),
    [
      V.viewEl("span", [V.attrClass("ctx-label")], [V.viewText(label)]),
      V.viewEl(
        "span",
        [
          V.attrClass("ctx-num"),
          V.ViewAttr{"style", "font-variant-numeric: tabular-nums"}
        ],
        [V.viewText(value)]
      )
    ]
  )

def statRow.given(label: String, value: String) -> V.ViewNode:
  +v = value
  statRow(label, v, String.is_empty(v))

def gaugeBar(fillText: String) -> V.ViewNode:
  V.viewEl(
    "div",
    [V.attrClass("ctx-bar")],
    [
      V.viewEl(
        "span",
        [V.attrClass("ctx-fill"), V.ViewAttr{"style", String.append("width:", fillText)}],
        Nil{}
      )
    ]
  )

def totalRow(value: String, hidden: Bool) -> V.ViewNode:
  V.viewEl(
    "div",
    V.attrJoin([
      [V.attrClass("ctx-row ctx-total")],
      V.attrWhen(hidden, V.ViewAttr{"hidden", ""})
    ]),
    [
      V.viewEl("span", [V.attrClass("ctx-label")], [V.viewText(gaugeTotalLabel())]),
      V.viewEl("span", [V.attrClass("ctx-total-num")], [V.viewText(value)])
    ]
  )

def totalRow.given(value: String) -> V.ViewNode:
  +v = value
  totalRow(v, String.is_empty(v))

# ---------- balão ----------

def gaugePopAttrs(open: Bool, pct: Nat) -> List<&2, V.ViewAttr>:
  V.attrJoin([
    [
      V.attrId("ctx-pop"),
      gaugePopClass(pct),
      V.ViewAttr{"role", "dialog"},
      V.attrAria("label", gaugeTitle())
    ],
    V.attrWhen(Bool.not(open), V.ViewAttr{"hidden", ""})
  ])

def gaugePop.given(open: Bool, pct: Nat, pctText: String, usedText: String, windowText: String, remainText: String, totalText: String, fillText: String) -> V.ViewNode:
  V.viewEl(
    "div",
    gaugePopAttrs(open, pct),
    [
      gaugeHead(),
      pctRow(pctText),
      statRow.given(gaugeUsedLabel(), usedText),
      statRow.given(gaugeWindowLabel(), windowText),
      statRow.given(gaugeRemainLabel(), remainText),
      gaugeBar(fillText),
      totalRow.given(totalText)
    ]
  )

def gaugePop(f: GaugeFacts) -> V.ViewNode:
  match f:
    case GaugeFacts{open, pct, pctText, usedText, windowText, remainText, totalText, fillText}:
      gaugePop.given(open, pct, pctText, usedText, windowText, remainText, totalText, fillText)

# ---------- amostras das leis ----------

def sampleFacts(open: Bool, pct: Nat) -> GaugeFacts:
  GaugeFacts{open, pct, "0,6%", "1,2 mil", "200 mil", "198,8 mil", "", "0.6%"}

def emptyFacts(open: Bool, pct: Nat) -> GaugeFacts:
  GaugeFacts{open, pct, "0,6%", "", "", "", "", "0.6%"}
