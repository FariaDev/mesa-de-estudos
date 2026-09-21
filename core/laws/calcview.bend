import Base
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
    == [C.calcToggle(False{}, "rad"), C.calcBody(False{}, "", "0", Nil{}, False{})]
    : List<&2, V.ViewNode>}

# ---------- botão do título (toggle) ----------

law calc_titulo:
  {C.calcTitle() == "Calculadora" : String}

law calc_toggle_id:
  {V.attrGet(V.attrsOf(C.calcToggle(False{}, "rad")), "id")
    == Some{"calc-toggle"} : Maybe<&2, String>}

law calc_toggle_aberto:
  {V.attrGet(V.attrsOf(C.calcToggle(False{}, "rad")), "aria-expanded")
    == Some{"true"} : Maybe<&2, String>}

law calc_toggle_colapsado:
  {V.attrGet(V.attrsOf(C.calcToggle(True{}, "rad")), "aria-expanded")
    == Some{"false"} : Maybe<&2, String>}

law calc_toggle_clique:
  {V.attrGet(V.attrsOf(C.calcToggle(False{}, "rad")), "on:click")
    == Some{"ToggleCalc"} : Maybe<&2, String>}

law calc_toggle_completo:
  {C.calcToggle(False{}, "rad") == V.viewEl("button", [
    V.attrId("calc-toggle"),
    V.attrAria("expanded", "true"),
    V.attrOn("click", "ToggleCalc")
  ], Con{
    V.viewEl("span", Nil{}, Con{V.viewText("Calculadora"), Nil{}}),
    Con{
      V.viewEl("span", [V.attrClass("calc-mode")], Con{
        V.viewEl("select", [
          V.attrId("angle"),
          V.attrAria("label", "Unidade angular"),
          V.attrOn("change", "SetAngle")
        ], Con{
          V.viewEl("option", [V.ViewAttr{"value", "rad"}, V.ViewAttr{"selected", ""}], Con{V.viewText("RAD"), Nil{}}),
          Con{
            V.viewEl("option", [V.ViewAttr{"value", "deg"}], Con{V.viewText("GRAUS"), Nil{}}),
            Nil{}
          }
        }),
        Nil{}
      }),
      Nil{}
    }
  }) : V.ViewNode}

# ---------- ângulo ----------

law calc_angulo_rad:
  {C.angleOption("rad", "RAD", "rad")
    == V.viewEl("option", [V.ViewAttr{"value", "rad"}, V.ViewAttr{"selected", ""}], Con{V.viewText("RAD"), Nil{}})
    : V.ViewNode}

law calc_angulo_graus:
  {C.angleOption("deg", "GRAUS", "deg")
    == V.viewEl("option", [V.ViewAttr{"value", "deg"}, V.ViewAttr{"selected", ""}], Con{V.viewText("GRAUS"), Nil{}})
    : V.ViewNode}

law calc_angulo_sem_selecao:
  {C.angleOption("deg", "GRAUS", "rad")
    == V.viewEl("option", [V.ViewAttr{"value", "deg"}], Con{V.viewText("GRAUS"), Nil{}})
    : V.ViewNode}

