import Base
import msg.bend as M
import view.bend as V

# ---------------------------------------------------------------------------
# View da calculadora da Mesa (ticket #16 da spec de redesenho): recolhida, é
# UMA linha no pé da coluna do tutor — ícone, campo de expressão, "=", resultado
# e a unidade vigente — e calcula ali mesmo; o controle `#calc-toggle` expande
# o painel com o ângulo, o histórico e o guia, e recolhe de volta à linha. O
# núcleo não avalia, não mede e não toca no DOM — o host (`desk/src/calc.mjs`)
# guarda os fatos e aplica a árvore no casco fixo do `index.html`.
#
# Fatos (todos já resolvidos pelo host):
#   - `visible`: a flag `calculator` do `desk` (a seção inteira some);
#   - `collapsed`: o colapso (classe `.collapsed` + `#calc-body[hidden]` +
#     `aria-expanded`/rótulo do controle). É estado de interface: o host o
#     guarda com o layout da view (fora do `config.json`);
#   - `angle`: "rad"/"deg" — vira o `selected` da opção, com `SetAngle` no
#     `change`, e o texto da unidade na linha (não é um controle: quem muda é
#     o seletor do painel expandido);
#   - `expression`/`result`: textos do host (a avaliação é o `calculate` do
#     JS, precisão dupla; nada de parser aqui);
#   - `history`: pares expr/resultado já avaliados, do mais novo para o mais
#     antigo; o rótulo `expr = result` é montado aqui e o `data-expr` guarda a
#     expressão para o clique `Reuse` reutilizar e focar;
#   - `guideOpen`: o `<details>` estava aberto (o host lê o DOM antes de
#     re-renderizar, como faz com o texto digitado).
#
# O guia (`calcGuide`) é o texto do `index.html`: os nomes que ele anuncia
# vêm de `opNames`/`fnNames`/`trigNames`/`constNames`, e quem aceita cada um é
# o `desk/calculator.mjs` (um teste em `desk/tests/calcview.test.mjs` garante
# que todo nome anunciado existe no avaliador).
#
# Convenções de attr: as mesmas do `core/view.bend` (o host pula `class`/`id`
# vazios e liga `on:<evento>` na tabela de handlers). Os ícones (calculadora e
# o chevron do controle) são asset do host (`icons.mjs`), como nas abas: a view
# só reserva o lugar.
# ---------------------------------------------------------------------------

# Item do histórico: expressão digitada e resultado avaliado pelo host.
type CalcEntry is Data:
  CalcEntry{expr: String, result: String}

# ---------- textos ----------

def calcTitle() -> String:
  M.msg("calc.title")

def angleAria() -> String:
  M.msg("calc.angleAria")

def angleLabelText() -> String:
  M.msg("calc.angleLabel")

def expandLabel() -> String:
  M.msg("calc.expand")

def collapseLabel() -> String:
  M.msg("calc.collapse")

def expressionPlaceholder() -> String:
  "sqrt(16) + sin(pi/2)"

def expressionAria() -> String:
  M.msg("calc.expressionAria")

def equalsAria() -> String:
  M.msg("calc.equalsAria")

def equalsText() -> String:
  "="

def historyTitleText() -> String:
  M.msg("calc.historyTitle")

def clearText() -> String:
  M.msg("calc.clear")

def historyEmptyText() -> String:
  M.msg("calc.historyEmpty")

def guideSummaryText() -> String:
  M.msg("calc.guideSummary")

def guideLeadText() -> String:
  M.msg("calc.guideLead")

# ---------- guia ----------
# O guia é uma cola: uma frase do que a calculadora é, os nomes que ela aceita
# em quatro grupos (o que digitar, em `code`) e as poucas armadilhas. Quem
# aceita cada nome é o `desk/calculator.mjs` (o teste confere grupo a grupo).

def codeNode(txt: String) -> V.ViewNode:
  V.viewEl("code", Nil{}, [V.viewText(txt)])

def chips(names: List<&2, String>) -> List<&2, V.ViewNode>:
  V.viewMap(~String, ~codeNode, names)

