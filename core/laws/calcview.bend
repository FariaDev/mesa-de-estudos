import Base
import ../msg.bend as M
import ../calcview.bend as C
import ../view.bend as V

# ---------------------------------------------------------------------------
# Contrato da calculadora da Mesa. Prefixo `calc_`.
#
# Tudo é cenário concreto (como `laws/dialogsview.bend`): os fatos entram já
# resolvidos (flags Bool, textos do host) e a lei fecha por computação. O que
# se fixa aqui é o DOM que o aplicador cola no `index.html` (ids, classes,
# aria, textos e ordem) e as decisões pequenas do núcleo: rótulo do histórico
# (`expr = result`), `selected` do ângulo, `hidden`/`collapsed` e `open` da
# guia. A avaliação (`calculate`) não entra: continua no host.
# ---------------------------------------------------------------------------

# ---------- casco ----------

law calc_tag:
  {V.tagOf(C.calculator(True{}, False{}, "rad", "", "0", Nil{}, False{})) == "section" : String}

law calc_id:
  {V.attrGet(V.attrsOf(C.calculator(True{}, False{}, "rad", "", "0", Nil{}, False{})), "id")
    == Some{"calculator"} : Maybe<&2, String>}

law calc_visivel:
  {V.attrGet(V.attrsOf(C.calculator(True{}, False{}, "rad", "", "0", Nil{}, False{})), "hidden")
    == None{} : Maybe<&2, String>}

law calc_oculta:
  {V.attrGet(V.attrsOf(C.calculator(False{}, False{}, "rad", "", "0", Nil{}, False{})), "hidden")
    == Some{""} : Maybe<&2, String>}

law calc_aberta_classe:
  {V.attrGet(V.attrsOf(C.calculator(True{}, False{}, "rad", "", "0", Nil{}, False{})), "class")
    == Some{""} : Maybe<&2, String>}

law calc_colapsada_classe:
  {V.attrGet(V.attrsOf(C.calculator(True{}, True{}, "rad", "", "0", Nil{}, False{})), "class")
    == Some{"collapsed"} : Maybe<&2, String>}

law calc_filhos:
  {V.kidsOf(C.calculator(True{}, False{}, "rad", "", "0", Nil{}, False{}))
    == [C.calcBar(False{}, "rad", "", "0"), C.calcBody(False{}, "rad", Nil{}, False{})]
    : List<&2, V.ViewNode>}

# Os fatos descem aos filhos: o colapso decide o controle e o corpo, o ângulo
# decide a unidade da linha e a opção do seletor.
law calc_filhos_colapsada_graus:
  {V.kidsOf(C.calculator(True{}, True{}, "deg", "2+3", "5", Nil{}, False{}))
    == [C.calcBar(True{}, "deg", "2+3", "5"), C.calcBody(True{}, "deg", Nil{}, False{})]
    : List<&2, V.ViewNode>}

# ---------- barra (a linha de 40px) ----------

law calc_barra_id:
  {V.attrGet(V.attrsOf(C.calcBar(True{}, "rad", "", "0")), "id")
    == Some{"calc-bar"} : Maybe<&2, String>}

law calc_barra_grupo:
  {V.attrGet(V.attrsOf(C.calcBar(True{}, "rad", "", "0")), "role")
    == Some{"group"} : Maybe<&2, String>}

law calc_barra_nome:
  {V.attrGet(V.attrsOf(C.calcBar(True{}, "rad", "", "0")), "aria-label")
    == Some{M.msg("calc.title")} : Maybe<&2, String>}

law calc_titulo:
  {C.calcTitle() == M.msg("calc.title") : String}

law calc_barra_completa:
  {C.calcBar(True{}, "deg", "2+3", "5") == V.viewEl("div", [
    V.attrId("calc-bar"),
    V.ViewAttr{"role", "group"},
    V.attrAria("label", M.msg("calc.title"))
  ], [
    V.viewEl("span", [V.attrClass("calc-icon"), V.attrAria("hidden", "true")], Nil{}),
    C.calcForm("2+3"),
    V.viewEl("output", [V.attrId("result")], Con{V.viewText("5"), Nil{}}),
    V.viewEl("span", [V.attrClass("calc-unit")], Con{V.viewText(M.msg("calc.unit.deg")), Nil{}}),
    C.calcToggle(True{})
  ]) : V.ViewNode}

