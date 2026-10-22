import Base
import ../msg.bend as M
import ../mesaqollayout.bend as L

# ---------------------------------------------------------------------------
# Contrato do layout da Mesa. Prefixo `layout_`.
#
# As leis fecham em valores concretos: limites, clamp, nome aparado, a
# normalização do layout inteiro, a decisão mínima da área de apoio e os três
# embutidos (Leitura/Exercícios/Comparar).
# ---------------------------------------------------------------------------

def doisMin(+a: Bool, +b: Bool) -> List<&2, Bool>:
  Con{a, Con{b, Nil{}}}

# ---------- limites ----------

law layout_limits:
  {L.minChat() == 300n : Nat}

law layout_max_chat:
  {L.maxChat() == 700n : Nat}

law layout_min_calc:
  {L.minCalc() == 72n : Nat}

law layout_max_calc:
  {L.maxCalc() == 900n : Nat}

law layout_min_split:
  {L.minSplit() == 200n : Nat}

law layout_max_split:
  {L.maxSplit() == 800n : Nat}

law layout_max_name:
  {L.maxName() == 60n : Nat}

law layout_max_presets:
  {L.maxPresets() == 24n : Nat}

# ---------- clamp ----------

law layout_clamp_below:
  {L.clamp(1n, 300n, 700n) == 300n : Nat}

law layout_clamp_inside:
  {L.clamp(420n, 300n, 700n) == 420n : Nat}

law layout_clamp_above:
  {L.clamp(9999n, 300n, 700n) == 700n : Nat}

# ---------- nome ----------

law layout_name_trims:
  {L.name("  Cálculo I  ") == "Cálculo I" : String}

law layout_name_caps:
  {String.length(L.name("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")) == 60n : Nat}

# ---------- layout inteiro ----------

law layout_normalizes:
  {L.facts(L.layout(1n, 9999n, 1n, False{}, False{}, False{}, doisMin(False{}, False{})))
    == "300/900/20/0/0" : String}

law layout_keeps_inside:
  {L.facts(L.layout(420n, 220n, 500n, False{}, False{}, False{}, doisMin(False{}, False{})))
    == "420/220/50/0/0" : String}

law layout_caps_minimized:
  {L.facts(L.layout(420n, 220n, 500n, False{}, False{}, False{}, Con{True{}, Con{False{}, Con{True{}, Nil{}}}}))
    == "420/220/50/1/0" : String}

law layout_counts_both_minimized:
  {L.facts(L.layout(420n, 220n, 500n, False{}, False{}, False{}, doisMin(True{}, True{})))
    == "420/220/50/2/0" : String}

law layout_chat_collapsed:
  {L.facts(L.layout(420n, 220n, 500n, True{}, False{}, False{}, doisMin(False{}, False{})))
    == "420/220/50/0/1" : String}

law layout_split_rounds:
  {L.facts(L.layout(420n, 220n, 625n, False{}, False{}, False{}, doisMin(False{}, False{})))
    == "420/220/63/0/0" : String}

# ---------- área de apoio ----------

law layout_ref_two_false:
  {L.referenceAction(False{}, False{}, False{}, False{}) == "none" : String}

law layout_ref_sem_mexer:
  {L.referenceAction(True{}, True{}, True{}, True{}) == "none" : String}

law layout_ref_esconde:
  {L.referenceAction(True{}, True{}, True{}, False{}) == "hide" : String}

law layout_ref_mostra_recolhido:
  {L.referenceAction(True{}, True{}, False{}, True{}) == "show" : String}

law layout_ref_mostra_do_chat:
  {L.referenceAction(True{}, False{}, False{}, True{}) == "show" : String}

law layout_ref_chat_a_frente_nao_mexe:
  {L.referenceAction(True{}, False{}, True{}, False{}) == "none" : String}

# ---------- embutidos ----------

law layout_builtin_leitura_id:
  {L.leituraId() == "mesa-leitura" : String}

law layout_builtin_exercicios_id:
  {L.exerciciosId() == "mesa-exercicios" : String}

law layout_builtin_comparar_id:
  {L.compararId() == "mesa-comparar" : String}

law layout_builtin_leitura_nome:
  {L.builtinName("mesa-leitura") == M.msg("layout.builtin.reading") : String}

law layout_builtin_exercicios_nome:
  {L.builtinName("mesa-exercicios") == M.msg("layout.builtin.exercises") : String}

law layout_builtin_comparar_nome:
  {L.builtinName("mesa-comparar") == M.msg("layout.builtin.compare") : String}

law layout_builtin_is:
  {L.isBuiltin("mesa-comparar") == True{} : Bool}

law layout_builtin_isnt:
  {L.isBuiltin("p-abc123") == False{} : Bool}

law layout_builtin_leitura_summary:
  {L.facts(L.leituraLayout())
    == "420/220/50/0/0" : String}

law layout_builtin_exercicios_summary:
  {L.facts(L.exerciciosLayout())
    == "360/420/50/0/0" : String}

law layout_builtin_comparar_summary:
  {L.facts(L.compararLayout())
    == "330/220/50/0/1" : String}

law layout_builtin_layout_leitura:
  {L.builtinLayout("mesa-leitura") == Some{L.leituraLayout()} : Maybe<&2, L.LayoutView>}