def opNames() -> List<&2, String>:
  ["+", "-", "*", "/", "^", "( )"]

def fnNames() -> List<&2, String>:
  ["sqrt", "abs", "exp", "ln", "log"]

def trigNames() -> List<&2, String>:
  ["sin", "cos", "tan", "sec", "csc", "cot", "asin", "acos", "atan"]

def constNames() -> List<&2, String>:
  ["pi", "e"]

# Um grupo é um par `dt`/`dd` da lista de nomes.
def guideGroup(title: String, names: List<&2, String>) -> List<&2, V.ViewNode>:
  [
    V.viewEl("dt", Nil{}, [V.viewText(title)]),
    V.viewEl("dd", Nil{}, chips(names))
  ]

def guideGroups() -> V.ViewNode:
  V.viewEl("dl", [V.attrClass("calc-groups")], V.viewJoin([
    guideGroup(M.msg("calc.group.ops"), opNames()),
    guideGroup(M.msg("calc.group.fns"), fnNames()),
    guideGroup(M.msg("calc.group.trig"), trigNames()),
    guideGroup(M.msg("calc.group.consts"), constNames())
  ]))

def guideLead() -> V.ViewNode:
  V.viewEl("p", [V.attrClass("calc-guide-lead")], [V.viewText(guideLeadText())])

def guideTip1() -> V.ViewNode:
  V.viewEl("li", Nil{}, [
    V.viewText(M.msg("calc.tip1.a")),
    codeNode("2*pi"),
    V.viewText(M.msg("calc.tip1.b")),
    codeNode("2pi"),
    V.viewText(M.msg("calc.tip1.c")),
    codeNode("2,5"),
    V.viewText(".")
  ])

def guideTip2() -> V.ViewNode:
  V.viewEl("li", Nil{}, [
    codeNode("log"),
    V.viewText(M.msg("calc.tip2.a")),
    codeNode("ln"),
    V.viewText(M.msg("calc.tip2.b"))
  ])

def guideTip3() -> V.ViewNode:
  V.viewEl("li", Nil{}, [
    V.viewText(M.msg("calc.tip3.a")),
    codeNode("sin(pi/2)"),
    V.viewText(M.msg("calc.tip3.b")),
    codeNode("sin(90)"),
    V.viewText(M.msg("calc.tip3.c")),
    codeNode("asin(0.5)"),
    V.viewText(M.msg("calc.tip3.d"))
  ])

def guideTip4() -> V.ViewNode:
  V.viewEl("li", Nil{}, [
    V.viewText(M.msg("calc.tip4.a")),
    codeNode("cos(90)"),
    V.viewText(M.msg("calc.tip4.b")),
    codeNode("tan(90)"),
    V.viewText(M.msg("calc.tip4.c"))
  ])

def guideTip5() -> V.ViewNode:
  V.viewEl("li", Nil{}, [V.viewText(M.msg("calc.tip5"))])

def guideTips() -> V.ViewNode:
  V.viewEl("ul", [V.attrClass("calc-tips")], [guideTip1(), guideTip2(), guideTip3(), guideTip4(), guideTip5()])

def calcGuide(open: Bool) -> V.ViewNode:
  V.viewEl("details", V.attrJoin([
    [V.attrId("calc-guide")],
    V.attrWhen(open, V.ViewAttr{"open", ""})
  ]), [
    V.viewEl("summary", Nil{}, [V.viewText(guideSummaryText())]),
    guideLead(),
    guideGroups(),
    guideTips()
  ])

# ---------- unidade vigente (ângulo) ----------

def isDegrees(+angle: String) -> Bool:
  String.eq(angle, "deg")

def unitText(deg: Bool) -> String:
  match deg:
    case True{}:
      M.msg("calc.unit.deg")
    case False{}:
      "RAD"

def unitLabel(+angle: String) -> String:
  unitText(isDegrees(angle))

