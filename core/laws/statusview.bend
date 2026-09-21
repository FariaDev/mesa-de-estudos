import Base
import ../view.bend as V
import ../statusview.bend as SV

# ---------------------------------------------------------------------------
# Contrato do status (rodapé, medidor, conexão, compactação, modelo/sessão).
#
# Tudo aqui é cenário concreto: `String.eq`/`String.is_empty`/`Nat.show` não
# reduzem genericamente em string livre/`Nat` livre, então as leis fixam as
# entradas e o checker normaliza os dois lados. As leis de lista valem para a
# lista concreta montada; não há binder abstrato a analisar.
# ---------------------------------------------------------------------------

# ---------- rodapé: itens e separadores ----------

law statusview_foot_empty:
  {SV.footItems("", "", "") == Nil{} : List<&2, V.ViewNode>}

law statusview_foot_only_model:
  {SV.footItems("Pi", "", "") == [
      V.viewEl("span", [V.attrClass("fs-item fs-model")], [V.viewText("Pi")])
    ] : List<&2, V.ViewNode>}

# Um separador "·" (aria-hidden) entre cada par de itens presentes.
law statusview_foot_three:
  {SV.footItems("Pi", "Alto", "42%") == [
      V.viewEl("span", [V.attrClass("fs-item fs-model")], [V.viewText("Pi")]),
      V.viewEl("span", [V.attrClass("fs-sep"), V.attrBool("aria-hidden", True{})], [V.viewText("·")]),
      V.viewEl("span", [V.attrClass("fs-item fs-eff")], [V.viewText("Alto")]),
      V.viewEl("span", [V.attrClass("fs-sep"), V.attrBool("aria-hidden", True{})], [V.viewText("·")]),
      V.viewEl("span", [V.attrClass("fs-item fs-ctx")], [V.viewText("42%")])
    ] : List<&2, V.ViewNode>}

law statusview_foot_hidden_empty:
  {V.attrGet(V.attrsOf(SV.footStatus("", "", "", "", "")), "hidden") == Some{""} : Maybe<&2, String>}

law statusview_foot_shown:
  {V.attrGet(V.attrsOf(SV.footStatus("Pi", "", "", "", "")), "hidden") == None{} : Maybe<&2, String>}

law statusview_foot_click:
  {V.attrGet(V.attrsOf(SV.footStatus("Pi", "", "", "", "")), "on:click") == Some{"toggleMeterTip"} : Maybe<&2, String>}

# ---------- rodapé: tooltip ----------

law statusview_foot_tip_join:
  {SV.footTip("Pi", "Alto", "42%", "", "") == "Pi · Alto · 42%" : String}

law statusview_foot_tip_detail:
  {SV.footTip("Pi", "", "42%", "Contexto do modelo: 42%", "") == "Pi · Contexto do modelo: 42%" : String}

law statusview_foot_tip_empty:
  {SV.footTip("", "", "", "", "") == "" : String}

law statusview_foot_tip_fallback:
  {SV.footTip("", "", "42%", "", "") == "42%" : String}

# O host pode mandar o balão pronto (chips com provider/prefixo); aí o núcleo não recompõe.
law statusview_foot_tip_override:
  {SV.footTip("Pi", "Alto", "42%", "", "Nome · provider · Esforço: Alto · Contexto: 42% usado") == "Nome · provider · Esforço: Alto · Contexto: 42% usado" : String}

law statusview_foot_data_tip_override:
  {V.attrGet(V.attrsOf(SV.footStatus("Pi", "Alto", "42%", "", "balão pronto")), "data-tip") == Some{"balão pronto"} : Maybe<&2, String>}

law statusview_foot_data_tip:
  {V.attrGet(V.attrsOf(SV.footStatus("Pi", "Alto", "42%", "", "")), "data-tip") == Some{"Pi · Alto · 42%"} : Maybe<&2, String>}

# O balão do tooltip vive no `dataset.tip`; `title` re-renderizado apagaria.
law statusview_foot_no_title:
  {V.attrGet(V.attrsOf(SV.footStatus("Pi", "", "", "", "")), "title") == None{} : Maybe<&2, String>}

law statusview_foot_aria_fallback:
  {V.attrGet(V.attrsOf(SV.footStatus("", "", "", "", "")), "aria-label") == Some{"Status do modelo"} : Maybe<&2, String>}

# ---------- medidor ----------

law statusview_meter_text:
  {SV.meterText(42n) == "42%" : String}

law statusview_meter_width:
  {SV.meterWidth(42n) == "width:42%" : String}

law statusview_meter_warn:
  {SV.meterWarn(60n) == True{} : Bool}

law statusview_meter_warn_off:
  {SV.meterWarn(85n) == False{} : Bool}

law statusview_meter_hot:
  {SV.meterHot(85n) == True{} : Bool}

law statusview_meter_hot_cold:
  {SV.meterHot(84n) == False{} : Bool}

law statusview_meter_hidden:
  {V.attrGet(V.attrsOf(SV.ctxMeter(False{}, 42n)), "hidden") == Some{""} : Maybe<&2, String>}

law statusview_meter_visible:
  {V.attrGet(V.attrsOf(SV.ctxMeter(True{}, 42n)), "hidden") == None{} : Maybe<&2, String>}

