import Base
import ../mesaqolescape.bend as E

# ---------------------------------------------------------------------------
# Contrato do Esc da Mesa. Prefixo `escape_`.
#
# As leis fecham em valores concretos (fatos Bool viram `True{}`/`False{}`) e
# cobrem: precedência de cada camada sobre as de baixo, o tutor por último e a
# garantia de que fechar camada não para o turno.
# ---------------------------------------------------------------------------

# ---------- ordem completa ----------

law escape_modal_ganha_de_tudo:
  {E.escapeAction(E.EscapeFacts{True{}, True{}, True{}, True{}, True{}, True{}, True{}}) == "modal" : String}

law escape_paleta_ganha_do_resto:
  {E.escapeAction(E.EscapeFacts{False{}, True{}, True{}, True{}, True{}, True{}, True{}}) == "palette" : String}

law escape_menu_ganha_do_resto:
  {E.escapeAction(E.EscapeFacts{False{}, False{}, True{}, True{}, True{}, True{}, True{}}) == "menu" : String}

law escape_popover_ganha_do_resto:
  {E.escapeAction(E.EscapeFacts{False{}, False{}, False{}, True{}, True{}, True{}, True{}}) == "popover" : String}

law escape_citacao_ganha_do_resto:
  {E.escapeAction(E.EscapeFacts{False{}, False{}, False{}, False{}, True{}, True{}, True{}}) == "citation" : String}

law escape_busca_ganha_do_tutor:
  {E.escapeAction(E.EscapeFacts{False{}, False{}, False{}, False{}, False{}, True{}, True{}}) == "search" : String}

law escape_tutor_por_ultimo:
  {E.escapeAction(E.EscapeFacts{False{}, False{}, False{}, False{}, False{}, False{}, True{}}) == "tutor" : String}

law escape_nada_aberto:
  {E.escapeAction(E.EscapeFacts{False{}, False{}, False{}, False{}, False{}, False{}, False{}}) == "none" : String}

# ---------- fechar camada não para o turno ----------

law escape_modal_nao_para:
  {E.escapeAction(E.EscapeFacts{True{}, True{}, True{}, True{}, True{}, True{}, True{}}) == "modal" : String}

law escape_stops_tutor_modal:
  {E.stopsTutor("modal") == False{} : Bool}

law escape_stops_tutor_paleta:
  {E.stopsTutor("palette") == False{} : Bool}

law escape_stops_tutor_busca:
  {E.stopsTutor("search") == False{} : Bool}

law escape_stops_tutor_tutor:
  {E.stopsTutor("tutor") == True{} : Bool}

law escape_stops_tutor_none:
  {E.stopsTutor("none") == False{} : Bool}