# Texto, não controle: a linha recolhida não troca o ângulo, mas nunca deixa
# uma conta em GRAUS passar por RAD sem aviso.
def calcUnit(+angle: String) -> V.ViewNode:
  V.viewEl("span", [V.attrClass("calc-unit")], [V.viewText(unitLabel(angle))])

# ---------- ângulo (grupo segmentado) ----------

# Dois botões num grupo: `aria-pressed` diz qual vale e `data-angle` leva o
# valor ao `SetAngle`; a `key` mantém o foco do teclado no re-render. Valor desconhecido não marca nenhum (o host normaliza).
def angleButton(+value: String, label: String, +angle: String) -> V.ViewNode:
  V.viewEl("button", [
    V.attrType("button"),
    V.attrKey("angle-" ++ value),
    V.attrData("angle", value),
    V.attrAria("pressed", V.boolStr(String.eq(value, angle))),
    V.attrOn("click", "SetAngle")
  ], [V.viewText(label)])

def angleGroup(+angle: String) -> V.ViewNode:
  V.viewEl("div", [
    V.attrId("angle"),
    V.ViewAttr{"role", "group"},
    V.attrClass("calc-seg"),
    V.attrAria("label", angleAria())
  ], [angleButton("rad", "RAD", angle), angleButton("deg", M.msg("calc.unit.deg"), angle)])

def hintText(deg: Bool) -> String:
  match deg:
    case True{}:
      M.msg("calc.hint.deg")
    case False{}:
      M.msg("calc.hint.rad")

# A dica mostra, na unidade vigente, a conta que serve de teste.
def angleHint(+angle: String) -> V.ViewNode:
  V.viewEl("span", [V.attrClass("calc-hint")], [V.viewText(hintText(isDegrees(angle)))])

# Linha do painel expandido: o rótulo visível, o grupo e a dica.
def angleRow(+angle: String) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("calc-angle")], [
    V.viewEl("span", [V.attrClass("calc-angle-label")], [V.viewText(angleLabelText())]),
    angleGroup(angle),
    angleHint(angle)
  ])

# ---------- ícone e controle de expandir ----------

def calcIcon() -> V.ViewNode:
  V.viewEl("span", [V.attrClass("calc-icon"), V.attrAria("hidden", "true")], Nil{})

def toggleLabel(collapsed: Bool) -> String:
  match collapsed:
    case True{}:
      expandLabel()
    case False{}:
      collapseLabel()

# O chevron entra pelo host; o nome acessível e a dica dizem o que o clique faz
# AGORA (expandir quando recolhida, recolher quando aberta).
def calcToggle(+collapsed: Bool) -> V.ViewNode:
  V.viewEl("button", [
    V.attrId("calc-toggle"),
    V.attrType("button"),
    V.attrClass("icon-btn"),
    V.attrAria("expanded", V.boolStr(Bool.not(collapsed))),
    V.attrAria("controls", "calc-body"),
    V.attrAria("label", toggleLabel(collapsed)),
    V.attrTitle(toggleLabel(collapsed)),
    V.attrOn("click", "ToggleCalc")
  ], Nil{})

# ---------- formulário / resultado ----------

# Valor vazio não vira atributo (o input novo já nasce vazio).
def expressionValue(+value: String) -> List<&2, V.ViewAttr>:
  V.attrWhen(Bool.not(String.is_empty(value)), V.ViewAttr{"value", value})

def calcForm(+expression: String) -> V.ViewNode:
  V.viewEl("form", [
    V.attrId("calc-form"),
    V.attrOn("submit", "Eval")
  ], [
    V.viewEl("input", V.attrJoin([
      [ V.attrId("expression")
      , V.ViewAttr{"autocomplete", "off"}
      , V.ViewAttr{"placeholder", expressionPlaceholder()}
      , V.attrAria("label", expressionAria())
      ],
      expressionValue(expression)
    ]), Nil{}),
    V.viewEl("button", [
      V.attrType("submit"),
      V.attrClass("icon-btn"),
      V.attrAria("label", equalsAria())
    ], [V.viewText(equalsText())])
  ])

