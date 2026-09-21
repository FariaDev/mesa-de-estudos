import Base
import ../view.bend as V
import ../gaugeview.bend as G

# ---------------------------------------------------------------------------
# Contrato do medidor de contexto da Conversa (`#context-gauge` + `#ctx-pop`).
#
# Cenários concretos: `String.eq`/`is_empty`/`Nat.show` não reduzem
# genericamente, então cada lei fixa as entradas e o checker normaliza os dois
# lados. O que fica de fora (medida/posicionamento do balão, foco, IPC de
# saúde, fila de timers e a troca dos slots pelo SVG do host) é host.
# ---------------------------------------------------------------------------

def at(xs: List<&2, V.ViewNode>, i: Nat) -> V.ViewNode:
  match xs i:
    case Nil{} _:
      V.viewText("")
    case Con{h, t} 0n:
      h
    case Con{h, t} 1n+p:
      at(t, p)

def kind(n: V.ViewNode, i: Nat) -> V.ViewNode:
  at(V.kidsOf(n), i)

def attrOf(n: V.ViewNode, name: String) -> Maybe<&2, String>:
  V.attrGet(V.attrsOf(n), name)

def textOfKid(n: V.ViewNode, i: Nat) -> String:
  V.textOf(at(V.kidsOf(at(V.kidsOf(kind(n, i)), 0n)), 0n))

def totalFacts(open: Bool, pct: Nat) -> G.GaugeFacts:
  G.GaugeFacts{open, pct, "42%", "84 mil", "200 mil", "116 mil", "1,2 mi", "42.0%"}

# ---------- textos ----------

law gv_title:
  {G.gaugeTitle() == "Janela de contexto" : String}

law gv_close_text:
  {G.gaugeCloseText() == "Fechar" : String}

law gv_used_label:
  {G.gaugeUsedLabel() == "Usado" : String}

law gv_window_label:
  {G.gaugeWindowLabel() == "Janela" : String}

law gv_remain_label:
  {G.gaugeRemainLabel() == "Restante" : String}

law gv_total_label:
  {G.gaugeTotalLabel() == "Total processado" : String}

law gv_context_label:
  {G.contextLabel("0,6%") == "Contexto: 0,6% usado" : String}

# ---------- corte de aviso: over (>90), como no app ----------

# `over` é o gancho do CSS da Conversa; mantém o corte histórico (>90).
law gv_over_90:
  {G.gaugeOver(90n) == False{} : Bool}

law gv_over_91:
  {G.gaugeOver(91n) == True{} : Bool}

# ---------- botão ----------

law gv_btn_tag:
  {V.tagOf(G.gaugeButton(G.sampleFacts(False{}, 30n))) == "button" : String}

law gv_btn_type:
  {attrOf(G.gaugeButton(G.sampleFacts(False{}, 30n)), "type") == Some{"button"} : Maybe<&2, String>}

law gv_btn_class_low:
  {attrOf(G.gaugeButton(G.sampleFacts(False{}, 30n)), "class") == Some{"ctx-btn"} : Maybe<&2, String>}

law gv_btn_class_mid:
  {attrOf(G.gaugeButton(G.sampleFacts(False{}, 70n)), "class") == Some{"ctx-btn"} : Maybe<&2, String>}

law gv_btn_class_high:
  {attrOf(G.gaugeButton(G.sampleFacts(False{}, 85n)), "class") == Some{"ctx-btn"} : Maybe<&2, String>}

law gv_btn_class_over:
  {attrOf(G.gaugeButton(G.sampleFacts(False{}, 92n)), "class") == Some{"ctx-btn over"} : Maybe<&2, String>}

law gv_btn_haspopup:
  {attrOf(G.gaugeButton(G.sampleFacts(False{}, 30n)), "aria-haspopup") == Some{"dialog"} : Maybe<&2, String>}

law gv_btn_controls:
  {attrOf(G.gaugeButton(G.sampleFacts(False{}, 30n)), "aria-controls") == Some{"ctx-pop"} : Maybe<&2, String>}

law gv_btn_expanded_closed:
  {attrOf(G.gaugeButton(G.sampleFacts(False{}, 30n)), "aria-expanded") == Some{"false"} : Maybe<&2, String>}

law gv_btn_expanded_open:
  {attrOf(G.gaugeButton(G.sampleFacts(True{}, 30n)), "aria-expanded") == Some{"true"} : Maybe<&2, String>}

