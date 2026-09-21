import Base
import view.bend as V

# ---------------------------------------------------------------------------
# View da calculadora da Mesa: casco, colapso, ângulo, expressão/resultado,
# histórico e guia. O núcleo não avalia, não mede e não toca no DOM — o host
# (`desk/src/calc.mjs`) guarda os fatos e aplica a árvore no casco fixo do
# `index.html`.
#
# Fatos (todos já resolvidos pelo host):
#   - `visible`: a flag `calculator` do `desk` (a seção inteira some);
#   - `collapsed`: o colapso (classe `.collapsed` + `#calc-body[hidden]` +
#     `aria-expanded` do botão);
#   - `angle`: "rad"/"deg" — vira o `selected` da opção, com `SetAngle` no
#     `change`;
#   - `expression`/`result`: textos do host (a avaliação é o `calculate` do
#     JS, precisão dupla; nada de parser aqui);
#   - `history`: pares expr/resultado já avaliados, do mais novo para o mais
#     antigo; o rótulo `expr = result` é montado aqui e o `data-expr` guarda a
#     expressão para o clique `Reuse` reutilizar e focar;
#   - `guideOpen`: o `<details>` estava aberto (o host lê o DOM antes de
#     re-renderizar, como faz com o texto digitado).
#
# Convenções de attr: as mesmas do `core/view.bend` (o host pula `class`/`id`
# vazios e liga `on:<evento>` na tabela de handlers). O ícone do título é
# asset do host (`icons.mjs`), como nas abas: a view só diz o texto.
# ---------------------------------------------------------------------------

# Item do histórico: expressão digitada e resultado avaliado pelo host.
type CalcEntry is Data:
  CalcEntry{expr: String, result: String}

# ---------- textos ----------

def calcTitle() -> String:
  "Calculadora"

def angleAria() -> String:
  "Unidade angular"

def expressionPlaceholder() -> String:
  "sqrt(16) + sin(pi/2)"

def expressionAria() -> String:
  "Expressão matemática"

def equalsAria() -> String:
  "Calcular"

def equalsText() -> String:
  "="

def calcHelpText() -> String:
  "+ − * / ^ · sqrt · sin · cos · tan · ln · log · pi"

def guideSummaryText() -> String:
  "Como usar"

# ---------- guia ----------

def codeNode(txt: String) -> V.ViewNode:
  V.viewEl("code", Nil{}, [V.viewText(txt)])

def guideParagraph1() -> V.ViewNode:
  V.viewEl("p", Nil{}, [
    V.viewText("Calculadora numérica local, sem IA. Digite e pressione Enter. Parênteses agrupam: "),
    codeNode("(2+3)*4"),
    V.viewText(". Multiplicação: "),
    codeNode("2*pi"),
    V.viewText("; potência: "),
    codeNode("2^3"),
    V.viewText("; raiz: "),
    codeNode("sqrt(16)"),
    V.viewText(".")
  ])

def guideParagraph2() -> V.ViewNode:
  V.viewEl("p", Nil{}, [
    codeNode("sin(pi/2)"),
    V.viewText(" em RAD e "),
    codeNode("sin(90)"),
    V.viewText(" em GRAUS dão 1. "),
    codeNode("ln"),
    V.viewText(" é logaritmo natural; "),
    codeNode("log"),
    V.viewText(" é base 10. Aceita vírgula decimal. Clique no histórico para reutilizar uma expressão.")
  ])

def guideParagraph3() -> V.ViewNode:
  V.viewEl("p", Nil{}, [V.viewText("Não resolve equações nem deriva ou integra simbolicamente.")])

def calcGuide(open: Bool) -> V.ViewNode:
  V.viewEl("details", V.attrJoin([
    [V.attrId("calc-guide")],
    V.attrWhen(open, V.ViewAttr{"open", ""})
  ]), [
    V.viewEl("summary", Nil{}, [V.viewText(guideSummaryText())]),
    guideParagraph1(),
    guideParagraph2(),
    guideParagraph3()
  ])

# ---------- ângulo ----------

def angleOption(+value: String, label: String, angle: String) -> V.ViewNode:
  V.viewEl("option", V.attrJoin([
    [V.ViewAttr{"value", value}],
    V.attrWhen(String.eq(value, angle), V.ViewAttr{"selected", ""})
  ]), [V.viewText(label)])

def angleSelect(+angle: String) -> V.ViewNode:
  V.viewEl("select", [
    V.attrId("angle"),
    V.attrAria("label", angleAria()),
    V.attrOn("change", "SetAngle")
  ], [angleOption("rad", "RAD", angle), angleOption("deg", "GRAUS", angle)])

# ---------- botão do título (toggle) ----------

def calcToggle(collapsed: Bool, +angle: String) -> V.ViewNode:
  V.viewEl("button", [
    V.attrId("calc-toggle"),
    V.attrAria("expanded", V.boolStr(Bool.not(collapsed))),
    V.attrOn("click", "ToggleCalc")
  ], [
    V.viewEl("span", Nil{}, [V.viewText(calcTitle())]),
    V.viewEl("span", [V.attrClass("calc-mode")], [angleSelect(angle)])
  ])

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
      V.attrAria("label", equalsAria())
    ], [V.viewText(equalsText())])
  ])

def calcResult(value: String) -> V.ViewNode:
  V.viewEl("output", [V.attrId("result")], [V.viewText(value)])

# ---------- histórico ----------

def histLabel(expr: String, result: String) -> String:
  expr ++ " = " ++ result

def histButton(e: CalcEntry) -> V.ViewNode:
  match e:
    case CalcEntry{+expr, result}:
      V.viewEl("button", [
        V.attrData("expr", expr),
        V.attrOn("click", "Reuse")
      ], [V.viewText(histLabel(expr, result))])

def histItems(hs: List<&2, CalcEntry>) -> List<&2, V.ViewNode>:
  V.viewMap(~CalcEntry, ~histButton, hs)

def calcHistory(hs: List<&2, CalcEntry>) -> V.ViewNode:
  V.viewEl("div", [V.attrId("calc-history")], histItems(hs))

# ---------- ajuda ----------

def calcHelp() -> V.ViewNode:
  V.viewEl("div", [V.attrClass("calc-help")], [V.viewText(calcHelpText())])

# ---------- corpo e casco ----------

def calcBody(collapsed: Bool, +expression: String, result: String, history: List<&2, CalcEntry>, guideOpen: Bool) -> V.ViewNode:
  V.viewEl("div", V.attrJoin([
    [V.attrId("calc-body")],
    V.attrWhen(collapsed, V.ViewAttr{"hidden", ""})
  ]), [
    calcForm(expression),
    calcResult(result),
    calcHistory(history),
    calcHelp(),
    calcGuide(guideOpen)
  ])

def calculator(visible: Bool, +collapsed: Bool, +angle: String, +expression: String, result: String, history: List<&2, CalcEntry>, guideOpen: Bool) -> V.ViewNode:
  V.viewEl("section", V.attrJoin([
    [V.attrId("calculator")],
    V.attrWhen(Bool.not(visible), V.ViewAttr{"hidden", ""}),
    [V.classes([V.classOn("collapsed", collapsed)])]
  ]), [calcToggle(collapsed, angle), calcBody(collapsed, expression, result, history, guideOpen)])