def calcResult(value: String) -> V.ViewNode:
  V.viewEl("output", [V.attrId("result")], [V.viewText(value)])

# ---------- histórico ----------

def histLabel(expr: String, result: String) -> String:
  expr ++ " = " ++ result

def histEq(result: String) -> String:
  "= " ++ result

# Linha de 30px: a conta à esquerda (truncada, `title` leva a inteira) e o
# resultado à direita. O nome acessível segue sendo "conta = resultado".
def histButton(e: CalcEntry) -> V.ViewNode:
  match e:
    case CalcEntry{+expr, +result}:
      V.viewEl("button", [
        V.attrType("button"),
        V.attrData("expr", expr),
        V.attrTitle(expr),
        V.attrAria("label", histLabel(expr, result)),
        V.attrOn("click", "Reuse")
      ], [
        V.viewEl("span", [V.attrClass("calc-hist-expr")], [V.viewText(expr)]),
        V.viewEl("span", [V.attrClass("calc-hist-res")], [V.viewText(histEq(result))])
      ])

def histItems(hs: List<&2, CalcEntry>) -> List<&2, V.ViewNode>:
  V.viewMap(~CalcEntry, ~histButton, hs)

def calcHistory(hs: List<&2, CalcEntry>) -> V.ViewNode:
  V.viewEl("div", [V.attrId("calc-history")], histItems(hs))

def clearButton(empty: Bool) -> V.ViewNode:
  V.viewEl("button", V.attrJoin([
    [ V.attrId("calc-clear")
    , V.attrType("button")
    , V.attrOn("click", "ClearHistory")
    ],
    V.attrWhen(empty, V.ViewAttr{"disabled", ""})
  ]), [V.viewText(clearText())])

def historyHead(empty: Bool) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("calc-hist-head")], [
    V.viewEl("h3", Nil{}, [V.viewText(historyTitleText())]),
    clearButton(empty)
  ])

def historyEmpty() -> V.ViewNode:
  V.viewEl("p", [V.attrClass("calc-hist-empty")], [V.viewText(historyEmptyText())])

# Bloco do painel: título, "Limpar" (desligado sem nada a limpar), a lista e,
# vazia, a frase que diz de onde as contas vêm.
def historyBlock(+hs: List<&2, CalcEntry>) -> V.ViewNode:
  +empty = List.is_empty(&2, CalcEntry, hs)
  V.viewEl("div", [V.attrId("calc-hist")], V.viewJoin([
    [historyHead(empty)],
    V.viewWhen(empty, historyEmpty()),
    [calcHistory(hs)]
  ]))

# ---------- barra (a linha de 40px) ----------

def calcBar(collapsed: Bool, +angle: String, +expression: String, result: String) -> V.ViewNode:
  V.viewEl("div", [
    V.attrId("calc-bar"),
    V.ViewAttr{"role", "group"},
    V.attrAria("label", calcTitle())
  ], [
    calcIcon(),
    calcForm(expression),
    calcResult(result),
    calcUnit(angle),
    calcToggle(collapsed)
  ])

# ---------- corpo (painel expandido) e casco ----------

def calcBody(collapsed: Bool, +angle: String, history: List<&2, CalcEntry>, guideOpen: Bool) -> V.ViewNode:
  V.viewEl("div", V.attrJoin([
    [V.attrId("calc-body")],
    V.attrWhen(collapsed, V.ViewAttr{"hidden", ""})
  ]), [
    angleRow(angle),
    historyBlock(history),
    calcGuide(guideOpen)
  ])

def calculator(visible: Bool, +collapsed: Bool, +angle: String, +expression: String, result: String, history: List<&2, CalcEntry>, guideOpen: Bool) -> V.ViewNode:
  V.viewEl("section", V.attrJoin([
    [V.attrId("calculator")],
    V.attrWhen(Bool.not(visible), V.ViewAttr{"hidden", ""}),
    [V.classes([V.classOn("collapsed", collapsed)])]
  ]), [calcBar(collapsed, angle, expression, result), calcBody(collapsed, angle, history, guideOpen)])