law statusview_meter_class_warn:
  {V.attrGet(V.attrsOf(SV.ctxMeter(True{}, 70n)), "class") == Some{"warn"} : Maybe<&2, String>}

law statusview_meter_class_hot:
  {V.attrGet(V.attrsOf(SV.ctxMeter(True{}, 85n)), "class") == Some{"hot"} : Maybe<&2, String>}

# Abaixo dos cortes a classe é vazia (o host pula `class` vazia no apply).
law statusview_meter_no_class:
  {V.attrGet(V.attrsOf(SV.ctxMeter(True{}, 30n)), "class") == Some{""} : Maybe<&2, String>}

law statusview_meter_kids:
  {V.kidsOf(SV.ctxMeter(True{}, 42n)) == [
      V.viewEl("span", [V.attrClass("bar")], [V.viewEl("i", [V.ViewAttr{"style", "width:42%"}], Nil{})]),
      V.viewEl("em", Nil{}, [V.viewText("42%")])
    ] : List<&2, V.ViewNode>}

# O balão do medidor é o `#ctx-tip` do host; a delegação de tooltip pula.
law statusview_meter_no_tip:
  {V.attrGet(V.attrsOf(SV.ctxMeter(True{}, 42n)), "data-no-tip") == Some{""} : Maybe<&2, String>}

# ---------- balão do medidor (#ctx-tip) ----------
# O texto e o `hidden` são fatos; medir/posicionar e os eventos de hover, foco
# e clique (rodapé) ficam no host. `title` nunca entra: o aplicador re-renderiza
# o nó vivo e um title apagaria o balão armado.

law statusview_tip_id:
  {V.attrGet(V.attrsOf(SV.ctxTip("detalhe", False{})), "id") == Some{"ctx-tip"} : Maybe<&2, String>}

law statusview_tip_texto:
  {V.kidsOf(SV.ctxTip("detalhe", False{})) == [V.viewText("detalhe")] : List<&2, V.ViewNode>}

law statusview_tip_aberto:
  {V.attrGet(V.attrsOf(SV.ctxTip("detalhe", False{})), "hidden") == None{} : Maybe<&2, String>}

law statusview_tip_escondido:
  {V.attrGet(V.attrsOf(SV.ctxTip("detalhe", True{})), "hidden") == Some{""} : Maybe<&2, String>}

law statusview_tip_sem_title:
  {V.attrGet(V.attrsOf(SV.ctxTip("detalhe", False{})), "title") == None{} : Maybe<&2, String>}

# ---------- conexão ----------

law statusview_dot_online:
  {V.attrGet(V.attrsOf(SV.statusDot(SV.ConnOnline{}, "Pi conectado")), "class") == Some{"online"} : Maybe<&2, String>}

law statusview_dot_error:
  {V.attrGet(V.attrsOf(SV.statusDot(SV.ConnError{}, "Falha")), "class") == Some{"error"} : Maybe<&2, String>}

law statusview_dot_off:
  {V.attrGet(V.attrsOf(SV.statusDot(SV.ConnOff{}, "Pi desconectado")), "class") == Some{""} : Maybe<&2, String>}

law statusview_dot_tip:
  {V.attrGet(V.attrsOf(SV.statusDot(SV.ConnOnline{}, "Pi conectado")), "data-tip") == Some{"Pi conectado"} : Maybe<&2, String>}

law statusview_dot_aria:
  {V.attrGet(V.attrsOf(SV.statusDot(SV.ConnOff{}, "")), "aria-label") == Some{"Pi desconectado"} : Maybe<&2, String>}

# ---------- compactação automática ----------

law statusview_compact_hidden:
  {V.attrGet(V.attrsOf(SV.autoCompact(False{}, True{}, "tip")), "hidden") == Some{""} : Maybe<&2, String>}

law statusview_compact_shown:
  {V.attrGet(V.attrsOf(SV.autoCompact(True{}, False{}, "tip")), "hidden") == None{} : Maybe<&2, String>}

law statusview_compact_pressed:
  {V.attrGet(V.attrsOf(SV.autoCompact(True{}, True{}, "tip")), "aria-pressed") == Some{"true"} : Maybe<&2, String>}

law statusview_compact_unpressed:
  {V.attrGet(V.attrsOf(SV.autoCompact(True{}, False{}, "tip")), "aria-pressed") == Some{"false"} : Maybe<&2, String>}

law statusview_compact_off_class:
  {V.attrGet(V.attrsOf(SV.autoCompact(True{}, False{}, "tip")), "class") == Some{""} : Maybe<&2, String>}

# ---------- modelo / sessão ----------

law statusview_pi_label:
  {V.kidsOf(SV.piLabel("Pi")) == [V.viewText("Pi")] : List<&2, V.ViewNode>}

law statusview_session_options:
  {SV.sessionOptions("b", [SV.SessionChoice{"A", "a"}, SV.SessionChoice{"B", "b"}]) == [
      V.viewEl("option", [V.ViewAttr{"value", "a"}], [V.viewText("A")]),
      V.viewEl("option", [V.ViewAttr{"value", "b"}, V.ViewAttr{"selected", ""}], [V.viewText("B")])
    ] : List<&2, V.ViewNode>}

law statusview_session_select:
  {V.attrGet(V.attrsOf(SV.sessionSelect("a", True{}, Nil{})), "disabled") == Some{""} : Maybe<&2, String>}