# ---------- unidade na linha ----------

law calc_unidade_rad:
  {C.unitLabel("rad") == "RAD" : String}

law calc_unidade_graus:
  {C.unitLabel("deg") == M.msg("calc.unit.deg") : String}

# Valor desconhecido nunca vira GRAUS: a linha cai na unidade padrão.
law calc_unidade_desconhecida:
  {C.unitLabel("grad") == "RAD" : String}

law calc_unidade_no:
  {C.calcUnit("deg") == V.viewEl("span", [V.attrClass("calc-unit")], Con{V.viewText(M.msg("calc.unit.deg")), Nil{}})
    : V.ViewNode}

# ---------- ícone e controle de expandir ----------

law calc_icone:
  {C.calcIcon() == V.viewEl("span", [V.attrClass("calc-icon"), V.attrAria("hidden", "true")], Nil{})
    : V.ViewNode}

law calc_toggle_id:
  {V.attrGet(V.attrsOf(C.calcToggle(False{})), "id")
    == Some{"calc-toggle"} : Maybe<&2, String>}

law calc_toggle_aberto:
  {V.attrGet(V.attrsOf(C.calcToggle(False{})), "aria-expanded")
    == Some{"true"} : Maybe<&2, String>}

law calc_toggle_colapsado:
  {V.attrGet(V.attrsOf(C.calcToggle(True{})), "aria-expanded")
    == Some{"false"} : Maybe<&2, String>}

law calc_toggle_clique:
  {V.attrGet(V.attrsOf(C.calcToggle(False{})), "on:click")
    == Some{"ToggleCalc"} : Maybe<&2, String>}

law calc_toggle_rotulo_recolhida:
  {C.toggleLabel(True{}) == M.msg("calc.expand") : String}

law calc_toggle_rotulo_aberta:
  {C.toggleLabel(False{}) == M.msg("calc.collapse") : String}

law calc_toggle_completo:
  {C.calcToggle(True{}) == V.viewEl("button", [
    V.attrId("calc-toggle"),
    V.attrType("button"),
    V.attrClass("icon-btn"),
    V.attrAria("expanded", "false"),
    V.attrAria("controls", "calc-body"),
    V.attrAria("label", M.msg("calc.expand")),
    V.attrTitle(M.msg("calc.expand")),
    V.attrOn("click", "ToggleCalc")
  ], Nil{}) : V.ViewNode}

law calc_toggle_completo_aberta:
  {C.calcToggle(False{}) == V.viewEl("button", [
    V.attrId("calc-toggle"),
    V.attrType("button"),
    V.attrClass("icon-btn"),
    V.attrAria("expanded", "true"),
    V.attrAria("controls", "calc-body"),
    V.attrAria("label", M.msg("calc.collapse")),
    V.attrTitle(M.msg("calc.collapse")),
    V.attrOn("click", "ToggleCalc")
  ], Nil{}) : V.ViewNode}

# ---------- ângulo (grupo segmentado) ----------

law calc_angulo_rad:
  {C.angleButton("rad", "RAD", "rad")
    == V.viewEl("button", [
      V.attrType("button"),
      V.attrKey("angle-rad"),
      V.attrData("angle", "rad"),
      V.attrAria("pressed", "true"),
      V.attrOn("click", "SetAngle")
    ], Con{V.viewText("RAD"), Nil{}})
    : V.ViewNode}

law calc_angulo_graus:
  {C.angleButton("deg", M.msg("calc.unit.deg"), "deg")
    == V.viewEl("button", [
      V.attrType("button"),
      V.attrKey("angle-deg"),
      V.attrData("angle", "deg"),
      V.attrAria("pressed", "true"),
      V.attrOn("click", "SetAngle")
    ], Con{V.viewText(M.msg("calc.unit.deg")), Nil{}})
    : V.ViewNode}

law calc_angulo_sem_selecao:
  {V.attrGet(V.attrsOf(C.angleButton("deg", M.msg("calc.unit.deg"), "rad")), "aria-pressed")
    == Some{"false"} : Maybe<&2, String>}