law calc_angulo_select_graus:
  {C.angleSelect("deg") == V.viewEl("select", [
    V.attrId("angle"),
    V.attrAria("label", "Unidade angular"),
    V.attrOn("change", "SetAngle")
  ], Con{
    V.viewEl("option", [V.ViewAttr{"value", "rad"}], Con{V.viewText("RAD"), Nil{}}),
    Con{
      V.viewEl("option", [V.ViewAttr{"value", "deg"}, V.ViewAttr{"selected", ""}], Con{V.viewText("GRAUS"), Nil{}}),
      Nil{}
    }
  }) : V.ViewNode}

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
      V.attrAria("label", "Expressão matemática"),
      V.ViewAttr{"value", "2+3"}
    ], Nil{}),
    Con{
      V.viewEl("button", [
        V.attrType("submit"),
        V.attrAria("label", "Calcular")
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
      V.attrAria("label", "Expressão matemática")
    ], Nil{}),
    Con{
      V.viewEl("button", [
        V.attrType("submit"),
        V.attrAria("label", "Calcular")
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
    V.attrData("expr", "2+3"),
    V.attrOn("click", "Reuse")
  ], Con{V.viewText("2+3 = 5"), Nil{}}) : V.ViewNode}

law calc_historico_vazio:
  {C.calcHistory(Nil{}) == V.viewEl("div", [V.attrId("calc-history")], Nil{}) : V.ViewNode}

law calc_historico_ordem:
  {C.calcHistory(Con{C.CalcEntry{"2+3", "5"}, Con{C.CalcEntry{"1+1", "2"}, Nil{}}})
    == V.viewEl("div", [V.attrId("calc-history")], Con{
      C.histButton(C.CalcEntry{"2+3", "5"}),
      Con{C.histButton(C.CalcEntry{"1+1", "2"}), Nil{}}
    }) : V.ViewNode}

# ---------- corpo ----------

law calc_corpo_id:
  {V.attrGet(V.attrsOf(C.calcBody(False{}, "", "0", Nil{}, False{})), "id")
    == Some{"calc-body"} : Maybe<&2, String>}

law calc_corpo_aberto:
  {V.attrGet(V.attrsOf(C.calcBody(False{}, "", "0", Nil{}, False{})), "hidden")
    == None{} : Maybe<&2, String>}

law calc_corpo_oculto:
  {V.attrGet(V.attrsOf(C.calcBody(True{}, "", "0", Nil{}, False{})), "hidden")
    == Some{""} : Maybe<&2, String>}

law calc_corpo_tamanho:
  {List.length(&2, V.ViewNode, V.kidsOf(C.calcBody(False{}, "", "0", Nil{}, False{}))) == 5n : Nat}

# ---------- ajuda e guia ----------

law calc_ajuda_texto:
  {C.calcHelpText() == "+ − * / ^ · sqrt · sin · cos · tan · ln · log · pi" : String}

law calc_ajuda_no:
  {C.calcHelp() == V.viewEl("div", [V.attrClass("calc-help")], Con{
    V.viewText("+ − * / ^ · sqrt · sin · cos · tan · ln · log · pi"),
    Nil{}
  }) : V.ViewNode}

law calc_guia_id:
  {V.attrGet(V.attrsOf(C.calcGuide(False{})), "id") == Some{"calc-guide"} : Maybe<&2, String>}

law calc_guia_fechada:
  {V.attrGet(V.attrsOf(C.calcGuide(False{})), "open") == None{} : Maybe<&2, String>}

law calc_guia_aberta:
  {V.attrGet(V.attrsOf(C.calcGuide(True{})), "open") == Some{""} : Maybe<&2, String>}

law calc_guia_no:
  {C.calcGuide(False{}) == V.viewEl("details", [V.attrId("calc-guide")], Con{
    V.viewEl("summary", Nil{}, Con{V.viewText("Como usar"), Nil{}}),
    Con{
      C.guideParagraph1(),
      Con{C.guideParagraph2(), Con{C.guideParagraph3(), Nil{}}}
    }
  }) : V.ViewNode}

law calc_guia_p1:
  {C.guideParagraph1() == V.viewEl("p", Nil{}, Con{
    V.viewText("Calculadora numérica local, sem IA. Digite e pressione Enter. Parênteses agrupam: "),
    Con{
      C.codeNode("(2+3)*4"),
      Con{
        V.viewText(". Multiplicação: "),
        Con{
          C.codeNode("2*pi"),
          Con{
            V.viewText("; potência: "),
            Con{
              C.codeNode("2^3"),
              Con{
                V.viewText("; raiz: "),
                Con{C.codeNode("sqrt(16)"), Con{V.viewText("."), Nil{}}}
              }
            }
          }
        }
      }
    }
  }) : V.ViewNode}

law calc_guia_p2:
  {C.guideParagraph2() == V.viewEl("p", Nil{}, Con{
    C.codeNode("sin(pi/2)"),
    Con{
      V.viewText(" em RAD e "),
      Con{
        C.codeNode("sin(90)"),
        Con{
          V.viewText(" em GRAUS dão 1. "),
          Con{
            C.codeNode("ln"),
            Con{
              V.viewText(" é logaritmo natural; "),
              Con{
                C.codeNode("log"),
                Con{
                  V.viewText(" é base 10. Aceita vírgula decimal. Clique no histórico para reutilizar uma expressão."),
                  Nil{}
                }
              }
            }
          }
        }
      }
    }
  }) : V.ViewNode}

law calc_guia_p3:
  {C.guideParagraph3() == V.viewEl("p", Nil{}, Con{
    V.viewText("Não resolve equações nem deriva ou integra simbolicamente."),
    Nil{}
  }) : V.ViewNode}