law gv_btn_label:
  {attrOf(G.gaugeButton(G.sampleFacts(False{}, 30n)), "aria-label") == Some{"Contexto: 0,6% usado"} : Maybe<&2, String>}

law gv_btn_title:
  {attrOf(G.gaugeButton(G.sampleFacts(False{}, 30n)), "title") == Some{"Contexto: 0,6% usado"} : Maybe<&2, String>}

law gv_btn_click:
  {attrOf(G.gaugeButton(G.sampleFacts(False{}, 30n)), "on:click") == Some{"toggle"} : Maybe<&2, String>}

law gv_btn_keydown:
  {attrOf(G.gaugeButton(G.sampleFacts(False{}, 30n)), "on:keydown") == Some{"key"} : Maybe<&2, String>}

# O anel é um slot: o host troca o `.icon-slot` pelo SVG (`ctx-donut`).
law gv_btn_slot:
  {V.kidsOf(G.gaugeButton(G.sampleFacts(False{}, 30n))) == [
      V.viewEl("span", [V.attrClass("icon-slot")], [V.viewText("ctx-donut")])
    ] : List<&2, V.ViewNode>}

# ---------- balão: casca ----------

law gv_pop_id:
  {attrOf(G.gaugePop(G.sampleFacts(False{}, 30n)), "id") == Some{"ctx-pop"} : Maybe<&2, String>}

law gv_pop_class_low:
  {attrOf(G.gaugePop(G.sampleFacts(False{}, 30n)), "class") == Some{"ctx-pop"} : Maybe<&2, String>}

law gv_pop_class_over:
  {attrOf(G.gaugePop(G.sampleFacts(False{}, 92n)), "class") == Some{"ctx-pop over"} : Maybe<&2, String>}

law gv_pop_role:
  {attrOf(G.gaugePop(G.sampleFacts(False{}, 30n)), "role") == Some{"dialog"} : Maybe<&2, String>}

law gv_pop_aria:
  {attrOf(G.gaugePop(G.sampleFacts(False{}, 30n)), "aria-label") == Some{"Janela de contexto"} : Maybe<&2, String>}

law gv_pop_hidden_closed:
  {attrOf(G.gaugePop(G.sampleFacts(False{}, 30n)), "hidden") == Some{""} : Maybe<&2, String>}

law gv_pop_shown_open:
  {attrOf(G.gaugePop(G.sampleFacts(True{}, 30n)), "hidden") == None{} : Maybe<&2, String>}

law gv_pop_kids:
  {List.length(&2, V.ViewNode, V.kidsOf(G.gaugePop(G.sampleFacts(False{}, 30n)))) == 7n : Nat}

law gv_pop_head_class:
  {attrOf(kind(G.gaugePop(G.sampleFacts(False{}, 30n)), 0n), "class") == Some{"ctx-head"} : Maybe<&2, String>}

law gv_pop_pct_class:
  {attrOf(kind(G.gaugePop(G.sampleFacts(False{}, 30n)), 1n), "class") == Some{"ctx-row"} : Maybe<&2, String>}

law gv_pop_stat_class:
  {attrOf(kind(G.gaugePop(G.sampleFacts(False{}, 30n)), 2n), "class") == Some{"ctx-row ctx-stat"} : Maybe<&2, String>}

law gv_pop_bar_class:
  {attrOf(kind(G.gaugePop(G.sampleFacts(False{}, 30n)), 5n), "class") == Some{"ctx-bar"} : Maybe<&2, String>}

law gv_pop_total_class:
  {attrOf(kind(G.gaugePop(G.sampleFacts(False{}, 30n)), 6n), "class") == Some{"ctx-row ctx-total"} : Maybe<&2, String>}

# ---------- balão: cabeçalho e fechar ----------

law gv_head_title:
  {textOfKid(G.gaugePop(G.sampleFacts(False{}, 30n)), 0n) == "Janela de contexto" : String}

law gv_head_label_class:
  {attrOf(kind(kind(G.gaugePop(G.sampleFacts(False{}, 30n)), 0n), 0n), "class") == Some{"ctx-label"} : Maybe<&2, String>}

law gv_head_close_class:
  {attrOf(kind(kind(G.gaugePop(G.sampleFacts(False{}, 30n)), 0n), 1n), "class") == Some{"ctx-close"} : Maybe<&2, String>}

