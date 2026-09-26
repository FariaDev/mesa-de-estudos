import Base
import ../handoff.bend as H

# ---------------------------------------------------------------------------
# Contrato do bilhete Conversa → Mesa. Prefixo `handoff_`.
#
# As leis fixam o formato (o que os dois apps precisam combinar) e a regra de
# aceitação. Listas não entram nas leis: `List<String>` não reduz numa lista
# livre, então a montagem com referências é coberta pelos testes do host, como
# já acontece no núcleo do contexto da Mesa.
# ---------------------------------------------------------------------------

# --- aceitação: o que faz um bilhete existir ---

# Sem objetivo e sem pergunta não há pedido.
law handoff_vazio_recusa:
  {H.accepted("", "") == False{} : Bool}

# Objetivo sozinho já é pedido.
law handoff_objetivo_aceita:
  {H.accepted("revisar limites", "") == True{} : Bool}

# Pergunta sozinha também.
law handoff_pergunta_aceita:
  {H.accepted("", "como isolar x?") == True{} : Bool}

# Objetivo vazio depois do trim não conta.
law handoff_objetivo_so_espaco_recusa:
  {H.accepted(H.cleanGoal("   "), "") == False{} : Bool}

# Pergunta só com espaços, idem.
law handoff_pergunta_so_espaco_recusa:
  {H.accepted("", H.cleanQuestion("  ")) == False{} : Bool}

# Referências não contam para a aceitação: é a assinatura da `accepted`.
law handoff_referencia_sozinha_recusa:
  {H.accepted(H.cleanGoal(""), H.cleanQuestion("")) == False{} : Bool}

# --- formato: o que os dois apps precisam combinar ---

law handoff_cabecalho:
  {H.header() == "[Da Conversa]" : String}

law handoff_linha_objetivo:
  {H.goalLine("revisar limites") == "- objetivo: revisar limites" : String}

law handoff_linha_pergunta:
  {H.questionLine("como isolar x?") == "- pergunta pendente: como isolar x?" : String}

law handoff_linha_referencia:
  {H.refLine("Limites.pdf") == "  · Limites.pdf" : String}

law handoff_cabecalho_referencias:
  {H.refsHeader() == "- referências trazidas da Conversa:" : String}

law handoff_linha_marcada:
  {H.seg("x") == "\nx" : String}

# --- limpeza dos campos ---

law handoff_objetivo_trim:
  {H.cleanGoal("  revisar limites  ") == "revisar limites" : String}

law handoff_objetivo_vazio:
  {H.cleanGoal("") == "" : String}

law handoff_pergunta_trim:
  {H.cleanQuestion("  como isolar x?  ") == "como isolar x?" : String}

# --- linhas opcionais ---

law handoff_opcional_vazio:
  {H.optional("x", True{}) == "" : String}

law handoff_opcional_presente:
  {H.optional("x", False{}) == "\nx" : String}

# --- aviso de bilhete antigo ---

law handoff_antigo_avisa:
  {String.contains(H.staleLine(True{}), "mais de um dia") == True{} : Bool}

law handoff_recente_nao_avisa:
  {H.staleLine(False{}) == "" : String}

# --- montagem ---

# Bilhete recusado não vira bloco, independente dos campos e do aviso.
law handoff_recusado_sem_bloco:
  {H.render("", "", Nil{}, False{}, True{}) == "" : String}

law handoff_recusado_sem_bloco_recente:
  {H.render("", "", Nil{}, False{}, False{}) == "" : String}