# Valor desconhecido não marca nenhum dos dois.
law calc_angulo_desconhecido:
  {V.attrGet(V.attrsOf(C.angleButton("rad", "RAD", "grad")), "aria-pressed")
    == Some{"false"} : Maybe<&2, String>}

law calc_angulo_grupo_graus:
  {C.angleGroup("deg") == V.viewEl("div", [
    V.attrId("angle"),
    V.ViewAttr{"role", "group"},
    V.attrClass("calc-seg"),
    V.attrAria("label", M.msg("calc.angleAria"))
  ], [C.angleButton("rad", "RAD", "deg"), C.angleButton("deg", M.msg("calc.unit.deg"), "deg")])
    : V.ViewNode}

law calc_angulo_dica_rad:
  {C.angleHint("rad") == V.viewEl("span", [V.attrClass("calc-hint")], [V.viewText(M.msg("calc.hint.rad"))])
    : V.ViewNode}

law calc_angulo_dica_graus:
  {C.angleHint("deg") == V.viewEl("span", [V.attrClass("calc-hint")], [V.viewText(M.msg("calc.hint.deg"))])
    : V.ViewNode}

law calc_angulo_linha:
  {C.angleRow("deg") == V.viewEl("div", [V.attrClass("calc-angle")], [
    V.viewEl("span", [V.attrClass("calc-angle-label")], [V.viewText(M.msg("calc.angleLabel"))]),
    C.angleGroup("deg"),
    C.angleHint("deg")
  ]) : V.ViewNode}

# ---------- formulário / resultado ----------

law calc_form_valor:
  {C.calcForm("2+3") == V.viewEl("form", [
    V.attrId("calc-form"),
    V.attrOn("submit", "Eval")
  ], Con{
    V.viewEl("input", [
      V.attrId("expression"),
      V.ViewAttr{"autocomplete", "off"},
      V.ViewAttr{"placeholder", "sqrt(16) + sin(pi/2)"},
      V.attrAria("label", M.msg("calc.expressionAria")),
      V.ViewAttr{"value", "2+3"}
    ], Nil{}),
    Con{
      V.viewEl("button", [
        V.attrType("submit"),
        V.attrClass("icon-btn"),
        V.attrAria("label", M.msg("calc.equalsAria"))
      ], Con{V.viewText("="), Nil{}}),
      Nil{}
    }
  }) : V.ViewNode}

law calc_form_vazio:
  {C.calcForm("") == V.viewEl("form", [
    V.attrId("calc-form"),
    V.attrOn("submit", "Eval")
  ], Con{
    V.viewEl("input", [
      V.attrId("expression"),
      V.ViewAttr{"autocomplete", "off"},
      V.ViewAttr{"placeholder", "sqrt(16) + sin(pi/2)"},
      V.attrAria("label", M.msg("calc.expressionAria"))
    ], Nil{}),
    Con{
      V.viewEl("button", [
        V.attrType("submit"),
        V.attrClass("icon-btn"),
        V.attrAria("label", M.msg("calc.equalsAria"))
      ], Con{V.viewText("="), Nil{}}),
      Nil{}
    }
  }) : V.ViewNode}

law calc_resultado:
  {C.calcResult("5") == V.viewEl("output", [V.attrId("result")], Con{V.viewText("5"), Nil{}}) : V.ViewNode}

law calc_resultado_erro:
  {C.calcResult("—") == V.viewEl("output", [V.attrId("result")], Con{V.viewText("—"), Nil{}}) : V.ViewNode}

# ---------- histórico ----------

law calc_historico_rotulo:
  {C.histLabel("sqrt(16)+sin(pi/2)", "5") == "sqrt(16)+sin(pi/2) = 5" : String}

law calc_historico_botao:
  {C.histButton(C.CalcEntry{"2+3", "5"}) == V.viewEl("button", [
    V.attrType("button"),
    V.attrData("expr", "2+3"),
    V.attrTitle("2+3"),
    V.attrAria("label", "2+3 = 5"),
    V.attrOn("click", "Reuse")
  ], [
    V.viewEl("span", [V.attrClass("calc-hist-expr")], [V.viewText("2+3")]),
    V.viewEl("span", [V.attrClass("calc-hist-res")], [V.viewText("= 5")])
  ]) : V.ViewNode}