law gv_close_aria:
  {attrOf(kind(kind(G.gaugePop(G.sampleFacts(False{}, 30n)), 0n), 1n), "aria-label") == Some{"Fechar"} : Maybe<&2, String>}

law gv_close_title:
  {attrOf(kind(kind(G.gaugePop(G.sampleFacts(False{}, 30n)), 0n), 1n), "title") == Some{"Fechar"} : Maybe<&2, String>}

law gv_close_click:
  {attrOf(kind(kind(G.gaugePop(G.sampleFacts(False{}, 30n)), 0n), 1n), "on:click") == Some{"close"} : Maybe<&2, String>}

law gv_close_slot:
  {attrOf(kind(kind(kind(G.gaugePop(G.sampleFacts(False{}, 30n)), 0n), 1n), 0n), "class") == Some{"icon-slot"} : Maybe<&2, String>}

law gv_close_slot_text:
  {V.textOf(at(V.kidsOf(kind(kind(kind(G.gaugePop(G.sampleFacts(False{}, 30n)), 0n), 1n), 0n)), 0n)) == "x" : String}

# ---------- balão: porcentual e estatísticas ----------

law gv_pct_text:
  {textOfKid(G.gaugePop(G.sampleFacts(False{}, 30n)), 1n) == "0,6%" : String}

law gv_stat_used:
  {attrOf(kind(kind(G.gaugePop(G.sampleFacts(False{}, 30n)), 2n), 0n), "class") == Some{"ctx-label"} : Maybe<&2, String>}

law gv_stat_used_label:
  {textOfKid(G.gaugePop(G.sampleFacts(False{}, 30n)), 2n) == "Usado" : String}

law gv_stat_window_label:
  {textOfKid(G.gaugePop(G.sampleFacts(False{}, 30n)), 3n) == "Janela" : String}

law gv_stat_remain_label:
  {textOfKid(G.gaugePop(G.sampleFacts(False{}, 30n)), 4n) == "Restante" : String}

law gv_stat_value:
  {V.textOf(at(V.kidsOf(kind(kind(G.gaugePop(G.sampleFacts(False{}, 30n)), 2n), 1n)), 0n)) == "1,2 mil" : String}

law gv_stat_num_class:
  {attrOf(kind(kind(G.gaugePop(G.sampleFacts(False{}, 30n)), 2n), 1n), "class") == Some{"ctx-num"} : Maybe<&2, String>}

law gv_stat_visible:
  {attrOf(kind(G.gaugePop(G.sampleFacts(False{}, 30n)), 2n), "hidden") == None{} : Maybe<&2, String>}

law gv_stat_hidden_empty:
  {attrOf(kind(G.gaugePop(G.emptyFacts(False{}, 30n)), 2n), "hidden") == Some{""} : Maybe<&2, String>}

law gv_stat_hidden_empty_window:
  {attrOf(kind(G.gaugePop(G.emptyFacts(False{}, 30n)), 3n), "hidden") == Some{""} : Maybe<&2, String>}

law gv_stat_hidden_empty_remain:
  {attrOf(kind(G.gaugePop(G.emptyFacts(False{}, 30n)), 4n), "hidden") == Some{""} : Maybe<&2, String>}

# ---------- balão: barra e total ----------

law gv_bar_fill_class:
  {attrOf(kind(kind(G.gaugePop(G.sampleFacts(False{}, 30n)), 5n), 0n), "class") == Some{"ctx-fill"} : Maybe<&2, String>}

law gv_bar_fill_style:
  {attrOf(kind(kind(G.gaugePop(G.sampleFacts(False{}, 30n)), 5n), 0n), "style") == Some{"width:0.6%"} : Maybe<&2, String>}

law gv_total_hidden_empty:
  {attrOf(kind(G.gaugePop(G.sampleFacts(False{}, 30n)), 6n), "hidden") == Some{""} : Maybe<&2, String>}

law gv_total_row_label:
  {textOfKid(G.gaugePop(totalFacts(False{}, 42n)), 6n) == "Total processado" : String}

law gv_total_visible:
  {attrOf(kind(G.gaugePop(totalFacts(False{}, 42n)), 6n), "hidden") == None{} : Maybe<&2, String>}

law gv_total_value:
  {V.textOf(at(V.kidsOf(kind(kind(G.gaugePop(totalFacts(False{}, 42n)), 6n), 1n)), 0n)) == "1,2 mi" : String}
