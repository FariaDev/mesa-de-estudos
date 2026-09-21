import Base
import ../view.bend as V
import ../auxview.bend as A

# ---------------------------------------------------------------------------
# Contrato dos controles auxiliares da Mesa (densidade, dica e avisos).
#
# Cenários concretos, no espírito de `laws/statusview.bend`: `String.eq` não
# reduz genericamente em string livre, então as leis fixam as entradas
# (literais) e o checker normaliza os dois lados. As leis de nó comparam a
# árvore inteira, como `sessionOptions`/`ctxMeter` fazem lá.
# ---------------------------------------------------------------------------

# ---------- densidade ----------

law aux_density_valor_vazio:
  {A.densityValue("") == "padrao" : String}

law aux_density_valor_desconhecido:
  {A.densityValue("outro") == "padrao" : String}

law aux_density_valor_compacta:
  {A.densityValue("compacta") == "compacta" : String}

law aux_density_denso:
  {A.densityDense("compacta") == True{} : Bool}

law aux_density_padrao:
  {A.densityDense("padrao") == False{} : Bool}

# O select mantém id e evento do contrato (`on:change` vira lookup no aplicador).
law aux_density_select_id:
  {V.attrGet(V.attrsOf(A.densitySelect("padrao")), "id") == Some{"density-mode"} : Maybe<&2, String>}

law aux_density_select_evento:
  {V.attrGet(V.attrsOf(A.densitySelect("padrao")), "on:change") == Some{"SetDensity"} : Maybe<&2, String>}

# Só o modo corrente sai marcado (o `selected` é o fato do host).
law aux_density_opcoes:
  {A.densitySelect("compacta") == V.viewEl("select",
     [V.ViewAttr{"id", "density-mode"}, V.ViewAttr{"on:change", "SetDensity"}],
     [ V.viewEl("option", [V.ViewAttr{"value", "padrao"}], [V.viewText("Padrão")])
     , V.viewEl("option", [V.ViewAttr{"value", "compacta"}, V.ViewAttr{"selected", ""}], [V.viewText("Compacta")])
     ]
   ) : V.ViewNode}

law aux_density_campos:
  {List.length(&2, V.ViewNode, A.densityFields("padrao")) == 2n : Nat}

law aux_density_controle_rotulo:
  {V.tagOf(A.densityControl("compacta")) == "label" : String}

# ---------- balão de dica ----------

law aux_tip_classes:
  {V.classValue(A.tooltipClasses(False{})) == "tip" : String}

law aux_tip_classes_abaixo:
  {V.classValue(A.tooltipClasses(True{})) == "tip below" : String}

law aux_tip_aberto:
  {A.tooltipView(True{}, "dica", False{}) == V.viewEl("div", [V.attrClass("tip")], [V.viewText("dica")]) : V.ViewNode}

law aux_tip_aberto_sem_hidden:
  {V.attrGet(V.attrsOf(A.tooltipView(True{}, "dica", False{})), "hidden") == None{} : Maybe<&2, String>}

law aux_tip_fechado:
  {V.attrGet(V.attrsOf(A.tooltipView(False{}, "dica", False{})), "hidden") == Some{""} : Maybe<&2, String>}

law aux_tip_abaixo:
  {V.attrGet(V.attrsOf(A.tooltipView(True{}, "dica", True{})), "class") == Some{"tip below"} : Maybe<&2, String>}

law aux_tip_texto:
  {V.kidsOf(A.tooltipView(True{}, "dica", False{})) == [V.viewText("dica")] : List<&2, V.ViewNode>}

# ---------- avisos de conclusão ----------

law aux_notify_linha_marcada:
  {A.checkRow("notify-sound", "Som", True{}) == V.viewEl("label", [V.attrClass("set-check")], [
      V.viewEl("input", [V.ViewAttr{"type", "checkbox"}, V.ViewAttr{"id", "notify-sound"}, V.ViewAttr{"on:change", "SetNotify"}, V.ViewAttr{"checked", ""}], Nil{}),
      V.viewEl("span", Nil{}, [V.viewText("Som")])
    ]) : V.ViewNode}

law aux_notify_linha_vazia:
  {A.checkRow("notify-sound", "Som", False{}) == V.viewEl("label", [V.attrClass("set-check")], [
      V.viewEl("input", [V.ViewAttr{"type", "checkbox"}, V.ViewAttr{"id", "notify-sound"}, V.ViewAttr{"on:change", "SetNotify"}], Nil{}),
      V.viewEl("span", Nil{}, [V.viewText("Som")])
    ]) : V.ViewNode}

law aux_notify_linhas_len:
  {List.length(&2, V.ViewNode, A.notifyRows(A.NotifyPrefs{True{}, True{}, False{}})) == 3n : Nat}

# Ordem e marcação das três linhas (som, notificação, foco).
law aux_notify_linhas:
  {A.notifyRows(A.NotifyPrefs{True{}, True{}, False{}}) == [
      A.checkRow("notify-sound", "Som", True{}),
      A.checkRow("notify-desktop", "Notificação", True{}),
      A.checkRow("notify-focused", "Avisar mesmo com a janela em foco", False{})
    ] : List<&2, V.ViewNode>}

law aux_notify_grupo_id:
  {V.attrGet(V.attrsOf(A.notifyGroup(A.NotifyPrefs{True{}, True{}, False{}})), "id") == Some{"notify-mode"} : Maybe<&2, String>}

law aux_notify_grupo_papel:
  {V.attrGet(V.attrsOf(A.notifyGroup(A.NotifyPrefs{True{}, True{}, False{}})), "role") == Some{"group"} : Maybe<&2, String>}

law aux_notify_grupo_rotulo:
  {V.attrGet(V.attrsOf(A.notifyGroup(A.NotifyPrefs{True{}, True{}, False{}})), "aria-label") == Some{"Avisos de conclusão"} : Maybe<&2, String>}

law aux_notify_controles_len:
  {List.length(&2, V.ViewNode, A.notifyControls(A.NotifyPrefs{True{}, True{}, False{}})) == 4n : Nat}

law aux_notify_legenda:
  {A.notifyLegend() == V.viewEl("span", [V.attrClass("set-group-label")], [V.viewText("Avisos de conclusão")]) : V.ViewNode}