law calc_historico_vazio:
  {C.calcHistory(Nil{}) == V.viewEl("div", [V.attrId("calc-history")], Nil{}) : V.ViewNode}

law calc_historico_ordem:
  {C.calcHistory(Con{C.CalcEntry{"2+3", "5"}, Con{C.CalcEntry{"1+1", "2"}, Nil{}}})
    == V.viewEl("div", [V.attrId("calc-history")], Con{
      C.histButton(C.CalcEntry{"2+3", "5"}),
      Con{C.histButton(C.CalcEntry{"1+1", "2"}), Nil{}}
    }) : V.ViewNode}

# Bloco: título e "Limpar" no cabeçalho, depois a lista. Sem contas, "Limpar"
# fica desligado e entra a frase que explica a lista vazia.
law calc_historico_bloco_vazio:
  {C.historyBlock(Nil{}) == V.viewEl("div", [V.attrId("calc-hist")], [
    C.historyHead(True{}),
    C.historyEmpty(),
    C.calcHistory(Nil{})
  ]) : V.ViewNode}

law calc_historico_bloco_cheio:
  {C.historyBlock([C.CalcEntry{"2+3", "5"}]) == V.viewEl("div", [V.attrId("calc-hist")], [
    C.historyHead(False{}),
    C.calcHistory([C.CalcEntry{"2+3", "5"}])
  ]) : V.ViewNode}

law calc_historico_cabecalho:
  {C.historyHead(False{}) == V.viewEl("div", [V.attrClass("calc-hist-head")], [
    V.viewEl("h3", Nil{}, [V.viewText(M.msg("calc.historyTitle"))]),
    V.viewEl("button", [
      V.attrId("calc-clear"),
      V.attrType("button"),
      V.attrOn("click", "ClearHistory")
    ], [V.viewText(M.msg("calc.clear"))])
  ]) : V.ViewNode}

law calc_historico_limpar_desligado:
  {V.attrGet(V.attrsOf(C.clearButton(True{})), "disabled") == Some{""} : Maybe<&2, String>}

law calc_historico_limpar_ligado:
  {V.attrGet(V.attrsOf(C.clearButton(False{})), "disabled") == None{} : Maybe<&2, String>}

# ---------- corpo (painel expandido) ----------

law calc_corpo_id:
  {V.attrGet(V.attrsOf(C.calcBody(False{}, "rad", Nil{}, False{})), "id")
    == Some{"calc-body"} : Maybe<&2, String>}

law calc_corpo_aberto:
  {V.attrGet(V.attrsOf(C.calcBody(False{}, "rad", Nil{}, False{})), "hidden")
    == None{} : Maybe<&2, String>}

law calc_corpo_oculto:
  {V.attrGet(V.attrsOf(C.calcBody(True{}, "rad", Nil{}, False{})), "hidden")
    == Some{""} : Maybe<&2, String>}

law calc_corpo_tamanho:
  {List.length(&2, V.ViewNode, V.kidsOf(C.calcBody(False{}, "rad", Nil{}, False{}))) == 3n : Nat}

# O painel expandido guarda o que a linha não mostra: ângulo, histórico e
# guia, nessa ordem. Formulário e resultado moram só na barra; a lista de nomes
# solta saiu (os nomes moram nos grupos do guia).
law calc_corpo_partes:
  {V.kidsOf(C.calcBody(False{}, "deg", Nil{}, True{}))
    == [C.angleRow("deg"), C.historyBlock(Nil{}), C.calcGuide(True{})]
    : List<&2, V.ViewNode>}

# ---------- guia ----------

law calc_guia_id:
  {V.attrGet(V.attrsOf(C.calcGuide(False{})), "id") == Some{"calc-guide"} : Maybe<&2, String>}

law calc_guia_fechada:
  {V.attrGet(V.attrsOf(C.calcGuide(False{})), "open") == None{} : Maybe<&2, String>}

law calc_guia_aberta:
  {V.attrGet(V.attrsOf(C.calcGuide(True{})), "open") == Some{""} : Maybe<&2, String>}

