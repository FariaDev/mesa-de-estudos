import Base
import view.bend as V

# Conforto de leitura da Conversa. O núcleo decide controles, classes e ARIA;
# localStorage, CSS global, medidas e rolagem continuam no host Electron.

def optionNode(value: String, label: String, selected: Bool) -> V.ViewNode:
  V.viewEl(
    "option",
    V.attrConcat(
      [V.attr("value", value)],
      V.attrWhen(selected, V.attr("selected", ""))
    ),
    [V.viewText(label)]
  )

def densitySelect(+mode: String) -> V.ViewNode:
  V.viewEl(
    "select",
    [V.attrId("density-mode"), V.attrOn("change", "density")],
    [ optionNode("padrao", "Padrão", String.eq(mode, "padrao"))
    , optionNode("compacta", "Compacta", String.eq(mode, "compacta"))
    ]
  )

def densityControl(mode: String) -> V.ViewNode:
  V.viewEl("label", Nil{}, [V.viewText("Densidade"), densitySelect(mode)])

def readingSelect(+size: String) -> V.ViewNode:
  V.viewEl(
    "select",
    [V.attrId("reading-size"), V.attrOn("change", "reading")],
    [ optionNode("14", "Padrão · 14 px", String.eq(size, "14"))
    , optionNode("15", "Grande · 15 px", String.eq(size, "15"))
    , optionNode("16", "Maior · 16 px", String.eq(size, "16"))
    , optionNode("17", "Extra · 17 px", String.eq(size, "17"))
    ]
  )

def readingControl(size: String) -> V.ViewNode:
  V.viewEl("label", Nil{}, [V.viewText("Tamanho do texto"), readingSelect(size)])

# Histerese com comparações já medidas pelo host: ligado permanece até cruzar
# o limiar de desligar; desligado só liga ao cruzar o limiar de ligar.
def hysteresis(wasOn: Bool, pastOn: Bool, pastOff: Bool) -> Bool:
  match wasOn:
    case True{}:
      pastOff
    case False{}:
      pastOn

def messageClasses(top: Bool, bottom: Bool) -> String:
  V.classValue([
    V.classOn("fade-top", top),
    V.classOn("fade-bottom", bottom)
  ])

def jumpLatestView(visible: Bool) -> V.ViewNode:
  V.viewEl(
    "button",
    V.attrConcat(
      [ V.attrType("button")
      , V.attrClass("jump-latest")
      , V.attrTitle("Rolar até o fim")
      , V.attrAria("label", "Rolar até o fim da conversa")
      , V.attrOn("mousedown", "hold")
      , V.attrOn("click", "jump")
      ],
      V.attrWhen(Bool.not(visible), V.attr("hidden", ""))
    ),
    [V.viewEl("span", [V.attrClass("icon-slot")], [V.viewText("chevronDown")])]
  )