law calc_guia_no:
  {C.calcGuide(False{}) == V.viewEl("details", [V.attrId("calc-guide")], [
    V.viewEl("summary", Nil{}, [V.viewText(M.msg("calc.guideSummary"))]),
    C.guideLead(),
    C.guideGroups(),
    C.guideTips()
  ]) : V.ViewNode}

law calc_guia_lead:
  {C.guideLead() == V.viewEl("p", [V.attrClass("calc-guide-lead")], [
    V.viewText(M.msg("calc.guideLead"))
  ]) : V.ViewNode}

# Quatro grupos, cada um um par dt/dd: Operações, Funções, Trigonometria e
# Constantes.
law calc_guia_grupos_classe:
  {V.attrGet(V.attrsOf(C.guideGroups()), "class") == Some{"calc-groups"} : Maybe<&2, String>}

law calc_guia_grupos_tamanho:
  {List.length(&2, V.ViewNode, V.kidsOf(C.guideGroups())) == 8n : Nat}

law calc_guia_grupo_constantes:
  {C.guideGroup(M.msg("calc.group.consts"), C.constNames()) == [
    V.viewEl("dt", Nil{}, [V.viewText(M.msg("calc.group.consts"))]),
    V.viewEl("dd", Nil{}, [C.codeNode("pi"), C.codeNode("e")])
  ] : List<&2, V.ViewNode>}

law calc_guia_operacoes:
  {C.opNames() == ["+", "-", "*", "/", "^", "( )"] : List<&2, String>}

law calc_guia_funcoes:
  {C.fnNames() == ["sqrt", "abs", "exp", "ln", "log"] : List<&2, String>}

law calc_guia_trig:
  {C.trigNames() == ["sin", "cos", "tan", "sec", "csc", "cot", "asin", "acos", "atan"] : List<&2, String>}

law calc_guia_chips_trig:
  {List.length(&2, V.ViewNode, C.chips(C.trigNames())) == 9n : Nat}

law calc_guia_dicas_classe:
  {V.attrGet(V.attrsOf(C.guideTips()), "class") == Some{"calc-tips"} : Maybe<&2, String>}

law calc_guia_dicas_tamanho:
  {List.length(&2, V.ViewNode, V.kidsOf(C.guideTips())) == 5n : Nat}

law calc_guia_dica1:
  {C.guideTip1() == V.viewEl("li", Nil{}, [
    V.viewText(M.msg("calc.tip1.a")),
    C.codeNode("2*pi"),
    V.viewText(M.msg("calc.tip1.b")),
    C.codeNode("2pi"),
    V.viewText(M.msg("calc.tip1.c")),
    C.codeNode("2,5"),
    V.viewText(".")
  ]) : V.ViewNode}

law calc_guia_dica2:
  {C.guideTip2() == V.viewEl("li", Nil{}, [
    C.codeNode("log"),
    V.viewText(M.msg("calc.tip2.a")),
    C.codeNode("ln"),
    V.viewText(M.msg("calc.tip2.b"))
  ]) : V.ViewNode}

law calc_guia_dica3:
  {C.guideTip3() == V.viewEl("li", Nil{}, [
    V.viewText(M.msg("calc.tip3.a")),
    C.codeNode("sin(pi/2)"),
    V.viewText(M.msg("calc.tip3.b")),
    C.codeNode("sin(90)"),
    V.viewText(M.msg("calc.tip3.c")),
    C.codeNode("asin(0.5)"),
    V.viewText(M.msg("calc.tip3.d"))
  ]) : V.ViewNode}

law calc_guia_dica4:
  {C.guideTip4() == V.viewEl("li", Nil{}, [
    V.viewText(M.msg("calc.tip4.a")),
    C.codeNode("cos(90)"),
    V.viewText(M.msg("calc.tip4.b")),
    C.codeNode("tan(90)"),
    V.viewText(M.msg("calc.tip4.c"))
  ]) : V.ViewNode}

law calc_guia_dica5:
  {C.guideTip5() == V.viewEl("li", Nil{}, [
    V.viewText(M.msg("calc.tip5"))
  ]) : V.ViewNode}
